// @navette-js/database — contrat d'accès aux données (ADR 0005) et premier adaptateur : Knex + Objection.
import knexFactory, { type Knex } from 'knex';
import { Model, type ModelClass, type QueryBuilder } from 'objection';

export { Model };
export type { Knex };

export type SortDirection = 'asc' | 'desc';
export type ListQuery = {
    /** Recherche globale : chaque mot doit apparaître dans au moins une des colonnes cherchables. */
    search?: string | null;
    searchColumns?: string[];
    /** Recherche par colonne : toutes les conditions doivent être vraies. */
    columnSearches?: Record<string, string>;
    /** Enregistrements supprimés (suppression douce) : exclus par défaut, inclus, ou seuls. */
    trashed?: 'without' | 'with' | 'only';
    sort?: { column: string; direction: SortDirection } | null;
    /** Regroupement de table : ce tri passe avant `sort`. */
    groupSort?: { column: string; direction: SortDirection } | null;
    /** Conditions supplémentaires posées par le serveur (onglet de liste, filtre sur mesure) : jamais construites à partir de données du navigateur non validées. */
    modifiers?: ((query: any) => void)[];
    page: number;
    perPage: number;
};
export type Page<T> = { records: T[]; total: number; page: number; perPage: number; lastPage: number; from: number | null; to: number | null };

/** Ce dont le framework a besoin pour lister, lire et écrire des enregistrements, sans connaître l'ORM. */
export interface DataAdapter<T = any> {
    getKey(record: T): string;
    /** Filtre des clés reçues du navigateur : seules celles de la portée de l'adaptateur sont rendues. */
    keysInScope(keys: (string | number)[]): Promise<string[]>;
    sum(query: Omit<ListQuery, 'page' | 'perPage'>, columns: string[]): Promise<Record<string, number>>;
    /** Agrégats sur les enregistrements d'une requête de liste : nombre, sommes et moyennes de colonnes. */
    aggregate(query: Omit<ListQuery, 'page' | 'perPage'>, columns?: { sum?: string[]; avg?: string[]; min?: string[]; max?: string[] }): Promise<{ count: number; sum: Record<string, number>; avg: Record<string, number>; min: Record<string, unknown>; max: Record<string, unknown> }>;
    getLabel(): string;
    count(): Promise<number>;
    paginate(query: ListQuery): Promise<Page<T>>;
    find(key: string | number): Promise<T | null>;
    create(data: Record<string, unknown>): Promise<T>;
    update(key: string | number, data: Record<string, unknown>): Promise<T | null>;
    delete(key: string | number): Promise<boolean>;
    /** Suppression douce : prise en charge, état d'un enregistrement, restauration, suppression définitive. */
    supportsSoftDeletes(): boolean;
    isTrashed(record: T): boolean;
    restore(key: string | number): Promise<boolean>;
    forceDelete(key: string | number): Promise<boolean>;
    /** Clés de tous les enregistrements correspondant à la requête (sans pagination), pour « tout sélectionner ». */
    listKeys(query: Omit<ListQuery, 'page' | 'perPage'>): Promise<string[]>;
    deleteMany(keys: (string | number)[]): Promise<number>;
    /** Vrai si un autre enregistrement a déjà cette valeur (règle `unique`). */
    exists(column: string, value: unknown, exceptKey?: string | number | null): Promise<boolean>;
}

export function createConnection(config: Knex.Config): Knex {
    const knex = knexFactory(config);
    Model.knex(knex);
    return knex;
}
/** Connexion SQLite (pilote better-sqlite3), pour le développement et la démo. */
export function sqlite(filename: string): Knex {
    return createConnection({ client: 'better-sqlite3', connection: { filename }, useNullAsDefault: true });
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

export class ObjectionAdapter<M extends Model> implements DataAdapter<M> {
    private model: ModelClass<M>;
    private modify: ((query: QueryBuilder<M, M[]>) => void) | null;
    private softDeletes: string | null;
    private findsTrashed: boolean;
    /** `softDeletes` : colonne d'horodatage de suppression (équivalent du trait SoftDeletes). `findsTrashed` : `find()` voit aussi les supprimés
     *  (équivalent de `getRecordRouteBindingEloquentQuery()->withoutGlobalScopes([SoftDeletingScope::class])`). */
    constructor(model: ModelClass<M>, options: { modify?: (query: QueryBuilder<M, M[]>) => void; softDeletes?: string; findsTrashed?: boolean } = {}) {
        this.model = model; this.modify = options.modify ?? null; this.softDeletes = options.softDeletes ?? null; this.findsTrashed = options.findsTrashed === true;
    }

    private tenantScope: { column: string; key: () => string | number | null } | null = null;
    /**
     * Cloisonne l'adaptateur par locataire : toute lecture filtre sur `column`, toute création la renseigne,
     * avec la clé rendue par `key()` (celle du locataire de la requête ; `null` : pas de filtre). Posé par le panel (`panel.tenant()`).
     */
    scopeToTenant(column: string, key: () => string | number | null): this { this.tenantScope = { column, key }; return this; }
    private base(trashed: 'without' | 'with' | 'only' = 'without'): QueryBuilder<M, M[]> {
        const q = this.model.query();
        const tenantKey = this.tenantScope?.key() ?? null;
        if (tenantKey !== null) q.where(`${this.model.tableName}.${this.tenantScope!.column}`, tenantKey);
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
     * Parmi des clés reçues du navigateur, celles qui appartiennent à la portée de l'adaptateur (`modify`, suppression douce comprise).
     * Une sélection forgée ne peut ainsi pas viser un enregistrement que la table n'affiche pas.
     */
    async keysInScope(keys: (string | number)[]): Promise<string[]> {
        if (!keys.length) return [];
        const rows = await this.base('with').whereIn(`${this.model.tableName}.${this.keyColumn}`, keys.map(String).slice(0, 10000));
        return rows.map((r) => this.getKey(r));
    }
    /** Somme de colonnes sur tous les enregistrements de la requête (pour les lignes de totaux). */
    async aggregate(query: Omit<ListQuery, 'page' | 'perPage'>, columns: { sum?: string[]; avg?: string[]; min?: string[]; max?: string[] } = {}): Promise<{ count: number; sum: Record<string, number>; avg: Record<string, number>; min: Record<string, unknown>; max: Record<string, unknown> }> {
        const q = this.model.knex().from(this.filtered(query).toKnexQuery().as('t')).count({ __count: '*' });
        for (const column of columns.sum ?? []) q.sum({ [`sum_${column}`]: `t.${column}` });
        for (const column of columns.avg ?? []) q.avg({ [`avg_${column}`]: `t.${column}` });
        for (const column of columns.min ?? []) q.min({ [`min_${column}`]: `t.${column}` });
        for (const column of columns.max ?? []) q.max({ [`max_${column}`]: `t.${column}` });
        const row = ((await q.first()) ?? {}) as Record<string, unknown>;
        return {
            count: Number(row.__count ?? 0),
            sum: Object.fromEntries((columns.sum ?? []).map((column) => [column, Number(row[`sum_${column}`] ?? 0)])),
            avg: Object.fromEntries((columns.avg ?? []).map((column) => [column, Number(row[`avg_${column}`] ?? 0)])),
            min: Object.fromEntries((columns.min ?? []).map((column) => [column, row[`min_${column}`] ?? null])),
            max: Object.fromEntries((columns.max ?? []).map((column) => [column, row[`max_${column}`] ?? null])),
        };
    }
    /**
     * Tendance mensuelle sur la requête filtrée (équivalent de `Trend::query(...)->between()->perMonth()->count()` ou `->average()`
     * de flowframe/laravel-trend) : une valeur par mois de `start` à `end`, 0 pour un mois sans enregistrement.
     * SQL de date écrit pour SQLite ; dates en UTC, au format `Y-m-d H:i:s`.
     */
    async trendPerMonth(query: Omit<ListQuery, 'page' | 'perPage'>, options: { start: Date; end: Date; dateColumn?: string; average?: string; modify?: (q: any) => void }): Promise<number[]> {
        const pad = (n: number) => String(n).padStart(2, '0');
        const stamp = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
        const column = options.dateColumn ?? 'created_at';
        const q = this.model.knex().from(this.filtered(query).toKnexQuery().as('t')).select(this.model.knex().raw(`strftime('%Y-%m', t.??) as month`, [column])).whereBetween(`t.${column}`, [stamp(options.start), stamp(options.end)]).groupBy('month');
        if (options.average) q.avg({ aggregate: `t.${options.average}` }); else q.count({ aggregate: '*' });
        options.modify?.(q);
        const rows = new Map(((await q) as { month: string; aggregate: number }[]).map((row) => [row.month, Number(row.aggregate ?? 0)]));
        const values: number[] = [];
        // Comme CarbonPeriod par pas d'un mois : même jour du mois que `start`, jusqu'à `end` compris.
        for (let i = 0; ; i++) {
            const month = new Date(Date.UTC(options.start.getUTCFullYear(), options.start.getUTCMonth() + i, 1));
            if (month.getTime() > options.end.getTime()) break;
            values.push(rows.get(`${month.getUTCFullYear()}-${pad(month.getUTCMonth() + 1)}`) ?? 0);
        }
        return values;
    }
    async sum(query: Omit<ListQuery, 'page' | 'perPage'>, columns: string[]): Promise<Record<string, number>> {
        if (!columns.length) return {};
        // La requête filtrée sert de sous-requête : ses colonnes calculées (alias) restent utilisables par la recherche.
        const q = this.model.knex().from(this.filtered(query).toKnexQuery().as('t'));
        for (const column of columns) q.sum({ [column]: `t.${column}` });
        const row = ((await q.first()) ?? {}) as Record<string, unknown>;
        return Object.fromEntries(columns.map((column) => [column, Number(row[column] ?? 0)]));
    }
    async deleteMany(keys: (string | number)[]): Promise<number> {
        keys = await this.keysInScope(keys);
        if (!keys.length) return 0;
        if (this.softDeletes) return this.model.query().whereIn(this.keyColumn, keys).whereNull(this.softDeletes).patch({ [this.softDeletes]: this.now() } as any);
        return this.model.query().delete().whereIn(this.keyColumn, keys);
    }

    async paginate(query: ListQuery): Promise<Page<M>> {
        return this.finishPagination(this.filtered(query), query);
    }

    /** Requête de base avec recherche globale et recherches par colonne appliquées. */
    private filtered(query: Omit<ListQuery, 'page' | 'perPage'>): QueryBuilder<M, M[]> {
        const q = this.base(query.trashed ?? 'without');
        for (const modifier of query.modifiers ?? []) modifier(q);
        const words = (query.search ?? '').trim().split(/\s+/).filter(Boolean);
        const columns = query.searchColumns ?? [];
        if (words.length && columns.length) {
            // Comme Filament : chaque mot doit correspondre à au moins une colonne, sans tenir compte de la casse.
            for (const word of words) {
                q.where((sub) => {
                    for (const column of columns) sub.orWhereRaw("lower(??) like ? escape '\\'", [column, `%${escapeLike(word.toLowerCase())}%`]);
                });
            }
        }
        for (const [column, value] of Object.entries(query.columnSearches ?? {})) {
            for (const word of String(value ?? '').trim().split(/\s+/).filter(Boolean)) q.whereRaw("lower(??) like ? escape '\\'", [column, `%${escapeLike(word.toLowerCase())}%`]);
        }
        return q;
    }

    private async finishPagination(q: QueryBuilder<M, M[]>, query: ListQuery): Promise<Page<M>> {
        const total = await q.clone().resultSize();
        if (query.groupSort) q.orderBy(query.groupSort.column, query.groupSort.direction);
        if (query.sort) q.orderBy(query.sort.column, query.sort.direction);
        q.orderBy(this.keyColumn, 'asc');
        const perPage = Math.max(1, query.perPage);
        const lastPage = Math.max(1, Math.ceil(total / perPage));
        const page = Math.min(Math.max(1, query.page), lastPage);
        const records = await q.offset((page - 1) * perPage).limit(perPage);
        return { records, total, page, perPage, lastPage, from: records.length ? (page - 1) * perPage + 1 : null, to: records.length ? (page - 1) * perPage + records.length : null };
    }

    async find(key: string | number): Promise<M | null> { return ((await this.base(this.findsTrashed ? 'with' : 'without').findById(key)) as M | undefined) ?? null; }
    async create(data: Record<string, unknown>): Promise<M> {
        const tenantKey = this.tenantScope?.key() ?? null;
        return (await this.model.query().insertAndFetch((tenantKey !== null ? { ...data, [this.tenantScope!.column]: tenantKey } : data) as any)) as unknown as M;
    }
    async update(key: string | number, data: Record<string, unknown>): Promise<M | null> {
        // Un enregistrement hors du locataire courant n'est pas modifiable, et la colonne du locataire ne change pas.
        if (this.tenantScope && this.tenantScope.key() !== null) {
            if (!(await this.base('with').findById(key))) return null;
            data = Object.fromEntries(Object.entries(data).filter(([column]) => column !== this.tenantScope!.column));
        }
        return ((await this.model.query().patchAndFetchById(key, data as any)) as unknown as M | undefined) ?? null;
    }
    /** Avec suppression douce, l'enregistrement est horodaté, pas retiré. */
    async delete(key: string | number): Promise<boolean> {
        if (this.softDeletes) return (await this.model.query().findById(key).whereNull(this.softDeletes).patch({ [this.softDeletes]: this.now() } as any)) > 0;
        return (await this.model.query().deleteById(key)) > 0;
    }
    supportsSoftDeletes(): boolean { return this.softDeletes !== null; }
    isTrashed(record: M): boolean { return this.softDeletes !== null && (record as any)?.[this.softDeletes] != null; }
    async restore(key: string | number): Promise<boolean> {
        if (!this.softDeletes) return false;
        return (await this.model.query().findById(key).whereNotNull(this.softDeletes).patch({ [this.softDeletes]: null } as any)) > 0;
    }
    async forceDelete(key: string | number): Promise<boolean> { return (await this.model.query().deleteById(key)) > 0; }
    async exists(column: string, value: unknown, exceptKey: string | number | null = null): Promise<boolean> {
        const q = this.model.query().where(column, value as any);
        if (exceptKey !== null) q.whereNot(this.keyColumn, exceptKey);
        return (await q.resultSize()) > 0;
    }
}
