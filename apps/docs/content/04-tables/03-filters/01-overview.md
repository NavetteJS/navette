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

## Setting a default value

You may set a default value for a filter with `default()`. It is applied when the table opens, and again when the user clicks "Reset":

```ts
import { SelectFilter, TernaryFilter } from '@navette-js/tables';

SelectFilter.make('status')
    .options(STATUSES)
    .default('draft')

TernaryFilter.make('is_active')
    .default(true)
```

Removing the filter's indicator, or clicking "Remove all", clears the filter instead of restoring its default.

## Hiding a filter

`hidden()` removes a filter from the table: its field, its query and its indicator. It accepts a condition or a function, and `visible()` does the contrary:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('owner')
    .options(OWNERS)
    .visible(() => currentUserIsAdmin())
```

A hidden filter is left out of the state the browser can apply: a forged request cannot use it. `table.getFilters()` returns the visible filters, `table.getFilters(true)` all of them, and `table.getFilter(name)` one of them.

## Applying filters

By default, the user changes the values of the filters in the form, then clicks the "Apply" button. Until then, the table does not change. Applying the filters returns the table to its first page. The "Reset" link restores the [default values](#setting-a-default-value) of all filters.

### Applying filters as soon as they change

You may apply filters as soon as a field changes, without the "Apply" button, with `deferFilters(false)`:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filters([
            // ...
        ])
        .deferFilters(false);
}
```

Every change sends a request to the server and reloads the table. Keep deferred filters for slow queries, or for forms with text fields.

### Resetting and refreshing the table from code

From an action or a method of the table's page, `this.resetTableFiltersForm()` (or `livewire.resetTableFiltersForm()` in an action's function) restores the default values of all filters, as the "Reset" link does, and returns the table to its first page. Navette keeps no cache of the records: every request renders the table again from a fresh query, so there is no `resetTable()` to call after changing records. To reload the table from the browser without changing anything, dispatch Livewire's `$refresh` (`wire:click="$refresh"`, or `$wire.$refresh()` in Alpine).

## Persisting filters in the user's session

To keep the applied filters when the user leaves the page and comes back, use `persistFiltersInSession()`. `persistSearchInSession()`, `persistColumnSearchesInSession()` and `persistSortInSession()` do the same for the search, the column searches and the sort:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filters([
            // ...
        ])
        .persistFiltersInSession()
        .persistSearchInSession();
}
```

The state is kept per browser and per user, and restored values are cleaned like values coming from the browser. By default, it is kept in the server's memory: it is lost when the server restarts, and it is not shared between several server processes. To keep it elsewhere, give the panel a store with `sessionStore()`:

```ts
import { Panel, type SessionStore } from '@navette-js/panels';

const store: SessionStore = {
    get: (session, key) => cache.get(`${session}:${key}`),
    set: (session, key, value) => cache.set(`${session}:${key}`, value),
};

Panel.make()
    .sessionStore(store)
```

## Customizing the filters actions

`filtersTriggerAction()`, `filtersApplyAction()` and `filtersResetAction()` customize the button that opens the filters, the "Apply" button and the "Reset" button. Each receives a `FiltersAction` with `label()`, `icon()`, `color()`, `button()`, `link()`, `iconButton()` and `hidden()`:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .filters([
            // ...
        ])
        .filtersTriggerAction((action) => action.button().label('Filter'))
        .filtersApplyAction((action) => action.label('Show results'))
        .filtersResetAction((action) => action.hidden());
}
```

You may also move the "Reset" button next to "Apply" with `filtersResetActionPosition('footer')`.

`filtersRemoveAllAction()` customizes the "Remove all filters" button displayed next to the [active filter indicators](#active-filter-indicators) in the same way (an icon button by default; `hidden()` removes it):

```ts
table.filtersRemoveAllAction((action) => action.button().label('Clear filters'))
```

## Customizing the filter's form field

Built-in filters build their form field themselves: a select for `SelectFilter` and `TernaryFilter`, a checkbox (or toggle) for a `Filter` without schema. `modifyFormFieldUsing()` receives that field to change it, for example to use the JavaScript select:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('status')
    .options(STATUSES)
    .modifyFormFieldUsing((field) => field.native(false).placeholder('Any status'))
```

The function may return the field, or nothing.

## Modifying the base query

`query()` adds the filter's conditions, grouped with the other filters'. `baseQuery()` changes the table's base query instead, whatever the filter's state (except an unchecked checkbox filter), for example to include soft-deleted records or join a table that the filter's conditions need:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('country')
    .options(COUNTRIES)
    .baseQuery((query) => query.leftJoin('addresses', 'addresses.customer_id', 'customers.id').select('customers.*'))
    .query((query, data) => { if (data.value) query.where('addresses.country', data.value); })
```

## Resolving records outside the filters

As in Filament, when a row action (or a column action) runs, its record must still match the applied filters: a record that no longer matches, for example because another user changed it, is not found. `excludeWhenResolvingRecord()` leaves a filter out of that check, typically for a filter on a value that the action itself changes:

```ts
import { Filter } from '@navette-js/tables';

Filter.make('in_stock')
    .query((query) => query.where('qty', '>', 0))
    .excludeWhenResolvingRecord()
```

The query builder accepts `excludeWhenResolvingRecord()` too.

## Keeping the selection when filtering

By default, changing the filters, the search or the column searches clears the selected records, and the selected records are restricted to the filtered records. `deselectAllRecordsWhenFiltered(false)` keeps the selection instead, as in Filament: the user can select records, search for others and add them to the selection. "Select all" then selects the listed keys (the deselected records are not tracked):

```ts
table.deselectAllRecordsWhenFiltered(false)
```

## Active filter indicators

When filters are applied, the badge of the filters button shows how many are active, and indicators are displayed above the table, which the user can remove individually:

- a select filter displays its label and the selected options, such as "Status: Draft & Published";
- a ternary filter displays its label and the selected option, such as "Is active: Yes"; the trashed filter displays the selected option;
- the [query builder](/tables/filters/query-builder) displays a summary of each rule;
- a [custom filter](/tables/filters/custom#active-indicators) displays its label, or the indicators returned by its `indicateUsing()` function.

You may change the label shown before the value with `indicator()`:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('author_id')
    .options(AUTHORS)
    .indicator('Author')
```

To hide the indicators, use `hiddenFilterIndicators()` on the table. The "Remove all" button clears every removable filter, the search and the column searches; customize it with [`filtersRemoveAllAction()`](#customizing-the-filters-actions).

## Positioning filters

By default, filters are displayed in a dropdown. You may also display them in a modal, or in a section above, below or beside the table. See [filter layout](/tables/filters/layout).

## Security

The values of the filters come from the browser. Each built-in filter only keeps the values it knows:

- a select filter with fixed options ignores a value that is not one of the options;
- a ternary filter only reacts to `'1'` and `'0'`;
- a custom filter only keeps the fields of its form, as strings, numbers or booleans; a filter without form only keeps its checkbox, as a boolean;
- the query builder only keeps rules for its declared constraints and operators.

Values are passed to the database as bound parameters. In your own `query()` functions, do the same: use `query.where(column, value)` or `whereRaw('... ?', [value])`, never string concatenation, and only use column names that you wrote yourself.

<Aside variant="danger">
Filters are not an access control mechanism: the user can remove them. To restrict which records a user may see, scope the data adapter of the table, for example with the `modify` option of `ObjectionAdapter`.
</Aside>
