// Shared by Repeater and Builder: item keys (`generateUuidUsing()`, `fake()`), processing limits (`maxItemsForProcessing()`),
// lazy item schemas, and the fields that look at their sibling items (`distinct`, `fixIndistinctState()`,
// `disableOptionsWhenSelectedInSiblingRepeaterItems()`).
import { evaluate, type Lazy } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import type { Component, ComponentContext, Schema } from '@navette-js/schemas';
import { randomUUID } from 'node:crypto';
import { isBlank, type Rule } from './rules.ts';

/**
 * How a Repeater or a Builder names new items: `null` (default) a random UUID; `false` numeric keys (`0`, `1`, `2`…), as a
 * list would; a function returns the key (a falsy result falls back to the next numeric key).
 */
export type ItemKeyGenerator = (() => string | number | null | undefined) | boolean | null;

/** Next item key, given the keys already used. */
export function generateItemKey(generator: ItemKeyGenerator, existingKeys: Iterable<string>): string {
    if (typeof generator === 'function') {
        const key = generator();
        if (key !== null && key !== undefined && key !== '') return String(key);
    } else if (generator !== false) return randomUUID();
    let next = 0;
    for (const key of existingKeys) if (/^\d{1,15}$/.test(key)) next = Math.max(next, Number(key) + 1);
    return String(next);
}

/** Thrown when a Repeater or a Builder receives more items than `maxItemsForProcessing()` allows: answered with HTTP 413. */
export class ItemsProcessingLimitError extends Error {
    readonly status = 413;
    readonly count: number;
    readonly limit: number;
    constructor(count: number, limit: number) { super(`Too many items to process (${count}, at most ${limit}).`); this.count = count; this.limit = limit; }
}

/** Stops before building item schemas for an unexpectedly large state (like Filament, nothing is truncated). */
export function ensureItemsCanBeProcessed(count: number, limit: number | null): void {
    if (limit !== null && count > limit) throw new ItemsProcessingLimitError(count, limit);
}

/** Number of entries of a raw item state (a keyed object or a list). */
export function rawItemCount(state: unknown): number {
    if (Array.isArray(state)) return state.length;
    return state && typeof state === 'object' ? Object.keys(state).length : 0;
}

/**
 * Makes an item schema lazy: from the component's own `lazyLoaded()` (Repeater, Builder), or from the `Schema` given to
 * `schema()` with `lazyLoaded()`. Each item schema keeps its own key (its state path), so items load independently.
 */
export function applyLazyItemSchema(schema: Schema, component: Component, template: Schema | null): Schema {
    const own = component.getLazyLoadedCondition();
    const conditions: (() => Promise<boolean>)[] = [];
    if (own !== false) conditions.push(async () => Boolean(await evaluate(own, component.context())));
    if (template) conditions.push(() => template.isLazyLoaded());
    if (conditions.length) schema.lazyLoaded(async () => { for (const condition of conditions) if (await condition()) return true; return false; });
    return schema;
}

// ---------------------------------------------------------------- sibling repeater items

type RepeaterLike = Component & { getRawItemState(key: unknown): unknown };
const isRepeaterLike = (component: Component | null): component is RepeaterLike => component !== null && typeof (component as any).getRawItemState === 'function' && typeof (component as any).getItems === 'function';

/** The Repeater or Builder holding a component (through layout components), with the item key and the path inside the item. */
export function getParentRepeaterItem(component: Component): { repeater: RepeaterLike; itemKey: string; itemPath: string } | null {
    let schema: Schema | undefined = component.container;
    while (schema) {
        const parent = schema.getParentComponent();
        if (!parent) return null;
        if (isRepeaterLike(parent)) {
            const prefix = `${parent.getStatePath()}.`;
            const path = component.getStatePath();
            if (!path.startsWith(prefix)) return null;
            const rest = path.slice(prefix.length);
            const dot = rest.indexOf('.');
            if (dot < 1) return null;
            return { repeater: parent, itemKey: rest.slice(0, dot), itemPath: rest.slice(dot + 1) };
        }
        schema = parent.container;
    }
    return null;
}

const readPath = (target: unknown, path: string): unknown => path.split('.').reduce((node: any, key) => (node !== null && typeof node === 'object' && Object.hasOwn(node, key) ? node[key] : undefined), target);
function writePath(target: any, path: string, value: unknown): void {
    const segments = path.split('.');
    let node = target;
    for (const key of segments.slice(0, -1)) { if (node[key] === null || typeof node[key] !== 'object') return; node = node[key]; }
    node[segments[segments.length - 1]] = value;
}

/** Raw state of the sibling items: `item key → value of the same field`, without the component's own item. */
function siblingStates(component: Component): { states: [string, unknown][]; repeaterPath: string; itemPath: string } | null {
    const found = getParentRepeaterItem(component);
    if (!found) return null;
    const raw = found.repeater.context().state;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const states = Object.entries(raw as Record<string, unknown>).filter(([key]) => key !== found.itemKey).map(([key, item]): [string, unknown] => [key, readPath(item, found.itemPath)]);
    return { states, repeaterPath: found.repeater.getStatePath(), itemPath: found.itemPath };
}
const scalar = (value: unknown) => (value !== null && typeof value === 'object' && 'value' in (value as any) ? (value as any).value : value);
const same = (a: unknown, b: unknown) => a === b || (a !== null && b !== null && typeof a !== 'boolean' && typeof b !== 'boolean' && a !== undefined && b !== undefined && String(scalar(a)) === String(scalar(b)));

/**
 * Validation that a field's state is unique across the items of its parent Repeater or Builder (Filament's `distinct()` on a
 * repeated field): a boolean may be `true` in one item only (and, when required, in at least one); another value, or a value
 * of a list, may be picked in one item only. Outside a repeater, the rules pass.
 */
export function siblingDistinctRules(condition: Lazy<boolean, ComponentContext> = true): Rule[] {
    const enabled = async (ctx: ComponentContext) => Boolean(await evaluate(condition, ctx));
    const message = (key: string, fallback: string) => (attribute: string) => {
        const translated = t(`navette-forms::validation.${key}`, { attribute });
        return translated === `navette-forms::validation.${key}` ? fallback.replace(':attribute', attribute) : translated;
    };
    return [
        {
            name: 'distinct',
            passes: async (value, ctx) => {
                if (typeof value === 'boolean' || !(await enabled(ctx))) return true;
                const siblings = siblingStates(ctx.component);
                if (!siblings) return true;
                if (Array.isArray(value)) return !siblings.states.some(([, other]) => Array.isArray(other) && other.some((item) => value.some((own) => same(own, item))));
                return !siblings.states.some(([, other]) => same(other, value));
            },
            message: (attribute) => `The ${attribute} field has a duplicate value.`,
        },
        {
            name: 'distinct.only_one_must_be_selected',
            passes: async (value, ctx) => value !== true || !(await enabled(ctx)) || !(siblingStates(ctx.component)?.states.some(([, other]) => other === true) ?? false),
            message: message('distinct.only_one_must_be_selected', 'Only one :attribute field must be selected.'),
        },
        {
            name: 'distinct.must_be_selected',
            passes: async (value, ctx) => {
                if (value !== false || !(await enabled(ctx))) return true;
                const siblings = siblingStates(ctx.component);
                if (!siblings || siblings.states.some(([, other]) => other === true)) return true;
                return !(await (ctx.component as any).isRequired?.());
            },
            message: message('distinct.must_be_selected', 'At least one :attribute field must be selected.'),
        },
    ];
}

/** Clears the sibling items' state that duplicates the component's new state (see `fixIndistinctState()`). */
export function fixIndistinctSiblingState(component: Component): void {
    const state = component.context().state;
    if (isBlank(state)) return;
    const siblings = siblingStates(component);
    if (!siblings) return;
    const livewire = component.livewire as any;
    for (const [key, other] of siblings.states) {
        const path = `${siblings.repeaterPath}.${key}.${siblings.itemPath}`;
        if (Array.isArray(state)) {
            if (!Array.isArray(other)) continue;
            const kept = other.filter((item) => !state.some((own) => same(own, item)));
            if (kept.length !== other.length) writePath(livewire, path, kept);
            continue;
        }
        if (other === false || isBlank(other) || !same(other, state)) continue;
        writePath(livewire, path, other === true ? false : null);
    }
}

type FieldLike = Component & { live(...args: any[]): unknown; hasAfterStateUpdated(): boolean; callAfterStateUpdated(...args: any[]): Promise<void>; rule(rule: Rule): unknown };
const FIX_CONDITION = Symbol('fixIndistinctState');

/**
 * `fixIndistinctState()`: `distinct()` validation across the sibling items, `live()`, and after each change of the state, the
 * same value is removed from the other items (a checkbox or a toggle is turned off, a selected option deselected).
 */
export function applyFixIndistinctState<T extends Component>(component: T, condition: Lazy<boolean, ComponentContext> = true): T {
    const field = component as unknown as FieldLike & Record<symbol, unknown>;
    if (condition === false) return component;
    for (const rule of siblingDistinctRules(condition)) field.rule(rule);
    field.live();
    const alreadyWrapped = Object.hasOwn(field, FIX_CONDITION);
    field[FIX_CONDITION] = condition;
    if (alreadyWrapped) return component;
    const prototype = Object.getPrototypeOf(field) as FieldLike;
    // Own properties: they are copied with the component when a repeater clones its item schema, and run with `this` = the copy.
    Object.assign(field, {
        hasAfterStateUpdated(this: FieldLike) { return true; },
        async callAfterStateUpdated(this: FieldLike & Record<symbol, unknown>, ...args: unknown[]) {
            if (prototype.hasAfterStateUpdated.call(this)) await prototype.callAfterStateUpdated.apply(this, args);
            if (await evaluate(this[FIX_CONDITION] as Lazy<boolean, ComponentContext>, this.context())) fixIndistinctSiblingState(this);
        },
    });
    return component;
}

/**
 * Option disabler of `disableOptionsWhenSelectedInSiblingRepeaterItems()`: an option picked in another item of the parent
 * Repeater or Builder is disabled (unless the field itself holds it). Called as a method of the field (`this`).
 */
export function siblingSelectedOptionDisabler(): (this: Component, value: string) => boolean {
    return function (this: Component, value: string): boolean {
        const siblings = siblingStates(this);
        if (!siblings) return false;
        const own = ([] as unknown[]).concat(this.context().state ?? []).map((item) => String(scalar(item)));
        return siblings.states.flatMap(([, other]) => ([] as unknown[]).concat(other)).filter((item) => !isBlank(item) && typeof item !== 'boolean').map((item) => String(scalar(item))).filter((item) => !own.includes(item)).includes(String(value));
    };
}

/** `disableOptionsWhenSelectedInSiblingRepeaterItems()`: distinct validation, `live()`, and the sibling option disabler. */
export function applyDisableOptionsWhenSelectedInSiblingRepeaterItems<T extends Component>(component: T): T {
    const field = component as unknown as FieldLike & { disableOptionWhen(callback: unknown): unknown };
    for (const rule of siblingDistinctRules(true)) field.rule(rule);
    field.live();
    field.disableOptionWhen(siblingSelectedOptionDisabler());
    return component;
}
