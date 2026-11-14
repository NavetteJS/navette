---
title: Testing exports
---

## Introduction

An [exporter](/actions/export) is tested at two levels: the values of a row, with its `test()` method, without a table; and the export action, with the file it produces, through the page that shows it.

## Testing row values

`test()` returns a tester whose `export()` gives the values of one record, in the order of the columns, as written to the file (before CSV escaping). State and formatting functions of the columns run as in a real export:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProductExporter } from '../src/admin/exports/ProductExporter.ts';

test('a product is exported', () => {
    const product = { name: 'Oak desk', sku: 'DESK-01', price: 250 };

    assert.deepEqual(ProductExporter.test().export(product), ['Oak desk', 'DESK-01', '$250.00']);
});
```

Without an argument, `test()` takes the columns enabled by default, in their order. A column map selects exactly the given columns, in its order, with their labels, including columns disabled by default:

```ts
const exporter = ProductExporter.test({ sku: 'SKU', name: 'Name' });

assert.deepEqual(exporter.export(product), ['DESK-01', 'Oak desk']);
assert.deepEqual(exporter.labels, ['SKU', 'Name']);
```

`labels` is the header row of the file. The record is used as given: load its relationships yourself when a column reads one (`author.name`), as the exporter's `modifyQuery()` would.

## Testing the export action

Through the page, the export action builds the file from the table query, with its filters, search and sort. Call it, then read the file with `getDownloads()`, which returns the files offered by the notifications of the test:

```ts
import { livewire, TestAction } from '@navette-js/panels/testing';

test('the drafts can be exported', async () => {
    const page = livewire(ProductResource.getPages().index);

    await page
        .filterTable('status', 'draft')
        .callAction(TestAction.make('export').table(), { columns: ['name', 'sku'] })
        .assertNotified('Export completed');

    const csv = page.getDownloads().find((file) => file.name.endsWith('.csv'))!;
    assert.equal(csv.content.toString('utf8').replace(/^﻿/, ''), 'Name,SKU\r\nOak desk,DESK-01\r\n');
});
```

`columns` lists the columns checked in the modal; without it, the columns enabled by default are exported. Each file has a `name`, a `type` and its `content` (a `Buffer`): the CSV file starts with a byte order mark, and the XLSX file is a spreadsheet you may read with a library of your choice.

A bulk export takes the selected records: `selectTableRecords()` before `callAction(TestAction.make('export').table().bulk())`. The export runs during the request unless the action is [queued](/actions/export#running-exports-in-the-background), with database notifications configured.
