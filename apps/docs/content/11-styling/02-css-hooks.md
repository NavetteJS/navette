---
title: CSS hooks
---

## Introduction

The markup rendered by Navette carries "hook" classes: classes that start with `nv-` and name the elements of the interface, such as `nv-sidebar`, `nv-btn` or `nv-ta-row`. You can target them with your own CSS to change the look of the panel, without overriding any view.

## Discovering hook classes

Open the developer tools of your browser and inspect the element you want to style. Its hook classes are listed in its `class` attribute, next to classes that describe its state (`nv-active`, `nv-disabled`), its size (`nv-size-md`) or its color (`nv-color-primary`).

Some classes tell you where you are:

| Element | Classes |
|---|---|
| `<body>` | `nv-body`, `nv-panel-<id of the panel>`, and `nv-body-has-topbar`, `nv-body-has-navigation`… |
| A resource page | `nv-resource-<slug>` (slashes become dashes: `nv-resource-shop-customers`) |
| The page of a record | `nv-resource-record-<key>` |
| The type of resource page | `nv-resource-list-records-page`, `nv-resource-create-record-page`, `nv-resource-edit-record-page`, `nv-resource-view-record-page`, `nv-resource-manage-related-records-page` |

A custom page may add its own classes by overriding `getPageClasses()`:

```ts
import { Page } from '@navette-js/panels';

export class StatusPage extends Page {
    getPageClasses(): string[] {
        return ['app-status-page'];
    }
}
```

## Applying styles to hook classes

There are three places to put your CSS.

In a [custom theme](/styling/overview#creating-a-custom-theme), compiled by Tailwind. This is the best place for large changes, and the only one where you may use `@apply`:

```css
@import '@navette-js/panels/theme.css';

.nv-sidebar {
    @apply bg-gray-50 dark:bg-gray-950;
}
```

In a plain stylesheet served by your application, added to the `<head>` of every page with a [render hook](/advanced/render-hooks):

```ts
panel.renderHook('panels::styles.after', () => '<link rel="stylesheet" href="/css/admin.css">');
```

```css
.nv-panel-admin .nv-sidebar-item-btn {
    border-radius: 9999px;
}
```

In the `css` of a [user-selectable theme](/styling/overview#offering-themes-to-users), for styles that belong to one theme only.

Tailwind CSS uses layers, and so does the stylesheet of the panel: a rule written outside of a layer, like the ones above, takes precedence over the default styles. Use `!important` only as a last resort.

## Common hook class abbreviations

Some hook classes are abbreviated to keep them short:

| Abbreviation | Meaning |
|---|---|
| `nv-ac` | actions |
| `nv-btn` | button |
| `nv-ctn` | container |
| `nv-fo` | forms |
| `nv-in` | infolists |
| `nv-no` | notifications |
| `nv-sc` | schemas |
| `nv-ta` | tables |
| `nv-wi` | widgets |
| `-wrp` | wrapper |
| `-ctn` | container |

Classes specific to Navette, such as the calendar (`nv-cal`) and the theme picker (`nv-theme-list`), start with `nv-`.

## Overriding views

When CSS is not enough, you may replace a view of the framework. Views are EJS templates, grouped in namespaces. Give Navette a folder of overrides when your application starts:

```ts
import path from 'node:path';
import { views } from '@navette-js/support';

views.overrideFrom(path.resolve('./views/vendor'));
```

A file `views/vendor/<namespace>/<path>.ejs` then replaces the view of the same name. For example, `views/vendor/navette-panels/components/user-menu.ejs` replaces the user menu. The original views are in the `views` folder of each package (`packages/panels/views`, `packages/tables/views`…).

<Aside variant="warning">
An overridden view no longer follows the changes of the framework, and an unescaped value in it opens an XSS hole: in EJS, `<%= value %>` escapes and `<%- html %>` does not. Prefer CSS hooks and render hooks when they are enough.
</Aside>
