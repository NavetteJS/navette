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

<Aside variant="warning">
Copying the color to the clipboard (`copyable()`) and wrapping multiple color blocks are not available yet.
</Aside>
