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

`getName()` may return an `HtmlString` (from `@navette-js/support`) to render HTML in the tenant menu, for instance an icon next to the name. Its text, without the tags, is used in the avatar's `alt` text. Escape the parts that come from your users yourself.

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
| `/app` | Redirects to the [default tenant](#setting-a-default-tenant) of the user, otherwise their first tenant, or to the tenant registration page if they have none. |
| `/app/new` | [Tenant registration](#adding-a-tenant-registration-page). |
| `/app/1` | The dashboard of tenant `1`, or the first item of the navigation when the panel has no page at the root. |
| `/app/1/projects` | A resource page, in tenant `1`. |
| `/app/1/profile` | [Tenant profile](#adding-a-tenant-profile-page). |
| `/app/login`, `/app/register`, `/app/profile`… | Authentication pages, outside of any tenant. |

A URL with an unknown tenant key, or the key of a tenant the user is not a member of, answers 404. `getUrl()` on a resource, and `panel.getUrl()`, include the key of the current tenant.

### Adding a prefix to tenant URLs

`tenantRoutePrefix()` adds a segment before the key of the tenant:

```ts
panel.tenantRoutePrefix('team');
```

The pages of tenant `1` are then at `/app/team/1`, `/app/team/1/projects`. The authentication pages are unchanged.

### Using a domain per tenant

A tenant may be identified by the host instead of the path: with `tenantDomain()`, the tenant `acme` is served at `acme.example.com/app`:

```ts
panel
    .tenantDomain('{tenant}.example.com')
    // The session cookie is shared by the subdomains, so that a sign-in holds on every tenant.
    .sessionCookieDomain('.example.com');
```

`{tenant}` is replaced with the key of the tenant (`getKey()` of the provider), in lowercase: use keys that are valid host labels, such as slugs. A port may follow the pattern in development (`{tenant}.localhost:3000`). On a host outside the pattern (`example.com`), the panel root redirects to the user's tenant. Any host matching the pattern designates a tenant, `www` included: a key that does not exist answers 404.

Links within a tenant are paths; links to another tenant, such as those of the tenant menu, are protocol-relative URLs to its host (`//globex.example.com/app`). Express reads the host from `req.hostname`: behind a proxy, set `trust proxy`.

<Aside variant="warning">
Point every tenant subdomain to the application (a wildcard DNS record and TLS certificate). Membership is checked on every request as for path-based tenants: a forged `Host` header cannot open the pages of a tenant the user does not belong to.
</Aside>

## Setting a default tenant

After signing in, users land on their first tenant. To choose another one (the last tenant they used, for example), implement `getDefaultTenant()` in the tenant provider:

```ts
const provider: TenantProvider<Team> = {
    // ...
    getDefaultTenant: (user) => findTeam(user.latest_team_id),
};
```

The tenant is only used if the user may still access it. `knexTenantProvider()` reads it from a column of the user with `defaultTenantAttribute`:

```ts
knexTenantProvider(knex, { defaultTenantAttribute: 'latest_team_id' });
```

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

## Running middleware once the tenant is known

`tenantMiddleware()` registers Express middleware that run on the pages of a tenant, once the tenant of the request is resolved and the user's access to it is checked. `res.locals.navette` holds `{ panel, user, tenant }`. Pass `true` as the second argument to run them on component updates too, as with the panel's [`middleware()`](/panels/configuration#registering-middleware-on-the-panel):

```ts
panel.tenantMiddleware([
    (req, res, next) => {
        setTenantTimezone(res.locals.navette.tenant.timezone);
        next();
    },
], true);
```

## Customizing the tenant menu

The tenant menu is displayed at the top of the sidebar. It shows the current tenant with its avatar, the other tenants of the user to switch to, and links to the tenant profile and registration pages.

To add items, pass actions to `tenantMenuItems()`. A negative `sort()` places the item above the list of tenants:

```ts
import { Action } from '@navette-js/actions';

panel.tenantMenuItems([
    Action.make('support').label('Support').icon('m-lifebuoy').url('https://support.example.com').sort(-1),
]);
```

The items work as in the [user menu](/panels/navigation#customizing-the-user-menu): a list of groups separates them, `ActionGroup` items form a group of their own, an action without a URL runs on the server (and may open a modal), and `postToUrl()` sends a `POST` request.

### Customizing the registration, profile and billing links

Register an item under the `register`, `profile` or `billing` key to replace the default link, or a function to change it:

```ts
panel.tenantMenuItems({
    // An action: the URL is computed for the tenant of each request.
    profile: Action.make('profile').label('Team settings').icon('m-cog-6-tooth').url(() => panel.getUrl('settings')),
    // A function: the default link, changed.
    billing: (action) => action.label('Plans and invoices'),
});
```

The `billing` item only exists with a [billing provider](#adding-billing).

### Disabling the tenant switcher

`tenantSwitcher(false)` removes the list of other tenants from the menu. The menu stays, with the current tenant and its links:

```ts
panel.tenantSwitcher(false);
```

### Searching tenants in the menu

From ten tenants to switch to, the menu has a search field. To always show it, or never:

```ts
panel.searchableTenantMenu();      // always
panel.searchableTenantMenu(false); // never
```

### Hiding the tenant menu

```ts
panel.tenantMenu(false);
```

## Adding billing

A billing provider handles the subscriptions of tenants: it serves the billing page of a tenant (`/app/1/billing`), usually a redirect to the customer portal of your payment provider, and the tenant menu gets a "Manage subscription" link to it.

```ts
import type { TenantBillingProvider } from '@navette-js/panels';

const billing: TenantBillingProvider<Team> = {
    async handle(req, res, team) {
        const session = await stripe.billingPortal.sessions.create({ customer: team.stripe_id, return_url: panel.getUrl('', team) });
        res.redirect(session.url);
    },
    isSubscribed: (team) => team.subscription_status === 'active',
};

panel.tenantBillingProvider(billing);
```

Change the URL segment with `tenantBillingRouteSlug('subscription')`. Replace or change the link with the [`billing` key](#customizing-the-registration-profile-and-billing-links) of `tenantMenuItems()`.

### Requiring a subscription

With `requiresTenantSubscription()`, the pages of a tenant without an active subscription (`isSubscribed()` returns `false`) redirect to its billing page, and their updates are refused:

```ts
panel.tenantBillingProvider(billing).requiresTenantSubscription();
```

The provider must then implement `isSubscribed()`. A page can stay open without a subscription:

```ts
export class Help extends Page {
    static isTenantSubscriptionRequired(): boolean { return false; }
}
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

The `unique()` rule of a field checks the whole table, not only the records of the tenant. When a value only needs to be unique within a tenant, use `scopedUnique()`: it checks the records that the data adapter of the resource can see, so within the current tenant, and without the soft-deleted records. `scopedExists()` is the matching `exists` rule (as in Filament, it also accepts soft-deleted records):

```ts
TextInput.make('slug').scopedUnique({ ignoreRecord: true })
Select.make('category_id').scopedExists({ adapter: new ObjectionAdapter(Category).scopedTo('team_id', currentTeamId), column: 'id' })
```

`ignoreRecord` excludes the record being edited. Without `adapter`, both rules use the adapter of the resource, so they check its own table: pass another adapter (an `ObjectionAdapter`, whose tenant and column scopes apply) to check another table, as for the category above. Both rules also accept `model` (an Objection model, queried as is), `column`, and `modifyQueryUsing` (a function receiving the query); `scopedUnique()` also accepts `ignorable` (another record to leave out).

