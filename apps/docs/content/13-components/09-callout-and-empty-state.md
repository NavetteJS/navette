---
title: Callout and empty state
---

## Introduction

The callout component draws attention to a message: a warning, a tip, the result of an operation. The empty state component fills the place of content that does not exist yet, such as an empty list.

```html
<x-callout
    heading="Payment overdue"
    description="The invoice of March has not been paid."
    icon="o-exclamation-triangle"
    color="warning"
/>
```

```preview
template(`<x-callout
    heading="Payment overdue"
    description="The invoice of March has not been paid."
    icon="o-exclamation-triangle"
    color="warning"
/>`)
```

## Callout

### Changing the color of a callout

Without `color`, the callout is gray. Pass a [color](/styling/colors) to tint its background, border and icon: `danger`, `info`, `success`, `warning`, `primary` or a color registered on the panel:

```html
<x-callout heading="Backup completed" icon="o-check-circle" color="success" />
<x-callout heading="Maintenance tonight" icon="o-information-circle" color="info" />
<x-callout heading="Disk almost full" icon="o-x-circle" color="danger" />
```

```preview
template(`<div style="display: grid; gap: 1rem">
<x-callout heading="Backup completed" icon="o-check-circle" color="success" />
<x-callout heading="Maintenance tonight" icon="o-information-circle" color="info" />
<x-callout heading="Disk almost full" icon="o-x-circle" color="danger" />
</div>`)
```

### Changing the icon of a callout

The icon takes the color of the callout. Use `icon-color` to give it another [color](/styling/colors), and `icon-size` to make it `sm` or `md` instead of `lg`:

```html
<x-callout heading="New version available" icon="o-arrow-path" icon-color="primary" icon-size="md" />
```

```preview
template(`<x-callout heading="New version available" icon="o-arrow-path" icon-color="primary" icon-size="md" />`)
```

### Adding a footer to a callout

The content of the tag is displayed below the description, for example buttons:

```html
<x-callout heading="Payment overdue" description="The invoice of March has not been paid." color="warning">
    <x-button size="sm" color="warning" tag="a" href="/billing">Pay now</x-button>
</x-callout>
```

```preview
template(`<x-callout heading="Payment overdue" description="The invoice of March has not been paid." color="warning"><x-button size="sm" color="warning" tag="a" href="/billing">Pay now</x-button></x-callout>`)
```

### Adding controls to a callout

The `controls` [named slot](/components/overview#using-named-slots) places content at the end of the callout, for example a button that dismisses it:

```html
<x-callout heading="Maintenance tonight" description="The panel is unavailable from 2 to 3 AM." color="info"><x-slot name="controls">
    <x-icon-button icon="o-x-mark" label="Dismiss" color="gray" wire:click="dismissNotice" />
</x-slot></x-callout>
```

```preview
template(`<x-callout heading="Maintenance tonight" description="The panel is unavailable from 2 to 3 AM." color="info"><x-slot name="controls">
    <x-icon-button icon="o-x-mark" label="Dismiss" color="gray" wire:click="dismissNotice" />
</x-slot></x-callout>`)
```

<Aside variant="tip">
The content of the tag is the footer: when a callout only has a `controls` slot, write the slot right after the opening tag and close the callout right after it, as above, so that no blank text becomes an empty footer.
</Aside>

### Callout props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `heading` | string | none | Heading, escaped |
| `description` | string | none | Text below the heading, escaped |
| `color` | string | gray | Color of the callout |
| `icon` | string | none | Icon name |
| `icon-color` | string | the callout color | Color of the icon |
| `icon-size` | `sm`, `md`, `lg` | `lg` | Size of the icon |
| `footer` | HTML | the content | Content below the description |
| `controls` | HTML | none | Content at the end of the callout (named slot) |

HTML attributes are placed on the root element of the callout.

## Empty state

The empty state displays an icon, a heading, a description, and the content of the tag below them, usually the action that creates the first record:

```html
<x-empty-state
    heading="No orders yet"
    description="Orders placed by your customers will appear here."
    icon="o-shopping-bag"
>
    <x-button icon="o-plus" tag="a" href="/admin/orders/create">New order</x-button>
</x-empty-state>
```

```preview
template(`<x-empty-state
    heading="No orders yet"
    description="Orders placed by your customers will appear here."
    icon="o-shopping-bag"
><x-button icon="o-plus" tag="a" href="/admin/orders/create">New order</x-button></x-empty-state>`)
```

`heading` is required; without content, the empty state has no footer.

### Changing the icon of an empty state

The icon is `primary`. Use `icon-color` to give it another [color](/styling/colors), and `icon-size` to make it `sm` or `md` instead of `lg`:

```html
<x-empty-state heading="No results" icon="o-magnifying-glass" icon-color="gray" icon-size="md" />
```

```preview
template(`<x-empty-state heading="No results" icon="o-magnifying-glass" icon-color="gray" icon-size="md" />`)
```

### Removing the card of an empty state

The empty state is displayed in a card. To display it on the background of the page, for example inside a [section](/components/section):

```html
<x-empty-state heading="No orders yet" icon="o-shopping-bag" :contained="false" />
```

```preview
template(`<x-empty-state heading="No orders yet" icon="o-shopping-bag" :contained="false" />`)
```

### Empty state props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `heading` | string | required | Heading, escaped |
| `description` | string | none | Text below the heading, escaped |
| `icon` | string | none | Icon name |
| `icon-color` | string | `primary` | Color of the icon |
| `icon-size` | `sm`, `md`, `lg` | `lg` | Size of the icon |
| `footer` | HTML | the content | Content below the description |
| `contained` | boolean | `true` | Card around the empty state |

HTML attributes are placed on the root element of the empty state.
