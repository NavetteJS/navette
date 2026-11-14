---
title: Form elements
---

## Introduction

These components render the bare elements of a form, with the styles of the panel fields: a text input, a select, a checkbox, the wrapper that draws the border of an input, and a fieldset. They are useful for a small form in a view, such as a search box or a filter:

```html
<x-input-wrapper prefix-icon="o-magnifying-glass">
    <x-input type="search" wire:model.live.debounce.500ms="search" placeholder="Search orders" />
</x-input-wrapper>
```

```preview
// width: 24rem
template(`<x-input-wrapper prefix-icon="o-magnifying-glass">
    <x-input type="search" wire:model.live.debounce.500ms="search" placeholder="Search orders" />
</x-input-wrapper>`)
```

They do not render a label, a hint or validation messages. For a complete form with validation, use a [form](/forms/overview) in a schema instead.

## Input

`<x-input>` renders an `<input>` element with the `fi-input` class. Every attribute of the tag is placed on the element, props and HTML attributes alike:

```html
<x-input-wrapper>
    <x-input type="email" name="email" :value="user.email" autocomplete="email" required />
</x-input-wrapper>
```

Write attribute names without hyphens, as HTML does (`autocomplete`, `maxlength`, `inputmode`): a hyphenated prop name is camelCased. Values are printed between double quotes, with `"` escaped. The input has no border of its own: place it in an [input wrapper](#input-wrapper).

## Input wrapper

`<x-input-wrapper>` draws the border and the background of a field around its content, an `<x-input>` or an `<x-select>`:

```html
<x-input-wrapper>
    <x-input type="text" wire:model="name" />
</x-input-wrapper>
```

### Adding affix text aside the input

Use `prefix` and `suffix` to place text before and after the input:

```html
<x-input-wrapper prefix="https://" suffix=".com">
    <x-input type="text" wire:model="domain" />
</x-input-wrapper>
```

```preview
// width: 24rem
template(`<x-input-wrapper prefix="https://" suffix=".com">
    <x-input type="text" wire:model="domain" value="example" />
</x-input-wrapper>`)
```

The affixes are separated from the input by a border. Add `inline-prefix` or `inline-suffix` to display them inside the input area instead. The affix text is escaped.

### Using icons as affixes

Use `prefix-icon` and `suffix-icon` with the name of an [icon](/styling/icons):

```html
<x-input-wrapper prefix-icon="o-globe-alt">
    <x-input type="url" wire:model="website" />
</x-input-wrapper>
```

```preview
// width: 24rem
template(`<x-input-wrapper prefix-icon="o-globe-alt">
    <x-input type="url" wire:model="website" value="https://example.com" />
</x-input-wrapper>`)
```

#### Setting the affix icon's color

The icons are gray. Use `prefix-icon-color` and `suffix-icon-color` to give them a [color](/styling/colors):

```html
<x-input-wrapper suffix-icon="o-check-circle" suffix-icon-color="success">
    <x-input type="text" wire:model="code" />
</x-input-wrapper>
```

```preview
// width: 24rem
template(`<x-input-wrapper suffix-icon="o-check-circle" suffix-icon-color="success">
    <x-input type="text" wire:model="code" value="WELCOME10" />
</x-input-wrapper>`)
```

### Triggering the error state of the input

Pass `:valid="false"` to draw the field in the danger color, for example when your page has an error message for it (here, `emailError` is a variable returned by `getViewData()`):

```html
<x-input-wrapper :valid="! emailError">
    <x-input type="email" wire:model="email" />
</x-input-wrapper>
<% if (emailError) { %>
    <p style="color: var(--danger-600)"><%= emailError %></p>
<% } %>
```

```preview
// width: 24rem
template(`<x-input-wrapper :valid="false">
    <x-input type="email" wire:model="email" value="ada@" />
</x-input-wrapper>`)
```

To trigger the error state in the browser, give `alpine-valid` an Alpine.js expression, which is `true` when the input is valid:

```html
<div x-data="{ errors: ['name'] }">
    <x-input-wrapper alpine-valid="! errors.includes('name')">
        <x-input type="text" wire:model="name" />
    </x-input-wrapper>
</div>
```

### Disabling the input

Add `disabled` to the wrapper, which grays it out, and to the input. `alpine-disabled` takes an Alpine.js expression instead:

```html
<x-input-wrapper disabled>
    <x-input type="text" wire:model="name" disabled />
</x-input-wrapper>
```

```preview
// width: 24rem
template(`<x-input-wrapper disabled>
    <x-input type="text" wire:model="name" value="Ada Lovelace" disabled />
</x-input-wrapper>`)
```

### Input wrapper props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `prefix` | string | none | Text before the input, escaped |
| `suffix` | string | none | Text after the input, escaped |
| `prefix-icon` | string | none | Icon before the input |
| `suffix-icon` | string | none | Icon after the input |
| `prefix-icon-color` | string | gray | Color of the prefix icon |
| `suffix-icon-color` | string | gray | Color of the suffix icon |
| `inline-prefix` | boolean | `false` | Prefix inside the input area |
| `inline-suffix` | boolean | `false` | Suffix inside the input area |
| `disabled` | boolean | `false` | Disabled style |
| `valid` | boolean | `true` | `false` gives the error style |
| `alpine-valid` | string | none | Alpine.js expression replacing `valid` |
| `alpine-disabled` | string | none | Alpine.js expression replacing `disabled` |

`<x-input.wrapper>` is another name of `<x-input-wrapper>`.

HTML attributes are placed on the wrapper element.

## Select

`<x-select>` renders a native `<select>` element with the `fi-select-input` class. Write the `<option>` elements as its content; like `<x-input>`, every attribute of the tag is placed on the element:

```html
<x-input-wrapper>
    <x-select wire:model.live="status">
        <option value="">All statuses</option>
        <% for (const [value, label] of Object.entries(statuses)) { %>
            <option value="<%= value %>"><%= label %></option>
        <% } %>
    </x-select>
</x-input-wrapper>
```

```preview
// width: 24rem
template(`<x-input-wrapper>
    <x-select wire:model.live="status">
        <option value="">All statuses</option>
        <% for (const [value, label] of Object.entries(statuses)) { %>
            <option value="<%= value %>"><%= label %></option>
        <% } %>
    </x-select>
</x-input-wrapper>`, { statuses: { draft: 'Draft', published: 'Published' } })
```

## Checkbox

`<x-checkbox>` renders a checkbox with the panel style:

```html
<label style="display: flex; gap: 0.75rem; align-items: center">
    <x-checkbox wire:model="notify" />
    Notify me by email
</label>
```

```preview
template(`<label style="display: flex; gap: 0.75rem; align-items: center">
    <x-checkbox checked />
    Notify me by email
</label>`)
```

`checked` checks it when the page is rendered. `:valid="false"` gives it the error style. The HTML attributes (`id`, `wire:model`, `x-model`, `data-*`…) are placed on the `<input>` element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `checked` | boolean | `false` | Checked when rendered |
| `valid` | boolean | `true` | `false` gives the error style |

## Fieldset

`<x-fieldset>` groups related elements in a `<fieldset>` with a border, and its `label` as legend:

```html
<x-fieldset label="Delivery">
    <!-- … -->
</x-fieldset>
```

```preview
// width: 24rem
template(`<x-fieldset label="Delivery">
    <x-input-wrapper prefix="Street">
        <x-input type="text" value="12 Rue de la Paix" />
    </x-input-wrapper>
</x-fieldset>`)
```

Add `label-hidden` to keep the legend for assistive technologies only. The label is escaped.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | string | none | Legend of the fieldset, escaped |
| `label-hidden` | boolean | `false` | Hides the legend visually |

HTML attributes are placed on the `<fieldset>` element.
