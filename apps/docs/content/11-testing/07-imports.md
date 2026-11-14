---
title: Testing imports
---

## Introduction

An [importer](/actions/import) is tested at two levels: its rows, with its `test()` method, without a file; and the import action, with an uploaded file, through the page that shows it.

## Testing a row

`test()` returns a tester running your importer on one row at a time, as the import action would: casting, `resolveRecord()`, validation of each column, filling, saving through the adapter (relationships included), and every hook. Give it the data adapter that saves the records, usually the resource's:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProductImporter } from '../src/admin/imports/ProductImporter.ts';
import { ProductResource } from '../src/admin/resources/ProductResource.ts';

test('a product is imported', async () => {
    const result = await ProductImporter.test({ adapter: ProductResource.adapter }).import({
        sku: 'MUG-001',
        name: 'Ceramic mug',
        price: '12.50',
    });

    result.assertImported();
    assert.equal(result.getRecord().price, 12.5);
});
```

`import()` is asynchronous and returns the tester. `assertImported()` checks that the importer completed without an error and resolved a record. It does not prove that the database was written, since your importer may customize [`saveRecord()`](/actions/import#customizing-how-the-record-is-saved): check the saved values with `getRecord()` or the database. `assertImported()` checks that the row was saved, and `getRecord()` returns the saved record (`null` when the row failed). The records are really saved: run these tests on a test database.

### Mapping the columns

The keys of the row are the headers of the file. By default, each column of the importer reads the header with its own name. Pass a `columnMap` to read other headers:

```ts
const result = await ProductImporter.test({
    adapter: ProductResource.adapter,
    columnMap: { sku: 'Product code', name: 'Product name' },
}).import({
    'Product code': 'MUG-001',
    'Product name': 'Ceramic mug',
});
```

A map replaces the default one: columns it omits are not imported, as when the user leaves them unmapped in the modal. `requiredMapping()` is checked by the import action, not by this tester.

### Passing options and the import

`options` are the [import options](/actions/import#using-import-options), as the action would merge them from its `options()` and its options form; `resolveRecord()`, the hooks and the column functions receive them in their context:

```ts
const result = await ProductImporter.test({
    adapter: ProductResource.adapter,
    options: { updateExisting: true },
}).import({ sku: 'MUG-001', name: 'Large ceramic mug' });

result.assertImported();
```

The tester does not validate the options form or apply its defaults: pass every option your importer reads. `import` sets the import run the hooks see (`ctx.import`: its `id`, `userId`, `fileName`…), and `livewire` the component.

## Testing skipped rows

`assertSkipped()` checks that `resolveRecord()` returned `null`: nothing was saved, and the row has neither validation errors nor a failure:

```ts
const result = await ProductImporter.test({ adapter: ProductResource.adapter }).import({ sku: 'MISSING-001' });

result.assertSkipped();
assert.equal(await db('products').where('sku', 'MISSING-001').first(), undefined);
```

## Testing validation errors

`assertHasErrors()` checks the validation errors of the row: any error without an argument, errors on some columns with a list, or the rules they fail with an object. `assertHasNoErrors()` checks that there are none, or none on the given columns:

```ts
const result = await ProductImporter.test({ adapter: ProductResource.adapter }).import({
    sku: 'MUG-001',
    name: '',
    price: 'twelve',
});

result
    .assertHasErrors({ name: 'required', price: 'numeric' })
    .assertHasNoErrors(['sku']);
```

Columns are named as in the importer, not by the headers of the file; a value of a [`multiple()`](/actions/import#handling-multiple-values-in-a-single-column) column is named after its position (`ratings.1`). Every rule a value fails is recorded: `{ price: ['numeric', 'min'] }` checks both. Rules are named without their parameter (`max`, not `max:255`); a function rule is named `closure`, an error thrown with an `ImportValidationError` is named `custom`, and any of them can be matched by its exact message. `errors()` returns the messages of each failed column, and `failedRules()` the names of its failed rules.

## Testing rejected rows

A row rejected by a `RowImportFailedError`, thrown from `resolveRecord()` or a hook, is checked with `assertHasRowFailure()`, optionally with its exact message. `assertHasNoRowFailure()` checks that the row was not rejected:

```ts
const result = await ProductImporter.test({ adapter: ProductResource.adapter }).import({ sku: 'MISSING-001' });

result.assertHasRowFailure('No product found with SKU [MISSING-001].');
```

Any other error thrown by your importer is not caught: it fails the test.

## Testing the import action

Through the page, the import action reads a real file. Mount the action, upload the file with `fillForm()` and an [`UploadedFile`](/testing/schemas#filling-a-form), choose the columns, then submit:

```ts
import { livewire, TestAction, UploadedFile } from '@navette-js/panels/testing';

test('products are imported from a file', async () => {
    await livewire(ProductResource.getPages().index)
        .mountAction(TestAction.make('import').table())
        .fillForm({
            file: UploadedFile.fake().createWithContent('products.csv', 'Product code,Product name\nMUG-001,Ceramic mug\n'),
        })
        .fillForm({ columnMap: { sku: 'Product code', name: 'Product name' } })
        .callMountedAction()
        .assertHasNoFormErrors()
        .assertNotified('Import completed');

    assert.ok(await db('products').where('sku', 'MUG-001').first());
});
```

Upload the file before choosing the columns: once uploaded, the form reads its headers and preselects the columns that match them. Without the second `fillForm()`, the preselected columns are imported.

The action is the one of the table header (`table()`); for an import action in the page header, use `mountAction('import')`. The rows are imported during the request unless the action is [queued](/actions/import#running-imports-in-the-background), with database notifications configured. Rows that fail are offered in a file: `getDownloads()` returns it after the chain has run.

## Faking the import action

`ImportAction.fake()` records the imports that import actions request, without processing their rows: the action still reads the file, validates the form (the column mapping, the options form) and records the run in the [history](/actions/import#keeping-a-history-of-imports), but no row is saved, no hook runs and no notification is sent. Check the requests with the returned fake:

```ts
import { ImportAction } from '@navette-js/panels';
import { livewire, TestAction, UploadedFile } from '@navette-js/panels/testing';

test('a product import is requested', async () => {
    const imports = ImportAction.fake();
    try {
        await livewire(ProductResource.getPages().index)
            .mountAction(TestAction.make('import').table())
            .fillForm({ file: UploadedFile.fake().createWithContent('products.csv', 'Product code,Product name\nMUG-001,Ceramic mug\n') })
            .fillForm({ columnMap: { sku: 'Product code', name: 'Product name' }, updateExisting: true })
            .callMountedAction()
            .assertHasNoFormErrors();

        imports
            .assertDispatched(ProductImporter, (run, columnMap, options) => run.userId === user.id && columnMap.sku === 'Product code' && options.updateExisting === true)
            .assertDispatchedTimes(ProductImporter);
    } finally {
        imports.restore();
    }
});
```

The callback receives the import run (`userId`, `fileName`, `totalRows`…), the column map (column name → header, `null` for a column left unmapped) and the options, merged from the action and the form.

`assertDispatched()` checks that at least one import of the importer was requested, matching the callback if given. `assertDispatchedTimes()` checks the exact count (1 by default), `assertNotDispatched()` that none was requested (or none matching the callback), and `assertNothingDispatched()` that no import was requested at all, for example after a form error. Importers may also be named by their class name.

The fake replaces the import processing of every action of the process until `restore()` is called: restore it at the end of the test. Calling `ImportAction.fake()` again starts a new, empty fake. Test the rows with the importer's `test()` method.
