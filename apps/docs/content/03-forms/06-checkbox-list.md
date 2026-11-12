---
title: Checkbox list
---

## Introduction

The checkbox list component allows you to select multiple values from a list of predefined options:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
```

```preview
// state: {"technologies": ["alpine", "laravel"]}
CheckboxList.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
```

Options may be an object of `value: label` pairs, or a list of `[value, label]` pairs.

The state of the field is a list of strings. When the form is filled, a JSON string such as `'["alpine","laravel"]'` is parsed into a list. The saved value keeps only known options, without duplicates, in the order of the options. Store it in a JSON column: with an Objection model, list the column in `static jsonAttributes`.

## Splitting options into columns

You may split the options into columns by using the `columns()` method. The columns apply from the `lg` breakpoint:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('labels')
    .options({
        bug: 'Bug',
        feature: 'Feature',
        enhancement: 'Enhancement',
        documentation: 'Documentation',
        design: 'Design',
        testing: 'Testing',
    })
    .columns(3)
```

```preview
// state: {"labels": ["bug", "documentation", "testing"]}
// viewport: 1100
CheckboxList.make('labels')
    .options({
        bug: 'Bug',
        feature: 'Feature',
        enhancement: 'Enhancement',
        documentation: 'Documentation',
        design: 'Design',
        testing: 'Testing',
    })
    .columns(3)
```

## Checkbox list validation

As well as all rules listed on the [validation](/forms/validation) page, the checkbox list checks that every submitted value is one of its options. A `required()` checkbox list needs at least one checked option.

<Aside variant="warning">
Option descriptions, search, bulk toggling, disabling specific options, HTML labels and `relationship()` are not available yet. To save a many-to-many relationship, handle the list of keys in your data adapter.
</Aside>
