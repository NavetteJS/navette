---
title: Toggle column
---

## Introduction

The toggle column allows you to render a toggle button inside the table, which can be used to update that database record without needing to open a new page or a modal:

```ts
import { ToggleColumn } from '@navette-js/tables';

ToggleColumn.make('is_admin')
```

The toggle is on when the state is truthy (`true` or `1`). When the user switches it, `true` or `false` is sent to the server, validated with the `boolean` rule, and written to the record's attribute with the column's name. With SQLite, convert booleans to `1` and `0` in the model's `$formatDatabaseJson()` if the driver does not do it for you.

## Customizing the colors

By default, the toggle uses the `primary` color when it is on, and `gray` when it is off. You may change them with `onColor()` and `offColor()`:

```ts
import { ToggleColumn } from '@navette-js/tables';

ToggleColumn.make('is_active')
    .onColor('success')
    .offColor('danger')
```

## Adding icons to the toggle button

You may display an [icon](/styling/icons) inside the toggle button, for each state:

```ts
import { ToggleColumn } from '@navette-js/tables';

ToggleColumn.make('is_visible')
    .onIcon('m-eye')
    .offIcon('m-eye-slash')
```

## Disabling the column

You may disable the toggle for some records, by passing a function that receives the record to `disabled()`:

```ts
import { ToggleColumn } from '@navette-js/tables';

ToggleColumn.make<Post>('is_featured')
    .disabled((record) => record.author_id !== currentUserId())
```

The condition is checked again on the server before saving.

## Adding a tooltip

You may display a tooltip when the user hovers the toggle. Pass a string, or a function that receives the record:

```ts
import { ToggleColumn } from '@navette-js/tables';

ToggleColumn.make('is_visible')
    .tooltip('Show this product in the store')
```

A validation error replaces the tooltip while it is displayed.

## Lifecycle hooks

Hooks may be used to execute code at various points within the toggle's lifecycle. They receive an object with the new `state` (`true` or `false`) and the `record`:

```ts
import { ToggleColumn } from '@navette-js/tables';

ToggleColumn.make('is_admin')
    .beforeStateUpdated(({ record, state }) => {
        // Runs before the state is saved to the database.
    })
    .afterStateUpdated(({ record, state }) => {
        // Runs after the state is saved to the database.
    })
```

[Validation rules](/tables/columns/text-input#validation) and [`updateStateUsing()`](/tables/columns/text-input#customizing-how-the-state-is-saved) work as for the other editable columns.

## Security

### Authorization

On a resource's list page, a relation manager or a related-record page, Navette checks the `update` ability of the resource's [policy](/resources/overview) for the record before saving, as well as the column's visibility, the record's scope and the [`disabled()`](#disabling-the-column) condition.

The `update` ability covers the whole record. If only some users may change this particular attribute, add that check with `disabled()`.
