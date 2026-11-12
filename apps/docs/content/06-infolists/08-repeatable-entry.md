---
title: Repeatable entry
---

## Introduction

The repeatable entry allows you to repeat a set of entries for items in an array. In Navette, the items are presented as a table: one row per item, and one cell per entry:

```ts
import { TableColumn } from '@navette-js/forms';
import { RepeatableEntry, TextEntry } from '@navette-js/infolists';

RepeatableEntry.make('expenseLines')
    .table([
        TableColumn.make('Description'),
        TableColumn.make('Quantity').width(100),
        TableColumn.make('Unit price').width(120),
        TableColumn.make('Amount').width(120),
        TableColumn.make('Date').width(150),
    ])
    .schema(() => [
        TextEntry.make('description'),
        TextEntry.make('quantity').numeric(),
        TextEntry.make('unit_price').money('usd'),
        TextEntry.make('amount').money('usd'),
        TextEntry.make('date').date(),
    ])
```

```preview
// record: {"expenseLines": [{"description": "Train ticket", "quantity": 1, "unit_price": 89.5, "amount": 89.5, "date": "2025-03-04"}, {"description": "Hotel night", "quantity": 2, "unit_price": 120, "amount": 240, "date": "2025-03-04"}, {"description": "Team dinner", "quantity": 1, "unit_price": 64.2, "amount": 64.2, "date": "2025-03-05"}]}
// viewport: 1100
RepeatableEntry.make('expenseLines')
    .table([
        TableColumn.make('Description'),
        TableColumn.make('Quantity').width(100),
        TableColumn.make('Unit price').width(120),
        TableColumn.make('Amount').width(120),
        TableColumn.make('Date').width(150),
    ])
    .schema(() => [
        TextEntry.make('description'),
        TextEntry.make('quantity').numeric(),
        TextEntry.make('unit_price').money('usd'),
        TextEntry.make('amount').money('usd'),
        TextEntry.make('date').date(),
    ])
```

As you can see, the repeatable entry has an embedded `schema()` which gets repeated for each item. Each entry reads its state from the item, in the same way as it reads it from the record in an infolist.

For example, the state of this entry might be represented as:

```ts
[
    { description: 'Train ticket', quantity: 1, unit_price: 89.5, amount: 89.5, date: '2025-03-04' },
    { description: 'Hotel night', quantity: 2, unit_price: 120, amount: 240, date: '2025-03-04' },
]
```

The state must be an array: the record should carry the items, loaded by its data adapter. Any other state renders an empty table.

<Aside variant="tip">
Pass a function to `schema()`, as in this example, so that each item receives fresh entry instances. You may also pass an array of entries.
</Aside>

## Table repeatable layout

The `table()` method accepts an array of `TableColumn` objects, from `@navette-js/forms`. These objects represent the columns of the table, which correspond to the entries of the schema, in the same order. The labels displayed in the header of the table are passed to the `TableColumn.make()` method. The labels of the entries themselves are hidden in the cells.

You can set a fixed column width using the `width()` method. A number is a width in pixels; a string is passed directly to the `style` attribute of the column header:

```ts
import { TableColumn } from '@navette-js/forms';

TableColumn.make('Name')
    .width('200px')
```

The repeatable entry has its own label above the table. When it is the only entry of a section, you may hide it with `hiddenLabel()`:

```ts
import { TableColumn } from '@navette-js/forms';
import { RepeatableEntry, TextEntry } from '@navette-js/infolists';
import { Section } from '@navette-js/schemas';

Section.make('Line Items')
    .columnSpanFull()
    .schema([
        RepeatableEntry.make('expenseLines')
            .hiddenLabel()
            .table([
                // ...
            ])
            .schema(() => [
                // ...
            ]),
    ])
```

```preview
// record: {"expenseLines": [{"description": "Train ticket", "amount": 89.5}, {"description": "Hotel night", "amount": 240}]}
// viewport: 1100
Section.make('Line Items')
    .columnSpanFull()
    .schema([
        RepeatableEntry.make('expenseLines')
            .hiddenLabel()
            .table([
                TableColumn.make('Description'),
                TableColumn.make('Amount').width(120),
            ])
            .schema(() => [
                TextEntry.make('description'),
                TextEntry.make('amount').money('usd'),
            ]),
    ])
```

<Aside variant="warning">
The default layout of Filament, where each item is rendered as a card with its own grid (`grid()`, `columns()`, `contained()`), is not available in Navette yet: always use `table()`. `hiddenHeaderLabel()`, `wrapHeader()` and `alignment()` on table columns, and `maxItemsForProcessing()`, are not available either. Only entries can be placed in the schema of a repeatable entry, not layout components.
</Aside>
