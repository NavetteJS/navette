// @navette-js/schemas — Schema, Component and the layout components.
// Each component renders in two steps: async property resolution, then a synchronous EJS view (ADR 0003).
import { Attributes, HtmlString, cls, e, evaluate, icon, icons, js, loadingIndicator, renderHook, views, type ColorManager, type Lazy, configured, configureUsing } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

views.namespace('filament-schemas', fileURLToPath(new URL('../views', import.meta.url)));

/** What a schema expects from the stateful component hosting it. */
export interface SchemaHost {
    readonly id: string;
    _errors: Record<string, string[]>;
    getSchema(name: string): Schema | Promise<Schema>;
}
export type ComponentContext = { livewire: SchemaHost; component: Component; operation: string | null; record: unknown; get: (path: string) => unknown; state: unknown };
type SpanValue = number | string | ((ctx: ComponentContext) => number | string | Promise<number | string>);
type ColumnSpan = Record<string, SpanValue> | number | string;
type GridValue = number | null | ((ctx: ComponentContext) => number | null | Promise<number | null>);
/** Column start or order: a number (from `lg`), an object of breakpoints, or a function returning either (a number then applies to every screen size). */
export type ColumnPlacement = Record<string, GridValue> | number | null | ((ctx: ComponentContext) => Record<string, number | null> | number | null | Promise<Record<string, number | null> | number | null>);

/** Breakpoints accepted in grid objects: viewport (`sm`…`2xl`), container (`@3xs`…`@7xl`) and fallback (`!@sm`…`!@2xl`). */
const GRID_BREAKPOINT = /^(default|sm|md|lg|xl|2xl|@(3xs|2xs|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)|!@(sm|md|lg|xl|2xl))$/;
/** CSS variable suffix of a breakpoint (`@md` → `cmd`, `!@md` → `ncmd`). */
const breakpointVariable = (breakpoint: string) => breakpoint.replace(/@/g, 'c').replace(/!/g, 'n');
/** Resolves a column start or order: successive calls merge, a function's number result applies to `default`. */
async function resolvePlacement(entries: ColumnPlacement[], ctx: ComponentContext, keepZero: boolean): Promise<Record<string, number>> {
    const out: Record<string, number | null> = {};
    for (const entry of entries) {
        const value = typeof entry === 'function' ? await entry(ctx) : entry;
        if (value === null || value === undefined) continue;
        if (typeof value === 'number') { out[typeof entry === 'function' ? 'default' : 'lg'] = value; continue; }
        for (const [breakpoint, item] of Object.entries(value)) out[breakpoint] = await evaluate(item as GridValue, ctx);
    }
    const result: Record<string, number> = {};
    for (const [breakpoint, value] of Object.entries(out)) {
        if (!GRID_BREAKPOINT.test(breakpoint) || typeof value !== 'number' || !Number.isInteger(value) || (!keepZero && value === 0)) continue;
        result[breakpoint] = value;
    }
    return result;
}

export abstract class Component {
    private _grow = true;
    /** Inside a Flex: `false` keeps the natural width instead of filling the available space. */
    grow(condition = true): this { this._grow = condition; return this; }
    canGrow(): boolean { return this._grow; }
    /** Default configuration for every instance later created by `make()`: `TextInput.configureUsing((input) => input.maxLength(255))`. */
    static configureUsing<T>(this: abstract new (...args: any[]) => T, configure: (instance: T) => void): void { configureUsing(this, configure); }
    protected _name: string | null = null;
    protected _keyName: string | null = null;
    protected _hidden: Lazy<boolean, ComponentContext> = false;
    protected _visible: Lazy<boolean, ComponentContext> = true;
    protected _lazyLoaded: Lazy<boolean, ComponentContext> = false;
    /**
     * Renders the component's content (its child schema) only when it enters the viewport, in a separate request: a loading
     * indicator is shown meanwhile. The component needs a unique key (a heading, or `key()`).
     */
    lazyLoaded(condition: Lazy<boolean, ComponentContext> = true): this { this._lazyLoaded = condition; return this; }
    getLazyLoadedCondition(): Lazy<boolean, ComponentContext> { return this._lazyLoaded; }
    protected _columnSpan: ColumnSpan = { default: 1 };
    protected _extraAttributes: Record<string, string> = {};
    protected _columnStart: ColumnPlacement[] = [];
    protected _columnOrder: ColumnPlacement[] = [];
    protected _gridContainer: Lazy<boolean, ComponentContext> = false;
    protected _dense: boolean | null = null;
    protected _gap: boolean | null = null;
    container!: Schema;

    hidden(condition: Lazy<boolean, ComponentContext> = true): this { this._hidden = condition; return this; }
    visible(condition: Lazy<boolean, ComponentContext> = true): this { this._visible = condition; return this; }
    key(key: string | null): this { this._keyName = key; return this; }
    /** Hidden for the given operation(s) (`'create'`, `'edit'`…). */
    hiddenOn(operations: string | string[]): this { const list = ([] as string[]).concat(operations); return this.hidden(({ operation }) => operation !== null && list.includes(operation)); }
    /** Visible only for the given operation(s). */
    visibleOn(operations: string | string[]): this { const list = ([] as string[]).concat(operations); return this.visible(({ operation }) => operation !== null && list.includes(operation)); }
    /** A number applies from the `lg` breakpoint; an object replaces the default entirely. Values may be closures. */
    columnSpan(span: ColumnSpan): this { this._columnSpan = typeof span === 'object' ? span : { default: 1, lg: span }; return this; }
    /** Starting grid column: a number applies from the `lg` breakpoint; an object sets it per breakpoint. Successive calls merge; `null` resets it. */
    columnStart(start: ColumnPlacement): this { this._columnStart = start === null ? [] : [...this._columnStart, start]; return this; }
    /** Visual order in the grid, without changing the markup order: a number applies from `lg`; an object sets it per breakpoint. */
    columnOrder(order: ColumnPlacement): this { this._columnOrder = order === null ? [] : [...this._columnOrder, order]; return this; }
    /** Makes the component a CSS container, so that grids inside it may use container breakpoints (`@md`, `@xl`…). */
    gridContainer(condition: Lazy<boolean, ComponentContext> = true): this { this._gridContainer = condition; return this; }
    /** Tighter spacing between the components of its child schemas (inherited by nested layouts). */
    dense(condition: boolean | null = true): this { this._dense = condition; return this; }
    /** `false`: no space between the components of its child schemas (inherited by nested layouts). */
    gap(condition: boolean | null = true): this { this._gap = condition; return this; }
    isDense(): boolean { return this._dense ?? this.container.isDense(); }
    hasGap(): boolean { return this._gap ?? this.container.hasGap(); }
    /** Heading level of the component's own headings (`index` for a second heading). */
    getHeadingLevel(index = 0): number { return Math.max(1, this.container.getRootHeadingLevel() + index); }
    /** `h1`…`h6`, or `p` beyond level 6. */
    getHeadingTag(index = 0): string { const level = this.getHeadingLevel(index); return level > 6 ? 'p' : `h${level}`; }
    /** Number of heading levels the component adds above its child schemas (1 for a section with a heading). */
    getHeadingsCount(): number { return 0; }
    getChildSchemaRootHeadingLevel(): number { return this.getHeadingLevel() + this.getHeadingsCount(); }
    /** Full grid width on every screen size (`columnSpan('full')` only applies from `lg`). */
    columnSpanFull(): this { return this.columnSpan({ default: 'full' } as any); }
    extraAttributes(attributes: Record<string, string>): this { Object.assign(this._extraAttributes, attributes); return this; }

    get livewire(): SchemaHost { return this.container.livewire; }
    isLiberatedFromContainerGrid(): boolean { return false; }
    /** Server methods the component's JavaScript may call (announced to the browser). */
    getExposedMethods(): string[] { return []; }
    /** False for an exposed method after which the host must re-render (e.g. next wizard step, to show validation errors). */
    isRenderlessMethod(_method: string): boolean { return true; }
    hasStatePath(): boolean { return false; }

    /** Absolute component key: `<schema key>.<key or name>`, or null. */
    getKey(): string | null {
        // `::data::` in a generated key (section, tabs) stands for the schema state path, and is dropped when there is none (infolists).
        const statePath = this.container.getStatePath();
        const own = (this._keyName ?? this._name)?.replace('::data::', statePath ? `::${statePath}::` : '::') ?? null;
        return own === null ? null : `${this.container.getKey()}.${own}`;
    }
    getLivewireKey(): string | null { const k = this.getKey(); return k === null ? null : `${this.livewire.id}.${k}`; }
    getStatePath(): string { return this.hasStatePath() ? [this.container.getStatePath(), this._name].filter(Boolean).join('.') : ''; }
    getAlpineScopeConfiguration(): Record<string, unknown> {
        // A stateless (layout) component exposes its container's state path.
        return { key: this.getKey(), exposedMethods: this.getExposedMethods(), path: this.hasStatePath() ? this.getStatePath() : this.container.getStatePath(), containerPath: this.container.getStatePath() };
    }
    context(): ComponentContext {
        const livewire = this.livewire as any;
        const read = (path: string) => path.split('.').reduce((o: any, k) => o?.[k], livewire);
        return { livewire, component: this, operation: this.container.getOperation(), record: this.container.getRecord(), get: (p) => read([this.container.getStatePath(), p].filter(Boolean).join('.')), state: this.hasStatePath() ? read(this.getStatePath()) : undefined };
    }
    async isVisible(): Promise<boolean> {
        const ctx = this.context();
        return !(await evaluate(this._hidden, ctx)) && (await evaluate(this._visible, ctx));
    }

    /** The component's own HTML, without its grid wrapper. */
    abstract toHtml(): Promise<string>;

    /** Grid column wrapper, rendered even when the component is hidden. */
    async toSchemaHtml(isVisible: boolean): Promise<string> {
        const key = this.getKey();
        const span: Record<string, number | string> = {};
        const rawSpan = typeof this._columnSpan === 'object' ? this._columnSpan : { default: 1, lg: this._columnSpan };
        const ctx = this.context();
        for (const [breakpoint, value] of Object.entries(rawSpan)) span[breakpoint] = await evaluate(value as any, ctx);
        const start = await resolvePlacement(this._columnStart, ctx, false);
        const order = await resolvePlacement(this._columnOrder, ctx, true);
        const placementClass = (name: string, values: Record<string, number>) => Object.keys(values).map((breakpoint) => (breakpoint === 'default' ? `fi-grid-col-${name}` : `${breakpoint}:fi-grid-col-${name}`));
        const placementStyle = (name: string, values: Record<string, number>) => Object.entries(values).map(([breakpoint, value]) => `--col-${name}-${breakpointVariable(breakpoint)}: ${value}`);
        const attributes = new Attributes()
            .when(!this.container.isInline(), (a) => a.gridColumn(span, !isVisible)
                .class([...placementClass('start', start), ...placementClass('order', order)])
                .style([...placementStyle('start', start), ...placementStyle('order', order)]))
            .merge({ 'wire:key': this.getLivewireKey() });
        return views.render('filament-schemas::component', {
            key, isVisible, attributes: attributes.toHtml(),
            alpine: isVisible ? `filamentSchemaComponent(${js(this.getAlpineScopeConfiguration())})` : null,
            html: isVisible ? await this.toHtml() : '',
            gridContainer: isVisible && Boolean(await evaluate(this._gridContainer, ctx)),
        });
    }
}

export class Schema {
    livewire: SchemaHost;
    private _key = 'schema';
    private _components: Component[] = [];
    private _statePath: string | null = null;
    private _columns: Record<string, number> | number | null = {};
    private _root = true;
    private _inline = false;
    private _operation: string | null = null;
    private _record: unknown = null;
    private _extraClass: string | null = null;
    private _partial = false;
    private _dense: boolean | null = null;
    private _parentComponent: Component | null = null;
    private _rootHeadingLevel = 2;

    constructor(livewire: SchemaHost) { this.livewire = livewire; }
    static make(livewire: SchemaHost): Schema { return configured(new Schema(livewire)); }
    private _lazy: boolean | (() => boolean | Promise<boolean>) = false;
    private _lazyKey: string | null = null;
    /** Renders the components only when the schema enters the viewport (see `Component.lazyLoaded()`). */
    lazyLoaded(condition: boolean | (() => boolean | Promise<boolean>) = true): this { this._lazy = condition; return this; }
    async isLazyLoaded(): Promise<boolean> { return Boolean(typeof this._lazy === 'function' ? await this._lazy() : this._lazy); }
    /** Key identifying a lazy schema (its own key by default; a layout component's child schema uses the component's key). */
    lazyKey(key: string | null): this { this._lazyKey = key; return this; }
    getLazyKey(): string { return this._lazyKey ?? this._key; }

    key(key: string): this { this._key = key; return this; }
    components(components: Component[]): this { this._components = components; for (const c of components) c.container = this; return this; }
    schema(components: Component[]): this { return this.components(components); }
    statePath(path: string | null): this { this._statePath = path; return this; }
    columns(columns: Record<string, number> | number | null): this { this._columns = columns; return this; }
    root(isRoot = true): this { this._root = isRoot; return this; }
    inline(isInline = true): this { this._inline = isInline; return this; }
    operation(operation: string | null): this { this._operation = operation; return this; }
    record(record: unknown): this { this._record = record; return this; }
    /** Class placed before the grid classes (e.g. `fi-section-content`). */
    extraClass(name: string | null): this { this._extraClass = name; return this; }
    /** Tighter spacing between components (`fi-sc-dense`). Without a value set, a child schema follows its parent component. */
    dense(condition: boolean | null = true): this { this._dense = condition; return this; }
    /** Layout component the schema belongs to: spacing and heading levels are inherited from it. */
    parentComponent(component: Component | null): this { this._parentComponent = component; return this; }
    getParentComponent(): Component | null { return this._parentComponent; }
    /** Heading level of the schema's top-level headings (`2` by default: `<h2>`); nested schemas follow their parent. */
    rootHeadingLevel(level: number): this { if (Number.isInteger(level) && level >= 1) this._rootHeadingLevel = level; return this; }
    getRootHeadingLevel(): number { return this._parentComponent ? this._parentComponent.getChildSchemaRootHeadingLevel() : this._rootHeadingLevel; }
    isDense(): boolean { return this._dense ?? (this._inline || (this._parentComponent?.isDense() ?? false)); }
    hasGap(): boolean { return this._gap ?? this._parentComponent?.hasGap() ?? true; }
    /** Partially rendered schema: its root carries `wire:partial="schema.<key>"`. */
    partiallyRendered(condition = true): this { this._partial = condition; return this; }
    private _partialName: string | null = null;
    /** Root `wire:partial` name when it differs from the schema key (filters form: `table-filters-form`). */
    partialName(name: string | null): this { this._partialName = name; return this; }
    private _gap: boolean | null = null;
    /** `false`: components touch, with no gap (no `fi-sc-has-gap`), as in a FusedGroup. */
    gap(condition: boolean | null = true): this { this._gap = condition; return this; }
    private _fieldWrapperView: string | null = null;
    /**
     * Field wrapper for this schema: `'filament-forms::plain-field-wrapper'` keeps only a screen-reader label
     * (FusedGroup fields). `null`: the usual wrapper.
     */
    fieldWrapperView(view: string | null): this { this._fieldWrapperView = view; return this; }
    getFieldWrapperView(): string | null { return this._fieldWrapperView; }

    getKey(): string { return this._key; }
    getStatePath(): string { return this._statePath ?? ''; }
    getComponents(): Component[] { return this._components; }
    getOperation(): string | null { return this._operation; }
    getRecord(): unknown { return this._record; }
    isInline(): boolean { return this._inline; }
    isRoot(): boolean { return this._root; }

    /** All components, depth-first. */
    getFlatComponents(): Component[] {
        return this._components.flatMap((c) => [c, ...((c as any).getChildSchemas?.() ?? []).flatMap((s: Schema) => s.getFlatComponents())]);
    }
    /** Same, without hidden components or their descendants: a field inside a hidden section is neither validated nor saved. */
    async getVisibleFlatComponents(): Promise<Component[]> {
        const out: Component[] = [];
        for (const c of this._components) {
            if (!(await c.isVisible())) continue;
            out.push(c);
            for (const s of ((c as any).getChildSchemas?.() ?? []) as Schema[]) out.push(...(await s.getVisibleFlatComponents()));
        }
        return out;
    }

    async toHtml(): Promise<string> {
        const isLazy = await this.isLazyLoaded();
        if (isLazy && typeof (this.livewire as any).isDeferredSchemaLoaded === 'function' && !(await (this.livewire as any).isDeferredSchemaLoaded(this))) return this.toDeferredLoadingHtml();
        const withVisibility = await Promise.all(this._components.map(async (c) => [c, await c.isVisible()] as const));
        if (!withVisibility.some(([, v]) => v)) return '';
        const attributes = new Attributes(this._extraClass ? { class: this._extraClass } : {})
            .when(!this._inline, (a) => a.grid(this._columns))
            .merge({
                'wire:partial': this._partialName ?? (this._partial ? `schema.${this._key}` : isLazy ? `schema.${this.getLazyKey()}` : null),
                'x-data': this._root ? `filamentSchema({ livewireId: ${js(this.livewire.id)}, schemaKey: ${js(this._key)} })` : null,
                'x-on:form-validation-error.window': this._root ? 'handleFormValidationError' : null,
                'x-on:reset-schema-component-state.window': this._root ? 'handleClientSideStateReset' : null,
            })
            .class(['fi-sc', { 'fi-inline': this._inline }, { 'fi-sc-has-gap': this.hasGap() }, { 'fi-sc-dense': this.isDense() }]);
        const parts: string[] = [];
        for (const [component, isVisible] of withVisibility) {
            if (!component.isLiberatedFromContainerGrid()) parts.push(await component.toSchemaHtml(isVisible));
            else if (isVisible) parts.push(`<div class="fi-sc-liberated" wire:key="${e(component.getLivewireKey() ?? '')}" x-data="filamentSchemaComponent(${js(component.getAlpineScopeConfiguration())})">${await component.toHtml()}</div>`);
        }
        return `<div ${attributes.toHtml()}>${parts.join('')}</div>`;
    }
    /** Placeholder of a lazy schema: a loading indicator that asks for the schema when it enters the viewport. */
    toDeferredLoadingHtml(): string {
        const key = this.getLazyKey();
        const attributes = new Attributes(this._extraClass ? { class: this._extraClass } : {}).merge({ 'wire:partial': `schema.${key}`, 'x-data': `filamentSchema({ livewireId: ${js(this.livewire.id)}, schemaKey: ${js(key)}, isLoadingDeferred: true })`, role: 'status', 'aria-busy': 'true' }).class(['fi-sc', 'fi-sc-loading']);
        return `<div ${attributes.toHtml()}>${loadingIndicator(new Attributes(), 'lg')}<span class="fi-sr-only">${e(t('filament::components/loading-section.label'))}</span></div>`;
    }
}

/** Child schema of a layout component: shares the parent's key and state path, without being a root. */
export function childSchema(parent: Component, components: Component[]): Schema {
    const c = parent.container;
    const schema = new Schema(c.livewire).key(c.getKey()).statePath(c.getStatePath() || null).operation(c.getOperation()).record(c.getRecord()).root(false).parentComponent(parent).components(components);
    const lazy = parent.getLazyLoadedCondition();
    if (lazy !== false) schema.lazyLoaded(typeof lazy === 'function' ? () => evaluate(lazy, parent.context()) : lazy).lazyKey(parent.getKey());
    return schema;
}

/** Stateful group: its children live under `<container path>.<name>` (used by filter forms). */
export class StatefulGroup extends Component {
    private children: Component[];
    constructor(name: string, children: Component[]) { super(); this._name = name; this.children = children; }
    static make(name: string, children: Component[]): StatefulGroup { return configured(new StatefulGroup(name, children)); }
    hasStatePath(): boolean { return true; }
    getChildSchemas(): Schema[] {
        const c = this.container;
        return [new Schema(c.livewire).key(this.getKey()!).statePath(this.getStatePath()).operation(c.getOperation()).record(c.getRecord()).root(false).parentComponent(this).components(this.children)];
    }
    async toHtml(): Promise<string> { return `<div id="${e(this.getKey()!)}">${await this.getChildSchemas()[0].toHtml()}</div>`; }
}

/** Groups components in a grid, without any chrome. */
export class Group extends Component {
    protected children: Component[];
    protected _columns: Record<string, number> | number | null = {};
    constructor(children: Component[] = []) { super(); this.children = children; }
    static make(children: Component[] = []): Group { return configured(new Group(children)); }
    schema(components: Component[]): this { this.children = components; return this; }
    columns(columns: Record<string, number> | number | null): this { this._columns = columns; return this; }
    /** State path of the components, relative to the container (`address`: their state lives under `address.*`). */
    statePath(path: string | null): this { this._name = path; return this; }
    hasStatePath(): boolean { return this._name !== null; }
    getChildSchemas(): Schema[] {
        const schema = childSchema(this, this.children).columns(this._columns);
        if (this.hasStatePath()) schema.key(this.getKey()!).statePath(this.getStatePath());
        return [schema];
    }
    async toHtml(): Promise<string> {
        const attributes = new Attributes().merge({ ...this._extraAttributes }).toHtml();
        return `<div${attributes ? ` ${attributes}` : ''}>${await this.getChildSchemas()[0].toHtml()}</div>`;
    }
}

/** Column grid: two columns from `lg` by default. */
export class Grid extends Group {
    constructor(columns: Record<string, number> | number = 2) { super(); this._columns = columns; }
    static make(columns: Record<string, number> | number | Component[] = 2): Grid { return configured(new Grid(Array.isArray(columns) ? 2 : columns)); }
}

/**
 * Components side by side from a breakpoint: each fills the available space,
 * except those marked `grow(false)`, which keep their natural width.
 */
export class Flex extends Component {
    private children: Component[];
    private _from = 'sm';
    constructor(children: Component[] = []) { super(); this.children = children; }
    static make(children: Component[] = []): Flex { return configured(new Flex(children)); }
    schema(components: Component[]): this { this.children = components; return this; }
    from(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl'): this { this._from = breakpoint; return this; }
    getChildSchemas(): Schema[] { return [childSchema(this, this.children)]; }
    async toHtml(): Promise<string> {
        const parts: string[] = [];
        for (const component of this.getChildSchemas()[0].getComponents()) {
            if (!(await component.isVisible())) continue;
            parts.push(`<div wire:key="${e(component.getLivewireKey() ?? '')}" x-data="filamentSchemaComponent(${js(component.getAlpineScopeConfiguration())})"${component.canGrow() ? ' class="fi-growable"' : ''}>${await component.toHtml()}</div>`);
        }
        return `<div class="fi-sc-flex fi-from-${this._from}">${parts.join('')}</div>`;
    }
}

export const slug = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Footer alignment (`start`, `center`, `end`, `between`; `right` and `justify` are aliases) as an inline schema alignment. */
const footerAlignment = (alignment: string): string => (['right', 'end'].includes(alignment) ? 'end' : alignment === 'justify' ? 'between' : ['start', 'center', 'between'].includes(alignment) ? alignment : 'start');

/**
 * Card grouping components, with an optional header (icon, heading, description, components after the header)
 * and footer (actions or components).
 */
export class Section extends Component {
    private children: Component[] = [];
    private _columns: Record<string, number> | number | null = {};
    private _heading: Lazy<string | null, ComponentContext>;
    private _description: Lazy<string | null, ComponentContext> = null;
    private _icon: Lazy<string | null, ComponentContext> = null;
    private _iconColor: Lazy<string | null, ComponentContext> = null;
    private _iconSize: string | null = null;
    private _afterHeader: InlineItem[] | null = null;
    private _headerActions: Renderable[] = [];
    private _footer: InlineItem[] | null = null;
    private _footerActions: Renderable[] = [];
    private _footerActionsAlignment = 'start';
    private _aside: Lazy<boolean, ComponentContext> = false;
    private _contentBefore: Lazy<boolean, ComponentContext> = false;
    private _compact: Lazy<boolean, ComponentContext> = false;
    private _secondary: Lazy<boolean, ComponentContext> = false;
    private _divided: Lazy<boolean, ComponentContext> = false;
    private _contained: Lazy<boolean, ComponentContext> = true;
    private _collapsible: Lazy<boolean, ComponentContext> | null = null;
    private _collapsed: Lazy<boolean, ComponentContext> = false;
    private _persistCollapsed: Lazy<boolean, ComponentContext> = false;
    constructor(heading: Lazy<string | null, ComponentContext> = null) { super(); this._heading = heading; }
    static make(heading: Lazy<string | null, ComponentContext> = null): Section { return configured(new Section(heading)); }
    schema(components: Component[]): this { this.children = components; return this; }
    columns(columns: Record<string, number> | number | null): this { this._columns = columns; return this; }
    /** Heading: a string or a function of the context object. */
    heading(heading: Lazy<string | null, ComponentContext>): this { this._heading = heading; return this; }
    /** Text under the heading. */
    description(description: Lazy<string | null, ComponentContext>): this { this._description = description; return this; }
    /** Header icon (Heroicons name). */
    icon(name: Lazy<string | null, ComponentContext>): this { this._icon = name; return this; }
    /** Header icon color (`gray` by default). */
    iconColor(color: Lazy<string | null, ComponentContext>): this { this._iconColor = color; return this; }
    /** Header icon size (`lg` by default). */
    iconSize(size: string | null): this { this._iconSize = size; return this; }
    /** Heading and description on the left, the content in a card on the right (from the `md` breakpoint). */
    aside(condition: Lazy<boolean, ComponentContext> = true): this { this._aside = condition; return this; }
    /** With `aside()`: the content before the heading and description. */
    contentBefore(condition: Lazy<boolean, ComponentContext> = true): this { this._contentBefore = condition; return this; }
    /** Smaller paddings, for nested sections. */
    compact(condition: Lazy<boolean, ComponentContext> = true): this { this._compact = condition; return this; }
    /** Less contrasting background, for a section on a background of the same color (nested sections…). */
    secondary(condition: Lazy<boolean, ComponentContext> = true): this { this._secondary = condition; return this; }
    /** Dividing lines between the components of the content. */
    divided(condition: Lazy<boolean, ComponentContext> = true): this { this._divided = condition; return this; }
    /** `false`: no card around the section. */
    contained(condition: Lazy<boolean, ComponentContext> = true): this { this._contained = condition; return this; }
    /** Collapsible by clicking its header; `collapsed()` starts it collapsed. */
    collapsible(condition: Lazy<boolean, ComponentContext> = true): this { this._collapsible = condition; return this; }
    collapsed(condition: Lazy<boolean, ComponentContext> = true): this { this._collapsed = condition; if (this._collapsible === null) this._collapsible = condition; return this; }
    /** Keeps the collapsed state in the browser's local storage, under the section's key. */
    persistCollapsed(condition: Lazy<boolean, ComponentContext> = true): this { this._persistCollapsed = condition; return this; }
    /** Components and actions shown after the heading; replaces `headerActions()`. */
    afterHeader(items: InlineItem[] | null): this { this._afterHeader = items; return this; }
    /** Actions shown after the heading (when `afterHeader()` is not used). */
    headerActions(actions: Renderable[]): this { this._headerActions = [...this._headerActions, ...actions]; return this; }
    /** Components and actions in the footer; replaces `footerActions()`. */
    footer(items: InlineItem[] | null): this { this._footer = items; return this; }
    /** Actions in the footer (when `footer()` is not used). */
    footerActions(actions: Renderable[]): this { this._footerActions = [...this._footerActions, ...actions]; return this; }
    /** Footer actions alignment (`start`, `center`, `end`, `between`). */
    footerActionsAlignment(alignment: string): this { this._footerActionsAlignment = alignment; return this; }
    private getHeaderItems(): InlineItem[] { return this._afterHeader ?? this._headerActions; }
    private getFooterItems(): InlineItem[] { return this._footer ?? this._footerActions; }
    /** Actions the section exposes for mounting (header and footer). */
    getActions(): Renderable[] { return [...actionsOf(this.getHeaderItems()), ...actionsOf(this.getFooterItems())]; }
    /** Heading used for the key: a function heading is only used when it returns a string synchronously. */
    private getHeadingForKey(): string | null {
        if (typeof this._heading !== 'function') return this._heading;
        let value: unknown;
        try { value = (this._heading as (ctx: ComponentContext) => unknown)(this.context()); } catch { return null; }
        // An async heading is not awaited here: its failure is reported when the section renders.
        if (value instanceof Promise) value.catch(() => {});
        return typeof value === 'string' ? value : null;
    }
    /** Key derived from the heading (`rate-limiting::data::section`), unless a `key()` is set. */
    getKey(): string | null {
        if (this._keyName !== null) return super.getKey();
        const heading = this.getHeadingForKey();
        if (isBlank(heading)) return null;
        const statePath = this.container.getStatePath();
        return `${this.container.getKey()}.${slug(heading!)}::${statePath ? `${statePath}::` : ''}section`;
    }
    getHeadingsCount(): number { return typeof this._heading === 'function' || !isBlank(this._heading) ? 1 : 0; }
    getChildSchemas(): Schema[] { return [childSchema(this, this.children).columns(this._columns).extraClass('fi-section-content')]; }
    async toHtml(): Promise<string> {
        const ctx = this.context();
        const [content] = this.getChildSchemas();
        const id = this.getKey();
        const heading = await evaluate(this._heading, ctx);
        const description = await evaluate(this._description, ctx);
        const iconName = await evaluate(this._icon, ctx);
        const isAside = Boolean(await evaluate(this._aside, ctx));
        const isCollapsible = Boolean(await evaluate(this._collapsible ?? false, ctx)) && !isAside;
        const isCollapsed = Boolean(await evaluate(this._collapsed, ctx));
        const shouldPersistCollapsed = Boolean(await evaluate(this._persistCollapsed, ctx));
        const hasHeading = !isBlank(heading), hasDescription = !isBlank(description), hasIcon = !isBlank(iconName);
        const afterHeader = await renderInlineItems(this, this.getHeaderItems(), { alignment: 'end' });
        const footer = await renderInlineItems(this, this.getFooterItems(), { alignment: this._footer === null ? footerAlignment(this._footerActionsAlignment) : null });
        const contentHtml = await content.toHtml();
        const hasHeader = hasIcon || hasHeading || hasDescription || isCollapsible || afterHeader !== '';
        const hasContent = contentHtml !== '' || footer !== '';
        const contentId = id !== null && hasContent ? `${id}-content` : null;
        const headingId = id !== null && hasHeading ? `${id}-heading` : null;
        const descriptionId = id !== null && hasDescription ? `${id}-description` : null;
        const outer = new Attributes().merge({ id, ...this._extraAttributes }).class(['fi-sc-section']);
        // Collapsible section: listens to `collapse-section` / `expand-section`… window events, with a toggle button in the header.
        // A persisted state lives in local storage, under the section's key (or its element id).
        const idTest = `if ($event.detail.id == (${js(id)} ?? $el.id))`;
        const collapse = isCollapsible ? ` x-on:collapse-section.window="${e(`${idTest} isCollapsed = true`)}" x-on:expand="isCollapsed = false" x-on:expand-section.window="${e(`${idTest} isCollapsed = false`)}" x-on:open-section.window="${e(`${idTest} isCollapsed = false`)}" x-on:toggle-section.window="${e(`${idTest} isCollapsed = ! isCollapsed`)}"${shouldPersistCollapsed ? '' : ` x-on:reset-schema-component-state.window="${e(`if (($event.detail.livewireId === ${js(this.livewire.id)}) && ($event.detail.schemaKey === ${js(this.container.getKey().split('.')[0])})) $nextTick(() => isCollapsed = ${isCollapsed ? 'true' : 'false'})`)}"`} x-bind:class="isCollapsed &amp;&amp; 'fi-collapsed'"` : '';
        const collapsedState = shouldPersistCollapsed ? e(`$persist(${isCollapsed ? 'true' : 'false'}).as(\`filament:section:collapsed:\${${js(id)} ?? $el.id}\`)`) : (isCollapsed ? 'true' : 'false');
        const sectionClass = cls(['fi-section', {
            'fi-section-not-contained': !(await evaluate(this._contained, ctx)),
            'fi-section-has-content-before': Boolean(await evaluate(this._contentBefore, ctx)),
            'fi-section-has-header': hasHeader,
            'fi-aside': isAside,
            'fi-compact': Boolean(await evaluate(this._compact, ctx)),
            'fi-collapsible': isCollapsible,
            'fi-collapsed': isCollapsible && isCollapsed,
            'fi-divided': Boolean(await evaluate(this._divided, ctx)),
            'fi-secondary': Boolean(await evaluate(this._secondary, ctx)),
        }]);
        let header = '';
        if (hasHeader) {
            const iconColor = (await evaluate(this._iconColor, ctx)) ?? 'gray';
            const iconHtml = hasIcon ? icon(iconName!, { size: safeClass(this._iconSize) ?? 'lg', attributes: new Attributes().class(plainColorClasses(iconColor)) }) : '';
            const tag = this.getHeadingTag();
            const text = hasHeading || hasDescription ? `<div class="fi-section-header-text-ctn">${hasHeading ? `<${tag}${headingId ? ` id="${e(headingId)}"` : ''} class="fi-section-header-heading">${e(heading)}</${tag}>` : ''}${hasDescription ? `<p${descriptionId ? ` id="${e(descriptionId)}"` : ''} class="fi-section-header-description">${e(description)}</p>` : ''}</div>` : '';
            const headerContent = hasHeading || hasDescription || afterHeader ? `<div class="${cls(['fi-section-header-content', { 'fi-section-header-content-has-heading': hasHeading || hasDescription }])}">${text}${afterHeader ? `<div class="fi-section-header-after-ctn">${afterHeader}</div>` : ''}</div>` : '';
            const collapseButton = isCollapsible ? `<button type="button" x-on:click.stop="isCollapsed = ! isCollapsed" aria-label="${e(t(isCollapsed ? 'filament::components/section.actions.expand.label' : 'filament::components/section.actions.collapse.label'))}" x-bind:aria-label="isCollapsed ? ${e(js(t('filament::components/section.actions.expand.label')))} : ${e(js(t('filament::components/section.actions.collapse.label')))}" aria-expanded="${isCollapsed ? 'false' : 'true'}" x-bind:aria-expanded="(! isCollapsed).toString()"${contentId ? ` aria-controls="${e(contentId)}"` : ''} class="fi-icon-btn fi-size-md fi-section-collapse-btn">${icon('m-chevron-up', { alias: 'section.collapse-button' })}</button>` : '';
            header = `<header${isCollapsible ? ` x-on:click="if (! $event.target.closest('.fi-section-header-after-ctn')) isCollapsed = ! isCollapsed"` : ''} class="fi-section-header">${iconHtml}${headerContent}${collapseButton}</header>`;
        }
        const body = hasContent ? `<div${contentId ? ` id="${e(contentId)}"` : ''}${isCollapsible && (isCollapsed || shouldPersistCollapsed) ? ' x-cloak' : ''} class="fi-section-content-ctn">${contentHtml}${footer ? `<footer class="fi-section-footer">${footer}</footer>` : ''}</div>` : '';
        return `<div ${outer.toHtml()}><section x-data="{
                isCollapsed: ${collapsedState},
            }"${collapse}${headingId ? ` aria-labelledby="${e(headingId)}"` : ''}${descriptionId ? ` aria-describedby="${e(descriptionId)}"` : ''} class="${sectionClass}">${header}${body}</section></div>`;
    }
}

/**
 * Raw markup in a schema. The content is inserted AS IS: never put a user- or database-supplied value in it
 * without escaping it with `e()` from `@navette-js/support`.
 */
export class Html extends Component {
    private content: string | ((ctx: ComponentContext) => string | Promise<string>);
    constructor(content: string | ((ctx: ComponentContext) => string | Promise<string>)) { super(); this.content = content; }
    static make(content: string | ((ctx: ComponentContext) => string | Promise<string>)): Html { return new Html(content); }
    async toHtml(): Promise<string> { return typeof this.content === 'function' ? this.content(this.context()) : this.content; }
}

/** A tab of a Tabs component: a label, an optional icon and badge, and its own schema. */
export class Tab extends Component {
    private children: Component[] = [];
    private _columns: Record<string, number> | number | null = {};
    private _icon: string | null = null;
    private _iconPosition: 'before' | 'after' = 'before';
    private _badge: Lazy<string | number | null, ComponentContext> = null;
    private _badgeColor: Lazy<string | null, ComponentContext> = null;
    private _badgeIcon: string | null = null;
    private _badgeIconPosition: 'before' | 'after' = 'before';
    private _badgeTooltip: Lazy<string | null, ComponentContext> = null;
    private label: string;
    constructor(label: string) { super(); this.label = label; this._keyName = `${slug(label)}::data::tab`; }
    static make(label: string): Tab { return configured(new Tab(label)); }
    schema(components: Component[]): this { this.children = components; return this; }
    columns(columns: Record<string, number> | number | null): this { this._columns = columns; return this; }
    icon(name: string | null): this { this._icon = name; return this; }
    /** Icon before (default) or after the label. */
    iconPosition(position: 'before' | 'after'): this { this._iconPosition = position === 'after' ? 'after' : 'before'; return this; }
    /** Badge after the label (a count…); a function receives the context object. */
    badge(badge: Lazy<string | number | null, ComponentContext>): this { this._badge = badge; return this; }
    /** Badge color (`primary` by default). */
    badgeColor(color: Lazy<string | null, ComponentContext>): this { this._badgeColor = color; return this; }
    badgeIcon(name: string | null): this { this._badgeIcon = name; return this; }
    badgeIconPosition(position: 'before' | 'after'): this { this._badgeIconPosition = position === 'after' ? 'after' : 'before'; return this; }
    /** Tooltip of the badge (plain text). */
    badgeTooltip(text: Lazy<string | null, ComponentContext>): this { this._badgeTooltip = text; return this; }
    getLabel(): string { return this.label; }
    getIcon(): string | null { return this._icon; }
    getIconPosition(): 'before' | 'after' { return this._iconPosition; }
    async getBadge(): Promise<{ label: string; color: string; icon: string | null; iconPosition: 'before' | 'after'; tooltip: string | null } | null> {
        const ctx = this.context();
        const badge = await evaluate(this._badge, ctx);
        if (isBlank(badge)) return null;
        return { label: String(badge), color: (await evaluate(this._badgeColor, ctx)) ?? 'primary', icon: this._badgeIcon, iconPosition: this._badgeIconPosition, tooltip: await evaluate(this._badgeTooltip, ctx) };
    }
    /** Browser-side tab key (no schema prefix): `::data::` follows the schema state path, and is dropped in infolists. */
    getTabKey(): string { const statePath = this.container.getStatePath(); return this._keyName!.replace('::data::', statePath ? `::${statePath}::` : '::'); }
    getChildSchemas(): Schema[] { return [childSchema(this, this.children).columns(this._columns)]; }
    async toHtml(): Promise<string> { return this.getChildSchemas()[0].toHtml(); }
}

/** Badge colors of a tab: computed shades when a color manager is available. */
const badgeColorClasses = (component: Component, color: string): string[] => colorsFor(component)?.getComponentClasses('badge', color) ?? plainColorClasses(color);
const badgeTooltipAttribute = (tooltip: string | null): string => (tooltip ? ` x-tooltip="${e(`{ content: ${js(tooltip)}, theme: $store.theme, allowHTML: false }`)}"` : '');

/**
 * Layout tabs: every panel is rendered, the browser only shows the active one.
 * The active tab may be persisted in local storage (`persistTab()`) or in the URL (`persistTabInQueryString()`):
 * the browser only selects a persisted key when it matches an existing tab.
 */
export class Tabs extends Component {
    private tabs: Tab[] = [];
    private label: string;
    private _activeTab: Lazy<number, ComponentContext> = 1;
    private _persistTab: Lazy<boolean, ComponentContext> = false;
    private _tabQueryStringKey: string | null = null;
    private _vertical: Lazy<boolean, ComponentContext> = false;
    private _contained: Lazy<boolean, ComponentContext> = true;
    private _scrollable: Lazy<boolean, ComponentContext> = true;
    constructor(label: string) { super(); this.label = label; this._keyName = `${slug(label)}::data::tabs`; }
    static make(label: string): Tabs { return configured(new Tabs(label)); }
    schema(tabs: Tab[]): this { this.tabs = tabs; return this; }
    /** Tab active when the page loads (1-based, among the visible tabs). */
    activeTab(tab: Lazy<number, ComponentContext>): this { this._activeTab = tab; return this; }
    /** Remembers the active tab in the browser's local storage, under the key of the tabs. */
    persistTab(condition: Lazy<boolean, ComponentContext> = true): this { this._persistTab = condition; return this; }
    /** Keeps the active tab in the URL's query string (`?tab=…`); `null` disables it. */
    persistTabInQueryString(key: string | null = 'tab'): this { this._tabQueryStringKey = key === null || key.trim() === '' ? null : key; return this; }
    /** Tab headers on the side of the panels (from the `md` breakpoint). */
    vertical(condition: Lazy<boolean, ComponentContext> = true): this { this._vertical = condition; return this; }
    /** `false`: no card around the tabs. */
    contained(condition: Lazy<boolean, ComponentContext> = true): this { this._contained = condition; return this; }
    /** `false`: tabs that do not fit are moved to a "more" dropdown instead of scrolling. */
    scrollable(condition: Lazy<boolean, ComponentContext> = true): this { this._scrollable = condition; return this; }
    getExposedMethods(): string[] { return ['getLazyLoadedTabBadges', 'getDeferredTabBadges']; }
    getLazyLoadedTabBadges(): Record<string, unknown> { return {}; }
    getDeferredTabBadges(): Record<string, unknown> { return {}; }
    getChildSchemas(): Schema[] { return [childSchema(this, this.tabs)]; }
    /** Active tab (1-based): the query string's tab when it names a visible tab, otherwise `activeTab()`. */
    private async getActiveTab(visible: Tab[]): Promise<number> {
        if (this._tabQueryStringKey !== null) {
            const requested = (this.livewire as any)._ctx?.req?.query?.[this._tabQueryStringKey];
            const index = typeof requested === 'string' ? visible.findIndex((tab) => tab.getTabKey() === requested) : -1;
            if (index !== -1) return index + 1;
        }
        const active = await evaluate(this._activeTab, this.context());
        return Number.isInteger(active) && active >= 1 ? active : 1;
    }
    async toHtml(): Promise<string> {
        // Building the child schema attaches the tabs to their container, which is what gives them their keys.
        this.getChildSchemas();
        const ctx = this.context();
        const key = this.getKey()!;
        const id = this.livewire.id;
        const q = (k: string) => js(k);
        const tabId = (tab: Tab) => `fi-sc-tab-${createHash('md5').update(tab.getKey()!).digest('hex')}`;
        const visible: Tab[] = [];
        for (const tab of this.tabs) if (await tab.isVisible()) visible.push(tab);
        const isContained = Boolean(await evaluate(this._contained, ctx));
        const isVertical = Boolean(await evaluate(this._vertical, ctx));
        const isScrollable = Boolean(await evaluate(this._scrollable, ctx));
        const isTabPersisted = Boolean(await evaluate(this._persistTab, ctx));
        const activeTab = await this.getActiveTab(visible);
        const badges = await Promise.all(visible.map((tab) => tab.getBadge()));
        const badgeHtml = (badge: NonNullable<Awaited<ReturnType<Tab['getBadge']>>>, withIcon: boolean) => {
            const badgeIcon = withIcon && badge.icon ? icon(badge.icon, { size: 'sm' }) : '';
            return `<span${badgeTooltipAttribute(badge.tooltip)} class="${cls(['fi-badge', 'fi-size-sm', ...badgeColorClasses(this, badge.color)])}">${badge.iconPosition === 'before' ? badgeIcon : ''}<span class="fi-badge-label-ctn"><span class="fi-badge-label">${e(badge.label)}</span></span>${badge.iconPosition === 'after' ? badgeIcon : ''}</span>`;
        };
        const buttons = visible.map((tab, index) => {
            const k = tab.getTabKey();
            const tabIcon = tab.getIcon() ? icon(tab.getIcon()!) : '';
            const badge = badges[index];
            return `<button type="button" x-bind:class="{
 'fi-active': isTabSelected(${q(k)}),
 'fi-sc-tabs-header-overflow': overflowTabs.includes(${q(k)}),
 'fi-sc-tabs-header-overflow-open': isOverflowOpen &amp;&amp; overflowTabs.includes(${q(k)}),
 }" id="${tabId(tab)}" role="tab" aria-controls="${e(tab.getKey()!)}" tabindex="-1" x-bind:tabindex="getTabIndex(${q(k)})" data-tab-key="${e(k)}" x-bind:data-tab-available="Boolean(true).toString()" x-bind:aria-selected="isTabSelected(${q(k)})" x-on:click="selectTab(${q(k)}, $event)" x-show="true" class="fi-tabs-item">${tab.getIconPosition() === 'before' ? tabIcon : ''}<span class="fi-tabs-item-label">${e(tab.getLabel())}</span>${tab.getIconPosition() === 'after' ? tabIcon : ''}${badge ? badgeHtml(badge, true) : ''}</button>`;
        });
        // Not scrollable: tabs that do not fit move to an overflow dropdown, opened from a "more" trigger.
        let overflow = '';
        if (!isScrollable) {
            const more = t('filament-schemas::components.tabs.actions.more.label');
            const triggers = visible.map((tab, index) => {
                const k = tab.getTabKey();
                const badge = badges[index];
                return `<button type="button" tabindex="-1" aria-hidden="true" data-tabs-overflow-trigger="data-tabs-overflow-trigger" data-tab-trigger-key="${e(k)}" aria-label="${e(`${more}: ${tab.getLabel()}`)}" x-show="overflowReady &amp;&amp; overflowTabs.includes(${q(k)}) &amp;&amp; isTabSelected(${q(k)})" class="fi-tabs-item fi-active">${icon('m-chevron-down', { alias: 'schemas::components.tabs.dropdown-trigger-button' })}<span class="fi-tabs-item-label">${e(tab.getLabel())}</span>${badge ? badgeHtml(badge, false) : ''}</button>`;
            });
            const items = visible.map((tab, index) => {
                const k = tab.getTabKey();
                const badge = badges[index];
                const listBadge = badge ? `<span${badgeTooltipAttribute(badge.tooltip)} class="${cls(['fi-badge', ...badgeColorClasses(this, badge.color)])}">${e(badge.label)}</span>` : '';
                return `<div data-tab-menu-key="${e(k)}" x-bind:aria-disabled="availableTabs.includes(${q(k)}) ? 'false' : 'true'" x-show="(true) &amp;&amp; overflowTabs.includes(${q(k)})" class="fi-dropdown-list-item fi-sc-tabs-overflow-placeholder">${tab.getIcon() ? icon(tab.getIcon()!) : ''}<span class="fi-dropdown-list-item-label">${e(tab.getLabel())}</span>${listBadge}</div>`;
            });
            overflow = `<div aria-hidden="true" class="fi-dropdown"><div x-on:mousedown="if ($event.button === 0) { $event.preventDefault(); toggleOverflow() }" class="fi-dropdown-trigger">${triggers.join('')}<button type="button" data-tabs-overflow-trigger data-tabs-overflow-ellipsis tabindex="-1" aria-hidden="true" aria-label="${e(more)}" class="fi-tabs-item" x-show="! overflowReady || (overflowTabs.some(key =&gt; availableTabs.includes(key)) &amp;&amp; ! overflowTabs.includes(tab))"><span class="fi-tabs-item-label">${icon('m-ellipsis-horizontal', { alias: 'schemas::components.tabs.more-tabs-button' })}</span></button></div><div x-cloak x-ref="overflowPanel" x-show="isOverflowOpen" aria-hidden="true" x-on:mousedown.self.prevent x-on:scroll="scheduleUpdate()" x-on:click.outside="if (! $el.closest('.fi-sc-tabs').querySelector('[x-ref=tablist]').contains($event.target) &amp;&amp; ! getOverflowTrigger()?.contains($event.target)) dismissOverflow()" class="fi-dropdown-panel fi-sc-tabs-overflow-panel"><div class="fi-dropdown-list">${items.join('')}</div></div></div>`;
        }
        const panels: string[] = [];
        for (const tab of visible) {
            const k = tab.getTabKey();
            panels.push(`<div aria-labelledby="${tabId(tab)}" id="${e(tab.getKey()!)}" role="tabpanel" tabindex="0" wire:key="${e(`${id}.${tab.getKey()}`)}.container" x-show="true" x-bind:class="{ 'fi-active': isTabSelected(${q(k)}) }" x-on:expand="revealTab(${q(k)})" x-data="filamentSchemaComponent(${e(js(tab.getAlpineScopeConfiguration()))})" class="fi-sc-tabs-tab">${await tab.toHtml()}</div>`);
        }
        const outer = new Attributes().merge({ id: key, 'wire:key': `${id}.${key}.container`, ...this._extraAttributes }).class(['fi-sc-tabs', { 'fi-contained': isContained, 'fi-vertical': isVertical }]);
        const nav = new Attributes({ 'x-ref': 'tabsHeader' }).class(['fi-tabs', { 'fi-contained': isContained, 'fi-vertical': isVertical }])
            .when(!isScrollable, (a) => a.merge({ 'x-bind:class': "{ 'fi-invisible': ! overflowReady }" }))
            .merge({ 'x-cloak': true });
        const tablistExtra = `${isVertical ? ` x-bind:aria-orientation="hasVisibleTabHeaders ? 'vertical' : null"` : ''} x-on:keydown="handleKeydown($event)"${isScrollable ? '' : ` x-on:dropdown-escape="if (isOverflowOpen) { $event.preventDefault(); $event.stopPropagation(); dismissOverflow() }" x-on:wheel="scrollOverflow($event)" x-on:touchstart="scrollOverflow($event)" x-on:touchmove="scrollOverflow($event)"`}`;
        const persistedTab = isTabPersisted ? e(`$persist(null).as(${js(`filament:tabs:active:${key}`)})`) : 'null';
        return `<div x-data="tabsSchemaComponent({
 activeTab: ${activeTab},
 hasTabPanels: true,
 isScrollable: ${isScrollable ? 'true' : 'false'},
 isVertical: ${isVertical ? 'true' : 'false'},
 isTabPersisted: ${isTabPersisted ? 'true' : 'false'},
 isTabPersistedInQueryString: ${this._tabQueryStringKey !== null ? 'true' : 'false'},
 livewireId: ${e(js(id))},
 schemaKey: ${e(js(key.split('.')[0]))},
 tab: ${persistedTab},
 tabQueryStringKey: ${e(js(this._tabQueryStringKey))},
 })" x-load x-load-src="${e(views.render('filament-schemas::asset', { path: 'tabs' }).trim())}"${isScrollable ? '' : ' x-on:resize.window="scheduleUpdate(true)"'} wire:ignore.self ${outer.toHtml()}><div ${nav.toHtml()}><div x-ref="tablist" role="tablist" x-bind:role="hasVisibleTabHeaders ? 'tablist' : 'group'" aria-label="${e(this.label)}"${tablistExtra} class="fi-sc-tabs-tablist">${buttons.join('')}</div>${overflow}</div>${panels.join('')}</div>`;
    }
}

/** Render hook injection point, using the host's scopes. Liberated from the container grid. */
export class RenderHook extends Component {
    private hook: string;
    constructor(hook: string) { super(); this.hook = hook; }
    static make(hook: string): RenderHook { return configured(new RenderHook(hook)); }
    isLiberatedFromContainerGrid(): boolean { return true; }
    async toHtml(): Promise<string> { return renderHook(this.hook, (this.livewire as any).getRenderHookScopes?.() ?? []); }
}

/** Embeds another schema of the host (`form`, `infolist`…) as a root schema. */
export class EmbeddedSchema extends Component {
    private schemaName: string;
    constructor(name: string) { super(); this.schemaName = name; }
    static make(name: string): EmbeddedSchema { return configured(new EmbeddedSchema(name)); }
    async toHtml(): Promise<string> { return (await this.livewire.getSchema(this.schemaName)).toHtml(); }
}

/** `<form>` element: content and footer (actions), submitted to a host method. */
export class Form extends Component {
    private children: Component[];
    private _footer: Component[] = [];
    private _id: string | null = null;
    private _submit: string | null = null;
    constructor(children: Component[]) { super(); this.children = children; }
    static make(children: Component[] = []): Form { return configured(new Form(children)); }
    id(id: string): this { this._id = id; return this; }
    livewireSubmitHandler(method: string): this { this._submit = method; return this; }
    footer(components: Component[]): this { this._footer = components; return this; }
    getChildSchemas(): Schema[] { return [childSchema(this, this.children), childSchema(this, this._footer)]; }
    async toHtml(): Promise<string> {
        const attributes = new Attributes().merge({ id: this._id, 'wire:submit': this._submit }).class(['fi-sc-form']);
        const [content, footer] = this.getChildSchemas();
        return `<form ${attributes.toHtml()}>${await content.toHtml()}${await footer.toHtml()}</form>`;
    }
}

/** Item rendered in an actions container: in practice an Action (actions package). */
export interface Renderable { isVisible(ctx: ComponentContext): Promise<boolean>; toHtml(ctx: ComponentContext): Promise<string> }

/** Row of actions in a schema. */
/** Content placed around a component: text, components and actions, or a function of the context returning them. */
export type ComponentSlot = Lazy<string | HtmlString | InlineItem | (string | HtmlString | InlineItem)[] | null, ComponentContext>;
export class Actions extends Component {
    private actions: Renderable[];
    private _fullWidth = false;
    private _alignment: string | null = null;
    private _label: Lazy<string | null, ComponentContext> = null;
    private _beforeLabel: ComponentSlot = null;
    private _afterLabel: ComponentSlot = null;
    private _aboveContent: ComponentSlot = null;
    private _belowContent: ComponentSlot = null;
    constructor(actions: Renderable[]) { super(); this.actions = actions; }
    static make(actions: Renderable[]): Actions { return configured(new Actions(actions)); }
    fullWidth(condition = true): this { this._fullWidth = condition; return this; }
    alignment(alignment: string | null): this { this._alignment = alignment; return this; }
    /** Label shown above the actions, like a field label. */
    label(label: Lazy<string | null, ComponentContext>): this { this._label = label; return this; }
    /** Text, components or actions before the label. */
    beforeLabel(content: ComponentSlot): this { this._beforeLabel = content; return this; }
    /** Text, components or actions after the label (a status badge…). */
    afterLabel(content: ComponentSlot): this { this._afterLabel = content; return this; }
    /** Text, components or actions between the label and the actions. */
    aboveContent(content: ComponentSlot): this { this._aboveContent = content; return this; }
    /** Text, components or actions below the actions. */
    belowContent(content: ComponentSlot): this { this._belowContent = content; return this; }
    /** Actions this component exposes for mounting (its key is sent with each of them). */
    getActions(): Renderable[] { return this.actions; }
    async toHtml(): Promise<string> {
        const ctx = this.context();
        const key = this.getKey();
        const mountContext = key !== null ? { ...((this.livewire as any)?.getActionMountContext?.() ?? {}), schemaComponent: key } : null;
        const visible: string[] = [];
        for (const a of this.actions) if (await a.isVisible(ctx)) visible.push(await (a as any).toHtml(ctx, mountContext));
        const label = await evaluate(this._label, ctx);
        const slot = (content: ComponentSlot) => renderSlot(this, content, key);
        const labelHtml = isBlank(label) ? '' : `<div class="fi-sc-actions-label-ctn">${await slot(this._beforeLabel)}<div class="fi-sc-actions-label">${e(label)}</div>${await slot(this._afterLabel)}</div>`;
        const above = await slot(this._aboveContent), below = await slot(this._belowContent);
        if (!visible.length && !labelHtml && !above && !below) return '';
        const inner = cls(['fi-ac', { 'fi-width-full': this._fullWidth }, this._alignment ? `fi-align-${this._alignment}` : null]);
        return `<div ${new Attributes().merge({ id: key, ...this._extraAttributes }).class(['fi-sc-actions']).toHtml()}>${labelHtml}${above}${visible.length ? `<div class="${inner}">${visible.join('')}</div>` : ''}${below}</div>`;
    }
}
/** Renders a slot of a component as an inline row: strings become `Text` components. */
export async function renderSlot(parent: Component, content: ComponentSlot, mountKey: string | null = null): Promise<string> {
    const value = await evaluate(content, parent.context());
    if (value === null || value === undefined || value === '') return '';
    const items = (Array.isArray(value) ? value : [value]).map((item) => (typeof item === 'string' || item instanceof HtmlString ? Text.make(item) : item)) as InlineItem[];
    return renderInlineItems(parent, items, { mountKey, actionView: 'link' });
}

let colorManager: ColorManager | null = null;
/** Color manager used outside a panel; inside a panel, the host panel's manager takes precedence. */
export const useColorManager = (manager: ColorManager) => { colorManager = manager; };
const colorsFor = (component: Component): ColorManager | null => (component.livewire as any)?.panel?.colors ?? colorManager;
/** Color classes without computed shades (icon, callout, empty state); none for gray, the default. */
const plainColorClasses = (color: string | null | undefined): string[] => (color && color !== 'gray' ? ['fi-color', `fi-color-${color.replace(/[^a-zA-Z0-9_-]/g, '')}`] : []);
/** Size or weight class: only class-name characters are kept. */
const safeClass = (value: string | null): string | null => (value ? value.replace(/[^a-zA-Z0-9_:-]/g, '') || null : null);
const tooltipExpression = (text: string | null): string | null => (text ? `{ content: ${js(text)}, theme: $store.theme, allowHTML: false }` : null);
const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (value instanceof HtmlString && value.html.trim() === '');
/** Escaped text, or an `HtmlString`'s HTML inserted as is (build it only from escaped values). */
const textOrHtml = (value: string | HtmlString | null): string => (value instanceof HtmlString ? value.html : e(value));

/** Item in an inline row: a schema component or an action. */
export type InlineItem = Component | Renderable;
/**
 * Inline row mixing components and actions (footers, controls, after a label).
 * Actions are mounted with `schemaComponent: mountKey` (the root schema by default, which finds them through the parent's `getActions()`).
 * `actionView`: `'button'` (full button), `'link'` (link, or icon button for an `iconButton()` action), `'auto'` (icon button if `iconButton()`, button otherwise).
 * `scope` overrides keys of the components' Alpine configuration (`path`, `containerPath`).
 */
export async function renderInlineItems(parent: Component, items: InlineItem[], options: { alignment?: string | null; scope?: Record<string, unknown>; mountKey?: string | null; actionView?: 'button' | 'link' | 'auto' } = {}): Promise<string> {
    const components = items.filter((item): item is Component => item instanceof Component);
    if (components.length) childSchema(parent, components).inline();
    const ctx = parent.context();
    const mountContext = { ...((parent.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: options.mountKey ?? parent.container.getKey() };
    const parts: string[] = [];
    for (const item of items) {
        if (item instanceof Component) {
            if (!(await item.isVisible())) continue;
            const key = item.getKey();
            const attributes = new Attributes().merge({
                'wire:partial': key !== null ? `schema-component::${key}` : null,
                'x-data': `filamentSchemaComponent(${js({ ...item.getAlpineScopeConfiguration(), ...(options.scope ?? {}) })})`,
                'wire:key': item.getLivewireKey(),
            });
            parts.push(`<div ${attributes.toHtml()}><div class="fi-sc-component">${await item.toHtml()}</div></div>`);
            continue;
        }
        if (!(await item.isVisible(ctx))) continue;
        const action = item as any;
        const view = options.actionView ?? 'button';
        const asLink = typeof action.toLinkHtml === 'function' && (view === 'link' || (view === 'auto' && action._iconButton === true));
        // The link rendering is shared with table rows: its row key, empty here, is stripped.
        const html = asLink ? String(await action.toLinkHtml(ctx, mountContext, '')).replace(' wire:key=""', '') : await action.toHtml(ctx, mountContext);
        parts.push(`<div class="fi-sc-action">${html}</div>`);
    }
    if (!parts.length) return '';
    return `<div class="${cls(['fi-sc', 'fi-inline', options.alignment ? `fi-align-${options.alignment}` : null, 'fi-sc-has-gap', 'fi-sc-dense'])}">${parts.join('')}</div>`;
}
/** Actions among inline items (expose them through `getActions()` so they can be mounted). */
const actionsOf = (items: InlineItem[]): Renderable[] => items.filter((item) => !(item instanceof Component)) as Renderable[];

/** Column-direction grid: items fill column by column. */
function columnGrid(columns: Record<string, number> | number | null): Attributes {
    const cols: Record<string, number> = typeof columns === 'number' ? { lg: columns } : { ...(columns ?? {}) };
    for (const key of Object.keys(cols)) if (!cols[key]) delete cols[key];
    cols.default ??= 1;
    const name = (breakpoint: string) => breakpoint.replace(/@/g, 'c').replace(/!/g, 'n');
    return new Attributes()
        .class(['fi-grid', 'fi-grid-direction-col', ...Object.keys(cols).map((breakpoint) => (breakpoint === 'default' ? (cols[breakpoint] > 1 ? 'fi-grid-cols' : '') : `${breakpoint}:fi-grid-cols`))])
        .style(Object.entries(cols).map(([breakpoint, count]) => `--cols-${name(breakpoint)}: ${count}`));
}

/**
 * Titled frame grouping fields: a legend and a two-column grid by default.
 * With `statePath()`, the fields live under that path and the fieldset gets a key (and an `id`).
 */
export class Fieldset extends Component {
    private children: Component[] = [];
    private _columns: Record<string, number> | number | null = 2;
    private _label: Lazy<string | null, ComponentContext>;
    private _hiddenLabel = false;
    private _contained = true;
    private _markedAsRequired = false;
    constructor(label: Lazy<string | null, ComponentContext> = null) { super(); this._label = label; }
    static make(label: Lazy<string | null, ComponentContext> = null): Fieldset { return configured(new Fieldset(label)); }
    schema(components: Component[]): this { this.children = components; return this; }
    columns(columns: Record<string, number> | number | null): this { this._columns = columns; return this; }
    label(label: Lazy<string | null, ComponentContext>): this { this._label = label; return this; }
    /** Keeps the legend for screen readers only. */
    hiddenLabel(condition = true): this { this._hiddenLabel = condition; return this; }
    /** `false`: no border or padding. */
    contained(condition = true): this { this._contained = condition; return this; }
    /** Asterisk after the legend (the fieldset itself is never validated). */
    markAsRequired(condition = true): this { this._markedAsRequired = condition; return this; }
    /** State path of the fields, relative to the container. */
    statePath(path: string | null): this { this._name = path; return this; }
    hasStatePath(): boolean { return this._name !== null; }
    getChildSchemas(): Schema[] {
        const schema = childSchema(this, this.children).columns(this._columns);
        if (this.hasStatePath()) schema.key(this.getKey()!).statePath(this.getStatePath());
        return [schema];
    }
    async toHtml(): Promise<string> {
        const label = await evaluate(this._label, this.context());
        const attributes = new Attributes().merge({ id: this.getKey(), ...this._extraAttributes })
            .class(['fi-sc-fieldset', 'fi-fieldset', { 'fi-fieldset-label-hidden': this._hiddenLabel, 'fi-fieldset-not-contained': !this._contained }]);
        const legend = isBlank(label) ? '' : `<legend>${e(label)}${this._markedAsRequired ? '<sup class="fi-fieldset-label-required-mark">*</sup>' : ''}</legend>`;
        return `<fieldset ${attributes.toHtml()}>${legend}${await this.getChildSchemas()[0].toHtml()}</fieldset>`;
    }
}

/**
 * Text in a schema: a plain `<span>`, or a badge with `badge()`. The content is escaped;
 * an `HtmlString` (from `@navette-js/support`) is inserted as is, so build it only from escaped values.
 */
export class Text extends Component {
    private _content: Lazy<string | HtmlString | null, ComponentContext>;
    private _badge: Lazy<boolean, ComponentContext> = false;
    private _color: Lazy<string | null, ComponentContext> = null;
    private _size: string | null = null;
    private _weight: string | null = null;
    private _fontFamily: string | null = null;
    private _icon: string | null = null;
    private _iconPosition: 'before' | 'after' = 'before';
    private _iconSize: string | null = null;
    private _tooltip: Lazy<string | null, ComponentContext> = null;
    private _copyable: Lazy<boolean, ComponentContext> = false;
    private _copyableState: Lazy<string | null, ComponentContext> = null;
    private _copyMessage: string | null = null;
    private _copyMessageDuration = 2000;
    private _isJs = false;
    constructor(content: Lazy<string | HtmlString | null, ComponentContext>) { super(); this._content = content; }
    static make(content: Lazy<string | HtmlString | null, ComponentContext>): Text { return configured(new Text(content)); }
    content(content: Lazy<string | HtmlString | null, ComponentContext>): this { this._content = content; return this; }
    /** Renders as a badge. */
    badge(condition: Lazy<boolean, ComponentContext> = true): this { this._badge = condition; return this; }
    /** Color (`gray` by default; `primary`, `danger`…). */
    color(color: Lazy<string | null, ComponentContext>): this { this._color = color; return this; }
    /** Text or badge size (`xs`, `sm`, `md`, `lg`). */
    size(size: string | null): this { this._size = size; return this; }
    /** Font weight (`bold`, `semibold`, `medium`…). */
    weight(weight: string | null): this { this._weight = weight; return this; }
    /** Font family (`sans`, `serif`, `mono`). */
    fontFamily(family: string | null): this { this._fontFamily = family; return this; }
    /** Badge icon. */
    icon(name: string | null): this { this._icon = name; return this; }
    iconPosition(position: 'before' | 'after'): this { this._iconPosition = position; return this; }
    iconSize(size: string | null): this { this._iconSize = size; return this; }
    tooltip(text: Lazy<string | null, ComponentContext>): this { this._tooltip = text; return this; }
    /** Clicking copies the text (or `copyableState()`) to the clipboard. */
    copyable(condition: Lazy<boolean, ComponentContext> = true): this { this._copyable = condition; return this; }
    copyableState(state: Lazy<string | null, ComponentContext>): this { this._copyableState = state; return this; }
    copyMessage(message: string | null): this { this._copyMessage = message; return this; }
    copyMessageDuration(milliseconds: number): this { this._copyMessageDuration = milliseconds; return this; }
    /**
     * The content is a JavaScript expression evaluated in the browser (`$get()` and `$state` are available), re-evaluated when the state changes.
     * Only use it with expressions written by the developer, never with user input.
     */
    js(condition = true): this { this._isJs = condition; return this; }
    async getContent(): Promise<string | HtmlString | null> {
        const content = await evaluate(this._content, this.context());
        if (!this._isJs || content === null) return content;
        return new HtmlString(`<span x-text="() => eval(${js(content instanceof HtmlString ? content.html : content)})"></span>`);
    }
    async toHtml(): Promise<string> {
        const ctx = this.context();
        const content = await this.getContent();
        const color = (await evaluate(this._color, ctx)) ?? 'gray';
        const tooltip = tooltipExpression(await evaluate(this._tooltip, ctx));
        const isCopyable = Boolean(await evaluate(this._copyable, ctx));
        const copyableState = (await evaluate(this._copyableState, ctx)) ?? (content instanceof HtmlString ? content.html : content);
        const copy = `window.navigator.clipboard.writeText(${js(copyableState)})\n$tooltip(${js(this._copyMessage ?? t('filament::components/copyable.messages.copied'))}, {\n theme: $store.theme,\n timeout: ${js(this._copyMessageDuration)},\n})`;
        if (await evaluate(this._badge, ctx)) {
            const tag = isCopyable ? 'button' : 'span';
            const attributes = new Attributes().merge({ 'x-on:click': isCopyable ? copy : null, 'x-tooltip': tooltip, ...this._extraAttributes, type: isCopyable ? 'button' : null })
                .class(['fi-sc-text', 'fi-badge', `fi-size-${safeClass(this._size) ?? 'md'}`, ...(color !== 'gray' ? (colorsFor(this)?.getComponentClasses('badge', color) ?? plainColorClasses(color)) : [])]);
            const iconHtml = this._icon ? icon(this._icon, { size: safeClass(this._iconSize) ?? 'sm' }) : '';
            return `<${tag} ${attributes.toHtml()}>${this._iconPosition === 'before' ? iconHtml : ''}<span class="fi-badge-label-ctn"><span class="fi-badge-label">${textOrHtml(content)}</span></span>${this._iconPosition === 'after' ? iconHtml : ''}</${tag}>`;
        }
        // Text color: same contrast-aware classes as a link.
        const colorClasses = color !== 'gray' ? (colorsFor(this)?.getComponentClasses('link', color) ?? plainColorClasses(color)) : [];
        const attributes = new Attributes().merge({
            role: isCopyable ? 'button' : null, tabindex: isCopyable ? '0' : null, 'x-on:click': isCopyable ? copy : null,
            'x-on:keydown.enter.prevent': isCopyable ? '$el.click()' : null, 'x-on:keydown.space.prevent': isCopyable ? '$el.click()' : null, 'x-tooltip': tooltip,
        }).class([...colorClasses, 'fi-sc-text', { 'fi-copyable': isCopyable }, this._size ? `fi-size-${safeClass(this._size)}` : null, this._weight ? `fi-font-${safeClass(this._weight)}` : null, this._fontFamily ? `fi-font-${safeClass(this._fontFamily)}` : null])
            .merge(this._extraAttributes);
        return `<span ${attributes.toHtml()}>${textOrHtml(content)}</span>`;
    }
}

/** Heroicon in a schema: decorative, unless a tooltip or an `aria-label` (extra attribute) describes it. */
export class Icon extends Component {
    private _icon: Lazy<string | null, ComponentContext>;
    private _color: Lazy<string | null, ComponentContext> = null;
    private _size: string | null = null;
    private _tooltip: Lazy<string | null, ComponentContext> = null;
    constructor(name: Lazy<string | null, ComponentContext>) { super(); this._icon = name; }
    static make(name: Lazy<string | null, ComponentContext>): Icon { return configured(new Icon(name)); }
    icon(name: Lazy<string | null, ComponentContext>): this { this._icon = name; return this; }
    /** Color (`primary` by default). */
    color(color: Lazy<string | null, ComponentContext>): this { this._color = color; return this; }
    /** Size (`xs` … `2xl`); `base` resets to the default size. */
    size(size: string | null): this { this._size = size === 'base' ? null : size; return this; }
    tooltip(text: Lazy<string | null, ComponentContext>): this { this._tooltip = text; return this; }
    async toHtml(): Promise<string> {
        const ctx = this.context();
        const name = await evaluate(this._icon, ctx);
        if (!name) return '';
        const tooltip = await evaluate(this._tooltip, ctx);
        const { 'aria-label': ariaLabel = null, 'aria-labelledby': ariaLabelledBy = null, 'aria-describedby': ariaDescribedBy = null, ...extra } = this._extraAttributes;
        const attributes = new Attributes({ 'x-tooltip': tooltipExpression(tooltip) }).merge({ ...extra, 'aria-hidden': 'true' })
            .class([...plainColorClasses((await evaluate(this._color, ctx)) ?? 'primary'), 'fi-sc-icon']);
        const html = icon(name, { size: safeClass(this._size) ?? 'md', attributes });
        const label = ariaLabel ?? (ariaLabelledBy ? null : tooltip);
        if (!label && !ariaLabelledBy) return html;
        return `${html}<span ${new Attributes().merge({ 'aria-describedby': ariaDescribedBy ? e(ariaDescribedBy) : null, 'aria-label': label ? e(label) : null, 'aria-labelledby': ariaLabelledBy ? e(ariaLabelledBy) : null, role: 'img' }).class(['fi-sr-only']).toHtml()}></span>`;
    }
}

/** Image in a schema. Only same-site (`/…`) or http(s) URLs are rendered. */
export class Image extends Component {
    private _url: Lazy<string, ComponentContext>;
    private _alt: Lazy<string, ComponentContext>;
    private _height: string | null = null;
    private _width: string | null = null;
    private _alignment: string | null = null;
    private _tooltip: Lazy<string | null, ComponentContext> = null;
    constructor(url: Lazy<string, ComponentContext>, alt: Lazy<string, ComponentContext>) { super(); this._url = url; this._alt = alt; }
    static make(url: Lazy<string, ComponentContext>, alt: Lazy<string, ComponentContext>): Image { return configured(new Image(url, alt)); }
    url(url: Lazy<string, ComponentContext>): this { this._url = url; return this; }
    alt(alt: Lazy<string, ComponentContext>): this { this._alt = alt; return this; }
    private static dimension(value: number | string | null): string | null {
        if (value === null) return null;
        const css = typeof value === 'number' ? `${value}px` : value.trim();
        return /^(\d+(\.\d+)?(px|rem|em|%|vh|vw)?|auto)$/.test(css) ? css : null;
    }
    /** Height (`8rem` by default); a number is in pixels. */
    imageHeight(height: number | string | null): this { this._height = Image.dimension(height); return this; }
    imageWidth(width: number | string | null): this { this._width = Image.dimension(width); return this; }
    imageSize(size: number | string): this { return this.imageWidth(size).imageHeight(size); }
    /** Alignment (`start`, `center`, `end`). */
    alignment(alignment: string | null): this { this._alignment = alignment; return this; }
    alignStart(): this { return this.alignment('start'); }
    alignCenter(): this { return this.alignment('center'); }
    alignEnd(): this { return this.alignment('end'); }
    tooltip(text: Lazy<string | null, ComponentContext>): this { this._tooltip = text; return this; }
    async toHtml(): Promise<string> {
        const ctx = this.context();
        const url = String((await evaluate(this._url, ctx)) ?? '');
        // Relative and http(s) URLs, or an inline image (`data:image/…;base64,`: scripts never run in an <img>).
        if (!/^(\/(?!\/)|https?:\/\/|data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$)/i.test(url)) return '';
        const tooltip = tooltipExpression(await evaluate(this._tooltip, ctx));
        const attributes = new Attributes(this._extraAttributes)
            .class(['fi-sc-image', this._alignment ? `fi-align-${safeClass(this._alignment)}` : null])
            .style([`height: ${this._height ?? '8rem'}`, this._width ? `width: ${this._width}` : null]);
        return `<img alt="${e(await evaluate(this._alt, ctx))}" src="${e(url)}"${tooltip ? ` x-tooltip="${tooltip}"` : ''} ${attributes.toHtml()} />`;
    }
}

/** Bulleted list: each item is a component; a string becomes a `Text`. Two columns from `sm`. */
export class UnorderedList extends Component {
    private children: Component[];
    private _columns: Record<string, number> | number | null = { sm: 2 };
    private _size: string | null = null;
    constructor(items: (Component | string | HtmlString)[] = []) { super(); this.children = UnorderedList.normalize(items); }
    static make(items: (Component | string | HtmlString)[] = []): UnorderedList { return configured(new UnorderedList(items)); }
    private static normalize(items: (Component | string | HtmlString)[]): Component[] { return items.map((item) => (item instanceof Component ? item : Text.make(item))); }
    schema(items: (Component | string | HtmlString)[]): this { this.children = UnorderedList.normalize(items); return this; }
    columns(columns: Record<string, number> | number | null): this { this._columns = columns; return this; }
    /** Text size (`xs`, `sm`, `md`, `lg`). */
    size(size: string | null): this { this._size = size; return this; }
    getChildSchemas(): Schema[] { return [childSchema(this, this.children)]; }
    async toHtml(): Promise<string> {
        const attributes = columnGrid(this._columns).merge(this._extraAttributes).class(['fi-sc-unordered-list', this._size ? `fi-size-${safeClass(this._size)}` : null]);
        const items: string[] = [];
        for (const component of this.getChildSchemas()[0].getComponents()) {
            items.push(`<li wire:key="${e(component.getLivewireKey() ?? '')}" x-data="filamentSchemaComponent(${js(component.getAlpineScopeConfiguration())})">${await component.toHtml()}</li>`);
        }
        return `<ul ${attributes.toHtml()}>${items.join('')}</ul>`;
    }
}

/** Empty state: icon, heading, description and a footer (actions, components). */
export class EmptyState extends Component {
    private _heading: Lazy<string, ComponentContext>;
    private _description: Lazy<string | null, ComponentContext> = null;
    private _icon: string | null = null;
    private _iconColor: string | null = null;
    private _iconSize: string | null = null;
    private _compact = false;
    private _contained = true;
    private _headingTag: string | null = null;
    private _footer: InlineItem[] = [];
    constructor(heading: Lazy<string, ComponentContext>) { super(); this._heading = heading; }
    static make(heading: Lazy<string, ComponentContext>): EmptyState { return configured(new EmptyState(heading)); }
    heading(heading: Lazy<string, ComponentContext>): this { this._heading = heading; return this; }
    description(description: Lazy<string | null, ComponentContext>): this { this._description = description; return this; }
    icon(name: string | null): this { this._icon = name; return this; }
    /** Icon color (`primary` by default). */
    iconColor(color: string | null): this { this._iconColor = color; return this; }
    iconSize(size: string | null): this { this._iconSize = size; return this; }
    /** Compact variant. */
    compact(condition = true): this { this._compact = condition; return this; }
    /** `false`: no surrounding card. */
    contained(condition = true): this { this._contained = condition; return this; }
    /** Heading tag (`h2` by default). */
    /** Heading tag; by default it follows the heading level of the schema (`h2` at the root). */
    headingTag(tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | null): this { this._headingTag = tag; return this; }
    /** Footer: inline actions and components. */
    footer(items: InlineItem[]): this { this._footer = items; return this; }
    /** Footer actions, mounted on the root schema. */
    getActions(): Renderable[] { return actionsOf(this._footer); }
    async toHtml(): Promise<string> {
        const ctx = this.context();
        const description = await evaluate(this._description, ctx);
        const footer = await renderInlineItems(this, this._footer);
        const iconColor = this._iconColor ?? 'primary';
        const headingTag = this._headingTag ?? this.getHeadingTag();
        const iconHtml = this._icon ? `<div class="${cls(['fi-empty-state-icon-bg', ...plainColorClasses(iconColor)])}">${icon(this._icon, { size: safeClass(this._iconSize) ?? 'lg', attributes: new Attributes().class(plainColorClasses(iconColor)) })}</div>` : '';
        return `<div ${new Attributes(this._extraAttributes).class(['fi-sc-empty-state']).toHtml()}><section class="${cls(['fi-empty-state', { 'fi-compact': this._compact, 'fi-empty-state-not-contained': !this._contained }])}"><div class="fi-empty-state-content">${iconHtml}<div class="fi-empty-state-text-ctn"><${headingTag} class="fi-empty-state-heading">${e(await evaluate(this._heading, ctx))}</${headingTag}>${isBlank(description) ? '' : `<p class="fi-empty-state-description">${e(description)}</p>`}${footer ? `<footer class="fi-empty-state-footer">${footer}</footer>` : ''}</div></div></section></div>`;
    }
}

const CALLOUT_ICONS: Record<string, string> = { danger: 'o-x-circle', info: 'o-information-circle', success: 'o-check-circle', warning: 'o-exclamation-circle' };
/**
 * Information box: a status (`info()`, `success()`, `warning()`, `danger()`) setting color and icon,
 * heading, description, footer actions (as links) and control actions (on the right).
 */
export class Callout extends Component {
    private _heading: Lazy<string | null, ComponentContext>;
    private _description: Lazy<string | null, ComponentContext> = null;
    private _status: string | null = null;
    private _color: string | null = null;
    private _hasColor = false;
    private _icon: string | null = null;
    private _iconColor: string | null = null;
    private _iconSize: string | null = null;
    private _footerActions: Renderable[] = [];
    private _footerActionsAlignment = 'start';
    private _footer: InlineItem[] | null = null;
    private _controlActions: Renderable[] = [];
    private _controls: InlineItem[] | null = null;
    constructor(heading: Lazy<string | null, ComponentContext> = null) { super(); this._heading = heading; }
    static make(heading: Lazy<string | null, ComponentContext> = null): Callout { return configured(new Callout(heading)); }
    heading(heading: Lazy<string | null, ComponentContext>): this { this._heading = heading; return this; }
    description(description: Lazy<string | null, ComponentContext>): this { this._description = description; return this; }
    /** Status: sets color, icon and a screen-reader prefix ("Note:"…). */
    status(status: string | null): this { this._status = status; return this; }
    danger(): this { return this.status('danger'); }
    info(): this { return this.status('info'); }
    success(): this { return this.status('success'); }
    warning(): this { return this.status('warning'); }
    /** Background color; `null` removes the status color (the icon keeps it). */
    color(color: string | null): this { this._color = color; this._hasColor = true; return this; }
    icon(name: string | null): this { this._icon = name; return this; }
    iconColor(color: string | null): this { this._iconColor = color; return this; }
    /** Icon size (`lg` by default). */
    iconSize(size: string | null): this { this._iconSize = size; return this; }
    /** Footer actions, rendered as links. */
    actions(actions: Renderable[]): this { this._footerActions = [...this._footerActions, ...actions]; return this; }
    footerActions(actions: Renderable[]): this { return this.actions(actions); }
    /** Footer actions alignment (`start`, `center`, `end`, `between`). */
    footerActionsAlignment(alignment: string): this { this._footerActionsAlignment = alignment; return this; }
    /** Free-form footer (components and actions), replacing the footer actions. */
    footer(items: InlineItem[] | null): this { this._footer = items; return this; }
    /** Small actions on the right of the callout (dismiss…). */
    controlActions(actions: Renderable[]): this { this._controlActions = [...this._controlActions, ...actions]; return this; }
    /** Free-form controls (components and actions) on the right of the callout, replacing the control actions. */
    controls(items: InlineItem[] | null): this { this._controls = items; return this; }
    getColor(): string | null { return this._hasColor ? this._color : (this._color ?? this._status); }
    getIcon(): string | null { return this._icon ?? (this._status ? (icons.resolve(`schemas::components.callout.${this._status}`) ?? CALLOUT_ICONS[this._status] ?? null) : null); }
    /** Callout actions, mounted on the root schema. */
    getActions(): Renderable[] { return [...(this._footer ? actionsOf(this._footer) : this._footerActions), ...(this._controls ? actionsOf(this._controls) : this._controlActions)]; }
    async toHtml(): Promise<string> {
        const ctx = this.context();
        const heading = await evaluate(this._heading, ctx);
        const description = await evaluate(this._description, ctx);
        const color = this.getColor() ?? 'gray';
        const iconName = this.getIcon();
        const iconColor = this._iconColor ?? this._status ?? color;
        const footer = this._footer ? await renderInlineItems(this, this._footer, { actionView: 'link' }) : await renderInlineItems(this, this._footerActions, { alignment: ['right', 'end'].includes(this._footerActionsAlignment) ? 'end' : this._footerActionsAlignment === 'justify' ? 'between' : this._footerActionsAlignment, actionView: 'link' });
        const controls = this._controls ? await renderInlineItems(this, this._controls, { actionView: 'auto' }) : await renderInlineItems(this, this._controlActions, { alignment: 'start', actionView: 'auto' });
        const statusKey = this._status ? `filament-schemas::components.callout.statuses.${this._status}` : null;
        const statusLabel = statusKey && t(statusKey) !== statusKey ? t(statusKey) : null;
        const statusHtml = statusLabel ? `<span class="fi-sr-only">${e(statusLabel)} </span>` : '';
        const hasHeading = !isBlank(heading), hasDescription = !isBlank(description);
        const text = hasHeading || hasDescription ? `<div class="fi-callout-text">${hasHeading ? `<h4 class="fi-callout-heading">${statusHtml}${e(heading)}</h4>` : ''}${hasDescription ? `<p class="fi-callout-description">${hasHeading ? '' : statusHtml}${e(description)}</p>` : ''}</div>` : '';
        const main = text || footer ? `<div class="fi-callout-main">${text}${footer ? `<div class="fi-callout-footer">${footer}</div>` : ''}</div>` : '';
        const iconHtml = iconName ? icon(iconName, { size: safeClass(this._iconSize) ?? 'lg', attributes: new Attributes({ 'aria-hidden': 'true' }).class([...plainColorClasses(iconColor), 'fi-callout-icon']) }) : '';
        const attributes = new Attributes(this._extraAttributes).class([...plainColorClasses(color), 'fi-sc-callout', 'fi-callout']);
        return `<div ${attributes.toHtml()}>${iconHtml}${main}${controls ? `<div class="fi-callout-controls">${controls}</div>` : ''}</div>`;
    }
}

/**
 * Fields joined under a single label: each field keeps only a screen-reader label,
 * and the first validation error among the fields is shown under the group.
 */
export class FusedGroup extends Component {
    private children: Component[];
    private _columns: Record<string, number> | number | null = {};
    private _label: Lazy<string | null, ComponentContext> = null;
    private _hiddenLabel = false;
    private _markedAsRequired = false;
    constructor(children: Component[] = []) { super(); this.children = children; }
    static make(children: Component[] = []): FusedGroup { return configured(new FusedGroup(children)); }
    schema(components: Component[]): this { this.children = components; return this; }
    columns(columns: Record<string, number> | number | null): this { this._columns = columns; return this; }
    label(label: Lazy<string | null, ComponentContext>): this { this._label = label; return this; }
    hiddenLabel(condition = true): this { this._hiddenLabel = condition; return this; }
    /** Asterisk after the label (validation stays per field). */
    markAsRequired(condition = true): this { this._markedAsRequired = condition; return this; }
    getChildSchemas(): Schema[] { return [childSchema(this, this.children).columns(this._columns).gap(false).fieldWrapperView('filament-forms::plain-field-wrapper')]; }
    /** First error among the group's fields (including one on an item of a multi-valued field). */
    private firstError(): string | null {
        const errors = this.livewire._errors ?? {};
        for (const component of this.getChildSchemas()[0].getComponents()) {
            if (!component.hasStatePath()) continue;
            const path = component.getStatePath();
            if (errors[path]?.length) return errors[path][0];
            const nested = Object.keys(errors).find((key) => key.startsWith(`${path}.`) && errors[key].length);
            if (nested) return errors[nested][0];
        }
        return null;
    }
    async toHtml(): Promise<string> {
        const id = this.getKey();
        const label = await evaluate(this._label, this.context());
        const error = this.firstError();
        const hasLabel = !isBlank(label);
        const inner = new Attributes().merge({ id, role: 'group', 'aria-labelledby': id && hasLabel ? `${id}-label` : null, ...this._extraAttributes, 'aria-describedby': id && error !== null ? `${id}-error` : null }).class(['fi-sc-fused-group']);
        const labelId = id ? `id="${e(id)}-label" ` : '';
        const labelHtml = !hasLabel ? '' : this._hiddenLabel
            ? `<label ${labelId}class="fi-fo-field-label fi-sr-only">${e(label)}</label>`
            : `<div class="fi-fo-field-label-col"><div class="fi-fo-field-label-ctn"><label ${labelId}class="fi-fo-field-label"><span class="fi-fo-field-label-content">${e(label)}${this._markedAsRequired ? '<sup class="fi-fo-field-label-required-mark">*</sup>' : ''}</span></label></div></div>`;
        const errorHtml = error !== null ? `<p data-validation-error ${id ? `id="${e(id)}-error" ` : ''}class="fi-fo-field-wrp-error-message">${e(error)}</p>` : '';
        return `<div data-field-wrapper class="fi-fo-field">${labelHtml}<div class="fi-fo-field-content-col"><div ${inner.toHtml()}>${await this.getChildSchemas()[0].toHtml()}</div>${errorHtml}</div></div>`;
    }
}
