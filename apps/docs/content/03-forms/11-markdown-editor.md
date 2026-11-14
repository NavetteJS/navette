---
title: Markdown editor
---

## Introduction

The Markdown editor allows you to edit and preview Markdown content. Navette uses the [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) editor:

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
        ['table', 'attachFiles'],
        ['undo', 'redo'],
    ])
```

This is also the default toolbar. The available buttons are `bold`, `italic`, `strike`, `link`, `heading`, `blockquote`, `codeBlock`, `bulletList`, `orderedList`, `table`, `attachFiles`, `undo` and `redo`. The `attachFiles` button is only shown when a storage is available for [uploaded images](#uploading-images-to-the-editor).

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

## Uploading images to the editor

The `attachFiles` toolbar button lets the user upload images, which are inserted into the text by their URL. Uploads must be [set up](/forms/file-upload#setting-up-uploads): images are sent to the temporary upload store, then stored in `FileUpload.storage` by default. Without a storage, the `attachFiles` button is hidden. You may customize where images are stored using configuration methods:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .fileAttachmentsStorage(attachmentsStorage)
    .fileAttachmentsDirectory('attachments')
```

`fileAttachmentsStorage()` accepts any [`FileStorage`](/advanced/file-storage#storing-files). Images are stored without a chosen name (`LocalFileStorage` gives them a random one). Only URLs starting with `/` or `http(s)://` are accepted: since the URL is saved in the text, use a storage whose URLs are public and stay valid.

An image is stored as soon as it is uploaded, not when the form is saved. It therefore stays stored if the user removes it from the text, or leaves without saving the form. A `disabled()` editor refuses uploads.

Panel pages, including [custom pages](/resources/custom-pages), can receive editor uploads. If you use the Markdown editor in your own wire component, declare a public `componentFileAttachments` property, initialized to `{}`: the browser uploads images into it, and attaching files fails without it.

### Validating uploaded images

You may use the `fileAttachmentsAcceptedFileTypes()` method to control a list of accepted MIME types for uploaded images. By default, `image/png`, `image/jpeg`, `image/gif`, and `image/webp` are accepted. Only image types are kept, and `image/svg+xml` is always refused:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .fileAttachmentsAcceptedFileTypes(['image/png', 'image/jpeg'])
```

You may use the `fileAttachmentsMaxSize()` method to control the maximum file size for uploaded images. The size is specified in kilobytes. By default, the maximum size is 12288 KB (12 MB):

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .fileAttachmentsMaxSize(5120) // 5 MB
```

Both checks run in the browser, and again on the server before the image is stored. On the server, the type is [detected from the file's content](/advanced/file-storage#checking-the-type-of-a-file), never from its name or the type announced by the browser. The `maxFileSize` of the temporary upload store also applies.

## Setting a placeholder

You may display a placeholder while the editor is empty:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .placeholder('Write your article…')
```

## Making the field live

The Markdown editor accepts `live()`, `live({ onBlur: true })` and `live({ debounce: 500 })`. See [reactivity](/forms/overview#the-basics-of-reactivity).

## Generating fake Markdown

`MarkdownEditor.fake()` generates Markdown for seeders and tests (Filament's `fake()->filamentMarkdown()`). Chain blocks, then get the content with `toString()`:

```ts
import { MarkdownEditor } from '@navette-js/forms';

await knex('posts').insert({
    title: 'Hello',
    content: MarkdownEditor.fake()
        .heading()
        .paragraphs(3)
        .bulletList()
        .toString(),
});
```

`article(depth)` generates a complete article: an introductory paragraph, then sections with level-two headings; each level of `depth` (up to 5) adds nested sections with the next heading level:

```ts
MarkdownEditor.fake().article(2).toString()
```

The available blocks are `heading(level)`, `paragraphs(count, marks)`, `bulletList(items)`, `orderedList(items)`, `blockquote(paragraphs)`, `codeBlock(language, code)`, `horizontalRule()`, `hardBreak()`, `table(columns, rows)` and `image(url, width, height, alt)`. `paragraphs()` may add a link and bold, italic, strike-through and inline code words:

```ts
MarkdownEditor.fake()
    .paragraphs(3, { links: true, bold: true, italic: true })
    .toString()
```

Pass `{ seed: 42 }` to `fake()` for reproducible content. To generate rich text instead, see [`RichEditor.fake()`](/forms/rich-editor#generating-fake-rich-content).

## Markdown editor validation

As well as all rules listed on the [validation](/forms/validation) page, you may limit the length of the text with `minLength()` and `maxLength()`:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .minLength(50)
    .maxLength(10000)
```
