# AGENTS.md

Instructions for AI coding agents (and people) contributing to Navette, admin panels for Node.js. Applications built with Navette get their own `AGENTS.md` from `npm create navette`.

## Layout

npm workspaces, Node.js 24 or later. Packages export their TypeScript sources (`src/*.ts`), which Node runs directly: there is no build step in development.

| Path | Contents |
| --- | --- |
| `packages/panels` | Panels, resources, pages, navigation, authentication, tenancy, widgets, testing helpers |
| `packages/forms`, `tables`, `infolists`, `schemas`, `actions` | Form fields, tables, infolist entries, layout components, actions and modals |
| `packages/support` | Colors, icons, EJS views, translations (`data/lang.en-fr.json`), render hooks |
| `packages/database` | Knex / Objection data adapters |
| `packages/wire` | Server-side component runtime and its browser client |
| `packages/cli` | `npx navette`: migrations, users, generators, offline documentation (`navette docs`) |
| `packages/create` | `npm create navette`: project templates (`src/templates.ts`) |
| `packages/*/test` | Unit tests (`node:test`) |
| `apps/demo` | Demo application used by the end-to-end tests (seed database: `apps/demo/database/seed.sqlite`) |
| `apps/starter`, `apps/playground` | Minimal application, and a scratch application |
| `apps/docs` | Documentation site: Markdown in `content/`, rules in `WRITING.md` |
| `e2e` | Browser tests (Playwright) against a copy of the demo database |
| `scripts/release.mjs` | Builds the npm packages into `.release/` (see `PUBLISHING.md`) |

## Commands

```bash
npm install
npm test                                  # every unit test
node --test packages/forms/test/*.test.ts # one package while iterating
npm run demo                              # demo app
cd apps/docs && node build.ts && node check.mjs   # docs site, then its checks: must print "No problems."
cd apps/docs && node server.ts            # serve the built docs on http://127.0.0.1:3300
E2E_PORT=3411 npm run test:e2e -- brands  # one end-to-end spec (npx playwright install chromium once)
node scripts/release.mjs 1.0.0-beta.0 --pack   # release build and archives, publishes nothing
```

## Rules

- English only, everywhere in the repository: code, comments, documentation, commit messages.
- Navette is its own product: CSS classes use the `nv-` prefix, and the documentation describes Navette on its own (third-party works are credited on the credits page and in `THIRD-PARTY-NOTICES.md`). Keep the MIT licenses.
- Comments are short, in English, and only where they help: why, not what.
- Every change comes with tests: unit tests in `packages/*/test`, an end-to-end spec in `e2e/` for browser behaviour. Run `npm test` before committing.
- Documentation changes follow `apps/docs/WRITING.md`; document only what exists in the code. Build and check the docs after editing them.
- Never modify `apps/demo/database/seed.sqlite`: end-to-end tests run on a throwaway copy made by `e2e/run.mjs`. Never point a destructive test at the seed.
- `packages/panels/src/index.ts`, `packages/forms/src/index.ts` and `packages/tables/src/index.ts` are several thousand lines long: search them and read line ranges, and put substantial new code in new files.
- The release build compiles `.d.ts` declarations: do not export anonymous classes with private members.
- Anything coming from the browser is untrusted: validate and authorize on the server, escape output.

## Documentation for agents

The docs site publishes `llms.txt`, `llms-full.txt` and a Markdown version of every page (its URL + `.md`): https://navettejs.github.io/navette/llms.txt. In the repository, after `node apps/docs/build.ts`, `node packages/cli/src/cli.ts docs search <terms>` searches the built pages.
