// @navette-js/forms — picking records from a table: `TableSelect` (the table in the form) and `ModalTableSelect` (a button
// opening the table in a slide-over). The table is a child component of the page, built by the panels package.
//
// The classes extend `Field`, declared in `./index.ts`, which re-exports them: they are built by a factory called once
// `Field` exists, so that the two modules can import each other.
import { Attributes, configured, e, evaluate, type ColorManager, type Lazy } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { Action } from '@navette-js/actions';
import type { ComponentContext } from '@navette-js/schemas';
import { createHash } from 'node:crypto';
import type { Field as FieldBase, Rule } from './index.ts';

/**
 * Table configuration of a `TableSelect`: a class (or an object) with a `name` and a `configure(table)` method returning the
 * table, like Filament's table configuration classes. A resource class works as well (its `table()` and its `adapter`).
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
function requireDriver(): TableSelectDriver {
    if (!driver) throw new Error('TableSelect needs @navette-js/tables to be loaded.');
    return driver;
}

const definitions = new Map<string, TableSelectDefinition>();
/**
 * Definition registered by a field when it was built in this process (`null` otherwise). The table child component looks it
 * up on each of its requests: its id is a locked (signed) property, so the browser cannot pick another one.
 */
export function getTableSelectDefinition(id: string): TableSelectDefinition | null { return definitions.get(id) ?? null; }
/** Data adapter of the table: the configuration's own, or one for the relationship's related model. */
export function getTableSelectDataAdapter(definition: TableSelectDefinition): any {
    const configuration = definition.configuration as any;
    const own = typeof configuration.getDataAdapter === 'function' ? configuration.getDataAdapter() : configuration.adapter;
    if (own) return own;
    if (definition.model) return requireDriver().adapterForModel(definition.model);
    throw new Error(`Table configuration [${configuration.name}]: no data adapter. Give it an adapter, or use relationship() on the field.`);
}

type RelationshipSpec = { name: string; title: string | null; modify: ((query: any) => unknown) | null; model: any };
type OptionList = [string, string][] | Record<string, string>;

/** Writes a value at a state path of the host component. */
function writeState(target: any, path: string, value: unknown): void {
    const segments = path.split('.');
    let node = target;
    for (const segment of segments.slice(0, -1)) {
        if (node[segment] === null || typeof node[segment] !== 'object') node[segment] = {};
        node = node[segment];
    }
    node[segments[segments.length - 1]] = value;
}
const isKey = (value: unknown): value is string | number => (typeof value === 'string' && value !== '') || (typeof value === 'number' && Number.isFinite(value));

export function createTableSelectFields(deps: { Field: typeof FieldBase; colors: () => ColorManager | null }) {
    /** Shared by both fields: table configuration, relationship, selection rules and saving. */
    abstract class TableSelectField extends deps.Field {
        protected _tableConfiguration: Lazy<TableConfiguration | null, ComponentContext> = null;
        protected _tableArguments: Lazy<Record<string, unknown>, ComponentContext> = {};
        protected _relationship: RelationshipSpec | null = null;
        protected _multiple = false;
        protected _maxItems: number | null = null;
        protected _minItems: number | null = null;
        /** Definition handed down by a `ModalTableSelect` to the `TableSelect` of its modal. */
        protected _definition: TableSelectDefinition | null = null;

        /** The table's configuration (see `TableConfiguration`), or a function returning it. */
        tableConfiguration(configuration: Lazy<TableConfiguration | null, ComponentContext>): this { this._tableConfiguration = configuration; return this; }
        async getTableConfiguration(): Promise<TableConfiguration> {
            // A class is a function too: one with `configure()` (or a resource's `table()`) is the configuration itself.
            const value = this._tableConfiguration as any;
            const isConfiguration = value && (typeof value.configure === 'function' || typeof value.table === 'function');
            const configuration: TableConfiguration | null = isConfiguration ? value : await evaluate(this._tableConfiguration, this.context());
            if (!configuration) throw new Error('The [tableConfiguration()] method must be set when using a [TableSelect] component.');
            if (typeof configuration.name !== 'string' || configuration.name === '') throw new Error('A table configuration needs a name (use a class, or an object with a `name`).');
            if (typeof configuration.configure !== 'function' && typeof configuration.table !== 'function') throw new Error(`Table configuration [${configuration.name}] does not have a [configure(table)] method.`);
            return configuration;
        }
        /** Values passed to the table configuration, read there with `table.getArguments()`. They must be JSON values. */
        tableArguments(args: Lazy<Record<string, unknown>, ComponentContext>): this { this._tableArguments = args; return this; }
        async getTableArguments(): Promise<Record<string, unknown>> {
            const args = await evaluate(this._tableArguments, this.context());
            return args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
        }
        /** Several records can be selected: the state is a list of keys. */
        multiple(condition = true): this { this._multiple = condition; return this; }
        isMultiple(): boolean { return this._multiple; }
        /** Maximum (and minimum) number of selected records, checked on the server. */
        maxItems(count: number | null): this { this._maxItems = count; return this; }
        minItems(count: number | null): this { this._minItems = count; return this; }
        getMaxItems(): number | null { return this._maxItems; }
        getMinItems(): number | null { return this._minItems; }
        /** @internal Uses another field's table definition (the `TableSelect` of a `ModalTableSelect`). */
        useDefinition(definition: TableSelectDefinition | null): this { this._definition = definition; return this; }
        getRelationshipName(): string | null { return this._relationship?.name ?? null; }
        hasRelationship(): boolean { return this._relationship !== null; }

        protected relationInfo() {
            const spec = this._relationship!;
            const host = this.context().livewire as any;
            const adapter = host.getDataAdapter?.() ?? host.getDataAdapterForTable?.() ?? host.resource?.adapter ?? null;
            const model = spec.model ?? adapter?.model;
            if (typeof model !== 'function' || typeof model.getRelation !== 'function') throw new Error('relationship(): the form has no Objection model; pass it with the `model` option.');
            const relation = model.getRelation(spec.name);
            const related = relation.relatedModelClass;
            const isMany = /ManyToMany/.test(relation.constructor?.name ?? '') || typeof relation.joinTable === 'string';
            return { model, related, isMany };
        }
        /** The table's definition, registered so that the table child component finds it again. */
        async getDefinition(): Promise<TableSelectDefinition> {
            if (this._definition) return this._definition;
            const configuration = await this.getTableConfiguration();
            const related = this._relationship ? this.relationInfo().related : null;
            const owner = (this.context().livewire as any)?.constructor?.name ?? '';
            const fingerprint = [owner, this.getName(), this._relationship?.name ?? '', related?.tableName ?? ''].join('|');
            const id = `${configuration.name}.${createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)}`;
            const definition: TableSelectDefinition = { id, configuration, model: related, modifiers: this._relationship?.modify ? [this._relationship.modify] : [] };
            definitions.set(id, definition);
            return definition;
        }
        /** Selected keys: unique strings, whatever the state holds. */
        selectedValues(): string[] {
            const state = this.context().state;
            return [...new Set((Array.isArray(state) ? state : [state]).filter(isKey).map(String))];
        }
        /** The selected keys the table allows (adapter and tenant scope, table and relationship queries, selectable records). */
        async getSelectableValues(values: string[] = this.selectedValues()): Promise<string[]> {
            if (!values.length) return [];
            return requireDriver().selectableKeys(await this.getDefinition(), await this.getTableArguments(), values.slice(0, 1000));
        }
        getDefaultState(): unknown { return this._default ?? (this._multiple ? [] : null); }
        hydrateState(value: unknown): unknown {
            if (this._multiple) return (Array.isArray(value) ? value : []).filter(isKey).map(String);
            return isKey(value) ? String(value) : null;
        }
        dehydrateState(state: unknown): unknown { return this._multiple ? this.selectedValues() : isKey(state) ? state : null; }
        async getValidationRules(): Promise<Rule[]> {
            const count = (value: unknown) => (Array.isArray(value) ? new Set(value.filter(isKey).map(String)).size : 0);
            const rules: Rule[] = [];
            if (this._multiple && this._minItems !== null) rules.push({ name: 'min', passes: (v) => count(v) >= this._minItems!, message: (a) => `The ${a} field must have at least ${this._minItems} items.` });
            if (this._multiple && this._maxItems !== null) rules.push({ name: 'max', passes: (v) => count(v) <= this._maxItems!, message: (a) => `The ${a} field must not have more than ${this._maxItems} items.` });
            // Keys come from the browser: each one must be a record of the table's own query.
            rules.push({
                name: 'in',
                passes: async (v) => {
                    const values = Array.isArray(v) ? v : [v];
                    if (!this._multiple && Array.isArray(v)) return false;
                    if (!values.every(isKey)) return false;
                    const unique = [...new Set(values.map(String))];
                    if (unique.length > 1000) return false;
                    return (await this.getSelectableValues(unique)).length === unique.length;
                },
                message: (a) => `The selected ${a} is invalid.`,
            });
            return [...(await super.getValidationRules()), ...rules];
        }
        private isManyRelationship(): boolean { return this._relationship !== null && this.relationInfo().isMany; }
        async savesRelationships(): Promise<boolean> { return (await super.savesRelationships()) || this.isManyRelationship(); }
        async loadStateFromRelationships(record: any): Promise<{ state: unknown } | null> {
            if (!this.isManyRelationship()) return super.loadStateFromRelationships(record);
            const { model, related } = this.relationInfo();
            const rows = await model.relatedQuery(this._relationship!.name).for(record[model.idColumn]).clearSelect().select(`${related.tableName}.${related.idColumn} as __key`);
            return { state: rows.map((row: any) => String(row.__key)) };
        }
        /** Many-to-many: links the selected records the table allows, and unlinks the others. */
        async saveRelationships(record: any): Promise<void> {
            if (!this.isManyRelationship()) return super.saveRelationships(record);
            const { model, related } = this.relationInfo();
            const key = record[model.idColumn];
            const desired = new Set(await this.getSelectableValues());
            const current = (await this.loadStateFromRelationships(record))!.state as string[];
            const removed = current.filter((value) => !desired.has(value));
            if (removed.length) await model.relatedQuery(this._relationship!.name).for(key).unrelate().whereIn(`${related.tableName}.${related.idColumn}`, removed);
            for (const value of desired) if (!current.includes(value)) await model.relatedQuery(this._relationship!.name).for(key).relate(related.idColumn === 'id' && /^\d+$/.test(value) ? Number(value) : value);
            await super.saveRelationships(record);
        }
        async getLabel(): Promise<string> {
            // Label from the relationship name (`relationship('category')` → "Category"), like a Select.
            if (this._label === null && this._relationship) {
                const name = this._relationship.name.split('.')[0].replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
                return name.charAt(0).toUpperCase() + name.slice(1);
            }
            return super.getLabel();
        }
        protected setState(value: unknown): void { writeState(this.livewire as any, this.getStatePath(), value); }
    }

    /**
     * A table embedded in the form, with a checkbox on each row: the state is the selected key (or keys, with `multiple()`).
     * Searching, filtering and paging happen in the table's own child component; selected keys are checked on the server
     * against the table's query when the form is validated.
     */
    class TableSelect extends TableSelectField {
        static make(name: string): TableSelect { return configured(new TableSelect(name)); }
        /**
         * Records of a relationship of the form's model: a belongs-to relationship (the field is the foreign key), or a
         * many-to-many one with `multiple()` (the field saves the links once the record is saved). `modifyQueryUsing(query)`
         * restricts the records shown and accepted.
         */
        relationship(name: string, modifyQueryUsing: ((query: any) => unknown) | null = null, options: { model?: any } = {}): this {
            this._relationship = { name, title: null, modify: modifyQueryUsing, model: options.model ?? null };
            return this;
        }
        async toHtml(): Promise<string> {
            const host = this.livewire as any;
            const componentName = host.getTableSelectComponentName?.();
            if (typeof componentName !== 'string' || typeof host.mountChild !== 'function') throw new Error('TableSelect must be rendered by a panel page.');
            const definition = await this.getDefinition();
            const statePath = this.getStatePath();
            const state = this._multiple ? this.selectedValues() : (this.selectedValues()[0] ?? null);
            const child = await host.mountChild(componentName, {
                definition: definition.id,
                isDisabled: await this.isDisabled(),
                isMultiple: this._multiple,
                maxSelectableRecords: this._multiple ? this._maxItems : 1,
                tableArguments: await this.getTableArguments(),
                state,
            }, this.getLivewireKey(), { model: { property: 'state', outer: statePath, directive: this.wireModel() } });
            const id = this.getId();
            const describedBy = this.hasError() ? `${id}-error` : null;
            const attributes = new Attributes().merge({ 'aria-labelledby': `${id}-label`, id, role: 'group', 'aria-describedby': describedBy });
            return this.wrap(`<div ${attributes.toHtml()}>${child}</div>`, { labelAsDiv: true });
        }
    }

    /**
     * Shows the selected records' labels, and a "Select" button opening the table in a slide-over, where the user checks
     * one record (or several, with `multiple()`). Labels come from the relationship's title attribute, or from
     * `getOptionLabelFromRecordUsing()`.
     */
    class ModalTableSelect extends TableSelectField {
        private _placeholder: string | null = null;
        private _hasBadges: boolean | null = null;
        private _badgeColor: Lazy<string | null, ComponentContext> = null;
        private _optionLabelFromRecord: ((record: any, ctx: ComponentContext) => string | Promise<string>) | null = null;
        private _optionLabelUsing: ((value: string, ctx: ComponentContext) => string | null | Promise<string | null>) | null = null;
        private _optionLabelsUsing: ((values: string[], ctx: ComponentContext) => OptionList | Promise<OptionList>) | null = null;
        private _modifySelectAction: ((action: Action, ctx: ComponentContext) => Action | void) | null = null;
        private _modifyTableSelect: ((select: TableSelect, ctx: ComponentContext) => TableSelect | void) | null = null;
        static make(name: string): ModalTableSelect { return configured(new ModalTableSelect(name)); }
        /**
         * Records of a relationship of the form's model: a belongs-to relationship (the field is the foreign key), or a
         * many-to-many one with `multiple()`. `titleAttribute` is the column shown as the label of a selected record;
         * `modifyQueryUsing(query)` restricts the records shown and accepted.
         */
        relationship(name: string, titleAttribute: string | null = null, modifyQueryUsing: ((query: any) => unknown) | null = null, options: { model?: any } = {}): this {
            this._relationship = { name, title: titleAttribute, modify: modifyQueryUsing, model: options.model ?? null };
            return this;
        }
        /** Text shown when nothing is selected. */
        placeholder(placeholder: string | null): this { this._placeholder = placeholder; return this; }
        /** Labels in badges (by default with `multiple()` only). */
        badge(condition: boolean | null = true): this { this._hasBadges = condition; return this; }
        hasBadges(): boolean { return this._hasBadges ?? this._multiple; }
        badgeColor(color: Lazy<string | null, ComponentContext>): this { this._badgeColor = color; return this; }
        /** Label of a selected record, from the record (`(record) => \`${record.name} (${record.slug})\``). */
        getOptionLabelFromRecordUsing(callback: ((record: any, ctx: ComponentContext) => string | Promise<string>) | null): this { this._optionLabelFromRecord = callback; return this; }
        /** Label of the selected key (single selection), instead of reading the record. */
        getOptionLabelUsing(callback: ((value: string, ctx: ComponentContext) => string | null | Promise<string | null>) | null): this { this._optionLabelUsing = callback; return this; }
        /** Labels of the selected keys (`multiple()`): `[key, label]` pairs or an object. */
        getOptionLabelsUsing(callback: ((values: string[], ctx: ComponentContext) => OptionList | Promise<OptionList>) | null): this { this._optionLabelsUsing = callback; return this; }
        /** Customizes the "Select" action: label, modal heading, submit label, width… */
        selectAction(callback: ((action: Action, ctx: ComponentContext) => Action | void) | null): this { this._modifySelectAction = callback; return this; }
        /** Customizes the `TableSelect` shown in the modal. */
        tableSelect(callback: ((select: TableSelect, ctx: ComponentContext) => TableSelect | void) | null): this { this._modifyTableSelect = callback; return this; }

        /** Labels of keys: `[key, label]`, in the order of `values`; keys without a record are left out. */
        private async labelsOf(values: string[]): Promise<[string, string][]> {
            if (!values.length) return [];
            const ctx = this.context();
            let known: [string, string][];
            if (this._multiple && this._optionLabelsUsing) {
                const labels = await this._optionLabelsUsing(values, ctx);
                known = (Array.isArray(labels) ? labels : Object.entries(labels)).map(([value, label]): [string, string] => [String(value), String(label)]);
            } else if (!this._multiple && this._optionLabelUsing) {
                const label = await this._optionLabelUsing(values[0], ctx);
                known = label === null || label === undefined ? [] : [[values[0], String(label)]];
            } else if (this._relationship || this._optionLabelFromRecord) {
                const definition = await this.getDefinition();
                const adapter = getTableSelectDataAdapter(definition);
                const title = this._relationship?.title ?? null;
                known = [];
                for (const record of await requireDriver().findRecords(definition, values)) {
                    const label = this._optionLabelFromRecord ? await this._optionLabelFromRecord(record, ctx) : title !== null ? record?.[title] : adapter.getKey(record);
                    known.push([adapter.getKey(record), String(label ?? adapter.getKey(record))]);
                }
            } else {
                known = values.map((value): [string, string] => [value, value]);
            }
            const map = new Map(known);
            return values.filter((value) => map.has(value)).map((value): [string, string] => [value, map.get(value)!]);
        }
        /** Label of the selected record (single selection). */
        async getOptionLabel(): Promise<string | null> {
            const [value] = this.selectedValues();
            return value === undefined ? null : ((await this.labelsOf([value]))[0]?.[1] ?? value);
        }
        /** Labels of the selected records (`multiple()`), by key. */
        async getOptionLabels(): Promise<[string, string][]> {
            const values = this.selectedValues();
            const labels = new Map(await this.labelsOf(values));
            return values.map((value): [string, string] => [value, labels.get(value) ?? value]);
        }

        /** The `TableSelect` of the modal: same table, relationship and limits. */
        async getTableSelect(): Promise<TableSelect> {
            const select = TableSelect.make('selection').label(await this.getLabel()).hiddenLabel()
                .tableConfiguration(await this.getTableConfiguration())
                .tableArguments(await this.getTableArguments())
                .multiple(this._multiple).maxItems(this._maxItems).minItems(this._minItems)
                .useDefinition(await this.getDefinition());
            return this._modifyTableSelect?.(select, this.context()) ?? select;
        }
        /** Actions mounted on the field: its hint actions and the "Select" action. */
        getActions(): Action[] { return [...this.getHintActions(), this.getSelectAction()]; }
        /** "Select" button: opens the table in a slide-over; its submit button copies the selection into the field. */
        getSelectAction(): Action {
            const blank = this.selectedValues().length === 0;
            const action = Action.make('select')
                .label(t('filament-forms::components.modal_table_select.actions.select.label'))
                .slideOver()
                .modalHeading(() => this.getLabel())
                .modalSubmitActionLabel(t('filament-forms::components.modal_table_select.actions.select.actions.select.label'))
                .icon('m-pencil-square')
                .iconPosition('after')
                .hidden(() => this.isDisabled())
                .fillForm(() => ({ selection: this._multiple ? this.selectedValues() : (this.selectedValues()[0] ?? null) }))
                .schema(async (schema: any) => schema.components([await this.getTableSelect()]))
                .action(async ({ data }) => {
                    const selection = data.selection;
                    this.setState(this._multiple ? (Array.isArray(selection) ? [...new Set(selection.filter(isKey).map(String))] : []) : isKey(selection) ? String(selection) : null);
                    await this.callAfterStateUpdated((name, value) => writeState(this.livewire as any, [this.container.getStatePath(), name].filter(Boolean).join('.'), value));
                });
            if (this._multiple || blank) action.link(); else action.iconButton();
            return this._modifySelectAction?.(action, this.context()) ?? action;
        }

        private badgeHtml(label: string, color: string | null): string {
            const colors = deps.colors()?.getComponentClasses('badge', color ?? 'primary') ?? [];
            return `<span class="${['fi-badge', 'fi-size-md', ...colors].join(' ')}"><span class="fi-badge-label-ctn"><span class="fi-badge-label">${e(label)}</span></span></span>`;
        }
        async toHtml(): Promise<string> {
            const id = this.getId();
            const isDisabled = await this.isDisabled();
            const isMultiple = this._multiple;
            const hasBadges = this.hasBadges();
            const badgeColor = await evaluate(this._badgeColor, this.context());
            const optionLabel = isMultiple ? null : await this.getOptionLabel();
            const optionLabels = isMultiple ? await this.getOptionLabels() : [];
            const describedBy = this.hasError() ? `${id}-error` : null;
            const attributes = new Attributes().merge({ 'aria-labelledby': `${id}-label`, id, role: 'group', 'aria-describedby': describedBy })
                .class(['fi-fo-modal-table-select', { 'fi-fo-modal-table-select-disabled': isDisabled, 'fi-fo-modal-table-select-multiple': isMultiple }]);
            let content = '';
            if ((!isMultiple && optionLabel !== null && optionLabel !== '') || (isMultiple && optionLabels.length)) {
                if (isMultiple && hasBadges) content = `<div class="fi-fo-modal-table-select-badges-ctn">${optionLabels.map(([, label]) => this.badgeHtml(label, badgeColor)).join('')}</div>`;
                else if (hasBadges) content = `<div>${this.badgeHtml(optionLabel!, badgeColor)}</div>`;
                else if (isMultiple) content = `<div>${optionLabels.map(([, label]) => e(label)).join(', ')}</div>`;
                else content = `<div>${e(optionLabel!)}</div>`;
            } else if (this._placeholder !== null && this._placeholder !== '') {
                content = `<div class="fi-fo-modal-table-select-placeholder">${e(this._placeholder)}</div>`;
            }
            if (!isDisabled) {
                const ctx = this.context();
                const action = this.getSelectAction();
                const mountContext = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: this.getKey() };
                if (await action.isVisible(ctx)) content += `<div>${await action.toHtml(ctx, mountContext)}</div>`;
            }
            return this.wrap(`<div ${attributes.toHtml()}>${content}</div>`, { labelAsDiv: true });
        }
    }

    return { TableSelect, ModalTableSelect };
}
