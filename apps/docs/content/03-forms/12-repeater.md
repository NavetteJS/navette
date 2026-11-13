---
title: Repeater
---

## Introduction

The repeater component allows you to output a list of items, each with the same set of form components. Each item is displayed as a card:

```ts
import { Repeater, Select, TextInput } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        TextInput.make('name').required(),
        Select.make('role')
            .options({
                member: 'Member',
                administrator: 'Administrator',
                owner: 'Owner',
            })
            .required(),
    ])
    .columns(2)
```

```preview
// state: {"members": {"a1": {"name": "Dan Harrin", "role": "owner"}, "b2": {"name": "Ryan Chandler", "role": "administrator"}}}
// viewport: 1100
Repeater.make('members')
    .schema([
        TextInput.make('name').required(),
        Select.make('role')
            .options({
                member: 'Member',
                administrator: 'Administrator',
                owner: 'Owner',
            })
            .required(),
    ])
    .columns(2)
```

`schema()` takes the components of an item: fields, and layout components such as sections or grids. Each item gets its own copy of these components. You may also pass a function returning the components, which is called for each item. `columns()` lays out the components of each item in a grid, with the same options as the [grid system](/schemas/layouts#grid-system).

<Aside variant="info">
The stacked card layout is the default layout of the repeater. To display the items as rows of a table, use [`table()`](#table-repeaters).
</Aside>

The state of a repeater is an object of items keyed by a unique item key, in display order. It is also the saved value: store it in a JSON column.

```json
{
    "6f1c…": { "name": "Dan Harrin", "role": "owner" },
    "a03b…": { "name": "Ryan Chandler", "role": "member" }
}
```

The keys of new items are UUIDs. Keys coming from the browser are checked: only simple keys (letters, digits, `_` and `-`) are kept. When the form is filled, the repeater also accepts a list of items, or the same value as a JSON string.

If you wish to define a repeater with several kinds of items that can be repeated in any order, use the [builder](/forms/builder).

<Aside variant="warning">
Extra item actions are limited to links (see [adding links to items](#adding-links-to-items)). Customizing the add, delete and clone actions, confirming them with a modal, and inserting items between other items are not available yet.
</Aside>

## Setting empty default items

Repeaters start with no item. You may add default items with `defaultItems()`. Each item is filled with the default values of its fields:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .defaultItems(1)
    .schema([
        // ...
    ])
```

Default items are created when the form is filled without a value for the repeater: on a Create page, or on an Edit page when the record has no value for it.

## Adding items

An action button is displayed below the repeater to allow the user to add a new item.

## Setting the add action button's label

You may set a label to customize the text that should be displayed in the button for adding a repeater item, using the `addActionLabel()` method:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .addActionLabel('Add member')
```

### Aligning the add action button

By default, the add action is aligned in the center. You may adjust this using the `addActionAlignment()` method, passing `'start'` or `'end'`:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .addActionAlignment('start')
```

### Preventing the user from adding items

You may prevent the user from adding items to the repeater using the `addable(false)` method. The button is removed, and the server refuses additions:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .addable(false)
```

## Deleting items

An action button is displayed on each item to allow the user to delete it.

### Preventing the user from deleting items

You may prevent the user from deleting items from the repeater using the `deletable(false)` method. The button is removed, and the server refuses deletions:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .deletable(false)
```

## Reordering items

When there is more than one item, a handle on each item allows the user to reorder the items by drag and drop. Keyboard users can move an item up or down with buttons revealed to assistive technology. The server only accepts a new order that is a permutation of the existing items.

### Preventing the user from reordering items

You may prevent the user from reordering items from the repeater using the `reorderable(false)` method:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .reorderable(false)
```

### Reordering items with buttons

You may use `reorderableWithButtons()` to display move up and move down buttons in the header of each item:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .reorderableWithButtons()
```

### Preventing reordering with drag and drop

You may use the `reorderableWithDragAndDrop(false)` method to prevent items from being ordered with drag and drop. Combined with `reorderableWithButtons()`, items can only be moved with the buttons:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .reorderableWithDragAndDrop(false)
    .reorderableWithButtons()
```

`reorderable(false)` turns off all reordering, buttons included. `reorderableWithDragAndDrop(false)` only removes drag and drop: with `reorderableWithButtons()`, the move buttons stay available. Both are enforced on the server.

## Collapsing items

The repeater may be `collapsible()` to optionally hide content in long forms. A button in the header of each item collapses or expands it, and "Collapse all" and "Expand all" links are displayed above the items:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('qualifications')
    .schema([
        // ...
    ])
    .collapsible()
```

You may also collapse all items by default:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('qualifications')
    .schema([
        // ...
    ])
    .collapsed()
```

`collapsed()` also makes the repeater collapsible. Collapsing happens in the browser: the fields of a collapsed item are still rendered and validated.

### Remembering collapsed items

`persistCollapsed()` keeps the collapsed state of each item in the browser's local storage, so it is restored on the next visit. The state is stored per item key: items loaded from a [relationship](#integrating-with-a-relationship) keep their key (`record-<id>`) from one visit to the next.

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('qualifications')
    .schema([
        // ...
    ])
    .collapsible()
    .persistCollapsed()
```

## Cloning items

You may allow repeater items to be duplicated using the `cloneable()` method. The copy is inserted after the original item, and counts towards [`maxItems()`](#number-of-items-validation):

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('qualifications')
    .schema([
        // ...
    ])
    .cloneable()
```

## Integrating with a relationship

You may use the `relationship()` method of the `Repeater` to configure a has-many relationship of the form's model, an Objection model with `relationMappings` (the resource's data adapter model). The items are loaded from the related records when the form is filled. Once the record is created or updated, on resource pages and in the `CreateAction` and `EditAction` modals, new items create related records, existing items update them, and the records whose item was removed are deleted. If a relationship name is not passed to `relationship()`, the field name is used:

```ts
import { Repeater, TextInput } from '@navette-js/forms';

Repeater.make('comments')
    .relationship()
    .schema([
        TextInput.make('body').required(),
    ])
```

The relationship is not part of the saved data of the record. Each related record becomes an item keyed `record-<id>`, filled with the fields of the item schema.

<Aside variant="info">
Item keys come from the browser. Only the related records of the record being saved are updated or deleted: an item whose key refers to a record of another owner is saved as a new record.
</Aside>

If the form's model is not the data adapter's model, pass it as the third argument: `relationship('comments', null, { model: Post })`.

### Reordering items in a relationship

To save the order of the items, the related model needs a column to store it. Pass its name to the `orderColumn()` method: the records are loaded in this order, and each item's position (starting at 1) is saved in this column:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('comments')
    .relationship()
    .schema([
        // ...
    ])
    .orderColumn('sort')
```

Without an order column, the order of the items cannot be saved, so reordering is turned off.

### Customizing the relationship query

The second argument of `relationship()` is a function that receives the Objection query of the related records. It applies when the records are loaded and when they are saved: records outside of the query are never updated or deleted.

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('approvedComments')
    .relationship('comments', (query) => query.where('approved', true))
    .schema([
        // ...
    ])
```

### Saving related rows yourself

Without `relationship()`, the repeater does not save related records itself: the saved value is the object of items, and your data adapter decides what to do with it.

When the form is filled from a list of related rows (for example, `record.items` loaded by your adapter's `find()`), each row with an `id` becomes an item keyed `record-<id>`, with only the declared fields. When saving, you may use this key to update the rows that still exist, create the new ones and delete the rest:

```ts
async saveItems(orderId: number, items: unknown): Promise<void> {
    if (!items || typeof items !== 'object' || Array.isArray(items)) return;
    const existing = new Set((await knex('order_items').where({ order_id: orderId }).select('id')).map((row) => Number(row.id)));
    const kept: number[] = [];
    let sort = 0;

    for (const [key, item] of Object.entries(items as Record<string, any>)) {
        const values = { product_id: Number(item.product_id), qty: Number(item.qty), sort: sort++ };
        const id = Number(/^record-(\d+)$/.exec(key)?.[1] ?? NaN);

        if (existing.has(id)) {
            await knex('order_items').where({ id, order_id: orderId }).update(values);
            kept.push(id);
        } else {
            kept.push((await knex('order_items').insert({ ...values, order_id: orderId }))[0]);
        }
    }

    await knex('order_items').where({ order_id: orderId }).whereNotIn('id', kept).delete();
}
```

<Aside variant="danger">
Item keys come from the browser. Only update a row when its id belongs to the record being saved, as the `existing` set does here; otherwise a forged key could change another record's rows.
</Aside>

## Grid layout

You may organize repeater items into columns by using the `grid()` method. It accepts a number of columns, applied from the `lg` breakpoint, or an object of columns per breakpoint, such as `{ md: 2, xl: 3 }`:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('qualifications')
    .schema([
        // ...
    ])
    .grid(2)
```

```preview
// state: {"members": {"a1": {"name": "Dan Harrin", "role": "owner"}, "b2": {"name": "Ryan Chandler", "role": "administrator"}, "c3": {"name": "Zep Fietje", "role": "member"}, "d4": {"name": "Alex Six", "role": "member"}}}
// viewport: 1100
Repeater.make('members')
    .schema([
        TextInput.make('name').required(),
        Select.make('role')
            .options({
                member: 'Member',
                administrator: 'Administrator',
                owner: 'Owner',
            })
            .required(),
    ])
    .grid(2)
```

## Adding a label to repeater items based on their content

You may add a label for repeater items using the `itemLabel()` method. It accepts a string, or a function that receives `{ state, key, index }`, where `state` is the current data of the item, `key` its item key and `index` its zero-based position. Return a string to be used as the item label, or `null` for no label. The label is escaped:

```ts
import { Repeater, Select, TextInput } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        TextInput.make('name')
            .required()
            .live({ onBlur: true }),
        Select.make('role')
            .options({
                member: 'Member',
                administrator: 'Administrator',
                owner: 'Owner',
            })
            .required(),
    ])
    .columns(2)
    .itemLabel(({ state }) => (typeof state.name === 'string' ? state.name : null))
```

```preview
// state: {"members": {"a1": {"name": "Dan Harrin", "role": "owner"}, "b2": {"name": "Ryan Chandler", "role": "administrator"}}}
// viewport: 1100
Repeater.make('members')
    .schema([
        TextInput.make('name')
            .required()
            .live({ onBlur: true }),
        Select.make('role')
            .options({
                member: 'Member',
                administrator: 'Administrator',
                owner: 'Owner',
            })
            .required(),
    ])
    .columns(2)
    .itemLabel(({ state }) => (typeof state.name === 'string' ? state.name : null))
```

<Aside variant="tip">
Any fields that you use from `state` should be `live()` if you wish to see the item label update as the user fills the form.
</Aside>

`state` is the raw data sent by the browser, before validation: do not assume its values have the expected type.

Long labels are truncated to one line. You may display them in full with `truncateItemLabel(false)`.

## Numbering repeater items

You can add the repeater item's number next to its label using the `itemNumbers()` method. The number is only displayed with an [item label](#adding-a-label-to-repeater-items-based-on-their-content):

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .itemLabel('Member')
    .itemNumbers()
```

## Hiding the item headers

`itemHeaders(false)` displays only the content of each item, without its header. The header holds the reorder, clone, delete and collapse buttons and the item links, so those actions are then unavailable:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .itemHeaders(false)
```

## Adding a label between items

You may display a label between items with the `labelBetweenItems()` method:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('conditions')
    .schema([
        // ...
    ])
    .labelBetweenItems('or')
```

## Simple repeaters with one field

You can use the `simple()` method to create a repeater with a single field, using a minimal design. The field is copied for each item:

```ts
import { Repeater, TextInput } from '@navette-js/forms';

Repeater.make('invitations')
    .simple(
        TextInput.make('email')
            .email()
            .required(),
    )
```

```preview
// state: {"invitations": ["dan@example.com", "ryan@example.com"]}
// width: 32rem
Repeater.make('invitations')
    .simple(
        TextInput.make('email')
            .email()
            .required(),
    )
```

Instead of an object of items, simple repeaters save a list of values, and accept the same list when the form is filled:

```json
["dan@example.com", "ryan@example.com"]
```

## Accessing parent field values

Inside an item, `get()` and `set()` are relative to the item: `get('quantity')` reads the quantity of the same item. To read a field outside of the item, use the host component's state, which lives under `data` on resource pages:

```ts
import { Repeater, TextInput } from '@navette-js/forms';

Repeater.make('items')
    .schema([
        TextInput.make('qty')
            .integer()
            .maxValue(1000)
            .hint(({ livewire }) => ((livewire as any).data?.currency === 'EUR' ? 'Units, billed in euros' : null)),
    ])
```

To update a total when an item changes, see [setting the state of another field](/forms/overview#setting-the-state-of-another-field).

## Table repeaters

You can present repeater items in a table format using the `table()` method, which accepts an array of `TableColumn` objects. These objects represent the columns of the table, which correspond to the components in the schema of the repeater, in the same order. `TableColumn.width()` accepts a number of pixels or a CSS width:

```ts
import { Repeater, Select, TableColumn, TextInput } from '@navette-js/forms';

Repeater.make('members')
    .table([
        TableColumn.make('Name'),
        TableColumn.make('Role').width(160),
    ])
    .schema([
        TextInput.make('name').required(),
        Select.make('role')
            .options({
                member: 'Member',
                administrator: 'Administrator',
                owner: 'Owner',
            })
            .required(),
    ])
```

```preview
// state: {"members": {"a1": {"name": "Dan Harrin", "role": "owner"}, "b2": {"name": "Ryan Chandler", "role": "administrator"}, "c3": {"name": "Zep Fietje", "role": "member"}}}
// viewport: 900
Repeater.make('members')
    .table([
        TableColumn.make('Name'),
        TableColumn.make('Role').width(160),
    ])
    .schema([
        TextInput.make('name').required(),
        Select.make('role')
            .options({
                member: 'Member',
                administrator: 'Administrator',
                owner: 'Owner',
            })
            .required(),
    ])
```

The table layout supports adding, deleting and reordering items by drag and drop, `addable(false)`, `deletable(false)`, `reorderable(false)`, `addActionLabel()` and [item links](#adding-links-to-items). The other options of this page (labels, collapsing, cloning, grid, add button alignment, buttons to reorder) only apply to the stacked layout.

## Adding links to items

You may add a link to each item with `extraItemLink()`. The function receives the item and its key, and returns a link (`label`, `icon`, `url`) or `null`. The link opens in a new tab:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('items')
    .extraItemLink(({ item }) => (item.product_id
        ? { label: 'Open product', icon: 'm-arrow-top-right-on-square', url: `/shop/products/${Number(item.product_id)}/edit` }
        : null))
```

`item` is the raw data sent by the browser: build the URL from values you have checked, as `Number()` does here.

## Repeater validation

As well as all rules listed on the [validation](/forms/validation) page, a `required()` repeater needs at least one item. Each field of each item is validated with its own rules; errors are displayed in the item.

```preview
// state: {"members": {"a1": {"name": "Dan Harrin", "role": "owner"}, "b2": {"name": "", "role": "member"}}}
// errors: {"data.members.b2.name": ["The name field is required."]}
// viewport: 1100
Repeater.make('members')
    .required()
    .schema([
        TextInput.make('name').required(),
        Select.make('role')
            .options({
                member: 'Member',
                administrator: 'Administrator',
                owner: 'Owner',
            })
            .required(),
    ])
    .columns(2)
```

### Number of items validation

You can validate the minimum and maximum number of items that you can have in a repeater by setting the `minItems()` and `maxItems()` methods:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .minItems(2)
    .maxItems(5)
```

Both are checked on the server when the form is validated. Once `maxItems()` is reached, the add button disappears and the server ignores further additions and clones. Without `maxItems()`, a repeater is limited to 500 items.
