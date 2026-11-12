---
title: Icon column
---

## Introduction

Icon columns render an [icon](/styling/icons) representing the state of the column. In Navette, they display boolean values.

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

<Aside variant="warning">
Icon columns only support `boolean()` for now: a column without it renders an empty cell. Custom icons per state (`icon()`), colors (`color()`), sizes, custom boolean icons and colors, and wrapping multiple icons are not available yet. To display a different icon depending on the state, use a [text column](/tables/columns/text#adding-an-icon) with `icon()`, or a [custom column](/tables/columns/custom-columns).
</Aside>

You may also use the deprecated `BooleanColumn`, which is an `IconColumn` with `boolean()` already enabled.
