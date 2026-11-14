---
title: Testing actions
---

## Introduction

`callAction()` clicks an action: it mounts it, fills its modal form with the given data, and submits it. An action without a modal runs at once:

```ts
import { test } from 'node:test';
import { livewire } from '@navette-js/panels/testing';
import { TaskResource } from '../src/admin/resources/TaskResource.ts';

test('a task can be deleted from its edit page', async () => {
    await livewire(TaskResource.getPages().edit, { record: id })
        .callAction('delete')
        .assertNotified()
        .assertRedirect();
});
```

An action with a form gets its data as the second argument; its arguments, if any, as the third:

```ts
await livewire(InvoiceResource.getPages().edit, { record: id })
    .callAction('send', { email: 'ada@example.test' }, { copy: true })
    .assertHasNoFormErrors();
```

`callAction()` first checks that the action exists and is visible, and fails otherwise. Then each step is a request to the server, which checks again that the action is visible and enabled for the record.

## Testing actions step by step

`mountAction()` opens an action, like clicking its button; `setActionData()` (or `fillForm()`) fills its modal form; `callMountedAction()` submits it, and `unmountAction()` closes it:

```ts
await livewire(TaskResource.getPages().edit, { record: id })
    .mountAction('assign')
    .assertMountedActionModalSee('Assign the task')
    .setActionData({ user_id: '' })
    .callMountedAction()
    .assertHasActionErrors({ user_id: 'required' })
    .setActionData({ user_id: ada.id })
    .callMountedAction()
    .assertHasNoActionErrors()
    .assertActionNotMounted();
```

`assertMountedActionModalSee()` and `assertMountedActionModalDontSee()` check the texts of the open modal. `assertActionDataSet()` checks the values of its form, like [`assertSchemaStateSet()`](/testing/schemas#testing-the-state-of-a-schema). `assertHasActionErrors()` and `assertHasNoActionErrors()` check its validation errors, like [`assertHasFormErrors()`](/testing/schemas#testing-validation-errors).

## Testing table actions

To designate an action of a table, use a `TestAction`, created with `TestAction.make(name)`:

- `table(record)` for a row action of this record (or of its key);
- `table()` for an action of the table header or toolbar;
- `table().bulk()` for a bulk action, run on the records selected with `selectTableRecords()`.

```ts
import { TestAction } from '@navette-js/panels/testing';

await livewire(TaskResource.getPages().index)
    .callAction(TestAction.make('toggle').table(task))
    .assertNotified('Task updated');

await livewire(TaskResource.getPages().index)
    .selectTableRecords([first, second])
    .callAction(TestAction.make('delete').table().bulk())
    .assertCanNotSeeTableRecords([first, second]);
```

Shorter forms exist for the most common cases: `callTableAction(name, record, data, args)` for a row (or, without a record, header) action, and `callTableBulkAction(name, records, data, args)`, which also selects the records. `mountTableAction()` and `mountTableBulkAction()` only open them.

Selected keys are checked by the server, as the browser's: a key the table cannot show is dropped.

## Testing actions of schema components

Actions in a schema, such as the header actions of a section or the actions of a field, belong to their component. Designate the component by its key with `schemaComponent()`:

```ts
await livewire(TaskResource.getPages().edit, { record: id })
    .callAction(TestAction.make('resetViews').schemaComponent('stats'))
    .assertSchemaStateSet({ views: 0 });
```

The key is relative to the page's form schema; pass the schema name as the second argument for another schema: `schemaComponent('stats', 'infolist')`. For an action of a field of an action modal, the key is relative to the form of that modal.

## Testing nested actions

An action of the footer of a modal is nested in the action that opened the modal. Give the list of actions, from the outer one, or their names joined with dots:

```ts
await livewire(TaskResource.getPages().index)
    .callAction([TestAction.make('publish').table(task), 'preview'])
    .assertNotified('Preview ready');

await livewire(Settings).callAction('rename.suggest');
```

The outer actions are mounted, then the last one is called. When the outer action is already mounted, name only the nested one: `callAction('preview')` runs the footer action of the open modal.

## Testing that an action stopped

An action may stop with `halt()`, leaving its modal open. `assertActionHalted()` checks that the action is still mounted:

```ts
await livewire(TaskResource.getPages().edit, { record: id })
    .callAction('archive', { reason: 'wait' })
    .assertActionHalted('archive');
```

`assertActionMounted()` (the same check) and `assertActionNotMounted()` check which actions are open; without an argument, whether any is. The arguments of a mounted action are checked with `TestAction.make('send').arguments({ copy: true })`, or with a function receiving them.

## Testing that an action exists

`assertActionExists()` checks that an action exists, optionally with a function checking its configuration, and `assertActionDoesNotExist()` the contrary:

```ts
await livewire(TaskResource.getPages().edit, { record: id })
    .assertActionExists('delete')
    .assertActionExists('delete', (action) => action.getColor() === 'danger')
    .assertActionDoesNotExist('publish');
```

The function may be asynchronous, and receives the action and its context (with the mount `arguments` of a `TestAction`). The modal getters evaluate the action's functions with that context: `getModalHeading()`, `getModalDescription()`, `getModalEyebrow()` and `getModalSubmitActionLabel()` (asynchronous), `getModalCancelActionLabel()`, `getModalIcon()`, `getModalIconColor()`, `getModalWidth()`, `getModalAlignment()`, `getModalFooterActionsAlignment()`, `isModalSlideOver()`, `isConfirmationRequired()` and `hasModalSubmitAction()`:

```ts
await livewire(InvoiceResource.getPages().edit, { record: id })
    .assertActionExists('send', async (action) => (await action.getModalDescription()) === "This will send an email to the customer's primary address, with the invoice attached as a PDF");
```

Instead of a name, you can pass an action class: its default name is used (`TestAction.make(SendInvoiceAction)`, `assertActionExists(EditAction)`). Every prebuilt action has one (`EditAction.getDefaultName()` is `'edit'`); see [custom action classes](/actions/overview#creating-a-custom-action-class).

## Testing the visibility of actions

`assertActionVisible()` and `assertActionHidden()` check whether an action is shown, with its [authorization](/resources/authorization); `assertActionEnabled()` and `assertActionDisabled()` whether it can be clicked:

```ts
await livewire(TaskResource.getPages().edit, { record: id }, { user: reader })
    .assertActionHidden('delete')
    .assertActionDisabled('archive');

await livewire(TaskResource.getPages().index)
    .assertActionVisible(TestAction.make('toggle').table(task))
    .assertTableActionHidden('reopen', task);
```

A hidden or disabled action is refused by the server too. A test sending the request directly gets a 403:

```ts
await livewire(TaskResource.getPages().index, {}, { user: reader })
    .call('mountAction', 'delete', {}, { table: true, recordKey: String(task.id) })
    .assertForbidden();
```

## Testing the appearance of actions

`assertActionHasLabel()`, `assertActionHasIcon()`, `assertActionHasColor()` and `assertActionHasUrl()` check how an action looks, and `assertActionDoesNotHaveLabel()`, `assertActionDoesNotHaveIcon()`, `assertActionDoesNotHaveColor()` and `assertActionDoesNotHaveUrl()` the contrary. `assertActionShouldOpenUrlInNewTab()` and `assertActionShouldNotOpenUrlInNewTab()` check where a link action opens:

```ts
await livewire(TaskResource.getPages().edit, { record: id })
    .assertActionHasLabel('delete', 'Delete')
    .assertActionHasIcon('archive', 'o-archive-box')
    .assertActionHasColor('delete', 'danger')
    .assertActionHasUrl('help', 'https://example.test/help')
    .assertActionShouldOpenUrlInNewTab('help');
```

## Testing the modal of an action

`assertMountedActionModalSee()` and `assertMountedActionModalDontSee()` check the texts of the modal of the mounted action, with HTML entities decoded. `assertMountedActionModalSeeHtml()` and `assertMountedActionModalDontSeeHtml()` look for raw HTML:

```ts
await livewire(TaskResource.getPages().edit, { record: task.id })
    .mountAction('delete')
    .assertMountedActionModalSee('Delete this task?')
    .assertMountedActionModalSeeHtml('<strong>cannot be undone</strong>');
```

## Older method names

These names are kept so that older tests still run:

| Name | Same as |
| --- | --- |
| `assertActionHeld()` | `assertActionHalted()` |
| `setActionData()` | `fillForm()` on the form of the mounted action |
| `assertActionDataSet()` | `assertSchemaStateSet()` on the form of the mounted action |
| `assertHasActionErrors()`, `assertHasNoActionErrors()` | `assertHasFormErrors()`, `assertHasNoFormErrors()` |
| `mountTableAction()`, `callTableAction()` | `mountAction()`, `callAction()` with `TestAction.make(name).table(record)` |
| `mountTableBulkAction()`, `callTableBulkAction()` | `selectTableRecords()`, then the bulk action |
| `callMountedTableAction()` | `callMountedAction()` |
| `assertTableActionExists()`, `assertTableActionDoesNotExist()`, `assertTableActionVisible()`, `assertTableActionHidden()`, `assertTableActionEnabled()`, `assertTableActionDisabled()` | The action assertions with `TestAction.make(name).table(record)` |
| `assertTableBulkActionExists()`, `assertTableBulkActionDoesNotExist()`, `assertTableBulkActionVisible()`, `assertTableBulkActionHidden()` | The action assertions with `TestAction.make(name).table().bulk()` |
| `assertFormFieldIsVisible()`, `assertFormFieldIsHidden()`, `assertFormFieldIsEnabled()`, `assertFormFieldIsDisabled()` | `assertFormFieldVisible()`, `assertFormFieldHidden()`, `assertFormFieldEnabled()`, `assertFormFieldDisabled()` |
| `assertFormComponentExists()` | `assertSchemaComponentExists()` |
| `assertTableActionsExistInOrder()` | `assertTableRecordActionsExistInOrder()` |
