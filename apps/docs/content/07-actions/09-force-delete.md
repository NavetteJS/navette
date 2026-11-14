---
title: Force-delete action
---

## Introduction

Navette includes an action that is able to permanently delete soft-deleted records. When the trigger button is clicked, a modal asks the user for confirmation. You may use it like so:

```ts
import { ForceDeleteAction } from '@navette-js/panels';

ForceDeleteAction.make()
```

```preview
ForceDeleteAction.make()
```

The action is visible only when the page's record is in the trash, and only to users allowed to `forceDelete` it according to the resource policy. It deletes the record with the adapter's `forceDelete()`, sends a "Deleted" notification and redirects to the resource's list page.

Records are soft-deleted when the resource's data adapter has soft deletes enabled. Set `findsTrashed: true` too, so that the edit and view pages can still load a record once it is in the trash:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { Resource } from '@navette-js/panels';

export class ProjectResource extends Resource {
    static adapter = new ObjectionAdapter(Project, { softDeletes: 'deleted_at', findsTrashed: true });
}
```

The edit page of such a resource already has `DeleteAction`, `RestoreAction` and `ForceDeleteAction` in its header. Users reach deleted records through a `TrashedFilter` on the table. When you override `getHeaderActions()` of an edit or view page, include the actions you want to keep:

```ts
import { DeleteAction, EditRecord, ForceDeleteAction, RestoreAction, ViewAction } from '@navette-js/panels';

class EditProject extends EditRecord {
    static resource = ProjectResource;

    getHeaderActions() {
        return [ViewAction.make(), DeleteAction.make(), RestoreAction.make(), ForceDeleteAction.make()];
    }
}
```

## Using ForceDeleteAction in a table

In a table that shows deleted records — with a [`TrashedFilter`](/tables/filters/ternary) — add it to the row actions: it is only shown on the deleted rows. To act on several records at once, use its bulk version:

```ts
import { ForceDeleteAction, ForceDeleteBulkAction } from '@navette-js/panels';
import { TrashedFilter } from '@navette-js/tables';

table
    .filters([TrashedFilter.make()])
    .recordActions([ForceDeleteAction.make()])
    .groupedBulkActions([ForceDeleteBulkAction.make()])
```

A row action finds deleted records only while the trashed filter shows them: a key sent by the browser for any other record is refused. The bulk action checks the `forceDelete` ability on each selected record.

## Lifecycle hooks

You can use the `before()` and `after()` methods to execute code before and after a record is force-deleted:

```ts
import { ForceDeleteAction } from '@navette-js/panels';

ForceDeleteAction.make()
    .before(async ({ record }) => {
        // Runs before the record is force-deleted.
    })
    .after(async ({ record }) => {
        // Runs after the record is force-deleted.
    })
```

## Customizing the force-deletion process

You can replace the deletion with the `using()` method. It receives the context with the `record`; return `false` to report a failure. The notifications and the redirect stay:

```ts
import { ForceDeleteAction } from '@navette-js/panels';

ForceDeleteAction.make()
    .using(async ({ livewire }) => {
        await deleteProjectFiles(livewire.recordKey);
        return livewire.getDataAdapter().forceDelete(livewire.recordKey);
    })
```

The `action()` method replaces the whole behavior instead, success notification and redirect included:

```ts
import { ForceDeleteAction, Notification } from '@navette-js/panels';

ForceDeleteAction.make()
    .action(async ({ livewire }) => {
        await livewire.getDataAdapter().forceDelete(livewire.recordKey);
        await deleteProjectFiles(livewire.recordKey);
        Notification.make().success().title('Project and files deleted').send();
        livewire.redirect(ProjectResource.getUrl(), true);
    })
```

## Customizing the deleted notification

When the record is deleted, a notification is sent. To change its title, use `successNotificationTitle()`:

```ts
import { ForceDeleteAction } from '@navette-js/panels';

ForceDeleteAction.make()
    .successNotificationTitle('Post deleted for good')
```

To change the whole notification, pass a function to `successNotification()`. It receives the notification and returns it, or `null` to send none:

```ts
import { ForceDeleteAction } from '@navette-js/panels';

ForceDeleteAction.make()
    .successNotification((notification) => notification
        .title('Post deleted for good')
        .body('The change is visible to everyone.'))
```

## Redirecting after success

`successRedirectUrl()` sets the page opened after the action. It takes a URL, or a function receiving the context:

```ts
import { ForceDeleteAction } from '@navette-js/panels';

ForceDeleteAction.make()
    .successRedirectUrl('/admin/posts')
```

Only URLs starting with a single `/`, `http://` or `https://` are followed. By default, the action returns to the list.

## Customizing the failure notification

When the record cannot be deleted (the adapter's `forceDelete()` returns `false`, or the process given to `using()` does), no success notification is sent. A failure notification is sent instead if it has a title: set it with `failureNotificationTitle()`, and change the whole notification with `failureNotification()`, which receives it and returns it, or pass `null` to send none. `failureRedirectUrl()` sets the page opened after a failure:

```ts
import { ForceDeleteAction } from '@navette-js/panels';

ForceDeleteAction.make()
    .failureNotificationTitle('The post could not be deleted')
    .failureNotification((notification) => notification.body('It is locked by another user.'))
    .failureRedirectUrl('/admin/posts')
```

## Customizing the bulk notifications and redirect

`ForceDeleteBulkAction` sends its success notification when every selected record was deleted: `successNotificationTitle()`, `successNotification()` and `successRedirectUrl()` work as for the single action, and their functions also receive `successCount` and `totalCount`. When some records could not be deleted, it sends the failure notification instead, with a line for the records the user may not force-delete and one for the records that failed; `failureNotification()` receives it with `successCount`, `failureCount`, `totalCount` and `isAll` (nothing was deleted), and `failureRedirectUrl()` applies:

```ts
import { ForceDeleteBulkAction } from '@navette-js/panels';

ForceDeleteBulkAction.make()
    .successNotification((notification, { successCount }) => notification.title(`${successCount} posts deleted`))
    .failureNotification((notification, { successCount, totalCount }) => notification.title(`${successCount} of ${totalCount} posts deleted`))
    .successRedirectUrl('/admin/posts')
```

## Improving the performance of force-delete bulk actions

By default, `ForceDeleteBulkAction` loads the selected records, 100 at a time, and force-deletes them one by one. If you are force-deleting a large number of records, you may use the `chunkSelectedRecords()` method to load fewer records at a time:

```ts
import { ForceDeleteBulkAction } from '@navette-js/panels';

ForceDeleteBulkAction.make()
    .chunkSelectedRecords(250)
```

Records are loaded first for two reasons:

- To check each one with a policy ability, using `authorizeIndividualRecords('forceDelete')` (the default of this action).
- To run the adapter's `forceDelete()` for each record, with the logic your adapter adds there.

If you need neither, the `fetchSelectedRecords(false)` method does not load the records: the selected keys are deleted in one call to the adapter's `forceDeleteMany()` (one query with `ObjectionAdapter`), and no record is checked individually:

```ts
import { ForceDeleteBulkAction } from '@navette-js/panels';

ForceDeleteBulkAction.make()
    .fetchSelectedRecords(false)
```

The selected keys are always narrowed to the records the table can show. `using()` replaces the process: it receives the loaded `records` and their `keys` (only the `keys` with `fetchSelectedRecords(false)`), and returns `false` when it failed.
