---
title: Creating components
---

## Introduction

You may write your own components and use them in your views with the same tags as the [built-in components](/components/overview#using-the-built-in-components). A component is an EJS file of a **components directory**: `<x-card>` renders `card.ejs`.

Projects created with `npm create navette` already register `src/components` as a components directory, in `src/server.ts`:

```ts
import { views } from '@navette-js/support';

views.components(new URL('./components/', import.meta.url));
```

To use a component, create `src/components/card.ejs`:

```html
<div <%- attributes.class(['card']) %>>
    <h3><%= title %></h3>

    <%- slot %>
</div>
```

Then write `<x-card>` in any view:

```html
<x-card title="Shipping address" class="mt-4">
    <p><%= order.address %></p>
</x-card>
```

The tag renders:

```html
<div class="mt-4 card">
    <h3>Shipping address</h3>

    <p>12 Rue de la Paix, Paris</p>
</div>
```

## Generating a component

The CLI creates the file of a component in `src/components`:

```bash
npx navette make:component card
```

The generated `src/components/card.ejs` shows the variables a component receives: an optional `title` prop, the slot, a `footer` named slot and the attributes. Edit it to your needs. The command never overwrites an existing file, unless you pass `--force`.

The name is converted to lowercase words separated by hyphens: `make:component StatCard` creates `stat-card.ejs`, used as `<x-stat-card>`.

### Placing components in sub-folders

A dot in the name of a component is a folder: `<x-forms.hint>` renders `src/components/forms/hint.ejs`. The generator follows the same rule:

```bash
npx navette make:component forms.hint
```

Component names may contain letters, digits, `-` and `_`, and dots between folders.

## Registering a components directory

Outside a generated project, or to add another directory, call `views.components()` once when your application starts, with a URL or an absolute path:

```ts
import { views } from '@navette-js/support';

views.components(new URL('./components/', import.meta.url));
views.components(new URL('./theme/components/', import.meta.url));
```

When a component exists in several directories, the directory registered **last** wins: `theme/components/card.ejs` is used before `components/card.ejs`. A directory that does not exist is ignored.

## Writing the view of a component

A component view is an EJS template, with these variables:

| Variable | Content |
| --- | --- |
| The props | One variable per prop of the tag, camelCased: `<x-card sub-title="…">` gives `subTitle`. Named slots are props too |
| `slot` | The content of the tag, already rendered HTML (an empty string for a self-closing tag) |
| `slots` | The named slots, by name: `slots.footer` |
| `attributes` | The HTML attributes of the tag (`class`, `id`, `data-*`, `x-*`, `wire:*`…), see [using the attributes](#using-the-attributes) |
| `e`, `icon` | Helpers: `e(value)` escapes a value, `icon(name)` returns the SVG of an [icon](/styling/icons) |

A component view only sees these variables: the variables of the view that uses the tag are not passed to it. Pass what the component needs as props.

### Testing whether a prop was given

A prop that the tag does not set is not defined, and EJS throws an error when a view reads an undefined variable. Test optional props through `locals`, the object that holds all the variables of the view:

```html
<div <%- attributes.class(['card']) %>>
    <% if (locals.title) { %>
        <h3><%= title %></h3>
    <% } %>

    <%- slot %>

    <% if (slots.footer) { %>
        <footer><%- slots.footer %></footer>
    <% } %>
</div>
```

```html
<x-card>
    <p>No title for this one.</p>

    <x-slot name="footer">
        <x-button size="sm">Save</x-button>
    </x-slot>
</x-card>
```

### Using other components in a component

A component view may use component tags, built-in or your own:

```html
<%# src/components/stat-card.ejs: <x-stat-card label="Revenue" value="$12,400" trend="up" /> %>
<div <%- attributes.class(['stat-card']) %>>
    <p class="stat-card-label"><%= label %></p>
    <p class="stat-card-value"><%= value %></p>

    <% if (locals.trend) { %>
        <x-badge
            :color="trend === 'up' ? 'success' : 'danger'"
            :icon="trend === 'up' ? 'm-arrow-trending-up' : 'm-arrow-trending-down'"
        >
            <%= trend === 'up' ? 'Rising' : 'Falling' %>
        </x-badge>
    <% } %>
</div>
```

### Escaping values in a component

Inside a component view, the [usual rules](/components/overview#escaping-and-security) apply: print props with `<%= %>`, which escapes them, and keep `<%- %>` for `slot`, the named slots and `attributes`, which are HTML. A prop is not escaped before it reaches your view: `<x-card :title="user.name">` gives the raw name, and `<%= title %>` escapes it.

## Using the attributes

`attributes` holds the HTML attributes of the tag. Print it inside the opening tag of your root element with `<%- attributes %>`; values are printed between double quotes, with `"` escaped. Its methods return a new set of attributes:

| Method | Effect |
| --- | --- |
| `class(['card', { 'card-active': active }])` | Adds classes after the classes of the tag. An object adds each key whose value is true |
| `merge({ role: 'region', class: 'card' })` | Default attributes: the tag's attributes replace them, except `class` and `style`, which are added after the defaults |
| `style(['padding: 1rem', wide && 'width: 100%'])` | Adds styles after the styles of the tag; false values are skipped |
| `set('aria-live', 'polite')` | Adds or replaces one attribute |
| `get('id')`, `has('wire:key')` | Reads an attribute |
| `when(condition, (attributes) => attributes.class(['card-compact']))` | Applies a change only when the condition is true |

```html
<section <%- attributes.merge({ role: 'region' }).class(['card', { 'card-compact': locals.compact }]) %>>
    <%- slot %>
</section>
```

`<x-card compact class="mt-4" wire:key="card-1">` renders `<section role="region" class="mt-4 card card-compact" wire:key="card-1">`.

## Rendering a component with a function

A component may also be a function, registered with `views.component()` when your application starts. It receives the props (camelCased, named slots included) and the default slot, and returns HTML:

```ts
import { attrs, e, views } from '@navette-js/support';

views.component('rating', ({ value, max = 5, attributes }) => {
    const stars = Math.max(0, Math.min(Math.round(Number(value)) || 0, Number(max)));

    return `<span ${attrs(attributes).class(['rating'])} aria-label="${e(stars)} out of ${e(max)}">`
        + '★'.repeat(stars) + '☆'.repeat(Number(max) - stars)
        + '</span>';
});
```

```html
<x-rating :value="product.rating" class="text-warning" />
```

In a function, `attributes` is a plain object of the HTML attributes: wrap it with `attrs()` to use the methods above, or read its keys. The function must return a string synchronously, and it must escape what it prints with `e()`: unlike `<%= %>` in a view, nothing is escaped for you.

```preview
views.component('docs-rating', ({ value, max = 5, attributes }) => {
    const stars = Math.max(0, Math.min(Math.round(Number(value)) || 0, Number(max)));
    return `<span ${attrs(attributes).class(['rating'])} style="color: #f59e0b; font-size: 1.25rem" aria-label="${e(stars)} out of ${e(max)}">` + '★'.repeat(stars) + '☆'.repeat(Number(max) - stars) + '</span>';
});
return template(`<x-docs-rating :value="4" />`);
```

When a file and a function have the same name, the file wins.

## Overriding a built-in component

The built-in components are function components too. To change one of them in your views, create a file with its name in a components directory, for example `src/components/badge.ejs`, or register a function with `views.component('badge', …)`. Registering a name that already exists replaces the component.

The override applies to the `<x-badge>` tags of your views only. The components that Navette renders itself (form fields, table columns, actions, notifications) keep their own HTML.

<Aside variant="info">
Navette compiles each view once and keeps it in memory. `npm run dev` restarts the server when a TypeScript file changes, but not when an `.ejs` file changes: restart it after editing a view or a component.
</Aside>
