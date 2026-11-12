---
title: Icons
---

## Introduction

Icons are used throughout the interface of Navette: in the navigation, in actions, in columns and entries, in notifications. Navette ships with [Heroicons](https://heroicons.com), the icon set of Filament, and lets you add your own SVG icons.

## Using Heroicons in Navette

An icon is designated by its name, prefixed with its style:

| Prefix | Style | Size |
|---|---|---|
| `o-` | Outline | 24 px |
| `s-` | Solid | 24 px |
| `m-` | Mini | 20 px |
| `c-` | Micro | 16 px |

```ts
import { Action } from '@navette-js/actions';

static navigationIcon = 'o-user-group';

Action.make('export').icon('m-arrow-down-tray')
```

Filament's names with the `heroicon-` prefix are accepted too: `heroicon-o-user-group` is the same icon as `o-user-group`. Like Filament's own components, the navigation uses outline icons, buttons use mini icons, and table row actions use micro icons (`tableIcon()`).

The names are those of [heroicons.com](https://heroicons.com). An unknown name throws an error when the page is rendered, so a typo shows up during development.

## Using custom SVGs as icons

To use an icon that is not part of Heroicons, such as the logo of a service, register its SVG with `registerIcon()` when your application starts. The name is then usable wherever an icon name is expected:

```ts
import { registerIcon } from '@navette-js/support';

registerIcon('github', '<svg viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="…"/></svg>');

Action.make('repository').icon('github').url('https://github.com/acme/app')
```

The markup must be a complete `<svg>` element: other values throw an error. It is inserted as is, with the size classes of the component added, so it must come from your application, never from user input. Use `currentColor` to follow the color of the component.

## Rendering an icon in your own HTML

In a render hook, a custom view or an `Html` component, `icon()` returns the markup of an icon with the classes of Filament (`fi-icon fi-size-md`). It accepts a size:

```ts
import { icon } from '@navette-js/support';

panel.renderHook('panels::sidebar.footer', () => `<a href="/help" class="app-help">${icon('o-question-mark-circle', { size: 'lg' })} Help</a>`);
```

<Aside variant="warning">
Other icon sets (Blade Icons packages), and replacing the default icons of the interface with icon aliases, are not available yet.
</Aside>
