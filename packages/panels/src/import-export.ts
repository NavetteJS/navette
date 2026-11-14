// Import and export actions: CSV and XLSX files, read and written during the request or in the background (queued()),
// an optional history of runs, and durable per-user downloads (`downloads.ts`). The import side is in `imports.ts`.
import { XlsxWriter, type XlsxOptions, type XlsxRowInput, type XlsxStyle } from './xlsx.ts';
import { exportFormatKey, normalizeExportFormats, type ExportFormatInterface } from './export-formats.ts';
import { AssertionError } from 'node:assert';
import { Action } from '@navette-js/actions';
import { CheckboxList } from '@navette-js/forms';
import { configured, icons, readRecordPath, RelationshipAggregates, type AggregatedRelationship, type AggregatedRelationships, type RelationshipAggregate } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { addRelationshipsToQuery, ensureRelationshipSupport, getTableQuery, getVisibleColumns } from '@navette-js/tables';
import { registerDownloader, sendDownload, type Downloader } from './downloads.ts';
import { Notification } from './notifications.ts';

export { DownloadStore } from './downloads.ts';

// ------------------------------------------------------------------ CSV
/** Starts like a formula (`=`, `+`, `-`, `@`, a tab or a carriage return), numbers aside (`-5`, `+42`). */
export const startsLikeFormula = (text: string) => /^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text);
/**
 * A CSV cell. Unless `protect` is `false`, text that starts like a formula is prefixed with `'`, so that spreadsheet
 * software does not run it (CSV injection).
 */
export function csvCell(value: unknown, protect = true, delimiter = ','): string {
    let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
    if (protect && startsLikeFormula(text)) text = `'${text}`;
    return text.includes('"') || text.includes(delimiter) || /[\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
/** A CSV line; `protect` (one flag, or one per cell) as in `csvCell()`. */
export const csvLine = (cells: unknown[], delimiter = ',', protect: boolean | boolean[] = true): string => cells.map((cell, index) => csvCell(cell, Array.isArray(protect) ? protect[index] !== false : protect, delimiter)).join(delimiter);
/** Parses CSV text (quoted cells, doubled quotes, line breaks inside quotes), up to `maxRows` rows (blank rows are skipped). */
export function parseCsv(text: string, maxRows = Infinity, delimiter = ','): string[][] {
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
        else if (char === delimiter) { row.push(cell); cell = ''; }
        else if (char === '\n' || char === '\r') {
            if (char === '\r' && source[index + 1] === '\n') index++;
            row.push(cell); cell = '';
            if (row.some((value) => value !== '')) rows.push(row);
            row = [];
            if (rows.length >= maxRows) return rows;
        } else cell += char;
    }
    row.push(cell);
    if (row.some((value) => value !== '') && rows.length < maxRows) rows.push(row);
    return rows;
}

// ------------------------------------------------------------------ export
/** Built-in formats of an export. */
export const ExportFormat = { Csv: 'csv', Xlsx: 'xlsx' } as const;
export type ExportFormatValue = 'csv' | 'xlsx';
/** A format of an export: `'csv'`, `'xlsx'`, or a custom format (`ExportFormatInterface`). */
export type ExportFormatType = ExportFormatValue | ExportFormatInterface;
/** One export, as the exporter's methods, the notification and the fake see it. */
export type ExportRun = {
    /** Key of the run in the export history, if the panel keeps one. */
    id: string | number | null;
    userId: string | number | null;
    /** Type of the user (the panel's id), stored by a history with a polymorphic user (`knexImportExportHistory(db, { polymorphicUser: true })`). */
    userType?: string | null;
    exporter: string;
    fileName: string;
    totalRows: number;
    successfulRows: number;
    /** Column name → header label, in the order of the file. */
    columnMap: Record<string, string>;
    options: Record<string, unknown>;
    formats: ExportFormatType[];
};
/** What the functions of an export column receive. `record` is `null` where no record applies (`hidden()`, `limit()` before a row). */
export type ExportColumnContext = { record: any; options: Record<string, unknown>; column: ExportColumn; export: ExportRun | null };
type ExportLazy<T> = T | ((ctx: ExportColumnContext) => T);
const evaluateExport = <T>(value: ExportLazy<T>, ctx: ExportColumnContext): T => (typeof value === 'function' ? (value as (ctx: ExportColumnContext) => T)(ctx) : value);
/** Laravel's `Str::limit()`: at most `limit` characters, then `end`. */
const limitText = (text: string, limit: number, end: string) => { const chars = [...text]; return chars.length <= limit ? text : `${chars.slice(0, limit).join('').trimEnd()}${end}`; };
/** Laravel's `Str::words()`: at most `words` words, then `end`. */
const limitWords = (text: string, words: number, end: string) => { const match = new RegExp(`^\\s*(?:\\S+\\s*){1,${Math.max(1, Math.floor(words))}}`, 'u').exec(text); return !match || match[0].length === text.length ? text : `${match[0].trimEnd()}${end}`; };

/** Column of an export: its header and the value written for each record. */
export class ExportColumn {
    readonly name: string;
    private _label: string | null = null;
    private _state: ((record: any, ctx: ExportColumnContext) => unknown) | null = null;
    private _format: ((state: any, record: any, ctx: ExportColumnContext) => unknown) | null = null;
    private _enabledByDefault = true;
    private _hidden: ExportLazy<boolean> = false;
    private _visible: ExportLazy<boolean> = true;
    private _limit: { length: ExportLazy<number | null>; end: ExportLazy<string | null> } | null = null;
    private _words: { words: ExportLazy<number | null>; end: ExportLazy<string | null> } | null = null;
    private _prefix: ExportLazy<string | null> = null;
    private _suffix: ExportLazy<string | null> = null;
    private _listAsJson = false;
    private _preventFormulaInjection: ExportLazy<boolean | null> = null;
    constructor(name: string) { this.name = name; }
    static make(name: string): ExportColumn { return configured(new ExportColumn(name)); }
    label(label: string | null): this { this._label = label; return this; }
    getLabel(): string { return this._label ?? this.name.replace(/[_.]+/g, ' ').replace(/^./, (c) => c.toUpperCase()); }
    /** Value from the record, instead of the attribute with the column's name (dots read relationships: `author.name`). */
    state(resolver: ((record: any, ctx: ExportColumnContext) => unknown) | null): this { this._state = resolver; return this; }
    /** Formats the value (each value, for a list): `(state, record, ctx) => …`. */
    formatStateUsing(format: ((state: any, record: any, ctx: ExportColumnContext) => unknown) | null): this { this._format = format; return this; }
    /** `false`: unchecked in the export modal. */
    enabledByDefault(condition = true): this { this._enabledByDefault = condition; return this; }
    isEnabledByDefault(): boolean { return this._enabledByDefault; }
    private _aggregates: RelationshipAggregates | null = null;
    private aggregatesOf(): RelationshipAggregates { return (this._aggregates ??= new RelationshipAggregates(`ExportColumn ${this.name}`)); }
    /** Number of related records (`withCount()`): `ExportColumn.make('posts_count').counts('posts')`; also `'posts as alias'` or `{ posts: (query) => … }`. */
    counts(relationships: AggregatedRelationships | null): this { this.aggregatesOf().set('count', relationships); return this; }
    /** Whether related records exist (`withExists()`): `ExportColumn.make('posts_exists').exists('posts')`. */
    exists(relationships: AggregatedRelationships | null): this { this.aggregatesOf().set('exists', relationships); return this; }
    /** Average of a column of the related records: `ExportColumn.make('posts_avg_rating').avg('posts', 'rating')`. */
    avg(relationship: AggregatedRelationship | null, column: string | null): this { this.aggregatesOf().set('avg', relationship, column); return this; }
    /** Sum of a column of the related records: `ExportColumn.make('orders_sum_total').sum('orders', 'total')`. */
    sum(relationship: AggregatedRelationship | null, column: string | null): this { this.aggregatesOf().set('sum', relationship, column); return this; }
    /** Minimum of a column of the related records: `ExportColumn.make('orders_min_total').min('orders', 'total')`. */
    min(relationship: AggregatedRelationship | null, column: string | null): this { this.aggregatesOf().set('min', relationship, column); return this; }
    /** Maximum of a column of the related records: `ExportColumn.make('orders_max_total').max('orders', 'total')`. */
    max(relationship: AggregatedRelationship | null, column: string | null): this { this.aggregatesOf().set('max', relationship, column); return this; }
    /** Relationship aggregates selected by the export query for this column. */
    getRelationshipAggregates(): RelationshipAggregate[] { return this._aggregates?.all() ?? []; }
    /** A hidden column is not offered in the modal and never written (the condition cannot depend on a record). */
    hidden(condition: ExportLazy<boolean> = true): this { this._hidden = condition; return this; }
    visible(condition: ExportLazy<boolean> = true): this { this._visible = condition; return this; }
    isHidden(ctx: Partial<ExportColumnContext> = {}): boolean { const full = { record: null, options: {}, export: null, ...ctx, column: this }; return Boolean(evaluateExport(this._hidden, full)) || !evaluateExport(this._visible, full); }
    isVisible(ctx: Partial<ExportColumnContext> = {}): boolean { return !this.isHidden(ctx); }
    /** At most `length` characters (100 by default), then `end`. */
    limit(length: ExportLazy<number | null> = 100, end: ExportLazy<string | null> = '...'): this { this._limit = { length, end }; return this; }
    /** At most `words` words (100 by default), then `end`. */
    words(words: ExportLazy<number | null> = 100, end: ExportLazy<string | null> = '...'): this { this._words = { words, end }; return this; }
    prefix(prefix: ExportLazy<string | null>): this { this._prefix = prefix; return this; }
    suffix(suffix: ExportLazy<string | null>): this { this._suffix = suffix; return this; }
    /** Several values are written as a JSON array, instead of separated by commas. */
    listAsJson(condition = true): this { this._listAsJson = condition; return this; }
    isListedAsJson(): boolean { return this._listAsJson; }
    /**
     * `true`: a value starting like a formula is prefixed with `'` in every format (and in `Exporter.test()`). `false`: the CSV
     * cell is written as is. By default, CSV cells are protected and XLSX cells are always text, so neither runs formulas.
     */
    preventFormulaInjection(condition: ExportLazy<boolean | null> = true): this { this._preventFormulaInjection = condition; return this; }
    getFormulaInjectionPrevention(ctx: Partial<ExportColumnContext> = {}): boolean | null { return evaluateExport(this._preventFormulaInjection, { record: null, options: {}, export: null, ...ctx, column: this }); }
    getCharacterLimit(ctx: Partial<ExportColumnContext> = {}): number | null { return this._limit ? evaluateExport(this._limit.length, { record: null, options: {}, export: null, ...ctx, column: this }) : null; }
    getWordLimit(ctx: Partial<ExportColumnContext> = {}): number | null { return this._words ? evaluateExport(this._words.words, { record: null, options: {}, export: null, ...ctx, column: this }) : null; }
    /** The raw value of a record. */
    getState(record: any, ctx: Partial<ExportColumnContext> = {}): unknown {
        const full: ExportColumnContext = { options: {}, export: null, ...ctx, record, column: this };
        // `author.name` reads the eager-loaded relationship; a has-many relationship (`tags.name`) gives the list of values.
        return this._state ? this._state(record, full) : readRecordPath(record, this.name);
    }
    /** The value written to the file: formatted, limited, with its prefix and suffix; a list joined with `, ` (or as JSON). */
    getFormattedState(record: any, ctx: Partial<ExportColumnContext> = {}): unknown {
        const full: ExportColumnContext = { options: {}, export: null, ...ctx, record, column: this };
        const formatOne = (input: unknown): unknown => {
            let state = this._format ? this._format(input, record, full) : input;
            // An enum case is written as its value.
            if (state && typeof state === 'object' && !(state instanceof Date) && 'value' in state && Object.keys(state).length <= 2) state = (state as { value: unknown }).value;
            if (state === null || state === undefined) return state;
            const characters = this._limit ? evaluateExport(this._limit.length, full) : null;
            if (characters) state = limitText(String(state), characters, evaluateExport(this._limit!.end, full) ?? '');
            const words = this._words ? evaluateExport(this._words.words, full) : null;
            if (words) state = limitWords(String(state), words, evaluateExport(this._words!.end, full) ?? '');
            const prefix = evaluateExport(this._prefix, full), suffix = evaluateExport(this._suffix, full);
            if (prefix) state = `${prefix}${state}`;
            if (suffix) state = `${state}${suffix}`;
            return state;
        };
        const state = this.getState(record, full);
        let value = Array.isArray(state) ? (() => { const items = state.map(formatOne); return this._listAsJson ? JSON.stringify(items) : items.map((item) => (item === null || item === undefined ? '' : String(item))).join(', '); })() : formatOne(state);
        if (evaluateExport(this._preventFormulaInjection, full) === true && typeof value === 'string' && startsLikeFormula(value)) value = `'${value}`;
        return value;
    }
    /** Alias of `getFormattedState()`. */
    getValue(record: any): unknown { return this.getFormattedState(record); }
}
/** Describes an export: its columns, and optionally the options form, the query, the files and the notification. */
export abstract class Exporter {
    static getColumns(): ExportColumn[] { return []; }
    /** The columns that are not hidden (offered in the modal). */
    static getVisibleColumns(ctx: Partial<ExportColumnContext> = {}): ExportColumn[] { return this.getColumns().filter((column) => column.isVisible(ctx)); }
    /** Components added to the export modal; their values are the export's `options`. */
    static getOptionsFormComponents(): any[] { return []; }
    /** Changes the query of the exported records (e.g. eager loading). */
    static modifyQuery(_query: any, _options: Record<string, unknown> = {}): void {}
    static getCompletedNotificationTitle(_run: ExportRun): string { return t('navette-actions::export.notifications.completed.title'); }
    /** Body of the "Export completed" notification. */
    static getCompletedNotificationBody(count: number, _run?: ExportRun): string { return `Your export has completed and ${count.toLocaleString('en-US')} ${count === 1 ? 'row' : 'rows'} exported.`; }
    /** Changes the completion notification (icon, actions…), or returns another one. */
    static modifyCompletedNotification(notification: Notification, _run: ExportRun): Notification { return notification; }
    /** File name, without extension. */
    static getFileName(_count: number, _run?: ExportRun): string { return `export-${new Date().toISOString().slice(0, 10)}`; }
    /** Delimiter of the CSV file (one character). */
    static getCsvDelimiter(): string { return ','; }
    /** Formats offered by default (an action's `formats()` replaces them): `'csv'`, `'xlsx'` and custom formats (`ExportFormatInterface`). */
    static getFormats(): ExportFormatType[] { return ['csv', 'xlsx']; }
    /** How a file of this format is sent (see `Downloader`): a custom format's own `getDownloader()` by default. */
    static getDownloader(format: ExportFormatType): Downloader { return typeof format === 'object' ? format.getDownloader?.() ?? sendDownload : sendDownload; }
    /**
     * Name of the download disk where the files are kept: one of the panel's
     * `downloadDisks({ ... })`; `null` (the default) uses the panel's `downloads()` store. An action's `fileDisk()` wins.
     */
    static getFileDiskName(): string | null { return null; }
    /** Queue name handed to the background runner (`useBackgroundRunner()`) with each queued export of this exporter. */
    static getJobQueue(): string | null { return null; }
    /** Connection name handed to the background runner with each queued export of this exporter. */
    static getJobConnection(): string | null { return null; }
    /**
     * Changes the XLSX writer right after it is opened, before the header row: rows added here go above the header
     * (`writer.addRow(['Sales report'])`).
     */
    static configureXlsxWriterAfterOpen(writer: XlsxWriter, _run: ExportRun): XlsxWriter { return writer; }
    /**
     * Changes the XLSX writer before it is closed, after the data rows: rows added here go below the data, and
     * `writer.getCurrentSheet()` names the sheet and freezes panes (`setSheetView(new XlsxSheetView().setFreezeRow(2))`).
     */
    static configureXlsxWriterBeforeClose(writer: XlsxWriter, _run: ExportRun): XlsxWriter { return writer; }
    /** Style of the XLSX cells (see `XlsxStyle`). */
    static getXlsxCellStyle(): XlsxStyle | null { return null; }
    /** Style of the XLSX header cells (the cell style by default; bold without any). */
    static getXlsxHeaderCellStyle(): XlsxStyle | null { return null; }
    /** Options of the XLSX writer: column widths (see `XlsxOptions`). */
    static getXlsxWriterOptions(): XlsxOptions | null { return null; }
    /**
     * One XLSX row: its values (or `XlsxCell`s with their own style) and its style. `columns` are the exported column names, in
     * order, to style some cells: `values.map((value, i) => columns[i] === 'price' ? XlsxCell.fromValue(value, priceStyle) : value)`.
     */
    static makeXlsxRow(values: unknown[], style: XlsxStyle | null, _columns: string[]): XlsxRowInput { return { cells: values, style }; }
    /** The XLSX header row (like `makeXlsxRow()`). */
    static makeXlsxHeaderRow(values: unknown[], style: XlsxStyle | null, columns: string[]): XlsxRowInput { return this.makeXlsxRow(values, style, columns); }
    /**
     * Row values of this exporter, without a table or a file (tests): `ProductExporter.test().export(record)`. Without a
     * `columnMap`, the visible columns enabled by default; with one (`{ name: 'Name' }`), exactly those columns, in its order.
     */
    static test(columnMap: Record<string, string> | null = null, options: { options?: Record<string, unknown>; export?: Partial<ExportRun> | null } = {}): TestableExport { return new TestableExport(this, columnMap, options); }
}
/** Exports single records with an exporter's columns (see `Exporter.test()`). */
export class TestableExport {
    readonly columns: ExportColumn[];
    /** Header row of the file: the labels of the selected columns. */
    readonly labels: string[];
    private readonly options: Record<string, unknown>;
    private readonly run: ExportRun;
    constructor(exporter: typeof Exporter, columnMap: Record<string, string> | null = null, options: { options?: Record<string, unknown>; export?: Partial<ExportRun> | null } = {}) {
        this.options = options.options ?? {};
        const all = exporter.getColumns();
        this.columns = columnMap === null ? all.filter((column) => column.isVisible({ options: this.options }) && column.isEnabledByDefault()) : Object.keys(columnMap).map((name) => {
            const column = all.find((candidate) => candidate.name === name);
            if (!column) throw new Error(`${exporter.name}: no export column named "${name}".`);
            return column;
        });
        this.labels = this.columns.map((column) => columnMap?.[column.name] ?? column.getLabel());
        this.run = { id: null, userId: null, exporter: exporter.name, fileName: 'export', totalRows: 0, successfulRows: 0, columnMap: Object.fromEntries(this.columns.map((column, index) => [column.name, this.labels[index]])), options: this.options, formats: exporter.getFormats(), ...options.export };
    }
    /** Values of one record, in column order, as written to the file before CSV escaping. */
    export(record: unknown): unknown[] { return this.columns.map((column) => column.getFormattedState(record, { options: this.options, export: this.run })); }
}

/** The query of an export, as the fake gives it: the table's query with its filters, search and sort, and the query modifiers. */
export class ExportQuery {
    private readonly adapter: any;
    readonly query: Record<string, any>;
    constructor(adapter: any, query: Record<string, any>) { this.adapter = adapter; this.query = query; }
    /** Every record of the query (in pages of 1,000). */
    async getRecords(): Promise<any[]> {
        const records: any[] = [];
        for (let page = 1; ; page++) {
            const result = await this.adapter.paginate({ ...this.query, page, perPage: 1000 });
            records.push(...result.records);
            if (page >= result.lastPage) return records;
        }
    }
    /** Keys of the records of the query. */
    async getKeys(): Promise<string[]> { return (await this.getRecords()).map((record) => this.adapter.getKey(record)); }
    async count(): Promise<number> { return (await this.adapter.paginate({ ...this.query, page: 1, perPage: 1 })).total; }
}
/** An export requested by the action (`ExportAction.fake()`). `records`: the selected keys of a bulk export, `null` otherwise. */
export type DispatchedExport = { export: ExportRun; query: ExportQuery; columnMap: Record<string, string>; options: Record<string, unknown>; formats: ExportFormatType[]; records: string[] | null };
type ExportInspector = (run: ExportRun, query: ExportQuery, columnMap: Record<string, string>, options: Record<string, unknown>, formats: ExportFormatType[], records: string[] | null) => boolean | Promise<boolean>;
const assertionFailure = (message: string): never => { throw new AssertionError({ message }); };
let exportFake: ExportFake | null = null;
/**
 * Records the exports requested by export actions instead of building their files (`ExportAction.fake()`). The action still
 * checks its form, counts the records (enforcing `maxRows()`) and records the run in the history. Assertions are asynchronous
 * (the callback may run the query): `await exports.assertDispatched(ProductExporter, async (run, query) => …)`.
 */
export class ExportFake {
    readonly exports: DispatchedExport[] = [];
    record(dispatched: DispatchedExport): void { this.exports.push(dispatched); }
    private of(exporter: typeof Exporter | string): DispatchedExport[] { const name = typeof exporter === 'string' ? exporter : exporter.name; return this.exports.filter((entry) => entry.export.exporter === name); }
    private async matching(exporter: typeof Exporter | string, callback: ExportInspector | null): Promise<boolean> {
        for (const entry of this.of(exporter)) if (!callback || (await callback(entry.export, entry.query, entry.columnMap, entry.options, entry.formats, entry.records))) return true;
        return false;
    }
    /** At least one export of this exporter was requested (matching the callback, if given). */
    async assertDispatched(exporter: typeof Exporter | string, callback: ExportInspector | null = null): Promise<this> {
        if (!(await this.matching(exporter, callback))) assertionFailure(`The expected [${typeof exporter === 'string' ? exporter : exporter.name}] export was not dispatched${callback ? ' with matching data.' : '.'}`);
        return this;
    }
    assertDispatchedTimes(exporter: typeof Exporter | string, count = 1): this {
        const actual = this.of(exporter).length;
        if (actual !== count) assertionFailure(`The expected [${typeof exporter === 'string' ? exporter : exporter.name}] export was dispatched ${actual} times instead of ${count} times.`);
        return this;
    }
    async assertNotDispatched(exporter: typeof Exporter | string, callback: ExportInspector | null = null): Promise<this> {
        if (await this.matching(exporter, callback)) assertionFailure(`The unexpected [${typeof exporter === 'string' ? exporter : exporter.name}] export was dispatched${callback ? ' with matching data.' : '.'}`);
        return this;
    }
    assertNothingDispatched(): this { if (this.exports.length) assertionFailure('Unexpected exports were dispatched.'); return this; }
    /** Stops faking: export actions build their files again. */
    restore(): void { if (exportFake === this) exportFake = null; }
}

type ExportActionLazy<T> = T | ((ctx: { livewire: any; action: ExportActionInstance }) => T);
export type ExportActionInstance = Action & {
    exporter(exporter: typeof Exporter): ExportActionInstance;
    getExporter(): typeof Exporter;
    /** Refuses exports of more rows (10,000 by default, 100,000 at most). */
    maxRows(count: number): ExportActionInstance;
    /** `false`: no column selection, every column is exported (the modal only confirms). */
    columnMapping(condition: boolean): ExportActionInstance;
    /** Grid columns of the column selection (2 by default). */
    columnMappingColumns(columns: number): ExportActionInstance;
    /** Only the columns visible in the table (and enabled by default) are checked when the modal opens. */
    enableVisibleTableColumnsByDefault(condition?: boolean): ExportActionInstance;
    /** Files offered for download: `['csv', 'xlsx']` and custom formats (`ExportFormatInterface`); the exporter's `getFormats()` by default. */
    formats(formats: ExportFormatType[]): ExportActionInstance;
    /** Download disk of the files (a name given to the panel's `downloadDisks()`), instead of the exporter's `getFileDiskName()`. */
    fileDisk(disk: string | null): ExportActionInstance;
    getFileDisk(): string | null;
    /** Builds the files after the response, in the background; the download links arrive in the bell. */
    queued(condition?: boolean): ExportActionInstance;
    /** Changes the query of the exported records: `(query, { options, livewire }) => …`, after the exporter's `modifyQuery()`. */
    modifyQueryUsing(callback: ((query: any, ctx: { options: Record<string, unknown>; livewire: any }) => unknown) | null): ExportActionInstance;
    /** File name, without extension (the exporter's `getFileName()` by default). */
    fileName(name: string | ((run: ExportRun) => string) | null): ExportActionInstance;
    /** Static options merged with the values of the exporter's options form. */
    options(options: ExportActionLazy<Record<string, unknown>>): ExportActionInstance;
    /** Records read at a time (100 by default). */
    chunkSize(size: ExportActionLazy<number>): ExportActionInstance;
};

const DEFAULT_MAX_EXPORT_ROWS = 10000, HARD_MAX_EXPORT_ROWS = 100000;
const fileNameOf = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120) || 'export';

function makeExportAction(name: string, bulk: boolean): ExportActionInstance {
    let exporter: typeof Exporter | null = null, maxRows = DEFAULT_MAX_EXPORT_ROWS, mapping = true, formats: ExportFormatType[] | null = null, queued = false, fileDisk: string | null = null;
    let mappingColumns = 2, visibleTableColumnsByDefault = false, chunkSize: ExportActionLazy<number> = 100;
    let modifyQueryUsing: ((query: any, ctx: { options: Record<string, unknown>; livewire: any }) => unknown) | null = null;
    let fileName: string | ((run: ExportRun) => string) | null = null;
    let staticOptions: ExportActionLazy<Record<string, unknown>> = {};
    const exporterOf = () => { if (!exporter) throw new Error('ExportAction: call exporter() with an Exporter class.'); return exporter; };
    const columnsOf = () => exporterOf().getVisibleColumns();
    const lazy = <T>(value: ExportActionLazy<T>, livewire: any): T => (typeof value === 'function' ? (value as (ctx: { livewire: any; action: ExportActionInstance }) => T)({ livewire, action }) : value);
    const action = Action.make(name).color('gray').icon(icons.resolve('actions::export-action.grouped') ?? 'm-arrow-down-tray')
        // Exporting reads the records: the resource's `viewAny` ability (or the host's own checks) applies.
        .authorize(async ({ livewire }) => (typeof livewire?.resource?.can === 'function' ? livewire.resource.can('viewAny', livewire._ctx?.user ?? null) : true))
        .label(({ livewire }) => t('navette-actions::export.label', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
        .modalHeading(({ livewire }) => t('navette-actions::export.modal.heading', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
        .modalSubmitActionLabel(t('navette-actions::export.modal.actions.export.label'))
        .modalWidth('md')
        .schema(() => [
            ...(mapping ? [CheckboxList.make('columns').label(t('navette-actions::export.modal.form.columns.label')).options(columnsOf().map((column): [string, string] => [column.name, column.getLabel()])).columns(mappingColumns)] : []),
            ...exporterOf().getOptionsFormComponents(),
        ])
        .fillForm(({ livewire }) => {
            let visible: Set<string> | null = null;
            if (visibleTableColumnsByDefault) { try { visible = new Set(getVisibleColumns(livewire.getTable(), livewire).map((column) => column.name)); } catch { visible = null; } }
            return { columns: columnsOf().filter((column) => column.isEnabledByDefault() && (!visible || visible.has(column.name))).map((column) => column.name) };
        })
        .action(async ({ livewire, data }) => {
            const currentExporter = exporterOf();
            // Only declared, visible columns are exported, whatever list the browser sends.
            const requested = mapping ? (Array.isArray(data.columns) ? data.columns.map(String) : []) : columnsOf().map((column) => column.name);
            const columns = columnsOf().filter((column) => requested.includes(column.name));
            if (!columns.length) { Notification.make().danger().title(t('navette-actions::export.notifications.no_columns.title')).body(t('navette-actions::export.notifications.no_columns.body')).send(); return; }
            // The options: the action's, then the values of the options form (declared components only).
            const options: Record<string, unknown> = { ...lazy(staticOptions, livewire), ...Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'columns')) };
            const adapter = livewire.getDataAdapterForTable();
            const table = livewire.getTable();
            // The table's current query (filters, search, sort); a bulk export only takes the selected records.
            const tableQuery = getTableQuery(table, livewire);
            const query = { ...tableQuery, modifiers: [...(tableQuery.modifiers ?? []), (q: any) => currentExporter.modifyQuery(q, options), ...(modifyQueryUsing ? [(q: any) => { modifyQueryUsing!(q, { options, livewire }); }] : [])] } as any;
            // Relationships of the exported columns are eager-loaded, and their relationship aggregates selected.
            addRelationshipsToQuery(query, columns);
            ensureRelationshipSupport(adapter, query);
            const records: string[] | null = bulk ? await livewire.getSelectedRecordKeys() : null;
            const selection = records ? { ...query, keys: records } : query;
            const perPage = Math.max(1, Math.floor(lazy(chunkSize, livewire)));
            const first = await adapter.paginate({ ...selection, page: 1, perPage });
            const limit = Math.min(maxRows, HARD_MAX_EXPORT_ROWS);
            if (first.total > limit) { Notification.make().danger().title(t('navette-actions::export.notifications.max_rows.title')).body(tc('navette-actions::export.notifications.max_rows.body', limit, { count: limit.toLocaleString('en-US') })).send(); return; }
            const user = livewire._ctx?.user;
            const panel = livewire._ctx?.panel;
            const background = queued && canQueue(panel);
            const history: ImportExportHistory | null = panel?.getImportExportHistory?.() ?? null;
            const exportFormats = formats ?? normalizeExportFormats(currentExporter.getFormats());
            // The download disk: the action's, the exporter's, or the panel's `downloads()` store.
            const disk = fileDisk ?? currentExporter.getFileDiskName();
            const storage = panel.getDownloadDisk ? panel.getDownloadDisk(disk) : panel.getDownloads();
            const columnMap = Object.fromEntries(columns.map((column) => [column.name, column.getLabel()]));
            const run: ExportRun = { id: null, userId: user?.id ?? null, userType: panel?.getId?.() ?? null, exporter: currentExporter.name, fileName: '', totalRows: first.total, successfulRows: 0, columnMap, options, formats: exportFormats };
            const nameOf = (count: number) => fileNameOf(fileName === null ? currentExporter.getFileName(count, run) : typeof fileName === 'function' ? fileName(run) : fileName);
            run.fileName = nameOf(first.total);
            if (history) run.id = await history.startExport({ userId: user.id, userType: run.userType ?? null, exporter: currentExporter.name, fileName: run.fileName, totalRows: first.total });
            if (bulk) livewire.deselectAllTableRecords();
            if (exportFake) { exportFake.record({ export: run, query: new ExportQuery(adapter, query), columnMap, options, formats: exportFormats, records }); return; }
            const process = async () => {
                const ctx = { options, export: run };
                const names = columns.map((column) => column.name);
                const values: unknown[][] = [];
                for (let page = 1; page <= first.lastPage; page++) {
                    if (page > 1) await new Promise((resolve) => setImmediate(resolve));
                    const { records: chunk } = page === 1 ? first : await adapter.paginate({ ...selection, page, perPage });
                    for (const record of chunk) values.push(columns.map((column) => column.getFormattedState(record, ctx)));
                }
                run.successfulRows = values.length;
                run.fileName = nameOf(values.length);
                const labels = columns.map((column) => column.getLabel());
                const links: any[] = [];
                const store = async (format: ExportFormatType, type: string, content: string | Buffer) => {
                    const key = exportFormatKey(format);
                    const downloader = currentExporter.getDownloader(format);
                    let downloaderName: string | null = null;
                    if (downloader !== sendDownload) { downloaderName = `export:${currentExporter.name}:${key}`; registerDownloader(downloaderName, downloader); }
                    const token = await storage.put(user.id, `${run.fileName}.${key}`, type, content, { downloader: downloaderName });
                    return panel.getDownloadUrl(token, ...(disk ? [disk] : []));
                };
                for (const format of exportFormats) {
                    if (format === 'csv') {
                        const delimiter = currentExporter.getCsvDelimiter();
                        if ([...delimiter].length !== 1) throw new Error(`${currentExporter.name}.getCsvDelimiter(): the delimiter must be a single character.`);
                        // Cells are protected against formula injection, except in the columns that opt out.
                        const protect = columns.map((column) => column.getFormulaInjectionPrevention(ctx) !== false);
                        const csv = `\uFEFF${[csvLine(labels, delimiter), ...values.map((row) => csvLine(row, delimiter, protect))].join('\r\n')}\r\n`;
                        links.push({ label: t('navette-actions::export.notifications.completed.actions.download_csv.label'), url: await store('csv', 'text/csv; charset=utf-8', csv) });
                    } else if (format === 'xlsx') {
                        const cellStyle = currentExporter.getXlsxCellStyle();
                        const headerStyle = currentExporter.getXlsxHeaderCellStyle() ?? cellStyle;
                        // Rows added by `configureXlsxWriterAfterOpen()` go above the header, those of `configureXlsxWriterBeforeClose()` below the data.
                        let writer = currentExporter.configureXlsxWriterAfterOpen(new XlsxWriter(), run) ?? new XlsxWriter();
                        writer.addHeaderRow(currentExporter.makeXlsxHeaderRow(labels, headerStyle, names));
                        for (const row of values) writer.addRow(currentExporter.makeXlsxRow(row, cellStyle, names));
                        writer = currentExporter.configureXlsxWriterBeforeClose(writer, run) ?? writer;
                        // Without any style, the header row is bold.
                        const xlsx = writer.toBuffer({ headerStyle: headerStyle ?? undefined, cellStyle, writerOptions: currentExporter.getXlsxWriterOptions() });
                        links.push({ label: t('navette-actions::export.notifications.completed.actions.download_xlsx.label'), url: await store('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xlsx) });
                    } else {
                        // A custom format: its content, then its download link.
                        const content = await format.generate({ exporter: currentExporter, export: run, columns: names, labels, rows: values, options });
                        const url = await store(format, format.getMimeType(), content);
                        links.push(format.getDownloadNotificationAction?.(url, run) ?? { label: t('navette-actions::export.notifications.completed.actions.download_format.label', { extension: format.getExtension() }), url });
                    }
                }
                if (history && run.id !== null) await history.finishExport(run.id, { successfulRows: values.length });
                const notification = Notification.make().success().persistent().title(currentExporter.getCompletedNotificationTitle(run)).body(currentExporter.getCompletedNotificationBody(values.length, run)).actions(links);
                await deliver(currentExporter.modifyCompletedNotification(notification, run), background, panel, user);
            };
            if (!background) { await process(); return; }
            Notification.make().success().title(t('navette-actions::export.notifications.started.title')).body(tc('navette-actions::export.notifications.started.body', first.total, { count: first.total.toLocaleString('en-US') })).send();
            runInBackground(process, { type: 'export', exporter: currentExporter, importer: null, run, queue: currentExporter.getJobQueue(), connection: currentExporter.getJobConnection(), panel: panel?.getId?.() ?? null, userId: user?.id ?? null });
        }) as ExportActionInstance;
    action.exporter = (value) => { exporter = value; return action; };
    action.getExporter = () => exporterOf();
    action.maxRows = (count) => { maxRows = Math.max(1, Math.floor(count)); return action; };
    action.formats = (list) => { const allowed = normalizeExportFormats(list); if (!allowed.length) throw new Error('ExportAction: formats() needs at least one format.'); formats = allowed; return action; };
    action.fileDisk = (disk) => { fileDisk = disk; return action; };
    action.getFileDisk = () => fileDisk;
    action.columnMapping = (condition) => { mapping = condition; if (!condition) action.requiresConfirmation(); return action; };
    action.columnMappingColumns = (count) => { mappingColumns = Math.max(1, Math.floor(count)); return action; };
    action.enableVisibleTableColumnsByDefault = (condition = true) => { visibleTableColumnsByDefault = condition; return action; };
    action.queued = (condition = true) => { queued = condition; return action; };
    action.modifyQueryUsing = (callback) => { modifyQueryUsing = callback; return action; };
    action.fileName = (value) => { fileName = value; return action; };
    action.options = (value) => { staticOptions = value; return action; };
    action.chunkSize = (size) => { chunkSize = size; return action; };
    return action;
}
/** Exports the records of the table (with its filters, search and sort) to CSV and XLSX files. */
export class ExportAction {
    /** Records the exports requested by export actions instead of building them (tests); `restore()` stops it. */
    static fake(): ExportFake { exportFake?.restore(); exportFake = new ExportFake(); return exportFake; }
    /** Name of `ExportAction.make()` without a name. */
    static getDefaultName(): string { return 'export'; }
    private static configurators: ((action: ExportActionInstance) => void)[] = [];
    /** Default setup of every export action created afterwards by `make()`: `ExportAction.configureUsing((action) => action.fileDisk('reports'))`. */
    static configureUsing(configure: (action: ExportActionInstance) => void): void { this.configurators.push(configure); }
    /** Forgets the `configureUsing()` callbacks (tests). */
    static resetConfiguration(): void { this.configurators = []; }
    static make(name: string | null = null): ExportActionInstance { const action = makeExportAction(name ?? this.getDefaultName(), false); for (const configure of this.configurators) configure(action); return action; }
}
/** Exports the selected records to CSV and XLSX files. */
export class ExportBulkAction {
    /** Same fake as `ExportAction.fake()`: it records both actions. */
    static fake(): ExportFake { return ExportAction.fake(); }
    /** Name of `ExportBulkAction.make()` without a name. */
    static getDefaultName(): string { return 'export'; }
    private static configurators: ((action: ExportActionInstance) => void)[] = [];
    /** Default setup of every export bulk action created afterwards by `make()`. */
    static configureUsing(configure: (action: ExportActionInstance) => void): void { this.configurators.push(configure); }
    /** Forgets the `configureUsing()` callbacks (tests). */
    static resetConfiguration(): void { this.configurators = []; }
    static make(name: string | null = null): ExportActionInstance { const action = makeExportAction(name ?? this.getDefaultName(), true); for (const configure of this.configurators) configure(action); return action; }
}

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
/**
 * What a background runner receives with each task: the kind of work, the exporter or importer class, the run, the queue and
 * connection names of the exporter's or importer's `getJobQueue()` and `getJobConnection()`, the panel and the user.
 */
export type BackgroundTaskContext = {
    type: 'export' | 'import';
    exporter: Function | null;
    importer: Function | null;
    run: { id: string | number | null; fileName: string } & Record<string, unknown>;
    queue: string | null;
    connection: string | null;
    panel: string | null;
    userId: string | number | null;
};
let backgroundRunner: (task: BackgroundTask, context: BackgroundTaskContext | null) => void = (task) => { pendingTasks.push(task); setImmediate(() => { void drainTasks(); }); };
/**
 * Runs queued imports and exports. By default, one at a time in this process, after the response. Plug your own queue (BullMQ,
 * a worker…) with a function receiving each task.
 */
export const useBackgroundRunner = (runner: (task: BackgroundTask, context: BackgroundTaskContext | null) => void): void => { backgroundRunner = runner; };
/** Hands a task to the background runner, with its context (to route it: `context.queue`, `context.exporter`...). */
export const runInBackground = (task: BackgroundTask, context: BackgroundTaskContext | null = null): void => backgroundRunner(task, context);

/** Where runs of imports and exports are recorded (see `knexImportExportHistory()`). */
export interface ImportExportHistory {
    /** `userType`: the panel's id, stored by a history with a polymorphic user. */
    startImport(data: { userId: string | number; userType?: string | null; importer: string; fileName: string; totalRows: number }): Promise<string | number>;
    finishImport(id: string | number, data: { processedRows: number; successfulRows: number }): Promise<void>;
    recordFailedImportRow(importId: string | number, row: Record<string, unknown>, error: string): Promise<void>;
    startExport(data: { userId: string | number; userType?: string | null; exporter: string; fileName: string; totalRows: number }): Promise<string | number>;
    finishExport(id: string | number, data: { successfulRows: number }): Promise<void>;
}
type Query = (table: string) => any;
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
/** Options of the import and export history tables. */
export type ImportExportHistoryOptions = {
    /**
     * Runs also store the type of their user (`user_type`, the panel's id), for
     * users of several panels (several user tables) whose ids may collide.
     */
    polymorphicUser?: boolean;
};
/** History in `imports`, `exports` and `failed_import_rows` tables (create them with `importExportSchema()`, with the same options). */
export function knexImportExportHistory(db: Query, historyOptions: ImportExportHistoryOptions = {}): ImportExportHistory {
    const userOf = (data: { userId: string | number; userType?: string | null }) => ({ user_id: data.userId, ...(historyOptions.polymorphicUser ? { user_type: data.userType ?? null } : {}) });
    const insert = async (table: string, values: Record<string, unknown>) => { const [id] = await db(table).insert(values); return typeof id === 'object' && id !== null ? (id as any).id : id; };
    return {
        startImport: (data) => insert('imports', { ...userOf(data), importer: data.importer, file_name: data.fileName.slice(0, 255), total_rows: data.totalRows, processed_rows: 0, successful_rows: 0, created_at: now(), updated_at: now() }),
        async finishImport(id, data) { await db('imports').where('id', id).update({ processed_rows: data.processedRows, successful_rows: data.successfulRows, completed_at: now(), updated_at: now() }); },
        async recordFailedImportRow(importId, row, error) { await db('failed_import_rows').insert({ import_id: importId, data: JSON.stringify(row), validation_error: error.slice(0, 1000), created_at: now(), updated_at: now() }); },
        startExport: (data) => insert('exports', { ...userOf(data), exporter: data.exporter, file_name: data.fileName.slice(0, 255), total_rows: data.totalRows, successful_rows: 0, created_at: now(), updated_at: now() }),
        async finishExport(id, data) { await db('exports').where('id', id).update({ successful_rows: data.successfulRows, completed_at: now(), updated_at: now() }); },
    };
}
/** Creates the history tables when missing (call it from a migration); `polymorphicUser` adds (or creates) the `user_type` columns. */
export async function importExportSchema(knex: any, historyOptions: ImportExportHistoryOptions = {}): Promise<void> {
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
    if (historyOptions.polymorphicUser) for (const name of ['imports', 'exports']) {
        if (!(await knex.schema.hasColumn(name, 'user_type'))) await knex.schema.alterTable(name, (table: any) => { table.string('user_type').nullable(); table.index(['user_type', 'user_id']); });
    }
}
/** Sends a notification now (in the request) or, for background work, to the user's database notifications. */
export async function deliver(notification: Notification, background: boolean, panel: any, user: any): Promise<void> {
    if (background) await notification.sendToDatabase(panel.getDatabaseNotifications?.() ?? null, user.id);
    else notification.send();
}
/** Background work needs database notifications to tell the user it ended; without them, it runs in the request. */
export const canQueue = (panel: any) => Boolean(panel?.getDatabaseNotifications?.());

