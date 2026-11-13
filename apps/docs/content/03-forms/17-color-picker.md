---
title: Color picker
---

## Introduction

The color picker component allows you to pick a color:

```ts
import { ColorPicker } from '@navette-js/forms';

ColorPicker.make('color')
```

The user may pick a color in a panel, or type it in the input. A swatch next to the input previews the current color.

## Setting the color format

By default, the color picker stores colors in hexadecimal format, such as `#f59e0b`. You may use `rgb()`, `rgba()` or `hsl()` to store the color in another format instead:

```ts
import { ColorPicker } from '@navette-js/forms';

ColorPicker.make('hsl_color')
    .hsl()

ColorPicker.make('rgb_color')
    .rgb()

ColorPicker.make('rgba_color')
    .rgba()
```

| Method | Example value |
|---|---|
| `hex()` (default) | `#ff0000` |
| `rgb()` | `rgb(255, 0, 0)` |
| `rgba()` | `rgba(255, 0, 0, 1)` |
| `hsl()` | `hsl(0, 100%, 50%)` |

You may also pass the format as a string to the `format()` method: `format('hex')`, `format('rgb')`, `format('rgba')` or `format('hsl')`. The picker in the panel follows the same format.

## Color picker validation

The color picker always validates the value on the server against its format. An empty value is accepted unless the field is `required()`.

| Format | Accepted value |
|---|---|
| `hex` | `#` followed by 3, 4, 6 or 8 hexadecimal digits. |
| `rgb` | `rgb(r, g, b)`, with numbers of up to 3 digits. |
| `rgba` | `rgba(r, g, b, a)`, with numbers of up to 3 digits and an alpha of `0`, `1` or a decimal such as `0.5`. |
| `hsl` | `hsl(h, s%, l%)`, with numbers of up to 3 digits, optionally with decimals. |

The error message is "The color field must be a valid hexadecimal color." for the hexadecimal format, and "The color field format is invalid." for the others.

A value saved through the form can only contain the characters of its format. Values written to the column by other means are not checked: escape them like any other value before using them in a `style` attribute.
