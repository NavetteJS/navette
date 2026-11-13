---
title: Button
---

## Introduction

The button component renders a button, styled like the buttons of the panel:

```html
<x-button wire:click="openNewUserModal">
    New user
</x-button>
```

```preview
template(`<x-button wire:click="openNewUserModal">
    New user
</x-button>`)
```

Its content is the [slot](/components/overview#passing-content-with-slots): the label, which may contain HTML. `wire:click` and the other HTML attributes are placed on the `<button>` element. The button gets `type="button"`; during a Livewire request it is disabled with `aria-disabled` and the `fi-disabled` class.

## Using a button as an anchor link

By default, the component renders a `<button>`. To render a link instead, set `tag` to `a` and give it an `href`:

```html
<x-button tag="a" href="/admin/users/create">
    New user
</x-button>
```

## Setting the type of a button

The `<button>` element gets `type="button"`, so it does not submit the form it is in. Pass another `type` to submit a form:

```html
<x-button type="submit">
    Save
</x-button>
```

## Setting the size of a button

Use the `size` prop: `xs`, `sm`, `md` (the default), `lg` or `xl`:

```html
<x-button size="xs">New user</x-button>
<x-button size="sm">New user</x-button>
<x-button size="lg">New user</x-button>
<x-button size="xl">New user</x-button>
```

```preview
template(`<div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center">
<x-button size="xs">New user</x-button>
<x-button size="sm">New user</x-button>
<x-button size="lg">New user</x-button>
<x-button size="xl">New user</x-button>
</div>`)
```

## Changing the color of a button

By default, the color of a button is `primary`. Pass another [color](/styling/colors) with the `color` prop: `danger`, `gray`, `info`, `success`, `warning`, or a color registered on the panel:

```html
<x-button color="danger">New user</x-button>
<x-button color="gray">New user</x-button>
<x-button color="info">New user</x-button>
<x-button color="success">New user</x-button>
<x-button color="warning">New user</x-button>
```

```preview
template(`<div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center">
<x-button color="danger">New user</x-button>
<x-button color="gray">New user</x-button>
<x-button color="info">New user</x-button>
<x-button color="success">New user</x-button>
<x-button color="warning">New user</x-button>
</div>`)
```

## Adding an icon to a button

Pass the name of an [icon](/styling/icons) to the `icon` prop. It is placed before the label; set `icon-position` to `after` to place it after:

```html
<x-button icon="o-plus">New user</x-button>
<x-button icon="o-arrow-right" icon-position="after">Next step</x-button>
```

```preview
template(`<div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center">
<x-button icon="o-plus">New user</x-button>
<x-button icon="o-arrow-right" icon-position="after">Next step</x-button>
</div>`)
```

## Making a button outlined

The `outlined` prop gives the button a border and a transparent background:

```html
<x-button outlined>New user</x-button>
```

```preview
template(`<x-button outlined>New user</x-button>`)
```

## Disabling a button

The `disabled` prop disables the button, and adds `aria-disabled="true"` and the `fi-disabled` class:

```html
<x-button :disabled="! page.canInvite">Invite</x-button>
```

```preview
template(`<x-button disabled>Invite</x-button>`)
```

## Adding a badge to a button

The `badge` prop displays a small counter on the corner of the button. Its color is `primary`, unless you set `badge-color`:

```html
<x-button :badge="notifications.length" badge-color="danger">
    Notifications
</x-button>
```

```preview
template(`<x-button :badge="3" badge-color="danger">
    Notifications
</x-button>`)
```

The badge value is escaped.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | string | `primary` | Color of the button |
| `size` | `xs`, `sm`, `md`, `lg`, `xl` | `md` | Size of the button |
| `outlined` | boolean | `false` | Border and transparent background |
| `disabled` | boolean | `false` | Disables the button |
| `tag` | `button`, `a` | `button` | HTML element |
| `type` | string | `button` | `type` attribute of a `<button>` |
| `href` | string | none | URL of an `<a>` |
| `icon` | string | none | Icon name |
| `icon-position` | `before`, `after` | `before` | Position of the icon |
| `badge` | string or number | none | Counter displayed on the button |
| `badge-color` | string | `primary` | Color of the counter |
