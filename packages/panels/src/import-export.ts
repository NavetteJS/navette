// Import and export actions: CSV files read and written during the request (no queue), and a per-user download store.
import { randomBytes } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { Action } from '@navette-js/actions';
import { CheckboxList, FileUpload } from '@navette-js/forms';
import { configured } from '@navette-js/support';
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
}
export type ExportActionInstance = Action & {
    exporter(exporter: typeof Exporter): ExportActionInstance;
    /** Refuses exports of more rows (10,000 by default, 100,000 at most). */
    maxRows(count: number): ExportActionInstance;
    /** `false`: no column selection, every column is exported (the modal only confirms). */
    columnMapping(condition: boolean): ExportActionInstance;
};

const DEFAULT_MAX_EXPORT_ROWS = 10000, HARD_MAX_EXPORT_ROWS = 100000, CHUNK = 1000;
const fileNameOf = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120) || 'export';

function makeExportAction(name: string, bulk: boolean): ExportActionInstance {
    let exporter: typeof Exporter | null = null, maxRows = DEFAULT_MAX_EXPORT_ROWS, mapping = true;
    const columnsOf = () => { if (!exporter) throw new Error('ExportAction: call exporter() with an Exporter class.'); return exporter.getColumns(); };
    const action = Action.make(name).color('gray').icon('m-arrow-down-tray')
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
            const lines = [csvLine(columns.map((column) => column.getLabel()))];
            for (let page = 1; page <= first.lastPage; page++) {
                const { records } = page === 1 ? first : await adapter.paginate({ ...query, page, perPage: CHUNK });
                for (const record of records) lines.push(csvLine(columns.map((column) => column.getValue(record))));
            }
            const count = lines.length - 1;
            const user = livewire._ctx?.user;
            const panel = livewire._ctx?.panel;
            const token = panel.getDownloads().put(user.id, `${fileNameOf(exporter!.getFileName(count))}.csv`, 'text/csv; charset=utf-8', `﻿${lines.join('\r\n')}\r\n`);
            Notification.make().success().persistent().title(t('filament-actions::export.notifications.completed.title')).body(exporter!.getCompletedNotificationBody(count))
                .actions([{ label: t('filament-actions::export.notifications.completed.actions.download_csv.label'), url: panel.getDownloadUrl(token) }]).send();
            if (bulk) livewire.deselectAllTableRecords();
        }) as ExportActionInstance;
    action.exporter = (value) => { exporter = value; return action; };
    action.maxRows = (count) => { maxRows = Math.max(1, Math.floor(count)); return action; };
    action.columnMapping = (condition) => { mapping = condition; if (!condition) action.requiresConfirmation(); return action; };
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
    validate(value: string | null, row: Record<string, unknown>): string | null {
        const label = this.getLabel().toLowerCase();
        const blank = value === null || value.trim() === '';
        for (const rule of this._rules) {
            if (typeof rule === 'function') { const message = rule(value, row); if (message) return message; continue; }
            const [name, parameter = ''] = rule.split(':');
            if (name === 'required' && blank) return `The ${label} field is required.`;
            if (blank) continue;
            const text = value!.trim();
            if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `The ${label} field must be a valid email address.`;
            if (name === 'numeric' && !Number.isFinite(Number(text))) return `The ${label} field must be a number.`;
            if (name === 'integer' && !/^-?\d+$/.test(text)) return `The ${label} field must be an integer.`;
            if (name === 'boolean' && !['0', '1', 'true', 'false', 'yes', 'no'].includes(text.toLowerCase())) return `The ${label} field must be true or false.`;
            if (name === 'max' && text.length > Number(parameter)) return `The ${label} field must not be greater than ${parameter} characters.`;
            if (name === 'min' && text.length < Number(parameter)) return `The ${label} field must be at least ${parameter} characters.`;
            if (name === 'in' && !parameter.split(',').includes(text)) return `The selected ${label} is invalid.`;
        }
        return null;
    }
    cast(value: string | null): unknown { return this._cast ? this._cast(value) : value === '' ? null : value; }
    fill(record: Record<string, unknown>, value: unknown): void { if (this._fill) this._fill(record, value); else record[this.name] = value; }
}
/** Describes an import: its columns, how a row finds or creates its record, and hooks. */
export abstract class Importer {
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
    /** Refuses files with more rows (1,000 by default, 10,000 at most). */
    maxRows(count: number): ImportActionInstance;
    /** Largest accepted file, in kilobytes (5,120 by default). */
    maxFileSize(kilobytes: number): ImportActionInstance;
};
const DEFAULT_MAX_IMPORT_ROWS = 1000, HARD_MAX_IMPORT_ROWS = 10000;

/** Imports the rows of a CSV file: each row is validated, then creates or updates a record through the data adapter. */
export class ImportAction {
    static make(name = 'import'): ImportActionInstance {
        let importer: typeof Importer | null = null, maxRows = DEFAULT_MAX_IMPORT_ROWS, maxKilobytes = 5120;
        const columnsOf = () => { if (!importer) throw new Error('ImportAction: call importer() with an Importer class.'); return importer.getColumns(); };
        const example = Action.make('downloadExample').label(t('filament-actions::import.modal.actions.download_example.label')).color('gray').link()
            .action(({ livewire }) => {
                const columns = columnsOf();
                const csv = `${csvLine(columns.map((column) => column.name))}\r\n${csvLine(columns.map((column) => column.getExample()))}\r\n`;
                const panel = livewire._ctx?.panel;
                livewire.redirect(panel.getDownloadUrl(panel.getDownloads().put(livewire._ctx.user.id, 'import-example.csv', 'text/csv; charset=utf-8', csv)));
            });
        const action = Action.make(name).color('gray').icon('m-arrow-up-tray')
            // Importing creates or updates records: the resource's `create` ability applies.
            .authorize(async ({ livewire }) => (typeof livewire?.resource?.can === 'function' ? livewire.resource.can('create', livewire._ctx?.user ?? null) : true))
            .label(({ livewire }) => t('filament-actions::import.label', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
            .modalHeading(({ livewire }) => t('filament-actions::import.modal.heading', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
            .modalSubmitActionLabel(t('filament-actions::import.modal.actions.import.label'))
            .modalWidth('md')
            .schema(() => [FileUpload.make('file').label(t('filament-actions::import.modal.form.file.label')).acceptedFileTypes(['text/csv', 'text/plain', 'application/vnd.ms-excel', '.csv']).maxSize(maxKilobytes).storeFiles(false).required()])
            .extraModalFooterActions([example])
            .action(async ({ livewire, data }) => {
                const entry: any = Array.isArray(data.file) ? data.file[0] : data.file;
                const path = entry?.file?.path;
                // Only a temporary upload of this request is read, never a path sent by the browser.
                if (typeof path !== 'string' || statSync(path).size > maxKilobytes * 1024) return;
                const limit = Math.min(maxRows, HARD_MAX_IMPORT_ROWS);
                const rows = parseCsv(readFileSync(path, 'utf8'), limit + 1);
                const header = rows.shift() ?? [];
                if (rows.length > limit) { Notification.make().danger().title(t('filament-actions::import.notifications.max_rows.title')).body(tc('filament-actions::import.notifications.max_rows.body', limit, { count: limit.toLocaleString('en-US') })).send(); return; }
                const columns = columnsOf();
                const mapping = new Map(columns.map((column) => [column, header.findIndex((cell) => column.matches(cell))]));
                const missing = columns.filter((column) => column.isMappingRequired() && mapping.get(column) === -1);
                if (missing.length) {
                    Notification.make().danger().title(t('filament-actions::import.notifications.completed.title'))
                        .body(missing.map((column) => t('filament-actions::import.failure_csv.column_mapping_required_for_new_record', { attribute: column.getLabel() })).join(' ')).send();
                    return;
                }
                const adapter = livewire.getDataAdapterForTable();
                let imported = 0;
                const failures: string[] = [];
                for (const cells of rows) {
                    const raw: Record<string, string | null> = {};
                    for (const [column, index] of mapping) raw[column.name] = index === -1 ? null : (cells[index] ?? null);
                    const error = columns.map((column) => (mapping.get(column) === -1 ? null : column.validate(raw[column.name], raw))).find((message) => message !== null);
                    if (error) { failures.push(csvLine([...cells, error])); continue; }
                    try {
                        const record = await importer!.resolveRecord(raw, { livewire });
                        const values: Record<string, unknown> = {};
                        for (const column of columns) if (mapping.get(column) !== -1) column.fill(values, column.cast(raw[column.name]));
                        await importer!.beforeSave(values, record);
                        const saved = record ? await adapter.update(adapter.getKey(record), values) : await adapter.create(values);
                        await importer!.afterSave(saved);
                        imported++;
                    } catch (failure) {
                        console.error(failure);
                        failures.push(csvLine([...cells, t('filament-actions::import.failure_csv.system_error')]));
                    }
                }
                const notification = Notification.make().title(t('filament-actions::import.notifications.completed.title')).body(importer!.getCompletedNotificationBody(imported, failures.length)).persistent();
                if (failures.length) {
                    const panel = livewire._ctx?.panel;
                    const csv = `﻿${[csvLine([...header, t('filament-actions::import.failure_csv.error_header')]), ...failures].join('\r\n')}\r\n`;
                    const token = panel.getDownloads().put(livewire._ctx.user.id, 'import-failed-rows.csv', 'text/csv; charset=utf-8', csv);
                    notification.actions([{ label: tc('filament-actions::import.notifications.completed.actions.download_failed_rows_csv.label', failures.length), url: panel.getDownloadUrl(token) }]);
                }
                (imported ? (failures.length ? notification.warning() : notification.success()) : notification.danger()).send();
            }) as ImportActionInstance;
        action.importer = (value) => { importer = value; return action; };
        action.maxRows = (count) => { maxRows = Math.max(1, Math.floor(count)); return action; };
        action.maxFileSize = (kilobytes) => { maxKilobytes = Math.max(1, Math.floor(kilobytes)); return action; };
        return action;
    }
}
