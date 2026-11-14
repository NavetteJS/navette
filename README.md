# Navette

**Admin panels for Node.js.**

Navette builds admin panels on Node.js and Express: resources with tables, forms and infolists, actions and modals, dashboards and widgets, global search, database notifications, multiple panels, authentication pages and multi-tenancy. Pages are rendered on the server and kept interactive by a small Livewire-compatible runtime, all written in TypeScript.

> **Beta.** Navette is in `1.0.0-beta`. The API may change between beta releases. Feedback and issues are welcome.

## Packages

| Package | Contents |
|---|---|
| `@navette-js/panels` | Panels, resources, pages, navigation, authentication, tenancy, widgets |
| `@navette-js/forms` | Form fields and validation |
| `@navette-js/tables` | Tables, columns, filters, query builder, summaries, grouping |
| `@navette-js/infolists` | Read-only entries |
| `@navette-js/schemas` | Layout components (sections, tabs, grids, wizards…) |
| `@navette-js/actions` | Actions and modals |
| `@navette-js/database` | Data adapters (Knex / Objection) |
| `@navette-js/wire` | Server runtime compatible with the Livewire 3 client |
| `@navette-js/support` | Colors, icons, views, translations, render hooks |
| `@navette-js/cli` | Project CLI (`npx navette`): migrations, users, code generators |
| `create-navette` | Project scaffolding (`npm create navette@latest`) |

## Requirements

- Node.js 24 or later (check with `node --version`; get it from [nodejs.org](https://nodejs.org))
- A database supported by Knex (SQLite, PostgreSQL, MySQL…)

## Getting started

Nothing to install beforehand: `npm create` downloads the project generator and runs it.

```bash
npm create navette@latest my-app
cd my-app
npm run dev
```

The generator asks which template you want (starter or blank), whether to add a user panel with sign-up and teams, and which database to use, then creates the project, installs it and creates an admin account. Then generate screens from your tables:

```bash
npx navette make:migration create_posts_table
npx navette make:resource Post --generate
```

## Installing manually

To add Navette to an existing Express application:

```bash
npm install @navette-js/panels@beta express
```

```ts
import express from 'express';
import { sqlite } from '@navette-js/database';
import { knexAuthProvider, Panel, panelRouter } from '@navette-js/panels';
import { WireRuntime } from '@navette-js/wire';

// Expects a `users` table (id, name, email, password, email_verified_at).
const db = sqlite('database.sqlite');

const panel = Panel.make()
    .id('admin')
    .key(process.env.APP_KEY!)
    .login()
    .registration()
    .auth(knexAuthProvider((table) => db(table)));

const app = express();
app.use(panelRouter(panel, new WireRuntime({ key: process.env.APP_KEY! })));
app.listen(3000);
```

See `apps/starter` for a complete minimal dashboard. Documentation: https://navettejs.github.io/navette/ (for AI coding agents: [llms.txt](https://navettejs.github.io/navette/llms.txt), every page as Markdown, and `npx navette docs` offline in a project). Contributors: see `AGENTS.md`.

## Repository

| Path | |
|---|---|
| `packages/*` | The published packages (TypeScript sources) |
| `apps/starter` | Smallest useful dashboard, used as the getting-started example |
| `apps/demo` | Full demo: shop, HR, projects, blog, and a second panel with registration and teams |
| `apps/playground` | Runtime and UI component playground |
| `apps/docs` | Documentation website |
| `scripts/release.mjs` | Builds the npm packages (`.release/`) |

```bash
npm install
npm test              # unit tests
npm run demo          # http://127.0.0.1:3200/login
```

Publishing is described in `PUBLISHING.md`.

## License

MIT — see `LICENSE`. Navette reuses third-party markup, assets, icons and fonts under their own licenses; see `THIRD-PARTY-NOTICES.md`.
