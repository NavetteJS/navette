---
title: Select column
---

## Introduction

The select column allows you to render a select field inside the table, which can be used to update that database record without needing to open a new page or a modal.

You must pass options to the column:

```ts
import { SelectColumn } from '@navette-js/tables';

SelectColumn.make('status')
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
```

Options may be an object of `{ value: label }` pairs, or an array of `[value, label]` pairs, which keeps the order of numeric keys:

```ts
import { SelectColumn } from '@navette-js/tables';

SelectColumn.make<LeaveRequest>('status')
    .options(Object.entries(LEAVE_STATUSES).map(([value, status]): [string, string] => [value, status.label]))
```

When the user picks an option, the new value is sent to the server, [validated](#validation), and written to the record's attribute with the column's name. The select is disabled while the value is saved, and a validation error is displayed in a tooltip.

<Aside variant="warning">
The select column renders a native HTML select. A JavaScript select, searchable options, relationship options, HTML option labels and disabled options are not available yet.
</Aside>

## Disable placeholder selection

You can prevent the placeholder (empty option) from being selected using the `selectablePlaceholder(false)` method:

```ts
import { SelectColumn } from '@navette-js/tables';

SelectColumn.make('status')
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
    .selectablePlaceholder(false)
```

This only removes the empty option from the select. To reject an empty value on the server too, make the column [required](#validation).

## Validation

You can validate the input by passing rules in an array to `rules()`, or make the column required with `required()`:

```ts
import { SelectColumn } from '@navette-js/tables';

SelectColumn.make('status')
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
    .required()
```

The rules of all editable columns are described on the [text input column](/tables/columns/text-input#validation) page.

### Valid options validation (`in` rule)

The select column always checks that the received value is one of its options, before your own rules. A value that is not an option is rejected with "The selected status is invalid.", whatever the browser sends. An empty value is accepted, and saved as `null`, unless the column is required.

## Disabling the column

You may disable the select for some records, by passing a function that receives the record to `disabled()`:

```ts
import { SelectColumn } from '@navette-js/tables';

SelectColumn.make<Order>('status')
    .options(ORDER_STATUSES)
    .disabled((record) => record.status === 'delivered')
```

The condition is checked again on the server before saving: a disabled cell cannot be updated by a forged request.

## Lifecycle hooks

Hooks may be used to execute code at various points within the select's lifecycle. They receive an object with the new `state` and the `record`:

```ts
import { SelectColumn } from '@navette-js/tables';

SelectColumn.make('status')
    .options(STATUSES)
    .beforeStateUpdated(({ record, state }) => {
        // Runs before the state is saved to the database.
    })
    .afterStateUpdated(({ record, state }) => {
        // Runs after the state is saved to the database.
    })
```

To save the value yourself instead of updating the record's attribute, see [customizing how the state is saved](/tables/columns/text-input#customizing-how-the-state-is-saved).

## Security

### Authorization

On a resource's list page, a relation manager or a related-record page, Navette checks the `update` ability of the resource's [policy](/resources/overview) for the record before saving. It also checks that the column is declared and visible, that the record is within the data adapter's scope, and that the cell is not [disabled](#disabling-the-column).

The `update` ability covers the whole record. If only some users may change this particular attribute, add that check with `disabled()`.

<Aside variant="warning">
Editable columns cannot save in a [table widget](/tables/overview#using-a-table-outside-a-resource) yet.
</Aside>
