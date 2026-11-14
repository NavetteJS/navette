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

## Tweaking the search debounce

By default, the search waits one second after the user stops typing before filtering the options. You may change this delay using the `searchDebounce()` method, which accepts the number of milliseconds to wait:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .options({
        // ...
    })
    .searchable()
    .searchDebounce(500)
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

## Allowing HTML in the option labels

By default, the option labels are escaped. If you need HTML in them, you can use the `allowHtml()` method:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technology')
    .options({
        tailwind: '<span class="text-blue-500">Tailwind</span>',
        alpine: '<span class="text-green-500">Alpine</span>',
        laravel: '<span class="text-red-500">Laravel</span>',
        livewire: '<span class="text-pink-500">Livewire</span>',
    })
    .searchable()
    .allowHtml()
```

```preview
// state: {"technology": ["alpine"]}
CheckboxList.make('technology')
    .options({
        tailwind: '<strong>Tailwind</strong> CSS',
        alpine: '<em>Alpine</em>.js',
        laravel: '<strong>Laravel</strong>',
    })
    .allowHtml()
```

The labels are cleaned with the HTML sanitizer used for rich content (`sanitizeHtml()` from `@navette-js/support`): scripts, event handlers and dangerous URLs are removed. Still, avoid `allowHtml()` for labels that users can write.

## Integrating with a relationship

You may employ the `relationship()` method of the `CheckboxList` to point to a many-to-many relationship of the form's Objection model (`Model.ManyToManyRelation` in `relationMappings`). The second argument is the column of the related records to use as their label:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .relationship('technologies', 'name')
```

The options are the related records (1000 at most). When the form is filled, the records linked to the current record are checked. Once the record is saved, the checked records are linked and the unchecked ones are unlinked, through the join table. The field is not part of the record's own data.

The name of the relationship defaults to the name of the field, so `relationship(null, 'name')` works when both are the same. The model is the one of the [data adapter](/advanced/data-adapters) of the page; you may pass another one with `relationship('technologies', 'name', null, { model: Product })`.

Only the records offered by the field can be linked: keys sent by the browser that are not options (or are [disabled](#disabling-specific-options)) are refused by the validation and never linked.

### Customizing the relationship query

You may customize the database query that retrieves options using the third argument of the `relationship()` method:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .relationship('technologies', 'name', (query) => query.where('is_active', true))
```

### Customizing the relationship option labels

If you'd like to customize the label of each option, maybe to be more descriptive, or to concatenate a first and last name, you could use the `getOptionLabelFromRecordUsing()` method:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('authors')
    .relationship('authors', 'first_name')
    .getOptionLabelFromRecordUsing((record) => `${record.first_name} ${record.last_name}`)
```

### Customizing the relationship option descriptions

The `getOptionDescriptionFromRecordUsing()` method gives each option a description, displayed under its label:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .relationship('technologies', 'name')
    .getOptionDescriptionFromRecordUsing((record) => record.description)
```

### Saving pivot data to the relationship

If your pivot table has additional columns, you can use the `pivotData()` method to specify the data that should be saved in them when a record is linked:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('primaryTechnologies')
    .relationship('technologies', 'name')
    .pivotData({
        is_primary: true,
    })
```

The columns must be declared in the relationship's `join.through.extra`, as Objection requires.

## Making the field live

You may call `live()` so the form is re-rendered as soon as an option is checked or unchecked. See [reactivity](/forms/overview#the-basics-of-reactivity).

## Checkbox list validation

As well as all rules listed on the [validation](/forms/validation) page, the checkbox list checks that every submitted value is one of its options. A `required()` checkbox list needs at least one checked option.

## Customizing the checkbox list action objects

This field uses action objects for easy customization of buttons within it. You can customize these buttons by passing a function to an action registration method. The function receives the `Action` object, which you can use to [customize it](/actions/overview). The following methods are available to customize the actions:

- `selectAllAction()`
- `deselectAllAction()`

Here is an example of how you might customize an action:

```ts
import { CheckboxList } from '@navette-js/forms';

CheckboxList.make('technologies')
    .options({
        // ...
    })
    .bulkToggleable()
    .selectAllAction((action) => action.label('Select all technologies'))
```

The checkboxes are toggled in the browser, so these actions accept a label, an icon, a color and visibility, but no modal.
