// CLI file generators: resources (form and table inferred from the database columns), pages, widgets, migrations.

export type ColumnInfo = { name: string; type: string; nullable: boolean };

/** `blog post` → `BlogPost`. */
export const studly = (value: string): string => value.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase());
const snake = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const plural = (value: string) => (/[^aeiou]y$/.test(value) ? value.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/.test(value) ? value + 'es' : value + 's');
/** `BlogPost` → `blog_posts`. */
export const tableName = (model: string) => plural(snake(model));
const headline = (column: string) => column.replace(/_id$/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

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

/** Resource and model. Without known columns (no `--generate`), the form and table are placeholders to fill in. */
export function generateResource(model: string, table: string, columns: ColumnInfo[] | null): { model: string; resource: string } {
    const editable = (columns ?? []).filter((column) => !SKIPPED.has(column.name));
    const titleAttribute = editable.find((column) => ['name', 'title', 'label', 'subject'].includes(column.name))?.name ?? null;
    const kinds = new Set(editable.map(kindOf));
    const formImports = ['TextInput', ...(kinds.has('boolean') ? ['Toggle'] : []), ...(kinds.has('date') ? ['DatePicker'] : []), ...(kinds.has('dateTime') ? ['DateTimePicker'] : []), ...(kinds.has('longText') ? ['Textarea'] : [])];
    const tableImports = ['TextColumn', ...(kinds.has('boolean') ? ['IconColumn'] : []), 'type Table'];
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
    const resourceCode = `import { ObjectionAdapter } from '@navette-js/database';
import { ${formImports.join(', ')} } from '@navette-js/forms';
import { DeleteBulkAction, Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { ${tableImports.join(', ')} } from '@navette-js/tables';
import { ${model} } from '../../models/${model}.ts';

export class ${model}Resource extends Resource {
    static slug = '${table.replace(/_/g, '-')}';
    static modelLabel = '${snake(model).replace(/_/g, ' ')}';
    static navigationIcon = 'o-rectangle-stack';
${titleAttribute ? `    static recordTitleAttribute = '${titleAttribute}';\n` : ''}    static adapter = new ObjectionAdapter(${model});

    static form(schema: Schema): Schema {
        return schema.components([
${fields}
        ]);
    }

    static table(table: Table<${model}>): Table<${model}> {
        return table
            .columns([
${cols}${createdColumn}
            ])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
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
