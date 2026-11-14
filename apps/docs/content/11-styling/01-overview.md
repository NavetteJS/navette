---
title: Overview
---

## Introduction

Navette's interface is styled by a stylesheet compiled with [Tailwind CSS](https://tailwindcss.com), which targets semantic `fi-` classes in the markup. There are several levels of customization, from the simplest to the most powerful:

1. [Colors](/styling/colors), set with one method of the panel.
2. [Themes offered to users](#offering-themes-to-users), each with its own colors, font and CSS.
3. Your own CSS targeting the [CSS hook classes](/styling/css-hooks) of the interface.
4. A [custom theme](#creating-a-custom-theme), compiled by Tailwind from the theme of Navette and from your files.

## Changing the colors

On the panel, use `setColors()` to change the colors of the interface:

```ts
import { Color } from '@navette-js/support';

panel.setColors({
    primary: Color.Emerald,
    gray: Color.Slate,
    danger: '#e11d48',
});
```

See [colors](/styling/colors) for the available palettes and how a palette is generated from a single color.

## Changing the font

The panel uses Inter by default, served by the panel itself. `font()` loads another one, from [Bunny Fonts](https://fonts.bunny.net) or from the URL you give. See [changing the font](/panels/configuration#changing-the-font).

## Offering themes to users

A panel may declare several predefined themes. The user picks one in the user menu, under the light and dark mode switcher, and the choice is kept in a cookie for a year:

```ts
import { Color } from '@navette-js/support';

panel.themes([
    { id: 'navette', label: 'Navette', colors: { primary: Color.Blue } },
    { id: 'alpine', label: 'Alpine', colors: { primary: Color.Emerald, gray: Color.Stone } },
    { id: 'dusk', label: 'Dusk', colors: { primary: Color.Violet, gray: Color.Zinc }, font: { family: 'Outfit' } },
    { id: 'copper', label: 'Copper', colors: { primary: '#b45309', gray: Color.Neutral } },
]);
```

The first theme is the default one. Each theme may have:

| Key | Description |
|---|---|
| `id` | Identifier: lowercase letters, digits and dashes, up to 40 characters. Any other value throws an error. |
| `label` | Name displayed in the menu, next to a swatch of the theme's primary color. |
| `colors` | Same values as `setColors()`. They take precedence over the colors of the panel. |
| `font` | `{ family, url? }`. Without `url`, the font is loaded from Bunny Fonts. |
| `css` | CSS added to every page for this theme. |

The colors are resolved on every request: two users may use two different themes at the same time. Only a theme declared by the panel can be chosen; the menu only appears when the panel declares at least two themes. Light and dark mode are independent of the theme, and stay the user's choice.

<Aside variant="warning">
The `css` of a theme is inserted in the page as is. Write it yourself; never build it from user input.
</Aside>

## Creating a custom theme

A custom theme is a stylesheet compiled by Tailwind from the theme of Navette and from your own files. It lets you change the shape of components (radius, spacing), and use Tailwind classes in your custom pages, widgets and render hooks.

Create a CSS file that imports the theme of Navette and declares where your classes are, with `@source`:

```css
@import '@navette-js/panels/theme.css';

/* Your files, for Tailwind to find the classes they use. */
@source '../**/*.ts';
@source '../../server.ts';

.fi-sidebar-item-btn {
    border-radius: 9999px;
}
```

Compile it with the Tailwind CLI (version 4), into a folder served by your application:

```bash
npx @tailwindcss/cli -i resources/css/theme.css -o public/css/theme.css --minify
```

Then give its URL to the panel. It replaces the default stylesheet:

```ts
app.use(express.static('./public'));

panel.theme('/css/theme.css');
```

Compile the theme again whenever you use new Tailwind classes. The demo application has a complete example: `apps/demo/resources/css/theme.css`, compiled by `npm run build:theme -w @navette-js/demo`.

## Dark mode

The user menu has a switcher between light mode, dark mode and the mode of the operating system (the default). The choice is stored in the browser.

### Changing the default theme mode

Until the user picks a mode in the switcher, the panel follows the operating system. `defaultThemeMode()` changes that:

```ts
import { Panel } from '@navette-js/panels';

Panel.make()
    .defaultThemeMode('light')
```

### Disabling or forcing dark mode

`darkMode(false)` keeps the panel in light mode, and `darkMode(true, true)` in dark mode. In both cases, the switcher is removed from the user menu:

```ts
import { Panel } from '@navette-js/panels';

Panel.make()
    .darkMode(false)
```

To know how a panel is set up, for instance in a plugin or a view, read `hasDarkMode()` (dark mode is available) and `hasDarkModeForced()` (the panel is always dark, Filament's `isDarkModeForced()`), on the panel or on `getCurrentPanel()` during a request:

```ts
import { getCurrentPanel } from '@navette-js/panels';

const panel = getCurrentPanel();
const alwaysDark = panel?.hasDarkModeForced() ?? false;
```

Neither tells which mode the user has picked: that choice stays in their browser.

## Adding a logo

By default, the brand name is displayed as the logo. To use an image, see [setting the brand](/panels/configuration#setting-the-brand), which also covers the dark mode logo and the favicon.

## Motion

Navette adds light animations to the interface: the arrival of pages and of lazy-loaded content, a pressed state on buttons, the opening of modals and menus, and a "Loading…" pill at the top of the screen when a request takes more than 350 milliseconds. They follow the "reduce motion" setting of the operating system.

To render the interface without them:

```ts
panel.motion(false);
```
