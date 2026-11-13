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

By default, the name of the filter is the name of the column. The filter compares the column with `1` or `0`, which is how SQLite and MySQL store booleans.

## Using a ternary filter with a nullable column

Another common pattern is to use a nullable column. For example, when filtering verified and unverified users using the `email_verified_at` column, unverified users have a null timestamp in this column. To apply that logic, you may use the `nullable()` method:

```ts
import { TernaryFilter } from '@navette-js/tables';

TernaryFilter.make('email_verified_at')
    .nullable()
```

## Customizing the column used by a ternary filter

The column name used to scope the query is the name of the filter. To customize this, you may use the `attribute()` method:

```ts
import { TernaryFilter } from '@navette-js/tables';

TernaryFilter.make('verified')
    .nullable()
    .attribute('status_id')
```

## Customizing the ternary filter option labels

You may customize the labels used for each state of the ternary filter. The true option label can be customized using the `trueLabel()` method. The false option label can be customized using the `falseLabel()` method. The blank (default) option label can be customized using the `placeholder()` method:

```ts
import { TernaryFilter } from '@navette-js/tables';

TernaryFilter.make('email_verified_at')
    .label('Email verification')
    .nullable()
    .placeholder('All users')
    .trueLabel('Verified users')
    .falseLabel('Not verified users')
```

## Customizing how a ternary filter modifies the query

You may customize how the query changes for each state of the ternary filter, using the `queries()` method:

```ts
import { TernaryFilter } from '@navette-js/tables';

TernaryFilter.make('email_verified_at')
    .label('Email verification')
    .placeholder('All users')
    .trueLabel('Verified users')
    .falseLabel('Not verified users')
    .queries({
        true: (query) => query.whereNotNull('email_verified_at'),
        false: (query) => query.whereNull('email_verified_at'),
        blank: (query) => query, // In this example, we do not want to filter the query when it is blank.
    })
```

## Applying the ternary filter by default

You may set the default state with `default()`: `true` selects "Yes", `false` selects "No":

```ts
import { TernaryFilter } from '@navette-js/tables';

TernaryFilter.make('is_active')
    .default(true)
```

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

By default, soft-deleted records are hidden. The filter lets the user show them alongside the other records ("With deleted records"), or show only them ("Only deleted records"). Its labels may be changed with `placeholder()`, `trueLabel()` and `falseLabel()`.

The filter relies on the data adapter's soft-delete support. With `ObjectionAdapter`, declare the column that stores the deletion date:

```ts
import { ObjectionAdapter } from '@navette-js/database';

static adapter = new ObjectionAdapter(Order, {
    softDeletes: 'deleted_at',
    findsTrashed: true,
});
```

`findsTrashed` lets the edit page open a deleted record, so that it can be restored. Add `RestoreAction` and `ForceDeleteAction` from `@navette-js/panels` to the [record actions](/tables/actions#record-actions) to restore or permanently delete trashed records.
