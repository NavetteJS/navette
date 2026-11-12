// Équivalent de App\Filament\Resources\Blog (Categories et Authors : resources « simples », une page et des modales) de la démo Filament.
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { CheckboxList, RichEditor, Textarea, TextInput, Toggle } from '@navette-js/forms';
import { IconEntry, TextEntry } from '@navette-js/infolists';
import { CreateAction, DeleteAction, DeleteBulkAction, EditAction, ListRecords, Notification, Resource, ViewAction } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { registerIcon } from '@navette-js/support';
import { IconColumn, Split, Stack, TextColumn, type Table } from '@navette-js/tables';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
const slugify = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Icônes de marque de la démo (resources/svg) : elles ne font pas partie de Heroicons.
registerIcon('icon-github', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>');
registerIcon('icon-twitter', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>');

// ------------------------------------------------------------------ catégories d'articles
export class PostCategory extends Model {
    static tableName = 'post_categories';
    id!: number;
    name!: string;
    slug!: string;
    description!: string | null;
    is_visible!: number | boolean;
    created_at!: string;
    updated_at!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.is_visible === 'boolean') out.is_visible = out.is_visible ? 1 : 0;
        return out;
    }
}

/** Découpe une ligne CSV (guillemets doublés acceptés). */
const csvLine = (line: string): string[] => { const cells: string[] = []; let current = ''; let quoted = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (quoted) { if (c === '"' && line[i + 1] === '"') { current += '"'; i++; } else if (c === '"') quoted = false; else current += c; } else if (c === '"') quoted = true; else if (c === ',') { cells.push(current); current = ''; } else current += c; } cells.push(current); return cells.map((cell) => cell.trim()); };

class ManageCategories extends ListRecords {
    getHeaderActions(): Action[] {
        return [
            // Port partiel de ImportAction : le CSV est collé dans la modale (pas de téléversement, de correspondance de colonnes ni de file d'attente).
            Action.make('import').label('Import post categories').color('gray').modalHeading('Import post categories').modalSubmitActionLabel('Import')
                .schema(() => [Textarea.make('csv').label('CSV').rows(8).required().maxLength(200000).helperText('Columns: name, slug, description, is_visible. The first line is the header; rows are matched on the slug.')])
                .action(async ({ data }) => {
                    const lines = String(data.csv ?? '').split(/\r?\n/).filter((line) => line.trim() !== '').slice(0, 1001);
                    const header = csvLine(lines.shift() ?? '').map((name) => name.toLowerCase());
                    const at = (cells: string[], name: string) => (header.includes(name) ? (cells[header.indexOf(name)] ?? '') : '');
                    let imported = 0; let failed = 0;
                    for (const line of lines) {
                        const cells = csvLine(line);
                        const name = at(cells, 'name').slice(0, 255);
                        const slug = slugify(at(cells, 'slug') || name).slice(0, 255);
                        if (!name || !slug) { failed++; continue; }
                        const values = { name, slug, description: at(cells, 'description') || null, is_visible: !['0', 'false', 'no', ''].includes(at(cells, 'is_visible').toLowerCase()) || !header.includes('is_visible') };
                        const existing = await PostCategory.query().findOne({ slug });
                        if (existing) await PostCategoryResource.adapter.update(existing.id, values); else await PostCategoryResource.adapter.create(values);
                        imported++;
                    }
                    Notification.make().status(failed ? 'warning' : 'success').title(`Your post category import has completed and ${imported} ${imported === 1 ? 'row' : 'rows'} imported.`).body(failed ? `${failed} ${failed === 1 ? 'row' : 'rows'} failed to import.` : '').send();
                }),
            CreateAction.make(this.resource),
        ];
    }
}

export class PostCategoryResource extends Resource {
    static slug = 'blog/categories';
    static modelLabel = 'post category';
    static pluralModelLabel = 'post categories';
    static navigationIcon = 'o-rectangle-stack';
    static navigationGroup = 'Blog';
    static navigationSort = 1;
    static recordTitleAttribute = 'name';
    static globalSearchSort = 2;
    static isSimple = true;
    static pages = { index: ManageCategories };
    static adapter = new ObjectionAdapter(PostCategory);

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('name').required().maxLength(255).live({ onBlur: true })
                .afterStateUpdated(({ operation, state, set }) => { if (operation === 'create') set('slug', slugify(String(state ?? ''))); }),
            TextInput.make('slug').disabled().dehydrated().required().maxLength(255).unique({ ignoreRecord: true }),
            RichEditor.make('description').columnSpanFull(),
            Toggle.make('is_visible').label('Visibility').default(true),
        ]);
    }

    /** Affiché dans la modale « View » (la resource n'a pas de page de consultation). */
    static infolist(schema: Schema): Schema {
        return schema.columns(1).components([
            TextEntry.make('name'),
            TextEntry.make('slug').copyable(),
            TextEntry.make('description').markdown().placeholder('No description'),
            IconEntry.make('is_visible').label('Visibility').boolean(),
            TextEntry.make('updated_at').label('Last modified at').dateTime(),
        ]);
    }

    static table(table: Table<PostCategory>): Table<PostCategory> {
        return table
            .columns([
                TextColumn.make<PostCategory>('name').searchable().sortable().weight('medium'),
                TextColumn.make<PostCategory>('slug').searchable().sortable().copyable().toggleable(),
                IconColumn.make<PostCategory>('is_visible').label('Visibility').boolean(),
                TextColumn.make<PostCategory>('updated_at').label('Last modified at').date().toggleable(true, { isToggledHiddenByDefault: true }),
            ])
            .defaultSort('name')
            // Clic sur la ligne : la consultation (une action « View » existe), et non l'édition.
            .recordAction('view')
            .recordActions([
                ActionGroup.make([
                    Action.make('toggle_visibility').color('gray')
                        .icon(({ record }) => ((record as PostCategory).is_visible ? 'm-eye-slash' : 'm-eye'))
                        .label(({ record }) => ((record as PostCategory).is_visible ? 'Hide category' : 'Show category'))
                        .action(async ({ record }) => { await PostCategoryResource.adapter.update((record as PostCategory).id, { is_visible: !(record as PostCategory).is_visible }); }),
                    ViewAction.make(),
                    EditAction.make(),
                    DeleteAction.make().action(cheeky),
                ]),
            ])
            .groupedBulkActions([DeleteBulkAction.make().action(cheeky)]);
    }
}

// ------------------------------------------------------------------ auteurs
export class Author extends Model {
    static tableName = 'authors';
    id!: number;
    name!: string;
    email!: string;
    photo!: string | null;
    bio!: string | null;
    github_handle!: string | null;
    twitter_handle!: string | null;
    created_at!: string;
    updated_at!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
}

/** Colonnes exportables (équivalent de Exports\Blog\AuthorExporter). */
const EXPORT_COLUMNS: [keyof Author & string, string][] = [
    ['id', 'ID'], ['name', 'Name'], ['email', 'Email address'], ['github_handle', 'GitHub handle'], ['twitter_handle', 'Twitter handle'], ['created_at', 'Created at'], ['updated_at', 'Last modified at'],
];
const csvCell = (value: unknown) => { const text = value === null || value === undefined ? '' : String(value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };

class ManageAuthors extends ListRecords {
    getHeaderActions(): Action[] {
        return [
            // Port partiel de ExportAction : choix des colonnes puis fichier CSV écrit sur le disque public (pas de file d'attente ni de XLSX).
            Action.make('export').label('Export authors').color('gray').modalHeading('Export authors').modalSubmitActionLabel('Export')
                .fillForm(() => ({ columns: EXPORT_COLUMNS.map(([name]) => name) }))
                .schema(() => [CheckboxList.make('columns').label('Columns').options(EXPORT_COLUMNS).required()])
                .action(async ({ data }) => {
                    // Seules les colonnes déclarées sont exportées, quelle que soit la liste reçue.
                    const chosen = EXPORT_COLUMNS.filter(([name]) => Array.isArray(data.columns) && data.columns.includes(name));
                    const rows = await Author.query().orderBy('id');
                    const csv = [chosen.map(([, label]) => csvCell(label)).join(','), ...rows.map((row) => chosen.map(([name]) => csvCell(row[name])).join(','))].join('\r\n');
                    if (!AuthorResource.exportRoot) { Notification.make().danger().title('Export unavailable').body('No public disk is configured.').send(); return; }
                    const name = `authors-${randomBytes(8).toString('hex')}.csv`;
                    mkdirSync(path.join(AuthorResource.exportRoot, 'exports'), { recursive: true });
                    writeFileSync(path.join(AuthorResource.exportRoot, 'exports', name), `﻿${csv}\r\n`);
                    Notification.make().success().persistent()
                        .title(`Your author export has completed and ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} exported.`)
                        .body(`Download: /storage/exports/${name}`).send();
                }),
            CreateAction.make(this.resource),
        ];
    }
}

export class AuthorResource extends Resource {
    static slug = 'blog/authors';
    static modelLabel = 'author';
    static navigationIcon = 'o-users';
    static navigationGroup = 'Blog';
    static navigationSort = 2;
    static recordTitleAttribute = 'name';
    static globalSearchSort = 1;
    static isSimple = true;
    static pages = { index: ManageAuthors };
    static adapter = new ObjectionAdapter(Author);
    /** Dossier public où déposer les exports (servi sous /storage), fixé par le serveur. */
    static exportRoot: string | null = null;

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('name').required().maxLength(255),
            TextInput.make('email').label('Email address').required().maxLength(255).email().unique({ ignoreRecord: true }),
            RichEditor.make('bio').columnSpanFull(),
            TextInput.make('github_handle').label('GitHub handle').maxLength(255),
            TextInput.make('twitter_handle').maxLength(255),
        ]);
    }

    static table(table: Table<Author>): Table<Author> {
        return table
            .columns([
                Split.make<Author>([
                    Stack.make<Author>([
                        TextColumn.make<Author>('name').searchable().sortable().weight('medium').alignLeft(),
                        TextColumn.make<Author>('email').label('Email address').searchable().sortable().color('gray').alignLeft(),
                    ]).space(),
                    Stack.make<Author>([
                        TextColumn.make<Author>('github_handle').icon(() => 'icon-github').label('GitHub handle').alignLeft(),
                        TextColumn.make<Author>('twitter_handle').icon(() => 'icon-twitter').alignLeft(),
                    ]).space(2),
                ]).from('md'),
            ])
            .defaultSort('name')
            .recordActions([
                ActionGroup.make([
                    // Le pseudonyme est encodé : il ne peut pas sortir du chemin de l'adresse.
                    Action.make('view_github').label('View GitHub').icon('icon-github').color('gray').openUrlInNewTab()
                        .url(({ record }) => `https://github.com/${encodeURIComponent((record as Author).github_handle ?? '')}`)
                        .hidden(({ record }) => !(record as Author).github_handle),
                    Action.make('view_twitter').label('View Twitter').icon('icon-twitter').color('gray').openUrlInNewTab()
                        .url(({ record }) => `https://x.com/${encodeURIComponent((record as Author).twitter_handle ?? '')}`)
                        .hidden(({ record }) => !(record as Author).twitter_handle),
                    EditAction.make(),
                    DeleteAction.make().action(cheeky),
                ]),
            ])
            .groupedBulkActions([DeleteBulkAction.make().action(cheeky)]);
    }
}
