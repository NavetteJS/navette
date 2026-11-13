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

## Allowing the color to be copied to the clipboard

You may make the color copyable, such that clicking on the preview copies the CSS value to the clipboard, and optionally specify a custom confirmation message and duration in milliseconds:

```ts
import { ColorEntry } from '@navette-js/infolists';

ColorEntry.make('color')
    .copyable()
    .copyMessage('Copied!')
    .copyMessageDuration(1500)
```

```preview
// record: {"color": "#3b82f6"}
ColorEntry.make('color')
    .copyable()
    .copyMessage('Copied!')
    .copyMessageDuration(1500)
```

Optionally, you may pass a boolean value, or a function of the record and the state, to control if the color should be copyable or not. To copy another value than the color, use `copyableState()`.

<Aside variant="warning">
Browsers only allow copying to the clipboard on secure origins, so this feature only works when the panel is served over HTTPS (or on `localhost`).
</Aside>

## Displaying multiple colors

If the state is an array, a preview is displayed for each supported color, and the other values are skipped:

```ts
import { ColorEntry } from '@navette-js/infolists';

ColorEntry.make('palette')
```

```preview
// record: {"palette": ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"]}
ColorEntry.make('palette')
```

By default, the previews wrap to the next line when they exceed the width of the container. You can disable this behavior using `wrap(false)`. When the entry has a [tooltip](/infolists/overview#adding-a-tooltip-to-an-entry), screen readers announce the tooltip instead of the color value.

