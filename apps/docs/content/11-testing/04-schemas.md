---
title: Testing schemas
---

## Introduction

Forms and infolists are [schemas](/schemas/overview) of a page: the form of a resource page is the schema named `form`, the infolist of a view page the schema named `infolist`. The helpers of this page fill them and check their fields, components and state.

```ts
import { test } from 'node:test';
import { livewire } from '@navette-js/panels/testing';
import { TaskResource } from '../src/admin/resources/TaskResource.ts';

test('the form validates the title', async () => {
    await livewire(TaskResource.getPages().create)
        .fillForm({ title: '' })
        .call('create')
        .assertHasFormErrors({ title: 'required' });
});
```

Unless you name another schema, the helpers target the form of the [mounted action](/testing/actions), when an action modal is open; otherwise the `form` schema of the page, or its `infolist` schema, or else its `content` schema. Their last argument names another schema: `fillForm({ ... }, 'settings')`.

## Filling a form

`fillForm()` sets the values of the fields, by their name in the schema, like typing in them. Nested fields take a dotted name or a nested object:

```ts
await livewire(TaskResource.getPages().create)
    .fillForm({
        title: 'Write the tests',
        priority: 'high',
        'address.city': 'Paris',
    });
```

Each value goes through the same path as the browser's input: the field updates, and its `live()` and `afterStateUpdated()` behaviour runs. To compute the values from the current state, pass a function receiving it:

```ts
await page.fillForm((state) => ({ title: `${state.title} (copy)` }));
```

A file for a `FileUpload` field is a fake file of `UploadedFile`, uploaded like the browser would before the form is submitted:

```ts
import { UploadedFile } from '@navette-js/panels/testing';

await livewire(DocumentResource.getPages().create)
    .fillForm({
        title: 'Report',
        attachment: UploadedFile.fake().createWithContent('report.csv', 'name,total\nAda,12\n'),
        cover: UploadedFile.fake().image('cover.png', 640, 480),
    })
    .call('create')
    .assertHasNoFormErrors();
```

`UploadedFile.fake().create('large.pdf', 2048)` creates a file of 2,048 kilobytes. The type of an uploaded file is detected from its content, as for real uploads. A list of files fills a `multiple()` field.

For a rich editor or a Markdown editor, generate realistic content with [`RichEditor.fake()`](/forms/rich-editor#generating-fake-rich-content) and [`MarkdownEditor.fake()`](/forms/markdown-editor#generating-fake-markdown). A rich editor's state is a TipTap document, given by `toArray()`:

```ts
import { MarkdownEditor, RichEditor } from '@navette-js/forms';

await livewire(PostResource.getPages().create)
    .fillForm({
        content: await RichEditor.fake({ seed: 1 }).heading().paragraphs(2).toArray(),
        summary: MarkdownEditor.fake({ seed: 1 }).paragraphs().toString(),
    })
    .call('create')
    .assertHasNoFormErrors();
```

## Testing the state of a schema

`assertSchemaStateSet()` checks values of the schema, by their name in it. Fields you do not list are not checked:

```ts
await livewire(TaskResource.getPages().edit, { record: id })
    .assertSchemaStateSet({
        title: 'Write the tests',
        priority: 'high',
    });
```

A function receiving the whole state may return the values to check, or `true` once it has checked the state itself:

```ts
await page.assertSchemaStateSet((state) => ({ slug: slugify(state.title) }));
```

## Testing validation errors

`assertHasFormErrors()` checks that fields of the form have validation errors. Give the names of the fields, or the rule each one fails:

```ts
await livewire(TaskResource.getPages().create)
    .fillForm({ title: '', email: 'not an email' })
    .call('create')
    .assertHasFormErrors(['title'])
    .assertHasFormErrors({ title: 'required', email: 'email' });
```

Rules are named as in the [validation](/forms/validation) of the fields (`required`, `max`, `email`, `unique`…); a rule with a parameter, `max:255`, is matched by its name. A field may also be checked against its exact error message. Without arguments, `assertHasFormErrors()` checks that the form has at least one error.

`assertHasNoFormErrors()` checks that the form has no validation errors, or that the given fields have none:

```ts
await page.fillForm({ title: 'Write the tests' }).call('create').assertHasNoFormErrors();
```

`assertHasErrors()` and `assertHasNoErrors()` do the same for any state path of the component, such as `data.title`.

## Testing that a field exists

`assertFormFieldExists()` checks that the form has a field, by its name. A function may check the field's configuration:

```ts
await livewire(TaskResource.getPages().create)
    .assertFormFieldExists('title')
    .assertFormFieldExists('title', (field) => field.getName() === 'title')
    .assertFormFieldDoesNotExist('secret');
```

## Testing the visibility of a field

`assertFormFieldVisible()` and `assertFormFieldHidden()` check whether a field is shown, with the current state of the form: a field inside a hidden section is hidden too.

```ts
await livewire(TaskResource.getPages().create)
    .assertFormFieldHidden('reminder_at')
    .fillForm({ has_reminder: true })
    .assertFormFieldVisible('reminder_at');
```

## Testing a disabled field

`assertFormFieldEnabled()` and `assertFormFieldDisabled()` check whether a field is disabled:

```ts
await livewire(TaskResource.getPages().edit, { record: id })
    .assertFormFieldDisabled('created_by')
    .assertFormFieldEnabled('title');
```

## Testing other schema components

Layout components and entries are found by their key in the schema, the one given with `key()`: `assertSchemaComponentExists()`, `assertSchemaComponentDoesNotExist()`, `assertSchemaComponentVisible()` and `assertSchemaComponentHidden()`. The key may be the component's own key, or its path in the schema (`'details.address'`):

```ts
await livewire(TaskResource.getPages().view, { record: id })
    .assertSchemaComponentExists('details')
    .assertSchemaComponentHidden('archive-notice');
```

`assertSchemaExists('settings')` checks that the page has a schema with this name.

## Testing wizards

The browser keeps the current step of a [wizard](/schemas/wizards), so the tester keeps it too. `goToNextWizardStep()` clicks "Next": the server validates the current step, and the next one is shown only if it is valid. `goToPreviousWizardStep()` clicks "Back", and `assertWizardCurrentStep()` checks the current step, counted from 1:

```ts
await livewire(TaskResource.getPages().create)
    .goToNextWizardStep()
    .assertHasFormErrors(['title'])
    .assertWizardCurrentStep(1)
    .fillForm({ title: 'Write the tests' })
    .goToNextWizardStep()
    .assertHasNoFormErrors()
    .assertWizardCurrentStep(2);
```

`goToWizardStep(3)` validates step 2 and goes to step 3; `goToWizardStep(1)` goes back to the first step. `assertWizardStepExists()` checks that the wizard has a step. Each method takes the name of the schema as its last argument; by default, it is the form of the mounted action if one is open, otherwise the form of the page.

## Testing repeaters and builders

The items of a [repeater](/forms/repeater) or a [builder](/forms/builder) are kept under random keys. Give them predictable keys in a test with `Repeater.fake()` and `Builder.fake()`: new items are then keyed `0`, `1`, `2`… Each returns a function that restores the random keys:

```ts
import { Repeater } from '@navette-js/forms';

const undoRepeaterFake = Repeater.fake();

await livewire(TaskResource.getPages().create)
    .assertSchemaStateSet({
        checklist: [
            { label: 'Write the tests' },
            { label: 'Run them' },
        ],
    });

undoRepeaterFake();
```

The state assertions (`assertSchemaStateSet()`, `assertFormSet()`, `assertSet()`) treat an object whose keys are `0`, `1`, `2`… in order as a list, so the expected state is written as a list. Pass a function to `assertSchemaStateSet()` to check the number of items:

```ts
await livewire(TaskResource.getPages().edit, { record: task.id })
    .assertSchemaStateSet((state) => Object.keys(state.checklist as object).length === 2);
```
