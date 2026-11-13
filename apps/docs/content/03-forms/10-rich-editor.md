---
title: Rich editor
---

## Introduction

The rich editor allows you to edit and preview HTML content. It uses [TipTap](https://tiptap.dev) as the underlying editor:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
```

In the browser, the editor works on a TipTap document. On the server, Navette converts the record's HTML into a document when the form is filled, and converts the document back into HTML when the form is saved. By default, the column receives HTML.

<Aside variant="warning">
Custom text colors, custom blocks, merge tags, mentions, resizable images and extending the editor with TipTap plugins or extensions are not available yet. Only the tools listed in [customizing the toolbar buttons](#customizing-the-toolbar-buttons) exist: there is no `h1`, `highlight`, `textColor`, `code`, `grid`, `horizontalRule`, `clearFormatting`, `details`, `lead` or `small` tool.
</Aside>

## Storing content as JSON

By default, the rich editor stores content as HTML. If you would like to store the content as JSON instead, you can use the `json()` method:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .json()
```

The JSON is in [TipTap's](https://tiptap.dev) format, which is a structured representation of the content. The saved document goes through the same cleaning as HTML (see [security](#security)): it is rendered to HTML, then parsed again with the editor's schema. An empty document is saved as `null`.

Store the value in a JSON column: with an Objection model, list the column in `static jsonAttributes`. When the form is filled, the field accepts the document as an object or as a JSON string, and still accepts HTML, so an existing HTML column can be converted progressively.

## Customizing the toolbar buttons

You may set the toolbar buttons for the editor using the `toolbarButtons()` method. The options shown here are the defaults:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .toolbarButtons([
        ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript', 'link'],
        ['h2', 'h3'],
        ['alignStart', 'alignCenter', 'alignEnd'],
        ['blockquote', 'codeBlock', 'bulletList', 'orderedList'],
        ['table', 'attachFiles'],
        ['undo', 'redo'],
    ])
```

Each nested list in the main list represents a group of buttons in the toolbar. A flat list, such as `['bold', 'italic', 'link']`, is a single group.

The available tools are exported as `RICH_EDITOR_TOOLS`, in their default groups. An unknown tool name throws an error when the field is configured.

The `attachFiles` button is only shown when a storage is available for [uploaded images](#uploading-images-to-the-editor). The link button opens a modal asking for the URL and whether to open it in a new tab. Only `http(s)://`, `mailto:`, `tel:`, relative (`/…`) and anchor (`#…`) URLs are accepted. When the cursor is in a table, a floating toolbar lets the user add, delete, merge and split rows, columns and cells.

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .toolbarButtons([
        ['bold', 'italic', 'underline', 'link'],
        ['h2', 'h3'],
        ['bulletList', 'orderedList'],
        ['undo', 'redo'],
    ])
```

```preview
RichEditor.make('content')
    .toolbarButtons([
        ['bold', 'italic', 'underline', 'link'],
        ['h2', 'h3'],
        ['bulletList', 'orderedList'],
        ['undo', 'redo'],
    ])
```

You may also remove some buttons from the toolbar with `disableToolbarButtons()`, or remove the whole toolbar with `disableAllToolbarButtons()`:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .disableToolbarButtons(['table', 'attachFiles'])
```

## Setting a placeholder

You may display a placeholder while the editor is empty:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .placeholder('Write your article…')
```

## Making the field live

When the rich editor is `live()`, its document is sent to the server as soon as it changes, and the form is re-rendered. See [reactivity](/forms/overview#the-basics-of-reactivity).

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .live()
```

## Rendering rich content

The saved HTML contains only the elements and attributes the editor knows. You may output it in your own views as HTML:

```html
<div class="fi-prose"><%- post.content %></div>
```

The HTML is only cleaned when it is saved through the form. If the column may also be written by something else (an import, an API, a seeder), clean it before output with the functions the editor uses:

```ts
import { richDocumentToHtml, richHtmlToDocument } from '@navette-js/forms';

const safeHtml = richDocumentToHtml(richHtmlToDocument(untrustedHtml)) ?? '';
```

`richHtmlToDocument()` parses HTML into a TipTap document, dropping what the editor's schema doesn't know. `richDocumentToHtml()` renders a document to HTML, cleaned the same way, and returns `null` for an empty or invalid document.

If you're [storing content as JSON](#storing-content-as-json), render the document with `richDocumentToHtml()`:

```ts
import { richDocumentToHtml } from '@navette-js/forms';

const html = richDocumentToHtml(post.content) ?? '';
```

## Security

The document comes from the browser, so the server never trusts it. Before saving, Navette renders the document to HTML and parses it again with the editor's schema, so that only known nodes, marks and attributes survive:

- `<script>` elements, event attributes such as `onclick` and `onerror`, and unknown elements are removed.
- Links with a `javascript:` URL are removed, even when the browser sends a forged document.
- An empty document (no text, image or horizontal rule) is saved as `null`.

What your application must still do: clean HTML that reaches the column without going through the form, as shown in [rendering rich content](#rendering-rich-content), and set a Content Security Policy as a second line of defense.

## Uploading images to the editor

The `attachFiles` toolbar button lets the user upload images into the content. Uploads must be [set up](/forms/file-upload#setting-up-uploads): images are sent to the temporary upload store, then stored in `FileUpload.storage` by default. Without a storage, the `attachFiles` button is removed. You may customize where images are stored using configuration methods:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .fileAttachmentsStorage(attachmentsStorage)
    .fileAttachmentsDirectory('attachments')
```

`fileAttachmentsStorage()` accepts any [`FileStorage`](/advanced/file-storage#storing-files). Images are stored without a chosen name (`LocalFileStorage` gives them a random one), and the editor inserts the URL returned by the storage. Only URLs starting with `/` or `http(s)://` are accepted: since that URL is saved in the content, use a storage whose URLs stay valid.

An image is stored as soon as the editor asks for its URL, right after the upload, not when the form is saved. It therefore stays stored if the user removes it from the content, or leaves without saving the form.

Panel pages, including [custom pages](/resources/custom-pages), can receive editor uploads. If you use the rich editor in your own wire component, declare a public `componentFileAttachments` property, initialized to `{}`: the browser uploads images into it, and attaching files fails without it.

### Validating uploaded images

You may use the `fileAttachmentsAcceptedFileTypes()` method to control a list of accepted MIME types for uploaded images. By default, `image/png`, `image/jpeg`, `image/gif`, and `image/webp` are accepted. Only image types are kept, and `image/svg+xml` is always refused:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .fileAttachmentsAcceptedFileTypes(['image/png', 'image/jpeg'])
```

You may use the `fileAttachmentsMaxSize()` method to control the maximum file size for uploaded images. The size is specified in kilobytes. By default, the maximum size is 12288 KB (12 MB):

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .fileAttachmentsMaxSize(5120) // 5 MB
```

Both checks run in the browser, and again on the server before the image is stored. On the server, the type is [detected from the file's content](/advanced/file-storage#checking-the-type-of-a-file), never from its name or the type announced by the browser. The `maxFileSize` of the temporary upload store also applies.

## Rich editor validation

A `required()` rich editor fails when the document has no content, even if it contains empty paragraphs. Other [validation rules](/forms/validation) receive the editor document, not the HTML.
