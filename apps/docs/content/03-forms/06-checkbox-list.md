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

## Setting option descriptions

You can optionally provide descriptions to each option using the `descriptions()` method. This method accepts an object of plain text strings, keyed by option value:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
    .descriptions({
        tailwind: 'A utility-first CSS framework for rapidly building modern websites without ever leaving your HTML.',
        alpine: 'A rugged, minimal tool for composing behavior directly in your markup.',
        laravel: 'A web application framework with expressive, elegant syntax.',
        livewire: 'A full-stack framework for Laravel that makes building dynamic interfaces simple.',
    })
```

```preview
// state: {"technologies": ["alpine"]}
CheckboxList.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
    .descriptions({
        tailwind: 'A utility-first CSS framework for rapidly building modern websites without ever leaving your HTML.',
        alpine: 'A rugged, minimal tool for composing behavior directly in your markup.',
        laravel: 'A web application framework with expressive, elegant syntax.',
        livewire: 'A full-stack framework for Laravel that makes building dynamic interfaces simple.',
    })
```

Make sure to use the same keys in the descriptions object as the options object so the right description matches the right option.

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

## Disabling specific options

You can disable specific options using the `disableOptionWhen()` method. It accepts a function, which receives the option's `value` and `label`, and returns whether the option should be disabled:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
    .disableOptionWhen((value) => value === 'livewire')
```

```preview
// state: {"technologies": ["alpine"]}
CheckboxList.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
    .disableOptionWhen((value) => value === 'livewire')
```

A disabled option cannot be checked, even by a forged request: the server refuses it with the "The selected … is invalid." message.

## Searching options

You may enable a search input to allow easier access to many options, using the `searchable()` method. The options are filtered in the browser:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
    .searchable()
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
    .searchable()
```

### Customizing the search prompt and the "no results" message

The search input shows "Search" as its placeholder, and "No search results." is displayed when no option matches. You may change them using the `searchPrompt()` and `noSearchResultsMessage()` methods:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
    .searchable()
    .searchPrompt('Search for a technology')
    .noSearchResultsMessage('No technologies found.')
```

## Bulk toggling checkboxes

You may allow users to toggle all checkboxes at once using the `bulkToggleable()` method. A "Select all" link is displayed above the options, and becomes "Deselect all" once every option is checked:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
    .bulkToggleable()
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
    .bulkToggleable()
```

The links are not displayed when the field is disabled.

## Making the field live

You may call `live()` so the form is re-rendered as soon as an option is checked or unchecked. See [reactivity](/forms/overview#the-basics-of-reactivity).

## Checkbox list validation

As well as all rules listed on the [validation](/forms/validation) page, the checkbox list checks that every submitted value is one of its options. A `required()` checkbox list needs at least one checked option.

<Aside variant="warning">
HTML labels, `relationship()`, customizing the bulk toggle actions (`selectAllAction()`, `deselectAllAction()`) and the search debounce are not available yet. To save a many-to-many relationship, handle the list of keys in your data adapter.
</Aside>
