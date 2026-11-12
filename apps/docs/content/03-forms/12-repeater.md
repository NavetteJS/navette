---
title: Repeater
---

## Introduction

The repeater component allows you to output a list of items, each with the same set of fields. In Navette, the repeater is displayed as a table: one row per item, one column per field:

```ts
import { Repeater, Select, TableColumn, TextInput } from '@navette-js/forms';

Repeater.make('members')
    .table([
        TableColumn.make('Name'),
        TableColumn.make('Role').width(160),
    ])
    .schema(() => [
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
    .schema(() => [
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

`schema()` takes a function returning the fields of an item. It is called for each item, so each item gets its own field instances. `table()` defines the column headers, in the same order as the fields. `TableColumn.width()` accepts a number of pixels or a CSS width.

The state of a repeater is an object of items keyed by a unique item key, in display order:

```json
{
    "6f1c…": { "name": "Dan Harrin", "role": "owner" },
    "a03b…": { "name": "Ryan Chandler", "role": "member" }
}
```

The keys of new items are UUIDs. Keys coming from the browser are checked: only simple keys (letters, digits, `_` and `-`) are kept.

<Aside variant="warning">
The stacked (card) layout, grid layout, collapsing, cloning, item labels, simple repeaters and `relationship()` are not available yet.
</Aside>

## Setting empty default items

Repeaters start with no item. You may add default items with `defaultItems()`. Each item is filled with the default values of its fields:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .defaultItems(1)
    .schema(() => [
        // ...
    ])
```

Default items are created when the form is filled without a value for the repeater: on a Create page, or on an Edit page when the record has no value for it.

## Adding items

An action button is displayed below the table to allow the user to add a new item. You may limit the number of items with `maxItems()`: the button disappears once the limit is reached, and the server ignores further additions.

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .maxItems(10)
    .schema(() => [
        // ...
    ])
```

Without `maxItems()`, a repeater is limited to 500 items.

## Deleting items

An action button is displayed on each row to allow the user to delete it.

## Reordering items

When there is more than one item, a handle on each row allows the user to reorder the items by drag and drop. Keyboard users can move an item up or down with buttons revealed to assistive technology. The server only accepts a new order that is a permutation of the existing items.

### Preventing the user from reordering items

You may use the `reorderable(false)` method to prevent items from being reordered:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('members')
    .reorderable(false)
    .schema(() => [
        // ...
    ])
```

## Saving a relationship

The repeater does not save related records itself: the saved value is the object of items, and your data adapter decides what to do with it.

When the form is filled from a list of related rows (for example, `record.items` loaded by your adapter's `find()`), each row becomes an item keyed `record-<id>`, with only the declared fields. When saving, you may use this key to update the rows that still exist, create the new ones and delete the rest:

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

Each related row must have an `id`. A list of objects without `id` (a plain JSON column, for example) would give every item the same key: store such a value as the object of items instead.

## Adding links to items

You may add a link to each row with `extraItemLink()`. The function receives the item and its key, and returns a link (`label`, `icon`, `url`) or `null`. The link opens in a new tab:

```ts
import { Repeater } from '@navette-js/forms';

Repeater.make('items')
    .extraItemLink(({ item }) => (item.product_id
        ? { label: 'Open product', icon: 'm-arrow-top-right-on-square', url: `/shop/products/${Number(item.product_id)}/edit` }
        : null))
```

## Accessing parent field values

Inside an item, `get()` and `set()` are relative to the item: `get('quantity')` reads the quantity of the same row. To read a field outside of the item, use the host component's state, which lives under `data` on resource pages:

```ts
import { Repeater, TextInput } from '@navette-js/forms';

Repeater.make('items')
    .schema(() => [
        TextInput.make('qty')
            .integer()
            .maxValue(1000)
            .hint(({ livewire }) => ((livewire as any).data?.currency === 'EUR' ? 'Units, billed in euros' : null)),
    ])
```

To update a total when an item changes, see [setting the state of another field](/forms/overview#setting-the-state-of-another-field).

## Repeater validation

As well as all rules listed on the [validation](/forms/validation) page, a `required()` repeater needs at least one item. Each field of each item is validated with its own rules; errors are displayed in the row.

```preview
// state: {"members": {"a1": {"name": "Dan Harrin", "role": "owner"}, "b2": {"name": "", "role": "member"}}}
// errors: {"data.members.b2.name": ["The name field is required."]}
// viewport: 900
Repeater.make('members')
    .required()
    .table([
        TableColumn.make('Name'),
        TableColumn.make('Role').width(160),
    ])
    .schema(() => [
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
