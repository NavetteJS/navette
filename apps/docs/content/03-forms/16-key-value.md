---
title: Key-value
---

## Introduction

The key-value field allows you to interact with a one-dimensional object of keys and values:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
```

```preview
// width: 32rem
KeyValue.make('meta')
```

The saved value is an object, such as `{ "department": "Sales", "badge": "1042" }`. Store it in a JSON column: with an Objection model, list the column in `static jsonAttributes`. When the form is filled, the field also accepts the same object as a JSON string.

While the form is open, the state is a list of `{ key, value }` rows, so the order of the rows is kept. You only see this shape if you read the state with `get()`.

## Adding rows

An action button is displayed below the field to allow the user to add a new row.

## Deleting rows

An action button is displayed on each row to allow the user to delete it.

## Editing keys

### Customizing the key fields' label

You may customize the label for the key fields using the `keyLabel()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .keyLabel('Property name')
```

```preview
// width: 32rem
KeyValue.make('meta')
    .keyLabel('Property name')
    .valueLabel('Property value')
```

## Editing values

### Customizing the value fields' label

You may customize the label for the value fields using the `valueLabel()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .valueLabel('Property value')
```

## Reordering rows

You can allow the user to reorder rows within the table using the `reorderable()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .reorderable()
```

## Understanding the saved value

The rows come from the browser, so the saved object is cleaned on the server:

- Keys are trimmed and cut to 255 characters. Rows with an empty key are dropped, as are the keys `__proto__`, `constructor` and `prototype`.
- Values are saved as strings, cut to 5000 characters. A missing value, or a nested object or list, is saved as `null`.
- At most 200 rows are kept. If two rows have the same key, the last one wins.

<Aside variant="warning">
Preventing the user from adding, deleting or editing rows, key and value placeholders and customizing the action objects are not available yet.
</Aside>
