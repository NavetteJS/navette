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

The color picker stores colors in hexadecimal format, such as `#f59e0b`. `hex()` is accepted for compatibility with Filament, and changes nothing:

```ts
import { ColorPicker } from '@navette-js/forms';

ColorPicker.make('team_color')
    .hex()
```

<Aside variant="warning">
The `rgb()`, `rgba()` and `hsl()` formats are not available yet.
</Aside>

## Color picker validation

The color picker always validates the value on the server: it must be a hexadecimal color of 3, 4, 6 or 8 digits, starting with `#`. An empty value is accepted unless the field is `required()`.

A value saved through the form can only contain `#` and hexadecimal digits. Values written to the column by other means are not checked: escape them like any other value before using them in a `style` attribute.
