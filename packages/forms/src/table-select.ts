// @navette-js/forms — picking records from a table: `TableSelect` (the table in the form) and `ModalTableSelect` (a button
// opening the table in a slide-over). The table is a child component of the page, built by the panels package.
//
// This module holds what the fields share with the tables and panels packages; the field classes, which extend `Field`,
// are declared in `./index.ts`.

/**
 * Table configuration of a `TableSelect`: a class (or an object) with a `name` and a `configure(table)` method returning the
 * table. A resource class works as well (its `table()` and its `adapter`).
 * The records come from its `adapter` (or `getDataAdapter()`) when it has one, otherwise from the field's relationship.
 */
export type TableConfiguration = {
    readonly name: string;
    configure?: (table: any) => any;
    table?: (table: any) => any;
    adapter?: any;
    getDataAdapter?: () => any;
    /** Resource-like access check: the table is shown only if `can('viewAny', user)` allows it. */
    can?: (ability: string, user: any, record?: unknown) => boolean | Promise<boolean>;
    getPluralModelLabel?: () => string;
    pluralModelLabel?: string | null;
};

/** What the table child component needs to rebuild the table on its own requests. */
export type TableSelectDefinition = {
    /** Stable identifier: the same field declaration gives the same id in every process. */
    id: string;
    configuration: TableConfiguration;
    /** Related model of the field's relationship: the records come from it when the configuration has no adapter. */
    model: any | null;
    /** Relationship query constraints (`relationship(…, modifyQueryUsing)`), applied to the table and to validation. */
    modifiers: ((query: any) => unknown)[];
};

/** Table operations, provided by `@navette-js/tables` (which depends on this package). */
export interface TableSelectDriver {
    /** A new table set up by the configuration, with its arguments (`table.getArguments()`). */
    makeTable(configuration: TableConfiguration, args: Record<string, unknown>): any;
    /** Data adapter of an Objection model. */
    adapterForModel(model: any): any;
    /** The keys, among `keys`, that the table can show and select: adapter scope, queries, record selectability. */
    selectableKeys(definition: TableSelectDefinition, args: Record<string, unknown>, keys: string[]): Promise<string[]>;
    /** Records of these keys (relationship scope), for their labels. */
    findRecords(definition: TableSelectDefinition, keys: string[]): Promise<any[]>;
}
let driver: TableSelectDriver | null = null;
export function useTableSelectDriver(implementation: TableSelectDriver): void { driver = implementation; }
/** @internal */
export function requireTableSelectDriver(): TableSelectDriver {
    if (!driver) throw new Error('TableSelect needs @navette-js/tables to be loaded.');
    return driver;
}

const definitions = new Map<string, TableSelectDefinition>();
/**
 * Definition registered by a field when it was built in this process (`null` otherwise). The table child component looks it
 * up on each of its requests: its id is a locked (signed) property, so the browser cannot pick another one.
 */
export function getTableSelectDefinition(id: string): TableSelectDefinition | null { return definitions.get(id) ?? null; }
/** @internal Registers a field's table definition (see `getTableSelectDefinition()`). */
export function registerTableSelectDefinition(definition: TableSelectDefinition): void { definitions.set(definition.id, definition); }
/** Data adapter of the table: the configuration's own, or one for the relationship's related model. */
export function getTableSelectDataAdapter(definition: TableSelectDefinition): any {
    const configuration = definition.configuration as any;
    const own = typeof configuration.getDataAdapter === 'function' ? configuration.getDataAdapter() : configuration.adapter;
    if (own) return own;
    if (definition.model) return requireTableSelectDriver().adapterForModel(definition.model);
    throw new Error(`Table configuration [${configuration.name}]: no data adapter. Give it an adapter, or use relationship() on the field.`);
}

/** @internal */
export type TableSelectRelationship = { name: string; title: string | null; modify: ((query: any) => unknown) | null; model: any };
/** @internal */
export type TableSelectOptions = [string, string][] | Record<string, string>;

/** @internal Writes a value at a state path of the host component. */
export function writeTableSelectState(target: any, path: string, value: unknown): void {
    const segments = path.split('.');
    let node = target;
    for (const segment of segments.slice(0, -1)) {
        if (node[segment] === null || typeof node[segment] !== 'object') node[segment] = {};
        node = node[segment];
    }
    node[segments[segments.length - 1]] = value;
}
/** @internal A key sent by the browser: a non-empty string or a finite number. */
export const isTableSelectKey = (value: unknown): value is string | number => (typeof value === 'string' && value !== '') || (typeof value === 'number' && Number.isFinite(value));
