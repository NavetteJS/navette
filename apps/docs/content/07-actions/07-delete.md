---
title: Delete action
---

## Introduction

Navette includes an action that is able to delete records. When the trigger button is clicked, a modal asks the user for confirmation. You may use it like so:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
```

```preview
DeleteAction.make()
```

The action works in two places:

- In the row actions of a table, it deletes the row's record and stays on the page.
- In the header of an edit or view page, it deletes the page's record and redirects to the resource's list page. The edit page of a resource already has this action by default.

To add it to a view page, override `getHeaderActions()`:

```ts
import { DeleteAction, ViewRecord } from '@navette-js/panels';

class ViewPost extends ViewRecord {
    static resource = PostResource;

    getHeaderActions() {
        return [this.editAction(), DeleteAction.make()];
    }
}
```

The record is deleted with the data adapter of the host. When the adapter uses soft deletes, the record is moved to the trash, and the action is hidden for records that are already deleted (see the [restore](/actions/restore) and [force-delete](/actions/force-delete) actions). The action is only visible for records the user is allowed to `delete` according to the resource policy, and it has the `mod+d` keybinding.

Or if you want to add it as a table bulk action, so that the user can choose which rows to delete, use `DeleteBulkAction`:

```ts
import { DeleteBulkAction } from '@navette-js/panels';

table.groupedBulkActions([
    DeleteBulkAction.make(),
])
```

`DeleteBulkAction` deletes the selected records one by one with the adapter's `delete()` (see [improving its performance](#improving-the-performance-of-delete-bulk-actions)), then clears the selection. It is visible to users allowed to `deleteAny` by the resource policy; the policy is checked for each selected record only with `authorizeIndividualRecords('delete')`. A resource list page offers it by default when the table does not declare its own bulk actions.

## Redirecting after deleting

You may redirect the user after the deletion from the `after()` hook, using the `redirect()` method of the host component:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .after(({ livewire }) => livewire.redirect('/blog/posts', true))
```

## Customizing the deletion process

You can replace the deletion with the `using()` method. It receives the context with the `record`; return `false` to report a failure. The notifications and the redirect stay:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .using(async ({ record }) => archive(record))
```

The `action()` method replaces the whole behavior instead, success notification and redirect included. The demo uses this to keep its records:

```ts
import { DeleteAction, DeleteBulkAction, Notification } from '@navette-js/panels';

const refuse = () => {
    Notification.make().warning().title('Records cannot be deleted in the demo.').send();
};

DeleteAction.make().action(refuse)

DeleteBulkAction.make().action(refuse)
```

## Customizing the modal

The modal heading is "Delete" followed by the record title, and the submit button is labeled "Delete". You may change them like in any [modal](/actions/modals):

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .modalHeading(({ record }) => `Delete ${record.name}`)
    .modalDescription('The customer and their addresses will be removed.')
```

## Lifecycle hooks

You can use the `before()` and `after()` methods to execute code before and after a record is deleted:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .before(async ({ record }) => {
        // Runs before the record is deleted.
    })
    .after(async ({ record }) => {
        // Runs after the record is deleted.
    })
```

In a table, `record` is the row's record. In a page header, `record` is the page's record.

## Customizing the deleted notification

When the record is deleted, a notification is sent. To change its title, use `successNotificationTitle()`:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .successNotificationTitle('Post deleted')
```

To change the whole notification, pass a function to `successNotification()`. It receives the notification and returns it, or `null` to send none:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .successNotification((notification) => notification
        .title('Post deleted')
        .body('The change is visible to everyone.'))
```

## Redirecting after success

`successRedirectUrl()` sets the page opened after the action. It takes a URL, or a function receiving the context:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .successRedirectUrl('/admin/posts')
```

Only URLs starting with a single `/`, `http://` or `https://` are followed. On an edit page, the action returns to the list by default.

## Customizing the failure notification

When the record cannot be deleted (the adapter's `delete()` returns `false`, or the process given to `using()` does), no success notification is sent. A failure notification is sent instead if it has a title: set it with `failureNotificationTitle()`, and change the whole notification with `failureNotification()`, which receives it and returns it, or pass `null` to send none. `failureRedirectUrl()` sets the page opened after a failure:

```ts
import { DeleteAction } from '@navette-js/panels';

DeleteAction.make()
    .failureNotificationTitle('The post could not be deleted')
    .failureNotification((notification) => notification.body('It is locked by another user.'))
    .failureRedirectUrl('/admin/posts')
```

## Customizing the bulk notifications and redirect

`DeleteBulkAction` sends its success notification when every selected record was deleted: `successNotificationTitle()`, `successNotification()` and `successRedirectUrl()` work as for the single action, and their functions also receive `successCount` and `totalCount`. When some records could not be deleted, it sends the failure notification instead, with a line for the records the user may not delete and one for the records that failed; `failureNotification()` receives it with `successCount`, `failureCount`, `totalCount` and `isAll` (nothing was deleted), and `failureRedirectUrl()` applies:

```ts
import { DeleteBulkAction } from '@navette-js/panels';

DeleteBulkAction.make()
    .successNotification((notification, { successCount }) => notification.title(`${successCount} posts deleted`))
    .failureNotification((notification, { successCount, totalCount }) => notification.title(`${successCount} of ${totalCount} posts deleted`))
    .successRedirectUrl('/admin/posts')
```

## Improving the performance of delete bulk actions

By default, `DeleteBulkAction` loads the selected records, 100 at a time, and deletes them one by one. If you are deleting a large number of records, you may use the `chunkSelectedRecords()` method to load fewer records at a time:

```ts
import { DeleteBulkAction } from '@navette-js/panels';

DeleteBulkAction.make()
    .chunkSelectedRecords(250)
```

Records are loaded first for two reasons:

- To check each one with a policy ability, using `authorizeIndividualRecords('delete')`.
- To run the adapter's `delete()` for each record, with the logic your adapter adds there.

If you need neither, the `fetchSelectedRecords(false)` method does not load the records: the selected keys are deleted in one call to the adapter's `deleteMany()` (one query with `ObjectionAdapter`), and no record is checked individually:

```ts
import { DeleteBulkAction } from '@navette-js/panels';

DeleteBulkAction.make()
    .fetchSelectedRecords(false)
```

The selected keys are always narrowed to the records the table can show. `using()` replaces the process: it receives the loaded `records` and their `keys` (only the `keys` with `fetchSelectedRecords(false)`), and returns `false` when it failed.

## Halting the process

At any time, you may call `action.halt()` from a hook (such as `before()`) to stop the action: the modal stays open. `action.cancel()` stops it and closes the modal:

```ts
import { DeleteAction, Notification } from '@navette-js/panels';

DeleteAction.make()
    .before(({ action, record }) => {
        if (!userHasCredits()) {
            Notification.make().warning().title('You have no credits left').send();
            action!.halt();
        }
    })
```
