---
title: Installation
---

## Introduction

Navette panels are Express applications. You install the packages from npm, describe a panel in TypeScript, and mount it in an Express server with `panelRouter()`.

### Requirements

- Node.js 24 or later. Navette is written in TypeScript and runs `.ts` files directly with Node's built-in type stripping, without a build step.
- A database supported by [Knex](https://knexjs.org): SQLite (included), PostgreSQL, MySQL or SQL Server.

<Aside variant="info">
Node's type stripping only removes type annotations. Code that TypeScript would have to transform — `enum`, `namespace`, constructor parameter properties — is not supported in `.ts` files run this way. Write plain classes and constants instead, or compile your application with `tsc` first.
</Aside>

## Installing the panel builder

Create a project that uses ES modules, then install the panel builder and Express:

```bash
mkdir my-panel && cd my-panel
npm init -y
npm pkg set type=module
npm install @navette-js/panels express
```

`@navette-js/panels` depends on every other Navette package (`@navette-js/forms`, `@navette-js/tables`, `@navette-js/schemas`…), so they are installed with it. SQLite support comes with `@navette-js/database`. For another database, install its Knex driver as well, for example `npm install pg` or `npm install mysql2`.

<Aside variant="warning">
Navette is published as beta releases (`1.0.0-beta.x`). Pin the exact version in your `package.json` and read the release notes before upgrading: the API may change between betas.
</Aside>

## Creating a panel

Create a `server.ts` file. It connects to a database, creates the users table on the first run, describes a panel, and mounts it in Express:

```ts
import express from 'express';
import { sqlite } from '@navette-js/database';
import { AccountWidget, Dashboard, knexAuthProvider, NavetteInfoWidget, Panel, panelRouter } from '@navette-js/panels';
import { WireRuntime } from '@navette-js/wire';

const knex = sqlite('database.sqlite');

if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
        table.increments('id');
        table.string('name');
        table.string('email').unique();
        table.string('password');
        table.timestamp('email_verified_at').nullable();
        table.timestamps();
    });
}

const users = knexAuthProvider((table) => knex(table));

if (!(await users.findByEmail!('admin@example.com'))) {
    await users.create!({ name: 'Admin', email: 'admin@example.com', password: process.env.ADMIN_PASSWORD ?? 'change-me' });
}

const key = process.env.APP_KEY ?? 'change-this-development-key';

const panel = Panel.make()
    .id('admin')
    .key(key)
    .login()
    .pages([Dashboard])
    .widgets([AccountWidget, NavetteInfoWidget])
    .auth(users);

const app = express();
app.use(panelRouter(panel, new WireRuntime({ key })));
app.listen(3000, '127.0.0.1', () => console.log('http://127.0.0.1:3000/login'));
```

Start it:

```bash
ADMIN_PASSWORD=a-long-password node server.ts
```

Open `http://127.0.0.1:3000/login` and sign in with `admin@example.com`. You land on the dashboard, which shows the panel's widgets: here the account widget and the Navette information widget, like Filament's default dashboard.

## Understanding the pieces

- `Panel.make()` describes a panel: its pages, resources, widgets, colors, authentication and options. See [panel configuration](/panels/configuration).
- `.key()` sets the secret that signs session cookies and component snapshots. Use a long random value from your environment in production, and never commit it.
- `.auth()` connects your users. `knexAuthProvider()` reads and writes a `users` table in the same format as Laravel's, and hashes passwords with scrypt. You can also pass your own provider: an object with `attempt(email, password)` and `find(id)`. See [users](/panels/users).
- `WireRuntime` runs the server side of the component protocol: it restores each component from its signed snapshot, applies the browser's updates, calls the requested methods and renders the result. Each panel needs its own runtime.
- `panelRouter()` returns an Express router with everything the panel needs: Filament's CSS and JavaScript, the component endpoint, the login and logout routes, and one route per page.

## Enabling file uploads

File upload fields send files to a temporary store before the form is saved. Give the runtime an `UploadStore`, which keeps temporary files in a directory and signs upload URLs:

```ts
import { UploadStore, WireRuntime } from '@navette-js/wire';

const runtime = new WireRuntime({ key, uploads: new UploadStore('storage/tmp', key) });
```

See [file storage](/advanced/file-storage) for where uploaded files end up and how they are served.

## Next steps

- Build a real screen in [your first panel](/getting-started/your-first-panel).
- Learn how [resources](/resources/overview) turn a table of your database into list, create and edit pages.
- Before going to production, read the [deployment checklist](/advanced/deployment) and the [security notes](/advanced/security).
