---
title: Ternary filter
---

## Introduction

Ternary filters allow you to easily create a select filter which has three states: usually true, false and blank. To filter a column named `is_admin` to be `true` or `false`, you may use the ternary filter:

```ts
import { TernaryFilter } from '@navette-js/tables';

TernaryFilter.make('is_admin')
```

The filter's select offers an empty option, which lists all records, "Yes", which lists the records where the column is true, and "No", which lists the records where it is false.

The name of the filter is the name of the column. The filter compares the column with `1` or `0`, which is how SQLite and MySQL store booleans.

<Aside variant="warning">
Ternary filters for nullable columns, custom column names, custom option labels and custom queries (`queries()`) are not available yet. For these cases, write a [custom filter](/tables/filters/custom) with a select field.
</Aside>

## Filtering soft-deletable records

The `TrashedFilter` can be used to filter soft-deleted records. It is a type of ternary filter that is built into Navette:

```ts
import { TrashedFilter, type Table } from '@navette-js/tables';

static table(table: Table<Order>): Table<Order> {
    return table
        .filters([
            TrashedFilter.make(),
        ]);
}
```

By default, soft-deleted records are hidden. The filter lets the user show them alongside the other records ("With trashed records"), or show only them ("Only trashed records").

The filter relies on the data adapter's soft-delete support. With `ObjectionAdapter`, declare the column that stores the deletion date:

```ts
import { ObjectionAdapter } from '@navette-js/database';

static adapter = new ObjectionAdapter(Order, {
    softDeletes: 'deleted_at',
    findsTrashed: true,
});
```

`findsTrashed` lets the edit page open a deleted record, so that it can be restored. Add `RestoreAction` and `ForceDeleteAction` from `@navette-js/panels` to the [record actions](/tables/actions#record-actions) to restore or permanently delete trashed records.
