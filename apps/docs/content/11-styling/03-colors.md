---
title: Colors
---

## Introduction

Navette uses CSS variables to define its color palette. These CSS variables are mapped to the classes of the stylesheet when it is loaded. Every component that accepts a color, such as an action, a badge or a stat, takes the **name** of a color: `primary`, `danger`, `gray`…

The panel has six colors by default:

| Name | Default palette | Used for |
|---|---|---|
| `primary` | `Color.Amber` | Main buttons, links, active navigation items |
| `gray` | `Color.Zinc` | Neutral surfaces, borders and text |
| `danger` | `Color.Red` | Deletions, errors |
| `info` | `Color.Blue` | Information |
| `success` | `Color.Green` | Success notifications |
| `warning` | `Color.Amber` | Warnings |

## How to pass a color to Navette

A color is registered under a name with `setColors()` on the panel. It accepts three forms:

```ts
import { Color } from '@navette-js/support';

panel.setColors({
    primary: Color.Indigo,          // a Tailwind palette
    danger: '#e11d48',              // a single color: the palette is generated
    success: 'rgb(22, 163, 74)',    // also a single color
});
```

Then use the name wherever a color is expected:

```ts
Action.make('approve').color('success')
```

The palettes of `Color` are those of Tailwind CSS: `Slate`, `Gray`, `Zinc`, `Neutral`, `Stone`, `Mauve`, `Olive`, `Mist`, `Taupe`, `Red`, `Orange`, `Amber`, `Yellow`, `Lime`, `Green`, `Emerald`, `Teal`, `Cyan`, `Sky`, `Blue`, `Indigo`, `Violet`, `Purple`, `Fuchsia`, `Pink` and `Rose`.

## Customizing the default colors

Override a default color by registering a palette under its name. To change the tint of the grays, register another gray palette:

```ts
panel.setColors({
    primary: Color.Blue,
    gray: Color.Slate,
});
```

Each panel has its own colors, and each [user-selectable theme](/styling/overview#offering-themes-to-users) may change them for the users who pick it.

### Registering extra colors

You may register a color under a new name, and use it like the others:

```ts
panel.setColors({ brand: '#0ea5e9' });

Action.make('export').color('brand')
```

The palette of the new color is available as CSS variables (`--brand-50` to `--brand-950`), and components receive the classes `fi-color fi-color-brand`.

<Aside variant="warning">
Navette does not yet generate the CSS rule that maps a new color name to the color variables of components. Add it yourself, for example in a [custom theme](/styling/overview#creating-a-custom-theme) or with the `panels::styles.after` render hook, with one variable per shade:

```css
.fi-color-brand {
    --color-50: var(--brand-50);
    --color-100: var(--brand-100);
    /* … every shade up to 950 */
    --color-950: var(--brand-950);
}
```
</Aside>

## Using a non-Tailwind color

You can use custom colors that are not part of Tailwind CSS by passing an object of shades from `50` to `950`, in the OKLCH format:

```ts
panel.setColors({
    danger: {
        50: 'oklch(0.969 0.015 12.422)',
        100: 'oklch(0.941 0.03 12.58)',
        200: 'oklch(0.892 0.058 10.001)',
        300: 'oklch(0.81 0.117 11.638)',
        400: 'oklch(0.712 0.194 13.428)',
        500: 'oklch(0.645 0.246 16.439)',
        600: 'oklch(0.586 0.253 17.585)',
        700: 'oklch(0.514 0.222 16.935)',
        800: 'oklch(0.455 0.188 13.697)',
        900: 'oklch(0.41 0.159 10.272)',
        950: 'oklch(0.271 0.105 12.094)',
    },
});
```

### Generating a custom color palette

When you pass a single color, Navette generates the eleven shades for you, keeping its hue. It accepts `#rrggbb`, `#rgb` and `rgb(r, g, b)`:

```ts
panel.setColors({ primary: '#6366f1' });
```

`generatePalette()` from `@navette-js/support` returns the generated palette, if you need it elsewhere.

## How Navette selects accessible shades

Navette picks the shades of each component using contrast ratios. The same palette can produce different shades in a button, a badge or a link, because each component has different backgrounds and contrast requirements:

- text-bearing components (buttons, badges, links, dropdown items) look for a contrast of 4.5:1, the WCAG AA level for normal text;
- non-text components (icon buttons, toggles, icon columns) look for 3:1.

### Why some buttons render dark text instead of white

A filled button uses white text on a dark enough shade. When the light shades of a palette are too light for white text, as with `Amber` or `Yellow`, the button keeps a light background and uses a dark shade of the palette for its text. Changing a registered palette updates these choices automatically.

<Aside variant="warning">
Customizing the shade selection of components is not available yet.
</Aside>
