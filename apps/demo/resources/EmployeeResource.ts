// Équivalent de App\Filament\Resources\HR\Employees\EmployeeResource + Tables\EmployeesTable + Pages\ListEmployees de la démo Filament.
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { LEAVE_STATUSES, LEAVE_TYPES, type EnumCase } from './enums.ts';
import { CheckboxList, ColorPicker, DatePicker, KeyValue, Select, TextInput, Toggle, ToggleButtons } from '@navette-js/forms';
import { Notification, PageTableStatsWidget, RelationManager, Resource, Stat, Tab } from '@navette-js/panels';
import { Tab as FormTab, Tabs, type Schema } from '@navette-js/schemas';
import { IconEntry, TextEntry } from '@navette-js/infolists';
import { ColorColumn, IconColumn, SelectFilter, TernaryFilter, TextColumn, TrashedFilter, type Table } from '@navette-js/tables';

export class Employee extends Model {
    static tableName = 'employees';
    // Colonnes JSON : lues et écrites comme des valeurs JavaScript (équivalent des casts `array` d'Eloquent).
    static jsonAttributes = ['skills', 'metadata'];
    id!: number;
    department_id!: number | null;
    name!: string;
    email!: string;
    phone!: string | null;
    date_of_birth!: string | null;
    hire_date!: string;
    job_title!: string;
    employment_type!: string;
    salary!: number | null;
    hourly_rate!: number | null;
    team_color!: string | null;
    skills!: string[] | null;
    metadata!: Record<string, string | null> | null;
    is_active!: number | boolean;
    created_at!: string;
    updated_at!: string;
    deleted_at!: string | null;
    department_name?: string | null;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.is_active === 'boolean') out.is_active = out.is_active ? 1 : 0;
        return out;
    }
}

/** Enum EmploymentType de la démo : libellé, couleur et icône. */
export const EMPLOYMENT_TYPES: Record<string, { label: string; color: string; icon: string }> = {
    full_time: { label: 'Full Time', color: 'success', icon: 'user-group' },
    part_time: { label: 'Part Time', color: 'info', icon: 'clock' },
    contractor: { label: 'Contractor', color: 'warning', icon: 'briefcase' },
    intern: { label: 'Intern', color: 'gray', icon: 'academic-cap' },
};
const knex = () => Employee.knex();
const departments = async (): Promise<[string, string][]> => (await knex()('departments').orderBy('name').select('id', 'name')).map((d: any): [string, string] => [String(d.id), d.name]);
const countWhere = (active: boolean | null) => async () => Number(((await Employee.query().whereNull('deleted_at').modify((q) => { if (active !== null) q.where('is_active', active ? 1 : 0); }).count({ n: '*' }).first()) as any)?.n ?? 0);
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
const departmentSelect = () => Select.make('department_id').label('Department').searchable().options(departments, { dynamic: false, searchOnServer: false }).required();

class Timesheet extends Model { static tableName = 'timesheets'; id!: number; project_name?: string | null; }
class LeaveRequest extends Model { static tableName = 'leave_requests'; id!: number; type!: string; status!: string; }
/** Colonne à pastille pour une énumération : libellé, couleur et icône de la valeur. */
const enumBadge = (name: string, cases: Record<string, EnumCase>) => TextColumn.make<any>(name).badge()
    .formatStateUsing(({ state }) => cases[String(state)]?.label ?? String(state))
    .color((record) => cases[record[name]]?.color ?? 'gray')
    .icon((record) => (cases[record[name]] ? `c-${cases[record[name]].icon}` : null));

/** Équivalent de RelationManagers\TimesheetsRelationManager (lecture seule). */
export class TimesheetsRelationManager extends RelationManager {
    static relationship = 'timesheets';
    static modelLabel = 'timesheet';
    static adapterFor(ownerKey: string): DataAdapter {
        return new ObjectionAdapter(Timesheet, { modify: (query) => { query.select('timesheets.*', knex()('projects').select('projects.name').whereRaw('projects.id = timesheets.project_id').as('project_name')).where('timesheets.employee_id', ownerKey); } });
    }
    static table(table: Table): Table {
        return table
            .columns([
                TextColumn.make<Timesheet>('project.name').getStateUsing(({ record }) => record.project_name ?? null).sortable({ column: 'project_name' }).weight('medium'),
                TextColumn.make('date').date().sortable(),
                TextColumn.make('hours').numeric(1).alignEnd().sortable(),
                IconColumn.make('is_billable').label('Billable').boolean(),
                TextColumn.make('total_cost').money('usd').alignEnd().sortable(),
            ])
            .defaultSort('date', 'desc').groupedBulkActions([]);
    }
}
/** Équivalent de RelationManagers\LeaveRequestsRelationManager (lecture seule). */
export class LeaveRequestsRelationManager extends RelationManager {
    static relationship = 'leaveRequests';
    static modelLabel = 'leave request';
    static adapterFor(ownerKey: string): DataAdapter {
        return new ObjectionAdapter(LeaveRequest, { modify: (query) => { query.where('leave_requests.employee_id', ownerKey); } });
    }
    static table(table: Table): Table {
        return table
            .columns([
                enumBadge('type', LEAVE_TYPES).weight('medium'),
                enumBadge('status', LEAVE_STATUSES),
                TextColumn.make('start_date').date().sortable(),
                TextColumn.make('end_date').date().sortable(),
                TextColumn.make('days_requested').numeric(1).alignEnd().sortable(),
            ])
            .defaultSort('start_date', 'desc').groupedBulkActions([]);
    }
}

/** Équivalent de Widgets\EmployeeStats : agrégats sur les employés affichés par la table. */
export class EmployeeStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => EmployeeResource.getPages().index as any;
    async getStats(): Promise<Stat[]> {
        const total = await this.aggregatePageTable();
        const active = await this.aggregatePageTable({}, (q) => { q.where('is_active', 1); });
        const salary = await this.aggregatePageTable({ avg: ['salary'] }, (q) => { q.whereNotNull('salary'); });
        // Ancienneté moyenne, en années, des employés affichés (SQLite : jours juliens).
        const tenure = await this.aggregatePageTable({ avg: ['tenure_days'] });
        return [
            Stat.make('Total Employees', total.count),
            Stat.make('Active Employees', active.count).color('success'),
            Stat.make('Avg Salary', `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(salary.avg.salary)}`).color('info'),
            Stat.make('Avg Tenure', `${(tenure.avg.tenure_days / 365.25).toFixed(1)} years`).color('warning'),
        ];
    }
}

export class EmployeeResource extends Resource {
    static slug = 'hr/employees';
    static modelLabel = 'employee';
    static navigationIcon = 'o-identification';
    static navigationGroup = 'HR';
    static navigationSort = 0;
    static recordTitleAttribute = 'name';
    static globalSearchSort = 5;
    static globallySearchableAttributes = ['name', 'email', 'job_title'];
    static getGlobalSearchResultDetails(record: any): Record<string, unknown> { return { Department: record.department_name }; }
    static widgets = [EmployeeStats];
    static headerWidgets = [EmployeeStats];
    static relations = [TimesheetsRelationManager, LeaveRequestsRelationManager];
    static adapter = new ObjectionAdapter(Employee, {
        softDeletes: 'deleted_at', findsTrashed: true,
        modify: (query) => {
            query.select(
                'employees.*',
                knex()('departments').select('departments.name').whereRaw('departments.id = employees.department_id').as('department_name'),
                knex().raw('julianday(\'now\') - julianday(employees.hire_date) as tenure_days'),
            );
        },
    });
    /** Action d'en-tête de la liste : lien vers les demandes de congé, avec le nombre de demandes en attente. */
    static listHeaderActions = () => [
        Action.make('leave_requests').label('Leave requests').color('gray').icon('m-calendar')
            .badge(async () => String(((await knex()('leave_requests').where({ status: 'pending' }).count({ n: '*' }).first()) as any)?.n ?? 0)).badgeColor('warning')
            .url('/hr/leave-requests'),
    ];

    static tabs(): Record<string, Tab> {
        return {
            '': Tab.make('All').badge(countWhere(null)),
            active: Tab.make('Active').badge(countWhere(true)).badgeColor('success').query((query) => { query.where('is_active', 1); }),
            inactive: Tab.make('Inactive').badge(countWhere(false)).badgeColor('gray').query((query) => { query.where('is_active', 0); }),
        };
    }

    /** Équivalent de Schemas\EmployeeForm : trois onglets (identité, contrat, métadonnées). */
    static form(schema: Schema): Schema {
        const types = Object.entries(EMPLOYMENT_TYPES);
        const SKILLS = ['PHP', 'Laravel', 'JavaScript', 'TypeScript', 'React', 'Vue.js', 'Python', 'SQL', 'Docker', 'AWS'];
        const today = () => new Date().toISOString().slice(0, 10);
        return schema.components([
            Tabs.make('Employee')
                .schema([
                    FormTab.make('Personal').icon('m-user')
                        .schema([
                            TextInput.make('name').required().maxLength(255),
                            TextInput.make('email').required().email().maxLength(255).unique({ ignoreRecord: true }),
                            TextInput.make('phone').tel().mask('(999) 999-9999').maxLength(255),
                            DatePicker.make('date_of_birth').maxDate(today()),
                            ColorPicker.make('team_color').hex(),
                            CheckboxList.make('skills').options(SKILLS.map((skill): [string, string] => [skill, skill])).columns(5).columnSpanFull(),
                        ])
                        .columns(2),
                    FormTab.make('Employment').icon('m-briefcase')
                        .schema([
                            Select.make('department_id').label('Department').searchable().options(departments),
                            TextInput.make('job_title').required().maxLength(255),
                            ToggleButtons.make('employment_type').inline().required().live().default('full_time')
                                .options(types.map(([value, type]): [string, string] => [value, type.label]))
                                .colors(Object.fromEntries(types.map(([value, type]) => [value, type.color])))
                                .icons(Object.fromEntries(types.map(([value, type]) => [value, `m-${type.icon}`])))
                                .columnSpanFull(),
                            DatePicker.make('hire_date').required().default(today),
                            // Salaire annuel pour les salariés, taux horaire pour les prestataires et stagiaires.
                            TextInput.make('salary').numeric().prefix('$').minValue(0).maxValue(99999999.99).visible(({ get }) => ['full_time', 'part_time'].includes(String(get('employment_type')))),
                            TextInput.make('hourly_rate').numeric().prefix('$').minValue(0).maxValue(999999.99).visible(({ get }) => ['contractor', 'intern'].includes(String(get('employment_type')))),
                            Toggle.make('is_active').label('Active').default(true).columnStart(1),
                        ])
                        .columns(2),
                    FormTab.make('Documents & Metadata').icon('m-document-text')
                        .schema([KeyValue.make('metadata').keyLabel('Property').valueLabel('Value').reorderable().columnSpanFull()]),
                ])
                .columnSpanFull(),
        ]).columns(2);
    }

    static table(table: Table<Employee>): Table<Employee> {
        return table
            .columns([
                TextColumn.make<Employee>('name').searchable().sortable().weight('medium'),
                TextColumn.make<Employee>('email').searchable().sortable().copyable(),
                TextColumn.make<Employee>('department.name').getStateUsing(({ record }) => record.department_name ?? null)
                    .searchable({ column: 'department_name' }).sortable({ column: 'department_name' }).toggleable().placeholder('No department'),
                TextColumn.make<Employee>('job_title').searchable().sortable().toggleable(),
                TextColumn.make<Employee>('employment_type').badge()
                    .formatStateUsing(({ record }) => EMPLOYMENT_TYPES[record.employment_type]?.label ?? record.employment_type)
                    .color((record) => EMPLOYMENT_TYPES[record.employment_type]?.color ?? 'gray')
                    .icon((record) => (EMPLOYMENT_TYPES[record.employment_type] ? `c-${EMPLOYMENT_TYPES[record.employment_type].icon}` : null)),
                TextColumn.make<Employee>('salary').money('usd').alignEnd().sortable().toggleable(),
                ColorColumn.make<Employee>('team_color').toggleable(true, { isToggledHiddenByDefault: true }),
                TextColumn.make<Employee>('hire_date').date().sortable().toggleable(),
                IconColumn.make<Employee>('is_active').label('Active').boolean().sortable(),
            ])
            .defaultSort('name')
            .filters([
                SelectFilter.make('employment_type').options(Object.entries(EMPLOYMENT_TYPES).map(([value, type]): [string, string] => [value, type.label])),
                SelectFilter.make('department').column('department_id').options(departments),
                TernaryFilter.make('is_active'),
                TrashedFilter.make(),
            ])
            .recordActions([
                ActionGroup.make([
                    Action.make('view_profile').icon('m-eye').color('gray').slideOver().modalSubmitAction(false)
                        .schema(() => [
                            TextEntry.make('name'), TextEntry.make('email'), TextEntry.make('phone'),
                            TextEntry.make('department.name').label('Department').placeholder('No department'),
                            TextEntry.make('job_title'),
                            TextEntry.make('employment_type').badge()
                                .formatStateUsing(({ record }) => EMPLOYMENT_TYPES[record.employment_type]?.label ?? record.employment_type)
                                .color((record) => EMPLOYMENT_TYPES[record.employment_type]?.color ?? 'gray')
                                .icon((record) => (EMPLOYMENT_TYPES[record.employment_type] ? `c-${EMPLOYMENT_TYPES[record.employment_type].icon}` : null)),
                            TextEntry.make('salary').money('usd'), TextEntry.make('hire_date').date(),
                            IconEntry.make('is_active').boolean(),
                        ]),
                    Action.make('edit').label('Edit').icon('m-pencil-square').url(({ record }) => EmployeeResource.getUrl('edit', (record as Employee).id)),
                    Action.make('toggle_active')
                        .icon(({ record }) => ((record as Employee).is_active ? 'm-x-mark' : 'm-check'))
                        .label(({ record }) => ((record as Employee).is_active ? 'Deactivate' : 'Activate'))
                        .color(({ record }) => ((record as Employee).is_active ? 'danger' : 'success'))
                        .requiresConfirmation()
                        .action(async ({ record }) => { await EmployeeResource.adapter.update(record.id, { is_active: !record.is_active }); }),
                    Action.make('change_department').icon('m-building-office-2').color('gray')
                        .modalWidth('md').modalSubmitActionLabel('Save')
                        .fillForm(({ record }) => ({ department_id: record.department_id }))
                        .schema(() => [departmentSelect()])
                        .action(async ({ record, data }) => { await EmployeeResource.adapter.update(record.id, { department_id: Number(data.department_id) }); }),
                    Action.make('delete').label('Delete').icon('m-trash').color('danger').keyBindings(['mod+d'])
                        .requiresConfirmation().modalIcon('o-trash')
                        .modalHeading(({ record }) => `Delete ${record.name}`).modalSubmitActionLabel('Delete')
                        .action(cheeky),
                ]),
            ])
            .groupedBulkActions([
                Action.make('change_department').icon('m-building-office-2').color('gray')
                    .schema(() => [departmentSelect()])
                    .action(async ({ livewire, data }) => {
                        for (const key of await livewire.getSelectedRecordKeys()) await EmployeeResource.adapter.update(key, { department_id: Number(data.department_id) });
                        livewire.deselectAllTableRecords();
                    }),
                Action.make('toggle_active').icon('m-power').color('warning')
                    .schema(() => [ToggleButtons.make('is_active').options([['1', 'Active'], ['0', 'Inactive']]).inline().required()])
                    .action(async ({ livewire, data }) => {
                        for (const key of await livewire.getSelectedRecordKeys()) await EmployeeResource.adapter.update(key, { is_active: String(data.is_active) === '1' });
                        livewire.deselectAllTableRecords();
                    }),
                Action.make('delete').label('Delete selected').color('danger').icon('m-trash')
                    .requiresConfirmation().modalIcon('o-trash').modalHeading('Delete selected employees').modalSubmitActionLabel('Delete')
                    .action(cheeky),
            ]);
    }
}
