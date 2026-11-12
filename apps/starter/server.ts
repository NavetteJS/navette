// Application de départ : le plus petit dashboard Navette utile. Une table `tasks`, une resource, un widget.
// Lancer :  ADMIN_PASSWORD=un-mot-de-passe node apps/starter/server.ts   puis ouvrir http://127.0.0.1:3300/login
// La documentation (navette/docs) suit ce fichier pas à pas.
import express from 'express';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Action } from '@navette/actions';
import { Model, ObjectionAdapter, sqlite } from '@navette/database';
import { DatePicker, Select, Textarea, TextInput, Toggle } from '@navette/forms';
import { Dashboard, DeleteBulkAction, Notification, PageTableStatsWidget, Panel, Resource, Stat, StatsOverviewWidget, Tab, can, panelRouter, type Policy, type User } from '@navette/panels';
import { Page } from '@navette/panels';
import { TextEntry } from '@navette/infolists';
import { Html } from '@navette/schemas';
import { e } from '@navette/support';
import { Section, type Schema } from '@navette/schemas';
import { Color } from '@navette/support';
import { IconColumn, SelectFilter, TextColumn, type Table } from '@navette/tables';
import { WireRuntime } from '@navette/wire';
import { CreateTask, EffortColumn, EffortField, footerPlugin } from './extensions.ts';

const file = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// ------------------------------------------------------------------ 1. données
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
        { title: 'Lire la documentation', priority: 'high', is_done: true },
        { title: 'Créer ma première resource', priority: 'normal', is_done: false },
        { title: 'Choisir les couleurs du panel', priority: 'low', is_done: false },
    ]);
}
// Une base créée par une version précédente de cet exemple reçoit les colonnes ajoutées depuis.
for (const [column, add] of [['effort', (t: any) => t.integer('effort').notNullable().defaultTo(1)], ['created_by', (t: any) => t.string('created_by')]] as const) {
    if (!(await knex.schema.hasColumn('tasks', column))) await knex.schema.alterTable('tasks', add);
}
// Réglage global : tout champ texte créé ensuite est limité à 255 caractères, sauf indication contraire.
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
    // SQLite n'a pas de booléen : on écrit 0 ou 1.
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.is_done === 'boolean') out.is_done = out.is_done ? 1 : 0;
        return out;
    }
}

const PRIORITIES: Record<string, { label: string; color: string }> = {
    low: { label: 'Basse', color: 'gray' },
    normal: { label: 'Normale', color: 'info' },
    high: { label: 'Haute', color: 'danger' },
};

// ------------------------------------------------------------------ 2. un widget lié à la table
class TaskStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => TaskResource.getPages().index as any;
    async getStats(): Promise<Stat[]> {
        const all = await this.aggregatePageTable();
        const open = await this.aggregatePageTable({}, (query) => { query.where('is_done', 0); });
        return [Stat.make('Tâches affichées', all.count), Stat.make('À faire', open.count).color('warning')];
    }
}

// ------------------------------------------------------------------ 3. la resource : liste, création, édition
class TaskResource extends Resource {
    static slug = 'tasks';
    static modelLabel = 'task';
    static navigationIcon = 'o-clipboard-document-check';
    static recordTitleAttribute = 'title';
    static adapter = new ObjectionAdapter(Task);
    // La page de création est remplacée par une sous-classe (voir extensions.ts).
    static pages = { create: CreateTask };
    // Tout le monde consulte ; seul un administrateur crée, modifie et supprime.
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
            '': Tab.make('Toutes'),
            open: Tab.make('À faire').query((query) => { query.where('is_done', 0); }),
            done: Tab.make('Terminées').query((query) => { query.where('is_done', 1); }),
        };
    }

    static form(schema: Schema): Schema {
        return schema
            .components([
                Section.make('Tâche')
                    .schema([
                        TextInput.make('title').label('Titre').required(),
                        Select.make('priority').label('Priorité').options(Object.entries(PRIORITIES).map(([value, p]): [string, string] => [value, p.label])).default('normal').required(),
                        DatePicker.make('due_date').label('Échéance'),
                        Toggle.make('is_done').label('Terminée'),
                        EffortField.make('effort').label('Effort').helperText('De 1 (léger) à 5 (lourd).'),
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
                TextColumn.make<Task>('title').label('Titre').searchable().sortable().weight('medium'),
                TextColumn.make<Task>('priority').label('Priorité').badge()
                    .formatStateUsing(({ record }) => PRIORITIES[record.priority]?.label ?? record.priority)
                    .color((record) => PRIORITIES[record.priority]?.color ?? 'gray'),
                TextColumn.make<Task>('due_date').label('Échéance').date().sortable().placeholder('—'),
                EffortColumn.make<Task>('effort').label('Effort').sortable(),
                IconColumn.make<Task>('is_done').label('Terminée').boolean().sortable(),
                TextColumn.make<Task>('created_by').label('Créée par').placeholder('—').toggleable(),
            ])
            .defaultSort('due_date')
            .filters([SelectFilter.make('priority').label('Priorité').options(Object.entries(PRIORITIES).map(([value, p]): [string, string] => [value, p.label]))])
            .recordActions([
                Action.make('toggle_done')
                    .label(({ record }) => ((record as Task).is_done ? 'Rouvrir' : 'Terminer'))
                    .icon(({ record }) => ((record as Task).is_done ? 'c-arrow-uturn-left' : 'c-check'))
                    // Une action personnalisée déclare la capacité qu'elle exige : masquée et refusée sinon.
                    .authorize(({ livewire, record }) => can(livewire, 'update', record))
                    .action(async ({ record }) => {
                        await TaskResource.adapter.update(record.id, { is_done: !record.is_done });
                        Notification.make().success().title('Tâche mise à jour').send();
                    }),
                Action.make('edit').label('Modifier').icon('c-pencil-square').url(({ record }) => TaskResource.getUrl('edit', (record as Task).id))
                    .authorize(({ livewire, record }) => can(livewire, 'update', record)),
            ])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}

// ------------------------------------------------------------------ 4. le tableau de bord et son widget
class Overview extends StatsOverviewWidget {
    static pollingInterval = null;
    async getStats(): Promise<Stat[]> {
        const open = await Task.query().where('is_done', 0).resultSize();
        return [Stat.make('À faire', open).url('/tasks'), Stat.make('Total', await Task.query().resultSize())];
    }
}
class Home extends Dashboard {
    static navigationLabel = 'Accueil';
    getHeading(): string { return 'Bonjour'; }
    // Comme dans Filament, un tableau de bord affiche par défaut les widgets du panel (`.widgets([...])` plus bas) ; `getWidgets()` permet d'en choisir d'autres.
}

/** Une page libre : son contenu est un schéma (entrées en lecture seule, balisage libre à échapper soi-même). */
class StatusPage extends Page {
    static slug = 'status';
    static title = 'État';
    static navigationIcon = 'o-signal';
    static navigationSort = 10;
    static canAccess(user: User): boolean { return user.role === 'admin'; }
    contentSchema(schema: Schema): Schema {
        return schema.components([
            Section.make('Base de données').schema([
                TextEntry.make('tasks').label('Tâches enregistrées').state(async () => String(await Task.query().resultSize())),
            ]),
            Html.make(() => `<p class="fi-status-note">Node ${e(process.version)}</p>`),
        ]);
    }
}

// ------------------------------------------------------------------ 5. le panel et son authentification
const key = process.env.APP_KEY ?? 'cle-de-developpement-a-remplacer';
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) throw new Error('Définissez ADMIN_PASSWORD pour lancer l\'application de départ.');
// On ne garde qu'une empreinte du mot de passe ; la comparaison se fait en temps constant.
const hash = (password: string) => scryptSync(password, key, 32);
// Deux rôles pour l'exemple. Dans un vrai projet, les comptes viennent de votre base.
const accounts = [
    { id: 1, name: 'Admin', email: process.env.ADMIN_EMAIL ?? 'admin@example.test', role: 'admin', passwordHash: hash(adminPassword) },
    // Compte en lecture seule, créé seulement si READER_PASSWORD est défini.
    ...(process.env.READER_PASSWORD ? [{ id: 2, name: 'Lecteur', email: 'reader@example.test', role: 'reader', passwordHash: hash(process.env.READER_PASSWORD) }] : []),
];
const publicUser = (account: (typeof accounts)[number]): User => ({ id: account.id, name: account.name, email: account.email, role: account.role });

const panel = Panel.make()
    .id('admin')
    .key(key)
    .brandName('Mon dashboard')
    .setColors({ primary: Color.Emerald })
    .login()
    .pages([Home, StatusPage])
    .widgets([Overview])
    .plugin(footerPlugin('Mon dashboard — propulsé par Navette'))
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
app.listen(port, '127.0.0.1', () => console.log(`Mon dashboard : http://127.0.0.1:${port}/login`));
