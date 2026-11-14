// `MorphToSelect` (Filament's): a polymorphic `belongsTo`, edited as two fields inside a fieldset, a "type" select and
// a "key" select listing the records of the chosen type. They save the `<name>_type` and `<name>_id` attributes of the
// record, like any other field, through the resource's data adapter.
import { Fieldset, type Component, type ComponentContext } from '@navette-js/schemas';
import { configured, evaluate, type Lazy } from '@navette-js/support';
import { Select, ToggleButtons } from './index.ts';

/** An Objection model class (`query()`, `tableName`, `idColumn`), as for `Select.relationship()`. */
export type MorphModel = { name: string; tableName: string; idColumn: string | string[]; query(): any; morphClass?: string };
type Options = Record<string, string>;
type TypeSelect = Select | ToggleButtons;

const humanize = (value: string) => {
    const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_.]+/g, ' ').trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
};
const COLUMN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;

/**
 * A type of a `MorphToSelect`: a model whose records are listed by the key select (Filament's `MorphToSelect\Type`).
 * Its alias, saved in `<name>_type`, is the model's static `morphClass`, else its class name; `alias()` sets another.
 */
export class MorphToSelectType {
    protected model: MorphModel;
    protected _label: string | null = null;
    protected _alias: string | null = null;
    protected _titleAttribute: string | null = null;
    protected _searchColumns: string[] | null = null;
    protected _modifyOptionsQueryUsing: ((query: any, ctx: ComponentContext) => unknown) | null = null;
    protected _optionLabelFromRecordUsing: ((record: any, ctx: ComponentContext) => string | null) | null = null;
    protected _modifyKeySelectUsing: ((select: Select, ctx: ComponentContext) => Select | void) | null = null;
    protected _forceSearchCaseInsensitive: boolean | null = null;
    /** Options of the key select (when it is not searchable, or preloaded). Replace them with `getOptionsUsing()`. */
    getOptions: (select: Select, ctx: ComponentContext) => Promise<Options>;
    /** Search results of the key select. Replace them with `getSearchResultsUsing()`. */
    getSearchResults: (search: string, select: Select, ctx: ComponentContext) => Promise<Options>;
    /** Label of a key, `null` when the key is not one of the type's records (the value is then rejected). */
    getOptionLabel: (value: string, select: Select, ctx: ComponentContext) => Promise<string | null>;

    constructor(model: MorphModel) {
        this.model = model;
        // `ctx.optionsLimit`: limit given by the `MorphToSelect` (search results, and options of a searchable select).
        this.getOptions = (_select, ctx) => this.queryOptions(null, null, ctx, (ctx.optionsLimit as number | undefined) ?? null);
        this.getSearchResults = (search, _select, ctx) => this.queryOptions(search, null, ctx, (ctx.optionsLimit as number | undefined) ?? 50);
        this.getOptionLabel = async (value, _select, ctx) => (await this.queryOptions(null, [value], ctx, null))[value] ?? null;
    }
    static make(model: MorphModel): MorphToSelectType { return new this(model); }

    label(label: string | null): this { this._label = label; return this; }
    /** Value saved in the `<name>_type` attribute for this type. */
    alias(alias: string | null): this { this._alias = alias; return this; }
    /** Attribute shown as the option label (and searched). */
    titleAttribute(name: string | null): this { this._titleAttribute = name; return this; }
    titleColumnName(name: string | null): this { return this.titleAttribute(name); }
    /** Columns searched (the title attribute by default). */
    searchColumns(columns: string[] | null): this { this._searchColumns = columns; return this; }
    /** Scopes the records listed and accepted, synchronously: `(query, ctx) => query.where('team_id', team.id)`. */
    modifyOptionsQueryUsing(callback: ((query: any, ctx: ComponentContext) => unknown) | null): this { this._modifyOptionsQueryUsing = callback; return this; }
    /** Option label computed from the record, instead of the title attribute. */
    getOptionLabelFromRecordUsing(callback: ((record: any, ctx: ComponentContext) => string | null) | null): this { this._optionLabelFromRecordUsing = callback; return this; }
    hasOptionLabelFromRecordUsingCallback(): boolean { return this._optionLabelFromRecordUsing !== null; }
    /** Changes the key select when this type is chosen (after the `MorphToSelect`'s own `modifyKeySelectUsing()`). */
    modifyKeySelectUsing(callback: ((select: Select, ctx: ComponentContext) => Select | void) | null): this { this._modifyKeySelectUsing = callback; return this; }
    getModifyKeySelectUsingCallback(): ((select: Select, ctx: ComponentContext) => Select | void) | null { return this._modifyKeySelectUsing; }
    /** Compares the search in lower case on both sides (for case-sensitive databases such as PostgreSQL). */
    forceSearchCaseInsensitive(condition: boolean | null = true): this { this._forceSearchCaseInsensitive = condition; return this; }
    isSearchForcedCaseInsensitive(): boolean | null { return this._forceSearchCaseInsensitive; }
    getOptionsUsing(callback: (select: Select, ctx: ComponentContext) => Options | Promise<Options>): this { this.getOptions = async (select, ctx) => callback(select, ctx); return this; }
    getSearchResultsUsing(callback: (search: string, select: Select, ctx: ComponentContext) => Options | Promise<Options>): this { this.getSearchResults = async (search, select, ctx) => callback(search, select, ctx); return this; }
    getOptionLabelUsing(callback: (value: string, select: Select, ctx: ComponentContext) => string | null | Promise<string | null>): this { this.getOptionLabel = async (value, select, ctx) => callback(value, select, ctx); return this; }

    getModel(): MorphModel { return this.model; }
    getLabel(): string { return this._label ?? humanize(this.model.name); }
    getAlias(): string { return this._alias ?? this.model.morphClass ?? this.model.name; }
    getTitleAttribute(): string {
        if (!this._titleAttribute) throw new Error(`MorphToSelect type [${this.model.name}] must have a [titleAttribute()] set.`);
        return this._titleAttribute;
    }
    getSearchColumns(): string[] { return this._searchColumns ?? [this.getTitleAttribute()]; }

    /** Records of the type as options: all, those matching `search`, or those with the given keys. */
    protected async queryOptions(search: string | null, keys: string[] | null, ctx: ComponentContext, limit: number | null): Promise<Options> {
        const model = this.model;
        const id = Array.isArray(model.idColumn) ? model.idColumn[0] : model.idColumn;
        const qualifiedId = `${model.tableName}.${id}`;
        let query = model.query();
        if (keys !== null) { if (!keys.length) return {}; query.whereIn(qualifiedId, keys.slice(0, 1000)); }
        // Not awaited: a query builder is thenable, awaiting it would run the query.
        if (this._modifyOptionsQueryUsing) { const modified = this._modifyOptionsQueryUsing(query, ctx) as any; if (modified && typeof modified.where === 'function') query = modified; }
        if (search !== null) {
            const term = `%${search.slice(0, 255).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
            const columns = this.getSearchColumns().filter((column) => COLUMN.test(column)).map((column) => (column.includes('.') ? column : `${model.tableName}.${column}`));
            const lower = this._forceSearchCaseInsensitive === true;
            query.where((builder: any) => {
                for (const column of columns) {
                    if (lower) builder.orWhereRaw(`lower(??) like ? escape '\\'`, [column, term.toLowerCase()]);
                    else builder.orWhereRaw(`?? like ? escape '\\'`, [column, term]);
                }
            });
        }
        if (limit !== null && keys === null) query.limit(Math.max(1, Math.floor(limit)));
        if (this._optionLabelFromRecordUsing) {
            const rows = await query;
            return Object.fromEntries(rows.map((row: any) => [String(row[id]), String(this._optionLabelFromRecordUsing!(row, ctx) ?? row[id])]));
        }
        const title = this.getTitleAttribute();
        if (!COLUMN.test(title)) throw new Error(`MorphToSelect type [${model.name}]: invalid title attribute [${title}].`);
        const qualifiedTitle = title.includes('.') ? title : `${model.tableName}.${title}`;
        const rows = await query.clearSelect().select({ __key: qualifiedId, __title: qualifiedTitle }).orderBy(qualifiedTitle);
        return Object.fromEntries(rows.map((row: any) => [String(row.__key), String(row.__title ?? row.__key)]));
    }
}

/**
 * Two fields in a fieldset editing a polymorphic relationship (Filament's `MorphToSelect`): the type of the related record,
 * saved in `<name>_type`, and its key, saved in `<name>_id`. The key select lists the records of the chosen type.
 */
export class MorphToSelect extends Fieldset {
    static Type = MorphToSelectType;
    protected _morphName: string;
    protected _types: Lazy<MorphToSelectType[], ComponentContext> = [];
    protected _required: Lazy<boolean, ComponentContext> = false;
    protected _optionsLimit: Lazy<number, ComponentContext> = 50;
    protected _searchable = false;
    protected _preload: Lazy<boolean, ComponentContext> = false;
    protected _native: Lazy<boolean, ComponentContext> | null = null;
    protected _allowHtml: Lazy<boolean, ComponentContext> = false;
    protected _searchDebounce: Lazy<number, ComponentContext> | null = null;
    protected _messages: Partial<Record<'searchPrompt' | 'searchingMessage' | 'noSearchResultsMessage' | 'noOptionsMessage' | 'loadingMessage', Lazy<string, ComponentContext>>> = {};
    protected _live: { onBlur: boolean } | null = null;
    protected _typeColumn: string | null = null;
    protected _keyColumn: string | null = null;
    protected _typeSelectToggleButtons: Lazy<boolean, ComponentContext> = false;
    protected _modifyTypeSelectUsing: ((select: any, ctx: ComponentContext) => TypeSelect | void) | null = null;
    protected _modifyKeySelectUsing: ((select: Select, ctx: ComponentContext) => Select | void) | null = null;
    protected _morphLabel: Lazy<string | null, ComponentContext> = null;

    constructor(name: string) {
        super(null);
        if (!name) throw new Error('MorphToSelect must have a unique name, passed to the [make()] method.');
        this._morphName = name;
        this.label(humanize(name.split('.').pop() ?? name));
        this.columns(1);
    }
    /** Legend of the fieldset, also the accessible label of the type field. */
    label(label: Lazy<string | null, ComponentContext>): this { this._morphLabel = label; return super.label(label); }
    static make(name: string): MorphToSelect { return configured(new this(name)); }

    getName(): string { return this._morphName; }
    /** The types of record the user may pick, each listing its model's records. */
    types(types: Lazy<MorphToSelectType[], ComponentContext>): this { this._types = types; return this; }
    required(condition: Lazy<boolean, ComponentContext> = true): this { this._required = condition; return this; }
    optionsLimit(limit: Lazy<number, ComponentContext>): this { this._optionsLimit = limit; return this; }
    searchable(condition = true): this { this._searchable = condition; return this; }
    preload(condition: Lazy<boolean, ComponentContext> = true): this { this._preload = condition; return this; }
    native(condition: Lazy<boolean, ComponentContext> = true): this { this._native = condition; return this; }
    allowHtml(condition: Lazy<boolean, ComponentContext> = true): this { this._allowHtml = condition; return this; }
    searchDebounce(milliseconds: Lazy<number, ComponentContext>): this { this._searchDebounce = milliseconds; return this; }
    searchPrompt(message: Lazy<string, ComponentContext>): this { this._messages.searchPrompt = message; return this; }
    searchingMessage(message: Lazy<string, ComponentContext>): this { this._messages.searchingMessage = message; return this; }
    noSearchResultsMessage(message: Lazy<string, ComponentContext>): this { this._messages.noSearchResultsMessage = message; return this; }
    noOptionsMessage(message: Lazy<string, ComponentContext>): this { this._messages.noOptionsMessage = message; return this; }
    loadingMessage(message: Lazy<string, ComponentContext>): this { this._messages.loadingMessage = message; return this; }
    /** Re-renders the form when the key changes (the type select is always live). */
    live(condition = true, options: { onBlur?: boolean } = {}): this { this._live = condition ? { onBlur: options.onBlur === true } : null; return this; }
    /** Attribute holding the type (`<name>_type` by default). */
    typeColumn(column: string | null): this { this._typeColumn = column; return this; }
    /** Attribute holding the key (`<name>_id` by default). */
    keyColumn(column: string | null): this { this._keyColumn = column; return this; }
    /** Inline toggle buttons instead of a select for the type. */
    typeSelectToggleButtons(condition: Lazy<boolean, ComponentContext> = true): this { this._typeSelectToggleButtons = condition; return this; }
    /** Changes the type field (a `Select`, or `ToggleButtons` with `typeSelectToggleButtons()`); return it or a replacement. */
    modifyTypeSelectUsing(callback: ((select: any, ctx: ComponentContext) => TypeSelect | void) | null): this { this._modifyTypeSelectUsing = callback; return this; }
    /** Changes the key select, for every type; a type's own `modifyKeySelectUsing()` runs after it. */
    modifyKeySelectUsing(callback: ((select: Select, ctx: ComponentContext) => Select | void) | null): this { this._modifyKeySelectUsing = callback; return this; }

    getTypeColumn(): string { return this._typeColumn ?? `${this._morphName}_type`; }
    getKeyColumn(): string { return this._keyColumn ?? `${this._morphName}_id`; }
    /** Types by alias. */
    getTypes(ctx: ComponentContext = this.context()): Map<string, MorphToSelectType> {
        const types = typeof this._types === 'function' ? (this._types as (ctx: ComponentContext) => MorphToSelectType[])(ctx) : this._types;
        if (types instanceof Promise) throw new Error('MorphToSelect: types() must return the types synchronously.');
        return new Map((types ?? []).map((type) => [type.getAlias(), type]));
    }
    isRequiredSync(ctx: ComponentContext): boolean { return typeof this._required === 'function' ? Boolean((this._required as (ctx: ComponentContext) => unknown)(ctx)) : Boolean(this._required); }

    /** The type select and the key select, built for the type currently chosen. */
    protected buildFields(): Component[] {
        const ctx = this.context();
        const typeColumn = this.getTypeColumn(), keyColumn = this.getKeyColumn();
        const types = this.getTypes(ctx);
        const typeOf = (get: ComponentContext['get']) => types.get(String(get(typeColumn) ?? '')) ?? null;
        const selected = typeOf(ctx.get);
        const required = this._required;
        const typeOptions = Object.fromEntries([...types].map(([alias, type]) => [alias, type.getLabel()]));
        const label = this.getLabelLazy();
        const clearKey = ({ set }: { set: (path: string, value: unknown) => void }) => { set(keyColumn, null); };
        const toggle = typeof this._typeSelectToggleButtons === 'function' ? Boolean((this._typeSelectToggleButtons as (ctx: ComponentContext) => unknown)(ctx)) : Boolean(this._typeSelectToggleButtons);
        let typeSelect: TypeSelect = toggle
            ? ToggleButtons.make(typeColumn).label(label as any).hiddenLabel().options(typeOptions).inline().required(required).live().afterStateUpdated(clearKey)
            : Select.make(typeColumn).label(label as any).hiddenLabel().options(typeOptions).required(required).live().afterStateUpdated(clearKey);
        if (!toggle && this._native !== null) (typeSelect as Select).native(this._native);
        // A cleared type also clears the key, which is hidden then (Filament's `dehydratedWhenHidden()`).
        Object.assign(typeSelect, { getExtraDehydratedState: () => (typeOf((path: string) => (path === typeColumn ? typeSelect.context().state : null)) ? {} : { [keyColumn]: null }) });

        let keySelect = Select.make(keyColumn)
            .label(((c: ComponentContext) => typeOf(c.get)?.getLabel() ?? null) as any)
            .hiddenLabel()
            .required((c: ComponentContext) => typeOf(c.get) !== null)
            .hidden((c: ComponentContext) => typeOf(c.get) === null)
            .optionsLimit(this._optionsLimit)
            .preload(this._preload)
            .allowHtml(this._allowHtml)
            .getOptionLabelUsing(async (value, c) => { const type = typeOf(c.get); return type ? type.getOptionLabel(value, keySelect, c) : null; });
        const limitOf = async (c: ComponentContext) => Number(await evaluate(this._optionsLimit, c)) || 50;
        if (this._searchable) keySelect.searchable().getSearchResultsUsing(async (search, c) => { const type = typeOf(c.get); return type ? type.getSearchResults(search, keySelect, { ...c, optionsLimit: await limitOf(c) }) : {}; });
        keySelect.options(async (c: ComponentContext) => {
            const type = typeOf(c.get);
            if (!type || (this._searchable && !(await evaluate(this._preload, c)))) return {};
            return type.getOptions(keySelect, this._searchable ? { ...c, optionsLimit: await limitOf(c) } : c);
        });
        if (this._native !== null) keySelect.native(this._native);
        if (this._searchDebounce !== null) keySelect.searchDebounce(this._searchDebounce);
        for (const [method, message] of Object.entries(this._messages)) if (message !== undefined) (keySelect as any)[method](message);
        if (this._live) keySelect.live(true, { onBlur: this._live.onBlur });

        if (this._modifyTypeSelectUsing) typeSelect = this._modifyTypeSelectUsing(typeSelect, ctx) ?? typeSelect;
        if (this._modifyKeySelectUsing) keySelect = this._modifyKeySelectUsing(keySelect, ctx) ?? keySelect;
        const perType = selected?.getModifyKeySelectUsingCallback();
        if (perType) keySelect = perType(keySelect, ctx) ?? keySelect;
        return [typeSelect, keySelect];
    }
    protected getLabelLazy(): Lazy<string | null, ComponentContext> { return this._morphLabel; }
    getChildSchemas() {
        this.schema(this.container ? this.buildFields() : []);
        return super.getChildSchemas();
    }
    async toHtml(): Promise<string> {
        this.markAsRequired(Boolean(await evaluate(this._required, this.context())));
        return super.toHtml();
    }
}
