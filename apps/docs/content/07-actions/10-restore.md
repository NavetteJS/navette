---
title: Restore action
---

## Introduction

Navette includes an action that is able to restore soft-deleted records. When the trigger button is clicked, a modal asks the user for confirmation. You may use it like so:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
```

```preview
RestoreAction.make()
```

The action is visible only when the page's record is in the trash, and only to users allowed to `restore` it according to the resource policy. It restores the record with the adapter's `restore()`, reloads it, and sends a "Restored" notification. The user stays on the page.

Records can be restored when the resource's data adapter has soft deletes enabled. Set `findsTrashed: true` too, so that the edit and view pages can still load a record once it is in the trash:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { Resource } from '@navette-js/panels';

export class ProjectResource extends Resource {
    static adapter = new ObjectionAdapter(Project, { softDeletes: 'deleted_at', findsTrashed: true });
}
```

Users reach deleted records through a `TrashedFilter` on the table. The edit page of such a resource already has `DeleteAction`, `RestoreAction` and `ForceDeleteAction` in its header. When you override `getHeaderActions()` of an edit or view page, include the actions you want to keep:

```ts
import { DeleteAction, ForceDeleteAction, RestoreAction, ViewRecord } from '@navette-js/panels';

class ViewProject extends ViewRecord {
    static resource = ProjectResource;

    getHeaderActions() {
        return [this.editAction(), DeleteAction.make(), RestoreAction.make(), ForceDeleteAction.make()];
    }
}
```

## Using RestoreAction in a table

In a table that shows deleted records — with a [`TrashedFilter`](/tables/filters/ternary) — add it to the row actions: it is only shown on the deleted rows. To act on several records at once, use its bulk version:

```ts
import { RestoreAction, RestoreBulkAction } from '@navette-js/panels';
import { TrashedFilter } from '@navette-js/tables';

table
    .filters([TrashedFilter.make()])
    .recordActions([RestoreAction.make()])
    .groupedBulkActions([RestoreBulkAction.make()])
```

A row action finds deleted records only while the trashed filter shows them: a key sent by the browser for any other record is refused. The bulk action checks the `restore` ability on each selected record.

## Lifecycle hooks

You can use the `before()` and `after()` methods to execute code before and after a record is restored:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .before(async ({ record }) => {
        // Runs before the record is restored.
    })
    .after(async ({ livewire }) => {
        // Runs after the record is restored.
    })
```

## Customizing the restoring process

You can replace the default process with the `using()` method. The notifications, the redirect and the hooks stay; return `false` to report a failure:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .using(async ({ record, livewire }) => livewire.getDataAdapter().restore(record.id))
```

The `action()` method replaces the whole behavior instead, notifications and redirect included.

## Redirecting after restoring

You may redirect the user after the record is restored from the `after()` hook:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .after(({ livewire }) => livewire.redirect(ProjectResource.getUrl(), true))
```

## Customizing the restored notification

When the record is restored, a notification is sent. To change its title, use `successNotificationTitle()`:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .successNotificationTitle('Post restored')
```

To change the whole notification, pass a function to `successNotification()`. It receives the notification and returns it, or `null` to send none:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .successNotification((notification) => notification
        .title('Post restored')
        .body('The change is visible to everyone.'))
```

## Redirecting after success

`successRedirectUrl()` sets the page opened after the action. It takes a URL, or a function receiving the context:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .successRedirectUrl('/admin/posts')
```

Only URLs starting with a single `/`, `http://` or `https://` are followed.

## Customizing the failure notification

When the record cannot be restored (the adapter's `restore()` returns `false`, or the process given to `using()` does), no success notification is sent. A failure notification is sent instead if it has a title: set it with `failureNotificationTitle()`, and change the whole notification with `failureNotification()`, which receives it and returns it, or pass `null` to send none. `failureRedirectUrl()` sets the page opened after a failure:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .failureNotificationTitle('The post could not be restored')
    .failureNotification((notification) => notification.body('It is locked by another user.'))
    .failureRedirectUrl('/admin/posts')
```

## Customizing the bulk notifications and redirect

`RestoreBulkAction` sends its success notification when every selected record was restored: `successNotificationTitle()`, `successNotification()` and `successRedirectUrl()` work as for the single action, and their functions also receive `successCount` and `totalCount`. When some records could not be restored, it sends the failure notification instead, with a line for the records the user may not restore and one for the records that failed; `failureNotification()` receives it with `successCount`, `failureCount`, `totalCount` and `isAll` (nothing was restored), and `failureRedirectUrl()` applies:

```ts
import { RestoreBulkAction } from '@navette-js/panels';

RestoreBulkAction.make()
    .successNotification((notification, { successCount }) => notification.title(`${successCount} posts restored`))
    .failureNotification((notification, { successCount, totalCount }) => notification.title(`${successCount} of ${totalCount} posts restored`))
    .successRedirectUrl('/admin/posts')
```

## Improving the performance of restore bulk actions

By default, `RestoreBulkAction` loads the selected records, 100 at a time, and restores them one by one. If you are restoring a large number of records, you may use the `chunkSelectedRecords()` method to load fewer records at a time:

```ts
import { RestoreBulkAction } from '@navette-js/panels';

RestoreBulkAction.make()
    .chunkSelectedRecords(250)
```

Records are loaded first for two reasons:

- To check each one with a policy ability, using `authorizeIndividualRecords('restore')` (the default of this action).
- To run the adapter's `restore()` for each record, with the logic your adapter adds there.

If you need neither, the `fetchSelectedRecords(false)` method does not load the records: the selected keys are restored in one call to the adapter's `restoreMany()` (one query with `ObjectionAdapter`), and no record is checked individually:

```ts
import { RestoreBulkAction } from '@navette-js/panels';

RestoreBulkAction.make()
    .fetchSelectedRecords(false)
```

The selected keys are always narrowed to the records the table can show. `using()` replaces the process: it receives the loaded `records` and their `keys` (only the `keys` with `fetchSelectedRecords(false)`), and returns `false` when it failed.
