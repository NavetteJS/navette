---
title: Key-value entry
---

## Introduction

The key-value entry allows you to render key-value pairs of data, from a one-dimensional object:

```ts
import { KeyValueEntry } from '@navette-js/infolists';

KeyValueEntry.make('meta')
```

```preview
// record: {"meta": {"description": "Navette is a port of Filament to Node.js", "og:type": "website", "og:site_name": "Navette"}}
KeyValueEntry.make('meta')
```

For example, the state of this entry might be represented as:

```ts
{
    description: 'Navette is a port of Filament to Node.js',
    'og:type': 'website',
    'og:site_name': 'Navette',
}
```

The pairs are rendered in a table, with a row per key. Keys and values are escaped.

The state may be an object, a `Map`, or a JSON string, as stored in a JSON column of an SQL database: the entry parses it. A string that is not valid JSON is treated as empty.

Values that are not strings, numbers or booleans, such as nested objects or arrays, are displayed as JSON. `true` is displayed as `1`, and `false` and `null` as an empty cell.

## Customizing the key column's label

You may customize the label for the key column using the `keyLabel()` method:

```ts
import { KeyValueEntry } from '@navette-js/infolists';

KeyValueEntry.make('metadata')
    .keyLabel('Property')
```

## Customizing the value column's label

You may customize the label for the value column using the `valueLabel()` method:

```ts
import { KeyValueEntry } from '@navette-js/infolists';

KeyValueEntry.make('metadata')
    .keyLabel('Property')
    .valueLabel('Value')
```

```preview
// record: {"metadata": {"color": "Midnight blue", "size": "XL", "material": "Organic cotton"}}
KeyValueEntry.make('metadata')
    .keyLabel('Property')
    .valueLabel('Value')
```

## Customizing the placeholder text

When there are no pairs, the table displays "No entries". You may change this text using the `placeholder()` method:

```ts
import { KeyValueEntry } from '@navette-js/infolists';

KeyValueEntry.make('metadata')
    .placeholder('No metadata')
```

```preview
// record: {"metadata": {}}
KeyValueEntry.make('metadata')
    .placeholder('No metadata')
```
