---
title: Database notifications
---

## Introduction

Database notifications are stored for a user and listed in a slide-over panel, opened from a bell button in the panel's topbar or sidebar. Unlike [flash notifications](/notifications/overview), they stay until the user deletes them, and they can be sent to any user, not only to the one making the request.

## Setting up the notifications database table

Navette ships a store for a `notifications` table with the columns of Laravel's notifications table. Each notification is stored as JSON in the `data` column, with a `format` key set to `filament`; rows with another format, written by other kinds of notifications, are ignored. If you don't have this table yet, you may create it with a Knex migration:

```ts
export async function up(knex) {
    await knex.schema.createTable('notifications', (table) => {
        table.uuid('id').primary();
        table.string('type');
        table.string('notifiable_type');
        table.bigInteger('notifiable_id').unsigned();
        table.text('data');
        table.timestamp('read_at').nullable();
        table.timestamps();
        table.index(['notifiable_type', 'notifiable_id']);
    });
}
```

## Enabling database notifications in a panel

If you'd like to receive database notifications in a panel, you can enable them by passing a store to the `databaseNotifications()` method of the panel:

```ts
import { knexNotificationStore, Panel } from '@navette-js/panels';
import knex from './database.ts';

const panel = Panel.make()
    // ...
    .databaseNotifications(knexNotificationStore(knex));
```

`knexNotificationStore()` takes a Knex instance (or any function that returns a query builder for a table name) and these options:

| Option | Default | Effect |
|---|---|---|
| `table` | `'notifications'` | Name of the table. |
| `notifiableType` | `'App\\Models\\User'` | Value of the `notifiable_type` column for the panel's users. |
| `mapUrl` | none | Function applied to the URL of each action read from the table, for example to keep only the path of URLs stored by another application. |

```ts
import { knexNotificationStore } from '@navette-js/panels';

knexNotificationStore(knex, {
    notifiableType: 'user',
    mapUrl: (url) => url.replace(/^https?:\/\/[^/]+/, '') || '/',
})
```

<Aside variant="info">
`knexNotificationStore()` filters rows with the SQL function `json_extract()`, which SQLite and MySQL provide. For another database, or another storage, implement the [store interface](#using-a-custom-store).
</Aside>

## Moving the database notifications trigger

By default, the bell is in the topbar, or in the sidebar when the panel has no topbar (`topbar(false)`). You may choose its position with `databaseNotificationsPosition()`:

```ts
import { Panel } from '@navette-js/panels';

Panel.make()
    // ...
    .databaseNotificationsPosition('sidebar');
```

The bell shows the number of unread notifications.

## Sending database notifications

To send a database notification, build a `Notification` and pass the panel's store and the recipient's user ID to `sendToDatabase()`. The method is asynchronous:

```ts
import { CreateRecord, Notification, type PanelContext } from '@navette-js/panels';

class CreateOrder extends CreateRecord {
    static resource = OrderResource;

    protected async afterCreate(record: Order): Promise<void> {
        const { user } = this._ctx as PanelContext;
        await Notification.make()
            .title('New order')
            .icon('o-shopping-bag')
            .body(`Order ${record.number} has been placed.`)
            .actions([{ label: 'View', url: OrderResource.getUrl('edit', record.id) }])
            .sendToDatabase(this.panel.getDatabaseNotifications(), user!.id);
    }
}
```

Inside an action, the panel is available as `livewire.panel`. When the panel has no store, `sendToDatabase()` does nothing. Unlike `send()`, it can be called outside of a request, for example from a scheduled task, as long as you have the store.

The title, body, status, icon, icon color, background color and actions are stored; the duration is not, as database notifications are always persistent. In the notifications panel:

- The title is escaped.
- A plain text body is escaped. A body containing HTML is cleaned: only the tags of the rich editor are kept, and scripts, event handlers and `javascript:` links are removed.
- Actions are displayed below the text, as links or as buttons (`button: true`), like in [flash notifications](/notifications/overview#adding-actions-to-notifications): they can open a URL, dispatch a Livewire event and close the notification. Only a relative path (`/…`) or an `http://` / `https://` address becomes a link.

### Marking database notifications as read from an action

An action can mark its notification as read, or as unread, when it is clicked:

```ts
import { Notification } from '@navette-js/panels';

await Notification.make()
    .title('Invoice ready')
    .actions([
        { label: 'Open', url: '/invoices/42', button: true, markAsRead: true },
        { label: 'Mark as unread', markAsUnread: true, color: 'gray' },
    ])
    .sendToDatabase(livewire.panel.getDatabaseNotifications(), user.id);
```

Closing a database notification with an action that has `close: true` deletes it, like its close button.

## Receiving database notifications

### Polling for new database notifications

The bell and the panel refresh every 30 seconds. You may change this interval, or pass `null` to disable polling:

```ts
import { Panel } from '@navette-js/panels';

Panel.make()
    // ...
    .databaseNotificationsPolling('60s');
```

The interval is written in seconds (`'30s'`) or milliseconds (`'500ms'`).

When you send a database notification to the current user during a request, you may refresh the bell immediately by dispatching the `databaseNotificationsSent` event from the host component:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Action.make('remind_me')
    .action(async ({ livewire, record }) => {
        await Notification.make()
            .title(`Reminder: ${record.name}`)
            .sendToDatabase(livewire.panel.getDatabaseNotifications(), livewire._ctx.user.id);
        livewire.dispatch('databaseNotificationsSent');
    })
```

### Receiving new database notifications live

Polling is simple, but each open page asks the server for news every 30 seconds. With [broadcasting](/notifications/broadcast-notifications#setting-up-broadcasting-in-a-panel) enabled on the panel, the server tells the open pages when a user has new notifications instead, and the bell stops polling. Pass `true` as the third argument of `sendToDatabase()` to announce the notification:

```ts
import { knexNotificationStore, Notification, Panel } from '@navette-js/panels';

const panel = Panel.make()
    // ...
    .databaseNotifications(knexNotificationStore(knex))
    .broadcasting();

await Notification.make()
    .title('Saved successfully')
    .sendToDatabase(panel.getDatabaseNotifications(), user, true);
```

The polling interval still applies while the connection to the server is down. See [receiving database notifications live](/notifications/broadcast-notifications#receiving-database-notifications-live) for the details.

## Managing notifications in the panel

The panel lists the most recent notifications first, 50 per page, with "Previous" and "Next" buttons when there are more. Unread notifications are highlighted, and the panel header offers:

- "Mark all as read", while there are unread notifications.
- "Clear", which deletes all the notifications of the user.

Closing a notification with its close button deletes it.

## Opening the database notifications modal

You can open the database notifications modal from anywhere in the page by dispatching an `open-modal` browser event:

```html
<button x-data x-on:click="$dispatch('open-modal', { id: 'database-notifications' })" type="button">
    Notifications
</button>
```

## Using a custom store

The panel only talks to its store through the `DatabaseNotificationStore` interface. You may implement it to keep notifications anywhere else:

```ts
import type { DatabaseNotificationStore } from '@navette-js/panels';

const store: DatabaseNotificationStore = {
    async list(user, limit, offset = 0) { /* most recent first */ },
    async count(user) { /* ... */ },
    async unreadCount(user) { /* ... */ },
    async send(user, notification) { /* ... */ },
    async delete(user, id) { /* ... */ },
    async markAsRead(user, id, read) { /* read: `true` to mark as read, `false` as unread */ },
    async markAllAsRead(user) { /* ... */ },
    async clear(user) { /* ... */ },
};
```

`list()` returns `DatabaseNotificationRecord` objects: `{ id, title, body, icon, iconColor, status, actions, createdAt, unread }`, where `actions` is a list of `{ label, url, openUrlInNewTab, close, dispatch, color, button, outlined, markAsRead, markAsUnread }` and `createdAt` a `Date` or `null`. `send()` receives the notification's data, with an `id` that is a new UUID.

## Security

Navette provides these protections:

- The store and the user come from the server: every operation of the panel (listing, marking as read, deleting, clearing) is limited to the notifications of the logged-in user.
- Notification IDs sent by the browser must be UUIDs.
- Titles are escaped, bodies are escaped or cleaned, and action URLs are restricted to relative paths and `http(s)` addresses.

What your application must still do:

- In a custom store, scope every query to the `user` argument.
- Choose recipients yourself: `sendToDatabase()` stores the notification for whichever user ID you pass.
