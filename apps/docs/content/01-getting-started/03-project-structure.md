---
title: Project structure
---

## Introduction

A project created with `npm create navette` is a small Express application written in TypeScript. Node.js runs the `.ts` files directly: there is no build step. Resources, pages and widgets are **discovered** from folders, so adding a file is enough to add a screen.

With the starter template, a user panel and teams, the project looks like this:

```text
my-app/
├── .env                      settings and secrets (never commit it)
├── .env.example              the same keys, without secrets
├── package.json              scripts: dev, start, test, navette
├── tsconfig.json             editor support and type checking
├── tests/                    tests of the panels, run with npm test
└── src/
    ├── server.ts             starts Express, runs migrations, serves the panels
    ├── database.ts           database connection and migration runner
    ├── migrations/           one file per database change, run at start-up
    ├── models/               Objection.js models (Task.ts, User.ts…)
    ├── components/           view components: <x-name> renders components/name.ejs
    ├── fields/               custom form fields (npx navette make:field)
    ├── entries/              custom infolist entries (npx navette make:entry)
    ├── columns/              custom table columns (npx navette make:column)
    ├── panels/
    │   ├── admin.ts          the admin panel (/admin)
    │   └── app.ts            the user panel (/app), if you chose it
    ├── admin/                discovered by the admin panel
    │   ├── resources/
    │   ├── pages/
    │   └── widgets/
    └── app/                  discovered by the user panel
        ├── resources/
        ├── pages/
        ├── widgets/
        └── tenancy.ts        team registration and team profile pages
```

The blank template has the same layout with only the admin panel: a users resource, a dashboard and no widgets yet.

The `components`, `fields`, `entries` and `columns` folders are created by the [generators](/getting-started/cli) the first time you use them. Fields, entries and columns are classes that you import where you use them; components are EJS files used as tags in your views (see [creating components](/components/creating-components)).

## The server

`src/server.ts` runs the pending migrations, then mounts every panel found in `src/panels`:

```ts
import { discoverPanels, panelRouter } from '@navette-js/panels';
import { UploadStore, WireRuntime } from '@navette-js/wire';

for (const panel of await discoverPanels(new URL('./panels/', import.meta.url))) {
    app.use(panelRouter(panel, new WireRuntime({ key, uploads: new UploadStore('storage/tmp', key) })));
}
```

`discoverPanels()` imports every module of the folder and keeps the panels they export (as their default export). Each panel gets its own `WireRuntime`.

Before that, the server registers `src/components` as the directory of the view components, so that `<x-card>` in a view renders `src/components/card.ejs`:

```ts
import { views } from '@navette-js/support';

views.components(new URL('./components/', import.meta.url));
```

The `package.json` scripts start it:

| Script | Command | Use |
| --- | --- | --- |
| `npm run dev` | `node --env-file=.env --watch src/server.ts` | Development: restarts on every change |
| `npm start` | `node --env-file=.env src/server.ts` | Production |
| `npm test` | `node --test "tests/**/*.test.ts"` | Runs the [tests](/testing/overview), on a throwaway database |
| `npx navette …` | the [Navette CLI](/getting-started/cli) | Migrations, users, generators |

## Panels and discovery

Each file of `src/panels` exports one panel. A panel discovers its resources, pages and widgets in its own folder of `src`, named after its id:

```ts
import { AccountWidget, discoverPages, discoverResources, discoverWidgets, Panel } from '@navette-js/panels';

export default Panel.make()
    .id('admin')
    .path('admin')
    .key(process.env.APP_KEY!)
    .login()
    .resources(await discoverResources(new URL('../admin/resources/', import.meta.url)))
    .pages(await discoverPages(new URL('../admin/pages/', import.meta.url)))
    .widgets([AccountWidget, ...(await discoverWidgets(new URL('../admin/widgets/', import.meta.url)))]);
```

`discoverResources()`, `discoverPages()` and `discoverWidgets()` import every `.ts` and `.js` file of a folder and its sub-folders, in file name order, and keep the resource, page or widget classes they export. Test files (`*.test.ts`, `*.spec.ts`) and type declarations are skipped. You can still register classes by hand: `.resources([PostResource])`.

In the generated admin panel, only users with the `admin` role can sign in. The user panel lets anyone sign up; with teams, every page lives under `/app/<team>`. See [panel configuration](/panels/configuration), [users](/panels/users) and [multi-tenancy](/panels/tenancy).

## The database

`src/database.ts` exports `db`, the Knex connection, and `migrate()`, which runs the migrations of `src/migrations` that have not run yet, in file name order, each in a transaction. Ran migrations are recorded in a `migrations` table.

A migration exports an `up()` function:

```ts
import type { Knex } from '@navette-js/database';

export async function up(db: Knex): Promise<void> {
    await db.schema.createTable('posts', (table) => {
        table.increments('id');
        table.string('title');
        table.text('content').nullable();
        table.timestamps();
    });
}
```

Create one with `npx navette make:migration create_posts_table`. Migrations run when the server starts, or with `npx navette migrate`.

Models are [Objection.js](https://vincit.github.io/objection.js/) classes in `src/models`. Resources read and write them through an `ObjectionAdapter`: see [data adapters](/advanced/data-adapters).

## Settings

`.env` holds the settings, read by `npm run dev` and `npm start`:

| Key | Use |
| --- | --- |
| `APP_NAME` | Brand name shown in the panels |
| `APP_KEY` | Secret that signs sessions and component state. Generated by `npm create navette`; keep it secret and stable |
| `APP_URL` | Public address of the application, used in links sent by email |
| `PORT` | Port of the server |
| `DB_CONNECTION` | `sqlite`, `pgsql` or `mysql` |
| `DB_DATABASE` | SQLite file (`database/database.sqlite`) |
| `DATABASE_URL` | Connection URL for PostgreSQL or MySQL |
| `MAIL_LOG` | File where emails (password reset, email verification) are written in development |

<Aside variant="danger">
`.env` contains `APP_KEY`: anyone who knows it can forge sessions. It is listed in the generated `.gitignore`; never commit it, and use a different key in each environment.
</Aside>

Uploaded files go to `storage/` (temporary files in `storage/tmp`, public files in `storage/public`, served under `/storage`).
