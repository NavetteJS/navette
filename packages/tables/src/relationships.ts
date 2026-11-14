// Relationship columns of tables: eager loading and relationship aggregates of the list query, and saving editable relationship
// columns. The names come from the table's declared columns and groups, never from the browser.
import { assertRelationshipSupport, jsonColumnExpression, relatedRecordFor, resolveRelationshipColumn, updateRelatedRecord, whereRelationshipExists, type DataAdapter, type ListQuery } from '@navette-js/database';
import { relationshipPathOf, type RelationshipAggregate } from '@navette-js/support';

/** What the list query needs from a column or group: its name, and the relationship aggregates it declares. */
type RelationshipSource = { name: string; getRelationshipAggregates?(): RelationshipAggregate[] };

/**
 * Adds to a list query the relationships to eager-load (the relationship part of dot-notation names: `author.name` loads
 * `author`) and the relationship aggregates of the given columns (`counts()`, `exists()`, `avg()`…), like Filament's
 * `applyEagerLoading()` / `applyRelationshipAggregates()`. Aggregates with the same alias are only added once.
 */
export function addRelationshipsToQuery(query: Omit<ListQuery, 'page' | 'perPage'>, sources: RelationshipSource[], groupColumns: string[] = []): void {
    const paths = [...sources.map((source) => source.name), ...groupColumns].map((name) => relationshipPathOf(name)).filter((path): path is string => path !== null);
    if (paths.length) query.with = [...new Set([...(query.with ?? []), ...paths])];
    const aggregates = sources.flatMap((source) => source.getRelationshipAggregates?.() ?? []);
    if (!aggregates.length) return;
    const known = new Set((query.aggregates ?? []).map((aggregate) => aggregate.alias));
    for (const aggregate of aggregates) {
        if (known.has(aggregate.alias)) continue;
        known.add(aggregate.alias);
        (query.aggregates ??= []).push(aggregate);
    }
}

/** Throws a clear error when the table's columns aggregate relationships and the adapter does not support relationships. */
export function ensureRelationshipSupport(adapter: Pick<DataAdapter, 'getLabel'> & { supportsRelationships?(): boolean }, query: Omit<ListQuery, 'page' | 'perPage'>): void {
    assertRelationshipSupport(adapter, query);
}

/**
 * Where an editable column with a dot-notation name writes, like Filament's `CanUpdateState`: the single related record of a
 * relationship column (`author.name` → the author's `name`), or a key of a JSON attribute of the record (`meta.lang`).
 */
export async function relationshipWriteTarget(record: unknown, name: string): Promise<{ relatedRecord: unknown | null; save: ((state: unknown) => Promise<void>) | null }> {
    const related = await relatedRecordFor(record, name);
    if (related) return { relatedRecord: related.related, save: async (state) => { await updateRelatedRecord(record, name, state); } };
    return { relatedRecord: null, save: null };
}

/**
 * Restricts a query to one group of a grouping on a relationship column (`Group.make('author.name')`), like Laravel's `whereHas()`.
 * Returns `false` when the column is not a relationship column of the query's model (the group scopes the column itself).
 */
export function groupScopeThroughRelationship(query: any, column: string, key: string | null, date: boolean): boolean {
    const model = typeof query?.modelClass === 'function' ? query.modelClass() : null;
    const relationship = model ? resolveRelationshipColumn(model, column) : null;
    const json = model && !relationship ? jsonColumnExpression(model, column) : null;
    if (json) {
        // A key of a JSON attribute (`meta.lang`).
        if (key === null) query.where((inner: any) => inner.whereRaw(`${json.sql} is null`, json.bindings).orWhereRaw(`${json.sql} = ?`, [...json.bindings, '']));
        else query.whereRaw(date ? `date(${json.sql}) = ?` : `${json.sql} = ?`, [...json.bindings, key]);
        return true;
    }
    if (!relationship) return false;
    if (key === null) query.whereNot((inner: any) => whereRelationshipExists(inner, model, relationship, (sub, qualified) => { sub.whereNotNull(qualified).whereNot(qualified, ''); }));
    else whereRelationshipExists(query, model, relationship, (sub, qualified) => { if (date) sub.whereRaw('date(??) = ?', [qualified, key]); else sub.where(qualified, key); });
    return true;
}
