---
title: Select filter
---

## Introduction

Often, you will want to use a select field instead of a checkbox. This is especially true when you want to filter a column based on a set of pre-defined options that the user can choose from. To do this, you can create a filter using the `SelectFilter` class:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('status')
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
```

The options that are passed to `options()` are the values the user can choose from, and their labels. They may also be an array of `[value, label]` pairs:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make<Employee>('employment_type')
    .options(Object.entries(EMPLOYMENT_TYPES).map(([value, type]): [string, string] => [value, type.label]))
```

When an option is selected and the filters are applied, only the records whose `status` column equals the selected value are listed. The empty option, "All", removes the filter.

## Customizing the column used by a select filter

Select filters do not require their name to match the name of the column you want to filter. You can use the `column()` method to specify a different column:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('department')
    .column('department_id')
    .options(departmentOptions)
```

This is useful to give the filter a meaningful name and label ("Department") while filtering on a foreign key.

## Loading options from the database

Instead of fixed options, you may pass an asynchronous function that returns `[value, label]` pairs. It is called each time the filters form is rendered:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('department')
    .column('department_id')
    .options(async () => {
        const departments = await Department.query().whereNull('deleted_at').orderBy('name').select('id', 'name');

        return departments.map((department): [string, string] => [String(department.id), department.name]);
    })
```

This is how you filter records by a related record, such as the department of an employee: the filter compares the foreign key column with the selected key.

<Aside variant="info">
With fixed options, a value that is not one of the options is ignored. With a function, options are not reloaded when the filter is applied: the received value is used as a bound parameter, so an unknown value simply matches no records. Do not rely on the options of a select filter to hide records from a user; [scope the data adapter](/tables/filters/overview#security) instead.
</Aside>

## Multi-select filter

You may allow the user to select multiple options by adding `multiple()`. Records matching any of the selected options are listed:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('status')
    .multiple()
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
```

The state of a multi-select filter is `{ values: [...] }` instead of `{ value }`. At most 100 values are kept.

## Searching options

`searchable()` adds a search field to the select, which is useful for long lists of options:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('country')
    .options(COUNTRIES)
    .searchable()
```

`preload()` is accepted for compatibility: options are always loaded with the form.

## Disable placeholder selection

You can remove the empty option from the select with `selectablePlaceholder(false)`, and change its label with `placeholder()`:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('status')
    .options(STATUSES)
    .default('draft')
    .selectablePlaceholder(false)
```

## Applying the select filter by default

You may set the option selected by default with `default()`, or several options for a multi-select filter:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('status')
    .options(STATUSES)
    .multiple()
    .default(['draft', 'reviewing'])
```

## Customizing the query

To filter on something else than the equality of a column, pass a function to `query()`. It is called with the query and the cleaned data when an option is selected:

```ts
import { SelectFilter } from '@navette-js/tables';

SelectFilter.make('price_range')
    .options({ low: 'Under $50', high: '$50 and more' })
    .query((query, data) => {
        if (data.value === 'low') query.where('price', '<', 5000);
        if (data.value === 'high') query.where('price', '>=', 5000);
    })
```

With fixed options, only offered options reach `query()`.

<Aside variant="warning">
Relationship filters (`relationship()`) and filtering empty relationships are not available yet: load the options of the related records with a function, as described above.
</Aside>
