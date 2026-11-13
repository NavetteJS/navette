---
title: Badge
---

## Introduction

The badge component renders a small label, for a status or a count:

```html
<x-badge>
    New
</x-badge>
```

```preview
template(`<x-badge>
    New
</x-badge>`)
```

The content of the tag is the label. It is inserted as HTML: print values with `<%= %>`, which escapes them.

```html
<x-badge :color="order.paid ? 'success' : 'warning'">
    <%= order.status %>
</x-badge>
```

## Setting the size of a badge

Use the `size` prop: `xs`, `sm` or `md` (the default):

```html
<x-badge size="xs">New</x-badge>
<x-badge size="sm">New</x-badge>
<x-badge>New</x-badge>
```

```preview
template(`<div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center">
<x-badge size="xs">New</x-badge>
<x-badge size="sm">New</x-badge>
<x-badge>New</x-badge>
</div>`)
```

## Changing the color of a badge

By default, the color of a badge is `primary`. Pass another [color](/styling/colors) with the `color` prop: `danger`, `gray`, `info`, `success`, `warning`, or a color registered on the panel:

```html
<x-badge color="danger">New</x-badge>
<x-badge color="gray">New</x-badge>
<x-badge color="info">New</x-badge>
<x-badge color="success">New</x-badge>
<x-badge color="warning">New</x-badge>
```

```preview
template(`<div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center">
<x-badge color="danger">New</x-badge>
<x-badge color="gray">New</x-badge>
<x-badge color="info">New</x-badge>
<x-badge color="success">New</x-badge>
<x-badge color="warning">New</x-badge>
</div>`)
```

## Adding an icon to a badge

Pass the name of an [icon](/styling/icons) to the `icon` prop. It is placed before the label; set `icon-position` to `after` to place it after:

```html
<x-badge icon="m-check" color="success">Paid</x-badge>
<x-badge icon="m-arrow-trending-up" icon-position="after">12%</x-badge>
```

```preview
template(`<div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center">
<x-badge icon="m-check" color="success">Paid</x-badge>
<x-badge icon="m-arrow-trending-up" icon-position="after">12%</x-badge>
</div>`)
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | string | `primary` | Color of the badge |
| `size` | `xs`, `sm`, `md` | `md` | Size of the badge |
| `icon` | string | none | Icon name |
| `icon-position` | `before`, `after` | `before` | Position of the icon |
| `tag` | string | `span` | HTML element of the badge |

HTML attributes (`class`, `id`, `x-*`, `wire:*`…) are placed on the badge element.
