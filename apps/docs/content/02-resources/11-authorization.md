---
title: Authorization
---

## Introduction

Navette separates two questions:

- **Who is logged in?** That is authentication, handled by the [user provider](/panels/users) of the panel.
- **What may they do?** That is authorization, the subject of this page.

Navette does not ship roles or permissions. It provides checkpoints, enforces them everywhere (navigation, buttons, direct URLs, forged requests), and lets you plug in your own logic: a `role` column, a permissions table, an external service.

Without any rule, every logged-in user may list, create, edit and delete every record. If your users do not all have the same rights, write the rules, and [test them](/testing/other-tests#testing-authorization).

## The user object

The user provider returns the user on every request. Add whatever your rules need to it: the object is passed as is to every check.

```ts
panel.auth({
    attempt: async (email, password) => { /* ... */ },
    find: async (id) => {
        const row = await knex('users').where({ id }).first();
        return row ? { id: row.id, name: row.name, email: row.email, role: row.role, teamId: row.team_id } : null;
    },
});
```

Since `find()` runs on every request, a change of role applies immediately.

## Policies

A resource may declare a `policy`: an object with one function per ability. The ability names are:

```ts
import { Resource, type Policy } from '@navette-js/panels';

export class TaskResource extends Resource {
    static policy: Policy<Task> = {
        viewAny: () => true,
        create: (user) => user.role !== 'reader',
        update: (user, task) => user.role === 'admin' || task?.owner_id === user.id,
        delete: (user) => user.role === 'admin',
        deleteAny: (user) => user.role === 'admin',
    };
}
```

| Ability | What it governs |
|---|---|
| `viewAny` | The navigation item and the list page. Also whether the resource is searched by [global search](/resources/global-search). |
| `view` | The [View page](/resources/viewing-records), checked on the record, and `ViewAction`. |
| `create` | The "New" button, the create page and `CreateAction`. |
| `update` | The edit page (checked on the record), `EditAction`, the default "Edit" link of each row, and [editable columns](/tables/columns/overview). |
| `delete` | `DeleteAction`. |
| `deleteAny` | `DeleteBulkAction`. |
| `restore`, `forceDelete` | `RestoreAction`, `ForceDeleteAction`. |
| `replicate` | `ReplicateAction`. |
| `reorder` | Reordering the rows of the table. |

The rules:

- **A missing ability is allowed.** Without a `policy`, every logged-in user may do everything.
- A function may be asynchronous.
- The second argument is the record when there is one (`view`, `update`, `delete`…), otherwise `null`.
- Without a logged-in user, every check fails.
- A denied ability hides the element **and** fails the request: the page answers 403, and the action is not found by the server.
- A rule may return `AuthorizationResponse.deny('This task is closed.')` (from `@navette-js/actions`) instead of `false`, to explain the denial: actions show the message with [`authorizationTooltip()` or `authorizationNotification()`](/actions/overview#authorization-using-a-policy). `AuthorizationResponse.allow()` allows. The panel's `authorizeUsing()` hook may return one too, and `panel.inspect()` / `Resource.inspect()` return the response with its message.

A [relation manager](/resources/managing-relationships#authorizing-relation-managers) and a relation page have their own `policy`, with the same abilities.

### Authorization and the request lifecycle

Navette checks the rights on every request that a page sends, not only when it is displayed. The record of an edit or View page is read again from the adapter and checked again each time, so a user who loses a right while the page is open cannot use it anymore. An action is checked when it is displayed, again when its modal opens, and again before it runs.

### Skipping authorization for a resource

`shouldSkipAuthorization` lets every signed-in user do everything on a resource, without calling its policy, nor the panel's `authorizeUsing()`:

```ts
export class NoteResource extends Resource {
    static shouldSkipAuthorization = true;
}
```

A user is still required, unless the panel [allows guests](/panels/users#setting-up-guest-access-to-a-panel). Use it only for resources whose records every user of the panel may manage.

## Checking an ability

`Resource.can()` answers the same question as the checkpoints, with the panel hook described below:

```ts
if (await TaskResource.can('update', user, task)) {
    // ...
}
```

## Authorizing custom actions

An action that you write does not know which ability it requires. Declare it with `authorize('ability')`, or with a condition using the `can()` helper; both check an ability of the resource (or relation manager) of the component hosting the action:

```ts
import { Action } from '@navette-js/actions';
import { can } from '@navette-js/panels';

Action.make('publish')
    .authorize('update')
    .action(async ({ record }) => { /* ... */ }),

Action.make('archive')
    .authorize(({ livewire, record }) => can(livewire, 'update', record))
    .action(async ({ record }) => { /* ... */ }),

Action.make('export')
    .authorize(({ livewire }) => can(livewire, 'export'))   // your own ability: add `export` to the policy
    .action(async () => { /* ... */ }),
```

`authorize()` comes in addition to `visible()` and `hidden()`: use those for the state of the data ("already published"), and `authorize()` for the rights. In every case, the server checks again before running the action.

<Aside variant="danger">
An action without `authorize()` is available to every user who can see the page or the table. This includes `AttachAction`, `DetachAction` and `DetachBulkAction`, which do not consult the policy.
</Aside>

## Authorizing pages and widgets

A custom page decides who may open it with `canAccess()`. A widget decides who may see it with `canView()`:

```ts
import { Page, StatsOverviewWidget, type User } from '@navette-js/panels';

class AuditPage extends Page {
    static slug = 'audit';
    static canAccess(user: User): boolean { return user.role === 'admin'; } // hidden from the navigation, 403 on direct access
}

class RevenueStats extends StatsOverviewWidget {
    static canView(user: User): boolean { return user.role !== 'reader'; } // left out of the page, loading refused
}
```

## Plugging in your own permission system

When your rights live elsewhere (a permissions table, an authorization service, rules per tenant), `authorizeUsing()` registers a single hook that receives **every** question, before any policy:

```ts
panel.authorizeUsing(async ({ user, ability, resource, record, page, widget }) => {
    if (user.role === 'superadmin') return true;              // decides: yes

    if (resource) {
        const name = (resource as typeof Resource).slug;      // 'tasks', 'shop/products'…
        return permissions.has(user.id, `${name}.${ability}`); // decides: yes or no
    }

    return undefined;                                         // does not decide: the policy, canAccess or canView answers
});
```

| Field | Content |
|---|---|
| `user` | The logged-in user. |
| `ability` | `viewAny`, `create`, `update`…, your own names, `access` for a custom page, `view` for a widget. |
| `resource` | The resource, relation manager or relation page concerned, otherwise `null`. |
| `record` | The record concerned, otherwise `null`. |
| `page`, `widget` | The page or widget class concerned, otherwise `null`. |

Return `true` to allow, `false` to deny, or `undefined` to let the local rule answer. You may centralize everything in the hook, or keep policies per resource and use the hook for cross-cutting rules: super-administrators, suspended accounts, maintenance mode.

## Restricting the records

A policy answers "may they change **this** record?". It does not filter the list. For a user to only **see** some records, restrict the adapter of the resource with its `modify` option:

```ts
static adapter = new ObjectionAdapter(Task, {
    modify: (query) => {
        const user = currentUser();
        if (user?.role !== 'admin') query.where('tasks.team_id', user?.teamId ?? -1);
    },
});
```

It is the strongest protection: a record outside the scope does not exist for the resource, whatever the request. The adapter is shared by all requests and does not know the user: make the user available during the request with an `AsyncLocalStorage`, filled by an Express middleware mounted before `panelRouter()`. In a [multi-tenant panel](/panels/tenancy), the scope of the current tenant is applied for you.

## What Navette does not check for you

- **Actions you write** without `authorize()`.
- **Bulk actions** check `deleteAny`, not `delete` for each record. If your rights depend on the row, filter the keys in your own action.
- **Form fields**: to reserve a field, use `visible(({ livewire }) => …)`; a hidden field is not saved.
- **Attach and detach** actions, as described above.
