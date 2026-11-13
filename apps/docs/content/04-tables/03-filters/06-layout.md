---
title: Filter layout
---

## Introduction

By default, filters are displayed in a dropdown, opened by the filter button of the table's toolbar. In the dropdown and in the modal, filters are stacked in a single column.

## Displaying filters above the table content

To render the filters above the table content, in a section that the user can collapse and expand, pass the `'above-content-collapsible'` layout to `filters()`:

```ts
import { SelectFilter, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filters([
            SelectFilter.make('status').options(STATUSES),
            // ...
        ], { layout: 'above-content-collapsible' });
}
```

You may also set the layout separately with `filtersLayout()`:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filtersLayout('above-content-collapsible');
}
```

This layout gives the filters more room, which is useful for the [query builder](/tables/filters/query-builder).

## Positioning filters into grid columns

Above and below the table content, filters are arranged in a responsive grid: 2 columns from the `sm` breakpoint, 3 from `lg`, 4 from `xl` and 5 from `2xl`. Each filter takes one column, except the query builder, which takes the full width.

A built-in filter may span more columns with `columnSpan()` or `columnSpanFull()`; a [filter object](/tables/filters/custom#writing-a-filter-object) by implementing `getColumnSpan()`.

## Changing the number of columns

To change the number of columns that filters may occupy, use `filtersFormColumns()`. It takes a number, or an object of columns per breakpoint:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filters([
            // ...
        ])
        .filtersFormColumns(3);
}
```

## Controlling the width of the filters dropdown

`filtersFormWidth()` sets the width of the dropdown, the modal or the side panel: `'xs'` (the default for the dropdown), `'sm'`, `'md'`, `'lg'`, `'xl'`, `'2xl'` up to `'7xl'`, `'full'` or `'screen'`. Any other value is ignored:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filtersFormWidth('4xl');
}
```

## Controlling the maximum height of the filters dropdown

`filtersFormMaxHeight()` limits the height of the dropdown, which scrolls beyond. It takes a CSS length in `rem`, `px`, `em`, `vh` or `%`:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filtersFormMaxHeight('400px');
}
```

## Displaying filters in a modal

To render the filters in a modal instead of in a dropdown, use the `'modal'` layout. "Apply" closes the modal:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filtersLayout('modal');
}
```

## Displaying filters below the table content

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filtersLayout('below-content');
}
```

## Displaying filters beside the table content

The `'before-content'` and `'after-content'` layouts display the filters in a column to the left or to the right of the table on large screens; on small screens, the filter button opens them. The `'before-content-collapsible'` and `'after-content-collapsible'` variants are closed until the user clicks the filter button:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filtersLayout('before-content-collapsible');
}
```

`'above-content'` displays the filters above the table, always open.

## Customizing the filter form schema

`filtersFormSchema()` lets you arrange the filters form with [layout components](/schemas/layouts), such as sections. The function receives the form group of each filter, keyed by filter name:

```ts
import { Section } from '@navette-js/schemas';
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filters([
            SelectFilter.make('status').options(STATUSES),
            Filter.make('is_featured'),
            SelectFilter.make('author').relationship('author', 'name'),
        ])
        .filtersFormSchema((filters) => [
            Section.make('Visibility')
                .schema([filters.status, filters.is_featured])
                .columns(2)
                .columnSpanFull(),
            filters.author,
        ]);
}
```

A filter left out of the schema is not displayed, but it still exists: it keeps its default value and can be applied by its indicator.
