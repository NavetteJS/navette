// @navette-js/database — data access contract and its Knex + Objection adapter.
import { AsyncLocalStorage } from 'node:async_hooks';
import knexFactory, { type Knex } from 'knex';
import { Model, type ModelClass, type QueryBuilder } from 'objection';
import type { RelationshipAggregate } from '@navette-js/support';
import { applyEagerLoading, applyRelationshipAggregates, castRelationshipAggregates, jsonColumnExpression, orderByColumn, relatedRecordsOf, resolveRelationshipColumn, whereRelationshipExists } from './relationships.ts';
import { applyCursorCondition, cursorOrdersOf, decodeCursor, encodeCursor, searchWords } from './cursor.ts';

export { Model };
export * from './relationships.ts';
export { decodeCursor, encodeCursor, searchWords } from './cursor.ts';
export type { Cursor, CursorOrder } from './cursor.ts';
export type { Knex };

export type SortDirection = 'asc' | 'desc';
export type ListQuery = {
    /** Global search: every word must appear in at least one of the searchable columns. */
    search?: string | null;
    searchColumns?: string[];
    /** `false`: the search term is matched as a whole, instead of word by word. */
    splitSearchTerms?: boolean;
    /** Replaces the global search: receives the query and the whole search term (`Table.searchUsing()`). */
    searchUsing?: ((query: any, search: string) => void) | null;
    /** More global search conditions, OR-ed with `searchColumns` for each word (custom column search queries). */
    searchConstraints?: ((query: any, search: string) => void)[];
    /** Per-column search: all conditions must match. */
    columnSearches?: Record<string, string>;
    /**
     * How each per-column search applies: the database columns it looks in (the key itself by default), whether the term is
     * split into words (default), or a custom query replacing the column match.
     */
    columnSearchOptions?: Record<string, { columns?: string[]; split?: boolean; query?: ((query: any, search: string) => void) | null }>;
    /** Soft-deleted records: excluded by default, included, or only those. */
    trashed?: 'without' | 'with' | 'only';
    /** Sort: by `column` (or by every one of `columns`), or by `modify` (a custom order). */
    sort?: TableSort | null;
    /** Further sorts after `sort` (a table's default sort, applied after the user's). */
    thenSort?: TableSort[];
    /** `false`: no final sort by the primary key. */
    keySort?: boolean;
    /** Table grouping: this sort is applied before `sort`. */
    /** Rows are first ordered by their group: by `column`, or by `modify` (a custom order). */
    groupSort?: { column: string; direction: SortDirection; modify?: (query: any, direction: SortDirection) => void } | null;
    /** Only these records (keys), e.g. the rows of the displayed page. */
    keys?: string[];
    /** Extra server-side conditions (list tab, custom filter); never built from unvalidated browser input. */
    modifiers?: ((query: any) => void)[];
    /**
     * Related records to load with each record, as dot-notation paths (`author`, `author.country`, `comments`): the relationships of
     * dot-notation columns (`author.name`). Segments that are not relationships are ignored (JSON attributes). Optional for adapters:
     * one that does not support relationships may ignore it (columns then read nested objects of the records, if any).
     */
    with?: string[];
    /**
     * Relationship aggregates to select on each record under their alias (`posts_count`), from `counts()`, `exists()`, `avg()`,
     * `sum()`, `min()` and `max()`. Only adapters whose `supportsRelationships()` returns true receive them.
     */
    aggregates?: RelationshipAggregate[];
    page: number;
    perPage: number;
};
/** Aggregates of one group of records (`DataAdapter.aggregateGroups()`). */
export type AggregateGroup = { key: unknown; count: number; sum: Record<string, number>; avg: Record<string, number>; min: Record<string, unknown>; max: Record<string, unknown> };
export type TableSort = { column: string; direction: SortDirection; columns?: string[]; modify?: ((query: any, direction: SortDirection) => void) | null };
export type Page<T> = {
    records: T[]; total: number; page: number; perPage: number; lastPage: number; from: number | null; to: number | null;
    /** Cursor pagination (`cursorPaginate()`): the cursors of the previous and next pages, `null` when there is none. */
    cursor?: { previous: string | null; next: string | null };
};

/** What the framework needs to list, read and write records, independently of the ORM. */
export interface DataAdapter<T = any> {
    getKey(record: T): string;
    /** Filters keys received from the browser: only those within the adapter's scope are returned. */
    keysInScope(keys: (string | number)[]): Promise<string[]>;
    sum(query: Omit<ListQuery, 'page' | 'perPage'>, columns: string[]): Promise<Record<string, number>>;
    /** Aggregates over the records of a list query: count, and column sums, averages, minimums and maximums. */
    aggregate(query: Omit<ListQuery, 'page' | 'perPage'>, columns?: { sum?: string[]; avg?: string[]; min?: string[]; max?: string[] }): Promise<{ count: number; sum: Record<string, number>; avg: Record<string, number>; min: Record<string, unknown>; max: Record<string, unknown> }>;
    /**
     * Same aggregates, one row per group of a grouped query: `group` receives the aggregate query (selecting from the list
     * query, aliased with the table name) and must group it, e.g. `(query) => query.groupBy('status')`. Each row has the value
     * of the first grouping expression as `key`. Optional: without it, groups are aggregated one query at a time.
     */
    aggregateGroups?(query: Omit<ListQuery, 'page' | 'perPage'>, columns: { sum?: string[]; avg?: string[]; min?: string[]; max?: string[] }, group: (query: any) => void): Promise<AggregateGroup[]>;
    getLabel(): string;
    count(): Promise<number>;
    paginate(query: ListQuery): Promise<Page<T>>;
    /**
     * Cursor pagination (Filament's `paginationMode('cursor')`): the `perPage` records after (or before) `cursor`, without
     * counting the records; `page.cursor` holds the cursors of the previous and next pages. Optional.
     */
    cursorPaginate?(query: Omit<ListQuery, 'page'> & { cursor: string | null }): Promise<Page<T>>;
    find(key: string | number): Promise<T | null>;
    /** Like `find()`, soft-deleted records included (tables that show deleted records). Optional. */
    findWithTrashed?(key: string | number): Promise<T | null>;
    create(data: Record<string, unknown>): Promise<T>;
    update(key: string | number, data: Record<string, unknown>): Promise<T | null>;
    delete(key: string | number): Promise<boolean>;
    /** Soft deletes: support, record state, restore, permanent delete. */
    supportsSoftDeletes(): boolean;
    isTrashed(record: T): boolean;
    restore(key: string | number): Promise<boolean>;
    forceDelete(key: string | number): Promise<boolean>;
    /** Keys of every record matching the query (unpaginated), for "select all". */
    listKeys(query: Omit<ListQuery, 'page' | 'perPage'>): Promise<string[]>;
    deleteMany(keys: (string | number)[]): Promise<number>;
    /** True if another record already has this value (`unique` rule). */
    exists(column: string, value: unknown, exceptKey?: string | number | null): Promise<boolean>;
    /** Runs `fn` in a database transaction (`panel.databaseTransactions()`); without it, `fn` runs as is. */
    transaction?<T>(fn: () => Promise<T>): Promise<T>;
    /** A copy limited to the records whose `column` equals `value` (nested resources); optional. */
    scopedTo?(column: string, value: string | number): DataAdapter<T>;
    /**
     * True when the adapter handles relationships: `with` and `aggregates` of list queries, and dot-notation (`author.name`) search,
     * sort and column search through relationships. Optional: without it, columns that aggregate relationships throw a clear error.
     */
    supportsRelationships?(): boolean;
}

/** Throws when a list query needs relationship support (aggregates) that the adapter does not declare (`supportsRelationships()`). */
export function assertRelationshipSupport(adapter: { getLabel?(): string; supportsRelationships?(): boolean }, query: { aggregates?: RelationshipAggregate[] }): void {
    if (!query.aggregates?.length || (typeof adapter.supportsRelationships === 'function' && adapter.supportsRelationships())) return;
    const aggregate = query.aggregates[0];
    let label = 'custom';
    try { label = adapter.getLabel?.() ?? label; } catch { /* label unavailable */ }
    throw new Error(`The "${aggregate.alias}" column aggregates the "${aggregate.relationship}" relationship (${aggregate.function === 'count' ? 'counts' : aggregate.function}()), but the data adapter of "${label}" does not support relationships. Use ObjectionAdapter, or implement supportsRelationships() and ListQuery.aggregates in your adapter.`);
}

/** Transactions open in the current async context, by connection. */
const openTransactions = new AsyncLocalStorage<Map<Knex, Knex.Transaction>>();
const RAW = Symbol('navette.rawKnex');
const rawOf = (knex: Knex): Knex => ((knex as any)[RAW] as Knex | undefined) ?? knex;

/** The transaction open on this connection in the current async context (`transaction()`), or `null`. */
export function currentTransaction(knex: Knex = Model.knex()): Knex.Transaction | null {
    return openTransactions.getStore()?.get(rawOf(knex)) ?? null;
}

/**
 * Runs `fn` in a database transaction: committed when it resolves, rolled back when it throws. Every query made in the
 * meantime through the connection (`createConnection()`, `sqlite()`: Objection models and `knex(table)` alike) joins it.
 * Called inside an open transaction, `fn` simply joins it.
 */
export async function transaction<T>(knex: Knex | (() => Promise<T>), fn?: () => Promise<T>): Promise<T> {
    if (typeof fn !== 'function') { fn = knex as () => Promise<T>; knex = Model.knex(); }
    const raw = rawOf(knex as Knex);
    const open = openTransactions.getStore();
    if (open?.has(raw)) return fn();
    return raw.transaction((trx) => openTransactions.run(new Map(open ?? []).set(raw, trx), fn!));
}

/** The connection, routed to the transaction open in the current async context (`transaction()`), if any. */
function transactionAware(knex: Knex): Knex {
    const target = () => openTransactions.getStore()?.get(knex) ?? knex;
    return new Proxy(knex, {
        apply: (_target, thisArg, args) => Reflect.apply(target() as any, thisArg, args),
        get: (_target, property) => {
            if (property === RAW) return knex;
            const current = target();
            const value = Reflect.get(current, property);
            return typeof value === 'function' && current !== knex && property !== 'constructor' ? value.bind(current) : value;
        },
    }) as Knex;
}

export function createConnection(config: Knex.Config): Knex {
    const knex = transactionAware(knexFactory(config));
    Model.knex(knex);
    return knex;
}
/** SQLite connection (better-sqlite3 driver), for development and demos. */
export function sqlite(filename: string): Knex {
    return createConnection({ client: 'better-sqlite3', connection: { filename }, useNullAsDefault: true });
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);
/** Case-insensitive LIKE on a bound column identifier; LIKE wildcards of the searched value are escaped. */
const LIKE = "lower(??) like ? escape '\\'";

export class ObjectionAdapter<M extends Model> implements DataAdapter<M> {
    private model: ModelClass<M>;
    private modify: ((query: QueryBuilder<M, M[]>) => void) | null;
    private softDeletes: string | null;
    private findsTrashed: boolean;
    /**
     * `modify`: base query constraints applied to every read. `softDeletes`: deletion timestamp column.
     * `findsTrashed`: `find()` also returns soft-deleted records.
     */
    constructor(model: ModelClass<M>, options: { modify?: (query: QueryBuilder<M, M[]>) => void; softDeletes?: string; findsTrashed?: boolean } = {}) {
        this.model = model; this.modify = options.modify ?? null; this.softDeletes = options.softDeletes ?? null; this.findsTrashed = options.findsTrashed === true;
    }

    private tenantScope: { column: string; key: () => string | number | null } | null = null;
    /**
     * Scopes the adapter to a tenant: every read filters on `column` and every create fills it, with the key returned by `key()`
     * (the request's tenant; `null` means no filter). Set by the panel (`panel.tenant()`).
     */
    scopeToTenant(column: string, key: () => string | number | null): this { this.tenantScope = { column, key }; return this; }
    private columnScopes: { column: string; value: string | number }[] = [];
    /**
     * A copy of this adapter limited to the records whose `column` equals `value` (the tasks of one project): every read filters on
     * it, `create()` fills it, `update()` never changes it, and updates or deletions of a record outside the scope do nothing.
     * Nested resources use it to scope their records to the parent record (`Resource.scopeAdapterToParent()`).
     */
    scopedTo(column: string, value: string | number): this {
        const copy = Object.create(Object.getPrototypeOf(this)) as this;
        Object.assign(copy, this);
        copy.columnScopes = [...this.columnScopes, { column, value }];
        return copy;
    }
    /** Whether a record is outside the column scopes (`scopedTo()`): writes to it are refused. */
    private async isOutOfColumnScope(key: string | number): Promise<boolean> {
        return this.columnScopes.length > 0 && !(await this.base('with').findById(key));
    }
    /** A query of the model, in the open transaction if any. */
    private query(): QueryBuilder<M, M[]> { return this.model.query(currentTransaction(this.model.knex()) ?? undefined); }
    /** Runs `fn` in a transaction of the model's connection. */
    transaction<T>(fn: () => Promise<T>): Promise<T> { return transaction(this.model.knex(), fn); }
    /** A query of the model within the adapter's scopes (tenant, column scopes, `modify`, soft deletes): used by `scopedExists()` / `scopedUnique()`. */
    scopedQuery(trashed: 'without' | 'with' | 'only' = 'without'): QueryBuilder<M, M[]> { return this.base(trashed); }
    private base(trashed: 'without' | 'with' | 'only' = 'without'): QueryBuilder<M, M[]> {
        const q = this.query();
        const tenantKey = this.tenantScope?.key() ?? null;
        if (tenantKey !== null) q.where(`${this.model.tableName}.${this.tenantScope!.column}`, tenantKey);
        for (const scope of this.columnScopes) q.where(`${this.model.tableName}.${scope.column}`, scope.value);
        if (this.modify) this.modify(q);
        if (this.softDeletes) {
            if (trashed === 'without') q.whereNull(this.softDeletes);
            else if (trashed === 'only') q.whereNotNull(this.softDeletes);
        }
        return q;
    }
    private now(): string { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
    private get keyColumn(): string { return String(this.model.idColumn); }
    getKey(record: M): string { return String((record as any)[this.keyColumn]); }
    getLabel(): string { return this.model.tableName; }

    async count(): Promise<number> { return this.base().resultSize(); }

    async listKeys(query: Omit<ListQuery, 'page' | 'perPage'>): Promise<string[]> {
        const rows = await this.filtered(query).select(this.keyColumn);
        return rows.map((r) => this.getKey(r));
    }
    /**
     * Keeps the browser-supplied keys that fall within the adapter's scope (`modify` and tenant; trashed records included),
     * so a forged selection cannot target a record the table does not show.
     */
    async keysInScope(keys: (string | number)[]): Promise<string[]> {
        if (!keys.length) return [];
        const rows = await this.base('with').whereIn(`${this.model.tableName}.${this.keyColumn}`, keys.map(String).slice(0, 10000));
        return rows.map((r) => this.getKey(r));
    }
    /** Count and column aggregates over every record of the query (for summary rows). */
    async aggregate(query: Omit<ListQuery, 'page' | 'perPage'>, columns: { sum?: string[]; avg?: string[]; min?: string[]; max?: string[] } = {}): Promise<{ count: number; sum: Record<string, number>; avg: Record<string, number>; min: Record<string, unknown>; max: Record<string, unknown> }> {
        const q = this.model.knex().from(this.filtered(query, true).toKnexQuery().as('t')).count({ __count: '*' });
        const plain = (list: string[] | undefined) => (list ?? []).filter((column) => !resolveRelationshipColumn(this.model, column));
        for (const column of plain(columns.sum)) q.sum({ [`sum_${column}`]: `t.${column}` });
        for (const column of plain(columns.avg)) q.avg({ [`avg_${column}`]: `t.${column}` });
        for (const column of plain(columns.min)) q.min({ [`min_${column}`]: `t.${column}` });
        for (const column of plain(columns.max)) q.max({ [`max_${column}`]: `t.${column}` });
        const row = ((await q.first()) ?? {}) as Record<string, unknown>;
        // A relationship column (`items.price`) is summarized over the related records of the listed records, each counted once (Filament).
        for (const [fn, list] of Object.entries(columns) as ['sum' | 'avg' | 'min' | 'max', string[]][]) {
            for (const column of list ?? []) {
                const relationship = resolveRelationshipColumn(this.model, column);
                if (!relationship) continue;
                const related = relatedRecordsOf(this.filtered(query), this.model, relationship);
                const value = ((await this.model.knex().from(related.toKnexQuery().as('r'))[fn]({ value: `r.${relationship.attribute}` }).first()) ?? {}) as Record<string, unknown>;
                row[`${fn}_${column}`] = value.value ?? null;
            }
        }
        return {
            count: Number(row.__count ?? 0),
            sum: Object.fromEntries((columns.sum ?? []).map((column) => [column, Number(row[`sum_${column}`] ?? 0)])),
            avg: Object.fromEntries((columns.avg ?? []).map((column) => [column, Number(row[`avg_${column}`] ?? 0)])),
            min: Object.fromEntries((columns.min ?? []).map((column) => [column, row[`min_${column}`] ?? null])),
            max: Object.fromEntries((columns.max ?? []).map((column) => [column, row[`max_${column}`] ?? null])),
        };
    }
    async aggregateGroups(query: Omit<ListQuery, 'page' | 'perPage'>, columns: { sum?: string[]; avg?: string[]; min?: string[]; max?: string[] }, group: (query: any) => void): Promise<AggregateGroup[]> {
        const knex = this.model.knex();
        const table = this.model.tableName;
        const relationshipColumn = Object.values(columns).flat().find((column) => resolveRelationshipColumn(this.model, column as string));
        if (relationshipColumn) throw new Error(`aggregateGroups(): "${relationshipColumn}" is a relationship column; aggregate its groups one at a time with aggregate().`);
        // Like Laravel's summary query: the list query becomes a subquery named after the table, so `posts.status` and `status` both work.
        const q = knex.from(this.filtered(query, true).toKnexQuery().as(table)).count({ __count: '*' });
        const qualify = (column: string) => `${table}.${column}`;
        for (const column of columns.sum ?? []) q.sum({ [`sum_${column}`]: qualify(column) });
        for (const column of columns.avg ?? []) q.avg({ [`avg_${column}`]: qualify(column) });
        for (const column of columns.min ?? []) q.min({ [`min_${column}`]: qualify(column) });
        for (const column of columns.max ?? []) q.max({ [`max_${column}`]: qualify(column) });
        group(q);
        // The first grouping expression is selected too, to tell the groups apart (as Filament does).
        const grouping = ((q as any)._statements as any[]).find((statement) => statement.grouping === 'group');
        if (!grouping) throw new Error('The group query of a summary must group the records, e.g. query.groupBy(column).');
        const expression = grouping.type === 'groupByRaw' ? grouping.value : Array.isArray(grouping.value) ? grouping.value[0] : grouping.value;
        if (typeof expression === 'string') q.select({ __group: expression });
        else q.select(knex.raw(`${expression.sql} as ??`, [...(expression.bindings ?? []), '__group']));
        const rows = (await q) as Record<string, unknown>[];
        return rows.map((row) => ({
            key: row.__group ?? null,
            count: Number(row.__count ?? 0),
            sum: Object.fromEntries((columns.sum ?? []).map((column) => [column, Number(row[`sum_${column}`] ?? 0)])),
            avg: Object.fromEntries((columns.avg ?? []).map((column) => [column, Number(row[`avg_${column}`] ?? 0)])),
            min: Object.fromEntries((columns.min ?? []).map((column) => [column, row[`min_${column}`] ?? null])),
            max: Object.fromEntries((columns.max ?? []).map((column) => [column, row[`max_${column}`] ?? null])),
        }));
    }
    /**
     * Monthly trend over the filtered query (count, or average of `average`): one value per month from `start` to `end`,
     * 0 for months without records. The date SQL targets SQLite; dates are UTC, formatted `Y-m-d H:i:s`.
     */
    async trendPerMonth(query: Omit<ListQuery, 'page' | 'perPage'>, options: { start: Date; end: Date; dateColumn?: string; average?: string; modify?: (q: any) => void }): Promise<number[]> {
        const pad = (n: number) => String(n).padStart(2, '0');
        const stamp = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
        const column = options.dateColumn ?? 'created_at';
        const q = this.model.knex().from(this.filtered(query, true).toKnexQuery().as('t')).select(this.model.knex().raw(`strftime('%Y-%m', t.??) as month`, [column])).whereBetween(`t.${column}`, [stamp(options.start), stamp(options.end)]).groupBy('month');
        if (options.average) q.avg({ aggregate: `t.${options.average}` }); else q.count({ aggregate: '*' });
        options.modify?.(q);
        const rows = new Map(((await q) as { month: string; aggregate: number }[]).map((row) => [row.month, Number(row.aggregate ?? 0)]));
        const values: number[] = [];
        // One step per calendar month from `start`, up to and including `end`.
        for (let i = 0; ; i++) {
            const month = new Date(Date.UTC(options.start.getUTCFullYear(), options.start.getUTCMonth() + i, 1));
            if (month.getTime() > options.end.getTime()) break;
            values.push(rows.get(`${month.getUTCFullYear()}-${pad(month.getUTCMonth() + 1)}`) ?? 0);
        }
        return values;
    }
    async sum(query: Omit<ListQuery, 'page' | 'perPage'>, columns: string[]): Promise<Record<string, number>> {
        if (!columns.length) return {};
        // The filtered query is used as a subquery so its computed (aliased) columns remain usable by the search.
        const q = this.model.knex().from(this.filtered(query, true).toKnexQuery().as('t'));
        for (const column of columns) q.sum({ [column]: `t.${column}` });
        const row = ((await q.first()) ?? {}) as Record<string, unknown>;
        return Object.fromEntries(columns.map((column) => [column, Number(row[column] ?? 0)]));
    }
    async deleteMany(keys: (string | number)[]): Promise<number> {
        keys = await this.keysInScope(keys);
        if (!keys.length) return 0;
        if (this.softDeletes) return this.query().whereIn(this.keyColumn, keys).whereNull(this.softDeletes).patch({ [this.softDeletes]: this.now() } as any);
        return this.query().delete().whereIn(this.keyColumn, keys);
    }

    async paginate(query: ListQuery): Promise<Page<M>> {
        const page = await this.finishPagination(this.filtered(query, true), query);
        castRelationshipAggregates(page.records, query.aggregates ?? []);
        return page;
    }
    /** Relationships (`with`, `aggregates`, dot-notation search and sort) are supported through the model's `relationMappings`. */
    supportsRelationships(): boolean { return true; }

    /** Base query with modifiers, global search and per-column searches applied. */
    private filtered(query: Omit<ListQuery, 'page' | 'perPage'>, withAggregates = false): QueryBuilder<M, M[]> {
        const q = this.base(query.trashed ?? 'without');
        if (query.keys) q.whereIn(`${this.model.tableName}.${this.keyColumn}`, query.keys.map(String).slice(0, 10000));
        for (const modifier of query.modifiers ?? []) modifier(q);
        const term = (query.search ?? '').trim();
        // `author.name`: the word must match the name of a related author (Laravel's `orWhereHas()`); a JSON key its value.
        const like = (sub: any, column: string, word: string) => {
            const pattern = `%${escapeLike(word.toLowerCase())}%`;
            const relationship = resolveRelationshipColumn(this.model, column);
            const json = relationship ? null : jsonColumnExpression(this.model, column);
            if (relationship) whereRelationshipExists(sub, this.model, relationship, (related, qualified) => { related.whereRaw(LIKE, [qualified, pattern]); }, 'or');
            else if (json) sub.orWhereRaw(`lower(${json.sql}) like ? escape '\\'`, [...json.bindings, pattern]);
            else sub.orWhereRaw(LIKE, [column, pattern]);
        };
        if (term && query.searchUsing) q.where((sub) => { query.searchUsing!(sub, term); });
        else {
            const words = query.splitSearchTerms === false ? (term ? [term] : []) : searchWords(term);
            const columns = query.searchColumns ?? [];
            const constraints = query.searchConstraints ?? [];
            if (words.length && (columns.length || constraints.length)) {
                // Each word must match at least one column, case-insensitively; LIKE wildcards in the input are escaped.
                for (const word of words) {
                    q.where((sub) => {
                        for (const column of columns) like(sub, column, word);
                        for (const constraint of constraints) sub.orWhere((inner: any) => { constraint(inner, word); });
                    });
                }
            }
        }
        for (const [column, value] of Object.entries(query.columnSearches ?? {})) {
            const options = query.columnSearchOptions?.[column] ?? {};
            const text = String(value ?? '').trim();
            for (const word of options.split === false ? (text ? [text] : []) : searchWords(text)) {
                q.where((sub) => {
                    if (options.query) sub.where((inner: any) => { options.query!(inner, word); });
                    else for (const target of options.columns?.length ? options.columns : [column]) like(sub, target, word);
                });
            }
        }
        // Relationship aggregates are selected after the modifiers, which may select columns of their own.
        if (withAggregates) applyRelationshipAggregates(q, this.model, query.aggregates ?? []);
        return q;
    }

    private async finishPagination(q: QueryBuilder<M, M[]>, query: ListQuery): Promise<Page<M>> {
        const total = await q.clone().resultSize();
        this.applySorts(q, query);
        if (query.with?.length) applyEagerLoading(q, this.model, query.with);
        const perPage = Math.max(1, query.perPage);
        const lastPage = Math.max(1, Math.ceil(total / perPage));
        const page = Math.min(Math.max(1, query.page), lastPage);
        const records = await q.offset((page - 1) * perPage).limit(perPage);
        return { records, total, page, perPage, lastPage, from: records.length ? (page - 1) * perPage + 1 : null, to: records.length ? (page - 1) * perPage + records.length : null };
    }

    /** Group sort, then the sorts, then the key (unless `keySort: false`). */
    private applySorts(q: QueryBuilder<M, M[]>, query: Omit<ListQuery, 'page' | 'perPage'>): void {
        if (query.groupSort?.modify) query.groupSort.modify(q, query.groupSort.direction);
        else if (query.groupSort) orderByColumn(q, this.model, query.groupSort.column, query.groupSort.direction);
        for (const sort of [query.sort ?? null, ...(query.thenSort ?? [])]) {
            if (!sort) continue;
            if (sort.modify) sort.modify(q, sort.direction);
            // `author.name`: ordered by a correlated subquery of the related value (single-record relationships only).
            else for (const column of sort.columns?.length ? sort.columns : [sort.column]) orderByColumn(q, this.model, column, sort.direction);
        }
        if (query.keySort !== false) q.orderBy(this.keyColumn, 'asc');
    }

    /**
     * Cursor pagination: the query's orderings (sorts, then the key) must be plain columns. The cursor comes from the
     * browser: anything that does not decode to values of exactly these columns gives the first page.
     */
    async cursorPaginate(query: Omit<ListQuery, 'page'> & { cursor: string | null }): Promise<Page<M>> {
        const q = this.filtered(query);
        // The key always ends the orderings: without a unique last ordering, a cursor could skip or repeat records.
        this.applySorts(q, { ...query, keySort: true });
        if (query.with?.length) applyEagerLoading(q, this.model, query.with);
        const orders = cursorOrdersOf(q.toKnexQuery());
        const cursor = decodeCursor(query.cursor, orders);
        const perPage = Math.max(1, query.perPage);
        if (cursor) {
            applyCursorCondition(q, orders, cursor);
            // Going back: the orderings are reversed to read the records just before the cursor, then put back in order.
            if (!cursor.pointsToNextItems) { q.clearOrder(); for (const order of orders) q.orderBy(order.column, order.direction === 'asc' ? 'desc' : 'asc'); }
        }
        const rows = (await q.limit(perPage + 1)) as M[];
        const hasMore = rows.length > perPage;
        const records = rows.slice(0, perPage);
        if (cursor && !cursor.pointsToNextItems) records.reverse();
        const first = records[0] as Record<string, unknown> | undefined, last = records[records.length - 1] as Record<string, unknown> | undefined;
        // Forward: a previous page exists once a cursor was followed, a next one if more rows were read; backward, the opposite.
        const forward = !cursor || cursor.pointsToNextItems;
        const previous = first && (forward ? cursor !== null : hasMore) ? encodeCursor(first, orders, false) : null;
        const next = last && (forward ? hasMore : true) ? encodeCursor(last, orders, true) : null;
        return { records, total: records.length, page: 1, perPage, lastPage: 1, from: records.length ? 1 : null, to: records.length || null, cursor: { previous, next } };
    }

    async find(key: string | number): Promise<M | null> { return ((await this.base(this.findsTrashed ? 'with' : 'without').findById(key)) as M | undefined) ?? null; }
    async findWithTrashed(key: string | number): Promise<M | null> { return ((await this.base('with').findById(key)) as M | undefined) ?? null; }
    async create(data: Record<string, unknown>): Promise<M> {
        const tenantKey = this.tenantScope?.key() ?? null;
        const scoped = Object.fromEntries(this.columnScopes.map((scope) => [scope.column, scope.value]));
        return (await this.query().insertAndFetch({ ...data, ...(tenantKey !== null ? { [this.tenantScope!.column]: tenantKey } : {}), ...scoped } as any)) as unknown as M;
    }
    async update(key: string | number, data: Record<string, unknown>): Promise<M | null> {
        // Records outside the current tenant (or the column scopes) cannot be updated, and the scope columns never change.
        const guarded = [...(this.tenantScope && this.tenantScope.key() !== null ? [this.tenantScope.column] : []), ...this.columnScopes.map((scope) => scope.column)];
        if (guarded.length) {
            if (!(await this.base('with').findById(key))) return null;
            data = Object.fromEntries(Object.entries(data).filter(([column]) => !guarded.includes(column)));
        }
        return ((await this.query().patchAndFetchById(key, data as any)) as unknown as M | undefined) ?? null;
    }
    /** With soft deletes, the record is timestamped instead of removed. */
    async delete(key: string | number): Promise<boolean> {
        if (await this.isOutOfColumnScope(key)) return false;
        if (this.softDeletes) return (await this.query().findById(key).whereNull(this.softDeletes).patch({ [this.softDeletes]: this.now() } as any)) > 0;
        return (await this.query().deleteById(key)) > 0;
    }
    supportsSoftDeletes(): boolean { return this.softDeletes !== null; }
    isTrashed(record: M): boolean { return this.softDeletes !== null && (record as any)?.[this.softDeletes] != null; }
    async restore(key: string | number): Promise<boolean> {
        if (!this.softDeletes || (await this.isOutOfColumnScope(key))) return false;
        return (await this.query().findById(key).whereNotNull(this.softDeletes).patch({ [this.softDeletes]: null } as any)) > 0;
    }
    async forceDelete(key: string | number): Promise<boolean> { return !(await this.isOutOfColumnScope(key)) && (await this.query().deleteById(key)) > 0; }
    async exists(column: string, value: unknown, exceptKey: string | number | null = null): Promise<boolean> {
        const q = this.query().where(column, value as any);
        if (exceptKey !== null) q.whereNot(this.keyColumn, exceptKey);
        return (await q.resultSize()) > 0;
    }
}
