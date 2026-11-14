// Enums: a fixed set of values, each with an optional label, color, icon and description.
// An enum can be passed as field and filter options, and columns and entries display a value through its enum (label,
// badge color, icon).

/** Text that may be computed when it is read (a translation), e.g. `() => t('statuses.draft')`. */
export type EnumText = string | (() => string);

/** What a case may declare. Every property is optional; a plain string is the label. */
export type EnumCaseDefinition = {
    /** Displayed instead of the value. */
    label?: EnumText | null;
    /** A color name (`gray`, `success`, `danger`…), used by badges, icons and toggle buttons. */
    color?: string | null;
    /** An icon name (`m-pencil`, `o-check`…), shown next to the label. */
    icon?: string | null;
    /** Helper text under the label, in radio buttons and checkbox lists. */
    description?: EnumText | null;
    /** A navigation group built from this case (`NavigationGroup.fromEnum()`) starts collapsed. */
    collapsed?: boolean | null;
    /** Whether that navigation group can be collapsed. */
    collapsible?: boolean | null;
};

export type EnumValueOf<D> = D extends readonly (infer V)[] ? V & (string | number) : Extract<keyof D, string>;

const ENUM = Symbol.for('navette.enum');
const ENUM_CASE = Symbol.for('navette.enumCase');

const read = (text: EnumText | null | undefined): string | null => (typeof text === 'function' ? text() : text ?? null);

/** One value (case) of an enum. Converts to its value in strings and JSON. */
export class EnumCase<V extends string | number = string> {
    /** The stored value. */
    readonly value: V;
    /** The case name: the key of a TypeScript `enum`, or the value. */
    readonly name: string;
    readonly #definition: EnumCaseDefinition;

    constructor(value: V, name: string, definition: EnumCaseDefinition = {}) {
        Object.defineProperty(this, ENUM_CASE, { value: true });
        this.value = value;
        this.name = name;
        this.#definition = definition;
    }

    /** The label, or the case name when there is none. */
    getLabel(): string { return read(this.#definition.label) ?? this.name; }
    getColor(): string | null { return this.#definition.color ?? null; }
    getIcon(): string | null { return this.#definition.icon ?? null; }
    getDescription(): string | null { return read(this.#definition.description); }
    /** `collapsed` of the definition (`null` when unset). */
    isCollapsed(): boolean | null { return this.#definition.collapsed ?? null; }
    /** `collapsible` of the definition (`null` when unset). */
    isCollapsible(): boolean | null { return this.#definition.collapsible ?? null; }
    get label(): string { return this.getLabel(); }
    get color(): string | null { return this.getColor(); }
    get icon(): string | null { return this.getIcon(); }
    get description(): string | null { return this.getDescription(); }
    /** Whether this case has the given value (`'draft'`, `1`, or another case). */
    is(value: unknown): boolean { return valueKey(value) === String(this.value); }
    toString(): string { return String(this.value); }
    toJSON(): V { return this.value; }
    valueOf(): V { return this.value; }
}

/** Key a value is compared with: cases by their value, numbers and strings as strings (form state is always a string). */
const valueKey = (value: unknown): string | null => {
    if (isEnumCase(value)) return String(value.value);
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    return null;
};

/**
 * A fixed set of values (`defineEnum()`, `nativeEnum()`). Accepted by `Select`, `Radio`, `CheckboxList`, `ToggleButtons`,
 * `SelectColumn` and `SelectFilter` options, by the `in()` / `enum()` validation rules, and by `enum()` on columns and
 * entries (or a model's `static casts`), which display values through it.
 */
export class Enum<V extends string | number = string> {
    readonly #cases: EnumCase<V>[];
    readonly #byKey: Map<string, EnumCase<V>>;

    constructor(cases: EnumCase<V>[]) {
        Object.defineProperty(this, ENUM, { value: true });
        this.#cases = cases;
        this.#byKey = new Map();
        for (const item of cases) {
            const key = String(item.value);
            if (this.#byKey.has(key)) throw new Error(`Enum value "${key}" is defined twice.`);
            this.#byKey.set(key, item);
        }
    }

    /** Every case, in definition order. */
    cases(): EnumCase<V>[] { return [...this.#cases]; }
    /** Every value, in definition order. */
    values(): V[] { return this.#cases.map((item) => item.value); }
    /** Whether the value (or a case) belongs to the enum. */
    has(value: unknown): boolean { return this.tryFrom(value) !== null; }
    /** The case of a value, or `null`. Numbers and numeric strings are interchangeable. */
    tryFrom(value: unknown): EnumCase<V> | null {
        const key = valueKey(value);
        return key === null ? null : this.#byKey.get(key) ?? null;
    }
    /** The case of a value; throws when the value is not in the enum. */
    from(value: unknown): EnumCase<V> {
        const found = this.tryFrom(value);
        if (!found) throw new RangeError(`"${String(value)}" is not a valid value of this enum.`);
        return found;
    }
    /** `[value, label]` pairs, for field and filter options. */
    options(): [string, string][] { return this.#cases.map((item) => [String(item.value), item.getLabel()]); }
    /** Labels by value. */
    labels(): Record<string, string> { return Object.fromEntries(this.options()); }
    /** Colors by value (cases without a color are left out). */
    colors(): Record<string, string> { return this.#collect((item) => item.getColor()); }
    /** Icons by value (cases without an icon are left out). */
    icons(): Record<string, string> { return this.#collect((item) => item.getIcon()); }
    /** Descriptions by value (cases without a description are left out). */
    descriptions(): Record<string, string> { return this.#collect((item) => item.getDescription()); }
    /** Label of a value; the value itself when it is not in the enum, `null` for an empty value. */
    getLabel(value: unknown): string | null { return this.tryFrom(value)?.getLabel() ?? (value === null || value === undefined ? null : String(value)); }
    getColor(value: unknown): string | null { return this.tryFrom(value)?.getColor() ?? null; }
    getIcon(value: unknown): string | null { return this.tryFrom(value)?.getIcon() ?? null; }
    getDescription(value: unknown): string | null { return this.tryFrom(value)?.getDescription() ?? null; }
    #collect(pick: (item: EnumCase<V>) => string | null): Record<string, string> {
        const out: Record<string, string> = {};
        for (const item of this.#cases) { const value = pick(item); if (value !== null && value !== '') out[String(item.value)] = value; }
        return out;
    }
}

/**
 * Defines an enum from its values: `{ value: definition }` or a list of values.
 *
 * ```ts
 * export const Status = defineEnum({
 *     draft: { label: 'Draft', color: 'gray', icon: 'm-pencil' },
 *     published: { label: 'Published', color: 'success', icon: 'm-check' },
 *     archived: 'Archived', // label only
 * });
 * export type Status = EnumValue<typeof Status>; // 'draft' | 'published' | 'archived'
 * ```
 */
export function defineEnum<const D extends Record<string, EnumText | EnumCaseDefinition> | readonly (string | number)[]>(definitions: D): Enum<EnumValueOf<D>> {
    if (Array.isArray(definitions)) return new Enum(definitions.map((value) => new EnumCase(value, String(value)))) as Enum<EnumValueOf<D>>;
    if (definitions === null || typeof definitions !== 'object') throw new TypeError('defineEnum() expects an object of cases or a list of values.');
    return new Enum(Object.entries(definitions).map(([value, definition]) => new EnumCase(value, value, typeof definition === 'object' && definition !== null ? definition : { label: definition as EnumText }))) as unknown as Enum<EnumValueOf<D>>;
}

/**
 * Wraps a TypeScript `enum` (string or numeric): the keys are the case names, the members their values. Labels, colors,
 * icons and descriptions can be added by case name or by value; without a label, a case shows its name.
 *
 * ```ts
 * enum Priority { Low = 1, High = 2 }
 * export const PriorityEnum = nativeEnum(Priority, { Low: { color: 'gray' }, High: { color: 'danger', icon: 'm-fire' } });
 * ```
 */
export function nativeEnum<T extends Record<string, string | number>>(native: T, definitions: Partial<Record<string, EnumText | EnumCaseDefinition>> = {}): Enum<T[keyof T] & (string | number)> {
    if (native === null || typeof native !== 'object') throw new TypeError('nativeEnum() expects a TypeScript enum.');
    const cases: EnumCase<T[keyof T] & (string | number)>[] = [];
    for (const [name, value] of Object.entries(native)) {
        // Numeric enums also map each value back to its name (`Priority[1] === 'Low'`): those entries are skipped.
        if (typeof value === 'string' && typeof native[value] === 'number' && String(native[value]) === name) continue;
        if (typeof value !== 'string' && typeof value !== 'number') continue;
        const definition = definitions[name] ?? definitions[String(value)];
        cases.push(new EnumCase(value as T[keyof T] & (string | number), name, typeof definition === 'object' && definition !== null ? definition : definition === undefined ? {} : { label: definition }));
    }
    return new Enum(cases);
}

/** The value type of an enum: `EnumValue<typeof Status>` is `'draft' | 'published'`. */
export type EnumValue<E> = E extends Enum<infer V> ? V : never;

export function isEnum(value: unknown): value is Enum<string | number> {
    return value !== null && typeof value === 'object' && (value as any)[ENUM] === true;
}
export function isEnumCase(value: unknown): value is EnumCase<string | number> {
    return value !== null && typeof value === 'object' && (value as any)[ENUM_CASE] === true;
}

/**
 * The enum a model casts an attribute to: `static casts = { status: Status }` on the record's class. Values stay as stored; columns, entries and table groups display them through the enum.
 */
export function enumCast(record: unknown, attribute: string): Enum<string | number> | null {
    if (record === null || typeof record !== 'object') return null;
    const casts = (record.constructor as { casts?: unknown } | undefined)?.casts;
    if (casts === null || typeof casts !== 'object' || !Object.prototype.hasOwnProperty.call(casts, attribute)) return null;
    const cast = (casts as Record<string, unknown>)[attribute];
    return isEnum(cast) ? cast : null;
}

/**
 * Case of a displayed state item: the item itself when it is a case, or its case in the given enum, or in the enum the
 * record's model casts the attribute to. `null` when there is no enum or the value is not in it.
 */
export function resolveEnumCase(item: unknown, options: { enum?: Enum<string | number> | null; record?: unknown; attribute?: string } = {}): EnumCase<string | number> | null {
    if (isEnumCase(item)) return item;
    const source = options.enum ?? (options.attribute ? enumCast(options.record, options.attribute) : null);
    return source ? source.tryFrom(item) : null;
}

/** Option pairs of an enum, or `null` when the value is not an enum (helper for components accepting both). */
export function enumOptions(value: unknown): [string, string][] | null {
    return isEnum(value) ? value.options() : null;
}
