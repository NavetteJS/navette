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

Item actions (add, delete, clone, move...) can be customized and confirmed with a modal, and you can add your own: see [customizing the repeater item actions](#customizing-the-repeater-item-actions).

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

### Inserting items between other items

An "Insert between" button may be displayed between two items, so the user can add an item at a precise position. It is hidden by default: make its action visible with `addBetweenAction()`:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .addBetweenAction((action) => action.visible())
```

```preview
// state: {"members": {"a1": {"name": "Dan Harrin"}, "b2": {"name": "Ryan Chandler"}}}
Repeater.make('members')
    .schema([
        TextInput.make('name').required(),
    ])
    .addBetweenAction((action) => action.visible())
```

You may change its label with `addBetweenActionLabel()`. The new item is inserted after the item whose key the button sends; the server checks that this item exists. When the button is not displayed, the [label between items](#adding-a-label-between-items) is shown instead, if you set one.

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

### Mutating related item data before filling the field

You may change the data of a related record before it fills its item using the `mutateRelationshipDataBeforeFillUsing()` method. The function receives the record's attributes as `data` (with the other utilities of the field), and returns the data to fill:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('qualifications')
    .relationship()
    .schema([
        // ...
    ])
    .mutateRelationshipDataBeforeFillUsing(({ data }) => ({
        ...data,
        title: String(data.title).toUpperCase(),
    }))
```

### Mutating related item data before creating

You may change the data of a new item before its related record is created using the `mutateRelationshipDataBeforeCreateUsing()` method. The function receives the item's data as `data`, and returns either the data to save, or `null` to skip creating the record:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('qualifications')
    .relationship()
    .schema([
        // ...
    ])
    .mutateRelationshipDataBeforeCreateUsing(({ data }) => ({
        ...data,
        user_id: currentUserId(),
    }))
```

### Mutating related item data before saving

You may change the data of an existing item before its related record is updated using the `mutateRelationshipDataBeforeSaveUsing()` method. The function receives the item's data as `data` and the related record as `record`, and returns either the data to save, or `null` to leave the record unchanged:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('qualifications')
    .relationship()
    .schema([
        // ...
    ])
    .mutateRelationshipDataBeforeSaveUsing(({ data, record }) => ({
        ...data,
        updated_by: currentUserId(),
    }))
```

### Running code after creating a related item

You may run code after a new item's record is created using the `afterCreate()` method. The function receives the item's data as `data` and the new record (an Objection model instance, with its id) as `record`. This is useful when you need the record's id, for instance to link other records to it:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('variants')
    .relationship()
    .schema([
        // ...
    ])
    .afterCreate(async ({ data, record }) => {
        await Variant.relatedQuery('attributes').for(record.id).relate(data.attribute_ids);
    })
```

### Running code after updating a related item

You may run code after an existing item's record is updated using the `afterUpdate()` method. The function receives the saved data as `data` and the updated record as `record`:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('variants')
    .relationship()
    .schema([
        // ...
    ])
    .afterUpdate(async ({ data, record }) => {
        await auditLog('variant updated', record.id);
    })
```

### Running code after deleting a related item

You may run code after the record of a removed item is deleted using the `afterDelete()` method. The function receives the deleted record as `record`: it no longer exists in the database, but you can still read its attributes, such as its id:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('attachments')
    .relationship()
    .schema([
        // ...
    ])
    .afterDelete(async ({ record }) => {
        await storage.delete(record.file_path);
    })
```

The records of removed items are deleted first, then the remaining items are updated and the new ones created, in the order of the items.

### Modifying related records after retrieval

You may filter or change the related records after they are retrieved from the database using the `modifyRecordsUsing` option of `relationship()`. The function receives the list of records and returns the list to use. Only these records are filled into the repeater, and only these records are updated or deleted when saving, so two repeaters can share a relationship:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('startItems')
    .relationship('items', null, { modifyRecordsUsing: (records) => records.filter((record) => record.group === 'start') })
    .mutateRelationshipDataBeforeCreateUsing(({ data }) => ({ ...data, group: 'start' })),
Repeater.make('endItems')
    .relationship('items', null, { modifyRecordsUsing: (records) => records.filter((record) => record.group === 'end') })
    .mutateRelationshipDataBeforeCreateUsing(({ data }) => ({ ...data, group: 'end' })),
```

The function receives the records after the query and the [order column](#reordering-items-in-a-relationship) are applied. Filtering in the query (`relationship('items', (query) => query.where('group', 'start'))`) is usually cheaper; `modifyRecordsUsing` is for conditions that are easier to write in JavaScript.

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

The labels displayed in the header of the table are passed to the `TableColumn.make()` method. If you want to provide an accessible label for a column but do not wish to display it, you can use the `hiddenHeaderLabel()` method:

```ts
import { TableColumn } from '@navette-js/forms';

TableColumn.make('Name')
    .hiddenHeaderLabel()
```

If you would like to mark a column as "required" with a red asterisk, you can use the `markAsRequired()` method:

```ts
import { TableColumn } from '@navette-js/forms';

TableColumn.make('Name')
    .markAsRequired()
```

You can enable wrapping of the column header using the `wrapHeader()` method:

```ts
import { TableColumn } from '@navette-js/forms';

TableColumn.make('Name')
    .wrapHeader()
```

You can also adjust the alignment of the column header using the `alignment()` method, passing `'start'`, `'center'` or `'end'`, and the vertical alignment of the column's cells with `verticalAlignment()`:

```ts
import { TableColumn } from '@navette-js/forms';

TableColumn.make('Name')
    .alignment('center')
    .verticalAlignment('start')
```

### Compact table repeaters

You can make table repeaters more compact by using the `compact()` method, to fit more data in a smaller space:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .table([
        // ...
    ])
    .compact()
    .schema([
        // ...
    ])
```

Optionally, you may pass a boolean value, or a function of the field's context, to control if the table repeater should be compact or not.

```preview
// state: {"members": {"a1": {"name": "Dan Harrin", "role": "owner"}, "b2": {"name": "Ryan Chandler", "role": "administrator"}}}
// viewport: 900
Repeater.make('members')
    .table([
        TableColumn.make('Name').markAsRequired(),
        TableColumn.make('Role').width(160),
    ])
    .compact()
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

### Distinct state validation

In many cases, you will want to ensure some sort of uniqueness between repeater items. A couple of common examples could be:

- Ensuring that only one [checkbox](/forms/checkbox) or [toggle](/forms/toggle) is activated at once across items in the repeater.
- Ensuring that an option may only be selected once across [select](/forms/select), [radio](/forms/radio), [checkbox list](/forms/checkbox-list), or [toggle buttons](/forms/toggle-buttons) fields in a repeater.

`siblingDistinctRules()` returns the rules that validate that the state of a field is unique across all items of its repeater (or [builder](/forms/builder)). Add them with `rules()`:

```ts
import { Checkbox, Repeater, siblingDistinctRules } from '@navette-js/forms';

Repeater.make('answers')
    .schema([
        // ...
        Checkbox.make('is_correct')
            .rules(siblingDistinctRules()),
    ])
```

The behavior of the validation depends on the data type that the field handles:

- If the field holds a boolean, like a [checkbox](/forms/checkbox) or [toggle](/forms/toggle), only one item may have a value of `true`. There may be many fields in the repeater that have a value of `false`.
- Otherwise, for fields like a [select](/forms/select), [radio](/forms/radio), [checkbox list](/forms/checkbox-list), or [toggle buttons](/forms/toggle-buttons), each option may only be selected once across all items in the repeater.

`siblingDistinctRules()` accepts a boolean, or a function of the field's context, to turn the validation on or off. Outside a repeater, the rules always pass. The field's own `distinct()` rule is different: it checks that a list value (tags, multiple select) holds no duplicates.

#### Automatically fixing indistinct state

If you'd like to automatically fix indistinct state, you can use the `fixIndistinctState()` method, available on `Checkbox`, `Toggle`, `Select`, `Radio`, `CheckboxList` and `ToggleButtons`:

```ts
import { Checkbox, Repeater } from '@navette-js/forms';

Repeater.make('answers')
    .schema([
        // ...
        Checkbox.make('is_correct')
            .fixIndistinctState(),
    ])
```

This method adds the distinct validation above and makes the field [`live()`](/forms/overview#the-basics-of-reactivity). Depending on the data type that the field handles, the behavior of `fixIndistinctState()` adapts:

- If the field holds a boolean, like a checkbox or a toggle, and one of the fields is enabled, the other enabled fields are disabled on behalf of the user.
- Otherwise, for fields like a select, radio, checkbox list, or toggle buttons, when a user selects an option, the other usages of that option are deselected on behalf of the user.

The fix runs on the server after the field's state changes, after the field's own `afterStateUpdated()`. Optionally, you may pass a boolean value, or a function of the field's context, to control if the field should fix indistinct state or not.

#### Disabling options when they are already selected in another item

If you'd like to disable options in a select, radio, checkbox list, or toggle buttons when they are already selected in another item, you can use the `disableOptionsWhenSelectedInSiblingRepeaterItems()` method:

```ts
import { Repeater, Select } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        Select.make('role')
            .options({
                // ...
            })
            .disableOptionsWhenSelectedInSiblingRepeaterItems(),
    ])
```

This method adds the distinct validation above and makes the field `live()`, so the options of the other items are updated as soon as an option is picked. A disabled option cannot be picked by a forged request either: the distinct rule refuses it on the server.

<Aside variant="warning">
`disableOptionsWhenSelectedInSiblingRepeaterItems()` sets the field's `disableOptionWhen()` function. Calling `disableOptionWhen()` afterwards replaces it.
</Aside>

## Limiting item processing

If your application's JavaScript accidentally creates a large state, building and rendering an item schema for every entry can cause a long wait. You can opt in to a processing limit using `maxItemsForProcessing()` to stop processing rather than build an unexpectedly large schema:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .maxItems(5)
    .maxItemsForProcessing(100)
```

In this example, up to 100 items can be processed, but the form will only pass validation with at most 5 items. If the state contains more than 100 items, the request is refused with an HTTP 413 response (an `ItemsProcessingLimitError`) before the repeater's item schemas are built. It does not truncate the data. This limit is disabled by default and accepts a number, or `null` to disable it.

<Aside variant="danger">
The processing limit also applies to existing data loaded from your database. A record above the limit cannot be opened through that form until you raise the limit or correct its data elsewhere. Choose a limit that accommodates existing records you need to edit, including records above your validation limit.
</Aside>

### Applying processing limits globally

To enable processing limits for all repeaters and builders, use `configureUsing()` when your application starts. Configure each component class separately:

```ts
import { Repeater } from '@navette-js/forms';
import { Builder } from '@navette-js/forms/builder';

Repeater.configureUsing((repeater) => {
    repeater.maxItemsForProcessing(100);
});

Builder.configureUsing((builder) => {
    builder.maxItemsForProcessing(100);
});
```

You can override the global limit on each component to increase or decrease it, or pass `null` to turn it off for that component.

## Lazy loading repeater item schemas

If a repeater's item schema is expensive to render, you can pass a `Schema` object to `schema()` and use `lazyLoaded()`, or call `lazyLoaded()` on the repeater itself. This is particularly useful when items are [collapsed](#collapsing-items) by default. Each item schema is loaded independently when its item is expanded and enters the viewport:

```ts
import { Repeater, TextInput } from '@navette-js/forms';
import { Schema } from '@navette-js/schemas';

Repeater.make('members')
    .schema(
        Schema.make()
            .components([
                TextInput.make('name'),
                TextInput.make('email')
                    .email(),
            ])
            .lazyLoaded(),
    )
    .collapsed()
```

Repeater item schemas automatically receive unique keys from their item state paths. Lazy items are still part of the form: their fields are validated and saved even if they were never rendered, and an item holding a validation error is rendered. Table repeaters render their cells directly, so their items are not lazy loaded. You can learn more about lazy schemas in the [schema overview](/schemas/overview#lazy-loading-a-child-schema).

## Item keys

Each item is keyed by a random UUID (related records by `record-<id>`). You may generate the keys of new items yourself with `generateUuidUsing()`, passing a function that returns the key, or `false` to use numeric keys (`0`, `1`, `2`…) as a list would:

```ts
import { Repeater } from '@navette-js/forms';
import { randomBytes } from 'node:crypto';

Repeater.make('members')
    .generateUuidUsing(() => randomBytes(4).toString('hex'))
```

Keys come back from the browser: only keys of letters, digits, `-` and `_` (at most 64 characters) are accepted.

<Aside variant="warning">
Item order is the order of the keys of the state object, and JavaScript orders numeric keys in ascending order. With numeric keys, moving an item, or inserting an item between two others, is not reflected in the order of the items. Use them in tests, or for repeaters that cannot be reordered.
</Aside>

### Testing repeaters

Use `Repeater.fake()` to give repeater items predictable numeric keys instead of UUIDs when asserting their state. Call the returned function after the test to restore normal key generation:

```ts
import { Repeater } from '@navette-js/forms';

const undoRepeaterFake = Repeater.fake();

// Mount the form: `quotes` is { 0: { content: 'First quote' }, 1: { content: 'Second quote' } }.

undoRepeaterFake();
```

`fake()` applies to the repeaters made after it is called (it uses `configureUsing()`), and `Repeater.isFake()` tells whether it is active. To call an action on a particular item, pass the item key as the `item` argument: `'0'`, `'1'`… with `fake()`, or `record-<id>` for the items of a [relationship](#integrating-with-a-relationship).

## Customizing the repeater item actions

This field uses action objects for easy customization of buttons within it. You can customize these buttons by passing a function to an action registration method. The function receives the `Action` object, which you can use to [customize it](/actions/overview), and returns it (or changes it in place). The following methods are available to customize the actions:

- `addAction()`
- `addBetweenAction()`
- `cloneAction()`
- `collapseAction()`
- `collapseAllAction()`
- `deleteAction()`
- `expandAction()`
- `expandAllAction()`
- `moveDownAction()`
- `moveUpAction()`
- `reorderAction()`

Here is an example of how you might customize an action:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .collapseAllAction((action) => action.label('Collapse all members'))
```

Hiding an action with `hidden()` or `visible()` also refuses it on the server. The restrictions of the field, such as `deletable(false)` or `maxItems()`, still apply whatever the action says.

### Confirming repeater actions with a modal

You can confirm actions with a modal by using the `requiresConfirmation()` method on the action object. You may use any [modal customization method](/actions/modals) to change its content and behavior:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        // ...
    ])
    .deleteAction((action) => action.requiresConfirmation())
```

The item stays in the form until the user confirms. If they cancel, nothing changes.

<Aside variant="info">
The `collapseAction()`, `collapseAllAction()`, `expandAction()` and `expandAllAction()` methods do not support confirmation modals, as clicking their buttons does not make the network request that is required to show the modal.
</Aside>

Completing a drag that changes the item order invokes `reorderAction()`, which supports `requiresConfirmation()`. Clicking the drag handle alone does not invoke the action.

### Adding extra item actions to a repeater

You may add new [action buttons](/actions/overview) to the header of each repeater item by passing `Action` objects into `extraItemActions()`. They are small gray icon buttons, unless you say otherwise:

```ts
import { Action } from '@navette-js/actions';
import { Repeater, TextInput } from '@navette-js/forms';

Repeater.make('members')
    .schema([
        TextInput.make('email')
            .label('Email address')
            .email()
            .required(),
        // ...
    ])
    .extraItemActions([
        Action.make('sendEmail')
            .icon('m-envelope')
            .requiresConfirmation()
            .action(async ({ arguments: args, component }) => {
                const itemData = await component.getItemState(args.item);

                await mailer.send(itemData.email, 'Welcome to the team!');
            }),
    ])
```

In this example, `arguments.item` gives you the key of the current repeater item, and `component` is the repeater. The key comes from the browser, so it is checked on the server: an action mounted with a key that is not an item of the repeater is refused before it runs.

You can validate the data in that repeater item using the `getItemState()` method on the repeater component. This method returns the validated data for the item. If the item is not valid, it cancels the action and shows the error messages for that item in the form.

If you want to get a snapshot of the current item's state without validating it, you can use `component.getItemStateSnapshot(args.item)` instead. The snapshot still applies the fields' state transformations. `component.getRawItemState(args.item)` returns the raw data of the item, or `null` for an unknown key.

An extra item action can have a [modal form](/actions/modals): its `schema()` function receives the arguments as well, as `(schema, { arguments })`.

<Aside variant="info">
Extra item actions are also displayed in the rows of a [table repeater](#table-repeaters), next to the delete button. For a simple link, [`extraItemLink()`](#adding-links-to-items) is enough.
</Aside>
