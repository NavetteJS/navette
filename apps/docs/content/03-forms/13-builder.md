---
title: Builder
---

## Introduction

Similar to a [repeater](/forms/repeater), the builder component allows you to output a list of items. Unlike the repeater, the builder lets the user pick the type of each item, called a *block*, and each block has its own fields. This is useful for page builders, or any ordered content made of different kinds of parts.

The builder is exported by `@navette-js/forms/builder`:

```ts
import { DatePicker, Select, TagsInput, Textarea, TextInput } from '@navette-js/forms';
import { Block, Builder } from '@navette-js/forms/builder';

Builder.make('plan')
    .blocks([
        Block.make('milestone')
            .schema(() => [
                TextInput.make('title').required(),
                DatePicker.make('target_date').required(),
                Textarea.make('description').rows(2),
            ]),
        Block.make('task_group')
            .schema(() => [
                TextInput.make('title').required(),
                TagsInput.make('tasks').placeholder('Add tasks'),
            ]),
        Block.make('checkpoint')
            .schema(() => [
                TextInput.make('title').required(),
                Select.make('status').options({ pending: 'Pending', passed: 'Passed', failed: 'Failed' }),
            ]),
    ])
```

```preview
// state: {"plan": {"a1": {"type": "milestone", "data": {"title": "Beta", "target_date": "2025-06-01", "description": "First public release, for early adopters."}}, "b2": {"type": "task_group", "data": {"title": "Launch", "tasks": ["Press kit", "Announcement"]}}, "c3": {"type": "checkpoint", "data": {"title": "Security review", "status": "passed"}}}}
// viewport: 900

return Builder.make('plan')
    .blocks([
        Block.make('milestone')
            .schema(() => [
                TextInput.make('title').required(),
                DatePicker.make('target_date').required(),
                Textarea.make('description').rows(2),
            ]),
        Block.make('task_group')
            .schema(() => [
                TextInput.make('title').required(),
                TagsInput.make('tasks').placeholder('Add tasks'),
            ]),
        Block.make('checkpoint')
            .schema(() => [
                TextInput.make('title').required(),
                Select.make('status').options({ pending: 'Pending', passed: 'Passed', failed: 'Failed' }),
            ]),
    ])
```

`Block.schema()` takes a function returning the fields of a block. It is called for each item, and receives `{ builder, itemKey, data }`, where `data` is the current data of the item.

The saved value is a list of blocks. Store it in a JSON column:

```json
[
    { "type": "milestone", "data": { "title": "Beta", "target_date": "2025-06-01", "description": null } },
    { "type": "task_group", "data": { "title": "Launch", "tasks": ["Press kit", "Announcement"] } }
]
```

When the form is filled, the builder accepts this list, the same list as a JSON string, or an object of items keyed by item key. Items with an unknown block type are dropped. If you prefer to save the object of items keyed by item key, use `storedAsList(false)`.

## Setting a block's label

By default, the label of the block is generated from its name: `task_group` becomes "Task group". You may override it with the `label()` method:

```ts
import { Block } from '@navette-js/forms/builder';

Block.make('task_group')
    .label('Group of tasks')
```

### Labelling builder items based on their content

You may add a label for a builder item using the same `label()` method. This method accepts a function that receives the item's data in `state`. If `state` is `null`, you should return the block label that should be displayed in the block picker. Otherwise, you should return a string to be used as the item label:

```ts
import { Block } from '@navette-js/forms/builder';
import { TextInput } from '@navette-js/forms';

Block.make('heading')
    .schema(() => [
        TextInput.make('content')
            .live({ onBlur: true })
            .required(),
        // ...
    ])
    .label(({ state }) => {
        if (state === null) {
            return 'Heading';
        }

        return String(state.content ?? 'Untitled heading');
    })
```

The function also receives the item's `key` and its zero-based `index`. `state` is the raw, unvalidated data sent by the browser; the label is escaped. Any fields that you use from `state` should be `live()` if you wish to see the item label update live as you use the form.

### Numbering builder items

By default, items in the builder have a number next to their label. You may disable this using the `blockNumbers(false)` method:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blockNumbers(false)
```

```preview
// state: {"content": {"a1": {"type": "heading", "data": {"content": "Our roadmap for 2026", "level": "h2"}}, "b2": {"type": "paragraph", "data": {"content": "We are focusing on performance and accessibility this year."}}}}
// viewport: 900

return Builder.make('content')
    .blockNumbers(false)
    .blocks([
        Block.make('heading')
            .icon('m-bookmark')
            .schema(() => [
                TextInput.make('content').required(),
                Select.make('level').options({ h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' }),
            ]),
        Block.make('paragraph')
            .icon('m-bars-3-bottom-left')
            .schema(() => [
                Textarea.make('content').required().rows(2),
            ]),
    ])
```

## Setting a block's icon

Blocks may also have an icon, displayed next to the label in the block picker. Icons are Heroicons names, prefixed with `o-` (outline), `s-` (solid) or `m-` (mini):

```ts
import { Block } from '@navette-js/forms/builder';

Block.make('milestone')
    .icon('m-flag')
```

### Adding icons to the header of blocks

By default, blocks in the builder don't have an icon next to the header label, just in the block picker. You may enable this using the `blockIcons()` method:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blockIcons()
```

```preview
// state: {"content": {"a1": {"type": "heading", "data": {"content": "Our roadmap for 2026", "level": "h2"}}, "b2": {"type": "paragraph", "data": {"content": "We are focusing on performance and accessibility this year."}}}}
// viewport: 900

return Builder.make('content')
    .blockIcons()
    .blocks([
        Block.make('heading')
            .icon('m-bookmark')
            .schema(() => [
                TextInput.make('content').required(),
                Select.make('level').options({ h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' }),
            ]),
        Block.make('paragraph')
            .icon('m-bars-3-bottom-left')
            .schema(() => [
                Textarea.make('content').required().rows(2),
            ]),
    ])
```

## Previewing blocks

If you prefer to render read-only previews in the builder instead of the blocks' forms, you can use the `blockPreviews()` method. This will render each block's `preview()` instead of the form. The preview is either the name of a view, rendered with the block data as variables, or a function of the block data:

```ts
import { HtmlString, e } from '@navette-js/support';
import { Builder, Block } from '@navette-js/forms/builder';
import { TextInput } from '@navette-js/forms';

Builder.make('content')
    .blockPreviews()
    .blocks([
        Block.make('heading')
            .schema(() => [
                TextInput.make('text')
                    .placeholder('Default heading'),
            ])
            .preview('app::block-previews.heading'),
        Block.make('quote')
            .schema(() => [
                TextInput.make('text'),
            ])
            .preview((data) => new HtmlString(`<blockquote>${e(data.text ?? '')}</blockquote>`)),
    ])
```

```preview
// state: {"content": {"a1": {"type": "heading", "data": {"text": "Our roadmap for 2026"}}, "b2": {"type": "quote", "data": {"text": "Ship small, ship often."}}}}
// viewport: 900
return Builder.make('content')
    .blockPreviews()
    .blocks([
        Block.make('heading')
            .schema(() => [TextInput.make('text')])
            .preview((data) => new HtmlString(`<h2 style="font-size: 1.25rem; font-weight: 600">${e(data.text ?? 'Default heading')}</h2>`)),
        Block.make('quote')
            .schema(() => [TextInput.make('text')])
            .preview((data) => new HtmlString(`<blockquote style="font-style: italic">${e(data.text ?? '')}</blockquote>`)),
    ])
```

In the `app::block-previews.heading` view (an EJS file of a namespace registered with `views.namespace()`), you can access the block data like so:

```ejs
<h1><%= text ?? 'Default heading' %></h1>
```

The block data comes from the browser: `<%= %>` escapes it. A preview function returning a string is escaped as text; return an `HtmlString` to insert markup, and escape the data you put in it with `e()`.

Clicking a preview, or the edit button of the item header, opens the block's form in a modal. Adding a block also opens its form in a modal first. The edit action can be customized with `editAction()`.

Optionally, the `blockPreviews()` method accepts a boolean value to control if the builder should render block previews or not:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .blockPreviews(featureFlags.blockPreviews)
```

### Interactive block previews

By default, preview content is not interactive, and clicking it will open the Edit modal for that block to manage its settings. If you have links and buttons that you'd like to remain interactive in the block previews, you can pass `{ areInteractive: true }` to the `blockPreviews()` method (or `true` as its second argument):

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blockPreviews({ areInteractive: true })
    .blocks([
        //
    ])
```

## Setting the default data of a block

A new item is filled with the default values of its fields. When the defaults of a block depend on each other, or on the rest of the form, return them from `defaultData()`:

```ts
import { Block } from '@navette-js/forms/builder';

Block.make('milestone')
    .defaultData(() => ({ title: 'New milestone', target_date: new Date().toISOString().slice(0, 10), description: null }))
```

## Adding items

An action button is displayed below the builder to allow the user to add a new item. It opens the block picker.

## Setting the add action button's label

You may set a label to customize the text that should be displayed in the button for adding a builder item, using the `addActionLabel()` method. You may also add an icon with `addActionIcon()`:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .addActionLabel('Add a new block')
    .addActionIcon('m-plus')
```

```preview
// state: {"content": {"a1": {"type": "heading", "data": {"content": "Our roadmap for 2026", "level": "h2"}}, "b2": {"type": "paragraph", "data": {"content": "We are focusing on performance and accessibility this year."}}}}
// viewport: 900

return Builder.make('content')
    .addActionLabel('Add a new block')
    .addActionIcon('m-plus')
    .blocks([
        Block.make('heading')
            .icon('m-bookmark')
            .schema(() => [
                TextInput.make('content').required(),
                Select.make('level').options({ h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' }),
            ]),
        Block.make('paragraph')
            .icon('m-bars-3-bottom-left')
            .schema(() => [
                Textarea.make('content').required().rows(2),
            ]),
    ])
```

### Aligning the add action button

You may align the add action using the `addActionAlignment()` method, passing `'start'`, `'center'` or `'end'`:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .addActionAlignment('start')
```

```preview
// state: {"content": {"a1": {"type": "heading", "data": {"content": "Our roadmap for 2026", "level": "h2"}}, "b2": {"type": "paragraph", "data": {"content": "We are focusing on performance and accessibility this year."}}}}
// viewport: 900

return Builder.make('content')
    .addActionAlignment('start')
    .blocks([
        Block.make('heading')
            .icon('m-bookmark')
            .schema(() => [
                TextInput.make('content').required(),
                Select.make('level').options({ h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' }),
            ]),
        Block.make('paragraph')
            .icon('m-bars-3-bottom-left')
            .schema(() => [
                Textarea.make('content').required().rows(2),
            ]),
    ])
```

### Inserting items between other items

A block picker is also displayed between items, so the user can insert a block at a precise position. You may change its label with `addBetweenActionLabel()`, customize its action with a function (see [customizing the builder item actions](#customizing-the-builder-item-actions)), or remove it with `addBetweenAction(false)`. In that case, you may display a label between items instead:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .addBetweenAction(false)
    .labelBetweenItems('then')
```

```preview
// state: {"content": {"a1": {"type": "heading", "data": {"content": "Our roadmap for 2026", "level": "h2"}}, "b2": {"type": "paragraph", "data": {"content": "We are focusing on performance and accessibility this year."}}}}
// viewport: 900

return Builder.make('content')
    .addBetweenAction(false)
    .labelBetweenItems('then')
    .blocks([
        Block.make('heading')
            .icon('m-bookmark')
            .schema(() => [
                TextInput.make('content').required(),
                Select.make('level').options({ h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' }),
            ]),
        Block.make('paragraph')
            .icon('m-bars-3-bottom-left')
            .schema(() => [
                Textarea.make('content').required().rows(2),
            ]),
    ])
```

### Preventing the user from adding items

You may prevent the user from adding items to the builder using the `addable(false)` method. The block pickers are removed, and the server refuses additions:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .addable(false)
```

## Deleting items

An action button is displayed on each item header to allow the user to delete it.

### Preventing the user from deleting items

You may prevent the user from deleting items from the builder using the `deletable(false)` method. The button is removed, and the server refuses deletions:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .deletable(false)
```

## Reordering items

A handle on each item header allows the user to reorder the items by drag and drop. Keyboard users can move an item up or down with buttons revealed to assistive technology. The server only accepts a new order that is a permutation of the existing items.

### Preventing the user from reordering items

You may prevent the user from reordering items from the builder using the `reorderable(false)` method:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .reorderable(false)
```

### Reordering items with buttons

You may use `reorderableWithButtons()` to display move up and move down buttons in the header of each item:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .reorderableWithButtons()
```

### Preventing reordering with drag and drop

You may use the `reorderableWithDragAndDrop(false)` method to prevent items from being ordered with drag and drop. Combined with `reorderableWithButtons()`, items can only be moved with the buttons:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .reorderableWithDragAndDrop(false)
    .reorderableWithButtons()
```

`reorderable(false)` turns off all reordering, buttons included. `reorderableWithDragAndDrop(false)` only removes drag and drop: with `reorderableWithButtons()`, the move buttons stay available. Both are enforced on the server.

## Collapsing items

The builder may be `collapsible()` to optionally hide content in long forms. A button in the header of each item collapses or expands it, and "Collapse all" and "Expand all" links are displayed above the items:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .collapsible()
```

You may also collapse all items by default:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .collapsed()
```

`collapsed()` also makes the builder collapsible. Collapsing happens in the browser: the fields of a collapsed item are still rendered and validated. The collapse button is in the item header, so it is not available with [`blockHeaders(false)`](#hiding-the-block-headers).

### Remembering collapsed items

`persistCollapsed()` keeps the collapsed state of each item in the browser's local storage, so it is restored on the next visit. The state is stored per item key: it is only restored for items whose key does not change between visits, which is the case with `storedAsList(false)`.

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .collapsible()
    .persistCollapsed()
```

## Cloning items

You may allow builder items to be duplicated using the `cloneable()` method:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .cloneable()
```

```preview
// state: {"content": {"a1": {"type": "heading", "data": {"content": "Our roadmap for 2026", "level": "h2"}}, "b2": {"type": "paragraph", "data": {"content": "We are focusing on performance and accessibility this year."}}}}
// viewport: 900

return Builder.make('content')
    .cloneable()
    .blocks([
        Block.make('heading')
            .icon('m-bookmark')
            .schema(() => [
                TextInput.make('content').required(),
                Select.make('level').options({ h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' }),
            ]),
        Block.make('paragraph')
            .icon('m-bars-3-bottom-left')
            .schema(() => [
                Textarea.make('content').required().rows(2),
            ]),
    ])
```

## Hiding the block headers

`blockHeaders(false)` displays only the content of each item, without its header. The header holds the reorder, clone and delete buttons, so those actions are then unavailable.

You may also change the tag of the header label with `blockLabelHeadingTag()` (`'h2'` by default, to `'h6'` or `'p'`), to fit the heading levels of your page.

## Customizing the block picker

### Grouping blocks

You may group blocks under headings by passing an object of block lists to `blocks()`, keyed by group label:

```ts
import { Textarea, TextInput } from '@navette-js/forms';
import { Block, Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks({
        Content: [
            Block.make('heading')
                .schema(() => [TextInput.make('text')]),
            Block.make('paragraph')
                .schema(() => [Textarea.make('text')]),
        ],
        Media: [
            Block.make('video')
                .schema(() => [TextInput.make('url').url()]),
        ],
    })
```

Groups appear in the order they are defined. You may also set the group of a block with `Block.pickerGroup()`; blocks without a group appear first, without a heading. Grouping only affects the picker, not the order or stored state of the blocks you add.

### Changing the number of columns in the block picker

The block picker has only 1 column. You may customize it by passing a number of columns, which apply from the `lg` breakpoint, to `blockPickerColumns()`:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blockPickerColumns(2)
```

### Increasing the width of the block picker

When you increase the number of columns, the width of the dropdown should increase incrementally to handle the additional columns. You may set it with `blockPickerWidth()`, passing a width name such as `'md'` or `'2xl'`:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blockPickerColumns(3)
    .blockPickerWidth('2xl')
```

### Searching blocks

If you have many blocks, you may allow users to search them in the block picker using the `searchable()` method:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .searchable()
    .blocks([
        // ...
    ])
```

The search matches block labels in the browser, without making a server request, and is case-insensitive. You may customize the placeholder of the search field using the `searchPrompt()` method, and the message displayed when no blocks match the search using the `noSearchResultsMessage()` method:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .searchable()
    .searchPrompt('Search for a block')
    .noSearchResultsMessage('No blocks found.')
    .blocks([
        // ...
    ])
```

The search prompt is displayed as plain text. If you pass an `HtmlString` to `searchPrompt()`, its tags are removed and its HTML entities are decoded.

#### Tweaking the search debounce

By default, the block picker filters blocks immediately as the user types. You may debounce the search using the `searchDebounce()` method, which accepts the number of milliseconds to wait:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .searchable()
    .searchDebounce(500)
    .blocks([
        // ...
    ])
```

## Limiting the number of times a block can be used

By default, each block can be used in the builder an unlimited number of times. You may limit this using the `maxItems()` method on a block. Once the limit is reached, the block is removed from the block picker, and the server refuses to add or clone more items of this block:

```ts
import { Block } from '@navette-js/forms/builder';

Block.make('heading')
    .schema(() => [
        // ...
    ])
    .maxItems(1)
```

## Accessing parent field values

Inside a block, `get()` and `set()` are relative to the item's data: `get('title')` reads the title of the same block. To read a field outside of the item, use the host component's state, as explained for the [repeater](/forms/repeater#accessing-parent-field-values).

## Builder validation

As well as all rules listed on the [validation](/forms/validation) page, a `required()` builder needs at least one item, and each field of each block is validated with its own rules.

### Number of items validation

You can set the minimum and maximum number of items that you can have in a builder with the `minItems()` and `maxItems()` methods:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .minItems(1)
    .maxItems(5)
```

`minItems()` is checked on the server when the form is validated. `maxItems()` (100 by default) is a limit rather than a validation rule: the add buttons disappear once it is reached, the server ignores further additions and clones, and items beyond it are dropped.

## Limiting item processing

If your application's JavaScript accidentally creates a large state, building and rendering a block schema for every entry can cause a long wait. You can opt in to a processing limit using `maxItemsForProcessing()` to stop processing rather than build an unexpectedly large schema:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .maxItems(5)
    .maxItemsForProcessing(100)
```

In this example, up to 100 items can be processed, but the form will only pass validation with at most 5 items. If the state contains more than 100 items, the request is refused with an HTTP 413 response before the builder's item schemas are built. It does not truncate the data. This limit is disabled by default and accepts a number, or `null` to disable it. To apply a limit to every builder, see [applying processing limits globally](/forms/repeater#applying-processing-limits-globally).

<Aside variant="danger">
The processing limit also applies to existing data loaded from your database. A record above the limit cannot be opened through that form until you raise the limit or correct its data elsewhere.
</Aside>

## Lazy loading block schemas

If a block's schema is expensive to render, you can pass a `Schema` object to the block's `schema()` and use `lazyLoaded()`, or call `lazyLoaded()` on the builder itself for every block. This is particularly useful when items are [collapsed](#collapsing-items) by default. Each block item schema is loaded independently when its item is expanded and enters the viewport:

```ts
import { Textarea } from '@navette-js/forms';
import { Block, Builder } from '@navette-js/forms/builder';
import { Schema } from '@navette-js/schemas';

Builder.make('content')
    .blocks([
        Block.make('paragraph')
            .schema(
                Schema.make()
                    .components([
                        Textarea.make('content')
                            .required(),
                    ])
                    .lazyLoaded(),
            ),
    ])
    .collapsed()
```

Block's `schema()` also accepts a list of components (copied for each item), besides a function called for each item. Builder block item schemas automatically receive unique keys from their item state paths. Lazy items are still validated and saved. You can learn more about lazy schemas in the [schema overview](/schemas/overview#lazy-loading-a-child-schema).

## Item keys

Each item is keyed by a random UUID. You may generate the keys of new items yourself with `generateUuidUsing()`, passing a function that returns the key, or `false` to use numeric keys (`0`, `1`, `2`…):

```ts
import { Builder } from '@navette-js/forms/builder';
import { randomBytes } from 'node:crypto';

Builder.make('content')
    .generateUuidUsing(() => randomBytes(4).toString('hex'))
```

As with the [repeater](/forms/repeater#item-keys), JavaScript orders numeric keys in ascending order, so with numeric keys moving or inserting items between others is not reflected in their order.

### Testing builders

Use `Builder.fake()` to give builder items predictable numeric keys instead of UUIDs when asserting their state. Call the returned function after the test to restore normal key generation:

```ts
import { Builder } from '@navette-js/forms/builder';

const undoBuilderFake = Builder.fake();

// Mount the form: `content` is { 0: { type: 'heading', data: { … } }, 1: { type: 'paragraph', data: { … } } }.

undoBuilderFake();
```

`Builder.isFake()` tells whether `fake()` is active.

## Removing the builder's container

`extraClass()` adds a class to the builder's root element. Navette's [query builder](/tables/filters/query-builder) uses `extraClass('fi-fo-builder-not-contained')`, the class of a builder without its container border and padding:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .extraClass('fi-fo-builder-not-contained')
```

## Customizing the builder item actions

This field uses action objects for easy customization of buttons within it. You can customize these buttons by passing a function to an action registration method. The function receives the `Action` object, which you can use to [customize it](/actions/overview). The following methods are available to customize the actions:

- `addAction()`
- `addBetweenAction()`
- `cloneAction()`
- `collapseAction()`
- `collapseAllAction()`
- `deleteAction()`
- `editAction()` (with [block previews](#previewing-blocks))
- `expandAction()`
- `expandAllAction()`
- `moveDownAction()`
- `moveUpAction()`
- `reorderAction()`

Here is an example of how you might customize an action:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .collapseAllAction((action) => action.label('Collapse all content'))
```

`addBetweenAction(false)` still removes the picker between items.

### Confirming builder actions with a modal

You can confirm actions with a modal by using the `requiresConfirmation()` method on the action object. You may use any [modal customization method](/actions/modals) to change its content and behavior:

```ts
import { Builder } from '@navette-js/forms/builder';

Builder.make('content')
    .blocks([
        // ...
    ])
    .deleteAction((action) => action.requiresConfirmation())
```

<Aside variant="info">
The `collapseAction()`, `collapseAllAction()`, `expandAction()` and `expandAllAction()` methods do not support confirmation modals, as clicking their buttons does not make the network request that is required to show the modal. The `addAction()` and `addBetweenAction()` functions customize the block picker's button; picking a block runs the action.
</Aside>

Completing a drag that changes the block order invokes `reorderAction()`, which supports `requiresConfirmation()`. Clicking the drag handle alone does not invoke the action.

### Adding extra item actions to a builder

You may add new [action buttons](/actions/overview) to the header of each builder item by passing `Action` objects into `extraItemActions()`:

```ts
import { Action } from '@navette-js/actions';
import { Builder, Block } from '@navette-js/forms/builder';
import { TextInput } from '@navette-js/forms';

Builder.make('content')
    .blocks([
        Block.make('contactDetails')
            .schema(() => [
                TextInput.make('email')
                    .label('Email address')
                    .email()
                    .required(),
                // ...
            ]),
        // ...
    ])
    .extraItemActions([
        Action.make('sendEmail')
            .icon('m-envelope')
            .action(async ({ arguments: args, component }) => {
                const itemData = await component.getItemState(args.item);

                await mailer.send(itemData.email, 'Your details');
            }),
    ])
```

In this example, `arguments.item` gives you the key of the current builder item, checked on the server: an unknown key is refused before the action runs. You can validate the data in that builder item using the `getItemState()` method on the builder component. This method returns the validated data for the item. If the item is not valid, it will cancel the action and show an error message for that item in the form.

If you want to get a snapshot of the current item's state without validating it, you can use `component.getItemStateSnapshot(args.item)` instead. The snapshot still applies state transformations. `component.getRawItemState(args.item)` returns the raw `{ type, data }` of the item.
