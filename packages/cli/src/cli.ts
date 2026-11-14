#!/usr/bin/env node
// Project CLI (`npx navette …`): migrations, users, and generators for resources, pages, widgets, form fields and plugins.
// Run it at the root of a project created with `npm create navette`.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { readSecret } from './secret.ts';
import { generateColumn, generateComponent, generateEntry, generateField, generatePlugin, generateResource, generateMigration, generatePage, generateSchemaComponent, generateJsWidget, generateWidget, studly, tableName, type ColumnInfo } from './generators.ts';

const cwd = process.cwd();
if (existsSync(join(cwd, '.env'))) process.loadEnvFile(join(cwd, '.env'));
const [command, ...rest] = process.argv.slice(2);
const flags: Record<string, string | true> = {};
const positional: string[] = [];
for (const arg of rest) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (match) flags[match[1]] = match[2] ?? true; else positional.push(arg);
}
const flag = (name: string) => (typeof flags[name] === 'string' ? (flags[name] as string) : undefined);
const say = (text = '') => process.stdout.write(text + '\n');
const fail = (text: string): never => { process.stderr.write(`\n  ✖ ${text}\n\n`); process.exit(1); };

/** The project's `src/database.ts` exports `db` (knex) and `migrate()`. */
async function project(): Promise<{ db: any; migrate: () => Promise<string[]> }> {
    const file = join(cwd, 'src', 'database.ts');
    if (!existsSync(file)) fail('No src/database.ts here: run this command at the root of a Navette project (created with `npm create navette`).');
    return import(pathToFileURL(file).href);
}
async function ask(question: string, fallback = ''): Promise<string> {
    if (!process.stdin.isTTY) return fallback;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(`  ${question}${fallback ? ` (${fallback})` : ''}: `)).trim();
    rl.close();
    return answer || fallback;
}
async function askSecret(question: string): Promise<string> {
    return process.stdin.isTTY ? readSecret(`  ${question}: `) : '';
}
/** A password typed twice; empty: `''`, one is generated. */
async function askPassword(): Promise<string> {
    for (;;) {
        const password = await askSecret('Password (at least 8 characters; leave empty to generate one)');
        if (!password) return '';
        if (password.length < 8) { say('  ✖ At least 8 characters: try again.'); continue; }
        if ((await askSecret('Confirm the password')) === password) return password;
        say('  ✖ The passwords do not match: try again.');
    }
}
/** Never overwrites an existing file unless `--force` is given. */
function write(file: string, content: string): void {
    if (existsSync(file) && !flags.force) fail(`${relative(cwd, file)} already exists (use --force to overwrite).`);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
    say(`  ✔ Created ${relative(cwd, file).replaceAll('\\', '/')}`);
}
const panelOf = () => {
    const panel = flag('panel') ?? 'admin';
    if (!/^[a-z][a-z0-9-]*$/.test(panel)) fail(`Invalid panel id: ${panel}`);
    return panel;
};

const commands: Record<string, { usage: string; run: () => Promise<void> }> = {
    migrate: {
        usage: 'navette migrate                                  Run the pending migrations of src/migrations',
        async run() {
            const { migrate, db } = await project();
            const ran = await migrate();
            say(ran.length ? ran.map((name) => `  ✔ Migrated ${name}`).join('\n') : '  Nothing to migrate.');
            await db.destroy();
        },
    },
    'make:migration': {
        usage: 'navette make:migration <name>                    Create a migration file (e.g. create_posts_table)',
        async run() {
            const name = (positional[0] ?? fail('Give the migration a name, e.g. create_posts_table')).replace(/[^a-z0-9_]/gi, '_').toLowerCase();
            const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
            write(join(cwd, 'src', 'migrations', `${stamp}_${name}.ts`), generateMigration(name));
        },
    },
    'make:user': {
        usage: 'navette make:user [--admin] [--name=] [--email=] [--password=]   Create a user (role admin with --admin; the password may also come from NAVETTE_PASSWORD)',
        async run() {
            const { db, migrate } = await project();
            await migrate();
            const name = flag('name') ?? (await ask('Name', 'Admin'));
            const email = flag('email') ?? (await ask('Email address', 'admin@example.com'));
            if (!/^[^\s@]+@[^\s@]+$/.test(email)) fail(`Invalid email address: ${email}`);
            // `--password` is visible to the other users of the machine (process list): prefer NAVETTE_PASSWORD, or typing it.
            let password = flag('password') ?? process.env.NAVETTE_PASSWORD ?? (await askPassword());
            const generated = !password;
            if (generated) password = randomBytes(12).toString('base64url');
            if (password.length < 8) fail('The password must be at least 8 characters.');
            if (await db('users').where('email', email).first()) fail(`A user with the email ${email} already exists.`);
            const { knexAuthProvider } = await import('@navette-js/panels');
            const user = await knexAuthProvider((table: string) => db(table)).create!({ name, email, password });
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await db('users').where('id', user.id).update({ role: flags.admin ? 'admin' : 'user', email_verified_at: now });
            say(`  ✔ ${flags.admin ? 'Admin' : 'User'} ${email} created`);
            if (generated) say(`    Password: ${password}   (generated: copy it now, it is not shown again)`);
            await db.destroy();
        },
    },
    'make:resource': {
        usage: 'navette make:resource <Name> [--panel=admin] [--generate] [--table=]   Create a resource (form and table from the database with --generate)',
        async run() {
            const model = studly((positional[0] ?? fail('Give the resource a name, e.g. Post')).replace(/Resource$/, ''));
            const table = flag('table') ?? tableName(model);
            let columns: ColumnInfo[] | null = null;
            if (flags.generate) {
                const { db, migrate } = await project();
                await migrate();
                if (!(await db.schema.hasTable(table))) fail(`Table "${table}" not found. Create it with a migration first (npx navette make:migration create_${table}_table), or pass --table=.`);
                const info = await db(table).columnInfo();
                columns = Object.entries(info).map(([name, column]: [string, any]) => ({ name, type: String(column.type ?? ''), nullable: column.nullable !== false }));
                await db.destroy();
            }
            const panel = panelOf();
            if (!existsSync(join(cwd, 'src', 'models', `${model}.ts`))) write(join(cwd, 'src', 'models', `${model}.ts`), generateResource(model, table, columns).model);
            write(join(cwd, 'src', panel, 'resources', `${model}Resource.ts`), generateResource(model, table, columns).resource);
            say(`\n  Restart the server: the resource is discovered from src/${panel}/resources.`);
        },
    },
    'make:page': {
        usage: 'navette make:page <Name> [--panel=admin]             Create a custom page',
        async run() {
            const name = studly(positional[0] ?? fail('Give the page a name, e.g. Settings'));
            write(join(cwd, 'src', panelOf(), 'pages', `${name}.ts`), generatePage(name));
        },
    },
    'make:field': {
        usage: 'navette make:field <Name>                        Create a custom form field (src/fields)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the field a name, e.g. RatingInput'));
            write(join(cwd, 'src', 'fields', `${name}.ts`), generateField(name));
        },
    },
    'make:entry': {
        usage: 'navette make:entry <Name>                        Create a custom infolist entry (src/entries)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the entry a name, e.g. AudioPlayerEntry'));
            write(join(cwd, 'src', 'entries', `${name}.ts`), generateEntry(name));
        },
    },
    'make:column': {
        usage: 'navette make:column <Name>                       Create a custom table column (src/columns)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the column a name, e.g. ProgressColumn'));
            write(join(cwd, 'src', 'columns', `${name}.ts`), generateColumn(name));
        },
    },
    'make:schema-component': {
        usage: 'navette make:schema-component <Name>             Create a schema component class (src/schemas/components)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the component a name, e.g. Chart'));
            if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) fail(`Invalid component name: ${positional[0]}`);
            write(join(cwd, 'src', 'schemas', 'components', `${name}.ts`), generateSchemaComponent(name));
            say(`\n  Use it in a schema: ${name}.make().heading('…'), imported from src/schemas/components/${name}.ts.`);
        },
    },
    'make:component': {
        usage: 'navette make:component <name>                    Create a view component, used as <x-name> (src/components)',
        async run() {
            const raw = positional[0] ?? fail('Give the component a name, e.g. stat-card or forms.hint');
            const name = raw.split('.').map((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase().replace(/^-|-$/g, '')).filter(Boolean).join('.');
            if (!name) fail(`Invalid component name: ${raw}`);
            write(join(cwd, 'src', 'components', ...name.split('.')) + '.ejs', generateComponent(name));
            say(`\n  Use it in any view as <x-${name}>…</x-${name}>.`);
        },
    },
    'make:widget': {
        usage: 'navette make:widget <Name> [--panel=admin] [--type=stats|chart|table] [--js]   Create a dashboard widget (--js: rendered by a JavaScript module)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the widget a name, e.g. OrdersChart'));
            const frameworks = ['react', 'vue', 'svelte', 'typescript', 'ts'].filter((option) => flags[option]);
            if (frameworks.length) fail(`--${frameworks[0]} needs a bundler, which Navette does not run: generate a --js widget and import your framework (or your compiled TypeScript) from its renderer module.`);
            if (flags.js && flag('type') && flag('type') !== 'js') fail('--js cannot be combined with --type=stats, chart or table.');
            const type = flags.js ? 'js' : (flag('type') ?? 'stats');
            if (!['stats', 'chart', 'table', 'js'].includes(type)) fail('--type must be stats, chart, table or js.');
            if (type === 'js') {
                const { files, rendererFile } = generateJsWidget(name, panelOf());
                for (const [file, content] of Object.entries(files)) write(join(cwd, ...file.split('/')), content);
                say(`\n  Edit the renderer in ${rendererFile}, then add ${name} to the panel's widgets.`);
                return;
            }
            write(join(cwd, 'src', panelOf(), 'widgets', `${name}.ts`), generateWidget(name, type as 'stats' | 'chart' | 'table'));
        },
    },
    'make:plugin': {
        usage: 'navette make:plugin <Name> [--standalone]           Create a plugin package in plugins/ (a panel plugin, or a schema component with --standalone)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the plugin a name, e.g. Blog'));
            const { id, className, files } = generatePlugin(name, { standalone: flags.standalone === true });
            for (const [file, content] of Object.entries(files)) write(join(cwd, 'plugins', id, ...file.split('/')), content);
            const from = `'../../plugins/${id}/src/index.ts'`;
            say(flags.standalone
                ? `\n  Use it in a schema: import { ${className} } from ${from}; then ${className}.make().content('Hello')`
                : `\n  Add it to a panel (src/panels/admin.ts): import { ${className} } from ${from}; then .plugin(${className}.make())`);
        },
    },
};

if (!command || command === 'help' || command === '--help' || !commands[command]) {
    if (command && command !== 'help' && command !== '--help') say(`\n  Unknown command: ${command}`);
    say('\n  Navette CLI\n');
    for (const { usage } of Object.values(commands)) say(`  ${usage}`);
    const panels = existsSync(join(cwd, 'src')) ? readdirSync(join(cwd, 'src'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(join(cwd, 'src', entry.name, 'resources'))).map((entry) => entry.name) : [];
    if (panels.length) say(`\n  Panels in this project: ${panels.join(', ')}`);
    say('');
    process.exit(command && command !== 'help' && command !== '--help' ? 1 : 0);
}
await commands[command].run();
