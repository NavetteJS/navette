---
title: Tags input
---

## Introduction

The tags input component allows you to interact with a list of tags:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tags')
```

```preview
// width: 32rem
TagsInput.make('tags')
```

The state of the field is a list of strings. When the form is filled, a JSON string such as `'["php","node"]'` is parsed into a list, and any other non-empty string becomes a single tag. When saving, each tag is trimmed, empty tags are dropped, and at most 1000 tags are kept.

Store the value in a JSON column: with an Objection model, list the column in `static jsonAttributes`.

The input displays "New tag" as its placeholder. You may change it with `placeholder()`:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tasks')
    .placeholder('Add tasks')
```

## Autocompleting tag suggestions

Tags inputs may have autocomplete suggestions. To enable this, pass a list of suggestions to the `suggestions()` method:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tags')
    .suggestions([
        'tailwindcss',
        'alpinejs',
        'laravel',
        'livewire',
    ])
```

Suggestions are displayed by the browser's native autocomplete, and are only suggestions: the user may still enter any tag. A suggestion already added is not proposed again.

## Defining split keys

Split keys allow you to map specific buttons on your user's keyboard to create a new tag. By default, when the user presses "Enter", a new tag is created in the input. You may also define other keys to create new tags, such as "Tab" or " ". To do this, pass a list of keys to the `splitKeys()` method:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tags')
    .splitKeys(['Tab', ' '])
```

You can [read more about possible options for keys](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key).

## Tags validation

As well as all rules listed on the [validation](/forms/validation) page, you may validate each tag by writing a [custom rule](/forms/validation#custom-rules) that checks every item of the list:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tags')
    .rule({
        name: 'tags_max',
        passes: (value) => Array.isArray(value) && value.every((tag) => String(tag).length <= 50),
        message: (attribute) => `Each of the ${attribute} must not be greater than 50 characters.`,
    })
```

A `required()` tags input needs at least one tag.

<Aside variant="warning">
Comma-separated storage (`separator()`), tag prefixes and suffixes, reordering tags, tag colors and `nestedRecursiveRules()` are not available yet.
</Aside>
