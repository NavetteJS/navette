---
title: Using the components from TypeScript
---

## Introduction

Each `<x-…>` component is backed by a TypeScript function of `@navette-js/support/ui` that returns its HTML as a string. Call these functions when you build HTML in TypeScript (a render hook, a custom column, a widget's `render()` method, an HTTP route of your own) instead of in a view:

```ts
import { ui } from '@navette-js/support/ui';

const html = ui.button({ color: 'danger', icon: 'o-trash', tooltip: 'Delete the post' }, 'Delete');
```

The functions are exported one by one too (`import { button, badge, modal } from '@navette-js/support/ui'`), with the type of their props (`ButtonProps`, `BadgeProps`, `ModalProps`…). The `ui` object groups them.

In a panel application, the panel gives the components its colors. Elsewhere, call `useColorManager()` once before rendering, as described in the [overview](/components/overview):

```ts
import { Color, ColorManager } from '@navette-js/support';
import { useColorManager } from '@navette-js/support/ui';

useColorManager(new ColorManager().register({ primary: Color.Indigo }));
```

## Props, slots and attributes

The functions follow the components:

- The first argument is an object of props, with the names of the component's props in camelCase: `icon-position="after"` becomes `{ iconPosition: 'after' }`, `persist-collapsed` becomes `{ persistCollapsed: true }`.
- The second argument, when the component has content, is the slot: the HTML placed inside the component.
- `attributes` holds the other HTML attributes of the root element, as in the [attribute bag](/components/overview#passing-props) of a view. Classes are merged with the component's own classes.

```ts
ui.section({ heading: 'Rate limiting', collapsible: true, persistCollapsed: true, attributes: { id: 'rate-limiting' } }, '<p>…</p>');

ui.badge({ color: 'success', icon: 'o-check-circle', attributes: { class: 'my-badge' } }, 'Published');
```

<Aside variant="warning">
The slot and the props that take HTML (`trigger`, `footer`, `footerActions`, `afterHeader`, `labelHtml`…) are inserted as they are. Escape any text that does not come from your code with `e()`, which `@navette-js/support/ui` re-exports. Text props (`label`, `heading`, `description`, `tooltip`, `badge`…) and attributes are escaped by the functions.
</Aside>

```ts
import { e, ui } from '@navette-js/support/ui';

ui.button({ color: 'gray' }, e(user.name));
```

## Available functions

| Function | Component | Arguments |
| --- | --- | --- |
| `avatar()` | [`<x-avatar>`](/components/other#avatar) | `{ src, alt, size, circular, attributes }` |
| `badge()` | [`<x-badge>`](/components/badge) | `BadgeProps`, slot |
| `breadcrumbs()` | [`<x-breadcrumbs>`](/components/other#breadcrumbs) | a list of `{ label, url }`, the label of the navigation landmark |
| `button()` | [`<x-button>`](/components/button) | `ButtonProps`, slot |
| `callout()` | [`<x-callout>`](/components/callout-and-empty-state) | `CalloutProps` |
| `checkbox()` | [`<x-checkbox>`](/components/form-elements#checkbox) | `{ checked, valid, attributes }` |
| `dropdown()` | [`<x-dropdown>`](/components/dropdown) | `{ trigger, width, maxHeight, placement, offset, menu, attributes }`, slot |
| `dropdownList()`, `dropdownItem()` | `<x-dropdown-list>`, `<x-dropdown-item>` | a list of `DropdownItem`, or one |
| `emptyState()` | [`<x-empty-state>`](/components/callout-and-empty-state) | `EmptyStateProps` |
| `fieldset()` | [`<x-fieldset>`](/components/form-elements#fieldset) | `{ label, labelHidden, attributes }`, slot |
| `iconButton()` | [`<x-icon-button>`](/components/other#icon-button) | `IconButtonProps` |
| `input()` | [`<x-input>`](/components/form-elements#input) | attributes |
| `inputWrapper()` | [`<x-input-wrapper>`](/components/form-elements#input-wrapper) | `InputWrapperProps`, slot |
| `link()` | [`<x-link>`](/components/other#link) | `LinkProps`, slot |
| `loadingIndicator()` | [`<x-loading-indicator>`](/components/other#loading-indicator) | an `Attributes` bag, size |
| `modal()` | [`<x-modal>`](/components/modal) | `ModalProps`, slot |
| `pagination()` | [`<x-pagination>`](/components/other#pagination) | `PaginationProps` |
| `section()` | [`<x-section>`](/components/section) | `SectionProps`, slot |
| `select()` | [`<x-select>`](/components/form-elements#select) | attributes, slot (the `<option>` elements) |
| `spinner()` | `<x-spinner>` | attributes |
| `tabs()`, `tabItem()` | [`<x-tabs>`, `<x-tabs.item>`](/components/tabs) | tabs props, a list of `TabItem`, slot |

Each component page lists the props; their TypeScript names are the camelCase forms. A few props only exist in TypeScript, where a view would use a slot:

- `modal()`: `trigger` (the HTML of the element opening the modal), `triggerAttributes`, `footer` and `footerActions` (lists of rendered buttons);
- `dropdown()`: `trigger`;
- `tabItem()` and `dropdownItem()`: `labelHtml`, an HTML label used instead of `label`;
- `section()`: `afterHeader` and `footer`.

## Building a modal with a trigger

```ts
import { ui } from '@navette-js/support/ui';

const html = ui.modal({
    id: 'confirm-publish',
    heading: 'Publish the post?',
    description: 'Subscribers will receive it by email.',
    icon: 'o-paper-airplane',
    trigger: ui.button({}, 'Publish'),
    footerActions: [
        ui.button({ attributes: { 'wire:click': 'publish' } }, 'Publish'),
        ui.button({ color: 'gray', attributes: { 'x-on:click': 'close' } }, 'Cancel'),
    ],
}, '<p>The post will be visible to everyone.</p>');
```

As with `<x-modal>`, the modal also opens with an `open-modal` browser event carrying its `id`.

## Other helpers

`@navette-js/support/ui` also re-exports three helpers used to build HTML:

- `e(value)` escapes a value for HTML text and attributes;
- `js(value)` turns a value into a JavaScript literal, for Alpine.js expressions (`x-on:click="select(${js(id)})"`, then escaped with `e()` in an attribute);
- `cls(list)` builds a `class` attribute value from strings, arrays and `{ className: condition }` objects.

```ts
import { cls, e, js } from '@navette-js/support/ui';

const attribute = `x-on:click="${e(`select(${js(record.id)})`)}"`;
const classes = cls(['fi-card', { 'fi-active': isActive }]);
```
