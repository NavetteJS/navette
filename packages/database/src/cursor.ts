// Cursor pagination and search term helpers of the Objection adapter.

/** One ordering of a cursor-paginated query: a column (as given to `orderBy`) and its direction. */
export type CursorOrder = { column: string; direction: 'asc' | 'desc' };
/** Decoded cursor: the order column values of the record it points from, and the side it points to. */
export type Cursor = { values: Record<string, string | number | null>; pointsToNextItems: boolean };

const MAX_CURSOR_LENGTH = 2000;

/**
 * Encodes a cursor like Laravel does: base64url JSON of the order column values, plus `_pointsToNextItems`.
 * The values are read from the record (the attribute named after the last segment of each column).
 */
export function encodeCursor(record: Record<string, unknown>, orders: CursorOrder[], pointsToNextItems: boolean): string {
    const values: Record<string, unknown> = {};
    for (const order of orders) {
        const value = record[order.column.split('.').pop()!];
        values[order.column] = value instanceof Date ? value.toISOString() : (value ?? null);
    }
    return Buffer.from(JSON.stringify({ ...values, _pointsToNextItems: pointsToNextItems })).toString('base64url');
}

/**
 * Decodes a cursor received from the browser. Anything that is not a cursor for exactly these orderings, with scalar
 * values, gives `null` (the first page): the values are only ever used as bound query parameters.
 */
export function decodeCursor(encoded: unknown, orders: CursorOrder[]): Cursor | null {
    if (typeof encoded !== 'string' || encoded === '' || encoded.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { return null; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const data = parsed as Record<string, unknown>;
    if (typeof data._pointsToNextItems !== 'boolean') return null;
    const values: Record<string, string | number | null> = {};
    for (const order of orders) {
        if (!Object.prototype.hasOwnProperty.call(data, order.column)) return null;
        const value = data[order.column];
        if (value !== null && typeof value !== 'string' && typeof value !== 'number') return null;
        values[order.column] = value as string | number | null;
    }
    if (Object.keys(data).length !== orders.length + 1) return null;
    return { values, pointsToNextItems: data._pointsToNextItems };
}

/**
 * Adds the keyset condition of a cursor: `(a > x) or (a = x and b > y) or ...`, each comparison following its column's
 * direction (inverted when going back to previous items).
 */
export function applyCursorCondition(query: any, orders: CursorOrder[], cursor: Cursor): void {
    query.where((outer: any) => {
        orders.forEach((order, index) => {
            outer.orWhere((inner: any) => {
                for (const previous of orders.slice(0, index)) {
                    const value = cursor.values[previous.column];
                    if (value === null) inner.whereNull(previous.column); else inner.where(previous.column, value);
                }
                const ascending = (order.direction === 'asc') === cursor.pointsToNextItems;
                const value = cursor.values[order.column];
                // Null values sort first: after a null comes any value, before it nothing.
                if (value === null) { if (ascending) inner.whereNotNull(order.column); else inner.whereRaw('1 = 0'); }
                else inner.where(order.column, ascending ? '>' : '<', value);
            });
        });
    });
}

/**
 * Orderings of a Knex query (from its statements): only plain column orderings can be paginated with a cursor, as in
 * Laravel (which refuses raw orderings).
 */
export function cursorOrdersOf(query: any): CursorOrder[] {
    const statements = ((query.toKnexQuery?.() ?? query) as any)._statements as any[] | undefined;
    const orders: CursorOrder[] = [];
    for (const statement of statements ?? []) {
        if (statement.grouping !== 'order') continue;
        if (statement.type !== 'orderByBasic' || typeof statement.value !== 'string') throw new Error('Cursor pagination only supports orderings by a column: remove raw orderings (custom sort queries) or use another pagination mode.');
        const direction = String(statement.direction ?? 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
        if (!orders.some((order) => order.column === statement.value)) orders.push({ column: statement.value, direction });
    }
    return orders;
}

/**
 * Words of a search term, like Filament's `str_getcsv()` split: separated by spaces, a double-quoted phrase being one word.
 */
export function searchWords(search: string): string[] {
    const words: string[] = [];
    const pattern = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
    const normalized = search.replace(/[\sㅤᅠ]+/gu, ' ').trim();
    for (const match of normalized.matchAll(pattern)) {
        const word = match[1] !== undefined ? match[1].replace(/\\(.)/g, '$1') : match[2];
        if (word.trim() !== '') words.push(word);
    }
    return words;
}
