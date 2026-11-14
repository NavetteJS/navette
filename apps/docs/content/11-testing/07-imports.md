---
title: Testing imports
---

## Introduction

An [importer](/actions/import) is tested at two levels: its rows, with its `test()` method, without a file; and the import action, with an uploaded file, through the page that shows it.

## Testing a row

`test()` returns a tester running your importer on one row at a time, as the import action would: validation of each column, casting, `resolveRecord()`, `beforeSave()`, saving through the adapter, and `afterSave()`. Give it the data adapter that saves the records, usually the resource's:

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

`import()` is asynchronous and returns the tester. `assertImported()` checks that the row was saved, and `getRecord()` returns the saved record (`null` when the row failed). The records are really saved: run these tests on a test database.

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

`resolveRecord()` receives `{ livewire }` as its second argument; pass the component it needs with the `livewire` option.

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

Columns are named as in the importer, not by the headers of the file. Rules are named without their parameter (`max`, not `max:255`); a function rule is named `closure`, or matched by its exact message. `errors()` returns the message of each failed column.

## Testing rejected rows

A row rejected by a `RowImportFailedError`, thrown from `resolveRecord()`, `beforeSave()` or `afterSave()`, is checked with `assertHasRowFailure()`, optionally with its exact message. `assertHasNoRowFailure()` checks that the row was not rejected:

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
