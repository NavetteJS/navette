---
title: Export action
---

## Introduction

Navette includes an action that exports records to CSV and Excel (XLSX) files. The user picks the columns in a modal, and gets a notification with download links:

```ts
import { ExportAction } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';
import { ProductExporter } from './ProductExporter.ts';

static table(table: Table<Product>): Table<Product> {
    return table
        .headerActions([
            ExportAction.make()
                .exporter(ProductExporter),
        ]);
}
```

The export follows the table: its filters, search and sort apply. `ExportBulkAction` exports the selected records instead:

```ts
import { ExportBulkAction } from '@navette-js/panels';
import { BulkActionGroup, type Table } from '@navette-js/tables';

static table(table: Table<Product>): Table<Product> {
    return table
        .toolbarActions([
            BulkActionGroup.make([
                ExportBulkAction.make().exporter(ProductExporter),
            ]),
        ]);
}
```

The file is built during the request: there is no queue. Large exports are refused (see [limiting the number of rows](#limiting-the-number-of-rows)).

## Creating an exporter

An exporter lists the columns of the file:

```ts
import { ExportColumn, Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getColumns(): ExportColumn[] {
        return [
            ExportColumn.make('sku').label('SKU'),
            ExportColumn.make('name'),
            ExportColumn.make('price').formatStateUsing((price) => Number(price).toFixed(2)),
            ExportColumn.make('brand.name').label('Brand'),
        ];
    }
}
```

A column reads the attribute with its name; a name with dots reads a [relationship](#displaying-data-from-relationships) (`brand.name`). `state()` computes the value yourself, and `formatStateUsing()` formats it:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('full_name')
    .state((record) => `${record.first_name} ${record.last_name}`)
```

### Disabling a column by default

`enabledByDefault(false)` leaves a column unchecked in the modal.

### Disabling the column selection

`columnMapping(false)` removes the column checkboxes: every column is exported, and the modal only asks for confirmation.

### Displaying data from relationships

You may use "dot notation" to access columns within relationships. The name of the relationship comes first, followed by a period, followed by the name of the column to display:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('author.name')
```

The relationship is eager-loaded with the exported records (it must be declared by the Objection model's `relationMappings`). A relationship holding several records (`tags.name`) gives the list of their values.

### Counting relationships

If you wish to count the number of related records in a column, you may use the `counts()` method:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('users_count')
    .counts('users')
```

In this example, `users` is the name of the relationship to count from. The name of the column must be `users_count`, as this is the convention (Laravel's `withCount()`) used to name the result.

If you'd like to scope the relationship before counting, you can pass an object to the method, where the key is the relationship name and the value is the function to scope the Objection query with:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('users_count')
    .counts({
        users: (query) => query.where('is_active', true),
    })
```

### Determining relationship existence

If you simply wish to indicate whether related records exist in a column, you may use the `exists()` method:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('users_exists')
    .exists('users')
```

In this example, `users` is the name of the relationship to check for existence. The name of the column must be `users_exists`. If you'd like to scope the relationship before checking existence, pass an object, as for `counts()`:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('users_exists')
    .exists({
        users: (query) => query.where('is_active', true),
    })
```

### Aggregating relationships

Navette provides several methods for aggregating a relationship field, including `avg()`, `max()`, `min()` and `sum()`. For instance, if you wish to show the average of a field on all related records in a column, you may use the `avg()` method:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('users_avg_age')
    .avg('users', 'age')
```

In this example, `users` is the name of the relationship, while `age` is the field that is being averaged. The name must be `users_avg_age`: the relationship, the function and the field.

If you'd like to scope the relationship before aggregating, you can pass an object to the method, where the key is the relationship name and the value is the function to scope the Objection query with:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('users_avg_age')
    .avg({
        users: (query) => query.where('is_active', true),
    }, 'age')
```

The aggregates are selected by the export query, with the records, so they need a data adapter that supports relationships (`ObjectionAdapter`).

## Modifying the export query

`modifyQuery()` changes the query of the exported records, for example to leave some of them out:

```ts
import { Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static modifyQuery(query: any): void {
        query.where('products.is_visible', true);
    }
}
```

## Customizing the file name and the notification

```ts
import { Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getFileName(count: number): string {
        return `products-${new Date().toISOString().slice(0, 10)}`;
    }

    static getCompletedNotificationBody(count: number): string {
        return `Your product export has completed and ${count} rows exported.`;
    }
}
```

## Limiting the number of rows

An export of more than 10,000 rows is refused with a notification. Change the limit with `maxRows()`; it cannot exceed 100,000:

```ts
import { ExportAction } from '@navette-js/panels';

ExportAction.make()
    .exporter(ProductExporter)
    .maxRows(50000)
```

## Downloading the file

The file is kept by the panel for 24 hours, and only the user who exported it can download it. By default it is kept in memory: it is lost when the server restarts and is not shared between server processes. Give the panel your own `DownloadStore` with `downloads()` to change the retention:

```ts
import { DownloadStore, Panel } from '@navette-js/panels';

Panel.make()
    .downloads(new DownloadStore({ ttl: 60 * 60 * 1000, maxFiles: 100 }))
```

## Customizing the export formats

By default, both a CSV and an XLSX file are offered. `formats()` keeps only some of them:

```ts
import { ExportAction } from '@navette-js/panels';

ExportAction.make()
    .exporter(ProductExporter)
    .formats(['xlsx'])
```

In the XLSX file, every cell is text: a value starting with `=` is never evaluated as a formula.

## Running exports in the background

By default, the export runs during the request, and its notification appears when it ends. With `queued()`, the user is told the export started, the work runs after the response, and the completion notification, with the download links, arrives in the [database notifications](/notifications/database-notifications) (the bell):

```ts
ExportAction.make()
    .exporter(ProductExporter)
    .queued()
```

The panel must have database notifications (`databaseNotifications()`): without them, the export runs during the request. 

Queued work runs one task at a time in the Node process, after the response. It is lost if the process stops. To run it elsewhere (BullMQ, a worker process…), give Navette your own runner: each task is a function to run.

```ts
import { useBackgroundRunner } from '@navette-js/panels';

useBackgroundRunner((task) => {
    queue.add(task); // run `await task()` in your worker
});
```

## Keeping a history of exports

The panel can record each import and export: who ran it, which file, how many rows succeeded. Create the tables with `importExportSchema()` in a migration, and give the panel the history store:

```ts
import { importExportSchema, knexImportExportHistory, Panel } from '@navette-js/panels';

// In a migration:
await importExportSchema(db); // imports, failed_import_rows and exports tables

Panel.make()
    .importExportHistory(knexImportExportHistory((table) => db(table)))
```

You can then list the runs in a resource of your own. To store them elsewhere, implement the `ImportExportHistory` interface: `startImport()`, `finishImport()`, `recordFailedImportRow()`, `startExport()`, `finishExport()`.

## Security

- The action is authorized with the `viewAny` ability of the resource's policy. Only the records of the table's query are exported: [scope your data adapter](/tables/filters/overview#security) to restrict what a user can see.
- Only the declared columns can be exported, whatever the browser sends.
- Cells starting with `=`, `+`, `-`, `@`, a tab or a carriage return (except numbers) are prefixed with `'`, so that spreadsheet software does not run them as formulas.

