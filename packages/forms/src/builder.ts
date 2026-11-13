// @navette-js/forms/builder — a list of items, each one a "block" picked from a menu.
// The state is a map `item key → { type, data }`; key order is display order.
// Not supported yet: block previews, collapsing, searching the block picker.
import { Attributes, cls, e, icon, js, loadingIndicator, views, type ColorManager, configured } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { Action } from '@navette-js/actions';
import { Schema, type Component } from '@navette-js/schemas';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Field, fillSchema } from './index.ts';

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
/** Item type of a Builder. */
export class Block {
    readonly name: string;
    private _label: string | null = null;
    private _icon: string | null = null;
    private _schema: (ctx: BlockContext) => Component[] = () => [];
    private _defaults: ((builder: Builder) => Record<string, unknown>) | null = null;
    private _pickerGroup: string | null = null;
    constructor(name: string) { this.name = name; }
    static make(name: string): Block { return configured(new Block(name)); }
    label(label: string | null): this { this._label = label; return this; }
    /** Group of the block in the block picker (also set by passing `{ 'Group label': [blocks] }` to `blocks()`). */
    pickerGroup(label: string | null): this { this._pickerGroup = label; return this; }
    getPickerGroup(): string | null { return this._pickerGroup; }
    icon(name: string | null): this { this._icon = name; return this; }
    /** Item components: a function called for each item (with its current data). */
    schema(factory: (ctx: BlockContext) => Component[]): this { this._schema = factory; return this; }
    /** Data of a new item when it cannot be derived from the fields' defaults (fields depending on another). */
    defaultData(factory: (builder: Builder) => Record<string, unknown>): this { this._defaults = factory; return this; }
    getLabel(): string { return this._label ?? this.name.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()); }
    getIcon(): string | null { return this._icon; }
    getComponents(ctx: BlockContext): Component[] { return this._schema(ctx); }
    getDefaults(builder: Builder): Record<string, unknown> | null { return this._defaults ? this._defaults(builder) : null; }
}

type Item = { type: string; data: Record<string, unknown> };
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
    private _addBetween = true;
    private _addBetweenLabel: string | null = null;
    private _addLabel: string | null = null;
    private _addIcon: string | null = null;
    private _addAlignment: 'start' | 'center' | 'end' | null = null;
    private _maxItems = 100;
    private _extraClass: string | null = null;
    private _uuid: () => string = randomUUID;
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
    /** "Insert between blocks" picker between two items (on by default). */
    addBetweenAction(condition = true): this { this._addBetween = condition; return this; }
    addBetweenActionLabel(label: string | null): this { this._addBetweenLabel = label; return this; }
    addActionLabel(label: string | null): this { this._addLabel = label; return this; }
    addActionIcon(name: string | null): this { this._addIcon = name; return this; }
    addActionAlignment(alignment: 'start' | 'center' | 'end' | null): this { this._addAlignment = alignment; return this; }
    maxItems(count: number): this { this._maxItems = count; return this; }
    /** Class added to the root (e.g. `fi-fo-builder-not-contained`). */
    extraClass(name: string | null): this { this._extraClass = name; return this; }
    generateUuidUsing(generator: () => string): this { this._uuid = generator; return this; }

    getBlocks(): Block[] { return (this._resolvedBlocks ??= typeof this._blocks === 'function' ? this._blocks() : this._blocks); }
    getBlock(name: unknown): Block | undefined { return typeof name === 'string' ? this.getBlocks().find((block) => block.name === name) : undefined; }
    /** Blocks offered in the picker (a subclass may remove some). */
    getBlockPickerBlocks(): Block[] { return this.getBlocks(); }

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
        return new Schema(container.livewire).key(`${this.getKey()}.${itemKey}.data`).statePath(`${this.getStatePath()}.${itemKey}.data`).operation(container.getOperation()).record(container.getRecord()).root(false)
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
    /** A subclass may refuse adding (a rule cap, for instance). */
    protected canAdd(_block: Block): boolean { return Object.keys(this.getItems()).length < this._maxItems; }

    getActions(): Action[] {
        const insert = (items: Record<string, Item>, after: string | null, key: string, item: Item) => {
            if (after === null || !Object.hasOwn(items, after)) return { ...items, [key]: item };
            return Object.fromEntries(Object.entries(items).flatMap(([k, v]) => (k === after ? [[k, v], [key, item]] : [[k, v]])));
        };
        const move = (offset: number) => ({ arguments: args }: { arguments: Record<string, unknown> }) => {
            const items = this.getItems();
            const keys = Object.keys(items);
            const from = keys.indexOf(String(args.item));
            const to = from + offset;
            if (from < 0 || to < 0 || to >= keys.length) return;
            [keys[from], keys[to]] = [keys[to], keys[from]];
            this.setItems(Object.fromEntries(keys.map((key) => [key, items[key]])));
        };
        return [
            ...this.getHintActions(),
            Action.make('add').action(({ arguments: args }) => {
                const block = this.getBlockPickerBlocks().find((candidate) => candidate.name === args.block);
                if (!block || !this.canAdd(block)) return;
                this.setItems(insert(this.getItems(), typeof args.afterItem === 'string' ? args.afterItem : null, this._uuid(), this.newItem(block)));
            }),
            Action.make('addBetween').action(({ arguments: args }) => {
                const block = this.getBlockPickerBlocks().find((candidate) => candidate.name === args.block);
                const items = this.getItems();
                if (!this._addBetween || !block || !this.canAdd(block) || typeof args.afterItem !== 'string' || !Object.hasOwn(items, args.afterItem)) return;
                this.setItems(insert(items, args.afterItem, this._uuid(), this.newItem(block)));
            }),
            Action.make('delete').action(({ arguments: args }) => { const items = this.getItems(); const key = String(args.item); if (!Object.hasOwn(items, key)) return; delete items[key]; this.setItems(items); }),
            Action.make('clone').action(({ arguments: args }) => {
                const items = this.getItems();
                const key = String(args.item);
                if (!this._cloneable || !Object.hasOwn(items, key) || !this.canAdd(this.getBlock(items[key].type)!)) return;
                this.setItems(insert(items, key, this._uuid(), this.cloneItem(items[key])));
            }),
            Action.make('moveUp').action(move(-1)),
            Action.make('moveDown').action(move(1)),
            // Drag and drop: the new order is only accepted if it is a permutation of the existing keys.
            Action.make('reorder').action(({ arguments: args }) => {
                const items = this.getItems();
                const keys = Object.keys(items);
                const order = Array.isArray(args.items) ? args.items.map(String) : [];
                if (order.length !== keys.length || new Set(order).size !== keys.length || !order.every((key) => Object.hasOwn(items, key))) return;
                this.setItems(Object.fromEntries(order.map((key) => [key, items[key]])));
            }),
        ];
    }
    /** Copy of an item; a subclass renews the keys of nested items. */
    protected cloneItem(item: Item): Item { return JSON.parse(JSON.stringify(item)); }

    /** `mountAction(...)` expression for an action of this component. */
    actionExpression(action: string, args: Record<string, unknown> | null): string {
        const context = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: this.getKey() };
        return `mountAction(${js(action)}, ${args ? js(args) : '{}'}, ${js(context)})`;
    }

    private blockPickerHtml(afterItem: string | null = null): string {
        const key = this.getKey()!;
        const blocks = this.getBlockPickerBlocks();
        const tr = (name: string) => t(`filament-forms::components.builder.${name}`);
        const between = afterItem !== null;
        const actionName = between ? 'addBetween' : 'add';
        const alignment = between ? null : this._addAlignment;
        const placement = alignment === 'start' ? 'bottom-start' : alignment === 'end' ? 'bottom-end' : null;
        const widthClass = this._pickerWidth ? `fi-width-${this._pickerWidth}` : null;
        const signature = `${widthClass ?? ''}|${placement ?? ''}|${blocks.length ? 1 : 0}|0`;
        const wireKey = `${key}.${actionName}.${afterItem ?? ''}.block-picker.${PICKER_HASHES[signature] ?? createHash('md5').update(signature).digest('hex')}`;
        const items = blocks.map((block) => {
            const expression = `mountAction('${actionName}', ${js(between ? { block: block.name, afterItem } : { block: block.name })}, { schemaComponent: ${js(key)} })`;
            const blockIcon = block.getIcon();
            return `<button x-on:click="close" wire:click="${e(expression)}" type="button" wire:loading.attr="disabled" wire:target="${e(expression)}" class="fi-dropdown-list-item">${blockIcon ? icon(blockIcon, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': expression }) }) + loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': expression })) : ''}<span class="fi-dropdown-list-item-label">${e(block.getLabel())}</span></button>`;
        });
        const grid = this._pickerColumns ? ` class="fi-grid fi-grid-direction-col lg:fi-grid-cols" style="--cols-lg: ${this._pickerColumns}; --cols-default: 1;"` : ' class="fi-grid fi-grid-direction-col" style="--cols-default: 1;"';
        // Grouped blocks: one labelled group per picker group (ungrouped blocks first), the groups laid out in the grid.
        const groups = new Map<string, string[]>();
        blocks.forEach((block, index) => { const group = block.getPickerGroup() ?? ''; groups.set(group, [...(groups.get(group) ?? []), items[index]]); });
        const grouped = [...groups.keys()].some((group) => group !== '');
        const content = grouped
            ? `<div${grid.replace(/class="([^"]*)"/, 'class="$1 fi-fo-builder-block-picker-groups"')}>${[...groups].map(([group, groupItems]) => `<div class="fi-fo-builder-block-picker-group"${group ? ` role="group" aria-label="${e(group)}"` : ''}>${group ? `<div class="fi-fo-builder-block-picker-group-label">${e(group)}</div>` : ''}${groupItems.join('')}</div>`).join('')}</div>`
            : `<div${grid}>${items.join('')}</div>`;
        const list = blocks.length ? `<div class="fi-dropdown-list"><div>${content}</div></div>` : '';
        const addIcon = !between && this._addIcon ? icon(this._addIcon, { size: 'sm' }) : '';
        const triggerLabel = between
            ? (this._addBetweenLabel ?? tr('actions.add_between.label'))
            : (this._addLabel ?? tr('actions.add.label').replace(':label', this._labelText.replace(/^./, (c) => c.toLowerCase())).trim());
        return `<div x-data="filamentDropdown({ isMenu: true })" wire:key="${e(wireKey)}" class="${cls(['fi-dropdown', 'fi-fo-builder-block-picker', alignment ? `fi-align-${alignment}` : null])}"><div x-on:mousedown="if ($event.button === 0) toggle($event)" class="fi-dropdown-trigger"><button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-ac-btn-action fi-btn fi-size-sm">${addIcon}${e(triggerLabel)}</button></div><div x-cloak="x-cloak" x-ref="panel" wire:key="${e(wireKey)}.panel" wire:ignore.self="" x-transition:enter-start="fi-opacity-0" x-transition:leave-end="fi-opacity-0" x-float${placement ? `.placement.${placement}` : ''}.flip.shift.offset="{ offset: 8 }" class="${cls(['fi-dropdown-panel', widthClass])}">${list}</div></div>`;
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
        const danger = colorsOf(this.livewire)?.getComponentClasses('icon-button', 'danger') ?? [];
        const rows: string[] = [];
        for (const [index, itemKey] of keys.entries()) {
            const item = items[itemKey];
            const block = this.getBlock(item.type)!;
            let header = '';
            if (this._blockHeaders) {
                const moveButton = (action: 'moveUp' | 'moveDown', label: string, iconName: string, direction: string, disabled: boolean) => {
                    const expression = this.actionExpression(action, { item: itemKey });
                    return `<li x-on:click.stop class="fi-sr-only">${iconActionButton({ inHeader: true, label, icon: iconName, expression, disabled, attributes: { tabindex: '-1', 'data-reorder-hidden': 'data-reorder-hidden', 'data-reorder-direction': direction, 'data-reorder-action': expression, 'aria-describedby': descriptionId(itemKey) } })}</li>`;
                };
                const blockIcon = block.getIcon();
                header = `<div class="fi-fo-builder-item-header"><ul class="fi-fo-builder-item-header-start-actions"><li x-on:click.stop><button title="${e(tr('actions.reorder.label'))}" aria-label="${e(tr('actions.reorder.label'))}" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-ac-icon-btn-action fi-icon-btn fi-size-sm" x-sortable-handle="x-sortable-handle">${icon('m-arrows-up-down')}</button></li>${moveButton('moveUp', tr('actions.move_up.label'), 'm-arrow-up', 'up', index === 0)}${moveButton('moveDown', tr('actions.move_down.label'), 'm-arrow-down', 'down', index === keys.length - 1)}</ul>${this._blockIcons && blockIcon ? icon(blockIcon, { attributes: new Attributes().class(['fi-fo-builder-item-header-icon']) }) : ''}<${this._headingTag} class="fi-fo-builder-item-header-label fi-truncated">${e(block.getLabel())}${this._blockNumbers ? ` ${index + 1}` : ''}</${this._headingTag}><ul class="fi-fo-builder-item-header-end-actions">${this._cloneable ? `<li x-on:click.stop>${iconActionButton({ inHeader: true, label: tr('actions.clone.label'), icon: 'm-square-2-stack', expression: this.actionExpression('clone', { item: itemKey }) })}</li>` : ''}<li x-on:click.stop>${iconActionButton({ inHeader: true, label: tr('actions.delete.label'), icon: 'm-trash', expression: this.actionExpression('delete', { item: itemKey }), colorClasses: danger })}</li></ul></div>`;
            }
            rows.push(`<li wire:ignore.self wire:key="${e(livewireKey)}.${e(itemKey)}.data.item" x-data="item(${e(js({ isCollapsed: false, collapseKey: null }))})" x-on:builder-expand.window="expandFromEvent" x-on:builder-collapse.window="collapseFromEvent" x-on:expand="expand" x-sortable-item="${e(itemKey)}" class="${cls(['fi-fo-builder-item', { 'fi-fo-builder-item-has-header': this._blockHeaders }])}" x-bind:class="itemClasses">${header}<div x-show="! isCollapsed" class="fi-fo-builder-item-content">${await this.itemSchema(itemKey, item).toHtml()}</div></li>`);
            if (index < keys.length - 1 && this._addBetween && this.canAdd(block)) rows.push(`<li class="fi-fo-builder-add-between-items-ctn"><div class="fi-fo-builder-add-between-items"><div class="fi-fo-builder-block-picker-ctn">${this.blockPickerHtml(itemKey)}</div></div></li>`);
            else if (index < keys.length - 1 && this._labelBetweenItems) rows.push(`<li class="fi-fo-builder-label-between-items-ctn"><div class="fi-fo-builder-label-between-items-divider-before"></div><span class="fi-fo-builder-label-between-items">${e(this._labelBetweenItems)}</span><div class="fi-fo-builder-label-between-items-divider-after"></div></li>`);
        }
        const config = { statePath: this.getStatePath(), schemaComponent: key, moveUpAction: 'moveUp', moveDownAction: 'moveDown', reorderAction: 'reorder', message: tr('reordering.moved'), hasCustomReorderAction: false };
        const descriptions = keys.map((itemKey, index) => {
            const label = this.getBlock(items[itemKey].type)!.getLabel().trim() || tr('reordering.item');
            return `<span class="fi-sr-only" data-reorder-description="${e(itemKey)}" data-reorder-label="${e(label)}" id="${e(descriptionId(itemKey))}">${e(tr('reordering.position', { label, position: String(index + 1), count: String(keys.length) }))}</span>`;
        }).join('');
        const list = keys.length ? `<ul x-sortable x-ref="reorderItems" data-sortable-animation-duration="300" x-on:end.stop="reorder" class="fi-fo-builder-items">${rows.join('')}</ul>` : '';
        const html = `<div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" data-reorder-owner="data-reorder-owner" data-reorder-items="${e(JSON.stringify(keys))}" x-load="x-load" x-load-src="${e(asset('builder'))}" x-data="builderFormComponent(${e(js(config))})" class="${cls([this._extraClass, 'fi-fo-builder'])}"><span wire:ignore x-ref="reorderStatus" class="fi-sr-only" role="status" aria-live="polite" aria-atomic="true"></span>${list}${this.blockPickerHtml()}${descriptions}</div>`;
        return this.wrap(html, { labelAsDiv: true });
    }
}
