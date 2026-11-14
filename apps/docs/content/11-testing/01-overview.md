---
title: Overview
---

## Introduction

The testing helpers of `@navette-js/panels/testing` test your pages, forms, tables and actions without a browser. `livewire()` mounts a page in a real component runtime, then every step of the test (filling a field, clicking an action, sorting the table) is sent to it as the browser would send it. The test sees what a user would see: validation errors, notifications, redirects, the records of the table.

```ts
import { test } from 'node:test';
import { livewire } from '@navette-js/panels/testing';
import admin from '../src/panels/admin.ts';
import { TaskResource } from '../src/admin/resources/TaskResource.ts';

const user = { id: 1, name: 'Ada', email: 'ada@example.test' };

test('a task can be created', async () => {
    await livewire(TaskResource.getPages().create, {}, { panel: admin, user })
        .fillForm({ title: 'Write the tests' })
        .call('create')
        .assertHasNoFormErrors()
        .assertNotified()
        .assertRedirect();
});
```

Failed assertions throw an `AssertionError` of `node:assert`: the helpers work with the test runner of Node.js (`node:test`), and with Vitest or Jest.

Projects created with `npm create navette` come with example tests in `tests/`, and run them with `npm test`.

## Testing guides

- To test the list, create, edit and view pages of a resource, see [testing resources](/testing/resources).
- To search, sort and filter tables, and check their records, columns and summaries, see [testing tables](/testing/tables).
- To fill forms and check fields and their state, see [testing schemas](/testing/schemas).
- To mount and call actions, in the page header, in table rows or in schema components, see [testing actions](/testing/actions).
- To check the notifications sent, see [testing notifications](/testing/notifications).
- To test importers and exporters, see [testing imports](/testing/imports) and [testing exports](/testing/exports).
- For unit tests of your rules and adapters, HTTP tests and end-to-end tests in a browser, see [other kinds of tests](/testing/other-tests).

## Running tests

Node.js 24 runs TypeScript files directly, and includes a test runner. Write your tests in `*.test.ts` files, and run them with:

```bash
node --test "tests/**/*.test.ts"
```

## Setting up the tests

Tests need a database of their own, and settings read by your application modules. Set them in a file that every test file imports first, before the modules of your application:

```ts
// tests/setup.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'navette-test-'));
process.env.DB_CONNECTION = 'sqlite';
process.env.DB_DATABASE = join(directory, 'database.sqlite');
process.env.APP_KEY ??= 'test-key-not-a-secret';
```

Then run your migrations once, and choose the panel and the user of the tests with `setCurrentPanel()` and `actingAs()`:

```ts
import './setup.ts';
import { after, before } from 'node:test';
import { actingAs, setCurrentPanel } from '@navette-js/panels/testing';
import { db, migrate } from '../src/database.ts';
import admin from '../src/panels/admin.ts';

before(async () => {
    await migrate();
    const [id] = await db('users').insert({ name: 'Ada', email: 'ada@example.test', password: '-', role: 'admin' });
    setCurrentPanel(admin);
    actingAs({ id, name: 'Ada', email: 'ada@example.test' });
});
after(() => db.destroy());
```

The test runner of Node.js runs each test file in its own process: with this setup, each file gets an empty database.

## Mounting a component

`livewire(component, params, options)` mounts a component and returns its tester:

- `component` is a page class, a resource page, a relation manager or a widget. The pages of a resource are `TaskResource.getPages().index`, `.create`, `.edit` and `.view`; a page class of your own, declared in `static pages`, works too.
- `params` are the parameters of the page URL, such as `{ record: task.id }` for an edit page. A record object is replaced by its key.
- `options` override the defaults of the tests: `panel`, `user` (`null` to test as a guest), `tenant` in a [multi-tenant panel](/panels/tenancy) (the user's first tenant by default), and `query` for the query string of the URL.

The defaults are set once, usually in the setup file: `setCurrentPanel(panel)` for the panel, `actingAs(user)` for the signed-in user (`null` for a guest), and `setTenant(tenant)` for the tenant of a multi-tenant panel:

```ts
import { actingAs, setCurrentPanel, setTenant } from '@navette-js/panels/testing';

setCurrentPanel(panel);
actingAs(admin);
setTenant(acme);
```

Components rendered [outside a panel](/components/outside-a-panel/form) are tested the same way: pass the panel of their `Livewire` instance, `{ panel: livewire.panel }`.

```ts
await livewire(TaskResource.getPages().edit, { record: task.id }).assertOk();
await livewire(Settings, {}, { user: reader }).assertForbidden();
```

Before mounting a page, the tester checks what the router checks: the user may access the panel, and is a member of the tenant. A relation manager is mounted with its owner, `{ ownerRecord: post.id }`, and loads like in the browser, once visible.

## Chaining steps

Every method of the tester returns the tester, and adds a step to its queue. Nothing runs until you `await` the chain, and the chain stops at the first failed assertion:

```ts
const page = livewire(TaskResource.getPages().create);

await page.fillForm({ title: '' }).call('create').assertHasFormErrors({ title: 'required' });
await page.fillForm({ title: 'Write the tests' }).call('create').assertHasNoFormErrors();
```

To check that a chain fails, give `assert.rejects()` a function that returns it:

```ts
import assert from 'node:assert/strict';

await assert.rejects(() => livewire(TaskResource.getPages().index).assertCanSeeTableRecords([999]));
```

## Testing through the same checks as the browser

Each step is a request to the component, built like the browser builds it: the signed state of the previous response, the changes, and the method calls. The runtime checks them as it checks the browser: the signature of the state, the [locked properties](/advanced/security), and the methods listed in `static callable`. A test cannot reach a method or change a value that the browser could not.

When the runtime refuses a request, the component keeps its previous state, and the tester records the status of the response. Assert it with `assertStatus()`, `assertForbidden()` (403), `assertNotFound()` (404) or `assertUnauthorized()` (401):

```ts
await livewire(TaskResource.getPages().edit, { record: task.id })
    .set('recordKey', String(other.id))
    .assertForbidden()
    .assertSet('recordKey', String(task.id));
```

Any other assertion made after a refused request fails, saying why the request was refused: a test cannot pass because nothing happened. `assertOk()` checks that the component mounted, or that the last request succeeded; `assertSuccessful()` is another name for it.

## Setting state and calling methods

- `set('data.title', 'Hello')` changes a public property, like a field bound to it; `set({ ... })` changes several at once.
- `call('create')` calls a method, like a button. Extra arguments are passed to it: `call('sortTable', 'title', 'desc')`.
- `assertSet('data.title', 'Hello')` and `assertNotSet()` check a value of the state. Instead of a value, you may pass a function receiving the value and returning `true` when it is the expected one.
- `refresh()` renders the component again, and `dispatch('event', { ... })` calls the component's listener of an event.

After the chain has run, `get('data.title')` returns a value of the state, `instance()` the component as it was after the last request, `html()` its last render, and `getEffects()` the effects of the last request (the browser events it dispatched, its redirect, the values returned by the methods it called).

## Testing the rendered HTML

`assertSee()` and `assertDontSee()` check the texts of the rendered component, with HTML entities decoded. `assertSeeText()` and `assertDontSeeText()` only look at the visible text, without the tags and their attributes; `assertSeeHtml()` and `assertDontSeeHtml()` look for raw HTML:

```ts
await livewire(TaskResource.getPages().index)
    .assertSeeText('Write the tests')
    .assertDontSee('Secret task');
```

Each method accepts one text or a list of texts.

### Testing child components

`assertSeeLivewire()` checks that the last render contains a child component, such as a widget or a relation manager, given by its class or by its registered name; `assertDontSeeLivewire()` checks the contrary:

```ts
await livewire(Dashboard)
    .assertSeeLivewire(StatsOverview)
    .assertDontSeeLivewire(RevenueChart);
```

## Testing redirects and events

`assertRedirect()` checks that the last request redirected, to a given URL if you pass one, and `assertNoRedirect()` that it did not. `assertDispatched()` and `assertNotDispatched()` check the browser events dispatched by the last request, optionally with some of their parameters:

```ts
await livewire(Settings)
    .call('save')
    .assertDispatched('settings-saved', { section: 'billing' })
    .assertNoRedirect();
```

Instead of the parameters, you may pass a function receiving the name and the parameters of each event, and returning `true` for the expected one.
