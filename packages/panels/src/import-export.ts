// Import and export actions: CSV and XLSX files, read and written during the request or in the background (queued()),
// an optional history of runs, and a per-user download store.
import { buildXlsx, readXlsx } from './xlsx.ts';
import { AssertionError } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { Action } from '@navette-js/actions';
import { CheckboxList, FileUpload, Select } from '@navette-js/forms';
import { Fieldset } from '@navette-js/schemas';
import { configured, icons } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { getTableQuery } from '@navette-js/tables';
import { Notification } from './notifications.ts';

// ------------------------------------------------------------------ downloads
type StoredFile = { owner: string; name: string; type: string; content: Buffer; expires: number };
/**
 * Files offered for download to one user (exports, failed import rows), kept in memory for a limited time. They are lost
 * when the process restarts and are not shared between processes.
 */
export class DownloadStore {
    private files = new Map<string, StoredFile>();
    private readonly ttl: number;
    private readonly maxFiles: number;
    constructor(options: { ttl?: number; maxFiles?: number } = {}) { this.ttl = options.ttl ?? 24 * 60 * 60 * 1000; this.maxFiles = options.maxFiles ?? 500; }
    /** Stores a file for a user and returns its token (part of the download URL). */
    put(owner: string | number, name: string, type: string, content: string | Buffer): string {
        const now = Date.now();
        for (const [token, file] of this.files) if (file.expires < now) this.files.delete(token);
        while (this.files.size >= this.maxFiles) this.files.delete(this.files.keys().next().value!);
        const token = randomBytes(24).toString('base64url');
        this.files.set(token, { owner: String(owner), name, type, content: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'), expires: now + this.ttl });
        return token;
    }
    /** The file of a token, only for the user who created it. */
    get(token: string, owner: string | number): StoredFile | null {
        const file = this.files.get(token);
        if (!file || file.expires < Date.now() || file.owner !== String(owner)) return null;
        return file;
    }
}

// ------------------------------------------------------------------ CSV
/**
 * A CSV cell. Text starting with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with `'`, so that spreadsheet
 * software does not run it as a formula (CSV injection).
 */
export function csvCell(value: unknown): string {
    let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
    if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export const csvLine = (cells: unknown[]): string => cells.map(csvCell).join(',');
/** Parses CSV text (quoted cells, doubled quotes, line breaks inside quotes). */
export function parseCsv(text: string, maxRows = Infinity): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false;
    const source = text.replace(/^﻿/, '');
    for (let index = 0; index < source.length; index++) {
        const char = source[index];
        if (quoted) {
            if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; } else if (char === '"') quoted = false; else cell += char;
            continue;
        }
        if (char === '"') quoted = true;
        else if (char === ',') { row.push(cell); cell = ''; }
        else if (char === '\n' || char === '\r') {
            if (char === '\r' && source[index + 1] === '\n') index++;
            row.push(cell); cell = '';
            if (row.some((value) => value !== '')) rows.push(row);
            row = [];
            if (rows.length > maxRows) return rows;
        } else cell += char;
    }
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
    return rows;
}

// ------------------------------------------------------------------ export
/** Column of an export: its header and the value written for each record. */
export class ExportColumn {
    readonly name: string;
    private _label: string | null = null;
    private _state: ((record: any) => unknown) | null = null;
    private _format: ((state: unknown, record: any) => unknown) | null = null;
    private _enabledByDefault = true;
    constructor(name: string) { this.name = name; }
    static make(name: string): ExportColumn { return configured(new ExportColumn(name)); }
    label(label: string | null): this { this._label = label; return this; }
    getLabel(): string { return this._label ?? this.name.replace(/[_.]+/g, ' ').replace(/^./, (c) => c.toUpperCase()); }
    /** Value from the record, instead of the attribute with the column's name (dots read relationships: `author.name`). */
    state(resolver: ((record: any) => unknown) | null): this { this._state = resolver; return this; }
    formatStateUsing(format: ((state: unknown, record: any) => unknown) | null): this { this._format = format; return this; }
    /** `false`: unchecked in the export modal. */
    enabledByDefault(condition = true): this { this._enabledByDefault = condition; return this; }
    isEnabledByDefault(): boolean { return this._enabledByDefault; }
    getValue(record: any): unknown {
        const state = this._state ? this._state(record) : this.name.split('.').reduce((value: any, key) => (value === null || value === undefined ? value : value[key]), record);
        return this._format ? this._format(state, record) : state;
    }
}
/** Describes an export: its columns, and optionally the query and the notification. */
export abstract class Exporter {
    static getColumns(): ExportColumn[] { return []; }
    /** Changes the query of the exported records (e.g. eager loading). */
    static modifyQuery(_query: any): void {}
    /** Body of the "Export completed" notification. */
    static getCompletedNotificationBody(count: number): string { return `Your export has completed and ${count.toLocaleString('en-US')} ${count === 1 ? 'row' : 'rows'} exported.`; }
    /** File name, without extension. */
    static getFileName(_count: number): string { return `export-${new Date().toISOString().slice(0, 10)}`; }
    /**
     * Row values of this exporter, without a table or a file (tests): `ProductExporter.test().export(record)`. Without a
     * `columnMap`, the columns enabled by default; with one (`{ name: 'Name' }`), exactly those columns, in its order.
     */
    static test(columnMap: Record<string, string> | null = null): TestableExport { return new TestableExport(this, columnMap); }
}
/** Exports single records with an exporter's columns (see `Exporter.test()`). */
export class TestableExport {
    readonly columns: ExportColumn[];
    /** Header row of the file: the labels of the selected columns. */
    readonly labels: string[];
    constructor(exporter: typeof Exporter, columnMap: Record<string, string> | null = null) {
        const all = exporter.getColumns();
        this.columns = columnMap === null ? all.filter((column) => column.isEnabledByDefault()) : Object.keys(columnMap).map((name) => {
            const column = all.find((candidate) => candidate.name === name);
            if (!column) throw new Error(`${exporter.name}: no export column named "${name}".`);
            return column;
        });
        this.labels = this.columns.map((column) => columnMap?.[column.name] ?? column.getLabel());
    }
    /** Values of one record, in column order, as written to the file before CSV escaping. */
    export(record: unknown): unknown[] { return this.columns.map((column) => column.getValue(record)); }
}
export type ExportActionInstance = Action & {
    exporter(exporter: typeof Exporter): ExportActionInstance;
    /** Refuses exports of more rows (10,000 by default, 100,000 at most). */
    maxRows(count: number): ExportActionInstance;
    /** `false`: no column selection, every column is exported (the modal only confirms). */
    columnMapping(condition: boolean): ExportActionInstance;
    /** Files offered for download: `['csv', 'xlsx']` (both by default). */
    formats(formats: ('csv' | 'xlsx')[]): ExportActionInstance;
    /** Builds the files after the response, in the background; the download links arrive in the bell. */
    queued(condition?: boolean): ExportActionInstance;
};

const DEFAULT_MAX_EXPORT_ROWS = 10000, HARD_MAX_EXPORT_ROWS = 100000, CHUNK = 1000;
const fileNameOf = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120) || 'export';

function makeExportAction(name: string, bulk: boolean): ExportActionInstance {
    let exporter: typeof Exporter | null = null, maxRows = DEFAULT_MAX_EXPORT_ROWS, mapping = true, formats: ('csv' | 'xlsx')[] = ['csv', 'xlsx'], queued = false;
    const columnsOf = () => { if (!exporter) throw new Error('ExportAction: call exporter() with an Exporter class.'); return exporter.getColumns(); };
    const action = Action.make(name).color('gray').icon(icons.resolve('actions::export-action.grouped') ?? 'm-arrow-down-tray')
        // Exporting reads the records: the resource's `viewAny` ability (or the host's own checks) applies.
        .authorize(async ({ livewire }) => (typeof livewire?.resource?.can === 'function' ? livewire.resource.can('viewAny', livewire._ctx?.user ?? null) : true))
        .label(({ livewire }) => t('filament-actions::export.label', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
        .modalHeading(({ livewire }) => t('filament-actions::export.modal.heading', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
        .modalSubmitActionLabel(t('filament-actions::export.modal.actions.export.label'))
        .modalWidth('md')
        .schema(() => (mapping ? [CheckboxList.make('columns').label(t('filament-actions::export.modal.form.columns.label')).options(columnsOf().map((column): [string, string] => [column.name, column.getLabel()])).columns(2)] : []))
        .fillForm(() => ({ columns: columnsOf().filter((column) => column.isEnabledByDefault()).map((column) => column.name) }))
        .action(async ({ livewire, data }) => {
            // Only declared columns are exported, whatever list the browser sends.
            const requested = mapping ? (Array.isArray(data.columns) ? data.columns.map(String) : []) : columnsOf().map((column) => column.name);
            const columns = columnsOf().filter((column) => requested.includes(column.name));
            if (!columns.length) { Notification.make().danger().title(t('filament-actions::export.notifications.no_columns.title')).body(t('filament-actions::export.notifications.no_columns.body')).send(); return; }
            const adapter = livewire.getDataAdapterForTable();
            const table = livewire.getTable();
            // The table's current query (filters, search, sort); a bulk export only takes the selected records.
            const query = { ...getTableQuery(table, livewire), modifiers: [...(getTableQuery(table, livewire).modifiers ?? []), (q: any) => exporter!.modifyQuery(q)] } as any;
            if (bulk) query.keys = await livewire.getSelectedRecordKeys();
            const first = await adapter.paginate({ ...query, page: 1, perPage: CHUNK });
            const limit = Math.min(maxRows, HARD_MAX_EXPORT_ROWS);
            if (first.total > limit) { Notification.make().danger().title(t('filament-actions::export.notifications.max_rows.title')).body(tc('filament-actions::export.notifications.max_rows.body', limit, { count: limit.toLocaleString('en-US') })).send(); return; }
            const user = livewire._ctx?.user;
            const panel = livewire._ctx?.panel;
            const background = queued && canQueue(panel);
            const history: ImportExportHistory | null = panel?.getImportExportHistory?.() ?? null;
            const run = async () => {
                const exportId = history ? await history.startExport({ userId: user.id, exporter: exporter!.name, fileName: fileNameOf(exporter!.getFileName(first.total)), totalRows: first.total }) : null;
                const rows: unknown[][] = [columns.map((column) => column.getLabel())];
                for (let page = 1; page <= first.lastPage; page++) {
                    const { records } = page === 1 ? first : await adapter.paginate({ ...query, page, perPage: CHUNK });
                    for (const record of records) rows.push(columns.map((column) => column.getValue(record)));
                }
                const count = rows.length - 1;
                const fileName = fileNameOf(exporter!.getFileName(count));
                const links: { label: string; url: string }[] = [];
                if (formats.includes('csv')) links.push({ label: t('filament-actions::export.notifications.completed.actions.download_csv.label'), url: panel.getDownloadUrl(panel.getDownloads().put(user.id, `${fileName}.csv`, 'text/csv; charset=utf-8', `﻿${rows.map(csvLine).join('\r\n')}\r\n`)) });
                if (formats.includes('xlsx')) links.push({ label: t('filament-actions::export.notifications.completed.actions.download_xlsx.label'), url: panel.getDownloadUrl(panel.getDownloads().put(user.id, `${fileName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buildXlsx(rows))) });
                if (history && exportId !== null) await history.finishExport(exportId, { successfulRows: count });
                await deliver(Notification.make().success().persistent().title(t('filament-actions::export.notifications.completed.title')).body(exporter!.getCompletedNotificationBody(count)).actions(links), background, panel, user);
            };
            if (bulk) livewire.deselectAllTableRecords();
            if (!background) { await run(); return; }
            Notification.make().success().title(t('filament-actions::export.notifications.started.title')).body(tc('filament-actions::export.notifications.started.body', first.total, { count: first.total.toLocaleString('en-US') })).send();
            runInBackground(run);
        }) as ExportActionInstance;
    action.exporter = (value) => { exporter = value; return action; };
    action.maxRows = (count) => { maxRows = Math.max(1, Math.floor(count)); return action; };
    action.formats = (list) => { const allowed = list.filter((format) => format === 'csv' || format === 'xlsx'); if (!allowed.length) throw new Error('ExportAction: formats() needs csv and/or xlsx.'); formats = [...new Set(allowed)]; return action; };
    action.columnMapping = (condition) => { mapping = condition; if (!condition) action.requiresConfirmation(); return action; };
    action.queued = (condition = true) => { queued = condition; return action; };
    return action;
}
/** Exports the records of the table (with its filters, search and sort) to a CSV file. */
export class ExportAction { static make(name = 'export'): ExportActionInstance { return makeExportAction(name, false); } }
/** Exports the selected records to a CSV file. */
export class ExportBulkAction { static make(name = 'export'): ExportActionInstance { return makeExportAction(name, true); } }

// ------------------------------------------------------------------ import
type ImportRule = string | ((value: unknown, row: Record<string, unknown>) => string | null);
/** Column of an import: the file column it is read from, its validation and how the value is cast. */
export class ImportColumn {
    readonly name: string;
    private _label: string | null = null;
    private _guesses: string[] = [];
    private _required = false;
    private _rules: ImportRule[] = [];
    private _cast: ((value: string | null) => unknown) | null = null;
    private _example: string | null = null;
    private _fill: ((record: Record<string, unknown>, value: unknown) => void) | null = null;
    constructor(name: string) { this.name = name; }
    static make(name: string): ImportColumn { return configured(new ImportColumn(name)); }
    label(label: string | null): this { this._label = label; return this; }
    getLabel(): string { return this._label ?? this.name.replace(/[_.]+/g, ' ').replace(/^./, (c) => c.toUpperCase()); }
    /** Other file headers that map to this column (compared case-insensitively). */
    guess(headers: string[]): this { this._guesses = headers; return this; }
    /** The file must contain this column. */
    requiredMapping(condition = true): this { this._required = condition; return this; }
    isMappingRequired(): boolean { return this._required; }
    /** `required`, `email`, `numeric`, `integer`, `boolean`, `min:n`, `max:n`, `in:a,b`, or a function returning an error message. */
    rules(rules: ImportRule[]): this { this._rules = rules; return this; }
    /** Converts the text of the cell before it is saved. */
    castStateUsing(cast: ((value: string | null) => unknown) | null): this { this._cast = cast; return this; }
    numeric(): this { return this.castStateUsing((value) => (value === null || value === '' ? null : Number(value))); }
    boolean(): this { return this.castStateUsing((value) => (value === null || value === '' ? null : ['1', 'true', 'yes', 'y', 'on'].includes(value.toLowerCase()) ? 1 : 0)); }
    /** Value written in the example file. */
    example(value: string | null): this { this._example = value; return this; }
    getExample(): string { return this._example ?? ''; }
    /** Writes the value into the record yourself, instead of the attribute with the column's name. */
    fillRecordUsing(fill: ((record: Record<string, unknown>, value: unknown) => void) | null): this { this._fill = fill; return this; }
    matches(header: string): boolean { const normalized = header.trim().toLowerCase(); return [this.name, this.getLabel(), ...this._guesses].some((candidate) => candidate.toLowerCase() === normalized); }
    validate(value: string | null, row: Record<string, unknown>): string | null { return this.failedRule(value, row)?.message ?? null; }
    /** First rule the value fails, with its message (`closure` for a function rule). */
    failedRule(value: string | null, row: Record<string, unknown>): { rule: string; message: string } | null {
        const label = this.getLabel().toLowerCase();
        const blank = value === null || value.trim() === '';
        for (const rule of this._rules) {
            if (typeof rule === 'function') { const message = rule(value, row); if (message) return { rule: 'closure', message }; continue; }
            const [name, parameter = ''] = rule.split(':');
            const fail = (message: string) => ({ rule: name, message });
            if (name === 'required' && blank) return fail(`The ${label} field is required.`);
            if (blank) continue;
            const text = value!.trim();
            if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return fail(`The ${label} field must be a valid email address.`);
            if (name === 'numeric' && !Number.isFinite(Number(text))) return fail(`The ${label} field must be a number.`);
            if (name === 'integer' && !/^-?\d+$/.test(text)) return fail(`The ${label} field must be an integer.`);
            if (name === 'boolean' && !['0', '1', 'true', 'false', 'yes', 'no'].includes(text.toLowerCase())) return fail(`The ${label} field must be true or false.`);
            if (name === 'max' && text.length > Number(parameter)) return fail(`The ${label} field must not be greater than ${parameter} characters.`);
            if (name === 'min' && text.length < Number(parameter)) return fail(`The ${label} field must be at least ${parameter} characters.`);
            if (name === 'in' && !parameter.split(',').includes(text)) return fail(`The selected ${label} is invalid.`);
        }
        return null;
    }
    cast(value: string | null): unknown { return this._cast ? this._cast(value) : value === '' ? null : value; }
    fill(record: Record<string, unknown>, value: unknown): void { if (this._fill) this._fill(record, value); else record[this.name] = value; }
}
/** Describes an import: its columns, how a row finds or creates its record, and hooks. */
/** Thrown from an importer hook to fail the current row with this message (shown in the failed rows file). */
export class RowImportFailedError extends Error {}

type DataAdapterLike = { getKey(record: any): string; create(data: Record<string, unknown>): Promise<any>; update(key: string, data: Record<string, unknown>): Promise<any> };
type RowResult = { record: any | null; errors: Record<string, { rule: string; message: string }>; failure: string | null };
/**
 * Imports one row (raw cell values by column name; only `mapped` columns are read): validation, then `resolveRecord()`,
 * `beforeSave()`, create or update through the adapter, and `afterSave()`. A `RowImportFailedError` fails the row.
 */
async function importRow(importer: typeof Importer, columns: ImportColumn[], mapped: (column: ImportColumn) => boolean, raw: Record<string, string | null>, adapter: DataAdapterLike, livewire: unknown): Promise<RowResult> {
    const errors: RowResult['errors'] = {};
    for (const column of columns) {
        if (!mapped(column)) continue;
        const failed = column.failedRule(raw[column.name] ?? null, raw);
        if (failed) errors[column.name] = failed;
    }
    if (Object.keys(errors).length) return { record: null, errors, failure: null };
    try {
        const record = await importer.resolveRecord(raw, { livewire });
        const values: Record<string, unknown> = {};
        for (const column of columns) if (mapped(column)) column.fill(values, column.cast(raw[column.name] ?? null));
        await importer.beforeSave(values, record);
        const saved = record ? await adapter.update(adapter.getKey(record), values) : await adapter.create(values);
        await importer.afterSave(saved);
        return { record: saved, errors, failure: null };
    } catch (error) {
        if (error instanceof RowImportFailedError) return { record: null, errors, failure: error.message };
        throw error;
    }
}

const fail = (message: string): never => { throw new AssertionError({ message }); };
/** Imports single rows with an importer, without a file or an action (see `Importer.test()`). */
export class TestableImport {
    private result: RowResult | null = null;
    private readonly importer: typeof Importer;
    private readonly options: { adapter: DataAdapterLike; columnMap?: Record<string, string> | null; livewire?: unknown };
    constructor(importer: typeof Importer, options: { adapter: DataAdapterLike; columnMap?: Record<string, string> | null; livewire?: unknown }) { this.importer = importer; this.options = options; }
    /** Imports a row: its keys are file headers (the column names, unless `columnMap` maps columns to other headers). */
    async import(row: Record<string, unknown>): Promise<this> {
        const columns = this.importer.getColumns();
        const map = this.options.columnMap ?? Object.fromEntries(columns.map((column) => [column.name, column.name]));
        const raw: Record<string, string | null> = {};
        for (const column of columns) {
            const header = map[column.name];
            const value = header === undefined ? undefined : row[header];
            raw[column.name] = value === undefined || value === null ? null : String(value);
        }
        this.result = await importRow(this.importer, columns, (column) => map[column.name] !== undefined, raw, this.options.adapter, this.options.livewire ?? null);
        return this;
    }
    private get outcome(): RowResult { if (!this.result) throw new Error('Call import() before asserting.'); return this.result; }
    /** The saved record (`null` when the row failed). */
    getRecord(): any | null { return this.outcome.record; }
    /** Validation errors of the row: message by column name. */
    errors(): Record<string, string> { return Object.fromEntries(Object.entries(this.outcome.errors).map(([column, error]) => [column, error.message])); }
    /** The row was saved. */
    assertImported(): this {
        const { record, errors, failure } = this.outcome;
        if (record === null) fail(`Failed asserting that the row was imported: ${failure ?? Object.values(errors).map((error) => error.message).join(' ')}`);
        return this;
    }
    /** Validation errors: any (no argument), on some columns (`['price']`), or failing given rules (`{ price: 'min' }`). */
    assertHasErrors(expected: string[] | Record<string, string | string[]> = []): this {
        const errors = this.outcome.errors;
        if (Array.isArray(expected) ? !expected.length : !Object.keys(expected).length) { if (!Object.keys(errors).length) fail('Failed asserting that the row has validation errors.'); return this; }
        for (const [column, rules] of Array.isArray(expected) ? expected.map((column): [string, string[]] => [column, []]) : Object.entries(expected)) {
            const error = errors[column];
            if (!error) fail(`Failed asserting that the column [${column}] has a validation error.`);
            for (const rule of [rules].flat()) if (rule !== error.rule && rule !== error.message) fail(`Failed asserting that the column [${column}] fails the [${rule}] rule: it failed [${error.rule}] (${error.message}).`);
        }
        return this;
    }
    /** No validation errors, or none on the given columns. */
    assertHasNoErrors(columns: string[] = []): this {
        const failed = Object.keys(this.outcome.errors).filter((column) => !columns.length || columns.includes(column));
        if (failed.length) fail(`Failed asserting that the row has no validation errors: ${failed.map((column) => `[${column}] ${this.outcome.errors[column].message}`).join(', ')}.`);
        return this;
    }
    /** The row failed with a `RowImportFailedError` (with this message, if given). */
    assertHasRowFailure(message: string | null = null): this {
        const failure = this.outcome.failure;
        if (failure === null) fail('Failed asserting that the row failed to import.');
        if (message !== null && failure !== message) fail(`Failed asserting that the row failed with [${message}]: it failed with [${failure}].`);
        return this;
    }
    assertHasNoRowFailure(): this { if (this.outcome.failure !== null) fail(`Failed asserting that the row did not fail: ${this.outcome.failure}`); return this; }
}

export abstract class Importer {
    /**
     * Runs rows through this importer without a file (tests): `await ProductImporter.test({ adapter }).import({ sku: 'MUG-1' })`.
     * `columnMap` maps column names to the row's keys (file headers); `livewire` is passed to `resolveRecord()`.
     */
    static test(options: { adapter: DataAdapterLike; columnMap?: Record<string, string> | null; livewire?: unknown }): TestableImport { return new TestableImport(this, options); }
    static getColumns(): ImportColumn[] { return []; }
    /**
     * Existing record a row updates, or `null` to create one (the default). For example, find a product by its SKU with the
     * data adapter. Only return records the user may change.
     */
    static async resolveRecord(_data: Record<string, unknown>, _ctx: { livewire: any }): Promise<any | null> { return null; }
    /** Runs before a record is saved; `data` may be changed. */
    static async beforeSave(_data: Record<string, unknown>, _record: any | null): Promise<void> {}
    static async afterSave(_record: any): Promise<void> {}
    static getCompletedNotificationBody(imported: number, failed: number): string {
        return `Your import has completed and ${imported.toLocaleString('en-US')} ${imported === 1 ? 'row' : 'rows'} imported.${failed ? ` ${failed.toLocaleString('en-US')} ${failed === 1 ? 'row' : 'rows'} failed to import.` : ''}`;
    }
}
export type ImportActionInstance = Action & {
    importer(importer: typeof Importer): ImportActionInstance;
    /** Refuses files with more rows (1,000 by default, 10,000 at most; 100,000 for a queued import). */
    maxRows(count: number): ImportActionInstance;
    /** Largest accepted file, in kilobytes (5,120 by default). */
    maxFileSize(kilobytes: number): ImportActionInstance;
    /** `false`: no column selection after the upload; file headers are matched to the columns automatically. */
    columnMapping(condition: boolean): ImportActionInstance;
    /** Runs after the response, in the background: the user is told it started, then notified in the bell when it ends. */
    queued(condition?: boolean): ImportActionInstance;
};
const DEFAULT_MAX_IMPORT_ROWS = 1000, HARD_MAX_IMPORT_ROWS = 10000, HARD_MAX_QUEUED_IMPORT_ROWS = 100000;

/** Rows of an uploaded CSV or XLSX file (detected from its content, never its name), up to `limit` rows. */
export function readSpreadsheet(path: string, limit: number): string[][] {
    const buffer = readFileSync(path);
    if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) return readXlsx(buffer, limit);
    return parseCsv(buffer.toString('utf8').replace(/^﻿/, ''), limit);
}
/** Path of the temporary file uploaded in a FileUpload state, if any. */
function temporaryPathOf(livewire: any, state: unknown): string | null {
    // A saved entry (`{ file: TemporaryUpload }`), a list of them, or the raw state of the field (upload references).
    if (state && typeof state === 'object' && typeof (state as any).file?.path === 'string') return (state as any).file.path;
    const values = Array.isArray(state) ? state : state && typeof state === 'object' ? Object.values(state as Record<string, unknown>) : [state];
    for (const value of values) {
        const file = (value && typeof value === 'object' && (value as any).file?.path) ? (value as any).file : livewire?._runtime?.uploads?.resolve?.(value);
        if (typeof file?.path === 'string') return file.path;
    }
    return null;
}
const headersOf = (livewire: any, state: unknown): string[] => {
    const path = temporaryPathOf(livewire, state);
    if (!path) return [];
    try { return (readSpreadsheet(path, 1)[0] ?? []).map((cell) => cell.trim()).filter((cell, index, all) => cell !== '' && all.indexOf(cell) === index); } catch { return []; }
};

// ------------------------------------------------------------------ background work and history
export type BackgroundTask = () => Promise<void>;
const pendingTasks: BackgroundTask[] = [];
let draining = false;
async function drainTasks(): Promise<void> {
    if (draining) return;
    draining = true;
    while (pendingTasks.length) {
        const task = pendingTasks.shift()!;
        try { await task(); } catch (error) { console.error('[navette] background task failed:', error); }
    }
    draining = false;
}
let backgroundRunner: (task: BackgroundTask) => void = (task) => { pendingTasks.push(task); setImmediate(() => { void drainTasks(); }); };
/**
 * Runs queued imports and exports. By default, one at a time in this process, after the response. Plug your own queue (BullMQ,
 * a worker…) with a function receiving each task.
 */
export const useBackgroundRunner = (runner: (task: BackgroundTask) => void): void => { backgroundRunner = runner; };
export const runInBackground = (task: BackgroundTask): void => backgroundRunner(task);

/** Where runs of imports and exports are recorded (see `knexImportExportHistory()`). */
export interface ImportExportHistory {
    startImport(data: { userId: string | number; importer: string; fileName: string; totalRows: number }): Promise<string | number>;
    finishImport(id: string | number, data: { processedRows: number; successfulRows: number }): Promise<void>;
    recordFailedImportRow(importId: string | number, row: Record<string, unknown>, error: string): Promise<void>;
    startExport(data: { userId: string | number; exporter: string; fileName: string; totalRows: number }): Promise<string | number>;
    finishExport(id: string | number, data: { successfulRows: number }): Promise<void>;
}
type Query = (table: string) => any;
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
/** History in `imports`, `exports` and `failed_import_rows` tables (create them with `importExportSchema()`). */
export function knexImportExportHistory(db: Query): ImportExportHistory {
    const insert = async (table: string, values: Record<string, unknown>) => { const [id] = await db(table).insert(values); return typeof id === 'object' && id !== null ? (id as any).id : id; };
    return {
        startImport: (data) => insert('imports', { user_id: data.userId, importer: data.importer, file_name: data.fileName.slice(0, 255), total_rows: data.totalRows, processed_rows: 0, successful_rows: 0, created_at: now(), updated_at: now() }),
        async finishImport(id, data) { await db('imports').where('id', id).update({ processed_rows: data.processedRows, successful_rows: data.successfulRows, completed_at: now(), updated_at: now() }); },
        async recordFailedImportRow(importId, row, error) { await db('failed_import_rows').insert({ import_id: importId, data: JSON.stringify(row), validation_error: error.slice(0, 1000), created_at: now(), updated_at: now() }); },
        startExport: (data) => insert('exports', { user_id: data.userId, exporter: data.exporter, file_name: data.fileName.slice(0, 255), total_rows: data.totalRows, successful_rows: 0, created_at: now(), updated_at: now() }),
        async finishExport(id, data) { await db('exports').where('id', id).update({ successful_rows: data.successfulRows, completed_at: now(), updated_at: now() }); },
    };
}
/** Creates the history tables when missing (call it from a migration). */
export async function importExportSchema(knex: any): Promise<void> {
    if (!(await knex.schema.hasTable('imports'))) await knex.schema.createTable('imports', (table: any) => {
        table.increments('id'); table.integer('user_id').index(); table.string('importer'); table.string('file_name');
        table.integer('total_rows'); table.integer('processed_rows').defaultTo(0); table.integer('successful_rows').defaultTo(0); table.timestamp('completed_at').nullable(); table.timestamps();
    });
    if (!(await knex.schema.hasTable('failed_import_rows'))) await knex.schema.createTable('failed_import_rows', (table: any) => {
        table.increments('id'); table.integer('import_id').index(); table.text('data'); table.text('validation_error').nullable(); table.timestamps();
    });
    if (!(await knex.schema.hasTable('exports'))) await knex.schema.createTable('exports', (table: any) => {
        table.increments('id'); table.integer('user_id').index(); table.string('exporter'); table.string('file_name');
        table.integer('total_rows'); table.integer('successful_rows').defaultTo(0); table.timestamp('completed_at').nullable(); table.timestamps();
    });
}
/** Sends a notification now (in the request) or, for background work, to the user's database notifications. */
async function deliver(notification: Notification, background: boolean, panel: any, user: any): Promise<void> {
    if (background) await notification.sendToDatabase(panel.getDatabaseNotifications?.() ?? null, user.id);
    else notification.send();
}
/** Background work needs database notifications to tell the user it ended; without them, it runs in the request. */
const canQueue = (panel: any) => Boolean(panel?.getDatabaseNotifications?.());

/** Imports the rows of a CSV or XLSX file: each row is validated, then creates or updates a record through the data adapter. */
export class ImportAction {
    static make(name = 'import'): ImportActionInstance {
        let importer: typeof Importer | null = null, maxRows = DEFAULT_MAX_IMPORT_ROWS, maxKilobytes = 5120, mapping = true, queued = false;
        const columnsOf = () => { if (!importer) throw new Error('ImportAction: call importer() with an Importer class.'); return importer.getColumns(); };
        const example = Action.make('downloadExample').label(t('filament-actions::import.modal.actions.download_example.label')).color('gray').link()
            .action(({ livewire }) => {
                const columns = columnsOf();
                const csv = `${csvLine(columns.map((column) => column.name))}\r\n${csvLine(columns.map((column) => column.getExample()))}\r\n`;
                const panel = livewire._ctx?.panel;
                livewire.redirect(panel.getDownloadUrl(panel.getDownloads().put(livewire._ctx.user.id, 'import-example.csv', 'text/csv; charset=utf-8', csv)));
            });
        const action = Action.make(name).color('gray').icon(icons.resolve('actions::import-action.grouped') ?? 'm-arrow-up-tray')
            // Importing creates or updates records: the resource's `create` ability applies.
            .authorize(async ({ livewire }) => (typeof livewire?.resource?.can === 'function' ? livewire.resource.can('create', livewire._ctx?.user ?? null) : true))
            .label(({ livewire }) => t('filament-actions::import.label', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
            .modalHeading(({ livewire }) => t('filament-actions::import.modal.heading', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
            .modalSubmitActionLabel(t('filament-actions::import.modal.actions.import.label'))
            .modalWidth('md')
            .schema((schema: any) => {
                const livewire = schema.livewire;
                const columns = columnsOf();
                // The columns of the uploaded file, to map them to the importer's columns.
                const mounted = livewire?.mountedActions?.find?.((candidate: any) => candidate.name === name);
                const headers = mapping ? headersOf(livewire, mounted?.data?.file) : [];
                const file = FileUpload.make('file').label(t('filament-actions::import.modal.form.file.label')).placeholder(t('filament-actions::import.modal.form.file.placeholder'))
                    .acceptedFileTypes(['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv', '.xlsx']).maxSize(maxKilobytes).storeFiles(false).required();
                if (mapping) file.live().afterStateUpdated(({ state, set }) => {
                    const found = headersOf(livewire, state);
                    set('columnMap', Object.fromEntries(columns.map((column) => [column.name, found.find((header) => column.matches(header)) ?? null])));
                });
                return schema.components([
                    file,
                    ...(mapping && headers.length ? [Fieldset.make(t('filament-actions::import.modal.form.columns.label')).statePath('columnMap').columns(1).schema(columns.map((column) =>
                        Select.make(column.name).label(column.getLabel()).placeholder(t('filament-actions::import.modal.form.columns.placeholder')).options(headers.map((header): [string, string] => [header, header])).required(column.isMappingRequired())))] : []),
                ]);
            })
            .extraModalFooterActions([example])
            .action(async ({ livewire, data }) => {
                const path = temporaryPathOf(livewire, data.file);
                // Only a temporary upload of this request is read, never a path sent by the browser.
                if (typeof path !== 'string' || statSync(path).size > maxKilobytes * 1024) return;
                const panel = livewire._ctx?.panel, user = livewire._ctx?.user;
                const background = queued && canQueue(panel);
                const limit = Math.min(maxRows, background ? HARD_MAX_QUEUED_IMPORT_ROWS : HARD_MAX_IMPORT_ROWS);
                let rows: string[][];
                try { rows = readSpreadsheet(path, limit + 1); } catch {
                    Notification.make().danger().title(t('filament-actions::import.notifications.completed.title')).body('The file could not be read: upload a CSV or XLSX file.').send();
                    return;
                }
                const header = (rows.shift() ?? []).map((cell) => cell.trim());
                if (rows.length > limit) { Notification.make().danger().title(t('filament-actions::import.notifications.max_rows.title')).body(tc('filament-actions::import.notifications.max_rows.body', limit, { count: limit.toLocaleString('en-US') })).send(); return; }
                const columns = columnsOf();
                // Chosen columns (only headers of the file are accepted), else automatic matching.
                const chosen = (data.columnMap && typeof data.columnMap === 'object' ? data.columnMap : {}) as Record<string, unknown>;
                const indexOf = (column: ImportColumn) => {
                    if (mapping && Object.hasOwn(chosen, column.name)) return typeof chosen[column.name] === 'string' ? header.indexOf(chosen[column.name] as string) : -1;
                    return header.findIndex((cell) => column.matches(cell));
                };
                const columnIndexes = new Map(columns.map((column) => [column, indexOf(column)]));
                const missing = columns.filter((column) => column.isMappingRequired() && columnIndexes.get(column) === -1);
                if (missing.length) {
                    Notification.make().danger().title(t('filament-actions::import.notifications.completed.title'))
                        .body(missing.map((column) => t('filament-actions::import.failure_csv.column_mapping_required_for_new_record', { attribute: column.getLabel() })).join(' ')).send();
                    return;
                }
                const adapter = livewire.getDataAdapterForTable();
                const history: ImportExportHistory | null = panel?.getImportExportHistory?.() ?? null;
                const fileName = String((Object.values(data.file ?? {})[0] as any)?.file?.name ?? (Object.values(data.file ?? {})[0] as any)?.name ?? 'import');
                const run = async () => {
                    const importId = history ? await history.startImport({ userId: user.id, importer: importer!.name, fileName, totalRows: rows.length }) : null;
                    let imported = 0;
                    const failures: string[] = [];
                    for (const cells of rows) {
                        const raw: Record<string, string | null> = {};
                        for (const [column, index] of columnIndexes) raw[column.name] = index === -1 ? null : (cells[index] ?? null);
                        const fail = async (message: string) => { failures.push(csvLine([...cells, message])); if (history && importId !== null) await history.recordFailedImportRow(importId, raw, message); };
                        let result: RowResult;
                        try { result = await importRow(importer!, columns, (column) => columnIndexes.get(column) !== -1, raw, adapter, livewire); } catch (failure) {
                            console.error(failure);
                            await fail(t('filament-actions::import.failure_csv.system_error'));
                            continue;
                        }
                        // The first column error; a deliberate failure keeps its own message.
                        const error = columns.map((column) => result.errors[column.name]?.message ?? null).find((message) => message !== null) ?? result.failure;
                        if (error) { await fail(error); continue; }
                        imported++;
                    }
                    if (history && importId !== null) await history.finishImport(importId, { processedRows: rows.length, successfulRows: imported });
                    const notification = Notification.make().title(t('filament-actions::import.notifications.completed.title')).body(importer!.getCompletedNotificationBody(imported, failures.length)).persistent();
                    if (failures.length) {
                        const csv = `﻿${[csvLine([...header, t('filament-actions::import.failure_csv.error_header')]), ...failures].join('\r\n')}\r\n`;
                        const token = panel.getDownloads().put(user.id, 'import-failed-rows.csv', 'text/csv; charset=utf-8', csv);
                        notification.actions([{ label: tc('filament-actions::import.notifications.completed.actions.download_failed_rows_csv.label', failures.length), url: panel.getDownloadUrl(token) }]);
                    }
                    await deliver(imported ? (failures.length ? notification.warning() : notification.success()) : notification.danger(), background, panel, user);
                };
                if (!background) { await run(); return; }
                Notification.make().success().title(t('filament-actions::import.notifications.started.title')).body(tc('filament-actions::import.notifications.started.body', rows.length, { count: rows.length.toLocaleString('en-US') })).send();
                runInBackground(run);
            }) as ImportActionInstance;
        action.importer = (value) => { importer = value; return action; };
        action.maxRows = (count) => { maxRows = Math.max(1, Math.floor(count)); return action; };
        action.maxFileSize = (kilobytes) => { maxKilobytes = Math.max(1, Math.floor(kilobytes)); return action; };
        action.columnMapping = (condition) => { mapping = condition; return action; };
        action.queued = (condition = true) => { queued = condition; return action; };
        return action;
    }
}
