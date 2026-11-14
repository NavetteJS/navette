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

```preview
// records: [{"title": "Introducing Navette", "status": "published"}, {"title": "Building your first panel", "status": "published"}, {"title": "Ten tips for faster tables", "status": "draft"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('status').badge(),
    ])
    .recordActions([
        Action.make('edit').icon('m-pencil-square').url(({ record }) => `/admin/posts/${record.id}/edit`),
        Action.make('delete').icon('m-trash').color('danger').requiresConfirmation().action(() => {}),
    ])
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

```preview
// records: [{"description": "Design review", "hours": 2.5, "is_billable": true}, {"description": "Team meeting", "hours": 1, "is_billable": false}, {"description": "Bug fixing", "hours": 4.25, "is_billable": true}]
new Table()
    .pluralModelLabel('timesheets')
    .columns([
        TextColumn.make('description'),
        TextColumn.make('hours').numeric(2),
    ])
    .recordActions([
        Action.make('toggle_billable')
            .label(({ record }) => (record.is_billable ? 'Billable' : 'Not billable'))
            .iconButton()
            .icon(({ record }) => (record.is_billable ? 'm-currency-dollar' : 'm-no-symbol'))
            .color(({ record }) => (record.is_billable ? 'success' : 'gray'))
            .action(() => {}),
    ])
```

`tableIcon()` sets the icon used when the action is displayed in a table row, and `groupedIcon()` the icon used in an [action group](#grouping-actions), when they should differ from `icon()`.

### Modifying every record action

`modifyUngroupedRecordActionsUsing()` on the table changes every record action that is not inside an [action group](#grouping-actions), for example to display them all as icon buttons:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .modifyUngroupedRecordActionsUsing((action) => action.iconButton())
        .recordActions([
            // ...
        ]);
}
```

The function applies to the actions given to `recordActions()`, whether it is declared before or after them.

### Opening a record action when a row is clicked

You may open one of the record actions when the user clicks anywhere on a row, by passing its name to the table's [`recordAction()`](/tables/overview#opening-an-action-when-a-row-is-clicked) method.

## Column actions

A column may run its own action when its cell is clicked, with `action()`. See [triggering actions](/tables/columns/overview#triggering-actions).

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

Once records are selected, the "Bulk actions" button and the number of selected records appear above the table:

```preview
// records: [{"employee": "Ada Lovelace", "dates": "Dec 22 - Dec 26", "status": "pending"}, {"employee": "Grace Hopper", "dates": "Jan 5 - Jan 9", "status": "pending"}, {"employee": "Alan Turing", "dates": "Jan 12", "status": "approved"}, {"employee": "Katherine Johnson", "dates": "Feb 2 - Feb 6", "status": "pending"}]
// selected: [1, 2]
new Table()
    .pluralModelLabel('leave requests')
    .columns([
        TextColumn.make('employee'),
        TextColumn.make('dates'),
        TextColumn.make('status').badge().color((state) => (state === 'approved' ? 'success' : 'warning')),
    ])
    .groupedBulkActions([
        Action.make('approve').icon('m-check').color('success').requiresConfirmation().action(() => {}),
        Action.make('reject').icon('m-x-mark').color('danger').requiresConfirmation().action(() => {}),
    ])
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

### Authorizing each selected record

`authorizeIndividualRecords()` checks a policy ability, or a function, for each selected record. Records that fail are skipped, and counted in the notification. Process the records with `processSelectedRecords()` of the table's page, which loads them in chunks of 100 (change it with `chunkSelectedRecords()`):

```ts
import { Action } from '@navette-js/actions';

Action.make('archive')
    .authorizeIndividualRecords('update')
    .successNotificationTitle('Archived')
    .failureNotificationTitle((success, total) => `Archived ${success} of ${total}`)
    .missingBulkAuthorizationFailureNotificationMessage((count) => `You may not archive ${count} of them.`)
    .missingBulkProcessingFailureNotificationMessage((count) => `${count} could not be archived.`)
    .deselectRecordsAfterCompletion()
    .action(async ({ livewire, action }) => {
        await livewire.processSelectedRecords(action, (record) => PostResource.adapter.update(record.id, { is_archived: 1 }));
    })
```

The function passed to `processSelectedRecords()` reports a failure by returning `false` or throwing, or with `action.reportBulkProcessingFailure()` (see below) to give its own message. When every record succeeds, the success notification is sent; otherwise a warning (or a danger notification when nothing succeeded) gives the failure title and the messages. `DeleteBulkAction` uses the same notifications: with `authorizeIndividualRecords('delete')`, it deletes record by record instead of in one query.

### Restoring and force-deleting records in bulk

`RestoreBulkAction` and `ForceDeleteBulkAction` from `@navette-js/panels` restore or permanently delete the selected soft-deleted records. They are only visible when the [trashed filter](/tables/filters/ternary#filtering-soft-deletable-records) shows deleted records, and check the `restore` or `forceDelete` ability for each record. `DeleteBulkAction` is hidden when only deleted records are shown.

### Preventing some records from being selected

Records for which `checkIfRecordIsSelectableUsing()` returns `false` have no checkbox, and are left out of the selection on the server, even if the browser sends their key:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Order>): Table<Order> {
    return table
        .checkIfRecordIsSelectableUsing((record) => record.status !== 'shipped');
}
```

With "select all", every record of the query is loaded to check it: keep this check cheap.

### Limiting the number of selectable records

`maxSelectableRecords()` limits how many records the user may select. The other checkboxes are disabled once the limit is reached, and the server keeps at most that number of keys:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .maxSelectableRecords(10);
}
```

With a limit of 2, the other checkboxes are disabled once two leave requests are selected, and "Select all" is not offered:

```preview
// records: [{"employee": "Ada Lovelace", "dates": "Dec 22 - Dec 26", "status": "pending"}, {"employee": "Grace Hopper", "dates": "Jan 5 - Jan 9", "status": "pending"}, {"employee": "Alan Turing", "dates": "Jan 12", "status": "approved"}, {"employee": "Katherine Johnson", "dates": "Feb 2 - Feb 6", "status": "pending"}]
// selected: [1, 2]
new Table()
    .pluralModelLabel('leave requests')
    .columns([
        TextColumn.make('employee'),
        TextColumn.make('dates'),
        TextColumn.make('status').badge().color((state) => (state === 'approved' ? 'success' : 'warning')),
    ])
    .groupedBulkActions([
        Action.make('approve').icon('m-check').color('success').requiresConfirmation().action(() => {}),
        Action.make('reject').icon('m-x-mark').color('danger').requiresConfirmation().action(() => {}),
    ])
    .maxSelectableRecords(2)
```

`selectCurrentPageOnly()` makes "select all" select the records of the current page only.

### Selecting groups only

In a [grouped table](/tables/grouping), `selectGroupsOnly()` lets the user select records group by group: the "Select all" link and the page checkbox are removed, the group checkboxes stay:

```ts
table
    .groups(['status'])
    .selectGroupsOnly()
```

### Accessing the selected records from any table action

Bulk actions are not the only ones that can work on the selection: a header, toolbar or record action with `accessSelectedRecords()` sends the selected records along with its click, and reads them with `action.getSelectedRecords()`. `selectable()` on the table shows the checkboxes even without bulk actions (and `selectable(false)` hides them despite bulk actions):

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';

static table(table: Table<Product>): Table<Product> {
    return table
        .selectable()
        .toolbarActions([
            Action.make('compare')
                .accessSelectedRecords()
                .action(async ({ action }) => {
                    const products = await action!.getSelectedRecords();
                    Notification.make().title(`Comparing ${products.length} products`).send();
                }),
        ]);
}
```

The selection is checked again on the server, like for bulk actions: only records the table can show, that are selectable, and within `maxSelectableRecords()`; by default, they are also [restricted to the current filters](/tables/filters/overview#keeping-the-selection-when-filtering). The records are loaded by chunks of `chunkSelectedRecords()` (100 by default); `fetchSelectedRecords(false)` returns their keys only, without loading them.

Bulk actions access the selected records in the same way: `getSelectedRecords()` works in their `action()` function too.

### Updating the selected records in one query

`action.getSelectedRecordsQuery()` hands a query of the selected records (an Objection query builder with `ObjectionAdapter`) to a function, and returns what it returns. An Objection query runs as soon as it is awaited, so it is passed to a function instead of being returned:

```ts
import { Action } from '@navette-js/actions';

Action.make('publish')
    .accessSelectedRecords()
    .action(async ({ action }) => {
        await action!.getSelectedRecordsQuery((query) => query.patch({ is_published: 1 }));
    })
```

### Reporting failures

While processing the selected records, call `action.reportBulkProcessingFailure()` for each record that could not be processed. Failures reported with the same key share a message, a text or a function of the number of such failures and of the number of selected records. Once the action has run, the failure notification gives the failure title and the messages; when nothing failed, the success notification is sent:

```ts
import { Action } from '@navette-js/actions';

Action.make('ship')
    .accessSelectedRecords()
    .successNotificationTitle('Shipped')
    .failureNotificationTitle((success, total) => `Shipped ${success} of ${total} orders`)
    .missingBulkProcessingFailureNotificationMessage((count) => `${count} could not be shipped.`)
    .action(async ({ action }) => {
        for (const order of await action!.getSelectedRecords()) {
            if (order.status === 'cancelled') {
                action!.reportBulkProcessingFailure('cancelled', (count) => `${count} cancelled order(s) cannot be shipped.`);
                continue;
            }
            await ship(order);
        }
    })
```

A failure reported without a key uses the `missingBulkProcessingFailureNotificationMessage()`. `reportCompleteBulkProcessingFailure()` reports that no record could be processed, and `reportBulkProcessingSuccessfulRecordsCount()` gives the number of processed records when you process them in one query.

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

```preview
// records: [{"reference": "PAY-2041", "customer": "Acme Corporation", "amount": 1250}, {"reference": "PAY-2042", "customer": "Globex", "amount": 480.5}]
new Table()
    .pluralModelLabel('payments')
    .heading('Payments')
    .columns([
        TextColumn.make('reference'),
        TextColumn.make('customer'),
        TextColumn.make('amount').money('usd'),
    ])
    .headerActions([
        Action.make('create').label('New payment').action(() => {}),
    ])
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

```preview
// records: [{"title": "Introducing Navette", "status": "published"}, {"title": "Building your first panel", "status": "published"}, {"title": "Ten tips for faster tables", "status": "draft"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('status').badge(),
    ])
    .recordActions([
        ActionGroup.make([
            Action.make('view').icon('m-eye').url(({ record }) => `/admin/posts/${record.id}`),
            Action.make('edit').icon('m-pencil-square').url(({ record }) => `/admin/posts/${record.id}/edit`),
            Action.make('delete').icon('m-trash').color('danger').requiresConfirmation().action(() => {}),
        ]),
    ])
```

Actions that are hidden for a record are left out of its dropdown.

<Aside variant="warning">
Action groups may be used in `recordActions()`, `headerActions()` and `toolbarActions()`.
</Aside>

## Toolbar actions

`toolbarActions()` puts actions in the toolbar of the table, before the search field. They are mounted like [header actions](#header-actions). A `BulkActionGroup` among them is a dropdown of bulk actions, shown while records are selected. Several groups make several dropdowns, each with its own label and icon: see [grouping bulk actions](/actions/grouping-actions#grouping-bulk-actions).

```ts
import { Action } from '@navette-js/actions';
import { DeleteBulkAction } from '@navette-js/panels';
import { BulkActionGroup, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .toolbarActions([
            Action.make('export').icon('m-arrow-down-tray').url('/posts/export'),
            BulkActionGroup.make([
                DeleteBulkAction.make(),
            ]),
        ]);
}
```

Toolbar actions are hidden while the user reorders records.

## Positioning record actions

By default, record actions are displayed after the columns. You may move them before the columns, after the checkbox, with `recordActionsPosition('before-columns')`, or before the checkbox with `'before-cells'`:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .recordActions([
            // ...
        ])
        .recordActionsPosition('before-columns');
}
```

`recordActionsAlignment()` aligns them in their cell (`'start'`, `'center'` or `'end'`).
