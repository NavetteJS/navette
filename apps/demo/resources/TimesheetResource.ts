// Équivalent de App\Filament\Resources\HR\Timesheets (resource, formulaire, table, widget, pages List / Create / Edit) de la démo Filament.
import { Action } from '@navette/actions';
import { Model, ObjectionAdapter } from '@navette/database';
import { DatePicker, Select, Textarea, TextInput, Toggle } from '@navette/forms';
import { DeleteBulkAction, Notification, PageTableStatsWidget, Resource, Stat } from '@navette/panels';
import { Section, type Schema } from '@navette/schemas';
import { Average, Count, Filter, Group, IconColumn, Range, SelectFilter, Sum, TernaryFilter, TextColumn, type Table } from '@navette/tables';

export class Timesheet extends Model {
    static tableName = 'timesheets';
    id!: number;
    employee_id!: number;
    project_id!: number;
    task_id!: number | null;
    employee_name?: string | null;
    project_name?: string | null;
    task_title?: string | null;
    date!: string;
    hours!: number;
    minutes!: number;
    description!: string | null;
    is_billable!: boolean | number;
    hourly_rate!: number;
    total_cost!: number;
    created_at!: string;
    updated_at!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        delete out.employee_name;
        delete out.project_name;
        delete out.task_title;
        return out;
    }
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const knex = () => Timesheet.knex();
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
const options = (table: string, limit: number | null = 50) => async (): Promise<[string, string][]> =>
    (await knex()(table).whereNull('deleted_at').orderBy('name').modify((query: any) => { if (limit !== null) query.limit(limit); }).select('id', 'name')).map((row: any): [string, string] => [String(row.id), row.name]);
const shortDate = (date: unknown) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(date).slice(0, 10)}T00:00:00Z`));
const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const updateTotalCost = ({ get, set }: { get: (path: string) => unknown; set: (path: string, value: unknown) => void }) => {
    set('total_cost', ((Number(get('hours')) || 0) * (Number(get('hourly_rate')) || 0)).toFixed(2));
};
/** Entrée de plus de sept jours : sa facturation n'est plus modifiable depuis la liste. */
const isLocked = (record: Timesheet) => Date.parse(`${String(record.date).slice(0, 10)}T00:00:00Z`) < Date.now() - 7 * 86400000;

export class Timesheets extends ObjectionAdapter<Timesheet> {
    /** `projectId` : entrées d'un seul projet (relation manager de la page d'un projet). */
    constructor(projectId: number | string | null = null) {
        super(Timesheet, {
            modify: (query) => {
                query.select('timesheets.*',
                    knex()('employees').select('employees.name').whereRaw('employees.id = timesheets.employee_id').as('employee_name'),
                    knex()('projects').select('projects.name').whereRaw('projects.id = timesheets.project_id').as('project_name'),
                    knex()('tasks').select('tasks.title').whereRaw('tasks.id = timesheets.task_id').as('task_title'));
                if (projectId !== null) query.where('timesheets.project_id', projectId);
            },
        });
    }
}

/** Équivalent de Widgets\TimesheetStats : chiffres calculés sur la requête de la table de la liste. */
export class TimesheetStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => TimesheetResource.getPages().index as any;
    async getStats(): Promise<Stat[]> {
        // Semaine en cours, du lundi au dimanche (Carbon::startOfWeek / endOfWeek).
        const today = new Date();
        const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay() + 6) % 7)));
        const sunday = new Date(monday.getTime() + 6 * 86400000);
        const day = (date: Date) => date.toISOString().slice(0, 10);
        const [week, all, billable] = await Promise.all([
            this.aggregatePageTable({ sum: ['hours'] }, (q) => { q.whereBetween('date', [`${day(monday)} 00:00:00`, `${day(sunday)} 23:59:59`]); }),
            this.aggregatePageTable({ sum: ['total_cost'] }),
            this.aggregatePageTable({}, (q) => { q.where('is_billable', 1); }),
        ]);
        const number = (value: number, decimals = 0) => new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value ?? 0);
        return [
            Stat.make('Hours This Week', number(week.sum.hours, 1)).color('success'),
            Stat.make('Billable %', `${all.count > 0 ? Math.round((billable.count / all.count) * 100) : 0}%`).color('info'),
            Stat.make('Total Entries', number(all.count)).color('warning'),
            Stat.make('Total Cost', `$${number(all.sum.total_cost)}`).color('primary'),
        ];
    }
}

const setBillable = (value: boolean) => async ({ livewire }: { livewire: any }) => {
    for (const key of await livewire.getSelectedRecordKeys()) await TimesheetResource.adapter.update(key, { is_billable: value });
    livewire.deselectAllTableRecords();
};

/** Table des entrées de temps, partagée avec le relation manager d'un projet (qui n'affiche ni la colonne ni le filtre « Project »). */
export function timesheetsTable(table: Table<Timesheet>, projectScoped = false): Table<Timesheet> {
    return table
        .columns([
            // Comme dans la démo, la première colonne déclare un décompte ; Filament ne l'affiche pas : sa cellule porte l'intitulé de la ligne de résumé.
            TextColumn.make<Timesheet>('employee.name').getStateUsing(({ record }) => record.employee_name ?? null).searchable({ column: 'employee_name' }).sortable({ column: 'employee_name' }).weight('medium').summarize(Count.make()),
            ...(projectScoped ? [] : [TextColumn.make<Timesheet>('project.name').getStateUsing(({ record }) => record.project_name ?? null).searchable({ column: 'project_name' }).sortable({ column: 'project_name' })]),
            TextColumn.make<Timesheet>('task.title').getStateUsing(({ record }) => record.task_title ?? null).searchable({ column: 'task_title' }).limit(30)
                .tooltip((record) => (record.task_title && record.task_title.length > 30 ? record.task_title : null)).toggleable().placeholder('No task'),
            TextColumn.make<Timesheet>('date').date().sortable().summarize(Range.make().minimalDateTimeDifference()),
            TextColumn.make<Timesheet>('hours').numeric(1).alignEnd().sortable().summarize([Sum.make().label('Total'), Average.make().label('Avg')]),
            IconColumn.make<Timesheet>('is_billable').label('Billable').boolean().toggleable(),
            TextColumn.make<Timesheet>('hourly_rate').money('usd').alignEnd().sortable().toggleable().copyable(),
            TextColumn.make<Timesheet>('total_cost').money('usd').alignEnd().sortable().summarize(Sum.make().money('usd')),
        ])
        .defaultSort('date', 'desc')
        .groups([
            Group.make<Timesheet>('employee.name').label('Employee').column('employee_name').collapsible(),
            ...(projectScoped ? [] : [Group.make<Timesheet>('project.name').label('Project').column('project_name').collapsible()]),
            Group.make<Timesheet>('date').label('Date').date().collapsible(),
        ])
        .filters([
            SelectFilter.make('employee').column('employee_id').options(options('employees', null)),
            ...(projectScoped ? [] : [SelectFilter.make('project').column('project_id').options(options('projects', null))]),
            TernaryFilter.make('is_billable'),
            Filter.make('date_range')
                .schema([DatePicker.make('from'), DatePicker.make('until')])
                .query((query, data) => {
                    if (isDate(data.from)) query.whereRaw('date(??) >= ?', ['date', data.from]);
                    if (isDate(data.until)) query.whereRaw('date(??) <= ?', ['date', data.until]);
                })
                .indicateUsing((data) => ({
                    ...(isDate(data.from) ? { from: `From ${shortDate(data.from)}` } : {}),
                    ...(isDate(data.until) ? { until: `Until ${shortDate(data.until)}` } : {}),
                })),
        ])
        .recordActions([
            Action.make('toggle_billable').iconButton()
                .icon(({ record }) => ((record as Timesheet).is_billable ? 'm-currency-dollar' : 'm-no-symbol'))
                .color(({ record }) => ((record as Timesheet).is_billable ? 'success' : 'gray'))
                .disabled(({ record }) => isLocked(record as Timesheet))
                .action(async ({ record }) => { await TimesheetResource.adapter.update((record as Timesheet).id, { is_billable: !(record as Timesheet).is_billable }); }),
            Action.make('edit').label('Edit').tableIcon('c-pencil-square').url(({ record }) => TimesheetResource.getUrl('edit', (record as Timesheet).id)),
        ])
        .groupedBulkActions([
            Action.make('mark_billable').icon('m-currency-dollar').color('success').requiresConfirmation().action(setBillable(true)),
            Action.make('mark_non_billable').icon('m-no-symbol').color('gray').requiresConfirmation().action(setBillable(false)),
            DeleteBulkAction.make().action(cheeky),
        ]);
}

export class TimesheetResource extends Resource {
    static slug = 'timesheets';
    static modelLabel = 'timesheet';
    static navigationIcon = 'o-clock';
    static navigationGroup = 'Projects';
    static navigationSort = 2;
    static widgets = [TimesheetStats];
    static headerWidgets = [TimesheetStats];
    static adapter = new Timesheets();

    static form(schema: Schema): Schema {
        return schema.components([
            Section.make('Timesheet Entry').columns(2).columnSpanFull().schema([
                Select.make('employee_id').label('Employee').options(options('employees')).searchable().preload().required().live()
                    // Le taux horaire de l'employé choisi pré-remplit celui de l'entrée.
                    .afterStateUpdated(async ({ state, set }) => {
                        const id = Number(state);
                        if (!Number.isInteger(id) || id <= 0) return;
                        const employee = await knex()('employees').where('id', id).whereNull('deleted_at').first('hourly_rate');
                        if (employee?.hourly_rate) set('hourly_rate', employee.hourly_rate);
                    }),
                Select.make('project_id').label('Project').options(options('projects')).searchable().preload().required().live(),
                // Les tâches proposées sont celles du projet choisi.
                Select.make('task_id').label('Task').searchable().preload().options(async ({ get }) => {
                    const projectId = Number(get('project_id'));
                    const rows = await knex()('tasks').modify((query: any) => { if (Number.isInteger(projectId) && projectId > 0) query.where('project_id', projectId); }).orderBy('title').limit(50).select('id', 'title');
                    return rows.map((row: any): [string, string] => [String(row.id), row.title]);
                }),
                DatePicker.make('date').required().default(() => new Date().toISOString().slice(0, 10)),
                TextInput.make('hours').numeric().step(0.5).minValue(0).maxValue(999.9).suffix('hours').required().live({ onBlur: true }).afterStateUpdated(updateTotalCost),
                TextInput.make('minutes').required().integer().minValue(0).maxValue(59).mask('99').suffix('min').default(0),
                Toggle.make('is_billable').label('Billable').default(true).columnSpanFull(),
                TextInput.make('hourly_rate').required().numeric().prefix('$').minValue(0).maxValue(999999.99).live({ onBlur: true }).afterStateUpdated(updateTotalCost),
                TextInput.make('total_cost').numeric().prefix('$').minValue(0).maxValue(99999999.99).disabled().dehydrated(),
                Textarea.make('description').rows(2).maxLength(65535).columnSpanFull(),
            ]),
        ]);
    }

    static table(table: Table<Timesheet>): Table<Timesheet> { return timesheetsTable(table); }
}
