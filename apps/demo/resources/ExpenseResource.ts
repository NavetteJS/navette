// HR expenses: form, infolist, table, widget, and List / Create (wizard) / Edit / View pages.
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { DatePicker, FileUpload, Repeater, Select, Step, TableColumn, Textarea, TextInput, ToggleButtons, type Field } from '@navette-js/forms';
import { RepeatableEntry, TextEntry } from '@navette-js/infolists';
import { CreateRecord, DeleteAction, DeleteBulkAction, EditRecord, Notification, PageTableStatsWidget, Resource, Stat, Tab, ViewAction, ViewRecord } from '@navette-js/panels';
import { Section, type Component, type Schema } from '@navette-js/schemas';
import { Sum, TextColumn, type Table } from '@navette-js/tables';
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, type EnumCase } from './enums.ts';

export class Expense extends Model {
    static tableName = 'expenses';
    id!: number;
    employee_id!: number;
    project_id!: number | null;
    employee_name?: string | null;
    project_name?: string | null;
    expense_number!: string;
    status!: string;
    category!: string;
    description!: string;
    total_amount!: number;
    currency!: string;
    submitted_at!: string | null;
    approved_at!: string | null;
    receipt_path!: string | null;
    notes!: string | null;
    created_at!: string;
    updated_at!: string;
    /** Expense lines (`expense_lines`), loaded by the adapter. */
    expenseLines?: Record<string, unknown>[];
    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        delete out.employee_name;
        delete out.project_name;
        delete out.expenseLines;
        return out;
    }
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const knex = () => Expense.knex();
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
const countWhere = (status: string | null) => async () => Number(((await Expense.query().modify((q) => { if (status) q.where('status', status); }).count({ n: '*' }).first()) as any)?.n ?? 0);
const options = (table: string, softDeletes: boolean) => async (): Promise<[string, string][]> =>
    (await knex()(table).modify((q: any) => { if (softDeletes) q.whereNull('deleted_at'); }).orderBy('name').limit(50).select('id', 'name')).map((row: any): [string, string] => [String(row.id), row.name]);
const toggle = (name: string, cases: Record<string, EnumCase>) => ToggleButtons.make(name).inline().required()
    .options(Object.entries(cases).map(([value, item]): [string, string] => [value, item.label]))
    .colors(Object.fromEntries(Object.entries(cases).map(([value, item]) => [value, item.color])))
    .icons(Object.fromEntries(Object.entries(cases).map(([value, item]) => [value, `m-${item.icon}`])));
const badgeEntry = (name: string, cases: Record<string, EnumCase>) => TextEntry.make(name).badge()
    .formatStateUsing(({ state }) => cases[String(state)]?.label ?? String(state))
    .color((record) => cases[record[name]]?.color ?? 'gray')
    .icon((record) => (cases[record[name]] ? `c-${cases[record[name]].icon}` : null));
const badgeColumn = (name: 'category' | 'status', cases: Record<string, EnumCase>) => TextColumn.make<Expense>(name).badge()
    .formatStateUsing(({ record }) => cases[record[name]]?.label ?? record[name])
    .color((record) => cases[record[name]]?.color ?? 'gray')
    .icon((record) => (cases[record[name]] ? `c-${cases[record[name]].icon}` : null));
const lineAmount = (line: any) => Math.trunc(Number(line?.quantity ?? 1) || 0) * (Number(line?.unit_price ?? 0) || 0);
const linesTotal = (lines: unknown) => Object.values((lines ?? {}) as Record<string, any>).reduce((sum: number, line) => sum + lineAmount(line), 0);

/** `employee.name` and `project.name` come from subqueries; lines are saved with the expense. */
class Expenses extends ObjectionAdapter<Expense> {
    constructor() {
        super(Expense, {
            modify: (query) => {
                query.select('expenses.*',
                    knex()('employees').select('employees.name').whereRaw('employees.id = expenses.employee_id').as('employee_name'),
                    knex()('projects').select('projects.name').whereRaw('projects.id = expenses.project_id').as('project_name'));
            },
        });
    }
    async find(key: string | number): Promise<Expense | null> {
        const expense = await super.find(key);
        if (expense) expense.expenseLines = await knex()('expense_lines').where({ expense_id: key }).orderBy('id').select('id', 'description', 'quantity', 'unit_price', 'amount', 'date');
        return expense;
    }
    /** Lines keyed `record-<id>` that belong to THIS expense are updated, others are created, missing ones deleted. */
    private async saveLines(expenseKey: string | number, lines: unknown): Promise<void> {
        if (!lines || typeof lines !== 'object' || Array.isArray(lines)) return;
        const existing = new Set<number>((await knex()('expense_lines').where({ expense_id: expenseKey }).select('id')).map((row: any) => Number(row.id)));
        const kept: number[] = [];
        for (const [key, raw] of Object.entries(lines as Record<string, any>)) {
            const values = { description: String(raw.description ?? ''), quantity: Math.trunc(Number(raw.quantity ?? 1)), unit_price: Number(raw.unit_price ?? 0), amount: lineAmount(raw), date: raw.date, updated_at: now() };
            const id = Number(/^record-(\d+)$/.exec(key)?.[1] ?? NaN);
            if (existing.has(id)) { await knex()('expense_lines').where({ id, expense_id: expenseKey }).update(values); kept.push(id); }
            else kept.push((await knex()('expense_lines').insert({ ...values, expense_id: expenseKey, created_at: now() }))[0]);
        }
        await knex()('expense_lines').where({ expense_id: expenseKey }).whereNotIn('id', kept).delete();
    }
    async create(data: Record<string, unknown>): Promise<Expense> {
        const { expenseLines, ...attributes } = data;
        const expense = await super.create(attributes);
        await this.saveLines(expense.id, expenseLines);
        return expense;
    }
    async update(key: string | number, data: Record<string, unknown>): Promise<Expense | null> {
        const { expenseLines, ...attributes } = data;
        // The expense must be within the adapter's scope before any write.
        if (!(await super.find(key))) return null;
        await super.update(key, attributes);
        await this.saveLines(key, expenseLines);
        return this.find(key);
    }
}

// --- fields shared by the edit form (sections) and the create wizard (steps)
const expenseNumber = () => TextInput.make('expense_number').default(`EXP-${String(Math.floor(1 + Math.random() * 999999)).padStart(6, '0')}`).disabled().dehydrated().required().maxLength(255);
const employee = () => Select.make('employee_id').label('Employee').options(options('employees', true)).searchable().preload().required();
const project = () => Select.make('project_id').label('Project').options(options('projects', true)).searchable().preload();
const description = () => Textarea.make('description').required().maxLength(65535).columnSpanFull();
const updateAmount = ({ get, set }: { get: (name: string) => unknown; set: (name: string, value: unknown) => void }) => { set('amount', lineAmount({ quantity: get('quantity'), unit_price: get('unit_price') }).toFixed(2)); };
const linesRepeater = () => Repeater.make('expenseLines').defaultItems(1).reorderable(false)
    // The total follows the lines: called after the changed field (parent fields are notified in turn).
    .afterStateUpdated(({ state, set }) => { set('total_amount', linesTotal(state).toFixed(2)); })
    .table([TableColumn.make('Description'), TableColumn.make('Quantity').width(100), TableColumn.make('Unit Price').width(120), TableColumn.make('Amount').width(120), TableColumn.make('Date').width(150)])
    .schema((): Field[] => [
        TextInput.make('description').required().maxLength(255),
        TextInput.make('quantity').integer().minValue(1).maxValue(2147483647).default(1).required().live({ onBlur: true }).afterStateUpdated(updateAmount),
        TextInput.make('unit_price').numeric().prefix('$').minValue(0).maxValue(99999999.99).required().live({ onBlur: true }).afterStateUpdated(updateAmount),
        TextInput.make('amount').numeric().prefix('$').minValue(0).maxValue(99999999.99).disabled().dehydrated(),
        DatePicker.make('date').required().default(new Date().toISOString().slice(0, 10)),
    ])
    .columnSpanFull();
const summaryFields = (): Component[] => [
    TextInput.make('total_amount').numeric().prefix('$').minValue(0).maxValue(99999999.99).disabled().dehydrated(),
    Select.make('currency').required().options([['USD', 'USD']]).default('USD').disabled().dehydrated()
        .rule({ name: 'in', passes: (value) => value === 'USD', message: (attribute) => `The selected ${attribute} is invalid.` }),
    FileUpload.make('receipt_path').directory('expense-receipts'),
    Textarea.make('notes').maxLength(65535).columnSpanFull(),
];
/** Amounts are recomputed on the server before saving. */
const withTotals = (data: Record<string, unknown>) => {
    const lines = Object.fromEntries(Object.entries((data.expenseLines ?? {}) as Record<string, any>).map(([key, line]) => [key, { ...line, amount: lineAmount(line) }]));
    return { ...data, expenseLines: lines, total_amount: linesTotal(lines) };
};

// --- workflow actions: the same on a table row and in the View page header
const change = async (record: Expense, changes: Record<string, unknown>) => {
    await ExpenseResource.adapter.update(record.id, changes);
    // Also update the in-memory record so the View page re-renders with fresh data.
    Object.assign(record, changes);
};
const is = (status: string) => ({ record }: { record: unknown }) => (record as Expense | null)?.status === status;
const reason = (name: string, label: string) => [Textarea.make(name).required().label(label)];
const workflowActions = (): Record<'approve' | 'reject' | 'submit' | 'reimburse' | 'flag', Action> => ({
    approve: Action.make('approve').icon('m-check').color('success').visible(is('submitted')).requiresConfirmation()
        .action(async ({ record }) => { await change(record as Expense, { status: 'approved', approved_at: now() }); Notification.make().success().title('Expense approved').send(); }),
    reject: Action.make('reject').icon('m-x-mark').color('danger').visible(is('submitted')).modalWidth('md').modalSubmitActionLabel('Reject').schema(reason('rejection_reason', 'Reason for rejection'))
        .action(async ({ record, data }) => { await change(record as Expense, { status: 'rejected', notes: data.rejection_reason }); Notification.make().danger().title('Expense rejected').send(); }),
    submit: Action.make('submit').icon('m-paper-airplane').color('info').visible(is('draft')).requiresConfirmation()
        .action(async ({ record }) => {
            const expense = record as Expense;
            if (Number(expense.total_amount) <= 0) { Notification.make().danger().title('Cannot submit an expense with no amount').send(); return; }
            await change(expense, { status: 'submitted', submitted_at: now() });
            Notification.make().success().title(`Expense ${expense.expense_number} submitted for approval`).send();
        }),
    reimburse: Action.make('reimburse').icon('m-banknotes').color('success').visible(is('approved')).requiresConfirmation()
        .action(async ({ record }) => { await change(record as Expense, { status: 'reimbursed' }); Notification.make().success().title('Expense reimbursed').send(); }),
    flag: Action.make('flag').icon('m-flag').color('warning').modalWidth('md').modalSubmitActionLabel('Flag').schema(reason('flag_reason', 'Reason for flagging'))
        .action(async ({ record, data }) => { await change(record as Expense, { status: 'draft', notes: data.flag_reason }); Notification.make().warning().title('Expense flagged and returned to draft').send(); }),
});

/** Created in three steps; the expense starts as a draft. */
class CreateExpense extends CreateRecord {
    protected getSteps(): Step[] {
        return [
            Step.make('Details').icon('s-information-circle').columns(2).schema([
                expenseNumber(), employee(), project(),
                toggle('category', EXPENSE_CATEGORIES).columnSpanFull(),
                description(),
                TextEntry.make('policy_notice').state(() => 'Expenses over $500 require manager approval. Expenses over $5,000 require VP approval.').columnSpanFull(),
            ]),
            Step.make('Line Items').icon('s-list-bullet').schema([linesRepeater()]),
            Step.make('Review').icon('s-check-circle').columns(2).schema(summaryFields()),
        ];
    }
    protected mutateFormDataBeforeCreate(data: Record<string, unknown>): Record<string, unknown> { return { ...withTotals(data), status: 'draft' }; }
}
class EditExpense extends EditRecord {
    getHeaderActions(): Action[] { return [ViewAction.make(), DeleteAction.make()]; }
    protected mutateFormDataBeforeSave(data: Record<string, unknown>): Record<string, unknown> { return withTotals(data); }
}
class ViewExpense extends ViewRecord {
    getHeaderActions(): Action[] { const actions = workflowActions(); return [actions.submit, actions.approve, actions.reject, actions.reimburse, actions.flag, this.editAction()]; }
}

/** Figures computed from the list table's query. */
export class ExpenseStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => ExpenseResource.getPages().index as any;
    async getStats(): Promise<Stat[]> {
        const monthStart = `${new Date().toISOString().slice(0, 7)}-01 00:00:00`;
        const [pending, approved, all, reimbursed] = await Promise.all([
            this.aggregatePageTable({}, (q) => { q.where('status', 'submitted'); }),
            this.aggregatePageTable({}, (q) => { q.where('status', 'approved').where('approved_at', '>=', monthStart); }),
            this.aggregatePageTable({ avg: ['total_amount'] }),
            this.aggregatePageTable({ sum: ['total_amount'] }, (q) => { q.where('status', 'reimbursed'); }),
        ]);
        const dollars = (value: number) => `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value ?? 0)}`;
        return [
            Stat.make('Pending Approval', pending.count).color('warning'),
            Stat.make('Approved This Month', approved.count).color('success'),
            Stat.make('Avg Expense', dollars(all.avg.total_amount)).color('info'),
            Stat.make('Total Reimbursed', dollars(reimbursed.sum.total_amount)).color('primary'),
        ];
    }
}

export class ExpenseResource extends Resource {
    static slug = 'hr/expenses';
    static modelLabel = 'expense';
    static navigationIcon = 'o-receipt-percent';
    static navigationGroup = 'HR';
    static navigationSort = 3;
    static recordTitleAttribute = 'expense_number';
    // Expenses are left out of global search.
    static globallySearchableAttributes = [];
    static hasViewPage = true;
    static pages = { create: CreateExpense, edit: EditExpense, view: ViewExpense };
    static widgets = [ExpenseStats];
    static headerWidgets = [ExpenseStats];
    static adapter = new Expenses();
    /** Submitted expenses awaiting approval (navigation badge). */
    static async getNavigationBadge(): Promise<string> { return String(await countWhere('submitted')()); }

    static tabs(): Record<string, Tab> {
        const tab = (status: string) => Tab.make(EXPENSE_STATUSES[status].label).badge(countWhere(status)).badgeColor(EXPENSE_STATUSES[status].color).query((query) => { query.where('status', status); });
        return { '': Tab.make('All').badge(countWhere(null)), draft: tab('draft'), submitted: tab('submitted'), approved: tab('approved'), rejected: tab('rejected'), reimbursed: tab('reimbursed') };
    }

    static form(schema: Schema): Schema {
        return schema.components([
            Section.make('Details').columns(2).columnSpanFull().schema([
                expenseNumber(), employee(), project(),
                toggle('category', EXPENSE_CATEGORIES).columnSpanFull(),
                toggle('status', EXPENSE_STATUSES).default('draft').columnSpanFull(),
                description(),
            ]),
            Section.make('Line Items').columnSpanFull().schema([linesRepeater().hiddenLabel()]),
            Section.make('Summary').columns(2).columnSpanFull().schema(summaryFields()),
        ]);
    }

    static infolist(schema: Schema): Schema {
        return schema.components([
            Section.make('Expense Details').columns(3).columnSpanFull().schema([
                TextEntry.make('expense_number').copyable(),
                TextEntry.make('employee.name').label('Employee'),
                badgeEntry('category', EXPENSE_CATEGORIES),
                badgeEntry('status', EXPENSE_STATUSES),
                TextEntry.make('total_amount').money('usd'),
                TextEntry.make('currency'),
                TextEntry.make('project.name').label('Project').placeholder('No project'),
                TextEntry.make('submitted_at').dateTime().placeholder('Not submitted'),
                TextEntry.make('approved_at').dateTime().placeholder('Not approved'),
                TextEntry.make('description').columnSpanFull(),
                TextEntry.make('notes').placeholder('No notes').columnSpanFull(),
            ]),
            Section.make('Line Items').columnSpanFull().schema([
                RepeatableEntry.make('expenseLines').hiddenLabel()
                    .table([TableColumn.make('Description'), TableColumn.make('Quantity').width(100), TableColumn.make('Unit Price').width(120), TableColumn.make('Amount').width(120), TableColumn.make('Date').width(150)])
                    .schema(() => [TextEntry.make('description'), TextEntry.make('quantity').numeric(), TextEntry.make('unit_price').money('usd'), TextEntry.make('amount').money('usd'), TextEntry.make('date').date()]),
            ]),
        ]);
    }

    static table(table: Table<Expense>): Table<Expense> {
        const actions = workflowActions();
        return table
            .columns([
                TextColumn.make<Expense>('expense_number').searchable().sortable().copyable().weight('medium'),
                TextColumn.make<Expense>('employee.name').getStateUsing(({ record }) => record.employee_name ?? null).searchable({ column: 'employee_name' }).sortable({ column: 'employee_name' }),
                badgeColumn('category', EXPENSE_CATEGORIES),
                badgeColumn('status', EXPENSE_STATUSES),
                TextColumn.make<Expense>('total_amount').money().alignEnd().sortable().summarize(Sum.make().money()),
                TextColumn.make<Expense>('project.name').getStateUsing(({ record }) => record.project_name ?? null).sortable({ column: 'project_name' }).toggleable().placeholder('No project'),
                TextColumn.make<Expense>('submitted_at').dateTime().sortable().toggleable(),
            ])
            .defaultSort('created_at', 'desc')
            .recordActions([
                ActionGroup.make([
                    ViewAction.make(),
                    Action.make('edit').label('Edit').icon('m-pencil-square').color('primary').url(({ record }) => ExpenseResource.getUrl('edit', (record as Expense).id)),
                    actions.approve, actions.reject, actions.submit, actions.reimburse, actions.flag,
                    DeleteAction.make().action(cheeky),
                ]),
            ])
            .groupedBulkActions([DeleteBulkAction.make().action(cheeky)]);
    }
}
