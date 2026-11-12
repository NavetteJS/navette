# Navette

**Admin panels for Node.js — a port of [Filament](https://filamentphp.com).**

Navette brings Filament's way of building admin panels to Node.js and Express: resources with tables, forms and infolists, actions and modals, dashboards and widgets, global search, database notifications, multiple panels, authentication pages and multi-tenancy. The server renders Filament's markup and reuses its CSS and JavaScript, so panels look and behave like Filament — written in TypeScript, without PHP.

> **Beta.** Navette is in `1.0.0-beta`. The API may change between beta releases. Feedback and issues are welcome.

## Packages

| Package | Contents |
|---|---|
| `@navette/panels` | Panels, resources, pages, navigation, authentication, tenancy, widgets |
| `@navette/forms` | Form fields and validation |
| `@navette/tables` | Tables, columns, filters, query builder, summaries, grouping |
| `@navette/infolists` | Read-only entries |
| `@navette/schemas` | Layout components (sections, tabs, grids, wizards…) |
| `@navette/actions` | Actions and modals |
| `@navette/database` | Data adapters (Knex / Objection) |
| `@navette/wire` | Server runtime compatible with the Livewire 3 client |
| `@navette/support` | Colors, icons, views, translations, render hooks |

## Requirements

- Node.js 24 or later
- A database supported by Knex (SQLite, PostgreSQL, MySQL…)

## Installation

```bash
npm install @navette/panels@beta express
```

```ts
import express from 'express';
import { sqlite } from '@navette/database';
import { knexAuthProvider, Panel, panelRouter } from '@navette/panels';
import { WireRuntime } from '@navette/wire';

// A Laravel-style `users` table (id, name, email, password, email_verified_at).
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

See `apps/starter` for a complete minimal dashboard, and the documentation site in `apps/docs`.

## Repository

| Path | |
|---|---|
| `packages/*` | The published packages (TypeScript sources) |
| `apps/starter` | Smallest useful dashboard, used as the getting-started example |
| `apps/demo` | Port of the official Filament demo (shop, HR, projects, blog, a second panel with registration and teams) |
| `apps/docs` | Documentation website |
| `scripts/release.mjs` | Builds the npm packages (`.release/`) |

```bash
npm install
npm test              # unit tests
npm run demo          # http://127.0.0.1:3200/login
```

Publishing is described in `PUBLISHING.md`. Porting notes (in French) are in `NOTES.md`.

## License

MIT — see `LICENSE`. Navette is an independent project, not affiliated with Filament, Livewire or Heroicons; it reuses their MIT-licensed markup, assets and icons, and the Inter font (SIL OFL 1.1). See `THIRD-PARTY-NOTICES.md`.
