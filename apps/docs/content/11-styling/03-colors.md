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

The palette of the new color is available as CSS variables (`--brand-50` to `--brand-950`), and components receive the classes `fi-color fi-color-brand`. The panel also writes the rule mapping that class to the color variables of components, next to the palette variables, so a button, a badge or an icon colored `brand` uses it with nothing else to add:

```css
.fi-color-brand {
    --color-50: var(--brand-50);
    --color-100: var(--brand-100);
    /* … every shade up to 950 */
    --color-950: var(--brand-950);
}
```

The default colors (`primary`, `danger`, `gray`, `info`, `success`, `warning`) already have their rules in Navette's stylesheet.

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

## Customizing shade selection

If you need to override how a particular component picks its shades (for example, to target WCAG AAA contrast or prefer darker button backgrounds), register your own color map for it with `ColorManager.overrideColorMap()`, once, when your server starts. It applies to every panel.

`@navette-js/support` exposes three color-map builders for this purpose. Each follows the same fluent shape: `make(palette)` to start, chained configuration setters, then `get()` to return an object mapping slot names (such as `bg`, `text`, `dark:hover:bg`) to shade numbers:

- `ComponentColorMap`, for components that pick one shade per slot, like badges, links, text, icons, dropdown items and toggles.
- `ButtonComponentColorMap`, for filled buttons. It picks a background shade and pairs it with a matching text shade.
- `IconButtonComponentColorMap`, for icon-only buttons. It picks a single icon shade and derives a hover variant from it.

### Components you can override

The first argument of `overrideColorMap()` names the component:

| Component | Used by |
| --- | --- |
| `'badge'` | Badges, including badge columns and entries, and navigation badges |
| `'button'` | Filled buttons |
| `'button-outlined'` | Outlined buttons |
| `'icon-button'` | Icon-only buttons |
| `'link'` | Links, and link actions |
| `'toggle'` | Form toggles and toggle columns |
| `'dropdown-item'` | Dropdown items and grouped actions |
| `'text'` | Colored text of text columns, text entries and schema text |
| `'icon-column'` | Icons of icon columns and icon entries |
| `'stat-description'` | Descriptions of the stats overview widget |
| `'stat-chart'` | Charts of the stats overview widget (no shades: only the `fi-color` classes) |

The second argument is a function. It receives the palette of the color being rendered, and a context with the `gray` palette, the name of the `color` (`'primary'`, `'danger'`…), and `getDefault()`, which returns the map Navette would use. It returns the new map:

```ts
import { ColorManager, ComponentColorMap, WCAG_AAA_TEXT } from '@navette-js/support';

ColorManager.overrideColorMap('badge', (palette, { gray, color, getDefault }) => color === 'gray'
    ? getDefault()
    : ComponentColorMap.make(palette)
        .slot('text', { surface: palette[50], minRatio: WCAG_AAA_TEXT })
        .slot('dark:text', { surface: gray[600], minRatio: WCAG_AAA_TEXT, maxShade: 500, shouldStartFromDarkest: true, fallback: 200 })
        .get());
```

The slots are `bg`, `hover:bg`, `dark:bg`, `dark:hover:bg`, `text`, `hover:text`, `dark:text` and `dark:hover:text`, and the shades whole numbers from `0` (white) to `950`. Any other slot or shade throws an error when the component is rendered. Pass `null` to restore the default: `ColorManager.overrideColorMap('badge', null)`.

<Aside variant="tip">
The fastest way to write a custom map is to start from the default one: `getDefault()` returns it, and the default functions (`buttonColorMap()`, `badgeColorMap()`, `linkColorMap()`…) are exported by `@navette-js/support`. `ColorManager.getColorMap(component, palette, gray)` returns the map in use for a component.
</Aside>

### `ComponentColorMap`

Builds a slot map one entry at a time. Call `slot()` once per output slot, then `get()`:

```ts
import { ComponentColorMap, WCAG_AA_TEXT } from '@navette-js/support';

ComponentColorMap.make(palette)
    .slot('text', { surface: gray[50], minRatio: WCAG_AA_TEXT, fallback: 900 })
    .slot('dark:text', { surface: gray[700], maxShade: 500, shouldStartFromDarkest: true, fallback: 200 })
    .get();
```

`slot()` options:

- `surface`: the color the chosen shade must contrast against (typically `gray[50]`, `gray[700]`, or `'oklch(1 0 0)'`).
- `minRatio`: minimum contrast ratio. Defaults to `WCAG_AA_TEXT` (`4.5`); use `WCAG_AA_NON_TEXT` (`3`) for icons or `WCAG_AAA_TEXT` (`7`) for AAA.
- `maxShade`: optional upper bound on the shade number considered.
- `minShade`: optional lower bound.
- `shouldStartFromDarkest`: walk from the darkest shade to the lightest instead of the default lightest to darkest. Use it for dark-mode lookups.
- `fallback`: shade returned when no candidate qualifies. Defaults to `900`; typically `200` for dark mode.

### `ButtonComponentColorMap`

Returns all eight slots a filled button needs (`bg`, `hover:bg`, `dark:bg`, `dark:hover:bg`, `text`, `hover:text`, `dark:text`, `dark:hover:text`) from one `get()` call. You configure which background shades to use; the matching text shade for each is found automatically. At least one `lightBackground()` and one `darkBackground()` are required:

```ts
import { ButtonComponentColorMap, WCAG_AA_TEXT } from '@navette-js/support';

ButtonComponentColorMap.make(palette)
    .minContrastRatio(WCAG_AA_TEXT)
    .lightBackground(600, 500)
    .lightBackground(400, 300, 500)
    .darkBackground(600, 500, 700)
    .get();
```

`minContrastRatio()` sets the minimum ratio between the background and the text. It defaults to `WCAG_AA_TEXT` (`4.5`); set it to `WCAG_AAA_TEXT` (`7`) for AAA.

`lightBackground()` and `darkBackground()` accept `(bg, hover, alternateHover?)`. Chain candidates in preference order. Navette prefers candidates that support light text in both resting and hover states, using `alternateHover` when the main hover shade is unsuitable. The final candidate is the fallback.

To express a color-aware cascade ("use 800 if the palette can carry it, otherwise 700, otherwise 600, falling back to a paler background with dark text for yellows"), chain candidates and end with a pale-friendly fallback:

```ts
ButtonComponentColorMap.make(palette)
    .lightBackground(800, 700)
    .lightBackground(700, 600)
    .lightBackground(600, 500)
    .lightBackground(400, 300, 500) // pale fallback
    .darkBackground(600, 500, 700)
    .get();
```

<Aside variant="warning">
The last candidate doubles as the fallback when no candidate produces light text on its background. If you configure only vibrant-friendly candidates and your palette is pale, that last candidate is used anyway, likely producing dark text on a dark background. Always end with a pale-friendly candidate (a background around `400`) to handle yellows, ambers and limes.
</Aside>

### `IconButtonComponentColorMap`

Returns the four icon slots (`text`, `hover:text`, `dark:text`, `dark:hover:text`) for icon-only buttons. A `lightSurface()` and a `darkSurface()` are required:

```ts
import { IconButtonComponentColorMap, WCAG_AA_NON_TEXT } from '@navette-js/support';

IconButtonComponentColorMap.make(palette)
    .minContrastRatio(WCAG_AA_NON_TEXT)
    .lightSurface(gray[50])
    .darkSurface(gray[700])
    .darkMaxShade(500)
    .get();
```

- `minContrastRatio()`: minimum contrast ratio between the icon and the surface. Defaults to `WCAG_AA_NON_TEXT` (`3`).
- `lightSurface()` / `darkSurface()`: the surface the icon must contrast against in each mode, typically `gray[50]` and `gray[700]`.
- `darkMaxShade()`: upper bound on the shade considered for the dark-mode icon color. Defaults to `500`; lower it for lighter icons.

### Worked example: AAA contrast for buttons

Here is a complete configuration that targets WCAG AAA contrast and prefers darker button backgrounds, for filled and outlined buttons. Verify the rendered contrast with your palettes and backgrounds, since fallback shades may not meet the target:

```ts
import { ButtonComponentColorMap, ColorManager, ComponentColorMap, WCAG_AAA_TEXT } from '@navette-js/support';

ColorManager.overrideColorMap('button', (palette) => ButtonComponentColorMap.make(palette)
    .minContrastRatio(WCAG_AAA_TEXT)
    .lightBackground(700, 600)
    .lightBackground(400, 300, 500)
    .darkBackground(600, 500, 700)
    .get());

ColorManager.overrideColorMap('button-outlined', (palette, { gray }) => ComponentColorMap.make(palette)
    .slot('text', { surface: gray[50], minRatio: WCAG_AAA_TEXT, fallback: 900 })
    .slot('dark:text', { surface: gray[700], minRatio: WCAG_AAA_TEXT, maxShade: 500, shouldStartFromDarkest: true, fallback: 200 })
    .get());
```

The gray button gets no color classes, so its map is never used.

<Aside variant="tip">
The defaults work for the overwhelming majority of palettes. Only override these maps if you have specific accessibility requirements (such as AAA compliance) or a design system that mandates different shade preferences.
</Aside>
