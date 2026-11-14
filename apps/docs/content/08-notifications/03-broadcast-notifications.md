---
title: Broadcast notifications
---

## Introduction

By default, [flash notifications](/notifications/overview) are sent with the response to the request that created them, so they only reach the browser of the user making that request. You may wish that your notifications are "broadcast" to a user in real-time, instead. This could be used to send a temporary success notification from a background job after it has finished processing, or to tell another user that something happened.

Navette delivers broadcast notifications over Server-Sent Events: each open page of a signed-in user keeps a connection to the panel, and the server pushes messages to it. This works out of the box, without any external service, as long as the application runs in a single Node.js process. For several processes, see [using another transport](#using-another-transport).

## Setting up broadcasting in a panel

To enable broadcasting, call `broadcasting()` on the panel:

```ts
import { Panel } from '@navette-js/panels';

const panel = Panel.make()
    // ...
    .broadcasting();
```

Every page of the panel opened by a signed-in user now connects to the panel's stream at `<panel path>/livewire/broadcasting`. The browser reconnects by itself after a network error, and messages published while it was disconnected are delivered on reconnection (for up to two minutes).

The server sends a keep-alive message every 25 seconds, and checks the user's session at the same time: when the user signs out or loses access to the panel, the stream is closed. You may change this interval, in milliseconds:

```ts
panel.broadcasting(true, { heartbeat: 15_000 });
```

<Aside variant="warning">
A proxy in front of the application must not buffer the stream. Navette sends `Cache-Control: no-transform` and `X-Accel-Buffering: no`, which nginx honors; for other proxies, disable response buffering for the `/livewire/broadcasting` path, and allow long-lived connections.
</Aside>

## Sending broadcast notifications

To broadcast a notification, build it as usual and call `broadcast()` with the recipient, a user object or a user ID. The method is asynchronous:

```ts
import { Notification } from '@navette-js/panels';

await Notification.make()
    .title('Saved successfully')
    .success()
    .broadcast(user);
```

The notification appears on every page of the panel that the user has open, a few moments later. Unlike `send()`, `broadcast()` can be called outside of a request: from a timer, a queue worker or a webhook handler. A user without any open page simply does not see it.

You may pass several recipients at once:

```ts
await Notification.make()
    .title('The export is ready')
    .broadcast([author, reviewer]);
```

Inside an action, the current user is `livewire._ctx.user` and the panel is `livewire.panel`:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Action.make('export')
    .action(({ livewire }) => {
        const user = livewire._ctx.user;
        const panel = livewire.panel;
        setTimeout(() => {
            void Notification.make().info().title('Background job finished').broadcast(user, { panel });
        }, 2000);
    })
```

### Limiting a notification to a panel or a tenant

The second argument of `broadcast()` may restrict where the notification is shown:

| Option | Effect |
|---|---|
| `panel` | Only shown in this panel. The user's channel is the panel's (see [channels](#choosing-the-channel-of-a-user)). |
| `tenant` | Only shown on the pages of this tenant, given by its key (`panel.getTenantUrlKey(team)`). Without it, the notification is shown whatever the tenant of the page. |
| `guard` | The auth guard of the user, when you don't pass `panel` (`'web'` by default). |

```ts
await Notification.make()
    .title('A new member joined your team')
    .broadcast(owner, { panel, tenant: panel.getTenantUrlKey(team) });
```

In a [multi-tenant panel](/panels/tenancy), a page connects to the stream for its own tenant, and the panel checks that the user is a member of that tenant before opening the stream.

## Receiving database notifications live

When the panel has both [database notifications](/notifications/database-notifications) and broadcasting, the bell does not poll anymore. Pass `true` as the third argument of `sendToDatabase()` to tell the user's open pages to fetch their notifications at once:

```ts
await Notification.make()
    .title('New order')
    .sendToDatabase(panel.getDatabaseNotifications(), user, true, { panel });
```

The last argument takes the same options as `broadcast()`. If you store notifications without `sendToDatabase()`, you may announce them with `dispatchDatabaseNotificationsSent()`:

```ts
import { dispatchDatabaseNotificationsSent } from '@navette-js/panels';

await dispatchDatabaseNotificationsSent(user, { panel });
```

While the stream is disconnected, the bell polls at the [polling interval](/notifications/database-notifications#polling-for-new-database-notifications) (`30s` by default), and it fetches the notifications again as soon as the stream reconnects. With `databaseNotificationsPolling(null)`, it does not poll at all.

## Choosing the channel of a user

Each user has a private channel. By default, its name is `<auth guard>.users.<id>`, for example `web.users.1`: panels sharing a session use the same channels, and a panel with [its own user table](/panels/users) has its own guard, hence its own channels. A user object may name its channel with a `receivesBroadcastNotificationsOn()` method:

```ts
const auth = {
    // ...
    async find(id) {
        const user = await knex('customers').where({ id }).first();
        return user ? { ...user, receivesBroadcastNotificationsOn: () => `customers.${user.id}` } : null;
    },
};
```

Pass the same kind of user object to `broadcast()`, or pass the panel, so that both sides agree on the channel. `panel.getBroadcastChannel(user)` returns the channel of a user of that panel.

## Using another transport

Messages go through a broadcaster. The default one, `MemoryBroadcaster`, delivers them inside the current process. When the application runs in several processes (a cluster, several containers), a message published in one process must reach the streams opened in the others: replace the broadcaster at startup with `useBroadcaster()`, before serving requests.

A broadcaster has two methods: `publish()` sends a message to every process, and `subscribe()` receives the messages of one channel and returns a function that stops receiving them. Each process subscribes once per channel, whatever the number of open pages. For example, with Redis publish/subscribe and the `ioredis` package:

```ts
import Redis from 'ioredis';
import { useBroadcaster, type BroadcastMessage } from '@navette-js/panels';

const publisher = new Redis();
const subscriber = new Redis();
const listeners = new Map<string, Set<(message: BroadcastMessage) => void>>();
subscriber.on('message', (channel: string, payload: string) => {
    for (const listener of listeners.get(channel) ?? []) listener(JSON.parse(payload));
});

useBroadcaster({
    publish: async (message) => { await publisher.publish(message.channel, JSON.stringify(message)); },
    subscribe(channel, listener) {
        const set = listeners.get(channel) ?? new Set();
        if (!set.size) void subscriber.subscribe(channel);
        set.add(listener);
        listeners.set(channel, set);
        return () => {
            set.delete(listener);
            if (!set.size) { listeners.delete(channel); void subscriber.unsubscribe(channel); }
        };
    },
});
```

A message is `{ channel, event, data, tenant, panel }`. The same interface fits a hosted service with a publish/subscribe API.

<Aside variant="info">
Messages published while a process was disconnected from the transport are not replayed by other processes. The bell fetches the notifications again when the stream reconnects, so database notifications are never lost; a flash notification broadcast during the disconnection may be.
</Aside>

## Security

Navette provides these protections:

- The stream is only served to a signed-in user of the panel, after the same checks as its pages (access to the panel, email verification, required multi-factor authentication). Guests get a `401` response, other users a `403`, and cross-site requests are refused.
- A stream only carries the messages of the signed-in user's own channel: a user never receives another user's notifications. In a multi-tenant panel, the user must be a member of the tenant of the stream.
- The session is checked again at every heartbeat: signing out or losing access closes the stream.
- A notification shown by the browser comes back to the server to be displayed; it is rebuilt from checked values (lengths, status, icon names, action URLs and event names), and its title, body and labels are escaped.
- Each user may have at most 20 open streams per process; beyond that, the oldest one is closed.

What your application must still do:

- Choose the recipients yourself: `broadcast()` sends the notification to whichever users you pass.
- Never put secrets in a notification: it is sent to the browser.
- With a custom transport, keep it private to the application (for example, a Redis server that only your processes can reach).
