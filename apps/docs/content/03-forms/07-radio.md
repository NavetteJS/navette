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

## Making the field live

You may call `live()` so the form is re-rendered as soon as an option is chosen. See [reactivity](/forms/overview#the-basics-of-reactivity).

## Radio validation

The radio checks that the submitted value is one of its options. The error message is "The selected status is invalid.".

<Aside variant="warning">
Disabling specific options and `boolean()` options are not available yet. For a yes/no choice, pass the options yourself as a list, which keeps their order: `options([['1', 'Yes'], ['0', 'No']])`.
</Aside>
