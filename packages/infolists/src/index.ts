// @navette-js/infolists — read-only entries (TextEntry, IconEntry…).
import { Component, Schema, Text, renderInlineItems, type ComponentContext, type InlineItem, type Renderable } from '@navette-js/schemas';
import { Attributes, HtmlString, cls, e, evaluate, findShade, icon, icons, isSafeStorageKey, isSafeUrl, js, resolveStoredFileUrl, markdownToHtml, resolveEnumCase, sanitizeHtml, type AttrValue, type ClassList, type ColorManager, type FileUrlStorage, type Enum, type EnumCase, type Lazy, configured } from '@navette-js/support';
import { diffForHumans, t, tc } from '@navette-js/support/i18n';
import { loadMissingRelationships, loadRelationshipAggregates, normalizeRelationshipAggregates, readRecordPath, type AggregatedRelationship, type AggregatedRelationships, type RelationshipAggregateFunction } from '@navette-js/support';
import { highlightCode, highlightedLinesHtml } from './code-highlighter.ts';

export { setCodeHighlighterLoader } from './code-highlighter.ts';

const headline = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
/** Default label: "Department" for `department.name`. */
const defaultLabel = (name: string) => headline(name.includes('.') ? name.split('.').slice(-2, -1)[0] : name);

let colorManager: ColorManager | null = null;
export const useColorManager = (manager: ColorManager) => { colorManager = manager; };

// ------------------------------------------------------------------ helpers
type AttrMap = Record<string, AttrValue>;
/** Filament-style merge: the defaults come first (and keep their position), `class` and `style` are concatenated defaults-first. */
function mergeAttrs(defaults: AttrMap, attributes: AttrMap): AttrMap {
    const out: AttrMap = {};
    for (const [key, value] of Object.entries(defaults)) if (value !== null && value !== undefined && value !== false) out[key] = value;
    for (const [key, value] of Object.entries(attributes)) {
        if (value === null || value === undefined || value === false) continue;
        out[key] = (key === 'class' || key === 'style') && out[key] ? [out[key], value].filter((part) => part !== '').join(' ') : value;
    }
    return out;
}
/** Appends classes (the attribute keeps its position, or goes last). */
function withClass(attributes: AttrMap, list: ClassList): AttrMap {
    const added = cls(list);
    return added ? { ...attributes, class: attributes.class ? `${attributes.class} ${added}` : added } : attributes;
}
function withStyle(attributes: AttrMap, styles: (string | null | false)[]): AttrMap {
    const added = styles.filter(Boolean).join('; ');
    if (!added) return attributes;
    const existing = String(attributes.style ?? '').replace(/[;\s]+$/, '');
    return { ...attributes, style: `${existing ? `${existing}; ` : ''}${added};` };
}
/** Values are expected to be escaped already; only `"` is escaped again. */
const renderAttrs = (attributes: AttrMap) => new Attributes(attributes).toHtml();
const ATTRIBUTE_NAME = /^[a-zA-Z_:@][a-zA-Z0-9_:.@-]*$/;
/** Developer-supplied attributes: valid names only, values escaped. */
const escapeAttributes = (attributes: Record<string, unknown>): AttrMap => Object.fromEntries(Object.entries(attributes)
    .filter(([name, value]) => ATTRIBUTE_NAME.test(name) && value !== null && value !== undefined && value !== false)
    .map(([name, value]) => [name, value === true ? true : e(value)]));

const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
const ALIGNMENTS = new Set(['start', 'center', 'end', 'left', 'right', 'justify', 'between']);
const alignmentClass = (alignment: string | null | undefined) => (alignment && ALIGNMENTS.has(alignment) ? `fi-align-${alignment}` : null);
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '');
// A Heroicons or registered name, an icon of a set (`lucide:house`), or an icon registered for an alias (`@…`, from `icons.resolve()`).
const ICON_NAME = /^[a-zA-Z0-9][a-zA-Z0-9-]*(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/;
const renderIcon = (name: unknown, options: { size?: string; attributes?: Attributes } = {}) => (typeof name === 'string' && (ICON_NAME.test(name) || name.startsWith('@')) ? icon(name, options) : '');
const tooltipJs = (text: unknown): string | null => (text === null || text === undefined || text === '' ? null : `{ content: ${js(String(text))}, theme: $store.theme, allowHTML: false }`);
const decodeEntities = (html: string) => html.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ''));
const isNumericValue = (value: unknown) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
/** Simple CSS length (`40px`, `2.5rem`, `50%`, `auto`); a number is a length in pixels. Anything else is rejected. */
const cssLength = (value: number | string | null | undefined): string | null => {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? `${value}px` : null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^(\d+(\.\d+)?|\.\d+)(px|rem|em|%|vh|vw|ch)$/.test(trimmed) || trimmed === 'auto' ? trimmed : null;
};
/** Image sources: same-site paths (`/…`) and http(s) URLs only. */
const isImageUrl = (value: unknown): value is string => typeof value === 'string' && /^(\/(?!\/)|https?:\/\/)/i.test(value.trim());

/** Option that may depend on the record and on the state item. */
export type PerItem<T> = T | ((record: any, state: unknown) => T);
const resolveItem = <T>(option: PerItem<T>, record: unknown, state: unknown): T => (typeof option === 'function' ? (option as (record: unknown, state: unknown) => T)(record, state) : option);
/** `icon()` / `color()` of an icon entry: a value, a map of state values, or a function. */
export type StateMap<T> = PerItem<T> | Record<string, T>;
const resolveMap = <T>(option: StateMap<T | null>, record: unknown, state: unknown): T | null => {
    if (option !== null && typeof option === 'object') return (option as Record<string, T>)[String(state)] ?? null;
    return resolveItem(option as PerItem<T | null>, record, state);
};

const TEXT_SIZES = new Set(['xs', 'sm', 'md', 'lg']);
const textSize = (size: string | null | undefined) => (size === 'base' ? 'md' : size && TEXT_SIZES.has(size) ? size : size ? safeName(size) || 'sm' : 'sm');
const FONT_WEIGHTS = new Set(['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black']);
const FONT_FAMILIES = new Set(['sans', 'serif', 'mono']);
const fontClass = (value: string | null | undefined, allowed: Set<string>) => (!value ? null : allowed.has(value) ? `fi-font-${value}` : safeName(value) || null);

/** Text color classes of a text entry item (Filament's `TextEntryComponent\ItemComponent` color map). */
const itemColorCache = new Map<string, string[]>();
function itemColorClasses(color: string | null | undefined): string[] {
    if (!color) return [];
    const base = ['fi-color', `fi-color-${safeName(color)}`];
    const palette = colorManager?.getColor(color), gray = colorManager?.getColor('gray');
    if (!palette || !gray) return base;
    const key = `${color}|${Object.values(palette).join(',')}|${gray[800]}`;
    let classes = itemColorCache.get(key);
    if (!classes) {
        const text = findShade(palette, 'oklch(1 0 0)') ?? 900;
        const dark = findShade(palette, gray[800], { maxShade: 600, fromDarkest: true }) ?? 200;
        classes = [...base, `fi-text-color-${text}`, `dark:fi-text-color-${dark}`];
        itemColorCache.set(key, classes);
    }
    return classes;
}
const badgeColorClasses = (color: string | null | undefined) => (color && color !== 'gray' ? (colorManager?.getComponentClasses('badge', color) ?? []) : []);
/** Icon entries: 3:1 contrast shades; gray is the default and gets no classes. */
const iconColorClasses = (color: string | null | undefined) => (color && color !== 'gray' ? (colorManager?.getComponentClasses('icon-column', color) ?? []) : []);

// ------------------------------------------------------------------ dates
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (value: number, length = 2) => String(Math.abs(value)).padStart(length, '0');
const ordinal = (value: number) => (value % 10 === 1 && value % 100 !== 11 ? 'st' : value % 10 === 2 && value % 100 !== 12 ? 'nd' : value % 10 === 3 && value % 100 !== 13 ? 'rd' : 'th');

/** Date state: a `Date`, a timestamp in milliseconds, or a string. Strings without a time zone (SQL values) are read as UTC; a time alone is today's. */
function parseDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;
    if (typeof value !== 'string' || value.trim() === '') return null;
    let text = value.trim();
    const time = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(\.\d+)?$/.exec(text);
    if (time) text = `${new Date().toISOString().slice(0, 10)}T${pad(Number(time[1]))}:${time[2]}:${time[3] ?? '00'}Z`;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text = `${text}T00:00:00Z`;
    else if (!/[zZ]$|[+-]\d\d:?\d\d$/.test(text)) text = `${text.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')}Z`;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}
const isTimeZone = (zone: string) => { try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; } };
type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; ms: number; weekday: number; offset: number; zone: string; timestamp: number };
function dateParts(date: Date, timeZone: string): DateParts {
    const zone = isTimeZone(timeZone) ? timeZone : 'UTC';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(date).map((part) => [part.type, part.value]));
    const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day), hour = Number(parts.hour) % 24, minute = Number(parts.minute), second = Number(parts.second);
    const offset = Math.round((Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
    return { year, month, day, hour, minute, second, ms: date.getUTCMilliseconds(), weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), offset, zone: parts.timeZoneName ?? zone, timestamp: Math.floor(date.getTime() / 1000) };
}
const offsetText = (minutes: number, colon: boolean) => `${minutes < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(minutes) / 60))}${colon ? ':' : ''}${pad(Math.abs(minutes) % 60)}`;
const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** PHP `date()` format (`M j, Y`, `d/m/Y H:i`…), with English month and day names. A backslash escapes a character. */
export function formatPhpDate(date: Date, format: string, timeZone = 'UTC'): string {
    const p = dateParts(date, timeZone);
    const hour12 = p.hour % 12 || 12;
    const tokens: Record<string, () => string> = {
        d: () => pad(p.day), D: () => DAYS[p.weekday].slice(0, 3), j: () => String(p.day), l: () => DAYS[p.weekday], N: () => String(p.weekday || 7), S: () => ordinal(p.day), w: () => String(p.weekday),
        z: () => String(Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 1)) / 86400000)),
        F: () => MONTHS[p.month - 1], M: () => MONTHS[p.month - 1].slice(0, 3), m: () => pad(p.month), n: () => String(p.month), t: () => String(new Date(Date.UTC(p.year, p.month, 0)).getUTCDate()),
        L: () => (isLeapYear(p.year) ? '1' : '0'), Y: () => String(p.year), y: () => pad(p.year % 100),
        a: () => (p.hour < 12 ? 'am' : 'pm'), A: () => (p.hour < 12 ? 'AM' : 'PM'), g: () => String(hour12), G: () => String(p.hour), h: () => pad(hour12), H: () => pad(p.hour),
        i: () => pad(p.minute), s: () => pad(p.second), u: () => pad(p.ms * 1000, 6), v: () => pad(p.ms, 3),
        e: () => (isTimeZone(timeZone) ? timeZone : 'UTC'), T: () => p.zone, P: () => offsetText(p.offset, true), O: () => offsetText(p.offset, false), p: () => (p.offset === 0 ? 'Z' : offsetText(p.offset, true)), Z: () => String(p.offset * 60),
        U: () => String(p.timestamp),
        c: () => `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${offsetText(p.offset, true)}`,
        r: () => `${DAYS[p.weekday].slice(0, 3)}, ${pad(p.day)} ${MONTHS[p.month - 1].slice(0, 3)} ${p.year} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} ${offsetText(p.offset, false)}`,
    };
    let out = '';
    for (let index = 0; index < format.length; index++) {
        const character = format[index];
        if (character === '\\' && index + 1 < format.length) { out += format[++index]; continue; }
        out += Object.hasOwn(tokens, character) ? tokens[character]() : character;
    }
    return out;
}

/** English macro formats of Carbon's `isoFormat()`. */
const ISO_MACROS: Record<string, string> = {
    LT: 'h:mm A', LTS: 'h:mm:ss A', L: 'MM/DD/YYYY', LL: 'MMMM D, YYYY', LLL: 'MMMM D, YYYY h:mm A', LLLL: 'dddd, MMMM D, YYYY h:mm A',
    l: 'M/D/YYYY', ll: 'MMM D, YYYY', lll: 'MMM D, YYYY h:mm A', llll: 'ddd, MMM D, YYYY h:mm A',
};
const ISO_TOKEN = /\[[^\]]*\]|LTS|LT|LLLL|LLL|LL|L|llll|lll|ll|l|YYYY|YY|Qo|Q|MMMM|MMM|MM|Mo|M|DDDD|DDDo|DDD|Do|DD|D|dddd|ddd|dd|do|d|E|e|HH|H|hh|h|kk|k|mm|m|ss|s|SSS|SS|S|A|a|ZZ|Z|X|x|zz|z/g;
/** Carbon `isoFormat()` format (`L`, `LLL`, `dddd D MMMM YYYY`…), in English. Text in `[brackets]` is kept as is. */
export function formatIsoDate(date: Date, format: string, timeZone = 'UTC'): string {
    const p = dateParts(date, timeZone);
    const hour12 = p.hour % 12 || 12;
    const dayOfYear = Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 1)) / 86400000) + 1;
    const tokens: Record<string, () => string> = {
        YYYY: () => String(p.year), YY: () => pad(p.year % 100), Q: () => String(Math.ceil(p.month / 3)), Qo: () => `${Math.ceil(p.month / 3)}${ordinal(Math.ceil(p.month / 3))}`,
        MMMM: () => MONTHS[p.month - 1], MMM: () => MONTHS[p.month - 1].slice(0, 3), MM: () => pad(p.month), Mo: () => `${p.month}${ordinal(p.month)}`, M: () => String(p.month),
        DDDD: () => pad(dayOfYear, 3), DDDo: () => `${dayOfYear}${ordinal(dayOfYear)}`, DDD: () => String(dayOfYear), Do: () => `${p.day}${ordinal(p.day)}`, DD: () => pad(p.day), D: () => String(p.day),
        dddd: () => DAYS[p.weekday], ddd: () => DAYS[p.weekday].slice(0, 3), dd: () => DAYS[p.weekday].slice(0, 2), do: () => `${p.weekday}${ordinal(p.weekday)}`, d: () => String(p.weekday), e: () => String(p.weekday), E: () => String(p.weekday || 7),
        HH: () => pad(p.hour), H: () => String(p.hour), hh: () => pad(hour12), h: () => String(hour12), kk: () => pad(p.hour || 24), k: () => String(p.hour || 24),
        mm: () => pad(p.minute), m: () => String(p.minute), ss: () => pad(p.second), s: () => String(p.second),
        SSS: () => pad(p.ms, 3), SS: () => pad(Math.floor(p.ms / 10)), S: () => String(Math.floor(p.ms / 100)),
        A: () => (p.hour < 12 ? 'AM' : 'PM'), a: () => (p.hour < 12 ? 'am' : 'pm'), Z: () => offsetText(p.offset, true), ZZ: () => offsetText(p.offset, false),
        X: () => String(p.timestamp), x: () => String(date.getTime()), z: () => p.zone, zz: () => p.zone,
    };
    return format.replace(ISO_TOKEN, (token) => {
        if (token.startsWith('[')) return token.slice(1, -1);
        if (Object.hasOwn(ISO_MACROS, token)) return formatIsoDate(date, ISO_MACROS[token], timeZone);
        return tokens[token]();
    });
}
/** Relative date: "2 days ago", or "in 3 hours" style for a future date ("3 hours from now"). */
function since(date: Date, now = new Date()): string {
    if (date.getTime() <= now.getTime()) return diffForHumans(date, now) ?? '';
    return (diffForHumans(now, date) ?? '').replace(/ ago$/, ' from now');
}

// ------------------------------------------------------------------ numbers
/** PHP `number_format()`: rounded to `decimals`, with the given separators. */
function numberFormat(value: number, decimals: number, decimalSeparator: string, thousandsSeparator: string): string {
    const fixed = Math.abs(value).toFixed(Math.max(0, Math.min(20, Math.floor(decimals))));
    const [integer, fraction] = fixed.split('.');
    const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
    return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator)}${fraction ? `${decimalSeparator}${fraction}` : ''}`;
}
const fractionDigits = (digits: number | null | undefined) => (typeof digits === 'number' && Number.isFinite(digits) ? Math.max(0, Math.min(20, Math.floor(digits))) : null);

// ------------------------------------------------------------------ entries
/** Content of an entry slot: a schema component, an action, a text (escaped) or an `HtmlString` (inserted as is). */
export type EntrySlotItem = Component | Renderable | string | HtmlString;
type SlotValue = EntrySlotItem | EntrySlotItem[] | null;
export type EntrySlot = SlotValue | ((ctx: ComponentContext) => SlotValue | Promise<SlotValue>);
type SlotName = 'aboveLabel' | 'belowLabel' | 'beforeLabel' | 'afterLabel' | 'aboveContent' | 'belowContent' | 'beforeContent' | 'afterContent';

/** Base entry: a label and a value read from the record (dotted paths allowed) or computed. */
abstract class Entry extends Component {
    protected _label: Lazy<string | null, ComponentContext> = null;
    protected _state: ((ctx: ComponentContext) => unknown | Promise<unknown>) | null = null;
    protected _default: unknown = null;
    protected _hiddenLabel: Lazy<boolean, ComponentContext> = false;
    protected _placeholder: string | null = null;
    protected _url: Lazy<string | null, ComponentContext> = null;
    protected _openUrlInNewTab: Lazy<boolean, ComponentContext> = false;
    protected _tooltip: PerItem<string | null> = null;
    protected _emptyTooltip: string | null = null;
    // `inlineLabel()` comes from the schema component: an entry inherits it from its layout component or schema.
    protected _alignment: Lazy<string | null, ComponentContext> = null;
    protected _hiddenJs: string | null = null;
    protected _visibleJs: string | null = null;
    protected _extraEntryWrapperAttributes: Record<string, string> = {};
    protected _slots: Partial<Record<SlotName, EntrySlot>> = {};
    constructor(name: string) { super(); this._name = name; }
    hasStatePath(): boolean { return true; }
    protected _enum: Enum<string | number> | null = null;
    /**
     * Displays values through an enum (label, color, icon), like Filament does for an attribute cast to an enum. Without it,
     * the enum of the model's `static casts` is used, and so is a state that is already an enum case.
     */
    enum(enumeration: Enum<string | number> | null): this { this._enum = enumeration; return this; }
    /** Enum case of a state item, or `null`. */
    protected enumCaseOf(record: unknown, item: unknown): EnumCase<string | number> | null { return resolveEnumCase(item, { enum: this._enum, record, attribute: this._name ?? undefined }); }
    /** Label: a string or a function of the context. Escaped when rendered. */
    label(label: Lazy<string | null, ComponentContext>): this { this._label = label; return this; }
    /** Keeps the label for screen readers only. */
    hiddenLabel(condition: Lazy<boolean, ComponentContext> = true): this { this._hiddenLabel = condition; return this; }
    /** Computed value; without it, the record attribute of the same name is shown. */
    state(resolver: (ctx: ComponentContext) => unknown | Promise<unknown>): this { this._state = resolver; return this; }
    /** State used when the real state is `null` or `undefined`; it is displayed as if it were real. */
    default(state: unknown): this { this._default = state; return this; }
    /** Gray text shown when the state is empty. */
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** Makes the content a link. Only `http(s)`, `mailto` and relative URLs are rendered: any other scheme is ignored. */
    url(url: Lazy<string | null, ComponentContext>, openInNewTab: Lazy<boolean, ComponentContext> | null = null): this {
        this._url = url;
        if (openInNewTab !== null) this._openUrlInNewTab = openInNewTab;
        return this;
    }
    openUrlInNewTab(condition: Lazy<boolean, ComponentContext> = true): this { this._openUrlInNewTab = condition; return this; }
    /** Tooltip on the content: a string, or a function of the record and the state item. */
    tooltip(tooltip: PerItem<string | null>): this { this._tooltip = tooltip; return this; }
    /** Tooltip shown on the content when the state is empty. */
    emptyTooltip(tooltip: string | null): this { this._emptyTooltip = tooltip; return this; }
    /** Label next to the content instead of above it (from the `sm` breakpoint); `null` follows the layout component or schema. */
    inlineLabel(condition: Lazy<boolean | null, ComponentContext> = true): this { return super.inlineLabel(condition); }
    /** Content alignment: `start`, `center`, `end`, `left`, `right`, `justify` or `between`. */
    alignment(alignment: Lazy<string | null, ComponentContext>): this { this._alignment = alignment; return this; }
    alignStart(): this { return this.alignment('start'); }
    alignCenter(): this { return this.alignment('center'); }
    alignEnd(): this { return this.alignment('end'); }
    alignLeft(): this { return this.alignment('left'); }
    alignRight(): this { return this.alignment('right'); }
    alignJustify(): this { return this.alignment('justify'); }
    /** Hides the entry in the browser while this JavaScript expression is true (`$get('role') !== 'staff'`). Written by the developer, never from user input. */
    hiddenJs(expression: string | null): this { this._hiddenJs = expression; return this; }
    /** Shows the entry in the browser only while this JavaScript expression is true. */
    visibleJs(expression: string | null): this { this._visibleJs = expression; return this; }
    /** Attributes of the outer element of the entry wrapper (label and content). Values are escaped. */
    extraEntryWrapperAttributes(attributes: Record<string, string>): this { Object.assign(this._extraEntryWrapperAttributes, attributes); return this; }
    aboveLabel(content: EntrySlot): this { this._slots.aboveLabel = content; return this; }
    belowLabel(content: EntrySlot): this { this._slots.belowLabel = content; return this; }
    beforeLabel(content: EntrySlot): this { this._slots.beforeLabel = content; return this; }
    /** Content after the label, aligned to the end. */
    afterLabel(content: EntrySlot): this { this._slots.afterLabel = content; return this; }
    aboveContent(content: EntrySlot): this { this._slots.aboveContent = content; return this; }
    belowContent(content: EntrySlot): this { this._slots.belowContent = content; return this; }
    beforeContent(content: EntrySlot): this { this._slots.beforeContent = content; return this; }
    /** Content after the entry content, aligned to the end. */
    afterContent(content: EntrySlot): this { this._slots.afterContent = content; return this; }

    async getLabel(): Promise<string> { return (await evaluate(this._label, this.context())) ?? defaultLabel(this._name!); }
    protected async getState(): Promise<unknown> {
        const ctx = this.context();
        let state: unknown;
        if (this._state) state = await this._state(ctx);
        else {
            const record = ctx.record as any;
            // `department.name`: flat `department_name` attribute (column computed by the adapter), otherwise the relationship,
            // loaded when missing (Objection models), or a path into the object; a has-many relationship gives a list of values.
            if (record && this._name!.includes('.')) {
                state = record[this._name!.replace(/\./g, '_')];
                if (state === undefined) { await loadMissingRelationships(record, [this._name!]); state = readRecordPath(record, this._name!); }
            } else {
                state = record?.[this._name!];
                // A relationship named like the entry (`RepeatableEntry.make('comments')`) is loaded when missing.
                if (state === undefined && record) { await loadMissingRelationships(record, [this._name!]); state = record[this._name!]; }
            }
        }
        return state === null || state === undefined ? (this._default ?? state) : state;
    }
    protected getExtraAttributesMap(): AttrMap { return escapeAttributes(this._extraAttributes); }
    protected async getAlignment(): Promise<string | null> { const alignment = await evaluate(this._alignment, this.context()); return alignment && ALIGNMENTS.has(alignment) ? alignment : null; }
    protected getEmptyAttributes(base: ClassList): AttrMap { return mergeAttrs({ 'x-tooltip': tooltipJs(this._emptyTooltip) }, withClass(this.getExtraAttributesMap(), base)); }
    protected emptyHtml(base: ClassList): string {
        return `<div ${renderAttrs(this.getEmptyAttributes(base))}>${this._placeholder !== null ? `<p class="fi-in-placeholder">${e(this._placeholder)}</p>` : ''}</div>`;
    }

    /** Actions placed in the slots, so that they can be mounted (`schemaComponent` = entry key). */
    getActions(): any[] {
        const actions: any[] = [];
        for (const slot of Object.values(this._slots)) {
            let value: unknown = slot;
            if (typeof value === 'function') {
                try { value = (slot as (ctx: ComponentContext) => unknown)(this.context()); } catch { continue; }
                if (value instanceof Promise) { value.catch(() => {}); continue; }
            }
            for (const item of ([] as unknown[]).concat(value ?? [])) {
                if (!item || typeof item !== 'object' || item instanceof Component || item instanceof HtmlString) continue;
                actions.push(...(typeof (item as any).getActions === 'function' ? (item as any).getActions() : [item]));
            }
        }
        return actions;
    }
    protected async renderSlot(name: SlotName): Promise<string | null> {
        const slot = this._slots[name];
        if (slot === undefined || slot === null) return null;
        const value = await evaluate(slot as Lazy<SlotValue, ComponentContext>, this.context());
        const items: InlineItem[] = ([] as EntrySlotItem[]).concat(value ?? []).map((item) => (typeof item === 'string' || item instanceof HtmlString ? Text.make(item) : item));
        return renderInlineItems(this, items, { alignment: name === 'afterLabel' || name === 'afterContent' ? 'end' : null, scope: { path: this.getStatePath(), containerPath: this.container.getStatePath() }, mountKey: this.getKey(), actionView: 'link' });
    }

    /** Places the content in the entry wrapper: label column, content column, slots and link. */
    protected async wrapEmbeddedHtml(content: string): Promise<string> {
        const ctx = this.context();
        const label = await this.getLabel();
        const hasLabel = label !== '';
        const isLabelHidden = Boolean(await evaluate(this._hiddenLabel, ctx));
        const hasInlineLabel = await this.hasInlineLabel();
        const alignment = await this.getAlignment();
        const url = await evaluate(this._url, ctx);
        const href = typeof url === 'string' && url.trim() !== '' && isSafeUrl(url) ? url : null;
        const [aboveLabel, belowLabel, beforeLabel, afterLabel, aboveContent, beforeContent, afterContent, belowContent] = await Promise.all(
            (['aboveLabel', 'belowLabel', 'beforeLabel', 'afterLabel', 'aboveContent', 'beforeContent', 'afterContent', 'belowContent'] as SlotName[]).map((name) => this.renderSlot(name)));
        const attributes = withClass(escapeAttributes(this._extraEntryWrapperAttributes), ['fi-in-entry', { 'fi-in-entry-has-inline-label': hasInlineLabel }]);
        let html = `<div ${renderAttrs(attributes)}>`;
        if (hasLabel && isLabelHidden) html += `<div class="fi-in-entry-label fi-sr-only" role="term">${e(label)}</div>`;
        if ((hasLabel && !isLabelHidden) || hasInlineLabel || aboveLabel || belowLabel || beforeLabel || afterLabel) {
            html += `<div class="fi-in-entry-label-col">${aboveLabel ?? ''}`;
            if ((hasLabel && !isLabelHidden) || beforeLabel || afterLabel) {
                html += `<div class="fi-in-entry-label-ctn">${beforeLabel ?? ''}${hasLabel && !isLabelHidden ? `<div class="fi-in-entry-label" role="term">${e(label)}</div>` : ''}${afterLabel ?? ''}</div>`;
            }
            html += `${belowLabel ?? ''}</div>`;
        }
        html += '<div class="fi-in-entry-content-col">';
        if (aboveContent !== null) html += `<div class="fi-in-entry-content-slot">${aboveContent}</div>`;
        html += '<div class="fi-in-entry-content-ctn" role="definition">';
        if (beforeContent !== null) html += `<div class="fi-in-entry-content-slot">${beforeContent}</div>`;
        const contentClass = cls(['fi-in-entry-content', alignmentClass(alignment)]);
        html += href !== null
            ? `<a href="${e(href)}"${(await evaluate(this._openUrlInNewTab, ctx)) ? ' target="_blank"' : ''} class="${contentClass}">${content}</a>`
            : `<div class="${contentClass}">${content}</div>`;
        html += `${afterContent ?? ''}</div>${belowContent ?? ''}</div></div>`;
        return html;
    }

    // `hiddenJs()` / `visibleJs()`: the schema component wraps the entry in a `<fieldset>` toggled by Alpine, as in Filament.
}

let htmlSanitizer: ((html: string) => string) | null = null;
const TIGHT_ITEM = new RegExp('<li><p>((?:(?!</?p>|</?li>)[^])*)</p></li>', 'g');

/**
 * Sanitizer applied to the HTML an entry renders as is (`html()`, `markdown()`, `prose()`).
 * Without one, `sanitizeHtml()` from `@navette-js/support` is used.
 */
export const useHtmlSanitizer = (sanitizer: ((html: string) => string) | null) => { htmlSanitizer = sanitizer; };
const sanitize = (html: string) => (htmlSanitizer ?? sanitizeHtml)(html);

type NumericOptions = { decimalPlaces?: number | null; maxDecimalPlaces?: number | null; decimalSeparator?: string | null; thousandsSeparator?: string | null; locale?: string | null };
type MoneyOptions = { divideBy?: number | null; locale?: string | null; decimalPlaces?: number | null };

/** Read-only text: badge, color, icon, money, number, date, list, Markdown and HTML. */
export class TextEntry extends Entry {
    /** State of an aggregate of related records, loaded for the record (Laravel's `loadCount()`, `loadSum()`…) under the entry's name. */
    private aggregateState(fn: RelationshipAggregateFunction, relationships: AggregatedRelationships | null, column: string | null): this {
        if (relationships === null) { this._state = null; return this; }
        const aggregates = normalizeRelationshipAggregates(fn, relationships, column, `TextEntry ${this._name}`);
        return this.state(async (ctx) => {
            const record = ctx.record as any;
            if (record === null || record === undefined) return null;
            await loadRelationshipAggregates(record, aggregates, `TextEntry ${this._name}`);
            return record[this._name!] ?? null;
        });
    }
    /** Number of related records: `TextEntry.make('posts_count').counts('posts')` (also `'posts as alias'` or `{ posts: (query) => … }`). */
    counts(relationships: AggregatedRelationships | null): this { return this.aggregateState('count', relationships, null); }
    /** Average of a column of the related records: `TextEntry.make('posts_avg_rating').avg('posts', 'rating')`. */
    avg(relationship: AggregatedRelationship | null, column: string | null): this { return this.aggregateState('avg', relationship, column); }
    /** Sum of a column of the related records: `TextEntry.make('orders_sum_total').sum('orders', 'total')`. */
    sum(relationship: AggregatedRelationship | null, column: string | null): this { return this.aggregateState('sum', relationship, column); }
    /** Minimum of a column of the related records: `TextEntry.make('orders_min_total').min('orders', 'total')`. */
    min(relationship: AggregatedRelationship | null, column: string | null): this { return this.aggregateState('min', relationship, column); }
    /** Maximum of a column of the related records: `TextEntry.make('orders_max_total').max('orders', 'total')`. */
    max(relationship: AggregatedRelationship | null, column: string | null): this { return this.aggregateState('max', relationship, column); }
    private _badge = false;
    private _color: PerItem<string | null> = null;
    private _icon: PerItem<string | null> = null;
    private _iconColor: PerItem<string | null> = null;
    private _iconPosition: 'before' | 'after' = 'before';
    private _format: ((ctx: { state: unknown; record: any }) => unknown) | null = null;
    private _formatter: ((state: unknown, record: any) => string) | null = null;
    private _formatterKind: 'date' | 'numeric' | 'money' | null = null;
    private _isDate = false;
    private _isMoney = false;
    private _isNumeric = false;
    private _timezone: string | null = null;
    private _prefix: string | HtmlString | null = null;
    private _suffix: string | HtmlString | null = null;
    private _prose = false;
    private _markdown = false;
    private _html = false;
    private _characterLimit: PerItem<number | null> = null;
    private _characterLimitEnd: PerItem<string | null> = '...';
    private _prefixActions: (Renderable | ((ctx: ComponentContext) => Renderable | Renderable[] | null))[] = [];
    private _suffixActions: (Renderable | ((ctx: ComponentContext) => Renderable | Renderable[] | null))[] = [];
    private _wordLimit: { words: number; end: string } | null = null;
    private _listWithLineBreaks = false;
    private _bulleted = false;
    private _listLimit: number | null = null;
    private _expandableLimitedList = false;
    private _separator: string | null = null;
    private _copyable: PerItem<boolean> = false;
    private _copyableState: PerItem<string | null> = null;
    private _copyMessage: string | null = null;
    private _copyMessageDuration = 2000;
    private _size: PerItem<string | null> = null;
    private _weight: PerItem<string | null> = null;
    private _fontFamily: PerItem<string | null> = null;
    private _lineClamp: number | null = null;
    private _wrap = true;
    static make(name: string): TextEntry { return configured(new TextEntry(name)); }
    badge(condition = true): this { this._badge = condition; return this; }
    /** Text (or badge) color: a name, or a function of the record and the state item. */
    color(color: PerItem<string | null>): this { this._color = color; return this; }
    /** Heroicon before the text: a name, or a function of the record and the state item returning a name or `null`. */
    icon(icon: PerItem<string | null>): this { this._icon = icon; return this; }
    iconColor(color: PerItem<string | null>): this { this._iconColor = color; return this; }
    iconPosition(position: 'before' | 'after'): this { this._iconPosition = position === 'after' ? 'after' : 'before'; return this; }
    /** Displayed text computed from the raw state; it takes precedence over date, number and money formatting. */
    formatStateUsing(formatter: ((ctx: { state: unknown; record: any }) => unknown) | null): this { this._format = formatter; return this; }

    private setFormatter(kind: 'date' | 'numeric' | 'money', formatter: ((state: unknown, record: any) => string) | null): this {
        if (formatter) { this._formatter = formatter; this._formatterKind = kind; } else if (this._formatterKind === kind) { this._formatter = null; this._formatterKind = null; }
        return this;
    }
    private dateFormatter(kind: 'php' | 'iso' | 'since', format: string, timezone: string | null): (state: unknown) => string {
        return (state) => {
            const date = parseDate(state);
            if (!date) return String(state);
            const zone = timezone ?? this._timezone ?? 'UTC';
            return kind === 'since' ? since(date) : kind === 'iso' ? formatIsoDate(date, format, zone) : formatPhpDate(date, format, zone);
        };
    }
    /** Date in a PHP format, `M j, Y` by default ("Mar 5, 2024"). `false` turns date formatting off. */
    date(format: string | boolean | null = null, timezone: string | null = null): this {
        this._isDate = format !== false;
        return this.setFormatter('date', format === false ? null : this.dateFormatter('php', typeof format === 'string' ? format : 'M j, Y', timezone));
    }
    /** Date and time, `M j, Y H:i:s` by default. */
    dateTime(format: string | boolean | null = null, timezone: string | null = null): this {
        return this.setFormatter('date', format === false ? null : this.dateFormatter('php', typeof format === 'string' ? format : 'M j, Y H:i:s', timezone));
    }
    /** Time, `H:i:s` by default. */
    time(format: string | null = null, timezone: string | null = null): this { return this.setFormatter('date', this.dateFormatter('php', format ?? 'H:i:s', timezone)); }
    /** Date in a Carbon `isoFormat()` format, `L` by default ("03/05/2024"). */
    isoDate(format: string | null = null, timezone: string | null = null): this { return this.setFormatter('date', this.dateFormatter('iso', format ?? 'L', timezone)); }
    /** Date and time in an `isoFormat()` format, `LLL` by default ("March 5, 2024 10:11 AM"). */
    isoDateTime(format: string | null = null, timezone: string | null = null): this { return this.setFormatter('date', this.dateFormatter('iso', format ?? 'LLL', timezone)); }
    /** Time in an `isoFormat()` format, `LT` by default ("10:11 AM"). */
    isoTime(format: string | null = null, timezone: string | null = null): this { return this.setFormatter('date', this.dateFormatter('iso', format ?? 'LT', timezone)); }
    /** Relative date: "2 days ago". */
    since(timezone: string | null = null): this { return this.setFormatter('date', this.dateFormatter('since', '', timezone)); }
    private dateTooltipFor(kind: 'php' | 'iso' | 'since', format: string, timezone: string | null): this {
        const formatter = this.dateFormatter(kind, format, timezone);
        return this.tooltip((_record: unknown, state: unknown) => (isBlank(state) ? null : formatter(state)));
    }
    /** Tooltip with the date in a PHP format (`M j, Y` by default). */
    dateTooltip(format: string | null = null, timezone: string | null = null): this { return this.dateTooltipFor('php', format ?? 'M j, Y', timezone); }
    dateTimeTooltip(format: string | null = null, timezone: string | null = null): this { return this.dateTooltipFor('php', format ?? 'M j, Y H:i:s', timezone); }
    timeTooltip(format: string | null = null, timezone: string | null = null): this { return this.dateTooltipFor('php', format ?? 'H:i:s', timezone); }
    isoDateTooltip(format: string | null = null, timezone: string | null = null): this { return this.dateTooltipFor('iso', format ?? 'L', timezone); }
    isoDateTimeTooltip(format: string | null = null, timezone: string | null = null): this { return this.dateTooltipFor('iso', format ?? 'LLL', timezone); }
    isoTimeTooltip(format: string | null = null, timezone: string | null = null): this { return this.dateTooltipFor('iso', format ?? 'LT', timezone); }
    sinceTooltip(timezone: string | null = null): this { return this.dateTooltipFor('since', '', timezone); }
    /** IANA time zone in which dates are displayed (`UTC` by default). */
    timezone(timezone: string | null): this { this._timezone = timezone; return this; }

    /**
     * Formatted number. `numeric(2)`: two decimal places. Options: `decimalPlaces`, `maxDecimalPlaces`, `locale` (`en-US` by default),
     * or `decimalSeparator` / `thousandsSeparator` for fixed separators. `false` turns number formatting off.
     */
    numeric(options: boolean | number | null | NumericOptions = true): this {
        this._isNumeric = options !== false;
        if (options === false) return this.setFormatter('numeric', null);
        const settings: NumericOptions = typeof options === 'number' ? { decimalPlaces: options } : options && typeof options === 'object' ? options : {};
        return this.setFormatter('numeric', (state) => {
            if (!isNumericValue(state)) return String(state);
            const value = Number(state);
            const decimals = fractionDigits(settings.decimalPlaces);
            if ((settings.decimalSeparator ?? null) !== null || (settings.thousandsSeparator ?? null) !== null) return numberFormat(value, decimals ?? 0, settings.decimalSeparator ?? '.', settings.thousandsSeparator ?? ',');
            const max = fractionDigits(settings.maxDecimalPlaces);
            const digits = max !== null ? { maximumFractionDigits: max } : decimals !== null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : {};
            return new Intl.NumberFormat(settings.locale ?? 'en-US', digits).format(value);
        });
    }
    /**
     * Amount of money in a currency (`usd` by default). `divideBy`: divides the state first (`100` for cents);
     * `locale` (`en-US` by default) and `decimalPlaces` may be passed after it, or in an options object.
     */
    money(currency: string | ((record: any) => string) = 'usd', divideBy: number | MoneyOptions | null = 0, locale: string | null = null, decimalPlaces: number | null = null): this {
        this._isMoney = true;
        const settings: MoneyOptions = divideBy !== null && typeof divideBy === 'object' ? divideBy : { divideBy: divideBy as number | null, locale, decimalPlaces };
        return this.setFormatter('money', (state, record) => {
            if (!isNumericValue(state)) return String(state);
            let value = Number(state);
            if (settings.divideBy) value /= settings.divideBy;
            const code = (typeof currency === 'function' ? currency(record) : currency) || 'usd';
            const decimals = fractionDigits(settings.decimalPlaces);
            return new Intl.NumberFormat(settings.locale ?? 'en-US', { style: 'currency', currency: code.toUpperCase(), ...(decimals !== null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : {}) }).format(value);
        });
    }
    /** Text before the formatted state. A string is escaped; an `HtmlString` is inserted as is. */
    prefix(text: string | HtmlString | null): this { this._prefix = text; return this; }
    /** Text after the formatted state. A string is escaped; an `HtmlString` is inserted as is. */
    suffix(text: string | HtmlString | null): this { this._suffix = text; return this; }
    /** Truncates the text to `length` characters, followed by `end`. */
    limit(length: PerItem<number | null> = 100, end: PerItem<string | null> = '...'): this { this._characterLimit = length; this._characterLimitEnd = end; return this; }
    /** Character limit of `limit()` for a state item (`null`: no limit), e.g. to show the full text in a tooltip only when it is cut. */
    getCharacterLimit(state: unknown = undefined, record: any = undefined): number | null {
        const limit = resolveItem(this._characterLimit, record === undefined ? this.currentRecord() : record, state);
        return typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
    }
    /** Text added after a cut state (`...` by default). */
    getCharacterLimitEnd(state: unknown = undefined, record: any = undefined): string | null { return resolveItem(this._characterLimitEnd, record === undefined ? this.currentRecord() : record, state) ?? null; }
    /** Record of the entry, or `null` before it is placed in a schema. */
    private currentRecord(): any { try { return this.context().record; } catch { return null; } }
    /** Action before the text (Filament's `prefixAction()`), an icon button by default; a function returns it from the context. */
    prefixAction(action: Renderable | ((ctx: ComponentContext) => Renderable | Renderable[] | null)): this { return this.prefixActions([action]); }
    prefixActions(actions: (Renderable | ((ctx: ComponentContext) => Renderable | Renderable[] | null))[]): this { this._prefixActions = [...this._prefixActions, ...actions]; return this; }
    /** Action after the text (Filament's `suffixAction()`), an icon button by default. */
    suffixAction(action: Renderable | ((ctx: ComponentContext) => Renderable | Renderable[] | null)): this { return this.suffixActions([action]); }
    suffixActions(actions: (Renderable | ((ctx: ComponentContext) => Renderable | Renderable[] | null))[]): this { this._suffixActions = [...this._suffixActions, ...actions]; return this; }
    /** Prefix actions, small icon buttons unless their size or style was chosen. */
    getPrefixActions(): Renderable[] { return this.affixActions(this._prefixActions); }
    getSuffixActions(): Renderable[] { return this.affixActions(this._suffixActions); }
    private affixActions(list: (Renderable | ((ctx: ComponentContext) => Renderable | Renderable[] | null))[]): Renderable[] {
        const actions: Renderable[] = [];
        for (const item of list) {
            const value = typeof item === 'function' ? (item as (ctx: ComponentContext) => Renderable | Renderable[] | null)(this.context()) : item;
            for (const action of ([] as (Renderable | null)[]).concat(value ?? [])) {
                if (!action) continue;
                const a = action as any;
                a.defaultSize?.('sm');
                if (typeof a.getView === 'function' && a.getView() === null && typeof a.iconButton === 'function') a.iconButton();
                actions.push(action);
            }
        }
        return actions;
    }
    /** Slot actions and affix actions, mounted with this entry's key. */
    getActions(): any[] { return [...super.getActions(), ...this.getPrefixActions(), ...this.getSuffixActions()]; }
    /** Truncates the text to a number of words, followed by `end`. */
    words(words: number | null = 100, end = '...'): this { this._wordLimit = words && words > 0 ? { words: Math.floor(words), end } : null; return this; }
    /** Clamps the text to a number of lines. */
    lineClamp(lines: number | null): this { this._lineClamp = lines && lines > 0 ? Math.floor(lines) : null; return this; }
    /** `false`: long text does not wrap onto several lines. */
    wrap(condition = true): this { this._wrap = condition; return this; }
    /** Text size: `xs`, `sm` (default), `md` (or `base`) or `lg`. */
    size(size: PerItem<string | null>): this { this._size = size; return this; }
    /** Font weight: `thin`, `extralight`, `light`, `normal`, `medium`, `semibold`, `bold`, `extrabold` or `black`. */
    weight(weight: PerItem<string | null>): this { this._weight = weight; return this; }
    /** Font family: `sans`, `serif` or `mono`. */
    fontFamily(family: PerItem<string | null>): this { this._fontFamily = family; return this; }
    /** Typographic styling of rich content (`fi-prose`); the state is rendered as sanitized HTML. */
    prose(condition = true): this { this._prose = condition; return this; }
    /** Renders Markdown as HTML. HTML in the state (from a rich editor) is sanitized instead. */
    markdown(condition = true): this { this._markdown = condition; return this; }
    /** Renders the state as HTML, after it has been sanitized. */
    html(condition = true): this { this._html = condition; return this; }
    /** Each value of a list on its own line. */
    listWithLineBreaks(condition = true): this { this._listWithLineBreaks = condition; return this; }
    /** Bulleted list (implies line breaks). */
    bulleted(condition = true): this { this._bulleted = condition; return this; }
    /** Shows only the first values of a list, followed by "and N more". */
    limitList(limit: number | null = 3): this { this._listLimit = limit && limit > 0 ? Math.floor(limit) : null; return this; }
    /** With `limitList()` and line breaks: a link reveals the other values. */
    expandableLimitedList(condition = true): this { this._expandableLimitedList = condition; return this; }
    /** Splits a string state into a list on this separator. */
    separator(separator: string | null = ','): this { this._separator = separator; return this; }
    /** Clicking copies the value to the clipboard. */
    copyable(condition: PerItem<boolean> = true): this { this._copyable = condition; return this; }
    /** Value copied, when it differs from the displayed text. */
    copyableState(state: PerItem<string | null>): this { this._copyableState = state; return this; }
    copyMessage(message: string | null): this { this._copyMessage = message; return this; }
    copyMessageDuration(milliseconds: number): this { this._copyMessageDuration = Number.isFinite(milliseconds) ? Math.max(0, Math.floor(milliseconds)) : 2000; return this; }

    /** Displayed text of a state item, and whether it is (sanitized) HTML. */
    private formatItem(item: unknown, record: any): { text: string; isHtml: boolean } {
        let isHtml = this._html || this._markdown || this._prose;
        const enumCase = this._format ? null : this.enumCaseOf(record, item);
        const value = this._format ? this._format({ state: item, record }) : enumCase ? enumCase.getLabel() : this._formatter && !isBlank(item) ? this._formatter(item, record) : item;
        let text: string;
        if (value instanceof HtmlString) { isHtml = true; text = value.html; }
        else {
            text = value === null || value === undefined ? '' : value instanceof Date ? formatPhpDate(value, 'Y-m-d H:i:s') : typeof value === 'object' ? JSON.stringify(value) : String(value);
            // Markdown: content starting with a tag is HTML (from a rich editor), sanitized; otherwise HTML in it is shown as text.
            if (isHtml) text = this._markdown ? (/^\s*<[a-z][^>]*>/i.test(text) ? sanitize(text).replace(TIGHT_ITEM, '<li>$1</li>') : markdownToHtml(text)) : sanitize(text);
        }
        if (!isHtml) {
            const limit = this.getCharacterLimit(item, record);
            if (limit !== null && [...text].length > limit) text = `${[...text].slice(0, limit).join('').trimEnd()}${this.getCharacterLimitEnd(item, record) ?? ''}`;
            if (this._wordLimit) {
                const match = new RegExp(`^\\s*(?:\\S+\\s*){1,${this._wordLimit.words}}`, 'u').exec(text);
                if (match && match[0].length !== text.length) text = `${match[0].trimEnd()}${this._wordLimit.end}`;
            }
        }
        if (!isHtml && (this._prefix instanceof HtmlString || this._suffix instanceof HtmlString)) { isHtml = true; text = e(text); }
        const affix = (value: string | HtmlString | null) => (value === null || value === '' ? '' : value instanceof HtmlString ? value.html : isHtml ? e(value) : value);
        return { text: `${affix(this._prefix)}${text}${affix(this._suffix)}`, isHtml };
    }

    async toHtml(): Promise<string> {
        const record = this.context().record as any;
        let state = await this.getState();
        if (typeof state === 'string' && this._separator) {
            const parts = state.split(this._separator);
            state = parts.length === 1 && parts[0].trim() === '' ? [] : parts;
        }
        const isNumeric = this._isMoney || this._isNumeric;
        if (isBlank(state)) {
            // Without placeholder, Filament renders an empty item, except for money, date and badge entries reading the record.
            if (this._placeholder === null && (this._state !== null || (!this._isMoney && !this._isDate && !this._badge))) return this.wrapEmbeddedHtml(this.emptyHtml(['fi-in-text-item', 'fi-size-sm', 'fi-in-text', { 'fi-wrapped': this._wrap }]));
            return this.wrapEmbeddedHtml(this.emptyHtml(['fi-in-text', { 'fi-numeric': isNumeric }]));
        }
        let items = Array.isArray(state) ? state : [state];
        const stateCount = items.length;
        let count = stateCount;
        const hasLineBreaks = this._listWithLineBreaks || this._bulleted;
        const listLimit = this._listLimit ?? count;
        const overLimit = listLimit && count > listLimit ? count - listLimit : 0;
        if (overLimit && (!hasLineBreaks || !this._expandableLimitedList)) items = items.slice(0, listLimit);
        // Several values without line breaks: one comma-separated item.
        let collapsed: string | null = null;
        if (count > 1 && !hasLineBreaks && !this._badge) {
            collapsed = items.map((item) => { const formatted = this.formatItem(item, record); return formatted.isHtml ? formatted.text : e(formatted.text); }).join(', ');
            items = [collapsed];
            count = 1;
        }
        const alignment = await this.getAlignment();
        const tr = (key: string, params?: Record<string, string>) => t(`filament::components/copyable.${key}`, params);
        const itemData = (item: unknown) => {
            const formatted = collapsed !== null ? { text: collapsed, isHtml: true } : this.formatItem(item, record);
            const plain = formatted.isHtml ? stripTags(formatted.text) : formatted.text;
            const color = resolveItem(this._color, record, item) ?? this.enumCaseOf(record, item)?.getColor() ?? (this._badge ? 'primary' : null);
            const size = textSize(resolveItem(this._size, record, item));
            const iconColor = resolveItem(this._iconColor, record, item);
            const iconHtml = renderIcon(resolveItem(this._icon, record, item) ?? this.enumCaseOf(record, item)?.getIcon() ?? null, { size: size === 'md' || size === 'lg' ? size : 'sm', attributes: new Attributes().class(iconColor && iconColor !== 'gray' ? ['fi-color', `fi-color-${safeName(iconColor)}`] : []) });
            const isCopyable = Boolean(resolveItem(this._copyable, record, item));
            const tooltip = resolveItem(this._tooltip, record, item);
            let attributes: AttrMap = { class: cls(['fi-in-text-item', { 'fi-prose': this._prose || this._markdown }, fontClass(resolveItem(this._fontFamily, record, item), FONT_FAMILIES)]) };
            if (!this._badge) {
                attributes = withClass(attributes, [`fi-size-${size}`, fontClass(resolveItem(this._weight, record, item), FONT_WEIGHTS)]);
                if (this._lineClamp) attributes = withStyle(attributes, [`--line-clamp: ${this._lineClamp}`]);
                attributes = withClass(attributes, itemColorClasses(color));
            }
            let content: AttrMap | null = null;
            if (this._badge || isCopyable || !isBlank(tooltip)) {
                let click: string | null = null, label: string | null = null;
                if (isCopyable) {
                    const copied = js(resolveItem(this._copyableState, record, item) ?? formatted.text);
                    const message = js(this._copyMessage ?? tr('messages.copied'));
                    click = `if (isStandalone) {\n    copy(${copied}, ${message}, ${this._copyMessageDuration}, ${js(tr('messages.failed'))})\n} else {\n    window.navigator.clipboard.writeText(${copied})\n    $tooltip(${message}, {\n        theme: $store.theme,\n        timeout: ${this._copyMessageDuration},\n    })\n}`;
                    label = `isStandalone ? ${js(tr('label', { label: plain }))} : null`;
                }
                content = mergeAttrs({ 'x-data': isCopyable ? 'filamentCopyable' : null, 'x-bind': isCopyable ? 'bindings' : null, 'x-bind:aria-label': label, 'x-on:click': click, 'x-tooltip': tooltipJs(tooltip) }, {});
                content = withClass(content, [{ 'fi-copyable': isCopyable }]);
                if (this._badge) content = withClass(content, ['fi-badge', `fi-size-${size}`, ...badgeColorClasses(color)]);
            }
            const html = formatted.isHtml ? formatted.text : e(formatted.text);
            const inner = `${content ? `<span ${renderAttrs(content)}>` : ''}${this._iconPosition === 'before' ? iconHtml : ''}${html}${this._iconPosition === 'after' ? iconHtml : ''}${content ? '</span>' : ''}`;
            return { attributes, inner };
        };

        let container = withClass(this.getExtraAttributesMap(), ['fi-in-text', { 'fi-numeric': isNumeric }]);
        container = withClass(container, [{ 'fi-in-text-has-badges': this._badge }, { 'fi-wrapped': this._wrap }, alignmentClass(alignment)]);
        // Prefix and suffix actions (icon buttons by default), mounted with this entry's key.
        const ctx = this.context();
        const mountContext = { ...((this.livewire as any)?.getActionMountContext?.() ?? {}), schemaComponent: this.getKey() };
        const affixHtml = async (actions: Renderable[]) => {
            const html: string[] = [];
            for (const action of actions) if (await action.isVisible(ctx)) html.push(await (action as any).toHtml(ctx, mountContext));
            return html.length ? `<div class="fi-in-text-affix">${html.join('')}</div>` : '';
        };
        const prefixHtml = await affixHtml(this.getPrefixActions()), suffixHtml = await affixHtml(this.getSuffixActions());
        const hasAffixActions = prefixHtml !== '' || suffixHtml !== '';
        if (count === 1 && !this._bulleted && !hasAffixActions) {
            const { attributes, inner } = itemData(items[0]);
            return this.wrapEmbeddedHtml(`<div ${renderAttrs(mergeAttrs(attributes, container))}>${inner}</div>`);
        }
        container = withClass(container, [{ 'fi-bulleted': this._bulleted }, { 'fi-in-text-has-line-breaks': hasLineBreaks }]);
        if (overLimit || hasAffixActions) {
            const expandable = hasLineBreaks && this._expandableLimitedList;
            container = withClass(mergeAttrs({ 'x-data': expandable && overLimit ? '{ isLimited: true }' : null }, container), [{ 'fi-in-text-affixed': hasAffixActions, 'fi-in-text-list-limited': overLimit > 0 }]);
            const listItems = items.map((item, index) => {
                const { attributes, inner } = itemData(item);
                return `<li ${index >= listLimit ? 'x-show="! isLimited" x-cloak x-transition ' : ''}${renderAttrs(attributes)}>${inner}</li>`;
            }).join('');
            const message = expandable
                ? `<div role="button" x-bind:aria-expanded="(! isLimited).toString()" x-on:click.prevent.stop="isLimited = false" x-show="isLimited" class="fi-link fi-size-xs">${e(tc('filament-infolists::components.entries.text.actions.expand_list', overLimit))}</div><div role="button" x-bind:aria-expanded="(! isLimited).toString()" x-on:click.prevent.stop="isLimited = true" x-cloak x-show="! isLimited" class="fi-link fi-size-xs">${e(tc('filament-infolists::components.entries.text.actions.collapse_list', overLimit))}</div>`
                : e(tc('filament-infolists::components.entries.text.more_list_items', overLimit));
            const limitedMessage = overLimit ? `<div class="fi-in-text-list-limited-message">${message}</div>` : '';
            const body = `<ul>${listItems}</ul>${limitedMessage}`;
            return this.wrapEmbeddedHtml(`<div ${renderAttrs(container)}>${prefixHtml}${hasAffixActions ? `<div class="fi-in-text-affixed-content">${body}</div>` : body}${suffixHtml}</div>`);
        }
        const listItems = items.map((item) => { const { attributes, inner } = itemData(item); return `<li ${renderAttrs(attributes)}>${inner}</li>`; }).join('');
        return this.wrapEmbeddedHtml(`<ul ${renderAttrs(container)}>${listItems}</ul>`);
    }
}

/** Only hex or simple functional colors are injected into the style attribute. */
const sanitizeCssColor = (value: unknown): string | null => (typeof value === 'string' && /^(#[0-9a-fA-F]{3,8}|(rgb|hsl|oklch)a?\([0-9.,%\s/deg-]+\))$/.test(value.trim()) ? value.trim() : null);

/** Color swatch: only hex or simple functional colors are displayed. */
export class ColorEntry extends Entry {
    private _copyable: PerItem<boolean> = false;
    private _copyableState: PerItem<string | null> = null;
    private _copyMessage: string | null = null;
    private _copyMessageDuration = 2000;
    private _wrap = true;
    static make(name: string): ColorEntry { return configured(new ColorEntry(name)); }
    /** Clicking the swatch copies the color to the clipboard. */
    copyable(condition: PerItem<boolean> = true): this { this._copyable = condition; return this; }
    copyableState(state: PerItem<string | null>): this { this._copyableState = state; return this; }
    copyMessage(message: string | null): this { this._copyMessage = message; return this; }
    copyMessageDuration(milliseconds: number): this { this._copyMessageDuration = Number.isFinite(milliseconds) ? Math.max(0, Math.floor(milliseconds)) : 2000; return this; }
    wrap(condition = true): this { this._wrap = condition; return this; }
    async toHtml(): Promise<string> {
        const record = this.context().record;
        const state = await this.getState();
        const colors = (Array.isArray(state) ? state : [state]).map(sanitizeCssColor).filter((color): color is string => color !== null);
        if (!colors.length) {
            // An empty or unsupported value: the wrapping container, with the placeholder if any.
            return this.wrapEmbeddedHtml(this.emptyHtml(['fi-in-color', { 'fi-wrapped': this._wrap }]));
        }
        const alignment = await this.getAlignment();
        const tr = (key: string, params?: Record<string, string>) => t(`filament::components/copyable.${key}`, params);
        const swatches = colors.map((color) => {
            const isCopyable = Boolean(resolveItem(this._copyable, record, color));
            const tooltip = resolveItem(this._tooltip, record, color);
            const label = isCopyable ? null : !isBlank(tooltip) ? String(tooltip) : color;
            const copied = js(resolveItem(this._copyableState, record, color) ?? color);
            const message = js(this._copyMessage ?? tr('messages.copied'));
            const attributes = withStyle(withClass(mergeAttrs({
                role: label !== null ? 'img' : null,
                'aria-label': label !== null ? e(label) : null,
                'x-data': isCopyable ? 'filamentCopyable' : null,
                'x-bind': isCopyable ? 'bindings' : null,
                'x-bind:aria-label': isCopyable ? `isStandalone ? ${js(tr('label', { label: color }))} : null` : null,
                'x-on:click': isCopyable ? `if (isStandalone) {\n    copy(${copied}, ${message}, ${this._copyMessageDuration}, ${js(tr('messages.failed'))})\n} else {\n    window.navigator.clipboard.writeText(${copied})\n    $tooltip(${message}, {\n        theme: $store.theme,\n        timeout: ${this._copyMessageDuration},\n    })\n}` : null,
                'x-tooltip': tooltipJs(tooltip),
            }, {}), ['fi-in-color-item', { 'fi-copyable': isCopyable }]), [`background-color: ${color}`]);
            return `<div ${renderAttrs(attributes)}></div>`;
        }).join('');
        const container = withClass(this.getExtraAttributesMap(), ['fi-in-color', { 'fi-wrapped': this._wrap }, alignmentClass(alignment)]);
        return this.wrapEmbeddedHtml(`<div ${renderAttrs(container)}>${swatches}</div>`);
    }
}

/** `<img>` attributes allowed in `extraImgAttributes()`: no event handler, style or source. */
const IMG_ATTRIBUTES = new Set(['class', 'id', 'title', 'loading', 'decoding', 'fetchpriority', 'referrerpolicy', 'crossorigin', 'width', 'height', 'draggable', 'role']);
const isAllowedImgAttribute = (name: string) => IMG_ATTRIBUTES.has(name.toLowerCase()) || /^(data|aria)-[a-z0-9_.-]+$/i.test(name);

/** Read-only images: only same-site (`/…`) or http(s) URLs are rendered. */
export class ImageEntry extends Entry {
    private _height: string | null = null;
    private _width: string | null = null;
    private _alt: PerItem<string | null> = null;
    private _circular = false;
    private _square = false;
    private _stacked = false;
    private _ring: number | null = null;
    private _overlap: number | null = null;
    private _limit: number | null = null;
    private _limitedRemainingText = false;
    private _limitedRemainingTextSize: string | null = null;
    private _defaultImageUrl: Lazy<string | null, ComponentContext> = null;
    private _extraImgAttributes: Record<string, string> = {};
    private _wrap = true;
    private _storage: Lazy<FileUrlStorage | null, ComponentContext> = null;
    private _visibility: Lazy<'public' | 'private' | null, ComponentContext> = null;
    private _checkFileExistence: Lazy<boolean, ComponentContext> = true;
    /**
     * Application-wide storage of the images whose state is a stored file key (Filament's default disk), e.g.
     * `ImageEntry.storage = FileUpload.storage`. Without one, only URLs are displayed.
     */
    static storage: FileUrlStorage | null = null;
    static make(name: string): ImageEntry { return configured(new ImageEntry(name)); }
    /** Storage of the images (Filament's `disk()`): a `FileStorage` of `@navette-js/forms`, or anything giving URLs of keys. */
    storage(storage: Lazy<FileUrlStorage | null, ComponentContext>): this { this._storage = storage; return this; }
    /** `'private'`: images are shown through temporary URLs of the storage. By default, the storage's own visibility. */
    visibility(visibility: Lazy<'public' | 'private' | null, ComponentContext>): this { this._visibility = visibility; return this; }
    /** `false`: stored images are not checked before being displayed (a missing file shows the default image otherwise). */
    checkFileExistence(condition: Lazy<boolean, ComponentContext> = true): this { this._checkFileExistence = condition; return this; }
    async getStorage(): Promise<FileUrlStorage | null> { return (await evaluate(this._storage, this.context())) ?? ImageEntry.storage; }
    async getVisibility(): Promise<'public' | 'private'> {
        const visibility = await evaluate(this._visibility, this.context());
        if (visibility === 'public' || visibility === 'private') return visibility;
        return (await this.getStorage())?.visibility === 'private' ? 'private' : 'public';
    }
    async shouldCheckFileExistence(): Promise<boolean> { return Boolean(await evaluate(this._checkFileExistence, this.context())); }
    /**
     * URL of an image of the state, like Filament's `getImageUrl()`: a local or http(s) URL as is; a stored file key through
     * the storage (`null` when it is missing and `checkFileExistence()` is on, a temporary URL when private).
     */
    async getImageUrl(state: unknown): Promise<string | null> {
        if (isImageUrl(state)) return state.trim();
        const storage = await this.getStorage();
        if (!storage || !isSafeStorageKey(state)) return null;
        const url = await resolveStoredFileUrl(storage, state, { visibility: await this.getVisibility(), checkExistence: await this.shouldCheckFileExistence() });
        return isImageUrl(url) ? url.trim() : null;
    }
    /** Height of the images: a CSS length (`40px`, `2.5rem`…) or a number of pixels; `8rem` by default. Any other value is ignored. */
    imageHeight(height: number | string | null): this { if (height === null) this._height = null; else this._height = cssLength(height) ?? this._height; return this; }
    /** Width of the images: a CSS length or a number of pixels. Any other value is ignored. */
    imageWidth(width: number | string | null): this { if (width === null) this._width = null; else this._width = cssLength(width) ?? this._width; return this; }
    imageSize(size: number | string): this { return this.imageWidth(size).imageHeight(size); }
    alt(text: PerItem<string | null>): this { this._alt = text; return this; }
    circular(condition = true): this { this._circular = condition; return this; }
    /** Square images: the width is the height. */
    square(condition = true): this { this._square = condition; return this; }
    /** Overlapping images (`2.5rem` high by default). */
    stacked(condition = true): this { this._stacked = condition; return this; }
    /** Ring width of stacked images, from 0 to 8. */
    ring(width: number | null): this { this._ring = width === null ? null : Math.max(0, Math.min(8, Math.floor(width))); return this; }
    /** Overlap of stacked images, from 0 to 8 (2 by default). */
    overlap(overlap: number | null): this { this._overlap = overlap === null ? null : Math.max(0, Math.min(8, Math.floor(overlap))); return this; }
    /** Maximum number of images displayed. */
    limit(limit: number | null = 3): this { this._limit = limit && limit > 0 ? Math.floor(limit) : null; return this; }
    /** Shows "+N" after the limited images; `size`: `xs`, `sm` (default), `md` or `lg`. */
    limitedRemainingText(condition = true, size: string | null = null): this { this._limitedRemainingText = condition; this._limitedRemainingTextSize = size; return this; }
    /** Image displayed when the state is empty. */
    defaultImageUrl(url: Lazy<string | null, ComponentContext>): this { this._defaultImageUrl = url; return this; }
    /** Extra `<img>` attributes (`loading`, `class`, `data-*`, `aria-*`…). Event handlers, `style` and sources are ignored; values are escaped. */
    extraImgAttributes(attributes: Record<string, string>): this { Object.assign(this._extraImgAttributes, attributes); return this; }
    wrap(condition = true): this { this._wrap = condition; return this; }
    async toHtml(): Promise<string> {
        const ctx = this.context();
        const state = await this.getState();
        const fallback = await evaluate(this._defaultImageUrl, ctx);
        const defaultUrl = isImageUrl(fallback) ? fallback.trim() : null;
        const items = isBlank(state) ? (defaultUrl ? [defaultUrl] : []) : Array.isArray(state) ? state : [state];
        let sources = (await Promise.all(items.map(async (item) => ({ item, src: (await this.getImageUrl(item)) ?? defaultUrl })))).filter((source): source is { item: unknown; src: string } => source.src !== null);
        if (!sources.length) return this.wrapEmbeddedHtml(this._placeholder !== null || this._emptyTooltip !== null ? this.emptyHtml(['fi-in-image']) : this.emptyHtml(['fi-in-image', { 'fi-wrapped': this._wrap }]));
        const count = sources.length;
        const overLimit = this._limit && count > this._limit ? count - this._limit : 0;
        if (overLimit) sources = sources.slice(0, this._limit!);
        const alignment = await this.getAlignment();
        const height = this._height ?? (this._stacked ? '2.5rem' : '8rem');
        const width = this._width ?? (this._circular || this._square ? height : null);
        const size = [`height: ${height}`, width ? `width: ${width}` : null];
        const extraImg = escapeAttributes(Object.fromEntries(Object.entries(this._extraImgAttributes).filter(([name]) => isAllowedImgAttribute(name))));
        const images = sources.map(({ item, src }) => {
            // Alt text and tooltip functions receive the state item (the URL, or the stored file key).
            const alt = resolveItem(this._alt, ctx.record, item);
            return `<img ${renderAttrs(withStyle(mergeAttrs({ alt: e(alt ?? ''), src: e(src), 'x-tooltip': tooltipJs(resolveItem(this._tooltip, ctx.record, item)) }, extraImg), size))} />`;
        }).join('');
        const remaining = overLimit && this._limitedRemainingText
            ? `<div ${renderAttrs(withStyle({ class: cls(['fi-in-image-limited-remaining-text', this._limitedRemainingTextSize ? `fi-size-${textSize(this._limitedRemainingTextSize)}` : null]) }, size))}>+${overLimit}</div>`
            : '';
        const container = withClass(this.getExtraAttributesMap(), [
            'fi-in-image', { 'fi-circular': this._circular, 'fi-wrapped': this._wrap, 'fi-stacked': this._stacked },
            this._stacked && this._ring !== null ? `fi-in-image-ring fi-in-image-ring-${this._ring}` : null,
            this._stacked && (this._overlap ?? 2) ? `fi-in-image-overlap-${this._overlap ?? 2}` : null,
            alignmentClass(alignment),
        ]);
        return this.wrapEmbeddedHtml(`<div ${renderAttrs(container)}>${images}${remaining}</div>`);
    }
}

const ICON_SIZES = new Set(['xs', 'sm', 'md', 'lg', 'xl', '2xl']);

/** Icons chosen from the state; `boolean()` shows a green check or a red cross. */
export class IconEntry extends Entry {
    private _boolean = false;
    private _icon: StateMap<string | null> = null;
    private _color: StateMap<string | null> = null;
    private _size: PerItem<string | null> = null;
    private _trueIcon: string | false | null = null;
    private _falseIcon: string | false | null = null;
    private _trueColor: string | null = null;
    private _falseColor: string | null = null;
    private _listWithLineBreaks = false;
    private _wrap = true;
    static make(name: string): IconEntry { return configured(new IconEntry(name)); }
    boolean(condition = true): this { this._boolean = condition; return this; }
    /** Icon: a Heroicon name, a map of state values to names, or a function of the record and the state item. */
    icon(icon: StateMap<string | null>): this { this._icon = icon; return this; }
    /** Color: a name, a map of state values to colors, or a function of the record and the state item. */
    color(color: StateMap<string | null>): this { this._color = color; return this; }
    /** Icon size: `xs`, `sm`, `md`, `lg` (default), `xl` or `2xl`. */
    size(size: PerItem<string | null>): this { this._size = size; return this; }
    /** Icon of a true state (`o-check-circle` by default); `false`: no icon. Implies `boolean()`. */
    trueIcon(icon: string | false | null): this { this._boolean = true; this._trueIcon = icon; return this; }
    /** Icon of a false state (`o-x-circle` by default); `false`: no icon. Implies `boolean()`. */
    falseIcon(icon: string | false | null): this { this._boolean = true; this._falseIcon = icon; return this; }
    /** Color of a true state (`success` by default). Implies `boolean()`. */
    trueColor(color: string | null): this { this._boolean = true; this._trueColor = color; return this; }
    /** Color of a false state (`danger` by default). Implies `boolean()`. */
    falseColor(color: string | null): this { this._boolean = true; this._falseColor = color; return this; }
    /** Each icon of a list on its own line. */
    listWithLineBreaks(condition = true): this { this._listWithLineBreaks = condition; return this; }
    wrap(condition = true): this { this._wrap = condition; return this; }
    async toHtml(): Promise<string> {
        const record = this.context().record;
        const state = await this.getState();
        if (isBlank(state)) return this.wrapEmbeddedHtml(this._placeholder !== null || this._emptyTooltip !== null ? this.emptyHtml(['fi-in-icon']) : this.emptyHtml(['fi-in-icon', { 'fi-wrapped': this._wrap }]));
        const alignment = await this.getAlignment();
        const items = (Array.isArray(state) ? state : [state]).map((item) => {
            const on = item === true || item === 1 || item === '1';
            const enumCase = this.enumCaseOf(record, item);
            let name = resolveMap(this._icon, record, item) ?? enumCase?.getIcon() ?? null;
            if (!name && this._boolean && item !== null && item !== undefined) name = on ? (this._trueIcon === false ? null : this._trueIcon ?? icons.resolve('infolists::components.icon-entry.true') ?? 'o-check-circle') : (this._falseIcon === false ? null : this._falseIcon ?? icons.resolve('infolists::components.icon-entry.false') ?? 'o-x-circle');
            if (!name) return '';
            let color = resolveMap(this._color, record, item) ?? enumCase?.getColor() ?? null;
            if (!color && this._boolean && item !== null && item !== undefined) color = on ? this._trueColor ?? 'success' : this._falseColor ?? 'danger';
            const size = resolveItem(this._size, record, item);
            const tooltip = resolveItem(this._tooltip, record, item);
            const attributes = new Attributes().merge({ 'x-tooltip': tooltipJs(tooltip) }).class(iconColorClasses(color));
            const text = !isBlank(tooltip) ? String(tooltip) : enumCase ? enumCase.getLabel() : this._boolean ? t(on ? 'filament-infolists::components.entries.icon.true' : 'filament-infolists::components.entries.icon.false') : ['string', 'number', 'boolean'].includes(typeof item) ? String(item) : '';
            return `${renderIcon(name, { size: size && ICON_SIZES.has(size) ? size : 'lg', attributes })}${text !== '' ? `<span class="fi-sr-only">${e(text)}</span>` : ''}`;
        }).join('');
        const container = withClass(this.getExtraAttributesMap(), ['fi-in-icon', { 'fi-in-icon-has-line-breaks': this._listWithLineBreaks, 'fi-wrapped': this._wrap }, alignmentClass(alignment)]);
        return this.wrapEmbeddedHtml(`<div ${renderAttrs(container)}>${items}</div>`);
    }
}

/** Key/value pairs as a table: the state is an object (or its JSON form); a non-scalar value is shown as JSON. */
export class KeyValueEntry extends Entry {
    private _keyLabel: string | null = null;
    private _valueLabel: string | null = null;
    static make(name: string): KeyValueEntry { return configured(new KeyValueEntry(name)); }
    keyLabel(label: string | null): this { this._keyLabel = label; return this; }
    valueLabel(label: string | null): this { this._valueLabel = label; return this; }
    /** @deprecated Use `placeholder()`. */
    emptyMessage(text: string | null): this { return this.placeholder(text); }
    async toHtml(): Promise<string> {
        let state = await this.getState();
        if (typeof state === 'string') { try { state = JSON.parse(state); } catch { state = null; } }
        const entries = state && typeof state === 'object' ? (state instanceof Map ? [...state.entries()] : Object.entries(state as object)) : [];
        const tr = (key: string) => t(`filament-infolists::components.entries.key_value.${key}`);
        const show = (value: unknown) => (value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value) ? (value === true ? '1' : value === false ? '' : String(value ?? '')) : JSON.stringify(value));
        const rows = entries.map(([key, value]) => `<tr><th scope="row">${e(key)}</th><td>${e(show(value))}</td></tr>`).join('');
        const empty = entries.length ? '' : `<tr><td colspan="2" class="fi-in-placeholder">${e(this._placeholder ?? tr('placeholder'))}</td></tr>`;
        return this.wrapEmbeddedHtml(`<table ${renderAttrs(withClass(this.getExtraAttributesMap(), ['fi-in-key-value']))}><thead><tr><th scope="col">${e(this._keyLabel ?? tr('columns.key.label'))}</th><th scope="col">${e(this._valueLabel ?? tr('columns.value.label'))}</th></tr></thead><tbody>${rows}${empty}</tbody></table>`);
    }
}

/** Pretty-printed JSON: four-space indent, with `/` and non-ASCII characters escaped. */
const phpPrettyJson = (value: unknown): string => (JSON.stringify(value, null, 4) ?? 'null').replace(/\//g, '\\/').replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
/** Background and text colors of the default themes (github-light / github-dark-high-contrast). */
const PHIKI_DEFAULT_STYLE = 'background-color: #fff;color: #24292e;--phiki-dark-background-color: #0a0c10;--phiki-dark-color: #f0f3f6;';
/**
 * Read-only code, rendered as `<pre class="phiki …">` like Filament's (Phiki) markup. With Shiki installed
 * (optional peer dependency), it is highlighted on the server in a light and a dark theme; without it, each line
 * is a single escaped text token. An array or object is shown as indented JSON.
 */
export class CodeEntry extends Entry {
    private _grammar: string | null = null;
    private _lightTheme: string | null = null;
    private _darkTheme: string | null = null;
    private _copyable = false;
    private _copyMessage: string | null = null;
    private _copyMessageDuration = 2000;
    static make(name: string): CodeEntry { return configured(new CodeEntry(name)); }
    /** Shiki grammar (`php`, `json`, `javascript`, `ts`…), also used in the `language-…` class; `html` by default, `json` for an array. */
    grammar(grammar: string | null): this { this._grammar = grammar; return this; }
    /** Shiki theme of the light mode (`github-light` by default) and of the dark mode (`github-dark-high-contrast`). */
    lightTheme(theme: string | null): this { this._lightTheme = theme; return this; }
    darkTheme(theme: string | null): this { this._darkTheme = theme; return this; }
    /** Clicking copies the code to the clipboard. */
    copyable(condition = true): this { this._copyable = condition; return this; }
    copyMessage(message: string | null): this { this._copyMessage = message; return this; }
    copyMessageDuration(milliseconds: number): this { this._copyMessageDuration = milliseconds; return this; }
    async toHtml(): Promise<string> {
        let state = await this.getState();
        if (state === null || state === undefined || (typeof state === 'string' && state.trim() === '') || (Array.isArray(state) && !state.length)) {
            return this.wrapEmbeddedHtml(`<div class="fi-in-code">${this._placeholder !== null ? `<p class="fi-in-placeholder">${e(this._placeholder)}</p>` : ''}</div>`);
        }
        let grammar = this._grammar;
        if (typeof state === 'object') { state = phpPrettyJson(state); grammar ??= 'json'; }
        const code = String(state);
        const language = (grammar ?? 'html').replace(/[^a-zA-Z0-9_+#-]/g, '');
        const light = (this._lightTheme ?? 'github-light').replace(/[^a-zA-Z0-9_-]/g, ''), dark = (this._darkTheme ?? 'github-dark-high-contrast').replace(/[^a-zA-Z0-9_-]/g, '');
        const highlighted = await highlightCode(code, language, light, dark);
        const style = highlighted ? ` style="${e(highlighted.preStyle)}"` : this._lightTheme === null && this._darkTheme === null ? ` style="${PHIKI_DEFAULT_STYLE}"` : '';
        // One `<span class="line">` per line, the newline being the last token of each line.
        const lines = code.split('\n');
        const linesHtml = highlighted ? highlightedLinesHtml(highlighted) : lines.map((line, index) => `<span class="line">${line === '' ? '' : `<span class="token">${e(line)}</span>`}${index < lines.length - 1 ? '<span class="token">\n</span>' : ''}</span>`).filter((html, index) => !(index === lines.length - 1 && lines[index] === '' && lines.length > 1)).join('');
        const pre = `<pre class="phiki language-${language} ${light} phiki-themes ${dark}" data-language="${language}"${style}><code>${linesHtml}</code></pre>`;
        if (!this._copyable) return this.wrapEmbeddedHtml(`<div ${renderAttrs(withClass(this.getExtraAttributesMap(), ['fi-in-code']))}>${pre}</div>`);
        const tr = (key: string, params?: Record<string, string>) => t(`filament::components/copyable.${key}`, params);
        const message = js(this._copyMessage ?? tr('messages.copied'));
        const click = `if (isStandalone) {\n    copy(${js(code)}, ${message}, ${this._copyMessageDuration}, ${js(tr('messages.failed'))})\n} else {\n    window.navigator.clipboard.writeText(${js(code)})\n    $tooltip(${message}, {\n        theme: $store.theme,\n        timeout: ${this._copyMessageDuration},\n    })\n}`;
        const attributes = new Attributes(this.getExtraAttributesMap()).merge({
            'x-data': 'filamentCopyable', 'x-bind': 'bindings', 'x-id': "['copyable-code']",
            'x-bind:aria-label': `isStandalone ? ${js(tr('label', { label: await this.getLabel() }))} : null`,
            'x-bind:aria-describedby': "isStandalone ? $id('copyable-code') : null", 'x-on:click': click,
        }).class(['fi-in-code', 'fi-copyable']);
        return this.wrapEmbeddedHtml(`<div ${attributes.toHtml()}><div x-bind:id="$id('copyable-code')">${pre}</div></div>`);
    }
}

/**
 * Custom-rendered entry: the given function receives the state, record and context, and returns the content
 * placed in the entry wrapper. This HTML is inserted AS IS: escape any user- or database-supplied value with `e()`.
 */
export class ViewEntry extends Entry {
    private _view: ((ctx: ComponentContext & { state: unknown; entry: ViewEntry }) => string | Promise<string>) | null = null;
    private _wrapped = true;
    static make(name: string): ViewEntry { return configured(new ViewEntry(name)); }
    /** Content render function. */
    view(renderer: ((ctx: ComponentContext & { state: unknown; entry: ViewEntry }) => string | Promise<string>) | null): this { this._view = renderer; return this; }
    /** `false`: the function renders the whole entry, without the usual wrapper (label). */
    wrapped(condition = true): this { this._wrapped = condition; return this; }
    /** Places custom content in the entry wrapper (label, slots, link): for entry classes extending `ViewEntry`. */
    protected wrap(content: string): Promise<string> { return this.wrapEmbeddedHtml(content); }
    async toHtml(): Promise<string> {
        if (!this._view) throw new Error(`ViewEntry [${this._name}]: view() is required.`);
        const html = await this._view({ ...this.context(), state: await this.getState(), entry: this });
        return this._wrapped ? this.wrapEmbeddedHtml(html) : html;
    }
}

/** Column of a table repeatable entry: a header label, an optional width and alignment. */
export class TableColumn {
    label: string;
    private _width: string | null = null;
    private _hiddenHeaderLabel = false;
    private _wrapHeader = false;
    private _alignment: string | null = null;
    constructor(label: string) { this.label = label; }
    static make(label: string): TableColumn { return configured(new TableColumn(label)); }
    /** Fixed width: a number of pixels, or a CSS length (`10rem`, `20%`). Any other value is ignored. */
    width(width: number | string | null): this { this._width = width === null ? null : cssLength(width) ?? this._width; return this; }
    /** Keeps the header label for screen readers only. */
    hiddenHeaderLabel(condition = true): this { this._hiddenHeaderLabel = condition; return this; }
    /** Lets a long header label wrap onto several lines. */
    wrapHeader(condition = true): this { this._wrapHeader = condition; return this; }
    /** Header alignment: `start`, `center` or `end`. */
    alignment(alignment: string | null): this { this._alignment = alignment; return this; }
    alignStart(): this { return this.alignment('start'); }
    alignCenter(): this { return this.alignment('center'); }
    alignEnd(): this { return this.alignment('end'); }
    getWidth(): string | null { return this._width; }
    isHeaderLabelHidden(): boolean { return this._hiddenHeaderLabel; }
    canHeaderWrap(): boolean { return this._wrapHeader; }
    getAlignment(): string | null { return this._alignment; }
}

/** Column header of a table repeatable entry: `TableColumn` from this package (or the one of @navette-js/forms). */
export type RepeatableColumn = { label: string; getWidth(): string | null; isHeaderLabelHidden?(): boolean; canHeaderWrap?(): boolean; getAlignment?(): string | null };

/**
 * Read-only list of items read from the record: cards in a grid (default), or a table (`table()`) with one row per item
 * and one cell per entry.
 */
export class RepeatableEntry extends Entry {
    private _tableColumns: RepeatableColumn[] | null = null;
    private _schema: () => Component[] = () => [];
    private _grid: Record<string, number> | number | null = null;
    private _itemColumns: Record<string, number> | number | null = null;
    private _contained = true;
    private _maxItemsForProcessing: number | null = null;
    static make(name: string): RepeatableEntry { return configured(new RepeatableEntry(name)); }
    /**
     * Refuses to build more item schemas than this (Filament's `maxItemsForProcessing()`): above it, rendering stops with an
     * HTTP 413 error instead of truncating the data. `null` (default) disables the limit.
     */
    maxItemsForProcessing(count: number | null): this { this._maxItemsForProcessing = count === null || !Number.isFinite(count) ? null : Math.max(0, Math.floor(count)); return this; }
    getMaxItemsForProcessing(): number | null { return this._maxItemsForProcessing; }
    private assertItemsForProcessing(count: number): void {
        const max = this._maxItemsForProcessing;
        if (max !== null && count > max) throw Object.assign(new Error(`The [${this._name ?? 'repeatable'}] entry has more than ${max} items to process.`), { status: 413 });
    }
    /** Renders the items as a table with these columns, in the order of the schema's entries. */
    table(columns: RepeatableColumn[] | null): this { this._tableColumns = columns; return this; }
    /** Components repeated for each item. A function returns fresh instances for each item. */
    schema(components: Component[] | (() => Component[])): this { this._schema = typeof components === 'function' ? components : () => components; return this; }
    /** Card layout: number of item columns (from `lg` for a number, per breakpoint for an object); 2 when called without argument. */
    grid(columns: Record<string, number> | number | null = 2): this { this._grid = columns; return this; }
    /** Card layout: grid columns inside each item. */
    columns(columns: Record<string, number> | number | null): this { this._itemColumns = columns; return this; }
    /** Card layout: `false` removes the card styling of the items. */
    contained(condition = true): this { this._contained = condition; return this; }
    private itemSchema(index: number, item: unknown): { schema: Schema; components: Component[] } {
        const c = this.container;
        const components = this._schema();
        const schema = new Schema(c.livewire).key(`${this.getKey()}.${index}`).statePath(`${this.getStatePath()}.${index}`).operation(c.getOperation()).record(item).root(false).components(components);
        return { schema, components };
    }
    async toHtml(): Promise<string> {
        const state = await this.getState();
        const items: unknown[] = Array.isArray(state) ? state : [];
        // Counted before any item schema is built, in both layouts.
        this.assertItemsForProcessing(items.length);
        const columns = this._tableColumns ?? [];
        if (!columns.length) {
            if (!items.length) return this.wrapEmbeddedHtml(this.emptyHtml(['fi-in-repeatable', { 'fi-contained': this._contained }]));
            const list = new Attributes(this.getExtraAttributesMap()).class(['fi-in-repeatable', { 'fi-contained': this._contained }]).grid(this._grid);
            const cards: string[] = [];
            for (const [index, item] of items.entries()) {
                const { schema } = this.itemSchema(index, item);
                cards.push(`<li class="fi-in-repeatable-item">${await schema.columns(this._itemColumns ?? {}).toHtml()}</li>`);
            }
            return this.wrapEmbeddedHtml(`<ul ${list.toHtml()}>${cards.join('')}</ul>`);
        }
        if (!items.length) return this.wrapEmbeddedHtml(this.emptyHtml(['fi-in-table-repeatable']));
        const rows: string[] = [];
        for (const [index, item] of items.entries()) {
            const { components } = this.itemSchema(index, item);
            const cells: string[] = [];
            for (const component of components.slice(0, columns.length)) {
                cells.push(await component.isVisible()
                    ? `<td wire:key="${e(component.getLivewireKey() ?? '')}" x-data="filamentSchemaComponent(${e(js(component.getAlpineScopeConfiguration()))})">${await component.toHtml()}</td>`
                    : '<td class="fi-hidden"></td>');
            }
            rows.push(`<tr>${cells.join('')}</tr>`);
        }
        const head = columns.map((column) => {
            const width = cssLength(column.getWidth());
            const classes = cls([{ 'fi-wrapped': column.canHeaderWrap?.() ?? false }, alignmentClass(column.getAlignment?.() ?? null)]);
            const label = column.isHeaderLabelHidden?.() ? `<span class="fi-sr-only">${e(column.label)}</span>` : e(column.label);
            return `<th scope="col" class="${classes}"${width ? ` style="width: ${e(width)}"` : ''}>${label}</th>`;
        }).join('');
        return this.wrapEmbeddedHtml(`<div ${renderAttrs(withClass(this.getExtraAttributesMap(), ['fi-in-table-repeatable']))}><table><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
    }
}
