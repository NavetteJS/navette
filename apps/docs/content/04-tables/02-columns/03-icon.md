---
title: Icon column
---

## Introduction

Icon columns render an [icon](/styling/icons) representing the state of the column.

## Choosing the icon

`icon()` takes an icon name, or a function of the record and the state:

```ts
import { IconColumn } from '@navette-js/tables';

IconColumn.make('status')
    .icon((record, status) => ({ draft: 'o-pencil', reviewing: 'o-clock', published: 'o-check-circle' })[status] ?? null)
    .color((record, status) => ({ draft: 'gray', reviewing: 'warning', published: 'success' })[status] ?? null)
```

`color()` works the same way. `size()` sets the size: `xs`, `sm`, `md`, `lg` (the default), `xl` or `2xl`. Each icon has a hidden text alternative for screen readers: its tooltip if it has one, otherwise the state.

## Handling booleans

Icon columns can display a check or "X" icon based on the state of the column, either true or false, using the `boolean()` method:

```ts
import { IconColumn } from '@navette-js/tables';

IconColumn.make('is_featured')
    .boolean()
```

```preview
// records: [{"title": "Introducing Navette", "is_featured": true}, {"title": "Building your first panel", "is_featured": false}, {"title": "Ten tips for faster tables", "is_featured": true}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        IconColumn.make('is_featured').boolean(),
    ])
```

`true`, `1` and `'1'` display a green check (`o-check-circle`, `success` color). Any other value, such as `false` or `0` as returned by SQLite, displays a red cross (`o-x-circle`, `danger` color). When the state is `null`, the cell is empty. Each icon has a hidden text label for screen readers.

Optionally, you may pass a boolean value to control if the icon should be boolean or not:

```ts
import { IconColumn } from '@navette-js/tables';

IconColumn.make('is_featured')
    .boolean(featureFlags.booleanColumns)
```

### Customizing the boolean icons and colors

```ts
import { IconColumn } from '@navette-js/tables';

IconColumn.make('is_featured')
    .boolean()
    .trueIcon('o-star')
    .falseIcon(false)
    .trueColor('warning')
```

`false` as an icon displays nothing for that value.

## Displaying multiple icons

When the state is an array, one icon is displayed per value. `listWithLineBreaks()` puts each one on its own line, and `wrap()` lets them wrap.

## Adding a tooltip and a placeholder

`tooltip()` takes a string or a function of the record and the state. `placeholder()` sets the text displayed when the state is empty.

You may also use the deprecated `BooleanColumn`, which is an `IconColumn` with `boolean()` already enabled.
