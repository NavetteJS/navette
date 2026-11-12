// Équivalent de App\Filament\Resources\HR\LeaveRequests (resource, formulaire, infolist, table, pages List / Create / Edit / View) de la démo Filament.
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { DatePicker, Select, Textarea, TextInput, TimePicker, ToggleButtons } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import { CreateRecord, DeleteAction, DeleteBulkAction, EditRecord, Notification, Resource, Tab, ViewAction, ViewRecord } from '@navette-js/panels';
import { Section, type Schema } from '@navette-js/schemas';
import { SelectColumn, Sum, TextColumn, type Table } from '@navette-js/tables';
import { LEAVE_STATUSES, LEAVE_TYPES, type EnumCase } from './enums.ts';

export class LeaveRequest extends Model {
    static tableName = 'leave_requests';
    id!: number;
    employee_id!: number;
    approver_id!: number | null;
    employee_name?: string | null;
    approver_name?: string | null;
    type!: string;
    status!: string;
    start_date!: string;
    end_date!: string;
    start_time!: string | null;
    end_time!: string | null;
    days_requested!: number;
    reason!: string;
    reviewer_notes!: string | null;
    reviewed_at!: string | null;
    created_at!: string;
    updated_at!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        delete out.employee_name;
        delete out.approver_name;
        return out;
    }
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const knex = () => LeaveRequest.knex();
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
const employeeName = (column: string, alias: string) => knex()('employees').select('employees.name').whereRaw(`employees.id = leave_requests.${column}`).as(alias);
const employees = async (): Promise<[string, string][]> => (await knex()('employees').whereNull('deleted_at').orderBy('name').limit(50).select('id', 'name')).map((row: any): [string, string] => [String(row.id), row.name]);
const like = (search: string) => `%${search.toLowerCase().replace(/[%_]/g, '')}%`;
const countWhere = (status: string | null) => async () => Number(((await LeaveRequest.query().modify((q) => { if (status) q.where('status', status); }).count({ n: '*' }).first()) as any)?.n ?? 0);
const toggle = (name: string, cases: Record<string, EnumCase>) => ToggleButtons.make(name).inline().required()
    .options(Object.entries(cases).map(([value, item]): [string, string] => [value, item.label]))
    .colors(Object.fromEntries(Object.entries(cases).map(([value, item]) => [value, item.color])))
    .icons(Object.fromEntries(Object.entries(cases).map(([value, item]) => [value, `m-${item.icon}`])));
const badgeEntry = (name: string, cases: Record<string, EnumCase>) => TextEntry.make(name).badge()
    .formatStateUsing(({ state }) => cases[String(state)]?.label ?? String(state))
    .color((record) => cases[record[name]]?.color ?? 'gray')
    .icon((record) => (cases[record[name]] ? `c-${cases[record[name]].icon}` : null));
/** `Carbon::parse($start)->diffInDays(Carbon::parse($end)) + 1`, au moins une demi-journée. */
const daysBetween = (start: unknown, end: unknown): number | null => {
    if (!start || !end) return null;
    const days = (Date.parse(`${String(end).slice(0, 10)}T00:00:00Z`) - Date.parse(`${String(start).slice(0, 10)}T00:00:00Z`)) / 86400000 + 1;
    return Number.isFinite(days) ? Math.max(0.5, days) : null;
};
const withDays = (data: Record<string, unknown>) => { const days = daysBetween(data.start_date, data.end_date); return days === null ? data : { ...data, days_requested: days }; };
const calculateDays = ({ get, set }: { get: (name: string) => unknown; set: (name: string, value: unknown) => void }) => { const days = daysBetween(get('start_date'), get('end_date')); if (days !== null) set('days_requested', days); };

/** `employee.name` et `approver.name` sont lus par sous-requêtes, pour le tri et la recherche. */
class LeaveRequests extends ObjectionAdapter<LeaveRequest> {
    constructor() {
        super(LeaveRequest, { modify: (query) => { query.select('leave_requests.*', employeeName('employee_id', 'employee_name'), employeeName('approver_id', 'approver_name')); } });
    }
}

const review = (status: 'approved' | 'rejected', extra: (data: Record<string, unknown>) => Record<string, unknown> = () => ({})) => async (record: LeaveRequest, data: Record<string, unknown> = {}) => {
    const changes = { status, ...extra(data), reviewed_at: now() };
    await LeaveRequestResource.adapter.update(record.id, changes);
    // Comme `$record->update()` d'Eloquent : l'enregistrement en mémoire suit, la page « View » se redessine à jour.
    Object.assign(record, changes);
};
const isPending = ({ record }: { record: unknown }) => (record as LeaveRequest | null)?.status === 'pending';
const rejectionSchema = () => [Textarea.make('reviewer_notes').label('Reason for rejection').required()];
/** Actions « Approve » et « Reject » : les mêmes sur une ligne de la table et dans l'en-tête de la page « View ». */
const approveAction = () => Action.make('approve').icon('m-check').color('success').visible(isPending).requiresConfirmation()
    .action(async ({ record }) => { await review('approved')(record as LeaveRequest); Notification.make().success().title('Leave request approved').send(); });
const rejectAction = () => Action.make('reject').icon('m-x-mark').color('danger').visible(isPending).modalWidth('md').modalSubmitActionLabel('Reject').schema(rejectionSchema())
    .action(async ({ record, data }) => { await review('rejected', (d) => ({ reviewer_notes: d.reviewer_notes }))(record as LeaveRequest, data); Notification.make().danger().title('Leave request rejected').send(); });

class CreateLeaveRequest extends CreateRecord {
    protected mutateFormDataBeforeCreate(data: Record<string, unknown>): Record<string, unknown> { return withDays(data); }
}
class EditLeaveRequest extends EditRecord {
    getHeaderActions(): Action[] { return [ViewAction.make(), DeleteAction.make()]; }
    protected mutateFormDataBeforeSave(data: Record<string, unknown>): Record<string, unknown> { return withDays(data); }
}
class ViewLeaveRequest extends ViewRecord {
    getHeaderActions(): Action[] { return [approveAction(), rejectAction(), this.editAction()]; }
}

export class LeaveRequestResource extends Resource {
    static slug = 'hr/leave-requests';
    static modelLabel = 'leave request';
    static navigationIcon = 'o-calendar-days';
    static navigationGroup = 'HR';
    static navigationSort = 2;
    static hasViewPage = true;
    static pages = { create: CreateLeaveRequest, edit: EditLeaveRequest, view: ViewLeaveRequest };
    static adapter = new LeaveRequests();
    /** Demandes en attente (équivalent de getNavigationBadge()). */
    static async getNavigationBadge(): Promise<string> { return String(await countWhere('pending')()); }

    static tabs(): Record<string, Tab> {
        const tab = (status: string) => Tab.make(LEAVE_STATUSES[status].label).badge(countWhere(status)).badgeColor(LEAVE_STATUSES[status].color).query((query) => { query.where('status', status); });
        return { '': Tab.make('All').badge(countWhere(null)), pending: tab('pending'), approved: tab('approved'), rejected: tab('rejected'), taken: tab('taken'), cancelled: tab('cancelled') };
    }

    static form(schema: Schema): Schema {
        return schema.components([
            Section.make('Leave Details').columns(2).columnSpanFull().schema([
                Select.make('employee_id').label('Employee').options(employees).searchable().preload().required(),
                toggle('type', LEAVE_TYPES).columnSpanFull(),
                DatePicker.make('start_date').required().live().afterStateUpdated(calculateDays),
                DatePicker.make('end_date').required().minDate(({ get }) => (get('start_date') as string | null) || null).live().afterStateUpdated(calculateDays),
                TimePicker.make('start_time').seconds(false).label('Start time (half days)'),
                TimePicker.make('end_time').seconds(false).label('End time (half days)'),
                TextInput.make('days_requested').numeric().step(0.5).minValue(0).maxValue(999.9).disabled().dehydrated().required(),
                Textarea.make('reason').required().maxLength(65535).columnSpanFull(),
            ]),
            Section.make('Review').hiddenOn('create').columns(2).columnSpanFull().schema([
                TextEntry.make('notice').state(() => "Note: Approving this request will deduct days from the employee's leave balance.").columnSpanFull(),
                toggle('status', LEAVE_STATUSES).columnSpanFull(),
                Select.make('approver_id').label('Approver').searchable()
                    .getSearchResultsUsing(async (search) => (await knex()('employees').whereNull('deleted_at').whereRaw('lower(name) like ?', [like(search)]).orderBy('name').limit(50).select('id', 'name')).map((row: any): [string, string] => [String(row.id), row.name]))
                    .getOptionLabelUsing(async (value) => (await knex()('employees').where({ id: value }).first('name'))?.name ?? null),
                Textarea.make('reviewer_notes').maxLength(65535),
            ]),
        ]);
    }

    static infolist(schema: Schema): Schema {
        return schema.components([
            Section.make('Leave Details').columns(3).columnSpanFull().schema([
                TextEntry.make('employee.name').label('Employee'),
                badgeEntry('type', LEAVE_TYPES),
                badgeEntry('status', LEAVE_STATUSES),
                TextEntry.make('start_date').date(),
                TextEntry.make('end_date').date(),
                TextEntry.make('days_requested').formatStateUsing(({ state }) => Number(state).toFixed(1)).suffix(' days'),
                TextEntry.make('start_time').label('Start time (half days)').time('H:i').placeholder('N/A'),
                TextEntry.make('end_time').label('End time (half days)').time('H:i').placeholder('N/A'),
                TextEntry.make('reason').columnSpanFull(),
            ]),
            Section.make('Review').columns(2).columnSpanFull().schema([
                TextEntry.make('approver.name').label('Approver').placeholder('Not yet assigned'),
                TextEntry.make('reviewed_at').label('Reviewed at').dateTime().placeholder('Not yet reviewed'),
                TextEntry.make('reviewer_notes').placeholder('No notes').columnSpanFull(),
            ]),
        ]);
    }

    static table(table: Table<LeaveRequest>): Table<LeaveRequest> {
        const type = (record: LeaveRequest) => LEAVE_TYPES[record.type];
        return table
            .columns([
                TextColumn.make<LeaveRequest>('employee.name').getStateUsing(({ record }) => record.employee_name ?? null).searchable({ column: 'employee_name' }).sortable({ column: 'employee_name' }).weight('medium'),
                TextColumn.make<LeaveRequest>('type').badge().formatStateUsing(({ record }) => type(record)?.label ?? record.type).color((record) => type(record)?.color ?? 'gray').icon((record) => (type(record) ? `c-${type(record).icon}` : null)),
                SelectColumn.make<LeaveRequest>('status').options(Object.entries(LEAVE_STATUSES).map(([value, item]): [string, string] => [value, item.label])).selectablePlaceholder(false).required(),
                TextColumn.make<LeaveRequest>('start_date').date().sortable(),
                TextColumn.make<LeaveRequest>('end_date').date().sortable(),
                TextColumn.make<LeaveRequest>('days_requested').numeric(1).alignEnd().sortable().summarize(Sum.make()),
                TextColumn.make<LeaveRequest>('approver.name').getStateUsing(({ record }) => record.approver_name ?? null).toggleable(true, { isToggledHiddenByDefault: true }).placeholder('Not assigned'),
            ])
            .defaultSort('start_date', 'desc')
            .recordActions([
                ActionGroup.make([approveAction(), rejectAction(), ViewAction.make(), Action.make('edit').label('Edit').icon('m-pencil-square').color('primary').url(({ record }) => LeaveRequestResource.getUrl('edit', (record as LeaveRequest).id)), DeleteAction.make().action(cheeky)]),
            ])
            .groupedBulkActions([
                Action.make('approve').icon('m-check').color('success').requiresConfirmation()
                    .action(async ({ livewire }) => {
                        for (const key of await livewire.getSelectedRecordKeys()) { const record = await LeaveRequestResource.adapter.find(key); if (record?.status === 'pending') await review('approved')(record); }
                        livewire.deselectAllTableRecords();
                    }),
                Action.make('reject').icon('m-x-mark').color('danger').schema(rejectionSchema())
                    .action(async ({ livewire, data }) => {
                        for (const key of await livewire.getSelectedRecordKeys()) { const record = await LeaveRequestResource.adapter.find(key); if (record?.status === 'pending') await review('rejected', (d) => ({ reviewer_notes: d.reviewer_notes }))(record, data); }
                        livewire.deselectAllTableRecords();
                    }),
                DeleteBulkAction.make().action(cheeky),
            ]);
    }
}
