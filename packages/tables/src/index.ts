// @navette-js/tables — tables: columns, filters, state (search, sort, pagination, columns) and rendering.
import type { DataAdapter, ListQuery, Page as RecordPage, SortDirection } from '@navette-js/database';
import { Attributes, cls, e, hasRenderHook, icon, js, renderHook, views, type ColorManager, configured, configureUsing } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

views.namespace('filament-tables', fileURLToPath(new URL('../views', import.meta.url)));
export * from './query-builder.ts';

/** Render hook slots of a table. */
export const TablesRenderHook = {
    CONTENT_AFTER: 'tables::content.after',
    CONTENT_BEFORE: 'tables::content.before',
    SELECTION_INDICATOR_ACTIONS_AFTER: 'tables::selection.indicator.actions.after',
    SELECTION_INDICATOR_ACTIONS_BEFORE: 'tables::selection.indicator.actions.before',
    HEADER_AFTER: 'tables::header.after',
    HEADER_BEFORE: 'tables::header.before',
    TOOLBAR_AFTER: 'tables::toolbar.after',
    TOOLBAR_BEFORE: 'tables::toolbar.before',
    TOOLBAR_COLUMN_MANAGER_TRIGGER_AFTER: 'tables::toolbar.toggle-column-trigger.after',
    TOOLBAR_COLUMN_MANAGER_TRIGGER_BEFORE: 'tables::toolbar.toggle-column-trigger.before',
    TOOLBAR_END: 'tables::toolbar.end',
    TOOLBAR_GROUPING_SELECTOR_AFTER: 'tables::toolbar.grouping-selector.after',
    TOOLBAR_GROUPING_SELECTOR_BEFORE: 'tables::toolbar.grouping-selector.before',
    TOOLBAR_REORDER_TRIGGER_AFTER: 'tables::toolbar.reorder-trigger.after',
    TOOLBAR_REORDER_TRIGGER_BEFORE: 'tables::toolbar.reorder-trigger.before',
    TOOLBAR_SEARCH_AFTER: 'tables::toolbar.search.after',
    TOOLBAR_SEARCH_BEFORE: 'tables::toolbar.search.before',
    TOOLBAR_START: 'tables::toolbar.start',
    FILTER_INDICATORS: 'tables::filter.indicators',
    HEADER_CELL: 'tables::header.cell',
    /** Legacy aliases of the column manager trigger slots. */
    TOOLBAR_TOGGLE_COLUMN_TRIGGER_AFTER: 'tables::toolbar.toggle-column-trigger.after',
    TOOLBAR_TOGGLE_COLUMN_TRIGGER_BEFORE: 'tables::toolbar.toggle-column-trigger.before',
} as const;

/** Methods and properties that trigger the table's loading state (`wire:target`). */
export const LOADING_TARGETS = 'activeTab,applyTableFilters,gotoPage,nextPage,previousPage,removeTableFilter,removeTableFilters,reorderTable,resetTableColumnSearch,resetTableFiltersForm,resetTableSearch,setPage,sortTable,tableColumnSearches,tableFilters,tableGrouping,tableRecordsPerPage,tableSearch,tableSort,toggleTableReordering';

const headline = (s: string) => s.replace(/[_.-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
type StateResolver<R> = (ctx: { record: R }) => unknown | Promise<unknown>;

// ------------------------------------------------------------------ columns
/** Base class of table columns. */
export abstract class Column<R = any> {
    /** Default setup for every instance created afterwards by `make()`, e.g. `TextColumn.configureUsing((column) => column.sortable())`. */
    static configureUsing<T>(this: abstract new (...args: any[]) => T, configure: (instance: T) => void): void { configureUsing(this, configure); }
    readonly name: string;
    protected _label: string | null = null;
    protected _sortable = false;
    protected _searchable = false;
    protected _individuallySearchable = false;
    protected _toggleable = false;
    protected _toggledHiddenByDefault = false;
    protected _alignment: string | null = null;
    protected _state: StateResolver<R> | null = null;
    protected _sortColumn: string | null = null;
    protected _searchColumn: string | null = null;
    protected _url: ((record: R) => string | null) | null = null;
    /** Label of the column group this column belongs to (set by ColumnGroup). */
    _group: string | null = null;

    constructor(name: string) { this.name = name; }
    label(label: string): this { this._label = label; return this; }
    /** `column`: column (or query alias) to sort by when it differs from the name, e.g. for a relationship. */
    sortable(condition: boolean | { column: string; inverted?: boolean } = true): this { this._sortable = condition !== false; this._sortColumn = typeof condition === 'object' ? condition.column : null; this._sortInverted = typeof condition === 'object' && condition.inverted === true; return this; }
    getSortColumn(): string { return this._sortColumn ?? this.name; }
    private _sortInverted = false;
    /** `inverted`: the sort column runs opposite to the displayed value (e.g. an age sorted by birth date). */
    isSortInverted(): boolean { return this._sortInverted; }
    /** Link on the cell; takes precedence over the row action. */
    url(resolver: (record: R) => string | null): this { this._url = resolver; return this; }
    getUrl(record: R): string | null { return this._url ? this._url(record) : null; }
    /** `isGlobal: false` excludes the column from the global search; `isIndividual` adds a search field for this column. */
    getSearchColumn(): string { return this._searchColumn ?? this.name; }
    searchable(options: boolean | { isIndividual?: boolean; isGlobal?: boolean; column?: string } = true): this {
        this._searchColumn = typeof options === 'object' ? (options.column ?? null) : null;
        this._searchable = typeof options === 'boolean' ? options : options.isGlobal !== false;
        this._individuallySearchable = typeof options === 'object' && options.isIndividual === true;
        return this;
    }
    /** Lets the user hide the column from the column manager. */
    toggleable(condition = true, options: { isToggledHiddenByDefault?: boolean } = {}): this { this._toggleable = condition; this._toggledHiddenByDefault = options.isToggledHiddenByDefault === true; return this; }
    alignment(alignment: 'start' | 'center' | 'end' | null): this { this._alignment = alignment; return this; }
    alignEnd(): this { return this.alignment('end'); }
    alignLeft(): this { return this.alignment('left'); }
    alignCenter(): this { return this.alignment('center'); }
    getStateUsing(resolver: StateResolver<R>): this { this._state = resolver; return this; }

    getLabel(): string { return this._label ?? headline(this.name.includes('.') ? this.name.split('.').slice(-2, -1)[0] : this.name); }
    isSortable(): boolean { return this._sortable; }
    isGloballySearchable(): boolean { return this._searchable; }
    isIndividuallySearchable(): boolean { return this._individuallySearchable; }
    isToggleable(): boolean { return this._toggleable; }
    isToggledHiddenByDefault(): boolean { return this._toggledHiddenByDefault; }
    getAlignment(): string | null { return this._alignment; }
    /** Suffix of the `fi-ta-header-cell-…` / `fi-ta-cell-…` classes: underscores become dashes, dots are kept. */
    getCssName(): string { return this.name.replace(/_/g, '-'); }
    async getState(record: R): Promise<unknown> { return this._state ? this._state({ record }) : (record as any)[this.name]; }
    /** True for editable cells: they are not wrapped in a link or button to the record. */
    isClickDisabled(): boolean { return false; }
    abstract toHtml(record: R, recordKey?: string | number): Promise<string>;
}

export class TextColumn<R = any> extends Column<R> {
    private _weight: string | null = null;
    private _copyable = false;
    private _money: string | ((record: R) => string) | null = null;
    private _placeholder: string | null = null;
    private _badge = false;
    private _color: string | ((record: R) => string) | null = null;
    private _icon: ((record: R) => string | null) | null = null;
    private _format: ((ctx: { state: unknown; record: R }) => string) | null = null;
    private _date = false;
    private _numeric = false;
    private _summarizers: Summarizer[] = [];
    private _limit: number | null = null;
    private _tooltip: ((record: R) => string | null) | string | null = null;

    static make<R = any>(name: string): TextColumn<R> { return configured(new TextColumn<R>(name)); }
    /** Displays the value in a badge. */
    badge(condition = true): this { this._badge = condition; return this; }
    color(color: string | ((record: R) => string)): this { this._color = color; return this; }
    icon(resolver: (record: R) => string | null): this { this._icon = resolver; return this; }
    /** Text displayed instead of the raw value (e.g. an enum label). */
    formatStateUsing(formatter: (ctx: { state: unknown; record: R }) => string): this { this._format = formatter; return this; }
    /** Short date, e.g. "Nov 9, 2026". */
    date(condition = true): this { this._date = condition; return this; }
    private _dateTime = false;
    /** Date and time, e.g. "Nov 9, 2026 14:30:00". */
    dateTime(condition = true): this { this._dateTime = condition; this._date = condition; return this; }
    /** Number formatted with thousands separators. */
    private _decimals: number | null = null;
    /** `numeric(1)`: fixed number of decimals. */
    numeric(condition: boolean | number = true): this { this._numeric = condition !== false; this._decimals = typeof condition === 'number' ? condition : null; return this; }
    /** Summary row below the table. */
    summarize(summarizer: Summarizer | Summarizer[]): this { this._summarizers = Array.isArray(summarizer) ? summarizer : [summarizer]; return this; }
    getSummarizers(): Summarizer[] { return this._summarizers; }
    weight(weight: string): this { this._weight = weight; return this; }
    /** Truncates the displayed text to `length` characters, followed by "...". */
    limit(length: number | null): this { this._limit = length; return this; }
    /** Tooltip on hover; `null` for none. */
    tooltip(tooltip: ((record: R) => string | null) | string | null): this { this._tooltip = tooltip; return this; }
    copyable(condition = true): this { this._copyable = condition; return this; }
    /** Amount formatted in the given currency, e.g. `money('usd')`. */
    money(currency: string | ((record: R) => string) = 'usd'): this { this._money = currency; return this; }
    /** Text displayed when the value is empty. */
    placeholder(text: string | null): this { this._placeholder = text; return this; }

    /** Cell content: a short markup for plain text, a full markup as soon as an option (badge, icon, color…) is set. */
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        if ((state === null || state === undefined || state === '') && this._placeholder !== null) return `<div class="fi-ta-text"><p class="fi-ta-placeholder">${e(this._placeholder)}</p></div>`;
        // Empty value without placeholder: render a bare container.
        if (state === null || state === undefined || state === '') return `<div class="${cls(['fi-ta-text', this._money || this._numeric ? 'fi-numeric' : null, (this._money || this._numeric) && this._alignment && this._alignment !== 'start' ? `fi-align-${this._alignment}` : null])}"></div>`;
        const currency = typeof this._money === 'function' ? this._money(record) : this._money;
        if (this._badge || this._format || this._date) {
            let shown = state === null || state === undefined ? '' : String(state);
            if (this._date && shown) shown = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${shown.replace(' ', 'T').slice(0, 19)}Z`)) + (this._dateTime ? ` ${shown.slice(11, 19)}` : '');
            if (this._format) shown = this._format({ state, record });
            if (this._badge) {
                const color = typeof this._color === 'function' ? this._color(record) : (this._color ?? 'primary');
                const iconName = this._icon?.(record) ?? null;
                const classes = ['fi-badge', 'fi-size-sm', ...(color !== 'gray' ? (colorManager?.getComponentClasses('badge', color) ?? []) : [])].join(' ');
                // Without an icon the cell uses the short markup, which writes the classes in the other order.
                return `<div class="${iconName ? 'fi-ta-text-item fi-ta-text' : 'fi-ta-text fi-ta-text-item'} fi-ta-text-has-badges"><span class="${classes}">${iconName ? icon(iconName, { size: 'sm', attributes: new Attributes({ 'aria-hidden': 'true' }) }) : ''}${e(shown)}</span></div>`;
            }
            if (!this._weight && !this._copyable) return `<div class="${cls(['fi-ta-text', 'fi-ta-text-item', 'fi-size-sm', this._alignment && this._alignment !== 'start' ? `fi-align-${this._alignment}` : null])}">${e(shown)}</div>`;
        }
        const text = state === null || state === undefined ? '' : currency ? new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(Number(state)) : this._numeric && Number.isFinite(Number(state)) ? new Intl.NumberFormat('en-US', this._decimals !== null ? { minimumFractionDigits: this._decimals, maximumFractionDigits: this._decimals } : {}).format(Number(state)) : String(state);
        const align = this._alignment && this._alignment !== 'start' ? `fi-align-${this._alignment}` : null;
        const tooltip = typeof this._tooltip === 'function' ? this._tooltip(record) : this._tooltip;
        if (this._limit !== null || (tooltip !== null && tooltip !== '')) {
            const limited = this._limit !== null && text.length > this._limit ? `${text.slice(0, this._limit).trimEnd()}...` : text;
            const content = tooltip !== null && tooltip !== '' ? `<span x-tooltip="{
                                content: ${e(js(tooltip))},
                                theme: $store.theme,
                                allowHTML: false,
                            }">${e(limited)}</span>` : e(limited);
            return `<div class="${cls(['fi-ta-text-item', 'fi-size-sm', this._weight ? `fi-font-${this._weight}` : null, 'fi-ta-text', this._money || this._numeric ? 'fi-numeric' : null, align])}">${content}</div>`;
        }
        // Outside a badge: an icon precedes the text (full markup) and a color tints the text.
        const plainIcon = this._icon?.(record) ?? null;
        const plainColor = typeof this._color === 'function' ? this._color(record) : this._color;
        const colorClasses = plainColor ? (colorManager?.getComponentClasses('text', plainColor) ?? []) : [];
        if (plainIcon) return `<div class="${cls(['fi-ta-text-item', 'fi-size-sm', this._weight ? `fi-font-${this._weight}` : null, 'fi-ta-text', ...colorClasses, align])}">${icon(plainIcon, { size: 'sm', attributes: new Attributes({ 'aria-hidden': 'true' }) })}${e(text)}</div>`;
        if (!this._weight && !this._copyable) return `<div class="${cls(['fi-ta-text', 'fi-ta-text-item', 'fi-size-sm', this._money || this._numeric ? 'fi-numeric' : null, ...colorClasses, align])}">${e(text)}</div>`;
        const inner = this._copyable
            ? `<span x-data="filamentCopyable" x-bind="bindings" x-bind:aria-label="isStandalone ? ${e(js(t('filament::components/copyable.label', { label: text })))} : null" x-on:click.prevent.stop="if (isStandalone) {
    copy(${e(js(text))}, ${e(js(t('filament::components/copyable.messages.copied')))}, 2000, ${e(js(t('filament::components/copyable.messages.failed')))})
} else {
    window.navigator.clipboard.writeText(${e(js(text))})
    $tooltip(${e(js(t('filament::components/copyable.messages.copied')))}, {
        theme: $store.theme,
        timeout: 2000,
    })
}" class="fi-copyable">${e(text)}</span>`
            : e(text);
        return `<div class="${cls(['fi-ta-text-item', 'fi-size-sm', this._weight ? `fi-font-${this._weight}` : null, 'fi-ta-text', this._money || this._numeric ? 'fi-numeric' : null, align])}">${inner}</div>`;
    }
}

/** Values a summarizer works from: aggregates over the query (all records) or over the displayed page. */
export type SummaryValues = { count: number; sum: Record<string, number>; avg: Record<string, number>; min: Record<string, unknown>; max: Record<string, unknown> };
export type SummaryItem = { type: 'text' | 'range'; label: string | null; value: string };

/** Column summary below the table: sum, average, count or range. */
export abstract class Summarizer {
    abstract readonly kind: 'sum' | 'avg' | 'count' | 'range';
    protected _label: string | null = null;
    protected _money: string | null = null;
    label(label: string | null): this { this._label = label; return this; }
    money(currency = 'usd'): this { this._money = currency.toUpperCase(); return this; }
    getLabel(): string | null { return this._label; }
    format(value: number): string { return this._money ? new Intl.NumberFormat('en-US', { style: 'currency', currency: this._money }).format(value) : new Intl.NumberFormat('en-US').format(value); }
    abstract summarize(column: string, values: SummaryValues): SummaryItem | null;
}
/** Column total. */
export class Sum extends Summarizer {
    readonly kind = 'sum';
    static make(): Sum { return configured(new Sum()); }
    getLabel(): string { return this._label ?? t('filament-tables::table.summary.summarizers.sum.label'); }
    summarize(column: string, values: SummaryValues): SummaryItem { return { type: 'text', label: this.getLabel(), value: this.format(values.sum[column] ?? 0) }; }
}
/** Column average. */
export class Average extends Summarizer {
    readonly kind = 'avg';
    static make(): Average { return configured(new Average()); }
    getLabel(): string { return this._label ?? t('filament-tables::table.summary.summarizers.average.label'); }
    summarize(column: string, values: SummaryValues): SummaryItem { return { type: 'text', label: this.getLabel(), value: this.format(values.avg[column] ?? 0) }; }
}
/** Record count. */
export class Count extends Summarizer {
    readonly kind = 'count';
    static make(): Count { return configured(new Count()); }
    getLabel(): string { return this._label ?? t('filament-tables::table.summary.summarizers.count.label'); }
    summarize(_column: string, values: SummaryValues): SummaryItem { return { type: 'text', label: this.getLabel(), value: this.format(values.count) }; }
}
/** Smallest and largest value of a column. */
export class Range extends Summarizer {
    readonly kind = 'range';
    private _minimalDateTime = false;
    static make(): Range { return configured(new Range()); }
    /** Dates: day only when the bounds fall on different days, day and time otherwise; a single value when both are equal. */
    minimalDateTimeDifference(condition = true): this { this._minimalDateTime = condition; return this; }
    summarize(column: string, values: SummaryValues): SummaryItem | null {
        let bounds = [values.min[column], values.max[column]].filter((v) => v !== null && v !== undefined && v !== '').map(String);
        if (!bounds.length) return null;
        if (this._minimalDateTime && bounds.length === 2) {
            const date = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
            const dateTime = (value: string) => `${date(value)} ${value.length > 10 ? value.slice(11, 19) : '00:00:00'}`;
            const days = bounds.map(date);
            if (days[0] !== days[1]) bounds = days;
            else { const times = bounds.map(dateTime); bounds = times[0] === times[1] ? [times[0]] : times; }
        }
        return { type: 'range', label: this._label, value: bounds.join(' - ') };
    }
}

/** Row grouping: rows are sorted by the column and each group gets a header row. */
export class Group<R = any> {
    private id: string;
    private _label: string | null = null;
    private _column: string | null = null;
    private _title: ((record: R) => string | null) | null = null;
    private _description: ((record: R) => string | null) | null = null;
    private _collapsible = false;
    private _date = false;
    private _titlePrefixedWithLabel = true;
    constructor(id: string) { this.id = id; }
    static make<R = any>(id: string): Group<R> { return configured(new Group<R>(id)); }
    label(label: string | null): this { this._label = label; return this; }
    /** Query column holding the group value, when it differs from the id (relationship). */
    column(column: string | null): this { this._column = column; return this; }
    /** Group title computed from the record (e.g. an enum label). */
    getTitleUsing(resolver: ((record: R) => string | null) | null): this { this._title = resolver; return this; }
    getDescriptionUsing(resolver: ((record: R) => string | null) | null): this { this._description = resolver; return this; }
    /** Aliases using the `get…FromRecordUsing` naming. */
    getTitleFromRecordUsing(resolver: ((record: R) => string | null) | null): this { return this.getTitleUsing(resolver); }
    getDescriptionFromRecordUsing(resolver: ((record: R) => string | null) | null): this { return this.getDescriptionUsing(resolver); }
    /** Groups collapse when their header is clicked. */
    collapsible(condition = true): this { this._collapsible = condition; return this; }
    /** The column is a date: rows from the same day form one group. */
    date(condition = true): this { this._date = condition; return this; }
    titlePrefixedWithLabel(condition = true): this { this._titlePrefixedWithLabel = condition; return this; }
    getId(): string { return this.id; }
    getLabel(): string {
        if (this._label !== null) return this._label;
        const base = (this.id.includes('.') ? this.id.slice(0, this.id.lastIndexOf('.')) : this.id).split('.').pop() ?? '';
        return base.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
    }
    getColumn(): string { return this._column ?? this.id; }
    isCollapsible(): boolean { return this._collapsible; }
    isDate(): boolean { return this._date; }
    isTitlePrefixedWithLabel(): boolean { return this._titlePrefixedWithLabel; }
    /** Group value of a record, as text; `null` when empty. */
    getStringKey(record: R): string | null {
        let key = (record as any)?.[this.getColumn()];
        if (key === null || key === undefined || key === '') return null;
        if (typeof key === 'boolean') key = key ? 1 : 0;
        return this._date ? String(key).slice(0, 10) : String(key);
    }
    getTitle(record: R): string | null {
        if (this._title) return this._title(record);
        const key = this.getStringKey(record);
        if (key !== null && this._date) return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`));
        return key;
    }
    getDescription(record: R): string | null { return this._description ? this._description(record) : null; }
    /** Restricts a query to the records of the group with the given key. */
    scope(query: any, key: string | null): void {
        if (key === null) query.where((sub: any) => sub.whereNull(this.getColumn()).orWhere(this.getColumn(), ''));
        else if (this._date) query.whereRaw('date(??) = ?', [this.getColumn(), key]);
        else query.where(this.getColumn(), key);
    }
}

/**
 * Column layout: as soon as a table has one, records are rendered as cards (`fi-ta-content`) instead of table rows,
 * and sorting goes through a "Sort by" select.
 */
export abstract class ColumnLayout<R = any> {
    protected _children: (Column<R> | ColumnLayout<R>)[];
    constructor(children: (Column<R> | ColumnLayout<R>)[]) { this._children = children; }
    getChildren(): (Column<R> | ColumnLayout<R>)[] { return this._children; }
    /** Leaf columns, in order: the ones the table sorts, searches and toggles. */
    getColumns(): Column<R>[] { return this._children.flatMap((child) => (child instanceof ColumnLayout ? child.getColumns() : [child])); }
    abstract getClasses(): string[];
}
/** Columns side by side, from a given breakpoint. */
export class Split<R = any> extends ColumnLayout<R> {
    private _from: string | null = null;
    static make<R = any>(children: (Column<R> | ColumnLayout<R>)[]): Split<R> { return new Split<R>(children); }
    from(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | null): this { this._from = breakpoint; return this; }
    getClasses(): string[] { return ['fi-ta-split', ...(this._from ? [`${this._from}:fi-ta-split`] : [])]; }
}
/** Columns stacked vertically. */
export class Stack<R = any> extends ColumnLayout<R> {
    private _space: number | null = null;
    private _alignment = 'start';
    static make<R = any>(children: (Column<R> | ColumnLayout<R>)[]): Stack<R> { return new Stack<R>(children); }
    /** Gap between columns: 1 (small), 2 (medium) or 3 (large). */
    space(space: 1 | 2 | 3 | null = 1): this { this._space = space; return this; }
    alignment(alignment: 'start' | 'center' | 'end'): this { this._alignment = alignment; return this; }
    getClasses(): string[] { return ['fi-ta-stack', `fi-align-${this._alignment}`, ...(this._space ? [`fi-gap-${['sm', 'md', 'lg'][this._space - 1]}`] : [])]; }
}
const layoutCell = (classes: string[], html: string) => `<div class="${['fi-grid-col', 'fi-growable', ...classes].join(' ')}" style="--col-span-default: span 1 / span 1;">${html}</div>`;
/** Renders a record through the layout, skipping columns the user has hidden. */
async function renderColumnLayout<R>(node: Column<R> | ColumnLayout<R>, record: R, key: string, visible: Set<Column<R>>): Promise<string> {
    if (node instanceof ColumnLayout) {
        const children = [];
        for (const child of node.getChildren()) children.push(await renderColumnLayout(child, record, key, visible));
        return layoutCell([], `<div class="${node.getClasses().join(' ')}">${children.join('')}</div>`);
    }
    if (!visible.has(node)) return '';
    const alignment = node.getAlignment();
    // Inside a layout, text is inline and carries its own alignment.
    const html = (await node.toHtml(record, key)).replace(/class="([^"]*\bfi-ta-text\b[^"]*)"/, (_match, classes: string) => `class="${classes.replace(/ fi-align-\w+/g, '')} fi-inline${alignment ? ` fi-align-${alignment}` : ''}"`);
    return layoutCell(['fi-ta-col', ...(alignment ? [`fi-align-${alignment}`] : [])], html);
}

/** Column group: a shared label above the column headers. */
export class ColumnGroup<R = any> {
    private label: string;
    private _columns: Column<R>[] = [];
    constructor(label: string) { this.label = label; }
    static make<R = any>(label: string): ColumnGroup<R> { return configured(new ColumnGroup<R>(label)); }
    columns(columns: Column<R>[]): this { this._columns = columns; for (const c of columns) c._group = this.label; return this; }
    getColumns(): Column<R>[] { return this._columns; }
}

/** Color swatch column. */
export class ColorColumn<R = any> extends Column<R> {
    static make<R = any>(name: string): ColorColumn<R> { return configured(new ColorColumn<R>(name)); }
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        // Only hex or simple functional colors are injected into the style attribute (no CSS injection).
        const color = typeof state === 'string' && /^(#[0-9a-fA-F]{3,8}|(rgb|hsl|oklch)a?\([0-9.,%\s/deg-]+\))$/.test(state.trim()) ? state.trim() : null;
        return `<div class="fi-ta-color">${color ? `<div aria-label="${e(color)}" role="img" class="fi-ta-color-item" style="background-color: ${color};"></div>` : ''}</div>`;
    }
}

/** Image column: the state is the image URL. Only local or http(s) URLs are rendered. */
export class ImageColumn<R = any> extends Column<R> {
    private _alt: ((record: R) => string | null) | null = null;
    private _height = '2.5rem';
    private _circular = false;
    static make<R = any>(name: string): ImageColumn<R> { return configured(new ImageColumn<R>(name)); }
    alt(resolver: (record: R) => string | null): this { this._alt = resolver; return this; }
    /** CSS height of the image (`2.5rem` by default). */
    imageHeight(height: string): this { if (/^[0-9.]+(rem|px|em)$/.test(height)) this._height = height; return this; }
    circular(condition = true): this { this._circular = condition; return this; }
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        const src = typeof state === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(state) ? state : null;
        if (!src) return '<div class="fi-ta-image"></div>';
        const alt = this._alt?.(record) ?? null;
        return `<div class="fi-ta-image"><img${alt !== null ? ` alt="${e(alt)}"` : ''} src="${e(src)}" style="height: ${this._height};"${this._circular ? ' class="fi-circular"' : ''} /></div>`;
    }
}

/** Icon depending on the value; `boolean()` shows a green check or a red cross. */
export class IconColumn<R = any> extends Column<R> {
    private _boolean = false;
    static make<R = any>(name: string): IconColumn<R> { return configured(new IconColumn<R>(name)); }
    boolean(condition = true): this { this._boolean = condition; return this; }
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        if (!this._boolean || state === null || state === undefined) return '<div class="fi-ta-icon"></div>';
        const on = state === true || state === 1 || state === '1';
        const classes = colorManager?.getComponentClasses('icon-column', on ? 'success' : 'danger') ?? [];
        return `<div class="fi-ta-icon">${icon(on ? 'o-check-circle' : 'o-x-circle', { size: 'lg', attributes: new Attributes().class(classes) })}<span class="fi-sr-only">${e(t(on ? 'filament-tables::table.columns.icon.boolean.true' : 'filament-tables::table.columns.icon.boolean.false'))}</span></div>`;
    }
}

/** Application-defined validation rule of an editable column: synchronous check and message (`:attribute` already replaced). */
export type ColumnValidationRule = { name: string; passes: (value: unknown) => boolean; message: (attribute: string) => string };
type StateHook<R> = (ctx: { state: unknown; record: R }) => unknown | Promise<unknown>;

const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
const isNumeric = (value: unknown) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
/** String rules accepted by `rules([...])`, with their messages. An unknown rule throws at declaration time instead of being ignored. */
const STRING_RULES: Record<string, (parameter: string, numeric: boolean) => ColumnValidationRule> = {
    boolean: () => ({ name: 'boolean', passes: (v) => [true, false, 0, 1, '0', '1'].includes(v as any), message: (a) => `The ${a} field must be true or false.` }),
    string: () => ({ name: 'string', passes: (v) => typeof v === 'string', message: (a) => `The ${a} field must be a string.` }),
    numeric: () => ({ name: 'numeric', passes: isNumeric, message: (a) => `The ${a} field must be a number.` }),
    integer: () => ({ name: 'integer', passes: (v) => isNumeric(v) && Number.isInteger(Number(v)) && !/[.eE]/.test(String(v)), message: (a) => `The ${a} field must be an integer.` }),
    email: () => ({ name: 'email', passes: (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+$/.test(v), message: (a) => `The ${a} field must be a valid email address.` }),
    url: () => ({ name: 'url', passes: (v) => typeof v === 'string' && /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v), message: (a) => `The ${a} field must be a valid URL.` }),
    min: (n, numeric) => ({ name: 'min', passes: (v) => (numeric && isNumeric(v) ? Number(v) : [...String(v)].length) >= Number(n), message: (a) => numeric ? `The ${a} field must be at least ${n}.` : `The ${a} field must be at least ${n} characters.` }),
    max: (n, numeric) => ({ name: 'max', passes: (v) => (numeric && isNumeric(v) ? Number(v) : [...String(v)].length) <= Number(n), message: (a) => numeric ? `The ${a} field must not be greater than ${n}.` : `The ${a} field must not be greater than ${n} characters.` }),
    in: (list) => ({ name: 'in', passes: (v) => list.split(',').includes(String(v)), message: (a) => `The selected ${a} is invalid.` }),
};

/**
 * Base class of in-cell editable columns. The browser calls `updateTableColumnState(column, key, value)` on the host component:
 * the column must be declared, visible and enabled for this record, and the value must pass the rules; only then do
 * `beforeStateUpdated`, the write and `afterStateUpdated` run. The write does not check model permissions: use `disabled()`
 * to restrict editing.
 */
export abstract class EditableColumn<R = any> extends Column<R> {
    protected _disabled: ((record: R) => boolean | Promise<boolean>) | boolean = false;
    protected _rules: (string | ColumnValidationRule)[] = [];
    protected _validationAttribute: string | null = null;
    protected _validationMessages: Record<string, string> = {};
    protected _updateStateUsing: StateHook<R> | null = null;
    protected _beforeStateUpdated: StateHook<R> | null = null;
    protected _afterStateUpdated: StateHook<R> | null = null;
    protected _tooltip: ((record: R) => string | null) | string | null = null;

    disabled(condition: ((record: R) => boolean | Promise<boolean>) | boolean = true): this { this._disabled = condition; return this; }
    async isDisabledFor(record: R): Promise<boolean> { return typeof this._disabled === 'function' ? this._disabled(record) : this._disabled; }
    /** An editable cell is neither a link nor a button to the record. */
    isClickDisabled(): boolean { return true; }
    isEditable(): boolean { return true; }
    /** Rules applied to the received value: strings (`required`, `max:255`, `in:a,b`…) or `{ name, passes, message }` objects. */
    rules(rules: (string | ColumnValidationRule)[]): this {
        for (const rule of rules) if (typeof rule === 'string' && rule !== 'required' && rule !== 'nullable' && !STRING_RULES[rule.split(':')[0]]) throw new Error(`Validation rule not supported by columns: ${rule}`);
        this._rules = [...rules];
        return this;
    }
    getRules(): (string | ColumnValidationRule)[] { return this._rules; }
    /** Same as adding `required` to the rules. */
    required(condition = true): this { this._rules = [...this._rules.filter((rule) => rule !== 'required'), ...(condition ? ['required'] : [])]; return this; }
    isRequired(): boolean { return this._rules.includes('required'); }
    /** Column name used in messages (defaults to the label with a lowercase first letter). */
    validationAttribute(label: string | null): this { this._validationAttribute = label; return this; }
    /** Custom messages by rule name, e.g. `{ max: 'Too long.' }`. */
    validationMessages(messages: Record<string, string>): this { this._validationMessages = { ...messages }; return this; }
    getValidationAttribute(): string { return this._validationAttribute ?? this.getLabel().replace(/^./, (c) => c.toLowerCase()); }
    /** Rules specific to the column type (e.g. select options). */
    protected getImplicitRules(): ColumnValidationRule[] { return []; }
    /**
     * Error message, or `null` if the value is valid. An empty value is only checked by `required`, and several errors
     * produce the first message followed by "(and N more errors)".
     */
    validate(input: unknown): string | null {
        const attribute = this.getValidationAttribute();
        const blank = isBlank(input);
        const numeric = this._rules.some((rule) => rule === 'numeric' || rule === 'integer');
        const errors: string[] = [];
        const fail = (name: string, message: string) => errors.push(this._validationMessages[name] ?? message);
        if (blank) {
            if (this.isRequired()) fail('required', `The ${attribute} field is required.`);
        } else {
            // Column-type rules first: a malformed value (list, forged object) stops here.
            const implicit = this.getImplicitRules().find((rule) => !rule.passes(input));
            if (implicit) return this._validationMessages[implicit.name] ?? implicit.message(attribute);
            // String rules only apply to scalars: a list or an object fails them.
            const isScalar = ['string', 'number', 'boolean'].includes(typeof input);
            for (const rule of this._rules) {
                if (rule === 'required' || rule === 'nullable') continue;
                const resolved = typeof rule === 'string' ? STRING_RULES[rule.split(':')[0]](rule.slice(rule.indexOf(':') + 1), numeric) : rule;
                if (!((typeof rule !== 'string' || isScalar) && resolved.passes(input))) fail(resolved.name, resolved.message(attribute));
            }
        }
        if (!errors.length) return null;
        return errors.length === 1 ? errors[0] : `${errors[0]} (and ${errors.length - 1} more error${errors.length > 2 ? 's' : ''})`;
    }
    /** Custom write, replacing the update of the record's column. Its return value is sent back to the browser. */
    updateStateUsing(callback: StateHook<R> | null): this { this._updateStateUsing = callback; return this; }
    beforeStateUpdated(callback: StateHook<R> | null): this { this._beforeStateUpdated = callback; return this; }
    afterStateUpdated(callback: StateHook<R> | null): this { this._afterStateUpdated = callback; return this; }
    /** Tooltip on the control, shown while no error is displayed. */
    tooltip(tooltip: ((record: R) => string | null) | string | null): this { this._tooltip = tooltip; return this; }
    getUpdateStateMessages(): Record<'saving' | 'saved' | 'failure', string> {
        return { saving: t('filament-tables::table.columns.editable.saving'), saved: t('filament-tables::table.columns.editable.saved'), failure: t('filament-tables::table.columns.editable.failure') };
    }
    /** Value written from a validated value: blank values become `null`. */
    castState(input: unknown): unknown { return isBlank(input) ? null : input; }
    /**
     * Saves an already validated value. Only the column's declared name is written: a relationship column (`author.name`)
     * can only be edited with `updateStateUsing()`.
     */
    async updateState(record: R, input: unknown, adapter: Pick<DataAdapter<R>, 'getKey' | 'update'>): Promise<unknown> {
        const state = this.castState(input);
        await this._beforeStateUpdated?.({ state, record });
        if (this._updateStateUsing) {
            try { return await this._updateStateUsing({ state, record }); } finally { await this._afterStateUpdated?.({ state, record }); }
        }
        if (this.name.includes('.')) return { error: t('filament-tables::table.columns.editable.unavailable') };
        await adapter.update(adapter.getKey(record), { [this.name]: state });
        await this._afterStateUpdated?.({ state, record });
        return state;
    }
    /** `x-tooltip` expression of editable controls: the column tooltip, replaced by the validation error when there is one. */
    protected tooltipExpression(record: R): string {
        const tooltip = typeof this._tooltip === 'function' ? this._tooltip(record) : this._tooltip;
        return `error === undefined ? ${tooltip !== null && tooltip !== '' ? `{
                        content: ${js(tooltip)},
                        theme: $store.theme,
                        allowHTML: false,
                        aria: { content: 'auto' },
                    }` : 'false'} : {
                        content: error,
                        theme: $store.theme,
                        allowHTML: false,
                        aria: { content: null },
                    }`;
    }
    /** Shared opening markup of editable cells: lazily loaded Alpine component, server state and record key. */
    protected editableAttributes(component: string, asset: string, recordKey: string | number, state: unknown): Attributes {
        return new Attributes().merge({
            'x-load': 'x-load',
            'x-load-src': views.render('filament-tables::asset', { path: `columns/${asset}` }).trim(),
            'x-data': `${component}({
                    messages: ${js(this.getUpdateStateMessages())},
                    name: ${js(this.name)},
                    recordKey: ${js(String(recordKey))},
                    state: ${js(state)},
                })`,
            'x-id': "['table-column-error']",
            'x-on:click.capture': 'preventEdit($event)',
            'x-on:keydown.capture': 'preventEdit($event)',
        });
    }
    protected static readonly STATUS_HTML = `<p x-cloak x-show="error" x-bind:id="$id('table-column-error')" x-ref="error" x-text="error" class="fi-sr-only"></p><p role="status" aria-live="polite" aria-atomic="true" x-text="status" class="fi-sr-only"></p>`;
}

/**
 * In-cell editable select (native select only). The received value must be one of the declared options.
 */
export class SelectColumn<R = any> extends EditableColumn<R> {
    private _options: [string, string][] = [];
    private _selectablePlaceholder = true;
    static make<R = any>(name: string): SelectColumn<R> { return configured(new SelectColumn<R>(name)); }
    options(options: [string, string][] | Record<string, string>): this { this._options = (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]): [string, string] => [String(value), String(label)]); return this; }
    getOptions(): [string, string][] { return this._options; }
    selectablePlaceholder(condition = true): this { this._selectablePlaceholder = condition; return this; }
    protected getImplicitRules(): ColumnValidationRule[] {
        return [{ name: 'in', passes: (v) => (typeof v === 'string' || typeof v === 'number') && this._options.some(([value]) => value === String(v)), message: (a) => `The selected ${a} is invalid.` }];
    }
    async toHtml(record: R, recordKey: string | number = ''): Promise<string> {
        const state = await this.getState(record);
        const value = state === null || state === undefined ? '' : String(state);
        const optionLabel = this._options.find(([option]) => option === value)?.[1] ?? null;
        const isDisabled = await this.isDisabledFor(record);
        const placeholder = t('filament-forms::components.select.placeholder');
        const messages = this.getUpdateStateMessages();
        const config = `selectTableColumn({
                    accessibilityAttributes: [],
                    ariaLabel: ${js(this.getLabel())},
                    canOptionLabelsWrap: true,
                    canSelectPlaceholder: ${js(this._selectablePlaceholder)},
                    clearButtonLabel: ${js(t('filament-forms::components.select.actions.clear.label'))},
                    errorMessage: ${js(t('filament-forms::components.select.error_message'))},
                    hasDynamicOptions: false,
                    hasDynamicSearchResults: false,
                    hasInitialNoOptionsMessage: true,
                    initialOptionLabel: ${js(optionLabel)},
                    isDisabled: ${js(isDisabled)},
                    isHtmlAllowed: false,
                    isNative: true,
                    isSearchable: false,
                    loadingMessage: ${js(t('filament-forms::components.select.loading_message'))},
                    messages: ${js(messages)},
                    name: ${js(this.name)},
                    noOptionsMessage: ${js(t('filament-forms::components.select.no_options_message'))},
                    noSearchResultsMessage: ${js(t('filament-forms::components.select.no_search_results_message'))},
                    options: [],
                    optionsLimit: 50,
                    placeholder: ${js(placeholder)},
                    position: null,
                    recordKey: ${js(String(recordKey))},
                    searchableOptionFields: ${js(['label'])},
                    searchDebounce: 1000,
                    searchingMessage: ${js(t('filament-forms::components.select.searching_message'))},
                    searchLabel: ${js(t('filament-forms::components.select.search_label'))},
                    searchPrompt: ${js(t('filament-forms::components.select.search_prompt'))},
                    state: ${js(state === null || state === undefined ? null : value)},
                })`;
        const select = new Attributes().merge({
            'aria-label': e(this.getLabel()),disabled: true, 'wire:loading.attr': 'disabled', 'wire:target': LOADING_TARGETS,
            'x-bind:aria-invalid': "error ? 'true' : null", 'x-bind:aria-busy': "isLoading ? 'true' : null",
            'x-bind:aria-describedby': "getAccessibilityAttributes([])[ 'aria-describedby' ]", 'x-bind:disabled': isDisabled ? null : 'isLoading', 'x-on:change': 'clearError()',
            'x-tooltip': `error === undefined ? false : {
                        content: error,
                        theme: $store.theme,
                        allowHTML: false,
                        aria: { content: null },

                    }`,
        }).class(['fi-select-input']);
        const options = `${this._selectablePlaceholder ? `<option value="">${e(placeholder)}</option>` : ''}${this._options.map(([option, label]) => `<option value="${e(option)}">${e(label)}</option>`).join('')}`;
        return `<div wire:ignore.self x-load="x-load" x-load-src="${e(views.render('filament-tables::asset', { path: 'columns/select' }).trim())}" x-data="${e(config)}" x-id="['table-column-error']" x-on:click.capture="preventEdit($event)" x-on:keydown.capture="preventEdit($event)" class="fi-ta-select"><input type="hidden" value="${e(value)}" data-option-label="${e(optionLabel ?? '')}" data-disabled="${isDisabled ? 'true' : 'false'}" x-ref="serverState" /><div x-bind:class="{
                    'fi-disabled': isLoading || ${js(isDisabled)},
                    'fi-invalid': error !== undefined,
                }" x-on:click.prevent.stop class="fi-input-wrp"><select x-model="state" ${select.toHtml()}>${options}</select></div><p x-cloak x-show="error" x-bind:id="$id('table-column-error')" x-ref="error" x-text="error" class="fi-sr-only"></p><p role="status" aria-live="polite" aria-atomic="true" x-text="status" class="fi-sr-only"></p></div>`;
    }
}

/** Boolean value received from the browser (already checked by the `boolean` rule): `true`, `false` or `null`. */
const toBoolean = (value: unknown): boolean | null => (isBlank(value) ? null : value === true || value === 1 || value === '1');
const ALIGNMENTS = ['start', 'center', 'end', 'left', 'right', 'justify', 'between'];
const alignmentClass = (alignment: string | null) => (alignment && ALIGNMENTS.includes(alignment) ? `fi-align-${alignment}` : null);

/** In-cell editable toggle. The received value must be a boolean (`boolean` rule by default). */
export class ToggleColumn<R = any> extends EditableColumn<R> {
    private _onColor: string | null = null;
    private _offColor: string | null = null;
    private _onIcon: string | null = null;
    private _offIcon: string | null = null;
    constructor(name: string) { super(name); this._rules = ['boolean']; }
    static make<R = any>(name: string): ToggleColumn<R> { return configured(new ToggleColumn<R>(name)); }
    /** Toggle color when on (`primary` by default) and off (`gray`). */
    onColor(color: string | null): this { this._onColor = color; return this; }
    offColor(color: string | null): this { this._offColor = color; return this; }
    /** Icons shown inside the toggle's thumb. */
    onIcon(icon: string | null): this { this._onIcon = icon; return this; }
    offIcon(icon: string | null): this { this._offIcon = icon; return this; }
    castState(input: unknown): unknown { return toBoolean(input); }
    async toHtml(record: R, recordKey: string | number = ''): Promise<string> {
        const state = Boolean(await this.getState(record));
        const isDisabled = await this.isDisabledFor(record);
        // Gray is the toggle's default color and adds no class.
        const colorClasses = (color: string) => (color === 'gray' ? [] : (colorManager?.getComponentClasses('toggle', color) ?? []));
        const onColorClasses = colorClasses(this._onColor ?? 'primary');
        const onClasses = ['fi-toggle-on', ...onColorClasses].join(' ');
        const offClasses = ['fi-toggle-off', ...colorClasses(this._offColor ?? 'gray')].join(' ');
        const toggleIcon = (name: string | null) => (name ? icon(name, { size: 'xs' }) : '');
        const outer = this.editableAttributes('toggleTableColumn', 'toggle', recordKey, state).class(['fi-ta-toggle', alignmentClass(this._alignment)]);
        const button = new Attributes().merge({
            'aria-disabled': 'true', 'aria-label': e(this.getLabel()),disabled: isDisabled, 'wire:loading.attr': 'disabled', 'wire:target': LOADING_TARGETS,
            'x-bind:aria-invalid': "error ? 'true' : null", 'x-bind:aria-busy': "isLoading ? 'true' : null", 'x-bind:aria-describedby': "getAccessibilityAttributes()['aria-describedby']",
            'x-tooltip': this.tooltipExpression(record),
        }).class(['fi-toggle']);
        // The live toggle is hidden (x-cloak) until Alpine starts; a static copy is shown meanwhile.
        return `<div wire:ignore.self ${outer.toHtml()}><input type="hidden" value="${state ? 1 : 0}" x-ref="serverState" /><div aria-checked="${state ? 'true' : 'false'}" x-bind:aria-checked="state ? 'true' : 'false'" x-bind:tabindex="$el.hasAttribute('disabled') ? '-1' : '0'" x-bind:aria-disabled="isLoading || $el.hasAttribute('disabled') ? 'true' : null" x-on:click.prevent.stop="if (! $el.hasAttribute('disabled')) { clearError(); state = ! state }" x-on:keydown.enter.prevent.stop="if (! $el.hasAttribute('disabled')) { clearError(); state = ! state }" x-on:keydown.space.prevent.stop="if (! $el.hasAttribute('disabled')) { clearError(); state = ! state }" x-bind:class="state ? ${js(onClasses)} : ${js(offClasses)}"${state ? ' x-cloak' : ''} role="switch" ${button.toHtml()}><div><div aria-hidden="true">${toggleIcon(this._offIcon)}</div><div aria-hidden="true">${toggleIcon(this._onIcon)}</div></div></div>${state ? `<div x-cloak="inline-flex" wire:ignore class="${e(['fi-toggle fi-toggle-on fi-hidden', ...onColorClasses].join(' '))}"><div><div aria-hidden="true"></div><div aria-hidden="true">${toggleIcon(this._onIcon)}</div></div></div>` : ''}${EditableColumn.STATUS_HTML}</div>`;
    }
}

/** In-cell editable checkbox. The received value must be a boolean (`boolean` rule by default). */
export class CheckboxColumn<R = any> extends EditableColumn<R> {
    constructor(name: string) { super(name); this._rules = ['boolean']; }
    static make<R = any>(name: string): CheckboxColumn<R> { return configured(new CheckboxColumn<R>(name)); }
    castState(input: unknown): unknown { return toBoolean(input); }
    async toHtml(record: R, recordKey: string | number = ''): Promise<string> {
        const state = Boolean(await this.getState(record));
        const isDisabled = await this.isDisabledFor(record);
        const outer = this.editableAttributes('checkboxTableColumn', 'checkbox', recordKey, state).class(['fi-ta-checkbox', alignmentClass(this._alignment)]);
        const input = new Attributes().merge({
            'aria-label': e(this.getLabel()),disabled: true, 'wire:loading.attr': 'disabled', 'wire:target': LOADING_TARGETS,
            'x-bind:aria-invalid': "error ? 'true' : null", 'x-bind:aria-busy': "isLoading ? 'true' : null", 'x-bind:aria-describedby': "getAccessibilityAttributes([])[ 'aria-describedby' ]",
            'x-bind:disabled': isDisabled ? null : 'isLoading', 'x-on:change': 'clearError()', 'x-tooltip': this.tooltipExpression(record),
        }).class(['fi-checkbox-input']);
        return `<div x-on:click.stop wire:ignore.self ${outer.toHtml()}><input type="hidden" value="${state ? 1 : 0}" x-ref="serverState" /><input type="checkbox" x-bind:class="{
                    'fi-valid': ! error,
                    'fi-invalid': error,
                }" x-model="state" ${input.toHtml()} />${EditableColumn.STATUS_HTML}</div>`;
    }
}

/** In-cell editable text input. Only a string or a number is accepted from the browser. */
export class TextInputColumn<R = any> extends EditableColumn<R> {
    private _type = 'text';
    private _mask: string | null = null;
    private _inputMode: string | null = null;
    private _step: number | string | null = null;
    private _placeholder: string | null = null;
    private _prefix: string | null = null;
    private _suffix: string | null = null;
    private _prefixIcon: string | null = null;
    private _suffixIcon: string | null = null;
    private _prefixIconColor: string | null = null;
    private _suffixIconColor: string | null = null;
    private _prefixInline = false;
    private _suffixInline = false;
    static make<R = any>(name: string): TextInputColumn<R> { return configured(new TextInputColumn<R>(name)); }
    /** HTML input type (`text` by default; `number`, `email`, `color`…). */
    type(type: string | null): this { this._type = type && /^[a-z-]+$/.test(type) ? type : 'text'; return this; }
    /** Alpine input mask (`x-mask`); the input then becomes a text input. */
    mask(mask: string | null): this { this._mask = mask; return this; }
    inputMode(mode: string | null): this { this._inputMode = mode; return this; }
    step(step: number | string | null): this { this._step = step; return this; }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    prefix(label: string | null, isInline = false): this { this._prefix = label; this._prefixInline = isInline; return this; }
    suffix(label: string | null, isInline = false): this { this._suffix = label; this._suffixInline = isInline; return this; }
    inlinePrefix(condition = true): this { this._prefixInline = condition; return this; }
    inlineSuffix(condition = true): this { this._suffixInline = condition; return this; }
    prefixIcon(name: string | null, isInline = false): this { this._prefixIcon = name; this._prefixInline = isInline; return this; }
    suffixIcon(name: string | null, isInline = false): this { this._suffixIcon = name; this._suffixInline = isInline; return this; }
    prefixIconColor(color: string | null): this { this._prefixIconColor = color; return this; }
    suffixIconColor(color: string | null): this { this._suffixIconColor = color; return this; }
    protected getImplicitRules(): ColumnValidationRule[] {
        return [{ name: 'string', passes: (v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)), message: (a) => `The ${a} field must be a string.` }];
    }
    async toHtml(record: R, recordKey: string | number = ''): Promise<string> {
        const raw = await this.getState(record);
        const state = raw === undefined ? null : raw;
        const isDisabled = await this.isDisabledFor(record);
        const type = this._mask ? 'text' : this._type;
        // Affix icon: gray is the default color and adds no class.
        const affixIcon = (name: string | null, color: string | null) => (name ? icon(name, { attributes: new Attributes().class(color && color !== 'gray' ? ['fi-color', `fi-color-${color.replace(/[^a-zA-Z0-9_-]/g, '')}`] : []) }) : '');
        const outer = this.editableAttributes('textInputTableColumn', 'text-input', recordKey, state).class(['fi-ta-text-input']);
        const input = new Attributes().merge({
            'aria-label': e(this.getLabel()),disabled: true, 'wire:loading.attr': 'disabled', 'wire:target': LOADING_TARGETS,
            'x-bind:aria-invalid': "error ? 'true' : null", 'x-bind:aria-busy': "isLoading ? 'true' : null", 'x-bind:aria-describedby': "getAccessibilityAttributes([])[ 'aria-describedby' ]",
            'x-bind:disabled': isDisabled ? null : 'isLoading', 'x-on:input': 'clearError()', inputmode: this._inputMode, placeholder: this._placeholder ? e(this._placeholder) : null, step: this._step,
            type, 'x-mask': this._mask, 'x-tooltip': this.tooltipExpression(record),
        }).class(['fi-input', alignmentClass(this._alignment ?? 'start')]);
        const prefix = this._prefixIcon || this._prefix ? `<div class="fi-input-wrp-prefix fi-input-wrp-prefix-has-content ${this._prefixInline ? 'fi-inline' : ''} ${this._prefix ? 'fi-input-wrp-prefix-has-label' : ''}">${affixIcon(this._prefixIcon, this._prefixIconColor)}${this._prefix ? `<span class="fi-input-wrp-label">${e(this._prefix)}</span>` : ''}</div>` : '';
        const suffix = this._suffixIcon || this._suffix ? `<div class="fi-input-wrp-suffix ${this._suffixInline ? 'fi-inline' : ''} ${this._suffix ? 'fi-input-wrp-suffix-has-label' : ''}">${this._suffix ? `<span class="fi-input-wrp-label">${e(this._suffix)}</span>` : ''}${affixIcon(this._suffixIcon, this._suffixIconColor)}</div>` : '';
        return `<div wire:ignore.self ${outer.toHtml()}><input type="hidden" value="${e(state)}" x-ref="serverState" /><div x-bind:class="{
                    'fi-disabled': isLoading || ${js(isDisabled)},
                    'fi-invalid': error !== undefined,
                }" x-on:click.prevent.stop class="fi-input-wrp">${prefix}<div class="fi-input-wrp-content-ctn"><input${type === 'color' ? ` onclick="if (typeof this.showPicker === 'function') { this.showPicker() }"` : ''} x-model.lazy="state" ${input.toHtml()} /></div>${suffix}</div>${EditableColumn.STATUS_HTML}</div>`;
    }
}

/**
 * Custom-rendered column: `view()` takes a function returning the cell HTML, or the name of an EJS view rendered with
 * `{ state, record, column }`. This HTML is the application's own: data inside it must be escaped there (`e()`).
 */
export class ViewColumn<R = any> extends Column<R> {
    private _view: ((ctx: { state: unknown; record: R; column: ViewColumn<R> }) => string | Promise<string>) | string | null = null;
    private _viewData: Record<string, unknown> = {};
    static make<R = any>(name: string): ViewColumn<R> { return configured(new ViewColumn<R>(name)); }
    view(view: ((ctx: { state: unknown; record: R; column: ViewColumn<R> }) => string | Promise<string>) | string, data: Record<string, unknown> = {}): this { this._view = view; this._viewData = data; return this; }
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        if (this._view === null) throw new Error(`ViewColumn ${this.name}: no view declared (view()).`);
        if (typeof this._view === 'function') return this._view({ state, record, column: this });
        return views.render(this._view, { ...this._viewData, state, record, column: this, getState: () => state, getRecord: () => record });
    }
}

/** @deprecated Use `TextColumn.make(name).badge()`. */
export class BadgeColumn<R = any> extends TextColumn<R> {
    constructor(name: string) { super(name); this.badge(); }
    static make<R = any>(name: string): BadgeColumn<R> { return configured(new BadgeColumn<R>(name)); }
}

/** @deprecated Use `IconColumn.make(name).boolean()`. */
export class BooleanColumn<R = any> extends IconColumn<R> {
    constructor(name: string) { super(name); this.boolean(); }
    static make<R = any>(name: string): BooleanColumn<R> { return configured(new BooleanColumn<R>(name)); }
}

/**
 * Writes an editable cell value received from the browser. Everything is checked again: the column must be declared, editable
 * and visible, the record within the adapter's scope and not disabled for this column, `authorize` (the host's edit permission)
 * must accept it, and the value must pass the column's rules.
 */
export async function updateTableColumnState<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>, columnName: unknown, recordKey: unknown, input: unknown, options: { authorize?: (record: R) => boolean | Promise<boolean> } = {}): Promise<unknown> {
    const unavailable = { error: t('filament-tables::table.columns.editable.unavailable') };
    const column = getVisibleColumns(table, host).find((c) => c.name === columnName);
    if (!(column instanceof EditableColumn)) return unavailable;
    if (typeof recordKey !== 'string' && typeof recordKey !== 'number') return unavailable;
    const record = (await adapter.keysInScope([String(recordKey)])).length ? await adapter.find(String(recordKey)) : null;
    if (!record || (options.authorize && !(await options.authorize(record))) || (await column.isDisabledFor(record))) return unavailable;
    const error = column.validate(input);
    if (error !== null) return { error };
    return column.updateState(record, input, adapter);
}

// ------------------------------------------------------------------ filters
/** Filter state: the values of its form. */
export type FilterState = Record<string, unknown>;
/** Active filter indicator: its label, and the filter field cleared when it is removed. */
export type FilterIndicator = { label: string; field: string };
/** Filters layout: toolbar dropdown (default), or collapsible panel above the content. */
export type FiltersLayout = 'dropdown' | 'above-content-collapsible';
export interface TableFilter {
    readonly name: string;
    getLabel(): string;
    /** Initial state (empty form). */
    getDefaultState(): FilterState;
    /** Options of the `value` field as [value, label] pairs, and the empty option's label. */
    getFormDefinition(): { placeholder: string; options: [string, string][] };
    isActive(state: FilterState): boolean;
    /** Applies the filter to the list query. Only reads known values. */
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void;
    /** Form components of the filter, replacing the select described by `getFormDefinition()`. */
    getFormComponents?(): unknown[];
    getColumnSpan?(): Record<string, number | string>;
    /** Applied state derived from the form state (received from the browser): keeps only what the filter knows. */
    sanitizeState?(state: unknown): FilterState;
    getIndicators?(state: FilterState): FilterIndicator[];
    /** Select options loaded on demand (relationship), replacing those of `getFormDefinition()`. */
    getFormOptions?(): Promise<[string, string][]>;
    removeIndicator?(state: FilterState, field: string): FilterState;
    /** Data loaded from the database before indicators are computed (e.g. related record labels). */
    loadIndicatorData?(state: FilterState, host: TableHost): Promise<void>;
}

/** "Trashed" filter for soft-deletable models. */
export class TrashedFilter implements TableFilter {
    readonly name = 'trashed';
    static make(): TrashedFilter { return configured(new TrashedFilter()); }
    getLabel(): string { return t('filament-tables::table.filters.trashed.label'); }
    getDefaultState(): FilterState { return { value: null }; }
    getFormDefinition() {
        return { placeholder: t('filament-tables::table.filters.trashed.without_trashed'), options: [['1', t('filament-tables::table.filters.trashed.with_trashed')], ['0', t('filament-tables::table.filters.trashed.only_trashed')]] as [string, string][] };
    }
    isActive(state: FilterState): boolean { return ['1', '0'].includes(String(state.value)); }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        query.trashed = String(state.value) === '1' ? 'with' : String(state.value) === '0' ? 'only' : 'without';
    }
}

const filterLabel = (name: string) => name.replace(/[_.-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Filters on a column value picked from a list (single select). */
export class SelectFilter implements TableFilter {
    readonly name: string;
    private _label: string | null = null;
    private _column: string | null = null;
    private _options: [string, string][] | (() => Promise<[string, string][]>) = [];
    constructor(name: string) { this.name = name; }
    static make(name: string): SelectFilter { return configured(new SelectFilter(name)); }
    label(label: string): this { this._label = label; return this; }
    /** Filtered column when it differs from the filter name (e.g. a relationship's foreign key). */
    column(column: string): this { this._column = column; return this; }
    /** Fixed options, or an async function (e.g. records of a relationship). */
    options(options: [string, string][] | Record<string, string> | (() => Promise<[string, string][]>)): this {
        this._options = typeof options === 'function' ? options : (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]): [string, string] => [String(value), String(label)]);
        return this;
    }
    getLabel(): string { return this._label ?? filterLabel(this.name); }
    getDefaultState(): FilterState { return { value: null }; }
    getFormDefinition() { return { placeholder: t('filament-tables::table.filters.select.placeholder'), options: Array.isArray(this._options) ? this._options : [] }; }
    getFormOptions(): Promise<[string, string][]> { return typeof this._options === 'function' ? this._options() : Promise.resolve(this._options); }
    /** Options are evaluated on every render, so the select gets a key derived from them (forces a re-render when they change). */
    readonly hasDynamicOptions = true;
    isActive(state: FilterState): boolean { return typeof state.value === 'string' && state.value !== ''; }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        if (!this.isActive(state)) return;
        const value = String(state.value).slice(0, 255);
        // Fixed options: only an offered value filters. Loaded options: the value is a bound parameter, an unknown value matches nothing.
        if (Array.isArray(this._options) && !this._options.some(([option]) => option === value)) return;
        const column = this._column ?? this.name;
        (query.modifiers ??= []).push((q) => { q.where(column, value); });
    }
}

/** Three-state filter on a boolean column: all, yes, no. */
export class TernaryFilter implements TableFilter {
    readonly name: string;
    private _label: string | null = null;
    constructor(name: string) { this.name = name; }
    static make(name: string): TernaryFilter { return configured(new TernaryFilter(name)); }
    label(label: string): this { this._label = label; return this; }
    getLabel(): string { return this._label ?? filterLabel(this.name); }
    getDefaultState(): FilterState { return { value: null }; }
    getFormDefinition() { return { placeholder: '-', options: [['1', t('filament-forms::components.select.boolean.true')], ['0', t('filament-forms::components.select.boolean.false')]] as [string, string][] }; }
    isActive(state: FilterState): boolean { return ['1', '0'].includes(String(state.value)); }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        if (!this.isActive(state)) return;
        const column = this.name, on = String(state.value) === '1';
        (query.modifiers ??= []).push((q) => { q.where(column, on ? 1 : 0); });
    }
}

/** Custom form filter (`schema()`): the query and indicators are written by the application. */
export class Filter implements TableFilter {
    readonly name: string;
    private _label: string | null = null;
    private _components: unknown[] = [];
    private _query: ((query: any, data: FilterState) => void) | null = null;
    private _indicate: ((data: FilterState) => Record<string, string>) | null = null;
    constructor(name: string) { this.name = name; }
    static make(name: string): Filter { return configured(new Filter(name)); }
    label(label: string): this { this._label = label; return this; }
    /** Filter fields; their names are the only state keys accepted from the browser. */
    schema(components: unknown[]): this { this._components = components; return this; }
    /** Query condition built from the sanitized form state. */
    query(modifier: (query: any, data: FilterState) => void): this { this._query = modifier; return this; }
    /** Indicators of applied values as `{ field: label }`; removing one clears its field. */
    indicateUsing(resolver: (data: FilterState) => Record<string, string>): this { this._indicate = resolver; return this; }
    private fields(): string[] { return this._components.map((c: any) => (typeof c?.getName === 'function' ? String(c.getName()) : null)).filter((name): name is string => name !== null); }
    getLabel(): string { return this._label ?? filterLabel(this.name); }
    getDefaultState(): FilterState { return Object.fromEntries(this.fields().map((name) => [name, null])); }
    getFormDefinition() { return { placeholder: '', options: [] as [string, string][] }; }
    getFormComponents(): unknown[] { return this._components; }
    sanitizeState(state: unknown): FilterState {
        const received = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
        return Object.fromEntries(this.fields().map((name) => { const value = received[name]; return [name, ['string', 'number', 'boolean'].includes(typeof value) && value !== '' ? value : null]; }));
    }
    isActive(state: FilterState): boolean { return Object.values(this.sanitizeState(state)).some((value) => value !== null); }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        const data = this.sanitizeState(state);
        if (this._query && this.isActive(data)) (query.modifiers ??= []).push((q) => { this._query!(q, data); });
    }
    getIndicators(state: FilterState): FilterIndicator[] {
        const data = this.sanitizeState(state);
        if (!this._indicate) return this.isActive(data) ? [{ label: this.getLabel(), field: '' }] : [];
        return Object.entries(this._indicate(data)).map(([field, label]) => ({ field, label }));
    }
    removeIndicator(state: FilterState, field: string): FilterState { return field === '' ? this.getDefaultState() : { ...this.sanitizeState(state), [field]: null }; }
}

// ------------------------------------------------------------------ table
export type ColumnState = { type: 'column'; name: string; label: string; isHidden: boolean; isToggled: boolean; isToggleable: boolean; isToggledHiddenByDefault: boolean | null };

export class Table<R = any> {
    private _columns: Column<R>[] = [];
    private _recordAction: string | null = null;
    private _recordActions: any[] = [];
    private _heading: string | null = null;
    private _headerActions: any[] = [];
    private _bulkActions: any[] | null = null;
    private _recordClasses: ((record: R) => string | null) | null = null;
    private _filters: TableFilter[] = [];
    private _filtersLayout: FiltersLayout = 'dropdown';
    private _defaultSort: { column: string; direction: SortDirection } | null = null;
    private _recordUrl: ((record: R) => string | null) | null = null;
    private _pageOptions = [5, 10, 25, 50];
    private _stackedOnMobile = false;
    private _label = 'records';
    private _groups: Group<R>[] = [];
    private _defaultGroup: Group<R> | string | null = null;
    private _defaultGroupDirection: SortDirection = 'asc';
    private _groupsOnly = false;
    private _groupingSettingsHidden = false;
    private _groupingDirectionSettingHidden = false;
    private _groupingSettingsInDropdownOnDesktop = false;
    private _collapsedGroupsByDefault = false;
    /** Groupings offered in the toolbar (a column id is shorthand for `Group.make(id)`). */
    groups(groups: (Group<R> | string)[]): this { this._groups = groups.map((g) => (typeof g === 'string' ? Group.make<R>(g) : g)); return this; }
    getGroups(): Group<R>[] { return this._groups; }
    getGroup(id: string | null | undefined): Group<R> | null { return this._groups.find((g) => g.getId() === id) ?? null; }
    /**
     * Default grouping. If it is one of `groups()`, it is only preselected when the table opens (`initializeTableGrouping`)
     * and the user can remove it; otherwise it always applies, without a selector.
     */
    defaultGroup(group: Group<R> | string | null, direction: SortDirection = 'asc'): this { this._defaultGroup = group; this._defaultGroupDirection = direction === 'desc' ? 'desc' : 'asc'; return this; }
    getDefaultGroup(): Group<R> | null {
        if (this._defaultGroup === null) return null;
        if (this._defaultGroup instanceof Group) return this._defaultGroup;
        return this.getGroup(this._defaultGroup) ?? Group.make<R>(this._defaultGroup);
    }
    getDefaultGroupDirection(): SortDirection { return this._defaultGroupDirection; }
    isDefaultGroupSelectable(): boolean { const group = this.getDefaultGroup(); return group !== null && this.getGroup(group.getId()) !== null; }
    /** Shows only group headers and summaries, without rows or pagination. */
    groupsOnly(condition = true): this { this._groupsOnly = condition; return this; }
    isGroupsOnly(): boolean { return this._groupsOnly; }
    /** Hides the toolbar grouping selector. */
    groupingSettingsHidden(condition = true): this { this._groupingSettingsHidden = condition; return this; }
    areGroupingSettingsHidden(): boolean { return this._groupingSettingsHidden; }
    /** Hides the grouping direction (ascending / descending) choice. */
    groupingDirectionSettingHidden(condition = true): this { this._groupingDirectionSettingHidden = condition; return this; }
    isGroupingDirectionSettingHidden(): boolean { return this._groupingDirectionSettingHidden; }
    /** Puts the grouping selector in a dropdown on desktop too. */
    groupingSettingsInDropdownOnDesktop(condition = true): this { this._groupingSettingsInDropdownOnDesktop = condition; return this; }
    /** @deprecated Use `groupingSettingsInDropdownOnDesktop()`. */
    groupsInDropdownOnDesktop(condition = true): this { return this.groupingSettingsInDropdownOnDesktop(condition); }
    areGroupingSettingsInDropdownOnDesktop(): boolean { return this._groupingSettingsInDropdownOnDesktop; }
    /** Collapsible groups start collapsed. */
    collapsedGroupsByDefault(condition = true): this { this._collapsedGroupsByDefault = condition; return this; }
    areGroupsCollapsedByDefault(): boolean { return this._collapsedGroupsByDefault; }

    private _columnsLayout: (Column<R> | ColumnLayout<R>)[] | null = null;
    columns(columns: (Column<R> | ColumnGroup<R> | ColumnLayout<R>)[]): this {
        this._columns = columns.flatMap((c) => (c instanceof ColumnGroup || c instanceof ColumnLayout ? c.getColumns() : [c]));
        this._columnsLayout = columns.some((c) => c instanceof ColumnLayout) ? (columns.filter((c) => !(c instanceof ColumnGroup)) as (Column<R> | ColumnLayout<R>)[]) : null;
        return this;
    }
    /** Column layout, or `null` for a regular table. */
    getColumnsLayout(): (Column<R> | ColumnLayout<R>)[] | null { return this._columnsLayout; }
    /** Action mounted when a row is clicked (e.g. `'edit'`), instead of a URL. */
    recordAction(name: string | null): this { this._recordAction = name; return this; }
    getRecordAction(): string | null { return this._recordAction; }
    /** Heading shown in the table header. */
    heading(heading: string | null): this { this._heading = heading; return this; }
    getHeading(): string | null { return this._heading; }
    /** Actions shown in the table header. */
    headerActions(actions: any[]): this { this._headerActions = actions; return this; }
    getHeaderActions(): any[] { return this._headerActions; }
    /** Bulk actions ("Bulk actions" menu); if never called, the host provides its default ones. */
    groupedBulkActions(actions: any[]): this { this._bulkActions = actions; return this; }
    getBulkActions(): any[] | null { return this._bulkActions; }
    /** Row actions: `Action`s or an `ActionGroup` (dropdown). */
    recordActions(actions: any[]): this { this._recordActions = actions; return this; }
    getRecordActions(): any[] { return this._recordActions; }
    /** CSS classes added to a row depending on its record. */
    recordClasses(resolver: (record: R) => string | null): this { this._recordClasses = resolver; return this; }
    getRecordClasses(record: R): string | null { return this._recordClasses ? this._recordClasses(record) : null; }
    filters(filters: TableFilter[], options: { layout?: FiltersLayout } = {}): this { this._filters = filters; if (options.layout) this._filtersLayout = options.layout; return this; }
    filtersLayout(layout: FiltersLayout): this { this._filtersLayout = layout; return this; }
    getFiltersLayout(): FiltersLayout { return this._filtersLayout; }
    /** No-op kept for API compatibility: filters always wait for the "Apply" button. */
    deferFilters(): this { return this; }
    defaultSort(column: string, direction: SortDirection = 'asc'): this { this._defaultSort = { column, direction }; return this; }
    recordUrl(resolver: (record: R) => string | null): this { this._recordUrl = resolver; return this; }
    private _reorderColumn: string | null = null;
    /** Lets users reorder rows by hand; `column` stores the position. */
    reorderable(column: string | null): this { this._reorderColumn = column; return this; }
    getReorderColumn(): string | null { return this._reorderColumn; }
    paginationPageOptions(options: number[]): this { this._pageOptions = options; return this; }
    private _defaultPageOption: number | null = null;
    /** Rows per page when the table opens. */
    defaultPaginationPageOption(option: number | null): this { this._defaultPageOption = option; return this; }
    getDefaultPageOption(): number { return this._defaultPageOption !== null && this._pageOptions.includes(this._defaultPageOption) ? this._defaultPageOption : (this._pageOptions.includes(10) ? 10 : this._pageOptions[0]); }
    private _paginationMode: 'default' | 'simple' = 'default';
    /** `'simple'`: previous / next buttons only, without page numbers or total. */
    paginationMode(mode: 'default' | 'simple'): this { this._paginationMode = mode; return this; }
    getPaginationMode(): 'default' | 'simple' { return this._paginationMode; }
    stackedOnMobile(condition = true): this { this._stackedOnMobile = condition; return this; }
    pluralModelLabel(label: string): this { this._label = label; return this; }

    getColumns(): Column<R>[] { return this._columns; }
    getColumn(name: string): Column<R> | undefined { return this._columns.find((c) => c.name === name); }
    getFilters(): TableFilter[] { return this._filters; }
    getDefaultSort(): { column: string; direction: SortDirection } | null { return this._defaultSort; }
    getRecordUrl(record: R): string | null { return this._recordUrl ? this._recordUrl(record) : null; }
    getPageOptions(): number[] { return this._pageOptions; }
    isStackedOnMobile(): boolean { return this._stackedOnMobile; }
    getPluralModelLabel(): string { return this._label; }
    hasToggleableColumns(): boolean { return this._columns.some((c) => c.isToggleable()); }

    /** Default column manager state. */
    getDefaultColumnState(): ColumnState[] {
        return this._columns.map((c) => ({ type: 'column', name: c.name, label: c.getLabel(), isHidden: false, isToggled: !c.isToggleable() || !c.isToggledHiddenByDefault(), isToggleable: c.isToggleable(), isToggledHiddenByDefault: c.isToggleable() ? c.isToggledHiddenByDefault() : null }));
    }
    getDefaultFilterState(): Record<string, FilterState> { return Object.fromEntries(this._filters.map((f) => [f.name, f.getDefaultState()])); }
}

/** Table state held by the host component. */
export interface TableHost {
    readonly id: string;
    tableSearch: string;
    tableSort: string | null;
    tableColumnSearches: Record<string, string>;
    tableRecordsPerPage: number;
    paginators: Record<string, number>;
    tableFilters?: Record<string, FilterState>;
    tableColumns?: ColumnState[];
    /** Current grouping: `id` or `id:direction`. */
    tableGrouping?: string | null;
    /** Reordering mode: all rows, in position order, with drag handles. */
    isTableReordering?: boolean;
}

/** Visible columns: those left checked in the column manager. Browser state can only hide columns declared toggleable. */
export function getVisibleColumns<R>(table: Table<R>, host: TableHost): Column<R>[] {
    const hidden = new Set((Array.isArray(host.tableColumns) ? host.tableColumns : []).filter((c) => c && c.isToggled === false).map((c) => c.name));
    return table.getColumns().filter((c) => !(c.isToggleable() && hidden.has(c.name)));
}
/** Sanitizes column state from the browser: only `isToggled` of toggleable columns is kept. */
export function sanitizeColumnState<R>(table: Table<R>, state: unknown): ColumnState[] {
    const received = new Map((Array.isArray(state) ? state : []).filter((c) => c && typeof c === 'object').map((c: any) => [String(c.name), c.isToggled]));
    return table.getDefaultColumnState().map((c) => (c.isToggleable && typeof received.get(c.name) === 'boolean' ? { ...c, isToggled: received.get(c.name) as boolean } : c));
}

/**
 * List query (search, column searches, filters, sort) for the host's state, without pagination.
 * Only what the table declares is accepted, whatever state the browser sends.
 */
export function getTableQuery<R>(table: Table<R>, host: TableHost): Omit<ListQuery, 'page' | 'perPage'> {
    const [column, direction] = (host.tableSort ?? '').split(':');
    const sortColumn = table.getColumn(column);
    const query: Omit<ListQuery, 'page' | 'perPage'> = {
        search: host.tableSearch,
        searchColumns: table.getColumns().filter((c) => c.isGloballySearchable()).map((c) => c.getSearchColumn()),
        columnSearches: Object.fromEntries(table.getColumns().filter((c) => c.isIndividuallySearchable() && String(host.tableColumnSearches?.[c.name] ?? '').trim() !== '').map((c) => [c.name, String(host.tableColumnSearches[c.name])])),
        sort: sortColumn?.isSortable() ? { column: sortColumn.getSortColumn(), direction: ((direction === 'desc') !== sortColumn.isSortInverted() ? 'desc' : 'asc') as SortDirection } : table.getDefaultSort(),
    };
    const grouping = getTableGrouping(table, host);
    if (grouping) query.groupSort = { column: grouping.group.getColumn(), direction: grouping.direction };
    // The host can restrict the query (active list tab).
    (host as any).modifyTableQuery?.(query);
    for (const filter of table.getFilters()) {
        const state = host.tableFilters?.[filter.name];
        filter.apply(query, state && typeof state === 'object' ? state : filter.getDefaultState());
    }
    return query;
}
/** Current grouping: only a group declared by the table is accepted, whatever state the browser sends. */
export function getTableGrouping<R>(table: Table<R>, host: TableHost): { group: Group<R>; direction: SortDirection } | null {
    if (host.isTableReordering === true) return null;
    const [id, direction] = String(host.tableGrouping ?? '').split(':');
    const group = table.getGroup(id);
    if (group) return { group, direction: direction === 'desc' ? 'desc' : 'asc' };
    // A default grouping missing from the selector always applies; one listed in the selector only applies when chosen.
    const fallback = table.isDefaultGroupSelectable() ? null : table.getDefaultGroup();
    return fallback ? { group: fallback, direction: table.getDefaultGroupDirection() } : null;
}
/** When the table opens (host mount): preselects the default grouping when the user can change it. */
export function initializeTableGrouping<R>(table: Table<R>, host: TableHost): void {
    const group = table.getDefaultGroup();
    if ((host.tableGrouping === null || host.tableGrouping === undefined || host.tableGrouping === '') && group && table.isDefaultGroupSelectable()) host.tableGrouping = `${group.getId()}:${table.getDefaultGroupDirection()}`;
}
export function countActiveFilters<R>(table: Table<R>, host: TableHost): number {
    // The count is the number of indicators; an active filter without indicators counts as one.
    return table.getFilters().reduce((total, f) => { const s = host.tableFilters?.[f.name]; return total + (!s || typeof s !== 'object' ? 0 : f.getIndicators ? f.getIndicators(s).length : f.isActive(s) ? 1 : 0); }, 0);
}

/** Indicators of the applied filters (only filters that declare some have them). */
export function getFilterIndicators<R>(table: Table<R>, host: TableHost): { filter: string; field: string; label: string }[] {
    return table.getFilters().flatMap((f) => { const s = host.tableFilters?.[f.name]; return s && typeof s === 'object' && f.getIndicators ? f.getIndicators(s).map((indicator) => ({ filter: f.name, ...indicator })) : []; });
}

/** Cycles a column's sort: none → asc → desc → none. */
export function sortTable(host: TableHost, column: string | null = null, direction: string | null = null): void {
    const [current, currentDirection] = (host.tableSort ?? '').split(':');
    if (column === (host.tableSort ? current : null)) direction ??= (currentDirection ?? 'asc') === 'asc' ? 'desc' : currentDirection === 'desc' ? null : 'asc';
    else direction ??= 'asc';
    host.tableSort = direction ? `${column}:${direction}` : null;
    host.paginators.page = 1;
}

/** Loads the page of records matching the host's state. */
export async function getTableRecords<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>): Promise<RecordPage<R>> {
    const options = table.getPageOptions();
    const perPage = options.includes(Number(host.tableRecordsPerPage)) ? Number(host.tableRecordsPerPage) : options[0];
    return adapter.paginate({ ...getTableQuery(table, host), page: Number(host.paginators.page) || 1, perPage });
}

/** Pagination elements: the first and last pages and a window around the current page, with `...` gaps. */
export function paginationElements(current: number, last: number, onEachSide = 0): (number | '...')[] {
    const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
    if (last < onEachSide * 2 + 8) return range(1, last);
    const window = onEachSide + 4;
    if (current <= window) return [...range(1, window + onEachSide), '...', last - 1, last];
    if (current > last - window) return [1, 2, '...', ...range(last - (window + (onEachSide - 1)), last)];
    return [1, 2, '...', ...range(current - onEachSide, current + onEachSide), '...', last - 1, last];
}

let colorManager: ColorManager | null = null;
export const useColorManager = (manager: ColorManager) => { colorManager = manager; };

export type RenderTableOptions<R> = {
    rowActions?: (record: R) => { label: string; url: string; icon: string; key: string }[] | Promise<{ label: string; url: string; icon: string; key: string }[]>;
    /** `false`: reordering is not offered (user not authorized). */
    canReorder?: boolean;
    /** HTML placed in `.fi-ta`, after the table container (action modals). */
    after?: string;
    /** Already rendered HTML of the table header actions. */
    headerActions?: string[];
    /** Already rendered HTML of the row actions (ActionGroup…), replacing the `rowActions` links. */
    rowActionsHtml?: (record: R) => Promise<string>;
    bulkActions?: string[];
    /** HTML of the filters form (`tableFiltersForm` schema), if there are filters. */
    filtersForm?: string | null;
};

/** Maximum number of rows shown (and reorderable) in reordering mode. */
export const REORDER_LIMIT = 1000;

type SummaryCell = { alignment: string; items: SummaryItem[] };
type SummaryRow = { heading: string; cells: SummaryCell[]; striped: boolean };
/** Placeholder cells of summary rows: selection cell before, actions cell after (like record rows). */
type SummaryPlaceholders = { selection: boolean; actions: boolean };

/** Summary row; with `groupsOnly`, a leading label cell, then one cell per column. */
function summaryRowHtml(row: SummaryRow, span: number, groupsOnly: boolean, placeholders: SummaryPlaceholders): string {
    const items = (cell: SummaryCell) => cell.items.map((item) => `<div class="fi-ta-${item.type}-summary">${item.label !== null ? `<span class="fi-ta-${item.type}-summary-label">${e(item.label)}</span>` : ''}<span>${e(item.value)}</span></div>`).join('');
    const heading = groupsOnly
        ? `<th scope="row" class="fi-ta-cell fi-ta-summary-row-heading-cell fi-align-start">${e(row.heading)}</th>`
        : `<th scope="row"${span > 1 ? ` colspan="${span}"` : ''} class="fi-ta-cell fi-align-start fi-ta-summary-row-heading-cell ">${e(row.heading)}</th>`;
    return `<tr class="fi-ta-row fi-ta-summary-row${row.striped ? ' fi-striped' : ''}">${placeholders.selection ? '<td></td>' : ''}${heading}${row.cells.map((cell) => `<td class="fi-ta-cell fi-align-${e(cell.alignment)} ">${items(cell)}</td>`).join('')}${placeholders.actions ? '<td></td>' : ''}</tr>`;
}

/**
 * Table summaries: a single "Summary" row without pagination; with several pages, a header then "This page" and "All …" rows.
 * Also returns what is needed to compute a group's summary row (query restricted to the group).
 */
async function summarize<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>, visible: Column<R>[], page: { records: R[]; lastPage: number }, options: { group: Group<R> | null; groupsOnly: boolean; placeholders: SummaryPlaceholders }) {
    // Groups only: the grouped column has no summary cell (its label already leads the row).
    const columns = options.groupsOnly && options.group ? visible.filter((c) => c.name !== options.group!.getColumn()) : visible;
    const lists = columns.map((c) => (c instanceof TextColumn ? c.getSummarizers() : []));
    if (!lists.some((list) => list.length) || !page.records.length) return null;
    // The first cell holds the row label and spans up to the first summarized column after it.
    const next = lists.findIndex((list, i) => i > 0 && list.length > 0);
    const span = options.groupsOnly ? 0 : next < 0 ? columns.length : next;
    const columnOf = (c: Column<R>) => c.getSortColumn?.() ?? c.name;
    const names = (kind: Summarizer['kind']) => [...new Set(columns.filter((_, i) => lists[i].some((s) => s.kind === kind)).map(columnOf))];
    const aggregate = (query: Omit<ListQuery, 'page' | 'perPage'>): Promise<SummaryValues> => adapter.aggregate(query, { sum: names('sum'), avg: names('avg'), min: names('range'), max: names('range') });
    const query = getTableQuery(table, host);
    const all = await aggregate(query);
    const present = (name: string) => page.records.map((record) => (record as any)[name]).filter((v) => v !== null && v !== undefined && v !== '');
    const onPage: SummaryValues = {
        count: page.records.length,
        sum: Object.fromEntries(names('sum').map((name) => [name, present(name).reduce((total, v) => total + Number(v), 0)])),
        avg: Object.fromEntries(names('avg').map((name) => { const values = present(name); return [name, values.length ? values.reduce((total, v) => total + Number(v), 0) / values.length : 0]; })),
        min: Object.fromEntries(names('range').map((name) => [name, present(name).map(String).sort()[0] ?? null])),
        max: Object.fromEntries(names('range').map((name) => [name, present(name).map(String).sort().pop() ?? null])),
    };
    const cells = (values: SummaryValues): SummaryCell[] => columns.slice(span).map((c, i) => ({
        alignment: c.getAlignment() ?? 'start',
        items: lists[i + span].map((s) => s.summarize(columnOf(c), values)).filter((item): item is SummaryItem => item !== null),
    }));
    const label = table.getPluralModelLabel();
    const hasPageSummary = !options.groupsOnly && page.lastPage > 1;
    const rowHtml = (row: SummaryRow) => summaryRowHtml(row, span, options.groupsOnly, options.placeholders);
    const header = hasPageSummary
        ? `<tr class="fi-ta-row fi-ta-summary-header-row fi-striped">${options.placeholders.selection ? '<td></td>' : ''}${columns.map((c, i) => {
            const heading = i === 0 ? t('filament-tables::table.summary.heading', { label }) : lists[i].length ? c.getLabel() : null;
            return heading === null ? '<td class="fi-ta-cell fi-ta-summary-header-cell"></td>' : `<th scope="col" class="fi-ta-cell fi-ta-summary-header-cell fi-align-${e(i === 0 ? 'start' : (c.getAlignment() ?? 'start'))}">${e(heading)}</th>`;
        }).join('')}${options.placeholders.actions ? '<td></td>' : ''}</tr>`
        : '';
    const rows = hasPageSummary
        ? [{ heading: t('filament-tables::table.summary.subheadings.page', { label }), cells: cells(onPage), striped: false }, { heading: t('filament-tables::table.summary.subheadings.all', { label }), cells: cells(all), striped: false }]
        : [{ heading: t('filament-tables::table.summary.heading', { label }), cells: cells(all), striped: true }];
    return {
        html: header + rows.map(rowHtml).join(''),
        /** Group summary row: aggregates over all the group's records (not only those on the page). */
        group: async (group: Group<R>, key: string | null, title: string | null): Promise<string> => {
            const values = await aggregate({ ...query, modifiers: [...(query.modifiers ?? []), (q: any) => group.scope(q, key)] });
            return rowHtml({ heading: options.groupsOnly ? (title ?? '') : t('filament-tables::table.summary.subheadings.group', { group: title ?? '', label }), cells: cells(values), striped: false });
        },
    };
}

/** Maximum records read for a `groupsOnly` table (which is not paginated). */
export const GROUPS_ONLY_LIMIT = 1000;

export async function renderTable<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>, options: RenderTableOptions<R> = {}): Promise<string> {
    const reorderColumn = options.canReorder === false ? null : table.getReorderColumn();
    const reordering = reorderColumn !== null && host.isTableReordering === true;
    // Reordering: all rows of the query, in position order, without pagination or actions.
    if (reordering) options = { ...options, bulkActions: [], headerActions: options.headerActions, rowActions: undefined, rowActionsHtml: undefined, filtersForm: null };
    const grouping = reordering ? null : getTableGrouping(table, host);
    // Groups only: no pagination and no record rows, just one summary row per group.
    const groupsOnly = grouping !== null && table.isGroupsOnly();
    const page = reordering
        ? await adapter.paginate({ ...getTableQuery(table, host), sort: { column: reorderColumn!, direction: 'asc' }, page: 1, perPage: REORDER_LIMIT })
        : groupsOnly ? await adapter.paginate({ ...getTableQuery(table, host), page: 1, perPage: GROUPS_ONLY_LIMIT }) : await getTableRecords(table, host, adapter);
    const [sortColumn, sortDirection] = (host.tableSort ?? '').split(':');
    const number = (n: number) => n.toLocaleString('en-US');
    const visible = getVisibleColumns(table, host);
    const rows = [];
    const hasBulk = (options.bulkActions ?? []).length > 0;
    const selectable = (hasBulk || reordering) && !groupsOnly;
    const filled = (value: string | null) => value !== null && value.trim() !== '';
    // A new group starts when the title changes; the previous group then gets its summary row.
    let previousGroup: { key: string | null; title: string | null } = { key: null, title: null };
    const columnsLayout = table.getColumnsLayout();
    const visibleSet = new Set(visible);
    for (const record of page.records) {
        const key = adapter.getKey(record);
        let groupHeader: { key: string | null; title: string | null; label: string | null; description: string | null; collapsible: boolean; keys: string[]; ariaHidden: boolean } | null = null;
        let summaryBefore: { key: string | null; title: string | null } | null = null;
        const groupKey = grouping ? grouping.group.getStringKey(record) : null;
        const groupTitle = grouping ? grouping.group.getTitle(record) : null;
        if (grouping && String(groupTitle ?? '') !== String(previousGroup.title ?? '')) {
            if (filled(previousGroup.title)) summaryBefore = previousGroup;
            const query = getTableQuery(table, host);
            const label = grouping.group.isTitlePrefixedWithLabel() ? grouping.group.getLabel() : null;
            const description = grouping.group.getDescription(record);
            if (!groupsOnly) groupHeader = {
                key: groupKey, title: groupTitle, label, description, collapsible: grouping.group.isCollapsible(),
                // Keys of the whole group (not only the page), for its "select all" checkbox.
                keys: hasBulk ? await adapter.listKeys({ ...query, modifiers: [...(query.modifiers ?? []), (q: any) => grouping.group.scope(q, groupKey)] }) : [],
                // Header with nothing to announce: hidden from assistive technologies.
                ariaHidden: !(filled(groupTitle) || filled(label) || filled(description) || grouping.group.isCollapsible() || selectable),
            };
        }
        previousGroup = { key: groupKey, title: groupTitle };
        const cells = [];
        if (!groupsOnly) for (const column of visible) cells.push({ name: column.name, cssName: column.getCssName(), alignment: column.getAlignment(), label: column.getLabel(), url: column.getUrl(record), html: await column.toHtml(record, key), plain: column.isClickDisabled() });
        const recordAction = table.getRecordAction();
        if (reordering) for (const cell of cells) cell.url = null;
        let contentHtml: string | null = null;
        if (columnsLayout && !groupsOnly) { contentHtml = ''; for (const node of columnsLayout) contentHtml += await renderColumnLayout(node, record, key, visibleSet); }
        rows.push({
            contentHtml, summaryBefore, groupSummaryHtml: '',
            groupHeader, groupKey, collapsedExpression: grouping?.group.isCollapsible() ? `isGroupCollapsed(${js(groupTitle)})` : null,
            reorder: reordering ? { id: `${host.id}-table-reorder-${createHash('md5').update(key).digest('hex')}`, label: String((record as any)[table.getColumns()[0]?.name ?? ''] ?? key), position: rows.length + 1 } : null,
            wasClickable: reordering && (recordAction !== null || table.getRecordUrl(record) !== null),
            key, url: reordering ? null : recordAction ? null : table.getRecordUrl(record), cells, actions: groupsOnly ? [] : ((await options.rowActions?.(record)) ?? []),
            actionsHtml: options.rowActionsHtml && !groupsOnly ? await options.rowActionsHtml(record) : null, classes: table.getRecordClasses(record),
            // Row click: the action is mounted with the record key.
            mountExpression: reordering ? null : recordAction ? `mountAction(${js(recordAction)}, {}, ${js({ table: true, recordKey: key })})` : null,
        });
    }
    const hasRowActions = rows.some((row) => row.actionsHtml !== null || row.actions.length > 0);
    // Summaries: never while reordering; group summaries go before the next group's header.
    const summary = reordering ? null : await summarize(table, host, adapter, visible, page, { group: grouping?.group ?? null, groupsOnly, placeholders: { selection: selectable, actions: hasRowActions } });
    let trailingGroupSummary = '';
    if (summary && grouping) {
        for (const row of rows) if (row.summaryBefore) row.groupSummaryHtml = await summary.group(grouping.group, row.summaryBefore.key, row.summaryBefore.title);
        // Last group on the page: summarized only if it does not continue on the next page.
        let trailing = filled(previousGroup.title);
        if (trailing && !groupsOnly && page.page < page.lastPage) {
            const nextRecord = (await adapter.paginate({ ...getTableQuery(table, host), page: page.page * page.perPage + 1, perPage: 1 })).records[0];
            trailing = !nextRecord || grouping.group.getStringKey(nextRecord) !== previousGroup.key;
        }
        if (trailing) trailingGroupSummary = await summary.group(grouping.group, previousGroup.key, previousGroup.title);
    }
    const classes = (component: 'button' | 'badge' | 'link', color: string) => colorManager?.getComponentClasses(component, color) ?? [];
    for (const filter of table.getFilters()) {
        const state = host.tableFilters?.[filter.name];
        if (filter.loadIndicatorData && state && typeof state === 'object') await filter.loadIndicatorData(state, host);
    }
    const scopes = (host as any).getRenderHookScopes?.() ?? [];
    return views.render('filament-tables::index', {
        contentLayout: columnsLayout !== null,
        hook: (name: string, data: Record<string, unknown> = {}) => renderHook(name, scopes, data), hasHook: (name: string) => hasRenderHook(name, scopes),
        visibleColumns: visible, isReordering: reordering,
        groups: reordering || table.areGroupingSettingsHidden() ? [] : table.getGroups().map((g) => ({ id: g.getId(), label: g.getLabel() })),
        grouping: { directionHidden: table.isGroupingDirectionSettingHidden(), inDropdownOnDesktop: table.areGroupingSettingsInDropdownOnDesktop(), collapsedByDefault: table.areGroupsCollapsedByDefault(), groupsOnly },
        id: host.id, targets: LOADING_TARGETS, table, rows, page, number,
        reorder: reorderColumn !== null ? { active: reordering } : null,
        // No checkboxes without bulk actions (or in groups-only mode), no actions column without row actions.
        selectable, hasRowActions,
        // The key changes on every render to force the checkbox to be replaced.
        randomKey: () => Array.from(randomBytes(16), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join(''),
        // "Select all" covers every record of the current query.
        allCount: table.getPaginationMode() === 'simple' ? '' : page.total, resultsCount: table.getPaginationMode() === 'simple' ? rows.length : page.total,
        columns: visible.map((c) => ({ name: c.name, grouped: c._group !== null, cssName: c.getCssName(), alignment: c.getAlignment(), label: c.getLabel(), sortable: !reordering && c.isSortable(), individuallySearchable: !reordering && c.isIndividuallySearchable(), sort: sortColumn === c.name ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none' })),
        linkClasses: classes('link', 'primary'), dangerLinkClasses: classes('link', 'danger'), primaryButtonClasses: classes('button', 'primary'), badgeClasses: classes('badge', 'primary'), indicatorBadgeClasses: classes('badge', 'primary'),
        bulkActions: options.bulkActions ?? [],
        filtersForm: options.filtersForm ?? null, activeFiltersCount: countActiveFilters(table, host), filtersLayout: table.getFiltersLayout(), filterIndicators: getFilterIndicators(table, host),
        hasColumnManager: !reordering && table.hasToggleableColumns(),
        afterContainer: options.after ?? '', heading: table.getHeading(), headerActions: options.headerActions ?? [], summaryHtml: summary?.html ?? '', trailingGroupSummary,
        // Column group header row: one cell per ungrouped column, one merged cell per run of columns in the same group.
        headerGroups: visible.some((c) => c._group !== null) ? visible.reduce<{ label: string | null; span: number }[]>((runs, c) => {
            const last = runs[runs.length - 1];
            if (c._group !== null && last && last.label === c._group) last.span++;
            else runs.push({ label: c._group, span: 1 });
            return runs;
        }, []) : null,
        isSearchable: !reordering && table.getColumns().some((c) => c.isGloballySearchable()),
        pagination: reordering || groupsOnly ? '' : views.render('filament::components.pagination', {
            id: host.id, targets: LOADING_TARGETS + ',paginators', page, number, pageOptions: table.getPageOptions(), elements: paginationElements(page.page, page.lastPage), simple: table.getPaginationMode() === 'simple',
            attrs: (o: Record<string, any>) => new Attributes(o),
        }),
    });
}
