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
                .rules(['numeric', 'min:0']),
        ];
    }
}
```

### Requiring a column to be mapped

When a column marked `requiredMapping()` is not mapped to a column of the file, nothing is imported: the mapping select is required in the modal.

`requiredMappingForNewRecordsOnly()` only requires the column for rows that create a record: a file without it may still update existing records, and each row that would create one fails with an error saying the column was not mapped:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('name')
    .requiredMappingForNewRecordsOnly()
```

### Matching the columns of the file

A column of the file matches an import column when its header is the column's label or name, ignoring case, with `-`, `_` and spaces alike (`Unit price`, `unit_price` and `unit-price` all match `unit_price`). `guesses()` (or `guess()`) adds other headers:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('sku')
    .guesses(['id', 'number', 'stock-keeping unit'])
```

### Choosing the columns of the file

Once the file is uploaded, the modal lists the importer's columns, each with a select of the file's headers, already set to the header it matches. The user may change them; a column left empty is not imported. Only headers of the uploaded file are accepted, whatever the browser sends. A file with duplicate headers is refused.

`helperText()` adds a text under a column's select:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('skus')
    .multiple(',')
    .helperText('A comma-separated list of SKUs.')
```

To skip this step and only match the headers automatically, disable it:

```ts
ImportAction.make()
    .importer(ProductImporter)
    .columnMapping(false)
```

### Validating the data

The values are validated once [cast](#casting-the-data). `rules()` takes the rules of [form fields](/forms/validation) written as strings (`required`, `email`, `numeric`, `integer`, `boolean`, `min:n`, `max:n`, `in:a,b`, `regex:/…/`…), rule objects, or a function returning an error message or `null`. Sizes compare numbers for a numeric column (`numeric()`, `integer()` or a `numeric` rule) and the length of the text otherwise:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('email')
    .rules(['required', 'email', (state) => (String(state).endsWith('@example.com') ? null : 'Only company addresses are accepted.')])
```

A function rule receives the value, the row's data and the [row context](#lifecycle-hooks). A row that fails validation is skipped, and listed in the failed rows file with every error.

`enum()` only accepts the values of an [enum](/advanced/enums#importing-enum-values): `ImportColumn.make('status').enum(Status)`. The enum's values are the column's examples.

#### Customizing validation messages

`getValidationMessages()` returns messages by column and rule; `:attribute` is replaced by the column's name in messages:

```ts
import { Importer } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static getValidationMessages(): Record<string, string> {
        return {
            'name.required': 'The name column must not be empty.',
        };
    }
}
```

The name of a column in messages is its label, with a lowercase first letter. `validationAttribute()` changes it:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('name')
    .validationAttribute('full name')
```

### Casting the data

Cells are text, trimmed, and `null` when blank. `numeric()`, `integer()` and `boolean()` convert them:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('price')
    .numeric() // Ignores characters other than digits, `.` and `-` ("$12.50" is 12.5).

ImportColumn.make('price')
    .numeric(true, 2) // Rounded to 2 decimal places.

ImportColumn.make('quantity')
    .integer()

ImportColumn.make('is_visible')
    .boolean() // `1`, `true`, `yes`, `y`, `on` are 1; `0`, `false`, `no`, `n`, `off` are 0.
```

A cell with no number at all (`twelve`) stays invalid, so that a `numeric` rule rejects it.

`castStateUsing()` converts the value yourself, after the built-in casts. It receives the cast value, and the context with `originalState`, the cell before casting:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('price')
    .numeric()
    .castStateUsing((state, { originalState }) => (state === null ? null : Math.round(state * 100)))
```

### Handling multiple values in a single column

`multiple()` splits the cell into a list of values, with the given separator (`,` by default; `array()` is the same). Each value is cast, and blank values are dropped:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('customer_ratings')
    .multiple(',')
    .integer()
    .rules(['array'])
    .nestedRecursiveRules(['min:1', 'max:5'])
```

`nestedRecursiveRules()` validates each value; its errors are named after the column and the position of the value (`customer_ratings.1`).

### Importing relationships

`relationship()` imports a relationship of the Objection model (from its `relationMappings`; the column's name by default). For a belongs-to relationship, the cell identifies the related record, whose key fills the foreign key:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('author')
    .relationship()
```

The cell holds the key of the author; a value that matches no record fails validation. With `multiple()`, a many-to-many relationship links the records once the record is saved (records already linked are left as they are):

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('tags')
    .relationship()
    .multiple(',')
```

`resolveUsing`, the second argument, finds the related records by another column, or by any of several columns:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('author')
    .relationship(null, 'email')

ImportColumn.make('author')
    .relationship(null, ['email', 'username'])
```

It may also be a function returning the related record (a list of records for `multiple()`), or the columns to search:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('author')
    .relationship(null, (state) => (String(state).includes('@') ? 'email' : 'username'))
```

When a function returns records, check that every value was found: Navette cannot know which value each record stands for. The model is the data adapter's; set the importer's static `model` (or pass `{ model }` as the third argument) when the adapter has none.

### Marking column data as sensitive

`sensitive()` leaves the column's values out of the failed rows file and of the [import history](#keeping-a-history-of-imports):

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('ssn')
    .label('Social security number')
    .sensitive()
    .rules(['required', 'digits:9'])
```

### Customizing how a column fills the record

`fillRecordUsing()` writes the value into the record's attributes yourself, for example into another attribute. `saveRelationshipsUsing()` runs once the record is saved, with the saved record:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('sku')
    .fillRecordUsing((values, state) => { values.sku = String(state).toUpperCase(); })
```

### Ignoring blank cells

By default, a blank cell of a mapped column writes `null`. With `ignoreBlankState()`, it leaves the record's value as it is:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('price')
    .ignoreBlankState()
```

## Updating existing records

`resolveRecord()` returns the record a row fills. By default it returns `{}`, a new record: every row creates one. Return an existing record to update it instead, and `{}` (or an object with the attributes a new record starts with) to create one:

```ts
import { Importer } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static async resolveRecord(data: Record<string, unknown>): Promise<Product | object | null> {
        return (await Product.query().findOne({ sku: data.sku })) ?? {};
    }
}
```

A record is new when it has no key. The data adapter creates it, or updates the existing one.

### Updating existing records only

Return `null` to skip a row: nothing is saved, and the row is neither an error nor a failure (it counts as successful). An importer that only updates records returns `null` when none is found:

```ts
import { Importer } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static async resolveRecord(data: Record<string, unknown>): Promise<Product | null> {
        return (await Product.query().findOne({ sku: data.sku })) ?? null;
    }
}
```

To list such rows in the failed rows file instead, throw a `RowImportFailedError` with your message:

```ts
import { Importer, RowImportFailedError } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static async resolveRecord(data: Record<string, unknown>): Promise<Product> {
        const product = await Product.query().findOne({ sku: data.sku });
        if (!product) throw new RowImportFailedError(`No product found with SKU [${data.sku}].`);
        return product;
    }
}
```

## Using import options

`getOptionsFormComponents()` adds components to the modal, for the user to choose how the file is imported. Their values are the import's options:

```ts
import { Checkbox } from '@navette-js/forms';
import { Importer } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static getOptionsFormComponents() {
        return [
            Checkbox.make('updateExisting')
                .label('Update existing records'),
        ];
    }
}
```

`options()` on the action passes static options; the values of the form override them:

```ts
ImportAction.make()
    .importer(ProductImporter)
    .options({ updateExisting: true })
```

`resolveRecord()`, the hooks and the column functions receive the options in their context (`ctx.options`):

```ts
import { Importer, type ImportRowContext } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static async resolveRecord(data: Record<string, unknown>, ctx: ImportRowContext) {
        if (ctx.options.updateExisting) return (await Product.query().findOne({ sku: data.sku })) ?? {};
        return {};
    }
}
```

## Lifecycle hooks

Hooks run code at each step of a row: before and after validation, before and after the record's attributes are filled, and around saving:

```ts
import { Importer, type ImportRowContext } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static async beforeValidate(ctx: ImportRowContext) {} // ctx.data may be changed
    static async afterValidate(ctx: ImportRowContext) {}
    static async beforeFill(ctx: ImportRowContext) {}
    static async afterFill(ctx: ImportRowContext) {} // ctx.values, the attributes, may be changed
    static async beforeSave(values: Record<string, unknown>, record: Product | null, ctx: ImportRowContext) {}
    static async beforeCreate(ctx: ImportRowContext) {} // like beforeSave, for a new record only
    static async beforeUpdate(ctx: ImportRowContext) {} // like beforeSave, for an existing record only
    static async afterSave(record: Product, ctx: ImportRowContext) {}
    static async afterCreate(ctx: ImportRowContext) {}
    static async afterUpdate(ctx: ImportRowContext) {}
}
```

The context has the row's `data` (cast values by column name), its `originalData` (the cells by header), the `record` (as returned by `resolveRecord()`, then the saved one), the `values` written to the record, the `options`, the `columnMap`, the `import` run and the `livewire` component.

### Customizing how the record is saved

By default, a new record is created and an existing one updated through the resource's data adapter, with the attributes filled by the columns. Override `saveRecord(values, record, ctx)` to save it another way (an upsert, a service of your application…) and return the saved record. `record` is `null` for a new record; `ctx.key` is the key of the existing one, and `ctx.adapter` the data adapter. Call `super.saveRecord()` to keep the default save:

```ts
import { Importer, type ImportRowContext } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static async saveRecord(values: Record<string, unknown>, record: Product | null, ctx: ImportRowContext & { adapter: any; key: string | null }) {
        return productService.upsertBySku(values);
    }
}
```

The `beforeSave()` / `beforeCreate()` / `beforeUpdate()` hooks run before it, and the relationship columns are saved on the returned record after it, before `afterSave()`. Because `saveRecord()` can be customized, `assertImported()` in [importer tests](/testing/imports) does not prove the database was written: check the saved record.

### Rejecting a row

To reject a row from a hook, throw a `RowImportFailedError`: the row is skipped, and listed in the failed rows file with your message. Throw an `ImportValidationError` to reject it with validation errors (`new ImportValidationError({ price: 'The price is too low.' })`). Any other error is logged, and the row is listed with a generic message.

`getCompletedNotificationTitle(run)` and `getCompletedNotificationBody(imported, failed, run)` customize the notification; `modifyCompletedNotification(notification, run)` changes anything else (its icon, its actions…) or returns another notification. The notification already holds the link to the failed rows file, if any: `notification.getActions()` returns it, to add an action without losing it:

```ts
import { Action } from '@navette-js/actions';
import { Importer, type ImportRun, type Notification } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static modifyCompletedNotification(notification: Notification, run: ImportRun): Notification {
        return notification.actions([
            ...notification.getActions(),
            Action.make('viewProducts').label('View products').url('/admin/products'),
        ]);
    }
}
```

To test an importer, see [testing imports](/testing/imports).

## Providing an example file

The modal offers an example CSV file, with a header row of every column and example rows. `example()` sets a column's value in the example row; `examples()` sets several, one row each. `exampleHeader()` changes the column's header in the file (its name by default):

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('sku')
    .exampleHeader('SKU')
    .examples(['ABC123', 'DEF456'])
```

## Reading the file

### Setting the CSV encoding

By default, a CSV file is read as UTF-8 when it is valid UTF-8, and as Windows-1252 otherwise. `csvEncoding()` sets the encoding, with a [`TextDecoder` label](https://developer.mozilla.org/docs/Web/API/Encoding_API/Encodings) (`windows-1252`, `shift_jis`, `euc-kr`…; `SJIS-win` is accepted too); `null` restores the detection:

```ts
ImportAction.make()
    .importer(ProductImporter)
    .csvEncoding('windows-1252')
```

### Changing the CSV delimiter

By default, the delimiter is guessed among `,`, `;`, `|` and tab. `csvDelimiter()` sets it (one character):

```ts
ImportAction.make()
    .importer(ProductImporter)
    .csvDelimiter(';')
```

### Changing the header offset

When the header is not the first row of the file, `headerOffset()` skips the rows before it:

```ts
ImportAction.make()
    .importer(ProductImporter)
    .headerOffset(5)
```

### Validating the file

The upload field accepts CSV and XLSX files, and refuses files larger than 5 MB (`maxFileSize()`, in kilobytes). `fileRules()` adds rules: `max:n` and `min:n` (kilobytes), `extensions:csv,txt` (the name of the file), `mimes:` and `mimetypes:` (the detected type), rule objects, or a function of the uploaded file returning an error message:

```ts
ImportAction.make()
    .importer(ProductImporter)
    .fileRules(['max:1024', (file) => (file.name.startsWith('tmp') ? 'Rename the file first.' : null)])
```

## Limiting the size of the file

A file of more than 1,000 rows is refused; change it with `maxRows()`, up to 10,000:

```ts
import { ImportAction } from '@navette-js/panels';

ImportAction.make()
    .importer(ProductImporter)
    .maxRows(5000)
    .maxFileSize(10240)
```

## Changing the chunk size

Rows are processed 100 at a time; between chunks, the process handles other requests. `chunkSize()` changes it:

```ts
ImportAction.make()
    .importer(ProductImporter)
    .chunkSize(250)
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

The runner also receives the task's context, to route it: `type` (`'import'`), the `importer` class, the `run`, the `panel` id, the `userId`, and the `queue` and `connection` names returned by the importer's `getJobQueue()` and `getJobConnection()` (`null` by default). See [running exports in the background](/actions/export#running-exports-in-the-background).

`ImportAction.configureUsing((action) => …)` sets up every import action created afterwards, e.g. to make them all queued.

## Downloading the failed rows

The failed rows file lists the cells of each failed row, as uploaded (sensitive columns left blank), with its errors. It is kept like the [export files](/actions/export#downloading-the-files): on the disk, for 24 hours, for the user who imported it only.

`getFailedRowsDownloader()` changes how the file is sent: a function receiving the stored file and the Express response:

```ts
import { Importer, type Downloader } from '@navette-js/panels';

export class ProductImporter extends Importer {
    static getFailedRowsDownloader(): Downloader {
        return (file, res) => {
            res.setHeader('Content-Type', file.type);
            res.attachment(`failed-${file.name}`);
            res.send(file.content);
        };
    }
}
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

### Using a polymorphic user relationship

If users of several panels (with their own user tables) share the history, pass `{ polymorphicUser: true }` to `importExportSchema()` and `knexImportExportHistory()`: runs then also store the id of the panel the user imported from in a `user_type` column. See [the export history](/actions/export#using-a-polymorphic-user-relationship).

## Security

- The action is authorized with the `create` ability of the resource's policy. Rows are not authorized one by one: `resolveRecord()` decides which records a row may update, so only return records the user is allowed to change, and check anything else in the hooks (`beforeCreate()`, `beforeUpdate()`).
- Only the uploaded file of the request is read, never a path sent by the browser. Its type is detected from its content.
- The chosen columns can only be headers of the uploaded file, and only the components of the options form give options.
- Values are validated with your rules, then written through the data adapter, which only writes declared attributes as bound parameters. Relationship lookups use the columns your code names, with the cells as bound parameters.
- The failed rows file holds the uploaded cells. Cells that start like a formula (`=`, `+`, `-`, `@`, a tab or a carriage return; numbers such as `-5` aside) are prefixed with `'`, so that spreadsheet software does not run them. This is on by default. As the prefix stays when the file is corrected and uploaded again, you may turn it off for every importer with `Importer.preventFormulaInjection(false)`, or for one with `ProductImporter.preventFormulaInjection(false)` (or by overriding `shouldPreventFormulaInjection()`), when the files come from trusted users.
