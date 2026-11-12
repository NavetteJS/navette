---
title: Modals
---

## Introduction

Actions may require additional confirmation or input from the user before they run. You may open a modal before an action is executed to do this.

The modal is rendered on the server: when the action is mounted, Navette checks that it is available, builds its form, fills it, and sends back the modal's HTML only. Submitting the modal validates the form on the server and runs the action.

## Confirmation modals

You may require confirmation before an action is run using the `requiresConfirmation()` method. This is useful for particularly destructive actions, such as those that delete records.

```ts
import { Action } from '@navette-js/actions';

Action.make('delete')
    .color('danger')
    .requiresConfirmation()
    .action(async ({ record }) => {
        await PostResource.adapter.delete(PostResource.adapter.getKey(record));
    })
```

A confirmation modal is centered and narrow (`md`). By default its heading is the action's label, its description is "Are you sure you would like to do this?", its icon is a warning triangle in the action's color, and its submit button is labeled "Confirm". The cancel button comes before the submit button.

<Aside variant="info">
The confirmation modal is not available when a `url()` is set instead of an `action()`. Instead, you should redirect to the URL within the `action()` function, with `livewire.redirect(url)`.
</Aside>

## Controlling modal content

### Customizing the modal's heading, description, and submit action label

You may customize the heading, description and label of the submit button in the modal:

```ts
import { Action } from '@navette-js/actions';

Action.make('delete')
    .color('danger')
    .requiresConfirmation()
    .modalHeading('Delete post')
    .modalDescription('Are you sure you\'d like to delete this post? This cannot be undone.')
    .modalSubmitActionLabel('Yes, delete it')
    .action(async ({ record }) => {
        // ...
    })
```

`modalHeading()` and `modalDescription()` also accept a function, which may be asynchronous. It receives the same context as `action()`: `record`, `arguments`, `livewire` and `data`:

```ts
import { Action } from '@navette-js/actions';

Action.make('delete')
    .requiresConfirmation()
    .modalHeading(({ record }) => `Delete ${record.name}`)
```

The heading and description are escaped.

### Rendering a schema in a modal

Navette allows you to render a schema in a modal, which allows you to render any of the available components to build a UI. To do so, use the `schema()` method. It accepts an array of components, or a function receiving the modal's `Schema` and returning either an array of components or the configured schema:

```ts
import { Action } from '@navette-js/actions';
import { TextEntry } from '@navette-js/infolists';

Action.make('view_profile')
    .icon('m-eye')
    .color('gray')
    .modalSubmitAction(false)
    .schema(() => [
        TextEntry.make('name'),
        TextEntry.make('email'),
        TextEntry.make('salary').money('usd'),
        TextEntry.make('hire_date').date(),
    ])
```

The modal's schema is bound to the action's `record`, so entries display its attributes. With `modalSubmitAction(false)`, the modal only has a close button.

The schema is rebuilt on every request. Prefer a function returning new components over an array of components stored in a shared constant.

You may pass the number of columns of the modal's grid as the second argument of `schema()`, for example `.schema(() => [...], 2)`.

#### Rendering a form in a modal

You may use form field components to create action modal forms. The data from the form is available in the `data` property of the `action()` function's context:

```ts
import { Action } from '@navette-js/actions';
import { Select } from '@navette-js/forms';

Action.make('change_department')
    .icon('m-building-office-2')
    .color('gray')
    .modalWidth('md')
    .modalSubmitActionLabel('Save')
    .schema(() => [
        Select.make('department_id')
            .label('Department')
            .options(async () => (await Department.query().select('id', 'name')).map((department): [string, string] => [String(department.id), department.name]))
            .required(),
    ])
    .action(async ({ record, data }) => {
        await EmployeeResource.adapter.update(record.id, { department_id: Number(data.department_id) });
    })
```

When the modal is submitted, Navette validates the form on the server. If validation fails, the modal stays open with the error messages, and the action does not run. Otherwise, `data` contains the validated state of the visible, dehydrated fields declared in the schema, and nothing else; empty strings become `null`.

#### Filling the form with existing data

You may fill the form with existing data, using the `fillForm()` method. It receives the action's context and may be asynchronous:

```ts
import { Action } from '@navette-js/actions';

Action.make('change_department')
    .fillForm(({ record }) => ({ department_id: record.department_id }))
    .schema(() => [
        // ...
    ])
    .action(async ({ record, data }) => {
        // ...
    })
```

The form is first filled with the default values of its fields, then with the values returned by `fillForm()`.

### Adding an icon inside the modal

You may add an icon inside the modal using the `modalIcon()` method. It is displayed in the color of the action:

```ts
import { Action } from '@navette-js/actions';

Action.make('delete')
    .color('danger')
    .requiresConfirmation()
    .modalIcon('o-trash')
```

### Custom modal content

You may add your own HTML to modals with the render hooks of `ActionsRenderHook`. They are rendered around the modal's schema, in this order: `MODAL_CUSTOM_CONTENT_BEFORE`, `MODAL_CUSTOM_CONTENT_AFTER`, `MODAL_SCHEMA_BEFORE`, the schema, `MODAL_SCHEMA_AFTER`, `MODAL_CUSTOM_CONTENT_FOOTER_BEFORE` and `MODAL_CUSTOM_CONTENT_FOOTER_AFTER`. Each hook receives the action as `data.action`:

```ts
import { ActionsRenderHook } from '@navette-js/actions';
import { e } from '@navette-js/support';

panel.renderHook(
    ActionsRenderHook.MODAL_CUSTOM_CONTENT_BEFORE,
    ({ data }) => (data.action.getName() === 'delete' ? `<p>${e('Deleted posts can be restored for 30 days.')}</p>` : null),
    EditPost,
);
```

The third argument limits the hook to pages of a class (here, the `EditPost` page). The returned HTML is inserted as-is: escape anything that comes from data.

## Using a slide-over instead of a modal

You can open a "slide-over" dialog instead of a modal by using the `slideOver()` method:

```ts
import { Action } from '@navette-js/actions';

Action.make('view_profile')
    .slideOver()
    .modalSubmitAction(false)
    .schema(() => [
        // ...
    ])
```

Instead of opening in the center of the screen, the modal content will now slide in from the side.

## Changing the modal width

You can change the width of the modal by using the `modalWidth()` method. Options are `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl` and `7xl`:

```ts
import { Action } from '@navette-js/actions';

Action.make('update_author')
    .schema(() => [
        // ...
    ])
    .modalWidth('5xl')
```

By default, a confirmation modal is `md` and centered, and a form modal is `4xl` and aligned to the start. A form modal of width `xs` or `sm` is centered.

## Customizing the action buttons in the footer of the modal

### Modifying the default modal footer action buttons

You may change the label of the submit button with `modalSubmitActionLabel()`, and the label of the cancel button with `modalCancelActionLabel()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('help')
    .modalSubmitActionLabel('Got it')
    .modalCancelActionLabel('Close')
```

The submit button uses the color of the action, or `primary` if the action is `gray`.

### Removing the submit button

You may remove the submit button with `modalSubmitAction(false)`. This is useful for modals that only display information:

```ts
import { Action } from '@navette-js/actions';

Action.make('view_profile')
    .modalSubmitAction(false)
    .modalCancelActionLabel('Close')
```

### Adding an extra modal action button to the footer

You may pass an array of extra actions to be rendered between the default actions in the footer of the modal using the `extraModalFooterActions()` method:

```ts
import { Action } from '@navette-js/actions';

Action.make('edit_page')
    .schema(() => [
        // ...
    ])
    .extraModalFooterActions([
        Action.make('preview')
            .color('gray')
            .url('/pages/preview')
            .openUrlInNewTab(),
    ])
```

Extra footer actions are rendered as buttons, but they are not mounted like the main action: give them a `url()`, or a string `action()` naming a method of the host component, which is called with `wire:click`. That method must be listed in the component's `static callable`.

The prebuilt create and attach actions use this to add a "Create & create another" button: `action('callMountedAction({ another: true })')` submits the modal, runs the action and keeps the modal open with a reset form.

<Aside variant="warning">
Extra footer actions with an `action()` function, nested modals, and access to the data of a parent action are not available yet.
</Aside>

## Modifying data and running code around the action

### Modifying data before the action runs

You may transform the validated form data before it reaches the `action()` function with `mutateDataUsing()`. The function receives the data and the action's context, and returns the new data:

```ts
import { Action } from '@navette-js/actions';

Action.make('add_note')
    .schema(() => [
        // ...
    ])
    .mutateDataUsing((data, { livewire }) => ({ ...data, author_id: livewire._ctx.user.id }))
    .action(async ({ data }) => {
        await Note.query().insert(data);
    })
```

This is also how you customize the data of the prebuilt [create](/actions/create#customizing-data-before-saving) and [edit](/actions/edit#customizing-data-before-saving) actions.

### Lifecycle hooks

`before()` runs after `mutateDataUsing()` and just before the `action()` function, and `after()` runs once the `action()` function has succeeded. Both receive the action's context, with the mutated `data`:

```ts
import { Action } from '@navette-js/actions';

Action.make('approve')
    .requiresConfirmation()
    .before(async ({ record }) => {
        // Runs before the action
    })
    .action(async ({ record }) => {
        // ...
    })
    .after(async ({ record }) => {
        // Runs after the action
    })
```

An error thrown by `before()` stops the action, but the request fails and the browser displays an error. To stop an action with a message instead, check the condition in the `action()` function, send a [notification](/notifications/overview) and return.

## Closing the modal

The modal closes once the action has run successfully. The user may also close it with the close button, the cancel button, the Escape key or a click outside the modal; nothing is run in that case.

<Aside variant="warning">
Disabling closing by clicking away or by pressing Escape, sticky headers and footers, modal wizards, `mountUsing()` and `modalHidden()` are not available yet.
</Aside>
