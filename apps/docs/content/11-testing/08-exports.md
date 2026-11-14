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

Without an argument, `test()` takes the visible columns enabled by default, in their order. A column map selects exactly the given columns, in its order, with their labels, including hidden columns and columns disabled by default:

```ts
const exporter = ProductExporter.test({ sku: 'SKU', name: 'Name' });

assert.deepEqual(exporter.export(product), ['DESK-01', 'Oak desk']);
assert.deepEqual(exporter.labels, ['SKU', 'Name']);
```

`labels` is the header row of the file. The record is used as given: load its relationships yourself when a column reads one (`author.name`), as the exporter's `modifyQuery()` would.

### Testing formatting and options

The second argument passes the [export options](/actions/export#using-export-options), which the column functions receive in their context, and the export run (`export`) they see:

```ts
// The exporter's column:
// ExportColumn.make('score')
//     .state((record, { options }) => record.rating * Number(options.multiplier ?? 1))
//     .formatStateUsing((state) => `${state} points`)
assert.deepEqual(PostExporter.test({ score: 'Score' }, { options: { multiplier: 2 } }).export({ rating: 3 }), ['6 points']);
```

Options are passed as given: the options form's defaults and validation do not apply.

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

## Faking the export action

`ExportAction.fake()` records the exports that export actions request, without building their files: the action still checks its form, counts the records (refusing more than `maxRows()`) and records the run in the [history](/actions/export#keeping-a-history-of-exports), but no file is written and no notification is sent. `ExportBulkAction.fake()` is the same fake: it records both actions.

```ts
import { ExportAction } from '@navette-js/panels';
import { livewire, TestAction } from '@navette-js/panels/testing';

test('a product export is requested', async () => {
    const exports = ExportAction.fake();
    try {
        await livewire(ProductResource.getPages().index)
            .searchTable('Oak')
            .callAction(TestAction.make('export').table(), { columns: ['name'] })
            .assertHasNoFormErrors();

        await exports.assertDispatched(ProductExporter, async (run, query, columnMap) => {
            const names = (await query.getRecords()).map((product) => product.name);
            assert.deepEqual(names, ['Oak desk']);
            assert.deepEqual(columnMap, { name: 'Name' });
            return run.totalRows === 1;
        });
        exports.assertDispatchedTimes(ProductExporter);
    } finally {
        exports.restore();
    }
});
```

The callback receives, in this order, the export run (`userId`, `totalRows`, `fileName`…), the query, the column map (column name → label, in the order of the file), the options (merged from the action and the form), the formats, and the selected keys of a bulk export (`null` otherwise). Return `true` for a match, or `false` to try the next export; you may assert inside it. The query has the table's filters, search and sort, the exporter's `modifyQuery()` and the action's `modifyQueryUsing()`; `getRecords()`, `getKeys()` and `count()` run it. It is not restricted to the selected records: compare the keys with the last argument.

As the callback may run the query, `assertDispatched()` and `assertNotDispatched()` are asynchronous: await them. `assertDispatchedTimes()` checks the exact count (1 by default), and `assertNothingDispatched()` that no export was requested at all, for example after a form error. Exporters may also be named by their class name.

The fake replaces the export processing of every action of the process until `restore()` is called: restore it at the end of the test. Calling `fake()` again starts a new, empty fake. Test the values of the rows with the exporter's `test()` method, and the files with an unfaked action.
