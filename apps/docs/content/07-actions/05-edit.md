---
title: Edit action
---

## Introduction

Navette includes an action that is able to edit records. When the trigger button is clicked, a modal will open with a form, using the `form()` schema of the resource, filled with the attributes of the record. The user submits the form, the data is validated on the server, and the record is updated with the resource's data adapter. You may use it like so:

```ts
import { EditAction } from '@navette-js/panels';

EditAction.make()
```

```preview
EditAction.make()
```

The action is placed in the row actions of a table, for example in a relation manager or a simple resource:

```ts
import { ActionGroup } from '@navette-js/actions';
import { DeleteAction, EditAction } from '@navette-js/panels';

table.recordActions([
    ActionGroup.make([
        EditAction.make(),
        DeleteAction.make(),
    ]),
])
```

```preview
ActionGroup.make([
    EditAction.make(),
    DeleteAction.make(),
])
```

Without an argument, the action uses the resource (or relation manager) of the component that hosts it. You may pass another resource explicitly: `EditAction.make(DepartmentResource)`.

In a simple resource, and in a relation manager that has an `edit` row action, clicking a row opens this action.

After a successful update, a "Saved" notification is sent and the modal closes. The action is only visible for records the user is allowed to `update` according to the resource policy.

<Aside variant="info">
The edit page of a regular resource is a page, not this action: its form, lifecycle hooks (`mutateFormDataBeforeSave()`, `afterSave()`…) and redirect are configured on the `EditRecord` page class.
</Aside>

## Customizing data before filling the form

By default, the form is filled with all the attributes of the record. You may modify the data before it is filled into the form using the `fillForm()` method, which receives the action's context:

```ts
import { EditAction } from '@navette-js/panels';

EditAction.make()
    .fillForm(({ record }) => ({ ...record, tags: String(record.tags ?? '').split(',') }))
```

## Customizing data before saving

Sometimes, you may wish to modify form data before it is finally saved to the database. To do this, you may use the `mutateDataUsing()` method, which has access to the `data` as an object, and returns the modified version:

```ts
import { EditAction } from '@navette-js/panels';

EditAction.make()
    .mutateDataUsing((data, { livewire }) => ({ ...data, last_edited_by_id: livewire._ctx.user.id }))
```

## Customizing the saving process

You can tweak how the record is updated with the `action()` method. It replaces the default behavior, including the success notification:

```ts
import { EditAction, Notification } from '@navette-js/panels';

EditAction.make()
    .action(async ({ record, data }) => {
        await PostResource.adapter.update(record.id, { ...data, revised_at: new Date().toISOString() });
        Notification.make().success().title('Post revised').send();
    })
```

## Redirecting after saving

You may redirect the user when the form is submitted, from the `after()` hook, using the `redirect()` method of the host component:

```ts
import { EditAction } from '@navette-js/panels';

EditAction.make()
    .after(({ livewire, record }) => livewire.redirect(PostResource.getUrl('view', record.id), true))
```

## Lifecycle hooks

Hooks may be used to execute code at various points within the action's lifecycle:

```ts
import { EditAction } from '@navette-js/panels';

EditAction.make()
    .before(async ({ record, data }) => {
        // Runs after `mutateDataUsing()`, before the record is updated.
    })
    .after(async ({ record, data }) => {
        // Runs after the record is updated. `record` holds the attributes read before the update.
    })
```

## Customizing the saved notification

When the record is saved, a notification is sent. To change its title, use `successNotificationTitle()`:

```ts
import { EditAction } from '@navette-js/panels';

EditAction.make()
    .successNotificationTitle('Address updated')
```

To change the whole notification, pass a function to `successNotification()`. It receives the notification and returns it, or `null` to send none:

```ts
import { EditAction } from '@navette-js/panels';

EditAction.make()
    .successNotification((notification) => notification
        .title('Address updated')
        .body('The change is visible to everyone.'))
```

## Redirecting after success

`successRedirectUrl()` sets the page opened after the action. It takes a URL, or a function receiving the context with the `record`:

```ts
import { EditAction } from '@navette-js/panels';

EditAction.make()
    .successRedirectUrl('/admin/posts')
```

Only URLs starting with a single `/`, `http://` or `https://` are followed.

## Halting the process

At any time, you may call `action.halt()` from a hook (such as `before()`) to stop the action: the modal stays open. `action.cancel()` stops it and closes the modal:

```ts
import { EditAction, Notification } from '@navette-js/panels';

EditAction.make()
    .before(({ action, data }) => {
        if (!userHasCredits()) {
            Notification.make().warning().title('You have no credits left').send();
            action!.halt();
        }
    })
```
