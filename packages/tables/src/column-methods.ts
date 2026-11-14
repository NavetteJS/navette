// Methods of a column called by its JavaScript (Filament's `callTableColumnMethod()`), e.g. the server-side search of a
// select column. Everything comes from the browser: only a few read-only methods of a declared, visible column are reachable,
// for a record within the table's scope.
import type { DataAdapter } from '@navette-js/database';
import { getVisibleColumns, SelectColumn, type Table, type TableHost } from './index.ts';

/** Methods a column's JavaScript may call, by column type. */
export const TABLE_COLUMN_METHODS = ['getOptionLabel', 'getOptionsForJs', 'getOptionsSearchResultsForJs'] as const;

/**
 * Runs `method` of the visible column `columnName` for the record `recordKey`. Returns `null` for anything unknown: an
 * undeclared or hidden column, a method that is not exposed, or a record outside the adapter's scope.
 */
export async function callTableColumnMethod<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>, columnName: unknown, recordKey: unknown, method: unknown, args: unknown = null): Promise<unknown> {
    if (typeof method !== 'string' || !(TABLE_COLUMN_METHODS as readonly string[]).includes(method)) return null;
    const column = getVisibleColumns(table, host).find((candidate) => candidate.name === columnName);
    if (!(column instanceof SelectColumn)) return null;
    if (typeof recordKey !== 'string' && typeof recordKey !== 'number') return null;
    const record = (await adapter.keysInScope([String(recordKey)])).length ? await adapter.find(String(recordKey)) : null;
    if (!record) return null;
    if (method === 'getOptionLabel') return column.getOptionLabelForJs(record);
    if (method === 'getOptionsForJs') return column.getOptionsForJsFor(record);
    const search = args && typeof args === 'object' && typeof (args as Record<string, unknown>).search === 'string' ? (args as Record<string, string>).search : '';
    return column.getOptionsSearchResultsForJsFor(record, search.slice(0, 1000));
}
