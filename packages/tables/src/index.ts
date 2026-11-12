// @navette-js/tables — port de filament/tables : Table, TextColumn, filtres, état (recherche, tri, pagination, colonnes) et rendu.
import type { DataAdapter, ListQuery, Page as RecordPage, SortDirection } from '@navette-js/database';
import { Attributes, cls, e, hasRenderHook, icon, js, renderHook, views, type ColorManager, configured, configureUsing } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

views.namespace('filament-tables', fileURLToPath(new URL('../views', import.meta.url)));
export * from './query-builder.ts';

/** Emplacements de render hook d'une table — mêmes noms que `Filament\Tables\View\TablesRenderHook`. */
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
    /** Anciens noms, conservés par Filament. */
    TOOLBAR_TOGGLE_COLUMN_TRIGGER_AFTER: 'tables::toolbar.toggle-column-trigger.after',
    TOOLBAR_TOGGLE_COLUMN_TRIGGER_BEFORE: 'tables::toolbar.toggle-column-trigger.before',
} as const;

/** Cibles de chargement de la table (`wire:target`), dans l'ordre émis par Filament. */
export const LOADING_TARGETS = 'activeTab,applyTableFilters,gotoPage,nextPage,previousPage,removeTableFilter,removeTableFilters,reorderTable,resetTableColumnSearch,resetTableFiltersForm,resetTableSearch,setPage,sortTable,tableColumnSearches,tableFilters,tableGrouping,tableRecordsPerPage,tableSearch,tableSort,toggleTableReordering';

const headline = (s: string) => s.replace(/[_.-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
type StateResolver<R> = (ctx: { record: R }) => unknown | Promise<unknown>;

// ------------------------------------------------------------------ colonnes
/** Base commune des colonnes (port partiel de Filament\Tables\Columns\Column). */
export abstract class Column<R = any> {
    /** Réglage par défaut de toutes les instances créées ensuite par `make()` : `TextInput.configureUsing((input) => input.maxLength(255))`. */
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
    /** Libellé du groupe de colonnes auquel la colonne appartient (posé par ColumnGroup). */
    _group: string | null = null;

    constructor(name: string) { this.name = name; }
    label(label: string): this { this._label = label; return this; }
    /** `column` : colonne (ou alias de la requête) utilisée pour trier quand elle diffère du nom, par exemple pour une relation. */
    sortable(condition: boolean | { column: string; inverted?: boolean } = true): this { this._sortable = condition !== false; this._sortColumn = typeof condition === 'object' ? condition.column : null; this._sortInverted = typeof condition === 'object' && condition.inverted === true; return this; }
    getSortColumn(): string { return this._sortColumn ?? this.name; }
    private _sortInverted = false;
    /** Vrai quand la colonne de tri évolue en sens inverse de la valeur affichée (`inverted` : un âge trié par sa date). */
    isSortInverted(): boolean { return this._sortInverted; }
    /** Lien posé sur la cellule ; il prend le pas sur l'action de ligne. */
    url(resolver: (record: R) => string | null): this { this._url = resolver; return this; }
    getUrl(record: R): string | null { return this._url ? this._url(record) : null; }
    /** `isGlobal: false` exclut la colonne de la recherche globale ; `isIndividual` ajoute un champ de recherche propre à la colonne. */
    getSearchColumn(): string { return this._searchColumn ?? this.name; }
    searchable(options: boolean | { isIndividual?: boolean; isGlobal?: boolean; column?: string } = true): this {
        this._searchColumn = typeof options === 'object' ? (options.column ?? null) : null;
        this._searchable = typeof options === 'boolean' ? options : options.isGlobal !== false;
        this._individuallySearchable = typeof options === 'object' && options.isIndividual === true;
        return this;
    }
    /** Colonne que l'utilisateur peut masquer depuis le gestionnaire de colonnes. */
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
    /** Suffixe des classes `fi-ta-header-cell-…` / `fi-ta-cell-…` : les tirets bas deviennent des tirets, les points sont conservés (comme Filament). */
    getCssName(): string { return this.name.replace(/_/g, '-'); }
    async getState(record: R): Promise<unknown> { return this._state ? this._state({ record }) : (record as any)[this.name]; }
    /** Vrai pour une cellule modifiable : elle n'est enveloppée ni d'un lien ni d'un bouton vers l'enregistrement. */
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
    /** Affiche la valeur dans une pastille. */
    badge(condition = true): this { this._badge = condition; return this; }
    color(color: string | ((record: R) => string)): this { this._color = color; return this; }
    icon(resolver: (record: R) => string | null): this { this._icon = resolver; return this; }
    /** Texte affiché à la place de la valeur brute (libellé d'une énumération, par exemple). */
    formatStateUsing(formatter: (ctx: { state: unknown; record: R }) => string): this { this._format = formatter; return this; }
    /** Date courte, comme `->date()` de Filament (« Nov 9, 2026 »). */
    date(condition = true): this { this._date = condition; return this; }
    private _dateTime = false;
    /** Date et heure, « M j, Y H:i:s » (format par défaut de Filament). */
    dateTime(condition = true): this { this._dateTime = condition; this._date = condition; return this; }
    /** Nombre formaté avec séparateurs de milliers (`->numeric()`). */
    private _decimals: number | null = null;
    /** `numeric(1)` : nombre de décimales fixe. */
    numeric(condition: boolean | number = true): this { this._numeric = condition !== false; this._decimals = typeof condition === 'number' ? condition : null; return this; }
    /** Ligne de totaux sous la table. */
    summarize(summarizer: Summarizer | Summarizer[]): this { this._summarizers = Array.isArray(summarizer) ? summarizer : [summarizer]; return this; }
    getSummarizers(): Summarizer[] { return this._summarizers; }
    weight(weight: string): this { this._weight = weight; return this; }
    /** Tronque le texte affiché à `length` caractères, suivi de « ... » (port de `limit()`, Str::limit). */
    limit(length: number | null): this { this._limit = length; return this; }
    /** Infobulle au survol du texte ; `null` pour ne pas en afficher. */
    tooltip(tooltip: ((record: R) => string | null) | string | null): this { this._tooltip = tooltip; return this; }
    copyable(condition = true): this { this._copyable = condition; return this; }
    /** Montant formaté dans la devise donnée (`money('usd')`). */
    money(currency: string | ((record: R) => string) = 'usd'): this { this._money = currency; return this; }
    /** Texte affiché quand la valeur est vide. */
    placeholder(text: string | null): this { this._placeholder = text; return this; }

    /** Contenu de cellule. Filament a deux balisages : un chemin court pour le texte simple, un chemin complet dès qu'une option est posée. */
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        if ((state === null || state === undefined || state === '') && this._placeholder !== null) return `<div class="fi-ta-text"><p class="fi-ta-placeholder">${e(this._placeholder)}</p></div>`;
        // Valeur vide sans texte de remplacement : Filament rend un conteneur nu.
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
                // Comme Filament : sans icône, la cellule passe par le chemin court, qui écrit les classes dans l'autre ordre.
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
        // Hors pastille : une icône précède le texte (chemin complet), une couleur teinte le texte.
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

/** Valeurs dont un summarizer tire son résultat : agrégats de la requête (tous les enregistrements) ou de la page affichée. */
export type SummaryValues = { count: number; sum: Record<string, number>; avg: Record<string, number>; min: Record<string, unknown>; max: Record<string, unknown> };
export type SummaryItem = { type: 'text' | 'range'; label: string | null; value: string };

/** Résumé d'une colonne sous la table (port de Summarizers\Summarizer) : somme, moyenne, nombre ou étendue. */
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
/** Total d'une colonne (port du summarizer Sum). */
export class Sum extends Summarizer {
    readonly kind = 'sum';
    static make(): Sum { return configured(new Sum()); }
    getLabel(): string { return this._label ?? t('filament-tables::table.summary.summarizers.sum.label'); }
    summarize(column: string, values: SummaryValues): SummaryItem { return { type: 'text', label: this.getLabel(), value: this.format(values.sum[column] ?? 0) }; }
}
/** Moyenne d'une colonne (port du summarizer Average). */
export class Average extends Summarizer {
    readonly kind = 'avg';
    static make(): Average { return configured(new Average()); }
    getLabel(): string { return this._label ?? t('filament-tables::table.summary.summarizers.average.label'); }
    summarize(column: string, values: SummaryValues): SummaryItem { return { type: 'text', label: this.getLabel(), value: this.format(values.avg[column] ?? 0) }; }
}
/** Nombre d'enregistrements (port du summarizer Count). */
export class Count extends Summarizer {
    readonly kind = 'count';
    static make(): Count { return configured(new Count()); }
    getLabel(): string { return this._label ?? t('filament-tables::table.summary.summarizers.count.label'); }
    summarize(_column: string, values: SummaryValues): SummaryItem { return { type: 'text', label: this.getLabel(), value: this.format(values.count) }; }
}
/** Plus petite et plus grande valeur d'une colonne (port du summarizer Range). */
export class Range extends Summarizer {
    readonly kind = 'range';
    private _minimalDateTime = false;
    static make(): Range { return configured(new Range()); }
    /** Dates : le jour seul quand les deux bornes diffèrent de jour, le jour et l'heure sinon ; une seule valeur si elles sont identiques. */
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

/** Regroupement des lignes d'une table (port de Grouping\Group) : les lignes sont triées par la colonne, un en-tête précède chaque groupe. */
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
    /** Colonne de la requête qui porte la valeur du groupe, quand elle diffère de l'identifiant (relation). */
    column(column: string | null): this { this._column = column; return this; }
    /** Titre du groupe tiré de l'enregistrement (libellé d'une énumération, par exemple). */
    getTitleUsing(resolver: ((record: R) => string | null) | null): this { this._title = resolver; return this; }
    getDescriptionUsing(resolver: ((record: R) => string | null) | null): this { this._description = resolver; return this; }
    /** Noms de Filament (`getTitleFromRecordUsing`, `getDescriptionFromRecordUsing`). */
    getTitleFromRecordUsing(resolver: ((record: R) => string | null) | null): this { return this.getTitleUsing(resolver); }
    getDescriptionFromRecordUsing(resolver: ((record: R) => string | null) | null): this { return this.getDescriptionUsing(resolver); }
    /** Les groupes se replient d'un clic sur leur en-tête. */
    collapsible(condition = true): this { this._collapsible = condition; return this; }
    /** La colonne est une date : les lignes d'un même jour forment un groupe. */
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
    /** Valeur du groupe pour un enregistrement, en texte ; `null` quand elle est vide. */
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
    /** Restreint une requête aux enregistrements du groupe de clé donnée. */
    scope(query: any, key: string | null): void {
        if (key === null) query.where((sub: any) => sub.whereNull(this.getColumn()).orWhere(this.getColumn(), ''));
        else if (this._date) query.whereRaw('date(??) = ?', [this.getColumn(), key]);
        else query.where(this.getColumn(), key);
    }
}

/**
 * Mise en page des colonnes (port de Tables\Columns\Layout) : dès qu'une table en contient une, ses enregistrements sont
 * rendus en cartes (`fi-ta-content`) et non plus en lignes de tableau ; le tri passe par un sélecteur « Sort by ».
 */
export abstract class ColumnLayout<R = any> {
    protected _children: (Column<R> | ColumnLayout<R>)[];
    constructor(children: (Column<R> | ColumnLayout<R>)[]) { this._children = children; }
    getChildren(): (Column<R> | ColumnLayout<R>)[] { return this._children; }
    /** Colonnes feuilles, dans l'ordre : ce sont elles que la table trie, cherche et masque. */
    getColumns(): Column<R>[] { return this._children.flatMap((child) => (child instanceof ColumnLayout ? child.getColumns() : [child])); }
    abstract getClasses(): string[];
}
/** Colonnes côte à côte, à partir d'un point de rupture (port de Layout\Split). */
export class Split<R = any> extends ColumnLayout<R> {
    private _from: string | null = null;
    static make<R = any>(children: (Column<R> | ColumnLayout<R>)[]): Split<R> { return new Split<R>(children); }
    from(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | null): this { this._from = breakpoint; return this; }
    getClasses(): string[] { return ['fi-ta-split', ...(this._from ? [`${this._from}:fi-ta-split`] : [])]; }
}
/** Colonnes l'une sous l'autre (port de Layout\Stack). */
export class Stack<R = any> extends ColumnLayout<R> {
    private _space: number | null = null;
    private _alignment = 'start';
    static make<R = any>(children: (Column<R> | ColumnLayout<R>)[]): Stack<R> { return new Stack<R>(children); }
    /** Espace entre les colonnes : 1 (petit), 2 (moyen) ou 3 (grand). */
    space(space: 1 | 2 | 3 | null = 1): this { this._space = space; return this; }
    alignment(alignment: 'start' | 'center' | 'end'): this { this._alignment = alignment; return this; }
    getClasses(): string[] { return ['fi-ta-stack', `fi-align-${this._alignment}`, ...(this._space ? [`fi-gap-${['sm', 'md', 'lg'][this._space - 1]}`] : [])]; }
}
const layoutCell = (classes: string[], html: string) => `<div class="${['fi-grid-col', 'fi-growable', ...classes].join(' ')}" style="--col-span-default: span 1 / span 1;">${html}</div>`;
/** Rendu d'un enregistrement selon la mise en page : les colonnes masquées par l'utilisateur sont sautées. */
async function renderColumnLayout<R>(node: Column<R> | ColumnLayout<R>, record: R, key: string, visible: Set<Column<R>>): Promise<string> {
    if (node instanceof ColumnLayout) {
        const children = [];
        for (const child of node.getChildren()) children.push(await renderColumnLayout(child, record, key, visible));
        return layoutCell([], `<div class="${node.getClasses().join(' ')}">${children.join('')}</div>`);
    }
    if (!visible.has(node)) return '';
    const alignment = node.getAlignment();
    // Dans une mise en page, le texte est « en ligne » et porte lui-même l'alignement (comme Filament).
    const html = (await node.toHtml(record, key)).replace(/class="([^"]*\bfi-ta-text\b[^"]*)"/, (_match, classes: string) => `class="${classes.replace(/ fi-align-\w+/g, '')} fi-inline${alignment ? ` fi-align-${alignment}` : ''}"`);
    return layoutCell(['fi-ta-col', ...(alignment ? [`fi-align-${alignment}`] : [])], html);
}

/** Groupe de colonnes : un intitulé commun au-dessus des en-têtes (port de ColumnGroup). */
export class ColumnGroup<R = any> {
    private label: string;
    private _columns: Column<R>[] = [];
    constructor(label: string) { this.label = label; }
    static make<R = any>(label: string): ColumnGroup<R> { return configured(new ColumnGroup<R>(label)); }
    columns(columns: Column<R>[]): this { this._columns = columns; for (const c of columns) c._group = this.label; return this; }
    getColumns(): Column<R>[] { return this._columns; }
}

/** Pastille de couleur (port de ColorColumn). */
export class ColorColumn<R = any> extends Column<R> {
    static make<R = any>(name: string): ColorColumn<R> { return configured(new ColorColumn<R>(name)); }
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        // Seules les couleurs hexadécimales ou fonctionnelles simples sont injectées dans le style.
        const color = typeof state === 'string' && /^(#[0-9a-fA-F]{3,8}|(rgb|hsl|oklch)a?\([0-9.,%\s/deg-]+\))$/.test(state.trim()) ? state.trim() : null;
        return `<div class="fi-ta-color">${color ? `<div aria-label="${e(color)}" role="img" class="fi-ta-color-item" style="background-color: ${color};"></div>` : ''}</div>`;
    }
}

/** Image (port partiel de ImageColumn) : l'état est l'adresse de l'image. Seules les adresses locales ou http(s) sont rendues. */
export class ImageColumn<R = any> extends Column<R> {
    private _alt: ((record: R) => string | null) | null = null;
    private _height = '2.5rem';
    private _circular = false;
    static make<R = any>(name: string): ImageColumn<R> { return configured(new ImageColumn<R>(name)); }
    alt(resolver: (record: R) => string | null): this { this._alt = resolver; return this; }
    /** Hauteur CSS de l'image (`2.5rem` par défaut, comme Filament). */
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

/** Icône selon la valeur ; `boolean()` affiche une coche verte ou une croix rouge (port partiel de IconColumn). */
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

/** Règle de validation d'une colonne modifiable écrite par l'application : test synchrone et message (`:attribute` déjà remplacé). */
export type ColumnValidationRule = { name: string; passes: (value: unknown) => boolean; message: (attribute: string) => string };
type StateHook<R> = (ctx: { state: unknown; record: R }) => unknown | Promise<unknown>;

const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
const isNumeric = (value: unknown) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
/** Règles Laravel reconnues par `rules([...])`, avec leurs messages anglais. Une règle inconnue est refusée à la déclaration plutôt qu'ignorée. */
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
 * Base des colonnes modifiables dans la cellule (port des traits CanBeValidated et CanUpdateState de Filament). Le navigateur appelle
 * `updateTableColumnState(colonne, clé, valeur)` sur le composant hôte : la colonne doit être déclarée, visible et active pour cet
 * enregistrement, la valeur passer les règles ; ensuite seulement viennent `beforeStateUpdated`, l'écriture et `afterStateUpdated`.
 * Comme dans Filament, l'écriture ne consulte pas les droits du modèle : `disabled()` reste le moyen de restreindre la modification.
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
    /** Une cellule modifiable n'est ni un lien ni un bouton vers l'enregistrement. */
    isClickDisabled(): boolean { return true; }
    isEditable(): boolean { return true; }
    /** Règles appliquées à la valeur reçue : chaînes Laravel (`required`, `max:255`, `in:a,b`…) ou règles `{ name, passes, message }`. */
    rules(rules: (string | ColumnValidationRule)[]): this {
        for (const rule of rules) if (typeof rule === 'string' && rule !== 'required' && rule !== 'nullable' && !STRING_RULES[rule.split(':')[0]]) throw new Error(`Règle de validation non prise en charge par les colonnes : ${rule}`);
        this._rules = [...rules];
        return this;
    }
    getRules(): (string | ColumnValidationRule)[] { return this._rules; }
    /** Équivalent de l'ajout de `required` aux règles. */
    required(condition = true): this { this._rules = [...this._rules.filter((rule) => rule !== 'required'), ...(condition ? ['required'] : [])]; return this; }
    isRequired(): boolean { return this._rules.includes('required'); }
    /** Nom de la colonne dans les messages (par défaut, le libellé avec une minuscule initiale). */
    validationAttribute(label: string | null): this { this._validationAttribute = label; return this; }
    /** Messages remplaçant ceux de Laravel, par nom de règle : `{ max: 'Trop long.' }`. */
    validationMessages(messages: Record<string, string>): this { this._validationMessages = { ...messages }; return this; }
    getValidationAttribute(): string { return this._validationAttribute ?? this.getLabel().replace(/^./, (c) => c.toLowerCase()); }
    /** Règles propres au type de colonne (options d'une liste, par exemple), vérifiées après celles de l'application. */
    protected getImplicitRules(): ColumnValidationRule[] { return []; }
    /**
     * Message d'erreur, ou `null` si la valeur est acceptable. Comme le validateur de Laravel : une valeur vide ne passe que `required`,
     * et plusieurs erreurs donnent le premier message suivi de « (and N more errors) ».
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
            // Règles du type de colonne d'abord : une valeur de mauvaise forme (liste, objet forgé) s'arrête là.
            const implicit = this.getImplicitRules().find((rule) => !rule.passes(input));
            if (implicit) return this._validationMessages[implicit.name] ?? implicit.message(attribute);
            // Les règles Laravel portées ne valent que pour un scalaire : une liste ou un objet les fait échouer.
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
    /** Écriture personnalisée, à la place de la mise à jour de la colonne de l'enregistrement. Sa valeur de retour est renvoyée au navigateur. */
    updateStateUsing(callback: StateHook<R> | null): this { this._updateStateUsing = callback; return this; }
    beforeStateUpdated(callback: StateHook<R> | null): this { this._beforeStateUpdated = callback; return this; }
    afterStateUpdated(callback: StateHook<R> | null): this { this._afterStateUpdated = callback; return this; }
    /** Infobulle au survol du contrôle, tant qu'aucune erreur n'est affichée. */
    tooltip(tooltip: ((record: R) => string | null) | string | null): this { this._tooltip = tooltip; return this; }
    getUpdateStateMessages(): Record<'saving' | 'saved' | 'failure', string> {
        return { saving: t('filament-tables::table.columns.editable.saving'), saved: t('filament-tables::table.columns.editable.saved'), failure: t('filament-tables::table.columns.editable.failure') };
    }
    /** Valeur écrite à partir d'une valeur validée : une valeur vide devient `null` (comme `blank()` dans Filament). */
    castState(input: unknown): unknown { return isBlank(input) ? null : input; }
    /**
     * Enregistre une valeur déjà validée (port de `updateState`). Seul le nom déclaré de la colonne est écrit : une colonne de relation
     * (`auteur.nom`) n'est modifiable qu'avec `updateStateUsing()`.
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
    /** Expression `x-tooltip` des contrôles modifiables : l'infobulle de la colonne, remplacée par l'erreur de validation quand il y en a une. */
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
    /** Ouverture commune des cellules modifiables : composant Alpine chargé à la demande, état serveur et clé de l'enregistrement. */
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
 * Liste déroulante modifiable dans la cellule (port de SelectColumn, liste native seulement). La valeur reçue doit être l'une des
 * options déclarées.
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

/** Valeur booléenne reçue du navigateur (déjà passée par la règle `boolean`) : `true`, `false` ou `null`. */
const toBoolean = (value: unknown): boolean | null => (isBlank(value) ? null : value === true || value === 1 || value === '1');
const ALIGNMENTS = ['start', 'center', 'end', 'left', 'right', 'justify', 'between'];
const alignmentClass = (alignment: string | null) => (alignment && ALIGNMENTS.includes(alignment) ? `fi-align-${alignment}` : null);

/** Interrupteur modifiable dans la cellule (port de ToggleColumn). La valeur reçue doit être un booléen (règle `boolean` par défaut). */
export class ToggleColumn<R = any> extends EditableColumn<R> {
    private _onColor: string | null = null;
    private _offColor: string | null = null;
    private _onIcon: string | null = null;
    private _offIcon: string | null = null;
    constructor(name: string) { super(name); this._rules = ['boolean']; }
    static make<R = any>(name: string): ToggleColumn<R> { return configured(new ToggleColumn<R>(name)); }
    /** Couleur de l'interrupteur allumé (`primary` par défaut) et éteint (`gray`). */
    onColor(color: string | null): this { this._onColor = color; return this; }
    offColor(color: string | null): this { this._offColor = color; return this; }
    /** Icônes affichées dans le bouton de l'interrupteur. */
    onIcon(icon: string | null): this { this._onIcon = icon; return this; }
    offIcon(icon: string | null): this { this._offIcon = icon; return this; }
    castState(input: unknown): unknown { return toBoolean(input); }
    async toHtml(record: R, recordKey: string | number = ''): Promise<string> {
        const state = Boolean(await this.getState(record));
        const isDisabled = await this.isDisabledFor(record);
        // Le gris est la couleur par défaut de l'interrupteur : il ne pose aucune classe (HasDefaultGrayColor).
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
        // Interrupteur allumé : masqué (x-cloak) jusqu'au démarrage d'Alpine, remplacé en attendant par une copie statique, comme dans Filament.
        return `<div wire:ignore.self ${outer.toHtml()}><input type="hidden" value="${state ? 1 : 0}" x-ref="serverState" /><div aria-checked="${state ? 'true' : 'false'}" x-bind:aria-checked="state ? 'true' : 'false'" x-bind:tabindex="$el.hasAttribute('disabled') ? '-1' : '0'" x-bind:aria-disabled="isLoading || $el.hasAttribute('disabled') ? 'true' : null" x-on:click.prevent.stop="if (! $el.hasAttribute('disabled')) { clearError(); state = ! state }" x-on:keydown.enter.prevent.stop="if (! $el.hasAttribute('disabled')) { clearError(); state = ! state }" x-on:keydown.space.prevent.stop="if (! $el.hasAttribute('disabled')) { clearError(); state = ! state }" x-bind:class="state ? ${js(onClasses)} : ${js(offClasses)}"${state ? ' x-cloak' : ''} role="switch" ${button.toHtml()}><div><div aria-hidden="true">${toggleIcon(this._offIcon)}</div><div aria-hidden="true">${toggleIcon(this._onIcon)}</div></div></div>${state ? `<div x-cloak="inline-flex" wire:ignore class="${e(['fi-toggle fi-toggle-on fi-hidden', ...onColorClasses].join(' '))}"><div><div aria-hidden="true"></div><div aria-hidden="true">${toggleIcon(this._onIcon)}</div></div></div>` : ''}${EditableColumn.STATUS_HTML}</div>`;
    }
}

/** Case à cocher modifiable dans la cellule (port de CheckboxColumn). La valeur reçue doit être un booléen (règle `boolean` par défaut). */
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

/** Champ de saisie modifiable dans la cellule (port de TextInputColumn). Seuls un texte ou un nombre sont acceptés du navigateur. */
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
    /** Type HTML du champ (`text` par défaut ; `number`, `email`, `color`…). */
    type(type: string | null): this { this._type = type && /^[a-z-]+$/.test(type) ? type : 'text'; return this; }
    /** Masque de saisie Alpine (`x-mask`) ; le champ devient alors un champ texte. */
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
        // Icône d'affixe : la couleur grise est celle par défaut, sans classe (comme InputComponent\WrapperComponent\IconComponent).
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
 * Colonne au rendu libre (port de ViewColumn) : `view()` reçoit une fonction qui renvoie le HTML de la cellule, ou le nom d'une vue EJS
 * rendue avec `{ state, record, column }`. Ce HTML est celui de l'application : les données qu'il contient doivent y être échappées (`e()`).
 */
export class ViewColumn<R = any> extends Column<R> {
    private _view: ((ctx: { state: unknown; record: R; column: ViewColumn<R> }) => string | Promise<string>) | string | null = null;
    private _viewData: Record<string, unknown> = {};
    static make<R = any>(name: string): ViewColumn<R> { return configured(new ViewColumn<R>(name)); }
    view(view: ((ctx: { state: unknown; record: R; column: ViewColumn<R> }) => string | Promise<string>) | string, data: Record<string, unknown> = {}): this { this._view = view; this._viewData = data; return this; }
    async toHtml(record: R): Promise<string> {
        const state = await this.getState(record);
        if (this._view === null) throw new Error(`ViewColumn ${this.name} : aucune vue déclarée (view()).`);
        if (typeof this._view === 'function') return this._view({ state, record, column: this });
        return views.render(this._view, { ...this._viewData, state, record, column: this, getState: () => state, getRecord: () => record });
    }
}

/** @deprecated Port de BadgeColumn : utiliser `TextColumn.make(nom).badge()`. */
export class BadgeColumn<R = any> extends TextColumn<R> {
    constructor(name: string) { super(name); this.badge(); }
    static make<R = any>(name: string): BadgeColumn<R> { return configured(new BadgeColumn<R>(name)); }
}

/** @deprecated Port de BooleanColumn : utiliser `IconColumn.make(nom).boolean()`. */
export class BooleanColumn<R = any> extends IconColumn<R> {
    constructor(name: string) { super(name); this.boolean(); }
    static make<R = any>(name: string): BooleanColumn<R> { return configured(new BooleanColumn<R>(name)); }
}

/**
 * Écriture d'une cellule modifiable reçue du navigateur (port de `updateTableColumnState`). Tout est revérifié : la colonne doit
 * être déclarée, modifiable et visible, l'enregistrement dans la portée de l'adaptateur et non désactivé pour cette colonne,
 * `authorize` (droit de modification de l'hôte) l'accepter, et la valeur passer les règles de la colonne.
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

// ------------------------------------------------------------------ filtres
/** État d'un filtre : les valeurs de son formulaire. */
export type FilterState = Record<string, unknown>;
/** Pastille « filtre actif » : son libellé, et le champ du filtre que son retrait efface. */
export type FilterIndicator = { label: string; field: string };
/** Disposition des filtres : menu déroulant de la barre d'outils (défaut), ou panneau repliable au-dessus du contenu. */
export type FiltersLayout = 'dropdown' | 'above-content-collapsible';
export interface TableFilter {
    readonly name: string;
    getLabel(): string;
    /** État initial (formulaire vide). */
    getDefaultState(): FilterState;
    /** Options du champ `value` : [valeur, libellé], et libellé de l'option vide. */
    getFormDefinition(): { placeholder: string; options: [string, string][] };
    isActive(state: FilterState): boolean;
    /** Applique le filtre à la requête de liste. Ne lit que des valeurs connues. */
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void;
    /** Composants de formulaire du filtre, à la place du sélecteur décrit par `getFormDefinition()`. */
    getFormComponents?(): unknown[];
    getColumnSpan?(): Record<string, number | string>;
    /** État appliqué à partir de l'état du formulaire (reçu du navigateur) : ne garde que ce que le filtre connaît. */
    sanitizeState?(state: unknown): FilterState;
    getIndicators?(state: FilterState): FilterIndicator[];
    /** Options du sélecteur chargées à la demande (relation), à la place de celles de `getFormDefinition()`. */
    getFormOptions?(): Promise<[string, string][]>;
    removeIndicator?(state: FilterState, field: string): FilterState;
    /** Données lues en base avant le calcul des indicateurs (libellés d'enregistrements liés, par exemple). */
    loadIndicatorData?(state: FilterState, host: TableHost): Promise<void>;
}

/** Filtre « corbeille » des modèles à suppression douce (port de TrashedFilter). */
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

/** Filtre par valeur d'une colonne, choisie dans une liste (port de SelectFilter, sélection simple). */
export class SelectFilter implements TableFilter {
    readonly name: string;
    private _label: string | null = null;
    private _column: string | null = null;
    private _options: [string, string][] | (() => Promise<[string, string][]>) = [];
    constructor(name: string) { this.name = name; }
    static make(name: string): SelectFilter { return configured(new SelectFilter(name)); }
    label(label: string): this { this._label = label; return this; }
    /** Colonne filtrée quand elle diffère du nom du filtre (clé étrangère d'une relation, par exemple). */
    column(column: string): this { this._column = column; return this; }
    /** Options fixes, ou fonction asynchrone (enregistrements d'une relation). */
    options(options: [string, string][] | Record<string, string> | (() => Promise<[string, string][]>)): this {
        this._options = typeof options === 'function' ? options : (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]): [string, string] => [String(value), String(label)]);
        return this;
    }
    getLabel(): string { return this._label ?? filterLabel(this.name); }
    getDefaultState(): FilterState { return { value: null }; }
    getFormDefinition() { return { placeholder: t('filament-tables::table.filters.select.placeholder'), options: Array.isArray(this._options) ? this._options : [] }; }
    getFormOptions(): Promise<[string, string][]> { return typeof this._options === 'function' ? this._options() : Promise.resolve(this._options); }
    /** Comme Filament : les options d'un SelectFilter sont évaluées à chaque rendu, le sélecteur porte donc une clé dérivée d'elles. */
    readonly hasDynamicOptions = true;
    isActive(state: FilterState): boolean { return typeof state.value === 'string' && state.value !== ''; }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        if (!this.isActive(state)) return;
        const value = String(state.value).slice(0, 255);
        // Options fixes : seule une valeur proposée filtre. Options chargées : la valeur est un paramètre lié, une valeur inconnue ne trouve rien.
        if (Array.isArray(this._options) && !this._options.some(([option]) => option === value)) return;
        const column = this._column ?? this.name;
        (query.modifiers ??= []).push((q) => { q.where(column, value); });
    }
}

/** Filtre à trois états sur une colonne booléenne : tous, oui, non (port de TernaryFilter). */
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

/** Filtre à formulaire libre (port de Filter avec `schema()`) : la requête et les indicateurs sont écrits par l'application. */
export class Filter implements TableFilter {
    readonly name: string;
    private _label: string | null = null;
    private _components: unknown[] = [];
    private _query: ((query: any, data: FilterState) => void) | null = null;
    private _indicate: ((data: FilterState) => Record<string, string>) | null = null;
    constructor(name: string) { this.name = name; }
    static make(name: string): Filter { return configured(new Filter(name)); }
    label(label: string): this { this._label = label; return this; }
    /** Champs du filtre ; leurs noms sont les seules clés d'état acceptées du navigateur. */
    schema(components: unknown[]): this { this._components = components; return this; }
    /** Condition posée sur la requête à partir de l'état nettoyé du formulaire. */
    query(modifier: (query: any, data: FilterState) => void): this { this._query = modifier; return this; }
    /** Pastilles des valeurs appliquées : `{ champ: libellé }` ; retirer une pastille efface son champ. */
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
    /** Regroupements proposés dans la barre d'outils (un identifiant de colonne vaut `Group.make(identifiant)`). */
    groups(groups: (Group<R> | string)[]): this { this._groups = groups.map((g) => (typeof g === 'string' ? Group.make<R>(g) : g)); return this; }
    getGroups(): Group<R>[] { return this._groups; }
    getGroup(id: string | null | undefined): Group<R> | null { return this._groups.find((g) => g.getId() === id) ?? null; }
    /**
     * Regroupement par défaut (port de `defaultGroup()`). S'il fait partie de `groups()`, il est seulement présélectionné à l'ouverture
     * (`initializeTableGrouping`) et l'utilisateur peut le retirer ; sinon il s'applique toujours, sans sélecteur.
     */
    defaultGroup(group: Group<R> | string | null, direction: SortDirection = 'asc'): this { this._defaultGroup = group; this._defaultGroupDirection = direction === 'desc' ? 'desc' : 'asc'; return this; }
    getDefaultGroup(): Group<R> | null {
        if (this._defaultGroup === null) return null;
        if (this._defaultGroup instanceof Group) return this._defaultGroup;
        return this.getGroup(this._defaultGroup) ?? Group.make<R>(this._defaultGroup);
    }
    getDefaultGroupDirection(): SortDirection { return this._defaultGroupDirection; }
    isDefaultGroupSelectable(): boolean { const group = this.getDefaultGroup(); return group !== null && this.getGroup(group.getId()) !== null; }
    /** Seuls les en-têtes et résumés des groupes sont affichés, sans les lignes ni la pagination (port de `groupsOnly()`). */
    groupsOnly(condition = true): this { this._groupsOnly = condition; return this; }
    isGroupsOnly(): boolean { return this._groupsOnly; }
    /** Masque le sélecteur de regroupement de la barre d'outils. */
    groupingSettingsHidden(condition = true): this { this._groupingSettingsHidden = condition; return this; }
    areGroupingSettingsHidden(): boolean { return this._groupingSettingsHidden; }
    /** Masque le choix du sens (croissant / décroissant) du regroupement. */
    groupingDirectionSettingHidden(condition = true): this { this._groupingDirectionSettingHidden = condition; return this; }
    isGroupingDirectionSettingHidden(): boolean { return this._groupingDirectionSettingHidden; }
    /** Sur grand écran aussi, le sélecteur de regroupement est dans un menu déroulant. */
    groupingSettingsInDropdownOnDesktop(condition = true): this { this._groupingSettingsInDropdownOnDesktop = condition; return this; }
    /** @deprecated Ancien nom de `groupingSettingsInDropdownOnDesktop()`. */
    groupsInDropdownOnDesktop(condition = true): this { return this.groupingSettingsInDropdownOnDesktop(condition); }
    areGroupingSettingsInDropdownOnDesktop(): boolean { return this._groupingSettingsInDropdownOnDesktop; }
    /** Les groupes repliables s'affichent repliés. */
    collapsedGroupsByDefault(condition = true): this { this._collapsedGroupsByDefault = condition; return this; }
    areGroupsCollapsedByDefault(): boolean { return this._collapsedGroupsByDefault; }

    private _columnsLayout: (Column<R> | ColumnLayout<R>)[] | null = null;
    columns(columns: (Column<R> | ColumnGroup<R> | ColumnLayout<R>)[]): this {
        this._columns = columns.flatMap((c) => (c instanceof ColumnGroup || c instanceof ColumnLayout ? c.getColumns() : [c]));
        this._columnsLayout = columns.some((c) => c instanceof ColumnLayout) ? (columns.filter((c) => !(c instanceof ColumnGroup)) as (Column<R> | ColumnLayout<R>)[]) : null;
        return this;
    }
    /** Mise en page des colonnes, ou `null` pour un tableau classique. */
    getColumnsLayout(): (Column<R> | ColumnLayout<R>)[] | null { return this._columnsLayout; }
    /** Action montée au clic sur une ligne (ex. `'edit'`), à la place d'une URL. */
    recordAction(name: string | null): this { this._recordAction = name; return this; }
    getRecordAction(): string | null { return this._recordAction; }
    /** Titre affiché dans l'en-tête de la table. */
    heading(heading: string | null): this { this._heading = heading; return this; }
    getHeading(): string | null { return this._heading; }
    /** Actions affichées dans l'en-tête de la table. */
    headerActions(actions: any[]): this { this._headerActions = actions; return this; }
    getHeaderActions(): any[] { return this._headerActions; }
    /** Actions groupées (menu « Bulk actions ») ; sans appel, l'hôte fournit ses actions par défaut. */
    groupedBulkActions(actions: any[]): this { this._bulkActions = actions; return this; }
    getBulkActions(): any[] | null { return this._bulkActions; }
    /** Actions de ligne : des `Action` ou un `ActionGroup` (menu déroulant). */
    recordActions(actions: any[]): this { this._recordActions = actions; return this; }
    getRecordActions(): any[] { return this._recordActions; }
    /** Classes CSS ajoutées à la ligne selon l'enregistrement. */
    recordClasses(resolver: (record: R) => string | null): this { this._recordClasses = resolver; return this; }
    getRecordClasses(record: R): string | null { return this._recordClasses ? this._recordClasses(record) : null; }
    filters(filters: TableFilter[], options: { layout?: FiltersLayout } = {}): this { this._filters = filters; if (options.layout) this._filtersLayout = options.layout; return this; }
    filtersLayout(layout: FiltersLayout): this { this._filtersLayout = layout; return this; }
    getFiltersLayout(): FiltersLayout { return this._filtersLayout; }
    /** Les filtres ne s'appliquent qu'au bouton « Apply » : c'est déjà le comportement de toutes les tables (méthode gardée pour la compatibilité d'API). */
    deferFilters(): this { return this; }
    defaultSort(column: string, direction: SortDirection = 'asc'): this { this._defaultSort = { column, direction }; return this; }
    recordUrl(resolver: (record: R) => string | null): this { this._recordUrl = resolver; return this; }
    private _reorderColumn: string | null = null;
    /** Lignes réordonnables à la main ; `column` reçoit le rang (port de `reorderable()`). */
    reorderable(column: string | null): this { this._reorderColumn = column; return this; }
    getReorderColumn(): string | null { return this._reorderColumn; }
    paginationPageOptions(options: number[]): this { this._pageOptions = options; return this; }
    private _defaultPageOption: number | null = null;
    /** Nombre de lignes par page à l'ouverture (port de `defaultPaginationPageOption()`). */
    defaultPaginationPageOption(option: number | null): this { this._defaultPageOption = option; return this; }
    getDefaultPageOption(): number { return this._defaultPageOption !== null && this._pageOptions.includes(this._defaultPageOption) ? this._defaultPageOption : (this._pageOptions.includes(10) ? 10 : this._pageOptions[0]); }
    private _paginationMode: 'default' | 'simple' = 'default';
    /** `'simple'` : boutons précédent / suivant seulement, sans numéros de page ni total (port de `PaginationMode::Simple`). */
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

    /** État par défaut du gestionnaire de colonnes (port de getDefaultTableColumnState). */
    getDefaultColumnState(): ColumnState[] {
        return this._columns.map((c) => ({ type: 'column', name: c.name, label: c.getLabel(), isHidden: false, isToggled: !c.isToggleable() || !c.isToggledHiddenByDefault(), isToggleable: c.isToggleable(), isToggledHiddenByDefault: c.isToggleable() ? c.isToggledHiddenByDefault() : null }));
    }
    getDefaultFilterState(): Record<string, FilterState> { return Object.fromEntries(this._filters.map((f) => [f.name, f.getDefaultState()])); }
}

/** État de table porté par le composant hôte (équivalent du trait InteractsWithTable). */
export interface TableHost {
    readonly id: string;
    tableSearch: string;
    tableSort: string | null;
    tableColumnSearches: Record<string, string>;
    tableRecordsPerPage: number;
    paginators: Record<string, number>;
    tableFilters?: Record<string, FilterState>;
    tableColumns?: ColumnState[];
    /** Regroupement courant : `identifiant` ou `identifiant:direction`. */
    tableGrouping?: string | null;
    /** Mode « tri manuel » : toutes les lignes, dans l'ordre de la colonne de rang, avec des poignées. */
    isTableReordering?: boolean;
}

/** Colonnes affichées : celles que l'état du gestionnaire laisse cochées. L'état du navigateur ne peut masquer qu'une colonne déclarée « toggleable ». */
export function getVisibleColumns<R>(table: Table<R>, host: TableHost): Column<R>[] {
    const hidden = new Set((Array.isArray(host.tableColumns) ? host.tableColumns : []).filter((c) => c && c.isToggled === false).map((c) => c.name));
    return table.getColumns().filter((c) => !(c.isToggleable() && hidden.has(c.name)));
}
/** Nettoie un état de colonnes reçu du navigateur : seul `isToggled` des colonnes « toggleable » est repris. */
export function sanitizeColumnState<R>(table: Table<R>, state: unknown): ColumnState[] {
    const received = new Map((Array.isArray(state) ? state : []).filter((c) => c && typeof c === 'object').map((c: any) => [String(c.name), c.isToggled]));
    return table.getDefaultColumnState().map((c) => (c.isToggleable && typeof received.get(c.name) === 'boolean' ? { ...c, isToggled: received.get(c.name) as boolean } : c));
}

/** Requête de liste (recherche, recherches par colonne, filtres, tri) correspondant à l'état de l'hôte, sans pagination.
 *  Seul ce que la table déclare est accepté, quel que soit l'état envoyé par le navigateur. */
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
    // L'hôte peut restreindre la requête (onglet de liste actif).
    (host as any).modifyTableQuery?.(query);
    for (const filter of table.getFilters()) {
        const state = host.tableFilters?.[filter.name];
        filter.apply(query, state && typeof state === 'object' ? state : filter.getDefaultState());
    }
    return query;
}
/** Regroupement courant : seul un groupe déclaré par la table est accepté, quel que soit l'état envoyé par le navigateur. */
export function getTableGrouping<R>(table: Table<R>, host: TableHost): { group: Group<R>; direction: SortDirection } | null {
    if (host.isTableReordering === true) return null;
    const [id, direction] = String(host.tableGrouping ?? '').split(':');
    const group = table.getGroup(id);
    if (group) return { group, direction: direction === 'desc' ? 'desc' : 'asc' };
    // Comme Filament : un regroupement par défaut absent du sélecteur s'applique toujours ; présent, il ne vaut que s'il est choisi.
    const fallback = table.isDefaultGroupSelectable() ? null : table.getDefaultGroup();
    return fallback ? { group: fallback, direction: table.getDefaultGroupDirection() } : null;
}
/** À l'ouverture de la table (montage de l'hôte) : présélectionne le regroupement par défaut quand l'utilisateur peut le changer. */
export function initializeTableGrouping<R>(table: Table<R>, host: TableHost): void {
    const group = table.getDefaultGroup();
    if ((host.tableGrouping === null || host.tableGrouping === undefined || host.tableGrouping === '') && group && table.isDefaultGroupSelectable()) host.tableGrouping = `${group.getId()}:${table.getDefaultGroupDirection()}`;
}
export function countActiveFilters<R>(table: Table<R>, host: TableHost): number {
    // Comme Filament : le compteur est le nombre d'indicateurs ; un filtre sans indicateurs compte pour un quand il est actif.
    return table.getFilters().reduce((total, f) => { const s = host.tableFilters?.[f.name]; return total + (!s || typeof s !== 'object' ? 0 : f.getIndicators ? f.getIndicators(s).length : f.isActive(s) ? 1 : 0); }, 0);
}

/** Indicateurs des filtres appliqués (seuls les filtres qui en déclarent en ont). */
export function getFilterIndicators<R>(table: Table<R>, host: TableHost): { filter: string; field: string; label: string }[] {
    return table.getFilters().flatMap((f) => { const s = host.tableFilters?.[f.name]; return s && typeof s === 'object' && f.getIndicators ? f.getIndicators(s).map((indicator) => ({ filter: f.name, ...indicator })) : []; });
}

/** Port de sortTable() : non trié → asc → desc → non trié. */
export function sortTable(host: TableHost, column: string | null = null, direction: string | null = null): void {
    const [current, currentDirection] = (host.tableSort ?? '').split(':');
    if (column === (host.tableSort ? current : null)) direction ??= (currentDirection ?? 'asc') === 'asc' ? 'desc' : currentDirection === 'desc' ? null : 'asc';
    else direction ??= 'asc';
    host.tableSort = direction ? `${column}:${direction}` : null;
    host.paginators.page = 1;
}

/** Charge la page d'enregistrements correspondant à l'état de l'hôte. */
export async function getTableRecords<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>): Promise<RecordPage<R>> {
    const options = table.getPageOptions();
    const perPage = options.includes(Number(host.tableRecordsPerPage)) ? Number(host.tableRecordsPerPage) : options[0];
    return adapter.paginate({ ...getTableQuery(table, host), page: Number(host.paginators.page) || 1, perPage });
}

/** Éléments de pagination : port de UrlWindow de Laravel avec onEachSide(0), comme Filament. */
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
    /** `false` : le tri manuel n'est pas proposé (utilisateur non autorisé). */
    canReorder?: boolean;
    /** HTML placé dans `.fi-ta`, après le conteneur de la table (modales des actions). */
    after?: string;
    /** HTML déjà rendu des actions d'en-tête de la table. */
    headerActions?: string[];
    /** HTML déjà rendu des actions de ligne (ActionGroup…), à la place des liens de `rowActions`. */
    rowActionsHtml?: (record: R) => Promise<string>;
    bulkActions?: string[];
    /** HTML du formulaire des filtres (schéma `tableFiltersForm`), s'il y a des filtres. */
    filtersForm?: string | null;
};

/** Nombre maximal de lignes affichées (et réordonnées) en mode tri manuel. */
export const REORDER_LIMIT = 1000;

type SummaryCell = { alignment: string; items: SummaryItem[] };
type SummaryRow = { heading: string; cells: SummaryCell[]; striped: boolean };
/** Cases réservées des lignes de résumé : cellule de sélection avant, cellule d'actions après (comme les lignes d'enregistrements). */
type SummaryPlaceholders = { selection: boolean; actions: boolean };

/** Ligne de résumé (port de `tables::summary.row`) ; `groupsOnly` : intitulé seul en tête, puis une cellule par colonne. */
function summaryRowHtml(row: SummaryRow, span: number, groupsOnly: boolean, placeholders: SummaryPlaceholders): string {
    const items = (cell: SummaryCell) => cell.items.map((item) => `<div class="fi-ta-${item.type}-summary">${item.label !== null ? `<span class="fi-ta-${item.type}-summary-label">${e(item.label)}</span>` : ''}<span>${e(item.value)}</span></div>`).join('');
    const heading = groupsOnly
        ? `<th scope="row" class="fi-ta-cell fi-ta-summary-row-heading-cell fi-align-start">${e(row.heading)}</th>`
        : `<th scope="row"${span > 1 ? ` colspan="${span}"` : ''} class="fi-ta-cell fi-align-start fi-ta-summary-row-heading-cell ">${e(row.heading)}</th>`;
    return `<tr class="fi-ta-row fi-ta-summary-row${row.striped ? ' fi-striped' : ''}">${placeholders.selection ? '<td></td>' : ''}${heading}${row.cells.map((cell) => `<td class="fi-ta-cell fi-align-${e(cell.alignment)} ">${items(cell)}</td>`).join('')}${placeholders.actions ? '<td></td>' : ''}</tr>`;
}

/**
 * Résumés de la table (port de `tables::summary`) : sans pagination, une seule ligne « Summary » ; avec plusieurs pages, un en-tête
 * puis « This page » et « All … ». Renvoie aussi de quoi calculer la ligne de résumé d'un groupe (requête restreinte au groupe).
 */
async function summarize<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>, visible: Column<R>[], page: { records: R[]; lastPage: number }, options: { group: Group<R> | null; groupsOnly: boolean; placeholders: SummaryPlaceholders }) {
    // Groupes seuls : la colonne du groupe n'a pas de cellule de résumé (son intitulé est déjà en tête de ligne).
    const columns = options.groupsOnly && options.group ? visible.filter((c) => c.name !== options.group!.getColumn()) : visible;
    const lists = columns.map((c) => (c instanceof TextColumn ? c.getSummarizers() : []));
    if (!lists.some((list) => list.length) || !page.records.length) return null;
    // Comme Filament : la première cellule porte l'intitulé de la ligne ; elle s'étend jusqu'à la première colonne résumée qui la suit.
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
        /** Ligne de résumé d'un groupe : agrégats de tous les enregistrements du groupe (pas seulement ceux de la page). */
        group: async (group: Group<R>, key: string | null, title: string | null): Promise<string> => {
            const values = await aggregate({ ...query, modifiers: [...(query.modifiers ?? []), (q: any) => group.scope(q, key)] });
            return rowHtml({ heading: options.groupsOnly ? (title ?? '') : t('filament-tables::table.summary.subheadings.group', { group: title ?? '', label }), cells: cells(values), striped: false });
        },
    };
}

/** Plafond d'enregistrements lus pour une table `groupsOnly` (non paginée, comme dans Filament). */
export const GROUPS_ONLY_LIMIT = 1000;

export async function renderTable<R>(table: Table<R>, host: TableHost, adapter: DataAdapter<R>, options: RenderTableOptions<R> = {}): Promise<string> {
    const reorderColumn = options.canReorder === false ? null : table.getReorderColumn();
    const reordering = reorderColumn !== null && host.isTableReordering === true;
    // Tri manuel : toutes les lignes de la requête, dans l'ordre de la colonne de rang, sans pagination ni actions.
    if (reordering) options = { ...options, bulkActions: [], headerActions: options.headerActions, rowActions: undefined, rowActionsHtml: undefined, filtersForm: null };
    const grouping = reordering ? null : getTableGrouping(table, host);
    // Groupes seuls : ni pagination ni lignes d'enregistrements, seulement une ligne de résumé par groupe (comme Filament).
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
    // Comme Filament : un nouveau groupe commence quand le titre change ; le groupe précédent reçoit alors sa ligne de résumé.
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
                // Clés de tout le groupe (pas seulement de la page), pour sa case « tout sélectionner ».
                keys: hasBulk ? await adapter.listKeys({ ...query, modifiers: [...(query.modifiers ?? []), (q: any) => grouping.group.scope(q, groupKey)] }) : [],
                // En-tête sans rien à annoncer : masqué aux technologies d'assistance.
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
            // Clic sur la ligne : l'action est montée avec la clé de l'enregistrement (même expression que Filament).
            mountExpression: reordering ? null : recordAction ? `mountAction(${js(recordAction)}, {}, ${js({ table: true, recordKey: key })})` : null,
        });
    }
    const hasRowActions = rows.some((row) => row.actionsHtml !== null || row.actions.length > 0);
    // Résumés : jamais en mode « tri manuel » ; ceux des groupes s'intercalent avant l'en-tête du groupe suivant.
    const summary = reordering ? null : await summarize(table, host, adapter, visible, page, { group: grouping?.group ?? null, groupsOnly, placeholders: { selection: selectable, actions: hasRowActions } });
    let trailingGroupSummary = '';
    if (summary && grouping) {
        for (const row of rows) if (row.summaryBefore) row.groupSummaryHtml = await summary.group(grouping.group, row.summaryBefore.key, row.summaryBefore.title);
        // Dernier groupe de la page : résumé seulement s'il ne continue pas sur la page suivante (port de shouldRenderTrailingGroupedTableSummary).
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
        // Comme Filament : pas de cases à cocher sans action groupée (ni en mode « groupes seuls »), pas de colonne d'actions sans action de ligne.
        selectable, hasRowActions,
        // Comme Filament (Str::random) : la clé change à chaque rendu pour forcer le remplacement de la case à cocher.
        randomKey: () => Array.from(randomBytes(16), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join(''),
        // Total sélectionnable par « tout sélectionner » : tous les enregistrements de la requête courante.
        allCount: table.getPaginationMode() === 'simple' ? '' : page.total, resultsCount: table.getPaginationMode() === 'simple' ? rows.length : page.total,
        columns: visible.map((c) => ({ name: c.name, grouped: c._group !== null, cssName: c.getCssName(), alignment: c.getAlignment(), label: c.getLabel(), sortable: !reordering && c.isSortable(), individuallySearchable: !reordering && c.isIndividuallySearchable(), sort: sortColumn === c.name ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none' })),
        linkClasses: classes('link', 'primary'), dangerLinkClasses: classes('link', 'danger'), primaryButtonClasses: classes('button', 'primary'), badgeClasses: classes('badge', 'primary'), indicatorBadgeClasses: classes('badge', 'primary'),
        bulkActions: options.bulkActions ?? [],
        filtersForm: options.filtersForm ?? null, activeFiltersCount: countActiveFilters(table, host), filtersLayout: table.getFiltersLayout(), filterIndicators: getFilterIndicators(table, host),
        hasColumnManager: !reordering && table.hasToggleableColumns(),
        afterContainer: options.after ?? '', heading: table.getHeading(), headerActions: options.headerActions ?? [], summaryHtml: summary?.html ?? '', trailingGroupSummary,
        // Ligne d'intitulés de groupes : une cellule par colonne isolée, une cellule fusionnée par suite de colonnes du même groupe.
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
