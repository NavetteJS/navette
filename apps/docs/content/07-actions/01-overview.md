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
| `arguments` | Arguments passed when the action was mounted (for example `{ date }` from a calendar, or `{ item }` for a [repeater item action](/forms/repeater#adding-extra-item-actions-to-a-repeater)). A component rendering an action sets them with `arguments()`. |
| `livewire` | The component that hosts the action: the page, the relation manager or the table page. |
| `component` | For an action of a form component (a field's affix action, a repeater's item action...): that component. |

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

### Setting a default color

`defaultColor()` sets a color used only when `color()` was not called. Components rendering actions use it to give their actions a color the developer can still override, and so can your own components:

```ts
import { Action } from '@navette-js/actions';

Action.make('archive')
    .defaultColor('warning')
```

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

`defaultSize()` sets a size used only when `size()` was not called, the counterpart of `defaultColor()`.

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

You can use a policy to authorize an action: pass the name of the policy ability to `authorize()`, and Navette checks it with the policy of the resource (or relation manager) hosting the action, for the action's record:

```ts
import { Action } from '@navette-js/actions';

Action.make('publish')
    .authorize('update')
    .action(async ({ record }) => {
        // ...
    })
```

`authorize(['update', 'publish'])` requires every ability; `authorizeAny(['update', 'publish'])` requires one of them. `authorize()` also takes a condition: a boolean, or a function returning a boolean or an `AuthorizationResponse`. The `can()` helper checks an ability from your own condition:

```ts
import { Action } from '@navette-js/actions';
import { can } from '@navette-js/panels';

Action.make('publish')
    .authorize(({ livewire, record }) => can(livewire, 'update', record))
    .action(async ({ record }) => {
        // ...
    })
```

`can()` uses the policy of the resource (or relation manager) hosting the action, after the panel's `authorizeUsing()` hook. The prebuilt actions already call it with their ability: `create`, `update` (edit), `view`, `delete`, `deleteAny` (bulk delete), `replicate`, `restore` and `forceDelete`. A missing policy method allows access. Actions outside a resource (a custom page) cannot check abilities: `authorize('update')` denies them there, so use a condition instead.

A policy rule may explain a denial by returning an `AuthorizationResponse` instead of `false`:

```ts
import { AuthorizationResponse } from '@navette-js/actions';

class PostResource extends Resource {
    static policy = {
        update: (user, post) => (post?.is_locked ? AuthorizationResponse.deny('This post is locked.') : true),
    };
}
```

With a message, you can show the action disabled instead of hiding it, with the message as its tooltip, using `authorizationTooltip()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('edit')
    .authorize('update')
    .authorizationTooltip()
```

If the denial has no message (the rule returns plain `false`, or the panel's `authorizeUsing()` denies), the action is hidden instead. `authorizationMessage()` supplies a fallback message, which keeps the action visible in that case.

You may instead keep the action clickable, and send a notification containing the message when it is clicked, using `authorizationNotification()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('edit')
    .authorize('update')
    .authorizationNotification()
```

As with `authorizationTooltip()`, the action is hidden if the denial has no message, unless you supply one with `authorizationMessage()`. `unauthorizedNotificationTitle()` changes the title of the notification, and `unauthorizedNotification((notification) => notification.warning())` the whole notification (`null` sends none). In both cases, the server refuses to run the unauthorized action: the tooltip and the notification only explain it.

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

The server refuses to mount or run a disabled action. The disabled state is displayed on buttons, links, icon buttons and menu items.

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

The tooltip is displayed on every trigger: buttons, links, icon buttons, badges and table row links.

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

## Adding extra HTML attributes to an action

You can pass extra HTML attributes to the action with the `extraAttributes()` method; they are merged onto its outer HTML element (`class` is added to its classes, other attributes replace the element's own):

```ts
import { Action } from '@navette-js/actions';

Action.make('edit')
    .url(({ record }) => `/posts/${record.id}/edit`)
    .extraAttributes({
        title: 'Edit this post',
    })
```

`extraAttributes()` also accepts a function of the context. Calling it again replaces the previous attributes; pass `true` as the second argument to merge them instead. Values are escaped.

## Using actions in schemas

Actions can be placed in a [schema](/schemas/overview): in field slots (`suffixAction()`...), section headers, or on their own row with the `Actions` component. If the `Actions` component is in a grid alongside other components, you can change its vertical alignment using the `verticalAlignment()` method (`start`, `center` or `end`):

```ts
import { Action } from '@navette-js/actions';
import { TextInput } from '@navette-js/forms';
import { Actions, Grid } from '@navette-js/schemas';

Grid.make(2).schema([
    TextInput.make('title'),
    Actions.make([
        Action.make('star').icon('m-star'),
    ]).verticalAlignment('end'),
])
```

### Running JavaScript when an action is clicked

If you need a simple action that runs JavaScript directly in the browser without making a request, use the `actionJs()` method. In a schema, the JavaScript has access to `$get()` and `$set()`, which read and change the fields of the schema:

```ts
import { Action } from '@navette-js/actions';
import { TextInput } from '@navette-js/forms';

TextInput.make('title')
    .suffixAction(
        Action.make('generateSlug')
            .icon('m-link')
            .actionJs("$set('slug', $get('title').toLowerCase().replaceAll(' ', '-'))"),
    )

TextInput.make('slug')
```

`actionJs()` also accepts a function of the context returning the JavaScript. An action with `actionJs()` cannot open a modal or run code on the server.

<Aside variant="danger">
The JavaScript string is executed in the browser: never build it from user input, as that would allow cross-site scripting. A value read with `$get()` is data, and is safe to use as a string.
</Aside>

`alpineClickHandler()` is the same as `actionJs()` with a plain string, and is what the cancel button of a modal uses (`close()`). When the JavaScript calls a method of the component, `livewireTarget()` names it, so the button shows its loading indicator during the request:

```ts
import { Action } from '@navette-js/actions';

Action.make('refresh')
    .alpineClickHandler('$wire.refreshStats()')
    .livewireTarget('refreshStats')
```

## Opening an action from a URL

You can link to an action modal on a panel page using `?action=sendEmail`. For a table action, use `?tableAction=view&tableActionRecord=123`. Links without `actionComponent` target the page, not its embedded components; `actionComponent=page` targets the page explicitly.

You may pass arguments using `actionArguments[source]=email` or `tableActionArguments[source]=email`, and a mount context using `actionContext[...]` (for example `actionContext[schemaComponent]=form.notes`).

The action opens once the page has loaded in the browser, through the same checks as a click: it must be an action of that location, visible, enabled and authorized for the user, and its record is resolved by the page (a table resolves it through its own query: the active tab, a relation manager's relationship).

<Aside variant="danger">
A link does not authorize anything: keep the authorization of the page and of the action in place. Arguments and context are user input: validate them in your action. An action without a modal is never run from a link, since the user would confirm nothing; but `fillForm()` and `mountUsing()` do run when the modal opens, so do not change data there.
</Aside>

A page can also open an action when it loads, with its `defaultAction` and `defaultActionArguments` properties:

```ts
import { Page } from '@navette-js/panels';

export class Onboarding extends Page {
    defaultAction = 'welcome';
    defaultActionArguments = { step: 1 };
}
```

### Targeting an embedded component

Relation managers, widgets and other embedded components do not open actions from links. To enable it for one, return a stable identifier from `getDefaultActionUrlIdentifier()`:

```ts
import { RelationManager } from '@navette-js/panels';

export class DepartmentsRelationManager extends RelationManager {
    getDefaultActionUrlIdentifier(): string | null {
        return 'departments';
    }
}
```

Then include its identifier in the link: `?actionComponent=departments&tableAction=view&tableActionRecord=123`. Use an identifier unique on the page, and never `page`. If the component is in a tab that is not active, the link must also select that tab.

### Initializing URL actions

An action is opened once per page load: closing its modal or re-rendering the page does not reopen it. Closing an ordinary action removes its parameters from the URL; table action parameters remain, so reloading the page opens the table action again. Prefer linking to one action at a time rather than combining `action` and `tableAction`.

## Rate limiting actions

You can rate limit actions with the `rateLimit()` method. It takes the number of attempts per minute that a user IP address can make. Over the limit, the action does not run and a notification is shown:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .rateLimit(5)
```

If the action opens a modal, the rate limit is applied when the modal is submitted. The limit is counted on the server, separately for each IP address, page class and action, with its arguments and record: it is not a combined limit across records. `rateLimit()` also accepts a function of the context.

Attempts are kept in memory by default. When several instances serve the panel, share them with `useActionRateLimitStore()` and your own store (`attempt(key, maxAttempts, decaySeconds)` returns `0` or the seconds to wait).

### Customizing the rate limited notification

To customize the title of the notification, use the `rateLimitedNotificationTitle()` method:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .rateLimit(5)
    .rateLimitedNotificationTitle('Slow down!')
```

You may customize the whole notification using the `rateLimitedNotification()` method. The function receives the default notification and the context, with `seconds` and `minutes` until the action is available again; `null` sends no notification:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .rateLimit(5)
    .rateLimitedNotification((notification, { seconds }) => notification
        .warning()
        .title('Slow down!')
        .body(`You can try deleting again in ${seconds} seconds.`))
```

## Using a database transaction

`databaseTransaction()` runs the action, from `before()` to `after()`, in a database transaction: if anything throws, every query is rolled back. The transaction is opened by the data adapter of the page's resource (or relation manager), or else by the default connection of `createConnection()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('transfer')
    .databaseTransaction()
    .action(async ({ data }) => {
        await debit(data.from, data.amount);
        await credit(data.to, data.amount);
    })
```

`action.halt()` and `action.cancel()` commit what was done; `action.halt(true)` and `action.cancel(true)` roll it back. With the panel's [`databaseTransactions()`](/panels/configuration#enabling-database-transactions), every action uses a transaction unless it calls `databaseTransaction(false)`.

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
- `visible()`, `hidden()`, `authorize()` and `disabled()` are evaluated again before the action is mounted and before it runs, including an action opened from a link.
- `rateLimit()` is counted on the server.
- Modal form data is validated against the schema on the server, and only fields declared in the schema reach `data`.
- Labels, tooltips, modal headings and descriptions are escaped.

What your application must still do:

- Put authorization rules in `authorize()`, `visible()` or `hidden()`, not only in the way you build the page.
- Validate `arguments`: they come from the browser as-is.
- Escape any HTML you build yourself, with `e()` from `@navette-js/support`.
