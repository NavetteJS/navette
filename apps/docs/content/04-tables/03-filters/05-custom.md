---
title: Custom filters
---

## Introduction

When the [built-in filters](/tables/filters/overview#available-filters) are not enough, you may build a filter with a form of your own, or write a filter object from scratch.

## Checkbox filters

The simplest filter is a checkbox: without `schema()`, a `Filter` displays a checkbox labelled with the filter's label, and calls `query()` when it is checked:

```ts
import { Filter } from '@navette-js/tables';

Filter.make('is_featured')
    .query((query) => query.where('is_featured', 1))
```

### Using a toggle button instead of a checkbox

```ts
import { Filter } from '@navette-js/tables';

Filter.make('is_featured')
    .toggle()
    .query((query) => query.where('is_featured', 1))
```

### Applying the checkbox filter by default

```ts
import { Filter } from '@navette-js/tables';

Filter.make('is_featured')
    .default()
    .query((query) => query.where('is_featured', 1))
```

## Custom filter schemas

You may use [form fields](/forms/overview) to create custom filters using the `schema()` method of a `Filter`. The data from the custom filter form is available in the `data` object passed to the `query()` function, along with the query of the table:

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

With `ObjectionAdapter`, `query` is the Objection query builder of the table's list query, with the data adapter's scope already applied. Add conditions to it; do not remove existing ones.

### Understanding the filter's data

`data` contains one key for each field of the schema, named after the field. Before it reaches `query()`, Navette cleans the data received from the browser:

- keys that are not the name of a field of `schema()` are dropped;
- values that are not a string, a number or a boolean, and empty strings, become `null`.

The filter is active, and `query()` is called, when at least one value is neither `null` nor `false` (an unchecked checkbox). Even so, check each value before using it, as in the `isDate()` test above: a date field may receive any string from a forged request.

The `default()` values of the fields are applied when the table opens, and when the user clicks "Reset".

<Aside variant="warning">
Put the fields directly in `schema()`: fields nested in layout components are not read. Fields whose value is an array, such as a multiple select or a checkbox list, are not supported yet.
</Aside>

## Active indicators

When a filter is active, an indicator is displayed above the table content to signal that the table query has been scoped. By default, the label of the filter is used as the indicator, and removing it clears all the fields of the filter. You may change it with `indicator()`:

```ts
import { Filter } from '@navette-js/tables';

Filter.make('is_featured')
    .indicator('Featured')
```

### Custom active indicators

Not all indicators are simple, so you may use `indicateUsing()` to customize which indicators should be shown at any time. The function receives the cleaned data and returns an object whose keys are field names and whose values are the indicator labels:

```ts
import { DatePicker } from '@navette-js/forms';
import { Filter } from '@navette-js/tables';

const formatDate = (date: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

Filter.make('created_at')
    .schema([DatePicker.make('date')])
    // ...
    .indicateUsing((data) => (isDate(data.date) ? { date: `Created on ${formatDate(data.date)}` } : {}))
```

An empty object displays no indicator. Indicator labels are escaped.

### Multiple active indicators

You may render multiple indicators at once by returning several keys. Each key is the field that is cleared when the user removes that indicator:

```ts
import { DatePicker } from '@navette-js/forms';
import { Filter } from '@navette-js/tables';

Filter.make('created_at')
    .schema([
        DatePicker.make('from'),
        DatePicker.make('until'),
    ])
    // ...
    .indicateUsing((data) => ({
        ...(isDate(data.from) ? { from: `Created from ${formatDate(data.from)}` } : {}),
        ...(isDate(data.until) ? { until: `Created until ${formatDate(data.until)}` } : {}),
    }))
```

The badge of the filters button counts the indicators of each filter.

### Preventing indicators from being removed

`indicateUsing()` may also return `Indicator` objects, or a list of them. An indicator may be made non-removable with `removable(false)`, and colored with `color()`:

```ts
import { Filter, Indicator } from '@navette-js/tables';

Filter.make('created_at')
    // ...
    .indicateUsing((data) => (isDate(data.from)
        ? Indicator.make(`Created from ${formatDate(data.from)}`).removable(false)
        : null))
```

A filter showing a non-removable indicator is also kept when the server receives a forged removal request, and "Remove all" leaves it in place. `removeField()` sets the field cleared when an `Indicator` is removed.

## Writing a filter object

Every filter is an object that implements the `TableFilter` interface of `@navette-js/tables`. You may write one yourself, for a filter that does not fit the built-in classes. Without its own form, a filter object is displayed as a select field named `value`, with the options returned by `getFormDefinition()`:

```ts
import { type TableFilter } from '@navette-js/tables';

const today = () => new Date().toISOString().slice(0, 10);

export const overdue: TableFilter = {
    name: 'overdue',
    getLabel: () => 'Deadline',
    getDefaultState: () => ({ value: null }),
    getFormDefinition: () => ({ placeholder: 'All tasks', options: [['1', 'Overdue'], ['0', 'On time']] }),
    isActive: (state) => state.value === '1' || state.value === '0',
    apply: (query, state) => {
        if (state.value === '1') (query.modifiers ??= []).push((builder) => { builder.where('due_date', '<', today()).where('is_done', 0); });
        if (state.value === '0') (query.modifiers ??= []).push((builder) => { builder.where('due_date', '>=', today()); });
    },
};
```

`apply()` receives the list query of the table, and the filter's state. It adds conditions by pushing functions to `query.modifiers`: the data adapter calls each of them with its query builder, an Objection query builder for `ObjectionAdapter`.

<Aside variant="danger">
The state of a filter object comes from the browser. Only the keys of `getDefaultState()` are kept, but their values are not cleaned: compare them with known values, as above, and pass any free value to the database as a bound parameter, never by concatenation.
</Aside>

A filter object may also implement these optional methods:

| Method | Purpose |
|---|---|
| `getFormComponents()` | Form fields, displayed instead of the select. Their state is stored under the filter's name. |
| `sanitizeState(state)` | Cleans the form state received from the browser when the filters are applied. |
| `getIndicators(state)` | Returns `{ label, field, removable?, color? }` indicators displayed above the table. |
| `getResetState()` | State after the filter is removed; `getDefaultState()` is used when it is missing. |
| `removeIndicator(state, field)` | Returns the new state when the user removes the indicator of `field`. |
| `getFormOptions()` | Loads the options of the select asynchronously, instead of `getFormDefinition().options`. |
| `getColumnSpan()` | Number of columns of the filters form that the filter spans, such as `{ default: 'full' }`. |
