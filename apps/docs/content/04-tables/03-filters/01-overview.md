---
title: Overview
---

## Introduction

Filters allow you to define certain constraints on your data, and allow users to scope it to find the information they need. You put them in the `filters()` method of the table:

```ts
import { SelectFilter, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filters([
            SelectFilter.make('status')
                .options({
                    draft: 'Draft',
                    reviewing: 'Reviewing',
                    published: 'Published',
                }),
        ]);
}
```

A "filter" icon button appears in the toolbar of the table, with a badge counting the active filters. Clicking it opens a dropdown with the form of each filter.

Filters can also have a form of their own, built with [form components](/forms/overview), and a function that applies their values to the query:

```ts
import { DatePicker } from '@navette-js/forms';
import { Filter } from '@navette-js/tables';

const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

Filter.make('created_at')
    .schema([
        DatePicker.make('created_from'),
        DatePicker.make('created_until'),
    ])
    .query((query, data) => {
        if (isDate(data.created_from)) query.where('created_at', '>=', `${data.created_from} 00:00:00`);
        if (isDate(data.created_until)) query.where('created_at', '<=', `${data.created_until} 23:59:59`);
    })
```

## Available filters

Navette includes these filters:

- [Select filter](/tables/filters/select): records whose column has the chosen value.
- [Ternary filter](/tables/filters/ternary): all records, records where a boolean column is true, or records where it is false. The trashed filter is a ternary filter for soft-deleted records.
- [Query builder](/tables/filters/query-builder): rules composed by the user, combined with "and" and "or".
- [Custom filters](/tables/filters/custom): a form of your choice and a function that applies its values to the query.

You may also [write a filter object](/tables/filters/custom#writing-a-filter-object) from scratch.

## Setting a label

By default, the label of the filter is generated from its name: underscores, dots and hyphens become spaces, and the first letter is capitalized (`is_active` gives "Is active"). You may customize the label using the `label()` method:

```ts
import { TernaryFilter } from '@navette-js/tables';

TernaryFilter.make('is_active')
    .label('Active')
```

## Applying filters

The user changes the values of the filters in the form, then clicks the "Apply" button. Until then, the table does not change: filters are always deferred, as with Filament's `deferFilters()`. Applying the filters returns the table to its first page.

The "Reset" link in the filters form clears all filters at once. The `deferFilters()` method of the table exists for compatibility with Filament's API, and has no effect.

<Aside variant="warning">
Live filters (applied as soon as a value changes), default filter values, persisting filters in the session and customizing the filter trigger, apply and reset actions are not available yet.
</Aside>

## Active filter indicators

When filters are applied, the badge of the filters button shows how many are active. Some filters also display indicators above the table, one for each value applied, which the user can remove individually:

- the [query builder](/tables/filters/query-builder) displays a summary of each rule;
- a [custom filter](/tables/filters/custom#active-indicators) displays the indicators returned by its `indicateUsing()` function, or its label if it has none.

Select, ternary and trashed filters are counted in the badge, but do not display indicators yet.

## Positioning filters

By default, filters are displayed in a dropdown. You may also display them above the table, in a collapsible section. See [filter layout](/tables/filters/layout).

## Security

The values of the filters come from the browser. Each built-in filter only keeps the values it knows:

- a select filter with fixed options ignores a value that is not one of the options;
- a ternary filter only reacts to `'1'` and `'0'`;
- a custom filter only keeps the fields of its form, as strings, numbers or booleans;
- the query builder only keeps rules for its declared constraints and operators.

Values are passed to the database as bound parameters. In your own `query()` functions, do the same: use `query.where(column, value)` or `whereRaw('... ?', [value])`, never string concatenation, and only use column names that you wrote yourself.

<Aside variant="danger">
Filters are not an access control mechanism: the user can remove them. To restrict which records a user may see, scope the data adapter of the table, for example with the `modify` option of `ObjectionAdapter`.
</Aside>
