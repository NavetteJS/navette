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

<Aside variant="warning">
Multi-select filters, relationship filters with search and preloading (`relationship()`, `searchable()`, `preload()`), filtering empty relationships, disabling the placeholder option and default values are not available yet. For more complex conditions, use the [query builder](/tables/filters/query-builder) or a [custom filter](/tables/filters/custom).
</Aside>
