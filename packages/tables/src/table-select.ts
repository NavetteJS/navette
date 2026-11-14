// @navette-js/tables — the table side of the forms' `TableSelect` and `ModalTableSelect`: builds their table and checks the
// keys the browser selected against the table's own query. Registered with @navette-js/forms when this package loads.
import { getTableSelectDataAdapter, useTableSelectDriver, type TableConfiguration, type TableSelectDefinition } from '@navette-js/forms';
import { ObjectionAdapter } from '@navette-js/database';
import { Table, filterSelectableKeys } from './index.ts';

/** A table set up by a `TableSelect` configuration (`configure(table)`, or a resource's `table(table)`), with its arguments. */
export function makeTableSelectTable(configuration: TableConfiguration, args: Record<string, unknown> = {}): Table {
    const table = new Table().arguments(args);
    const configure = typeof configuration.configure === 'function' ? configuration.configure : configuration.table!;
    const result = configure.call(configuration, table);
    return result instanceof Table ? result : table;
}

const modelAdapters = new WeakMap<object, ObjectionAdapter<any>>();
const adapterForModel = (model: any): ObjectionAdapter<any> => {
    let adapter = modelAdapters.get(model);
    if (!adapter) modelAdapters.set(model, (adapter = new ObjectionAdapter(model)));
    return adapter;
};
/** Relationship and table query constraints, as list query modifiers. */
const modifiersOf = (definition: TableSelectDefinition, table: Table | null): ((query: any) => void)[] =>
    [...definition.modifiers, ...(table?.getQueryModifiers() ?? [])].map((modifier) => (query: any) => { modifier(query); });

useTableSelectDriver({
    makeTable: makeTableSelectTable,
    adapterForModel,
    /**
     * Keys the table can show and select, whatever the browser sent: the adapter's scope (its `modify` and the tenant), the
     * relationship's and the table's queries (`modifyQueryUsing()`, which may depend on the arguments), soft-deleted records
     * left out, and `checkIfRecordIsSelectableUsing()`. Filters chosen in the table only narrow what is displayed.
     */
    async selectableKeys(definition, args, keys) {
        if (!keys.length) return [];
        const adapter = getTableSelectDataAdapter(definition);
        const table = makeTableSelectTable(definition.configuration, args);
        const found = new Set(await adapter.listKeys({ keys, modifiers: modifiersOf(definition, table) }));
        return filterSelectableKeys(table, adapter, keys.filter((key) => found.has(key)));
    },
    async findRecords(definition, keys) {
        if (!keys.length) return [];
        const adapter = getTableSelectDataAdapter(definition);
        return (await adapter.paginate({ keys, modifiers: modifiersOf(definition, null), page: 1, perPage: keys.length })).records;
    },
});
