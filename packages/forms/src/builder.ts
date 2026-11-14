// @navette-js/forms/builder — a list of items, each one a "block" picked from a menu.
// The state is a map `item key → { type, data }`; key order is display order.
import { Attributes, HtmlString, cls, e, icon, js, loadingIndicator, views, type ColorManager, configured } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { Action, ActionHalt } from '@navette-js/actions';
import { Schema, type Component } from '@navette-js/schemas';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Field, fillSchema, fillSchemaFromRecord, getSchemaState, validateSchema, type Rule } from './index.ts';
import { colorClassesOf, fieldActionIcon, itemContext, modifyAction, prepareExtraItemAction, resolveAction, type ActionModifier, type ResolvedAction } from './item-actions.ts';

const asset = (name: string) => views.render('filament-forms::asset', { path: name }).trim();
const ITEM_KEY = /^[A-Za-z0-9_-]{1,64}$/;
/** Whether an item key is acceptable: keys come from the browser. */
export const isItemKey = (key: string) => ITEM_KEY.test(key) && key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
/** Random four-character alphanumeric key. */
export const shortKey = () => Array.from(randomBytes(4), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');

/** Writes a value at a state path of the host component. */
export function writeState(target: any, segments: string[], value: unknown): void {
    let node = target;
    for (const key of segments.slice(0, -1)) { if (node[key] === null || typeof node[key] !== 'object') node[key] = {}; node = node[key]; }
    node[segments[segments.length - 1]] = value;
}

/** Icon button for a component action: the icon, then a loading indicator. */
export function iconActionButton(options: { label: string; icon: string; expression: string; colorClasses?: string[]; attributes?: Record<string, string | null>; disabled?: boolean; inHeader?: boolean }): string {
    // Item header buttons put `tabindex` before `type`, and the class before the extra attributes.
    const { tabindex = null, ...extra } = options.attributes ?? {};
    const attributes = new Attributes(options.inHeader ? {
        title: options.label, 'aria-disabled': options.disabled ? 'true' : null, 'aria-label': options.label, disabled: options.disabled ? 'disabled' : null, tabindex, type: 'button',
        'wire:loading.attr': 'aria-disabled', 'wire:loading.class': 'fi-disabled', class: '', ...extra, 'wire:click': options.expression,
    } : {
        title: options.label, 'aria-disabled': options.disabled ? 'true' : null, 'aria-label': options.label, disabled: options.disabled ? 'disabled' : null, type: 'button',
        'wire:loading.attr': 'aria-disabled', 'wire:loading.class': 'fi-disabled', ...(options.attributes ?? {}), 'wire:click': options.expression,
    }).class(['fi-ac-icon-btn-action', 'fi-icon-btn', { 'fi-disabled': options.disabled === true }, 'fi-size-sm', ...(options.colorClasses ?? [])]);
    return `<button ${attributes.toHtml()}>${icon(options.icon, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': options.expression }) })}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': options.expression }))}</button>`;
}
/** Color manager of the host's panel (pages and widgets expose it through `panel`). */
export const colorsOf = (livewire: unknown): ColorManager | null => (livewire as any)?.panel?.colors ?? null;

type BlockContext = { builder: Builder; itemKey: string; data: Record<string, unknown> };
/** Context of a block label function: `state` is `null` in the block picker, the item's raw data otherwise. */
export type BlockLabelContext = { state: Record<string, unknown> | null; key: string | null; index: number | null };
/**
 * Preview of a block (`Builder.blockPreviews()`): a view name, rendered with the item's data as variables (EJS escapes
 * `<%= %>`), or a function of the data returning text (escaped) or an `HtmlString` (inserted as is: escape the data in it).
 */
export type BlockPreview = string | ((data: Record<string, unknown>) => string | HtmlString);
/** Item type of a Builder. */
export class Block {
    readonly name: string;
    private _label: string | ((ctx: BlockLabelContext) => string | null) | null = null;
    private _icon: string | null = null;
    private _schema: (ctx: BlockContext) => Component[] = () => [];
    private _defaults: ((builder: Builder) => Record<string, unknown>) | null = null;
    private _pickerGroup: string | null = null;
    private _maxItems: number | null = null;
    private _preview: BlockPreview | null = null;
    constructor(name: string) { this.name = name; }
    /** How many items of this block the builder may hold; at the limit, the block leaves the picker (checked on the server). */
    maxItems(count: number | null): this { this._maxItems = count; return this; }
    getMaxItems(): number | null { return this._maxItems; }
    static make(name: string): Block { return configured(new Block(name)); }
    /**
     * Label in the block picker and the item header. A function labels items from their content: it receives the item's
     * raw data as `state` (`null` in the block picker, where it returns the block label). The result is escaped.
     */
    label(label: string | ((ctx: BlockLabelContext) => string | null) | null): this { this._label = label; return this; }
    /** Group of the block in the block picker (also set by passing `{ 'Group label': [blocks] }` to `blocks()`). */
    pickerGroup(label: string | null): this { this._pickerGroup = label; return this; }
    getPickerGroup(): string | null { return this._pickerGroup; }
    icon(name: string | null): this { this._icon = name; return this; }
    /** Item components: a function called for each item (with its current data). */
    schema(factory: (ctx: BlockContext) => Component[]): this { this._schema = factory; return this; }
    /** Data of a new item when it cannot be derived from the fields' defaults (fields depending on another). */
    defaultData(factory: (builder: Builder) => Record<string, unknown>): this { this._defaults = factory; return this; }
    /** Read-only preview shown instead of the form when the builder has `blockPreviews()`. */
    preview(preview: BlockPreview | null): this { this._preview = preview; return this; }
    hasPreview(): boolean { return this._preview !== null; }
    /** Preview markup for an item's data. */
    renderPreview(data: Record<string, unknown>): string {
        if (this._preview === null) return '';
        if (typeof this._preview === 'string') return views.render(this._preview, { ...data });
        const result = this._preview(data);
        return result instanceof HtmlString ? result.html : e(result);
    }
    getLabel(ctx: BlockLabelContext = { state: null, key: null, index: null }): string {
        const fallback = () => this.name.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
        if (typeof this._label === 'function') { const label = this._label(ctx); return label === null || label === undefined || label === '' ? fallback() : String(label); }
        return this._label ?? fallback();
    }
    getIcon(): string | null { return this._icon; }
    getComponents(ctx: BlockContext): Component[] { return this._schema(ctx); }
    getDefaults(builder: Builder): Record<string, unknown> | null { return this._defaults ? this._defaults(builder) : null; }
}

type Item = { type: string; data: Record<string, unknown> };
type BuilderActionName = 'add' | 'addBetween' | 'clone' | 'delete' | 'edit' | 'moveUp' | 'moveDown' | 'reorder' | 'collapse' | 'expand' | 'collapseAll' | 'expandAll';
/** Precomputed block picker key hashes for common `width|placement|has blocks|searchable` signatures; others hash the signature itself. */
const PICKER_HASHES: Record<string, string> = { 'fi-width-md|bottom-start|1|0': '8b2521a32ddb82abb3a5f4fd214c90b1', '||1|0': '9c288f69c73367423cc1eb48b3e9a82b' };

export class Builder extends Field {
    private _blocks: Block[] | (() => Block[]) = [];
    private _resolvedBlocks: Block[] | null = null;
    private _pickerColumns: number | null = null;
    private _pickerWidth: string | null = null;
    private _labelBetweenItems: string | null = null;
    private _blockHeaders = true;
    private _cloneable = false;
    private _blockNumbers = true;
    private _blockIcons = false;
    private _headingTag = 'h2';
    private _addBetweenLabel: string | null = null;
    private _addLabel: string | null = null;
    private _addIcon: string | null = null;
    private _addAlignment: 'start' | 'center' | 'end' | null = null;
    private _maxItems = 100;
    private _minItems: number | null = null;
    private _addable = true;
    private _deletable = true;
    private _reorderable = true;
    private _reorderableWithButtons = false;
    private _collapsible = false;
    private _collapsed = false;
    private _persistCollapsed = false;
    private _searchable = false;
    private _searchPrompt: string | HtmlString | null = null;
    private _noSearchResultsMessage: string | null = null;
    private _searchDebounce = 0;
    private _blockPreviews = false;
    private _interactivePreviews = false;
    private _extraClass: string | null = null;
    private _uuid: () => string = randomUUID;
    private _actionModifiers: Partial<Record<BuilderActionName, ActionModifier>> = {};
    private _extraItemActions: Action[] = [];
    static make(name: string): Builder { return configured(new Builder(name)); }

    /** Blocks, or `{ 'Group label': [blocks] }` to group them in the block picker. */
    blocks(blocks: Block[] | Record<string, Block[]> | (() => Block[])): this {
        this._blocks = typeof blocks === 'function' || Array.isArray(blocks) ? blocks : Object.entries(blocks).flatMap(([group, list]) => list.map((block) => block.pickerGroup(group)));
        this._resolvedBlocks = null;
        return this;
    }
    blockPickerColumns(columns: number | null = 2): this { this._pickerColumns = columns; return this; }
    blockPickerWidth(width: string | null): this { this._pickerWidth = width; return this; }
    labelBetweenItems(label: string | null): this { this._labelBetweenItems = label; return this; }
    /** Without a header, an item only shows its content: its actions are then up to the block. */
    blockHeaders(condition = true): this { this._blockHeaders = condition; return this; }
    cloneable(condition = true): this { this._cloneable = condition; return this; }
    /** Item number after the block label (on by default). */
    blockNumbers(condition = true): this { this._blockNumbers = condition; return this; }
    /** Block icon in the item header (off by default). */
    blockIcons(condition = true): this { this._blockIcons = condition; return this; }
    /** Tag of the header label (`h2` by default). */
    blockLabelHeadingTag(tag: 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'): this { this._headingTag = tag; return this; }
    /**
     * Each item shows its block's `preview()` instead of its form; the edit button (or a click on the preview) opens the
     * form in a modal, and adding a block opens its form first. `areInteractive`: links and buttons of the preview stay
     * usable (no click-to-edit overlay).
     */
    blockPreviews(condition: boolean | { areInteractive?: boolean } = true, areInteractive = false): this {
        if (typeof condition === 'object') { this._blockPreviews = true; this._interactivePreviews = condition.areInteractive === true; return this; }
        this._blockPreviews = condition; this._interactivePreviews = areInteractive; return this;
    }
    hasBlockPreviews(): boolean { return this._blockPreviews; }
    /**
     * "Insert between blocks" picker between two items (on by default): `false` removes it, a function customizes the
     * action (`(action) => action.label('Insert')`).
     */
    addBetweenAction(modify: ActionModifier | boolean = true): this { this._actionModifiers.addBetween = typeof modify === 'boolean' ? (modify ? null : (action) => action.hidden()) : modify; return this; }
    addBetweenActionLabel(label: string | null): this { this._addBetweenLabel = label; return this; }
    addActionLabel(label: string | null): this { this._addLabel = label; return this; }
    addActionIcon(name: string | null): this { this._addIcon = name; return this; }
    addActionAlignment(alignment: 'start' | 'center' | 'end' | null): this { this._addAlignment = alignment; return this; }
    /** Customizes the block picker's trigger and the add action (label, icon, a confirmation...). */
    addAction(modify: ActionModifier): this { this._actionModifiers.add = modify; return this; }
    cloneAction(modify: ActionModifier): this { this._actionModifiers.clone = modify; return this; }
    deleteAction(modify: ActionModifier): this { this._actionModifiers.delete = modify; return this; }
    /** Edit button of the block previews (its modal holds the block's form). */
    editAction(modify: ActionModifier): this { this._actionModifiers.edit = modify; return this; }
    moveUpAction(modify: ActionModifier): this { this._actionModifiers.moveUp = modify; return this; }
    moveDownAction(modify: ActionModifier): this { this._actionModifiers.moveDown = modify; return this; }
    /** Drag and drop: the action runs when a drag changes the order (it may require a confirmation). */
    reorderAction(modify: ActionModifier): this { this._actionModifiers.reorder = modify; return this; }
    /** Collapse / expand buttons (handled in the browser: label, icon and color only, no modal). */
    collapseAction(modify: ActionModifier): this { this._actionModifiers.collapse = modify; return this; }
    expandAction(modify: ActionModifier): this { this._actionModifiers.expand = modify; return this; }
    collapseAllAction(modify: ActionModifier): this { this._actionModifiers.collapseAll = modify; return this; }
    expandAllAction(modify: ActionModifier): this { this._actionModifiers.expandAll = modify; return this; }
    /**
     * Actions added to each item's header. They receive the item key as `arguments.item`, checked on the server, and the
     * builder as `component`: `component.getItemState(arguments.item)` validates the item's data.
     */
    extraItemActions(actions: Action[]): this { this._extraItemActions.push(...actions); return this; }
    getExtraItemActions(): Action[] { return this._extraItemActions.map(prepareExtraItemAction); }
    maxItems(count: number): this { this._maxItems = count; return this; }
    /** Minimum number of items, checked on the server. */
    minItems(count: number | null): this { this._minItems = count; return this; }
    /** `false`: no block picker (adding is refused on the server). */
    addable(condition = true): this { this._addable = condition; return this; }
    /** `false`: no delete button (deleting is refused on the server). */
    deletable(condition = true): this { this._deletable = condition; return this; }
    /** `false`: items keep their order. */
    reorderable(condition = true): this { this._reorderable = condition; return this; }
    private _dragAndDrop = true;
    /** `false`: no drag and drop (buttons may still reorder, with `reorderableWithButtons()`). */
    reorderableWithDragAndDrop(condition = true): this { this._dragAndDrop = condition; return this; }
    private canDrag(): boolean { return this._reorderable && this._dragAndDrop; }
    private canMove(): boolean { return this._reorderable && (this._dragAndDrop || this._reorderableWithButtons); }
    /** Move up / move down buttons in each item header. */
    reorderableWithButtons(condition = true): this { this._reorderableWithButtons = condition; return this; }
    /** Items can be collapsed from their header; `collapsed()` collapses them on load. */
    collapsible(condition = true): this { this._collapsible = condition; return this; }
    collapsed(condition = true): this { this._collapsed = condition; if (condition) this._collapsible = true; return this; }
    /** Keeps each item's collapsed state in the browser (local storage). */
    persistCollapsed(condition = true): this { this._persistCollapsed = condition; return this; }
    /** Search field in the block picker (filtered in the browser). */
    searchable(condition = true): this { this._searchable = condition; return this; }
    /** Placeholder of the block search; an `HtmlString` is shown as its text. */
    searchPrompt(prompt: string | HtmlString | null): this { this._searchPrompt = prompt; return this; }
    noSearchResultsMessage(message: string | null): this { this._noSearchResultsMessage = message; return this; }
    /** Milliseconds to wait after typing before filtering the blocks (0 by default). */
    searchDebounce(milliseconds: number): this { this._searchDebounce = Math.max(0, Math.floor(milliseconds)); return this; }
    async getValidationRules(): Promise<Rule[]> {
        const count = () => Object.keys(this.getItems()).length;
        const rules: Rule[] = [];
        if (await this.isRequired()) rules.push({ name: 'required', passes: () => count() > 0, message: (a) => `The ${a} field is required.` });
        if (this._minItems !== null) rules.push({ name: 'min', implicit: true, passes: () => count() >= this._minItems!, message: (a) => `The ${a} field must have at least ${this._minItems} items.` });
        const items = () => Object.values(this.getItems());
        for (const block of this.getBlocks()) if (block.getMaxItems() !== null) rules.push({ name: 'max', implicit: true, passes: () => items().filter((item) => item.type === block.name).length <= block.getMaxItems()!, message: (a) => `The ${a} field must not have more than ${block.getMaxItems()} ${block.getLabel()} items.` });
        return [...rules, ...this._rules];
    }
    /** Class added to the root (e.g. `fi-fo-builder-not-contained`). */
    extraClass(name: string | null): this { this._extraClass = name; return this; }
    generateUuidUsing(generator: () => string): this { this._uuid = generator; return this; }

    getBlocks(): Block[] { return (this._resolvedBlocks ??= typeof this._blocks === 'function' ? this._blocks() : this._blocks); }
    getBlock(name: unknown): Block | undefined { return typeof name === 'string' ? this.getBlocks().find((block) => block.name === name) : undefined; }
    /** Blocks offered in the picker: those under their `maxItems()` (a subclass may remove more). */
    getBlockPickerBlocks(): Block[] { const items = Object.values(this.getItems()); return this.getBlocks().filter((block) => block.getMaxItems() === null || items.filter((item) => item.type === block.name).length < block.getMaxItems()!); }

    /** Well-formed items only: simple key, declared type, object data. Anything else the browser sends is ignored. */
    getItems(): Record<string, Item> {
        const state = this.context().state;
        if (!state || typeof state !== 'object' || Array.isArray(state)) return {};
        const items: Record<string, Item> = {};
        for (const [key, raw] of Object.entries(state as Record<string, any>).slice(0, this._maxItems)) {
            if (!isItemKey(key) || !raw || typeof raw !== 'object' || !this.getBlock(raw.type)) continue;
            items[key] = { type: raw.type, data: raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : {} };
        }
        return items;
    }
    protected setItems(items: Record<string, Item>): void { writeState(this.livewire, this.getStatePath().split('.'), items); }
    getDefaultState(): unknown { return {}; }
    /**
     * Stored value (a `[{ type, data }]` list, possibly as JSON) to form state (a map by key).
     * Each block's fields hydrate their own value.
     */
    hydrateState(value: unknown): unknown {
        if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
        if (!value || typeof value !== 'object') return {};
        const entries: [string, any][] = Array.isArray(value) ? value.map((raw) => [this._uuid(), raw]) : Object.entries(value);
        const items: Record<string, Item> = {};
        for (const [key, raw] of entries.slice(0, this._maxItems)) {
            const block = raw && typeof raw === 'object' ? this.getBlock(raw.type) : undefined;
            if (!block || !isItemKey(key)) continue;
            const source = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : {};
            const data: Record<string, unknown> = { ...source };
            for (const component of block.getComponents({ builder: this, itemKey: key, data: source })) {
                if (component instanceof Field) data[component.getName()] = component.hydrateState(source[component.getName()] ?? null);
            }
            items[key] = { type: block.name, data };
        }
        return items;
    }
    private _storedAsList = true;
    /** `false`: the stored value stays the keyed map of the state (filters) instead of a `[{ type, data }]` list. */
    storedAsList(condition = true): this { this._storedAsList = condition; return this; }
    finalizeDehydratedState(state: unknown): unknown {
        if (!this._storedAsList || !state || typeof state !== 'object' || Array.isArray(state)) return state;
        return Object.values(state as Record<string, unknown>);
    }
    dehydrateState(): unknown { return Object.fromEntries(Object.entries(this.getItems()).map(([key, item]) => [key, { type: item.type, data: {} }])); }
    /** Item schema: key `<builder>.<item>.data`, state at the same path. */
    protected itemSchema(itemKey: string, item: Item): Schema {
        const container = this.container;
        return new Schema(container.livewire).key(`${this.getKey()}.${itemKey}.data`).statePath(`${this.getStatePath()}.${itemKey}.data`).operation(container.getOperation()).record(container.getRecord()).root(false).parentComponent(this)
            .components(this.getBlock(item.type)!.getComponents({ builder: this, itemKey, data: item.data }));
    }
    getChildSchemas(): Schema[] { return Object.entries(this.getItems()).map(([key, item]) => this.itemSchema(key, item)); }
    protected newItem(block: Block): Item {
        const defaults = block.getDefaults(this);
        if (defaults) return { type: block.name, data: defaults };
        const data: Record<string, unknown> = {};
        const item = { type: block.name, data };
        fillSchema(this.itemSchema('new', item), data);
        return item;
    }
    /** An item of a block filled from saved-shape data (the form of a modal): each field hydrates its value. */
    protected itemFromData(block: Block, itemKey: string, data: Record<string, unknown>): Item {
        const state: Record<string, unknown> = {};
        fillSchemaFromRecord(this.itemSchema(itemKey, { type: block.name, data }), state, data);
        return { type: block.name, data: state };
    }
    /** A subclass may refuse adding (a rule cap, for instance). */
    protected canAdd(block: Block): boolean {
        const items = Object.values(this.getItems());
        return this._addable && items.length < this._maxItems && (block.getMaxItems() === null || items.filter((item) => item.type === block.name).length < block.getMaxItems()!);
    }

    /** Raw state of an item (`{ type, data }`, unvalidated), or `null` for an unknown key. */
    getRawItemState(key: unknown): Item | null { const items = this.getItems(); return typeof key === 'string' && Object.hasOwn(items, key) ? items[key] : null; }
    /** Data of an item as it would be saved, without validating it. */
    async getItemStateSnapshot(key: unknown): Promise<Record<string, unknown> | null> { const item = this.getRawItemState(key); return item ? getSchemaState(this.itemSchema(key as string, item)) : null; }
    /** Validated data of an item. If it is invalid, its errors are shown in the form and the running action is cancelled. */
    async getItemState(key: unknown): Promise<Record<string, unknown>> {
        const item = this.getRawItemState(key);
        if (!item) throw new ActionHalt(true);
        const schema = this.itemSchema(key as string, item);
        const errors = await validateSchema(schema);
        if (Object.keys(errors).length) { Object.assign(((this.livewire as any)._errors ??= {}), errors); throw new ActionHalt(true); }
        return getSchemaState(schema);
    }
    /** Item actions receive keys from the browser: an action about an item needs an existing item. */
    authorizeActionArguments(name: string, args: Record<string, unknown>): boolean {
        const items = this.getItems();
        const has = (key: unknown) => typeof key === 'string' && Object.hasOwn(items, key);
        if (name === 'addBetween') return has(args.afterItem);
        if (['delete', 'clone', 'edit', 'moveUp', 'moveDown'].includes(name) || this._extraItemActions.some((action) => action.getName() === name)) return has(args.item);
        return true;
    }

    private insert(items: Record<string, Item>, after: string | null, key: string, item: Item): Record<string, Item> {
        if (after === null || !Object.hasOwn(items, after)) return { ...items, [key]: item };
        return Object.fromEntries(Object.entries(items).flatMap(([k, v]) => (k === after ? [[k, v], [key, item]] : [[k, v]])));
    }
    /** Block form of the add modal (with block previews): the components of the block named in the arguments. */
    private blockFormOf(args: Record<string, unknown>): Component[] {
        const block = this.getBlockPickerBlocks().find((candidate) => candidate.name === args.block);
        return block ? block.getComponents({ builder: this, itemKey: 'new', data: {} }) : [];
    }
    private builderAction(name: BuilderActionName): Action {
        const tr = (key: string, replace: Record<string, string> = {}) => t(`filament-forms::components.builder.actions.${key}`, replace);
        const move = (offset: number) => ({ arguments: args }: { arguments: Record<string, unknown> }) => {
            if (!this.canMove()) return;
            const items = this.getItems();
            const keys = Object.keys(items);
            const from = keys.indexOf(String(args.item));
            const to = from + offset;
            if (from < 0 || to < 0 || to >= keys.length) return;
            [keys[from], keys[to]] = [keys[to], keys[from]];
            this.setItems(Object.fromEntries(keys.map((key) => [key, items[key]])));
        };
        // Adding a block: with block previews, the block's form is filled in a modal first.
        const add = (between: boolean) => ({ arguments: args, data }: { arguments: Record<string, unknown>; data: Record<string, unknown> }) => {
            const block = this.getBlockPickerBlocks().find((candidate) => candidate.name === args.block);
            const items = this.getItems();
            if (!block || !this.canAdd(block)) return;
            if (between && (typeof args.afterItem !== 'string' || !Object.hasOwn(items, args.afterItem))) return;
            const key = this._uuid();
            const item = this._blockPreviews && block.getComponents({ builder: this, itemKey: key, data: {} }).length ? this.itemFromData(block, key, data ?? {}) : this.newItem(block);
            this.setItems(this.insert(items, typeof args.afterItem === 'string' ? args.afterItem : null, key, item));
        };
        const withAddModal = (action: Action, modal: 'add' | 'add_between') => (this._blockPreviews
            ? action.modalHeading(async () => tr(`${modal}.modal.heading`, { label: String((await this.getLabel()) ?? '') })).modalSubmitActionLabel(tr(`${modal}.modal.actions.add.label`)).schema((schema: Schema, ctx: { arguments?: Record<string, unknown> } = {}) => this.blockFormOf(ctx.arguments ?? {}))
            : action);
        let action: Action;
        switch (name) {
            case 'add': action = withAddModal(Action.make('add').label(() => this._addLabel ?? tr('add.label').replace(':label', this._labelText.replace(/^./, (c) => c.toLowerCase())).trim()).icon(this._addIcon).color('gray').size('sm').action(add(false)), 'add'); break;
            case 'addBetween': action = withAddModal(Action.make('addBetween').label(() => this._addBetweenLabel ?? tr('add_between.label')).color('gray').size('sm').action(add(true)), 'add_between'); break;
            case 'delete': action = Action.make('delete').label(tr('delete.label')).icon(fieldActionIcon('builder', 'delete')).color('danger').iconButton().size('sm')
                .action(({ arguments: args }) => { const items = this.getItems(); const key = String(args.item); if (!this._deletable || !Object.hasOwn(items, key)) return; delete items[key]; this.setItems(items); }); break;
            case 'clone': action = Action.make('clone').label(tr('clone.label')).icon(fieldActionIcon('builder', 'clone')).color('gray').iconButton().size('sm')
                .action(({ arguments: args }) => {
                    const items = this.getItems();
                    const key = String(args.item);
                    if (!this._cloneable || !Object.hasOwn(items, key) || !this.canAdd(this.getBlock(items[key].type)!)) return;
                    this.setItems(this.insert(items, key, this._uuid(), this.cloneItem(items[key])));
                }); break;
            // Block previews: the item's form, in a modal.
            case 'edit': action = Action.make('edit').label(tr('edit.label')).icon(fieldActionIcon('builder', 'edit')).color('gray').iconButton().size('sm')
                .modalHeading(tr('edit.modal.heading')).modalSubmitActionLabel(tr('edit.modal.actions.save.label'))
                .visible(async () => this._blockPreviews && !(await this.isDisabled()))
                .schema((schema: Schema, ctx: { arguments?: Record<string, unknown> } = {}) => {
                    const key = ctx.arguments?.item;
                    const item = this.getRawItemState(key);
                    return item ? this.getBlock(item.type)!.getComponents({ builder: this, itemKey: key as string, data: item.data }) : [];
                })
                .fillForm(async ({ arguments: args }) => (await this.getItemStateSnapshot(args.item)) ?? {})
                .action(({ arguments: args, data }) => {
                    const items = this.getItems();
                    const key = String(args.item);
                    if (!this._blockPreviews || !Object.hasOwn(items, key)) return;
                    items[key] = this.itemFromData(this.getBlock(items[key].type)!, key, data ?? {});
                    this.setItems(items);
                }); break;
            case 'moveUp': action = Action.make('moveUp').label(tr('move_up.label')).icon(fieldActionIcon('builder', 'move-up')).color('gray').iconButton().size('sm').action(move(-1)); break;
            case 'moveDown': action = Action.make('moveDown').label(tr('move_down.label')).icon(fieldActionIcon('builder', 'move-down')).color('gray').iconButton().size('sm').action(move(1)); break;
            // Drag and drop: the new order is only accepted if it is a permutation of the existing keys.
            case 'reorder': action = Action.make('reorder').label(tr('reorder.label')).icon(fieldActionIcon('builder', 'reorder')).color('gray').iconButton().size('sm')
                .action(({ arguments: args }) => {
                    if (!this.canDrag()) return;
                    const items = this.getItems();
                    const keys = Object.keys(items);
                    const order = Array.isArray(args.items) ? args.items.map(String) : [];
                    if (order.length !== keys.length || new Set(order).size !== keys.length || !order.every((key) => Object.hasOwn(items, key))) return;
                    this.setItems(Object.fromEntries(order.map((key) => [key, items[key]])));
                }); break;
            case 'collapse': action = Action.make('collapse').label(tr('collapse.label')).icon(fieldActionIcon('builder', 'collapse')).color('gray').iconButton().size('sm'); break;
            case 'expand': action = Action.make('expand').label(tr('expand.label')).icon(fieldActionIcon('builder', 'expand')).color('gray').iconButton().size('sm'); break;
            case 'collapseAll': action = Action.make('collapseAll').label(tr('collapse_all.label')).color('gray').link().size('sm'); break;
            case 'expandAll': action = Action.make('expandAll').label(tr('expand_all.label')).color('gray').link().size('sm'); break;
        }
        return modifyAction(action, this._actionModifiers[name]);
    }

    getActions(): Action[] {
        return [
            ...this.getHintActions(),
            ...(['add', 'addBetween', 'delete', 'clone', 'edit', 'moveUp', 'moveDown', 'reorder'] as const).map((name) => this.builderAction(name)),
            ...this.getExtraItemActions(),
        ];
    }
    /** Copy of an item; a subclass renews the keys of nested items. */
    protected cloneItem(item: Item): Item { return JSON.parse(JSON.stringify(item)); }

    /** `mountAction(...)` expression for an action of this component. */
    actionExpression(action: string, args: Record<string, unknown> | null): string {
        const context = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: this.getKey() };
        return `mountAction(${js(action)}, ${args ? js(args) : '{}'}, ${js(context)})`;
    }

    private blockPickerHtml(trigger: ResolvedAction, afterItem: string | null = null): string {
        const key = this.getKey()!;
        const blocks = this.getBlockPickerBlocks();
        const tr = (name: string) => t(`filament-forms::components.builder.${name}`);
        const between = afterItem !== null;
        const actionName = between ? 'addBetween' : 'add';
        const alignment = between ? null : this._addAlignment;
        const placement = alignment === 'start' ? 'bottom-start' : alignment === 'end' ? 'bottom-end' : null;
        const widthClass = this._pickerWidth ? `fi-width-${this._pickerWidth}` : null;
        const searchPrompt = this._searchPrompt instanceof HtmlString ? decodeEntities(this._searchPrompt.html.replace(/<[^>]*>/g, '')) : (this._searchPrompt ?? tr('block_picker.search_prompt'));
        const noSearchResults = this._noSearchResultsMessage ?? tr('block_picker.no_search_results_message');
        // Customized search texts change the picker's key, so that a re-render updates it.
        const customSearch = this._searchable && (this._searchPrompt !== null || this._noSearchResultsMessage !== null || this._searchDebounce !== 0) ? `|${searchPrompt}|${noSearchResults}|${this._searchDebounce}` : '';
        const signature = `${widthClass ?? ''}|${placement ?? ''}|${blocks.length ? 1 : 0}|${this._searchable ? 1 : 0}${customSearch}`;
        const wireKey = `${key}.${actionName}.${afterItem ?? ''}.block-picker.${PICKER_HASHES[signature] ?? createHash('md5').update(signature).digest('hex')}`;
        const items = blocks.map((block) => {
            const expression = `mountAction('${actionName}', ${js(between ? { block: block.name, afterItem } : { block: block.name })}, { schemaComponent: ${js(key)} })`;
            const blockIcon = block.getIcon();
            const search = this._searchable ? ` role="button" tabindex="0" wire:key="${e(createHash('md5').update(expression + block.getLabel().toLowerCase()).digest('hex'))}" data-block-label="${e(block.getLabel().toLowerCase())}" x-show="isBlockVisible($el)"` : '';
            return `<button x-on:click="close" wire:click="${e(expression)}"${search} type="button" wire:loading.attr="disabled" wire:target="${e(expression)}" class="fi-dropdown-list-item">${blockIcon ? icon(blockIcon, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': expression }) }) + loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': expression })) : ''}<span class="fi-dropdown-list-item-label">${e(block.getLabel())}</span></button>`;
        });
        const grid = this._pickerColumns ? ` class="fi-grid fi-grid-direction-col lg:fi-grid-cols" style="--cols-lg: ${this._pickerColumns}; --cols-default: 1;"` : ' class="fi-grid fi-grid-direction-col" style="--cols-default: 1;"';
        // Grouped blocks: one labelled group per picker group (ungrouped blocks first), the groups laid out in the grid.
        const groups = new Map<string, string[]>();
        blocks.forEach((block, index) => { const group = block.getPickerGroup() ?? ''; groups.set(group, [...(groups.get(group) ?? []), items[index]]); });
        const grouped = [...groups.keys()].some((group) => group !== '');
        const content = grouped
            ? `<div${grid.replace(/class="([^"]*)"/, 'class="$1 fi-fo-builder-block-picker-groups"')}>${[...groups].map(([group, groupItems]) => `<div class="fi-fo-builder-block-picker-group"${group ? ` role="group" aria-label="${e(group)}"` : ''}>${group ? `<div class="fi-fo-builder-block-picker-group-label">${e(group)}</div>` : ''}${groupItems.join('')}</div>`).join('')}</div>`
            : `<div${grid}>${items.join('')}</div>`;
        const searchInput = this._searchable ? `<div class="fi-fo-builder-block-picker-search-ctn"><div class="fi-input-wrp"><div class="fi-input-wrp-content-ctn"><input type="text" x-ref="searchInput" x-on:keydown.enter.prevent="" aria-label="${e(searchPrompt)}" placeholder="${e(searchPrompt)}" x-model.debounce.${this._searchDebounce}="search" class="fi-input" /></div></div></div>` : '';
        const noResults = this._searchable ? `<div x-cloak x-show="hasNoSearchResults" role="status" aria-live="polite" class="fi-fo-builder-block-picker-no-search-results-message">${e(noSearchResults)}</div>` : '';
        const list = blocks.length ? `<div${this._searchable ? ' x-data="blockPicker()"' : ''} class="fi-dropdown-list">${searchInput}<div>${content}</div>${noResults}</div>` : '';
        const addIcon = trigger.icon ? icon(trigger.icon, { size: 'sm' }) : '';
        const colorClasses = colorClassesOf(colorsOf(this.livewire), 'button', trigger.color, 'gray', []);
        return `<div x-data="filamentDropdown({ isMenu: ${this._searchable ? 'false' : 'true'} })" wire:key="${e(wireKey)}" class="${cls(['fi-dropdown', 'fi-fo-builder-block-picker', alignment ? `fi-align-${alignment}` : null])}"><div x-on:mousedown="if ($event.button === 0) toggle($event)" class="fi-dropdown-trigger"><button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${cls(['fi-ac-btn-action', 'fi-btn', 'fi-size-sm', ...colorClasses])}">${addIcon}${e(trigger.label)}</button></div><div x-cloak="x-cloak" x-ref="panel" wire:key="${e(wireKey)}.panel" wire:ignore.self="" x-transition:enter-start="fi-opacity-0" x-transition:leave-end="fi-opacity-0" x-float${placement ? `.placement.${placement}` : ''}.flip.shift.offset="{ offset: 8 }" class="${cls(['fi-dropdown-panel', widthClass])}">${list}</div></div>`;
    }

    private _labelText = '';
    async toHtml(): Promise<string> {
        const id = this.getId();
        const key = this.getKey()!;
        this._labelText = String((await this.getLabel()) ?? '');
        const livewireKey = this.getLivewireKey() ?? '';
        const items = this.getItems();
        const keys = Object.keys(items);
        const tr = (name: string, replace: Record<string, string> = {}) => t(`filament-forms::components.builder.${name}`, replace);
        const descriptionId = (itemKey: string) => `${id}-item-${createHash('md5').update(itemKey).digest('hex')}`;
        const colors = colorsOf(this.livewire);
        const danger = colors?.getComponentClasses('icon-button', 'danger') ?? [];
        const gray = colors?.getComponentClasses('icon-button', 'gray') ?? [];
        const ctx = this.context();
        const context = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: key };
        const actions = Object.fromEntries((['add', 'addBetween', 'delete', 'clone', 'edit', 'moveUp', 'moveDown', 'reorder', 'collapse', 'expand', 'collapseAll', 'expandAll'] as const).map((name) => [name, this.builderAction(name)])) as Record<BuilderActionName, Action>;
        const resolve = (name: BuilderActionName, args: Record<string, unknown> = {}) => resolveAction(actions[name], ctx, args);
        const colorsFor = (resolved: ResolvedAction, defaultColor: string, defaultClasses: string[]) => colorClassesOf(colors, 'icon-button', resolved.color, defaultColor, defaultClasses);
        const extraItemActions = this.getExtraItemActions();
        const reorder = await resolve('reorder'), collapse = await resolve('collapse'), expand = await resolve('expand');
        const rows: string[] = [];
        for (const [index, itemKey] of keys.entries()) {
            const item = items[itemKey];
            const block = this.getBlock(item.type)!;
            const args = { item: itemKey };
            const edit = await resolve('edit', args);
            const showEdit = this._blockPreviews && edit.visible;
            let header = '';
            if (this._blockHeaders) {
                const moveButton = async (action: 'moveUp' | 'moveDown', fallbackIcon: string, direction: string, disabled: boolean) => {
                    const resolved = await resolve(action, args);
                    if (!resolved.visible) return '';
                    const expression = this.actionExpression(action, args);
                    return `<li x-on:click.stop${this._reorderableWithButtons ? '' : ' class="fi-sr-only"'}>${iconActionButton({ inHeader: true, label: resolved.label, icon: resolved.icon ?? fallbackIcon, expression, disabled: disabled || resolved.disabled, colorClasses: colorsFor(resolved, 'gray', []), attributes: { tabindex: this._reorderableWithButtons ? null : '-1', 'data-reorder-hidden': 'data-reorder-hidden', 'data-reorder-direction': direction, 'data-reorder-action': expression, 'aria-describedby': descriptionId(itemKey) } })}</li>`;
                };
                const blockIcon = block.getIcon();
                const collapseHtml = this._collapsible ? `<li class="fi-fo-builder-item-header-collapsible-actions" x-on:click.stop="toggleCollapsed"><div class="fi-fo-builder-item-header-collapse-action"><button title="${e(collapse.label)}" aria-label="${e(collapse.label)}" type="button" class="${cls(['fi-ac-icon-btn-action', 'fi-icon-btn', 'fi-size-sm', ...colorsFor(collapse, 'gray', gray)])}">${icon(collapse.icon ?? fieldActionIcon('builder', 'collapse'))}</button></div><div class="fi-fo-builder-item-header-expand-action"><button title="${e(expand.label)}" aria-label="${e(expand.label)}" type="button" class="${cls(['fi-ac-icon-btn-action', 'fi-icon-btn', 'fi-size-sm', ...colorsFor(expand, 'gray', gray)])}">${icon(expand.icon ?? fieldActionIcon('builder', 'expand'))}</button></div></li>` : '';
                const reorderHtml = this.canDrag() && reorder.visible ? `<li x-on:click.stop><button title="${e(reorder.label)}" aria-label="${e(reorder.label)}" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${cls(['fi-ac-icon-btn-action', 'fi-icon-btn', 'fi-size-sm', ...colorsFor(reorder, 'gray', [])])}" x-sortable-handle="x-sortable-handle">${icon(reorder.icon ?? fieldActionIcon('builder', 'reorder'))}</button></li>` : '';
                const moves = this.canMove() ? `${await moveButton('moveUp', fieldActionIcon('builder', 'move-up'), 'up', index === 0)}${await moveButton('moveDown', fieldActionIcon('builder', 'move-down'), 'down', index === keys.length - 1)}` : '';
                const extra: string[] = [];
                for (const extraAction of extraItemActions) {
                    extraAction.arguments(args);
                    if (await extraAction.isVisible(itemContext(ctx, args))) extra.push(`<li x-on:click.stop>${await extraAction.toHtml(itemContext(ctx, args), context)}</li>`);
                }
                const clone = await resolve('clone', args), del = await resolve('delete', args);
                const end = [
                    ...extra,
                    showEdit ? `<li x-on:click.stop>${iconActionButton({ inHeader: true, label: edit.label, icon: edit.icon ?? fieldActionIcon('builder', 'edit'), expression: this.actionExpression('edit', args), disabled: edit.disabled, colorClasses: colorsFor(edit, 'gray', []) })}</li>` : '',
                    this._cloneable && clone.visible ? `<li x-on:click.stop>${iconActionButton({ inHeader: true, label: clone.label, icon: clone.icon ?? fieldActionIcon('builder', 'clone'), expression: this.actionExpression('clone', args), disabled: clone.disabled, colorClasses: colorsFor(clone, 'gray', []) })}</li>` : '',
                    this._deletable && del.visible ? `<li x-on:click.stop>${iconActionButton({ inHeader: true, label: del.label, icon: del.icon ?? fieldActionIcon('builder', 'delete'), expression: this.actionExpression('delete', args), disabled: del.disabled, colorClasses: colorsFor(del, 'danger', danger) })}</li>` : '',
                    collapseHtml,
                ].join('');
                const label = block.getLabel({ state: item.data, key: itemKey, index });
                header = `<div${this._collapsible ? ' x-on:click.stop="toggleCollapsed"' : ''} class="fi-fo-builder-item-header">${reorderHtml || moves ? `<ul class="fi-fo-builder-item-header-start-actions">${reorderHtml}${moves}</ul>` : ''}${this._blockIcons && blockIcon ? icon(blockIcon, { attributes: new Attributes().class(['fi-fo-builder-item-header-icon']) }) : ''}<${this._headingTag} class="fi-fo-builder-item-header-label fi-truncated">${e(label)}${this._blockNumbers ? ` ${index + 1}` : ''}</${this._headingTag}><ul class="fi-fo-builder-item-header-end-actions">${end}</ul></div>`;
            }
            const hasPreview = this._blockPreviews && block.hasPreview();
            const content = hasPreview
                ? `<div class="${cls(['fi-fo-builder-item-preview', { 'fi-interactive': this._interactivePreviews }])}">${block.renderPreview(item.data)}</div>${showEdit && !this._interactivePreviews ? `<div class="fi-fo-builder-item-preview-edit-overlay" role="button" x-on:click.stop="${e(`editItem(${js(itemKey)})`)}"></div>` : ''}`
                : await this.itemSchema(itemKey, item).toHtml();
            rows.push(`<li wire:ignore.self wire:key="${e(livewireKey)}.${e(itemKey)}.data.item" x-data="item(${e(js({ isCollapsed: this._collapsed, collapseKey: this._persistCollapsed ? `filament:builder:collapsed:${key}-${itemKey}` : null }))})" x-on:builder-expand.window="expandFromEvent" x-on:builder-collapse.window="collapseFromEvent" x-on:expand="expand" x-sortable-item="${e(itemKey)}" class="${cls(['fi-fo-builder-item', { 'fi-fo-builder-item-has-header': this._blockHeaders }])}" x-bind:class="itemClasses">${header}<div x-show="! isCollapsed" class="${cls(['fi-fo-builder-item-content', { 'fi-fo-builder-item-content-has-preview': hasPreview }])}">${content}</div></li>`);
            if (index < keys.length - 1) {
                const addBetween = await resolve('addBetween', { afterItem: itemKey });
                if (addBetween.visible && this._addable && this.getBlockPickerBlocks().length && Object.keys(items).length < this._maxItems) rows.push(`<li class="fi-fo-builder-add-between-items-ctn"><div class="fi-fo-builder-add-between-items"><div class="fi-fo-builder-block-picker-ctn">${this.blockPickerHtml(addBetween, itemKey)}</div></div></li>`);
                else if (this._labelBetweenItems) rows.push(`<li class="fi-fo-builder-label-between-items-ctn"><div class="fi-fo-builder-label-between-items-divider-before"></div><span class="fi-fo-builder-label-between-items">${e(this._labelBetweenItems)}</span><div class="fi-fo-builder-label-between-items-divider-after"></div></li>`);
            }
        }
        const config = { statePath: this.getStatePath(), schemaComponent: key, moveUpAction: 'moveUp', moveDownAction: 'moveDown', reorderAction: 'reorder', message: tr('reordering.moved'), hasCustomReorderAction: Boolean(this._actionModifiers.reorder) };
        const descriptions = keys.map((itemKey, index) => {
            const label = this.getBlock(items[itemKey].type)!.getLabel({ state: items[itemKey].data, key: itemKey, index }).trim() || tr('reordering.item');
            return `<span class="fi-sr-only" data-reorder-description="${e(itemKey)}" data-reorder-label="${e(label)}" id="${e(descriptionId(itemKey))}">${e(tr('reordering.position', { label, position: String(index + 1), count: String(keys.length) }))}</span>`;
        }).join('');
        const list = keys.length ? `<ul x-sortable x-ref="reorderItems" data-sortable-animation-duration="300" x-on:end.stop="reorder" class="fi-fo-builder-items">${rows.join('')}</ul>` : '';
        const link = (resolved: ResolvedAction, click: string) => (resolved.visible ? `<span x-on:click="${click}"><button type="button" class="${cls(['fi-ac-link-action', 'fi-link', 'fi-size-sm', ...(colors?.getComponentClasses('link', resolved.color) ?? [])])}">${resolved.icon ? icon(resolved.icon, { size: 'sm' }) : ''}<span class="fi-link-label">${e(resolved.label)}</span></button></span>` : '');
        const collapseLinks = this._collapsible ? link(await resolve('collapseAll'), 'collapseAll') + link(await resolve('expandAll'), 'expandAll') : '';
        const collapseAll = collapseLinks ? `<div class="${cls(['fi-fo-builder-actions', { 'fi-hidden': keys.length < 2 }])}">${collapseLinks}</div>` : '';
        const add = await resolve('add');
        const picker = this._addable && add.visible && keys.length < this._maxItems ? this.blockPickerHtml(add) : '';
        const html = `<div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" data-reorder-owner="data-reorder-owner" data-reorder-items="${e(JSON.stringify(keys))}" x-load="x-load" x-load-src="${e(asset('builder'))}" x-data="builderFormComponent(${e(js(config))})" class="${cls([this._extraClass, 'fi-fo-builder', { 'fi-collapsible': this._collapsible }])}"><span wire:ignore x-ref="reorderStatus" class="fi-sr-only" role="status" aria-live="polite" aria-atomic="true"></span>${collapseAll}${list}${picker}${descriptions}</div>`;
        return this.wrap(html, { labelAsDiv: true });
    }
}

/** Text of an HTML fragment's entities (the search prompt is plain text). */
function decodeEntities(text: string): string {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
        if (code[0] === '#') { const point = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10); return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match; }
        return named[code.toLowerCase()] ?? match;
    });
}
