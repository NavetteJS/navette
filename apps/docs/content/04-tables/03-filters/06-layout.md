---
title: Filter layout
---

## Introduction

By default, filters are displayed in a dropdown, opened by the filter button of the table's toolbar. In the dropdown, filters are stacked in a single column.

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

Above the table content, filters are arranged in a responsive grid: 2 columns from the `sm` breakpoint, 3 from `lg`, 4 from `xl` and 5 from `2xl`. Each filter takes one column, except the query builder, which takes the full width.

A [filter object](/tables/filters/custom#writing-a-filter-object) may span more columns by implementing `getColumnSpan()`.

<Aside variant="warning">
Displaying filters in a modal, below the table content, or to the left or right of it, hiding the filter indicators, and customizing the width, maximum height, number of columns and form schema of the filters are not available yet. The filter layouts available are `'dropdown'` (the default) and `'above-content-collapsible'`.
</Aside>
