---
title: Toggle buttons
---

## Introduction

The toggle buttons input provides a group of buttons for selecting a single value from a list of predefined options:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
```

```preview
// state: {"status": "scheduled"}
ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
```

Options may be an object of `value: label` pairs, or a list of `[value, label]` pairs.

## Changing the color of option buttons

You can change the color of the option buttons using the `colors()` method. Each key in the object should correspond to an option value:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .colors({
        draft: 'info',
        scheduled: 'warning',
        published: 'success',
    })
```

```preview
// state: {"status": "scheduled"}
ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .colors({
        draft: 'info',
        scheduled: 'warning',
        published: 'success',
    })
```

Buttons without a color use `primary`. The colors are those registered on the panel.

## Adding icons to option buttons

You can add icons to the option buttons using the `icons()` method. Each key in the object should correspond to an option value, and each value is a Heroicons name prefixed with `o-`, `s-` or `m-`:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .icons({
        draft: 'm-pencil',
        scheduled: 'm-clock',
        published: 'm-check-circle',
    })
```

```preview
// state: {"status": "scheduled"}
ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .icons({
        draft: 'm-pencil',
        scheduled: 'm-clock',
        published: 'm-check-circle',
    })
```

## Positioning the options inline with each other

You may wish to display the buttons `inline()` with each other:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('feedback')
    .options({ like: 'Like', dislike: 'Dislike' })
    .inline()
```

```preview
// state: {"feedback": "like"}
ToggleButtons.make('feedback')
    .options({ like: 'Like', dislike: 'Dislike' })
    .inline()
```

## Grouping option buttons

You may wish to group option buttons together so they are more compact, using the `grouped()` method. This also makes them appear horizontally inline with each other:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('provider')
    .options({ stripe: 'Stripe', paypal: 'PayPal' })
    .grouped()
```

```preview
// state: {"provider": "stripe"}
ToggleButtons.make('provider')
    .options({ stripe: 'Stripe', paypal: 'PayPal' })
    .grouped()
```

## Making the field live

You may call `live()` so the form is re-rendered as soon as an option is chosen. This is a common way to show fields depending on a type:

```ts
import { TextInput, ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('employment_type')
    .options({ full_time: 'Full time', contractor: 'Contractor' })
    .default('full_time')
    .inline()
    .required()
    .live(),

TextInput.make('salary')
    .numeric()
    .visible(({ get }) => get('employment_type') === 'full_time'),

TextInput.make('hourly_rate')
    .numeric()
    .visible(({ get }) => get('employment_type') === 'contractor'),
```

```preview
// state: {"employment_type": "full_time", "salary": 52000}
// width: 32rem
[
    ToggleButtons.make('employment_type')
        .options({ full_time: 'Full time', contractor: 'Contractor' })
        .default('full_time')
        .inline()
        .required()
        .live(),

    TextInput.make('salary')
        .numeric()
        .visible(({ get }) => get('employment_type') === 'full_time'),

    TextInput.make('hourly_rate')
        .numeric()
        .visible(({ get }) => get('employment_type') === 'contractor'),
]
```

## Toggle buttons validation

The toggle buttons check that the submitted value is one of the options. The error message is "The selected status is invalid.".

<Aside variant="warning">
Selecting multiple buttons, tooltips, button sizes, `boolean()` options, filling the container's width, splitting options into columns and disabling specific options are not available yet.
</Aside>
