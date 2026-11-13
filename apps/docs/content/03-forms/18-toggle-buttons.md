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

## Boolean options

If you want a simple boolean toggle button group, with "Yes" and "No" options, you can use the `boolean()` method:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('feedback')
    .label('Like this post?')
    .boolean()
```

```preview
// state: {"feedback": "1"}
ToggleButtons.make('feedback')
    .label('Like this post?')
    .boolean()
```

The options will have [colors](#changing-the-color-of-option-buttons) and [icons](#adding-icons-to-option-buttons) set up automatically: "Yes" is green with a check icon, and "No" is red with a cross icon. Their values are `'1'` and `'0'`. You may change the labels by passing them as arguments, and colors or icons set with `colors()` and `icons()` before `boolean()` take precedence:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('feedback')
    .label('Like this post?')
    .boolean('Absolutely', 'Not really')
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

## Selecting multiple buttons

The `multiple()` method on the `ToggleButtons` component allows you to select multiple values from the list of options:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('technologies')
    .multiple()
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
```

```preview
// state: {"technologies": ["alpine", "laravel"]}
ToggleButtons.make('technologies')
    .multiple()
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
```

The state of the field is then a list of strings, `[]` by default. When the form is filled, a JSON string is parsed into a list. The saved value keeps only known options, in the order of the options. Store it in a JSON column: with an Objection model, list the column in `static jsonAttributes`.

## Splitting options into columns

You may split the options into columns by using the `columns()` method. The columns apply from the `lg` breakpoint, and are ignored when the buttons are [inline](#positioning-the-options-inline-with-each-other) or [grouped](#grouping-option-buttons):

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
    .columns(2)
```

```preview
// state: {"technologies": "laravel"}
// viewport: 1100
ToggleButtons.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
    .columns(2)
```

## Making the buttons fill the width

You may stretch the buttons to the full width of the field using the `fullWidth()` method:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('provider')
    .options({ stripe: 'Stripe', paypal: 'PayPal' })
    .grouped()
    .fullWidth()
```

```preview
// state: {"provider": "stripe"}
// width: 32rem
ToggleButtons.make('provider')
    .options({ stripe: 'Stripe', paypal: 'PayPal' })
    .grouped()
    .fullWidth()
```

## Changing the size of option buttons

You may change the size of the buttons using the `size()` method. It accepts `xs`, `sm`, `md` (the default), `lg` or `xl`:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .size('sm')
```

```preview
// state: {"status": "draft"}
ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .size('sm')
```

## Adding tooltips to option buttons

You may add a tooltip to each option button using the `tooltips()` method. Each key in the object should correspond to an option value:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .tooltips({
        draft: 'Not visible to customers.',
        scheduled: 'Published on the planned date.',
        published: 'Visible to customers.',
    })
```

The tooltips are plain text.

## Hiding option button labels

You may want to hide the labels of the option buttons, and only show their [icons](#adding-icons-to-option-buttons), using the `hiddenButtonLabels()` method. The labels are kept for screen readers:

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
    .hiddenButtonLabels()
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
    .hiddenButtonLabels()
```

Use it together with `tooltips()` so sighted users can still tell the buttons apart.

## Disabling specific options

You can disable specific options using the `disableOptionWhen()` method. It accepts a function, which receives the option's `value` and `label`, and returns whether the option should be disabled:

```ts
import { ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .disableOptionWhen((value) => value === 'published')
```

```preview
// state: {"status": "draft"}
ToggleButtons.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .disableOptionWhen((value) => value === 'published')
```

A disabled option cannot be selected, even by a forged request: the server refuses it as an invalid value.

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

The toggle buttons check that the submitted value is one of the options, and not a [disabled option](#disabling-specific-options). With `multiple()`, every submitted value is checked. The error message is "The selected status is invalid.".
