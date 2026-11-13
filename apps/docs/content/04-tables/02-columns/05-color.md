---
title: Color column
---

## Introduction

The color column allows you to show the color preview from a CSS color definition, typically entered using the color picker field:

```ts
import { ColorColumn } from '@navette-js/tables';

ColorColumn.make('color')
```

```preview
// records: [{"name": "Ocean", "color": "#0ea5e9"}, {"name": "Forest", "color": "#16a34a"}, {"name": "Sunset", "color": "rgb(245, 158, 11)"}, {"name": "Berry", "color": "hsl(330, 80%, 50%)"}]
new Table()
    .pluralModelLabel('themes')
    .columns([
        TextColumn.make('name'),
        ColorColumn.make('color'),
    ])
```

The state is displayed as a small swatch. Its accessible name is the color value itself.

## Supported color formats

Only these formats are rendered:

- hexadecimal colors with 3 to 8 digits, such as `#f59e0b`;
- `rgb()`, `rgba()`, `hsl()`, `hsla()`, `oklch()` and `oklcha()` colors with numeric arguments, such as `rgb(245, 158, 11)`.

Any other value, such as a color name, renders an empty cell. This prevents a value stored by a user from injecting other CSS into the `style` attribute of the swatch.

## Allowing the color to be copied to the clipboard

You may make the color copyable, such that clicking on the preview copies the CSS value to the clipboard, and optionally specify a custom confirmation message and duration in milliseconds:

```ts
import { ColorColumn } from '@navette-js/tables';

ColorColumn.make('color')
    .copyable()
    .copyMessage('Color code copied')
    .copyMessageDuration(1500)
```

The browser only gives access to the clipboard on HTTPS pages or on `localhost`.

## Displaying multiple colors

When the state is an array of colors, a swatch is displayed for each of them. Color blocks can wrap if they can't fit on one line, by setting `wrap()`:

```ts
import { ColorColumn } from '@navette-js/tables';

ColorColumn.make('palette')
    .wrap()
```

```preview
// records: [{"name": "Seaside", "palette": ["#0ea5e9", "#38bdf8", "#f59e0b", "#fde68a"]}, {"name": "Woods", "palette": ["#14532d", "#16a34a", "#a16207"]}]
new Table()
    .pluralModelLabel('palettes')
    .columns([
        TextColumn.make('name'),
        ColorColumn.make('palette').wrap(),
    ])
```

## Other options

- `tooltip()` accepts a text, or a function that receives the record and the color.
- `placeholder()` displays a text when the state is empty.
- `alignCenter()` and `alignEnd()` align the swatches in the cell.
