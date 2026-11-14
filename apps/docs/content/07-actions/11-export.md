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

The files are built during the request, or [in the background](#running-exports-in-the-background). Large exports are refused (see [limiting the number of rows](#limiting-the-number-of-rows)).

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

A column reads the attribute with its name; a name with dots reads a [relationship](#displaying-data-from-relationships) (`brand.name`). `state()` computes the value yourself, from the record and the [context](#using-export-options):

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('amount_including_vat')
    .state((record) => record.amount * (1 + record.vat_rate))
```

### Configuring the default column selection

`enabledByDefault(false)` leaves a column unchecked in the modal.

`enableVisibleTableColumnsByDefault()` on the action only checks the columns visible in the table (and enabled by default), matched by name; the user may still check the others:

```ts
ExportAction.make()
    .exporter(ProductExporter)
    .enableVisibleTableColumnsByDefault()
```

### Hiding a column

A column marked `hidden()` (or `visible(false)`) is not offered in the modal and never written. The condition may be a function of the context, without a record (the options, for instance):

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('cost_price')
    .hidden(({ options }) => !options.includeCosts)
```

### Configuring the column selection layout

The column checkboxes are laid out in 2 columns. `columnMappingColumns()` changes it:

```ts
ExportAction.make()
    .exporter(ProductExporter)
    .columnMappingColumns(3)
```

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

## Formatting the values

`formatStateUsing()` formats the value of a column; it receives the value, the record and the context:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('status')
    .formatStateUsing((state) => statusLabels[state])
```

A column whose value is a list is written with its values separated by commas, each value formatted. `listAsJson()` writes the list as a JSON array instead:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('tags')
    .listAsJson()
```

### Limiting the text

`limit()` keeps at most a number of characters (100 by default), and `words()` a number of words, followed by `...` (or the second argument):

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('description')
    .limit(50)

ExportColumn.make('summary')
    .words(10, '…')
```

### Adding a prefix or a suffix

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('domain')
    .prefix('https://')
    .suffix('.com')
```

These methods also accept a function of the context: `limit(({ options }) => options.descriptionLimit ?? 100)`.

## Using export options

`getOptionsFormComponents()` adds components to the modal; their values are the export's options:

```ts
import { TextInput } from '@navette-js/forms';
import { Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getOptionsFormComponents() {
        return [
            TextInput.make('descriptionLimit')
                .label('Limit the length of the description column content')
                .integer(),
        ];
    }
}
```

`options()` on the action passes static options (or a function of `{ livewire }`); the values of the form override them:

```ts
ExportAction.make()
    .exporter(ProductExporter)
    .options({ descriptionLimit: 250 })
```

The functions of the columns receive the options in their context:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('description')
    .limit(({ options }) => Number(options.descriptionLimit ?? 100))

ExportColumn.make('description')
    .formatStateUsing((state, record, { options }) => String(state).slice(0, Number(options.descriptionLimit ?? 100)))
```

## Modifying the export query

`modifyQuery()` changes the query of the exported records, for example to leave some of them out. It receives the options too:

```ts
import { Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static modifyQuery(query: any): void {
        query.where('products.is_visible', true);
    }
}
```

`modifyQueryUsing()` on the action changes it for one action, after the exporter's:

```ts
ExportAction.make()
    .exporter(ProductExporter)
    .modifyQueryUsing((query, { options }) => query.where('is_active', options.isActive ?? true))
```

## Customizing the file name and the notification

`getFileName(count, run)` returns the name of the files, without extension; `fileName()` on the action sets it for one action (a text, or a function of the export run):

```ts
import { Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getFileName(count: number): string {
        return `products-${new Date().toISOString().slice(0, 10)}`;
    }

    static getCompletedNotificationTitle(): string {
        return 'Your product export is ready';
    }

    static getCompletedNotificationBody(count: number): string {
        return `Your product export has completed and ${count} rows exported.`;
    }
}
```

```ts
ExportAction.make()
    .exporter(ProductExporter)
    .fileName((run) => `products-${run.id}`)
```

`modifyCompletedNotification(notification, run)` changes anything else (its icon, its actions…), or returns another notification. The run gives the `columnMap` (column name → label) and the `options` of the export.

## Limiting the number of rows

An export of more than 10,000 rows is refused with a notification. Change the limit with `maxRows()`; it cannot exceed 100,000:

```ts
import { ExportAction } from '@navette-js/panels';

ExportAction.make()
    .exporter(ProductExporter)
    .maxRows(50000)
```

## Changing the chunk size

Records are read 100 at a time; between chunks, the process handles other requests. `chunkSize()` changes it:

```ts
ExportAction.make()
    .exporter(ProductExporter)
    .chunkSize(250)
```

## Configuring the export formats

By default, both a CSV and an XLSX file are offered. `formats()` keeps only some of them; `getFormats()` on the exporter sets the default of every action using it:

```ts
import { ExportAction, ExportFormat } from '@navette-js/panels';

ExportAction.make()
    .exporter(ProductExporter)
    .formats([ExportFormat.Xlsx]) // or ['xlsx']
```

### Changing the CSV delimiter

`getCsvDelimiter()` on the exporter returns the delimiter of the CSV file (one character):

```ts
import { Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getCsvDelimiter(): string {
        return ';';
    }
}
```

## Customizing XLSX files

In the XLSX file, every cell is text: a value starting with `=` is never evaluated as a formula. Without styles, the header row is bold.

### Styling XLSX rows

`getXlsxCellStyle()` returns the style of the cells, and `getXlsxHeaderCellStyle()` the style of the header cells (the cell style by default). An `XlsxStyle` sets fonts, colors and alignment, like OpenSpout's `Style` in Filament:

```ts
import { Exporter, XlsxColor, XlsxStyle } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getXlsxCellStyle(): XlsxStyle {
        return new XlsxStyle().setFontSize(12).setFontName('Consolas');
    }

    static getXlsxHeaderCellStyle(): XlsxStyle {
        return new XlsxStyle()
            .setFontBold()
            .setFontItalic()
            .setFontSize(14)
            .setFontName('Consolas')
            .setFontColor(XlsxColor.rgb(255, 255, 77))
            .setBackgroundColor(XlsxColor.rgb(0, 0, 0))
            .setCellAlignment('center')
            .setCellVerticalAlignment('center');
    }
}
```

`XlsxStyle` also has `setFontUnderline()`, `setFontStrikethrough()` and `setShouldWrapText()`. Colors are `RRGGBB` strings; `XlsxColor` has constants such as `XlsxColor.BLACK`.

### Styling XLSX columns

`makeXlsxRow()` (and `makeXlsxHeaderRow()`, for the header) builds each row. It receives the values, the row's style and the names of the exported columns, in order, and returns the cells, values or `XlsxCell`s with their own style, applied on top of the row's (`XlsxStyle.merge()` merges two styles):

```ts
import { Exporter, XlsxCell, XlsxStyle, type XlsxRowInput } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static makeXlsxRow(values: unknown[], style: XlsxStyle | null, columns: string[]): XlsxRowInput {
        return {
            cells: values.map((value, index) => (columns[index] === 'name' ? XlsxCell.fromValue(value, new XlsxStyle().setFontUnderline()) : value)),
            style,
        };
    }
}
```

### Customizing the XLSX writer

`getXlsxWriterOptions()` returns the column widths (in characters; columns are numbered from 1), like OpenSpout's `Options`:

```ts
import { Exporter, XlsxOptions } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getXlsxWriterOptions(): XlsxOptions {
        return new XlsxOptions()
            .setColumnWidth(10, 1)
            .setColumnWidthForRange(12, 2, 3);
    }
}
```

`setDefaultColumnWidth()` and `setDefaultRowHeight()` set the defaults of the sheet.

## Downloading the files

The files are kept by the panel for 24 hours, and only the user who exported them can download them. By default they are written on the disk, in `storage/downloads/<panel id>` relative to the working directory (or in the directory of the `NAVETTE_DOWNLOADS` environment variable, then the panel id): they survive restarts and are shared by the processes using the same directory. Expired files are removed as new files are stored, and when they are requested. Keep this directory private: never serve it statically.

Give the panel a `DiskDownloadStore` to change the directory, the lifetime or the maximum number of files, a `DownloadStore` to keep them in memory (tests), or your own store implementing `DownloadStorage` (`put()`, `get()`, and optionally `delete()` and `prune()`, any of them asynchronous):

```ts
import { DiskDownloadStore, Panel } from '@navette-js/panels';

Panel.make()
    .downloads(new DiskDownloadStore({ directory: '/var/lib/my-app/downloads', ttl: 60 * 60 * 1000, maxFiles: 1000 }))
```

Call `prune()` from a scheduled task to remove expired files without waiting for new ones.

### Customizing how the files are sent

`getDownloader(format)` returns how a file of a format is sent: a function receiving the stored file and the Express response. The default one sends the file as an attachment, never cached:

```ts
import { Exporter, sendDownload, type Downloader, type ExportFormatValue } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getDownloader(format: ExportFormatValue): Downloader {
        if (format !== 'csv') return sendDownload;
        return (file, res) => {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.attachment(file.name);
            res.send(file.content);
        };
    }
}
```

The downloader is found by the exporter's name when the file is requested: after a restart, until an export action of this exporter has been used again, files are sent with the default downloader.

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

To test an exporter, see [testing exports](/testing/exports).

## Security

- The action is authorized with the `viewAny` ability of the resource's policy. Records are not authorized one by one: only the records of the table's query are exported, so [scope your data adapter](/tables/filters/overview#security), or the query with `modifyQueryUsing()`, to restrict what a user can see.
- Only the declared, visible columns can be exported, and only the components of the options form give options, whatever the browser sends.
- CSV cells starting with `=`, `+`, `-`, `@`, a tab or a carriage return (except numbers) are prefixed with `'`, so that spreadsheet software does not run them as formulas; XLSX cells are always text. `preventFormulaInjection()` on a column also prefixes its values in the XLSX file; `preventFormulaInjection(false)` writes its CSV cells as they are.
- The files are only sent to the user who exported them, through a random token, until they expire.
