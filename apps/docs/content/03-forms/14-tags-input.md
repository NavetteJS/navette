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

Store the value in a JSON column: with an Objection model, list the column in `static jsonAttributes`. To store it in a text column instead, use a [separator](#using-a-separator).

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

## Using a separator

Tags can be stored in a separated string instead of a list. To set this up, pass the separating character to the `separator()` method:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tags')
    .separator(',')
```

The tags are then saved as one string, such as `'php,node,typescript'`, and that string is split back into tags when the form is filled. `separator()` without an argument uses a comma.

## Adding a prefix and suffix to individual tags

You can add prefix and suffix to tags without modifying the real state of the field. This can be useful if you need to show presentational formatting to users without saving it. This is done with the `tagPrefix()` and `tagSuffix()` methods:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('percentages')
    .tagSuffix('%')
```

```preview
// state: {"percentages": ["10", "25", "50"]}
// width: 32rem
TagsInput.make('percentages')
    .tagSuffix('%')
```

## Reordering tags

You can allow the user to reorder tags within the field using the `reorderable()` method:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tags')
    .reorderable()
```

The tags are reordered by dragging them. Reordering is turned off when the field is disabled.

## Stripping characters from tags

The `stripCharacters()` method removes a character, or each of an array of characters, from every tag before the tags are validated and saved. A tag left empty is dropped:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('hashtags')
    .stripCharacters('#')
```

As well as allowing a static value, `stripCharacters()` also accepts a function of the [field context](/forms/overview#using-the-field-context) returning the characters.

## Changing the color of tags

You can change the color of the tags by passing a color registered on the panel to the `color()` method. Tags use `primary` by default:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tags')
    .color('danger')
```

```preview
// state: {"tags": ["urgent", "blocker"]}
// width: 32rem
TagsInput.make('tags')
    .color('danger')
```

## Tags validation

As well as all rules listed on the [validation](/forms/validation) page, you may add validation rules for each tag by passing a list of [rule objects](/forms/validation#custom-rules) to the `nestedRecursiveRules()` method:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tags')
    .nestedRecursiveRules([
        {
            name: 'max',
            passes: (tag) => String(tag).length <= 50,
            message: (attribute) => `Each of the ${attribute} must not be greater than 50 characters.`,
        },
    ])
```

Each rule runs against every tag, and the field fails with the rule's message as soon as one tag fails it. `nestedRecursiveRules()` replaces the list of nested rules each time it is called. Rules may also be written as [Laravel rule strings](/forms/validation#laravel-rule-strings), such as `'max:50'`.

You may also write a [custom rule](/forms/validation#custom-rules) that checks the whole list:

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
