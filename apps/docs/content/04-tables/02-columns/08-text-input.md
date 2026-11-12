---
title: Text input column
---

## Introduction

The text input column allows you to render a text input inside the table, which can be used to update that database record without needing to open a new page or a modal:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('email')
```

The value is sent to the server when the input loses focus. Only a string or a number is accepted; an empty value is saved as `null`.

## Validation

You can validate the input by passing rules in an array to `rules()`:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('name')
    .rules(['required', 'max:255'])
```

These Laravel rule strings are supported: `required`, `nullable`, `string`, `numeric`, `integer`, `boolean`, `email`, `url`, `min:n`, `max:n` and `in:a,b,c`. `min` and `max` compare the number itself when the column also has the `numeric` or `integer` rule, and the number of characters otherwise. Any other rule string throws an error when the table is defined, rather than being silently ignored.

`required()` is a shortcut for adding the `required` rule. As with Laravel's validator, an empty value only fails `required`: the other rules apply to filled values.

### Writing your own rules

A rule may also be an object with a `name`, a synchronous `passes()` test and a `message()` function, which receives the attribute name:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('sku')
    .rules([
        'required',
        {
            name: 'uppercase',
            passes: (value) => typeof value === 'string' && value === value.toUpperCase(),
            message: (attribute) => `The ${attribute} must be uppercase.`,
        },
    ])
```

### Customizing validation messages

Error messages use the column's label, starting with a lowercase letter ("The name field is required."). You may change the attribute name with `validationAttribute()`, and replace messages by rule name with `validationMessages()`:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('qty')
    .type('number')
    .rules(['integer', 'min:0'])
    .validationAttribute('quantity')
    .validationMessages({ min: 'The stock cannot be negative.' })
```

When several rules fail, the first message is displayed, followed by "(and 1 more error)".

## Customizing the HTML input type

You may use the `type()` method to pass a custom [HTML input type](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#input_types):

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('background_color')
    .type('color')
```

The type only changes the input in the browser. Validate the value on the server with [rules](#validation).

## Setting the HTML input mode

You may set the [`inputmode` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode) of the input using the `inputMode()` method:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('amount')
    .inputMode('decimal')
```

## Setting the numeric step

You may set the [`step` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#step) of the input using the `step()` method:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('price')
    .type('number')
    .step(0.01)
```

## Masking the input

You may apply an [Alpine.js mask](https://alpinejs.dev/plugins/mask#x-mask) to the input with `mask()`. The input then becomes a text input:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('phone')
    .mask('(999) 999-9999')
```

## Setting a placeholder

You may display placeholder text when the input is empty:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('nickname')
    .placeholder('None')
```

## Adding affix text aside the field

You may place text before and after the input using the `prefix()` and `suffix()` methods:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('domain')
    .prefix('https://')
    .suffix('.com')
```

Pass `true` as the second argument, or call `inlinePrefix()` / `inlineSuffix()`, to display the affix inside the input instead of next to it.

### Using icons as affixes

You may place an [icon](/styling/icons) before and after the input using the `prefixIcon()` and `suffixIcon()` methods:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('domain')
    .prefixIcon('m-globe-alt')
```

#### Setting the affix icon's color

Affix icons are gray by default, but you may set a different color using the `prefixIconColor()` and `suffixIconColor()` methods:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('status')
    .suffixIcon('m-check-circle')
    .suffixIconColor('success')
```

## Disabling the column

You may disable the input for some records, by passing a function that receives the record to `disabled()`:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make<Invoice>('reference')
    .disabled((record) => record.status === 'paid')
```

The condition is checked again on the server before saving.

## Adding a tooltip

You may display a tooltip when the user hovers the input. Pass a string, or a function that receives the record. A validation error replaces the tooltip while it is displayed:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('sku')
    .tooltip('Stock keeping unit')
```

## Lifecycle hooks

Hooks may be used to execute code at various points within the input's lifecycle. They receive an object with the new `state` and the `record`:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make('name')
    .beforeStateUpdated(({ record, state }) => {
        // Runs before the state is saved to the database.
    })
    .afterStateUpdated(({ record, state }) => {
        // Runs after the state is saved to the database.
    })
```

Hooks only run for a value that passed validation.

### Customizing how the state is saved

By default, the validated value is written to the record's attribute with the column's name, through the data adapter. To save it yourself, pass a function to `updateStateUsing()`. Its return value is sent back to the browser as the new state:

```ts
import { TextInputColumn } from '@navette-js/tables';

TextInputColumn.make<Order>('customer.email')
    .getStateUsing(({ record }) => record.customer_email ?? null)
    .rules(['required', 'email'])
    .updateStateUsing(async ({ record, state }) => {
        await Customer.query().findById(record.customer_id).patch({ email: String(state) });
        return state;
    })
```

A column whose name contains a dot, like `customer.email`, can only be saved with `updateStateUsing()`: Navette does not write related records itself. `afterStateUpdated()` still runs after your function.

<Aside variant="warning">
`updateStateUsing()` runs after Navette's checks on the row's record, but whatever else it writes is up to you. In the example above, the `update` ability is checked for the order, not for the customer: authorize writes to other records yourself.
</Aside>

## Security

### Authorization

On a resource's list page, a relation manager or a related-record page, Navette checks the `update` ability of the resource's [policy](/resources/overview) for the record before saving. It also checks that the column is declared and visible, that the record is within the data adapter's scope, that the cell is not [disabled](#disabling-the-column), and that the value passes the column's rules.

The `update` ability covers the whole record. If only some users may change this particular attribute, add that check with `disabled()`.
