// AGENTS.md and CLAUDE.md of a new project: what an AI coding agent needs to work on it, and where the Navette
// documentation of the installed version is.
import type { ProjectOptions } from './templates.ts';

export const DOCS_URL = 'https://navettejs.github.io/navette';

export function agentFiles(o: ProjectOptions): Record<string, string> {
    const starter = o.template === 'starter';
    const teams = o.userPanel && o.teams;
    const database = o.database === 'sqlite'
        ? 'SQLite, in `database/database.sqlite` (`DB_DATABASE` in `.env`)'
        : `${o.database === 'postgres' ? 'PostgreSQL' : 'MySQL'}, through \`DATABASE_URL\` in \`.env\` (the database must exist before the first start)`;
    const resources = ['`UserResource`', ...(starter ? ['`TaskResource` and the `TaskStats` widget'] : [])].join(', ');
    const rows = [
        ['`src/server.ts`', 'Entry point: runs the migrations, then serves every panel of `src/panels/` with Express'],
        ['`src/panels/admin.ts`', 'The admin panel (`/admin`), for users with the `admin` role'],
        ...(o.userPanel ? [['`src/panels/app.ts`', `The user panel (\`/app\`): sign-up, password reset, email verification, profile${teams ? ', teams (multi-tenancy, records scoped by `team_id`)' : ''}`]] : []),
        ['`src/admin/resources/`, `pages/`, `widgets/`', `Discovered automatically by the admin panel (${resources})`],
        ...(o.userPanel ? [['`src/app/…`', `The same for the user panel${teams && starter ? ' (`NoteResource`, scoped to the current team)' : ''}`]] : []),
        ...(teams ? [['`src/app/tenancy.ts`', 'Team registration and team profile pages']] : []),
        ['`src/users.ts`', 'User provider shared by the panels'],
        ['`src/database.ts`', 'Knex connection (`db`) and `migrate()`'],
        ['`src/models/`', 'Objection models'],
        ['`src/migrations/`', 'Migrations, run in file name order at start-up'],
        ['`tests/`', 'Tests (`node:test`), each file imports `./setup.ts` first'],
        ['`.env`', 'Settings; `APP_KEY` is secret'],
    ];
    const panelFlag = o.userPanel ? ' Add `--panel=app` to generate into the user panel.' : '';

    const agents = `# AGENTS.md

Instructions for AI coding agents working on ${o.appName.replace(/[\r\n]/g, ' ')}, a [Navette](https://github.com/NavetteJS/navette) application: admin panels for Node.js, written in TypeScript and rendered on the server (Express, EJS views, server-side components).

## Commands

- \`npm run dev\`: starts the server on http://127.0.0.1:${o.port} and restarts it when a file changes. Admin panel: \`/admin\`${o.userPanel ? `; user panel: \`/app\`` : ''}.
- \`npm test\`: runs \`tests/**/*.test.ts\` without a browser, on a throwaway SQLite database. Run it after every change.
- \`npx tsc\`: type-checks the project (nothing is emitted).
- \`npx navette migrate\`: runs the pending migrations (the server also runs them when it starts).
- \`npx navette make:user --admin\`: creates an admin user.
- \`npx navette\`: lists every command.

Generators never overwrite a file (add \`--force\` to replace one).${panelFlag}

- \`npx navette make:migration create_posts_table\`: a migration; edit it, then restart or run \`npx navette migrate\`.
- \`npx navette make:resource Post --generate\`: a resource and its model, with a form and a table built from the \`posts\` table.
- \`npx navette make:relation-manager PostResource comments\`: a table of related records on a resource's pages.
- \`npx navette make:page Settings\`, \`npx navette make:widget SalesChart --type=chart\`, \`npx navette make:cluster Settings\`, \`npx navette make:panel <id>\`.
- \`npx navette make:field\`, \`make:entry\`, \`make:column\`, \`make:schema-component\`, \`make:component\`, \`make:plugin\`, \`make:theme\`: custom components.

## Project structure

| Path | Role |
| --- | --- |
${rows.map(([path, role]) => `| ${path} | ${role} |`).join('\n')}

Database: ${database}.

## Conventions

- Node runs the TypeScript sources directly: there is no build step. Use ES modules, and end relative imports with \`.ts\` (\`import { db } from '../database.ts'\`).
- Import Navette from its packages: \`@navette-js/panels\`, \`@navette-js/forms\`, \`@navette-js/tables\`, \`@navette-js/schemas\`, \`@navette-js/infolists\`, \`@navette-js/actions\`, \`@navette-js/support\`, \`@navette-js/database\`, \`@navette-js/wire\`.
- A resource, page or widget is a class in the panel's folder: the panel discovers it, there is nothing to register. Prefer the generators to writing these files by hand.
- Change the database with a new migration; never edit a migration that has already run.
- Authorization is enforced on the server, but custom actions and records need rules: use resource policies and \`authorize()\` on actions (see \`npx navette docs show resources/authorization\`).
- Never commit \`.env\` or print \`APP_KEY\`; document new settings in \`.env.example\`.
- Add or update a test in \`tests/\` for each resource you change (see \`tests/UserResource.test.ts\`).

## Navette documentation

Check every Navette class, method and option in the documentation of the installed version before using it, instead of guessing:

- \`npx navette docs search <terms>\`: ranked pages with matching lines, e.g. \`npx navette docs search select searchable\`.
- \`npx navette docs show <page>\`: prints a page as Markdown, e.g. \`npx navette docs show tables/columns/overview\`; add \`#heading-anchor\` to print one section.
- \`npx navette docs\`: lists every page.
- The same Markdown files are in \`node_modules/@navette-js/cli/docs/\` (\`llms.txt\` is the index, with one-line summaries).
- Online (latest release): ${DOCS_URL}/llms.txt, ${DOCS_URL}/llms-full.txt, and every page as Markdown at its URL + \`.md\` (${DOCS_URL}/tables/columns/overview.md).
- Type declarations: \`node_modules/@navette-js/*/lib/*.d.ts\`.
`;
    const claude = `# CLAUDE.md

The instructions for this project are in [AGENTS.md](AGENTS.md): commands, structure, conventions, and the Navette documentation (\`npx navette docs search <terms>\`).

@AGENTS.md
`;
    return { 'AGENTS.md': agents, 'CLAUDE.md': claude };
}
