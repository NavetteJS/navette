// HR projects: tabbed form with a block-based plan, infolist, table, widget,
// Tasks and Timesheets relation managers, and List / Create / Edit / View pages.
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { ColorPicker, DatePicker, RichEditor, Select, TagsInput, Textarea, TextInput, ToggleButtons } from '@navette-js/forms';
import { Block, Builder } from '@navette-js/forms/builder';
import { ColorEntry, TextEntry } from '@navette-js/infolists';
import { CreateAction, DeleteAction, DeleteBulkAction, EditRecord, ForceDeleteAction, Notification, PageTableStatsWidget, RelationManager, Resource, RestoreAction, Stat, ViewAction, ViewRecord } from '@navette-js/panels';
import { Tab, Tabs, type Schema } from '@navette-js/schemas';
import { IconColumn, SelectFilter, Sum, TextColumn, TrashedFilter, type Table } from '@navette-js/tables';
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES, type EnumCase } from './enums.ts';
import { Tasks, tasksTable, type Task } from './TaskResource.ts';
import { Timesheets, type Timesheet } from './TimesheetResource.ts';

export class Project extends Model {
    static tableName = 'projects';
    id!: number;
    department_id!: number | null;
    department_name?: string | null;
    name!: string;
    slug!: string;
    description!: string | null;
    color!: string | null;
    status!: string;
    priority!: string;
    budget!: number;
    spent!: number;
    estimated_hours!: number;
    actual_hours!: number;
    start_date!: string;
    end_date!: string | null;
    plan!: unknown;
    created_at!: string;
    updated_at!: string;
    deleted_at!: string | null;
    static jsonAttributes = ['plan'];
    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        delete out.department_name;
        return out;
    }
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const knex = () => Project.knex();
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
const slugify = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pairs = (cases: Record<string, EnumCase>) => Object.entries(cases).map(([value, item]): [string, string] => [value, item.label]);
const options = (table: string, limit: number | null = 50, order = 'name') => async (): Promise<[string, string][]> =>
    // No limit, in database order.
    (await knex()(table).orderBy(order).modify((query: any) => { if (table !== 'departments') query.whereNull('deleted_at'); if (limit !== null) query.limit(limit); }).select('id', 'name')).map((row: any): [string, string] => [String(row.id), row.name]);
const toggle = (name: string, cases: Record<string, EnumCase>) => ToggleButtons.make(name).inline().required()
    .options(pairs(cases))
    .colors(Object.fromEntries(Object.entries(cases).map(([value, item]) => [value, item.color])))
    .icons(Object.fromEntries(Object.entries(cases).map(([value, item]) => [value, `m-${item.icon}`])));
const badgeColumn = (name: 'status' | 'priority', cases: Record<string, EnumCase>) => TextColumn.make<Project>(name).badge()
    .formatStateUsing(({ record }) => cases[record[name]]?.label ?? record[name])
    .color((record) => cases[record[name]]?.color ?? 'gray')
    .icon((record) => (cases[record[name]] ? `c-${cases[record[name]].icon}` : null));
const badgeEntry = (name: 'status' | 'priority', cases: Record<string, EnumCase>) => TextEntry.make(name).badge()
    .formatStateUsing(({ state }) => cases[String(state)]?.label ?? String(state))
    .color((record) => cases[record[name]]?.color ?? 'gray')
    .icon((record) => (cases[record[name]] ? `c-${cases[record[name]].icon}` : null));
const money = (name: string) => TextInput.make(name).numeric().prefix('$').minValue(0).maxValue(9999999999.99);
const hours = (name: string) => TextInput.make(name).numeric().suffix('hours').minValue(0).maxValue(9999999.9);
const dollars = (value: number) => `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value ?? 0)}`;

class Projects extends ObjectionAdapter<Project> {
    constructor() {
        super(Project, {
            softDeletes: 'deleted_at', findsTrashed: true,
            modify: (query) => { query.select('projects.*', knex()('departments').select('departments.name').whereRaw('departments.id = projects.department_id').as('department_name')); },
        });
    }
}

// --- workflow actions: the same in a row's menu and in the View page header
const change = (changes: (data: Record<string, unknown>) => Record<string, unknown>, notify: (() => void) | null = null) => async ({ record, data }: { record: unknown; data: Record<string, unknown> }) => {
    const values = changes(data);
    await ProjectResource.adapter.update((record as Project).id, values);
    // Also update the in-memory record so the View page re-renders with fresh data.
    Object.assign(record as Project, values);
    notify?.();
};
const statusIs = (...statuses: string[]) => ({ record }: { record: unknown }) => statuses.includes((record as Project | null)?.status ?? '');
const workflowActions = () => [
    Action.make('change_status').icon('m-arrow-path-rounded-square').color('gray').modalWidth('md').modalSubmitActionLabel('Save')
        .fillForm(({ record }) => ({ status: (record as Project).status }))
        .schema(() => [toggle('status', PROJECT_STATUSES)])
        .action(change((data) => ({ status: data.status }))),
    Action.make('put_on_hold').icon('m-pause').color('warning').visible(statusIs('active')).requiresConfirmation()
        .modalHeading('Put Project On Hold').modalDescription('This will pause all work on this project.').modalIcon('o-exclamation-triangle').modalIconColor('warning')
        .action(change(() => ({ status: 'on_hold' }), () => { Notification.make().warning().title('Project put on hold').send(); })),
    Action.make('resume').icon('m-play').color('success').visible(statusIs('on_hold'))
        .action(change(() => ({ status: 'active' }), () => { Notification.make().success().title('Project resumed').send(); })),
    Action.make('complete').icon('m-check-circle').color('success').visible(statusIs('active', 'on_hold')).requiresConfirmation()
        .action(change(() => ({ status: 'completed', end_date: now() }), () => { Notification.make().success().title('Project completed').send(); })),
];

class EditProject extends EditRecord {
    getHeaderActions(): Action[] { return [ViewAction.make(), DeleteAction.make(), RestoreAction.make(), ForceDeleteAction.make()]; }
}
class ViewProject extends ViewRecord {
    getHeaderActions(): Action[] { return [...workflowActions(), this.editAction()]; }
}

/** The task table, limited to the project. */
export class TasksRelationManager extends RelationManager {
    static relationship = 'tasks';
    static modelLabel = 'task';
    static recordTitleAttribute = 'title';
    static adapterFor(ownerKey: string): DataAdapter { return new ProjectTasks(ownerKey); }
    static form(schema: Schema): Schema {
        return schema.columns(2).components([
            TextInput.make('title').required(),
            Select.make('assigned_to').label('Assignee').options(options('employees')).searchable().preload(),
            toggle('status', TASK_STATUSES).default('backlog'),
            toggle('priority', TASK_PRIORITIES).default('medium'),
            TextInput.make('estimated_hours').numeric().step(0.5).minValue(0).maxValue(99999.9).suffix('hours'),
            DatePicker.make('due_date'),
        ]);
    }
    static table(table: Table): Table { return tasksTable(table as Table<Task>, true).headerActions([CreateAction.make()]); }
}
/** Tasks of a project: a task created here is attached to it, whatever data is received. */
class ProjectTasks extends Tasks {
    private owner: string;
    constructor(owner: string) { super(owner); this.owner = owner; }
    create(data: Record<string, unknown>): Promise<Task> { return super.create({ ...data, project_id: Number(this.owner) }); }
}

/** The project's timesheets (read-only). */
export class TimesheetsRelationManager extends RelationManager {
    static relationship = 'timesheets';
    static modelLabel = 'timesheet';
    static adapterFor(ownerKey: string): DataAdapter { return new Timesheets(ownerKey); }
    static table(table: Table): Table {
        return table
            .columns([
                TextColumn.make<Timesheet>('employee.name').getStateUsing(({ record }) => record.employee_name ?? null).sortable({ column: 'employee_name' }).weight('medium'),
                TextColumn.make('date').date().sortable(),
                TextColumn.make('hours').numeric(1).alignEnd().sortable().summarize(Sum.make().label('Total hours')),
                IconColumn.make('is_billable').label('Billable').boolean(),
                TextColumn.make('total_cost').money('usd').alignEnd().sortable().summarize(Sum.make().money('usd').label('Total cost')),
            ])
            .defaultSort('date', 'desc').groupedBulkActions([]);
    }
}

/** Figures computed from the list table's query. */
export class ProjectStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => ProjectResource.getPages().index as any;
    async getStats(): Promise<Stat[]> {
        const [active, all, estimated] = await Promise.all([
            this.aggregatePageTable({}, (q) => { q.where('status', 'active'); }),
            this.aggregatePageTable({ sum: ['budget', 'spent'] }),
            this.aggregatePageTable({ sum: ['actual_hours', 'estimated_hours'] }, (q) => { q.where('estimated_hours', '>', 0); }),
        ]);
        // Average of per-project completion rates (not the overall rate).
        const rows: { actual_hours: number; estimated_hours: number }[] = estimated.count
            ? await knex()('projects').whereNull('deleted_at').where('estimated_hours', '>', 0).select('actual_hours', 'estimated_hours')
            : [];
        const average = rows.length ? rows.reduce((total, row) => total + (Number(row.actual_hours) / Number(row.estimated_hours)) * 100, 0) / rows.length : 0;
        return [
            Stat.make('Active Projects', active.count).color('success'),
            Stat.make('Total Budget', dollars(all.sum.budget)).color('info'),
            Stat.make('Total Spent', dollars(all.sum.spent)).color('warning'),
            Stat.make('Avg Completion', `${Math.round(average)}%`).color('primary'),
        ];
    }
}

export class ProjectResource extends Resource {
    static slug = 'projects';
    static modelLabel = 'project';
    static navigationIcon = 'o-folder';
    static navigationGroup = 'Projects';
    static navigationSort = 0;
    static recordTitleAttribute = 'name';
    static globalSearchSort = 6;
    static hasViewPage = true;
    static pages = { edit: EditProject, view: ViewProject };
    static relations = [TasksRelationManager, TimesheetsRelationManager];
    static widgets = [ProjectStats];
    static headerWidgets = [ProjectStats];
    static adapter = new Projects();
    /** Active projects (navigation badge). */
    static async getNavigationBadge(): Promise<string> { return String(Number(((await Project.query().whereNull('deleted_at').where('status', 'active').count({ n: '*' }).first()) as any)?.n ?? 0)); }

    static form(schema: Schema): Schema {
        return schema.components([
            Tabs.make('Project').columnSpanFull().schema([
                Tab.make('Overview').icon('m-information-circle').columns(2).schema([
                    TextInput.make('name').required().maxLength(255).live({ onBlur: true })
                        .afterStateUpdated(({ operation, state, set }) => { if (operation === 'create') set('slug', slugify(String(state ?? ''))); }),
                    TextInput.make('slug').disabled().dehydrated().required().maxLength(255).unique({ ignoreRecord: true }),
                    RichEditor.make('description').columnSpanFull(),
                    Select.make('department_id').label('Department').options(options('departments')).searchable().preload(),
                    toggle('status', PROJECT_STATUSES).default('planning'),
                    toggle('priority', TASK_PRIORITIES).default('medium'),
                    ColorPicker.make('color'),
                    DatePicker.make('start_date').required(),
                    DatePicker.make('end_date').minDate(({ get }) => (get('start_date') as string | null) || null),
                ]),
                Tab.make('Plan').icon('m-clipboard-document-list').schema([
                    Builder.make('plan').hiddenLabel().columnSpanFull().blocks([
                        Block.make('milestone').icon('m-flag').schema(() => [
                            TextInput.make('title').required(),
                            DatePicker.make('target_date').required(),
                            Textarea.make('description').rows(2),
                        ]),
                        Block.make('task_group').label('Task group').icon('m-list-bullet').schema(() => [
                            TextInput.make('title').required(),
                            Select.make('assignee').options(options('employees', null, 'id')),
                            TagsInput.make('tasks').placeholder('Add tasks'),
                        ]),
                        Block.make('checkpoint').icon('m-check-circle').schema(() => [
                            TextInput.make('title').required(),
                            DatePicker.make('date').required(),
                            Select.make('status').options({ pending: 'Pending', passed: 'Passed', failed: 'Failed' }),
                        ]),
                    ]),
                ]),
                Tab.make('Budget').icon('m-currency-dollar').columns(2).schema([
                    money('budget').required().default(0),
                    money('spent').disabled().dehydrated().required().default(0),
                    hours('estimated_hours').required().default(0),
                    hours('actual_hours').disabled().dehydrated().required().default(0),
                ]),
            ]),
        ]);
    }

    static infolist(schema: Schema): Schema {
        return schema.components([
            Tabs.make('Project').columnSpanFull().schema([
                Tab.make('Overview').icon('m-information-circle').columns(2).schema([
                    TextEntry.make('name'),
                    TextEntry.make('slug').copyable(),
                    TextEntry.make('department.name').label('Department').placeholder('No department'),
                    badgeEntry('status', PROJECT_STATUSES),
                    badgeEntry('priority', TASK_PRIORITIES),
                    ColorEntry.make('color').placeholder('No color'),
                    TextEntry.make('start_date').date(),
                    TextEntry.make('end_date').date().placeholder('No end date'),
                    TextEntry.make('description').prose().markdown().columnSpanFull().placeholder('No description'),
                ]),
                Tab.make('Budget').icon('m-currency-dollar').columns(2).schema([
                    TextEntry.make('budget').money('usd').placeholder('$0.00'),
                    TextEntry.make('spent').money('usd').placeholder('$0.00'),
                    TextEntry.make('estimated_hours').numeric().suffix(' hours').placeholder('0'),
                    TextEntry.make('actual_hours').numeric().suffix(' hours').placeholder('0'),
                ]),
            ]),
        ]);
    }

    static table(table: Table<Project>): Table<Project> {
        return table
            .columns([
                TextColumn.make<Project>('name').searchable().sortable().weight('medium'),
                badgeColumn('status', PROJECT_STATUSES),
                badgeColumn('priority', TASK_PRIORITIES),
                TextColumn.make<Project>('department.name').getStateUsing(({ record }) => record.department_name ?? null).sortable({ column: 'department_name' }).toggleable().placeholder('No department'),
                TextColumn.make<Project>('budget').money('usd').alignEnd().sortable().summarize(Sum.make().money('usd')),
                TextColumn.make<Project>('spent').money('usd').alignEnd().sortable().summarize(Sum.make().money('usd')),
                TextColumn.make<Project>('progress').alignEnd()
                    .getStateUsing(({ record }) => (Number(record.estimated_hours) > 0 ? `${Math.round((Number(record.actual_hours) / Number(record.estimated_hours)) * 100)}%` : '0%')),
                TextColumn.make<Project>('start_date').date().sortable().toggleable(),
                TextColumn.make<Project>('end_date').date().sortable().toggleable(),
            ])
            .defaultSort('start_date', 'desc')
            .filters([
                SelectFilter.make('status').options(pairs(PROJECT_STATUSES)),
                SelectFilter.make('priority').options(pairs(TASK_PRIORITIES)),
                SelectFilter.make('department').column('department_id').options(options('departments', null)),
                TrashedFilter.make(),
            ])
            .recordActions([
                ActionGroup.make([
                    ViewAction.make(),
                    Action.make('edit').label('Edit').icon('m-pencil-square').color('primary').url(({ record }) => ProjectResource.getUrl('edit', (record as Project).id)),
                    ...workflowActions(),
                    DeleteAction.make().action(cheeky),
                ]),
            ])
            .groupedBulkActions([DeleteBulkAction.make().action(cheeky)]);
    }
}
