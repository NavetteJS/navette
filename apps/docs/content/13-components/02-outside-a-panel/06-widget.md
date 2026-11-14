---
title: Rendering a widget outside a panel
---

## Introduction

[Widgets](/widgets/overview) are components: a stats overview, a chart or a table widget may be shown outside a panel too.

## Adding the widget

Register the widget with your other components, then render it as a child of a component with `livewire()`:

```ts
livewire.components([Dashboard, PostsChart]);
```

```html
<div>
    <%- await livewire(PostsChart) %>
</div>
```

The second argument gives the widget its data (its public properties), and the third a key, when the same widget is shown twice: `livewire(PostsChart, { filter: 'week' }, 'week')`. A lazy widget (`static isLazy = true`, the default) shows a placeholder and loads once visible.

A widget may also be the whole page, or be embedded in a page of your own, like any component:

```ts
app.get('/stats', livewire.page(PostsChart));
```

## Restricting a widget

Outside a panel, a widget is open to guests. `static canView(user)` still decides who may see it: it receives the user returned by the `user` option of `Livewire`, or `null` for a guest.
