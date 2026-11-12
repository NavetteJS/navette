---
title: Rich editor
---

## Introduction

The rich editor allows you to edit and preview HTML content. It uses [TipTap](https://tiptap.dev) as the underlying editor, like Filament:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
```

In the browser, the editor works on a TipTap document. On the server, Navette converts the record's HTML into a document when the form is filled, and converts the document back into HTML when the form is saved. The column receives HTML.

## Understanding the toolbar

The toolbar is the one of Filament's default rich editor: bold, italic, underline, strikethrough, subscript, superscript, link, headings (2 and 3), text alignment, blockquote, code block, bullet and numbered lists, tables, undo and redo.

The link button opens a modal asking for the URL and whether to open it in a new tab. Only `http(s)://`, `mailto:`, `tel:`, relative (`/…`) and anchor (`#…`) URLs are accepted.

<Aside variant="warning">
Customizing the toolbar, storing content as JSON, custom text colors, uploading images (the "Attach files" button), custom blocks, merge tags, mentions and extending the editor with TipTap plugins are not available yet.
</Aside>

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

`richHtmlToDocument()` parses HTML into a TipTap document, dropping what the editor's schema doesn't know. `richDocumentToHtml()` renders a document to HTML, and returns `null` for an empty or invalid document.

## Security

The document comes from the browser, so the server never trusts it. Before saving, Navette renders the document to HTML and parses it again with the editor's schema, so that only known nodes, marks and attributes survive:

- `<script>` elements, event attributes such as `onclick` and `onerror`, and unknown elements are removed.
- Links with a `javascript:` URL are removed, even when the browser sends a forged document.
- An empty document (no text, image or horizontal rule) is saved as `null`.

What your application must still do: clean HTML that reaches the column without going through the form, as shown in [rendering rich content](#rendering-rich-content), and set a Content Security Policy as a second line of defense.

## Rich editor validation

A `required()` rich editor fails when the document has no content, even if it contains empty paragraphs. Other [validation rules](/forms/validation) receive the editor document, not the HTML.
