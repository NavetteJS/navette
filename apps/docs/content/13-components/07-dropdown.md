---
title: Dropdown
---

## Introduction

The dropdown component renders a trigger and a floating panel that opens when the trigger is clicked. Put the trigger in a `trigger` [named slot](/components/overview#using-named-slots), and the menu in the content, usually a list of items:

```html
<x-dropdown>
    <x-slot name="trigger">
        <x-button color="gray" icon="o-ellipsis-vertical" icon-position="after">Actions</x-button>
    </x-slot>

    <x-dropdown-list>
        <x-dropdown-item icon="o-pencil-square" wire:click="edit">Edit</x-dropdown-item>
        <x-dropdown-item icon="o-document-duplicate" wire:click="duplicate">Duplicate</x-dropdown-item>
        <x-dropdown-item icon="o-trash" color="danger" wire:click="delete">Delete</x-dropdown-item>
    </x-dropdown-list>
</x-dropdown>
```

When it is open, the dropdown looks like this:

```preview
// width: 16rem
template(`<div class="nv-dropdown-panel" style="position: relative">
    <x-dropdown-list>
        <x-dropdown-item icon="o-pencil-square">Edit</x-dropdown-item>
        <x-dropdown-item icon="o-document-duplicate">Duplicate</x-dropdown-item>
        <x-dropdown-item icon="o-trash" color="danger">Delete</x-dropdown-item>
    </x-dropdown-list>
</div>`)
```

The panel is opened and closed in the browser by Alpine.js. It is placed below the trigger, and moved above it when there is not enough room.

## Writing the items of a dropdown

`<x-dropdown-list>` groups items. A dropdown may contain several lists, separated by a line:

```html
<x-dropdown>
    <x-slot name="trigger">
        <x-button color="gray">Account</x-button>
    </x-slot>

    <x-dropdown-list>
        <x-dropdown-item icon="o-user" tag="a" href="/admin/profile">Profile</x-dropdown-item>
        <x-dropdown-item icon="o-cog-6-tooth" tag="a" href="/admin/settings">Settings</x-dropdown-item>
    </x-dropdown-list>

    <x-dropdown-list>
        <x-dropdown-item icon="o-arrow-left-start-on-rectangle" wire:click="logout">Sign out</x-dropdown-item>
    </x-dropdown-list>
</x-dropdown>
```

```preview
// width: 16rem
template(`<div class="nv-dropdown-panel" style="position: relative">
    <x-dropdown-list>
        <x-dropdown-item icon="o-user" tag="a" href="/admin/profile">Profile</x-dropdown-item>
        <x-dropdown-item icon="o-cog-6-tooth" tag="a" href="/admin/settings">Settings</x-dropdown-item>
    </x-dropdown-list>
    <x-dropdown-list>
        <x-dropdown-item icon="o-arrow-left-start-on-rectangle">Sign out</x-dropdown-item>
    </x-dropdown-list>
</div>`)
```

The label of an item is the text of the tag, or its `label` prop. It is escaped: write plain text, and pass a value with a bound prop, `:label="user.name"`, rather than with `<%= %>` in the content, which would escape it twice.

A list may also be built from an array, with the props of each item:

```html
<x-dropdown-list :items="[
    { label: 'Profile', icon: 'o-user', tag: 'a', href: '/admin/profile' },
    { label: 'Settings', icon: 'o-cog-6-tooth', tag: 'a', href: '/admin/settings' },
]" />
```

In the array, HTML attributes go in an `attributes` object: `{ label: 'Edit', attributes: { 'wire:click': 'edit' } }`.

## Using a dropdown item as an anchor link

An item is a `<button>`. To render a link instead, set `tag` to `a` and give it an `href`:

```html
<x-dropdown-item tag="a" href="/admin/profile">
    Profile
</x-dropdown-item>
```

## Changing the color of a dropdown item

Items are gray. Pass another [color](/styling/colors) with the `color` prop:

```html
<x-dropdown-item color="danger">Delete</x-dropdown-item>
<x-dropdown-item color="success">Publish</x-dropdown-item>
```

```preview
// width: 16rem
template(`<div class="nv-dropdown-panel" style="position: relative">
    <x-dropdown-list>
        <x-dropdown-item color="danger">Delete</x-dropdown-item>
        <x-dropdown-item color="success">Publish</x-dropdown-item>
    </x-dropdown-list>
</div>`)
```

## Adding an icon to a dropdown item

Pass the name of an [icon](/styling/icons) to the `icon` prop. The icon takes the color of the item:

```html
<x-dropdown-item icon="o-pencil-square">Edit</x-dropdown-item>
```

### Changing the icon color of a dropdown item

Use `icon-color` to give the icon its own [color](/styling/colors):

```html
<x-dropdown-item icon="o-check-circle" icon-color="success">Approve</x-dropdown-item>
```

```preview
// width: 16rem
template(`<div class="nv-dropdown-panel" style="position: relative">
    <x-dropdown-list>
        <x-dropdown-item icon="o-check-circle" icon-color="success">Approve</x-dropdown-item>
    </x-dropdown-list>
</div>`)
```

## Adding an image to a dropdown item

The `image` prop displays a small round image before the label, for example an avatar. It is ignored when the item has an icon:

```html
<x-dropdown-item :image="user.avatarUrl" :label="user.name" />
```

```preview
// width: 16rem
template(`<div class="nv-dropdown-panel" style="position: relative">
    <x-dropdown-list>
        <x-dropdown-item image="https://ui-avatars.com/api/?name=Ada+Lovelace&background=random" label="Ada Lovelace" />
    </x-dropdown-list>
</div>`)
```

## Adding a badge to a dropdown item

The `badge` prop displays a value at the end of the item. Its color is `primary`, unless you set `badge-color`:

```html
<x-dropdown-item icon="o-bell" :badge="unread" badge-color="danger">Notifications</x-dropdown-item>
```

```preview
// width: 16rem
template(`<div class="nv-dropdown-panel" style="position: relative">
    <x-dropdown-list>
        <x-dropdown-item icon="o-bell" :badge="3" badge-color="danger">Notifications</x-dropdown-item>
    </x-dropdown-list>
</div>`)
```

## Disabling a dropdown item

The `disabled` prop disables the item:

```html
<x-dropdown-item icon="o-trash" :disabled="! page.canDelete">Delete</x-dropdown-item>
```

## Setting the placement of a dropdown

By default, the panel opens below the trigger (`bottom`). Use `placement` to change it: `top`, `bottom`, `left` or `right`, optionally followed by `-start` or `-end` to align the panel with the start or the end of the trigger (`bottom-end`, `top-start`…):

```html
<x-dropdown placement="bottom-end">
    <!-- … -->
</x-dropdown>
```

The `offset` prop sets the distance between the trigger and the panel, in pixels (`8` by default).

## Setting the width of a dropdown

Use `width` to change the width of the panel: `xs`, `sm`, `md`, `lg`, `xl`, `2xl` to `7xl`:

```html
<x-dropdown width="xs">
    <!-- … -->
</x-dropdown>
```

## Controlling the maximum height of a dropdown

Use `max-height` with a CSS length. A panel taller than this scrolls:

```html
<x-dropdown max-height="400px">
    <!-- … -->
</x-dropdown>
```

## Displaying content other than a menu

The content of the dropdown is free: put any HTML in it instead of lists. When it holds form fields or other content than menu items, set `:menu="false"`: the panel then keeps the native keyboard behavior of its content, and is not announced as a menu:

```html
<x-dropdown :menu="false">
    <x-slot name="trigger">
        <x-button>Edit notes</x-button>
    </x-slot>

    <label for="dropdown-notes">Notes</label>

    <x-input-wrapper>
        <x-input id="dropdown-notes" wire:model="notes" />
    </x-input-wrapper>
</x-dropdown>
```

Use form elements, buttons and links in such a panel, rather than `<x-dropdown-item>`, which is a menu item.

```html
<x-dropdown width="sm">
    <x-slot name="trigger">
        <x-icon-button icon="o-information-circle" label="About this report" color="gray" />
    </x-slot>

    <div style="padding: 1rem">
        <p>The report is computed every night from the paid orders.</p>
    </div>
</x-dropdown>
```

## Props

`<x-dropdown>`:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `trigger` | HTML | required | Element that opens the panel (named slot) |
| `placement` | string | `bottom` | Position of the panel |
| `offset` | number | `8` | Distance between the trigger and the panel, in pixels |
| `width` | string | none | Width of the panel |
| `max-height` | string | none | Maximum height of the panel (CSS length) |
| `menu` | boolean | `true` | `false` for content other than a menu |

`<x-dropdown-list>`:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | array | none | Items, each with the props of `<x-dropdown-item>`. Without it, the content of the tag is the list |

`<x-dropdown-item>`:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | string | the content | Label, escaped |
| `color` | string | `gray` | Color of the item |
| `icon` | string | none | Icon name |
| `icon-color` | string | the item color | Color of the icon |
| `image` | string | none | URL of an image shown when there is no icon |
| `badge` | string or number | none | Value at the end of the item |
| `badge-color` | string | `primary` | Color of the badge |
| `tag` | `button`, `a` | `button` | HTML element |
| `href` | string | none | URL of an `<a>` |
| `disabled` | boolean | `false` | Disables the item |

HTML attributes are placed on the root element of `<x-dropdown>` and on the element of `<x-dropdown-item>`. `<x-dropdown-list>` does not use them.
