---
title: Create action
---

## Introduction

Navette includes an action that is able to create records. When the trigger button is clicked, a modal will open with a form, using the `form()` schema of the resource. The user fills the form, the data is validated on the server, and the record is created with the resource's data adapter. You may use it like so:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
```

```preview
// Outside a resource, the default label ("New" + the model label) is not available: set it.
CreateAction.make()
    .label('New address')
```

The action is usually placed in the header of a table, for example in a relation manager:

```ts
import { CreateAction, DeleteAction, EditAction, RelationManager } from '@navette-js/panels';
import type { Table } from '@navette-js/tables';

class AddressesRelationManager extends RelationManager {
    static relationship = 'addresses';
    static modelLabel = 'address';

    // adapterFor(), form()...

    static table(table: Table): Table {
        return table
            .columns([
                // ...
            ])
            .headerActions([CreateAction.make()])
            .recordActions([EditAction.make(), DeleteAction.make()]);
    }
}
```

Without an argument, the action uses the resource (or relation manager) of the component that hosts it: its `form()`, its data adapter and its model label ("New address"). You may pass another resource explicitly: `CreateAction.make(PostCategoryResource)`.

The list page of a simple resource (`static isSimple = true`) already has a create action in its header. To add your own header actions next to it, override `getHeaderActions()` in the list page and include `CreateAction.make(this.resource)`.

After a successful creation, a "Created" notification is sent and the modal closes. The action is only visible to users allowed to `create` records by the resource policy.

## Customizing data before saving

Sometimes, you may wish to modify form data before it is finally saved to the database. To do this, you may use the `mutateDataUsing()` method, which has access to the `data` as an object, and returns the modified version:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .mutateDataUsing((data, { livewire }) => ({ ...data, user_id: livewire._ctx.user.id }))
```

## Customizing the creation process

You can tweak how the record is created with the `using()` method. It receives the context with the validated `data`, and returns the created record (whose form relationships are then saved). The success notification and redirect stay:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .using(async ({ data, livewire }) => livewire.getDataAdapter().create({ ...data, status: 'draft' }))
```

The `action()` method replaces the whole behavior instead, success notification included.

## Redirecting after creation

You may redirect the user when the form is submitted, from the `after()` hook, using the `redirect()` method of the host component:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .after(({ livewire }) => livewire.redirect(PostResource.getUrl(), true))
```

The second argument of `redirect()` navigates without a full page reload. The "Created" notification is displayed on the next page.

To redirect to the new record, replace the creation process with `action()` and use the record returned by `adapter.create()`.

## Lifecycle hooks

Hooks may be used to execute code at various points within the action's lifecycle:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .before(async ({ data }) => {
        // Runs after `mutateDataUsing()`, before the record is created.
    })
    .after(async ({ data }) => {
        // Runs after the record is created.
    })
```

The form has hooks of its own, run when the modal opens and when it is submitted:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .beforeFormFilled(async ({ data }) => {
        // Runs when the modal opens, before the form is filled with its defaults.
    })
    .afterFormFilled(async ({ data }) => {
        // Runs when the modal opens, after the form is filled: `data` is its state, which you may change.
    })
    .beforeFormValidated(async ({ data }) => {
        // Runs when the form is submitted, before it is validated.
    })
    .afterFormValidated(async ({ data }) => {
        // Runs when the form is submitted, once it is valid, before `mutateDataUsing()`.
    })
```

`action.halt()` in `beforeFormValidated()` keeps the modal open without validating the form; `action.cancel()` in `beforeFormFilled()` or `afterFormFilled()` does not open it. These hooks exist on every action with a modal form.

## Creating another record

The modal has a "Create & create another" button, which creates the record and keeps the modal open with an empty form.

### Modifying the create another action

If you'd like to modify the "create another" action, you may use the `createAnotherAction()` method, passing a function that receives the action and returns it changed:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .createAnotherAction((action) => action.label('Custom create another label'))
```

### Disabling create another

If you'd like to remove the "create another" button from the modal, you can use the `createAnother(false)` method:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .createAnother(false)
```

Passing your own `extraModalFooterActions()` replaces the button too; `getCreateAnotherAction()` returns it, to place it among them.

## Customizing the created notification

When the record is created, a notification is sent. To change its title, use `successNotificationTitle()`:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .successNotificationTitle('Address created')
```

To change the whole notification, pass a function to `successNotification()`. It receives the notification and returns it, or `null` to send none:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .successNotification((notification) => notification
        .title('Address created')
        .body('The change is visible to everyone.'))
```

## Redirecting after success

`successRedirectUrl()` sets the page opened after the action. It takes a URL, or a function receiving the context with the created `record`: `successRedirectUrl(({ record }) => '/admin/addresses/' + record.id + '/edit')`:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .successRedirectUrl('/admin/posts')
```

Only URLs starting with a single `/`, `http://` or `https://` are followed.

## Halting the process

At any time, you may call `action.halt()` from a hook (such as `before()`) to stop the action: the modal stays open. `action.cancel()` stops it and closes the modal:

```ts
import { CreateAction, Notification } from '@navette-js/panels';

CreateAction.make()
    .before(({ action, data }) => {
        if (!userHasCredits()) {
            Notification.make().warning().title('You have no credits left').send();
            action!.halt();
        }
    })
```

## Preserving data when creating another

"Create & create another" empties the form. To keep some fields, pass their names to `preserveFormDataWhenCreatingAnother()`, or a function returning the data to keep:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .preserveFormDataWhenCreatingAnother(['country', 'city'])
```

## Using a wizard

You may transform the creation process into a multistep wizard with [`steps()`](/actions/modals#using-a-wizard-as-a-modal), instead of the resource form:

```ts
import { Step, TextInput } from '@navette-js/forms';
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .steps([
        Step.make('Address').schema([TextInput.make('street').required(), TextInput.make('city').required()]),
        Step.make('Contact').schema([TextInput.make('phone')]),
    ])
```

Steps are validated one at a time before the next one opens. To let the user move between steps freely, use `skippableSteps()`; the whole form is still validated when it is submitted:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .steps([
        // ...
    ])
    .skippableSteps()
```
