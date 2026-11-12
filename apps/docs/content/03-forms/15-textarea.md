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
// state: {"description": "A lightweight admin panel for Node.js, inspired by Filament."}
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
// state: {"description": "Navette renders Filament's components on the server.\n\nForms, tables, infolists and actions share the same schema system, so a page is described once and rendered with the same CSS as Filament."}
// width: 32rem
Textarea.make('description')
    .rows(10)
```

Without `rows()`, the textarea is two rows high.

## Textarea validation

As well as all rules listed on the [validation](/forms/validation) page, there are additional rules that are specific to textareas.

### Length validation

You may limit the length of the textarea by setting the `maxLength()` method. This method adds both frontend and backend validation:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('description')
    .maxLength(1000)
```

To require a minimum length, add a [custom rule](/forms/validation#custom-rules).

<Aside variant="warning">
Autosizing (`autosize()`), `minLength()`, `placeholder()`, `readOnly()`, `disableGrammarly()`, `trim()` and `live()` are not available yet on the textarea.
</Aside>
