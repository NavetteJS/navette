---
title: Import action
---

## Introduction

Navette includes an action that imports records from a CSV or XLSX file. The user uploads the file in a modal and chooses which column of the file goes into each field; each row is validated, then creates or updates a record:

```ts
import { ImportAction } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';
import { ProductImporter } from './ProductImporter.ts';

static table(table: Table<Product>): Table<Product> {
    return table
        .headerActions([
            ImportAction.make()
                .importer(ProductImporter),
        ]);
}
```

The file is read during the request, or [in the background](#running-imports-in-the-background). A notification gives the number of imported and failed rows, with a link to download the failed rows and their errors.

The type of the file is detected from its content: an XLSX file is read from its first worksheet, every cell as text (numbers as written, formulas as their last computed value).

## Creating an importer

An importer lists the columns of the file:

```ts
import { ImportColumn, Importer } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static getColumns(): ImportColumn[] {
        return [
            ImportColumn.make('name')
                .requiredMapping()
                .rules(['required', 'max:255']),
            ImportColumn.make('sku')
                .label('SKU')
                .rules(['required', 'max:32']),
            ImportColumn.make('price')
                .numeric()
                .rules(['numeric']),
        ];
    }
}
```

### Matching the columns of the file

A column of the file matches an import column when its header is the column's name or label, ignoring case. `guess()` adds other headers:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('price')
    .guess(['cost', 'amount'])
```

When a column marked `requiredMapping()` is missing from the file, nothing is imported.

### Choosing the columns of the file

Once the file is uploaded, the modal lists the importer's columns, each with a select of the file's headers, already set to the header it matches. The user may change them; a column left empty is not imported. A column with `requiredMapping()` must be chosen.

To skip this step and only match the headers automatically, disable it:

```ts
ImportAction.make()
    .importer(ProductImporter)
    .columnMapping(false)
```

### Validating the data

`rules()` takes `required`, `email`, `numeric`, `integer`, `boolean`, `min:n`, `max:n` (text length), `in:a,b`, or a function returning an error message or `null`:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('email')
    .rules(['required', 'email', (value) => (value?.endsWith('@example.com') ? null : 'Only company addresses are accepted.')])
```

A row that fails validation is skipped, and listed in the failed rows file with its error.

### Casting the data

Cells are text. `numeric()` and `boolean()` convert them, and `castStateUsing()` lets you write your own conversion:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('tags')
    .castStateUsing((value) => (value ?? '').split('|').map((tag) => tag.trim()).filter(Boolean).join(','))
```

`fillRecordUsing()` writes the value into the record yourself, for example into another attribute.

### Providing an example file

`example()` sets the value of a column in the example file, which the user downloads from the modal.

## Updating existing records

By default, every row creates a record. `resolveRecord()` returns an existing record to update instead:

```ts
import { Importer } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static async resolveRecord(data: Record<string, unknown>): Promise<Product | null> {
        return (await Product.query().findOne({ sku: data.sku })) ?? null;
    }
}
```

## Running code around saving

`beforeSave()` receives the values about to be saved (which you may change) and the existing record, if any; `afterSave()` receives the saved record:

```ts
import { Importer } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static async beforeSave(data: Record<string, unknown>): Promise<void> {
        data.is_visible = 0;
    }
}
```

To reject a row from one of these methods, or from `resolveRecord()`, throw a `RowImportFailedError`: the row is skipped, and listed in the failed rows file with your message. Any other error is logged, and the row is listed with a generic message.

```ts
import { Importer, RowImportFailedError } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static async resolveRecord(data: Record<string, unknown>): Promise<Product | null> {
        const product = await Product.query().findOne({ sku: data.sku });
        if (!product) throw new RowImportFailedError(`No product found with SKU [${data.sku}].`);
        return product;
    }
}
```

`getCompletedNotificationBody(imported, failed)` customizes the text of the notification.

To test an importer, see [testing imports](/testing/imports).

## Limiting the size of the file

A file of more than 1,000 rows is refused; change it with `maxRows()`, up to 10,000. Files larger than 5 MB are refused by the upload field; change it with `maxFileSize()`, in kilobytes:

```ts
import { ImportAction } from '@navette-js/panels';

ImportAction.make()
    .importer(ProductImporter)
    .maxRows(5000)
    .maxFileSize(10240)
```

## Running imports in the background

By default, the import runs during the request, and its notification appears when it ends. With `queued()`, the user is told the import started, the work runs after the response, and the completion notification arrives in the [database notifications](/notifications/database-notifications) (the bell):

```ts
ImportAction.make()
    .importer(ProductImporter)
    .queued()
```

The panel must have database notifications (`databaseNotifications()`): without them, the import runs during the request. A queued import accepts up to 100,000 rows (`maxRows()`).

Queued work runs one task at a time in the Node process, after the response. It is lost if the process stops. To run it elsewhere (BullMQ, a worker process…), give Navette your own runner: each task is a function to run.

```ts
import { useBackgroundRunner } from '@navette-js/panels';

useBackgroundRunner((task) => {
    queue.add(task); // run `await task()` in your worker
});
```

## Keeping a history of imports

The panel can record each import and export: who ran it, which file, how many rows succeeded, and the failed rows with their errors. Create the tables with `importExportSchema()` in a migration, and give the panel the history store:

```ts
import { importExportSchema, knexImportExportHistory, Panel } from '@navette-js/panels';

// In a migration:
await importExportSchema(db); // imports, failed_import_rows and exports tables

Panel.make()
    .importExportHistory(knexImportExportHistory((table) => db(table)))
```

You can then list the runs in a resource of your own. To store them elsewhere, implement the `ImportExportHistory` interface: `startImport()`, `finishImport()`, `recordFailedImportRow()`, `startExport()`, `finishExport()`.

## Security

- The action is authorized with the `create` ability of the resource's policy. `resolveRecord()` decides which records a row may update: only return records the user is allowed to change.
- Only the uploaded file of the request is read, never a path sent by the browser.
- Values are validated with your rules, then written through the data adapter, which only writes declared attributes as bound parameters.

- The chosen columns can only be headers of the uploaded file.
