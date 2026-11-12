---
title: Actions
---

## Introduction

Navette's tables can use [actions](/actions/overview). They are buttons that can be added to the [end of any table row](#record-actions), or to the [header](#header-actions) of a table. For instance, you may want an action to "create" a new record in the header, and then "edit" and "delete" actions on each row. [Bulk actions](#bulk-actions) can be used to execute code when records in the table are selected.

## Record actions

Action buttons can be rendered at the end of each table row. You can put them in the `recordActions()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .recordActions([
            // ...
        ]);
}
```

Actions may be created using the static `make()` method, passing their unique name.

You can then pass a function to `action()` which executes the task, or a function to `url()` which creates a link:

```ts
import { Action } from '@navette-js/actions';

Action.make('edit')
    .url(({ record }) => PostResource.getUrl('edit', (record as Post).id))
    .openUrlInNewTab()

Action.make('delete')
    .requiresConfirmation()
    .action(async ({ record }) => { await PostResource.adapter.delete((record as Post).id); })
```

The functions you pass to an action receive an object with the current table `record` that was clicked, and the `livewire` component of the page. The `action()` function also receives the `data` of the action's form, if it has one.

The record is loaded again from the data adapter when the action runs, using the key sent by the browser: a key outside the adapter's scope finds no record.

<Aside variant="warning">
Custom actions must be authorized explicitly, with `authorize()`. Navette checks `authorize()`, `visible()`, `hidden()` and `disabled()` on the server before running an action, but an action without `authorize()` can be run by any user who can open the page. For URL actions, the destination page must also authorize access.
</Aside>

```ts
import { Action } from '@navette-js/actions';
import { can } from '@navette-js/panels';

Action.make('publish')
    .authorize(({ livewire, record }) => can(livewire, 'update', record))
    .action(async ({ record }) => { /* ... */ })
```

`can()` checks an ability of the resource's [policy](/resources/overview) for the current user.

### Using the built-in record actions

`@navette-js/panels` provides ready-made actions for resource tables. They use the resource's form, data adapter and policy:

| Action | Purpose |
|---|---|
| `EditAction` | Edits the record in a modal, with the resource's form. |
| `ViewAction` | Opens the view page, or the resource's infolist in a modal when there is no view page. |
| `DeleteAction` | Deletes the record (soft-deletes it if the adapter supports it), after confirmation. |
| `RestoreAction`, `ForceDeleteAction` | Restore or permanently delete a soft-deleted record. |
| `ReplicateAction` | Creates a copy of the record. |
| `DetachAction` | Detaches a record in a relation manager. |

```ts
import { DeleteAction, EditAction, ViewAction } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';

static table(table: Table<PostCategory>): Table<PostCategory> {
    return table
        .recordActions([
            ViewAction.make(),
            EditAction.make(),
            DeleteAction.make(),
        ]);
}
```

Each of them checks the matching policy ability (`view`, `update`, `delete`, `restore`, `forceDelete`, `replicate`) for the record.

When a resource table does not declare any record action, each row gets an "Edit" link to the edit page, displayed only if the user may update the record.

### Displaying record actions as icon buttons

In a table row, an action is displayed as a link with its label. To display only its icon, with the label as a tooltip and accessible name, use `iconButton()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('toggle_billable')
    .iconButton()
    .icon(({ record }) => ((record as Timesheet).is_billable ? 'm-currency-dollar' : 'm-no-symbol'))
    .color(({ record }) => ((record as Timesheet).is_billable ? 'success' : 'gray'))
    .action(async ({ record }) => { /* ... */ })
```

`tableIcon()` sets the icon used when the action is displayed in a table row, and `groupedIcon()` the icon used in an [action group](#grouping-actions), when they should differ from `icon()`.

### Opening a record action when a row is clicked

You may open one of the record actions when the user clicks anywhere on a row, by passing its name to the table's [`recordAction()`](/tables/overview#opening-an-action-when-a-row-is-clicked) method.

## Bulk actions

Tables also support "bulk actions". These can be used when the user selects rows in the table. When rows are selected, a "Bulk actions" button appears. When the user clicks this button, they are presented with a dropdown menu of actions to choose from. You can put them in the `groupedBulkActions()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<LeaveRequest>): Table<LeaveRequest> {
    return table
        .groupedBulkActions([
            // ...
        ]);
}
```

A bulk action is an ordinary `Action`. In its `action()` function, read the keys of the selected records with `livewire.getSelectedRecordKeys()`, then clear the selection with `livewire.deselectAllTableRecords()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('approve')
    .icon('m-check')
    .color('success')
    .requiresConfirmation()
    .action(async ({ livewire }) => {
        for (const key of await livewire.getSelectedRecordKeys()) {
            const record = await LeaveRequestResource.adapter.find(key);
            if (record?.status === 'pending') await LeaveRequestResource.adapter.update(key, { status: 'approved' });
        }

        livewire.deselectAllTableRecords();
    })
```

`getSelectedRecordKeys()` returns the keys the user selected, reduced to the records that the data adapter can see. When the user chose to select all records, it returns the keys of every record matching the current search, filters and tab, except those they deselected.

When bulk actions are defined, each row of the table gets a checkbox.

### Using the built-in bulk actions

`DeleteBulkAction` deletes the selected records after confirmation, and `DetachBulkAction` detaches them in a relation manager. They come from `@navette-js/panels`:

```ts
import { DeleteBulkAction } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groupedBulkActions([
            DeleteBulkAction.make(),
        ]);
}
```

A resource table that does not call `groupedBulkActions()` gets `DeleteBulkAction` by default. To remove bulk actions, and the checkboxes, pass an empty array:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Timesheet>): Table<Timesheet> {
    return table
        .groupedBulkActions([]);
}
```

### Authorizing bulk actions

`DeleteBulkAction` is only displayed if the user has the `deleteAny` ability of the resource's policy. For your own bulk actions, authorize the action as a whole with `authorize()`, and check each record before processing it if permissions vary between records:

```ts
import { Action } from '@navette-js/actions';
import { can } from '@navette-js/panels';

Action.make('archive')
    .authorize(({ livewire }) => can(livewire, 'update'))
    .action(async ({ livewire }) => {
        for (const key of await livewire.getSelectedRecordKeys()) {
            const record = await PostResource.adapter.find(key);
            if (record && (await can(livewire, 'update', record))) await PostResource.adapter.update(key, { is_archived: 1 });
        }

        livewire.deselectAllTableRecords();
    })
```

Selecting a record does not authorize the operation.

<Aside variant="warning">
Bulk action notifications, `authorizeIndividualRecords()`, disabling selection for some rows, limiting the number of selectable records and chunked processing are not available yet.
</Aside>

## Header actions

Both actions and bulk actions can be rendered in the header of the table. You can put them in the `headerActions()` method:

```ts
import { CreateAction } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';

static table(table: Table<Payment>): Table<Payment> {
    return table
        .headerActions([
            CreateAction.make(),
        ]);
}
```

`CreateAction` opens the resource's form in a modal and creates a record. Header actions are typically used in relation managers; on a resource's list page, the "New" button is already in the page header.

## Grouping actions

You may use an `ActionGroup` object to group multiple record actions together in a dropdown:

```ts
import { Action, ActionGroup } from '@navette-js/actions';
import { DeleteAction, EditAction, ViewAction } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .recordActions([
            ActionGroup.make([
                ViewAction.make(),
                EditAction.make(),
                DeleteAction.make(),
            ]),
        ]);
}
```

Actions that are hidden for a record are left out of its dropdown.

<Aside variant="warning">
Action groups are only supported in `recordActions()`. Positioning record actions before the columns, toolbar actions and column actions are not available yet.
</Aside>
