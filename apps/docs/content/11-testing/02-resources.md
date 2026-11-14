---
title: Testing resources
---

## Introduction

The pages of a resource are tested like any page: mount them with `livewire()`, then fill their forms and call their actions. The examples of this page assume the [setup of the overview](/testing/overview#setting-up-the-tests): a test database, the panel chosen with `setCurrentPanel()`, and a user signed in with `actingAs()`.

```ts
import './setup.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { livewire } from '@navette-js/panels/testing';
import { db } from '../src/database.ts';
import { TaskResource } from '../src/admin/resources/TaskResource.ts';

const pages = TaskResource.getPages();
```

`TaskResource.getPages()` returns the page classes served by the panel: `index`, `create`, `edit` and `view` (when the resource has a view page), plus your `relatedPages`. If you declared your own page classes in `static pages`, you may pass them instead.

## Testing a resource list page

Check that the list page loads, and shows the records, with `assertOk()` and `assertCanSeeTableRecords()`:

```ts
test('the list shows the tasks', async () => {
    const [write] = await db('tasks').insert({ title: 'Write the tests' });
    const [ship] = await db('tasks').insert({ title: 'Ship the release' });

    await livewire(pages.index)
        .assertOk()
        .assertCanSeeTableRecords([write, ship]);
});
```

Records are given by their key, or as record objects. To search, sort and filter the table, see [testing tables](/testing/tables):

```ts
test('the tasks can be searched', async () => {
    const [write] = await db('tasks').insert({ title: 'Write the tests' });
    const [ship] = await db('tasks').insert({ title: 'Ship the release' });

    await livewire(pages.index)
        .searchTable('Write')
        .assertCanSeeTableRecords([write])
        .assertCanNotSeeTableRecords([ship]);
});
```

Bulk actions act on the records you select with `callTableBulkAction()`:

```ts
test('the selected tasks can be deleted', async () => {
    const [first] = await db('tasks').insert({ title: 'Old task' });
    const [second] = await db('tasks').insert({ title: 'Older task' });

    await livewire(pages.index)
        .callTableBulkAction('delete', [first, second])
        .assertNotified()
        .assertCanNotSeeTableRecords([first, second]);

    assert.equal(await db('tasks').whereIn('id', [first, second]).first(), undefined);
});
```

## Testing a resource create page

Fill the form with `fillForm()`, submit it with `call('create')`, then check the result: no validation errors, a notification, a redirect to the new record, and the record in the database:

```ts
test('a task can be created', async () => {
    await livewire(pages.create)
        .fillForm({ title: 'Buy milk', priority: 'low' })
        .call('create')
        .assertHasNoFormErrors()
        .assertNotified()
        .assertRedirect();

    const task = await db('tasks').where('title', 'Buy milk').first();
    assert.equal(task.priority, 'low');
});
```

To test the validation, fill the form with invalid data, and check the rules that fail with `assertHasFormErrors()`. A loop runs the same test for each case:

```ts
for (const [data, errors] of [
    [{ title: '' }, { title: 'required' }],
    [{ title: 'x'.repeat(256) }, { title: 'max' }],
] as const) {
    test(`the form rejects ${JSON.stringify(data)}`, async () => {
        await livewire(pages.create)
            .fillForm({ title: 'Buy milk', ...data })
            .call('create')
            .assertHasFormErrors(errors)
            .assertNotNotified()
            .assertNoRedirect();
    });
}
```

Rules are named as in the [validation](/forms/validation) of the fields: `required`, `max`, `email`, `unique`… A field may also be checked against its exact error message.

## Testing a resource edit page

Mount the edit page with the key of the record. `assertSchemaStateSet()` checks that the form is filled with the record:

```ts
test('the form is filled with the task', async () => {
    const [id] = await db('tasks').insert({ title: 'Write the tests', priority: 'high' });

    await livewire(pages.edit, { record: id })
        .assertOk()
        .assertSchemaStateSet({ title: 'Write the tests', priority: 'high' });
});
```

Then change the form, and save it with `call('save')`:

```ts
test('a task can be renamed', async () => {
    const [id] = await db('tasks').insert({ title: 'Write the tests' });

    await livewire(pages.edit, { record: id })
        .fillForm({ title: 'Write more tests' })
        .call('save')
        .assertHasNoFormErrors()
        .assertNotified();

    assert.equal((await db('tasks').where('id', id).first()).title, 'Write more tests');
});
```

The delete action of the header is called with `callAction()`: see [testing actions](/testing/actions). A key that matches no record gives a 404:

```ts
await livewire(pages.edit, { record: 999 }).assertNotFound();
```

## Testing a resource view page

The view page shows the record in its infolist. Mount it with the key of the record, and check what it shows:

```ts
test('the task is shown', async () => {
    const [id] = await db('tasks').insert({ title: 'Write the tests' });

    await livewire(pages.view, { record: id })
        .assertOk()
        .assertSeeText('Write the tests');
});
```

## Testing relation managers

A relation manager is mounted with the key of its owner record, `ownerRecord`, and its table is tested like the table of a list page:

```ts
import { TestAction } from '@navette-js/panels/testing';
import { CommentsRelationManager } from '../src/admin/resources/CommentsRelationManager.ts';

test('the comments of the post are listed', async () => {
    const [post] = await db('posts').insert({ title: 'Hello' });
    const [mine] = await db('comments').insert({ post_id: post, title: 'First!' });
    const [other] = await db('comments').insert({ post_id: 999, title: 'Elsewhere' });

    await livewire(CommentsRelationManager, { ownerRecord: post })
        .assertCanSeeTableRecords([mine])
        .assertCanNotSeeTableRecords([other])
        .callAction(TestAction.make('create').table(), { title: 'Second' })
        .assertHasNoFormErrors();
});
```

The owner record is locked: a test that changes `ownerRecord` gets a 403, as a forged request would.

## Testing authorization

A page the user may not open answers 403, whether the [policy](/resources/authorization) denies it or the user may not access the panel:

```ts
const reader = { id: 2, name: 'Reader', email: 'reader@example.test' };

test('readers cannot create tasks', async () => {
    await livewire(pages.create, {}, { user: reader }).assertForbidden();
    await livewire(pages.index, {}, { user: reader }).assertActionHidden('create');
});
```

Hidden actions cannot be called either: `callAction()` fails on an action that is not visible, and a request mounting it directly is refused by the server. See [testing actions](/testing/actions#testing-the-visibility-of-actions).
