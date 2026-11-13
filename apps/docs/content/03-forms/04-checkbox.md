---
title: Checkbox
---

## Introduction

The checkbox component allows you to interact with a boolean value:

```ts
import { Checkbox } from '@navette-js/forms';

Checkbox.make('is_admin')
```

```preview
// state: {"is_admin": true}
Checkbox.make('is_admin')
```

The checkbox is displayed inline with its label. Its default state is `false`.

If you're saving the boolean value using a database column, make sure your model reads `0` and `1` as booleans. You may also set the [default value](/forms/overview#setting-the-default-value-of-a-field):

```ts
import { Checkbox } from '@navette-js/forms';

Checkbox.make('accepts_newsletter')
    .default(true)
```

## Positioning the label above

Checkbox fields have two layout modes, inline and stacked. By default, they are inline, with the checkbox next to its label. You may display the label above the checkbox with `inline(false)`:

```ts
import { Checkbox } from '@navette-js/forms';

Checkbox.make('is_admin')
    .inline(false)
```

```preview
// state: {"is_admin": true}
Checkbox.make('is_admin')
    .inline(false)
```

## Making the field live

You may call `live()` so the form is re-rendered as soon as the checkbox is checked or unchecked. See [reactivity](/forms/overview#the-basics-of-reactivity).

## Checkbox validation

As well as all rules listed on the [validation](/forms/validation) page, there are additional rules that are specific to checkboxes.

### Accepted validation

A `required()` checkbox must be checked: an unchecked box (`false`) fails the `required` rule. This is how you ensure the user accepts terms:

```ts
import { Checkbox } from '@navette-js/forms';

Checkbox.make('terms_of_service')
    .label('I accept the terms of service')
    .required()
```

```preview
// state: {"terms_of_service": false}
// errors: {"data.terms_of_service": ["The terms of service field is required."]}
Checkbox.make('terms_of_service')
    .label('I accept the terms of service')
    .required()
```

### Declined validation

To ensure the checkbox is *not* checked, add a [custom rule](/forms/validation#custom-rules). Rules other than `required` run on any non-empty value, including `true`:

```ts
import { Checkbox } from '@navette-js/forms';

Checkbox.make('is_under_18')
    .rule({
        name: 'declined',
        passes: (value) => value !== true,
        message: (attribute) => `The ${attribute} field must be declined.`,
    })
```
