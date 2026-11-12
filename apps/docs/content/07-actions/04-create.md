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

You can tweak how the record is created with the `action()` method. It replaces the default behavior, including the success notification:

```ts
import { CreateAction, Notification } from '@navette-js/panels';

CreateAction.make()
    .action(async ({ data }) => {
        await PostResource.adapter.create({ ...data, status: 'draft' });
        Notification.make().success().title('Draft created').send();
    })
```

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

## Creating another record

### Disabling create another

The modal has a "Create & create another" button, which creates the record and keeps the modal open with an empty form. If you'd like to remove this button, you can pass an empty array of extra footer actions:

```ts
import { CreateAction } from '@navette-js/panels';

CreateAction.make()
    .extraModalFooterActions([])
```

<Aside variant="warning">
Customizing the success notification and redirect URL with dedicated methods, halting the creation process, using a wizard, and preserving data when creating another record are not available yet.
</Aside>
