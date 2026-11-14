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

### Setting the add action button's label

You may set a label to customize the text that should be displayed in the button for adding a row, using the `addActionLabel()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .addActionLabel('Add property')
```

### Preventing the user from adding rows

You may prevent the user from adding rows using the `addable(false)` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .addable(false)
```

## Deleting rows

An action button is displayed on each row to allow the user to delete it.

### Setting the delete action button's label

You may customize the label of the delete button, which is used as its tooltip and accessible name, using the `deleteActionLabel()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .deleteActionLabel('Remove property')
```

### Preventing the user from deleting rows

You may prevent the user from deleting rows using the `deletable(false)` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .deletable(false)
```

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

### Adding key field placeholders

You may also add placeholders for the key fields using the `keyPlaceholder()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .keyPlaceholder('Property name')
```

### Preventing the user from editing keys

You may prevent the user from editing keys using the `editableKeys(false)` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .editableKeys(false)
```

## Editing values

### Customizing the value fields' label

You may customize the label for the value fields using the `valueLabel()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .valueLabel('Property value')
```

### Adding value field placeholders

You may also add placeholders for the value fields using the `valuePlaceholder()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .valuePlaceholder('Property value')
```

### Preventing the user from editing values

You may prevent the user from editing values using the `editableValues(false)` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .editableValues(false)
```

## Reordering rows

You can allow the user to reorder rows within the table using the `reorderable()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .reorderable()
```

The drag handle of each row is labelled "Reorder row" (its accessible name and title). You may change this label using the `reorderActionLabel()` method:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .reorderable()
    .reorderActionLabel('Move property')
```

## Understanding the saved value

The rows come from the browser, so the saved object is cleaned on the server:

- Keys are trimmed and cut to 255 characters. Rows with an empty key are dropped, as are the keys `__proto__`, `constructor` and `prototype`.
- Values are saved as strings, cut to 5000 characters. A missing value, or a nested object or list, is saved as `null`.
- At most 200 rows are kept. If two rows have the same key, the last one wins.

The restrictions set with `addable(false)`, `deletable(false)`, `editableKeys(false)` and `editableValues(false)` are also enforced on the server, so a forged request cannot bypass them. The submitted rows are compared with the value the form was filled with:

- With `addable(false)`, rows whose key was not in that value are dropped.
- With `deletable(false)`, rows that were in that value and are missing from the request are put back.
- With `editableKeys(false)`, the keys of that value are kept, in their order.
- With `editableValues(false)`, the values of that value are kept, and a row with a new key gets a `null` value.

## Customizing the key-value action objects

This field uses action objects for easy customization of buttons within it. You can customize these buttons by passing a function to an action registration method. The function receives the `Action` object, which you can use to [customize it](/actions/overview). The following methods are available to customize the actions:

- `addAction()`
- `deleteAction()`
- `reorderAction()`

Here is an example of how you might customize an action:

```ts
import { KeyValue } from '@navette-js/forms';

KeyValue.make('meta')
    .deleteAction((action) => action.icon('m-x-mark'))
```

Rows are added, deleted and moved in the browser, so these actions accept a label, an icon, a color and visibility, but no modal. Hiding the add or delete action removes the button only: use `addable(false)` or `deletable(false)` to have the server refuse the change too.
