#!/usr/bin/env node
// Project CLI (`npx navette …`): migrations, users, and generators for panels, clusters, resources, relation managers, pages,
// widgets, themes, form fields and plugins. Run it at the root of a project created with `npm create navette`.
// A project may change any generated file in `navette.generators.ts` (see `applyGeneratorOverrides()`).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { readSecret } from './secret.ts';
import { generateColumn, generateComponent, generateEntry, generateField, generateLivewireForm, generateLivewireTable, generatePlugin, kebab, generateResource, generateMigration, generatePage, generateSchemaComponent, generateJsWidget, generateWidget, studly, tableName, type ColumnInfo } from './generators.ts';
import { generateCluster, generatePanel, generateRelationManager, generateResourcePage, generateResourceWidget, generateTheme, RESOURCE_PAGE_TYPES, type GeneratedFiles, type ResourcePageType } from './panel-generators.ts';
import { applyGeneratorOverrides } from './overrides.ts';

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
/** Asks for the password twice; returns `''` when left empty (a password is then generated). */
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
/** Writes generated files, after the project's `navette.generators.ts` had a chance to change them. */
async function emit(generator: string, files: GeneratedFiles, context: Record<string, unknown> = {}): Promise<void> {
    for (const [file, content] of Object.entries(await applyGeneratorOverrides(cwd, generator, files, context))) write(join(cwd, ...file.split('/')), content);
}
const resourceOf = (value: string | undefined) => {
    const name = studly((value ?? fail('Give the resource, e.g. --resource=PostResource')).replace(/Resource$/, '')) + 'Resource';
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) fail(`Invalid resource name: ${value}`);
    return name;
};
/** Columns of a database table (`--generate`), after running the pending migrations. */
async function databaseColumns(table: string): Promise<ColumnInfo[]> {
    const { db, migrate } = await project();
    await migrate();
    if (!(await db.schema.hasTable(table))) fail(`Table "${table}" not found. Create it with a migration first (npx navette make:migration create_${table}_table), or pass --table=.`);
    const info = await db(table).columnInfo();
    await db.destroy();
    return Object.entries(info).map(([name, column]: [string, any]) => ({ name, type: String(column.type ?? ''), nullable: column.nullable !== false }));
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
            await emit('migration', { [`src/migrations/${stamp}_${name}.ts`]: generateMigration(name) }, { name });
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
        usage: 'navette make:resource <Name> [--panel=admin] [--generate] [--table=] [--simple] [--view] [--soft-deletes] [--nested=ParentResource]   Create a resource (form and table from the database with --generate)',
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
            const nested = typeof flags.nested === 'string' ? resourceOf(flags.nested) : flags.nested === true ? fail('Give the parent resource: --nested=CourseResource') : null;
            const options = { simple: flags.simple === true, view: flags.view === true, softDeletes: flags['soft-deletes'] === true, nested };
            const generated = generateResource(model, table, columns, options);
            const files: GeneratedFiles = { [`src/${panel}/resources/${model}Resource.ts`]: generated.resource };
            if (!existsSync(join(cwd, 'src', 'models', `${model}.ts`))) files[`src/models/${model}.ts`] = generated.model;
            await emit('resource', files, { model, table, panel, columns, ...options });
            if (options.softDeletes && columns && !columns.some((column) => column.name === 'deleted_at')) say(`\n  The table has no deleted_at column: add one with a migration (table.timestamp('deleted_at').nullable()).`);
            if (nested) say(`\n  List its records in ${nested} with a relation manager: npx navette make:relation-manager ${nested} ${tableName(model).replace(/_(.)/g, (_m, c) => c.toUpperCase())} --related-resource=${model}Resource`);
            say(`\n  Restart the server: the resource is discovered from src/${panel}/resources.`);
        },
    },
    'make:livewire-form': {
        usage: 'navette make:livewire-form <Name> [Model] [--edit] [--generate] [--table=]   Create a component with a form, outside any panel (src/livewire)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the component a name, e.g. CreatePost'));
            const model = positional[1] ? studly(positional[1]) : null;
            if (flags.edit && !model) fail('--edit needs a model: navette make:livewire-form EditPost Post --edit');
            const columns = model && flags.generate ? await databaseColumns(flag('table') ?? tableName(model)) : null;
            const { component, view } = generateLivewireForm(name, model, columns, { edit: flags.edit === true });
            write(join(cwd, 'src', 'livewire', `${name}.ts`), component);
            write(join(cwd, 'src', 'livewire', `${kebab(name)}.ejs`), view);
            say(`\n  Register it with livewire.components([${name}]) and serve it: see "Rendering a form outside a panel" in the documentation.`);
        },
    },
    'make:livewire-table': {
        usage: 'navette make:livewire-table <Name> [Model] [--generate] [--table=]   Create a component with a table, outside any panel (src/livewire)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the component a name, e.g. ListProducts'));
            const model = positional[1] ? studly(positional[1]) : null;
            const columns = model && flags.generate ? await databaseColumns(flag('table') ?? tableName(model)) : null;
            write(join(cwd, 'src', 'livewire', `${name}.ts`), generateLivewireTable(name, model, columns).component);
            say(`\n  Register it with livewire.components([${name}]) and serve it: see "Rendering a table outside a panel" in the documentation.`);
        },
    },
    'make:page': {
        usage: `navette make:page <Name> [--panel=admin] [--resource=PostResource --type=${RESOURCE_PAGE_TYPES.join('|')}] [--relationship=]   Create a custom page, or a page of a resource`,
        async run() {
            const name = studly(positional[0] ?? fail('Give the page a name, e.g. Settings'));
            const panel = panelOf();
            if (!flags.resource) return emit('page', { [`src/${panel}/pages/${name}.ts`]: generatePage(name) }, { name, panel });
            const resource = resourceOf(flag('resource'));
            const type = (flag('type') ?? 'ManageRelatedRecords') as ResourcePageType;
            if (!RESOURCE_PAGE_TYPES.includes(type)) fail(`--type must be one of ${RESOURCE_PAGE_TYPES.join(', ')}.`);
            const page = generateResourcePage(name, resource, type, { panel, relationship: flag('relationship'), model: flag('model') });
            await emit('resource-page', page.files, { name, resource, type, panel });
            say(`\n  Register it in ${resource}: ${page.register}`);
        },
    },
    'make:panel': {
        usage: 'navette make:panel <id>                          Create a panel (src/panels/<id>.ts, served at /<id>) and its folders',
        async run() {
            const id = (positional[0] ?? fail('Give the panel an id, e.g. app')).toLowerCase();
            if (!/^[a-z][a-z0-9-]*$/.test(id)) fail(`Invalid panel id: ${id} (lowercase letters, digits and dashes)`);
            await emit('panel', generatePanel(id, { usersModule: existsSync(join(cwd, 'src', 'users.ts')) }), { id });
            say(`\n  Restart the server: the panel is discovered from src/panels and served at /${id}.`);
        },
    },
    'make:cluster': {
        usage: 'navette make:cluster <Name> [--panel=admin]          Create a cluster gathering pages and resources under one menu item',
        async run() {
            const name = studly(positional[0] ?? fail('Give the cluster a name, e.g. Settings')).replace(/Cluster$/, '');
            const panel = panelOf();
            await emit('cluster', generateCluster(name, panel), { name, panel });
            say(`\n  Add \`static cluster = ${name}Cluster\` to the pages and resources of the cluster (import it from src/${panel}/clusters/${name}Cluster.ts).`);
        },
    },
    'make:relation-manager': {
        usage: 'navette make:relation-manager <Resource> <relationship> [titleAttribute] [--panel=admin] [--model=] [--foreign-key=] [--attach [--pivot-table=]] [--associate] [--soft-deletes] [--view] [--related-resource=]   Create a relation manager',
        async run() {
            const resource = resourceOf(positional[0]);
            const relationship = positional[1] ?? fail('Give the relationship, e.g. posts');
            if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(relationship)) fail(`Invalid relationship name: ${relationship}`);
            const titleAttribute = positional[2] ?? 'name';
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(titleAttribute)) fail(`Invalid title attribute: ${titleAttribute}`);
            const panel = panelOf();
            const options = { panel, model: flag('model'), foreignKey: flag('foreign-key'), attach: flags.attach === true, pivotTable: flag('pivot-table'), associate: flags.associate === true, softDeletes: flags['soft-deletes'] === true, view: flags.view === true, relatedResource: flag('related-resource') ? resourceOf(flag('related-resource')) : undefined };
            const manager = generateRelationManager(resource, relationship, titleAttribute, options);
            await emit('relation-manager', manager.files, { resource, relationship, titleAttribute, ...options });
            say(`\n  Register it in ${resource}: static relations = [${manager.className}] (import it from ${manager.file}).`);
        },
    },
    'make:theme': {
        usage: 'navette make:theme [--panel=admin]                  Create a Tailwind theme for a panel, and the npm script compiling it',
        async run() {
            const panel = panelOf();
            const theme = generateTheme(panel);
            await emit('theme', theme.files, { panel });
            // The compile script is added to package.json (an existing script of the same name is kept).
            const manifestFile = join(cwd, 'package.json');
            if (existsSync(manifestFile)) {
                const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
                manifest.scripts ??= {};
                if (!manifest.scripts[theme.script.name]) { manifest.scripts[theme.script.name] = theme.script.command; writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n'); say(`  ✔ Added the "${theme.script.name}" script to package.json`); }
            }
            say(`\n  1. Install Tailwind: npm install -D tailwindcss @tailwindcss/cli`);
            say(`  2. Compile the theme: npm run ${theme.script.name}   (again whenever you use new Tailwind classes)`);
            say(`  3. Use it in src/panels/${panel}.ts: .theme('${theme.url}')`);
        },
    },
    'make:field': {
        usage: 'navette make:field <Name>                        Create a custom form field (src/fields)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the field a name, e.g. RatingInput'));
            await emit('field', { [`src/fields/${name}.ts`]: generateField(name) }, { name });
        },
    },
    'make:entry': {
        usage: 'navette make:entry <Name>                        Create a custom infolist entry (src/entries)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the entry a name, e.g. AudioPlayerEntry'));
            await emit('entry', { [`src/entries/${name}.ts`]: generateEntry(name) }, { name });
        },
    },
    'make:column': {
        usage: 'navette make:column <Name>                       Create a custom table column (src/columns)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the column a name, e.g. ProgressColumn'));
            await emit('column', { [`src/columns/${name}.ts`]: generateColumn(name) }, { name });
        },
    },
    'make:schema-component': {
        usage: 'navette make:schema-component <Name>             Create a schema component class (src/schemas/components)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the component a name, e.g. Chart'));
            if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) fail(`Invalid component name: ${positional[0]}`);
            await emit('schema-component', { [`src/schemas/components/${name}.ts`]: generateSchemaComponent(name) }, { name });
            say(`\n  Use it in a schema: ${name}.make().heading('…'), imported from src/schemas/components/${name}.ts.`);
        },
    },
    'make:component': {
        usage: 'navette make:component <name>                    Create a view component, used as <x-name> (src/components)',
        async run() {
            const raw = positional[0] ?? fail('Give the component a name, e.g. stat-card or forms.hint');
            const name = raw.split('.').map((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase().replace(/^-|-$/g, '')).filter(Boolean).join('.');
            if (!name) fail(`Invalid component name: ${raw}`);
            await emit('component', { [`src/components/${name.split('.').join('/')}.ejs`]: generateComponent(name) }, { name });
            say(`\n  Use it in any view as <x-${name}>…</x-${name}>.`);
        },
    },
    'make:widget': {
        usage: 'navette make:widget <Name> [--panel=admin] [--type=stats|chart|table] [--js] [--resource=PostResource]   Create a dashboard widget (--js: rendered by a JavaScript module), or a widget of a resource',
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
            const panel = panelOf();
            if (!flags.resource) return emit('widget', { [`src/${panel}/widgets/${name}.ts`]: generateWidget(name, type as 'stats' | 'chart' | 'table') }, { name, type, panel });
            const resource = resourceOf(flag('resource'));
            const widget = generateResourceWidget(name, resource, type as 'stats' | 'chart' | 'table', { panel });
            await emit('resource-widget', widget.files, { name, type, resource, panel });
            say(`\n  Register it in ${resource}: static widgets = [${name}] and static headerWidgets = [${name}] (above the list).`);
        },
    },
    docs: {
        usage: 'navette docs [search <terms> | show <page>[#heading]] [--descriptions]   List, search or print the documentation pages of the installed version (offline Markdown)',
        async run() {
            const { docsDirectory, formatList, formatResults, loadDocs, resolvePage, searchDocs, showPage } = await import('./docs.ts');
            const dir = docsDirectory() ?? fail('No documentation found: it ships with @navette-js/cli (in the repository, run `node apps/docs/build.ts` first, or set NAVETTE_DOCS_DIR).');
            const docs = loadDocs(dir);
            const [action, ...args] = positional;
            if (!action || action === 'list') return say(formatList(docs, { descriptions: flags.descriptions === true }));
            if (action === 'search') {
                const query = args.join(' ').trim() || fail('Give search terms, e.g. npx navette docs search select options');
                return say(formatResults(searchDocs(docs, query, { limit: Number(flag('limit') ?? 10) || 10 }), query));
            }
            if (action !== 'show') fail(`Unknown docs command: ${action}. Use: npx navette docs, docs search <terms>, docs show <page>`);
            const reference = args.join(' ') || fail('Give a page, e.g. npx navette docs show tables/columns/overview');
            const { page, anchor, candidates } = resolvePage(docs, reference);
            if (!page) fail(`No page "${reference}".${candidates.length ? ` Did you mean: ${candidates.slice(0, 8).map((entry) => entry.path).join(', ')}?` : ' List the pages with: npx navette docs'}`);
            const markdown = showPage(docs, page!, anchor) ?? fail(`No heading "#${anchor}" in ${page!.path}.`);
            process.stdout.write(markdown);
        },
    },
    'make:plugin': {
        usage: 'navette make:plugin <Name> [--standalone]           Create a plugin package in plugins/ (a panel plugin, or a schema component with --standalone)',
        async run() {
            const name = studly(positional[0] ?? fail('Give the plugin a name, e.g. Blog'));
            const { id, className, files } = generatePlugin(name, { standalone: flags.standalone === true });
            await emit('plugin', Object.fromEntries(Object.entries(files).map(([file, content]) => [`plugins/${id}/${file}`, content])), { id, className, standalone: flags.standalone === true });
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
