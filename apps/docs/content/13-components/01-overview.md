---
title: Overview
---

## Introduction

Navette views are EJS templates. Besides the usual EJS tags, a view may use **component tags**: `<x-button>`, `<x-section>`, `<x-badge>`… Each tag renders a component with the same HTML and CSS classes as the panel, so the content you write by hand looks like the rest of the interface:

```html
<x-section heading="Latest orders" description="Orders placed in the last seven days.">
    <p>12 orders are waiting to be shipped.</p>

    <x-button tag="a" href="/admin/orders" icon="o-arrow-right" icon-position="after">
        See all orders
    </x-button>
</x-section>
```

```preview
template(`<x-section heading="Latest orders" description="Orders placed in the last seven days.">
    <p style="margin-bottom: 1rem">12 orders are waiting to be shipped.</p>

    <x-button tag="a" href="/admin/orders" icon="o-arrow-right" icon-position="after">
        See all orders
    </x-button>
</x-section>`)
```

Component tags work in every view rendered by the view registry of `@navette-js/support` (`views.render()` and `views.renderFile()`): a [page rendered with a view](/resources/custom-pages#rendering-a-page-with-a-view), the views of a [`ViewColumn`](/tables/columns/custom-columns#rendering-a-column-with-an-ejs-view), the views that your [custom component classes](/schemas/custom-components#accessing-the-context-in-a-component-class) render, and the files of your own [view components](/components/creating-components).

## Using the built-in components

These components are available in every view:

| Tag | Page |
| --- | --- |
| `<x-button>` | [Button](/components/button) |
| `<x-badge>` | [Badge](/components/badge) |
| `<x-section>` | [Section](/components/section) |
| `<x-modal>` | [Modal](/components/modal) |
| `<x-dropdown>`, `<x-dropdown-list>`, `<x-dropdown-item>` | [Dropdown](/components/dropdown) |
| `<x-tabs>` | [Tabs](/components/tabs) |
| `<x-callout>`, `<x-empty-state>` | [Callout and empty state](/components/callout-and-empty-state) |
| `<x-input>`, `<x-input-wrapper>`, `<x-select>`, `<x-checkbox>`, `<x-fieldset>` | [Form elements](/components/form-elements) |
| `<x-avatar>`, `<x-breadcrumbs>`, `<x-icon>`, `<x-icon-button>`, `<x-link>`, `<x-loading-indicator>`, `<x-spinner>`, `<x-pagination>` | [Other components](/components/other) |

In a panel application, they work without any setup: the panel gives them its colors. Outside a panel, import `@navette-js/support/ui` once, which registers the tags, and give the components a color manager:

```ts
import { Color, ColorManager } from '@navette-js/support';
import { useColorManager } from '@navette-js/support/ui';

useColorManager(new ColorManager().register({ primary: Color.Indigo }));
```

The components only produce HTML. Their styles come from the panel stylesheet, and the interactive ones (dropdown, modal, collapsible section) need the Alpine.js scripts of the panel: outside a panel, your page must load them.

You may also [create your own components](/components/creating-components) and use them with the same syntax.

## Passing props

The attributes of a tag are the props of the component. There are three ways to write them:

```html
<x-badge color="success">Paid</x-badge>

<x-badge :color="order.paid ? 'success' : 'danger'"><%= order.status %></x-badge>

<x-button outlined>Cancel</x-button>
```

- `name="text"` passes the text as a string: the first badge receives the string `"success"`.
- `:name="expression"` evaluates a JavaScript expression in the scope of the view (its variables, `page` in a page view, loop variables…) and passes the result.
- `name` alone passes `true`: the button is outlined.

Hyphenated names become camelCased props: `icon-position="after"` is the `iconPosition` prop.

A text value is always a string, even when it looks like something else. `outlined="false"` passes the string `"false"`, which counts as `true`; write `:outlined="false"`. In the same way, pass numbers, arrays and objects with a bound value: `:page="2"`, `:items="[{ label: 'Home', url: '/' }]"`.

<Aside variant="tip">
The value of an attribute ends at the next quote of the same kind. Inside a bound value written between double quotes, use single quotes for JavaScript strings, or the other way around.
</Aside>

## Passing HTML attributes

Some attributes are not props: they are HTML attributes that the component places on its root element. They are:

- `class`, `style` and `id`;
- the attributes that start with `x-`, `data-`, `aria-`, `wire:` or `@`;
- any other attribute whose name contains `:`.

Alpine.js and Livewire attributes (`x-data`, `x-on:click`, `@click`, `wire:click`, `wire:model`) are therefore always HTML attributes.

```html
<x-button wire:click="refresh" class="ms-auto" data-test="refresh-button">
    Refresh
</x-button>
```

The built-in components add your classes to their own ones. HTML attributes may be bound too: `:data-order="order.id"`.

The other attributes are props, even when they look like HTML (`href`, `type`, `name`, `placeholder`). Each component page lists the props it reads; [`<x-input>`](/components/form-elements#input) and [`<x-select>`](/components/form-elements#select) copy all of them to their element.

## Passing content with slots

The content between the opening and closing tags is the **slot** of the component. It is rendered by your view first, so it may contain HTML, EJS tags and other components:

```html
<x-button color="danger" icon="o-trash">
    Delete <%= selected.length %> orders
</x-button>
```

A component without content may be written as a self-closing tag: `<x-icon name="o-star" />`.

### Using named slots

Some components accept several pieces of content: a section has a footer, a dropdown has a trigger… Pass them with `<x-slot>`, inside the component:

```html
<x-section heading="Shipping">
    <x-slot name="after-header">
        <x-badge color="warning">Delayed</x-badge>
    </x-slot>

    <p>The parcel left the warehouse on Monday.</p>

    <x-slot:footer>
        <x-button size="sm" color="gray">Contact the carrier</x-button>
    </x-slot:footer>
</x-section>
```

```preview
template(`<x-section heading="Shipping">
    <x-slot name="after-header">
        <x-badge color="warning">Delayed</x-badge>
    </x-slot>

    <p>The parcel left the warehouse on Monday.</p>

    <x-slot:footer>
        <x-button size="sm" color="gray">Contact the carrier</x-button>
    </x-slot:footer>
</x-section>`)
```

`<x-slot name="footer">` and `<x-slot:footer>` are equivalent; either is closed by `</x-slot>`. A named slot becomes a prop of the nearest enclosing component, camelCased like the attributes (`after-header` is the `afterHeader` prop), and everything outside the named slots is the default slot.

### Nesting components

Components may be nested in the content of other components and in their named slots, at any depth. A slot belongs to the component tag that directly encloses it:

```html
<x-dropdown placement="bottom-end">
    <x-slot name="trigger">
        <x-icon-button icon="o-ellipsis-vertical" label="More actions" color="gray" />
    </x-slot>

    <x-dropdown-list>
        <x-dropdown-item icon="o-pencil-square">Edit</x-dropdown-item>
        <x-dropdown-item icon="o-trash" color="danger">Delete</x-dropdown-item>
    </x-dropdown-list>
</x-dropdown>
```

## Mixing component tags with EJS

Component tags may be placed inside EJS conditions and loops, and receive the loop variables:

```html
<% for (const order of orders) { %>
    <x-badge :color="order.paid ? 'success' : 'warning'"><%= order.number %></x-badge>
<% } %>
```

```preview
template(`<div style="display: flex; gap: 0.5rem">
<% for (const order of orders) { %>
    <x-badge :color="order.paid ? 'success' : 'warning'"><%= order.number %></x-badge>
<% } %>
</div>`, { orders: [{ number: 'OR-1024', paid: true }, { number: 'OR-1025', paid: false }, { number: 'OR-1026', paid: true }] })
```

The content of EJS tags is never read as a component: `<%# <x-button> %>` is a comment, and `<% const tag = '<x-badge>'; %>` is a JavaScript string. A component tag must be written in the template itself, not produced by an EJS expression.

A view that opens a component tag without closing it, closes a tag that is not open, or uses a component that does not exist throws an error when it is rendered, with the name of the file.

## Escaping and security

EJS gives you two output tags, and component tags follow the same rules:

- `<%= value %>` escapes the value. Use it for every value that comes from a user or from the database.
- `<%- html %>` prints the value as is. Use it only for HTML that you built and escaped yourself, or that a component returned.

The built-in components escape the text props they display: a `heading`, `description`, `label` or `prefix` is printed as text, whether you wrote it in the tag or bound it to a value (`:heading="customer.name"`).

A slot is different: it is HTML, already rendered by your view. In `<x-badge><%= order.status %></x-badge>`, the status is escaped by `<%= %>`, and the badge inserts the result as it is. Write `<%- %>` inside a slot only for trusted HTML. The props that take HTML (`footer`, `controls`, `after-header`, `trigger`, `footer-actions`) are inserted as is too: fill them with named slots, or with HTML that you built yourself.

HTML attributes and props such as `href` or `src` are printed between double quotes, with `"` escaped. Their content is not checked: a `href` that comes from a user may be a `javascript:` URL. Check such URLs with `isSafeUrl()` from `@navette-js/support` before you pass them.

<Aside variant="danger">
`<%- %>` with a value that a user can change makes your application vulnerable to XSS attacks. When in doubt, use `<%= %>`.
</Aside>
