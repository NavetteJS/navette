---
title: Color entry
---

## Introduction

The color entry allows you to show the color preview from a CSS color definition, typically entered using the [color picker field](/forms/color-picker):

```ts
import { ColorEntry } from '@navette-js/infolists';

ColorEntry.make('team_color')
```

```preview
// record: {"team_color": "#3b82f6"}
ColorEntry.make('team_color')
```

The color is exposed to screen readers as an image labelled with its value.

## Supported formats

Only these formats are displayed:

- Hexadecimal colors, from `#rgb` to `#rrggbbaa`.
- `rgb()`, `rgba()`, `hsl()`, `hsla()` and `oklch()` with plain numeric arguments, such as `rgb(255, 0, 0)` or `hsl(0deg 100% 50%)`.

Any other value, such as a color name (`red`) or a CSS variable, is treated as empty. This prevents a stored value from injecting other styles into the page.

## Adding placeholder text if the color is empty

You may display placeholder text when the state is empty or is not a supported color, using `placeholder()`:

```ts
import { ColorEntry } from '@navette-js/infolists';

ColorEntry.make('team_color')
    .placeholder('No color')
```

```preview
// record: {"team_color": null}
ColorEntry.make('team_color')
    .placeholder('No color')
```

<Aside variant="warning">
Copying the color to the clipboard (`copyable()`) is not available on the color entry in Navette yet.
</Aside>
