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

## Adding icons to the toggle button

Toggles may also use an [icon](/styling/icons) to represent the "on" and "off" state of the button. To add an icon to the "on" state, use the `onIcon()` method. To add an icon to the "off" state, use the `offIcon()` method:

```ts
import { Toggle } from '@navette-js/forms';

Toggle.make('is_admin')
    .onIcon('m-bolt')
    .offIcon('m-user')
```

```preview
// state: {"is_admin": true}
Toggle.make('is_admin')
    .onIcon('m-bolt')
    .offIcon('m-user')
```

## Customizing the color of the toggle button

You may also customize the color representing the "on" or "off" state of the toggle. By default, the switch uses the panel's `primary` color when on, and gray when off. Use the `onColor()` and `offColor()` methods with any color registered on the panel:

```ts
import { Toggle } from '@navette-js/forms';

Toggle.make('is_admin')
    .onColor('success')
    .offColor('danger')
```

```preview
// state: {"is_admin": true}
Toggle.make('is_admin')
    .onColor('success')
    .offColor('danger')
```

## Positioning the label above

Toggle fields have two layout modes, inline and stacked. By default, they are inline, with the switch next to its label. You may display the label above the switch with `inline(false)`:

```ts
import { Toggle } from '@navette-js/forms';

Toggle.make('is_admin')
    .inline(false)
```

```preview
// state: {"is_admin": false}
Toggle.make('is_admin')
    .inline(false)
```

## Making the field live

You may call `live()` so the form is re-rendered as soon as the toggle is switched. See [reactivity](/forms/overview#the-basics-of-reactivity).

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
