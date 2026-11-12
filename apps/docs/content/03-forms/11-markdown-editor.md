---
title: Markdown editor
---

## Introduction

The Markdown editor allows you to edit and preview Markdown content. Like Filament, Navette uses the [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) editor:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
```

The state of the field is the raw Markdown text. On the server, any value that is not a string fails validation.

## Security

Navette does not convert Markdown to HTML for you, and the saved value is the text the user typed. Markdown may contain raw HTML: if you render it as HTML, use a Markdown converter and an HTML sanitizer before outputting it, or your page is open to XSS.

When the field is `disabled()`, the editor is replaced by a read-only view of the text. That view escapes the content: Markdown is not converted, and HTML is displayed as text.

```preview
// state: {"content": "# Release notes\n\n- **Faster** builds\n- New `preview` blocks"}
MarkdownEditor.make('content')
    .disabled()
```

## Customizing the toolbar buttons

You may set the toolbar buttons for the editor using the `toolbarButtons()` method. Group buttons with nested lists:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .toolbarButtons([
        ['bold', 'italic', 'strike', 'link'],
        ['heading'],
        ['blockquote', 'codeBlock', 'bulletList', 'orderedList'],
        ['table'],
        ['undo', 'redo'],
    ])
```

This is also the default toolbar. The available buttons are `bold`, `italic`, `strike`, `link`, `heading`, `blockquote`, `codeBlock`, `bulletList`, `orderedList`, `table`, `undo` and `redo`.

You may also remove buttons with `disableToolbarButtons()` (all of them, without argument), remove the whole toolbar with `disableAllToolbarButtons()`, or add a group of buttons with `enableToolbarButtons()`:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .disableToolbarButtons(['table', 'codeBlock'])
```

## Setting the height

You may set the minimum and maximum height of the editing area with `minHeight()` and `maxHeight()`. The minimum height is `10rem` by default:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .minHeight('20rem')
    .maxHeight('40rem')
```

Only simple CSS lengths (`px`, `rem`, `em`, `%`, `vh`, `vw`) are accepted, because the value ends up in a `style` attribute. Any other value, like `null`, removes the limit.

## Setting a placeholder

You may display a placeholder while the editor is empty:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .placeholder('Write your article…')
```

## Making the field live

The Markdown editor accepts `live()`, `live({ onBlur: true })` and `live({ debounce: 500 })`. See [reactivity](/forms/overview#the-basics-of-reactivity).

## Markdown editor validation

As well as all rules listed on the [validation](/forms/validation) page, you may limit the length of the text with `minLength()` and `maxLength()`:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .minLength(50)
    .maxLength(10000)
```

<Aside variant="warning">
Uploading images to the editor (the `attachFiles` button) is not available yet.
</Aside>
