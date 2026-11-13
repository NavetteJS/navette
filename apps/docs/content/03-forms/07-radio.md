---
title: Radio
---

## Introduction

The radio input provides a radio button group for selecting a single value from a list of predefined options:

```ts
import { Radio } from '@navette-js/forms';

Radio.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
```

```preview
// state: {"status": "scheduled"}
Radio.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
```

Options may be an object of `value: label` pairs, or a list of `[value, label]` pairs.

## Setting option descriptions

You can optionally provide descriptions to each option using the `descriptions()` method. This method accepts an object of plain text strings, keyed by option value:

```ts
import { Radio } from '@navette-js/forms';

Radio.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .descriptions({
        draft: 'Is not visible.',
        scheduled: 'Will be visible.',
        published: 'Is visible.',
    })
```

```preview
// state: {"status": "draft"}
Radio.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .descriptions({
        draft: 'Is not visible.',
        scheduled: 'Will be visible.',
        published: 'Is visible.',
    })
```

## Positioning the options inline with each other

You may wish to display the options `inline()` with each other:

```ts
import { Radio } from '@navette-js/forms';

Radio.make('priority')
    .options({ low: 'Low', medium: 'Medium', high: 'High' })
    .default('medium')
    .inline()
```

```preview
// state: {"priority": "medium"}
Radio.make('priority')
    .options({ low: 'Low', medium: 'Medium', high: 'High' })
    .default('medium')
    .inline()
```

## Disabling specific options

You can disable specific options using the `disableOptionWhen()` method. It accepts a function, which receives the option's `value` and `label`, and returns whether the option should be disabled:

```ts
import { Radio } from '@navette-js/forms';

Radio.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .disableOptionWhen((value) => value === 'published')
```

```preview
// state: {"status": "draft"}
Radio.make('status')
    .options({
        draft: 'Draft',
        scheduled: 'Scheduled',
        published: 'Published',
    })
    .disableOptionWhen((value) => value === 'published')
```

A disabled option cannot be chosen, even by a forged request: the server refuses it as an invalid value.

## Boolean options

If you want a simple boolean radio button group, with "Yes" and "No" options, you can use the `boolean()` method:

```ts
import { Radio } from '@navette-js/forms';

Radio.make('feedback')
    .label('Like this post?')
    .boolean()
```

```preview
// state: {"feedback": "1"}
Radio.make('feedback')
    .label('Like this post?')
    .boolean()
```

The "Yes" option has the value `'1'`, and the "No" option has the value `'0'`. You may change their labels by passing them as arguments:

```ts
import { Radio } from '@navette-js/forms';

Radio.make('feedback')
    .label('Like this post?')
    .boolean('Absolutely', 'Not really')
```

The labels are translated: the default ones follow the panel's locale.

## Making the field live

You may call `live()` so the form is re-rendered as soon as an option is chosen. See [reactivity](/forms/overview#the-basics-of-reactivity).

## Radio validation

The radio checks that the submitted value is one of its options, and not a [disabled option](#disabling-specific-options). The error message is "The selected status is invalid.".
