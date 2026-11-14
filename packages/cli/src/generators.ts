// CLI file generators: resources (form and table inferred from the database columns), pages, widgets, migrations.

export type ColumnInfo = { name: string; type: string; nullable: boolean };

/** `blog post` → `BlogPost`. */
export const studly = (value: string): string => value.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase());
export const snake = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
export const plural = (value: string) => (/[^aeiou]y$/.test(value) ? value.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/.test(value) ? value + 'es' : value + 's');
const camel = (value: string) => studly(value).replace(/^./, (c) => c.toLowerCase());
/** `BlogPost` → `blog_posts`. */
export const tableName = (model: string) => plural(snake(model));
export const headline = (column: string) => column.replace(/_id$/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Columns never edited in a form. */
const SKIPPED = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'password', 'remember_token', 'email_verified_at']);
type Kind = 'text' | 'longText' | 'number' | 'boolean' | 'date' | 'dateTime' | 'email';
function kindOf(column: ColumnInfo): Kind {
    const type = column.type.toLowerCase();
    if (/bool/.test(type) || (type === 'tinyint' && /^(is|has|can)_/.test(column.name))) return 'boolean';
    if (/^date$/.test(type)) return 'date';
    if (/datetime|timestamp/.test(type)) return 'dateTime';
    if (/int|decimal|numeric|float|double|real/.test(type)) return 'number';
    if (/text|json|clob/.test(type)) return 'longText';
    if (/email/.test(column.name)) return 'email';
    return 'text';
}

function formField(column: ColumnInfo): string {
    const label = column.name;
    const required = column.nullable ? '' : '.required()';
    switch (kindOf(column)) {
        case 'boolean': return `Toggle.make('${label}')`;
        case 'date': return `DatePicker.make('${label}')${required}`;
        case 'dateTime': return `DateTimePicker.make('${label}')${required}`;
        case 'number': return `TextInput.make('${label}').numeric()${required}`;
        case 'longText': return `Textarea.make('${label}')${required}.columnSpanFull()`;
        case 'email': return `TextInput.make('${label}').email()${required}.maxLength(255)`;
        default: return `TextInput.make('${label}')${required}.maxLength(255)`;
    }
}
function tableColumn(column: ColumnInfo): string {
    const name = column.name;
    switch (kindOf(column)) {
        case 'boolean': return `IconColumn.make('${name}').boolean()`;
        case 'date': return `TextColumn.make('${name}').date().sortable()`;
        case 'dateTime': return `TextColumn.make('${name}').dateTime().sortable()`;
        case 'number': return `TextColumn.make('${name}').numeric().sortable()`;
        case 'longText': return `TextColumn.make('${name}').limit(50)`;
        default: return `TextColumn.make('${name}').searchable().sortable()`;
    }
}

/**
 * Options of a generated resource: `simple` (a single page, create and edit in modals), `view` (a view page and its infolist),
 * `softDeletes` (trashed filter, restore and force-delete actions), `nested` (the parent resource it is nested in).
 */
export type ResourceOptions = { simple?: boolean; view?: boolean; softDeletes?: boolean; nested?: string | null };

/** Resource and model. Without known columns (no `--generate`), the form and table are placeholders to fill in. */
export function generateResource(model: string, table: string, columns: ColumnInfo[] | null, options: ResourceOptions = {}): { model: string; resource: string } {
    const editable = (columns ?? []).filter((column) => !SKIPPED.has(column.name));
    const titleAttribute = editable.find((column) => ['name', 'title', 'label', 'subject'].includes(column.name))?.name ?? null;
    const kinds = new Set(editable.map(kindOf));
    const formImports = ['TextInput', ...(kinds.has('boolean') ? ['Toggle'] : []), ...(kinds.has('date') ? ['DatePicker'] : []), ...(kinds.has('dateTime') ? ['DateTimePicker'] : []), ...(kinds.has('longText') ? ['Textarea'] : [])];
    const tableImports = ['TextColumn', ...(kinds.has('boolean') ? ['IconColumn'] : []), ...(options.softDeletes ? ['TrashedFilter'] : []), 'type Table'];
    const panelImports = ['DeleteBulkAction', ...(options.softDeletes ? ['ForceDeleteBulkAction', 'RestoreBulkAction'] : []), 'Resource'];
    const entryImports = options.view ? ['TextEntry'] : [];
    const parent = options.nested ? studly(options.nested).replace(/Resource$/, '') + 'Resource' : null;
    const timestamps = (columns ?? []).some((column) => column.name === 'created_at');
    const modelCode = `import { Model } from '@navette-js/database';

export class ${model} extends Model {
    static tableName = '${table}';
${timestamps ? `
    $beforeInsert(): void { (this as any).created_at = (this as any).updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { (this as any).updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
` : ''}}
`;
    const fields = editable.length ? editable.map((column) => `                ${formField(column)},`).join('\n') : `                TextInput.make('name').required().maxLength(255),`;
    const cols = editable.length ? editable.filter((column) => kindOf(column) !== 'longText' || editable.length < 4).slice(0, 6).map((column) => `                ${tableColumn(column)},`).join('\n') : `                TextColumn.make('name').searchable().sortable(),`;
    const createdColumn = timestamps ? `\n                TextColumn.make('created_at').dateTime().sortable().toggleable(true, { isToggledHiddenByDefault: true }),` : '';
    const entries = editable.length ? editable.slice(0, 8).map((column) => `                TextEntry.make('${column.name}'),`).join('\n') : `                TextEntry.make('name'),`;
    const infolist = options.view ? `

    static infolist(schema: Schema): Schema {
        return schema.components([
${entries}
        ]);
    }` : '';
    const resourceCode = `import { ObjectionAdapter } from '@navette-js/database';
import { ${formImports.join(', ')} } from '@navette-js/forms';
${entryImports.length ? `import { ${entryImports.join(', ')} } from '@navette-js/infolists';\n` : ''}import { ${panelImports.join(', ')} } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { ${tableImports.join(', ')} } from '@navette-js/tables';
import { ${model} } from '../../models/${model}.ts';
${parent ? `import { ${parent} } from './${parent}.ts';\n` : ''}
export class ${model}Resource extends Resource {
    static slug = '${table.replace(/_/g, '-')}';
    static modelLabel = '${snake(model).replace(/_/g, ' ')}';
    static navigationIcon = 'o-rectangle-stack';
${titleAttribute ? `    static recordTitleAttribute = '${titleAttribute}';\n` : ''}${parent ? `    // Nested in ${parent}: served at /<parent>/{record}/${table.replace(/_/g, '-')}; list its records with a relation manager of ${parent}
    // (\`static relatedResource = () => ${model}Resource\`, \`npx navette make:relation-manager ${parent} ${camel(table)} --related-resource=${model}Resource\`).
    static parentResource = () => ${parent};
` : ''}${options.simple ? '    // A single page: records are created and edited in modals.\n    static isSimple = true;\n' : ''}${options.view ? '    // A view page: table rows open it, with the infolist below.\n    static hasViewPage = true;\n' : ''}    static adapter = new ObjectionAdapter(${model}${options.softDeletes ? `, { softDeletes: 'deleted_at' }` : ''});

    static form(schema: Schema): Schema {
        return schema.components([
${fields}
        ]);
    }

    static table(table: Table<${model}>): Table<${model}> {
        return table
            .columns([
${cols}${createdColumn}
            ])${options.softDeletes ? `
            // Deleted records: shown with the trashed filter, restored or deleted for good from their edit page or in bulk.
            .filters([TrashedFilter.make()])
            .groupedBulkActions([DeleteBulkAction.make(), ForceDeleteBulkAction.make(), RestoreBulkAction.make()]);` : `
            .groupedBulkActions([DeleteBulkAction.make()]);`}
    }${infolist}
}
`;
    return { model: modelCode, resource: resourceCode };
}

export function generateMigration(name: string): string {
    const created = /^create_(\w+)_table$/.exec(name)?.[1];
    return `import type { Knex } from '@navette-js/database';

export async function up(db: Knex): Promise<void> {
${created ? `    await db.schema.createTable('${created}', (table) => {
        table.increments('id');
        table.string('name');
        table.timestamps();
    });` : `    // await db.schema.alterTable('table', (table) => { … });`}
}
`;
}

export function generatePage(name: string): string {
    const slug = snake(name).replace(/_/g, '-');
    return `import { Page } from '@navette-js/panels';
import { Section, Text, type Schema } from '@navette-js/schemas';

export class ${name} extends Page {
    static slug = '${slug}';
    static title = '${headline(snake(name))}';
    static navigationIcon = 'o-document-text';

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Section.make('${headline(snake(name))}').schema([
                Text.make('Start building your page here.'),
            ]),
        ]);
    }
}
`;
}

/** `RevenueOverview` → `revenue-overview`, `CreatePost` → `create-post` (Livewire component and view file names). */
export const kebab = (value: string): string => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').toLowerCase();

/**
 * JavaScript widget (`make:widget <Name> --js`): the widget class, which registers its renderer module as an asset loaded on
 * request, and its framework-free renderer module. Paths are relative to the project root.
 */
export function generateJsWidget(name: string, panel: string): { classFile: string; rendererFile: string; files: Record<string, string> } {
    const id = kebab(name);
    const classFile = `src/${panel}/widgets/${name}.ts`;
    const rendererFile = `resources/js/${panel}/widgets/${id}.js`;
    const assetId = `${panel}/widgets/${id}`;
    const widget = `import { fileURLToPath } from 'node:url';
import { Js, JsWidget, NavetteAsset } from '@navette-js/panels';

// The renderer module: served by the panel, and only loaded by the pages showing this widget.
NavetteAsset.register([
    Js.make('${assetId}', fileURLToPath(new URL('../../../${rendererFile}', import.meta.url))).loadedOnRequest(),
]);

export class ${name} extends JsWidget {
    getRenderer(): string {
        return NavetteAsset.getScriptSrc('${assetId}');
    }

    // Received by the renderer as \`props.configuration\`: JSON values only, and only what the user may see.
    getRendererConfiguration(): Record<string, unknown> {
        return {
            heading: '${headline(snake(name))}',
            description: 'Widget description',
        };
    }
}
`;
    const renderer = `/** @param {import('@navette-js/panels').JsWidgetRendererContext} context */
export default function mount${name}({ host, props: initialProps }) {
    const heading = document.createElement('h2')
    const paragraph = document.createElement('p')

    const update = ({ configuration }) => {
        heading.textContent = configuration.heading ?? 'Widget heading'
        paragraph.textContent = configuration.description ?? 'Widget description'
    }

    update(initialProps)
    host.append(heading, paragraph)

    return { update, destroy: () => host.replaceChildren() }
}
`;
    return { classFile, rendererFile, files: { [classFile]: widget, [rendererFile]: renderer } };
}

export function generateWidget(name: string, type: 'stats' | 'chart' | 'table'): string {
    if (type === 'chart') return `import { ChartWidget, type ChartData } from '@navette-js/panels';

export class ${name} extends ChartWidget {
    static heading = '${headline(snake(name))}';

    getType(): string { return 'line'; }

    async getData(): Promise<ChartData> {
        return {
            datasets: [{ label: 'Items', data: [3, 8, 5, 12, 9, 14] }],
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        };
    }
}
`;
    if (type === 'table') return `import { TableWidget } from '@navette-js/panels';
import type { DataAdapter } from '@navette-js/database';
import { TextColumn, type Table } from '@navette-js/tables';

export class ${name} extends TableWidget {
    static heading = '${headline(snake(name))}';

    // Return the adapter of the records to list, e.g. \`new ObjectionAdapter(Order)\`.
    getDataAdapterForTable(): DataAdapter { throw new Error('${name}: return a data adapter from getDataAdapterForTable().'); }

    table(table: Table<any>): Table<any> {
        return table.columns([TextColumn.make('name')]);
    }
}
`;
    return `import { Stat, StatsOverviewWidget } from '@navette-js/panels';

export class ${name} extends StatsOverviewWidget {
    async getStats(): Promise<Stat[]> {
        return [
            Stat.make('Users', 0),
        ];
    }
}
`;
}

/** A custom form field: an Alpine.js control entangled with the field's state, validated on the server. */
export function generateField(name: string): string {
    return `import { Field, type Rule } from '@navette-js/forms';
import { configured, e, js } from '@navette-js/support';

/**
 * ${headline(snake(name))} field. Use it like any field: \`${name}.make('name').required()\`.
 * The state comes from the browser: check its shape in getValidationRules() before it is saved.
 */
export class ${name} extends Field {
    static make(name: string): ${name} {
        return configured(new ${name}(name));
    }

    async getValidationRules(): Promise<Rule[]> {
        return [
            ...(await super.getValidationRules()),
            { name: 'string', passes: (value) => typeof value === 'string', message: (attribute) => \`The \${attribute} field must be a string.\` },
        ];
    }

    async toHtml(): Promise<string> {
        const id = this.getId();
        const disabled = await this.isDisabled();

        return this.wrap(
            \`<div class="nv-input-wrp\${this.hasError() ? ' nv-invalid' : ''}" x-data="{ state: $wire.$entangle(\${e(js(this.getStatePath()))}) }">
                <div class="nv-input-wrp-content-ctn">
                    <input id="\${e(id)}" type="text" class="nv-input" x-model="state"\${disabled ? ' disabled' : ''}\${this.hasError() ? \` aria-invalid="true" aria-describedby="\${e(id)}-error"\` : ''} />
                </div>
            </div>\`,
        );
    }
}
`;
}

export function generateEntry(name: string): string {
    return `import { ViewEntry } from '@navette-js/infolists';
import { configured, e } from '@navette-js/support';

/** ${headline(snake(name))} infolist entry: \`${name}.make('field')\`. */
export class ${name} extends ViewEntry {
    static make(name: string): ${name} {
        return configured(new ${name}(name));
    }

    async toHtml(): Promise<string> {
        const state = await this.getState();

        // \`wrap()\` adds the label and the entry wrapper. Escape every value you print with \`e()\`.
        return this.wrap(\`<span>\${e(state ?? '')}</span>\`);
    }
}
`;
}

export function generateColumn(name: string): string {
    return `import { configured, e } from '@navette-js/support';
import { Column } from '@navette-js/tables';

/** ${headline(snake(name))} table column: \`${name}.make('field')\`. */
export class ${name}<R = any> extends Column<R> {
    static make<R = any>(name: string): ${name}<R> {
        return configured(new ${name}<R>(name));
    }

    // Returns the HTML of the cell. Escape every value you print with \`e()\`.
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);

        return \`<div class="nv-ta-text"><span>\${e(state ?? '')}</span></div>\`;
    }
}
`;
}

/** Component view: `<x-name>` in any view, after `views.components(directory)` (done by the generated server). */
export function generateComponent(name: string): string {
    return `<%#
    <x-${name} title="…">content</x-${name}>
    Variables: the tag's props (camelCased), \`slot\` (the content, already rendered), \`slots\` (named slots: <x-slot name="footer">),
    \`attributes\` (class, id, data-*, x-*, wire:* attributes given on the tag).
    Output tags: the escaping one (percent sign and equals) for values, the raw one (percent sign and dash) only for slots and trusted markup.
%>
<div <%- attributes.class(['${name}']) %>>
    <% if (locals.title) { %><h3><%= title %></h3><% } %>
    <%- slot %>
    <% if (slots.footer) { %><footer><%- slots.footer %></footer><% } %>
</div>
`;
}

/** Schema component class (`make:schema-component`): a `Component` with a configuration method that accepts a function. */
export function generateSchemaComponent(name: string): string {
    return `import { Component, type ComponentContext } from '@navette-js/schemas';
import { configured, e, evaluate, type Lazy } from '@navette-js/support';

/**
 * ${headline(snake(name))} schema component: \`${name}.make().heading('…')\`, in any form, infolist or page schema.
 * See "Custom components" in the schemas documentation: configuration methods, context, child components, exposed methods.
 */
export class ${name} extends Component {
    private headingValue: Lazy<string | null, ComponentContext> = null;

    static make(): ${name} {
        return configured(new ${name}());
    }

    /** A static value, or a function of the context: \`({ record, get, operation }) => …\`. */
    heading(heading: Lazy<string | null, ComponentContext>): this {
        this.headingValue = heading;

        return this;
    }

    // Returns the HTML of the component. Escape every value you print with \`e()\`.
    async toHtml(): Promise<string> {
        const heading = await evaluate(this.headingValue, this.context());

        return \`<div class="${snake(name).replace(/_/g, '-')}">\${heading ? \`<h3>\${e(heading)}</h3>\` : ''}</div>\`;
    }
}
`;
}

/**
 * A plugin package in `plugins/<id>/`: a panel plugin (plugin class with an option, a page, a view and translations), or with
 * `standalone`, a schema component usable in any form, infolist or page. Returns the files, by path inside the package.
 */
export function generatePlugin(name: string, options: { standalone?: boolean } = {}): { id: string; className: string; files: Record<string, string> } {
    const base = name.replace(/Plugin$/, '') || name;
    const id = snake(base).replace(/_/g, '-');
    const title = headline(snake(base));
    const files: Record<string, string> = {};
    const packageJson = (description: string, peers: string[], folders: string[]) => JSON.stringify({
        name: id, version: '0.1.0', private: true, description, license: 'MIT', type: 'module',
        exports: { '.': './src/index.ts' },
        files: ['src', ...folders],
        peerDependencies: Object.fromEntries(peers.map((peer) => [peer, '*'])),
    }, null, 4) + '\n';
    if (options.standalone) {
        const className = base;
        files['package.json'] = packageJson(`${title}: a schema component for Navette.`, ['@navette-js/schemas', '@navette-js/support'], ['views']);
        files['src/index.ts'] = `// ${title}: a schema component for Navette, usable in any form, infolist or page.
import { views } from '@navette-js/support';

// The package's views, rendered as \`${id}::<name>\`. An application may override them with \`views.overrideFrom(dir)\`.
views.namespace('${id}', new URL('../views', import.meta.url));

export { ${className} } from './${className}.ts';
`;
        files[`src/${className}.ts`] = `import { Component, type ComponentContext } from '@navette-js/schemas';
import { configured, evaluate, views, type Lazy } from '@navette-js/support';

/** ${title} component: \`${className}.make().content('Hello')\`. */
export class ${className} extends Component {
    protected _content: Lazy<string, ComponentContext> = '';

    static make(): ${className} {
        return configured(new ${className}());
    }

    /** A function receives the schema's context object (\`record\`, \`get\`, \`operation\`…). */
    content(content: Lazy<string, ComponentContext>): this {
        this._content = content;
        return this;
    }

    async toHtml(): Promise<string> {
        // The view escapes the content: print values with the escaping output tag only.
        return views.render('${id}::${id}', { content: String((await evaluate(this._content, this.context())) ?? '') });
    }
}
`;
        files[`views/${id}.ejs`] = `<%# ${title} component. Variables: content (text). %>
<div class="${id}"><%= content %></div>
`;
        files['README.md'] = `# ${title}

A schema component for Navette panels, forms and infolists.

\`\`\`ts
import { ${className} } from '${id}';

${className}.make().content('Hello');
\`\`\`
`;
        return { id, className, files };
    }
    const className = `${base}Plugin`;
    const pageClass = `${base}Page`;
    files['package.json'] = packageJson(`${title}: a panel plugin for Navette.`, ['@navette-js/panels', '@navette-js/support'], ['views', 'lang']);
    files['src/index.ts'] = `// ${title}: a panel plugin for Navette.
import { views } from '@navette-js/support';
import { loadTranslationsFrom } from '@navette-js/support/i18n';

// The package's views (\`${id}::page\`) and translations (\`${id}::${id}.title\`), registered once when the package is imported.
views.namespace('${id}', new URL('../views', import.meta.url));
loadTranslationsFrom(new URL('../lang', import.meta.url), '${id}');

export { ${className} } from './${className}.ts';
export { ${pageClass} } from './${pageClass}.ts';
`;
    files[`src/${className}.ts`] = `import { PanelPlugin, type Panel } from '@navette-js/panels';
import { ${pageClass} } from './${pageClass}.ts';

/**
 * Add it to a panel: \`panel.plugin(${className}.make())\`. Read its options anywhere during a request of that panel with
 * \`${className}.get()\`.
 */
export class ${className} extends PanelPlugin {
    protected _hasPage = true;

    getId(): string {
        return '${id}';
    }

    /** Whether the plugin adds its page to the panel. */
    page(condition = true): this {
        this._hasPage = condition;
        return this;
    }

    hasPage(): boolean {
        return this._hasPage;
    }

    /** Called by \`panel.plugin()\`: register resources, pages, widgets, render hooks, navigation items… */
    register(panel: Panel): void {
        if (this.hasPage()) {
            panel.pages([${pageClass}]);
        }
    }

    /** Called once, when \`panelRouter()\` serves the panel. Per-request work goes in \`panel.bootUsing()\`. */
    boot(_panel: Panel): void {
    }
}
`;
    files[`src/${pageClass}.ts`] = `import { Page } from '@navette-js/panels';
import { t } from '@navette-js/support/i18n';

export class ${pageClass} extends Page {
    static slug = '${id}';
    static navigationIcon = 'o-puzzle-piece';
    static view = '${id}::page';

    static getTitle(): string {
        return this.title ?? t('${id}::${id}.title');
    }

    getViewData(): Record<string, unknown> {
        return { message: t('${id}::${id}.message') };
    }
}
`;
    files['views/page.ejs'] = `<%# Page of the ${title} plugin. Variables: page, message. %>
<x-section :heading="page.getTitle()">
    <p><%= message %></p>
</x-section>
`;
    files[`lang/en/${id}.json`] = JSON.stringify({ title: title, message: `This page is added by the ${title} plugin.` }, null, 4) + '\n';
    files['README.md'] = `# ${title}

A panel plugin for Navette.

\`\`\`ts
import { ${className} } from '${id}';

panel.plugin(${className}.make());
\`\`\`

Translations live in \`lang/<locale>/${id}.json\` (keys \`${id}::${id}.title\`, \`${id}::${id}.message\`), views in \`views/\`.
`;
    return { id, className, files };
}

/** Form fields and their imports, from the database columns (or one placeholder field). */
function formFieldsOf(columns: ColumnInfo[] | null): { imports: string[]; fields: string } {
    const editable = (columns ?? []).filter((column) => !SKIPPED.has(column.name));
    const kinds = new Set(editable.map(kindOf));
    const imports = ['TextInput', ...(kinds.has('boolean') ? ['Toggle'] : []), ...(kinds.has('date') ? ['DatePicker'] : []), ...(kinds.has('dateTime') ? ['DateTimePicker'] : []), ...(kinds.has('longText') ? ['Textarea'] : [])];
    const fields = editable.length ? editable.map((column) => `            ${formField(column)},`).join('\n') : `            TextInput.make('name').required().maxLength(255),`;
    return { imports, fields };
}

/**
 * A component with a form, rendered outside a panel (`make:livewire-form`): its class and its view. With a model, the form
 * creates a record (or edits one, with `edit`); `columns` (`--generate`) gives the fields.
 */
export function generateLivewireForm(name: string, model: string | null, columns: ColumnInfo[] | null, options: { edit?: boolean } = {}): { component: string; view: string } {
    const { imports, fields } = formFieldsOf(columns);
    const view = kebab(name);
    const edit = Boolean(options.edit && model);
    const formImports = [...imports, 'fillSchema', 'fillSchemaFromRecord', 'getSchemaState', 'validateSchema'].filter((item) => edit || item !== 'fillSchemaFromRecord');
    const component = `import { ${formImports.join(', ')} } from '@navette-js/forms';
import { Notification } from '@navette-js/panels';
import { LivewireComponent } from '@navette-js/panels/livewire';
import type { Schema } from '@navette-js/schemas';
${model ? `import { ObjectionAdapter } from '@navette-js/database';\n${edit ? `import { WireError } from '@navette-js/wire';\n` : ''}import { ${model} } from '../models/${model}.ts';\n` : ''}
/**
 * A form outside any panel. Register it with \`livewire.components([${name}])\`, then serve it as a page
 * (\`app.get('/${view}${edit ? '/:record' : ''}', livewire.page(${name}))\`) or embed it: \`await livewire.mount('${view}', ${edit ? '{ record }' : '{}'}, req, res)\`.
 */
export class ${name} extends LivewireComponent {
    static view = new URL('./${view}.ejs', import.meta.url);
    /** Methods the browser may call. */
    static callable = ['${edit ? 'save' : 'create'}'];
${edit ? `    /** The key of the edited record: set on mount, never by the browser. */
    static locked = ['record'];
    record = '';
` : ''}    data: Record<string, unknown> = {};

    async mount(${edit ? '{ record }: Record<string, unknown>' : ''}): Promise<void> {
${edit ? `        this.record = String(record ?? '');
        // Authorize the user here: the record comes from the URL.
        const found = await new ObjectionAdapter(${model}).find(this.record);
        if (!found) throw new WireError(404, 'Record not found.');
        fillSchemaFromRecord(this.getSchema('form'), this.data, found as unknown as Record<string, unknown>);
` : `        fillSchema(this.getSchema('form'), this.data);
`}    }

    formSchema(schema: Schema): Schema {
        return schema.components([
${fields.replace(/^ {12}/gm, '            ')}
        ]);
    }

    async ${edit ? 'save' : 'create'}(): Promise<void> {
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) return;
        const data = await getSchemaState(form);
${model ? (edit ? `        await new ObjectionAdapter(${model}).update(this.record, data);
        Notification.make().success().title('Saved').send();` : `        await new ObjectionAdapter(${model}).create(data);
        fillSchema(form, (this.data = {}));
        Notification.make().success().title('Created').send();`) : `        // Use the validated data here.
        console.log(data);
        Notification.make().success().title('Submitted').send();`}
    }
}
`;
    const viewCode = `<div>
    <form wire:submit="${edit ? 'save' : 'create'}">
        <%- await schema('form') %>

        <div style="margin-top: 1.5rem;">
            <x-button type="submit">${edit ? 'Save' : 'Submit'}</x-button>
        </div>
    </form>

    <%- await modals() %>
</div>
`;
    return { component, view: viewCode };
}

/** A component with a table, rendered outside a panel (`make:livewire-table`); `columns` (`--generate`) gives the table columns. */
export function generateLivewireTable(name: string, model: string | null, columns: ColumnInfo[] | null): { component: string } {
    const listed = (columns ?? []).filter((column) => !SKIPPED.has(column.name) || column.name === 'created_at');
    const kinds = new Set(listed.map(kindOf));
    const tableImports = ['TextColumn', ...(kinds.has('boolean') ? ['IconColumn'] : []), 'type Table'];
    const cols = listed.length ? listed.filter((column) => kindOf(column) !== 'longText' || listed.length < 4).slice(0, 6).map((column) => `                ${tableColumn(column)},`).join('\n') : `                TextColumn.make('name').searchable().sortable(),`;
    const view = kebab(name);
    const component = `import { ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { TableComponent } from '@navette-js/panels/livewire';
import { ${tableImports.join(', ')} } from '@navette-js/tables';
${model ? `import { ${model} } from '../models/${model}.ts';\n` : ''}
/**
 * A table outside any panel. Register it with \`livewire.components([${name}])\`, then serve it as a page
 * (\`app.get('/${view}', livewire.page(${name}))\`) or embed it: \`await livewire.mount('${view}', {}, req, res)\`.
 */
export class ${name} extends TableComponent {
    table(table: Table): Table {
        return table
            .columns([
${cols}
            ])
            .filters([
                // ...
            ])
            .recordActions([
                // ...
            ])
            .toolbarActions([
                // ...
            ]);
    }

    getDataAdapterForTable(): DataAdapter {
        return new ObjectionAdapter(${model ?? 'Model /* your model */'});
    }
}
`;
    if (model) return { component };
    // Without a model: a placeholder one, to replace with yours.
    return { component: component
        .replace("import { ObjectionAdapter, type DataAdapter } from '@navette-js/database';", "import { Model, ObjectionAdapter, type DataAdapter } from '@navette-js/database';")
        .replace('/**\n * A table outside', `/** The records of the table: replace it with your model. */\nclass Item extends Model { static tableName = 'items'; }\n\n/**\n * A table outside`)
        .replace('Model /* your model */', 'Item') };
}
export type { GeneratorName, GeneratorOverride, GeneratorOverrides } from './overrides.ts';
export * from './panel-generators.ts';
