---
title: Toggle
---

## Introduction

The toggle component, similar to a [checkbox](/forms/checkbox), allows you to interact with a boolean value using a switch:

```ts
import { Toggle } from '@navette-js/forms';

Toggle.make('is_admin')
```

```preview
// state: {"is_admin": false}
Toggle.make('is_admin')
```

The default state of a toggle is `false`. When the form is filled from a record, `true`, `1` and `'1'` turn the toggle on, and any other value turns it off, so you may store the value in an integer column:

```ts
import { Toggle } from '@navette-js/forms';

Toggle.make('is_visible')
    .label('Visible to customers')
    .default(true)
```

```preview
// state: {"is_visible": true}
Toggle.make('is_visible')
    .label('Visible to customers')
    .default(true)
```

The switch uses the panel's `primary` color.

## Toggle validation

As well as all rules listed on the [validation](/forms/validation) page, there are additional rules that are specific to toggles.

### Accepted validation

A `required()` toggle must be on: a toggle that is off (`false`) fails the `required` rule:

```ts
import { Toggle } from '@navette-js/forms';

Toggle.make('terms_of_service')
    .required()
```

### Declined validation

To ensure the toggle is off, add a [custom rule](/forms/validation#custom-rules):

```ts
import { Toggle } from '@navette-js/forms';

Toggle.make('is_under_18')
    .rule({
        name: 'declined',
        passes: (value) => value !== true,
        message: (attribute) => `The ${attribute} field must be declined.`,
    })
```

<Aside variant="warning">
Icons inside the switch (`onIcon()`, `offIcon()`), custom colors (`onColor()`, `offColor()`), positioning the label above (`inline(false)`) and `live()` are not available yet.
</Aside>
