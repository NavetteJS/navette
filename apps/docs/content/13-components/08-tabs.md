---
title: Tabs
---

## Introduction

The tabs component renders a row of tabs. Pass the tabs as an array of objects to the `items` prop:

```html
<x-tabs label="Order views" :items="[
    { label: 'All', active: true },
    { label: 'Paid' },
    { label: 'Shipped' },
]" />
```

```preview
template(`<x-tabs label="Order views" :items="[
    { label: 'All', active: true },
    { label: 'Paid' },
    { label: 'Shipped' },
]" />`)
```

The component only renders the tabs: what happens on a click, and the content each tab shows, are up to you. `label` is the accessible name of the row of tabs.

## Triggering the active state of the tab

A tab with `active: true` is highlighted and gets `aria-current="true"`. Choose the active tab on the server, from the state of your page, or in the browser, with Alpine.js.

### Switching tabs on the server

In a [page rendered with a view](/resources/custom-pages#rendering-a-page-with-a-view), keep the current tab in a public property, and build the items in `getViewData()`. Each tab calls a method of the page with `wire:click`, given in its `attributes`:

```ts
import { Page } from '@navette-js/panels';

const TABS = { all: 'All', paid: 'Paid', shipped: 'Shipped' } as const;

export class Orders extends Page {
    static slug = 'orders-overview';
    static view = new URL('./orders-overview.ejs', import.meta.url);
    static callable = ['setTab'];

    tab = 'all';

    setTab(tab: unknown): void {
        // The argument comes from the browser.
        if (typeof tab === 'string' && tab in TABS) this.tab = tab;
    }

    getViewData() {
        return {
            tabs: Object.entries(TABS).map(([key, label]) => ({
                label,
                active: this.tab === key,
                attributes: { 'wire:click': `setTab('${key}')` },
            })),
        };
    }
}
```

```html
<x-tabs label="Order views" :items="tabs" />

<% if (page.tab === 'paid') { %>
    <!-- … -->
<% } %>
```

### Switching tabs in the browser

To switch without a request, keep the current tab in Alpine.js. Build the items in an EJS block, where quotes are free, and bind the `nv-active` class of each tab:

```html
<%
const item = (key, label) => ({
    label,
    active: key === 'details',
    attributes: { 'x-on:click': `tab = '${key}'`, 'x-bind:class': `{ 'nv-active': tab === '${key}' }` },
});
%>
<div x-data="{ tab: 'details' }">
    <x-tabs label="Order" :items="[item('details', 'Details'), item('history', 'History')]" />

    <div x-show="tab === 'details'"><!-- … --></div>
    <div x-show="tab === 'history'" x-cloak><!-- … --></div>
</div>
```

### Writing each tab as a tag

Instead of `items`, write each tab as an `<x-tabs.item>` tag in the content of `<x-tabs>`. Its content is the label; `active` highlights it, and `alpine-active` takes an Alpine.js expression instead, evaluated in the browser:

```html
<x-tabs label="Order" x-data="{ tab: 'details' }">
    <x-tabs.item alpine-active="tab === 'details'" x-on:click="tab = 'details'">
        Details
    </x-tabs.item>

    <x-tabs.item alpine-active="tab === 'history'" x-on:click="tab = 'history'">
        History
    </x-tabs.item>

    <x-tabs.item tag="a" href="/orders/archive" :active="false" icon="o-archive-box">
        Archive
    </x-tabs.item>
</x-tabs>
```

`<x-tabs.item>` takes the props of an item: `active`, `alpine-active`, `icon`, `icon-position`, `badge`, `badge-color`, `tag` and `href`. An active link gets `aria-current="page"`, an active button `aria-current="true"`.

## Setting a tab icon

Give a tab an `icon`, with the name of an [icon](/styling/icons):

```html
<x-tabs label="Settings" :items="[
    { label: 'Notifications', icon: 'o-bell', active: true },
    { label: 'Email', icon: 'o-envelope' },
]" />
```

```preview
template(`<x-tabs label="Settings" :items="[
    { label: 'Notifications', icon: 'o-bell', active: true },
    { label: 'Email', icon: 'o-envelope' },
]" />`)
```

### Setting the tab icon position

The icon is placed before the label. Set `iconPosition` to `after` to place it after:

```html
<x-tabs label="Settings" :items="[
    { label: 'Notifications', icon: 'o-bell', iconPosition: 'after', active: true },
    { label: 'Email', icon: 'o-envelope', iconPosition: 'after' },
]" />
```

```preview
template(`<x-tabs label="Settings" :items="[
    { label: 'Notifications', icon: 'o-bell', iconPosition: 'after', active: true },
    { label: 'Email', icon: 'o-envelope', iconPosition: 'after' },
]" />`)
```

## Setting a tab badge

Give a tab a `badge`, a value displayed after the label. Its color is `primary`, unless you set `badgeColor`:

```html
<x-tabs label="Order views" :items="[
    { label: 'All', active: true },
    { label: 'To ship', badge: 4, badgeColor: 'warning' },
]" />
```

```preview
template(`<x-tabs label="Order views" :items="[
    { label: 'All', active: true },
    { label: 'To ship', badge: 4, badgeColor: 'warning' },
]" />`)
```

## Using a tab as an anchor link

A tab is a `<button>`. To render a link instead, set `tag` to `a` and give it an `href`:

```html
<x-tabs label="Account" :items="[
    { label: 'Profile', tag: 'a', href: '/admin/profile', active: true },
    { label: 'Security', tag: 'a', href: '/admin/profile/security' },
]" />
```

## Using vertical tabs

The `vertical` prop stacks the tabs:

```html
<x-tabs label="Settings" vertical :items="[
    { label: 'Notifications', icon: 'o-bell', active: true },
    { label: 'Email', icon: 'o-envelope' },
]" />
```

```preview
// width: 16rem
template(`<x-tabs label="Settings" vertical :items="[
    { label: 'Notifications', icon: 'o-bell', active: true },
    { label: 'Email', icon: 'o-envelope' },
]" />`)
```

## Displaying tabs in a card

The `contained` prop gives the row of tabs a card background:

```html
<x-tabs label="Order views" contained :items="[
    { label: 'All', active: true },
    { label: 'Paid' },
]" />
```

```preview
template(`<x-tabs label="Order views" contained :items="[
    { label: 'All', active: true },
    { label: 'Paid' },
]" />`)
```

## Props

`<x-tabs>`:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | array | required | The tabs |
| `label` | string | none | Accessible name (`aria-label`) |
| `vertical` | boolean | `false` | Stacks the tabs |
| `contained` | boolean | `false` | Card background |

Each item:

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | string | required | Label, escaped |
| `active` | boolean | `false` | Highlights the tab |
| `icon` | string | none | Icon name |
| `iconPosition` | `before`, `after` | `before` | Position of the icon |
| `badge` | string or number | none | Value after the label, escaped |
| `badgeColor` | string | `primary` | Color of the badge |
| `tag` | `button`, `a` | `button` | HTML element |
| `href` | string | none | URL of an `<a>` |
| `attributes` | object | none | HTML attributes of the tab (`wire:click`, `x-on:click`…) |

The HTML attributes of the tag are placed on the `<nav>` element.
