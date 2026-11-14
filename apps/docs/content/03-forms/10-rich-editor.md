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
        ['table', 'attachFiles'], // The `customBlocks` and `mergeTags` tools are also added here if those features are used.
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
| `details` | A collapsible section (`<details>` with its `<summary>`) |
| `customBlocks`, `mergeTags` | The [blocks](#using-custom-blocks) and [merge tags](#using-merge-tags) panels |
| `table…`, `grid…` | The table and grid tools of the [floating toolbars](#customizing-floating-toolbars): `tableAddColumnBefore`, `tableAddRowAfter`, `tableMergeCells`, `gridDelete`… |

An unknown tool name throws an error when the field is configured: add [your own tools](#adding-your-own-toolbar-buttons) and [plugins](#creating-a-plugin) before calling `toolbarButtons()`.

The `attachFiles` button is only shown when a storage is available for [uploaded images](#uploading-images-to-the-editor). The link button opens a modal asking for the URL and whether to open it in a new tab. Only URLs with one of the [allowed protocols](#allowing-link-protocols), relative (`/…`) and anchor (`#…`) URLs are accepted.

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

You may also remove some buttons from the toolbar with `disableToolbarButtons()` (also inside [dropdowns](#grouping-toolbar-buttons-into-dropdowns)), add buttons after the current ones with `enableToolbarButtons()` (a nested list adds a group; buttons already in the toolbar are skipped), or remove the whole toolbar with `disableAllToolbarButtons()`:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .disableToolbarButtons(['table', 'attachFiles'])
    .enableToolbarButtons([['highlight', 'horizontalRule']])
```

`hasToolbarButton('table')` tells whether a tool (or every tool of a list) ends up in the toolbar. Calling `toolbarButtons()` again resets the enabled and disabled buttons.

### Using the toolbar with a keyboard

You can enter the main toolbar using Tab, or Shift+Tab from the editor. The toolbar has one tab stop, which remembers the last focused tool. Use the left and right arrow keys to move between tools, and Home or End to reach the first or last tool. Disabled and hidden tools are skipped. Enter or Space activates the focused tool. Escape returns to the editor without changing the selection.

### Customizing floating toolbars

A floating toolbar shows tools next to the cursor, only while it is inside a given node type: this keeps the main toolbar short. You may set them with `floatingToolbars()`, keyed by node name. In the example below, a toolbar with formatting buttons appears when text is selected in a paragraph, heading tools appear in a heading, and grids and tables show their own controls:

```ts
import { RichEditor, ToolbarButtonGroup } from '@navette-js/forms';

RichEditor.make('content')
    .floatingToolbars({
        paragraph: ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript'],
        heading: [ToolbarButtonGroup.make('Heading', ['h1', 'h2', 'h3'])],
        grid: ['gridAddColumnBefore', 'gridAddColumnAfter', 'gridDeleteColumn', 'gridDelete'],
        table: [
            'tableAddColumnBefore', 'tableAddColumnAfter', 'tableDeleteColumn',
            'tableAddRowBefore', 'tableAddRowAfter', 'tableDeleteRow',
            'tableMergeCells', 'tableSplitCell',
            'tableToggleHeaderRow', 'tableToggleHeaderCell',
            'tableDelete',
        ],
    })
```

By default, the `grid` and `table` toolbars above are shown. Pass `{}` to remove every floating toolbar, or `null` to restore the defaults. A `paragraph` toolbar only appears once some text is selected. A disabled editor has no floating toolbar.

You can press Alt+F10 inside the editor to enter an applicable floating toolbar, or the main toolbar if none applies. Press Alt+F10 again to cycle through the applicable floating toolbars, then the main toolbar. Floating toolbars use the same arrow, Home, End and Escape keys as the main toolbar.

### Grouping toolbar buttons into dropdowns

You may group related toolbar buttons into a dropdown menu using `ToolbarButtonGroup`. The first argument is a label used for the dropdown's tooltip and accessible name, and the second one is the list of button names to include:

```ts
import { RichEditor, ToolbarButtonGroup } from '@navette-js/forms';

RichEditor.make('content')
    .toolbarButtons([
        ['bold', 'italic', 'underline', 'strike'],
        [ToolbarButtonGroup.make('Paragraph', ['paragraph', 'h1', 'h2', 'h3'])],
        [ToolbarButtonGroup.make('Alignment', ['alignStart', 'alignCenter', 'alignEnd', 'alignJustify'])],
        ['blockquote', 'codeBlock', 'bulletList', 'orderedList'],
        ['undo', 'redo'],
    ])
```

By default, the first button's icon is used as the dropdown trigger, and it changes to show the active button. Clicking the trigger reveals the grouped buttons. A focused dropdown also opens with Enter, Space or the up and down arrow keys; inside the menu, the arrow keys, Home and End move between tools, Escape closes the menu and returns to its trigger, and Tab leaves it. Toggle tools are checked menu items (`menuitemcheckbox`).

You can set a fixed icon for the trigger with `icon()`: it then no longer follows the active button. `extraAttributes()` adds HTML attributes to the trigger:

```ts
import { RichEditor, ToolbarButtonGroup } from '@navette-js/forms';

RichEditor.make('content')
    .toolbarButtons([
        ['bold', 'italic'],
        [ToolbarButtonGroup.make('Heading', ['h1', 'h2', 'h3']).icon('fi-o-heading')],
        ['undo', 'redo'],
    ])
```

### Using textual dropdown toolbar buttons

Dropdown buttons show icons only, in a horizontal menu. To show each button's label next to its icon, in a vertical menu, use `textualButtons()`:

```ts
import { RichEditor, ToolbarButtonGroup } from '@navette-js/forms';

RichEditor.make('content')
    .toolbarButtons([
        ['bold', 'italic', 'underline', 'strike', 'link'],
        [ToolbarButtonGroup.make('Paragraph', ['paragraph', 'h1', 'h2', 'h3']).textualButtons()],
        [ToolbarButtonGroup.make('Alignment', ['alignStart', 'alignCenter', 'alignEnd', 'alignJustify'])],
        ['undo', 'redo'],
    ])
```

Dropdown groups can also be used in [floating toolbars](#customizing-floating-toolbars).

## Setting the height

You may control the editor's height with `minHeight()` and `maxHeight()`, which accept any CSS length:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .minHeight('12rem')
    .maxHeight('24rem')
```

The editor has a minimum height of `10rem` by default. Once the content exceeds `maxHeight()`, the editor stops growing and its content scrolls. Each method may be used on its own: pass `null` to `minHeight()` to use the intrinsic `3rem` minimum, or to `maxHeight()` to remove the limit. Both also accept a function of the field's context.

## Keeping the toolbar and panels visible while scrolling

In a long document, `stickyToolbar()` keeps the toolbar at the top of the screen while the user scrolls the content:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .stickyToolbar()
```

You can also keep the [custom blocks](#using-custom-blocks) and [merge tags](#using-merge-tags) panels visible with `stickyPanels()`. Each option can be enabled independently:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .stickyToolbar()
    .stickyPanels()
```

Panels only stick when the editor is wide enough to show them beside the content; in narrower editors they scroll with the page. Inside an action modal or slide-over, sticky panels fit within the modal's scrollable area.

### Setting the sticky offset

Inside a panel, the sticky toolbar and panels account for the topbar (and inside a modal, for its sticky header). If your page has its own fixed header, set the distance from the top of the viewport with `stickyOffset()`, a CSS length (`null` restores the automatic offset):

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .stickyToolbar()
    .stickyPanels()
    .stickyOffset('5rem')
```

`stickyPanels()` and `stickyOffset()` also accept a function of the field's context.

## Allowing link protocols

By default, links may use the `http`, `https`, `ftp`, `ftps`, `mailto`, `tel`, `callto`, `sms`, `cid` and `xmpp` protocols, besides relative and anchor URLs. You may change the list with `linkProtocols()`, to restrict it or to allow an application's own scheme:

```ts
import { RichEditor } from '@navette-js/forms';

RichEditor.make('content')
    .linkProtocols(['https', 'mailto', 'notion'])
```

The list is checked on the server: the link modal refuses other URLs, and a link with another protocol in the submitted document (or in content rendered with a [renderer](#rendering-rich-content) given the same `linkProtocols()`) is removed when the content is saved. `javascript:` links are never kept.

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

The renderer accepts HTML or a [JSON document](#storing-content-as-json), and always cleans it first with the editor's schema. Give it the same [plugins](#creating-a-plugin) and [link protocols](#allowing-link-protocols) as the editor with `plugins()` and `linkProtocols()`, and the storage of [private images](#using-private-images-in-the-editor) with `fileAttachmentsStorage()` and `fileAttachmentsVisibility()`. `toText()` returns the plain text of the rendered content.

An editor gives a renderer configured like itself (custom blocks, mentions, plugins, link protocols and attachments) with `getRenderer(content)`:

```ts
// The editor of the form, built by a function shared with the resource's form.
const contentEditor = () => RichEditor.make('content').customBlocks([CallToActionBlock]).mentions([users]);

const html = await contentEditor().getRenderer(post.content).mergeTags({ name: customer.name }).toHtml();
```

`renderRichDocument(content)` is the short form of `getRenderer(content).toHtml()`, like Filament's `renderRichContent()`:

```ts
const html = await contentEditor().renderRichDocument(post.content);
```

<Aside variant="warning">
`@navette-js/forms` also exports a lower-level function of the same name, `renderRichDocument(document, { linkProtocols, extensions })`, which turns a TipTap document into HTML **without** cleaning it: it is what the renderer calls once it has cleaned the content. Never pass it a document that could come from a user or another system; use the editor's method, `RichContentRenderer` or `richDocumentToHtml()` instead.
</Aside>

Otherwise, you may output the HTML in your own views as it is:

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

A merge tag is stored as `<span data-type="mergeTag" data-id="name">`. When the search after `{{` finds nothing, the editor shows "No merge tag results."; change it with `noMergeTagSearchResultsMessage()`:

```ts
RichEditor.make('content')
    .mergeTags(['name', 'today'])
    .noMergeTagSearchResultsMessage('No such placeholder.')
```

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

`extraAttributes()` adds HTML attributes to the mentions this provider inserts in the editor (a class to style them, for example):

```ts
MentionProvider.make('#').items({ urgent: 'Urgent' }).extraAttributes({ class: 'tag-mention' })
```

The attributes are not escaped in the browser: never build them from user input.

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

`toggle()` makes it a toggle button (`aria-pressed`), active when the node or mark of `activeKey()` (its name by default) is selected, or when `activeJsExpression()` is true. A tool with the name of a built-in one replaces it. Other options of a tool:

| Method | Effect |
|---|---|
| `activeOptions({ level: 2 })` | Attributes the `activeKey()` node or mark must have (TipTap's `isActive(key, options)`): `h2` is `activeKey('heading').activeOptions({ level: 2 })` |
| `activeStyling(false)` | No active style (`fi-active`) on the button, even when its expression is true |
| `disabledWhenNotActive()` | The button is disabled while its active expression is false (the grid tools use `activeJsExpression('$getEditor()?.can().addGridColumnBefore()')` with it) |
| `iconAlias('…')` | An [icon alias](/styling/icons#replacing-the-default-icons): an icon registered for it replaces `icon()` |
| `extraAttributes({ … })` | HTML attributes added to the button (`data-testid`…) |
| `hiddenLabel(false)` | Shows the label next to the icon, instead of a tooltip |

Custom tools take part in the toolbar's keyboard navigation, and can be used in [dropdowns](#grouping-toolbar-buttons-into-dropdowns) and [floating toolbars](#customizing-floating-toolbars).

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

Registered extensions apply to every rich editor and to the renderer. To scope an extension to some editors, ship it in a [plugin](#creating-a-plugin) instead.

### Creating a plugin

A plugin bundles TipTap extensions for the server and the browser, toolbar tools, and the actions they mount. Write a class implementing `RichContentPlugin`:

```ts
import { Action } from '@navette-js/actions';
import { RichEditorTool, type RichContentPlugin } from '@navette-js/forms';
import { Mark } from '@tiptap/core';

export class HighlightRichContentPlugin implements RichContentPlugin {
    static make() { return new this(); }

    // Server side (Filament's `getTipTapPhpExtensions()`): what is kept when the content is saved or rendered.
    getTipTapServerExtensions() {
        return [Mark.create({ name: 'marker', parseHTML: () => [{ tag: 'span[data-marker]' }], renderHTML: () => ['span', { 'data-marker': '' }, 0] })];
    }

    // Browser side: ES modules exporting the matching TipTap extension.
    getTipTapJsExtensions() {
        return ['/js/rich-editor/marker.js'];
    }

    getEditorTools() {
        return [
            RichEditorTool.make('marker').label('Marker').icon('m-pencil').toggle().jsHandler("$getEditor()?.chain().focus().toggleMark('marker').run()"),
            RichEditorTool.make('markerColor').label('Marker color').icon('m-swatch').action(),
        ];
    }

    getEditorActions() {
        return [Action.make('markerColor').schema([/* … */]).action(() => { /* … */ })];
    }
}
```

Register it with `plugins()`, then place its tools with `toolbarButtons()`, and give it to the [renderer](#rendering-rich-content) too:

```ts
RichEditor.make('content')
    .plugins([HighlightRichContentPlugin.make()])
    .toolbarButtons([['bold', 'italic', 'marker', 'markerColor'], ['undo', 'redo']])

await RichContentRenderer.make(post.content).plugins([HighlightRichContentPlugin.make()]).toHtml();
```

A plugin tool with the name of another tool replaces it. Unlike `registerRichContentExtensions()`, the plugin's server extensions only apply to the editors and renderers it is given to.

#### Enabling or disabling toolbar buttons from a plugin

A plugin may also add buttons to the toolbar, or remove some, with the optional `getEnabledToolbarButtons()` and `getDisabledToolbarButtons()` methods (Filament's `HasToolbarButtons`). They work like [`enableToolbarButtons()` and `disableToolbarButtons()`](#customizing-the-toolbar-buttons), and apply before the field's own changes, which therefore take precedence:

```ts
export class HighlightRichContentPlugin implements RichContentPlugin {
    // …
    getEnabledToolbarButtons() {
        return [['marker', 'markerColor']];
    }

    getDisabledToolbarButtons() {
        return ['highlight'];
    }
}
```

## Security

The document comes from the browser, so the server never trusts it. Before saving, Navette renders the document to HTML and parses it again with the editor's schema, so that only known nodes, marks and attributes survive:

- `<script>` elements, event attributes such as `onclick` and `onerror`, and unknown elements are removed.
- Links with a `javascript:` URL are removed, even when the browser sends a forged document, and so are links with a protocol outside [`linkProtocols()`](#allowing-link-protocols).
- An image's `data-id` is only accepted if the record already holds it, or if it is a new upload: see [securing file attachment IDs](#securing-file-attachment-ids).
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

`fileAttachmentsStorage()` accepts any [`FileStorage`](/advanced/file-storage#storing-files). While the form is being edited, an uploaded image is shown through a temporary signed URL of the upload store (`/livewire/preview-file/…`, valid for 30 minutes), and nothing is stored yet. When the form is saved, the image is stored, without a chosen name (`LocalFileStorage` gives it a random one): its key is saved in the image's `data-id` attribute, with the storage's URL in `src`. Only URLs starting with `/` or `http(s)://` are accepted. An image removed before saving, or a form left without saving, stores nothing: the temporary file is swept by the upload store.

You may store the image yourself with `saveUploadedFileAttachmentUsing()`, returning the key saved in `data-id`, and compute the URL of a key with `getFileAttachmentUrlUsing()`:

```ts
RichEditor.make('content')
    .saveUploadedFileAttachmentUsing(async (file) => (await media.add(file.path, file.name)).id)
    .getFileAttachmentUrlUsing((id) => `/media/${id}`)
```

`uploadingFileMessage()` changes the "Uploading file..." message shown during an upload.

### Using private images in the editor

Private images cannot be shown through a permanent URL. With `fileAttachmentsVisibility('private')`, no URL is saved in the content: only the image's `data-id`. Each time the editor is loaded, or the content [rendered](#rendering-rich-content), a temporary URL is generated for each image, valid until the end of the hour following the next 30 minutes:

```ts
RichEditor.make('content')
    .fileAttachmentsStorage(privateStorage)
    .fileAttachmentsVisibility('private')
```

The temporary URL comes from the storage's `temporaryUrl(key, expiresAt)` method: a storage of private files implements it to return a signed URL, served by a route of your application that checks the signature (a bucket's signed URLs, for instance). A storage without that method gives its usual URL. Keep the private files out of any static folder. When rendering the content, give the renderer the same configuration:

```ts
import { RichContentRenderer } from '@navette-js/forms';

const html = await RichContentRenderer.make(post.content)
    .fileAttachmentsStorage(privateStorage)
    .fileAttachmentsVisibility('private')
    .toHtml();
```

### Securing file attachment IDs

The `data-id` of an image is a key of the storage, and like any field value it comes from the browser: a forged request could replace it with the key of someone else's file, which the editor (or the renderer) would then show, with a signed URL for a private image. Navette therefore checks it by default (Filament's `preventFileAttachmentPathTampering()`, opt-in there): the record's saved content is parsed, and only the `data-id` values already present are accepted, besides new uploads. Any other one fails validation, with the `tampered` message, and gets no URL when the form is loaded.

If your application legitimately references other files (an image library, a "copy from another record" action), approve them with the `allowFilePathUsing` argument. It receives the key exactly as submitted: compare it with exact trusted keys, never with a prefix:

```ts
RichEditor.make('content')
    .preventFileAttachmentPathTampering(true, (file) => ['templates/logo.png', 'templates/banner.png'].includes(file))
    .validationMessages({ tampered: 'The content references an image that is not permitted.' })
```

On a create page there is no record: every existing `data-id` needs `allowFilePathUsing` (new uploads are unaffected). `preventFileAttachmentPathTampering(false)` turns the check off: only do it if the storage holds nothing a user should not see.

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

## Generating fake rich content

`RichEditor.fake()` generates content for seeders and tests (Filament's `fake()->filamentRichContent()`). Chain blocks, then get the stored HTML with `toHtml()`, the TipTap document with `toArray()`, or the value as the editor stores it with `toValue()`. The output methods are asynchronous:

```ts
import { RichEditor } from '@navette-js/forms';

await knex('posts').insert({
    title: 'Hello',
    content: await RichEditor.fake()
        .heading()
        .paragraphs(3)
        .bulletList()
        .toHtml(),
});
```

`article(depth)` generates a complete article: a lead introduction, then sections with level-two headings; each level of `depth` (up to 5) adds nested sections with the next heading level. The available blocks are `heading(level)`, `paragraphs(count, marks)`, `lead()`, `bulletList(items)`, `orderedList(items)`, `blockquote()`, `codeBlock(language, code)`, `horizontalRule()`, `table(columns, rows)`, `details()`, `grid(spans, breakpoint)`, `image(url, width, height, alt)` and `fileAttachment(id)` (an existing stored image). `paragraphs()` takes the marks to add, as `{ links, bold, italic, underline, strike, subscript, superscript, code, small, highlight }`:

```ts
await RichEditor.fake().paragraphs(3, { links: true, bold: true, italic: true }).toHtml();
```

`textColor()` colors random text, `textAlignment()` aligns a random block, and `hardBreak()` inserts a line break. Pass `{ seed: 42 }` for reproducible content.

### Using an editor's configuration

Pass an editor with `{ editor }` (Filament's rich content attribute): the faker uses its merge tags, mentions, custom blocks, text colors, link protocols, plugins and JSON mode. `toValue()` then returns the document when the editor uses `json()`, and HTML otherwise; `toRenderedHtml()` and `toText()` render it with the editor's [renderer](#rendering-rich-content):

```ts
const editor = RichEditor.make('content').mergeTags(['name']).mentions([users]).customBlocks([CallToActionBlock]).json();

await RichEditor.fake({ editor })
    .article()
    .mergeTags(2)
    .mention()
    .customBlock()
    .textColor()
    .toValue();
```

`mergeTag()` and `mention()` insert inline nodes into random paragraphs: without arguments, they pick among the editor's merge tags and mention items (`mergeTags(count)` and `mentions(count)` insert several). You may also pass a merge tag id to `mergeTag()`, or a mention id and trigger character to `mention()` (the character is required with several providers).

`customBlock()` without arguments picks among the editor's blocks that have a static `generateFakeConfiguration(faker)` method, so that no block gets an invalid empty configuration. You may also pass a block class or id, with its configuration:

```ts
import { RichContentCustomBlock, type FakeValues } from '@navette-js/forms';

export class CallToActionBlock extends RichContentCustomBlock {
    static generateFakeConfiguration(faker: FakeValues) {
        return { label: faker.sentence(3), url: '/register' };
    }
    // …
}

await RichEditor.fake().customBlock(CallToActionBlock, { label: 'Start building today', url: '/register' }).toHtml();
```

`block(node)` and `inline(node)` insert raw TipTap JSON, such as a [plugin's](#creating-a-plugin) node. `renderUsing(fn)` replaces the renderer used by `toRenderedHtml()`.

`FakeValues` is the seeded generator given to `generateFakeConfiguration()`: `numberBetween()`, `boolean(chance)`, `randomElement()`, `word()`, `words(count)`, `sentence()`, `paragraph()`, `text(maxCharacters)`, `uuid()`, `slug()`, `url()`, `safeEmail()`… With a seed, every random value comes from it, so the output is reproducible.

## Rich editor validation

A `required()` rich editor fails when the document has no content, even if it contains empty paragraphs. Other [validation rules](/forms/validation) receive the editor document, not the HTML.
