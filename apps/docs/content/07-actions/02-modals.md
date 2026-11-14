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

#### Adding an eyebrow above the modal heading

You may add an eyebrow, a short line of text displayed above the modal heading, using the `modalEyebrow()` method. This is useful when the heading names a specific record and the eyebrow names the operation being performed on it:

```ts
import { EditAction } from '@navette-js/panels';

EditAction.make()
    .modalEyebrow('Edit post')
    .modalHeading(({ record }) => record.title)
```

`modalEyebrow()` also accepts a function of the action's context. The eyebrow is escaped, unless it is an `HtmlString`; it requires a heading and is not part of the modal's accessible name.

Setting a heading, an eyebrow, a description or custom content is enough to give an action a modal: clicking it then opens the modal, and the action runs when the modal is submitted.

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

#### Disabling all form fields

You may disable all form fields in the modal, ensuring the user cannot edit them, using the `disabledSchema()` method:

```ts
import { Action } from '@navette-js/actions';
import { Textarea, TextInput } from '@navette-js/forms';

Action.make('approvePost')
    .schema([
        TextInput.make('title'),
        Textarea.make('content'),
    ])
    .fillForm(({ record }) => record)
    .disabledSchema()
    .action(async ({ record }) => {
        // ...
    })
```

Disabled fields are not submitted: `data` does not contain them, whatever the browser sends.

### Adding an icon inside the modal

You may add an icon inside the modal using the `modalIcon()` method. It is displayed in the color of the action, or in the color given to `modalIconColor()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('delete')
    .color('danger')
    .requiresConfirmation()
    .modalIcon('o-trash')
    .modalIconColor('warning')
```

### Custom modal content

You may define custom content to be rendered inside your modal with the `modalContent()` method. A string is escaped; an `HtmlString` (for example a rendered view) is inserted as is, so build it from escaped values:

```ts
import { Action } from '@navette-js/actions';
import { e, HtmlString, views } from '@navette-js/support';

Action.make('advance')
    .modalContent(({ record }) => new HtmlString(views.render('app::actions.advance', { record })))
    .action(async ({ record }) => {
        // ...
    })
```

`modalContent()` accepts a value or a function (which may be asynchronous) receiving the action's context, with the `record`.

#### Adding custom modal content below the form

By default, the custom content is displayed above the modal form if there is one; `modalContentFooter()` adds content below it:

```ts
import { Action } from '@navette-js/actions';
import { HtmlString } from '@navette-js/support';

Action.make('advance')
    .modalContentFooter(new HtmlString('<p>The customer is notified by email.</p>'))
```

#### Adding an action to custom modal content

You can add an action button to your custom modal content by registering the action with `registerModalActions()`, then rendering it with `renderModalAction()` (`getModalAction(name)` returns the action itself):

```ts
import { Action } from '@navette-js/actions';
import { HtmlString } from '@navette-js/support';

Action.make('advance')
    .registerModalActions([
        Action.make('report')
            .requiresConfirmation()
            .action(async ({ record }) => {
                // ...
            }),
    ])
    .modalContent(async (ctx) => new HtmlString(`<div>${await ctx.action!.renderModalAction('report', ctx)}</div>`))
    .action(async ({ record }) => {
        // ...
    })
```

A registered action is mounted on top of the open modal, like an [extra footer action](#running-an-action-on-top-of-the-modal), and checked the same way.

#### Using render hooks

You may also add your own HTML to modals with the render hooks of `ActionsRenderHook`. They are rendered around the custom content and the modal's schema, in this order: `MODAL_CUSTOM_CONTENT_BEFORE`, the custom content, `MODAL_CUSTOM_CONTENT_AFTER`, `MODAL_SCHEMA_BEFORE`, the schema, `MODAL_SCHEMA_AFTER`, `MODAL_CUSTOM_CONTENT_FOOTER_BEFORE`, the content footer and `MODAL_CUSTOM_CONTENT_FOOTER_AFTER`. Each hook receives the action as `data.action`:

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

### Changing the slide-over position

By default, slide-overs enter from the end of the screen (the right side in left-to-right languages, the left side in right-to-left languages). You may change this to the start of the screen with `slideOverPosition('start')`:

```ts
import { Action } from '@navette-js/actions';

Action.make('updateAuthor')
    .schema([
        // ...
    ])
    .slideOver()
    .slideOverPosition('start')
```

This is useful when the trigger sits near the start of the viewport, such as a row action at the beginning of a table row.

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

To modify the action used to render one of the default buttons, pass a function to `modalSubmitAction()` or `modalCancelAction()`. It receives the button's action, which you may change with the [methods of trigger buttons](/actions/overview), and returns it:

```ts
import { Action } from '@navette-js/actions';

Action.make('help')
    .modalContent('...')
    .modalCancelAction((action) => action.label('Close'))
    .modalSubmitAction((action) => action.icon('m-check').color('success'))
```

To only change the labels, use `modalSubmitActionLabel()` and `modalCancelActionLabel()`:

```ts
import { Action } from '@navette-js/actions';

Action.make('help')
    .modalSubmitActionLabel('Got it')
    .modalCancelActionLabel('Close')
```

The submit button uses the color of the action, or `primary` if the action is `gray`.

### Removing a default modal footer action button

You may remove the submit button with `modalSubmitAction(false)`, and the cancel button with `modalCancelAction(false)`. This is useful for modals that only display information:

```ts
import { Action } from '@navette-js/actions';

Action.make('view_profile')
    .modalSubmitAction(false)
    .modalCancelActionLabel('Close')
```

### Adding an extra modal action button to the footer

You may pass an array of extra actions to be rendered between the default actions in the footer of the modal using the `extraModalFooterActions()` method. It also accepts a function receiving the action:

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

An extra footer action may have a `url()`, a string `action()` naming a method of the host component (called with `wire:click`, and listed in the component's `static callable`), or an `action()` function.

`makeModalSubmitAction(name, arguments)` returns a button that submits the modal with extra arguments, merged into the `arguments` of the `action()` function. They are flags telling the action what the user chose:

```ts
import { Action } from '@navette-js/actions';

Action.make('create')
    .schema([
        // ...
    ])
    .extraModalFooterActions((action) => [
        action.makeModalSubmitAction('createAnother', { another: true }).label('Create & create another'),
    ])
    .action(async ({ data, arguments: args }) => {
        // Create...
        if (args.another) {
            // ...
        }
    })
```

These arguments come from the browser: treat them as user input. The prebuilt create and attach actions use `{ another: true }` for their "Create & create another" button, which keeps the modal open with a reset form.

### Running an action on top of the modal

An extra footer action with an `action()` function runs on top of the open modal, with the same record. If it has a modal of its own (a confirmation or a form), it opens over the first one, and the first modal stays open when it closes. Its `parentData` is the form state of the parent action; changes made to it are kept:

```ts
import { Action } from '@navette-js/actions';
import { TextInput } from '@navette-js/forms';

Action.make('send')
    .schema([
        TextInput.make('subject'),
        TextInput.make('body'),
    ])
    .extraModalFooterActions([
        Action.make('useTemplate')
            .label('Use the template')
            .color('gray')
            .action(({ parentData }) => {
                parentData!.subject = 'Your order has shipped';
                parentData!.body = 'Hello, ...';
            }),
    ])
    .action(async ({ data }) => {
        // ...
    })
```

The footer action is checked like any action when it is mounted: its visibility and authorization.

If the child action should end its parent too, use `cancelParentActions()`. With deep nesting, pass the name of the parent to cancel, with its children; parents below it stay open:

```ts
import { Action } from '@navette-js/actions';

Action.make('delete')
    .requiresConfirmation()
    .action(async ({ record }) => {
        // ...
    })
    .cancelParentActions()

Action.make('fourth')
    .requiresConfirmation()
    .action(() => {
        // ...
    })
    .cancelParentActions('second')
```

## Accessing information about parent actions from a child

A child action receives `parentAction`, a handle on the action directly below it, and `mountedActions`, the handles of every open action from the first one. `getRawData()` returns the current form state of that action, not validated since it has not been submitted; `getArguments()` returns its arguments:

```ts
import { Action } from '@navette-js/actions';
import { TextInput } from '@navette-js/forms';

Action.make('first')
    .schema([
        TextInput.make('foo'),
    ])
    .extraModalFooterActions([
        Action.make('second')
            .requiresConfirmation()
            .action(({ parentAction, mountedActions }) => {
                console.log(parentAction!.getRawData(), parentAction!.getArguments(), mountedActions![0].getName());
            }),
    ])
```

### Validating the data of a parent action

`getValidatedData()` validates the parent's form with its rules and returns its state. If it is invalid, the errors are shown in the parent's modal and the child action stops. Call it from `mountUsing()` when the child has a modal of its own, so that its modal does not open:

```ts
import { Action } from '@navette-js/actions';

Action.make('second')
    .action(async ({ parentAction }) => {
        const data = await parentAction!.getValidatedData();
        // ...
    })
```

`getValidatedData()` does not run `mutateDataUsing()` nor the form's hooks.

### Filling in the data of a parent action

`fillData()` updates fields of the parent's form. It accepts nested objects or dot-notation keys, ignores keys that are not fields of the form, and leaves validation to the parent's submission:

```ts
import { Action } from '@navette-js/actions';
import { TextInput } from '@navette-js/forms';

Action.make('createInvoice')
    .schema([
        TextInput.make('title').required(),
        TextInput.make('reference').required(),
    ])
    .extraModalFooterActions([
        Action.make('generateReference')
            .schema([TextInput.make('prefix').required()])
            .action(async ({ data, parentAction }) => {
                await parentAction!.fillData({ reference: `${data.prefix}-123` });
            }),
    ])
    .action(async ({ data }) => {
        // `data.reference` is filled in.
    })
```

The older `parentData` object of the context is the same raw state; changes made to it are kept too.

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

An error thrown by `before()` stops the action, but the request fails and the browser displays an error. To stop an action cleanly, call `action.halt()`: the modal stays open, for example after sending a [notification](/notifications/overview). `action.cancel()` stops it and closes the modal:

```ts
import { Action } from '@navette-js/actions';
import { Notification } from '@navette-js/panels';

Action.make('publish')
    .before(({ action, record }) => {
        if (!record.title) {
            Notification.make().warning().title('Add a title before publishing').send();
            action!.halt();
        }
    })
    .action(async ({ record }) => {
        // ...
    })
```

## Closing the modal

The modal closes once the action has run successfully. The user may also close it with the close button, the cancel button, the Escape key or a click outside the modal; nothing is run in that case.

### Disabling closing the modal

```ts
import { Action } from '@navette-js/actions';

Action.make('updateAuthor')
    .closeModalByClickingAway(false)
    .closeModalByEscaping(false)
    .modalCloseButton(false)
```

`modalCloseButton(false)` removes the close button of the header; the cancel button stays.

### Changing the defaults of every modal

To change these defaults for every modal of the application, call the static methods of `ModalComponent` once, when the application starts. They apply to action modals and to the [modal component](/components/modal), unless a modal sets its own value:

```ts
import { ModalComponent } from '@navette-js/support';

ModalComponent.closeButton(false);
ModalComponent.closedByClickingAway(false);
ModalComponent.closedByEscaping(false);
ModalComponent.autofocus(false);
```

An action can still ask for the close button with `modalCloseButton()`, and likewise with `closeModalByClickingAway()`, `closeModalByEscaping()` and `modalAutofocus()`.

### Disabling the unsaved changes alert

When [unsaved changes alerts](/panels/configuration) are enabled for a panel (`unsavedChangesAlerts()`), users are warned before leaving the page while an action modal is open. If a modal cannot contain unsaved changes, disable the warning with `unsavedChangesAlert(false)`:

```ts
import { Action } from '@navette-js/actions';
import { TextEntry } from '@navette-js/infolists';

Action.make('viewAuthor')
    .schema([
        TextEntry.make('name'),
        TextEntry.make('email'),
    ])
    .unsavedChangesAlert(false)
```

`unsavedChangesAlert()` also accepts a function of the context. Actions with a [disabled schema](#disabling-all-form-fields) do not trigger the alert by default.

## Making the modal click-through

By default, a modal blocks interaction with the rest of the page while it is open. With `modalClickThrough()`, the user can keep using the page behind the modal: the backdrop is removed, clicks outside the modal window reach the page, and the page stays scrollable. The modal still closes with its close button or the Escape key:

```ts
import { Action } from '@navette-js/actions';

Action.make('updateAuthor')
    .schema([
        // ...
    ])
    .modalClickThrough()
```

<Aside variant="info">
A click-through modal cannot be closed by clicking away, as that would be incompatible with interacting with the page behind it: `modalClickThrough()` disables it.
</Aside>

## Preventing the modal from autofocusing

By default, modals focus their first focusable element when they open. Disable this with `modalAutofocus(false)`:

```ts
import { Action } from '@navette-js/actions';

Action.make('updateAuthor')
    .modalAutofocus(false)
```

## Overlaying child action modals on top of parent action modals

By default, when a child action opens its modal, the parent's modal is hidden and shown again once the child is dismissed. With `overlayParentActions()` on the child, its modal opens on top of the parent's, which stays visible underneath:

```ts
import { Action } from '@navette-js/actions';
import { Repeater } from '@navette-js/forms';

Action.make('editItems')
    .slideOver()
    .schema([
        Repeater.make('items')
            .schema([
                // ...
            ])
            .deleteAction((action) => action.requiresConfirmation().overlayParentActions()),
    ])
```

## Canceling parent actions when a modal is closed

`cancelParentActions()` only cancels the parents when the child action runs. If the user closes the child's modal instead (Escape, the backdrop or the close button), only that modal closes. To abandon the whole flow when the child's modal is closed, use `cancelParentActionsOnClose()`; like `cancelParentActions()`, it accepts the name of the parent to cancel back to:

```ts
import { Action } from '@navette-js/actions';

Action.make('createPost')
    .schema([
        // ...
    ])
    .extraModalFooterActions([
        Action.make('saveAsDraft')
            .schema([
                // ...
            ])
            .cancelParentActionsOnClose()
            .action(() => {
                // ...
            }),
    ])
```

## Making the modal header and footer sticky

For a long form, `stickyModalHeader()` and `stickyModalFooter()` keep the header and the footer visible while the content scrolls:

```ts
import { Action } from '@navette-js/actions';

Action.make('updateAuthor')
    .schema([
        // ...
    ])
    .stickyModalHeader()
    .stickyModalFooter()
```

## Changing the alignment

`modalAlignment()` aligns the header (`'start'` or `'center'`), and `modalFooterActionsAlignment()` the footer buttons (`'start'`, `'center'` or `'end'`).

## Running code when the modal opens

`mountUsing()` runs when the action is mounted, after the form is filled. `data` is the form state, which you may change:

```ts
import { Action } from '@navette-js/actions';

Action.make('updateAuthor')
    .schema([
        // ...
    ])
    .mountUsing(({ data, record }) => {
        data.author_id = record.author_id ?? currentUserId();
    })
```

## Declaring the modal

Navette decides whether an action has a modal from its configuration: a confirmation, a form, a custom heading, eyebrow, description or content. `modal()` states it explicitly, and `modal(false)` removes the modal of an action that would otherwise have one.

## Hiding the modal

`modalHidden()` runs the action at once, without its modal. It accepts a function of the context, to skip the confirmation for some records:

```ts
import { Action } from '@navette-js/actions';

Action.make('archive')
    .requiresConfirmation()
    .modalHidden(({ record }) => record.is_draft)
```

## Using a wizard as a modal

You may transform the form of the modal into a multistep process with `steps()`. Each step is validated before the next one, and the last step submits the action; the modal then has no footer:

```ts
import { Action } from '@navette-js/actions';
import { Step, Textarea, TextInput, Toggle } from '@navette-js/forms';

Action.make('create')
    .steps([
        Step.make('Name')
            .description('Give the category a unique name')
            .schema([
                TextInput.make('name').required(),
                TextInput.make('slug').required(),
            ]),
        Step.make('Description')
            .schema([
                Textarea.make('description'),
            ]),
        Step.make('Visibility')
            .schema([
                Toggle.make('is_visible'),
            ]),
    ])
    .action(async ({ data }) => {
        // ...
    })
```

The data of every step is validated again when the action is submitted.

`modifyWizardUsing()` changes the wizard built by `steps()`, for example to make its steps skippable:

```ts
import { Action } from '@navette-js/actions';

Action.make('create')
    .steps([
        // ...
    ])
    .modifyWizardUsing((wizard) => wizard.skippable())
```

## Adding extra attributes to the modal window

You can pass extra HTML attributes to the modal window with `extraModalWindowAttributes()`; they are merged onto its outer element (`class` is added to its classes):

```ts
import { Action } from '@navette-js/actions';

Action.make('updateAuthor')
    .extraModalWindowAttributes({ class: 'update-author-modal' })
```

`extraModalWindowAttributes()` also accepts a function of the context. Calling it again replaces the previous attributes; pass `true` as the second argument to merge them instead.

## Adding extra attributes to the modal overlay

`extraModalOverlayAttributes()` does the same for the modal's backdrop:

```ts
import { Action } from '@navette-js/actions';

Action.make('updateAuthor')
    .extraModalOverlayAttributes({ class: 'update-author-overlay' })
```
