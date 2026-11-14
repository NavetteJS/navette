// @navette-js/panels — child component showing the table of a `TableSelect` (Filament's TableSelectLivewireComponent).
// It is a list page without actions: search, filters, sorting, pagination and the column manager, plus record checkboxes
// bound to the field's state (`wire:model` on the child, `state` here).
//
// The class extends `ListRecords`, declared in `./index.ts`: it is built by a factory called once `ListRecords` exists.
import { WireError } from '@navette-js/wire';
import { getTableSelectDataAdapter, getTableSelectDefinition, type TableSelectDefinition } from '@navette-js/forms';
import { MAX_UNPAGINATED_RECORDS, filterSelectableKeys, getTableQuery, getTableRecords, initializeTableGrouping, makeTableSelectTable, renderTable, type Table } from '@navette-js/tables';
import type { ListRecords as ListRecordsBase } from './index.ts';

export function createTableSelectComponent(ListRecords: typeof ListRecordsBase) {
    return class TableSelectComponent extends ListRecords {
        static callable = ['getAllSelectableTableRecordKeys'];
        static locked = ['definition', 'isMultiple', 'maxSelectableRecords', 'tableArguments'];
        /** Set by the form on every render, never by the browser. */
        static reactive = ['isDisabled'];
        /** Id of the field's table definition (see `getTableSelectDefinition()`). */
        definition = '';
        isDisabled = false;
        isMultiple = false;
        maxSelectableRecords: number | null = null;
        tableArguments: Record<string, unknown> = {};
        /** Selected key (or keys): bound to the field's state. Checked by the field on the server, never trusted here. */
        state: string | string[] | null = null;
        _definition: TableSelectDefinition | null = null;
        _selectFacade: any = null;

        getDefinition(): TableSelectDefinition {
            if (this._definition) return this._definition;
            const definition = getTableSelectDefinition(String(this.definition));
            // Registered when the form is built: missing after a restart until the page is reloaded.
            if (!definition) throw new WireError(419, 'Table select definition not found: reload the page.');
            return (this._definition = definition);
        }
        /** What ListRecords expects from a resource: the configuration's adapter and labels; viewing only. */
        get resource(): any {
            if (this._selectFacade) return this._selectFacade;
            const definition = this.getDefinition();
            const configuration = definition.configuration as any;
            const plural = typeof configuration.getPluralModelLabel === 'function' ? configuration.getPluralModelLabel() : (configuration.pluralModelLabel ?? 'records');
            return (this._selectFacade = {
                isSimple: true, slug: '', modelLabel: configuration.modelLabel ?? 'record', relations: [], adapter: getTableSelectDataAdapter(definition),
                // The table only shows records: editing cells, reordering or deleting from it is refused.
                can: (ability: string, user: unknown) => (ability === 'viewAny' && typeof configuration.can === 'function' ? configuration.can('viewAny', user) : ability === 'viewAny' || ability === 'view'),
                getPluralModelLabel: () => plural,
                getTitleCasePluralModelLabel: () => plural,
                getRecordTitle: () => configuration.modelLabel ?? 'record',
                table: (table: Table) => table, getUrl: () => '', form: (schema: any) => schema,
            });
        }
        /** On mount, `boot()` runs before the props are set: access is then checked in `mount()`. */
        protected isAccessAuthorized(ctx: any): Promise<boolean> { return Promise.resolve(this.definition === '' ? true : this.resource.can('viewAny', ctx.user)); }
        getTable(): Table {
            const definition = this.getDefinition();
            const table = makeTableSelectTable(definition.configuration, this.tableArguments && typeof this.tableArguments === 'object' ? this.tableArguments : {});
            if (table.getPluralModelLabel() === 'records') table.pluralModelLabel(this.resource.getPluralModelLabel());
            return table
                .headerActions([]).recordActions([]).toolbarActions([]).emptyStateActions([]).groupedBulkActions([])
                .recordAction(null)
                .reorderable(null)
                .persistFiltersInSession(false).persistSearchInSession(false).persistColumnSearchesInSession(false).persistSortInSession(false).persistGroupingInSession(false)
                .maxSelectableRecords(this.isMultiple ? this.maxSelectableRecords : 1);
        }
        async mount(): Promise<void> {
            if (!(await this.resource.can('viewAny', (this._ctx as any)?.user ?? null))) throw new WireError(403, 'Forbidden.');
            const table = this.getTable();
            this.tableFilters = table.getDefaultFilterState();
            this.tableDeferredFilters = table.getDefaultFilterState();
            this.tableColumns = table.getDefaultColumnState();
            this.tableRecordsPerPage = table.getDefaultPageOption() as number;
            initializeTableGrouping(table, this as any);
        }
        /** Relationship constraints of the field, on top of the table's own query. */
        modifyTableQuery(query: { modifiers?: ((q: any) => void)[] }): void {
            for (const modifier of this.getDefinition().modifiers) (query.modifiers ??= []).push((q) => { modifier(q); });
        }
        getTabs(): Record<string, any> { return {}; }
        getHeaderActions(): any[] { return []; }
        getBulkActions(): any[] { return []; }
        getRecordActions(): any[] { return []; }
        protected getMountableActions(context: Record<string, unknown>): any[] | Promise<any[]> {
            // Only the actions of the filters form fields (a searchable filter select…).
            return typeof context.schemaComponent === 'string' ? this.getSchemaComponentActions(context.schemaComponent) : [];
        }
        protected async resolveActionRecord(): Promise<unknown> { return null; }
        /** The selection survives filtering and searching (Filament's `deselectAllRecordsWhenFiltered(false)`). */
        dispatch(name: string, params: Record<string, unknown> | unknown[] = {}, options: { self?: boolean } = {}): void {
            if (name === 'deselectAllTableRecords') return;
            super.dispatch(name, params, options);
        }
        /** "Select all": every selectable record of the current query (or page), up to the selection limit. */
        async getAllSelectableTableRecordKeys(): Promise<string[]> {
            if (this.isDisabled) return [];
            const table = this.getTable(), adapter = this.resource.adapter;
            const keys = table.selectsCurrentPageOnly()
                ? (await getTableRecords(table, this, adapter)).records.map((record: any) => adapter.getKey(record))
                : (await adapter.listKeys(getTableQuery(table, this))).slice(0, MAX_UNPAGINATED_RECORDS);
            const selectable = await filterSelectableKeys(table, adapter, keys);
            const max = table.getMaxSelectableRecords();
            return max !== null ? selectable.slice(0, max) : selectable;
        }
        async renderTable(): Promise<string> {
            const table = this.getTable();
            return renderTable(table, this, this.resource.adapter, {
                selection: { property: 'state', disabled: this.isDisabled },
                canReorder: false,
                filtersForm: table.getFilters().length ? await this.getSchema('tableFiltersForm').toHtml() : null,
                after: await this.renderActionModals(),
            });
        }
        async render(): Promise<string> { return this.renderTable(); }
    };
}
