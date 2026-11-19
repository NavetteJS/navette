/** Records for keys, in the order of the keys (`null` for a missing one): one query when the adapter has `findMany()`, else one `find()` per key. */
export async function findRecords<R>(adapter: { find(key: string): Promise<R | null>; findMany?(keys: string[]): Promise<(R | null)[]> }, keys: string[]): Promise<(R | null)[]> {
    if (typeof adapter.findMany === 'function') return adapter.findMany(keys);
    return Promise.all(keys.map((key) => adapter.find(key)));
}
