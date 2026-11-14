---
title: Other kinds of tests
---

## Introduction

A panel is ordinary TypeScript running on Node.js, so you can test it with the tools of Node.js. Most tests of pages, forms, tables and actions are written with the [testing helpers](/testing/overview), without a browser. This page shows the other levels of tests, from the fastest to the most complete:

1. **Unit tests** of your rules and adapters, without a page.
2. **HTTP tests** of your routes, against the Express application started in the test.
3. **End-to-end tests** in a real browser, with [Playwright](https://playwright.dev), for what runs in the browser.

It ends with how Navette itself is tested, which you may use as a model.

The examples below use `node:test` and `node:assert`; any test framework works.

## Testing authorization

Your authorization rules are plain functions: test them for each role, without a server. A resource can only be checked once it is registered on a panel:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dashboard, Panel } from '@navette-js/panels';
import { TaskResource } from '../resources/TaskResource.ts';

const admin = { id: 1, name: 'Admin', email: 'admin@example.test', role: 'admin' };
const reader = { id: 2, name: 'Reader', email: 'reader@example.test', role: 'reader' };

const panel = Panel.make().id('admin').key('test-key').pages([Dashboard]).resources([TaskResource]);

test('readers cannot create or update tasks', async () => {
    assert.equal(await TaskResource.can('viewAny', reader), true);
    assert.equal(await TaskResource.can('create', reader), false);
    assert.equal(await TaskResource.can('update', reader, { id: 1 }), false);
    assert.equal(await TaskResource.can('update', admin, { id: 1 }), true);

    // The pages follow the same rules.
    assert.equal(await panel.canAccessPage(TaskResource.getPages().create, reader), false);
});
```

`Resource.can()` and `panel.canAccessPage()` go through the [`authorizeUsing()` hook](/resources/authorization#plugging-in-your-own-permission-system) of the panel, then through the policy, exactly like the pages. `panel.resolveInaccessiblePages(user)` returns the slugs of the pages hidden from a user's navigation.

Write at least one test per role. A complete check also covers the interface: the buttons are hidden, the direct URLs answer 403, and forged requests change nothing. The [testing helpers](/testing/resources#testing-authorization) check all three without a browser.

## Testing adapters

The scope of an adapter is your strongest protection: test it against a throwaway database. `sqlite(':memory:')` creates an in-memory SQLite database, and binds your models to it:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sqlite } from '@navette-js/database';

const knex = sqlite(':memory:');
await knex.schema.createTable('tasks', (table) => { table.increments('id'); table.string('title'); table.integer('team_id'); });

test('the adapter only sees the tasks of the team', async () => {
    const [mine] = await knex('tasks').insert({ title: 'Mine', team_id: 1 });
    const [theirs] = await knex('tasks').insert({ title: 'Theirs', team_id: 2 });

    assert.ok(await TaskResource.adapter.find(mine));
    assert.equal(await TaskResource.adapter.find(theirs), null);
    assert.deepEqual(await TaskResource.adapter.keysInScope([mine, theirs]), [String(mine)]);
});
```

Import the resources after creating the connection when your adapters read it at import time. If your application uses migrations, run them on the test database instead of creating the tables by hand.

## Testing pages over HTTP

The testing helpers mount components directly. To test the HTTP layer too (redirects of the router, cookies, your own routes), `panelRouter()` returns an Express router: start your application on a free port in the test, and request its pages with `fetch()`. To act as a user, create a session cookie with `panel.logIn()`, which writes the cookie on an Express response; in a test, give it an object with a `cookie()` method:

```ts
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import express from 'express';
import { panelRouter } from '@navette-js/panels';
import { WireRuntime } from '@navette-js/wire';

const app = express();
app.use(panelRouter(panel, new WireRuntime({ key: 'test-key' })));
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

const sessionCookie = (user) => {
    let cookie = '';
    panel.logIn({ cookie: (name, value) => { cookie = `${name}=${value}`; }, req: {} }, user, false);
    return cookie;
};

test('the create page answers 403 to a reader', async () => {
    const forbidden = await fetch(`${base}/tasks/create`, { headers: { cookie: sessionCookie(reader) }, redirect: 'manual' });
    assert.equal(forbidden.status, 403);

    const guest = await fetch(`${base}/tasks`, { redirect: 'manual' });
    assert.equal(guest.headers.get('location'), '/login');
});
```

For this test, the panel needs a user provider whose `find()` returns the test users.

## End-to-end testing

End-to-end tests drive a real browser through your panel: log in, fill a form, click an action, and check the result in the page and in the database. They are the only way to test what runs in the browser: JavaScript, Alpine behaviour, the layout.

1. Start your application in a separate process, with an environment variable pointing to a **copy** of a known database, and with the `fileMailer()` [mailer](/panels/users#sending-emails) when emails are involved.
2. Wait until the login page answers.
3. Run the journeys with Playwright, then stop the server.

```ts
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${base}/login`);
await page.locator('input[id="form.email"]').fill('admin@example.test');
await page.locator('input[id="form.password"]').fill(process.env.ADMIN_PASSWORD!);
await page.locator('form#form button[type=submit]').click();
await page.waitForURL(`${base}/`);

await page.goto(`${base}/tasks/create`);
await page.locator('input[id="form.title"]').fill('Write the tests');
await page.locator('form#form button[type=submit]').click();
await page.locator('.nv-no-notification', { hasText: 'Created' }).waitFor();

await browser.close();
```

Fields have the id of their state path (`form.title`), forms have the id `form`, and notifications the class `nv-no-notification`. Listen to the `pageerror` event of the page to fail on JavaScript errors.

<Aside variant="danger">
End-to-end tests create and delete records. Never point them at a database you care about: copy a reference database to a temporary file before each run.
</Aside>

## How Navette is tested

Navette's own tests follow the same levels, and are good examples of each:

- **Unit tests**, in `packages/*/test/*.test.ts`, run with `npm test` at the root of the repository: the component runtime (signed state, locked properties, callable methods), the data adapter, tables, forms, authorization, authentication tokens, render hooks, colors and themes. `packages/panels/test/testing.test.ts` exercises the testing helpers themselves.
- **End-to-end journeys** with Playwright, one per screen of the demo application: they start the demo on a copy of the reference database, and check behaviour, security (forged requests, direct URLs per role) and the absence of JavaScript errors. `apps/starter` has a journey of its own, which checks that a read-only account sees no write buttons and gets 403 on direct URLs.
