---
title: Textarea
---

## Introduction

The textarea allows you to interact with a multi-line string:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('description')
```

```preview
// state: {"description": "A lightweight admin panel for Node.js, written in TypeScript."}
// width: 32rem
Textarea.make('description')
```

## Resizing the textarea

You may change the size of the textarea by defining the `rows()` method:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('description')
    .rows(10)
```

```preview
// state: {"description": "Navette renders its components on the server.\n\nForms, tables, infolists and actions share the same schema system, so a page is described once and rendered with the same CSS everywhere."}
// width: 32rem
Textarea.make('description')
    .rows(10)
```

Without `rows()`, the textarea is two rows high.

## Autosizing the textarea

You may allow the textarea to automatically resize to fit its content by setting the `autosize()` method:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('description')
    .autosize()
```

The textarea starts at the height set by `rows()` (two rows by default), and grows as the user types.

## Adding a placeholder

You may display a placeholder when the textarea is empty using the `placeholder()` method:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('description')
    .placeholder('Describe the product in a few sentences.')
```

```preview
// width: 32rem
Textarea.make('description')
    .placeholder('Describe the product in a few sentences.')
```

## Making the field read-only

Not to be confused with [disabling the field](/forms/overview#disabling-a-field), you may make the field "read-only" using the `readOnly()` method:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('description')
    .readOnly()
```

There are a few differences, compared to `disabled()`:

- When using `readOnly()`, the field will still be sent to the server when the form is submitted. It can be mutated with the browser console, or via JavaScript. You can use [`dehydrated(false)`](/forms/overview#preventing-a-field-from-being-saved) to prevent this.
- There are no styling changes, such as less opacity, when using `readOnly()`.
- The field is still focusable when using `readOnly()`.
- The field is still validated on the server, but the browser's `required` check is dropped.

## Disabling Grammarly checks

If the user has Grammarly installed and you would like to prevent it from analyzing the contents of the textarea, you can use the `disableGrammarly()` method:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('description')
    .disableGrammarly()
```

## Making the field live

You may call `live()` so the form is re-rendered as the user types, or `live({ onBlur: true })` so it is re-rendered when the textarea loses focus. See [reactivity](/forms/overview#the-basics-of-reactivity).

## Textarea validation

As well as all rules listed on the [validation](/forms/validation) page, there are additional rules that are specific to textareas.

### Length validation

You may limit the length of the textarea by setting the `minLength()` and `maxLength()` methods. These methods add both frontend and backend validation:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('description')
    .minLength(2)
    .maxLength(1000)
```

You can also specify the exact length of the textarea by setting the `length()` method. This method adds both frontend and backend validation:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('question')
    .length(100)
```

