// HR tasks: form, table, and List / Create / Edit pages.
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { CheckboxList, DatePicker, DateTimePicker, Radio, RichEditor, Select, TextInput, ToggleButtons } from '@navette-js/forms';
import { DeleteAction, DeleteBulkAction, EditRecord, Notification, ReplicateAction, Resource } from '@navette-js/panels';
import { Section, type Schema } from '@navette-js/schemas';
import { Group, SelectFilter, TextColumn, type Table } from '@navette-js/tables';
import { TASK_PRIORITIES, TASK_STATUSES, type EnumCase } from './enums.ts';

export class Task extends Model {
    static tableName = 'tasks';
    id!: number;
    project_id!: number;
    assigned_to!: number | null;
    project_name?: string | null;
    assignee_name?: string | null;
    title!: string;
    description!: string | null;
    status!: string;
    priority!: string;
    estimated_hours!: number | null;
    actual_hours!: number;
    due_date!: string | null;
    completed_at!: string | null;
    labels!: string | string[] | null;
    sort!: number;
    created_at!: string;
    updated_at!: string;
    static jsonAttributes = ['labels'];
    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        delete out.project_name;
        delete out.assignee_name;
        return out;
    }
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const knex = () => Task.knex();
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
const pairs = (cases: Record<string, EnumCase>) => Object.entries(cases).map(([value, item]): [string, string] => [value, item.label]);
const options = (table: string, limit: number | null = 50) => async (): Promise<[string, string][]> =>
    (await knex()(table).whereNull('deleted_at').orderBy('name').modify((query: any) => { if (limit !== null) query.limit(limit); }).select('id', 'name')).map((row: any): [string, string] => [String(row.id), row.name]);
const toggle = (name: string, cases: Record<string, EnumCase>) => ToggleButtons.make(name).inline().required()
    .options(pairs(cases))
    .colors(Object.fromEntries(Object.entries(cases).map(([value, item]) => [value, item.color])))
    .icons(Object.fromEntries(Object.entries(cases).map(([value, item]) => [value, `m-${item.icon}`])));
const badgeColumn = (name: 'status' | 'priority', cases: Record<string, EnumCase>) => TextColumn.make<Task>(name).badge()
    .formatStateUsing(({ record }) => cases[record[name]]?.label ?? record[name])
    .color((record) => cases[record[name]]?.color ?? 'gray')
    .icon((record) => (cases[record[name]] ? `c-${cases[record[name]].icon}` : null));
const assignee = () => Select.make('assigned_to').label('Assignee').options(options('employees')).searchable().preload();
const hours = (name: string) => TextInput.make(name).numeric().step(0.5).minValue(0).maxValue(99999.9).suffix('hours');
const isPast = (date: string | null) => date !== null && Date.parse(`${date.slice(0, 10)}T00:00:00Z`) < Date.now();

/** Table scope: all tasks, or those of one project (project relation manager). */
export class Tasks extends ObjectionAdapter<Task> {
    constructor(projectId: number | string | null = null) {
        super(Task, {
            modify: (query) => {
                query.select('tasks.*',
                    knex()('projects').select('projects.name').whereRaw('projects.id = tasks.project_id').as('project_name'),
                    knex()('employees').select('employees.name').whereRaw('employees.id = tasks.assigned_to').as('assignee_name'));
                if (projectId !== null) query.where('tasks.project_id', projectId);
            },
        });
    }
}

const change = (changes: Record<string, unknown> | ((data: Record<string, unknown>) => Record<string, unknown>), title: string | null = null) => async ({ record, data }: { record: unknown; data: Record<string, unknown> }) => {
    await TaskResource.adapter.update((record as Task).id, typeof changes === 'function' ? changes(data) : changes);
    if (title) Notification.make().success().title(title).send();
};
const statusIs = (...statuses: string[]) => ({ record }: { record: unknown }) => statuses.includes((record as Task | null)?.status ?? '');

class EditTask extends EditRecord {
    getHeaderActions(): Action[] { return [DeleteAction.make()]; }
}

/** Task table, shared with a project's relation manager (which hides the Project column and filter). */
export function tasksTable(table: Table<Task>, projectScoped = false): Table<Task> {
    return table
        .columns([
            TextColumn.make<Task>('title').searchable().sortable().weight('medium').limit(40).tooltip((record) => (record.title && record.title.length > 40 ? record.title : null)),
            ...(projectScoped ? [] : [TextColumn.make<Task>('project.name').getStateUsing(({ record }) => record.project_name ?? null).searchable({ column: 'project_name' }).sortable({ column: 'project_name' })]),
            TextColumn.make<Task>('assignee.name').getStateUsing(({ record }) => record.assignee_name ?? null).searchable({ column: 'assignee_name' }).sortable({ column: 'assignee_name' }).toggleable().placeholder('Unassigned'),
            badgeColumn('status', TASK_STATUSES),
            badgeColumn('priority', TASK_PRIORITIES),
            TextColumn.make<Task>('estimated_hours').numeric(1).alignEnd().sortable().toggleable(),
            TextColumn.make<Task>('due_date').date().sortable().toggleable(),
        ])
        .defaultSort('created_at', 'desc')
        .groups([
            ...(projectScoped ? [] : [Group.make<Task>('project.name').label('Project').column('project_name')]),
            Group.make<Task>('status').getTitleUsing((record) => TASK_STATUSES[record.status]?.label ?? record.status),
            Group.make<Task>('priority').getTitleUsing((record) => TASK_PRIORITIES[record.priority]?.label ?? record.priority),
            Group.make<Task>('assignee.name').label('Assignee').column('assignee_name'),
        ])
        .filters([
            SelectFilter.make('status').options(pairs(TASK_STATUSES)),
            SelectFilter.make('priority').options(pairs(TASK_PRIORITIES)),
            ...(projectScoped ? [] : [SelectFilter.make('project').column('project_id').options(options('projects', null))]),
            SelectFilter.make('assignee').column('assigned_to').options(options('employees', null)),
        ])
        .recordActions([
            ActionGroup.make([
                Action.make('edit').label('Edit').icon('m-pencil-square').color('primary').url(({ record }) => TaskResource.getUrl('edit', (record as Task).id)),
                Action.make('start').icon('m-play').color('success').visible(statusIs('backlog', 'todo')).action(change({ status: 'in_progress' }, 'Task started')),
                Action.make('send_to_review').icon('m-eye').color('info').visible(statusIs('in_progress')).action(change({ status: 'in_review' }, 'Task sent to review')),
                Action.make('complete').icon('m-check-circle').color('success').modalWidth('md').modalSubmitActionLabel('Complete').visible(statusIs('in_progress', 'in_review'))
                    .fillForm(({ record }) => ({ actual_hours: (record as Task).actual_hours }))
                    .schema(() => [hours('actual_hours')])
                    .action(change((data) => ({ status: 'completed', completed_at: now(), actual_hours: data.actual_hours ?? 0 }), 'Task completed')),
                Action.make('assign').icon('m-user-plus').color('gray').modalWidth('md').modalSubmitActionLabel('Assign').schema(() => [assignee().required()])
                    .action(change((data) => ({ assigned_to: data.assigned_to }))),
                Action.make('set_priority').label('Set priority').icon('m-flag').color('gray').modalWidth('md').modalSubmitActionLabel('Save').schema(() => [toggle('priority', TASK_PRIORITIES)])
                    .action(change((data) => ({ priority: data.priority }))),
                ReplicateAction.make().color('gray').requiresConfirmation().excludeAttributes(['id', 'completed_at', 'actual_hours', 'sort', 'project_name', 'assignee_name']),
                DeleteAction.make().action(cheeky),
            ]),
        ])
        .groupedBulkActions([
            Action.make('set_status').icon('m-arrow-path-rounded-square').color('gray').schema(() => [toggle('status', TASK_STATUSES)])
                .action(async ({ livewire, data }) => {
                    const keys = await livewire.getSelectedRecordKeys();
                    for (const key of keys) await TaskResource.adapter.update(key, { status: data.status });
                    Notification.make().success().title(`Updated ${keys.length} tasks to ${TASK_STATUSES[String(data.status)]?.label ?? data.status}`).send();
                    livewire.deselectAllTableRecords();
                }),
            Action.make('assign').icon('m-user-plus').color('info').schema(() => [assignee().required()])
                .action(async ({ livewire, data }) => {
                    for (const key of await livewire.getSelectedRecordKeys()) await TaskResource.adapter.update(key, { assigned_to: data.assigned_to });
                    livewire.deselectAllTableRecords();
                }),
            DeleteBulkAction.make().action(cheeky),
        ])
        // Overdue task (past due, not completed): tinted row.
        .recordClasses((record) => (record.status !== 'completed' && isPast(record.due_date) ? 'bg-danger-50 dark:bg-danger-950/50' : null));
}

export class TaskResource extends Resource {
    static slug = 'tasks';
    static modelLabel = 'task';
    static navigationIcon = 'o-clipboard-document-check';
    static navigationGroup = 'Projects';
    static navigationSort = 1;
    static recordTitleAttribute = 'title';
    static globalSearchSort = 7;
    static pages = { edit: EditTask };
    static adapter = new Tasks();
    /** Tasks in progress (navigation badge). */
    static async getNavigationBadge(): Promise<string> { return String(Number(((await Task.query().where('status', 'in_progress').count({ n: '*' }).first()) as any)?.n ?? 0)); }

    static form(schema: Schema): Schema {
        return schema.components([
            Section.make('Task Details').columns(2).columnSpanFull().schema([
                TextInput.make('title').required().maxLength(255),
                Select.make('project_id').label('Project').options(options('projects')).searchable().preload().required(),
                assignee(),
                toggle('status', TASK_STATUSES).live().default('backlog').columnSpanFull(),
                Radio.make('priority').options(pairs(TASK_PRIORITIES)).inline().required().default('medium'),
                hours('estimated_hours'),
                DatePicker.make('due_date'),
                RichEditor.make('description').columnSpanFull(),
                CheckboxList.make('labels').options({ bug: 'Bug', feature: 'Feature', enhancement: 'Enhancement', documentation: 'Documentation', design: 'Design', testing: 'Testing', refactor: 'Refactor', urgent: 'Urgent' }).columns(4).columnSpanFull(),
                DateTimePicker.make('completed_at').visible(({ get }) => get('status') === 'completed'),
            ]),
        ]);
    }

    static table(table: Table<Task>): Table<Task> { return tasksTable(table); }
}
