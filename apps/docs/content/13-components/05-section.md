---
title: Section
---

## Introduction

The section component renders a card with an optional header, to group content:

```html
<x-section heading="User details">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
template(`<x-section heading="User details">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

The content of the tag is the content of the section. Without `heading`, `description`, `icon` or an `after-header` slot, the section has no header and is a simple card.

## Adding a description to the section

Use the `description` prop to add text below the heading:

```html
<x-section heading="User details" description="Only visible to administrators.">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
template(`<x-section heading="User details" description="Only visible to administrators.">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

The heading and the description are escaped.

## Changing the heading level

The heading is an `<h2>`. Use `heading-tag` to render another element, to keep the outline of your page correct:

```html
<x-section heading="Billing" heading-tag="h3">
    <!-- … -->
</x-section>
```

## Adding an icon to the section header

Pass the name of an [icon](/styling/icons) to the `icon` prop:

```html
<x-section heading="User details" icon="o-user">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
template(`<x-section heading="User details" icon="o-user">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

### Changing the color of the section icon

The icon is gray. Use `icon-color` to give it a [color](/styling/colors):

```html
<x-section heading="User details" icon="o-user" icon-color="info">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
template(`<x-section heading="User details" icon="o-user" icon-color="info">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

### Changing the size of the section icon

The icon is large (`lg`). Use `icon-size` to make it `sm` or `md`:

```html
<x-section heading="User details" icon="o-user" icon-size="sm">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
template(`<x-section heading="User details" icon="o-user" icon-size="sm">
    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

## Adding content to the end of the header

Put content at the end of the header, such as a button or a badge, in an `after-header` [named slot](/components/overview#using-named-slots):

```html
<x-section heading="User details">
    <x-slot name="after-header">
        <x-button color="gray" size="sm" icon="o-pencil-square">Edit</x-button>
    </x-slot>

    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
template(`<x-section heading="User details">
    <x-slot name="after-header">
        <x-button color="gray" size="sm" icon="o-pencil-square">Edit</x-button>
    </x-slot>

    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

Clicking in the after-header area does not collapse a [collapsible section](#making-a-section-collapsible).

## Adding a footer to the section

Use a `footer` named slot to add content below the content of the section:

```html
<x-section heading="User details">
    <p>Ada Lovelace, member since 2024.</p>

    <x-slot name="footer">
        <x-button size="sm">Save</x-button>
    </x-slot>
</x-section>
```

```preview
template(`<x-section heading="User details">
    <p>Ada Lovelace, member since 2024.</p>

    <x-slot name="footer">
        <x-button size="sm">Save</x-button>
    </x-slot>
</x-section>`)
```

## Making a section collapsible

With the `collapsible` prop, a click on the header, or on the button at the end of the header, hides and shows the content:

```html
<x-section heading="User details" collapsible>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
template(`<x-section heading="User details" collapsible>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

The section listens to the `collapse-section`, `expand-section`, `open-section` and `toggle-section` browser events whose `id` is the `id` of the section element, so you may control it from Alpine.js:

```html
<x-section id="user-details" heading="User details" collapsible>
    <!-- … -->
</x-section>

<x-button color="gray" x-on:click="$dispatch('toggle-section', { id: 'user-details' })">
    Show or hide the details
</x-button>
```

### Making a section collapsed by default

Add `collapsed` to a collapsible section to hide its content when the page loads:

```html
<x-section heading="User details" collapsible collapsed>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
template(`<x-section heading="User details" collapsible collapsed>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

`collapsed` has no effect without `collapsible`. The collapsed state lives in the browser: the server does not know it.

### Persisting collapsed sections

`persist-collapsed` keeps whether the section is collapsed in the browser's local storage, so that it stays collapsed when the user comes back. Give the section an `id`, which names its saved state:

```html
<x-section heading="User details" collapsible collapsed persist-collapsed id="user-details">
    <p>…</p>
</x-section>
```

The `collapse-id` prop names the saved state instead of the `id`.

## Adding the section header aside the content instead of above it

With the `aside` prop, the header is placed on the left of the content on large screens, and the content gets its own card:

```html
<x-section heading="User details" description="Only visible to administrators." aside>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
// viewport: 1100
template(`<x-section heading="User details" description="Only visible to administrators." aside>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

### Positioning the content before the header

Add `content-before` to an aside section to place the content on the left and the header on the right:

```html
<x-section heading="User details" description="Only visible to administrators." aside content-before>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>
```

```preview
// viewport: 1100
template(`<x-section heading="User details" description="Only visible to administrators." aside content-before>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>`)
```

## Changing the style of a section

These props change how the section looks:

- `compact` reduces the padding;
- `secondary` gives the section a secondary background, to set it apart from the sections around it;
- `divided` draws a line between the elements of its content, without gap;
- `:contained="false"` removes the card: the header and the content are displayed on the background of the page.

```html
<x-section heading="User details" compact secondary>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>

<x-section heading="Last orders" divided>
    <p>OR-1024</p>
    <p>OR-1025</p>
</x-section>
```

```preview
template(`<div style="display: grid; gap: 1.5rem">
<x-section heading="User details" compact secondary>
    <p>Ada Lovelace, member since 2024.</p>
</x-section>

<x-section heading="Last orders" divided>
    <p style="padding: 0.5rem 0">OR-1024</p>
    <p style="padding: 0.5rem 0">OR-1025</p>
</x-section>
</div>`)
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `heading` | string | none | Heading, escaped |
| `description` | string | none | Text below the heading, escaped |
| `heading-tag` | string | `h2` | HTML element of the heading |
| `icon` | string | none | Icon name |
| `icon-color` | string | gray | Color of the icon |
| `icon-size` | `sm`, `md`, `lg` | `lg` | Size of the icon |
| `after-header` | HTML | none | Content at the end of the header (named slot) |
| `footer` | HTML | none | Content below the content (named slot) |
| `collapsible` | boolean | `false` | The header toggles the content |
| `collapsed` | boolean | `false` | Collapsed when the page loads (with `collapsible`) |
| `aside` | boolean | `false` | Header beside the content on large screens |
| `content-before` | boolean | `false` | Content before the header (with `aside`) |
| `compact` | boolean | `false` | Smaller padding |
| `secondary` | boolean | `false` | Secondary background |
| `divided` | boolean | `false` | Lines between the elements of the content |
| `contained` | boolean | `true` | Card around the section |
| `persist-collapsed` | boolean | `false` | Keeps the collapsed state in local storage |
| `collapse-id` | string | the `id` | Name of the persisted state |

HTML attributes (`class`, `id`, `x-*`, `wire:*`…) are placed on the `<section>` element.
