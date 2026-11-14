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

The title is escaped: HTML is displayed as text.

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

The body of a flash notification is escaped: HTML is displayed as text.

## Adding actions to notifications

Notifications support links, given to the `actions()` method as plain objects with a `label`, a `url` and optionally `openUrlInNewTab`:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('New order')
    .actions([
        { label: 'View', url: OrderResource.getUrl('edit', order.id) },
        { label: 'Open invoice', url: `https://billing.example.com/invoices/${order.invoice_id}`, openUrlInNewTab: true },
    ])
```

At most ten actions are kept. Only a relative path (`/…`) or an `http://` / `https://` address becomes a link.

### Closing the notification and dispatching events

An action without a URL is a button. `close: true` closes the notification, and `dispatch` sends a Livewire event, received by the listeners of the page's components. `button: true` displays a button instead of a link:

```ts
import { Notification } from '@navette-js/panels';

Notification.make()
    .title('Post deleted')
    .actions([
        { label: 'Undo', dispatch: { event: 'undoDelete', data: { id: post.id } }, close: true, button: true },
        { label: 'Dismiss', close: true },
    ])
    .send()
```

The event name may only contain letters, digits and `_ . : -`. Its data comes back from the browser like any other request data: check it in the listener.

By default, the event is received by every component of the page. Add `to` with the name of a component to send it to that component only, or `self: true` to send it to the component showing the notification:

```ts
{ label: 'Refresh', dispatch: { event: 'refreshOrders', to: 'orders-table' } }
```

When an action has a URL and `close: true`, the notification is closed before the link is followed. `color` changes the color of a link or a button (`'gray'`, `'danger'`…), and `outlined: true` displays an outlined button.

## Sending notifications from JavaScript

Notifications can also be sent from the browser, without a request to the server. The `FilamentNotification` and `FilamentNotificationAction` classes are available on `window` in every panel page, with the same methods as the server-side builder:

```js
new FilamentNotification()
    .title('Saved successfully')
    .success()
    .body('Changes to the post have been saved.')
    .actions([
        new FilamentNotificationAction('view')
            .button()
            .url('/posts/5')
            .openUrlInNewTab(),
        new FilamentNotificationAction('undo')
            .color('gray')
            .dispatch('undoEditingPost', { id: 5 })
            .close(),
    ])
    .send()
```

The other methods are `status()`, `danger()`, `info()`, `warning()`, `color()`, `icon()`, `iconColor()`, `duration()`, `seconds()` and `persistent()`. An action's label defaults to its name in words (`'undoEdit'` becomes "Undo edit"); `label()` sets another one. Actions also support `dispatchSelf()`, `dispatchTo(component, event, data)` and `outlined()`.

`send()` dispatches a `notificationSent` browser event, which the notifications component of the page receives and displays. The notification travels through the server like any other request data: as on the server, the title and body are escaped, only relative paths and `http(s)` addresses become links, and unknown statuses, colors, icons and event names are left out.

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

In JavaScript, `new FilamentNotification().id('greeting')` sets the ID. If you send several notifications with the same ID, the last one replaces the others.

## Positioning notifications

Notifications are displayed in the top right corner of the page. You may move them with `Notifications.alignment()` and `Notifications.verticalAlignment()`, once when your application starts. The alignment is `'start'`, `'center'`, `'end'`, `'left'` or `'right'`; the vertical alignment is `'start'`, `'center'` or `'end'`:

```ts
import { Notifications } from '@navette-js/panels';

Notifications.alignment('start');
Notifications.verticalAlignment('end');
```

The position applies to every panel of the Node.js process.
