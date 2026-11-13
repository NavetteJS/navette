---
title: Multi-tenancy
---

## Introduction

Multi-tenancy is a concept where a single instance of an application serves multiple customers. Each customer has their own data and access rules that prevent them from viewing or modifying each other's data.

In Navette, a tenant is whatever groups your users: a team, an organization, a company. A user may belong to several tenants, and switches between them with the tenant menu. Every page of a multi-tenant panel lives under the key of a tenant, `/app/1/projects`, and only members of that tenant may open it.

## Setting up tenancy

To make a panel multi-tenant, give it a **tenant provider** with `tenant()`, and the column that links a record to its tenant:

```ts
import { knexTenantProvider, Panel } from '@navette-js/panels';

const panel = Panel.make()
    .id('app')
    .path('app')
    // ...
    .tenant(knexTenantProvider(knex, { label: 'Current team' }), { ownershipColumn: 'team_id' });
```

With `ownershipColumn`, the adapter of every resource of the panel is scoped to the tenant of the request:

- lists, record pages, global search and bulk selections only see the records whose `team_id` is the key of the current tenant;
- a record created in the panel receives the key of the current tenant in `team_id`, whatever the form sends;
- an update cannot reach a record of another tenant, and cannot change `team_id`.

The adapter must support this scoping: `ObjectionAdapter` does. A [custom adapter](/advanced/data-adapters#writing-your-own-adapter) must implement `scopeToTenant()`, otherwise `panelRouter()` throws an error at startup.

<Aside variant="danger">
Without `ownershipColumn`, nothing is scoped automatically: every resource sees the records of every tenant. Either set it, or scope each adapter yourself with `panel.getTenant()`.
</Aside>

### The tenant provider

A tenant provider implements the `TenantProvider` interface:

```ts
import type { TenantProvider } from '@navette-js/panels';

const teams: TenantProvider = {
    // Tenants the user is a member of: the tenant menu lists them.
    getTenants: (user) => knex('teams').join('team_user', 'team_user.team_id', 'teams.id').where('team_user.user_id', user.id).select('teams.*'),
    // Tenant from its key in the URL. The key comes from the browser: validate it.
    find: async (key) => (/^\d+$/.test(key) ? (await knex('teams').where('id', Number(key)).first()) ?? null : null),
    // Is the user a member of this tenant?
    canAccess: async (user, team) => Boolean(await knex('team_user').where({ user_id: user.id, team_id: team.id }).first()),
    getKey: (team) => String(team.id),
    getName: (team) => team.name,
};
```

Optional methods:

| Method | Description |
|---|---|
| `getCurrentTenantLabel(tenant)` | Text above the name of the tenant in the menu ("Current team"), or `null`. |
| `getAvatarUrl(tenant)` | Avatar of the tenant. By default, generated from its initials. |
| `create(data, user)` | Creates a tenant from the registration form; the user becomes a member. Enables tenant registration. |
| `update(tenant, data)` | Saves the tenant profile form. Enables the tenant profile page. |

### Using the Knex tenant provider

`knexTenantProvider()` implements every method for a `teams` table and a `team_user` pivot table:

```ts
knexTenantProvider(knex, {
    table: 'teams',          // the tenants
    pivot: 'team_user',      // the memberships
    foreignKey: 'team_id',   // column of the pivot pointing to the tenant
    userKey: 'user_id',      // column of the pivot pointing to the user
    nameAttribute: 'name',   // column displayed as the tenant name
    label: 'Current team',   // text above the name in the menu
});
```

Every option has the default shown above, except `label`, which is `null`. The key of a tenant is its numeric `id`.

## URL structure

| URL | Page |
|---|---|
| `/app` | Redirects to the first tenant of the user, or to the tenant registration page if they have none. |
| `/app/new` | [Tenant registration](#adding-a-tenant-registration-page). |
| `/app/1` | The dashboard of tenant `1`, or the first item of the navigation when the panel has no page at the root. |
| `/app/1/projects` | A resource page, in tenant `1`. |
| `/app/1/profile` | [Tenant profile](#adding-a-tenant-profile-page). |
| `/app/login`, `/app/register`, `/app/profile`… | Authentication pages, outside of any tenant. |

A URL with an unknown tenant key, or the key of a tenant the user is not a member of, answers 404. `getUrl()` on a resource, and `panel.getUrl()`, include the key of the current tenant.

## Adding a tenant registration page

A registration page lets users create a new tenant. Extend `RegisterTenant`, give it a label and a form, and register it with `tenantRegistration()`:

```ts
import { TextInput } from '@navette-js/forms';
import { RegisterTenant } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';

export class RegisterTeam extends RegisterTenant {
    static getLabel(): string { return 'New team'; }

    formSchema(schema: Schema): Schema {
        return schema.components([TextInput.make('name').required().maxLength(255)]);
    }
}

panel.tenantRegistration(RegisterTeam);
```

The page calls `create()` of the tenant provider with the validated data, then redirects to the new tenant. The menu of the tenant shows a link to it.

### Customizing the tenant registration page

`RegisterTenant` has the same hooks as the user registration page: `mutateFormDataBeforeRegister(data)` and `handleRegistration(data)`. To decide who may create tenants, override the static `canView()` method:

```ts
export class RegisterTeam extends RegisterTenant {
    static canView(panel: Panel, user: User): boolean {
        return user.role === 'owner';
    }
}
```

By default, the page is available when the provider has a `create()` method.

## Adding a tenant profile page

A profile page lets users edit the tenant. Extend `EditTenantProfile` and register it with `tenantProfile()`:

```ts
import { TextInput } from '@navette-js/forms';
import { EditTenantProfile } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';

export class EditTeamProfile extends EditTenantProfile {
    static getLabel(): string { return 'Team profile'; }

    formSchema(schema: Schema): Schema {
        return schema.components([TextInput.make('name').required().maxLength(255)]);
    }
}

panel.tenantProfile(EditTeamProfile);
```

The form is filled with the attributes of the current tenant, and saved with `update()` of the provider. The page uses the full layout, and is linked from the tenant menu.

<Aside variant="warning">
Every member of a tenant may open its profile page. To restrict it, check the user in `save()`, or register your own page.
</Aside>

## Accessing the current tenant

During a request, `panel.getTenant()` returns the current tenant, or `null` outside of a tenant:

```ts
const team = panel.getTenant();
```

In a page or an action, the panel is available as `this.panel` or `livewire.panel`. The tenant is also in the request context: `this._ctx.tenant`.

To run code for a tenant outside of a request, for example in a scheduled job, wrap it in `withTenant()`: the URLs and the scoped adapters use that tenant.

```ts
await panel.withTenant(team, async () => {
    const projects = await ProjectResource.adapter.paginate({ page: 1, perPage: 50 });
});
```

## Customizing the tenant menu

The tenant menu is displayed at the top of the sidebar. It shows the current tenant with its avatar, the other tenants of the user to switch to, and links to the tenant profile and registration pages.

To add items, pass actions with a URL to `tenantMenuItems()`. A negative `sort()` places the item above the list of tenants:

```ts
import { Action } from '@navette-js/actions';

panel.tenantMenuItems([
    Action.make('billing').label('Billing').icon('m-credit-card').url('/billing').sort(-1),
]);
```

### Customizing the registration and profile links

Register an item under the `register` or `profile` key to replace the default link:

```ts
panel.tenantMenuItems({
    // A function: the URL is computed for the tenant of each request.
    profile: Action.make('profile').label('Team settings').icon('m-cog-6-tooth').url(() => panel.getUrl('settings')),
});
```

### Hiding the tenant menu

```ts
panel.tenantMenu(false);
```

## Disabling tenancy for a resource

By default, every resource of a multi-tenant panel is scoped to the tenant. To share a resource between all tenants (a list of countries, for example), set `isScopedToTenant` to `false`:

```ts
export class CountryResource extends Resource {
    static isScopedToTenant = false;
}
```

When the column linking records to their tenant differs for one resource, set `tenantOwnershipColumn` on it:

```ts
export class InvoiceResource extends Resource {
    static tenantOwnershipColumn = 'company_id';
}
```

## Tenancy security

Navette protects the pages of a tenant from non-members, and scopes the adapters of resources. Some data remains yours to protect.

### Scoping queries to the current tenant

Only the adapters of the resources registered on the panel are scoped. These are not:

- the adapters returned by `adapterFor()` in [relation managers and relation pages](/resources/managing-relationships). They are limited to their owner record, which belongs to the tenant, but a record they create does not receive the tenant column: set it in the adapter;
- the queries you write yourself: widgets, custom pages, actions, select options. Filter them with `panel.getTenant()`;
- the adapter of a `TableWidget`.

### Protecting records between requests

The tenant of a request sent by a page is the tenant of the URL of that page, checked again for membership on every request. Records are read again through the scoped adapter on every request, so a key from another tenant is not found.

### `unique` validation

The `unique()` rule of a field checks the whole table, not only the records of the tenant. When a value only needs to be unique within a tenant, write your own rule.

<Aside variant="warning">
Billing, tenant search in the menu, a default tenant, tenant route prefixes and domains are not available yet.
</Aside>
