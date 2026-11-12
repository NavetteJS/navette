---
title: Checkbox column
---

## Introduction

The checkbox column allows you to render a checkbox inside the table, which can be used to update that database record without needing to open a new page or a modal:

```ts
import { CheckboxColumn } from '@navette-js/tables';

CheckboxColumn.make('is_admin')
```

The checkbox is checked when the state is truthy (`true` or `1`). When the user clicks it, `true` or `false` is sent to the server, validated with the `boolean` rule, and written to the record's attribute with the column's name.

## Disabling the column

You may disable the checkbox for some records, by passing a function that receives the record to `disabled()`:

```ts
import { CheckboxColumn } from '@navette-js/tables';

CheckboxColumn.make<User>('is_admin')
    .disabled((record) => record.id === currentUserId())
```

The condition is checked again on the server before saving.

## Lifecycle hooks

Hooks may be used to execute code at various points within the checkbox's lifecycle. They receive an object with the new `state` (`true` or `false`) and the `record`:

```ts
import { CheckboxColumn } from '@navette-js/tables';

CheckboxColumn.make('is_admin')
    .beforeStateUpdated(({ record, state }) => {
        // Runs before the state is saved to the database.
    })
    .afterStateUpdated(({ record, state }) => {
        // Runs after the state is saved to the database.
    })
```

[Validation rules](/tables/columns/text-input#validation), [tooltips](/tables/columns/text-input#adding-a-tooltip) and [`updateStateUsing()`](/tables/columns/text-input#customizing-how-the-state-is-saved) work as for the other editable columns.

## Security

### Authorization

On a resource's list page, a relation manager or a related-record page, Navette checks the `update` ability of the resource's [policy](/resources/overview) for the record before saving, as well as the column's visibility, the record's scope and the [`disabled()`](#disabling-the-column) condition.

The `update` ability covers the whole record. If only some users may change this particular attribute, add that check with `disabled()`.
