---
title: Installation
---

## Introduction

The quickest way to start is `npm create navette`: it asks a few questions, creates a ready-to-run project — panels, migrations, an admin account — and installs its dependencies. You can also [install Navette manually](#installing-manually) in an existing Express application.

### Requirements

- Node.js 24 or later. Navette is written in TypeScript and runs `.ts` files directly with Node's built-in type stripping, without a build step.
- A database supported by [Knex](https://knexjs.org): SQLite (no installation needed), PostgreSQL or MySQL.

<Aside variant="info">
Node's type stripping only removes type annotations. Code that TypeScript would have to transform — `enum`, `namespace`, constructor parameter properties — is not supported in `.ts` files run this way. Write plain classes and constants instead.
</Aside>

## Creating a project

Run:

```bash
npm create navette@latest
```

The command asks for:

| Question | Choices | Default |
| --- | --- | --- |
| Project name | a folder name | `my-navette-app` |
| Template | **Starter** (a dashboard with stats, a tasks resource and user management) or **Blank** (an empty admin panel) | Starter |
| User panel | adds a second panel at `/app` with sign-up, password reset, email verification and profile | no |
| Teams | lets users of the `/app` panel create and join teams ([multi-tenancy](/panels/tenancy)) | no |
| Database | SQLite, PostgreSQL, MySQL / MariaDB | SQLite |
| Language | English, Français | English |
| Install the dependencies now | runs `npm install` | yes |
| Admin email address | with SQLite and installation, creates the first admin account and prints its generated password | `admin@example.com` |

Then start the development server, which restarts on every change:

```bash
cd my-navette-app
npm run dev
```

Open `http://127.0.0.1:3000/admin` and sign in with the admin account printed at the end of the installation. Pending migrations run every time the server starts.

With PostgreSQL or MySQL, set `DATABASE_URL` in `.env` first, then create the admin account with `npx navette make:user --admin`.

### Answering the questions with options

Every question has an option, so you can create a project in one command — in a script or a CI job, for example. With `--yes`, or without an interactive terminal, unanswered questions take their default value:

```bash
npm create navette@latest my-app -- --template=blank --user-panel --teams --db=postgres --no-install
```

| Option | Effect |
| --- | --- |
| `--yes` | Never ask: use the options given and the defaults |
| `--template=starter` or `--template=blank` | Choose the template |
| `--user-panel` | Add the `/app` panel |
| `--teams` | Add teams to the `/app` panel |
| `--db=sqlite`, `--db=postgres`, `--db=mysql` | Choose the database |
| `--locale=en` or `--locale=fr` | Language of the interface |
| `--no-install` | Do not run `npm install` |
| `--admin-email=` | Email address of the first admin account |
| `--admin-password=` | Its password (generated when omitted) |
| `--port=` | Port of the development server (`3000`) |

The `--` after the project name passes the options to `create-navette` instead of npm.

## Next steps

- Find your way around the generated files in [project structure](/getting-started/project-structure).
- Generate a resource from a database table with `npx navette make:resource Post --generate`: see the [CLI reference](/getting-started/cli).
- Build a real screen in [your first panel](/getting-started/your-first-panel).
- Before going to production, read the [deployment checklist](/advanced/deployment) and the [security notes](/advanced/security).

## Installing manually

You can also add Navette to an existing Express application. Install the panel builder:

```bash
npm install @navette-js/panels express
```

`@navette-js/panels` depends on every other Navette package (`@navette-js/forms`, `@navette-js/tables`, `@navette-js/schemas`…), so they are installed with it. SQLite support comes with `@navette-js/database`. For another database, install its Knex driver as well, for example `npm install pg` or `npm install mysql2`.

<Aside variant="warning">
Navette is published as beta releases (`1.0.0-beta.x`). Pin the exact version in your `package.json` and read the release notes before upgrading: the API may change between betas.
</Aside>

### Creating a panel

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

Open `http://127.0.0.1:3000/login` and sign in with `admin@example.com`. You land on the dashboard, which shows the panel's widgets: here the account widget and the Navette information widget.

### Understanding the pieces

- `Panel.make()` describes a panel: its pages, resources, widgets, colors, authentication and options. See [panel configuration](/panels/configuration).
- `.key()` sets the secret that signs session cookies and component snapshots. Use a long random value from your environment in production, and never commit it.
- `.auth()` connects your users. `knexAuthProvider()` reads and writes a `users` table in the same format as Laravel's, and hashes passwords with scrypt. You can also pass your own provider: an object with `attempt(email, password)` and `find(id)`. See [users](/panels/users).
- `WireRuntime` runs the server side of the component protocol: it restores each component from its signed snapshot, applies the browser's updates, calls the requested methods and renders the result. Each panel needs its own runtime.
- `panelRouter()` returns an Express router with everything the panel needs: its CSS and JavaScript, the component endpoint, the login and logout routes, and one route per page.

### Enabling file uploads

File upload fields send files to a temporary store before the form is saved. Give the runtime an `UploadStore`, which keeps temporary files in a directory and signs upload URLs:

```ts
import { UploadStore, WireRuntime } from '@navette-js/wire';

const runtime = new WireRuntime({ key, uploads: new UploadStore('storage/tmp', key) });
```

See [file storage](/advanced/file-storage) for where uploaded files end up and how they are served.
