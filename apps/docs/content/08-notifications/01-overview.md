---
title: Overview
---

## Introduction

Notifications are sent using a `Notification` object that's constructed through a fluent API. Calling the `send()` method on the `Notification` object will dispatch the notification and display it in the browser that made the request:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Action.make('publish')
    .action(async ({ record }) => {
        await PostResource.adapter.update(record.id, { published_at: new Date().toISOString() });

        Notification.make()
            .title('Post published')
            .success()
            .send();
    })
```

These "flash" notifications are displayed in the top-right corner of the panel and disappear after a few seconds. To keep a notification in the panel's notifications list instead, see [database notifications](/notifications/database-notifications).

## Sending notifications

You may call `send()` while Navette handles a request coming from a page that is already displayed: an action function, a form submission, a lifecycle hook of a resource page (`afterCreate()`, `afterSave()`…), or a method called by a widget. The notification is collected during the request and displayed when the response reaches the browser.

If the request ends with a redirect, the notification is displayed on the next page:

```ts
import { DeleteAction, Notification } from '@navette-js/panels';

DeleteAction.make()
    .action(async ({ livewire, record }) => {
        await PostResource.adapter.delete(record.id);
        Notification.make().success().title('Post deleted').send();
        livewire.redirect(PostResource.getUrl(), true);
    })
```

<Aside variant="warning">
`send()` throws an error outside of such a request, for example in the `mount()` method of a page during its first display, or in a background job. Pending notifications are kept in the memory of the Node.js process for five minutes: they are not shared between several processes and do not survive a restart.
</Aside>

## Setting a title

The main message of the notification is shown in the title. You can set the title as follows:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Saved successfully')
    .send();
```

The title text can contain basic, safe HTML elements. To generate safe HTML with Markdown, you can use `markdownToHtml()` from `@navette-js/support`, wrapped in an `HtmlString` (`raw()`) or passed as a string: `title(markdownToHtml('Saved **successfully**'))`. The HTML is sanitized when the notification is rendered: formatting, links and lists stay, while scripts, event handler attributes, styles and `javascript:` links are removed. Plain text is shown as text (`<` and `&` are escaped).

## Setting a status

Notifications have a status, which sets their icon and color. The available statuses are `success`, `warning`, `danger` and `info`:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Saved successfully')
    .success()
    .send();
```

The `success()`, `warning()`, `danger()` and `info()` methods are shortcuts for `status()`, which is useful when the status is computed:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .status(failed > 0 ? 'warning' : 'success')
    .title(`Import completed: ${imported} rows imported.`)
    .send();
```

## Setting an icon

Optionally, a notification can have an icon that's displayed in front of its content. You may also set a color for the icon, which is gray by default:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Saved successfully')
    .icon('o-document-text')
    .iconColor('success')
    .send();
```

An icon set with `icon()` replaces the icon of the status, and `iconColor()` replaces its color.

## Setting a background color

Notifications have no background color by default. You may give them one to add context:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Saved successfully')
    .color('success')
    .send();
```

## Setting a duration

By default, notifications are shown for 6 seconds before they're automatically closed. You may specify a custom duration value in milliseconds as follows:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Saved successfully')
    .success()
    .duration(5000)
    .send();
```

If you prefer a notification to not close automatically, you may use the `persistent()` method:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Export completed')
    .success()
    .persistent()
    .send();
```

The countdown pauses while the pointer is over the notification. The user can always close it with its close button.

## Setting body text

Additional notification text can be shown in the `body()`:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Saved successfully')
    .success()
    .body('Changes to the post have been saved.')
    .send();
```

Like the title, the body can contain basic, safe HTML, for instance generated from Markdown:

```ts
import { Notification } from '@navette-js/panels';
import { markdownToHtml } from '@navette-js/support';

Notification.make()
    .title('Saved successfully')
    .success()
    .body(markdownToHtml('Changes to the **post** have been saved. [View it](/admin/posts/5).'))
    .send();
```

The HTML is sanitized when the notification is rendered, flash and database notifications alike.

## Adding actions to notifications

Notifications support [actions](/actions/overview), which are buttons or links rendered below the content of the notification. They can open a URL or dispatch a Livewire event. Actions are built with `Action` from `@navette-js/actions`:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Saved successfully')
    .success()
    .body('Changes to the post have been saved.')
    .actions([
        Action.make('view')
            .button(),
        Action.make('undo')
            .color('gray'),
    ])
    .send();
```

Notification actions are small links by default (`size('sm')` and `link()`), unless they choose another style with `button()`, `iconButton()` or `badge()`, or another size with `size()`. At most ten actions are kept. An action's label defaults to its name in words (`'undoEdit'` becomes "Undo edit").

### Opening URLs from notification actions

You can open a URL, optionally in a new tab, when clicking on an action:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('New order')
    .actions([
        Action.make('view')
            .button()
            .url(OrderResource.getUrl('edit', order.id)),
        Action.make('invoice')
            .url(`https://billing.example.com/invoices/${order.invoice_id}`)
            .openUrlInNewTab(),
    ])
    .send();
```

Only a relative path (`/…`) or an `http://` / `https://` address becomes a link: any other URL (`javascript:`, `data:`…) is left out.

### Dispatching Livewire events from notification actions

Sometimes you want to execute additional code when a notification action is clicked. This can be achieved by setting a Livewire event which should be dispatched on clicking the action. You may optionally pass an array or an object of data, which will be available as parameters in the event listener on your Livewire component:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Saved successfully')
    .success()
    .actions([
        Action.make('view')
            .button()
            .url(PostResource.getUrl('edit', post.id)),
        Action.make('undo')
            .color('gray')
            .dispatch('undoEditingPost', { post: post.id }),
    ])
    .send();
```

You can also `dispatchSelf()` (only the component showing the notification receives the event) and `dispatchTo(component, event, data)` (only the components with that name):

```ts
Action.make('undo')
    .color('gray')
    .dispatchSelf('undoEditingPost', { post: post.id })

Action.make('refresh')
    .dispatchTo('orders-table', 'refreshOrders', [order.id])
```

The event name may only contain letters, digits and `_ . : -`. Its data comes back from the browser like any other request data: check it in the listener.

### Closing notifications from actions

After opening a URL or dispatching an event from your action, you may want to close the notification right away:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Saved successfully')
    .success()
    .actions([
        Action.make('view')
            .button()
            .url(PostResource.getUrl('edit', post.id)),
        Action.make('undo')
            .color('gray')
            .dispatch('undoEditingPost', { post: post.id })
            .close(),
    ])
    .send();
```

When an action has a URL and `close()`, the notification is closed before the link is followed. In [database notifications](database-notifications), `markAsRead()` and `markAsUnread()` change the read state of the notification when the action is clicked.

### Customizing notification actions

Notification actions support the styling methods of other actions: `color()`, `icon()`, `iconPosition('after')`, `size()`, `outlined()`, `tooltip()`, `extraAttributes()` and `disabled()`:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Invoice ready')
    .actions([
        Action.make('download')
            .button()
            .icon('o-arrow-down-tray')
            .size('md')
            .tooltip('PDF, 120 KB')
            .url(invoice.url, true),
        Action.make('pay')
            .icon('o-credit-card')
            .iconPosition('after')
            .disabled(!invoice.payable)
            .tooltip('Already paid'),
        Action.make('archive')
            .iconButton()
            .icon('o-archive-box')
            .extraAttributes({ 'data-invoice': invoice.id })
            .dispatch('archiveInvoice', { id: invoice.id }),
    ])
    .send();
```

A disabled action has neither a link nor a click handler. Tooltips are plain text.

<Aside variant="warning">
Notification actions are stored in the page, in the `notifications` table and in broadcast messages, and read back from there. Only harmless extra attributes are kept: `data-*`, `aria-*`, `id`, `class`, `title`, `role`, `rel`, `lang` and `dir`. Event handlers (`onclick`), Alpine and Livewire directives (`x-on:click`, `@click`, `wire:click`), `href` and `style` are dropped. Use `dispatch()` to run code when an action is clicked.
</Aside>

### Grouping notification actions

Actions can be grouped in a dropdown with `ActionGroup`. In a notification, the group is a small "Actions" link by default; `button()`, `iconButton()`, `label()`, `icon()`, `color()`, `size()` and `tooltip()` change its trigger:

```ts
import { Action, ActionGroup } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('New comment')
    .actions([
        Action.make('reply')
            .button()
            .url(CommentResource.getUrl('view', comment.id)),
        ActionGroup.make([
            Action.make('approve')
                .icon('o-check')
                .dispatch('approveComment', { id: comment.id })
                .close(),
            Action.make('spam')
                .icon('o-no-symbol')
                .color('danger')
                .dispatch('markCommentAsSpam', { id: comment.id })
                .close(),
        ]),
    ])
    .send();
```

A nested group with `dropdown(false)` becomes a section of the menu, separated by a divider. A group with `dropdown(false)` at the top level shows its actions side by side.

### Actions as plain objects

Actions can also be plain objects, which is convenient when they are computed:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Post deleted')
    .actions([
        { label: 'Undo', dispatch: { event: 'undoDelete', data: { id: post.id } }, close: true, button: true },
        { label: 'View trash', url: '/admin/posts/trash', icon: 'o-trash' },
        { label: 'Refresh', dispatch: { event: 'refreshOrders', to: 'orders-table' }, view: 'icon-button', icon: 'o-arrow-path' },
    ])
    .send();
```

The keys are `label`, `url`, `openUrlInNewTab`, `close`, `dispatch` (`{ event, data, to }` or `{ event, data, self: true }`), `color`, `button` or `view` (`'link'`, `'button'`, `'icon-button'`, `'badge'`), `outlined`, `icon`, `iconPosition`, `size`, `tooltip`, `disabled`, `extraAttributes`, `markAsRead` and `markAsUnread`.

### The array format of actions

Notification actions are stored in an array format. `Action.toArray()` and `ActionGroup.toArray()` return it, and `Action.fromArray()` and `ActionGroup.fromArray()` rebuild an action from it. Data read from the database or sent by the browser is checked: unknown names, colors, icons, sizes and views are dropped.

## Sending notifications from JavaScript

Notifications can also be sent from the browser, without a request to the server. The `NavetteNotification` and `NavetteNotificationAction` classes are available on `window` in every panel page, with the same methods as the server-side builder:

```js
new NavetteNotification()
    .title('Saved successfully')
    .success()
    .body('Changes to the post have been saved.')
    .actions([
        new NavetteNotificationAction('view')
            .button()
            .url('/posts/5')
            .openUrlInNewTab(),
        new NavetteNotificationAction('undo')
            .color('gray')
            .dispatch('undoEditingPost', { id: 5 })
            .close(),
    ])
    .send()
```

The other methods are `status()`, `danger()`, `info()`, `warning()`, `color()`, `icon()`, `iconColor()`, `duration()`, `seconds()` and `persistent()`. An action's label defaults to its name in words (`'undoEdit'` becomes "Undo edit"); `label()` sets another one. Actions also support `dispatchSelf()`, `dispatchTo(component, event, data)`, `outlined()`, `icon()`, `iconPosition()`, `size()`, `tooltip()`, `extraAttributes()` and `disabled()`, and `NavetteNotificationActionGroup` groups them.

`send()` dispatches a `notificationSent` browser event, which the notifications component of the page receives and displays. The notification travels through the server like any other request data: as on the server, the title and body are sanitized, only relative paths and `http(s)` addresses become links, and unknown statuses, colors, icons and event names are left out.

## Closing a notification with JavaScript

Once a notification has been sent, you can close it on demand by dispatching a browser event on the window called `close-notification`, with the ID of the notification. To get the ID, use `getId()`:

```ts
import { Notification } from '@navette-js/panels';

const notification = Notification.make()
    .title('Hello')
    .persistent()
    .send();

const notificationId = notification.getId();
```

To close the notification, dispatch the event from a component on the server:

```ts
this.dispatch('close-notification', { id: notificationId });
```

Or from JavaScript, in this case Alpine.js:

```html
<button x-on:click="$dispatch('close-notification', { id: notificationId })" type="button">
    Close Notification
</button>
```

Random IDs are recommended, as you will not risk closing the wrong notification. If you cannot keep the random ID, pass your own ID to `make()`. It may only contain letters, digits and `_ . : -`:

```ts
import { Notification } from '@navette-js/panels';

Notification.make('greeting')
    .title('Hello')
    .persistent()
    .send();
```

```html
<button x-on:click="$dispatch('close-notification', { id: 'greeting' })" type="button">
    Close Notification
</button>
```

In JavaScript, `new NavetteNotification().id('greeting')` sets the ID. If you send several notifications with the same ID, the last one replaces the others.

## Positioning notifications

Notifications are displayed in the top right corner of the page. You may move them with `Notifications.alignment()` and `Notifications.verticalAlignment()`, once when your application starts. The alignment is `'start'`, `'center'`, `'end'`, `'left'` or `'right'`; the vertical alignment is `'start'`, `'center'` or `'end'`:

```ts
import { Notifications } from '@navette-js/panels';

Notifications.alignment('start');
Notifications.verticalAlignment('end');
```

The position applies to every panel of the Node.js process.

## Notifications as arrays

`Notification.fromArray(data)` builds a notification from its array format (the JSON of `NavetteNotification`), with its actions and action groups. The data is treated as untrusted: unknown statuses, colors, icons and event names are dropped, an unsafe id is replaced by a random one, and durations are bounded. `getData()` returns the notification's data, and `getBroadcastMessage()` the message that [`broadcast()`](broadcast-notifications) sends to the browser (the same data, with its actions in the array format and `format: 'navette'`; the page sends it back to the server, which reads it with `fromArray()`):

```ts
import { Notification } from '@navette-js/panels';

const notification = Notification.fromArray(JSON.parse(job.payload));

notification.getBroadcastMessage(); // { id, title, body, status, actions, …, format: 'navette' }
```
