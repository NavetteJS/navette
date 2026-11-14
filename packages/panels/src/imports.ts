// Import action: CSV and XLSX files read during the request or in the background (queued()), each row validated and
// saved through the data adapter by an importer, with an options form, lifecycle hooks, relationships, a failed rows file,
// and test helpers (`Importer.test()`, `ImportAction.fake()`).
import { AssertionError } from 'node:assert';
import { readFileSync, statSync } from 'node:fs';
import { Action } from '@navette-js/actions';
import { FileUpload, Select, stringRule, type Rule, type TemporaryUpload } from '@navette-js/forms';
import { Fieldset } from '@navette-js/schemas';
import { configured, icons, type Enum } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { registerDownloader, sendDownload, type Downloader } from './downloads.ts';
import { canQueue, csvLine, deliver, parseCsv, runInBackground, type ImportExportHistory } from './import-export.ts';
import { Notification } from './notifications.ts';
import { readXlsx } from './xlsx.ts';

// ------------------------------------------------------------------ runs and row context
/** One import, as the hooks, the notification and the fake see it. */
export type ImportRun = {
    /** Key of the run in the import history, if the panel keeps one. */
    id: string | number | null;
    userId: string | number | null;
    /** Type of the user (the panel's id), stored by a history with a polymorphic user. */
    userType?: string | null;
    importer: string;
    fileName: string;
    totalRows: number;
    processedRows: number;
    successfulRows: number;
    /** Importer column name → header of the file (`null`: not imported). */
    columnMap: Record<string, string | null>;
    options: Record<string, unknown>;
};
/** What an importer's hooks and column functions receive for the current row. */
export type ImportRowContext = {
    /** Values by column name, cast (and by file header, as read). Hooks may change them before validation. */
    data: Record<string, unknown>;
    /** The row as read from the file, by header. */
    originalData: Record<string, unknown>;
    /** The record of the row: as returned by `resolveRecord()`, then the saved record once saved. */
    record: any | null;
    /** Attributes written to the record (filled by the columns); hooks may change them before saving. */
    values: Record<string, unknown>;
    options: Record<string, unknown>;
    columnMap: Record<string, string | null>;
    import: ImportRun | null;
    livewire: any;
    importer: typeof Importer;
};
/** Context of an import column's functions: the row context, and the column. */
export type ImportColumnContext = Partial<ImportRowContext> & { column: ImportColumn; options: Record<string, unknown> };
type ImportLazy<T> = T | ((ctx: ImportColumnContext) => T);
const evaluate = <T>(value: ImportLazy<T>, ctx: ImportColumnContext): T => (typeof value === 'function' ? (value as (ctx: ImportColumnContext) => T)(ctx) : value);
const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

/** Thrown from an importer hook to fail the current row with this message (shown in the failed rows file). */
export class RowImportFailedError extends Error {}
/**
 * Thrown from an importer hook to fail the current row with validation errors:
 * `throw new ImportValidationError({ price: 'The price is too low.' })`.
 */
export class ImportValidationError extends Error {
    readonly errors: Record<string, string[]>;
    constructor(errors: Record<string, string | string[]>) {
        const normalized = Object.fromEntries(Object.entries(errors).map(([key, messages]) => [key, [messages].flat()]));
        super(Object.values(normalized).flat().join(' '));
        this.errors = normalized;
    }
}

// ------------------------------------------------------------------ columns
/**
 * A validation rule of an import column: a Laravel-style string (`'required'`, `'max:255'`, `'in:a,b'`…), a rule object
 * (`{ name, passes, message }`), or a function returning an error message or `null`: `(state, data, ctx) => …`.
 */
export type ImportRule = string | Rule | ((state: unknown, data: Record<string, unknown>, ctx: ImportColumnContext) => string | null | undefined | Promise<string | null | undefined>);
type FailedRule = { rule: string; message: string };
type RelationshipResolver = string | string[] | ((state: unknown, ctx: ImportColumnContext) => unknown);

/** Column of an import: the file column it is read from, how its value is cast and validated, and how it fills the record. */
export class ImportColumn {
    readonly name: string;
    private _label: ImportLazy<string | null> = null;
    private _guesses: ImportLazy<string[]> = [];
    private _required: ImportLazy<boolean> = false;
    private _requiredForNew: ImportLazy<boolean> = false;
    private _rules: ImportLazy<ImportRule[]> = [];
    private _nestedRules: ImportLazy<ImportRule[]> = [];
    private _cast: ((state: any, ctx: ImportColumnContext & { originalState: unknown }) => unknown) | null = null;
    private _examples: ImportLazy<unknown> | undefined = undefined;
    private _exampleHeader: ImportLazy<string | null> = null;
    private _fill: ((record: Record<string, unknown>, state: any, ctx: ImportColumnContext) => void) | null = null;
    private _saveRelationships: ((args: { record: any; state: unknown; ctx: ImportColumnContext }) => void | Promise<void>) | null = null;
    private _enum: Enum<string | number> | null = null;
    private _numeric: ImportLazy<boolean> = false;
    private _decimalPlaces: ImportLazy<number | null> = null;
    private _integer: ImportLazy<boolean> = false;
    private _boolean: ImportLazy<boolean> = false;
    private _ignoreBlank: ImportLazy<boolean> = false;
    private _separator: ImportLazy<string | null> = null;
    private _relationship: { name: ImportLazy<string>; resolveUsing: RelationshipResolver | null; model: any } | null = null;
    private _validationAttribute: ImportLazy<string | null> = null;
    private _helperText: ImportLazy<string | null> = null;
    private _sensitive: ImportLazy<boolean> = false;
    /** Related records found for the current row, by state (cleared for each row). */
    private resolved = new Map<string, unknown>();
    constructor(name: string) { this.name = name; }
    static make(name: string): ImportColumn { return configured(new ImportColumn(name)); }
    private ctx(ctx?: Partial<ImportColumnContext>): ImportColumnContext { return { options: {}, ...ctx, column: this }; }

    label(label: ImportLazy<string | null>): this { this._label = label; return this; }
    getLabel(ctx?: Partial<ImportColumnContext>): string { return evaluate(this._label, this.ctx(ctx)) ?? this.name.replace(/[_.]+/g, ' ').replace(/^./, (c) => c.toUpperCase()); }
    /** Other file headers that map to this column (compared case-insensitively, with `-`, `_` and spaces alike). */
    guess(headers: ImportLazy<string[]>): this { this._guesses = headers; return this; }
    /** Alias of `guess()`. */
    guesses(headers: ImportLazy<string[]>): this { return this.guess(headers); }
    /** The headers this column matches: its label, its name and its guesses, lowercased, with `-`, `_` and spaces variants. */
    getGuesses(ctx?: Partial<ImportColumnContext>): string[] {
        const guesses = [this.getLabel(ctx), this.name, ...evaluate(this._guesses, this.ctx(ctx))];
        return guesses.flatMap((guess) => {
            const lower = guess.toLowerCase();
            const spaced = lower.replace(/[-_]/g, ' ');
            return [lower, spaced, ...(spaced.includes(' ') ? [spaced.replace(/ /g, '-'), spaced.replace(/ /g, '_')] : [])];
        });
    }
    matches(header: string): boolean { return this.getGuesses().includes(header.trim().toLowerCase()); }
    /** The file must have this column: the user must map it before importing. */
    requiredMapping(condition: ImportLazy<boolean> = true): this { this._required = condition; return this; }
    isMappingRequired(ctx?: Partial<ImportColumnContext>): boolean { return Boolean(evaluate(this._required, this.ctx(ctx))); }
    /** Only rows that create a record need this column: a row creating a record fails when it is not mapped. */
    requiredMappingForNewRecordsOnly(condition: ImportLazy<boolean> = true): this { this._requiredForNew = condition; return this; }
    isMappingRequiredForNewRecordsOnly(ctx?: Partial<ImportColumnContext>): boolean { return Boolean(evaluate(this._requiredForNew, this.ctx(ctx))); }
    /** Validation of the cast value (see `ImportRule`). */
    rules(rules: ImportLazy<ImportRule[]>): this { if (Array.isArray(rules)) checkRules(rules); this._rules = rules; return this; }
    /** Validation of each value of a `multiple()` column: `.multiple(',').integer().nestedRecursiveRules(['min:1', 'max:5'])`. */
    nestedRecursiveRules(rules: ImportLazy<ImportRule[]>): this { if (Array.isArray(rules)) checkRules(rules); this._nestedRules = rules; return this; }
    /**
     * Converts the value, after the built-in casts (`numeric()`, `boolean()`, `multiple()`…): `(state, { originalState, … }) => value`.
     * The state is the trimmed text of the cell (`null` when blank) when no built-in cast applies.
     */
    castStateUsing(cast: ((state: any, ctx: ImportColumnContext & { originalState: unknown }) => unknown) | null): this { this._cast = cast; return this; }
    /** Casts the value to a number (characters other than digits, `.` and `-` are ignored), rounded to `decimalPlaces` if given. */
    numeric(condition: ImportLazy<boolean> = true, decimalPlaces: ImportLazy<number | null> = null): this { this._numeric = condition; this._decimalPlaces = decimalPlaces; return this; }
    /** Casts the value to an integer. */
    integer(condition: ImportLazy<boolean> = true): this { this._integer = condition; return this; }
    /** Casts `1`, `true`, `yes`, `y`, `on` to `1` and `0`, `false`, `no`, `n`, `off` to `0`. */
    boolean(condition: ImportLazy<boolean> = true): this { this._boolean = condition; return this; }
    isNumeric(): boolean { return Boolean(evaluate(this._numeric, this.ctx())) || Boolean(evaluate(this._integer, this.ctx())); }
    isBoolean(): boolean { return Boolean(evaluate(this._boolean, this.ctx())); }
    getDecimalPlaces(): number | null { return evaluate(this._decimalPlaces, this.ctx()); }
    /** A blank cell leaves the record's value unchanged, instead of writing `null`. */
    ignoreBlankState(condition: ImportLazy<boolean> = true): this { this._ignoreBlank = condition; return this; }
    isBlankStateIgnored(ctx?: Partial<ImportColumnContext>): boolean { return Boolean(evaluate(this._ignoreBlank, this.ctx(ctx))); }
    /** The cell holds several values, split by `separator`: the state is a list (each value cast, blank values dropped). */
    multiple(separator: ImportLazy<string | null> = ','): this { this._separator = separator; return this; }
    /** Alias of `multiple()`. */
    array(separator: ImportLazy<string | null> = ','): this { return this.multiple(separator); }
    getArraySeparator(ctx?: Partial<ImportColumnContext>): string | null { const separator = evaluate(this._separator, this.ctx(ctx)); return separator === null || separator === '' ? null : separator; }
    isMultiple(ctx?: Partial<ImportColumnContext>): boolean { return this.getArraySeparator(ctx) !== null; }
    /** Value written in the example file. */
    example(value: ImportLazy<unknown>): this { this._examples = value; return this; }
    /** Several values: one row of the example file each. */
    examples(values: ImportLazy<unknown[]>): this { this._examples = values; return this; }
    getExamples(ctx?: Partial<ImportColumnContext>): unknown[] {
        if (this._examples !== undefined) { const examples = evaluate(this._examples, this.ctx(ctx)); return examples === null || examples === undefined ? [] : [examples].flat(); }
        return this._enum ? this._enum.values() : [];
    }
    /** The first example value (`getExamples()`), as text. */
    getExample(): string { const example = this.getExamples()[0]; return example === null || example === undefined ? '' : String(example); }
    /** Header of this column in the example file (its name by default). */
    exampleHeader(header: ImportLazy<string | null>): this { this._exampleHeader = header; return this; }
    getExampleHeader(ctx?: Partial<ImportColumnContext>): string { return evaluate(this._exampleHeader, this.ctx(ctx)) ?? this.name; }
    /** Writes the value into the record's attributes yourself: `(values, state, ctx) => void`. */
    fillRecordUsing(fill: ((record: Record<string, unknown>, state: any, ctx: ImportColumnContext) => void) | null): this { this._fill = fill; return this; }
    /** Saves the value once the record is saved (related records…): `({ record, state, ctx }) => …`. */
    saveRelationshipsUsing(callback: ((args: { record: any; state: unknown; ctx: ImportColumnContext }) => void | Promise<void>) | null): this { this._saveRelationships = callback; return this; }
    /** A non-empty value must be one of the enum's values; the enum's values are the examples. */
    enum(enumeration: Enum<string | number> | null): this { this._enum = enumeration; return this; }
    /**
     * Imports a belongs-to relationship (the cell identifies the related record, whose key fills the foreign key) or, with
     * `multiple()`, a many-to-many relationship (the records are linked once the record is saved). The relationship is one
     * of the Objection model's `relationMappings` (the column's name by default). `resolveUsing` finds the related records:
     * by their key by default, or by a column (`'email'`), several columns (`['email', 'username']`, any of them), or a
     * function returning the record (or the records), or the columns to use. A value that matches no record fails validation.
     */
    relationship(name: ImportLazy<string> | null = null, resolveUsing: RelationshipResolver | null = null, options: { model?: any } = {}): this {
        this._relationship = { name: name ?? this.name, resolveUsing, model: options.model ?? null };
        return this;
    }
    hasRelationship(): boolean { return this._relationship !== null; }
    getRelationshipName(ctx?: Partial<ImportColumnContext>): string | null { return this._relationship ? evaluate(this._relationship.name, this.ctx(ctx)) : null; }
    /** Name of the column in validation messages (the lowercased label by default). */
    validationAttribute(label: ImportLazy<string | null>): this { this._validationAttribute = label; return this; }
    getValidationAttribute(ctx?: Partial<ImportColumnContext>): string { return evaluate(this._validationAttribute, this.ctx(ctx)) ?? this.getLabel(ctx).replace(/^./, (c) => c.toLowerCase()); }
    /** Text under the column's select in the mapping form. */
    helperText(text: ImportLazy<string | null>): this { this._helperText = text; return this; }
    getHelperText(ctx?: Partial<ImportColumnContext>): string | null { return evaluate(this._helperText, this.ctx(ctx)); }
    /** The value is left out of the failed rows file and of the import history. */
    sensitive(condition: ImportLazy<boolean> = true): this { this._sensitive = condition; return this; }
    isSensitive(ctx?: Partial<ImportColumnContext>): boolean { return Boolean(evaluate(this._sensitive, this.ctx(ctx))); }
    /** Select of the mapping form: the file's headers as options. */
    getSelect(headers: string[]): Select {
        const select = Select.make(this.name).label(this.getLabel()).placeholder(t('navette-actions::import.modal.form.columns.placeholder'))
            .options(headers.map((header): [string, string] => [header, header])).required(this.isMappingRequired());
        const helper = this.getHelperText();
        if (helper) select.belowContent(helper);
        return select;
    }

    // ---- casting
    private castItem(state: unknown): unknown {
        if (typeof state === 'string') state = state.trim();
        if (isBlank(state)) return null;
        if (this.isBoolean()) {
            const text = String(state).toLowerCase();
            return ['1', 'true', 'yes', 'y', 'on'].includes(text) ? 1 : ['0', 'false', 'no', 'n', 'off'].includes(text) ? 0 : text !== '' ? 1 : 0;
        }
        if (this.isNumeric()) {
            const digits = String(state).replace(/[^0-9.-]/g, '');
            // Text without a number stays invalid (NaN), so that the `numeric` rule rejects it.
            let number = digits === '' || digits === '-' || digits === '.' ? NaN : Number(digits);
            if (Number.isFinite(number) && Boolean(evaluate(this._integer, this.ctx()))) number = Math.trunc(number);
            const places = this.getDecimalPlaces();
            if (places !== null && Number.isFinite(number)) number = Math.round(number * 10 ** places) / 10 ** places;
            return number;
        }
        if (this._enum && !this.isMultiple()) return this._enum.tryFrom(String(state))?.value ?? state;
        return state;
    }
    /** The value of the cell, cast: trimmed, `null` when blank, split by `multiple()`, then `numeric()`, `boolean()`, `castStateUsing()`. */
    castState(state: unknown, ctx?: Partial<ImportColumnContext>): unknown {
        const originalState = state;
        const separator = this.getArraySeparator(ctx);
        let cast: unknown = separator !== null
            ? (isBlank(state) ? [] : String(state).split(separator).map((item) => this.castItem(item)).filter((item) => !isBlank(item)).map((item) => (this._enum && typeof item === 'string' ? this._enum.tryFrom(item)?.value ?? item : item)))
            : this.castItem(state);
        if (this._cast) cast = this._cast(cast, { ...this.ctx(ctx), originalState });
        return cast;
    }
    /** Alias of `castState()`. */
    cast(value: string | null): unknown { return this.castState(value); }

    // ---- relationships
    private relationInfo(model: any, ctx: ImportColumnContext) {
        const modelClass = this._relationship?.model ?? model;
        if (typeof modelClass?.getRelation !== 'function') throw new Error(`ImportColumn "${this.name}": relationship() needs an Objection model (the data adapter's, the importer's static \`model\`, or { model }).`);
        const relation = modelClass.getRelation(this.getRelationshipName(ctx));
        const related = relation.relatedModelClass;
        const isMany = /ManyToMany/.test(relation.constructor?.name ?? '') || typeof relation.joinTable === 'string';
        return { modelClass, relation, related, isMany };
    }
    /** Related records of a value (one record, or a list for `multiple()`), and whether every value was found. */
    async resolveRelated(state: unknown, model: any, ctx: ImportColumnContext): Promise<{ records: any[]; complete: boolean | null }> {
        const cacheKey = JSON.stringify(state);
        if (this.resolved.has(cacheKey)) return this.resolved.get(cacheKey) as { records: any[]; complete: boolean | null };
        const { related } = this.relationInfo(model, ctx);
        const values = [state].flat().filter((value) => !isBlank(value));
        let resolver: unknown = this._relationship!.resolveUsing ?? related.idColumn;
        if (typeof resolver === 'function') resolver = await resolver(this.isMultiple(ctx) ? values : state, ctx);
        let result: { records: any[]; complete: boolean | null };
        if (resolver === null || resolver === undefined || resolver === '') result = { records: [], complete: null };
        else if (typeof resolver === 'string' || (Array.isArray(resolver) && resolver.every((item) => typeof item === 'string'))) {
            // Columns named by the importer's code; the values are bound parameters.
            const columns = [resolver].flat() as string[];
            const query = related.query();
            query.where((where: any) => { columns.forEach((column, index) => (index === 0 ? where.whereIn(column, values) : where.orWhereIn(column, values))); });
            const records = values.length ? await query.limit(10000) : [];
            const found = (value: unknown) => records.some((record: any) => columns.some((column) => String(record[column]) === String(value)));
            result = { records: this.isMultiple(ctx) ? records : records.slice(0, 1), complete: values.every(found) };
        } else result = { records: [resolver].flat().filter((record) => record !== null && record !== undefined && typeof record === 'object'), complete: null };
        this.resolved.set(cacheKey, result);
        return result;
    }
    /** Forgets the related records of the previous row. */
    clearResolvedRelatedRecords(): void { this.resolved.clear(); }

    // ---- validation
    /** Every rule the cast value fails (a function rule is named `closure`); `messages` are the importer's custom messages. */
    async validateState(state: unknown, ctx: ImportColumnContext, model: any = null, messages: Record<string, string> = {}): Promise<Record<string, FailedRule[]>> {
        const attribute = this.getValidationAttribute(ctx);
        const failures: Record<string, FailedRule[]> = {};
        const add = (key: string, rule: string, message: string, label = attribute) => {
            const custom = messages[`${key}.${rule}`] ?? messages[`${this.name}.${rule}`] ?? messages[rule];
            (failures[key] ??= []).push({ rule, message: custom ? custom.replace(/:attribute/g, label) : message });
        };
        const numeric = this.isNumeric() || evaluate(this._rules, ctx).some((rule) => typeof rule === 'string' && /^(numeric|integer)\b/.test(rule));
        await runRules(evaluate(this._rules, ctx), state, ctx, { numeric, attribute }, (rule, message) => add(this.name, rule, message));
        if (this.isMultiple(ctx) && Array.isArray(state)) {
            const nested = evaluate(this._nestedRules, ctx);
            const nestedNumeric = this.isNumeric() || nested.some((rule) => typeof rule === 'string' && /^(numeric|integer)\b/.test(rule));
            for (const [index, item] of state.entries()) {
                const label = `${attribute}.${index}`;
                await runRules(nested, item, ctx, { numeric: nestedNumeric, attribute: label }, (rule, message) => add(`${this.name}.${index}`, rule, message, label));
                if (this._enum && !isBlank(item) && !this._enum.has(item as string | number)) add(`${this.name}.${index}`, 'enum', `The selected ${label} is invalid.`, label);
            }
        } else if (this._enum && !isBlank(state) && !this._enum.has(state as string | number)) add(this.name, 'enum', `The selected ${attribute} is invalid.`);
        if (this._relationship && !isBlank(state)) {
            const values = [state].flat().filter((value) => !isBlank(value));
            const { records, complete } = await this.resolveRelated(state, model, ctx);
            const distinct = new Set(values.map((value) => JSON.stringify(value))).size;
            if (this.isMultiple(ctx) ? records.length < distinct || complete === false : records.length === 0) add(this.name, 'exists', `The selected ${attribute} is invalid.`);
        }
        return failures;
    }
    /** First rule the raw cell value fails, with its message (`validateState()` checks the cast value). */
    failedRule(value: string | null, row: Record<string, unknown>): FailedRule | null {
        let first: FailedRule | null = null;
        const state = this.castState(value);
        const ctx = this.ctx({ data: row });
        const rules = evaluate(this._rules, ctx);
        // Synchronous rules only.
        for (const rule of rules) {
            if (first) break;
            if (typeof rule === 'function') { const message = rule(state, row, ctx); if (typeof message === 'string' && message) first = { rule: 'closure', message }; continue; }
            const built = typeof rule === 'string' ? stringRule(rule, { numeric: this.isNumeric(), name: this.name }) : rule;
            if (!built || (!built.implicit && isBlank(state))) continue;
            const passes = built.passes(state, ruleContext(ctx));
            if (passes === false) first = { rule: built.name, message: built.message(this.getValidationAttribute()) };
        }
        if (!first && this._enum && !isBlank(state) && !this._enum.has(state as string | number)) first = { rule: 'enum', message: `The selected ${this.getValidationAttribute()} is invalid.` };
        return first;
    }
    validate(value: string | null, row: Record<string, unknown>): string | null { return this.failedRule(value, row)?.message ?? null; }

    // ---- filling
    /** Writes the cast value into the record's attributes (the attribute with the column's name, or the foreign key of a belongs-to relationship). */
    async fillRecord(values: Record<string, unknown>, state: unknown, ctx: ImportColumnContext, model: any = null): Promise<void> {
        if (this._fill) { this._fill(values, state, ctx); return; }
        if (this._relationship) {
            const { relation, isMany } = this.relationInfo(model, ctx);
            if (isMany) return;
            const ownerProp = relation.ownerProp?.props?.[0] ?? relation.ownerProp?.cols?.[0];
            const relatedProp = relation.relatedProp?.props?.[0] ?? relation.relatedProp?.cols?.[0] ?? relation.relatedModelClass.idColumn;
            const related = isBlank(state) ? null : (await this.resolveRelated(state, model, ctx)).records[0] ?? null;
            values[ownerProp] = related ? related[relatedProp] : null;
            return;
        }
        values[this.name] = state;
    }
    /** Alias of `fillRecord()`: synchronous, without relationships. */
    fill(record: Record<string, unknown>, value: unknown): void { if (this._fill) this._fill(record, value, this.ctx()); else record[this.name] = value; }
    /** Once the record is saved: links the records of a many-to-many relationship (those not linked yet), or runs `saveRelationshipsUsing()`. */
    async saveRelationships(record: any, state: unknown, ctx: ImportColumnContext, model: any = null): Promise<void> {
        if (this._saveRelationships) { await this._saveRelationships({ record, state, ctx }); return; }
        if (!this._relationship) return;
        const { modelClass, related, isMany } = this.relationInfo(model, ctx);
        if (!isMany || isBlank(state)) return;
        const key = record[modelClass.idColumn];
        const linked = new Set((await modelClass.relatedQuery(this.getRelationshipName(ctx)).for(key).clearSelect().select(`${related.tableName}.${related.idColumn} as __key`)).map((row: any) => String(row.__key)));
        for (const target of (await this.resolveRelated(state, model, ctx)).records) {
            const id = target[related.idColumn];
            if (linked.has(String(id))) continue;
            await modelClass.relatedQuery(this.getRelationshipName(ctx)).for(key).relate(id);
            linked.add(String(id));
        }
    }
}

/** Rule names of strings are checked when the column is declared: an unknown rule fails at once. */
function checkRules(rules: ImportRule[]): void { for (const rule of rules) if (typeof rule === 'string') stringRule(rule, { numeric: false, name: 'column' }); }
/** The context the string rules expect (`same:`, `required_if:`… read sibling values): the row's cast data. */
const ruleContext = (ctx: ImportColumnContext): any => ({ get: (name: string) => ctx.data?.[name], state: undefined, livewire: ctx.livewire ?? null, record: ctx.record ?? null, operation: 'create' });
async function runRules(rules: ImportRule[], state: unknown, ctx: ImportColumnContext, options: { numeric: boolean; attribute: string }, fail: (rule: string, message: string) => void): Promise<void> {
    for (const rule of rules) {
        if (typeof rule === 'function') { const message = await rule(state, ctx.data ?? {}, ctx); if (message) fail('closure', message); continue; }
        const built = typeof rule === 'string' ? stringRule(rule, { numeric: options.numeric, name: ctx.column.name }) : rule;
        if (!built || (!built.implicit && isBlank(state))) continue;
        if (!(await built.passes(state, ruleContext(ctx)))) fail(built.name, built.message(options.attribute));
    }
}

// ------------------------------------------------------------------ rows
type DataAdapterLike = { getKey(record: any): string; create(data: Record<string, unknown>): Promise<any>; update(key: string, data: Record<string, unknown>): Promise<any>; model?: any };
export type RowStatus = 'imported' | 'skipped' | 'invalid' | 'failed';
type RowResult = { status: RowStatus; record: any | null; errors: Record<string, FailedRule[]>; failure: string | null };
/** A record returned by `resolveRecord()` exists when it has a key; one without (`{}`, `new Product()`) is created. */
const keyOf = (adapter: DataAdapterLike, record: any): string | null => {
    let key: unknown;
    try { key = adapter.getKey(record); } catch { return null; }
    return key === null || key === undefined || key === '' || key === 'undefined' || key === 'null' ? null : String(key);
};
/** Attributes a new record starts with: those `resolveRecord()` set on it (`{ team_id: 5 }`). */
const initialAttributes = (record: any): Record<string, unknown> => Object.fromEntries(Object.entries(record ?? {}).filter(([key, value]) => !key.startsWith('$') && typeof value !== 'function' && (value === null || typeof value !== 'object' || value instanceof Date)));

/**
 * Imports one row (`row`: cells by header; `columnMap`: column name → header): the mapped columns
 * are cast, `resolveRecord()` finds the record (`null` skips the row), then validation, filling and saving, with the hooks
 * around each step. A `RowImportFailedError` fails the row; an `ImportValidationError` fails it with validation errors.
 */
export async function importRow(importer: typeof Importer, columns: ImportColumn[], columnMap: Record<string, string | null>, row: Record<string, unknown>, adapter: DataAdapterLike, context: { livewire?: unknown; options?: Record<string, unknown>; import?: ImportRun | null } = {}): Promise<RowResult> {
    const errors: RowResult['errors'] = {};
    const model = importer.model ?? adapter.model ?? null;
    const mapped = (column: ImportColumn) => typeof columnMap[column.name] === 'string' && columnMap[column.name] !== '';
    const data: Record<string, unknown> = { ...row };
    for (const column of columns) if (mapped(column) && Object.hasOwn(row, columnMap[column.name]!)) data[column.name] = row[columnMap[column.name]!];
    const ctx: ImportRowContext = { data, originalData: { ...row }, record: null, values: {}, options: context.options ?? {}, columnMap, import: context.import ?? null, livewire: context.livewire ?? null, importer };
    const columnCtx = (column: ImportColumn): ImportColumnContext => ({ ...ctx, column });
    for (const column of columns) column.clearResolvedRelatedRecords();
    for (const column of columns) if (Object.hasOwn(data, column.name)) data[column.name] = column.castState(data[column.name], columnCtx(column));
    try {
        const record = await importer.resolveRecord(data, ctx);
        if (record === null || record === undefined) return { status: 'skipped', record: null, errors, failure: null };
        ctx.record = record;
        const existingKey = keyOf(adapter, record);
        if (existingKey === null) {
            for (const column of columns) if (!mapped(column) && column.isMappingRequiredForNewRecordsOnly(columnCtx(column))) {
                (errors[column.name] ??= []).push({ rule: 'required', message: t('navette-actions::import.failure_csv.column_mapping_required_for_new_record', { attribute: column.getLabel(columnCtx(column)) }) });
            }
            if (Object.keys(errors).length) return { status: 'invalid', record: null, errors, failure: null };
        }
        await importer.beforeValidate(ctx);
        const messages = importer.getValidationMessages();
        for (const column of columns) {
            if (!mapped(column)) continue;
            Object.assign(errors, await column.validateState(data[column.name] ?? null, columnCtx(column), model, messages));
        }
        if (Object.keys(errors).length) return { status: 'invalid', record: null, errors, failure: null };
        await importer.afterValidate(ctx);
        await importer.beforeFill(ctx);
        ctx.values = existingKey === null ? initialAttributes(record) : {};
        const filled = columns.filter((column) => mapped(column) && Object.hasOwn(data, column.name) && !(isBlank(data[column.name]) && column.isBlankStateIgnored(columnCtx(column))));
        for (const column of filled) await column.fillRecord(ctx.values, data[column.name], columnCtx(column), model);
        await importer.afterFill(ctx);
        await importer.beforeSave(ctx.values, existingKey === null ? null : record, ctx);
        await (existingKey === null ? importer.beforeCreate(ctx) : importer.beforeUpdate(ctx));
        // An update without any attribute to write (only relationships, or every cell blank and ignored) keeps the record as is.
        const saved = await importer.saveRecord(ctx.values, existingKey === null ? null : record, { ...ctx, adapter, key: existingKey });
        if (!saved) throw new RowImportFailedError('The record could not be saved.');
        ctx.record = saved;
        for (const column of filled) await column.saveRelationships(saved, data[column.name], columnCtx(column), model);
        await importer.afterSave(saved, ctx);
        await (existingKey === null ? importer.afterCreate(ctx) : importer.afterUpdate(ctx));
        return { status: 'imported', record: saved, errors, failure: null };
    } catch (error) {
        if (error instanceof RowImportFailedError) return { status: 'failed', record: null, errors, failure: error.message };
        if (error instanceof ImportValidationError) {
            for (const [key, list] of Object.entries(error.errors)) (errors[key] ??= []).push(...list.map((message) => ({ rule: 'custom', message })));
            return { status: 'invalid', record: null, errors, failure: null };
        }
        throw error;
    }
}
/** Message of a row that was not imported, for the failed rows file: every validation message, or the failure's. */
const rowError = (result: RowResult): string | null => (Object.keys(result.errors).length ? Object.values(result.errors).flat().map((error) => error.message).join(' ') : result.failure);

// ------------------------------------------------------------------ test helper
const fail = (message: string): never => { throw new AssertionError({ message }); };
export type TestableImportOptions = {
    adapter: DataAdapterLike;
    /** Column name → key of the row (file header); by default, every column reads the key with its own name. */
    columnMap?: Record<string, string | null> | null;
    /** Import options, as merged from the action's `options()` and its options form. */
    options?: Record<string, unknown>;
    /** The import run the hooks see (`ctx.import`); by default, an unsaved one. */
    import?: Partial<ImportRun> | null;
    livewire?: unknown;
};
/** Imports single rows with an importer, without a file or an action (see `Importer.test()`). */
export class TestableImport {
    private result: RowResult | null = null;
    private readonly importer: typeof Importer;
    private readonly options: TestableImportOptions;
    constructor(importer: typeof Importer, options: TestableImportOptions) { this.importer = importer; this.options = options; }
    /** Imports a row: its keys are file headers (the column names, unless `columnMap` maps columns to other headers). */
    async import(row: Record<string, unknown>): Promise<this> {
        const columns = this.importer.getColumns();
        const columnMap = this.options.columnMap ?? Object.fromEntries(columns.map((column) => [column.name, column.name]));
        const run: ImportRun = { id: null, userId: null, importer: this.importer.name, fileName: 'test.csv', totalRows: 1, processedRows: 0, successfulRows: 0, columnMap, options: this.options.options ?? {}, ...this.options.import };
        const cells = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === undefined || value === null ? null : typeof value === 'string' ? value : String(value)]));
        this.result = await importRow(this.importer, columns, columnMap, cells, this.options.adapter, { livewire: this.options.livewire ?? null, options: run.options, import: run });
        return this;
    }
    private get outcome(): RowResult { if (!this.result) throw new Error('Call import() before asserting.'); return this.result; }
    /** The saved record (`null` when the row failed or was skipped). */
    getRecord(): any | null { return this.outcome.record; }
    /** Validation errors of the row: messages by column name (`tags.1` for a value of a `multiple()` column). */
    errors(): Record<string, string> { return Object.fromEntries(Object.entries(this.outcome.errors).map(([column, list]) => [column, list.map((error) => error.message).join(' ')])); }
    /** Names of the failed rules, by column name. */
    failedRules(): Record<string, string[]> { return Object.fromEntries(Object.entries(this.outcome.errors).map(([column, list]) => [column, list.map((error) => error.rule)])); }
    /** The row was saved. */
    assertImported(): this {
        const { status, errors, failure } = this.outcome;
        if (status === 'skipped') fail('Failed asserting that the row was imported: it was skipped (resolveRecord() returned null).');
        if (status !== 'imported') fail(`Failed asserting that the row was imported: ${failure ?? Object.values(errors).flat().map((error) => error.message).join(' ')}`);
        return this;
    }
    /** `resolveRecord()` returned `null`: the row was skipped, without errors or failure. */
    assertSkipped(): this {
        const { status, errors, failure } = this.outcome;
        if (status !== 'skipped') fail(`Failed asserting that the row was skipped: it was ${status}${status === 'imported' ? '' : ` (${failure ?? Object.values(errors).flat().map((error) => error.message).join(' ')})`}.`);
        return this;
    }
    /** Validation errors: any (no argument), on some columns (`['price']`), or failing given rules (`{ price: 'min' }`). */
    assertHasErrors(expected: string[] | Record<string, string | string[]> = []): this {
        const errors = this.outcome.errors;
        if (Array.isArray(expected) ? !expected.length : !Object.keys(expected).length) { if (!Object.keys(errors).length) fail('Failed asserting that the row has validation errors.'); return this; }
        for (const [column, rules] of Array.isArray(expected) ? expected.map((column): [string, string[]] => [column, []]) : Object.entries(expected)) {
            const list = errors[column];
            if (!list?.length) fail(`Failed asserting that the column [${column}] has a validation error.`);
            for (const rule of [rules].flat()) if (!list.some((error) => rule === error.rule || rule === error.message)) fail(`Failed asserting that the column [${column}] fails the [${rule}] rule: it failed ${list.map((error) => `[${error.rule}] (${error.message})`).join(', ')}.`);
        }
        return this;
    }
    /** No validation errors, or none on the given columns. */
    assertHasNoErrors(columns: string[] = []): this {
        const failed = Object.keys(this.outcome.errors).filter((column) => !columns.length || columns.includes(column));
        if (failed.length) fail(`Failed asserting that the row has no validation errors: ${failed.map((column) => `[${column}] ${this.outcome.errors[column].map((error) => error.message).join(' ')}`).join(', ')}.`);
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

// ------------------------------------------------------------------ importer
/** Describes an import: its columns, its options form, how a row finds its record, hooks, and the notification. */
export abstract class Importer {
    /** The Objection model of the imported records, for `ImportColumn.relationship()` (the data adapter's model by default). */
    static model: any = null;
    /** Whether the failed rows file is protected against formula injection (see `preventFormulaInjection()`). */
    static formulaInjectionPrevented = true;
    /**
     * Runs rows through this importer without a file (tests): `await ProductImporter.test({ adapter }).import({ sku: 'MUG-1' })`.
     * `columnMap` maps column names to the row's keys (file headers); `options` are the import options.
     */
    static test(options: TestableImportOptions): TestableImport { return new TestableImport(this, options); }
    static getColumns(): ImportColumn[] { return []; }
    /** Components added to the import modal; their values are the import's `options`. */
    static getOptionsFormComponents(): any[] { return []; }
    /**
     * The record a row fills: an existing record to update, a new one to create (an object without a key: `{}`, the
     * default, or one with initial attributes), or `null` to skip the row. Only return records the user may change.
     */
    static async resolveRecord(_data: Record<string, unknown>, _ctx: ImportRowContext): Promise<any | null> { return {}; }
    /** Before the row's data is validated (`ctx.data` may be changed). */
    static async beforeValidate(_ctx: ImportRowContext): Promise<void> {}
    static async afterValidate(_ctx: ImportRowContext): Promise<void> {}
    /** Before the validated data fills the record's attributes. */
    static async beforeFill(_ctx: ImportRowContext): Promise<void> {}
    /** After the attributes are filled (`ctx.values` may be changed). */
    static async afterFill(_ctx: ImportRowContext): Promise<void> {}
    /** Before a record is saved; `data` (the attributes) may be changed. `record` is `null` for a new record. */
    static async beforeSave(_data: Record<string, unknown>, _record: any | null, _ctx: ImportRowContext): Promise<void> {}
    /** Like `beforeSave()`, only when creating a record. */
    static async beforeCreate(_ctx: ImportRowContext): Promise<void> {}
    /** Like `beforeSave()`, only when updating a record. */
    static async beforeUpdate(_ctx: ImportRowContext): Promise<void> {}
    /**
     * Saves the row's record and returns it: creates it with the attributes filled by the columns
     * (`values`), or updates the existing `record` (`ctx.key`). Override it to save another way (an upsert, a service...);
     * relationship columns are saved afterwards on the returned record.
     */
    static async saveRecord(values: Record<string, unknown>, record: any | null, ctx: ImportRowContext & { adapter: { create(data: Record<string, unknown>): Promise<any>; update(key: string, data: Record<string, unknown>): Promise<any> }; key: string | null }): Promise<any> {
        // An update without any attribute to write (only relationships, or every cell blank and ignored) keeps the record as is.
        if (ctx.key === null) return ctx.adapter.create(values);
        return Object.keys(values).length ? ctx.adapter.update(ctx.key, values) : record;
    }
    static async afterSave(_record: any, _ctx: ImportRowContext): Promise<void> {}
    /** Queue name handed to the background runner (`useBackgroundRunner()`) with each queued import of this importer. */
    static getJobQueue(): string | null { return null; }
    /** Connection name handed to the background runner with each queued import of this importer. */
    static getJobConnection(): string | null { return null; }
    static async afterCreate(_ctx: ImportRowContext): Promise<void> {}
    static async afterUpdate(_ctx: ImportRowContext): Promise<void> {}
    /** Custom validation messages: `{ 'name.required': 'The name column must not be empty.' }` (`:attribute` is replaced). */
    static getValidationMessages(): Record<string, string> { return {}; }
    static getCompletedNotificationTitle(_run: ImportRun): string { return t('navette-actions::import.notifications.completed.title'); }
    static getCompletedNotificationBody(imported: number, failed: number, _run?: ImportRun): string {
        return `Your import has completed and ${imported.toLocaleString('en-US')} ${imported === 1 ? 'row' : 'rows'} imported.${failed ? ` ${failed.toLocaleString('en-US')} ${failed === 1 ? 'row' : 'rows'} failed to import.` : ''}`;
    }
    /** Changes the completion notification (icon, actions…), or returns another one. */
    static modifyCompletedNotification(notification: Notification, _run: ImportRun): Notification { return notification; }
    /** How the failed rows file is sent (see `Downloader`). */
    static getFailedRowsDownloader(): Downloader { return sendDownload; }
    /**
     * Prefixes the cells of the failed rows file starting with `=`, `+`, `-`, `@`, a tab or a carriage return (numbers aside)
     * with `'`, so that spreadsheet software does not run them as formulas. On by default;
     * `Importer.preventFormulaInjection(false)` turns it off for every importer, `ProductImporter.preventFormulaInjection(false)` for one.
     */
    static preventFormulaInjection(condition = true): void { this.formulaInjectionPrevented = condition; }
    static shouldPreventFormulaInjection(): boolean { return this.formulaInjectionPrevented; }
}

// ------------------------------------------------------------------ reading files
/** Reading options of a CSV file. `encoding`: a label of `TextDecoder` (`windows-1252`, `shift_jis`…), `null` to detect it. */
export type SpreadsheetReadOptions = { delimiter?: string | null; encoding?: string | null; headerOffset?: number | null };
const ENCODING_ALIASES: Record<string, string> = { 'sjis-win': 'shift_jis', sjis: 'shift_jis', 'cp1252': 'windows-1252', 'cp1251': 'windows-1251' };
/** Text of a CSV file: the given encoding, else UTF-8 when the bytes are valid UTF-8, else Windows-1252. */
export function decodeCsv(buffer: Buffer, encoding: string | null = null): string {
    if (encoding) {
        const label = ENCODING_ALIASES[encoding.toLowerCase()] ?? encoding;
        return new TextDecoder(label).decode(buffer).replace(/^﻿/, '');
    }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, ''); } catch { return new TextDecoder('windows-1252').decode(buffer); }
}
/** The delimiter used by most lines among `,`, `;`, `|` and tab (the first lines are compared). */
export function guessCsvDelimiter(text: string): string {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '').slice(0, 10);
    let best = ',', bestCount = 0;
    for (const delimiter of [',', ';', '|', '\t']) {
        const count = lines.reduce((total, line) => total + (parseCsv(line, 1, delimiter)[0]?.length ?? 1) - 1, 0);
        if (count > bestCount) { best = delimiter; bestCount = count; }
    }
    return best;
}
/** Rows of an uploaded CSV or XLSX file (detected from its content, never its name), up to `limit` rows after the header offset. */
export function readSpreadsheet(path: string, limit: number, options: SpreadsheetReadOptions = {}): string[][] {
    const buffer = readFileSync(path);
    const offset = Math.max(0, Math.floor(options.headerOffset ?? 0));
    if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) return readXlsx(buffer, limit + offset).slice(offset);
    const text = decodeCsv(buffer, options.encoding ?? null);
    const delimiter = options.delimiter ?? guessCsvDelimiter(text);
    if ([...delimiter].length !== 1) throw new Error('The CSV delimiter must be a single character.');
    return parseCsv(text, limit + offset, delimiter).slice(offset);
}
/** Path of the temporary file uploaded in a FileUpload state, if any. */
function temporaryUploadOf(livewire: any, state: unknown): TemporaryUpload | null {
    // A saved entry (`{ file: TemporaryUpload }`), a list of them, or the raw state of the field (upload references).
    if (state && typeof state === 'object' && typeof (state as any).file?.path === 'string') return (state as any).file;
    const values = Array.isArray(state) ? state : state && typeof state === 'object' ? Object.values(state as Record<string, unknown>) : [state];
    for (const value of values) {
        const file = (value && typeof value === 'object' && (value as any).file?.path) ? (value as any).file : livewire?._runtime?.uploads?.resolve?.(value);
        if (typeof file?.path === 'string') return file;
    }
    return null;
}

// ------------------------------------------------------------------ fake
/** An import requested by the action (`ImportAction.fake()`). */
export type DispatchedImport = { import: ImportRun; columnMap: Record<string, string | null>; options: Record<string, unknown> };
let importFake: ImportFake | null = null;
/**
 * Records the imports requested by import actions instead of processing their rows (`ImportAction.fake()`). The action still
 * reads the file, validates the form and records the run in the history; rows, hooks and notifications are not processed.
 */
export class ImportFake {
    readonly imports: DispatchedImport[] = [];
    record(dispatched: DispatchedImport): void { this.imports.push(dispatched); }
    private of(importer: typeof Importer | string): DispatchedImport[] { const name = typeof importer === 'string' ? importer : importer.name; return this.imports.filter((entry) => entry.import.importer === name); }
    /** At least one import of this importer was requested (matching the callback, if given). */
    assertDispatched(importer: typeof Importer | string, callback: ((run: ImportRun, columnMap: Record<string, string | null>, options: Record<string, unknown>) => boolean) | null = null): this {
        const name = typeof importer === 'string' ? importer : importer.name;
        if (!this.of(importer).some((entry) => !callback || callback(entry.import, entry.columnMap, entry.options))) fail(`The expected [${name}] import was not dispatched${callback ? ' with matching data.' : '.'}`);
        return this;
    }
    assertDispatchedTimes(importer: typeof Importer | string, count = 1): this {
        const name = typeof importer === 'string' ? importer : importer.name;
        const actual = this.of(importer).length;
        if (actual !== count) fail(`Expected [${name}] to be dispatched ${count} time(s): it was dispatched ${actual} time(s).`);
        return this;
    }
    assertNotDispatched(importer: typeof Importer | string, callback: ((run: ImportRun, columnMap: Record<string, string | null>, options: Record<string, unknown>) => boolean) | null = null): this {
        const name = typeof importer === 'string' ? importer : importer.name;
        if (this.of(importer).some((entry) => !callback || callback(entry.import, entry.columnMap, entry.options))) fail(`The unexpected [${name}] import was dispatched${callback ? ' with matching data.' : '.'}`);
        return this;
    }
    assertNothingDispatched(): this { if (this.imports.length) fail('Imports were dispatched.'); return this; }
    /** Stops faking: import actions process their rows again. */
    restore(): void { if (importFake === this) importFake = null; }
}

// ------------------------------------------------------------------ action
type ActionLazy<T> = T | ((ctx: { livewire: any; action: ImportActionInstance }) => T);
/** A rule of the uploaded file: a Laravel-style string (`'max:1024'` in kilobytes, `'extensions:csv,txt'`), a rule object, or `(file) => message | null`. */
export type ImportFileRule = string | Rule | ((file: TemporaryUpload) => string | null | undefined);
export type ImportActionInstance = Action & {
    importer(importer: typeof Importer): ImportActionInstance;
    getImporter(): typeof Importer;
    /** Refuses files with more rows (1,000 by default, 10,000 at most; 100,000 for a queued import). */
    maxRows(count: ActionLazy<number>): ImportActionInstance;
    /** Largest accepted file, in kilobytes (5,120 by default). */
    maxFileSize(kilobytes: number): ImportActionInstance;
    /** `false`: no column selection after the upload; file headers are matched to the columns automatically. */
    columnMapping(condition: boolean): ImportActionInstance;
    /** Runs after the response, in the background: the user is told it started, then notified in the bell when it ends. */
    queued(condition?: boolean): ImportActionInstance;
    /** Rows processed at a time (100 by default); the process yields to other requests between chunks. */
    chunkSize(size: ActionLazy<number>): ImportActionInstance;
    /** Delimiter of CSV files (one character); guessed among `,`, `;`, `|` and tab by default. */
    csvDelimiter(delimiter: ActionLazy<string | null>): ImportActionInstance;
    /** Encoding of CSV files (`windows-1252`, `shift_jis`…; `TextDecoder` labels); `null` detects UTF-8, else Windows-1252. */
    csvEncoding(encoding: ActionLazy<string | null>): ImportActionInstance;
    /** Rows before the header row (0 by default). */
    headerOffset(offset: ActionLazy<number | null>): ImportActionInstance;
    /** Static options merged with the values of the importer's options form. */
    options(options: ActionLazy<Record<string, unknown>>): ImportActionInstance;
    /** More rules for the uploaded file (added to its type and size checks). */
    fileRules(rules: ActionLazy<ImportFileRule | ImportFileRule[]>): ImportActionInstance;
};
const DEFAULT_MAX_IMPORT_ROWS = 1000, HARD_MAX_IMPORT_ROWS = 10000, HARD_MAX_QUEUED_IMPORT_ROWS = 100000;
const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();

/** A file rule as a rule of the upload field (checked against the temporary file of the request). */
export function importFileRule(rule: ImportFileRule, livewire: () => any): Rule {
    const fileOf = (state: unknown) => temporaryUploadOf(livewire(), state);
    if (typeof rule === 'function') {
        let message = '';
        return { name: 'file_rule', passes: (state) => { const file = fileOf(state); if (!file) return true; message = rule(file) ?? ''; return !message; }, message: () => message };
    }
    if (typeof rule !== 'string') return rule;
    const [name, parameter = ''] = rule.split(':');
    const list = parameter.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    switch (name) {
        case 'max': return { name, passes: (state) => (fileOf(state)?.size ?? 0) <= Number(parameter) * 1024, message: (a) => `The ${a} field must not be greater than ${parameter} kilobytes.` };
        case 'min': return { name, passes: (state) => { const file = fileOf(state); return !file || file.size >= Number(parameter) * 1024; }, message: (a) => `The ${a} field must be at least ${parameter} kilobytes.` };
        case 'extensions': return { name, passes: (state) => { const file = fileOf(state); return !file || list.includes(String(file.name.split('.').pop() ?? '').toLowerCase()); }, message: (a) => `The ${a} field must have one of the following extensions: ${list.join(', ')}.` };
        case 'mimes': return { name, passes: (state) => { const file = fileOf(state); return !file || list.includes(String(file.extension).toLowerCase()); }, message: (a) => `The ${a} field must be a file of type: ${list.join(', ')}.` };
        case 'mimetypes': return { name, passes: (state) => { const file = fileOf(state); return !file || list.includes(String(file.type).toLowerCase()); }, message: (a) => `The ${a} field must be a file of type: ${list.join(', ')}.` };
        default: throw new Error(`ImportAction.fileRules(): unsupported file rule "${rule}" (max, min, extensions, mimes, mimetypes, a rule object or a function).`);
    }
}

/** Imports the rows of a CSV or XLSX file: each row is validated, then creates or updates a record through the data adapter. */
export class ImportAction {
    /** Records the imports requested by import actions instead of processing them (tests); `restore()` stops it. */
    static fake(): ImportFake { importFake?.restore(); importFake = new ImportFake(); return importFake; }
    /** Name of `ImportAction.make()` without a name. */
    static getDefaultName(): string { return 'import'; }
    private static configurators: ((action: ImportActionInstance) => void)[] = [];
    /** Default setup of every import action created afterwards by `make()`: `ImportAction.configureUsing((action) => action.chunkSize(500))`. */
    static configureUsing(configure: (action: ImportActionInstance) => void): void { this.configurators.push(configure); }
    /** Forgets the `configureUsing()` callbacks (tests). */
    static resetConfiguration(): void { this.configurators = []; }
    static make(name: string | null = null): ImportActionInstance {
        name ??= this.getDefaultName();
        let importer: typeof Importer | null = null, maxRows: ActionLazy<number> = DEFAULT_MAX_IMPORT_ROWS, maxKilobytes = 5120, mapping = true, queued = false;
        let chunkSize: ActionLazy<number> = 100, delimiter: ActionLazy<string | null> = null, encoding: ActionLazy<string | null> = null, headerOffset: ActionLazy<number | null> = null;
        let staticOptions: ActionLazy<Record<string, unknown>> = {};
        const fileRules: ActionLazy<ImportFileRule | ImportFileRule[]>[] = [];
        const importerOf = () => { if (!importer) throw new Error('ImportAction: call importer() with an Importer class.'); return importer; };
        const columnsOf = () => importerOf().getColumns();
        const lazy = <T>(value: ActionLazy<T>, livewire: any): T => (typeof value === 'function' ? (value as (ctx: { livewire: any; action: ImportActionInstance }) => T)({ livewire, action }) : value);
        const readOptions = (livewire: any): SpreadsheetReadOptions => {
            const csvDelimiter = lazy(delimiter, livewire);
            if (csvDelimiter !== null && [...csvDelimiter].length !== 1) throw new Error('ImportAction.csvDelimiter(): the delimiter must be a single character.');
            return { delimiter: csvDelimiter, encoding: lazy(encoding, livewire), headerOffset: lazy(headerOffset, livewire) };
        };
        /** Headers of the uploaded file (trimmed, as written: duplicates kept). */
        const rawHeadersOf = (livewire: any, state: unknown): string[] | null => {
            const file = temporaryUploadOf(livewire, state);
            if (!file) return null;
            try { return (readSpreadsheet(file.path, 1, readOptions(livewire))[0] ?? []).map((cell) => cell.trim()); } catch { return null; }
        };
        const headersOf = (livewire: any, state: unknown): string[] => (rawHeadersOf(livewire, state) ?? []).filter((cell, index, all) => cell !== '' && all.indexOf(cell) === index);
        const example = Action.make('downloadExample').label(t('navette-actions::import.modal.actions.download_example.label')).color('gray').link()
            .action(async ({ livewire }) => {
                const columns = columnsOf();
                const csvDelimiter = lazy(delimiter, livewire) ?? ',';
                const examples = columns.map((column) => column.getExamples());
                const count = Math.max(0, ...examples.map((list) => list.length));
                const lines = [columns.map((column) => column.getExampleHeader()), ...Array.from({ length: count }, (_unused, index) => examples.map((list) => list[index] ?? ''))];
                const csv = `﻿${lines.map((line) => csvLine(line, csvDelimiter)).join('\r\n')}\r\n`;
                const panel = livewire._ctx?.panel;
                const fileName = `${t('navette-actions::import.example_csv.file_name', { importer: kebab(importerOf().name) })}.csv`;
                livewire.redirect(panel.getDownloadUrl(await panel.getDownloads().put(livewire._ctx.user.id, fileName, 'text/csv; charset=utf-8', csv)));
            });
        const action = Action.make(name).color('gray').icon(icons.resolve('actions::import-action.grouped') ?? 'm-arrow-up-tray')
            // Importing creates or updates records: the resource's `create` ability applies.
            .authorize(async ({ livewire }) => (typeof livewire?.resource?.can === 'function' ? livewire.resource.can('create', livewire._ctx?.user ?? null) : true))
            .label(({ livewire }) => t('navette-actions::import.label', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
            .modalHeading(({ livewire }) => t('navette-actions::import.modal.heading', { label: livewire?.resource?.getPluralModelLabel?.() ?? '' }).trim())
            .modalSubmitActionLabel(t('navette-actions::import.modal.actions.import.label'))
            .modalWidth('md')
            .schema((schema: any) => {
                const livewire = schema.livewire;
                const columns = columnsOf();
                // The columns of the uploaded file, to map them to the importer's columns.
                const mounted = livewire?.mountedActions?.find?.((candidate: any) => candidate.name === name);
                const headers = mapping ? headersOf(livewire, mounted?.data?.file) : [];
                const file = FileUpload.make('file').label(t('navette-actions::import.modal.form.file.label')).placeholder(t('navette-actions::import.modal.form.file.placeholder'))
                    .acceptedFileTypes(['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv', '.xlsx']).maxSize(maxKilobytes).storeFiles(false).required();
                // Duplicate headers would make the mapping ambiguous: the file is refused.
                let duplicates: string[] = [];
                file.rule({
                    name: 'duplicate_columns',
                    passes: (state) => { const found = rawHeadersOf(livewire, state) ?? []; duplicates = found.filter((header, index) => found.indexOf(header) !== index).filter((header, index, all) => all.indexOf(header) === index); return duplicates.length === 0; },
                    message: () => { const filled = duplicates.filter((header) => header !== ''); return tc('navette-actions::import.modal.form.file.rules.duplicate_columns', filled.length, { columns: filled.join(', ') }); },
                });
                for (const rules of fileRules) for (const rule of [lazy(rules, livewire)].flat()) file.rule(importFileRule(rule, () => livewire));
                if (mapping) file.live().afterStateUpdated(({ state, set }) => {
                    const found = headersOf(livewire, state);
                    const lower = found.map((header) => header.toLowerCase());
                    // The first header of the file that the column matches.
                    set('columnMap', Object.fromEntries(columns.map((column) => { const guesses = column.getGuesses(); const index = lower.findIndex((header) => guesses.includes(header)); return [column.name, index >= 0 ? found[index] : null]; })));
                });
                return schema.components([
                    file,
                    ...(mapping && headers.length ? [Fieldset.make(t('navette-actions::import.modal.form.columns.label')).statePath('columnMap').columns(1).schema(columns.map((column) => column.getSelect(headers)))] : []),
                    ...importerOf().getOptionsFormComponents(),
                ]);
            })
            .extraModalFooterActions([example])
            .action(async ({ livewire, data }) => {
                const upload = temporaryUploadOf(livewire, data.file);
                // Only a temporary upload of this request is read, never a path sent by the browser.
                if (!upload || typeof upload.path !== 'string' || statSync(upload.path).size > maxKilobytes * 1024) return;
                const panel = livewire._ctx?.panel, user = livewire._ctx?.user;
                const background = queued && canQueue(panel);
                const limit = Math.min(lazy(maxRows, livewire), background ? HARD_MAX_QUEUED_IMPORT_ROWS : HARD_MAX_IMPORT_ROWS);
                let rows: string[][];
                try { rows = readSpreadsheet(upload.path, limit + 1, readOptions(livewire)); } catch {
                    Notification.make().danger().title(t('navette-actions::import.notifications.completed.title')).body('The file could not be read: upload a CSV or XLSX file.').send();
                    return;
                }
                const header = (rows.shift() ?? []).map((cell) => cell.trim());
                if (rows.length > limit) { Notification.make().danger().title(t('navette-actions::import.notifications.max_rows.title')).body(tc('navette-actions::import.notifications.max_rows.body', limit, { count: limit.toLocaleString('en-US') })).send(); return; }
                const currentImporter = importerOf();
                const columns = columnsOf();
                // Chosen columns: only headers of the file are accepted, whatever the browser sends; else automatic matching.
                const chosen = (data.columnMap && typeof data.columnMap === 'object' ? data.columnMap : {}) as Record<string, unknown>;
                const columnMap: Record<string, string | null> = Object.fromEntries(columns.map((column) => {
                    if (mapping && Object.hasOwn(chosen, column.name)) return [column.name, typeof chosen[column.name] === 'string' && header.includes(chosen[column.name] as string) ? chosen[column.name] as string : null];
                    return [column.name, header.find((cell) => column.matches(cell)) ?? null];
                }));
                const missing = columns.filter((column) => column.isMappingRequired() && columnMap[column.name] === null);
                if (missing.length) {
                    Notification.make().danger().title(t('navette-actions::import.notifications.completed.title'))
                        .body(missing.map((column) => t('navette-actions::import.failure_csv.column_mapping_required_for_new_record', { attribute: column.getLabel() })).join(' ')).send();
                    return;
                }
                // The options: the action's, then the values of the options form (declared components only).
                const options: Record<string, unknown> = { ...lazy(staticOptions, livewire), ...Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'file' && key !== 'columnMap')) };
                const adapter = livewire.getDataAdapterForTable();
                const history: ImportExportHistory | null = panel?.getImportExportHistory?.() ?? null;
                const fileName = String(upload.name ?? 'import');
                const run: ImportRun = { id: null, userId: user?.id ?? null, userType: panel?.getId?.() ?? null, importer: currentImporter.name, fileName, totalRows: rows.length, processedRows: 0, successfulRows: 0, columnMap, options };
                if (history) run.id = await history.startImport({ userId: user.id, userType: run.userType ?? null, importer: currentImporter.name, fileName, totalRows: rows.length });
                if (importFake) { importFake.record({ import: run, columnMap, options }); return; }
                const size = Math.max(1, Math.floor(lazy(chunkSize, livewire)));
                const sensitiveHeaders = new Set(columns.filter((column) => column.isSensitive()).map((column) => columnMap[column.name]).filter((header): header is string => header !== null));
                const process = async () => {
                    const failures: string[][] = [];
                    for (let start = 0; start < rows.length; start += size) {
                        if (start > 0) await new Promise((resolve) => setImmediate(resolve));
                        for (const cells of rows.slice(start, start + size)) {
                            const row: Record<string, string | null> = {};
                            // Headers come from the file: defined as own properties, so that a `__proto__` header is only a key.
                            header.forEach((cell, index) => { if (cell !== '' && !Object.hasOwn(row, cell)) Object.defineProperty(row, cell, { value: cells[index] ?? null, enumerable: true, writable: true, configurable: true }); });
                            // Sensitive values are left out of the failed rows file and of the history.
                            const logged = () => header.map((cell, index) => (sensitiveHeaders.has(cell) ? '' : cells[index] ?? ''));
                            const failRow = async (message: string) => {
                                failures.push([...logged(), message]);
                                if (history && run.id !== null) await history.recordFailedImportRow(run.id, Object.fromEntries(Object.entries(row).filter(([cell]) => !sensitiveHeaders.has(cell))), message);
                            };
                            let result: RowResult;
                            try { result = await importRow(currentImporter, columns, columnMap, row, adapter, { livewire, options, import: run }); } catch (failure) {
                                console.error(failure);
                                await failRow(t('navette-actions::import.failure_csv.system_error'));
                                run.processedRows++;
                                continue;
                            }
                            run.processedRows++;
                            const error = rowError(result);
                            if (error) { await failRow(error); continue; }
                            // A skipped row counts as successful.
                            run.successfulRows++;
                        }
                    }
                    if (history && run.id !== null) await history.finishImport(run.id, { processedRows: run.processedRows, successfulRows: run.successfulRows });
                    let notification = Notification.make().title(currentImporter.getCompletedNotificationTitle(run)).body(currentImporter.getCompletedNotificationBody(run.successfulRows, failures.length, run)).persistent();
                    if (failures.length) {
                        const protect = currentImporter.shouldPreventFormulaInjection();
                        const csv = `﻿${[csvLine([...header, t('navette-actions::import.failure_csv.error_header')], ',', protect), ...failures.map((cells) => csvLine(cells, ',', protect))].join('\r\n')}\r\n`;
                        const downloader = currentImporter.getFailedRowsDownloader();
                        let downloaderName: string | null = null;
                        if (downloader !== sendDownload) { downloaderName = `import-failures:${currentImporter.name}`; registerDownloader(downloaderName, downloader); }
                        const failedName = `${t('navette-actions::import.failure_csv.file_name', { import_id: String(run.id ?? 'new'), csv_name: fileName.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) })}.csv`;
                        const token = await panel.getDownloads().put(user.id, failedName, 'text/csv; charset=utf-8', csv, { downloader: downloaderName });
                        notification.actions([{ label: tc('navette-actions::import.notifications.completed.actions.download_failed_rows_csv.label', failures.length), url: panel.getDownloadUrl(token) }]);
                    }
                    notification = run.successfulRows ? (failures.length ? notification.warning() : notification.success()) : notification.danger();
                    await deliver(currentImporter.modifyCompletedNotification(notification, run), background, panel, user);
                };
                if (!background) { await process(); return; }
                Notification.make().success().title(t('navette-actions::import.notifications.started.title')).body(tc('navette-actions::import.notifications.started.body', rows.length, { count: rows.length.toLocaleString('en-US') })).send();
                runInBackground(process, { type: 'import', exporter: null, importer: currentImporter, run, queue: currentImporter.getJobQueue(), connection: currentImporter.getJobConnection(), panel: panel?.getId?.() ?? null, userId: user?.id ?? null });
            }) as ImportActionInstance;
        action.importer = (value) => { importer = value; return action; };
        action.getImporter = () => importerOf();
        action.maxRows = (count) => { maxRows = typeof count === 'function' ? count : Math.max(1, Math.floor(count)); return action; };
        action.maxFileSize = (kilobytes) => { maxKilobytes = Math.max(1, Math.floor(kilobytes)); return action; };
        action.columnMapping = (condition) => { mapping = condition; return action; };
        action.queued = (condition = true) => { queued = condition; return action; };
        action.chunkSize = (size) => { chunkSize = size; return action; };
        action.csvDelimiter = (value) => { if (typeof value === 'string' && [...value].length !== 1) throw new Error('ImportAction.csvDelimiter(): the delimiter must be a single character.'); delimiter = value; return action; };
        action.csvEncoding = (value) => { encoding = value; return action; };
        action.headerOffset = (value) => { headerOffset = value; return action; };
        action.options = (value) => { staticOptions = value; return action; };
        action.fileRules = (rules) => {
            const list = typeof rules === 'string' ? rules.split('|').filter(Boolean) : [rules];
            // Static string rules are checked at once: an unsupported rule fails when the action is declared.
            for (const rule of list) for (const item of typeof rule === 'function' && !Array.isArray(rule) ? [] : [rule].flat()) if (typeof item === 'string') importFileRule(item, () => null);
            fileRules.push(...list);
            return action;
        };
        for (const configure of this.configurators) configure(action);
        return action;
    }
}
