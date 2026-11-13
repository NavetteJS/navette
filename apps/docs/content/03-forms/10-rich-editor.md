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

Besides text formatting, the editor offers [text colors](#customizing-text-colors), [custom blocks](#using-custom-blocks), [merge tags](#using-merge-tags), [mentions](#using-mentions), [resizable images](#allowing-users-to-resize-images), and you can [extend it](#extending-the-rich-editor) with your own tools and TipTap extensions.

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

The default groups are exported as `RICH_EDITOR_TOOLS`. Every built-in tool is described in `RICH_EDITOR_TOOL_DEFINITIONS`; besides the defaults, they are:

| Tool | Effect |
|---|---|
| `h1`, `h4`, `h5`, `h6`, `paragraph` | Other heading levels, back to a paragraph |
| `code`, `highlight`, `small` | Inline code, highlighted text, small text |
| `lead` | A "lead" introduction (`<div class="lead">`) |
| `textColor` | [Text color](#customizing-text-colors) |
| `horizontalRule`, `clearFormatting`, `alignJustify` | A separator, removing formatting, justified text |
| `grid` | Columns (with a floating toolbar to add and remove columns) |
| `customBlocks`, `mergeTags` | The [blocks](#using-custom-blocks) and [merge tags](#using-merge-tags) panels |

An unknown tool name throws an error when the field is configured. You may add [your own tools](#adding-your-own-toolbar-buttons).

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

## Keeping the toolbar visible while scrolling

In a long document, `stickyToolbar()` keeps the toolbar at the top of the screen while the user scrolls the content:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .stickyToolbar()
```

## Customizing text colors

The `textColor` tool opens a modal to color the selected text. By default, it offers the Tailwind palette (shade 600, and 400 in dark mode). You may offer your own colors with `textColors()`, keyed by the name stored in the content:

```ts
import { RichEditor, TextColor } from '@navette-js/forms';

RichEditor.make('content')
    .toolbarButtons([['bold', 'italic', 'textColor'], ['undo', 'redo']])
    .textColors({
        brand: TextColor.make('Brand', '#0ea5e9', '#38bdf8'),
        warning: TextColor.make('Warning', '#c2410c', '#fb923c'),
    })
```

`TextColor.make(label, color, darkColor)` takes any CSS colors; the dark one defaults to the light one. Keep the default colors with `{ ...TextColor.getDefaults(), brand: … }`. The colored text is stored as `<span class="color" data-color="brand" style="--color: …; --dark-color: …">`.

To let users pick any color, besides the listed ones, use `customTextColors()`: the modal then shows a color picker.

```ts
RichEditor.make('content')
    .textColors({ brand: TextColor.make('Brand', '#0ea5e9') })
    .customTextColors()
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

The saved HTML contains only the elements and attributes the editor knows. When it uses [custom blocks](#using-custom-blocks), [merge tags](#using-merge-tags) or [mentions](#using-mentions), render it with `RichContentRenderer`, which replaces them with their final HTML:

```ts
import { RichContentRenderer } from '@navette-js/forms';

const html = await RichContentRenderer.make(post.content)
    .customBlocks([CallToActionBlock])
    .mergeTags({ name: customer.name, today: new Date().toDateString() })
    .mentions([users])
    .toHtml();
```

The renderer accepts HTML or a [JSON document](#storing-content-as-json), and always cleans it first with the editor's schema. Otherwise, you may output the HTML in your own views as it is:

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

## Allowing users to resize images

With `resizableImages()`, an image shows handles to resize it; its width and height are saved on the image (`width` and `height` attributes and style):

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .resizableImages()
```

## Using custom blocks

Custom blocks are elements users insert in the content: a call to action, a video, a product card… Each block is a class extending `RichContentCustomBlock`, with an id and a label. Its fields are added to its modal in `configureEditorAction()`; their values are its configuration:

```ts
import type { Action } from '@navette-js/actions';
import { RichContentCustomBlock, TextInput } from '@navette-js/forms';

export class CallToActionBlock extends RichContentCustomBlock {
    static getId() { return 'callToAction'; }

    static getLabel() { return 'Call to action'; }

    static configureEditorAction(action: Action) {
        return action
            .modalDescription('A button linking to another page')
            .schema([
                TextInput.make('label').required(),
                TextInput.make('url').label('URL').required().url(),
            ]);
    }
}
```

A block without fields is inserted directly, without a modal. Register the blocks on the editor, and add the `customBlocks` tool, which opens the blocks panel:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .toolbarButtons([['bold', 'italic', 'link'], ['customBlocks'], ['undo', 'redo']])
    .customBlocks([CallToActionBlock, VideoBlock])
```

Users click a block, or drag it into the content. An inserted block shows "Edit" and "Delete" buttons. It is stored as `<div data-type="customBlock" data-id="callToAction" data-config="{…}">`.

### Rendering a preview for a custom block

In the editor, a block shows its label. To show a preview instead, return HTML from `toPreviewHtml()`, and a label depending on the configuration from `getPreviewLabel()`. Build the HTML from values escaped with `e()`:

```ts
import { e } from '@navette-js/support';

export class CallToActionBlock extends RichContentCustomBlock {
    // …
    static getPreviewLabel(config: Record<string, unknown>) {
        return `Call to action: ${String(config.label ?? '')}`;
    }

    static toPreviewHtml(config: Record<string, unknown>) {
        return `<p><strong>${e(config.label)}</strong> → ${e(config.url)}</p>`;
    }
}
```

`shouldApplyProseStylingToPreview()` returning `true` styles the preview like the content.

#### Using minimal custom block controls

`minimalCustomBlockControls()` replaces the "Edit" and "Delete" buttons of the inserted blocks by smaller icon buttons:

```ts
RichEditor.make('content')
    .customBlocks([CallToActionBlock])
    .minimalCustomBlockControls()
```

### Rendering content with custom blocks

The stored content only holds each block's configuration. Its final HTML comes from `toHtml()`, called by the [renderer](#rendering-rich-content); `data` is what you pass with the block to the renderer. A block returning `null`, or one the renderer doesn't know, is left out:

```ts
export class CallToActionBlock extends RichContentCustomBlock {
    // …
    static toHtml(config: Record<string, unknown>, data: Record<string, unknown>) {
        return `<a class="button" href="${e(config.url)}">${e(config.label)}</a>`;
    }
}

const html = await RichContentRenderer.make(post.content)
    .customBlocks({ callToAction: { block: CallToActionBlock, data: { campaign: 'spring' } } })
    .toHtml();
```

<Aside variant="danger">
The HTML returned by `toHtml()` and `toPreviewHtml()` is inserted as it is. The configuration comes from the browser: escape every value with `e()`, and check URLs (for instance, accept only `https://`).
</Aside>

### Adding icons to custom blocks

`getIcon()` adds an icon next to the block in the panel:

```ts
export class CallToActionBlock extends RichContentCustomBlock {
    // …
    static getIcon() { return 'o-cursor-arrow-rays'; }
}
```

### Displaying custom blocks in a grid

```ts
RichEditor.make('content')
    .customBlocks([CallToActionBlock, VideoBlock, QuoteBlock])
    .customBlocksGrid()
```

### Grouping custom blocks

Pass an object of groups, keyed by their label:

```ts
RichEditor.make('content')
    .customBlocks({
        Marketing: [CallToActionBlock, PricingBlock],
        Media: [VideoBlock, GalleryBlock],
    })
```

### Searching custom blocks

With many blocks, `searchableCustomBlocks()` adds a search field to the panel, matching block and group labels:

```ts
RichEditor.make('content')
    .customBlocks({ Marketing: [CallToActionBlock, PricingBlock], Media: [VideoBlock, GalleryBlock] })
    .searchableCustomBlocks()
```

### Opening the custom blocks panel by default

```ts
RichEditor.make('content')
    .customBlocks([CallToActionBlock])
    .activePanel('customBlocks')
```

## Using merge tags

Merge tags are placeholders replaced by a value when the content is rendered: the name of the customer an email is sent to, today's date… Declare them with `mergeTags()`, and add the `mergeTags` tool, which opens a panel listing them. Users can also type `{{` in the text to search them:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .toolbarButtons([['bold', 'italic'], ['mergeTags'], ['undo', 'redo']])
    .mergeTags(['name', 'today'])
```

A merge tag is stored as `<span data-type="mergeTag" data-id="name">`.

### Rendering content with merge tags

Give their values to the [renderer](#rendering-rich-content). A value is text (escaped), or a function returning it, computed only if the tag is used. A tag without a value is rendered as `{{ name }}`:

```ts
const html = await RichContentRenderer.make(email.body)
    .mergeTags({
        name: customer.name,
        today: () => new Date().toLocaleDateString('en-GB'),
    })
    .toHtml();
```

#### Using HTML content in merge tags

A value wrapped in `HtmlString` is inserted as HTML: build it from escaped values.

```ts
import { HtmlString, e } from '@navette-js/support';

RichContentRenderer.make(email.body)
    .mergeTags({ signature: new HtmlString(`<strong>${e(user.name)}</strong><br>${e(user.title)}`) })
```

### Using custom merge tag labels

The editor shows the id of each tag. To show a label instead, pass an object, keyed by the id:

```ts
RichEditor.make('content')
    .mergeTags({ name: 'Customer name', today: "Today's date" })
```

### Opening the merge tags panel by default

```ts
RichEditor.make('content')
    .mergeTags(['name', 'today'])
    .activePanel('mergeTags')
```

## Using mentions

Mentions let users refer to people or things by typing a trigger character, such as `@`: a list of matches appears as they type. Each `MentionProvider` handles one trigger character:

```ts
import { MentionProvider, RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .mentions([
        MentionProvider.make('@').items({ 1: 'Ada Lovelace', 2: 'Grace Hopper' }),
        MentionProvider.make('#').items({ urgent: 'Urgent', billing: 'Billing' }),
    ])
```

A mention is stored as `<span data-type="mention" data-id="1" data-label="Ada Lovelace" data-char="@">@Ada Lovelace</span>`. `items()` also takes a function, and the provider customizes its messages with `noItemsMessage()`, `noSearchResultsMessage()`, `searchingMessage()` and `searchPrompt()`.

### Searching mentions from the database

With many items, search them on the server as the user types. `getLabelsUsing()` gives the current labels of stored mentions, so that a renamed user shows their new name:

```ts
MentionProvider.make('@')
    .getSearchResultsUsing(async (search) => Object.fromEntries(
        (await knex('users').whereLike('name', `%${search}%`).limit(10)).map((user) => [String(user.id), user.name]),
    ))
    .getLabelsUsing(async (ids) => Object.fromEntries(
        (await knex('users').whereIn('id', ids)).map((user) => [String(user.id), user.name]),
    ))
```

### Rendering content with mentions

Give the providers to the [renderer](#rendering-rich-content): mentions get their current labels, and become links with `url()`:

```ts
const users = MentionProvider.make('@')
    .getLabelsUsing(labelsOfUsers)
    .url((id) => `/users/${id}`);

const html = await RichContentRenderer.make(post.content).mentions([users]).toHtml();
```

Only `http(s)://`, relative and `mailto:` links are kept.

## Extending the rich editor

### Adding your own toolbar buttons

A `RichEditorTool` is a toolbar button. `jsHandler()` runs JavaScript in the browser, where `$getEditor()` is the [TipTap editor](https://tiptap.dev/docs/editor/api/editor). Register it with `tools()` and place it with `toolbarButtons()`:

```ts
import { RichEditor, RichEditorTool } from '@navette-js/forms';

RichEditor.make('content')
    .tools([
        RichEditorTool.make('signature')
            .label('Insert signature')
            .icon('m-pencil')
            .jsHandler(`$getEditor()?.chain().focus().insertContent('<p>— The team</p>').run()`),
    ])
    .toolbarButtons([['bold', 'italic'], ['signature'], ['undo', 'redo']])
```

`toggle()` makes it a toggle button, active when the node or mark of `activeKey()` (its name by default) is selected, or when `activeJsExpression()` is true. A tool with the name of a built-in one replaces it.

To run server code, `action()` mounts an action of the field instead: declare it with `editorActions()`. It receives the editor selection in `arguments.editorSelection`, and sends commands back to the editor with `runCommands()`:

```ts
import { Action } from '@navette-js/actions';
import { RichEditor, RichEditorTool, TextInput } from '@navette-js/forms';
import { e } from '@navette-js/support';

const editor = RichEditor.make('content');

editor
    .tools([RichEditorTool.make('quote').label('Quote').icon('m-chat-bubble-left').action()])
    .editorActions([
        Action.make('quote')
            .schema([TextInput.make('text').required(), TextInput.make('author')])
            .action(({ livewire, arguments: args, data }) => {
                editor.runCommands(livewire, [
                    { name: 'insertContent', arguments: [`<blockquote><p>${e(data.text)}</p><p>— ${e(data.author)}</p></blockquote>`] },
                ], args.editorSelection);
            }),
    ])
    .toolbarButtons([['bold', 'italic'], ['quote']])
```

### Setting up a TipTap JavaScript extension

TipTap extensions add nodes, marks and behaviors. Load a browser extension with `extensions()`: each URL is an ES module whose default export is an extension (or an array of extensions). It must import TipTap from the same bundle as the editor, so build it for the browser yourself and serve it as a static file:

```ts
RichEditor.make('content')
    .extensions(['/js/rich-editor/emoji.js'])
```

On the server, the editor's schema decides what is kept when the content is saved: register the matching server extension (any `@tiptap/core` `Node`, `Mark` or `Extension`), or its content is removed:

```ts
import { Node } from '@tiptap/core';
import { registerRichContentExtensions } from '@navette-js/forms';

registerRichContentExtensions(Node.create({
    name: 'emoji',
    group: 'inline', inline: true, atom: true,
    addAttributes: () => ({ name: { default: null } }),
    parseHTML: () => [{ tag: 'span[data-emoji]' }],
    renderHTML: ({ HTMLAttributes }) => ['span', { 'data-emoji': HTMLAttributes.name }],
}));
```

Registered extensions apply to every rich editor and to the renderer. The `details` tool of Filament is not available.

## Security

The document comes from the browser, so the server never trusts it. Before saving, Navette renders the document to HTML and parses it again with the editor's schema, so that only known nodes, marks and attributes survive:

- `<script>` elements, event attributes such as `onclick` and `onerror`, and unknown elements are removed.
- Links with a `javascript:` URL are removed, even when the browser sends a forged document.
- Text colors are kept only when they are known colors or plain CSS colors (`#0ea5e9`, `rgb(…)`, `oklch(…)`, a color name): anything else, such as `red; background: url(…)`, is dropped. Image sizes must be plain lengths.
- Custom block configurations, merge tags and mentions are kept as data; their HTML is only produced by your code when [rendering](#rendering-rich-content), so escape it there.
- An empty document (no text, image, horizontal rule, block, merge tag or mention) is saved as `null`.

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
