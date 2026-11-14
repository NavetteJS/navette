---
title: Testing tables
---

## Introduction

The table of a list page, a relation manager or a table widget is tested through the component that shows it. The helpers below change its state like the controls of the table do (search field, column headers, filters), then check what the table shows.

```ts
import { test } from 'node:test';
import { livewire } from '@navette-js/panels/testing';
import { TaskResource } from '../src/admin/resources/TaskResource.ts';

test('the list shows the tasks', async () => {
    await livewire(TaskResource.getPages().index)
        .assertCanSeeTableRecords(tasks);
});
```

In these examples, `tasks` holds records of the test database, inserted beforehand (record objects, or their keys).

## Testing that records are shown

`assertCanSeeTableRecords()` checks that the table shows the given records, and `assertCanNotSeeTableRecords()` that it does not. They look at the rendered rows: a record on another page of the table is not shown.

To check the order of the rows too, pass `{ inOrder: true }`:

```ts
await livewire(TaskResource.getPages().index)
    .sortTable('title')
    .assertCanSeeTableRecords(tasksSortedByTitle, { inOrder: true });
```

`assertCountTableRecords()` checks the number of records of the table query, on all pages:

```ts
await livewire(TaskResource.getPages().index).assertCountTableRecords(3);
```

## Testing that a column can be searched

`searchTable()` types in the search field of the table; without an argument, it clears it:

```ts
await livewire(TaskResource.getPages().index)
    .searchTable('Write')
    .assertCanSeeTableRecords([write])
    .assertCanNotSeeTableRecords([ship])
    .searchTable()
    .assertCanSeeTableRecords([write, ship]);
```

The search fields of individually searchable columns are filled with `searchTableColumns()`:

```ts
await livewire(TaskResource.getPages().index)
    .searchTableColumns({ title: 'Write' })
    .assertCanSeeTableRecords([write]);
```

## Testing that a column can be sorted

`sortTable()` sorts the table by a column, in the given direction, `'asc'` or `'desc'`. Without a direction, it acts like a click on the column header: ascending, then descending, then unsorted.

```ts
await livewire(TaskResource.getPages().index)
    .sortTable('title')
    .assertCanSeeTableRecords([alpha, bravo, charlie], { inOrder: true })
    .sortTable('title', 'desc')
    .assertCanSeeTableRecords([charlie, bravo, alpha], { inOrder: true });
```

Only a sortable column sorts the table: sorting by another name is ignored, as it is when the browser sends it.

## Testing filters

`filterTable()` applies a filter. Its value depends on the filter:

- a `SelectFilter` takes a value, or a list of values when it is `multiple()`;
- a `TernaryFilter` takes `true` or `false`, and is set to `true` without a value;
- a `Filter` with a checkbox or a toggle is enabled without a value, and disabled with `false`;
- a filter with its own form fields takes their state, such as `{ from: '2026-01-01', until: null }`.

```ts
await livewire(TaskResource.getPages().index)
    .filterTable('priority', 'high')
    .assertCanSeeTableRecords([urgent])
    .assertCanNotSeeTableRecords([someday]);
```

The applied state goes through the same checks as the browser's: keys a filter does not declare are dropped.

`resetTableFilters()` resets the filters to their defaults, `removeTableFilter('priority')` removes one filter (as its indicator does), and `removeTableFilters()` removes them all, with the search.

`assertTableFilterExists()` checks that the table has a filter. A function may check its configuration too:

```ts
await livewire(TaskResource.getPages().index)
    .assertTableFilterExists('priority', (filter) => filter.getLabel() === 'Priority');
```

### Testing the visibility of filters

`assertTableFilterVisible()` checks that a filter is shown, and `assertTableFilterHidden()` that it is [hidden](/tables/filters/overview#hiding-a-filter):

```ts
await livewire(TaskResource.getPages().index, {}, { user: reader })
    .assertTableFilterVisible('status')
    .assertTableFilterHidden('owner');
```

## Testing columns

`assertTableColumnExists()` checks that the table has a column, optionally with a function checking its configuration; `assertTableColumnDoesNotExist()` checks the contrary:

```ts
await livewire(TaskResource.getPages().index)
    .assertTableColumnExists('title', (column) => column.isSortable())
    .assertTableColumnDoesNotExist('secret');
```

A column hidden with `hidden()` or `visible()` does not exist for the table. A toggleable column the user has hidden still exists: `assertTableColumnVisible()` and `assertTableColumnHidden()` check whether it is shown. `toggleAllTableColumns()` shows every toggleable column, and `toggleAllTableColumns(false)` hides them.

`assertTableColumnStateSet()` checks the state of a column for a record, and `assertTableColumnStateNotSet()` the contrary. `assertTableColumnHasDescription()` and `assertTableColumnDoesNotHaveDescription()` check the description of a cell, below the value, or above it with `'above'` as the last argument:

```ts
await livewire(TaskResource.getPages().index)
    .assertTableColumnStateSet('title', 'Write the tests', write)
    .assertTableColumnHasDescription('title', 'Due tomorrow', write);
```

### Testing that a column is rendered

`assertCanRenderTableColumn()` checks that a column is shown, and rendered in every row of the current page. `assertCanNotRenderTableColumn()` checks that the column exists, but is not rendered, because the user hid it or it is hidden by default:

```ts
await livewire(TaskResource.getPages().index)
    .assertCanRenderTableColumn('title')
    .assertCanNotRenderTableColumn('created_at');
```

### Testing the formatted state of a column

`assertTableColumnFormattedStateSet()` checks the text a column shows for a record, after `formatStateUsing()`, dates, numbers, money, limits, prefix and suffix. `assertTableColumnFormattedStateNotSet()` checks the contrary. A list state gives a list of texts:

```ts
await livewire(OrderResource.getPages().index)
    .assertTableColumnFormattedStateSet('total', '$125.00', order)
    .assertTableColumnFormattedStateNotSet('total', '125', order);
```

The text is the one of `TextColumn.formatState(state, record)`, which you may also call yourself.

### Testing the extra attributes of a column

`assertTableColumnHasExtraAttributes()` checks the extra HTML attributes of a column for a record, and `assertTableColumnDoesNotHaveExtraAttributes()` the contrary:

```ts
await livewire(TaskResource.getPages().index)
    .assertTableColumnHasExtraAttributes('status', { class: 'is-late' }, lateTask)
    .assertTableColumnDoesNotHaveExtraAttributes('status', { class: 'is-late' }, task);
```

### Testing the options of a select column

`assertTableSelectColumnHasOptions()` checks the options of a [select column](/tables/columns/select) for a record, given as `{ value: label }` or as `[value, label]` pairs; `assertTableSelectColumnDoesNotHaveOptions()` checks the contrary:

```ts
await livewire(TaskResource.getPages().index)
    .assertTableSelectColumnHasOptions('status', { todo: 'To do', done: 'Done' }, task);
```

## Testing summaries

`assertTableColumnSummarySet()` checks the value of a [column summary](/tables/summaries), computed over all the records of the table query. Name the summarizer by its kind (`sum`, `average`, `count`, `range` or `values`) or by its label:

```ts
await livewire(OrderResource.getPages().index)
    .assertTableColumnSummarySet('total', 'sum', 1250)
    .assertTableColumnSummarySet('total', 'average', 125)
    .assertTableColumnSummarySet('created_at', 'range', ['2026-01-02', '2026-03-04']);
```

Numbers are compared rounded to four decimals. Pass `true` as the fourth argument to summarize only the current page. The summary follows the state of the table: after `filterTable()` or `searchTable()`, it covers the matching records only. `assertTableColumnSummaryNotSet()` checks the contrary, and `assertTableColumnSummarizerExists()` that a column has a summarizer.

## Testing table actions

Row actions, header actions and bulk actions are actions of the component: see [testing table actions](/testing/actions#testing-table-actions).

`assertTableRecordActionsExistInOrder()` checks that row actions come in a given order; other actions may come between them, and the actions of a group count in place of the group. `assertTableHeaderActionsExistInOrder()`, `assertTableEmptyStateActionsExistInOrder()` and `assertTableBulkActionsExistInOrder()` check the other lists. `assertTableActionsExistInOrder()` is an older name of the first one:

```ts
await livewire(TaskResource.getPages().index)
    .assertTableRecordActionsExistInOrder(['view', 'edit', 'delete'])
    .assertTableHeaderActionsExistInOrder(['import', 'export']);
```

`callTableColumnAction()` runs the action of a column (`action()` on the column) for a record. Tables load with their page, so `loadTable()` does nothing; it is kept so that older tests still run.
