// Starter app: the smallest useful Navette dashboard. One `tasks` table, one resource, one widget.
// Run:  ADMIN_PASSWORD=some-password node apps/starter/server.ts   then open http://127.0.0.1:3300/login
// The getting-started guide walks through this file step by step.
import express from 'express';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite } from '@navette-js/database';
import { DatePicker, Select, Textarea, TextInput, Toggle } from '@navette-js/forms';
import { Dashboard, DeleteBulkAction, Notification, PageTableStatsWidget, Panel, Resource, Stat, StatsOverviewWidget, Tab, can, panelRouter, type Policy, type User } from '@navette-js/panels';
import { Page } from '@navette-js/panels';
import { TextEntry } from '@navette-js/infolists';
import { Html } from '@navette-js/schemas';
import { e } from '@navette-js/support';
import { Section, type Schema } from '@navette-js/schemas';
import { Color } from '@navette-js/support';
import { IconColumn, SelectFilter, TextColumn, type Table } from '@navette-js/tables';
import { WireRuntime } from '@navette-js/wire';
import { CreateTask, EffortColumn, EffortField, footerPlugin } from './extensions.ts';

const file = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// ------------------------------------------------------------------ 1. data
const knex = sqlite(process.env.STARTER_DB ?? file('./data.sqlite'));
if (!(await knex.schema.hasTable('tasks'))) {
    await knex.schema.createTable('tasks', (t) => {
        t.increments('id');
        t.string('title').notNullable();
        t.text('notes');
        t.string('priority').notNullable().defaultTo('normal');
        t.date('due_date');
        t.boolean('is_done').notNullable().defaultTo(false);
        t.integer('effort').notNullable().defaultTo(1);
        t.string('created_by');
        t.timestamps();
    });
    await knex('tasks').insert([
        { title: 'Read the documentation', priority: 'high', is_done: true },
        { title: 'Create my first resource', priority: 'normal', is_done: false },
        { title: 'Pick the panel colors', priority: 'low', is_done: false },
    ]);
}
// A database created by an earlier version of this example gets the columns added since.
for (const [column, add] of [['effort', (t: any) => t.integer('effort').notNullable().defaultTo(1)], ['created_by', (t: any) => t.string('created_by')]] as const) {
    if (!(await knex.schema.hasColumn('tasks', column))) await knex.schema.alterTable('tasks', add);
}
// Global setting: every text input created from now on is limited to 255 characters unless told otherwise.
TextInput.configureUsing((input) => input.maxLength(255));

class Task extends Model {
    static tableName = 'tasks';
    id!: number;
    title!: string;
    notes!: string | null;
    priority!: string;
    due_date!: string | null;
    is_done!: number | boolean;
    created_at!: string;
    updated_at!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    // SQLite has no boolean type: store 0 or 1.
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.is_done === 'boolean') out.is_done = out.is_done ? 1 : 0;
        return out;
    }
}

const PRIORITIES: Record<string, { label: string; color: string }> = {
    low: { label: 'Low', color: 'gray' },
    normal: { label: 'Normal', color: 'info' },
    high: { label: 'High', color: 'danger' },
};

// ------------------------------------------------------------------ 2. a widget bound to the table
class TaskStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => TaskResource.getPages().index as any;
    async getStats(): Promise<Stat[]> {
        const all = await this.aggregatePageTable();
        const open = await this.aggregatePageTable({}, (query) => { query.where('is_done', 0); });
        return [Stat.make('Tasks shown', all.count), Stat.make('To do', open.count).color('warning')];
    }
}

// ------------------------------------------------------------------ 3. the resource: list, create, edit
class TaskResource extends Resource {
    static slug = 'tasks';
    static modelLabel = 'task';
    static navigationIcon = 'o-clipboard-document-check';
    static recordTitleAttribute = 'title';
    static adapter = new ObjectionAdapter(Task);
    // The create page is replaced by a subclass (see extensions.ts).
    static pages = { create: CreateTask };
    // Everyone can view; only admins create, edit and delete.
    static policy: Policy<Task> = {
        create: (user) => user.role === 'admin',
        update: (user) => user.role === 'admin',
        delete: (user) => user.role === 'admin',
        deleteAny: (user) => user.role === 'admin',
    };
    static widgets = [TaskStats];
    static headerWidgets = [TaskStats];

    static tabs(): Record<string, Tab> {
        return {
            '': Tab.make('All'),
            open: Tab.make('To do').query((query) => { query.where('is_done', 0); }),
            done: Tab.make('Done').query((query) => { query.where('is_done', 1); }),
        };
    }

    static form(schema: Schema): Schema {
        return schema
            .components([
                Section.make('Task')
                    .schema([
                        TextInput.make('title').label('Title').required(),
                        Select.make('priority').label('Priority').options(Object.entries(PRIORITIES).map(([value, p]): [string, string] => [value, p.label])).default('normal').required(),
                        DatePicker.make('due_date').label('Due date'),
                        Toggle.make('is_done').label('Done'),
                        EffortField.make('effort').label('Effort').helperText('From 1 (light) to 5 (heavy).'),
                        Textarea.make('notes').label('Notes').rows(4).columnSpanFull(),
                    ])
                    .columns(2)
                    .columnSpanFull(),
            ])
            .columns(2);
    }

    static table(table: Table<Task>): Table<Task> {
        return table
            .columns([
                TextColumn.make<Task>('title').label('Title').searchable().sortable().weight('medium'),
                TextColumn.make<Task>('priority').label('Priority').badge()
                    .formatStateUsing(({ record }) => PRIORITIES[record.priority]?.label ?? record.priority)
                    .color((record) => PRIORITIES[record.priority]?.color ?? 'gray'),
                TextColumn.make<Task>('due_date').label('Due date').date().sortable().placeholder('—'),
                EffortColumn.make<Task>('effort').label('Effort').sortable(),
                IconColumn.make<Task>('is_done').label('Done').boolean().sortable(),
                TextColumn.make<Task>('created_by').label('Created by').placeholder('—').toggleable(),
            ])
            .defaultSort('due_date')
            .filters([SelectFilter.make('priority').label('Priority').options(Object.entries(PRIORITIES).map(([value, p]): [string, string] => [value, p.label]))])
            .recordActions([
                Action.make('toggle_done')
                    .label(({ record }) => ((record as Task).is_done ? 'Reopen' : 'Complete'))
                    .icon(({ record }) => ((record as Task).is_done ? 'c-arrow-uturn-left' : 'c-check'))
                    // A custom action must declare the ability it requires; otherwise it is hidden and refused.
                    .authorize(({ livewire, record }) => can(livewire, 'update', record))
                    .action(async ({ record }) => {
                        await TaskResource.adapter.update(record.id, { is_done: !record.is_done });
                        Notification.make().success().title('Task updated').send();
                    }),
                Action.make('edit').label('Edit').icon('c-pencil-square').url(({ record }) => TaskResource.getUrl('edit', (record as Task).id))
                    .authorize(({ livewire, record }) => can(livewire, 'update', record)),
            ])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}

// ------------------------------------------------------------------ 4. the dashboard and its widget
class Overview extends StatsOverviewWidget {
    static pollingInterval = null;
    async getStats(): Promise<Stat[]> {
        const open = await Task.query().where('is_done', 0).resultSize();
        return [Stat.make('To do', open).url('/tasks'), Stat.make('Total', await Task.query().resultSize())];
    }
}
class Home extends Dashboard {
    static navigationLabel = 'Home';
    getHeading(): string { return 'Hello'; }
    // A dashboard shows the panel's widgets (`.widgets([...])` below) by default; override `getWidgets()` to pick others.
}

/** A custom page whose content is a schema: read-only entries, plus raw HTML that you must escape yourself. */
class StatusPage extends Page {
    static slug = 'status';
    static title = 'Status';
    static navigationIcon = 'o-signal';
    static navigationSort = 10;
    static canAccess(user: User): boolean { return user.role === 'admin'; }
    contentSchema(schema: Schema): Schema {
        return schema.components([
            Section.make('Database').schema([
                TextEntry.make('tasks').label('Stored tasks').state(async () => String(await Task.query().resultSize())),
            ]),
            Html.make(() => `<p class="fi-status-note">Node ${e(process.version)}</p>`),
        ]);
    }
}

// ------------------------------------------------------------------ 5. the panel and its authentication
const key = process.env.APP_KEY ?? 'cle-de-developpement-a-remplacer';
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) throw new Error('Set ADMIN_PASSWORD to run the starter app.');
// Only a password hash is kept, and it is compared in constant time.
const hash = (password: string) => scryptSync(password, key, 32);
// Two roles for the example. In a real project, accounts come from your database.
const accounts = [
    { id: 1, name: 'Admin', email: process.env.ADMIN_EMAIL ?? 'admin@example.test', role: 'admin', passwordHash: hash(adminPassword) },
    // Read-only account, created only when READER_PASSWORD is set.
    ...(process.env.READER_PASSWORD ? [{ id: 2, name: 'Reader', email: 'reader@example.test', role: 'reader', passwordHash: hash(process.env.READER_PASSWORD) }] : []),
];
const publicUser = (account: (typeof accounts)[number]): User => ({ id: account.id, name: account.name, email: account.email, role: account.role });

const panel = Panel.make()
    .id('admin')
    .key(key)
    .brandName('My dashboard')
    .setColors({ primary: Color.Emerald })
    .login()
    .pages([Home, StatusPage])
    .widgets([Overview])
    .plugin(footerPlugin('My dashboard — powered by Navette'))
    .resources([TaskResource])
    .auth({
        attempt: (email, password) => {
            const account = accounts.find((a) => a.email === email);
            return account && timingSafeEqual(hash(password), account.passwordHash) ? publicUser(account) : null;
        },
        find: (id) => { const account = accounts.find((a) => a.id === id); return account ? publicUser(account) : null; },
    });

const app = express();
app.use(panelRouter(panel, new WireRuntime({ key })));
const port = Number(process.env.PORT ?? 3300);
app.listen(port, '127.0.0.1', () => console.log(`My dashboard: http://127.0.0.1:${port}/login`));
