// Relationship columns and relationship aggregates on Objection queries: eager loading (`with`), sorting and searching through a
// relationship (`author.name`), and `withCount()`-like aggregates (`posts_count`). Relationship, column and alias names come from
// the developer's declarations (columns, entries, export columns), never from the browser, and are still checked to be plain
// identifiers and declared relationships (`relationMappings`) before they reach a query; values are always bound parameters.
import { Model, raw } from 'objection';
import { isIdentifier, isIdentifierPath, relationExpression, relationshipSegments, type RelationshipAggregate } from '@navette-js/support';

export type { RelationshipAggregate, RelationshipAggregateFunction } from '@navette-js/support';

/** A dot-notation name resolved on a model: the relationships to walk, and the attribute of the last related model. */
export type RelationshipColumn = { relationships: string[]; attribute: string; relatedModel: any };

const relationOf = (model: any, name: string): any => {
    const relations = typeof model?.getRelations === 'function' ? model.getRelations() : null;
    return relations && Object.prototype.hasOwnProperty.call(relations, name) ? relations[name] : null;
};

/**
 * Resolves a dot-notation column name (`author.name`, `author.country.name`) on a model, like Filament's `getRelationshipName()`:
 * the leading segments that are relationships of the model (`relationMappings`) form the relationship path, the rest is the
 * attribute. Returns `null` when the name is not a relationship column: no dot, a column qualified with the model's own table
 * (`posts.title`), or a first segment that is not a relationship (e.g. a JSON attribute).
 */
export function resolveRelationshipColumn(model: any, name: string): RelationshipColumn | null {
    if (typeof name !== 'string' || !name.includes('.') || !isIdentifierPath(name) || typeof model?.getRelations !== 'function') return null;
    const segments = name.split('.');
    if (segments[0] === model.tableName) return null;
    const relationships = relationshipSegments(model, segments.slice(0, -1).join('.'));
    if (!relationships.length) return null;
    const rest = segments.slice(relationships.length);
    if (rest.length !== 1) throw new Error(`Column ${name}: "${rest.join('.')}" is not an attribute of the related model; nested attributes of related records (JSON) cannot be sorted or searched.`);
    let relatedModel = model;
    for (const relationship of relationships) relatedModel = relationOf(relatedModel, relationship).relatedModelClass;
    return { relationships, attribute: rest[0], relatedModel };
}

/** Correlated subquery of the related records of one relationship of `model`, under a fixed alias (self-relations stay unambiguous). */
function relatedQuery(model: any, relationship: string, alias: string): any {
    if (!relationOf(model, relationship)) throw new Error(`"${relationship}" is not a relationship of model ${model?.name} (relationMappings).`);
    return model.relatedQuery(relationship).alias(alias);
}
const aliasFor = (relationship: string, depth: number) => `${relationship}_rel${depth}`;

/**
 * `whereExists` condition through the relationships of a column, like Laravel's `whereHas()`: `apply` receives the subquery of the
 * last related records and the qualified attribute column.
 */
export function whereRelationshipExists(query: any, model: any, column: RelationshipColumn, apply: (sub: any, qualifiedColumn: string) => void, boolean: 'and' | 'or' = 'and'): void {
    const build = (owner: any, depth: number): any => {
        const relationship = column.relationships[depth];
        const alias = aliasFor(relationship, depth);
        const sub = relatedQuery(owner, relationship, alias);
        if (depth === column.relationships.length - 1) apply(sub, `${alias}.${column.attribute}`);
        else sub.whereExists(build(relationOf(owner, relationship).relatedModelClass, depth + 1));
        return sub;
    };
    const sub = build(model, 0);
    if (boolean === 'or') query.orWhereExists(sub); else query.whereExists(sub);
}

/**
 * Correlated subquery of the value of a relationship column, for sorting (Filament's `RelationshipOrderer`): only single-record
 * relationships (belongs-to-one, has-one, has-one-through) can be sorted on.
 */
export function relationshipValueQuery(model: any, column: RelationshipColumn): any {
    const build = (owner: any, depth: number): any => {
        const relationship = column.relationships[depth];
        const relation = relationOf(owner, relationship);
        if (typeof relation?.isOneToOne === 'function' && !relation.isOneToOne()) throw new Error(`Sorting through a relationship only supports single-record relationships (belongs-to-one, has-one): "${relationship}" of model ${owner?.name} is a ${relation.constructor?.name}.`);
        const alias = aliasFor(relationship, depth);
        const sub = relatedQuery(owner, relationship, alias);
        if (depth === column.relationships.length - 1) sub.select(`${alias}.${column.attribute}`);
        else sub.select(build(relation.relatedModelClass, depth + 1).as(`${relationship}_value`));
        return sub.limit(1);
    };
    return build(model, 0);
}

/** Orders a query by a column, through its relationship when it is a relationship column (`author.name`). */
export function orderByColumn(query: any, model: any, name: string, direction: 'asc' | 'desc'): void {
    const dir = direction === 'desc' ? 'desc' : 'asc';
    const column = resolveRelationshipColumn(model, name);
    const json = column ? null : jsonColumnExpression(model, name);
    if (column) query.orderBy(relationshipValueQuery(model, column), dir);
    else if (json) query.orderByRaw(`${json.sql} ${dir}`, json.bindings);
    else query.orderBy(name, dir);
}

/**
 * SQL expression of a key of a JSON attribute (`meta.title`, `meta` being listed in the model's `jsonAttributes`), like Laravel's
 * `meta->title`; `null` for any other name. The column is a bound identifier and the path a bound value, in the connection's dialect.
 */
export function jsonColumnExpression(model: any, name: string): { sql: string; bindings: unknown[] } | null {
    if (typeof name !== 'string' || !name.includes('.') || !isIdentifierPath(name)) return null;
    const [attribute, ...keys] = name.split('.');
    const json = (model as any)?.jsonAttributes;
    if (!Array.isArray(json) || !json.includes(attribute) || relationOf(model, attribute)) return null;
    const column = `${model.tableName}.${attribute}`;
    const client = String(model.knex?.()?.client?.config?.client ?? '').toLowerCase();
    if (/^(pg|pgnative|postgres|postgresql|cockroachdb|redshift)$/.test(client)) return { sql: `(??::jsonb #>> ?)`, bindings: [column, `{${keys.join(',')}}`] };
    const path = `$.${keys.join('.')}`;
    if (/mysql|maria/.test(client)) return { sql: 'json_unquote(json_extract(??, ?))', bindings: [column, path] };
    if (/mssql|sqlserver/.test(client)) return { sql: 'json_value(??, ?)', bindings: [column, path] };
    return { sql: 'json_extract(??, ?)', bindings: [column, path] };
}

/**
 * Eager loads the relationships of dot-notation names (`with`: `author`, `author.country`, `comments`), like Laravel's `with()`.
 * Segments that are not relationships of the model are ignored (JSON attributes); the loaded expression is an object, never a string.
 */
export function applyEagerLoading(query: any, model: any, paths: string[]): void {
    const resolved = [...new Set(paths.filter((path) => isIdentifierPath(path)).map((path) => relationshipSegments(model, path).join('.')).filter(Boolean))];
    if (resolved.length) query.withGraphFetched(relationExpression(resolved));
}

/**
 * Adds relationship aggregates to the select of a query, like Laravel's `withCount()`, `withExists()`, `withSum()`…: each one is a
 * correlated subquery selected under its alias. The model's own columns are selected first when the query has no select yet.
 */
export function applyRelationshipAggregates(query: any, model: any, aggregates: RelationshipAggregate[]): void {
    if (!aggregates.length) return;
    if (typeof query.hasSelects === 'function' && !query.hasSelects()) query.select(`${model.tableName}.*`);
    aggregates.forEach((aggregate, index) => {
        if (!isIdentifier(aggregate.relationship) || !isIdentifier(aggregate.alias) || (aggregate.column !== null && !isIdentifier(aggregate.column))) throw new Error(`Relationship aggregate: invalid name in ${JSON.stringify({ relationship: aggregate.relationship, column: aggregate.column, alias: aggregate.alias })}.`);
        const alias = `${aggregate.relationship}_agg${index}`;
        const sub = relatedQuery(model, aggregate.relationship, alias);
        aggregate.modify?.(sub);
        sub.clearSelect();
        if (aggregate.function === 'count') query.select(sub.count('*').as(aggregate.alias));
        else if (aggregate.function === 'exists') query.select(raw('case when exists ? then 1 else 0 end', [sub.select(raw('1'))]).as(aggregate.alias));
        else {
            if (aggregate.column === null) throw new Error(`Relationship aggregate ${aggregate.alias}: ${aggregate.function}() needs a column.`);
            query.select(sub[aggregate.function](`${alias}.${aggregate.column}`).as(aggregate.alias));
        }
    });
}

/** Casts aggregate values read from the database: counts become numbers, existence checks booleans (Laravel's casts). */
export function castRelationshipAggregates(records: any[], aggregates: RelationshipAggregate[]): void {
    for (const aggregate of aggregates) {
        if (aggregate.function !== 'count' && aggregate.function !== 'exists') continue;
        for (const record of records) {
            if (!record || typeof record !== 'object' || !(aggregate.alias in record)) continue;
            const value = record[aggregate.alias];
            record[aggregate.alias] = aggregate.function === 'count' ? Number(value ?? 0) : value === true || Number(value) === 1;
        }
    }
}

/**
 * The single related record of a dot-notation name on a record (`author.name` → the author), loaded when missing, with the
 * attribute to write; `null` when the name is not a relationship column, or when the relationship holds several records (or none).
 */
export async function relatedRecordFor(record: any, name: string): Promise<{ related: any; attribute: string } | null> {
    if (!(record instanceof Model)) return null;
    const column = resolveRelationshipColumn(record.constructor, name);
    if (!column) return null;
    await (record as any).$fetchGraph(relationExpression([column.relationships.join('.')]), { skipFetched: true });
    let node: any = record;
    for (const relationship of column.relationships) {
        node = node?.[relationship];
        if (Array.isArray(node) || !(node instanceof Model)) return null;
    }
    return { related: node, attribute: column.attribute };
}

/** Saves an attribute of the single related record of a dot-notation name (`TextInputColumn.make('author.name')`). */
export async function updateRelatedRecord(record: any, name: string, value: unknown): Promise<boolean> {
    const target = await relatedRecordFor(record, name);
    if (!target) return false;
    await target.related.$query().patch({ [target.attribute]: value });
    target.related[target.attribute] = value;
    return true;
}

/**
 * Query of the distinct related records of the records of `listQuery` through a relationship column (`items.price` → the items of
 * the listed orders), like Filament's relationship summaries: each related record is included once.
 */
export function relatedRecordsOf(listQuery: any, model: any, column: RelationshipColumn): any {
    const related = column.relatedModel;
    const idColumn = related.idColumn;
    if (Array.isArray(idColumn)) throw new Error(`Summaries through the relationship ${column.relationships.join('.')} need a related model with a single-column key.`);
    const alias = column.relationships.join(':');
    const keys = listQuery.clearSelect().clearOrder().joinRelated(column.relationships.join('.')).select(`${alias}.${idColumn}`);
    return related.query().whereIn(`${related.tableName}.${idColumn}`, keys);
}
