---
title: Testing notifications
---

## Introduction

[Notifications](/notifications/overview) sent while the tester mounts the component or handles a step are collected. `assertNotified()` checks that at least one was sent:

```ts
import { test } from 'node:test';
import { livewire } from '@navette-js/panels/testing';
import { TaskResource } from '../src/admin/resources/TaskResource.ts';

test('creating a task notifies the user', async () => {
    await livewire(TaskResource.getPages().create)
        .fillForm({ title: 'Write the tests' })
        .call('create')
        .assertNotified();
});
```

## Testing the title of a notification

Pass a title to check that a notification with this title was sent:

```ts
await livewire(TaskResource.getPages().index)
    .callTableAction('toggle', task)
    .assertNotified('Task updated');
```

When it fails, the message lists the titles of the notifications that were sent.

## Testing the whole notification

Pass a notification to check that exactly this notification was sent: its title, body, status, icon, duration and actions:

```ts
import { Notification } from '@navette-js/panels';

await livewire(TaskResource.getPages().index)
    .callTableAction('archive', task)
    .assertNotified(
        Notification.make()
            .warning()
            .title('Task archived')
            .body('You can restore it from the archive.'),
    );
```

## Testing that no notification was sent

`assertNotNotified()` checks that no notification was sent, or none with a given title, or not a given notification:

```ts
await livewire(TaskResource.getPages().create)
    .fillForm({ title: '' })
    .call('create')
    .assertNotNotified();
```

## Checking the notifications of each step

Notifications are collected until an assertion reads them: `assertNotified()` and `assertNotNotified()` consume the notifications sent so far. Each assertion therefore checks the steps since the previous one:

```ts
await livewire(TaskResource.getPages().create)
    .fillForm({ title: 'First' })
    .call('createAnother')
    .assertNotified('Created')
    .fillForm({ title: '' })
    .call('createAnother')
    .assertNotNotified();
```

After the chain has run, `getNotifications()` returns every notification sent during the test, each with its `title`, `body`, `status` and `actions`.

Notifications sent to the database of the user (`sendToDatabase()`) are not flash notifications: check them in the notifications table of your test database.

## Testing notifications sent outside a component

A notification may be sent by code that is not a component: a route of the application, a job, a function you test on its own. `assertNotified()` and `assertNotNotified()`, imported from `@navette-js/panels/testing`, check every notification sent since the last of these assertions, wherever it was sent:

```ts
import { assertNotified, assertNotNotified, clearSentNotifications } from '@navette-js/panels/testing';

beforeEach(() => clearSentNotifications());

test('the import job notifies when it is done', async () => {
    await importTasks(file);
    assertNotified('Import completed');
    assertNotNotified('Import failed');
});
```

They take a title, a `Notification`, or nothing, like the methods of the tester, and consume the notifications they have seen. In tests, `Notification.send()` called outside a request records the notification instead of failing. The notifications sent by a component under test are seen by both: the tester's `assertNotified()` and the standalone one.
