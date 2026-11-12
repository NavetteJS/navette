// Équivalent de App\Filament\Resources\HR\Departments\DepartmentResource de la démo Filament (resource « simple » : ManageDepartments).
import { Model, ObjectionAdapter } from '@navette-js/database';
import { Action, ActionGroup } from '@navette-js/actions';
import { ColorPicker, Select, Textarea, TextInput, Toggle } from '@navette-js/forms';
import { EditAction, Notification, Resource } from '@navette-js/panels';
import { t } from '@navette-js/support/i18n';
import { randomBytes } from 'node:crypto';
import type { Schema } from '@navette-js/schemas';
import { ColorColumn, IconColumn, TextColumn, type Table } from '@navette-js/tables';

export class Department extends Model {
    static tableName = 'departments';
    id!: number;
    parent_id!: number | null;
    name!: string;
    slug!: string;
    description!: string | null;
    budget!: number | null;
    headcount_limit!: number | null;
    color!: string | null;
    is_active!: number | boolean;
    created_at!: string;
    updated_at!: string;
    // Colonnes calculées par la requête de liste.
    parent_name?: string | null;
    employees_count?: number;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    /** Équivalent du cast `boolean` d'Eloquent : SQLite stocke 0 ou 1. */
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.is_active === 'boolean') out.is_active = out.is_active ? 1 : 0;
        return out;
    }
}

const slugify = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export class DepartmentResource extends Resource {
    static slug = 'hr/departments';
    static modelLabel = 'department';
    static navigationIcon = 'o-building-office-2';
    static navigationGroup = 'HR';
    static navigationSort = 1;
    static recordTitleAttribute = 'name';
    static globalSearchSort = 4;
    static isSimple = true;
    // `parent.name` et `employees_count` (équivalent de `->counts('employees')`) : sous-requêtes, sans jointure.
    static adapter = new ObjectionAdapter(Department, {
        modify: (query) => {
            const knex = Department.knex();
            query.select(
                'departments.*',
                knex('departments as parents').select('parents.name').whereRaw('parents.id = departments.parent_id').as('parent_name'),
                knex('employees').count('*').whereRaw('employees.department_id = departments.id').whereNull('employees.deleted_at').as('employees_count'),
            );
        },
    });

    /** Équivalent de Schemas\DepartmentForm. */
    static form(schema: Schema): Schema {
        return schema
            .columns(2)
            .components([
                TextInput.make('name').required().maxLength(255).live({ onBlur: true })
                    // À la création seulement : le slug suit le nom.
                    .afterStateUpdated(({ operation, state, set }) => { if (operation === 'create') set('slug', slugify(String(state ?? ''))); }),
                TextInput.make('slug').disabled().dehydrated().required().maxLength(255).unique({ ignoreRecord: true }),
                Select.make('parent_id').label('Parent department')
                    // `relationship('parent', 'name', …whereNull('parent_id'))` : seuls les services de premier niveau.
                    .options(async () => (await Department.query().whereNull('parent_id').orderBy('name')).map((d): [string, string] => [String(d.id), d.name]))
                    .searchable().preload().columnSpanFull(),
                Textarea.make('description').rows(3).maxLength(65535).columnSpanFull(),
                TextInput.make('budget').required().numeric().prefix('$').minValue(0).maxValue(9999999999.99).default(0),
                TextInput.make('headcount_limit').required().integer().minValue(0).maxValue(2147483647).default(0),
                ColorPicker.make('color'),
                Toggle.make('is_active').label('Active').default(true).columnStart(1),
            ]);
    }

    static table(table: Table<Department>): Table<Department> {
        return table
            .columns([
                TextColumn.make<Department>('name').searchable().sortable().weight('medium'),
                TextColumn.make<Department>('parent.name').label('Parent').getStateUsing(({ record }) => record.parent_name ?? null).placeholder('Top level').toggleable(),
                TextColumn.make<Department>('employees_count').label('Headcount').alignEnd(),
                TextColumn.make<Department>('budget').money('usd').alignEnd().sortable(),
                ColorColumn.make<Department>('color').toggleable(),
                IconColumn.make<Department>('is_active').label('Active').boolean(),
            ])
            .defaultSort('name')
            .recordActions([
                ActionGroup.make([
                    EditAction.make(DepartmentResource),
                    Action.make('adjust_budget').icon('m-banknotes').color('success')
                        .modalWidth('xs').modalSubmitActionLabel('Save')
                        .fillForm(({ record }) => ({ budget: record.budget }))
                        .schema(() => [TextInput.make('budget').numeric().prefix('$').minValue(0).maxValue(9999999999.99).required()])
                        .action(async ({ record, data }) => { await DepartmentResource.adapter.update(record.id, { budget: Number(data.budget) }); }),
                    Action.make('toggle_active')
                        .icon(({ record }) => ((record as Department).is_active ? 'm-x-mark' : 'm-check'))
                        .label(({ record }) => ((record as Department).is_active ? 'Deactivate' : 'Activate'))
                        .color(({ record }) => ((record as Department).is_active ? 'danger' : 'success'))
                        .action(async ({ record }) => { await DepartmentResource.adapter.update(record.id, { is_active: !record.is_active }); }),
                    Action.make('replicate').label(t('filament-actions::replicate.single.label')).icon('m-square-2-stack').color('gray')
                        .requiresConfirmation()
                        .modalHeading(({ record }) => t('filament-actions::replicate.single.modal.heading', { label: record.name }))
                        .modalSubmitActionLabel(t('filament-actions::replicate.single.modal.actions.replicate.label'))
                        .action(async ({ record }) => {
                            // Comme la démo : copie sans `id` ni compteur, avec un slug rendu unique.
                            const { id, employees_count, parent_name, created_at, updated_at, ...copy } = record as Department;
                            await DepartmentResource.adapter.create({ ...copy, slug: `${slugify(record.name)}-${randomBytes(4).toString('hex').slice(0, 5)}` });
                            Notification.make().success().title(t('filament-actions::replicate.single.notifications.replicated.title')).send();
                        }),
                    Action.make('delete').label(t('filament-actions::delete.single.label')).icon('m-trash').color('danger').keyBindings(['mod+d'])
                        .requiresConfirmation().modalIcon('o-trash')
                        .modalHeading(({ record }) => t('filament-actions::delete.single.modal.heading', { label: record.name }))
                        .modalSubmitActionLabel(t('filament-actions::delete.single.modal.actions.delete.label'))
                        // Comme la démo Filament : la suppression est remplacée par une notification.
                        .action(() => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); }),
                ]),
            ])
            .recordClasses((record) => ((record.employees_count ?? 0) > (record.headcount_limit ?? 0) && (record.headcount_limit ?? 0) > 0 ? 'bg-danger-50 dark:bg-danger-950/50' : null));
    }
}
