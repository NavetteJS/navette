---
title: Deleting records
---

## Introduction

Records are deleted with the actions of `@navette-js/panels`:

| Action | Where | What it does |
|---|---|---|
| `DeleteAction` | Header of the edit or View page, or row of a table | Deletes one record, after a confirmation. On a record page, it then redirects to the list. |
| `DeleteBulkAction` | Bulk actions of a table | Deletes the selected records, after a confirmation. |
| `RestoreAction` | Header of the edit or View page | Restores a soft-deleted record. |
| `ForceDeleteAction` | Header of the edit or View page | Permanently deletes a soft-deleted record, then redirects to the list. |

The edit page has a `DeleteAction` in its header by default.

## Handling soft-deletes

With soft deletes, deleting a record only fills a timestamp column, and the record can be restored later. To enable them, pass the column to the adapter of the resource:

```ts
import { ObjectionAdapter } from '@navette-js/database';

export class CustomerResource extends Resource {
    static adapter = new ObjectionAdapter(Customer, {
        softDeletes: 'deleted_at',
        findsTrashed: true,
    });
}
```

With `softDeletes`:

- `delete()` and `deleteMany()` set the column to the current date instead of removing the row;
- soft-deleted records are excluded from the table and from global search;
- the header of the edit page contains `DeleteAction`, `RestoreAction` and `ForceDeleteAction`. Only the actions that make sense are visible: delete for a live record, restore and force-delete for a deleted one.

`findsTrashed: true` lets the edit and View pages open a deleted record, which is needed to restore it from there. Without it, a deleted record answers 404.

### Listing deleted records

Add `TrashedFilter` to the table to let users choose between live records (the default), all records, or deleted records only:

```ts
import { TrashedFilter, type Table } from '@navette-js/tables';

static table(table: Table<Customer>): Table<Customer> {
    return table
        .columns([/* ... */])
        .filters([TrashedFilter.make()]);
}
```

### Customizing the actions of the edit page

If you override `getHeaderActions()` on a soft-deleting resource, add the three actions yourself:

```ts
import { DeleteAction, EditRecord, ForceDeleteAction, RestoreAction, ViewAction } from '@navette-js/panels';

class EditProject extends EditRecord {
    getHeaderActions() {
        return [ViewAction.make(), DeleteAction.make(), RestoreAction.make(), ForceDeleteAction.make()];
    }
}
```

<Aside variant="warning">
`RestoreAction` and `ForceDeleteAction` only work in the header of a record page. Row versions and the `RestoreBulkAction` and `ForceDeleteBulkAction` bulk actions are not available yet.
</Aside>

## Deleting records on the List page

The list page offers `DeleteBulkAction` when the table declares no bulk action. Once you declare bulk actions, include it yourself:

```ts
import { DeleteBulkAction } from '@navette-js/panels';

static table(table: Table): Table {
    return table
        .columns([/* ... */])
        .groupedBulkActions([DeleteBulkAction.make()]);
}
```

To delete one row, add `DeleteAction` to the row actions:

```ts
import { DeleteAction, EditAction } from '@navette-js/panels';

table.recordActions([EditAction.make(), DeleteAction.make()])
```

The keys of the selected records come from the browser. Before deleting, they are reduced to the records that the adapter can see, so a forged selection cannot reach a record outside the table.

## Authorization

Each action checks an ability of the [resource policy](/resources/authorization), on the server, before it is displayed and before it runs:

| Action | Ability |
|---|---|
| `DeleteAction` | `delete`, with the record |
| `DeleteBulkAction` | `deleteAny`, without a record |
| `RestoreAction` | `restore`, with the record |
| `ForceDeleteAction` | `forceDelete`, with the record |

```ts
import type { Policy } from '@navette-js/panels';

static policy: Policy<Customer> = {
    delete: (user) => user.role === 'admin',
    deleteAny: (user) => user.role === 'admin',
    restore: (user) => user.role === 'admin',
    forceDelete: () => false,
};
```

<Aside variant="warning">
`DeleteBulkAction` checks `deleteAny` once, not `delete` for each selected record. If the right to delete depends on the record, filter the keys in your own bulk action, or restrict the adapter.
</Aside>
