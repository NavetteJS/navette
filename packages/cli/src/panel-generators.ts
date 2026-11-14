// CLI file generators for panels, clusters, relation managers, themes, resource pages and resource widgets. Each returns the
// files to write (path relative to the project root → content), so that a project can change them (`navette.generators.ts`).
import { headline, plural, snake, studly } from './generators.ts';

/** Files to write: path relative to the project root (forward slashes) → content. */
export type GeneratedFiles = Record<string, string>;

const kebab = (value: string) => snake(value).replace(/_/g, '-');
const singular = (value: string) => (/ies$/.test(value) ? value.slice(0, -3) + 'y' : /(ss|x|z|ch|sh)es$/.test(value) ? value.slice(0, -2) : /s$/.test(value) && !/ss$/.test(value) ? value.slice(0, -1) : value);
/** Relative import path from one project file to another, with `./` and forward slashes. */
export function relativeImport(from: string, to: string): string {
    const source = from.split('/').slice(0, -1);
    const target = to.split('/');
    let common = 0;
    while (common < source.length && common < target.length - 1 && source[common] === target[common]) common++;
    const up = source.length - common;
    const path = [...Array(up).fill('..'), ...target.slice(common)].join('/');
    return up === 0 ? `./${path}` : path;
}

// ------------------------------------------------------------------ make:panel
/** A panel file (discovered by the server from src/panels) and the folders of its resources, pages and widgets. */
export function generatePanel(id: string, options: { usersModule?: boolean } = {}): GeneratedFiles {
    const name = headline(id.replace(/-/g, '_'));
    const users = options.usersModule !== false;
    return {
        [`src/panels/${id}.ts`]: `// The ${name} panel (/${id}).
import { AccountWidget, discoverPages, discoverResources, discoverWidgets, ${users ? '' : 'knexAuthProvider, '}Panel } from '@navette-js/panels';
${users ? "import { users } from '../users.ts';\n" : "import { db } from '../database.ts';\n"}
export default Panel.make()
    .id('${id}')
    .path('${id}')
    .key(process.env.APP_KEY!)
    .appUrl(process.env.APP_URL ?? null)
    .brandName(process.env.APP_NAME ?? 'Navette')
    .login()
    // Resources, pages and widgets are discovered from these folders: \`npx navette make:resource Post --panel=${id}\` adds files there.
    .resources(await discoverResources(new URL('../${id}/resources/', import.meta.url)))
    .pages(await discoverPages(new URL('../${id}/pages/', import.meta.url)))
    .widgets([AccountWidget, ...(await discoverWidgets(new URL('../${id}/widgets/', import.meta.url)))])
    .auth(${users ? 'users' : 'knexAuthProvider((table) => db(table))'});
`,
        [`src/${id}/pages/Dashboard.ts`]: `import { Dashboard as BaseDashboard } from '@navette-js/panels';

// The panel's home page: it shows the panel's widgets (src/${id}/widgets).
export class Dashboard extends BaseDashboard {}
`,
        [`src/${id}/resources/.gitkeep`]: '',
        [`src/${id}/widgets/.gitkeep`]: '',
    };
}

// ------------------------------------------------------------------ make:cluster
/** A cluster: pages and resources declaring `static cluster = <Name>Cluster` are served under its URL and listed in its sub-navigation. */
export function generateCluster(name: string, panel: string): GeneratedFiles {
    const base = studly(name).replace(/Cluster$/, '');
    return {
        [`src/${panel}/clusters/${base}Cluster.ts`]: `import { Cluster } from '@navette-js/panels';

/**
 * ${headline(snake(base))} cluster: add \`static cluster = ${base}Cluster\` to the pages and resources it gathers. It is served at
 * /${kebab(base)} and opens its first page.
 */
export class ${base}Cluster extends Cluster {
    static navigationIcon = 'o-squares-2x2';
}
`,
    };
}

// ------------------------------------------------------------------ make:relation-manager
export type RelationManagerOptions = {
    panel: string;
    /** Model of the related records; defaults to the singular of the relationship (`posts` → `Post`). */
    model?: string;
    /** Foreign key of the related records pointing to the owner (`<owner>_id`). */
    foreignKey?: string;
    /** Many-to-many: attach and detach existing records (pivot table `<owner>_<related>`). */
    attach?: boolean;
    pivotTable?: string;
    /** One-to-many: associate and dissociate existing records. */
    associate?: boolean;
    softDeletes?: boolean;
    view?: boolean;
    /** A nested resource managing the records (its table, form and pages are used). */
    relatedResource?: string;
};

/** A relation manager for a resource's relationship, to list in the resource's `static relations`. */
export function generateRelationManager(resource: string, relationship: string, titleAttribute: string, options: RelationManagerOptions): { files: GeneratedFiles; className: string; file: string } {
    const owner = studly(resource).replace(/Resource$/, '');
    const name = studly(relationship);
    const className = `${name}RelationManager`;
    const file = `src/${options.panel}/resources/${owner}/RelationManagers/${className}.ts`;
    const model = studly(options.model ?? singular(relationship));
    const modelImport = relativeImport(file, `src/models/${model}.ts`);
    const foreignKey = options.foreignKey ?? `${snake(owner)}_id`;
    const label = snake(model).replace(/_/g, ' ');
    if (options.relatedResource) {
        const related = studly(options.relatedResource);
        return {
            className, file,
            files: {
                [file]: `import { RelationManager } from '@navette-js/panels';
import { ${related} } from '${relativeImport(file, `src/${options.panel}/resources/${related}.ts`)}';

/** The ${relationship} of a ${snake(owner).replace(/_/g, ' ')}, managed by the nested ${related} (its table, form, labels and pages). */
export class ${className} extends RelationManager {
    static relatedResource = () => ${related};
}
`,
            },
        };
    }
    const tableName = plural(snake(model));
    const pivot = options.pivotTable ?? [snake(owner), snake(model)].sort().join('_');
    const actions = ['CreateAction', 'EditAction', 'DeleteAction', 'DeleteBulkAction'];
    if (options.view) actions.push('ViewAction');
    if (options.attach) actions.push('AttachAction', 'DetachAction', 'DetachBulkAction');
    if (options.associate) actions.push('AssociateAction', 'DissociateAction', 'DissociateBulkAction');
    if (options.softDeletes) actions.push('ForceDeleteAction', 'ForceDeleteBulkAction', 'RestoreAction', 'RestoreBulkAction');
    const tableImports = ['TextColumn', ...(options.softDeletes ? ['TrashedFilter'] : []), 'type Table'];
    const headerActions = [...(options.attach ? ['AttachAction.make()'] : []), ...(options.associate ? ['AssociateAction.make()'] : []), 'CreateAction.make()'];
    const recordActions = [...(options.view ? ['ViewAction.make()'] : []), 'EditAction.make()', ...(options.attach ? ['DetachAction.make()'] : []), ...(options.associate ? ['DissociateAction.make()'] : []), 'DeleteAction.make()', ...(options.softDeletes ? ['ForceDeleteAction.make()', 'RestoreAction.make()'] : [])];
    const bulkActions = [...(options.attach ? ['DetachBulkAction.make()'] : []), ...(options.associate ? ['DissociateBulkAction.make()'] : []), 'DeleteBulkAction.make()', ...(options.softDeletes ? ['ForceDeleteBulkAction.make()', 'RestoreBulkAction.make()'] : [])];
    const adapterOptions = options.softDeletes ? `, { softDeletes: 'deleted_at' }` : '';
    const adapter = options.attach
        ? `    // Many-to-many: the ${relationship} attached to the owner in the \`${pivot}\` pivot table.
    static adapterFor(ownerKey: string): DataAdapter {
        return new ObjectionAdapter(${model}, { ${options.softDeletes ? "softDeletes: 'deleted_at', " : ''}modify: (query) => { query.whereIn('${tableName}.id', ${model}.knex()('${pivot}').select('${snake(model)}_id').where('${foreignKey}', ownerKey)); } });
    }
    /** Records not attached yet. */
    private static attachable(ownerKey: string) { return ${model}.query().whereNotIn('${tableName}.id', ${model}.knex()('${pivot}').select('${snake(model)}_id').where('${foreignKey}', ownerKey)); }
    static async searchAttachable(ownerKey: string, search: string): Promise<[string, string][]> {
        const records = await this.attachable(ownerKey).whereRaw('lower(??) like ?', ['${titleAttribute}', \`%\${search.toLowerCase().replace(/[%_]/g, '')}%\`]).orderBy('${titleAttribute}').limit(50);
        return records.map((record: any): [string, string] => [String(record.id), String(record.${titleAttribute})]);
    }
    static async attachableLabel(ownerKey: string, recordKey: string): Promise<string | null> {
        const record: any = await this.attachable(ownerKey).findById(recordKey);
        return record ? String(record.${titleAttribute}) : null;
    }
    static async attach(ownerKey: string, recordKey: string): Promise<void> {
        if (await this.attachableLabel(ownerKey, recordKey)) await ${model}.knex()('${pivot}').insert({ ${foreignKey}: ownerKey, ${snake(model)}_id: recordKey });
    }
    static async detach(ownerKey: string, recordKeys: string[]): Promise<void> {
        if (recordKeys.length) await ${model}.knex()('${pivot}').where('${foreignKey}', ownerKey).whereIn('${snake(model)}_id', recordKeys).delete();
    }`
        : `    // One-to-many: the ${relationship} whose \`${foreignKey}\` is the owner's key (a new record gets it).
    static adapterFor(ownerKey: string): DataAdapter { return new ObjectionAdapter(${model}${adapterOptions}).scopedTo('${foreignKey}', ownerKey); }${options.associate ? `
    /** Records that belong to no owner yet, or to another one. */
    private static associable(ownerKey: string) { return ${model}.query().where((query) => { query.whereNull('${foreignKey}').orWhereNot('${foreignKey}', ownerKey); }); }
    static async searchAssociable(ownerKey: string, search: string): Promise<[string, string][]> {
        const records = await this.associable(ownerKey).whereRaw('lower(??) like ?', ['${titleAttribute}', \`%\${search.toLowerCase().replace(/[%_]/g, '')}%\`]).orderBy('${titleAttribute}').limit(50);
        return records.map((record: any): [string, string] => [String(record.id), String(record.${titleAttribute})]);
    }
    static async associableLabel(ownerKey: string, recordKey: string): Promise<string | null> {
        const record: any = await this.associable(ownerKey).findById(recordKey);
        return record ? String(record.${titleAttribute}) : null;
    }
    static async associate(ownerKey: string, recordKey: string): Promise<void> {
        if (await this.associableLabel(ownerKey, recordKey)) await ${model}.query().findById(recordKey).patch({ ${foreignKey}: ownerKey } as any);
    }
    static async dissociate(ownerKey: string, recordKeys: string[]): Promise<void> {
        if (recordKeys.length) await ${model}.query().where('${foreignKey}', ownerKey).whereIn('id', recordKeys).patch({ ${foreignKey}: null } as any);
    }` : ''}`;
    return {
        className, file,
        files: {
            [file]: `import { ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { ${actions.sort().join(', ')}, RelationManager } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { ${tableImports.join(', ')} } from '@navette-js/tables';
import { ${model} } from '${modelImport}';

/** The ${relationship} of a ${snake(owner).replace(/_/g, ' ')}: add it to \`static relations\` of ${owner}Resource. */
export class ${className} extends RelationManager {
    static relationship = '${relationship}';
    static modelLabel = '${label}';
    static recordTitleAttribute = '${titleAttribute}';
${adapter}

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('${titleAttribute}').required().maxLength(255),
        ]);
    }

    static table(table: Table<${model}>): Table<${model}> {
        return table
            .columns([
                TextColumn.make('${titleAttribute}').searchable().sortable(),
            ])${options.softDeletes ? `
            .filters([TrashedFilter.make()])` : ''}
            .headerActions([${headerActions.join(', ')}])
            .recordActions([${recordActions.join(', ')}])
            .groupedBulkActions([${bulkActions.join(', ')}]);
    }
}
`,
        },
    };
}

// ------------------------------------------------------------------ make:page --resource
export type ResourcePageType = 'ManageRelatedRecords' | 'EditRecord' | 'ViewRecord' | 'CreateRecord' | 'ListRecords';
export const RESOURCE_PAGE_TYPES: ResourcePageType[] = ['ManageRelatedRecords', 'EditRecord', 'ViewRecord', 'CreateRecord', 'ListRecords'];

/** A page of a resource; the resource lists it in `static relatedPages` (record pages) or `static pages` (list, create, edit, view). */
export function generateResourcePage(name: string, resource: string, type: ResourcePageType, options: { panel: string; relationship?: string; model?: string }): { files: GeneratedFiles; file: string; register: string } {
    const owner = studly(resource).replace(/Resource$/, '');
    const className = studly(name);
    const file = `src/${options.panel}/resources/${owner}/Pages/${className}.ts`;
    const routeName = kebab(className.replace(new RegExp(`^(Manage|Edit|View)${owner}`), '').replace(/^(Manage|Edit|View)/, '')) || 'details';
    if (type === 'ManageRelatedRecords') {
        const relationship = options.relationship ?? (routeName.replace(/-/g, '_'));
        const model = studly(options.model ?? singular(relationship));
        return {
            file,
            register: `static relatedPages = { '${routeName}': ${className} }   (and \`recordSubNavigation\` to show it in the record's tabs)`,
            files: {
                [file]: `import { ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { CreateAction, DeleteAction, DeleteBulkAction, EditAction, ManageRelatedRecords } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';
import { ${model} } from '${relativeImport(file, `src/models/${model}.ts`)}';

/** The ${relationship.replace(/_/g, ' ')} of a ${snake(owner).replace(/_/g, ' ')}, on a page of its own (\`${routeName}\` of ${owner}Resource's \`relatedPages\`). */
export class ${className} extends ManageRelatedRecords {
    static relationship = '${relationship}';
    static modelLabel = '${snake(model).replace(/_/g, ' ')}';
    static navigationIcon = 'o-rectangle-stack';
    static adapterFor(ownerKey: string): DataAdapter { return new ObjectionAdapter(${model}).scopedTo('${snake(owner)}_id', ownerKey); }

    static form(schema: Schema): Schema {
        return schema.components([TextInput.make('name').required().maxLength(255)]);
    }

    static table(table: Table<${model}>): Table<${model}> {
        return table
            .columns([TextColumn.make('name').searchable().sortable()])
            .headerActions([CreateAction.make()])
            .recordActions([EditAction.make(), DeleteAction.make()])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}
`,
            },
        };
    }
    const slot = { EditRecord: 'edit', ViewRecord: 'view', CreateRecord: 'create', ListRecords: 'index' }[type];
    const body = {
        EditRecord: `    // Hooks: mutateFormDataBeforeFill(), mutateFormDataBeforeSave(), beforeSave(), afterSave(), getRedirectUrl()…
    getHeaderActions(): Action[] { return super.getHeaderActions(); }`,
        ViewRecord: `    // Hooks: mutateFormDataBeforeFill(), beforeFill(), afterFill() (with the resource's form, when it has no infolist).
    getHeaderActions(): Action[] { return super.getHeaderActions(); }`,
        CreateRecord: `    // Hooks: mutateFormDataBeforeCreate(), beforeCreate(), afterCreate(), getRedirectUrl()…
    static canCreateAnother = true;`,
        ListRecords: `    getHeaderActions(): Action[] { return super.getHeaderActions(); }`,
    }[type];
    const imports = type === 'CreateRecord' ? `import { CreateRecord } from '@navette-js/panels';` : `import type { Action } from '@navette-js/actions';\nimport { ${type} } from '@navette-js/panels';`;
    return {
        file,
        register: type === 'EditRecord' || type === 'ViewRecord'
            ? `static pages = { ${slot}: ${className} }   (or, for another page of the record, static relatedPages = { '${routeName}': ${className} })`
            : `static pages = { ${slot}: ${className} }`,
        files: {
            [file]: `${imports}

/** ${headline(snake(className))}: a page of ${owner}Resource. */
export class ${className} extends ${type} {
${body}
}
`,
        },
    };
}

// ------------------------------------------------------------------ make:widget --resource
/** A widget of a resource, shown above its list (`static headerWidgets`) or on its record pages; stats widgets read the list's table. */
export function generateResourceWidget(name: string, resource: string, type: 'stats' | 'chart' | 'table', options: { panel: string }): { files: GeneratedFiles; file: string } {
    const owner = studly(resource).replace(/Resource$/, '');
    const className = studly(name);
    const file = `src/${options.panel}/resources/${owner}/Widgets/${className}.ts`;
    const resourceImport = relativeImport(file, `src/${options.panel}/resources/${owner}Resource.ts`);
    if (type === 'stats') {
        return {
            file,
            files: {
                [file]: `import { InteractsWithPageTable, Stat, StatsOverviewWidget, type ListRecords } from '@navette-js/panels';
import { ${owner}Resource } from '${resourceImport}';

/**
 * Stats of the ${owner}Resource list: the widget receives the table's search, filters and tab, so the numbers follow what the
 * table shows. List it in the resource's \`static widgets\` and \`static headerWidgets\`.
 */
export class ${className} extends InteractsWithPageTable(StatsOverviewWidget) {
    getTablePage(): typeof ListRecords { return ${owner}Resource.getPages().index as typeof ListRecords; }

    async getStats(): Promise<Stat[]> {
        const { count } = await this.getPageTableAdapter().aggregate(this.getPageTableQuery());
        return [
            Stat.make('Total', count),
        ];
    }
}
`,
            },
        };
    }
    if (type === 'chart') {
        return {
            file,
            files: {
                [file]: `import { ChartWidget, type ChartData } from '@navette-js/panels';

/** Chart of ${owner}Resource: list it in the resource's \`static widgets\`, and \`static headerWidgets\` (or a page's getHeaderWidgets()). */
export class ${className} extends ChartWidget {
    static heading = '${headline(snake(className))}';

    getType(): string { return 'line'; }

    async getData(): Promise<ChartData> {
        return {
            datasets: [{ label: 'Items', data: [3, 8, 5, 12, 9, 14] }],
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        };
    }
}
`,
            },
        };
    }
    return {
        file,
        files: {
            [file]: `import type { DataAdapter } from '@navette-js/database';
import { TableWidget } from '@navette-js/panels';
import { TextColumn, type Table } from '@navette-js/tables';
import { ${owner}Resource } from '${resourceImport}';

/** Table of ${owner}Resource records: list it in the resource's \`static widgets\`, and \`static headerWidgets\`. */
export class ${className} extends TableWidget {
    static heading = '${headline(snake(className))}';

    getDataAdapterForTable(): DataAdapter { return ${owner}Resource.adapter; }

    table(table: Table<any>): Table<any> {
        return table.columns([TextColumn.make('id')]);
    }
}
`,
        },
    };
}

// ------------------------------------------------------------------ make:theme
/** A Tailwind theme for a panel: the stylesheet, and the npm script compiling it. */
export function generateTheme(panel: string): { files: GeneratedFiles; script: { name: string; command: string }; url: string } {
    const source = `resources/css/${panel}/theme.css`;
    const output = `storage/public/css/${panel}/theme.css`;
    return {
        files: {
            [source]: `/* Theme of the ${panel} panel: the panel stylesheet plus the Tailwind classes used by your own code. */
@import '@navette-js/panels/theme.css';

/* Where your classes are: resources, pages, widgets, components and views of the panel. */
@source '../../../src/${panel}/**/*.ts';
@source '../../../src/components/**/*.ejs';
@source '../../../src/views/**/*.ejs';

/* Your own CSS, e.g. a rounder look: */
/* .fi-btn { border-radius: var(--radius-full); } */
`,
        },
        script: { name: `build:theme:${panel}`, command: `tailwindcss -i ${source} -o ${output} --minify` },
        url: `/storage/css/${panel}/theme.css`,
    };
}
