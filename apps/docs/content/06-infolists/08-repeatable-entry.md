---
title: Repeatable entry
---

## Introduction

The repeatable entry allows you to repeat a set of entries and layout components for items in an array:

```ts
import { RepeatableEntry, TextEntry } from '@navette-js/infolists';

RepeatableEntry.make('comments')
    .schema(() => [
        TextEntry.make('author.name'),
        TextEntry.make('title'),
        TextEntry.make('content')
            .columnSpan(2),
    ])
    .columns(2)
```

```preview
// record: {"comments": [{"author": {"name": "Jane Doe"}, "title": "Wow!", "content": "The new release makes the review workflow so much faster. Thank you for the quick turnaround."}, {"author": {"name": "John Doe"}, "title": "This isn't working. Help!", "content": "Since the last update, the export button no longer downloads the file. I tried with two browsers."}]}
// viewport: 1100
RepeatableEntry.make('comments')
    .schema(() => [
        TextEntry.make('author.name'),
        TextEntry.make('title'),
        TextEntry.make('content').columnSpan(2),
    ])
    .columns(2)
```

As you can see, the repeatable entry has an embedded `schema()` which gets repeated for each item. Each entry reads its state from the item, in the same way as it reads it from the record in an infolist.

For example, the state of this entry might be represented as:

```ts
[
    {
        author: { name: 'Jane Doe' },
        title: 'Wow!',
        content: 'The new release makes the review workflow so much faster.',
    },
    {
        author: { name: 'John Doe' },
        title: "This isn't working. Help!",
        content: 'Since the last update, the export button no longer downloads the file.',
    },
]
```

The state must be an array. When the entry is named after a relationship of the record's Objection model (`relationMappings`), such as `comments`, the related records are loaded for you if the record does not carry them yet; the components of each item can use dot notation too (`author.name`). Any other state is treated as an empty list, and you may display text instead with [`placeholder()`](/infolists/overview#adding-placeholder-text-if-an-entry-is-empty).

The `columns()` method sets the grid of the components inside each item: a number applies from the `lg` breakpoint, and an object sets it per breakpoint, like the `columns()` method of a [grid](/schemas/layouts).

<Aside variant="tip">
Pass a function to `schema()`, as in this example, so that each item receives fresh component instances. You may also pass an array of components.
</Aside>

## Grid layout

You may organize repeatable items into columns by using the `grid()` method:

```ts
import { RepeatableEntry } from '@navette-js/infolists';

RepeatableEntry.make('comments')
    .schema(() => [
        // ...
    ])
    .grid(2)
```

```preview
// record: {"comments": [{"author": {"name": "Jane Doe"}, "title": "Wow!"}, {"author": {"name": "John Doe"}, "title": "This isn't working. Help!"}]}
// viewport: 1100
RepeatableEntry.make('comments')
    .schema(() => [
        TextEntry.make('author.name'),
        TextEntry.make('title'),
    ])
    .grid(2)
```

A number applies from the `lg` breakpoint. You may also pass an object to set the number of columns at various breakpoints, such as `grid({ default: 1, md: 2, xl: 3 })`.

## Removing the styled container

By default, each item in a repeatable entry is wrapped in a container styled as a card. You may remove the styled container using `contained()`:

```ts
import { RepeatableEntry } from '@navette-js/infolists';

RepeatableEntry.make('comments')
    .schema(() => [
        // ...
    ])
    .contained(false)
```

## Table repeatable layout

You can present repeatable items in a table format using the `table()` method, which accepts an array of `TableColumn` objects. These objects represent the columns of the table, which correspond to the entries of the schema, in the same order:

```ts
import { IconEntry, RepeatableEntry, TableColumn, TextEntry } from '@navette-js/infolists';

RepeatableEntry.make('expenseLines')
    .table([
        TableColumn.make('Description'),
        TableColumn.make('Quantity').width(100),
        TableColumn.make('Amount').width(120),
        TableColumn.make('Date').width(150),
        TableColumn.make('Refunded').width(100),
    ])
    .schema(() => [
        TextEntry.make('description'),
        TextEntry.make('quantity').numeric(),
        TextEntry.make('amount').money('usd'),
        TextEntry.make('date').date(),
        IconEntry.make('refunded').boolean(),
    ])
```

```preview
// record: {"expenseLines": [{"description": "Train ticket", "quantity": 1, "amount": 89.5, "date": "2025-03-04", "refunded": true}, {"description": "Hotel night", "quantity": 2, "amount": 240, "date": "2025-03-04", "refunded": true}, {"description": "Team dinner", "quantity": 1, "amount": 64.2, "date": "2025-03-05", "refunded": false}]}
// viewport: 1100
RepeatableEntry.make('expenseLines')
    .table([
        TableColumn.make('Description'),
        TableColumn.make('Quantity').width(100),
        TableColumn.make('Amount').width(120),
        TableColumn.make('Date').width(150),
        TableColumn.make('Refunded').width(100),
    ])
    .schema(() => [
        TextEntry.make('description'),
        TextEntry.make('quantity').numeric(),
        TextEntry.make('amount').money('usd'),
        TextEntry.make('date').date(),
        IconEntry.make('refunded').boolean(),
    ])
```

The labels displayed in the header of the table are passed to the `TableColumn.make()` method, and the labels of the entries themselves are hidden in the cells. Components beyond the number of columns are not rendered, and a hidden entry leaves an empty cell. The `TableColumn` class of `@navette-js/forms` is also accepted.

If you want to provide an accessible label for a column but do not wish to display it, you can use the `hiddenHeaderLabel()` method:

```ts
import { TableColumn } from '@navette-js/infolists';

TableColumn.make('Name')
    .hiddenHeaderLabel()
```

You can enable wrapping of the column header using the `wrapHeader()` method:

```ts
import { TableColumn } from '@navette-js/infolists';

TableColumn.make('Name')
    .wrapHeader()
```

You can also adjust the alignment of the column header using the `alignment()` method, passing `'start'`, `'center'` or `'end'`, or with the `alignStart()`, `alignCenter()` and `alignEnd()` methods:

```ts
import { TableColumn } from '@navette-js/infolists';

TableColumn.make('Name')
    .alignment('center')
```

You can set a fixed column width using the `width()` method. A number is a width in pixels; a string must be a CSS length in `px`, `rem`, `em`, `%`, `vh`, `vw` or `ch`, which is set in the `style` attribute of the column header. Any other value is ignored:

```ts
import { TableColumn } from '@navette-js/infolists';

TableColumn.make('Name')
    .width('200px')
```

The repeatable entry has its own label above the table. When it is the only entry of a section, you may hide it with `hiddenLabel()`:

```ts
import { RepeatableEntry, TableColumn, TextEntry } from '@navette-js/infolists';
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
Not available in Navette yet: limiting item processing (`maxItemsForProcessing()`).
</Aside>
