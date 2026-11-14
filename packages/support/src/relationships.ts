// Relationship paths and relationship aggregates shared by table columns, infolist entries and export columns.
// Nothing here is built from browser input: relationship and column names come from the developer's declarations, and are
// still checked to be plain identifiers before they reach a query.

/** Aggregate functions of `counts()`, `exists()`, `avg()`, `sum()`, `min()` and `max()`. */
export type RelationshipAggregateFunction = 'count' | 'exists' | 'avg' | 'sum' | 'min' | 'max';
/** Changes the query of the related records of an aggregate (e.g. only published posts). */
export type RelationshipAggregateQueryModifier = (query: any) => void;
/**
 * One relationship aggregate added to the query of the records, like Laravel's `withCount()`, `withExists()`, `withSum()`…
 * The value is selected as `alias` on every record (`posts_count`, `posts_exists`, `orders_sum_total`).
 */
export type RelationshipAggregate = {
    relationship: string;
    function: RelationshipAggregateFunction;
    /** Column of the related records (`null` for `count` and `exists`). */
    column: string | null;
    alias: string;
    modify?: RelationshipAggregateQueryModifier;
};
/**
 * Relationships of `counts()` and `exists()`: a name (`'posts'`), a name with an alias (`'posts as published_posts_count'`), a list
 * of them, or an object whose values change the query of the related records (`{ posts: (query) => query.where('published', true) }`).
 */
export type AggregatedRelationships = string | (string | Record<string, RelationshipAggregateQueryModifier>)[] | Record<string, RelationshipAggregateQueryModifier>;
/** Relationship of `avg()`, `sum()`, `min()` and `max()`: a name, `'name as alias'`, or `{ name: modifier }`. */
export type AggregatedRelationship = string | Record<string, RelationshipAggregateQueryModifier>;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Whether `name` is a plain identifier (a relationship, attribute or alias name that may safely reach a query). */
export function isIdentifier(name: unknown): name is string { return typeof name === 'string' && IDENTIFIER.test(name); }
/** Whether every dot-separated segment of `path` is a plain identifier. */
export function isIdentifierPath(path: unknown): path is string { return typeof path === 'string' && path.split('.').every((segment) => IDENTIFIER.test(segment)); }

/** `blogPosts` → `blog_posts` (Laravel's `Str::snake()`, used to name aggregates). */
const snake = (value: string) => value.replace(/\s+/g, '_').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/_+/g, '_');

/** Laravel's default alias of an aggregate: `posts_count`, `posts_exists`, `orders_sum_total`. */
export function relationshipAggregateAlias(relationship: string, fn: RelationshipAggregateFunction, column: string | null): string {
    if (fn === 'count' || fn === 'exists') return snake(`${relationship}_${fn}`);
    return snake(`${relationship}_${fn}_${column}`);
}

function parseRelationshipName(name: string, fn: RelationshipAggregateFunction, column: string | null, modify: RelationshipAggregateQueryModifier | undefined, owner: string): RelationshipAggregate {
    const match = /^\s*([A-Za-z0-9_]+)(?:\s+as\s+([A-Za-z0-9_]+))?\s*$/i.exec(name);
    if (!match || !isIdentifier(match[1]) || (match[2] !== undefined && !isIdentifier(match[2]))) throw new Error(`${owner}: invalid relationship "${name}" for ${fn}(): use a relationship name, optionally followed by "as alias".`);
    if (column !== null && !isIdentifier(column)) throw new Error(`${owner}: invalid column "${column}" for ${fn}(): use the name of a column of the related records.`);
    return { relationship: match[1], function: fn, column, alias: match[2] ?? relationshipAggregateAlias(match[1], fn, column), ...(modify ? { modify } : {}) };
}

/** Normalizes the relationships given to an aggregate method into a list of aggregates (names and aliases are checked). */
export function normalizeRelationshipAggregates(fn: RelationshipAggregateFunction, relationships: AggregatedRelationships | null, column: string | null = null, owner = 'Relationship aggregate'): RelationshipAggregate[] {
    if (relationships === null || relationships === undefined) return [];
    if (fn !== 'count' && fn !== 'exists' && (column === null || column === undefined)) throw new Error(`${owner}: ${fn}() needs the column of the related records to aggregate.`);
    const items = typeof relationships === 'string' ? [relationships] : Array.isArray(relationships) ? relationships : [relationships];
    const aggregates: RelationshipAggregate[] = [];
    for (const item of items) {
        if (typeof item === 'string') { aggregates.push(parseRelationshipName(item, fn, fn === 'count' || fn === 'exists' ? null : column, undefined, owner)); continue; }
        if (!item || typeof item !== 'object') throw new Error(`${owner}: invalid relationship given to ${fn}().`);
        for (const [name, modify] of Object.entries(item)) {
            if (typeof modify !== 'function') throw new Error(`${owner}: the value of relationship "${name}" given to ${fn}() must be a function changing its query.`);
            aggregates.push(parseRelationshipName(name, fn, fn === 'count' || fn === 'exists' ? null : column, modify, owner));
        }
    }
    return aggregates;
}

/**
 * The relationship aggregates of a column or entry (`counts()`, `exists()`, `avg()`, `sum()`, `min()`, `max()`), kept in one place so
 * that table columns, infolist entries and export columns declare them the same way.
 */
export class RelationshipAggregates {
    private items = new Map<RelationshipAggregateFunction, RelationshipAggregate[]>();
    readonly owner: string;
    constructor(owner: string) { this.owner = owner; }
    /** Replaces the aggregates of one function (`null` removes them). */
    set(fn: RelationshipAggregateFunction, relationships: AggregatedRelationships | null, column: string | null = null): void {
        const aggregates = normalizeRelationshipAggregates(fn, relationships, column, this.owner);
        if (aggregates.length) this.items.set(fn, aggregates); else this.items.delete(fn);
    }
    /** Every aggregate, in declaration order of the functions. */
    all(): RelationshipAggregate[] { return [...this.items.values()].flat(); }
    has(): boolean { return this.items.size > 0; }
    /** The relationship and column given to one function, or `null`. */
    get(fn: RelationshipAggregateFunction): RelationshipAggregate[] { return this.items.get(fn) ?? []; }
}

/** Relationship part of a dot-notation name (`author.country.name` → `author.country`), or `null` without a dot. */
export function relationshipPathOf(name: string): string | null {
    const index = name.lastIndexOf('.');
    return index > 0 && isIdentifierPath(name) ? name.slice(0, index) : null;
}

const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/**
 * State of a dot-notation name read from a record, like Filament's `getStateFromRecord()`: `author.name` reads `record.author.name`.
 * When a step is a list of related records (has-many, many-to-many), the state is the list of the non-blank values found in each of
 * them (`comments.author.name`); a single related record gives its value. An attribute of the record named like the full path
 * (`record['author.name']`, e.g. computed by a custom adapter) takes precedence.
 */
export function readRecordPath(record: unknown, name: string): unknown {
    if (record === null || record === undefined || typeof record !== 'object') return undefined;
    const own = (record as Record<string, unknown>)[name];
    if (own !== undefined || !name.includes('.')) return own;
    let multiple = false;
    const walk = (node: unknown, segments: string[]): unknown[] => {
        if (node === null || node === undefined) return [];
        if (Array.isArray(node)) { multiple = true; return node.flatMap((item) => walk(item, segments)); }
        if (!segments.length) return [node];
        if (typeof node !== 'object') return [];
        const [head, ...rest] = segments;
        if (!Object.prototype.hasOwnProperty.call(node, head) && !(head in (node as object))) return [];
        const value = (node as Record<string, unknown>)[head];
        // A list as the final value is an attribute of its own (JSON array, tags): it is not split into items.
        if (!rest.length) return [value];
        return walk(value, rest);
    };
    const values = walk(record, name.split('.')).filter((value) => !isBlank(value));
    if (!values.length) return multiple ? null : walk(record, name.split('.'))[0] ?? null;
    return multiple ? values : values[0];
}

/** Objection-like model instance: `$fetchGraph()` / `$relatedQuery()` and a model class declaring `relationMappings`. */
type ModelInstance = { $fetchGraph(expression: unknown, options?: unknown): Promise<unknown>; $relatedQuery(name: string): any; constructor: { getRelations?(): Record<string, unknown> } };
const isModelInstance = (record: unknown): record is ModelInstance => !!record && typeof record === 'object' && typeof (record as any).$fetchGraph === 'function' && typeof (record as any).$relatedQuery === 'function' && typeof (record as any).constructor?.getRelations === 'function';
const relationOf = (model: any, name: string): any => {
    const relations = typeof model?.getRelations === 'function' ? model.getRelations() : null;
    return relations && Object.prototype.hasOwnProperty.call(relations, name) ? relations[name] : null;
};

/**
 * Relationship segments of a dot path on a model class (`relationMappings`): `author.country.name` gives `['author', 'country']`
 * when both are relationships; the walk stops at the first segment that is not one (an attribute, e.g. a JSON column).
 */
export function relationshipSegments(model: any, path: string): string[] {
    const segments: string[] = [];
    let current = model;
    for (const segment of path.split('.')) {
        const relation = relationOf(current, segment);
        if (!relation) break;
        segments.push(segment);
        current = relation.relatedModelClass;
    }
    return segments;
}

/** `['author.country', 'comments']` → `{ author: { country: true }, comments: true }` (Objection relation expression object). */
export function relationExpression(paths: string[]): Record<string, unknown> {
    const tree: Record<string, any> = {};
    for (const path of paths) {
        let node = tree;
        for (const segment of path.split('.')) node = (node[segment] = node[segment] === true || node[segment] === undefined ? {} : node[segment]);
    }
    const close = (node: Record<string, any>): Record<string, unknown> => Object.fromEntries(Object.entries(node).map(([key, child]) => [key, Object.keys(child).length ? close(child) : true]));
    return close(tree);
}

/**
 * Loads the relationships of dot-notation names on one record when they are missing, like Laravel's `loadMissing()`: for an
 * Objection model instance, the relationship part of each name is fetched (`$fetchGraph`, already loaded relations are kept).
 * Other records are left as they are (their nested objects are read directly).
 */
export async function loadMissingRelationships(record: unknown, names: string[]): Promise<void> {
    if (!isModelInstance(record)) return;
    const model = record.constructor;
    const missing = names.map((name) => relationshipPathOf(name)).filter((path): path is string => path !== null)
        .map((path) => relationshipSegments(model, path))
        .filter((segments) => segments.length > 0)
        .filter((segments) => {
            // Already loaded down to the last relationship: nothing to fetch.
            let node: any = record;
            for (const segment of segments) {
                if (Array.isArray(node)) return node.some((item) => item?.[segment] === undefined);
                if (node === null || node === undefined) return false;
                if (node[segment] === undefined) return true;
                node = node[segment];
            }
            return false;
        }).map((segments) => segments.join('.'));
    if (missing.length) await record.$fetchGraph(relationExpression([...new Set(missing)]), { skipFetched: true });
}

/**
 * Computes relationship aggregates for one record, like Laravel's `loadCount()` / `loadSum()`…: the value of each aggregate is set
 * on the record under its alias (`posts_count`). Records that already have the alias (selected by the list query) are not queried
 * again. Needs an Objection model instance (`$relatedQuery()`); other records must carry the aggregate themselves.
 */
export async function loadRelationshipAggregates(record: unknown, aggregates: RelationshipAggregate[], owner = 'Relationship aggregate'): Promise<void> {
    if (!aggregates.length || record === null || record === undefined || typeof record !== 'object') return;
    const pending = aggregates.filter((aggregate) => (record as Record<string, unknown>)[aggregate.alias] === undefined);
    if (!pending.length) return;
    if (!isModelInstance(record)) throw new Error(`${owner}: relationship aggregates (counts(), sum()…) need an Objection model record (with relationMappings), or a record that already has the "${pending[0].alias}" attribute.`);
    for (const aggregate of pending) {
        const relation = relationOf(record.constructor, aggregate.relationship);
        if (!relation) throw new Error(`${owner}: "${aggregate.relationship}" is not a relationship of model ${(record.constructor as any).name} (relationMappings).`);
        const query = record.$relatedQuery(aggregate.relationship);
        aggregate.modify?.(query);
        const table = query.tableRefFor(query.modelClass());
        const qualified = aggregate.column === null ? null : `${table}.${aggregate.column}`;
        let value: unknown;
        if (aggregate.function === 'count') value = Number((await query.clearSelect().count({ aggregate: '*' }).first())?.aggregate ?? 0);
        else if (aggregate.function === 'exists') value = Number((await query.clearSelect().count({ aggregate: '*' }).first())?.aggregate ?? 0) > 0;
        else {
            const row = await query.clearSelect()[aggregate.function]({ aggregate: qualified }).first();
            value = row?.aggregate ?? null;
        }
        (record as Record<string, unknown>)[aggregate.alias] = value;
    }
}
