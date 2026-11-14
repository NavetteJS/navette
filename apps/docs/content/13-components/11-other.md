---
title: Other components
---

## Introduction

This page describes the smaller components: avatars, breadcrumbs, icons, icon buttons, links, loading indicators and pagination.

```html
<x-link href="/admin/users/1" icon="o-user">Ada Lovelace</x-link>
```

```preview
template(`<x-link href="/admin/users/1" icon="o-user">Ada Lovelace</x-link>`)
```

## Avatar

`<x-avatar>` renders a round image, for a user or a team:

```html
<x-avatar :src="user.avatarUrl" :alt="user.name" />
```

```preview
template(`<div style="display: flex; gap: 0.75rem; align-items: center">
<x-avatar src="https://ui-avatars.com/api/?name=Ada+Lovelace&background=random" alt="Ada Lovelace" size="sm" />
<x-avatar src="https://ui-avatars.com/api/?name=Ada+Lovelace&background=random" alt="Ada Lovelace" />
<x-avatar src="https://ui-avatars.com/api/?name=Ada+Lovelace&background=random" alt="Ada Lovelace" size="lg" />
<x-avatar src="https://ui-avatars.com/api/?name=Ada+Lovelace&background=random" alt="Ada Lovelace" size="lg" :circular="false" />
</div>`)
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | string | required | URL of the image |
| `alt` | string | none | Alternative text |
| `size` | `sm`, `md`, `lg` | `md` | Size of the avatar |
| `circular` | boolean | `true` | `false` gives a square with rounded corners |

HTML attributes are placed on the `<img>` element. Check URLs that come from users with `isSafeUrl()` from `@navette-js/support`.

## Breadcrumbs

`<x-breadcrumbs>` renders a trail of links. Pass the items as an array of objects with a `label` and a `url`:

```html
<x-breadcrumbs :items="[
    { label: 'Orders', url: '/admin/orders' },
    { label: 'OR-1024', url: '/admin/orders/1024' },
    { label: 'Invoice' },
]" />
```

```preview
template(`<x-breadcrumbs :items="[
    { label: 'Orders', url: '/admin/orders' },
    { label: 'OR-1024', url: '/admin/orders/1024' },
    { label: 'Invoice' },
]" />`)
```

An item without `url` is plain text. The last item is the current page: it gets `aria-current="page"`. Labels and URLs are escaped.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | array of `{ label, url }` | required | The items, in order |
| `label` | string | `Breadcrumb` | Accessible name of the `<nav>` element |

## Icon

`<x-icon>` renders an [icon](/styling/icons) as inline SVG:

```html
<x-icon name="o-star" />
<x-icon name="s-star" size="lg" style="color: var(--warning-500)" />
```

```preview
template(`<div style="display: flex; gap: 0.75rem; align-items: center">
<x-icon name="o-star" />
<x-icon name="s-star" size="lg" style="color: var(--warning-500)" />
</div>`)
```

The SVG uses the current text color. An unknown icon name throws an error when the view is rendered.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string | required | Icon name (`icon` is accepted too) |
| `size` | `xs`, `sm`, `md`, `lg`, `xl`, `2xl` | `md` | Size of the icon |

HTML attributes are placed on the `<svg>` element.

## Icon button

`<x-icon-button>` renders a button that only shows an icon. Its `label` is required: it is the accessible name of the button and the text of its native tooltip:

```html
<x-icon-button icon="o-trash" label="Delete" color="danger" wire:click="delete" />
<x-icon-button icon="o-bell" label="Notifications" color="gray" :badge="3" />
```

```preview
template(`<div style="display: flex; gap: 0.75rem; align-items: center">
<x-icon-button icon="o-trash" label="Delete" color="danger" wire:click="delete" />
<x-icon-button icon="o-bell" label="Notifications" color="gray" :badge="3" />
</div>`)
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `icon` | string | required | Icon name |
| `label` | string | required | Accessible name and tooltip |
| `color` | string | `primary` | Color of the icon |
| `size` | `xs`, `sm`, `md`, `lg`, `xl` | `md` | Size of the button |
| `disabled` | boolean | `false` | Disables the button |
| `tag` | `button`, `a` | `button` | HTML element |
| `href` | string | none | URL of an `<a>` |
| `badge` | string or number | none | Counter on the corner of the button, escaped |
| `badge-color` | string | `primary` | Color of the counter |
| `tooltip` | string | none | Text shown on hover, instead of the native tooltip of the label |

HTML attributes are placed on the button element, and your classes after its own classes.

The `tooltip` prop shows a styled tooltip instead of the native one: `<x-icon-button icon="o-plus" label="New user" tooltip="Register a user" />`. A disabled icon button with a tooltip stays focusable, so that its tooltip can show.

## Link

`<x-link>` renders a text link, styled like the links of the panel. Its content is the label:

```html
<x-link href="/admin/orders">See all orders</x-link>
<x-link href="/admin/orders" color="gray" weight="semibold" icon="o-arrow-right" icon-position="after">See all orders</x-link>
```

```preview
template(`<div style="display: flex; gap: 1.5rem; align-items: center">
<x-link href="/admin/orders">See all orders</x-link>
<x-link href="/admin/orders" color="gray" weight="semibold" icon="o-arrow-right" icon-position="after">See all orders</x-link>
</div>`)
```

To render a `<button>` that looks like a link, set `tag` to `button`, and give it a `wire:click` or `x-on:click`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `href` | string | none | URL of the link |
| `color` | string | `primary` | Color of the link |
| `size` | `xs`, `sm`, `md`, `lg`, `xl` | `md` | Size of the text |
| `weight` | `thin`, `extralight`, `light`, `normal`, `semibold`, `bold`, `extrabold`, `black` | none | Font weight |
| `tag` | `a`, `button` | `a` | HTML element |
| `icon` | string | none | Icon name |
| `icon-position` | `before`, `after` | `before` | Position of the icon |
| `badge` | string or number | none | Counter after the label, escaped |
| `badge-color` | string | `primary` | Color of the counter |
| `disabled` | boolean | `false` | Disabled style; disables a `<button>` |
| `tooltip` | string | none | Text shown on hover |

HTML attributes are placed on the link element. `<x-link href="/users/create" tooltip="Register a user">New user</x-link>` shows a tooltip on hover.

## Loading indicator

`<x-loading-indicator>` renders a spinning circle. With Livewire's `wire:loading`, it is only shown while a request is running:

```html
<x-button wire:click="refresh">Refresh</x-button>
<x-loading-indicator wire:loading wire:target="refresh" size="lg" />
```

```preview
template(`<div style="display: flex; gap: 0.75rem; align-items: center">
<x-button wire:click="refresh">Refresh</x-button>
<x-loading-indicator size="lg" />
</div>`)
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `size` | `xs`, `sm`, `md`, `lg`, `xl`, `2xl` | `md` | Size of the indicator |

HTML attributes are placed on the `<svg>` element.

### Replacing the loading indicator

`useLoadingIndicator()` from `@navette-js/support` replaces the indicator everywhere: buttons, tables, modals, `<x-loading-indicator>` and `<x-spinner>`. The function receives the attributes of the indicator, which already hold the `fi-icon fi-loading-indicator` classes and the size class, and returns its HTML:

```ts
import { useLoadingIndicator } from '@navette-js/support';

useLoadingIndicator((attributes) => `<span ${attributes.toHtml()}><span class="my-dots"></span></span>`);
```

Call it once when the application starts; `useLoadingIndicator(null)` restores the default indicator.

`<x-spinner>` renders the same indicator, in the medium size only. Its HTML attributes are placed on the `<svg>` element, and your classes after its own classes:

```html
<x-spinner wire:loading wire:target="save" />
```

## Pagination

`<x-pagination>` renders the pagination bar of the tables: previous and next buttons, the page numbers, the "Showing 21 to 30 of 95 results" overview and, optionally, a select of the number of items per page.

```html
<x-pagination :id="livewireId" :page="current" :per-page="10" :total="total" />
```

```preview
// viewport: 1100
template(`<x-pagination :page="3" :per-page="10" :total="95" />`)
```

Pass the numbers as bound values (`:page="3"`): a text attribute would pass a string.

### Handling page changes

The buttons call methods of the component that contains the pagination, with `wire:click`: `previousPage('page')`, `nextPage('page')` and `gotoPage(number, 'page')`. Implement them in your page, list them in `callable`, and read the current page in `getViewData()`:

```ts
import { Page } from '@navette-js/panels';

export class OrderList extends Page {
    static slug = 'order-list';
    static view = new URL('./order-list.ejs', import.meta.url);
    static callable = ['previousPage', 'nextPage', 'gotoPage'];

    currentPage = 1;

    previousPage(): void {
        this.currentPage = Math.max(1, Number(this.currentPage) - 1 || 1);
    }

    nextPage(): void {
        this.currentPage = (Number(this.currentPage) || 1) + 1;
    }

    gotoPage(page: unknown): void {
        // The argument comes from the browser.
        this.currentPage = Math.max(1, Math.floor(Number(page)) || 1);
    }

    async getViewData() {
        const total = await Order.query().resultSize();
        const lastPage = Math.max(1, Math.ceil(total / 10));
        // `currentPage` is a public property: the browser may send any value.
        const current = Math.min(Math.max(1, Math.floor(Number(this.currentPage)) || 1), lastPage);
        const { results } = await Order.query().orderBy('id', 'desc').page(current - 1, 10);

        return { current, total, orders: results };
    }
}
```

```html
<ul>
    <% for (const order of orders) { %>
        <li><%= order.number %></li>
    <% } %>
</ul>

<x-pagination :id="livewireId" :page="current" :per-page="10" :total="total" />
```

### Using simple pagination

Without `total`, the pagination only shows the previous and next buttons. Add `has-more` when there is a next page:

```html
<x-pagination :id="livewireId" :page="current" :per-page="10" :has-more="orders.length === 10" />
```

### Allowing the user to customize the number of items per page

Pass the choices to `page-options`, numbers or `'all'`. A select is shown when there are at least two choices. It is bound with `wire:model.live` to the property named by `property`, `tableRecordsPerPage` by default:

```html
<x-pagination :id="livewireId" :page="current" :per-page="page.perPage" :total="total" :page-options="[10, 25, 50]" property="perPage" />
```

Declare that public property on your page, and check its value before using it: it comes from the browser.

### Displaying links to the first and the last page

Add `extreme-links` to show buttons that go to the first and the last page:

```html
<x-pagination :id="livewireId" :page="current" :per-page="10" :total="total" extreme-links />
```

### Disabling the buttons during other requests

The buttons are disabled while the component is changing page. To disable them during other requests too, pass the names of the methods or properties to `loading-targets`:

```html
<x-pagination :id="livewireId" :page="current" :per-page="10" :total="total" :loading-targets="['search', 'applyFilters']" />
```

### Pagination props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | string | none | Id of the component that contains the pagination, prefix of the `wire:key` values |
| `page` | number | required | Current page, from 1 |
| `per-page` | number | required | Number of items per page |
| `total` | number | none | Total number of items; without it, the pagination is simple |
| `has-more` | boolean | `false` | There is a next page (simple pagination) |
| `page-options` | array | none | Choices of the per-page select |
| `property` | string | `tableRecordsPerPage` | Property bound to the per-page select |
| `extreme-links` | boolean | `false` | Buttons to the first and last page |
| `loading-targets` | array | none | Other methods or properties whose requests disable the buttons |
