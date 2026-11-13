---
title: Summaries
---

## Introduction

You may render a "summary" section below your table content. This is great for displaying the results of calculations such as averages, sums, counts and ranges of the data in your table.

By default, there will be a single summary line for the current page of data, and an additional summary line for the totals for all data if multiple pages are available. With a single page, one "Summary" line is displayed.

You may add summaries to [text columns](/tables/columns/text) using the `summarize()` method:

```ts
import { Average, TextColumn } from '@navette-js/tables';

TextColumn.make('rating')
    .summarize(Average.make())
```

```preview
// records: [{"name": "Wireless keyboard", "rating": 4.5}, {"name": "USB-C hub", "rating": 3.8}, {"name": "27-inch monitor", "rating": 4.9}, {"name": "Laptop stand", "rating": 4.2}]
new Table()
    .pluralModelLabel('products')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('rating')
            .summarize(Average.make()),
    ])
```

Multiple "summarizers" may be added to the same column:

```ts
import { Average, Range, TextColumn } from '@navette-js/tables';

TextColumn.make('rating')
    .numeric()
    .summarize([
        Average.make(),
        Range.make(),
    ])
```

```preview
// records: [{"name": "Wireless keyboard", "rating": 4.5}, {"name": "USB-C hub", "rating": 3.8}, {"name": "27-inch monitor", "rating": 4.9}, {"name": "Laptop stand", "rating": 4.2}]
new Table()
    .pluralModelLabel('products')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('rating')
            .numeric()
            .summarize([
                Average.make(),
                Range.make(),
            ]),
    ])
```

<Aside variant="info">
The first column in a table may not use summarizers. That column is used to render the heading and subheading/s of the summary section.
</Aside>

The totals for all data are computed by the data adapter, with SQL aggregates over the table's query: the current search, filters and tab apply, but not pagination. The totals for the current page are computed from the records displayed.

## Available summarizers

Navette ships with four types of summarizer:

- [Average](#average)
- [Count](#count)
- [Range](#range)
- [Sum](#sum)

Summarizers only apply to text columns.

## Average

Average can be used to calculate the average of all values in the dataset:

```ts
import { Average, TextColumn } from '@navette-js/tables';

TextColumn.make('rating')
    .summarize(Average.make())
```

In this example, all ratings in the table will be added together and divided by the number of ratings. Empty values are not counted.

## Count

Count can be used to find the total number of records in the dataset:

```ts
import { Count, TextColumn } from '@navette-js/tables';

TextColumn.make('employee.name')
    .getStateUsing(({ record }) => record.employee_name ?? null)
    .summarize(Count.make())
```

```preview
// records: [{"title": "Prepare the release notes", "employee_name": "Ada Lovelace"}, {"title": "Review the pull requests", "employee_name": "Grace Hopper"}, {"title": "Update the screenshots", "employee_name": "Alan Turing"}]
new Table()
    .pluralModelLabel('tasks')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('employee.name')
            .getStateUsing(({ record }) => record.employee_name ?? null)
            .summarize(Count.make()),
    ])
```

Count counts records, whatever the value of the column.

<Aside variant="warning">
Counting the occurrence of icons or of specific values (`query()`) is not available yet.
</Aside>

## Range

Range can be used to calculate the minimum and maximum value in the dataset:

```ts
import { Range, TextColumn } from '@navette-js/tables';

TextColumn.make('price')
    .summarize(Range.make())
```

```preview
// records: [{"name": "Wireless keyboard", "price": 79}, {"name": "USB-C hub", "price": 39.9}, {"name": "27-inch monitor", "price": 1249.99}, {"name": "Laptop stand", "price": 45}]
new Table()
    .pluralModelLabel('products')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('price')
            .summarize(Range.make()),
    ])
```

The range is displayed as `minimum - maximum`. Empty values are ignored.

### Date range

You may format the range as dates using the `minimalDateTimeDifference()` method:

```ts
import { Range, TextColumn } from '@navette-js/tables';

TextColumn.make('created_at')
    .dateTime()
    .summarize(Range.make().minimalDateTimeDifference())
```

```preview
// records: [{"number": "ORD-1042", "created_at": "2026-11-09 14:30:00"}, {"number": "ORD-1043", "created_at": "2026-11-10 09:12:45"}, {"number": "ORD-1044", "created_at": "2026-11-11 17:05:10"}]
new Table()
    .pluralModelLabel('orders')
    .columns([
        TextColumn.make('number'),
        TextColumn.make('created_at')
            .dateTime()
            .summarize(Range.make().minimalDateTimeDifference()),
    ])
```

This method will present the minimal difference between the minimum and maximum date. For example:

- If the minimum and maximum dates are different days, only the dates will be displayed.
- If the minimum and maximum dates are on the same day at different times, both the date and time will be displayed.
- If the minimum and maximum dates and times are identical, they will only appear once.

<Aside variant="warning">
On the current page's summary line, minimum and maximum values are compared as text, which suits dates and strings. The line for all data uses SQL `MIN()` and `MAX()`.
</Aside>

## Sum

Sum can be used to calculate the total of all values in the dataset:

```ts
import { Sum, TextColumn } from '@navette-js/tables';

TextColumn.make('price')
    .summarize(Sum.make())
```

```preview
// records: [{"name": "Wireless keyboard", "price": 79}, {"name": "USB-C hub", "price": 39.9}, {"name": "27-inch monitor", "price": 1249.99}, {"name": "Laptop stand", "price": 45}]
new Table()
    .pluralModelLabel('products')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('price')
            .summarize(Sum.make()),
    ])
```

In this example, all prices in the table will be added together.

## Setting a label

You may set a summarizer's label using the `label()` method:

```ts
import { Sum, TextColumn } from '@navette-js/tables';

TextColumn.make('hours')
    .numeric(1)
    .summarize([
        Sum.make().label('Total'),
    ])
```

```preview
// records: [{"task": "Design review", "hours": 2.5}, {"task": "Client call", "hours": 1}, {"task": "Bug fixing", "hours": 4.25}]
new Table()
    .pluralModelLabel('timesheets')
    .columns([
        TextColumn.make('task'),
        TextColumn.make('hours')
            .numeric(1)
            .summarize([
                Sum.make().label('Total'),
            ]),
    ])
```

Sum, Average and Count are labelled "Sum", "Average" and "Count" by default. A range has no label unless you set one.

## Formatting

Values are formatted as numbers, with thousands separators, for the `en-US` locale.

### Currency formatting

The `money()` method allows you to easily format monetary values, in any currency:

```ts
import { Sum, TextColumn } from '@navette-js/tables';

TextColumn.make('total_price')
    .money('usd')
    .summarize(Sum.make().money('usd'))
```

```preview
// records: [{"number": "ORD-1042", "total_price": 129.9}, {"number": "ORD-1043", "total_price": 54}, {"number": "ORD-1044", "total_price": 870.5}]
new Table()
    .pluralModelLabel('orders')
    .columns([
        TextColumn.make('number'),
        TextColumn.make('total_price')
            .money('usd')
            .summarize(Sum.make().money('usd')),
    ])
```

The summarizer does not inherit the column's formatting: set `money()` on the summarizer too.

### Number formatting

`numeric()` sets the number of decimal places:

```ts
import { Average, TextColumn } from '@navette-js/tables';

TextColumn.make('rating')
    .summarize(Average.make().numeric(2))
```

### Custom formatting

`formatStateUsing()` receives the value and returns the text to display (it is escaped):

```ts
import { Sum, TextColumn } from '@navette-js/tables';

TextColumn.make('duration_minutes')
    .summarize(Sum.make().formatStateUsing((minutes) => `${Math.floor(Number(minutes) / 60)} h`))
```

### Adding a prefix or suffix

```ts
import { Sum, TextColumn } from '@navette-js/tables';

TextColumn.make('volume')
    .summarize(Sum.make()
        .prefix('Total volume: ')
        .suffix(' m³'))
```

## Hiding the label

`hiddenLabel()` keeps the label for screen readers only:

```ts
import { Sum, TextColumn } from '@navette-js/tables';

TextColumn.make('price')
    .summarize(Sum.make().hiddenLabel())
```

## Conditionally hiding the summary

`hidden()` and `visible()` accept a boolean or a function, evaluated each time the table is rendered:

```ts
import { Sum, TextColumn } from '@navette-js/tables';

TextColumn.make('salary')
    .summarize(Sum.make().visible(() => currentUser()?.role === 'admin'))
```

## Custom summaries

You may create a custom summary with `Summarizer.make()` and `using()`. The function receives the column name and `records()`, which loads the summarized records: all records of the query, those of the current page, or those of a group:

```ts
import { Summarizer, TextColumn } from '@navette-js/tables';

TextColumn.make('name')
    .summarize(Summarizer.make()
        .label('First last name')
        .using(async ({ records }) => (await records()).map((record) => record.last_name).sort()[0] ?? null))
```

`records()` loads up to 10,000 records: prefer the built-in summarizers, which aggregate in the database, for large tables.

## Values

`Values` lists the distinct values of the column, as a bulleted list (`bulleted(false)` for a plain list):

```ts
import { TextColumn, Values } from '@navette-js/tables';

TextColumn.make('product.brand')
    .summarize(Values.make())
```

## Summarizing a computed column

Summaries are computed on the column of the query that the column [sorts by](/tables/columns/overview#sorting-by-a-different-column). For a column whose state comes from a computed column, set the `column` option of `sortable()`:

```ts
import { Sum, TextColumn } from '@navette-js/tables';

TextColumn.make<Order>('items_count')
    .numeric()
    .sortable({ column: 'items_count' })
    .summarize(Sum.make())
```

## Summarising groups of rows

You can use summaries with [groups](/tables/grouping) to display a summary of the records inside a group. This works automatically if you choose to add a summarizer column to your grouped table. Each group's summary covers all the records of the group, not only those on the current page.

### Hiding the grouped rows and showing the summary only

You may hide the rows inside groups and just show the summary of each group using the `groupsOnly()` method. This is beneficial in many reporting scenarios:

```ts
import { Sum, TextColumn, type Table } from '@navette-js/tables';

static table(table: Table<Timesheet>): Table<Timesheet> {
    return table
        .columns([
            TextColumn.make<Timesheet>('project_name').label('Project'),
            TextColumn.make<Timesheet>('hours').numeric(1).summarize(Sum.make()),
            TextColumn.make<Timesheet>('total_cost').money('usd').summarize(Sum.make().money('usd')),
        ])
        .defaultGroup('project_name')
        .groupsOnly();
}
```

```preview
// records: [{"project_name": "Website redesign", "hours": 6.5, "total_cost": 520}, {"project_name": "Website redesign", "hours": 3, "total_cost": 240}, {"project_name": "Mobile app", "hours": 8, "total_cost": 720}, {"project_name": "Mobile app", "hours": 2.5, "total_cost": 225}, {"project_name": "Data migration", "hours": 4, "total_cost": 380}]
new Table()
    .pluralModelLabel('timesheets')
    .columns([
        TextColumn.make('project_name').label('Project'),
        TextColumn.make('hours').numeric(1).summarize(Sum.make()),
        TextColumn.make('total_cost').money('usd').summarize(Sum.make().money('usd')),
    ])
    .defaultGroup('project_name')
    .groupsOnly()
```

Each line starts with the group's title, in the cell of the column that has the group's name, followed by the group's summaries. Name that column after the group's column, as above, so that the cells line up with the headers. The table is not paginated, and up to 1,000 records are read to build the groups.

<Aside variant="warning">
Scoping the dataset of a summarizer (`query()`) and hiding summary rows are not available yet.
</Aside>
