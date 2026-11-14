// @navette-js/tables — tables: columns, filters, state (search, sort, pagination, columns) and rendering.
import type { DataAdapter, ListQuery, Page as RecordPage, SortDirection } from '@navette-js/database';
import { Attributes, cls, e, hasRenderHook, icon, icons, js, markdownToHtml, renderHook, sanitizeHtml, views, type ColorManager, configured, configureUsing } from '@navette-js/support';
import { diffForHumans, t, tc } from '@navette-js/support/i18n';
import { Checkbox, Select, Toggle } from '@navette-js/forms';
import { modal } from '@navette-js/support/ui';
import { applyConditions, loadRelationshipOptions, modelOfHost, type RelationshipQueryModifier } from './query-builder.ts';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

views.namespace('filament-tables', fileURLToPath(new URL('../views', import.meta.url)));
export * from './query-builder.ts';
export { makeTableSelectTable } from './table-select.ts';

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
/** Screen size names of `visibleFrom()` and `hiddenFrom()`. */
const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', '2xl'];
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
    protected _summarizers: Summarizer[] = [];
    /** Summary row below the table. */
    summarize(summarizer: Summarizer | Summarizer[]): this { this._summarizers = Array.isArray(summarizer) ? summarizer : [summarizer]; return this; }
    getSummarizers(): Summarizer[] { return this._summarizers; }
    /** `column`: column (or query alias) to sort by when it differs from the name, e.g. for a relationship. */
    sortable(condition: boolean | { column: string; inverted?: boolean } = true): this { this._sortable = condition !== false; this._sortColumn = typeof condition === 'object' ? condition.column : null; this._sortInverted = typeof condition === 'object' && condition.inverted === true; return this; }
    getSortColumn(): string { return this._sortColumn ?? this.name; }
    private _sortInverted = false;
    /** `inverted`: the sort column runs opposite to the displayed value (e.g. an age sorted by birth date). */
    isSortInverted(): boolean { return this._sortInverted; }
    /** Link on the cell; takes precedence over the row action. */
    url(resolver: (record: R) => string | null): this { this._url = resolver; return this; }
    protected _cellAction: string | { getName(): string } | null = null;
    /**
     * Clicking the cell runs an action on its record: the name of a record action of the table, or an `Action` (checked and
     * authorized like record actions when it is mounted). A column `url()` takes precedence; the action takes precedence over the row's link and action.
     */
    action(action: string | { getName(): string } | null): this { this._cellAction = action; return this; }
    getAction(): { getName(): string } | null { return this._cellAction !== null && typeof this._cellAction === 'object' ? this._cellAction : null; }
    getActionName(): string | null { return this._cellAction === null ? null : typeof this._cellAction === 'string' ? this._cellAction : this._cellAction.getName(); }
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
    protected _visibleFrom: string | null = null;
    protected _hiddenFrom: string | null = null;
    protected _columnWidth: string | null = null;
    protected _grow: boolean | null = null;
    protected _wrapHeader = false;
    /** Shows the column only from this screen size up (`sm`, `md`, `lg`, `xl`, `2xl`). */
    visibleFrom(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | null): this { this._visibleFrom = breakpoint !== null && BREAKPOINTS.includes(breakpoint) ? breakpoint : null; return this; }
    /** Hides the column from this screen size up. */
    hiddenFrom(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | null): this { this._hiddenFrom = breakpoint !== null && BREAKPOINTS.includes(breakpoint) ? breakpoint : null; return this; }
    /** Classes hiding the header and cells on some screen sizes. */
    getResponsiveClasses(): string[] { return [this._hiddenFrom ? `${this._hiddenFrom}:fi-hidden` : null, this._visibleFrom ? `${this._visibleFrom}:fi-visible` : null].filter((c): c is string => c !== null); }
    /** Width of the column, as a CSS length (`200px`, `20%`...). */
    width(width: string | number | null): this { const text = typeof width === 'number' ? `${width}px` : width; this._columnWidth = text !== null && /^[0-9.]+(px|rem|em|%|ch|vw)$/.test(text.trim()) ? text.trim() : null; return this; }
    getWidth(): string | null { return this._columnWidth; }
    /** The column takes the remaining width of the table (when it has no `width()`). */
    grow(condition = true): this { this._grow = condition; return this; }
    /** In a table, columns do not grow unless told to; in a layout (split), they do. */
    canGrow(defaultValue = false): boolean { return this._grow ?? defaultValue; }
    /** Lets a long label wrap in the header. */
    wrapHeader(condition = true): this { this._wrapHeader = condition; return this; }
    canHeaderWrap(): boolean { return this._wrapHeader; }
    alignEnd(): this { return this.alignment('end'); }
    alignLeft(): this { return this.alignment('left'); }
    alignCenter(): this { return this.alignment('center'); }
    getStateUsing(resolver: StateResolver<R>): this { this._state = resolver; return this; }
    /** Fixed state, or a function of the record (alias of `getStateUsing()` for a value). */
    state(state: unknown | ((record: R) => unknown)): this { this._state = typeof state === 'function' ? ({ record }) => (state as (record: R) => unknown)(record) : () => state; return this; }
    /** True when the state is the record attribute named like the column (no custom state, no relationship). */
    hasAttributeState(): boolean { return this._state === null && !this.name.includes('.'); }
    protected _default: unknown = null;
    /** Value used when the state is empty. */
    default(value: unknown): this { this._default = value; return this; }
    protected _hidden: boolean | (() => boolean) = false;
    protected _visible: boolean | (() => boolean) = true;
    /** Removes the column from the table (header, cells, search, sort and column manager). */
    hidden(condition: boolean | (() => boolean) = true): this { this._hidden = condition; return this; }
    visible(condition: boolean | (() => boolean) = true): this { this._visible = condition; return this; }
    isHidden(): boolean { return Boolean(typeof this._hidden === 'function' ? this._hidden() : this._hidden) || !(typeof this._visible === 'function' ? this._visible() : this._visible); }

    getLabel(): string { return this._label ?? headline(this.name.includes('.') ? this.name.split('.').slice(-2, -1)[0] : this.name); }
    isSortable(): boolean { return this._sortable; }
    isGloballySearchable(): boolean { return this._searchable; }
    isIndividuallySearchable(): boolean { return this._individuallySearchable; }
    isToggleable(): boolean { return this._toggleable; }
    isToggledHiddenByDefault(): boolean { return this._toggledHiddenByDefault; }
    getAlignment(): string | null { return this._alignment; }
    /** Suffix of the `fi-ta-header-cell-…` / `fi-ta-cell-…` classes: underscores become dashes, dots are kept. */
    getCssName(): string { return this.name.replace(/_/g, '-'); }
    async getState(record: R): Promise<unknown> {
        const state = this._state ? await this._state({ record }) : (record as any)[this.name];
        return (state === null || state === undefined || state === '') && this._default !== null ? this._default : state;
    }
    /** True for editable cells: they are not wrapped in a link or button to the record. */
    isClickDisabled(): boolean { return false; }
    abstract toHtml(record: R, recordKey?: string | number): Promise<string>;
}

const isNumericValue = (value: unknown) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
/** Value of an option that may depend on the record and the state item. */
type PerItem<R, T> = T | ((record: R, state: unknown) => T);
const resolveItem = <R, T>(option: PerItem<R, T>, record: R, state: unknown): T => (typeof option === 'function' ? (option as (record: R, state: unknown) => T)(record, state) : option);
const isBlankState = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

/** Date in a PHP-style format (`M j, Y`, `d/m/Y H:i`…), in UTC or in the given IANA time zone. Database values without a zone are read as UTC. */
export function formatDate(value: unknown, format: string, timeZone: string | null = null): string {
    const raw = value instanceof Date ? value : new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(String(value)) ? String(value) : `${String(value).replace(' ', 'T').slice(0, 19)}Z`);
    if (Number.isNaN(raw.getTime())) return String(value);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: timeZone ?? 'UTC', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23', weekday: 'long' }).formatToParts(raw).map((p) => [p.type, p.value]));
    const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day), hour = Number(parts.hour), minute = Number(parts.minute), second = Number(parts.second);
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1)));
    const pad = (n: number) => String(n).padStart(2, '0');
    const zone = timeZone ? (new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(raw).find((p) => p.type === 'timeZoneName')?.value ?? timeZone) : 'UTC';
    const tokens: Record<string, () => string> = {
        d: () => pad(day), j: () => String(day), D: () => parts.weekday.slice(0, 3), l: () => parts.weekday,
        S: () => (day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'),
        m: () => pad(month), n: () => String(month), M: () => monthName.slice(0, 3), F: () => monthName,
        Y: () => String(year), y: () => String(year).slice(-2),
        H: () => pad(hour), G: () => String(hour), h: () => pad(hour % 12 || 12), g: () => String(hour % 12 || 12),
        i: () => pad(minute), s: () => pad(second), a: () => (hour < 12 ? 'am' : 'pm'), A: () => (hour < 12 ? 'AM' : 'PM'), T: () => zone,
    };
    let out = '';
    for (let index = 0; index < format.length; index++) {
        const character = format[index];
        if (character === '\\' && index + 1 < format.length) { out += format[++index]; continue; }
        out += tokens[character] ? tokens[character]() : character;
    }
    return out;
}

const TEXT_SIZES = new Set(['xs', 'sm', 'md', 'lg']);
const tooltipAttribute = (tooltip: string) => `{
                                content: ${js(tooltip)},
                                theme: $store.theme,
                                allowHTML: false,
                            }`;

export class TextColumn<R = any> extends Column<R> {
    private _weight: PerItem<R, string | null> = null;
    private _copyable: PerItem<R, boolean> = false;
    private _copyableState: PerItem<R, string | null> = null;
    private _copyMessage: string | null = null;
    private _copyMessageDuration = 2000;
    private _money: string | ((record: R) => string) | null = null;
    private _placeholder: string | null = null;
    private _badge = false;
    private _color: PerItem<R, string | null> = null;
    private _icon: PerItem<R, string | null> | null = null;
    private _iconColor: PerItem<R, string | null> = null;
    private _iconPosition: 'before' | 'after' = 'before';
    private _format: ((ctx: { state: unknown; record: R }) => string) | null = null;
    private _date: string | null = null;
    private _timeZone: string | null = null;
    private _since = false;
    private _numeric = false;
    private _decimals: number | null = null;
    private _limit: number | null = null;
    private _words: number | null = null;
    private _prefix: string | null = null;
    private _suffix: string | null = null;
    private _tooltip: PerItem<R, string | null> = null;
    private _size: PerItem<R, string | null> = null;
    private _fontFamily: PerItem<R, string | null> = null;
    private _wrap = false;
    private _lineClamp: number | null = null;
    private _inline = false;
    private _descriptionAbove: ((record: R) => string | null) | string | null = null;
    private _descriptionBelow: ((record: R) => string | null) | string | null = null;
    private _listWithLineBreaks = false;
    private _bulleted = false;
    private _listLimit: number | null = null;
    private _expandableLimitedList = false;
    private _separator: string | null = null;

    static make<R = any>(name: string): TextColumn<R> { return configured(new TextColumn<R>(name)); }
    /** Displays the value in a badge. */
    badge(condition = true): this { this._badge = condition; return this; }
    /** Text color (or badge color): a color name, or a function of the record and the state item. */
    color(color: PerItem<R, string | null>): this { this._color = color; return this; }
    /** Icon next to the text: a name, or a function of the record and the state item returning a name or `null`. */
    icon(icon: PerItem<R, string | null> | null): this { this._icon = icon; return this; }
    iconColor(color: PerItem<R, string | null>): this { this._iconColor = color; return this; }
    iconPosition(position: 'before' | 'after'): this { this._iconPosition = position; return this; }
    /** Text displayed instead of the raw value (e.g. an enum label). */
    formatStateUsing(formatter: (ctx: { state: unknown; record: R }) => string): this { this._format = formatter; return this; }
    /** Date in a PHP-style format, `M j, Y` by default ("Nov 9, 2026"). `timeZone`: IANA zone to display the date in. */
    date(format: string | boolean = 'M j, Y', timeZone: string | null = null): this { this._date = format === false ? null : format === true ? 'M j, Y' : format; this._timeZone = timeZone; return this; }
    /** Date and time, `M j, Y H:i:s` by default. */
    dateTime(format: string | boolean = 'M j, Y H:i:s', timeZone: string | null = null): this { return this.date(format === true ? 'M j, Y H:i:s' : format, timeZone); }
    /** Time only, `H:i:s` by default. */
    time(format = 'H:i:s', timeZone: string | null = null): this { return this.date(format, timeZone); }
    /** Relative date, e.g. "2 days ago". */
    since(condition = true): this { this._since = condition; return this; }
    /** Time zone used by `date()`, `dateTime()` and `time()`. */
    timezone(timeZone: string | null): this { this._timeZone = timeZone; return this; }
    /** Number formatted with thousands separators; `numeric(1)`: fixed number of decimals. */
    numeric(condition: boolean | number = true): this { this._numeric = condition !== false; this._decimals = typeof condition === 'number' ? condition : null; return this; }
    /** Font weight: `thin`, `light`, `medium`, `semibold`, `bold`… */
    weight(weight: PerItem<R, string | null>): this { this._weight = weight; return this; }
    /** Text size: `xs`, `sm` (default), `md` or `lg`. */
    size(size: PerItem<R, string | null>): this { this._size = size; return this; }
    /** Font family: `sans`, `serif` or `mono`. */
    fontFamily(family: PerItem<R, string | null>): this { this._fontFamily = family; return this; }
    /** Lets long text wrap onto several lines instead of overflowing. */
    wrap(condition = true): this { this._wrap = condition; return this; }
    /** Clamps the text to this number of lines. */
    lineClamp(lines: number | null): this { this._lineClamp = lines; return this; }
    /** Renders inline (without a block layout), e.g. inside a stacked layout. */
    inline(condition = true): this { this._inline = condition; return this; }
    /** Truncates the displayed text to `length` characters, followed by "...". */
    limit(length: number | null): this { this._limit = length; return this; }
    /** Truncates the displayed text to this number of words, followed by "...". */
    words(count: number | null): this { this._words = count; return this; }
    prefix(prefix: string | null): this { this._prefix = prefix; return this; }
    suffix(suffix: string | null): this { this._suffix = suffix; return this; }
    /** Tooltip on hover; `null` for none. */
    tooltip(tooltip: PerItem<R, string | null>): this { this._tooltip = tooltip; return this; }
    copyable(condition: PerItem<R, boolean> = true): this { this._copyable = condition; return this; }
    /** Value copied to the clipboard, when it differs from the displayed text. */
    copyableState(state: PerItem<R, string | null>): this { this._copyableState = state; return this; }
    copyMessage(message: string | null): this { this._copyMessage = message; return this; }
    copyMessageDuration(milliseconds: number): this { this._copyMessageDuration = milliseconds; return this; }
    /** Amount formatted in the given currency, e.g. `money('usd')`. */
    money(currency: string | ((record: R) => string) = 'usd'): this { this._money = currency; return this; }
    /** Text displayed when the value is empty. */
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** Secondary text below the value (`'below'`, the default) or above it. */
    description(text: ((record: R) => string | null) | string | null, position: 'above' | 'below' = 'below'): this {
        if (position === 'above') this._descriptionAbove = text; else this._descriptionBelow = text;
        return this;
    }
    /** One value per line, for a state that is a list (or a string split by `separator()`). */
    listWithLineBreaks(condition = true): this { this._listWithLineBreaks = condition; return this; }
    /** Bulleted list. */
    bulleted(condition = true): this { this._bulleted = condition; return this; }
    /** Shows only the first values of a list; `expandable`: a link reveals the others. */
    limitList(count: number | null, expandable = false): this { this._listLimit = count; this._expandableLimitedList = expandable; return this; }
    expandableLimitedList(condition = true): this { this._expandableLimitedList = condition; return this; }
    /** Splits a string state into a list on this separator. */
    separator(separator: string | null = ','): this { this._separator = separator; return this; }
    private _html: PerItem<R, boolean> = false;
    private _markdown: PerItem<R, boolean> = false;
    /**
     * Renders the state as HTML. It is sanitized first: only formatting elements (paragraphs, emphasis, lists, links with safe
     * URLs...) are kept, without any attribute that could run scripts or change the page's styles.
     */
    html(condition: PerItem<R, boolean> = true): this { this._html = condition; return this; }
    /** Renders the state as Markdown. Raw HTML in it is shown as text, and links only keep safe URLs. */
    markdown(condition: PerItem<R, boolean> = true): this { this._markdown = condition; return this; }
    /** Item text as HTML: Markdown, sanitized HTML, or escaped text. */
    private renderItemText(text: string, record: R, item: unknown): string {
        if (resolveItem(this._markdown, record, item)) return markdownToHtml(text);
        if (resolveItem(this._html, record, item)) return sanitizeHtml(text);
        return e(text);
    }

    /** Displayed text of one state item, escaped by the caller. */
    private formatItem(item: unknown, record: R): string {
        if (this._format) return String(this._format({ state: item, record }) ?? '');
        let text: string;
        const currency = typeof this._money === 'function' ? this._money(record) : this._money;
        if (this._since) text = diffForHumans(item as string) ?? String(item);
        else if (this._date !== null) text = formatDate(item, this._date, this._timeZone);
        else if (currency && isNumericValue(item)) text = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(Number(item));
        else if (this._numeric && isNumericValue(item)) text = new Intl.NumberFormat('en-US', this._decimals !== null ? { minimumFractionDigits: this._decimals, maximumFractionDigits: this._decimals } : {}).format(Number(item));
        else text = String(item);
        if (this._limit !== null && text.length > this._limit) text = `${text.slice(0, this._limit).trimEnd()}...`;
        if (this._words !== null) { const words = text.split(/\s+/); if (words.length > this._words) text = `${words.slice(0, this._words).join(' ')}...`; }
        return `${this._prefix ?? ''}${text}${this._suffix ?? ''}`;
    }
    private stateItems(state: unknown): unknown[] {
        if (Array.isArray(state)) return state.filter((item) => !isBlankState(item));
        if (this._separator !== null && typeof state === 'string') return state.split(this._separator).map((item) => item.trim()).filter(Boolean);
        return [state];
    }
    private hasDescriptions(): boolean { return this._descriptionAbove !== null || this._descriptionBelow !== null; }
    /** Plain value without per-item options: Filament's short markup. */
    private canRenderOptimized(state: unknown): boolean {
        return !Array.isArray(state) && this._separator === null && !isBlankState(state) && !this._bulleted && !this._listWithLineBreaks && this._icon === null && this._tooltip === null
            && this._copyable === false && this._weight === null && this._fontFamily === null && this._lineClamp === null && this._size === null && !this.hasDescriptions() && !this._wrap && this._html === false && this._markdown === false;
    }
    private alignClass(): string | null { return this._alignment && this._alignment !== 'start' ? `fi-align-${this._alignment}` : null; }
    private containerClasses(): (string | null)[] { return ['fi-ta-text', this._inline ? 'fi-inline' : null, this._numeric || this._money ? 'fi-numeric' : null, this.alignClass()]; }

    /** Cell content, as Filament renders it: a short markup for a plain value, the full markup as soon as an item option is set. */
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        if (isBlankState(state)) {
            return `<div class="${cls(this.containerClasses())}">${this._placeholder !== null ? `<p class="fi-ta-placeholder">${e(this._placeholder)}</p>` : ''}</div>`;
        }
        if (this.canRenderOptimized(state)) {
            let html = e(this.formatItem(state, record));
            const color = resolveItem(this._color, record, state);
            if (this._badge) {
                const badgeColor = color ?? 'primary';
                html = `<span class="${cls(['fi-badge', 'fi-size-sm', ...(badgeColor !== 'gray' ? (colorManager?.getComponentClasses('badge', badgeColor) ?? []) : [])])}">${html}</span>`;
            }
            const classes = this._badge ? ['fi-ta-text', 'fi-ta-text-item', 'fi-ta-text-has-badges'] : ['fi-ta-text', 'fi-ta-text-item', 'fi-size-sm', ...(color ? (colorManager?.getComponentClasses('text', color) ?? []) : [])];
            return `<div class="${cls([...classes, this._inline ? 'fi-inline' : null, this._numeric || this._money ? 'fi-numeric' : null, this.alignClass()])}">${html}</div>`;
        }

        let items = this.stateItems(state);
        let count = items.length;
        const limit = this._listLimit ?? count;
        const overLimit = limit && count > limit ? count - limit : 0;
        if (overLimit && (!this._listWithLineBreaks || !this._expandableLimitedList)) items = items.slice(0, limit);
        // Several values without line breaks: one comma-separated item.
        let collapsedHtml: string | null = null;
        if (count > 1 && !this._listWithLineBreaks && !this._badge) {
            collapsedHtml = items.map((item) => e(this.formatItem(item, record))).join(', ');
            count = 1;
            items = [items[0]];
        }

        const itemData = (item: unknown) => {
            const formatted = collapsedHtml !== null ? collapsedHtml.replace(/<[^>]+>/g, '') : this.formatItem(item, record);
            const color = resolveItem(this._color, record, item) ?? (this._badge ? 'primary' : null);
            const sizeOption = resolveItem(this._size, record, item);
            const size = sizeOption === 'base' ? 'md' : sizeOption ?? 'sm';
            const iconName = this._icon === null ? null : resolveItem(this._icon, record, item);
            const iconColor = resolveItem(this._iconColor, record, item);
            const iconHtml = iconName ? icon(iconName, { size: size === 'md' ? 'md' : size === 'lg' ? 'lg' : 'sm', attributes: new Attributes({ 'aria-hidden': 'true' }).class(iconColor ? (colorManager?.getComponentClasses('icon-column', iconColor) ?? []) : []) }) : '';
            const copyable = resolveItem(this._copyable, record, item);
            const tooltip = resolveItem(this._tooltip, record, item);
            const fontFamily = resolveItem(this._fontFamily, record, item);
            const weight = resolveItem(this._weight, record, item);
            const itemClasses = ['fi-ta-text-item', fontFamily ? `fi-font-${fontFamily}` : null];
            if (!this._badge) itemClasses.push(TEXT_SIZES.has(size) ? `fi-size-${size}` : size, weight ? `fi-font-${weight}` : null, ...(color ? (colorManager?.getComponentClasses('text', color) ?? []) : []));
            const itemStyle = !this._badge && this._lineClamp ? ` style="--line-clamp: ${Math.floor(this._lineClamp)}"` : '';
            let content: string | null = null;
            if (this._badge || copyable || (tooltip !== null && tooltip !== '')) {
                const attributes: string[] = [];
                if (copyable) {
                    const copied = resolveItem(this._copyableState, record, item) ?? formatted;
                    const message = this._copyMessage ?? t('filament::components/copyable.messages.copied');
                    attributes.push(...copyableAttributes(copied, formatted, message, this._copyMessageDuration));
                }
                if (tooltip !== null && tooltip !== '') attributes.push(`x-tooltip="${e(tooltipAttribute(tooltip))}"`);
                const contentClasses = [copyable ? 'fi-copyable' : null];
                if (this._badge) contentClasses.push('fi-badge', TEXT_SIZES.has(size) ? `fi-size-${size}` : size, ...(color && color !== 'gray' ? (colorManager?.getComponentClasses('badge', color) ?? []) : []));
                const classString = cls(contentClasses);
                content = `<span ${[...attributes, classString ? `class="${classString}"` : ''].filter(Boolean).join(' ')}>`;
            }
            const before = this._iconPosition === 'before' ? iconHtml : '', after = this._iconPosition === 'after' ? iconHtml : '';
            const inner = `${content ?? ''}${before}${collapsedHtml ?? this.renderItemText(formatted, record, item)}${after}${content ? '</span>' : ''}`;
            return { itemClasses, itemStyle, inner };
        };

        const containerExtra = [this._badge ? 'fi-ta-text-has-badges' : null, this._lineClamp && !this._badge ? 'fi-ta-text-has-line-clamp' : null, this._wrap ? 'fi-wrapped' : null];
        const descriptionAbove = typeof this._descriptionAbove === 'function' ? this._descriptionAbove(record) : this._descriptionAbove;
        const descriptionBelow = typeof this._descriptionBelow === 'function' ? this._descriptionBelow(record) : this._descriptionBelow;
        const hasDescriptions = (descriptionAbove ?? '') !== '' || (descriptionBelow ?? '') !== '';

        if (count === 1 && !this._bulleted && !hasDescriptions && !this._lineClamp) {
            const { itemClasses, itemStyle, inner } = itemData(items[0]);
            return `<div class="${cls([...itemClasses, ...this.containerClasses(), ...containerExtra])}"${itemStyle}>${inner}</div>`;
        }

        const container = [...this.containerClasses(), ...containerExtra, this._bulleted ? 'fi-bulleted' : null, this._listWithLineBreaks ? 'fi-ta-text-has-line-breaks' : null];
        const listItems = (forList: unknown[]) => forList.map((item, index) => {
            const { itemClasses, itemStyle, inner } = itemData(item);
            const hidden = index + 1 > limit ? ' x-show="! isLimited" x-cloak x-transition' : '';
            return `<li${hidden} class="${cls(itemClasses)}"${itemStyle}>${inner}</li>`;
        }).join('');

        if (hasDescriptions || overLimit) {
            const expandable = overLimit && this._expandableLimitedList;
            let body: string;
            if (count === 1 && !this._bulleted) {
                const { itemClasses, itemStyle, inner } = itemData(items[0]);
                body = `<p class="${cls(itemClasses)}"${itemStyle}>${inner}</p>`;
            } else body = `<ul>${listItems(items)}</ul>`;
            let more = '';
            if (overLimit) {
                more = expandable
                    ? `<div class="fi-ta-text-list-limited-message"><div role="button" x-bind:aria-expanded="(! isLimited).toString()" x-on:click.prevent.stop="isLimited = false" x-show="isLimited" class="fi-link fi-size-xs">${e(tc('filament-tables::table.columns.text.actions.expand_list', overLimit, { count: overLimit }))}</div><div role="button" x-bind:aria-expanded="(! isLimited).toString()" x-on:click.prevent.stop="isLimited = true" x-cloak x-show="! isLimited" class="fi-link fi-size-xs">${e(tc('filament-tables::table.columns.text.actions.collapse_list', overLimit, { count: overLimit }))}</div></div>`
                    : `<div class="fi-ta-text-list-limited-message">${e(tc('filament-tables::table.columns.text.more_list_items', overLimit, { count: overLimit }))}</div>`;
            }
            return `<div${expandable ? ' x-data="{ isLimited: true }"' : ''} class="${cls([...container, hasDescriptions ? 'fi-ta-text-has-descriptions' : null, overLimit ? 'fi-ta-text-list-limited' : null])}">`
                + `${(descriptionAbove ?? '') !== '' ? `<p class="fi-ta-text-description">${e(descriptionAbove)}</p>` : ''}${body}${more}`
                + `${(descriptionBelow ?? '') !== '' ? `<p class="fi-ta-text-description">${e(descriptionBelow)}</p>` : ''}</div>`;
        }
        return `<ul class="${cls(container)}">${listItems(items)}</ul>`;
    }
}

/** Values a summarizer works from: aggregates over the query (all records) or over the displayed page. */
export type SummaryValues = { count: number; sum: Record<string, number>; avg: Record<string, number>; min: Record<string, unknown>; max: Record<string, unknown> };
/** Occurrences of one icon (and color) of an icon column, for `Count.make().icons()`. */
export type IconCount = { icon: string; color: string | null; count: number };
export type SummaryItem = { type: 'text' | 'range' | 'values' | 'icon-count'; label: string | null; value: string; labelHidden?: boolean; values?: string[]; bulleted?: boolean; icons?: IconCount[] };
/** Records a custom summarizer works on: all records, the displayed page, or a group. */
export type SummaryDataset = { column: string; records: () => Promise<any[]> };

/**
 * Column summary below the table: sum, average, count, range, distinct values, or your own with `Summarizer.make().using()`.
 */
export class Summarizer {
    readonly kind: 'sum' | 'avg' | 'count' | 'range' | 'values' | 'custom' = 'custom';
    protected _label: string | null = null;
    protected _money: string | null = null;
    protected _decimals: number | null = null;
    protected _prefix: string | null = null;
    protected _suffix: string | null = null;
    protected _formatStateUsing: ((state: unknown) => string | null) | null = null;
    protected _labelHidden = false;
    protected _hidden: boolean | (() => boolean) = false;
    protected _using: ((dataset: SummaryDataset) => unknown) | null = null;
    protected _scope: ((query: any) => void) | null = null;
    /**
     * Restricts the records summarized by this summarizer (all records, the page, or a group), e.g.
     * `Count.make().query((query) => query.where('is_published', 1))`. The function receives the data adapter's query builder.
     */
    query(scope: ((query: any) => void) | null): this { this._scope = scope; return this; }
    getQueryScope(): ((query: any) => void) | null { return this._scope; }
    static make(): Summarizer { return configured(new Summarizer()); }
    label(label: string | null): this { this._label = label; return this; }
    money(currency = 'usd'): this { this._money = currency.toUpperCase(); return this; }
    /** Number formatting, with a fixed number of decimals. */
    numeric(decimals: number | null = null): this { this._decimals = decimals; return this; }
    prefix(prefix: string | null): this { this._prefix = prefix; return this; }
    suffix(suffix: string | null): this { this._suffix = suffix; return this; }
    /** Formats the value yourself (the result is escaped). */
    formatStateUsing(callback: ((state: unknown) => string | null) | null): this { this._formatStateUsing = callback; return this; }
    /** Keeps the label for screen readers only. */
    hiddenLabel(condition = true): this { this._labelHidden = condition; return this; }
    isLabelHidden(): boolean { return this._labelHidden; }
    hidden(condition: boolean | (() => boolean) = true): this { this._hidden = condition; return this; }
    visible(condition: boolean | (() => boolean) = true): this { return this.hidden(typeof condition === 'function' ? () => !condition() : !condition); }
    isHidden(): boolean { return typeof this._hidden === 'function' ? this._hidden() : this._hidden; }
    /** Computes the value from the summarized records (`records()` loads them: keep the dataset small). */
    using(callback: ((dataset: SummaryDataset) => unknown) | null): this { this._using = callback; return this; }
    hasCustomCalculation(): boolean { return this._using !== null; }
    async compute(dataset: SummaryDataset): Promise<unknown> { return this._using ? this._using(dataset) : null; }
    getLabel(): string | null { return this._label; }
    /** Formatted value: `formatStateUsing()`, money or number, then the prefix and suffix. */
    format(value: unknown): string {
        let text: string;
        if (this._formatStateUsing) text = this._formatStateUsing(value) ?? '';
        else if (typeof value === 'number' && Number.isFinite(value)) {
            const digits = this._decimals !== null ? { minimumFractionDigits: this._decimals, maximumFractionDigits: this._decimals } : {};
            text = this._money ? new Intl.NumberFormat('en-US', { style: 'currency', currency: this._money, ...digits }).format(value) : new Intl.NumberFormat('en-US', digits).format(value);
        } else text = value === null || value === undefined ? '' : String(value);
        return `${this._prefix ?? ''}${text}${this._suffix ?? ''}`;
    }
    protected item(value: unknown, type: SummaryItem['type'] = 'text'): SummaryItem { return { type, label: this.getLabel(), value: this.format(value), labelHidden: this._labelHidden }; }
    /** Summary item from the aggregates (or from `customValue`, computed by `using()`). */
    summarize(_column: string, _values: SummaryValues, customValue?: unknown): SummaryItem | null { return this.item(customValue ?? null); }
}
/** Column total. */
export class Sum extends Summarizer {
    readonly kind = 'sum';
    static make(): Sum { return configured(new Sum()); }
    getLabel(): string { return this._label ?? t('filament-tables::table.summary.summarizers.sum.label'); }
    summarize(column: string, values: SummaryValues, customValue?: unknown): SummaryItem { return this.item(customValue ?? values.sum[column] ?? 0); }
}
/** Column average. */
export class Average extends Summarizer {
    readonly kind = 'avg';
    static make(): Average { return configured(new Average()); }
    getLabel(): string { return this._label ?? t('filament-tables::table.summary.summarizers.average.label'); }
    summarize(column: string, values: SummaryValues, customValue?: unknown): SummaryItem { return this.item(customValue ?? values.avg[column] ?? 0); }
}
/** Record count, or the occurrences of each icon of an icon column with `icons()`. */
export class Count extends Summarizer {
    readonly kind = 'count';
    private _icons = false;
    static make(): Count { return configured(new Count()); }
    /** Counts how many times each icon (and color) of an `IconColumn` appears, instead of the records. */
    icons(condition = true): this { this._icons = condition; return this; }
    hasIcons(): boolean { return this._icons; }
    getLabel(): string | null { return this._label ?? (this._icons ? null : t('filament-tables::table.summary.summarizers.count.label')); }
    summarize(_column: string, values: SummaryValues, customValue?: unknown): SummaryItem {
        if (this._icons) return { type: 'icon-count', label: this.getLabel(), value: '', labelHidden: this._labelHidden, icons: Array.isArray(customValue) ? (customValue as IconCount[]) : [] };
        return this.item(customValue ?? values.count);
    }
}
/** Distinct values of the column, as a (bulleted) list. */
export class Values extends Summarizer {
    readonly kind = 'values';
    private _bulleted = true;
    static make(): Values { return configured(new Values()); }
    bulleted(condition = true): this { this._bulleted = condition; return this; }
    constructor() { super(); this._using = async ({ column, records }) => [...new Set((await records()).map((record) => (record as any)[column]).filter((value) => value !== null && value !== undefined && value !== ''))]; }
    summarize(_column: string, _values: SummaryValues, customValue?: unknown): SummaryItem {
        const list = Array.isArray(customValue) ? customValue : [];
        return { type: 'values', label: this.getLabel(), value: '', labelHidden: this._labelHidden, values: list.map((value) => this.format(value)), bulleted: this._bulleted };
    }
}
/** Smallest and largest value of a column. */
export class Range extends Summarizer {
    readonly kind = 'range';
    private _minimalDateTime = false;
    static make(): Range { return configured(new Range()); }
    /** Dates: day only when the bounds fall on different days, day and time otherwise; a single value when both are equal. */
    minimalDateTimeDifference(condition = true): this { this._minimalDateTime = condition; return this; }
    summarize(column: string, values: SummaryValues, _customValue?: unknown): SummaryItem | null {
        let bounds = [values.min[column], values.max[column]].filter((v) => v !== null && v !== undefined && v !== '').map(String);
        if (!bounds.length) return null;
        if (this._minimalDateTime && bounds.length === 2) {
            const date = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
            const dateTime = (value: string) => `${date(value)} ${value.length > 10 ? value.slice(11, 19) : '00:00:00'}`;
            const days = bounds.map(date);
            if (days[0] !== days[1]) bounds = days;
            else { const times = bounds.map(dateTime); bounds = times[0] === times[1] ? [times[0]] : times; }
        }
        return { type: 'range', label: this._label, value: `${this._prefix ?? ''}${bounds.join(' - ')}${this._suffix ?? ''}`, labelHidden: this._labelHidden };
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
    private _keyUsing: ((record: R) => string | null) | null = null;
    private _scopeUsing: ((query: any, key: string | null) => void) | null = null;
    private _orderUsing: ((query: any, direction: SortDirection) => void) | null = null;
    constructor(id: string) { this.id = id; }
    /** Group key of a record, when it is not the column value (records with the same key form a group). Use with `scopeQueryByKeyUsing()`. */
    getKeyFromRecordUsing(resolver: ((record: R) => string | null) | null): this { this._keyUsing = resolver; return this; }
    /** Restricts the query to one group (summaries, "select the group"): needed when `getKeyFromRecordUsing()` is not the column value. */
    scopeQueryByKeyUsing(scope: ((query: any, key: string | null) => void) | null): this { this._scopeUsing = scope; return this; }
    /** Orders the query by group, when ordering by the column is not right (e.g. a status with a custom order). */
    orderQueryUsing(order: ((query: any, direction: SortDirection) => void) | null): this { this._orderUsing = order; return this; }
    getOrderQueryUsing(): ((query: any, direction: SortDirection) => void) | null { return this._orderUsing; }
    private _groupQueryUsing: ((query: any, column: string) => void) | null = null;
    /**
     * Groups the summary query by group, so that the summaries of every group come from one query: by default
     * `query.groupBy(column)` (`date(column)` for date groups). Needed with `getKeyFromRecordUsing()`: the first grouping
     * expression must give the same key as the records, e.g. `(query) => query.groupByRaw("case when … end")`.
     */
    groupQueryUsing(callback: ((query: any, column: string) => void) | null): this { this._groupQueryUsing = callback; return this; }
    /**
     * Groups an aggregate query by group, or `null` when the groups must be aggregated one at a time: custom key or scope
     * without `groupQueryUsing()`, or a column of a related table.
     */
    getGroupQuery(): ((query: any) => void) | null {
        const column = this.getColumn();
        if (this._groupQueryUsing) return (query) => { this._groupQueryUsing!(query, column); };
        if (this._keyUsing || this._scopeUsing || column.includes('.')) return null;
        return this._date ? (query) => { query.groupByRaw('date(??)', [column]); } : (query) => { query.groupBy(column); };
    }
    /** Group key of a value selected by the group query (`null` for the empty group, which is aggregated on its own). */
    getKeyFromGroupValue(value: unknown): string | null {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'boolean') return value ? '1' : '0';
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        return this._date ? String(value).slice(0, 10) : String(value);
    }
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
        if (this._keyUsing) { const custom = this._keyUsing(record); return custom === null || custom === undefined || custom === '' ? null : String(custom); }
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
        if (this._scopeUsing) { this._scopeUsing(query, key); return; }
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
    protected _grow: boolean | null = null;
    protected _visibleFrom: string | null = null;
    protected _hiddenFrom: string | null = null;
    protected _columnSpan: Record<string, number | string> = { default: 1 };
    protected _collapsible = false;
    // Collapsed until the user opens it, as in Filament.
    protected _collapsed = true;
    protected _hidden: boolean | (() => boolean) = false;
    constructor(children: (Column<R> | ColumnLayout<R>)[]) { this._children = children; }
    getChildren(): (Column<R> | ColumnLayout<R>)[] { return this._children; }
    /** Leaf columns, in order: the ones the table sorts, searches and toggles. */
    getColumns(): Column<R>[] { return this._children.flatMap((child) => (child instanceof ColumnLayout ? child.getColumns() : [child])); }
    abstract getClasses(): string[];
    /** `false`: the component takes only the width it needs in a split, instead of sharing the remaining space. */
    grow(condition = true): this { this._grow = condition; return this; }
    canGrow(): boolean { return this._grow ?? true; }
    visibleFrom(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | null): this { this._visibleFrom = breakpoint !== null && BREAKPOINTS.includes(breakpoint) ? breakpoint : null; return this; }
    hiddenFrom(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | null): this { this._hiddenFrom = breakpoint !== null && BREAKPOINTS.includes(breakpoint) ? breakpoint : null; return this; }
    getResponsiveClasses(): string[] { return [this._hiddenFrom ? `${this._hiddenFrom}:fi-hidden` : null, this._visibleFrom ? `${this._visibleFrom}:fi-visible` : null].filter((c): c is string => c !== null); }
    /** Columns of a parent `Grid` taken by the component: a number, `'full'`, or one per breakpoint. */
    columnSpan(span: number | string | Record<string, number | string>): this { this._columnSpan = typeof span === 'object' ? { default: 1, ...span } : { default: span }; return this; }
    columnSpanFull(): this { return this.columnSpan('full'); }
    getColumnSpan(): Record<string, number | string> { return this._columnSpan; }
    /**
     * Content hidden behind a toggle button at the bottom of the record. Only one top-level component of the layout can
     * be collapsible. It starts collapsed; `collapsed(false)` shows it open.
     */
    collapsible(condition = true): this { this._collapsible = condition; return this; }
    collapsed(condition = true): this { this._collapsible = true; this._collapsed = condition; return this; }
    isCollapsible(): boolean { return this._collapsible; }
    isCollapsed(): boolean { return this._collapsed; }
    hidden(condition: boolean | (() => boolean) = true): this { this._hidden = condition; return this; }
    visible(condition: boolean | (() => boolean) = true): this { return this.hidden(typeof condition === 'function' ? () => !condition() : !condition); }
    isHidden(): boolean { return typeof this._hidden === 'function' ? this._hidden() : this._hidden; }
    /** Inner markup of the component, around the already rendered children. */
    async renderContent(children: string[], _record: R, _key: string): Promise<string> { return `<div class="${this.getClasses().join(' ')}">${children.join('')}</div>`; }
}
/** Columns side by side, from a given breakpoint. */
export class Split<R = any> extends ColumnLayout<R> {
    private _from: string | null = null;
    static make<R = any>(children: (Column<R> | ColumnLayout<R>)[]): Split<R> { return configured(new Split<R>(children)); }
    from(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | null): this { this._from = breakpoint; return this; }
    getClasses(): string[] { return ['fi-ta-split', ...(this._from ? [`${this._from}:fi-ta-split`] : [])]; }
}
/** Columns stacked vertically. */
export class Stack<R = any> extends ColumnLayout<R> {
    private _space: number | null = null;
    private _alignment = 'start';
    static make<R = any>(children: (Column<R> | ColumnLayout<R>)[]): Stack<R> { return configured(new Stack<R>(children)); }
    /** Gap between columns: 1 (small), 2 (medium) or 3 (large). */
    space(space: 1 | 2 | 3 | null = 1): this { this._space = space; return this; }
    alignment(alignment: 'start' | 'center' | 'end'): this { this._alignment = alignment; return this; }
    getClasses(): string[] { return ['fi-ta-stack', `fi-align-${this._alignment}`, ...(this._space ? [`fi-gap-${['sm', 'md', 'lg'][this._space - 1]}`] : [])]; }
}
/** Responsive grid of columns: `Grid.make(2)` (2 columns from `lg`) or `Grid.make({ default: 1, md: 2, xl: 3 })`. */
export class Grid<R = any> extends ColumnLayout<R> {
    private _gridColumns: Record<string, number> = {};
    constructor(columns: number | Record<string, number> | null = 2) { super([]); this.columns(columns); }
    static make<R = any>(columns: number | Record<string, number> | null = 2): Grid<R> { return configured(new Grid<R>(columns)); }
    /** Number of columns, or one per breakpoint (\`default\`, \`sm\`, \`md\`, \`lg\`, \`xl\`, \`2xl\`). */
    columns(columns: number | Record<string, number> | null = 2): this {
        const added = columns === null ? {} : typeof columns === 'number' ? { lg: columns } : columns;
        this._gridColumns = { ...this._gridColumns, ...Object.fromEntries(Object.entries(added).filter(([, count]) => Number.isInteger(count) && count > 0 && count <= 12)) };
        return this;
    }
    /** Components of the grid. */
    schema(children: (Column<R> | ColumnLayout<R>)[]): this { this._children = children; return this; }
    getGridColumns(): Record<string, number> { return this._gridColumns; }
    getClasses(): string[] {
        const columns = this._gridColumns;
        const gap = (count: number) => (count === 1 ? 'fi-gap-sm' : 'fi-gap-lg');
        return ['fi-ta-grid', gap(columns.default ?? 1), ...['sm', 'md', 'lg', 'xl', '2xl'].filter((breakpoint) => columns[breakpoint]).map((breakpoint) => `${breakpoint}:${gap(columns[breakpoint])}`)];
    }
    async renderContent(children: string[]): Promise<string> { return `<div ${new Attributes().grid(this._gridColumns).class(this.getClasses()).toHtml()}>${children.join('')}</div>`; }
}
/** Plain container, styled as a panel: often made collapsible. */
export class Panel<R = any> extends ColumnLayout<R> {
    static make<R = any>(children: (Column<R> | ColumnLayout<R>)[]): Panel<R> { return configured(new Panel<R>(children)); }
    getClasses(): string[] { return ['fi-ta-panel']; }
}
/**
 * Your own markup inside the record: a function returning HTML, or the name of an EJS view rendered with `record` and
 * `recordKey`. The HTML is inserted as it is: escape record data with `e()` (EJS's `<%= %>` does it).
 */
export class View<R = any> extends ColumnLayout<R> {
    private _view: string | ((ctx: { record: R; recordKey: string }) => string | Promise<string>);
    private _viewData: Record<string, unknown> = {};
    constructor(view: string | ((ctx: { record: R; recordKey: string }) => string | Promise<string>)) { super([]); this._view = view; }
    static make<R = any>(view: string | ((ctx: { record: R; recordKey: string }) => string | Promise<string>)): View<R> { return configured(new View<R>(view)); }
    /** Extra data passed to the EJS view. */
    viewData(data: Record<string, unknown>): this { this._viewData = data; return this; }
    /** Columns rendered inside the view are not part of the table: the view has no children. */
    components(children: (Column<R> | ColumnLayout<R>)[]): this { this._children = children; return this; }
    getClasses(): string[] { return []; }
    async renderContent(children: string[], record: R, key: string): Promise<string> {
        if (typeof this._view === 'function') return this._view({ record, recordKey: key });
        return views.render(this._view, { ...this._viewData, record, recordKey: key, getRecord: () => record, children: children.join('') });
    }
}
/** Renders a record through the layout, skipping columns the user has hidden. */
async function renderColumnLayout<R>(node: Column<R> | ColumnLayout<R>, record: R, key: string, visible: Set<Column<R>>): Promise<string> {
    if (node instanceof ColumnLayout) {
        if (node.isHidden()) return '';
        const children = [];
        for (const child of node.getChildren()) children.push(await renderColumnLayout(child, record, key, visible));
        const cell = new Attributes().gridColumn(node.getColumnSpan()).class([{ 'fi-growable': node.canGrow() }, ...node.getResponsiveClasses()]);
        return `<div ${cell.toHtml()}>${await node.renderContent(children, record, key)}</div>`;
    }
    if (!visible.has(node)) return '';
    const alignment = node.getAlignment();
    // Inside a layout, text is inline and carries its own alignment.
    const html = (await node.toHtml(record, key)).replace(/class="([^"]*\bfi-ta-text\b[^"]*)"/, (_match, classes: string) => `class="${classes.replace(/ fi-align-\w+/g, '')} fi-inline${alignment ? ` fi-align-${alignment}` : ''}"`);
    const cell = new Attributes().gridColumn({ default: 1 }).class([{ 'fi-growable': node.canGrow(true) }, 'fi-ta-col', ...(alignment ? [`fi-align-${alignment}`] : []), ...node.getResponsiveClasses()]);
    return `<div ${cell.toHtml()}>${html}</div>`;
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

/** Only plain CSS lengths are written into a style attribute. */
const cssLength = (value: string | number | null): string | null => {
    if (value === null) return null;
    const text = typeof value === 'number' ? `${value}px` : value.trim();
    return /^[0-9.]+(rem|px|em|%|vh|vw)$/.test(text) ? text : null;
};
/** Only hex or simple functional colors are written into a style attribute (no CSS injection). */
const sanitizeCssColor = (value: unknown): string | null => (typeof value === 'string' && /^(#[0-9a-fA-F]{3,8}|(rgb|hsl|oklch)a?\([0-9.,%\s/deg-]+\))$/.test(value.trim()) ? value.trim() : null);
/** Only local or http(s) URLs become image sources. */
const safeImageUrl = (value: unknown): string | null => (typeof value === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(value) ? value : null);
/** Attributes of a copyable element (Filament's `filamentCopyable` Alpine component). */
const copyableAttributes = (copied: string, label: string, message: string, duration: number): string[] => [
    'x-data="filamentCopyable"', 'x-bind="bindings"',
    `x-bind:aria-label="isStandalone ? ${e(js(t('filament::components/copyable.label', { label })))} : null"`,
    `x-on:click.prevent.stop="${e(`if (isStandalone) {\n    copy(${js(copied)}, ${js(message)}, ${duration}, ${js(t('filament::components/copyable.messages.failed'))})\n} else {\n    window.navigator.clipboard.writeText(${js(copied)})\n    $tooltip(${js(message)}, {\n        theme: $store.theme,\n        timeout: ${duration},\n    })\n}`)}"`,
];

/** Color swatch per state (a color, or a list of colors). */
export class ColorColumn<R = any> extends Column<R> {
    private _copyable: PerItem<R, boolean> = false;
    private _copyMessage: string | null = null;
    private _copyMessageDuration = 2000;
    private _tooltip: PerItem<R, string | null> = null;
    private _placeholder: string | null = null;
    private _wrap = false;
    private _inline = false;
    static make<R = any>(name: string): ColorColumn<R> { return configured(new ColorColumn<R>(name)); }
    /** Clicking the swatch copies the color. Browsers only expose the clipboard on HTTPS or `localhost`. */
    copyable(condition: PerItem<R, boolean> = true): this { this._copyable = condition; return this; }
    copyMessage(message: string | null): this { this._copyMessage = message; return this; }
    copyMessageDuration(milliseconds: number): this { this._copyMessageDuration = milliseconds; return this; }
    tooltip(tooltip: PerItem<R, string | null>): this { this._tooltip = tooltip; return this; }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** Lets several swatches wrap onto more lines. */
    wrap(condition = true): this { this._wrap = condition; return this; }
    inline(condition = true): this { this._inline = condition; return this; }
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        const align = this._alignment && this._alignment !== 'start' ? `fi-align-${this._alignment}` : null;
        const base = ['fi-ta-color', this._inline ? 'fi-inline' : null, align];
        if (isBlankState(state)) return `<div class="${cls(base)}">${this._placeholder !== null ? `<p class="fi-ta-placeholder">${e(this._placeholder)}</p>` : ''}</div>`;
        const items = (Array.isArray(state) ? state : [state]).map((item) => {
            const color = sanitizeCssColor(item);
            const copyable = resolveItem(this._copyable, record, item);
            const tooltip = resolveItem(this._tooltip, record, item);
            const attributes: string[] = [];
            // The swatch shows its value only through its color: it is a named image for screen readers.
            if (!copyable && color) attributes.push(`aria-label="${e(color)}"`, 'role="img"');
            if (copyable) attributes.push(...copyableAttributes(color ?? '', color ?? this.name, this._copyMessage ?? t('filament::components/copyable.messages.copied'), this._copyMessageDuration));
            if (tooltip) attributes.push(`x-tooltip="${e(tooltipAttribute(tooltip))}"`);
            attributes.push(`class="${cls(['fi-ta-color-item', copyable ? 'fi-copyable' : null])}"`);
            if (color) attributes.push(`style="background-color: ${color};"`);
            return `<div ${attributes.join(' ')}></div>`;
        });
        return `<div class="${cls([...base, this._wrap ? 'fi-wrapped' : null])}">${items.join('')}</div>`;
    }
}

/** Image per state (an image URL, or a list of URLs). Only local or http(s) URLs are rendered. */
export class ImageColumn<R = any> extends Column<R> {
    private _alt: PerItem<R, string | null> = null;
    private _height: string | null = null;
    private _width: string | null = null;
    private _circular = false;
    private _square = false;
    private _stacked = false;
    private _ring: number | null = null;
    private _overlap: number | null = null;
    private _limit: number | null = null;
    private _limitedRemainingText = false;
    private _limitedRemainingTextSize: string | null = null;
    private _defaultImageUrl: string | ((record: R) => string | null) | null = null;
    private _tooltip: PerItem<R, string | null> = null;
    private _placeholder: string | null = null;
    private _wrap = false;
    private _inline = false;
    static make<R = any>(name: string): ImageColumn<R> { return configured(new ImageColumn<R>(name)); }
    alt(alt: PerItem<R, string | null>): this { this._alt = alt; return this; }
    /** CSS height of the images (`2.5rem` by default, `2rem` when stacked). */
    imageHeight(height: string | number | null): this { this._height = cssLength(height); return this; }
    imageWidth(width: string | number | null): this { this._width = cssLength(width); return this; }
    /** Same width and height. */
    imageSize(size: string | number | null): this { return this.imageHeight(size).imageWidth(size); }
    circular(condition = true): this { this._circular = condition; return this; }
    square(condition = true): this { this._square = condition; return this; }
    /** Overlapping images, with a `ring` (border width, 0 to 8) and an `overlap` (0 to 8). */
    stacked(condition = true): this { this._stacked = condition; return this; }
    ring(width: number | null): this { this._ring = width; return this; }
    overlap(overlap: number | null): this { this._overlap = overlap; return this; }
    /** Shows only the first images; `limitedRemainingText()` adds "+3" for the others. */
    limit(count: number | null): this { this._limit = count; return this; }
    limitedRemainingText(condition = true, size: string | null = null): this { this._limitedRemainingText = condition; this._limitedRemainingTextSize = size; return this; }
    /** Image shown when the state is empty. */
    defaultImageUrl(url: string | ((record: R) => string | null) | null): this { this._defaultImageUrl = url; return this; }
    tooltip(tooltip: PerItem<R, string | null>): this { this._tooltip = tooltip; return this; }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    wrap(condition = true): this { this._wrap = condition; return this; }
    inline(condition = true): this { this._inline = condition; return this; }
    async toHtml(record: R): Promise<string> {
        let state = await this.getState(record);
        const align = this._alignment && this._alignment !== 'start' ? `fi-align-${this._alignment}` : null;
        const base = ['fi-ta-image', this._inline ? 'fi-inline' : null, align];
        const fallback = safeImageUrl(typeof this._defaultImageUrl === 'function' ? this._defaultImageUrl(record) : this._defaultImageUrl);
        let items = (Array.isArray(state) ? state : isBlankState(state) ? [] : [state]).filter((item) => safeImageUrl(item) !== null);
        if (!items.length && fallback) items = [fallback];
        if (!items.length) return `<div class="${cls(base)}">${this._placeholder !== null ? `<p class="fi-ta-placeholder">${e(this._placeholder)}</p>` : ''}</div>`;
        const overLimit = this._limit !== null && items.length > this._limit ? items.length - this._limit : 0;
        if (overLimit) items = items.slice(0, this._limit!);
        const height = this._height ?? (this._stacked ? '2rem' : '2.5rem');
        const width = this._width ?? (this._circular || this._square ? height : null);
        const style = `height: ${height};${width ? ` width: ${width};` : ''}`;
        const ring = this._stacked && this._ring !== null && Number.isInteger(this._ring) ? `fi-ta-image-ring fi-ta-image-ring-${this._ring}` : null;
        const overlap = this._stacked ? (this._overlap ?? 2) : null;
        const classes = [...base, this._circular ? 'fi-circular' : null, this._wrap ? 'fi-wrapped' : null, this._stacked ? 'fi-stacked' : null, ring, overlap ? `fi-ta-image-overlap-${overlap}` : null];
        const images = items.map((item) => {
            const alt = resolveItem(this._alt, record, item) ?? '';
            const tooltip = resolveItem(this._tooltip, record, item);
            return `<img alt="${e(alt)}" src="${e(String(item))}"${tooltip ? ` x-tooltip="${e(tooltipAttribute(tooltip))}"` : ''} style="${style}" />`;
        }).join('');
        const remaining = overLimit && this._limitedRemainingText ? `<div class="${cls(['fi-ta-image-limited-remaining-text', this._limitedRemainingTextSize ? `fi-size-${this._limitedRemainingTextSize}` : null])}" style="${style}">+${overLimit}</div>` : '';
        return `<div class="${cls(classes)}">${images}${remaining}</div>`;
    }
}

/** Icon depending on the value; `boolean()` shows a green check or a red cross. */
/**
 * Icon per state. `boolean()` shows a green check or a red cross; `icon()` and `color()` choose the icon and color from the
 * record and the state, e.g. `IconColumn.make('status').icon((record) => STATUSES[record.status].icon)`.
 */
export class IconColumn<R = any> extends Column<R> {
    private _boolean = false;
    private _icon: PerItem<R, string | null> | null = null;
    private _color: PerItem<R, string | null> | null = null;
    private _size: PerItem<R, string | null> = null;
    private _trueIcon: string | false | null = null;
    private _falseIcon: string | false | null = null;
    private _trueColor: string | null = null;
    private _falseColor: string | null = null;
    private _tooltip: PerItem<R, string | null> = null;
    private _placeholder: string | null = null;
    private _listWithLineBreaks = false;
    private _wrap = false;
    private _inline = false;
    static make<R = any>(name: string): IconColumn<R> { return configured(new IconColumn<R>(name)); }
    boolean(condition = true): this { this._boolean = condition; return this; }
    icon(icon: PerItem<R, string | null> | null): this { this._icon = icon; return this; }
    color(color: PerItem<R, string | null> | null): this { this._color = color; return this; }
    /** Icon size: `xs`, `sm`, `md`, `lg` (default), `xl` or `2xl`. */
    size(size: PerItem<R, string | null>): this { this._size = size; return this; }
    /** Icons and colors of a boolean column; `false` shows no icon for that value. */
    trueIcon(icon: string | false | null): this { this._trueIcon = icon; return this; }
    falseIcon(icon: string | false | null): this { this._falseIcon = icon; return this; }
    trueColor(color: string | null): this { this._trueColor = color; return this; }
    falseColor(color: string | null): this { this._falseColor = color; return this; }
    tooltip(tooltip: PerItem<R, string | null>): this { this._tooltip = tooltip; return this; }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** One icon per line, for a state that is a list. */
    listWithLineBreaks(condition = true): this { this._listWithLineBreaks = condition; return this; }
    wrap(condition = true): this { this._wrap = condition; return this; }
    inline(condition = true): this { this._inline = condition; return this; }

    private isBooleanItem(item: unknown): boolean { return this._boolean || typeof item === 'boolean'; }
    private iconOf(record: R, item: unknown): string | null {
        const own = this._icon === null ? null : resolveItem(this._icon, record, item);
        if (own) return own;
        if (!this.isBooleanItem(item) || item === null || item === undefined) return null;
        const on = item === true || item === 1 || item === '1';
        const chosen = on ? this._trueIcon : this._falseIcon;
        return chosen === false ? null : chosen ?? (on ? icons.resolve('tables::columns.icon-column.true') ?? 'o-check-circle' : icons.resolve('tables::columns.icon-column.false') ?? 'o-x-circle');
    }
    private colorOf(record: R, item: unknown): string | null {
        const own = this._color === null ? null : resolveItem(this._color, record, item);
        if (own) return own;
        if (!this.isBooleanItem(item) || item === null || item === undefined) return null;
        const on = item === true || item === 1 || item === '1';
        return on ? (this._trueColor ?? 'success') : (this._falseColor ?? 'danger');
    }
    /** Icon and color shown for one item of the state (icon count summaries). */
    getIconAndColor(record: R, item: unknown): { icon: string | null; color: string | null } { return { icon: this.iconOf(record, item), color: this.colorOf(record, item) }; }
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        const align = this._alignment && this._alignment !== 'start' ? `fi-align-${this._alignment}` : null;
        const base = ['fi-ta-icon', this._inline ? 'fi-inline' : null, align];
        if (isBlankState(state)) return `<div class="${cls(base)}">${this._placeholder !== null ? `<p class="fi-ta-placeholder">${e(this._placeholder)}</p>` : ''}</div>`;
        const items = Array.isArray(state) ? state : [state];
        const html = items.map((item) => {
            const name = this.iconOf(record, item);
            if (!name) return '';
            const color = this.colorOf(record, item);
            const size = resolveItem(this._size, record, item);
            const tooltip = resolveItem(this._tooltip, record, item);
            const attributes = new Attributes(tooltip ? { 'x-tooltip': tooltipAttribute(tooltip) } : {}).class(color ? (colorManager?.getComponentClasses('icon-column', color) ?? []) : []);
            // The icon is hidden from assistive technology: a text alternative goes with it.
            const alternative = tooltip ? tooltip : this.isBooleanItem(item) ? t(`filament-tables::table.columns.icon.boolean.${item === true || item === 1 || item === '1' ? 'true' : 'false'}`) : (typeof item === 'string' || typeof item === 'number') ? String(item) : null;
            return `${icon(name, { size: (size && size !== 'base' ? size : 'lg') as any, attributes })}${alternative ? `<span class="fi-sr-only">${e(alternative)}</span>` : ''}`;
        }).join('');
        return `<div class="${cls([...base, this._listWithLineBreaks ? 'fi-ta-icon-has-line-breaks' : null, this._wrap ? 'fi-wrapped' : null])}">${html}</div>`;
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
    /** Validation of a value for a given record (column types whose rules depend on the record override it). */
    async validateFor(_record: R, input: unknown): Promise<string | null> { return this.validate(input); }
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
    protected tooltipExpression(record: R, extra: string | null = null): string {
        const tooltip = typeof this._tooltip === 'function' ? this._tooltip(record) : this._tooltip;
        const more = extra ? `
                        ${extra}` : '';
        return `error === undefined ? ${tooltip !== null && tooltip !== '' ? `{
                        content: ${js(tooltip)},
                        theme: $store.theme,
                        allowHTML: false,
                        aria: { content: 'auto' },${more}
                    }` : 'false'} : {
                        content: error,
                        theme: $store.theme,
                        allowHTML: false,
                        aria: { content: null },${more}
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
export type SelectColumnOptions = [string, string][] | Record<string, string>;
const normalizeSelectOptions = (options: SelectColumnOptions): [string, string][] => (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]): [string, string] => [String(value), String(label)]);

export class SelectColumn<R = any> extends EditableColumn<R> {
    private _options: [string, string][] | ((record: R) => SelectColumnOptions | Promise<SelectColumnOptions>) = [];
    private _selectablePlaceholder = true;
    private _native = true;
    private _searchable = false;
    private _disabledOptions: ((value: string, label: string, record: R) => boolean)[] = [];
    private _placeholder: string | null = null;
    private _optionsLimit = 50;
    private _canOptionLabelsWrap = true;
    private _position: 'top' | 'bottom' | null = null;
    private _inline = false;
    static make<R = any>(name: string): SelectColumn<R> { return configured(new SelectColumn<R>(name)); }
    /** `{ value: label }` pairs, `[value, label]` pairs, or a function of the record returning either. */
    options(options: SelectColumnOptions | ((record: R) => SelectColumnOptions | Promise<SelectColumnOptions>)): this { this._options = typeof options === 'function' ? options : normalizeSelectOptions(options); return this; }
    /** Static options (empty when they depend on the record: use `getOptionsFor()`). */
    getOptions(): [string, string][] { return typeof this._options === 'function' ? [] : this._options; }
    async getOptionsFor(record: R): Promise<[string, string][]> {
        if (this._optionsRelationship) return (this._relationshipOptions ??= loadRelationshipOptions((record as any)?.constructor, this._optionsRelationship.name, this._optionsRelationship.title, this._optionsRelationship.modify));
        return typeof this._options === 'function' ? normalizeSelectOptions(await this._options(record)) : this._options;
    }
    private _optionsRelationship: { name: string; title: string | null; modify: RelationshipQueryModifier | null } | null = null;
    private _relationshipOptions: Promise<[string, string][]> | null = null;
    /**
     * Options from the records of a relationship of the record's model (an Objection model with `relationMappings`): the
     * column stores the picked record's key, e.g. `SelectColumn.make('author_id').optionsRelationship('author', 'name')`.
     * Up to 1,000 options are listed; any related record's key is accepted when saving.
     */
    optionsRelationship(name: string, titleAttribute: string | null = null, modifyQueryUsing: RelationshipQueryModifier | null = null): this {
        this._optionsRelationship = { name, title: titleAttribute, modify: modifyQueryUsing };
        this._relationshipOptions = null;
        return this;
    }
    selectablePlaceholder(condition = true): this { this._selectablePlaceholder = condition; return this; }
    /** `false`: a JavaScript select instead of the browser's native one. */
    native(condition = true): this { this._native = condition; return this; }
    private _allowHtml = false;
    /** Option labels are HTML, sanitized on the server (JavaScript select only; the native select shows their text). */
    allowHtml(condition = true): this { this._allowHtml = condition; return this; }
    private labelForDisplay(label: string): string { return !this._allowHtml ? label : this.isNative() ? label.replace(/<[^>]*>/g, '') : sanitizeHtml(label); }
    /** A search field in the select (implies a JavaScript select). */
    searchableOptions(condition = true): this { this._searchable = condition; return this; }
    isNative(): boolean { return this._native && !this._searchable; }
    /** Options that cannot be chosen. A disabled option is also refused on the server. */
    disableOptionWhen(callback: (value: string, label: string, record: R) => boolean): this { this._disabledOptions.push(callback); return this; }
    isOptionDisabled(value: string, label: string, record: R): boolean { return this._disabledOptions.some((callback) => callback(value, label, record)); }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** Maximum number of options listed by the JavaScript select (50 by default). */
    optionsLimit(limit: number): this { this._optionsLimit = limit; return this; }
    /** `false`: long option labels are truncated in the JavaScript select instead of wrapping. */
    allowOptionsLabelsWrap(condition = true): this { this._canOptionLabelsWrap = condition; return this; }
    /** Side where the JavaScript select's dropdown opens (automatic by default). */
    position(position: 'top' | 'bottom' | null): this { this._position = position; return this; }
    inline(condition = true): this { this._inline = condition; return this; }
    protected getImplicitRules(): ColumnValidationRule[] {
        // Options that depend on the record are checked by `validateFor()`.
        if (typeof this._options === 'function' || this._optionsRelationship) return [];
        const options = this._options;
        return [{ name: 'in', passes: (v) => (typeof v === 'string' || typeof v === 'number') && options.some(([value]) => value === String(v)), message: (a) => `The selected ${a} is invalid.` }];
    }
    /** The value must be one of the record's options, and not a disabled one. */
    async validateFor(record: R, input: unknown): Promise<string | null> {
        if (!isBlank(input)) {
            // Relationship options: the received key must be one of the related model's records (in the modified query).
            const options = this._optionsRelationship && (typeof input === 'string' || typeof input === 'number')
                ? await loadRelationshipOptions((record as any)?.constructor, this._optionsRelationship.name, this._optionsRelationship.title, this._optionsRelationship.modify, [String(input)])
                : await this.getOptionsFor(record);
            const option = (typeof input === 'string' || typeof input === 'number') ? options.find(([value]) => value === String(input)) : undefined;
            if (!option || this.isOptionDisabled(option[0], option[1], record)) return this._validationMessages.in ?? `The selected ${this.getValidationAttribute()} is invalid.`;
        }
        return this.validate(input);
    }
    async toHtml(record: R, recordKey: string | number = ''): Promise<string> {
        const state = await this.getState(record);
        const value = state === null || state === undefined ? '' : String(state);
        const options = await this.getOptionsFor(record);
        const found = options.find(([option]) => option === value)?.[1] ?? null;
        const optionLabel = found === null ? null : this.labelForDisplay(found);
        const isDisabled = await this.isDisabledFor(record);
        const isNative = this.isNative();
        const placeholder = this._placeholder ?? t('filament-forms::components.select.placeholder');
        const optionsForJs = isNative ? [] : options.map(([option, label]) => ({ label: this.labelForDisplay(label), value: option, isDisabled: this.isOptionDisabled(option, label, record) }));
        const config = `selectTableColumn({
                    accessibilityAttributes: [],
                    ariaLabel: ${js(this.getLabel())},
                    canOptionLabelsWrap: ${js(this._canOptionLabelsWrap)},
                    canSelectPlaceholder: ${js(this._selectablePlaceholder)},
                    clearButtonLabel: ${js(t('filament-forms::components.select.actions.clear.label'))},
                    errorMessage: ${js(t('filament-forms::components.select.error_message'))},
                    hasDynamicOptions: false,
                    hasDynamicSearchResults: false,
                    hasInitialNoOptionsMessage: true,
                    initialOptionLabel: ${js(optionLabel)},
                    isDisabled: ${js(isDisabled)},
                    isHtmlAllowed: ${js(this._allowHtml && !isNative)},
                    isNative: ${js(isNative)},
                    isSearchable: ${js(this._searchable)},
                    loadingMessage: ${js(t('filament-forms::components.select.loading_message'))},
                    messages: ${js(this.getUpdateStateMessages())},
                    name: ${js(this.name)},
                    noOptionsMessage: ${js(t('filament-forms::components.select.no_options_message'))},
                    noSearchResultsMessage: ${js(t('filament-forms::components.select.no_search_results_message'))},
                    options: ${js(optionsForJs)},
                    optionsLimit: ${js(this._optionsLimit)},
                    placeholder: ${js(placeholder)},
                    position: ${js(this._position)},
                    recordKey: ${js(String(recordKey))},
                    searchableOptionFields: ${js(['label'])},
                    searchDebounce: 1000,
                    searchingMessage: ${js(t('filament-forms::components.select.searching_message'))},
                    searchLabel: ${js(t('filament-forms::components.select.search_label'))},
                    searchPrompt: ${js(t('filament-forms::components.select.search_prompt'))},
                    state: ${js(state === null || state === undefined ? null : value)},
                })`;
        const tooltip = this.tooltipExpression(record, isNative ? null : 'triggerTarget: $el.isConnected && select ? select.selectButton : null,');
        const select = new Attributes().merge({
            'aria-label': e(this.getLabel()), disabled: true, 'wire:loading.attr': 'disabled', 'wire:target': LOADING_TARGETS,
            'x-bind:aria-invalid': "error ? 'true' : null", 'x-bind:aria-busy': "isLoading ? 'true' : null",
            'x-bind:aria-describedby': "getAccessibilityAttributes([])[ 'aria-describedby' ]", 'x-bind:disabled': isDisabled ? null : 'isLoading', 'x-on:change': 'clearError()',
            'x-tooltip': tooltip,
        }).class(['fi-select-input']);
        const control = isNative
            ? `<select x-model="state" ${select.toHtml()}>${this._selectablePlaceholder ? `<option value="">${e(placeholder)}</option>` : ''}${options.map(([option, label]) => `<option${this.isOptionDisabled(option, label, record) ? ' disabled' : ''} value="${e(option)}">${e(this.labelForDisplay(label))}</option>`).join('')}</select>`
            : '<div wire:ignore class="fi-select-input"><div x-ref="select"></div></div>';
        return `<div wire:ignore.self x-load="x-load" x-load-src="${e(views.render('filament-tables::asset', { path: 'columns/select' }).trim())}" x-data="${e(config)}" x-id="['table-column-error']" x-on:click.capture="preventEdit($event)" x-on:keydown.capture="preventEdit($event)" class="${cls(['fi-ta-select', this._inline ? 'fi-inline' : null])}"><input type="hidden" value="${e(value)}" data-option-label="${e(optionLabel ?? '')}" data-disabled="${isDisabled ? 'true' : 'false'}" x-ref="serverState" /><div x-bind:class="{
                    'fi-disabled': isLoading || ${js(isDisabled)},
                    'fi-invalid': error !== undefined,
                }" x-on:click.prevent.stop${isNative ? '' : ` x-tooltip="${e(tooltip)}"`} class="fi-input-wrp">${control}</div><p x-cloak x-show="error" x-bind:id="$id('table-column-error')" x-ref="error" x-text="error" class="fi-sr-only"></p><p role="status" aria-live="polite" aria-atomic="true" x-text="status" class="fi-sr-only"></p></div>`;
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
    const error = await column.validateFor(record, input);
    if (error !== null) return { error };
    return column.updateState(record, input, adapter);
}

// ------------------------------------------------------------------ filters
/** Filter state: the values of its form. */
export type FilterState = Record<string, unknown>;
/** Active filter indicator: its label, and the filter field cleared when it is removed. */
/** Active filter indicator: its label, the filter field cleared when it is removed (`''`: the whole filter), whether it can be removed, and its badge color. */
export type FilterIndicator = { label: string; field: string; removable?: boolean; color?: string | null };
/** Where the filters form is shown: in a toolbar dropdown (default) or modal, or in a panel around the table content. */
export type FiltersLayout = 'dropdown' | 'modal' | 'above-content' | 'above-content-collapsible' | 'below-content' | 'before-content' | 'before-content-collapsible' | 'after-content' | 'after-content-collapsible';
const FILTERS_LAYOUTS: FiltersLayout[] = ['dropdown', 'modal', 'above-content', 'above-content-collapsible', 'below-content', 'before-content', 'before-content-collapsible', 'after-content', 'after-content-collapsible'];
/** Widths accepted for the filters dropdown, modal or side panel. */
const FILTERS_WIDTHS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'full', 'screen-sm', 'screen-md', 'screen-lg', 'screen-xl', 'screen-2xl', 'screen'];
export interface TableFilter {
    readonly name: string;
    getLabel(): string;
    /** Initial state (empty form). */
    getDefaultState(): FilterState;
    /** State after the filter is removed (its indicator or "remove all"); `getDefaultState()` when absent. */
    getResetState?(): FilterState;
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

const filterLabel = (name: string) => name.replace(/[_.-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Badge shown above the table for an applied filter. */
export class Indicator {
    private _label: string;
    private _removeField: string | null = null;
    private _removable = true;
    private _color: string | null = null;
    constructor(label: string) { this._label = label; }
    static make(label: string): Indicator { return new Indicator(label); }
    label(label: string): this { this._label = label; return this; }
    getLabel(): string { return this._label; }
    /** Field of the filter form cleared when the indicator is removed (by default, the whole filter is reset). */
    removeField(field: string | null): this { this._removeField = field; return this; }
    getRemoveField(): string | null { return this._removeField; }
    /** `false`: no remove button. A forged removal is refused on the server too. */
    removable(condition = true): this { this._removable = condition; return this; }
    isRemovable(): boolean { return this._removable; }
    color(color: string | null): this { this._color = color; return this; }
    getColor(): string | null { return this._color; }
}
/** What `indicateUsing()` may return: a label, an `Indicator`, a list of them, or `{ field: label }` pairs. */
export type IndicatorResult = string | Indicator | null | undefined | (string | Indicator)[] | Record<string, string | Indicator>;
const toIndicators = (result: IndicatorResult): FilterIndicator[] => {
    if (result === null || result === undefined || result === '') return [];
    const one = (item: string | Indicator, field: string | null): FilterIndicator | null => {
        const indicator = item instanceof Indicator ? item : typeof item === 'string' && item !== '' ? Indicator.make(item) : null;
        if (!indicator) return null;
        return { label: indicator.getLabel(), field: indicator.getRemoveField() ?? field ?? '', removable: indicator.isRemovable(), color: indicator.getColor() };
    };
    if (typeof result === 'string' || result instanceof Indicator) return [one(result, null)].filter((i): i is FilterIndicator => i !== null);
    if (Array.isArray(result)) return result.map((item) => one(item, null)).filter((i): i is FilterIndicator => i !== null);
    return Object.entries(result).map(([field, item]) => one(item, field)).filter((i): i is FilterIndicator => i !== null);
};
/** A received select value: a string of at most 255 characters. */
const filterValue = (value: unknown): string | null => ((typeof value === 'string' || typeof value === 'number') && String(value) !== '' ? String(value).slice(0, 255) : null);

/** Shared options of the built-in filters: label, default state, indicators and custom query. */
abstract class BaseFilter implements TableFilter {
    readonly name: string;
    protected _label: string | null = null;
    protected _default: unknown = undefined;
    protected _indicator: string | Indicator | null = null;
    protected _indicateUsing: ((data: FilterState) => IndicatorResult) | null = null;
    protected _query: ((query: any, data: FilterState) => void) | null = null;
    protected _columnSpan: Record<string, number | string> = { default: 1, lg: 1 };
    constructor(name: string) { this.name = name; }
    label(label: string): this { this._label = label; return this; }
    getLabel(): string { return this._label ?? filterLabel(this.name); }
    /** State applied when the table opens and when the user clicks "Reset". */
    default(value: unknown = true): this { this._default = value; return this; }
    /** Label of the indicator (the filter label by default). */
    indicator(indicator: string | Indicator | null): this { this._indicator = indicator; return this; }
    getIndicator(): string | Indicator { return this._indicator ?? this.getLabel(); }
    /** Indicators of the applied state, replacing the default one. */
    indicateUsing(callback: ((data: FilterState) => IndicatorResult) | null): this { this._indicateUsing = callback; return this; }
    /** Query condition built from the sanitized state, replacing the default one. */
    query(modifier: (query: any, data: FilterState) => void): this { this._query = modifier; return this; }
    /** Width of the filter in the filters form grid. */
    columnSpan(span: number | string | Record<string, number | string>): this { this._columnSpan = typeof span === 'object' ? span : { default: span }; return this; }
    columnSpanFull(): this { return this.columnSpan('full'); }
    getColumnSpan(): Record<string, number | string> { return this._columnSpan; }
    /** State after removing the filter: blank, whatever the default. */
    abstract getResetState(): FilterState;
    abstract getDefaultState(): FilterState;
    abstract sanitizeState(state: unknown): FilterState;
    abstract isActive(state: FilterState): boolean;
    abstract apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void;
    getFormDefinition() { return { placeholder: '', options: [] as [string, string][] }; }
    protected defaultIndicators(_data: FilterState): IndicatorResult { return null; }
    getIndicators(state: FilterState): FilterIndicator[] {
        const data = this.sanitizeState(state);
        return toIndicators(this._indicateUsing ? this._indicateUsing(data) : this.defaultIndicators(data));
    }
    /** Prefixes a value label with the indicator, unless the indicator is a ready-made `Indicator`. */
    protected labelled(valueLabel: string): string | Indicator {
        const indicator = this.getIndicator();
        return indicator instanceof Indicator ? indicator : `${indicator}: ${valueLabel}`;
    }
}

/** Value of the "None" option of a relationship select filter. */
const EMPTY_RELATIONSHIP_OPTION = '__empty';

/** Filters on a column value picked from a list. */
export class SelectFilter extends BaseFilter {
    private _column: string | null = null;
    private _options: [string, string][] | (() => Promise<[string, string][]>) = [];
    private _multiple = false;
    private _searchable = false;
    private _selectablePlaceholder = true;
    private _placeholder: string | null = null;
    private _optionLabels = new Map<string, string>();
    static make(name: string): SelectFilter { return configured(new SelectFilter(name)); }
    /** Filtered column when it differs from the filter name (e.g. a relationship's foreign key). */
    column(column: string): this { this._column = column; return this; }
    attribute(column: string): this { return this.column(column); }
    getColumn(): string { return this._column ?? this.name; }
    /** Fixed options, or an async function (e.g. records of a relationship). */
    options(options: [string, string][] | Record<string, string> | (() => Promise<[string, string][]>)): this {
        this._options = typeof options === 'function' ? options : (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]): [string, string] => [String(value), String(label)]);
        return this;
    }
    /** Several values can be picked: records matching any of them are shown. */
    multiple(condition = true): this { this._multiple = condition; return this; }
    isMultiple(): boolean { return this._multiple; }
    searchable(condition = true): this { this._searchable = condition; return this; }
    /** `false`: the empty option cannot be picked again once a value is chosen. */
    selectablePlaceholder(condition = true): this { this._selectablePlaceholder = condition; return this; }
    placeholder(placeholder: string | null): this { this._placeholder = placeholder; return this; }
    /** No-op: options are always loaded with the form. */
    preload(): this { return this; }
    private _relationship: { name: string; title: string | null; modify: RelationshipQueryModifier | null; empty: boolean } | null = null;
    private _emptyOptionLabel: string | null = null;
    private _host: unknown = null;
    /**
     * Options from the records of a relationship of the table's model (an Objection model with `relationMappings`); records
     * related to the picked ones are shown. `hasEmptyOption` adds a "None" option for records without related records.
     */
    relationship(name: string, titleAttribute: string | null = null, modifyQueryUsing: RelationshipQueryModifier | null = null, hasEmptyOption = false): this {
        this._relationship = { name, title: titleAttribute, modify: modifyQueryUsing, empty: hasEmptyOption };
        return this;
    }
    hasRelationship(): boolean { return this._relationship !== null; }
    /** Label of the "None" option of `relationship(..., hasEmptyOption: true)`. */
    emptyRelationshipOptionLabel(label: string | null): this { this._emptyOptionLabel = label; return this; }
    getEmptyRelationshipOptionLabel(): string { return this._emptyOptionLabel ?? t('filament-tables::table.filters.select.relationship.empty_option_label'); }
    getFormDefinition() { return { placeholder: this._placeholder ?? t('filament-tables::table.filters.select.placeholder'), options: Array.isArray(this._options) && !this._relationship ? this._options : [] }; }
    getFormOptions(host: unknown = this._host): Promise<[string, string][]> {
        if (this._relationship) return this.loadRelationshipOptions(host, null);
        return typeof this._options === 'function' ? this._options() : Promise.resolve(this._options);
    }
    private async loadRelationshipOptions(host: unknown, keys: string[] | null): Promise<[string, string][]> {
        const relation = this._relationship!;
        const options = await loadRelationshipOptions(modelOfHost(host), relation.name, relation.title, relation.modify, keys === null ? null : keys.filter((key) => key !== EMPTY_RELATIONSHIP_OPTION));
        return relation.empty && (keys === null || keys.includes(EMPTY_RELATIONSHIP_OPTION)) ? [[EMPTY_RELATIONSHIP_OPTION, this.getEmptyRelationshipOptionLabel()], ...options] : options;
    }
    /** Options are evaluated on every render, so the select gets a key derived from them (forces a re-render when they change). */
    readonly hasDynamicOptions = true;
    getFormComponents(): unknown[] {
        const select = Select.make(this._multiple ? 'values' : 'value').label(this.getLabel()).placeholder(this.getFormDefinition().placeholder).options((ctx: any) => this.getFormOptions(ctx?.livewire));
        if (this._multiple) select.multiple();
        if (this._searchable) select.searchable();
        if (!this._selectablePlaceholder) select.selectablePlaceholder(false);
        return [select];
    }
    private defaultValues(): string[] { return (Array.isArray(this._default) ? this._default : this._default === undefined || this._default === null ? [] : [this._default]).map(filterValue).filter((v): v is string => v !== null); }
    getResetState(): FilterState { return this._multiple ? { values: [] } : { value: null }; }
    getDefaultState(): FilterState { const values = this.defaultValues(); return this._multiple ? { values } : { value: values[0] ?? null }; }
    sanitizeState(state: unknown): FilterState {
        const received = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
        if (!this._multiple) return { value: filterValue(received.value) };
        const values = Array.isArray(received.values) ? received.values : [];
        return { values: [...new Set(values.map(filterValue).filter((v): v is string => v !== null))].slice(0, 100) };
    }
    /** Values that can filter: with fixed options, only offered values; loaded options are bound parameters (an unknown value matches nothing). */
    private values(state: FilterState): string[] {
        const data = this.sanitizeState(state);
        const values = this._multiple ? (data.values as string[]) : data.value === null ? [] : [data.value as string];
        // Relationship or loaded options: the keys are bound parameters, an unknown key matches nothing.
        return Array.isArray(this._options) && !this._relationship ? values.filter((value) => (this._options as [string, string][]).some(([option]) => option === value)) : values;
    }
    isActive(state: FilterState): boolean { return this.values(state).length > 0; }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        const values = this.values(state);
        if (!values.length) return;
        const data = this.sanitizeState(state);
        if (this._query) { (query.modifiers ??= []).push((q) => { this._query!(q, data); }); return; }
        if (this._relationship) {
            const { name, modify } = this._relationship;
            const keys = values.filter((value) => value !== EMPTY_RELATIONSHIP_OPTION);
            const empty = this._relationship.empty && values.includes(EMPTY_RELATIONSHIP_OPTION);
            // Records related to one of the picked records, or (the "None" option) without related records.
            (query.modifiers ??= []).push((q) => {
                q.where((inner: any) => {
                    if (keys.length) inner.orWhere((related: any) => applyConditions(related, [{ kind: 'related', relationship: name, keys, negate: false, ...(modify ? { modify } : {}) }]));
                    if (empty) inner.orWhere((none: any) => applyConditions(none, [{ kind: 'related', relationship: name, keys: null, negate: true, ...(modify ? { modify } : {}) }]));
                });
            });
            return;
        }
        const column = this.getColumn();
        (query.modifiers ??= []).push((q) => { if (this._multiple) q.whereIn(column, values); else q.where(column, values[0]); });
    }
    /** Labels of the applied values, loaded before the indicators are computed. */
    async loadIndicatorData(state: FilterState, host?: TableHost): Promise<void> {
        const values = this.values(state);
        if (!values.length) return;
        this._optionLabels = new Map(this._relationship ? await this.loadRelationshipOptions(host, values) : await this.getFormOptions());
    }
    protected defaultIndicators(data: FilterState): IndicatorResult {
        const labels = this.values(data).map((value) => this._optionLabels.get(value) ?? (Array.isArray(this._options) ? this._options.find(([option]) => option === value)?.[1] : undefined)).filter((label): label is string => label !== undefined);
        if (!labels.length) return null;
        const joined = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}` : labels[0];
        return [this.labelled(joined)];
    }
}

/** Three-state filter: all, yes, no. By default on a boolean column; `nullable()` checks whether the column is filled. */
export class TernaryFilter extends BaseFilter {
    private _column: string | null = null;
    protected _trueLabel: string | null = null;
    protected _falseLabel: string | null = null;
    protected _placeholder: string | null = null;
    protected _nullable = false;
    protected _queries: { true: (query: any) => void; false: (query: any) => void; blank?: (query: any) => void } | null = null;
    static make(name: string): TernaryFilter { return configured(new TernaryFilter(name)); }
    attribute(column: string): this { this._column = column; return this; }
    column(column: string): this { return this.attribute(column); }
    getColumn(): string { return this._column ?? this.name; }
    trueLabel(label: string | null): this { this._trueLabel = label; return this; }
    falseLabel(label: string | null): this { this._falseLabel = label; return this; }
    placeholder(label: string | null): this { this._placeholder = label; return this; }
    getTrueLabel(): string { return this._trueLabel ?? t('filament-forms::components.select.boolean.true'); }
    getFalseLabel(): string { return this._falseLabel ?? t('filament-forms::components.select.boolean.false'); }
    /** "Yes" shows records where the column is filled, "No" those where it is empty. */
    nullable(condition = true): this { this._nullable = condition; return this; }
    /** Custom conditions for "yes", "no" and, optionally, the empty choice. */
    queries(queries: { true: (query: any) => void; false: (query: any) => void; blank?: (query: any) => void }): this { this._queries = queries; return this; }
    getFormDefinition() { return { placeholder: this._placeholder ?? '-', options: [['1', this.getTrueLabel()], ['0', this.getFalseLabel()]] as [string, string][] }; }
    getFormComponents(): unknown[] {
        const definition = this.getFormDefinition();
        return [Select.make('value').label(this.getLabel()).placeholder(definition.placeholder).options(definition.options)];
    }
    getResetState(): FilterState { return { value: null }; }
    getDefaultState(): FilterState { return { value: this._default === true || this._default === 1 || this._default === '1' ? '1' : this._default === false || this._default === 0 || this._default === '0' ? '0' : null }; }
    sanitizeState(state: unknown): FilterState {
        const value = state && typeof state === 'object' ? String((state as Record<string, unknown>).value ?? '') : '';
        return { value: value === '1' || value === '0' ? value : null };
    }
    isActive(state: FilterState): boolean { return this.sanitizeState(state).value !== null; }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        const data = this.sanitizeState(state);
        const value = data.value as string | null;
        if (this._query) { (query.modifiers ??= []).push((q) => { this._query!(q, data); }); return; }
        if (this._queries) {
            const modifier = value === '1' ? this._queries.true : value === '0' ? this._queries.false : this._queries.blank;
            if (modifier) (query.modifiers ??= []).push((q) => { modifier(q); });
            return;
        }
        if (value === null) return;
        const column = this.getColumn(), on = value === '1';
        (query.modifiers ??= []).push((q) => { if (this._nullable) { if (on) q.whereNotNull(column); else q.whereNull(column); } else q.where(column, on ? 1 : 0); });
    }
    protected defaultIndicators(data: FilterState): IndicatorResult {
        if (data.value === null) return null;
        return [this.labelled(data.value === '1' ? this.getTrueLabel() : this.getFalseLabel())];
    }
}

/** "Trashed" filter for soft-deletable models: without (default), with, or only deleted records. */
export class TrashedFilter extends TernaryFilter {
    constructor(name = 'trashed') { super(name); }
    static make(name = 'trashed'): TrashedFilter { return configured(new TrashedFilter(name)); }
    getLabel(): string { return this._label ?? t('filament-tables::table.filters.trashed.label'); }
    getTrueLabel(): string { return this._trueLabel ?? t('filament-tables::table.filters.trashed.with_trashed'); }
    getFalseLabel(): string { return this._falseLabel ?? t('filament-tables::table.filters.trashed.only_trashed'); }
    getFormDefinition() { return { placeholder: this._placeholder ?? t('filament-tables::table.filters.trashed.without_trashed'), options: [['1', this.getTrueLabel()], ['0', this.getFalseLabel()]] as [string, string][] }; }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        const value = this.sanitizeState(state).value;
        query.trashed = value === '1' ? 'with' : value === '0' ? 'only' : 'without';
    }
    protected defaultIndicators(data: FilterState): IndicatorResult {
        if (data.value === null) return null;
        return [data.value === '1' ? this.getTrueLabel() : this.getFalseLabel()];
    }
}

/**
 * Custom filter. Without `schema()`, it is a checkbox (or a toggle with `toggle()`) and `query()` runs when it is checked.
 * With `schema()`, the query and indicators are written by the application.
 */
export class Filter extends BaseFilter {
    private _components: unknown[] = [];
    private _toggle = false;
    private _formComponents: unknown[] | null = null;
    static make(name: string): Filter { return configured(new Filter(name)); }
    /** Filter fields; their names are the only state keys accepted from the browser. */
    schema(components: unknown[]): this { this._components = components; this._formComponents = null; return this; }
    /** Form fields of a filter without `schema()`: a toggle instead of a checkbox. */
    toggle(condition = true): this { this._toggle = condition; this._formComponents = null; return this; }
    checkbox(): this { return this.toggle(false); }
    private hasSchema(): boolean { return this._components.length > 0; }
    getFormComponents(): unknown[] {
        if (this.hasSchema()) return this._components;
        return (this._formComponents ??= [(this._toggle ? Toggle : Checkbox).make('isActive').label(this.getLabel())]);
    }
    private fields(): unknown[] { return this.getFormComponents().filter((c: any) => typeof c?.getName === 'function'); }
    getResetState(): FilterState { return this.hasSchema() ? Object.fromEntries(this.fields().map((c: any) => [String(c.getName()), null])) : { isActive: false }; }
    getDefaultState(): FilterState {
        if (!this.hasSchema()) return { isActive: this._default === true };
        return Object.fromEntries(this.fields().map((c: any) => {
            const value = typeof c.getDefaultState === 'function' ? c.getDefaultState() : null;
            return [String(c.getName()), filterFieldValue(value)];
        }));
    }
    sanitizeState(state: unknown): FilterState {
        const received = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
        if (!this.hasSchema()) return { isActive: received.isActive === true || received.isActive === 1 || received.isActive === '1' };
        return Object.fromEntries(this.fields().map((c: any) => { const name = String(c.getName()); const value = received[name]; return [name, filterFieldValue(value)]; }));
    }
    /** A field left empty, or an unchecked checkbox, does not filter. */
    isActive(state: FilterState): boolean { return Object.values(this.sanitizeState(state)).some((value) => value !== null && value !== false); }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        const data = this.sanitizeState(state);
        if (this._query && this.isActive(data)) (query.modifiers ??= []).push((q) => { this._query!(q, data); });
    }
    protected defaultIndicators(data: FilterState): IndicatorResult {
        if (!this.isActive(data)) return null;
        const indicator = this.getIndicator();
        return [indicator];
    }
    removeIndicator(state: FilterState, field: string): FilterState { return field === '' ? this.getResetState() : { ...this.sanitizeState(state), [field]: null }; }
}

/** Value of a custom filter field: a scalar, or a list of scalars (multiple select, checkbox list, 100 at most); anything else, empty strings and empty lists become `null`. */
function filterFieldValue(value: unknown): unknown {
    if (Array.isArray(value)) { const items = [...new Set(value.filter((item) => (typeof item === 'string' && item !== '') || typeof item === 'number').map(String))].slice(0, 100); return items.length ? items : null; }
    return ['string', 'number', 'boolean'].includes(typeof value) && value !== '' ? value : null;
}

// ------------------------------------------------------------------ table
export type ColumnState = { type: 'column'; name: string; label: string; isHidden: boolean; isToggled: boolean; isToggleable: boolean; isToggledHiddenByDefault: boolean | null };

/** Look of a filters action (trigger, apply, reset), changed with `filtersTriggerAction()`, `filtersApplyAction()` and `filtersResetAction()`. */
export class FiltersAction {
    private _label: string | null = null;
    private _icon: string | null | undefined = undefined;
    private _color: string | null = null;
    private _view: 'button' | 'link' | 'icon-button' | null = null;
    private _hidden = false;
    label(label: string | null): this { this._label = label; return this; }
    icon(icon: string | null): this { this._icon = icon; return this; }
    color(color: string | null): this { this._color = color; return this; }
    /** Labeled button. */
    button(): this { this._view = 'button'; return this; }
    link(): this { this._view = 'link'; return this; }
    /** Icon only, the label becomes the tooltip and accessible name. */
    iconButton(): this { this._view = 'icon-button'; return this; }
    hidden(condition = true): this { this._hidden = condition; return this; }
    resolve(defaults: { label: string; icon: string | null; color: string; view: 'button' | 'link' | 'icon-button' }) {
        return { label: this._label ?? defaults.label, icon: this._icon === undefined ? defaults.icon : this._icon, color: this._color ?? defaults.color, view: this._view ?? defaults.view, hidden: this._hidden };
    }
}
type FiltersActionView = ReturnType<FiltersAction['resolve']> & { customized: boolean };

/**
 * Bulk actions grouped in a dropdown of the toolbar, shown while records are selected (`toolbarActions([BulkActionGroup.make([...])])`).
 * Each group is its own menu, "Bulk actions" by default, with its own label, icon and color.
 */
export class BulkActionGroup {
    private _actions: any[];
    private _label: string | null = null;
    private _icon: string | null = null;
    private _color: string | null = null;
    private _tooltip: string | null = null;
    private _placement: string | null = null;
    constructor(actions: any[]) { this._actions = actions; }
    static make(actions: any[]): BulkActionGroup { return configured(new BulkActionGroup(actions)); }
    getActions(): any[] { return this._actions; }
    label(label: string | null): this { this._label = label; return this; }
    icon(icon: string | null): this { this._icon = icon; return this; }
    /** Color of the trigger button (gray by default). */
    color(color: string | null): this { this._color = color; return this; }
    tooltip(tooltip: string | null): this { this._tooltip = tooltip; return this; }
    /** Placement of the menu (`bottom-start` by default), e.g. `bottom-end`. */
    dropdownPlacement(placement: string | null): this { this._placement = placement !== null && /^(top|bottom|left|right)(-(start|end))?$/.test(placement) ? placement : null; return this; }
    getLabel(): string { return this._label ?? t('filament-tables::table.actions.open_bulk_actions.label'); }
    getIcon(): string { return this._icon ?? icons.resolve('tables::actions.open-bulk-actions') ?? 'm-ellipsis-vertical'; }
    getColor(): string { return this._color ?? 'gray'; }
    getTooltip(): string | null { return this._tooltip; }
    getDropdownPlacement(): string { return this._placement ?? 'bottom-start'; }
    /** Menu of the toolbar with the HTML of the visible actions (`renderTable({ bulkActionGroups })`). */
    toMenu(actions: string[]): BulkActionMenu {
        return { label: this.getLabel(), icon: this.getIcon(), color: this.getColor(), tooltip: this.getTooltip(), placement: this.getDropdownPlacement(), actions, customized: this._label !== null || this._icon !== null || this._color !== null || this._tooltip !== null || this._placement !== null };
    }
}
/** A bulk actions dropdown of the toolbar: the look of its trigger and the HTML of its actions. */
export type BulkActionMenu = { label: string; icon: string; color: string; tooltip: string | null; placement: string; actions: string[]; customized?: boolean };

/** Upper bound on the rows loaded by an unpaginated table or the `'all'` page option. */
export const MAX_UNPAGINATED_RECORDS = 10000;

export class Table<R = any> {
    /** Default setup for every table, e.g. `Table.configureUsing((table) => table.paginationPageOptions([10, 25]))`. */
    static configureUsing(configure: (table: Table<any>) => void): void { configureUsing(Table, configure); }
    // Global settings apply first: options set in `table()` override them.
    constructor() { configured(this); }
    private _columns: Column<R>[] = [];
    private _recordAction: string | null = null;
    private _pageSummary = true;
    private _allTableSummary = true;
    /** Which summary rows to show: "this page" (`pageCondition`) and the whole table (`allTableCondition`); group summaries are not affected. */
    summaries(pageCondition = true, allTableCondition = true): this { this._pageSummary = pageCondition; this._allTableSummary = allTableCondition; return this; }
    hasPageSummary(): boolean { return this._pageSummary; }
    hasAllTableSummary(): boolean { return this._allTableSummary; }
    private _recordActions: any[] = [];
    private _heading: string | null = null;
    private _headerActions: any[] = [];
    private _bulkActions: any[] | null = null;
    private _recordClasses: ((record: R) => string | null) | null = null;
    private _filters: TableFilter[] = [];
    private _filtersLayout: FiltersLayout = 'dropdown';
    private _defaultSort: { column: string; direction: SortDirection } | null = null;
    private _recordUrl: ((record: R) => string | null) | null = null;
    private _pageOptions: (number | 'all')[] = [5, 10, 25, 50];
    private _paginated = true;
    private _emptyStateHeading: string | (() => string) | null = null;
    private _emptyStateDescription: string | (() => string | null) | null = null;
    private _emptyStateIcon: string | null = null;
    private _emptyStateActions: any[] = [];
    private _emptyState: string | (() => string | Promise<string>) | null = null;
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
    /** Column layout, or `null` for a regular table. The collapsible component is left out (see `getCollapsibleColumnsLayout()`). */
    getColumnsLayout(): (Column<R> | ColumnLayout<R>)[] | null {
        const collapsible = this.getCollapsibleColumnsLayout();
        return this._columnsLayout && collapsible ? this._columnsLayout.filter((node) => node !== collapsible) : this._columnsLayout;
    }
    /** The first top-level layout component marked `collapsible()`, shown behind a toggle button. */
    getCollapsibleColumnsLayout(): ColumnLayout<R> | null { return (this._columnsLayout?.find((node) => node instanceof ColumnLayout && node.isCollapsible()) as ColumnLayout<R> | undefined) ?? null; }
    private _contentGrid: Record<string, number> | null = null;
    /** Arranges the record cards of a column layout in a grid: `contentGrid({ md: 2, xl: 3 })`. */
    contentGrid(columns: Record<string, number> | number | null): this { this._contentGrid = columns === null ? null : typeof columns === 'number' ? { lg: columns } : columns; return this; }
    getContentGrid(): Record<string, number> | null { return this._contentGrid; }
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
    /** Bulk actions: those of `groupedBulkActions()`, then those of the `BulkActionGroup`s of `toolbarActions()`; `null` when none is declared. */
    getBulkActions(): any[] | null {
        const groups = this._toolbarActions.filter((action) => action instanceof BulkActionGroup) as BulkActionGroup[];
        if (this._bulkActions === null && !groups.length) return null;
        return [...(this._bulkActions ?? []), ...groups.flatMap((group) => group.getActions())];
    }
    /**
     * Bulk action menus: one "Bulk actions" menu for `groupedBulkActions()`, then one per `BulkActionGroup` of `toolbarActions()`;
     * `null` when none is declared.
     */
    getBulkActionGroups(): BulkActionGroup[] | null {
        const groups = this._toolbarActions.filter((action) => action instanceof BulkActionGroup) as BulkActionGroup[];
        if (this._bulkActions === null && !groups.length) return null;
        return [...(this._bulkActions?.length ? [BulkActionGroup.make(this._bulkActions)] : []), ...groups];
    }
    private _toolbarActions: any[] = [];
    /** Actions in the toolbar, left of the search field: buttons, and a `BulkActionGroup` for the bulk actions dropdown. */
    toolbarActions(actions: any[]): this { this._toolbarActions = actions; return this; }
    /** Toolbar actions other than bulk action groups. */
    getToolbarActions(): any[] { return this._toolbarActions.filter((action) => !(action instanceof BulkActionGroup)); }
    /** Row actions: `Action`s or an `ActionGroup` (dropdown). */
    recordActions(actions: any[]): this { this._recordActions = actions; return this; }
    getRecordActions(): any[] { return this._recordActions; }
    /** Actions given to columns with `action()` (not those named after a record action). */
    getColumnActions(): any[] { return this.getColumns().map((column) => column.getAction()).filter((action) => action !== null); }
    /** CSS classes added to a row depending on its record. */
    recordClasses(resolver: (record: R) => string | null): this { this._recordClasses = resolver; return this; }
    getRecordClasses(record: R): string | null { return this._recordClasses ? this._recordClasses(record) : null; }
    filters(filters: TableFilter[], options: { layout?: FiltersLayout } = {}): this { this._filters = filters; if (options.layout) this.filtersLayout(options.layout); return this; }
    filtersLayout(layout: FiltersLayout): this { if (!FILTERS_LAYOUTS.includes(layout)) throw new Error(`Unknown filters layout: ${layout}`); this._filtersLayout = layout; return this; }
    getFiltersLayout(): FiltersLayout { return this._filtersLayout; }
    private _deferFilters = true;
    private _filtersFormColumns: number | Record<string, number> | null = null;
    private _filtersFormWidth: string | null = null;
    private _filtersFormMaxHeight: string | null = null;
    private _filtersResetPosition: 'header' | 'footer' = 'header';
    private _filterIndicatorsHidden = false;
    private _persist = { filters: false, search: false, columnSearches: false, sort: false };
    private _recordActionsPosition: 'before-columns' | 'before-cells' | 'after-columns' | 'after-cells' = 'after-columns';
    private _recordActionsAlignment: 'start' | 'center' | 'end' | null = null;
    /**
     * Where row actions go: after the columns (default), before the columns (after the checkbox), or before the checkbox
     * (`before-cells`). `after-cells` is the same as `after-columns`.
     */
    recordActionsPosition(position: 'before-columns' | 'before-cells' | 'after-columns' | 'after-cells'): this { if (['before-columns', 'before-cells', 'after-columns', 'after-cells'].includes(position)) this._recordActionsPosition = position; return this; }
    getRecordActionsPosition(): 'before-columns' | 'before-cells' | 'after-columns' | 'after-cells' { return this._recordActionsPosition; }
    /** Alignment of row actions in their cell. */
    recordActionsAlignment(alignment: 'start' | 'center' | 'end' | null): this { this._recordActionsAlignment = alignment; return this; }
    getRecordActionsAlignment(): 'start' | 'center' | 'end' | null { return this._recordActionsAlignment; }
    private _isRecordSelectable: ((record: R) => boolean | Promise<boolean>) | null = null;
    private _maxSelectableRecords: number | null = null;
    private _selectsCurrentPageOnly = false;
    /** Records for which this returns `false` have no checkbox, and are ignored by bulk actions even if the browser sends them. */
    checkIfRecordIsSelectableUsing(callback: ((record: R) => boolean | Promise<boolean>) | null): this { this._isRecordSelectable = callback; return this; }
    hasRecordSelectabilityCheck(): boolean { return this._isRecordSelectable !== null; }
    async isRecordSelectable(record: R): Promise<boolean> { return this._isRecordSelectable ? Boolean(await this._isRecordSelectable(record)) : true; }
    /** Maximum number of records the user may select at once (also enforced on the server). */
    maxSelectableRecords(count: number | null): this { this._maxSelectableRecords = count !== null && count > 0 ? Math.floor(count) : null; return this; }
    getMaxSelectableRecords(): number | null { return this._maxSelectableRecords; }
    private _queryModifiers: ((query: any) => unknown)[] = [];
    /**
     * Changes the table's query (an Objection query builder): only the records it keeps are shown, and, in a `TableSelect`,
     * only those can be selected. Several calls add up.
     */
    modifyQueryUsing(callback: (query: any) => unknown): this { this._queryModifiers.push(callback); return this; }
    getQueryModifiers(): ((query: any) => unknown)[] { return this._queryModifiers; }
    private _arguments: Record<string, unknown> = {};
    /** Values passed to the table by its host (the `tableArguments()` of a `TableSelect`), read with `getArguments()`. */
    arguments(args: Record<string, unknown>): this { this._arguments = args ?? {}; return this; }
    getArguments(): Record<string, unknown> { return this._arguments; }
    /** "Select all" only selects the records of the current page. */
    selectCurrentPageOnly(condition = true): this { this._selectsCurrentPageOnly = condition; return this; }
    selectsCurrentPageOnly(): boolean { return this._selectsCurrentPageOnly; }
    /** `false`: filters apply as soon as a field changes, without the "Apply" button. */
    deferFilters(condition = true): this { this._deferFilters = condition; return this; }
    private _filterActions: Partial<Record<'trigger' | 'apply' | 'reset', (action: FiltersAction) => FiltersAction | void>> = {};
    /** Customizes the button that opens the filters: `filtersTriggerAction((action) => action.button().label('Filter'))`. */
    filtersTriggerAction(configure: (action: FiltersAction) => FiltersAction | void): this { this._filterActions.trigger = configure; return this; }
    /** Customizes the "Apply" button of deferred filters. */
    filtersApplyAction(configure: (action: FiltersAction) => FiltersAction | void): this { this._filterActions.apply = configure; return this; }
    /** Customizes the "Reset" button (`hidden()` removes it). */
    filtersResetAction(configure: (action: FiltersAction) => FiltersAction | void): this { this._filterActions.reset = configure; return this; }
    getFiltersActionView(kind: 'trigger' | 'apply' | 'reset'): FiltersActionView {
        const defaults = {
            trigger: { label: t('filament-tables::table.actions.filter.label'), icon: icons.resolve('tables::actions.filter') ?? 'm-funnel', color: 'gray', view: 'icon-button' as const },
            apply: { label: t('filament-tables::table.filters.actions.apply.label'), icon: null, color: 'primary', view: 'button' as const },
            reset: { label: t('filament-tables::table.filters.actions.reset.label'), icon: null, color: this._filtersResetPosition === 'footer' ? 'gray' : 'danger', view: this._filtersResetPosition === 'footer' ? 'button' as const : 'link' as const },
        }[kind];
        const configure = this._filterActions[kind];
        if (!configure) return { ...defaults, hidden: false, customized: false };
        const action = new FiltersAction();
        return { ...(configure(action) ?? action).resolve(defaults), customized: true };
    }
    private _groupRecordsTriggerAction: ((action: FiltersAction) => FiltersAction | void) | null = null;
    /** Customizes the button that opens the grouping settings: `groupRecordsTriggerAction((action) => action.button().label('Group records'))`. */
    groupRecordsTriggerAction(configure: ((action: FiltersAction) => FiltersAction | void) | null): this { this._groupRecordsTriggerAction = configure; return this; }
    getGroupRecordsTriggerActionView(): FiltersActionView {
        const defaults = { label: t('filament-tables::table.actions.group.label'), icon: icons.resolve('tables::actions.group') ?? 'm-rectangle-stack', color: 'gray', view: 'icon-button' as const };
        if (!this._groupRecordsTriggerAction) return { ...defaults, hidden: false, customized: false };
        const action = new FiltersAction();
        return { ...(this._groupRecordsTriggerAction(action) ?? action).resolve(defaults), customized: true };
    }
    private _filtersFormSchema: ((filters: Record<string, any>) => any[]) | null = null;
    /**
     * Arranges the filters form yourself: the function receives each filter's form group, keyed by filter name, and returns
     * the form components (e.g. sections). Filters left out are not shown.
     */
    filtersFormSchema(schema: ((filters: Record<string, any>) => any[]) | null): this { this._filtersFormSchema = schema; return this; }
    getFiltersFormSchema(): ((filters: Record<string, any>) => any[]) | null { return this._filtersFormSchema; }
    hasDeferredFilters(): boolean { return this._deferFilters; }
    /** Columns of the filters form grid (1 in a dropdown or modal, up to 5 above or below the content by default). */
    filtersFormColumns(columns: number | Record<string, number> | null): this { this._filtersFormColumns = columns; return this; }
    getFiltersFormColumns(): number | Record<string, number> {
        if (this._filtersFormColumns !== null) return this._filtersFormColumns;
        return ['above-content', 'above-content-collapsible', 'below-content'].includes(this._filtersLayout) ? { sm: 2, lg: 3, xl: 4, '2xl': 5 } : 1;
    }
    /** Width of the filters dropdown, modal or side panel: `xs` to `7xl`, `full`, `screen`... */
    filtersFormWidth(width: string | null): this { this._filtersFormWidth = width === null || FILTERS_WIDTHS.includes(width) ? width : null; return this; }
    getFiltersFormWidth(): string | null { return this._filtersFormWidth; }
    /** Maximum height of the filters dropdown, as a CSS length; it scrolls beyond. */
    filtersFormMaxHeight(height: string | null): this { this._filtersFormMaxHeight = height !== null && /^[0-9.]+(rem|px|em|vh|%)$/.test(height) ? height : null; return this; }
    getFiltersFormMaxHeight(): string | null { return this._filtersFormMaxHeight; }
    /** `footer`: the "Reset" button goes next to "Apply" instead of the filters heading. */
    filtersResetActionPosition(position: 'header' | 'footer'): this { this._filtersResetPosition = position === 'footer' ? 'footer' : 'header'; return this; }
    getFiltersResetActionPosition(): 'header' | 'footer' { return this._filtersResetPosition; }
    /** Hides the active filter badges above the table. */
    hiddenFilterIndicators(condition = true): this { this._filterIndicatorsHidden = condition; return this; }
    areFilterIndicatorsHidden(): boolean { return this._filterIndicatorsHidden; }
    /** Keeps the applied filters for the user's browser session (restored when the page is opened again). */
    persistFiltersInSession(condition = true): this { this._persist.filters = condition; return this; }
    persistSearchInSession(condition = true): this { this._persist.search = condition; return this; }
    persistColumnSearchesInSession(condition = true): this { this._persist.columnSearches = condition; return this; }
    persistSortInSession(condition = true): this { this._persist.sort = condition; return this; }
    private _persistGrouping = false;
    persistGroupingInSession(condition = true): this { this._persistGrouping = condition; return this; }
    persistsGroupingInSession(): boolean { return this._persistGrouping; }
    persistsFiltersInSession(): boolean { return this._persist.filters; }
    persistsSearchInSession(): boolean { return this._persist.search; }
    persistsColumnSearchesInSession(): boolean { return this._persist.columnSearches; }
    persistsSortInSession(): boolean { return this._persist.sort; }
    defaultSort(column: string, direction: SortDirection = 'asc'): this { this._defaultSort = { column, direction }; return this; }
    recordUrl(resolver: (record: R) => string | null): this { this._recordUrl = resolver; return this; }
    private _reorderColumn: string | null = null;
    /** Lets users reorder rows by hand; `column` stores the position. */
    reorderable(column: string | null): this { this._reorderColumn = column; return this; }
    getReorderColumn(): string | null { return this._reorderColumn; }
    /** Page sizes offered; `'all'` shows every record (up to `MAX_UNPAGINATED_RECORDS`). */
    paginationPageOptions(options: (number | 'all')[]): this { this._pageOptions = options.filter((option) => option === 'all' || (Number.isInteger(option) && option > 0)); return this; }
    /** `false`: no pagination, every record is shown (up to `MAX_UNPAGINATED_RECORDS`). An array sets the page options. */
    paginated(condition: boolean | (number | 'all')[] = true): this {
        if (Array.isArray(condition)) { this.paginationPageOptions(condition); condition = true; }
        this._paginated = condition;
        return this;
    }
    isPaginated(): boolean { return this._paginated && !this._groupsOnly; }
    /** Heading of the empty state, instead of "No <records>". */
    emptyStateHeading(heading: string | (() => string) | null): this { this._emptyStateHeading = heading; return this; }
    emptyStateDescription(description: string | (() => string | null) | null): this { this._emptyStateDescription = description; return this; }
    emptyStateIcon(icon: string | null): this { this._emptyStateIcon = icon; return this; }
    /** Actions shown in the empty state, e.g. a create action. They are mounted like table header actions. */
    emptyStateActions(actions: any[]): this { this._emptyStateActions = actions; return this; }
    getEmptyStateActions(): any[] { return this._emptyStateActions; }
    /** Replaces the whole empty state with your HTML (inserted as it is: escape your data with `e()`). */
    emptyState(html: string | (() => string | Promise<string>) | null): this { this._emptyState = html; return this; }
    getEmptyStateHeading(): string { const heading = typeof this._emptyStateHeading === 'function' ? this._emptyStateHeading() : this._emptyStateHeading; return heading ?? t('filament-tables::table.empty.heading', { model: this.getPluralModelLabel() }); }
    getEmptyStateDescription(): string | null { return typeof this._emptyStateDescription === 'function' ? this._emptyStateDescription() : this._emptyStateDescription; }
    getEmptyStateIcon(): string { return this._emptyStateIcon ?? icons.resolve('tables::empty-state') ?? 'o-x-mark'; }
    async getCustomEmptyState(): Promise<string | null> { return typeof this._emptyState === 'function' ? this._emptyState() : this._emptyState; }
    private _defaultPageOption: number | 'all' | null = null;
    /** Rows per page when the table opens. */
    defaultPaginationPageOption(option: number | 'all' | null): this { this._defaultPageOption = option; return this; }
    getDefaultPageOption(): number | 'all' { return this._defaultPageOption !== null && this._pageOptions.includes(this._defaultPageOption) ? this._defaultPageOption : (this._pageOptions.includes(10) ? 10 : this._pageOptions[0]); }
    private _paginationMode: 'default' | 'simple' = 'default';
    /** `'simple'`: previous / next buttons only, without page numbers or total. */
    paginationMode(mode: 'default' | 'simple'): this { this._paginationMode = mode; return this; }
    getPaginationMode(): 'default' | 'simple' { return this._paginationMode; }
    stackedOnMobile(condition = true): this { this._stackedOnMobile = condition; return this; }
    pluralModelLabel(label: string): this { this._label = label; return this; }

    getColumns(): Column<R>[] { return this._columns.filter((column) => !column.isHidden()); }
    getColumn(name: string): Column<R> | undefined { return this.getColumns().find((c) => c.name === name); }
    getFilters(): TableFilter[] { return this._filters; }
    getDefaultSort(): { column: string; direction: SortDirection } | null { return this._defaultSort; }
    getRecordUrl(record: R): string | null { return this._recordUrl ? this._recordUrl(record) : null; }
    getPageOptions(): (number | 'all')[] { return this._pageOptions; }
    isStackedOnMobile(): boolean { return this._stackedOnMobile; }
    getPluralModelLabel(): string { return this._label; }
    hasToggleableColumns(): boolean { return this.getColumns().some((c) => c.isToggleable()); }

    /** Default column manager state. */
    getDefaultColumnState(): ColumnState[] {
        return this.getColumns().map((c) => ({ type: 'column', name: c.name, label: c.getLabel(), isHidden: false, isToggled: !c.isToggleable() || !c.isToggledHiddenByDefault(), isToggleable: c.isToggleable(), isToggledHiddenByDefault: c.isToggleable() ? c.isToggledHiddenByDefault() : null }));
    }
    getDefaultFilterState(): Record<string, FilterState> { return Object.fromEntries(this._filters.map((f) => [f.name, f.getDefaultState()])); }
}

/** Table state held by the host component. */
export interface TableHost {
    readonly id: string;
    tableSearch: string;
    tableSort: string | null;
    tableColumnSearches: Record<string, string>;
    tableRecordsPerPage: number | 'all';
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
    if (grouping) query.groupSort = { column: grouping.group.getColumn(), direction: grouping.direction, ...(grouping.group.getOrderQueryUsing() ? { modify: grouping.group.getOrderQueryUsing()! } : {}) };
    // The host can restrict the query (active list tab).
    (host as any).modifyTableQuery?.(query);
    for (const modifier of table.getQueryModifiers()) (query.modifiers ??= []).push((q) => { modifier(q); });
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
    return table.getFilters().flatMap((f) => { const s = host.tableFilters?.[f.name]; return s && typeof s === 'object' && f.getIndicators ? f.getIndicators(s).map((indicator) => ({ filter: f.name, ...indicator, removable: indicator.removable !== false, color: indicator.color ?? null })) : []; });
}

/** Whether an applied filter can be removed: none of its indicators is marked `removable(false)`. */
export async function isTableFilterRemovable<R>(table: Table<R>, host: TableHost, filterName: string): Promise<boolean> {
    const filter = table.getFilters().find((candidate) => candidate.name === filterName);
    if (!filter) return false;
    const state = host.tableFilters?.[filter.name];
    if (!state || typeof state !== 'object' || !filter.getIndicators) return true;
    await filter.loadIndicatorData?.(state, host);
    return filter.getIndicators(state).every((indicator) => indicator.removable !== false);
}

/** Markup of a customized filters action: an icon button, a button or a link, with an optional badge. */
function filterActionHtml(view: FiltersActionView, attributes: string, badge: string | null, forceEnabled = false): string {
    const force = forceEnabled ? ['fi-force-enabled'] : [];
    const colors = (component: 'button' | 'link' | 'icon-button') => (view.color && view.color !== 'gray' ? (colorManager?.getComponentClasses(component, view.color) ?? []) : []);
    const iconHtml = view.icon ? icon(view.icon) : '';
    if (view.view === 'icon-button') return `<button title="${e(view.label)}" aria-label="${e(view.label)}" ${attributes} class="${cls(['fi-force-enabled', 'fi-ac-icon-btn-action', 'fi-icon-btn', 'fi-size-md', ...colors('icon-button')])}">${iconHtml}${badge !== null ? `<div class="fi-icon-btn-badge-ctn">${badge}</div>` : ''}</button>`;
    if (view.view === 'link') return `<button ${attributes} class="${cls([...force, 'fi-ac-link-action', 'fi-link', 'fi-size-md', ...colors('link')])}">${iconHtml}<span class="fi-link-label">${e(view.label)}</span>${badge !== null ? `<div class="fi-link-badge-ctn">${badge}</div>` : ''}</button>`;
    return `<button ${attributes} class="${cls([...force, 'fi-ac-btn-action', 'fi-btn', 'fi-size-md', ...colors('button')])}">${iconHtml}${e(view.label)}${badge !== null ? `<div class="fi-btn-badge-ctn">${badge}</div>` : ''}</button>`;
}

/** Keys whose record passes `checkIfRecordIsSelectableUsing()`, loaded in chunks. Without a check, the keys are returned as they are. */
export async function filterSelectableKeys<R>(table: Table<R>, adapter: Pick<DataAdapter<R>, 'find'>, keys: string[], chunkSize = 100): Promise<string[]> {
    if (!table.hasRecordSelectabilityCheck()) return keys;
    const kept: string[] = [];
    for (let index = 0; index < keys.length; index += chunkSize) {
        const chunk = keys.slice(index, index + chunkSize);
        const records = await Promise.all(chunk.map((key) => adapter.find(key)));
        for (let position = 0; position < chunk.length; position++) if (records[position] && (await table.isRecordSelectable(records[position]!))) kept.push(chunk[position]);
    }
    return kept;
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
    // The page size comes from the browser: only a declared option is accepted.
    const requested = host.tableRecordsPerPage === 'all' || (host.tableRecordsPerPage as unknown) === 'all' ? 'all' : Number(host.tableRecordsPerPage);
    const option = options.includes(requested as any) ? requested : options[0];
    if (!table.isPaginated() || option === 'all') return adapter.paginate({ ...getTableQuery(table, host), page: 1, perPage: MAX_UNPAGINATED_RECORDS });
    return adapter.paginate({ ...getTableQuery(table, host), page: Number(host.paginators.page) || 1, perPage: option as number });
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
    /** Already rendered HTML of the toolbar actions. */
    toolbarActions?: string[];
    /** Already rendered HTML of the empty state actions. */
    emptyStateActions?: string[];
    /** Already rendered HTML of the row actions (ActionGroup…), replacing the `rowActions` links. */
    rowActionsHtml?: (record: R) => Promise<string>;
    bulkActions?: string[];
    /** Several bulk action menus (each `BulkActionGroup`); takes precedence over `bulkActions`, which is a single "Bulk actions" menu. */
    bulkActionGroups?: BulkActionMenu[];
    /** HTML of the filters form (`tableFiltersForm` schema), if there are filters. */
    filtersForm?: string | null;
    /**
     * Record checkboxes without bulk actions (`TableSelect`): the selection is entangled with this Livewire property of the
     * host (a key, or a list of keys), and the deselected records of "select all" are not tracked.
     */
    selection?: { property: string; disabled?: boolean } | null;
};

/** Maximum number of rows shown (and reorderable) in reordering mode. */
export const REORDER_LIMIT = 1000;

type SummaryCell = { alignment: string; items: SummaryItem[] };
type SummaryRow = { heading: string; cells: SummaryCell[]; striped: boolean };
/** Placeholder cells of summary rows: selection cell before, actions cell after (like record rows). */
type SummaryPlaceholders = { selection: boolean; actions: boolean; actionsBefore?: boolean };

/** Summary row; with `groupsOnly`, a leading label cell, then one cell per column. */
function summaryRowHtml(row: SummaryRow, span: number, groupsOnly: boolean, placeholders: SummaryPlaceholders): string {
    const items = (cell: SummaryCell) => cell.items.map((item) => {
        const label = item.label !== null && item.label !== '' ? `<span class="fi-ta-${item.type}-summary-label${item.labelHidden ? ' fi-sr-only' : ''}">${e(item.label)}</span>` : '';
        if (item.type === 'icon-count') {
            const iconCounts = item.icons ?? [];
            return `<div class="fi-ta-icon-count-summary">${label}${iconCounts.length ? `<ul>${iconCounts.map((entry) => `<li><span>${e(String(entry.count))}</span>${icon(entry.icon, { size: 'lg', attributes: new Attributes().class(entry.color && entry.color !== 'gray' ? (colorManager?.getComponentClasses('icon-count-summary', entry.color) ?? []) : []) })}</li>`).join('')}</ul>` : ''}</div>`;
        }
        if (item.type === 'values') return `<div class="fi-ta-values-summary">${label}${item.values?.length ? `<ul${item.bulleted ? ' class="fi-bulleted"' : ''}>${item.values.map((value) => `<li>${e(value)}</li>`).join('')}</ul>` : ''}</div>`;
        return `<div class="fi-ta-${item.type}-summary">${label}<span>${e(item.value)}</span></div>`;
    }).join('');
    const heading = groupsOnly
        ? `<th scope="row" class="fi-ta-cell fi-ta-summary-row-heading-cell fi-align-start">${e(row.heading)}</th>`
        : `<th scope="row"${span > 1 ? ` colspan="${span}"` : ''} class="fi-ta-cell fi-align-start fi-ta-summary-row-heading-cell ">${e(row.heading)}</th>`;
    return `<tr class="fi-ta-row fi-ta-summary-row${row.striped ? ' fi-striped' : ''}">${placeholders.selection ? '<td></td>' : ''}${placeholders.actionsBefore ? '<td></td>' : ''}${heading}${row.cells.map((cell) => `<td class="fi-ta-cell fi-align-${e(cell.alignment)} ">${items(cell)}</td>`).join('')}${placeholders.actions ? '<td></td>' : ''}</tr>`;
}

/**
 * Table summaries: a single "Summary" row without pagination; with several pages, a header then "This page" and "All …" rows.
 * Also returns what is needed to compute a group's summary row (query restricted to the group).
 */
async function summarize<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>, visible: Column<R>[], page: { records: R[]; lastPage: number }, options: { group: Group<R> | null; groupsOnly: boolean; placeholders: SummaryPlaceholders }) {
    // Groups only: the grouped column has no summary cell (its label already leads the row).
    const columns = options.groupsOnly && options.group ? visible.filter((c) => c.name !== options.group!.getColumn()) : visible;
    const lists = columns.map((c) => c.getSummarizers().filter((summarizer) => !summarizer.isHidden()));
    if (!lists.some((list) => list.length) || !page.records.length) return null;
    // The first cell holds the row label and spans up to the first summarized column after it.
    const next = lists.findIndex((list, i) => i > 0 && list.length > 0);
    const span = options.groupsOnly ? 0 : next < 0 ? columns.length : next;
    const columnOf = (c: Column<R>) => c.getSortColumn?.() ?? c.name;
    const names = (kind: Summarizer['kind']) => [...new Set(columns.filter((_, i) => lists[i].some((s) => s.kind === kind)).map(columnOf))];
    const aggregateColumns = () => ({ sum: names('sum'), avg: names('avg'), min: names('range'), max: names('range') });
    const aggregate = (query: Omit<ListQuery, 'page' | 'perPage'>): Promise<SummaryValues> => adapter.aggregate(query, aggregateColumns());
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
    // `using()` summarizers get the records of the summarized dataset, loaded once per row.
    const loader = (dataset: Omit<ListQuery, 'page' | 'perPage'> | R[]) => { let cache: Promise<R[]> | null = null; return () => (cache ??= Array.isArray(dataset) ? Promise.resolve(dataset) : adapter.paginate({ ...dataset, page: 1, perPage: MAX_UNPAGINATED_RECORDS }).then((result) => result.records)); };
    // The displayed page as a query (its record keys), for summarizers scoped with `query()`.
    const pageQuery = { ...query, keys: page.records.map((record) => adapter.getKey(record)) };
    /**
     * Occurrences of each icon (by color, then icon) of an icon column: from one grouped count query when the state is the
     * column's attribute, otherwise from the records.
     */
    const iconCounts = async (c: Column<R>, dataset: Omit<ListQuery, 'page' | 'perPage'> | R[], records: () => Promise<R[]>): Promise<IconCount[]> => {
        if (!(c instanceof IconColumn)) throw new Error(`The [${c.name}] column must be an IconColumn to show an icon count summary.`);
        let entries: { record: R; count: number }[];
        if (!Array.isArray(dataset) && adapter.aggregateGroups && c.hasAttributeState()) {
            entries = (await adapter.aggregateGroups(dataset, {}, (query) => { query.groupBy(c.name); })).map((row) => ({ record: { [c.name]: row.key } as R, count: row.count }));
        } else entries = (await records()).map((record) => ({ record, count: 1 }));
        const byColor = new Map<string, Map<string, number>>();
        for (const { record, count } of entries) {
            const state = await c.getState(record);
            if (isBlankState(state)) continue;
            for (const item of Array.isArray(state) ? state : [state]) {
                const { icon: name, color } = c.getIconAndColor(record, item);
                if (!name) continue;
                const icons = byColor.get(JSON.stringify(color)) ?? new Map<string, number>();
                icons.set(name, (icons.get(name) ?? 0) + count);
                byColor.set(JSON.stringify(color), icons);
            }
        }
        return [...byColor].flatMap(([color, icons]) => [...icons].map(([name, count]) => ({ icon: name, color: JSON.parse(color) as string | null, count })));
    };
    const cells = async (values: SummaryValues, dataset: Omit<ListQuery, 'page' | 'perPage'> | R[]): Promise<SummaryCell[]> => {
        const records = loader(dataset);
        const datasetQuery = Array.isArray(dataset) ? pageQuery : dataset;
        return Promise.all(columns.slice(span).map(async (c, i) => ({
            alignment: c.getAlignment() ?? 'start',
            items: (await Promise.all(lists[i + span].map(async (s) => {
                const scope = s.getQueryScope();
                const icons = s instanceof Count && s.hasIcons();
                if (!scope) return s.summarize(columnOf(c), values, icons ? await iconCounts(c, dataset, records) : s.hasCustomCalculation() ? await s.compute({ column: c.name, records }) : undefined);
                // Scoped summarizer: its own aggregates and records, on the dataset restricted by its query.
                const scoped = { ...datasetQuery, modifiers: [...(datasetQuery.modifiers ?? []), (q: any) => { scope(q); }] };
                return s.summarize(columnOf(c), await aggregate(scoped), icons ? await iconCounts(c, scoped, loader(scoped)) : s.hasCustomCalculation() ? await s.compute({ column: c.name, records: loader(scoped) }) : undefined);
            }))).filter((item): item is SummaryItem => item !== null),
        })));
    };
    const label = table.getPluralModelLabel();
    const showPage = table.hasPageSummary(), showAll = table.hasAllTableSummary();
    const isMultiPage = !options.groupsOnly && page.lastPage > 1;
    // Several pages: "this page" and "all" rows under a heading row; a single page: one "Summary" row.
    const hasPageSummary = isMultiPage && (showPage || showAll);
    const rowHtml = (row: SummaryRow) => summaryRowHtml(row, span, options.groupsOnly, options.placeholders);
    const header = hasPageSummary
        ? `<tr class="fi-ta-row fi-ta-summary-header-row fi-striped">${options.placeholders.selection ? '<td></td>' : ''}${options.placeholders.actionsBefore ? '<td></td>' : ''}${columns.map((c, i) => {
            const heading = i === 0 ? t('filament-tables::table.summary.heading', { label }) : lists[i].length ? c.getLabel() : null;
            return heading === null ? '<td class="fi-ta-cell fi-ta-summary-header-cell"></td>' : `<th scope="col" class="fi-ta-cell fi-ta-summary-header-cell fi-align-${e(i === 0 ? 'start' : (c.getAlignment() ?? 'start'))}">${e(heading)}</th>`;
        }).join('')}${options.placeholders.actions ? '<td></td>' : ''}</tr>`
        : '';
    const rows = hasPageSummary
        ? [
            ...(showPage ? [{ heading: t('filament-tables::table.summary.subheadings.page', { label }), cells: await cells(onPage, page.records), striped: false }] : []),
            ...(showAll ? [{ heading: t('filament-tables::table.summary.subheadings.all', { label }), cells: await cells(all, query), striped: false }] : []),
        ]
        : isMultiPage || !(showPage || showAll) ? [] : [{ heading: t('filament-tables::table.summary.heading', { label }), cells: await cells(all, query), striped: true }];
    const groupedValues = new Map<Group<R>, Promise<Map<string, SummaryValues>>>();
    return {
        html: header + rows.map(rowHtml).join(''),
        /** Group summary row: aggregates over all the group's records (not only those on the page). */
        group: async (group: Group<R>, key: string | null, title: string | null): Promise<string> => {
            const groupQuery = { ...query, modifiers: [...(query.modifiers ?? []), (q: any) => group.scope(q, key)] };
            // Aggregates of every group in one grouped query (`groupQueryUsing()`); a group it does not return is aggregated alone.
            const groupQueryCallback = group.getGroupQuery();
            if (groupQueryCallback && adapter.aggregateGroups && !groupedValues.has(group)) {
                groupedValues.set(group, adapter.aggregateGroups(query, aggregateColumns(), groupQueryCallback).then((rows) => {
                    const map = new Map<string, SummaryValues>();
                    for (const { key: value, ...values } of rows) { const groupKey = group.getKeyFromGroupValue(value); if (groupKey !== null && !map.has(groupKey)) map.set(groupKey, values); }
                    return map;
                }));
            }
            const values = (key !== null ? (await groupedValues.get(group))?.get(key) : undefined) ?? await aggregate(groupQuery);
            return rowHtml({ heading: options.groupsOnly ? (title ?? '') : t('filament-tables::table.summary.subheadings.group', { group: title ?? '', label }), cells: await cells(values, groupQuery), striped: false });
        },
    };
}

/** Maximum records read for a `groupsOnly` table (which is not paginated). */
export const GROUPS_ONLY_LIMIT = 1000;

export async function renderTable<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>, options: RenderTableOptions<R> = {}): Promise<string> {
    const reorderColumn = options.canReorder === false ? null : table.getReorderColumn();
    const reordering = reorderColumn !== null && host.isTableReordering === true;
    // Reordering: all rows of the query, in position order, without pagination or actions.
    if (reordering) options = { ...options, bulkActions: [], bulkActionGroups: [], headerActions: options.headerActions, rowActions: undefined, rowActionsHtml: undefined, filtersForm: null };
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
    const selectionOnly = !reordering && !!options.selection;
    // Bulk action menus: those given, or one "Bulk actions" menu with `bulkActions`; menus without a visible action are left out.
    const bulkMenus = (options.bulkActionGroups ?? ((options.bulkActions ?? []).length ? [BulkActionGroup.make([]).toMenu(options.bulkActions!)] : [])).filter((menu) => menu.actions.length > 0);
    const bulkActionsHtml = bulkMenus.flatMap((menu) => menu.actions);
    const hasBulk = bulkActionsHtml.length > 0 || selectionOnly;
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
        if (!groupsOnly) for (const column of visible) cells.push({ name: column.name, cssName: column.getCssName(), alignment: column.getAlignment(), responsive: column.getResponsiveClasses(), label: column.getLabel(), url: column.getUrl(record), html: await column.toHtml(record, key), plain: column.isClickDisabled(), mountExpression: !reordering && column.getActionName() !== null && !column.isClickDisabled() ? `mountAction(${js(column.getActionName())}, {}, ${js({ table: true, recordKey: key })})` : null });
        const recordAction = table.getRecordAction();
        if (reordering) for (const cell of cells) cell.url = null;
        let contentHtml: string | null = null;
        if (columnsLayout && !groupsOnly) { contentHtml = ''; for (const node of columnsLayout) contentHtml += await renderColumnLayout(node, record, key, visibleSet); }
        const collapsibleLayout = columnsLayout && !groupsOnly && !reordering ? table.getCollapsibleColumnsLayout() : null;
        const collapsibleHtml = collapsibleLayout && !collapsibleLayout.isHidden() ? await renderColumnLayout(collapsibleLayout, record, key, visibleSet) : null;
        rows.push({
            selectable: selectable && !reordering ? await table.isRecordSelectable(record) : true,
            contentHtml, collapsibleHtml, collapsed: collapsibleLayout?.isCollapsed() ?? false, summaryBefore, groupSummaryHtml: '',
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
    const actionsBefore = table.getRecordActionsPosition().startsWith('before');
    // Summaries: never while reordering; group summaries go before the next group's header.
    const summary = reordering ? null : await summarize(table, host, adapter, visible, page, { group: grouping?.group ?? null, groupsOnly, placeholders: { selection: selectable, actions: hasRowActions && !actionsBefore, actionsBefore: hasRowActions && actionsBefore } });
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
        contentLayout: columnsLayout !== null, contentGrid: table.getContentGrid(),
        hook: (name: string, data: Record<string, unknown> = {}) => renderHook(name, scopes, data), hasHook: (name: string) => hasRenderHook(name, scopes),
        visibleColumns: visible, isReordering: reordering,
        groups: reordering || table.areGroupingSettingsHidden() ? [] : table.getGroups().map((g) => ({ id: g.getId(), label: g.getLabel() })),
        grouping: { active: grouping !== null, trigger: table.getGroupRecordsTriggerActionView(), directionHidden: table.isGroupingDirectionSettingHidden(), inDropdownOnDesktop: table.areGroupingSettingsInDropdownOnDesktop(), collapsedByDefault: table.areGroupsCollapsedByDefault(), groupsOnly },
        id: host.id, targets: LOADING_TARGETS, table, rows, page, number,
        reorder: reorderColumn !== null ? { active: reordering } : null,
        // No checkboxes without bulk actions (or in groups-only mode), no actions column without row actions.
        toolbarActions: reordering ? [] : (options.toolbarActions ?? []),
        selectable, hasRowActions, actionsPosition: table.getRecordActionsPosition(), actionsAlignment: table.getRecordActionsAlignment() ?? (actionsBefore ? 'start' : null),
        // The key changes on every render to force the checkbox to be replaced.
        randomKey: () => Array.from(randomBytes(16), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join(''),
        // "Select all" covers every record of the current query.
        allCount: table.getPaginationMode() === 'simple' ? '' : table.selectsCurrentPageOnly() ? page.records.length : table.hasRecordSelectabilityCheck() && selectable ? (await filterSelectableKeys(table, adapter, await adapter.listKeys(getTableQuery(table, host)))).length : page.total,
        selection: selectionOnly ? { property: options.selection!.property, disabled: options.selection!.disabled === true } : null,
        maxSelectableRecords: table.getMaxSelectableRecords(), selectsCurrentPageOnly: table.selectsCurrentPageOnly(), resultsCount: table.getPaginationMode() === 'simple' ? rows.length : page.total,
        columns: visible.map((c) => ({ name: c.name, grouped: c._group !== null, cssName: c.getCssName(), alignment: c.getAlignment(), responsive: c.getResponsiveClasses(), width: c.getWidth(), growable: c.getWidth() === null && c.canGrow(), wrapHeader: c.canHeaderWrap(), label: c.getLabel(), sortable: !reordering && c.isSortable(), individuallySearchable: !reordering && c.isIndividuallySearchable(), sort: sortColumn === c.name ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none' })),
        linkClasses: classes('link', 'primary'), dangerLinkClasses: classes('link', 'danger'), primaryButtonClasses: classes('button', 'primary'), badgeClasses: classes('badge', 'primary'), indicatorBadgeClasses: classes('badge', 'primary'), grayButtonClasses: classes('button', 'gray'), indicatorColorClasses: (color: string) => classes('badge', color),
        bulkActions: bulkActionsHtml, bulkMenus, bulkMenuColors: (component: 'button' | 'icon-button', color: string) => (color === 'gray' ? [] : (colorManager?.getComponentClasses(component, color) ?? [])),
        filtersForm: options.filtersForm ?? null, activeFiltersCount: countActiveFilters(table, host), filtersLayout: table.getFiltersLayout(), filterIndicators: table.areFilterIndicatorsHidden() ? [] : getFilterIndicators(table, host),
        filterActions: { trigger: table.getFiltersActionView('trigger'), apply: table.getFiltersActionView('apply'), reset: table.getFiltersActionView('reset') },
        filterActionHtml: (view: FiltersActionView, attributes: string, badge: string | null = null, forceEnabled = false) => filterActionHtml(view, attributes, badge, forceEnabled),
        filtersDeferred: table.hasDeferredFilters(), filtersResetPosition: table.getFiltersResetActionPosition(), filtersFormWidth: table.getFiltersFormWidth(), filtersFormMaxHeight: table.getFiltersFormMaxHeight(), modal,
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
        emptyState: { custom: await table.getCustomEmptyState(), heading: table.getEmptyStateHeading(), description: table.getEmptyStateDescription(), icon: table.getEmptyStateIcon(), actions: options.emptyStateActions ?? [] },
        pagination: reordering || groupsOnly || !table.isPaginated() ? '' : views.render('filament::components.pagination', {
            id: host.id, targets: LOADING_TARGETS + ',paginators', page, number, pageOptions: table.getPageOptions(), elements: paginationElements(page.page, page.lastPage), simple: table.getPaginationMode() === 'simple',
            attrs: (o: Record<string, any>) => new Attributes(o),
        }),
    });
}
