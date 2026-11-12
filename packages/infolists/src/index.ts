// @navette-js/infolists — read-only entries (TextEntry, IconEntry…).
import { Component, Schema, type ComponentContext } from '@navette-js/schemas';
import { Attributes, e, icon, js, type ColorManager, configured } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';

const headline = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
/** Default label: "Department" for `department.name`. */
const defaultLabel = (name: string) => headline(name.includes('.') ? name.split('.').slice(-2, -1)[0] : name);

let colorManager: ColorManager | null = null;
export const useColorManager = (manager: ColorManager) => { colorManager = manager; };

/** Base entry: a label and a value read from the record (dotted paths allowed) or computed. */
abstract class Entry extends Component {
    protected _label: string | null = null;
    protected _state: ((ctx: ComponentContext) => unknown | Promise<unknown>) | null = null;
    constructor(name: string) { super(); this._name = name; }
    hasStatePath(): boolean { return true; }
    label(label: string): this { this._label = label; return this; }
    protected _hiddenLabel = false;
    /** Keeps the label for screen readers only. */
    hiddenLabel(condition = true): this { this._hiddenLabel = condition; return this; }
    /** Computed value; without it, the record attribute of the same name is shown. */
    state(resolver: (ctx: ComponentContext) => unknown | Promise<unknown>): this { this._state = resolver; return this; }
    protected async getState(): Promise<unknown> {
        const ctx = this.context();
        if (this._state) return this._state(ctx);
        const record = ctx.record as any;
        // `department.name`: flat `department_name` attribute (column computed by the adapter), otherwise a path into the object.
        if (record && this._name!.includes('.')) return record[this._name!.replace(/\./g, '_')] ?? this._name!.split('.').reduce((node: any, key) => node?.[key], record);
        return record?.[this._name!];
    }
    /** Wraps the content with the entry label. */
    protected wrap(content: string): string {
        if (this._hiddenLabel) return `<div class="fi-in-entry"><div class="fi-in-entry-label fi-sr-only" role="term">${e(this._label ?? defaultLabel(this._name!))}</div><div class="fi-in-entry-content-col"><div class="fi-in-entry-content-ctn" role="definition"><div class="fi-in-entry-content">${content}</div></div></div></div>`;
        return `<div class="fi-in-entry"><div class="fi-in-entry-label-col"><div class="fi-in-entry-label-ctn"><div class="fi-in-entry-label" role="term">${e(this._label ?? defaultLabel(this._name!))}</div></div></div><div class="fi-in-entry-content-col"><div class="fi-in-entry-content-ctn" role="definition"><div class="fi-in-entry-content">${content}</div></div></div></div>`;
    }
}

let htmlSanitizer: ((html: string) => string) | null = null;
const TIGHT_ITEM = new RegExp('<li><p>((?:(?!</?p>|</?li>)[^])*)</p></li>', 'g');

/** Sanitizer applied to HTML an entry renders as is (`markdown()`). Without one, the content is escaped. */
export const useHtmlSanitizer = (sanitizer: ((html: string) => string) | null) => { htmlSanitizer = sanitizer; };

/** Read-only text: badge, color, icon, money, date, placeholder. */
export class TextEntry extends Entry {
    private _badge = false;
    private _color: string | ((record: any) => string) | null = null;
    private _icon: ((record: any) => string | null) | null = null;
    private _format: ((ctx: { state: unknown; record: any }) => string) | null = null;
    private _money: string | null = null;
    private _date = false;
    private _placeholder: string | null = null;
    static make(name: string): TextEntry { return configured(new TextEntry(name)); }
    badge(condition = true): this { this._badge = condition; return this; }
    color(color: string | ((record: any) => string)): this { this._color = color; return this; }
    icon(resolver: (record: any) => string | null): this { this._icon = resolver; return this; }
    formatStateUsing(formatter: (ctx: { state: unknown; record: any }) => string): this { this._format = formatter; return this; }
    money(currency = 'usd'): this { this._money = currency.toUpperCase(); return this; }
    date(condition = true): this { this._date = condition; return this; }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    private _dateTime = false;
    private _time: string | null = null;
    private _suffix: string | null = null;
    dateTime(condition = true): this { this._dateTime = condition; return this; }
    time(format = 'H:i:s'): this { this._time = format; return this; }
    suffix(text: string | null): this { this._suffix = text; return this; }
    private _prose = false;
    private _markdown = false;
    /** Typographic styling of the content (`fi-prose`). */
    prose(condition = true): this { this._prose = condition; return this; }
    /**
     * Rich text content, rendered as HTML after the sanitizer set with `useHtmlSanitizer()`.
     * Existing HTML is kept (sanitized) and plain text becomes paragraphs; Markdown syntax itself is not converted.
     */
    markdown(condition = true): this { this._markdown = condition; return this; }
    private _copyable = false;
    private _numeric = false;
    /** Clicking copies the value to the clipboard. */
    copyable(condition = true): this { this._copyable = condition; return this; }
    /** Formatted number (thousands separators), aligned as a number. */
    numeric(condition = true): this { this._numeric = condition; return this; }
    async toHtml(): Promise<string> {
        const record = this.context().record as any;
        const state = await this.getState();
        const empty = state === null || state === undefined || state === '';
        if (empty && this._placeholder !== null) return this.wrap(`<div class="fi-in-text"><p class="fi-in-placeholder">${e(this._placeholder)}</p></div>`);
        // Empty value: bare container (with `fi-numeric` for money).
        if (empty) return this._state || (!this._money && !this._date && !this._badge) ? this.wrap('<div class="fi-in-text-item fi-size-sm fi-in-text fi-wrapped"></div>') : this.wrap(`<div class="${['fi-in-text', this._money || this._numeric ? 'fi-numeric' : null].filter(Boolean).join(' ')}"></div>`);
        let shown = String(state);
        if (this._numeric) shown = new Intl.NumberFormat('en-US').format(Number(state));
        if (this._money) shown = new Intl.NumberFormat('en-US', { style: 'currency', currency: this._money }).format(Number(state));
        if (this._date) shown = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${shown.replace(' ', 'T').slice(0, 19)}Z`));
        // `dateTime()`: "Jan 5, 2024 13:45:00" (`M j, Y H:i:s`).
        if (this._dateTime) shown = `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${shown.replace(' ', 'T').slice(0, 19)}Z`))} ${shown.slice(11, 19)}`;
        // `time('H:i')` or `time()` (`H:i:s`): the time part of an `H:i:s` or `Y-m-d H:i:s` value.
        if (this._time) shown = (shown.length > 8 ? shown.slice(11, 19) : shown).slice(0, this._time === 'H:i' ? 5 : 8);
        if (this._format) shown = this._format({ state, record });
        if (this._suffix !== null) shown += this._suffix;
        if (this._markdown) {
            const source = String(state);
            const html = /<[a-z][^>]*>/i.test(source)
                // Tight lists: a list item's single paragraph is unwrapped.
                ? (htmlSanitizer ? htmlSanitizer(source).replace(TIGHT_ITEM, '<li>$1</li>') : e(source))
                : source.split(/\n{2,}/).map((paragraph) => `<p>${e(paragraph.trim()).replace(/\n/g, '<br />')}</p>`).join('');
            return this.wrap(`<div class="${['fi-in-text-item', this._prose ? 'fi-prose' : null, 'fi-size-sm', 'fi-in-text', 'fi-wrapped'].filter(Boolean).join(' ')}">${html}</div>`);
        }
        if (this._badge && Array.isArray(state)) {
            // Several values: a list of badges (tags, for instance).
            const color = typeof this._color === 'function' ? this._color(record) : (this._color ?? 'primary');
            const classes = ['fi-badge', 'fi-size-sm', ...(color !== 'gray' ? (colorManager?.getComponentClasses('badge', color) ?? []) : [])].join(' ');
            return this.wrap(`<ul class="fi-in-text fi-in-text-has-badges fi-wrapped">${state.map((item) => `<li class="fi-in-text-item"><span class="${classes}">${e(String(item))}</span></li>`).join('')}</ul>`);
        }
        if (this._badge) {
            const color = typeof this._color === 'function' ? this._color(record) : (this._color ?? 'primary');
            const iconName = this._icon?.(record) ?? null;
            const classes = ['fi-badge', 'fi-size-sm', ...(color !== 'gray' ? (colorManager?.getComponentClasses('badge', color) ?? []) : [])].join(' ');
            return this.wrap(`<div class="fi-in-text-item fi-in-text fi-in-text-has-badges fi-wrapped"><span class="${classes}">${iconName ? icon(iconName, { size: 'sm' }) : ''}${e(shown)}</span></div>`);
        }
        const tr = (key: string, params?: Record<string, string>) => t(`filament::components/copyable.${key}`, params);
        const content = this._copyable
            ? `<span x-data="filamentCopyable" x-bind="bindings" x-bind:aria-label="isStandalone ? ${e(js(tr('label', { label: shown })))} : null" x-on:click="if (isStandalone) {
    copy(${e(js(shown))}, ${e(js(tr('messages.copied')))}, 2000, ${e(js(tr('messages.failed')))})
} else {
    window.navigator.clipboard.writeText(${e(js(shown))})
    $tooltip(${e(js(tr('messages.copied')))}, {
        theme: $store.theme,
        timeout: 2000,
    })
}" class="fi-copyable">${e(shown)}</span>`
            : e(shown);
        return this.wrap(`<div class="${['fi-in-text-item', 'fi-size-sm', 'fi-in-text', this._money || this._numeric ? 'fi-numeric' : null, 'fi-wrapped'].filter(Boolean).join(' ')}">${content}</div>`);
    }
}

/** Color swatch: only hex or simple functional colors are injected into the style attribute. */
export class ColorEntry extends Entry {
    private _placeholder: string | null = null;
    static make(name: string): ColorEntry { return configured(new ColorEntry(name)); }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    async toHtml(): Promise<string> {
        const state = await this.getState();
        const color = typeof state === 'string' && /^(#[0-9a-fA-F]{3,8}|(rgb|hsl|oklch)a?\([0-9.,%\s/deg-]+\))$/.test(state.trim()) ? state.trim() : null;
        if (color === null) return this.wrap(this._placeholder !== null ? `<div class="fi-in-color fi-wrapped"><p class="fi-in-placeholder">${e(this._placeholder)}</p></div>` : '<div class="fi-in-color fi-wrapped"></div>');
        return this.wrap(`<div class="fi-in-color fi-wrapped"><div role="img" aria-label="${e(color)}" class="fi-in-color-item" style="background-color: ${color};"></div></div>`);
    }
}

/** Read-only image: only same-site (`/…`) or http(s) URLs are rendered. */
export class ImageEntry extends Entry {
    private _height = '8rem';
    private _alt: string | null = null;
    private _circular = false;
    static make(name: string): ImageEntry { return configured(new ImageEntry(name)); }
    /** CSS height of the image (`8rem` by default). */
    imageHeight(height: string): this { if (/^[0-9.]+(rem|px|em)$/.test(height)) this._height = height; return this; }
    alt(text: string | null): this { this._alt = text; return this; }
    circular(condition = true): this { this._circular = condition; return this; }
    async toHtml(): Promise<string> {
        const state = await this.getState();
        const sources = (Array.isArray(state) ? state : [state]).filter((src): src is string => typeof src === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(src));
        return this.wrap(`<div class="fi-in-image fi-wrapped">${sources.map((src) => `<img alt="${e(this._alt ?? '')}" src="${e(src)}" style="height: ${this._height};"${this._circular ? ' class="fi-circular"' : ''} />`).join('')}</div>`);
    }
}

/** Icon based on the value; `boolean()` shows a green check or a red cross. */
export class IconEntry extends Entry {
    private _boolean = false;
    static make(name: string): IconEntry { return configured(new IconEntry(name)); }
    boolean(condition = true): this { this._boolean = condition; return this; }
    async toHtml(): Promise<string> {
        const state = await this.getState();
        if (!this._boolean || state === null || state === undefined) return this.wrap('<div class="fi-in-icon fi-wrapped"></div>');
        const on = state === true || state === 1 || state === '1';
        const classes = colorManager?.getComponentClasses('icon-column', on ? 'success' : 'danger') ?? [];
        return this.wrap(`<div class="fi-in-icon fi-wrapped">${icon(on ? 'o-check-circle' : 'o-x-circle', { size: 'lg', attributes: new Attributes().class(classes) })}<span class="fi-sr-only">${e(t(on ? 'filament-tables::table.columns.icon.boolean.true' : 'filament-tables::table.columns.icon.boolean.false'))}</span></div>`);
    }
}

/** Key/value pairs as a table: the state is an object (or its JSON form); a non-scalar value is shown as JSON. */
export class KeyValueEntry extends Entry {
    private _keyLabel: string | null = null;
    private _valueLabel: string | null = null;
    private _placeholder: string | null = null;
    static make(name: string): KeyValueEntry { return configured(new KeyValueEntry(name)); }
    keyLabel(label: string | null): this { this._keyLabel = label; return this; }
    valueLabel(label: string | null): this { this._valueLabel = label; return this; }
    /** Text shown when there are no pairs ("No entries" by default). */
    placeholder(text: string | null): this { this._placeholder = text; return this; }
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
        return this.wrap(`<table class="fi-in-key-value"><thead><tr><th scope="col">${e(this._keyLabel ?? tr('columns.key.label'))}</th><th scope="col">${e(this._valueLabel ?? tr('columns.value.label'))}</th></tr></thead><tbody>${rows}${empty}</tbody></table>`);
    }
}

/** Pretty-printed JSON: four-space indent, with `/` and non-ASCII characters escaped. */
const phpPrettyJson = (value: unknown): string => (JSON.stringify(value, null, 4) ?? 'null').replace(/\//g, '\\/').replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
/** Background and text colors of the default themes (github-light / github-dark-high-contrast). */
const PHIKI_DEFAULT_STYLE = 'background-color: #fff;color: #24292e;--phiki-dark-background-color: #0a0c10;--phiki-dark-color: #f0f3f6;';
/**
 * Read-only code, rendered as `<pre class="phiki …">` but WITHOUT syntax highlighting:
 * each line is a single escaped text token. An array or object is shown as indented JSON.
 */
export class CodeEntry extends Entry {
    private _grammar: string | null = null;
    private _lightTheme: string | null = null;
    private _darkTheme: string | null = null;
    private _placeholder: string | null = null;
    private _copyable = false;
    private _copyMessage: string | null = null;
    private _copyMessageDuration = 2000;
    static make(name: string): CodeEntry { return configured(new CodeEntry(name)); }
    /** Language (`php`, `json`, `javascript`…) used in the `language-…` class; `html` by default, `json` for an array. */
    grammar(grammar: string | null): this { this._grammar = grammar; return this; }
    /** Theme class names only: without a highlighter, colors stay those of the default themes. */
    lightTheme(theme: string | null): this { this._lightTheme = theme; return this; }
    darkTheme(theme: string | null): this { this._darkTheme = theme; return this; }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** Clicking copies the code to the clipboard. */
    copyable(condition = true): this { this._copyable = condition; return this; }
    copyMessage(message: string | null): this { this._copyMessage = message; return this; }
    copyMessageDuration(milliseconds: number): this { this._copyMessageDuration = milliseconds; return this; }
    async toHtml(): Promise<string> {
        let state = await this.getState();
        if (state === null || state === undefined || (typeof state === 'string' && state.trim() === '') || (Array.isArray(state) && !state.length)) {
            return this.wrap(`<div class="fi-in-code">${this._placeholder !== null ? `<p class="fi-in-placeholder">${e(this._placeholder)}</p>` : ''}</div>`);
        }
        let grammar = this._grammar;
        if (typeof state === 'object') { state = phpPrettyJson(state); grammar ??= 'json'; }
        const code = String(state);
        const language = (grammar ?? 'html').replace(/[^a-zA-Z0-9_+#-]/g, '');
        const light = (this._lightTheme ?? 'github-light').replace(/[^a-zA-Z0-9_-]/g, ''), dark = (this._darkTheme ?? 'github-dark-high-contrast').replace(/[^a-zA-Z0-9_-]/g, '');
        const style = this._lightTheme === null && this._darkTheme === null ? ` style="${PHIKI_DEFAULT_STYLE}"` : '';
        // One `<span class="line">` per line, the newline being the last token of each line.
        const lines = code.split('\n');
        const linesHtml = lines.map((line, index) => `<span class="line">${line === '' ? '' : `<span class="token">${e(line)}</span>`}${index < lines.length - 1 ? '<span class="token">\n</span>' : ''}</span>`).filter((html, index) => !(index === lines.length - 1 && lines[index] === '' && lines.length > 1)).join('');
        const pre = `<pre class="phiki language-${language} ${light} phiki-themes ${dark}" data-language="${language}"${style}><code>${linesHtml}</code></pre>`;
        if (!this._copyable) return this.wrap(`<div class="fi-in-code">${pre}</div>`);
        const tr = (key: string, params?: Record<string, string>) => t(`filament::components/copyable.${key}`, params);
        const message = js(this._copyMessage ?? tr('messages.copied'));
        const click = `if (isStandalone) {\n    copy(${js(code)}, ${message}, ${this._copyMessageDuration}, ${js(tr('messages.failed'))})\n} else {\n    window.navigator.clipboard.writeText(${js(code)})\n    $tooltip(${message}, {\n        theme: $store.theme,\n        timeout: ${this._copyMessageDuration},\n    })\n}`;
        const attributes = new Attributes().merge({
            'x-data': 'filamentCopyable', 'x-bind': 'bindings', 'x-id': "['copyable-code']",
            'x-bind:aria-label': `isStandalone ? ${js(tr('label', { label: this._label ?? defaultLabel(this._name!) }))} : null`,
            'x-bind:aria-describedby': "isStandalone ? $id('copyable-code') : null", 'x-on:click': click,
        }).class(['fi-in-code', 'fi-copyable']);
        return this.wrap(`<div ${attributes.toHtml()}><div x-bind:id="$id('copyable-code')">${pre}</div></div>`);
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
    async toHtml(): Promise<string> {
        if (!this._view) throw new Error(`ViewEntry [${this._name}]: view() is required.`);
        const html = await this._view({ ...this.context(), state: await this.getState(), entry: this });
        return this._wrapped ? this.wrap(html) : html;
    }
}

/** Column header of a table repeatable entry (same shape as `TableColumn` from @navette-js/forms). */
export type RepeatableColumn = { label: string; getWidth(): string | null };

/**
 * Read-only list of items, as a table: one row per item of the array read from
 * the record, one cell per schema entry.
 */
export class RepeatableEntry extends Entry {
    private _columns: RepeatableColumn[] = [];
    private _schema: () => Entry[] = () => [];
    static make(name: string): RepeatableEntry { return configured(new RepeatableEntry(name)); }
    table(columns: RepeatableColumn[]): this { this._columns = columns; return this; }
    schema(entries: Entry[] | (() => Entry[])): this { this._schema = typeof entries === 'function' ? entries : () => entries; return this; }
    async toHtml(): Promise<string> {
        const state = await this.getState();
        const items: unknown[] = Array.isArray(state) ? state : [];
        const c = this.container;
        const rows: string[] = [];
        for (const [index, item] of items.entries()) {
            const entries = this._schema();
            new Schema(c.livewire).key(`${this.getKey()}.${index}`).statePath(`${this.getStatePath()}.${index}`).operation(c.getOperation()).record(item).root(false).components(entries);
            const cells: string[] = [];
            for (const entry of entries) cells.push(`<td wire:key="${e(entry.getLivewireKey() ?? '')}" x-data="filamentSchemaComponent(${e(js(entry.getAlpineScopeConfiguration()))})">${await entry.toHtml()}</td>`);
            rows.push(`<tr>${cells.join('')}</tr>`);
        }
        const head = this._columns.map((column) => `<th scope="col" class=""${column.getWidth() ? ` style="width: ${e(column.getWidth()!)}"` : ''}>${e(column.label)}</th>`).join('');
        return this.wrap(`<div class="fi-in-table-repeatable"><table><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
    }
}
