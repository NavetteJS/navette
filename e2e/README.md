# End-to-end tests

Browser tests (Playwright, Chromium) that drive the demo app (`apps/demo`) and the starter app (`apps/starter`) like a user would, then check the result in the page and in the database.

## Running

```sh
npm install
npx playwright install chromium   # once
npm run test:e2e
```

`e2e/run.mjs` copies `apps/demo/database/seed.sqlite` to `e2e/.tmp/<port>/e2e.sqlite`, starts the demo on that copy on port 3399, runs every `*.e2e.mjs` spec in turn, prints a summary and exits non-zero if anything failed. The starter spec starts its own instance on the next port (3400).

Run one or several specs by name:

```sh
npm run test:e2e -- brands
npm run test:e2e -- orders products
```

Each spec prints one line per step: `✔` passed, `✖` failed, `○` skipped.

## Environment

| Variable | Default | |
| --- | --- | --- |
| `E2E_PORT` | `3399` | Port of the demo instance. |
| `E2E_STARTER_PORT` | `E2E_PORT + 1` | Port of the starter instance. |
| `NAVETTE_STORAGE` | unset | Folder holding the demo's seeded product images. They are not in the repository; without it, the step that loads a seeded image is skipped. |

## Safety

Specs create, change and delete records. They only run against the disposable copy made by `run.mjs`: a spec refuses to start unless the database path it receives ends with `e2e.sqlite`. The seed database is only copied, and your working demo database (`apps/demo/database/database.sqlite`) is never opened. Specs run in order on the same copy, so a spec computes what it expects from the database rather than from fixed numbers.

## Writing a spec

A spec is a plain Node script, `e2e/<name>.e2e.mjs`, called as `node <spec> <baseUrl> <users.json> <database>`. Use the helpers in `support.mjs`: `specArgs()` (arguments and the safety check), `openDatabase()`, `login()` and `reporter()` (`step`, `check`, `skip`).
