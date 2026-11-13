---
title: Overview
---

## Introduction

Actions combine a trigger button with the code to run when it is clicked. They can also open a modal to collect input or request confirmation. For example, this action asks for confirmation before archiving a project:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Action.make('archive')
    .requiresConfirmation()
    .action(async ({ record }) => {
        await ProjectResource.adapter.update(record.id, { status: 'archived' });
        Notification.make().success().title('Project archived').send();
    })
```

```preview
Action.make('archive')
    .requiresConfirmation()
```

The function passed to `action()` runs on the server. It receives one context object:

| Property | Content |
|---|---|
| `record` | The record the action belongs to (a table row, or the record of an edit or view page), read again from the data adapter on every request. `null` when there is none. |
| `data` | The validated state of the modal form, if the action has one. |
| `arguments` | Arguments passed when the action was mounted (for example `{ date }` from a calendar). |
| `livewire` | The component that hosts the action: the page, the relation manager or the table page. |

To collect input before running an action, define its modal's schema. The submitted data is available in `data`:

```ts
import { Action } from '@navette-js/actions';
import { Textarea, TextInput } from '@navette-js/forms';
import { Notification } from '@navette-js/panels';

Action.make('send_email')
    .icon('m-envelope')
    .schema([
        TextInput.make('subject').required().maxLength(255),
        Textarea.make('body').required(),
    ])
    .action(async ({ record, data }) => {
        await sendEmail(record.email, String(data.subject), String(data.body));
        Notification.make().success().title(`Email sent to ${record.name}`).send();
    })
```

```preview
Action.make('send_email')
    .icon('m-envelope')
    .schema([
        TextInput.make('subject').required().maxLength(255),
        Textarea.make('body').required(),
    ])
```

Actions usually run without navigating away from the page. To make a trigger link to another page instead, use `url()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('edit')
    .url(({ record }) => PostResource.getUrl('edit', record.id))
```

```preview
Action.make('edit')
    .url('/admin/posts/1/edit')
```

Only a relative path (`/…`) or an `http://` / `https://` address is rendered as a link. Any other value (`javascript:`, `data:`…) is never output as an `href`, so a URL built from user data cannot inject script through this attribute. A local link navigates without a full page reload; use `openUrlInNewTab()` to open it in a new tab instead:

```ts
import { Action } from '@navette-js/actions';

Action.make('view_github')
    .icon('m-arrow-top-right-on-square')
    .url(({ record }) => `https://github.com/${encodeURIComponent(record.github_handle ?? '')}`)
    .openUrlInNewTab()
```

```preview
Action.make('view_github')
    .icon('m-arrow-top-right-on-square')
    .url('https://github.com/ada-lovelace')
    .openUrlInNewTab()
```

When the function given to `url()` returns `null` for a record, the action is not a link for that record: if it also has an `action()` function, clicking it runs that function.

## Available actions

Navette includes several actions for the most common record operations. They are exported by `@navette-js/panels`:

- [Create](/actions/create)
- [Edit](/actions/edit)
- [View](/actions/view)
- [Delete](/actions/delete)
- [Replicate](/actions/replicate)
- [Force-delete](/actions/force-delete)
- [Restore](/actions/restore)

`AttachAction`, `DetachAction` and `DetachBulkAction` work in relation managers of many-to-many relationships.

Each of them returns an ordinary `Action`, so every method on this page and on the [modals](/actions/modals) page can still be chained on it. You can also create your own actions to do anything; these are just common ones included out of the box.

[`ExportAction`](/actions/export) and [`ImportAction`](/actions/import) export records to a CSV file and import them from one.

## Placing actions

An action is only mounted where it is declared. The server looks the action up by name among the actions of the location the browser asks for, so an action that is not declared there can never be run.

| Location | Declaration | `record` |
|---|---|---|
| Page header | `getHeaderActions()` of a page | the page's record (edit and view pages) |
| Resource list page header | `static listHeaderActions()` on the resource | none |
| Resource edit page header | `static editHeaderActions()` on the resource, placed before the default delete actions | the edited record |
| Table header | `table.headerActions([...])` | none |
| Table row | `table.recordActions([...])` | the row |
| Table row menu | `table.recordActions([ActionGroup.make([...])])` | the row |
| Table selection | `table.groupedBulkActions([...])` | none: read the selection from `livewire` |
| Section header | `Section.make('Status').afterHeader([...])` | the record of the form |

For example, a list page header action that links to another screen and shows a counter:

```ts
import { Action } from '@navette-js/actions';
import { Resource } from '@navette-js/panels';

export class EmployeeResource extends Resource {
    static listHeaderActions = () => [
        Action.make('leave_requests')
            .label('Leave requests')
            .color('gray')
            .icon('m-calendar')
            .badge(async () => String(await countPendingLeaveRequests()))
            .badgeColor('warning')
            .url('/hr/leave-requests'),
    ];
}
```

```preview
Action.make('leave_requests')
    .label('Leave requests')
    .color('gray')
    .icon('m-calendar')
    .badge('3')
    .badgeColor('warning')
    .url('/hr/leave-requests')
```

A bulk action reads the selected records with `getSelectedRecordKeys()`. The keys sent by the browser are reduced to the records the table can actually display:

```ts
import { Action } from '@navette-js/actions';

table.groupedBulkActions([
    Action.make('deactivate')
        .icon('m-power')
        .color('warning')
        .requiresConfirmation()
        .action(async ({ livewire }) => {
            for (const key of await livewire.getSelectedRecordKeys()) {
                await EmployeeResource.adapter.update(key, { is_active: false });
            }
            livewire.deselectAllTableRecords();
        }),
])
```

## Choosing a trigger style

The trigger style depends on where the action is placed: a button in page and table headers, a link in table rows, and a menu item inside an `ActionGroup` or a bulk actions menu.

In a table row, you may reduce the link to its icon with the `iconButton()` method. The label becomes the tooltip and the accessible name of the button:

```ts
import { Action } from '@navette-js/actions';

Action.make('toggle_billable')
    .icon('m-currency-dollar')
    .label('Toggle billable')
    .iconButton()
```

You may set a different icon for a table row link with `tableIcon()`, and for a menu item with `groupedIcon()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('send_email')
    .icon('m-envelope')
    .tableIcon('c-envelope')
```

You may also choose the style yourself, wherever the action is placed:

```ts
import { Action } from '@navette-js/actions';

Action.make('edit').button()

Action.make('edit').link()

Action.make('edit').iconButton()

Action.make('edit').badge()
```

`outlined()` gives a button a border instead of a background. `labeledFrom()` shows an icon button on small screens and a labeled button from a breakpoint up:

```ts
import { Action } from '@navette-js/actions';

Action.make('edit')
    .icon('m-pencil-square')
    .labeledFrom('md')
```

`badge()` without argument is the badge style; `badge(3)` adds a counter to the button.

## Setting a label

By default, the label of the trigger button is generated from its name: underscores and dashes become spaces and the first letter is capitalized, so `send_email` becomes "Send email". You may customize this using the `label()` method:

```ts
import { Action } from '@navette-js/actions';

Action.make('edit')
    .label('Edit post')
    .url(({ record }) => PostResource.getUrl('edit', record.id))
```

```preview
Action.make('edit')
    .label('Edit post')
    .url('/admin/posts/1/edit')
```

As well as allowing a static value, `label()` accepts a function receiving the context object, for example `({ record }) => (record.is_active ? 'Deactivate' : 'Activate')`.

## Setting a color

Buttons may have a color to indicate their significance. The available colors are those of the panel: `primary` (default), `gray`, `danger`, `info`, `success`, `warning`, and any color you register:

```ts
import { Action } from '@navette-js/actions';

Action.make('delete')
    .color('danger')
```

```preview
[
    Action.make('delete')
        .color('danger'),
    Action.make('primary').label('Primary'),
    Action.make('gray').label('Gray').color('gray'),
    Action.make('info').label('Info').color('info'),
    Action.make('success').label('Success').color('success'),
    Action.make('warning').label('Warning').color('warning'),
]
```

`color()` also accepts a function receiving the context object:

```ts
import { Action } from '@navette-js/actions';

Action.make('toggle_active')
    .color(({ record }) => (record.is_active ? 'danger' : 'success'))
```

<Aside variant="info">
A color calculated by a function is applied to table row links, menu items and modals. Page and table header buttons always use a static color.
</Aside>

## Setting a size

Header buttons come in several sizes: `sm`, `md` (default) and `lg`. You can change the size of the action's trigger using the `size()` method:

```ts
import { Action } from '@navette-js/actions';

Action.make('create')
    .size('lg')
```

```preview
[
    Action.make('create_small').label('Small').size('sm'),
    Action.make('create_medium').label('Medium').size('md'),
    Action.make('create')
        .label('Large')
        .size('lg'),
]
```

## Setting an icon

Buttons may have an icon to add more detail to the UI. Icon names are Heroicons with a style prefix: `o-` (outline), `s-` (solid), `m-` (mini) and `c-` (micro), for example `m-pencil-square`. Other icons can be registered with `registerIcon(name, svg)` from `@navette-js/support`; an unknown icon name throws an error when the action is rendered. You can set the icon using the `icon()` method:

```ts
import { Action } from '@navette-js/actions';

Action.make('edit')
    .url(({ record }) => PostResource.getUrl('edit', record.id))
    .icon('m-pencil-square')
```

```preview
Action.make('edit')
    .url('/admin/posts/1/edit')
    .icon('m-pencil-square')
```

`icon()` also accepts a function receiving the context object, which is applied to table row links and menu items:

```ts
import { Action } from '@navette-js/actions';

Action.make('toggle_visibility')
    .icon(({ record }) => (record.is_visible ? 'm-eye-slash' : 'm-eye'))
```

You can also change the icon's position on a header button to be after the label instead of before it, using the `iconPosition()` method:

```ts
import { Action } from '@navette-js/actions';

Action.make('next')
    .icon('m-arrow-right')
    .iconPosition('after')
```

```preview
Action.make('next')
    .icon('m-arrow-right')
    .iconPosition('after')
```

## Authorization

You may conditionally show or hide actions for certain users. To do this, you can use either the `visible()` or `hidden()` methods. Both accept a boolean or a function receiving the context object:

```ts
import { Action } from '@navette-js/actions';

Action.make('approve')
    .visible(({ record }) => record.status === 'submitted')

Action.make('approve')
    .hidden(({ record }) => record.status !== 'submitted')
```

Visibility is checked on the server, not only when the button is rendered: when the action is mounted and again when it runs, Navette evaluates `visible()`, `hidden()`, `authorize()` and `disabled()` with the record read from the data adapter, and refuses the request if the action is not available. A request forged in the browser cannot run a hidden action.

### Authorization using a policy

The `authorize()` method takes a condition, kept separate from `visible()` and `hidden()`. To check a resource policy, use the `can()` helper with the name of the ability:

```ts
import { Action } from '@navette-js/actions';
import { can } from '@navette-js/panels';

Action.make('publish')
    .authorize(({ livewire, record }) => can(livewire, 'update', record))
    .action(async ({ record }) => {
        // ...
    })
```

`can()` uses the policy of the resource (or relation manager) hosting the action, after the panel's `authorizeUsing()` hook. The prebuilt actions already call it with their ability: `create`, `update` (edit), `view`, `delete`, `deleteAny` (bulk delete), `replicate`, `restore` and `forceDelete`. A missing policy method allows access.

<Aside variant="warning">
For a URL action, `authorize()` only hides the link. The destination page must authorize access itself. Resource pages and pages with `canAccess()` already do this on every request.
</Aside>

### Disabling a button

If you want to disable a button instead of hiding it, you can use the `disabled()` method. It accepts a boolean or a function receiving the context object:

```ts
import { Action } from '@navette-js/actions';

Action.make('delete')
    .disabled(({ record }) => record.is_locked)
```

The server refuses to mount or run a disabled action. The disabled state is displayed on icon buttons and menu items.

<Aside variant="warning">
Page header buttons and table row links are not rendered as disabled yet: the click is refused by the server, but the button looks active. Use `hidden()` when the user should not see the action at all.
</Aside>

## Registering keybindings

You can attach keyboard shortcuts to trigger buttons. These use the same key codes as Mousetrap, where `mod` means `command` on macOS and `ctrl` elsewhere:

```ts
import { Action } from '@navette-js/actions';

Action.make('quick_publish')
    .keyBindings(['mod+shift+p'])
    .action(async ({ record }) => {
        // ...
    })
```

## Adding a tooltip

You may add a tooltip to a trigger with the `tooltip()` method. It accepts a string or a function receiving the context object, and is escaped before being displayed:

```ts
import { Action } from '@navette-js/actions';

Action.make('visit_website')
    .icon('m-arrow-top-right-on-square')
    .tooltip('Open brand website')
    .url(({ record }) => record.website)
    .openUrlInNewTab()
```

The tooltip is displayed on table row links and on header buttons that open a URL.

## Adding a badge to the corner of the button

You can add a badge to the corner of a header button, to display a count or a status indicator. `badge()` accepts a value or an asynchronous function, and `badgeColor()` sets its color (`primary` by default):

```ts
import { Action } from '@navette-js/actions';

Action.make('leave_requests')
    .url('/hr/leave-requests')
    .badge(async () => String(await countPendingLeaveRequests()))
    .badgeColor('warning')
```

```preview
Action.make('leave_requests')
    .url('/hr/leave-requests')
    .badge('3')
    .badgeColor('warning')
```

<Aside variant="info">
The badge is currently rendered on header buttons that open a URL only.
</Aside>

## Setting default configuration

`Action.configureUsing()` registers a function applied to every action created afterwards with `make()`:

```ts
import { Action } from '@navette-js/actions';

Action.configureUsing((action) => action.size('sm'));
```

## Security

Navette provides these protections for every action:

- The action name and its location come from the browser, but only actions declared at that location can be mounted.
- The record key comes from the browser, but the record is read again from the data adapter of the host on every request, and a key the adapter cannot find is refused. In a relation manager, the adapter only sees the records related to the owner.
- `visible()`, `hidden()`, `authorize()` and `disabled()` are evaluated again before the action is mounted and before it runs.
- Modal form data is validated against the schema on the server, and only fields declared in the schema reach `data`.
- Labels, tooltips, modal headings and descriptions are escaped.

What your application must still do:

- Put authorization rules in `authorize()`, `visible()` or `hidden()`, not only in the way you build the page.
- Validate `arguments`: they come from the browser as-is.
- Escape any HTML you build yourself, with `e()` from `@navette-js/support`.
