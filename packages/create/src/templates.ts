// Files of a new Navette project, built from the `npm create navette` answers.
// The generated code doubles as an example: each file has a single, clear role.
import { randomBytes } from 'node:crypto';

export type ProjectOptions = {
    /** Folder and package name. */
    name: string;
    /** Name shown in the panel. */
    appName: string;
    template: 'blank' | 'starter';
    /** Second panel (`/app`) for users: sign-up, password reset, email verification, profile. */
    userPanel: boolean;
    /** Teams (multi-tenancy) in the `/app` panel. */
    teams: boolean;
    database: 'sqlite' | 'postgres' | 'mysql';
    locale: 'en' | 'fr';
    /** Version range of the @navette-js packages to install. */
    version: string;
    port: number;
};

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

export function projectFiles(o: ProjectOptions): Record<string, string> {
    const files: Record<string, string> = {};
    const starter = o.template === 'starter';
    const teams = o.userPanel && o.teams;
    const sqlite = o.database === 'sqlite';
    const navette = (name: string) => [`@navette-js/${name}`, o.version];

    // ------------------------------------------------------------------ root
    files['package.json'] = json({
        name: o.name, private: true, type: 'module',
        scripts: { dev: 'node --env-file=.env --watch src/server.ts', start: 'node --env-file=.env src/server.ts', navette: 'navette' },
        engines: { node: '>=24' },
        dependencies: Object.fromEntries([
            ...['actions', 'database', 'forms', 'infolists', 'panels', 'schemas', 'support', 'tables', 'wire'].map(navette),
            ['express', '^5.1.0'],
            ...(o.database === 'postgres' ? [['pg', '^8.13.0']] : o.database === 'mysql' ? [['mysql2', '^3.11.0']] : []),
        ]),
        devDependencies: Object.fromEntries([navette('cli'), ['@types/express', '^5.0.0'], ['@types/node', '^24.0.0'], ['typescript', '^5.9.0']]),
    });
    files['tsconfig.json'] = json({
        // For your editor and `npx tsc`: Node runs the TypeScript sources directly, nothing is compiled.
        compilerOptions: { target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext', allowImportingTsExtensions: true, noEmit: true, strict: false, skipLibCheck: true, types: ['node'] },
        include: ['src'],
    });
    const env = (key: string) => [
        `APP_NAME="${o.appName.replace(/"/g, '')}"`,
        `APP_KEY=${key}`,
        `APP_URL=http://127.0.0.1:${o.port}`,
        `PORT=${o.port}`,
        '',
        sqlite ? 'DB_CONNECTION=sqlite' : `DB_CONNECTION=${o.database === 'postgres' ? 'pgsql' : 'mysql'}`,
        sqlite ? 'DB_DATABASE=database/database.sqlite' : `DATABASE_URL=${o.database === 'postgres' ? 'postgres://user:password@127.0.0.1:5432/' : 'mysql://user:password@127.0.0.1:3306/'}${o.name.replace(/[^a-z0-9_]/gi, '_')}`,
        '',
        '# E-mails (password reset, email verification) are written to this file in development.',
        'MAIL_LOG=storage/mail.log',
        '',
    ].join('\n');
    files['.env'] = env(randomBytes(32).toString('base64url'));
    files['.env.example'] = env('');
    files['.gitignore'] = ['node_modules/', '.env', 'database/*.sqlite*', 'storage/', ''].join('\n');

    // ------------------------------------------------------------------ database
    files['src/database.ts'] = `// Database connection and migrations.
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createConnection, sqlite, type Knex } from '@navette-js/database';

function connect(): Knex {
    const connection = process.env.DB_CONNECTION ?? 'sqlite';
    if (connection === 'sqlite') {
        const file = process.env.DB_DATABASE ?? 'database/database.sqlite';
        mkdirSync(dirname(file), { recursive: true });
        return sqlite(file);
    }
    return createConnection({ client: connection === 'mysql' ? 'mysql2' : 'pg', connection: process.env.DATABASE_URL });
}

export const db = connect();

/** Runs the migrations of \`src/migrations\` that have not run yet, in file name order. Called when the server starts. */
export async function migrate(): Promise<string[]> {
    if (!(await db.schema.hasTable('migrations'))) {
        await db.schema.createTable('migrations', (table) => {
            table.increments('id');
            table.string('name').unique();
            table.integer('batch');
            table.timestamp('ran_at');
        });
    }
    const done = new Set((await db('migrations').select('name')).map((row: { name: string }) => row.name));
    const directory = fileURLToPath(new URL('./migrations/', import.meta.url));
    const batch = Number((await db('migrations').max({ batch: 'batch' }).first())?.batch ?? 0) + 1;
    const ran: string[] = [];
    for (const file of readdirSync(directory).filter((name) => /\\.(m?ts|m?js)$/.test(name)).sort()) {
        const name = file.replace(/\\.(m?ts|m?js)$/, '');
        if (done.has(name)) continue;
        const migration = await import(pathToFileURL(directory + file).href);
        await db.transaction(async (trx) => {
            await migration.up(trx);
            await trx('migrations').insert({ name, batch, ran_at: new Date() });
        });
        ran.push(name);
    }
    return ran;
}
`;
    files['src/migrations/0001_create_users_table.ts'] = `import type { Knex } from '@navette-js/database';

export async function up(db: Knex): Promise<void> {
    await db.schema.createTable('users', (table) => {
        table.increments('id');
        table.string('name');
        table.string('email').unique();
        table.string('password');
        // \`admin\` users can sign in to the admin panel.
        table.string('role').defaultTo('user');
        table.timestamp('email_verified_at').nullable();
        table.timestamps();
    });
}
`;
    files['src/migrations/0002_create_notifications_table.ts'] = `import type { Knex } from '@navette-js/database';

// Database notifications (the bell).
export async function up(db: Knex): Promise<void> {
    await db.schema.createTable('notifications', (table) => {
        table.string('id', 36).primary();
        table.string('type');
        table.string('notifiable_type');
        table.integer('notifiable_id');
        table.text('data');
        table.timestamp('read_at').nullable();
        table.timestamps();
        table.index(['notifiable_type', 'notifiable_id']);
    });
}
`;
    if (teams) files['src/migrations/0003_create_teams_tables.ts'] = `import type { Knex } from '@navette-js/database';

export async function up(db: Knex): Promise<void> {
    await db.schema.createTable('teams', (table) => {
        table.increments('id');
        table.string('name');
        table.timestamps();
    });
    // Team members.
    await db.schema.createTable('team_user', (table) => {
        table.increments('id');
        table.integer('team_id').references('id').inTable('teams').onDelete('cascade');
        table.integer('user_id').references('id').inTable('users').onDelete('cascade');
        table.timestamps();
    });
}
`;
    if (starter) files['src/migrations/0004_create_tasks_table.ts'] = `import type { Knex } from '@navette-js/database';

export async function up(db: Knex): Promise<void> {
    await db.schema.createTable('tasks', (table) => {
        table.increments('id');
        table.string('title');
        table.text('notes').nullable();
        table.string('priority').defaultTo('normal');
        table.date('due_date').nullable();
        table.boolean('is_done').defaultTo(false);
        table.timestamps();
    });
}
`;
    if (starter && teams) files['src/migrations/0005_create_notes_table.ts'] = `import type { Knex } from '@navette-js/database';

// Notes belong to a team: the \`team_id\` column scopes them to the current team in the /app panel.
export async function up(db: Knex): Promise<void> {
    await db.schema.createTable('notes', (table) => {
        table.increments('id');
        table.integer('team_id').references('id').inTable('teams').onDelete('cascade');
        table.string('title');
        table.text('body').nullable();
        table.timestamps();
    });
}
`;

    // ------------------------------------------------------------------ models
    const timestamps = `    $beforeInsert(): void { (this as any).created_at = (this as any).updated_at = now(); }
    $beforeUpdate(): void { (this as any).updated_at = now(); }`;
    const nowHelper = `const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');`;
    files['src/models/User.ts'] = `import { Model } from '@navette-js/database';

${nowHelper}

export class User extends Model {
    static tableName = 'users';
    declare id: number;
    declare name: string;
    declare email: string;
    declare role: string;
${timestamps}
}
`;
    if (starter) files['src/models/Task.ts'] = `import { Model } from '@navette-js/database';

${nowHelper}

export class Task extends Model {
    static tableName = 'tasks';
    declare id: number;
    declare title: string;
    declare notes: string | null;
    declare priority: string;
    declare due_date: string | null;
    declare is_done: boolean | number;
${timestamps}
}
`;
    if (starter && teams) files['src/models/Note.ts'] = `import { Model } from '@navette-js/database';

${nowHelper}

export class Note extends Model {
    static tableName = 'notes';
    declare id: number;
    declare team_id: number;
    declare title: string;
    declare body: string | null;
${timestamps}
}
`;

    // ------------------------------------------------------------------ admin panel
    files['src/panels/admin.ts'] = `// The admin panel (/admin): only users with the \`admin\` role can sign in.
import { AccountWidget, discoverPages, discoverResources, discoverWidgets, fileMailer, knexAuthProvider, ${sqlite ? 'knexNotificationStore, ' : ''}Panel } from '@navette-js/panels';
import { Color } from '@navette-js/support';
import { db } from '../database.ts';

const users = knexAuthProvider((table) => db(table));
const isAdmin = async (id: string | number) => (await db('users').where('id', id).first())?.role === 'admin';

export default Panel.make()
    .id('admin')
    .path('admin')
    .key(process.env.APP_KEY!)
    .appUrl(process.env.APP_URL ?? null)
    .brandName(process.env.APP_NAME ?? 'Navette')
    .setColors({ primary: Color.Amber })
    .login()
    .passwordReset()
    .profile()
    .mailer(fileMailer(process.env.MAIL_LOG ?? 'storage/mail.log'))
${sqlite ? '    .databaseNotifications(knexNotificationStore((table: string) => db(table)))\n' : ''}    .globalSearchKeyBindings(['command+k', 'ctrl+k'])
    // Resources, pages and widgets are discovered from these folders: \`npx navette make:resource\` adds files there.
    .resources(await discoverResources(new URL('../admin/resources/', import.meta.url)))
    .pages(await discoverPages(new URL('../admin/pages/', import.meta.url)))
    .widgets([AccountWidget, ...(await discoverWidgets(new URL('../admin/widgets/', import.meta.url)))])
    .auth({
        ...users,
        attempt: async (email, password) => {
            const user = await users.attempt(email, password);
            return user && (await isAdmin(user.id)) ? user : null;
        },
        find: async (id) => ((await isAdmin(id)) ? users.find(id) : null),
    });
`;
    files['src/admin/pages/Dashboard.ts'] = `import { Dashboard as BaseDashboard } from '@navette-js/panels';

// The panel's home page: it shows the panel's widgets (src/admin/widgets).
export class Dashboard extends BaseDashboard {}
`;
    files['src/admin/resources/UserResource.ts'] = `import { ObjectionAdapter } from '@navette-js/database';
import { Select, TextInput } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, SelectFilter, type Table } from '@navette-js/tables';
import { User } from '../../models/User.ts';

const ROLES: [string, string][] = [['user', 'User'], ['admin', 'Admin']];

// Users sign up${o.userPanel ? ' on /app/register' : ''} or are created with \`npx navette make:user\`; here you edit their name and role.
export class UserResource extends Resource {
    static slug = 'users';
    static modelLabel = 'user';
    static navigationIcon = 'o-users';
    static navigationSort = 10;
    static recordTitleAttribute = 'name';
    static globallySearchableAttributes = ['name', 'email'];
    static adapter = new ObjectionAdapter(User);
    static policy = { create: () => false };

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('name').required().maxLength(255),
            TextInput.make('email').email().required().maxLength(255).unique({ ignoreRecord: true }),
            Select.make('role').options(ROLES).required(),
        ]);
    }

    static table(table: Table<User>): Table<User> {
        return table
            .columns([
                TextColumn.make<User>('name').searchable().sortable(),
                TextColumn.make<User>('email').searchable(),
                TextColumn.make<User>('role').badge().color((user) => (user.role === 'admin' ? 'warning' : 'gray')),
                TextColumn.make<User>('created_at').dateTime().sortable(),
            ])
            .filters([SelectFilter.make('role').options(ROLES)]);
    }
}
`;
    if (starter) {
        files['src/admin/resources/TaskResource.ts'] = `import { Action } from '@navette-js/actions';
import { ObjectionAdapter } from '@navette-js/database';
import { DatePicker, Select, Textarea, TextInput, Toggle } from '@navette-js/forms';
import { DeleteBulkAction, Notification, Resource, Tab } from '@navette-js/panels';
import { Section, type Schema } from '@navette-js/schemas';
import { IconColumn, SelectFilter, TextColumn, type Table } from '@navette-js/tables';
import { Task } from '../../models/Task.ts';

const PRIORITIES: Record<string, { label: string; color: string }> = {
    low: { label: 'Low', color: 'gray' },
    normal: { label: 'Normal', color: 'info' },
    high: { label: 'High', color: 'danger' },
};
const priorityOptions = Object.entries(PRIORITIES).map(([value, priority]): [string, string] => [value, priority.label]);

export class TaskResource extends Resource {
    static slug = 'tasks';
    static modelLabel = 'task';
    static navigationIcon = 'o-clipboard-document-check';
    static recordTitleAttribute = 'title';
    static adapter = new ObjectionAdapter(Task);

    // Tabs above the table, each with its own query.
    static tabs(): Record<string, Tab> {
        return {
            '': Tab.make('All'),
            open: Tab.make('To do').query((query) => { query.where('is_done', false); }),
            done: Tab.make('Done').query((query) => { query.where('is_done', true); }),
        };
    }

    static form(schema: Schema): Schema {
        return schema.components([
            Section.make('Task')
                .schema([
                    TextInput.make('title').required().maxLength(255),
                    Select.make('priority').options(priorityOptions).default('normal').required(),
                    DatePicker.make('due_date'),
                    Toggle.make('is_done').label('Done'),
                    Textarea.make('notes').rows(4).columnSpanFull(),
                ])
                .columns(2)
                .columnSpanFull(),
        ]);
    }

    static table(table: Table<Task>): Table<Task> {
        return table
            .columns([
                TextColumn.make<Task>('title').searchable().sortable().weight('medium'),
                TextColumn.make<Task>('priority').badge()
                    .formatStateUsing(({ record }) => PRIORITIES[record.priority]?.label ?? record.priority)
                    .color((record) => PRIORITIES[record.priority]?.color ?? 'gray'),
                TextColumn.make<Task>('due_date').date().sortable().placeholder('—'),
                IconColumn.make<Task>('is_done').label('Done').boolean().sortable(),
            ])
            .defaultSort('due_date')
            .filters([SelectFilter.make('priority').options(priorityOptions)])
            .recordActions([
                // A custom row action: it runs on the server when clicked.
                Action.make('toggle')
                    .label(({ record }) => ((record as Task).is_done ? 'Reopen' : 'Complete'))
                    .icon(({ record }) => ((record as Task).is_done ? 'c-arrow-uturn-left' : 'c-check'))
                    .action(async ({ record }) => {
                        await TaskResource.adapter.update((record as Task).id, { is_done: !(record as Task).is_done });
                        Notification.make().success().title('Task updated').send();
                    }),
            ])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}
`;
        files['src/admin/widgets/TaskStats.ts'] = `import { Stat, StatsOverviewWidget } from '@navette-js/panels';
import { Task } from '../../models/Task.ts';
import { User } from '../../models/User.ts';

// Shown on the dashboard. Widgets are discovered from src/admin/widgets.
export class TaskStats extends StatsOverviewWidget {
    async getStats(): Promise<Stat[]> {
        return [
            Stat.make('Open tasks', await Task.query().where('is_done', false).resultSize()).color('warning'),
            Stat.make('Done', await Task.query().where('is_done', true).resultSize()).color('success'),
            Stat.make('Users', await User.query().resultSize()),
        ];
    }
}
`;
    }

    // ------------------------------------------------------------------ user panel
    if (o.userPanel) {
        files['src/panels/app.ts'] = `// The user panel (/app): anyone can sign up${teams ? ', then create or join teams' : ''}.
import { AccountWidget, discoverPages, discoverResources, discoverWidgets, fileMailer, knexAuthProvider, ${teams ? 'knexTenantProvider, ' : ''}Panel } from '@navette-js/panels';
import { db } from '../database.ts';
${teams ? "import { EditTeamProfile, RegisterTeam } from '../app/tenancy.ts';\n" : ''}
export default Panel.make()
    .id('app')
    .path('app')
    .key(process.env.APP_KEY!)
    .appUrl(process.env.APP_URL ?? null)
    .brandName(process.env.APP_NAME ?? 'Navette')
    .login()
    .registration()
    .passwordReset()
    .emailVerification()
    .profile()
    .mailer(fileMailer(process.env.MAIL_LOG ?? 'storage/mail.log'))
${teams ? `    // Every page lives under /app/<team>; records with a \`team_id\` column only show to that team's members.
    .tenant(knexTenantProvider((table) => db(table), { label: 'Current team' }), { ownershipColumn: 'team_id' })
    .tenantRegistration(RegisterTeam)
    .tenantProfile(EditTeamProfile)
` : ''}    .resources(await discoverResources(new URL('../app/resources/', import.meta.url)))
    .pages(await discoverPages(new URL('../app/pages/', import.meta.url)))
    .widgets([AccountWidget, ...(await discoverWidgets(new URL('../app/widgets/', import.meta.url)))])
    .auth(knexAuthProvider((table) => db(table)));
`;
        files['src/app/pages/Dashboard.ts'] = `import { Dashboard as BaseDashboard } from '@navette-js/panels';

// The panel's home page: it shows the panel's widgets (src/app/widgets).
export class Dashboard extends BaseDashboard {}
`;
        files['src/app/widgets/.gitkeep'] = '';
        if (teams) {
            files['src/app/tenancy.ts'] = `import { EditTenantProfile, RegisterTenant } from '@navette-js/panels';
import { TextInput } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';

/** /app/new: create a team; its creator becomes a member. */
export class RegisterTeam extends RegisterTenant {
    static getLabel(): string { return 'New team'; }
    formSchema(schema: Schema): Schema { return schema.components([TextInput.make('name').required().maxLength(255)]); }
}

/** /app/<team>/profile: rename the current team. */
export class EditTeamProfile extends EditTenantProfile {
    static getLabel(): string { return 'Team settings'; }
    formSchema(schema: Schema): Schema { return schema.components([TextInput.make('name').required().maxLength(255)]); }
}
`;
            if (starter) files['src/app/resources/NoteResource.ts'] = `import { ObjectionAdapter } from '@navette-js/database';
import { Textarea, TextInput } from '@navette-js/forms';
import { DeleteBulkAction, Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';
import { Note } from '../../models/Note.ts';

// Team notes: the panel scopes them to the current team through their \`team_id\` column.
export class NoteResource extends Resource {
    static slug = 'notes';
    static modelLabel = 'note';
    static navigationIcon = 'o-pencil-square';
    static recordTitleAttribute = 'title';
    static adapter = new ObjectionAdapter(Note);

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('title').required().maxLength(255),
            Textarea.make('body').rows(6).columnSpanFull(),
        ]);
    }

    static table(table: Table<Note>): Table<Note> {
        return table
            .columns([
                TextColumn.make<Note>('title').searchable().sortable(),
                TextColumn.make<Note>('updated_at').dateTime().sortable(),
            ])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}
`;
        } else {
            files['src/app/resources/.gitkeep'] = '';
        }
    }
    if (!starter) files['src/admin/widgets/.gitkeep'] = '';

    // ------------------------------------------------------------------ server
    files['src/server.ts'] = `// Entry point: runs the migrations, then serves every panel of src/panels.
import express from 'express';
import { mkdirSync } from 'node:fs';
import { discoverPanels, panelRouter } from '@navette-js/panels';
${o.locale === 'fr' ? "import { setLocale } from '@navette-js/support/i18n';\n" : ''}import { UploadStore, WireRuntime } from '@navette-js/wire';
import { migrate } from './database.ts';

const key = process.env.APP_KEY;
if (!key) throw new Error('APP_KEY is missing: start the server with \`npm run dev\` (it reads .env), or copy .env.example to .env and set APP_KEY.');
${o.locale === 'fr' ? "setLocale('fr');\n" : ''}mkdirSync('storage/public', { recursive: true });

for (const name of await migrate()) console.log(\`Migrated \${name}\`);

const app = express();
// Uploaded files that are public (FileUpload with the public disk).
app.use('/storage', express.static('storage/public', { dotfiles: 'deny', index: false }));
// Each panel has its own runtime (its own Livewire endpoint and components).
for (const panel of await discoverPanels(new URL('./panels/', import.meta.url))) {
    app.use(panelRouter(panel, new WireRuntime({ key, uploads: new UploadStore('storage/tmp', key) })));
}
app.get('/', (_req, res) => res.redirect('/${o.userPanel ? 'app' : 'admin'}'));

const port = Number(process.env.PORT ?? ${o.port});
app.listen(port, '127.0.0.1', () => {
    console.log(\`\\n  \${process.env.APP_NAME ?? 'Navette'} is running:\`);
    console.log(\`  Admin panel  http://127.0.0.1:\${port}/admin\`);
${o.userPanel ? "    console.log(`  User panel   http://127.0.0.1:${port}/app`);\n" : ''}});
`;

    // ------------------------------------------------------------------ README
    files['README.md'] = `# ${o.appName}

Built with [Navette](https://github.com/NavetteJS/navette), admin panels for Node.js.

## Running

\`\`\`bash
npm run dev
\`\`\`

- Admin panel: http://127.0.0.1:${o.port}/admin — sign in with an \`admin\` user.
${o.userPanel ? `- User panel: http://127.0.0.1:${o.port}/app — anyone can sign up${teams ? ', then create a team' : ''}.\n` : ''}
Create an admin user:

\`\`\`bash
npx navette make:user --admin
\`\`\`

In development, e-mails (password reset${o.userPanel ? ', email verification' : ''}) are written to \`storage/mail.log\`.

## Project structure

| Path | |
|---|---|
| \`src/server.ts\` | Starts Express, runs the migrations, serves the panels |
| \`src/panels/\` | One file per panel (\`admin.ts\`${o.userPanel ? ', `app.ts`' : ''}) |
| \`src/admin/resources\`, \`pages\`, \`widgets\` | Discovered automatically by the admin panel |
${o.userPanel ? '| `src/app/…` | The same for the user panel |\n' : ''}| \`src/models/\` | Objection models |
| \`src/migrations/\` | Database migrations, run at start-up |
| \`.env\` | Settings (\`APP_KEY\` is secret: never commit it) |

## Generating code

\`\`\`bash
npx navette make:migration create_posts_table   # then edit it and restart
npx navette make:resource Post --generate        # form and table from the posts table
npx navette make:page Settings
npx navette make:widget SalesChart --type=chart
\`\`\`

Add \`--panel=app\` to target the user panel.
`;
    return files;
}
