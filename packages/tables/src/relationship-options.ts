// Options listed from the records of a relationship (select columns, select filters, query builder constraints): search on the
// server, labels computed from each record (`getOptionLabelFromRecordUsing()`), and lookup of picked keys.
import { MAX_LIST_VALUES, sqlDialectOf, type RelationshipQueryModifier } from './query-builder.ts';

/** What to load: only `keys`, or records matching `search` in `searchColumns`, at most `limit`. */
export type RelatedOptionsRequest = {
    keys?: string[] | null;
    search?: string | null;
    /** Columns of the related table searched (the title attribute by default). */
    searchColumns?: string[] | null;
    limit?: number;
    /** Label of an option computed from the whole related record, instead of the title attribute. */
    labelFromRecord?: ((record: any) => string | Promise<string>) | null;
    /** Called with the related query and the search, after `modify` (Filament's `modifyQueryUsing(query, search)`). */
    modify?: ((query: any, search: string | null) => unknown) | RelationshipQueryModifier | null;
};

/** Column names written into the query: identifiers only (they come from the application, never from the browser). */
const isColumnName = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(name);
/** Escapes `%`, `_` and `!` (the escape character) so that the search term matches literally inside a LIKE pattern. */
const likePattern = (search: string) => `%${search.replace(/[!%_]/g, (character) => `!${character}`)}%`;

/**
 * `[key, label]` pairs of the related records of `relationship` (an Objection relationship of `model`). The search term is a
 * bound parameter matched case-insensitively with LIKE; keys are bound parameters too.
 */
export async function loadRelatedRecordOptions(model: any, relationship: string, titleAttribute: string | null, request: RelatedOptionsRequest = {}): Promise<[string, string][]> {
    if (typeof model?.getRelation !== 'function') throw new Error(`Relationship ${relationship}: the table's records must come from an Objection model with relationMappings.`);
    const related = model.getRelation(relationship).relatedModelClass;
    const table = String(related.tableName);
    const idColumn = String(related.idColumn);
    const id = `${table}.${idColumn}`;
    const titleColumn = titleAttribute ?? idColumn;
    const title = titleColumn.includes('.') ? titleColumn : `${table}.${titleColumn}`;
    const query = related.query();
    const search = typeof request.search === 'string' ? request.search.slice(0, 255) : null;
    (request.modify as ((query: any, search: string | null) => unknown) | null | undefined)?.(query, search);
    const keys = request.keys ?? null;
    if (keys !== null) {
        if (!keys.length) return [];
        query.whereIn(id, keys.slice(0, MAX_LIST_VALUES));
    }
    if (search !== null && search.trim() !== '') {
        const columns = (request.searchColumns?.length ? request.searchColumns : [titleColumn]).filter(isColumnName).map((column) => (column.includes('.') ? column : `${table}.${column}`));
        const operator = sqlDialectOf(query) === 'pg' ? 'ilike' : 'like';
        query.where((inner: any) => {
            for (const column of columns) inner.orWhereRaw(`lower(??) ${operator} lower(?) escape '!'`, [column, likePattern(search.trim())]);
        });
    }
    const limit = Math.max(1, Math.min(1000, Math.floor(request.limit ?? 1000)));
    if (request.labelFromRecord) {
        const records = await query.orderBy(title).limit(limit);
        return Promise.all(records.map(async (record: any): Promise<[string, string]> => [String(record[idColumn]), String(await request.labelFromRecord!(record))]));
    }
    const rows = await query.clearSelect().select({ __key: id, __title: title }).orderBy(title).limit(limit);
    return rows.map((row: any): [string, string] => [String(row.__key), String(row.__title ?? row.__key)]);
}
