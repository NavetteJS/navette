---
title: Import action
---

## Introduction

Navette includes an action that imports records from a CSV file. The user uploads the file in a modal; each row is validated, then creates or updates a record:

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

The file is read during the request: there is no queue. A notification gives the number of imported and failed rows, with a link to download the failed rows and their errors.

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

`getCompletedNotificationBody(imported, failed)` customizes the text of the notification.

## Limiting the size of the file

A file of more than 1,000 rows is refused; change it with `maxRows()`, up to 10,000. Files larger than 5 MB are refused by the upload field; change it with `maxFileSize()`, in kilobytes:

```ts
import { ImportAction } from '@navette-js/panels';

ImportAction.make()
    .importer(ProductImporter)
    .maxRows(5000)
    .maxFileSize(10240)
```

## Security

- The action is authorized with the `create` ability of the resource's policy. `resolveRecord()` decides which records a row may update: only return records the user is allowed to change.
- Only the uploaded file of the request is read, never a path sent by the browser.
- Values are validated with your rules, then written through the data adapter, which only writes declared attributes as bound parameters.

<Aside variant="warning">
Choosing the file columns manually, queued imports, import history and XLSX files are not available yet.
</Aside>
