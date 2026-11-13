---
title: Modal
---

## Introduction

The modal component renders a dialog, hidden until it is opened. Give it an `id`, and open it by dispatching an `open-modal` browser event with that id:

```html
<x-button x-on:click="$dispatch('open-modal', { id: 'edit-user' })">
    Edit user
</x-button>

<x-modal id="edit-user" heading="Edit user">
    <p>The changes apply on the next sign-in.</p>
</x-modal>
```

The content of the tag is the content of the modal. The modal is rendered on the server with the page, and opened and closed in the browser by Alpine.js: its content is already there when it opens.

<Aside variant="info">
The `id` must be unique in the page: every modal listens to the same events, and opens when the event carries its id.
</Aside>

## Opening and closing a modal

Dispatch these browser events, with the id of the modal:

| Event | Effect |
| --- | --- |
| `open-modal` | Opens the modal |
| `close-modal` | Closes the modal |
| `close-modal-quietly` | Hides the modal only: the focus is not restored and no `modal-closed` event is dispatched |

When it closes, the modal dispatches a `modal-closed` browser event with its id, which you may listen to with `x-on:modal-closed.window`.

From Alpine.js, use `$dispatch()`:

```html
<x-button color="gray" x-on:click="$dispatch('close-modal', { id: 'edit-user' })">
    Cancel
</x-button>
```

From a method of a page called with `wire:click`, use `dispatch()`. The event reaches the browser with the response:

```ts
async save(): Promise<void> {
    // … save the changes
    this.dispatch('close-modal', { id: 'edit-user' });
}
```

## Adding a heading to a modal

Use the `heading` prop. The modal is labelled by its heading for assistive technologies:

```html
<x-modal id="edit-user" heading="Edit user">
    <!-- … -->
</x-modal>
```

## Adding a description to a modal

Use the `description` prop to add text below the heading. It is only displayed when the modal has a heading:

```html
<x-modal id="edit-user" heading="Edit user" description="The changes apply on the next sign-in.">
    <!-- … -->
</x-modal>
```

## Adding an eyebrow to a modal

The `eyebrow` prop displays a short text above the heading:

```html
<x-modal id="edit-user" eyebrow="Ada Lovelace" heading="Edit user">
    <!-- … -->
</x-modal>
```

The heading, description and eyebrow are escaped.

## Adding an icon to a modal

Pass the name of an [icon](/styling/icons) to the `icon` prop. Its color is `primary`, unless you set `icon-color`:

```html
<x-modal id="delete-user" heading="Delete user" icon="o-trash" icon-color="danger">
    <p>This cannot be undone.</p>
</x-modal>
```

## Adding a footer to a modal

Put the buttons of the modal in a `footer` [named slot](/components/overview#using-named-slots). Wrap them in a `fi-modal-footer-actions` element to lay them out like the footer of an action modal:

```html
<x-modal id="delete-user" heading="Delete user" icon="o-trash" icon-color="danger">
    <p>This cannot be undone.</p>

    <x-slot name="footer">
        <div class="fi-modal-footer-actions">
            <x-button color="danger" wire:click="deleteUser">Delete</x-button>
            <x-button color="gray" x-on:click="$dispatch('close-modal', { id: 'delete-user' })">Cancel</x-button>
        </div>
    </x-slot>
</x-modal>
```

You may instead pass the buttons as an array of HTML strings to `footer-actions`, as a bound value (`:footer-actions="buttons"`): the modal places them in the `fi-modal-footer-actions` element itself.

### Aligning the footer

The footer content is aligned at the start. Use `footer-actions-alignment` to align it at the `center` or the `end`:

```html
<x-modal id="edit-user" heading="Edit user" footer-actions-alignment="end">
    <!-- … -->
</x-modal>
```

## Changing the modal's alignment

The content of the modal is aligned at the start. Set `alignment` to `center` to center the icon, heading and description:

```html
<x-modal id="delete-user" heading="Delete user" icon="o-trash" icon-color="danger" alignment="center" width="md">
    <!-- … -->
</x-modal>
```

## Using a slide-over instead of a modal

The `slide-over` prop opens the dialog as a panel that slides in from the side of the screen:

```html
<x-modal id="filters" heading="Filters" slide-over>
    <!-- … -->
</x-modal>
```

## Making the modal header sticky

With `sticky-header`, the header stays visible when the content of a long modal scrolls:

```html
<x-modal id="terms" heading="Terms of service" sticky-header>
    <!-- … -->
</x-modal>
```

## Making the modal footer sticky

With `sticky-footer`, the footer stays visible when the content of a long modal scrolls:

```html
<x-modal id="terms" heading="Terms of service" sticky-footer>
    <!-- … -->
</x-modal>
```

## Changing the modal width

The modal is small (`sm`). Use `width` to change it: `xs`, `sm`, `md`, `lg`, `xl`, `2xl` to `7xl`, `full`, `screen`, `prose` or `fit`:

```html
<x-modal id="report" heading="Report" width="5xl">
    <!-- … -->
</x-modal>
```

## Closing the modal by clicking away

By default, a click outside the modal closes it. To disable this:

```html
<x-modal id="edit-user" heading="Edit user" :close-by-clicking-away="false">
    <!-- … -->
</x-modal>
```

## Closing the modal by escaping

By default, the Escape key closes the topmost modal. To disable this:

```html
<x-modal id="edit-user" heading="Edit user" :close-by-escaping="false">
    <!-- … -->
</x-modal>
```

## Hiding the modal close button

A modal with a heading has a close button in its header. To hide it:

```html
<x-modal id="edit-user" heading="Edit user" :close-button="false">
    <!-- … -->
</x-modal>
```

Keep another way to close the modal: a button in the footer, a click outside, or the Escape key.

## Using a modal as an alert dialog

The `alert` prop gives the modal the `alertdialog` role instead of `dialog`, for a message that requires the user's attention:

```html
<x-modal id="session-expired" heading="Your session has expired" alert :close-by-clicking-away="false">
    <!-- … -->
</x-modal>
```

## Using a modal in a page

In a [page rendered with a view](/resources/custom-pages#rendering-a-page-with-a-view), pass the id of the page component as `livewire-id`. The modal uses it to prefix the `wire:key` of its parts, so that Livewire tells them apart from the modals of other components:

```html
<x-modal id="edit-user" heading="Edit user" :livewire-id="livewireId">
    <!-- … -->
</x-modal>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | string | required | Id of the modal, used by the events |
| `heading` | string | none | Heading, escaped |
| `description` | string | none | Text below the heading, escaped |
| `eyebrow` | string | none | Text above the heading, escaped |
| `icon` | string | none | Icon name |
| `icon-color` | string | `primary` | Color of the icon |
| `footer` | HTML | none | Content of the footer (named slot) |
| `footer-actions` | array of HTML strings | none | Buttons of the footer, when there is no `footer` |
| `footer-actions-alignment` | `start`, `center`, `end` | `start` | Alignment of the footer |
| `alignment` | `start`, `center` | `start` | Alignment of the header |
| `width` | string | `sm` | Maximum width of the modal |
| `slide-over` | boolean | `false` | Slides in from the side |
| `sticky-header` | boolean | `false` | The header stays visible while scrolling |
| `sticky-footer` | boolean | `false` | The footer stays visible while scrolling |
| `alert` | boolean | `false` | `alertdialog` role |
| `close-button` | boolean | `true` | Close button in the header |
| `close-by-clicking-away` | boolean | `true` | A click outside closes the modal |
| `close-by-escaping` | boolean | `true` | The Escape key closes the modal |
| `livewire-id` | string | none | Id of the component that contains the modal |

Other HTML attributes are not used by the modal.
