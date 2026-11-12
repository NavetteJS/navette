// @navette-js/infolists — port de filament/infolists : entrées en lecture seule (TextEntry, IconEntry).
import { Component, Schema, type ComponentContext } from '@navette-js/schemas';
import { Attributes, e, icon, js, type ColorManager, configured } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';

const headline = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
/** Libellé par défaut : pour `department.name`, c'est « Department » (comme Filament). */
const defaultLabel = (name: string) => headline(name.includes('.') ? name.split('.').slice(-2, -1)[0] : name);

let colorManager: ColorManager | null = null;
export const useColorManager = (manager: ColorManager) => { colorManager = manager; };

/** Base des entrées : libellé, valeur lue dans l'enregistrement (chemin pointé accepté) ou calculée. */
abstract class Entry extends Component {
    protected _label: string | null = null;
    protected _state: ((ctx: ComponentContext) => unknown | Promise<unknown>) | null = null;
    constructor(name: string) { super(); this._name = name; }
    hasStatePath(): boolean { return true; }
    label(label: string): this { this._label = label; return this; }
    protected _hiddenLabel = false;
    /** Libellé gardé pour les lecteurs d'écran seulement. */
    hiddenLabel(condition = true): this { this._hiddenLabel = condition; return this; }
    /** Valeur calculée ; sans cela, l'attribut du même nom de l'enregistrement est affiché. */
    state(resolver: (ctx: ComponentContext) => unknown | Promise<unknown>): this { this._state = resolver; return this; }
    protected async getState(): Promise<unknown> {
        const ctx = this.context();
        if (this._state) return this._state(ctx);
        const record = ctx.record as any;
        // `department.name` : attribut à plat `department_name` (colonne calculée par l'adaptateur), sinon chemin dans l'objet.
        if (record && this._name!.includes('.')) return record[this._name!.replace(/\./g, '_')] ?? this._name!.split('.').reduce((node: any, key) => node?.[key], record);
        return record?.[this._name!];
    }
    /** Balisage de Entry::wrapEmbeddedHtml(). */
    protected wrap(content: string): string {
        if (this._hiddenLabel) return `<div class="fi-in-entry"><div class="fi-in-entry-label fi-sr-only" role="term">${e(this._label ?? defaultLabel(this._name!))}</div><div class="fi-in-entry-content-col"><div class="fi-in-entry-content-ctn" role="definition"><div class="fi-in-entry-content">${content}</div></div></div></div>`;
        return `<div class="fi-in-entry"><div class="fi-in-entry-label-col"><div class="fi-in-entry-label-ctn"><div class="fi-in-entry-label" role="term">${e(this._label ?? defaultLabel(this._name!))}</div></div></div><div class="fi-in-entry-content-col"><div class="fi-in-entry-content-ctn" role="definition"><div class="fi-in-entry-content">${content}</div></div></div></div>`;
    }
}

/** Texte en lecture seule (port partiel de TextEntry) : pastille, couleur, icône, montant, date, texte de remplacement. */
let htmlSanitizer: ((html: string) => string) | null = null;
const TIGHT_ITEM = new RegExp('<li><p>((?:(?!</?p>|</?li>)[^])*)</p></li>', 'g');

/** Filtre appliqué au HTML qu'une entrée affiche tel quel (`markdown()`). Sans filtre, le contenu est échappé. */
export const useHtmlSanitizer = (sanitizer: ((html: string) => string) | null) => { htmlSanitizer = sanitizer; };

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
    /** Mise en forme typographique du contenu (`fi-prose`). */
    prose(condition = true): this { this._prose = condition; return this; }
    /**
     * Le contenu est du texte enrichi : il est rendu en HTML après nettoyage par le filtre posé avec `useHtmlSanitizer()`.
     * Port partiel de `markdown()` : le HTML déjà présent est conservé (nettoyé), le texte brut devient des paragraphes ; la syntaxe Markdown n'est pas convertie.
     */
    markdown(condition = true): this { this._markdown = condition; return this; }
    private _copyable = false;
    private _numeric = false;
    /** Un clic copie la valeur dans le presse-papiers. */
    copyable(condition = true): this { this._copyable = condition; return this; }
    /** Nombre formaté (séparateurs de milliers), aligné comme un nombre. */
    numeric(condition = true): this { this._numeric = condition; return this; }
    async toHtml(): Promise<string> {
        const record = this.context().record as any;
        const state = await this.getState();
        const empty = state === null || state === undefined || state === '';
        if (empty && this._placeholder !== null) return this.wrap(`<div class="fi-in-text"><p class="fi-in-placeholder">${e(this._placeholder)}</p></div>`);
        // Valeur vide : conteneur nu (avec `fi-numeric` pour un montant), comme Filament.
        if (empty) return this._state || (!this._money && !this._date && !this._badge) ? this.wrap('<div class="fi-in-text-item fi-size-sm fi-in-text fi-wrapped"></div>') : this.wrap(`<div class="${['fi-in-text', this._money || this._numeric ? 'fi-numeric' : null].filter(Boolean).join(' ')}"></div>`);
        let shown = String(state);
        if (this._numeric) shown = new Intl.NumberFormat('en-US').format(Number(state));
        if (this._money) shown = new Intl.NumberFormat('en-US', { style: 'currency', currency: this._money }).format(Number(state));
        if (this._date) shown = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${shown.replace(' ', 'T').slice(0, 19)}Z`));
        // `dateTime()` : « M j, Y H:i:s », le format par défaut de Filament.
        if (this._dateTime) shown = `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${shown.replace(' ', 'T').slice(0, 19)}Z`))} ${shown.slice(11, 19)}`;
        // `time('H:i')` ou `time()` (« H:i:s ») : l'heure d'une valeur `H:i:s` ou `Y-m-d H:i:s`.
        if (this._time) shown = (shown.length > 8 ? shown.slice(11, 19) : shown).slice(0, this._time === 'H:i' ? 5 : 8);
        if (this._format) shown = this._format({ state, record });
        if (this._suffix !== null) shown += this._suffix;
        if (this._markdown) {
            const source = String(state);
            const html = /<[a-z][^>]*>/i.test(source)
                // Listes « serrées », comme le rendu Markdown de Filament : le paragraphe unique d'une puce est retiré.
                ? (htmlSanitizer ? htmlSanitizer(source).replace(TIGHT_ITEM, '<li>$1</li>') : e(source))
                : source.split(/\n{2,}/).map((paragraph) => `<p>${e(paragraph.trim()).replace(/\n/g, '<br />')}</p>`).join('');
            return this.wrap(`<div class="${['fi-in-text-item', this._prose ? 'fi-prose' : null, 'fi-size-sm', 'fi-in-text', 'fi-wrapped'].filter(Boolean).join(' ')}">${html}</div>`);
        }
        if (this._badge && Array.isArray(state)) {
            // Plusieurs valeurs : une liste de pastilles (étiquettes, par exemple).
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

/** Pastille de couleur (port de ColorEntry) : seules les couleurs hexadécimales ou fonctionnelles simples sont injectées dans le style. */
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

/** Image en lecture seule (port de ImageEntry) : seules une adresse du site (`/…`) ou une adresse http(s) sont affichées. */
export class ImageEntry extends Entry {
    private _height = '8rem';
    private _alt: string | null = null;
    private _circular = false;
    static make(name: string): ImageEntry { return configured(new ImageEntry(name)); }
    /** Hauteur CSS de l'image (`8rem` par défaut, comme Filament). */
    imageHeight(height: string): this { if (/^[0-9.]+(rem|px|em)$/.test(height)) this._height = height; return this; }
    alt(text: string | null): this { this._alt = text; return this; }
    circular(condition = true): this { this._circular = condition; return this; }
    async toHtml(): Promise<string> {
        const state = await this.getState();
        const sources = (Array.isArray(state) ? state : [state]).filter((src): src is string => typeof src === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(src));
        return this.wrap(`<div class="fi-in-image fi-wrapped">${sources.map((src) => `<img alt="${e(this._alt ?? '')}" src="${e(src)}" style="height: ${this._height};"${this._circular ? ' class="fi-circular"' : ''} />`).join('')}</div>`);
    }
}

/** Icône selon la valeur ; `boolean()` affiche une coche verte ou une croix rouge (port partiel de IconEntry). */
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

/** Paires clé / valeur en table (port de KeyValueEntry) : l'état est un objet (ou sa forme JSON) ; une valeur non scalaire est montrée en JSON. */
export class KeyValueEntry extends Entry {
    private _keyLabel: string | null = null;
    private _valueLabel: string | null = null;
    private _placeholder: string | null = null;
    static make(name: string): KeyValueEntry { return configured(new KeyValueEntry(name)); }
    keyLabel(label: string | null): this { this._keyLabel = label; return this; }
    valueLabel(label: string | null): this { this._valueLabel = label; return this; }
    /** Texte affiché sans aucune paire (« No entries » par défaut). */
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** @deprecated Utilisez `placeholder()`. */
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

/** `json_encode($value, JSON_PRETTY_PRINT)` de PHP : quatre espaces, `/` et caractères non ASCII échappés. */
const phpPrettyJson = (value: unknown): string => (JSON.stringify(value, null, 4) ?? 'null').replace(/\//g, '\\/').replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
/** Couleurs de fond et de texte des thèmes par défaut de Phiki (github-light / github-dark-high-contrast). */
const PHIKI_DEFAULT_STYLE = 'background-color: #fff;color: #24292e;--phiki-dark-background-color: #0a0c10;--phiki-dark-color: #f0f3f6;';
/**
 * Code en lecture seule (port de CodeEntry). Même balisage `<pre class="phiki …">` que Filament, mais SANS coloration syntaxique :
 * le surligneur Phiki n'est pas porté, chaque ligne est un seul jeton de texte échappé. Un tableau ou un objet est montré en JSON indenté.
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
    /** Langage (`php`, `json`, `javascript`…) : nom donné à la classe `language-…` ; `html` par défaut, `json` pour un tableau. */
    grammar(grammar: string | null): this { this._grammar = grammar; return this; }
    /** Thèmes (noms de classes seulement : sans Phiki, les couleurs restent celles des thèmes par défaut). */
    lightTheme(theme: string | null): this { this._lightTheme = theme; return this; }
    darkTheme(theme: string | null): this { this._darkTheme = theme; return this; }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** Un clic copie le code dans le presse-papiers. */
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
        // Phiki : une ligne par `<span class="line">`, le saut de ligne étant le dernier jeton de chaque ligne.
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
 * Entrée au rendu libre (port de ViewEntry) : la fonction fournie reçoit l'état, l'enregistrement et le contexte, et rend le contenu
 * placé dans l'enveloppe d'entrée. Ce HTML est inséré TEL QUEL : échappez toute valeur venue d'un utilisateur ou de la base avec `e()`.
 */
export class ViewEntry extends Entry {
    private _view: ((ctx: ComponentContext & { state: unknown; entry: ViewEntry }) => string | Promise<string>) | null = null;
    private _wrapped = true;
    static make(name: string): ViewEntry { return configured(new ViewEntry(name)); }
    /** Fonction de rendu du contenu (équivalent de la vue Blade de Filament). */
    view(renderer: ((ctx: ComponentContext & { state: unknown; entry: ViewEntry }) => string | Promise<string>) | null): this { this._view = renderer; return this; }
    /** `false` : la fonction rend toute l'entrée, sans l'enveloppe (libellé) habituelle. */
    wrapped(condition = true): this { this._wrapped = condition; return this; }
    async toHtml(): Promise<string> {
        if (!this._view) throw new Error(`ViewEntry [${this._name}] : view() est requis.`);
        const html = await this._view({ ...this.context(), state: await this.getState(), entry: this });
        return this._wrapped ? this.wrap(html) : html;
    }
}

/** En-tête de colonne d'une entrée répétée en table (même forme que `TableColumn` de @navette-js/forms). */
export type RepeatableColumn = { label: string; getWidth(): string | null };

/**
 * Liste d'éléments en lecture seule (port partiel de RepeatableEntry, en mode table) : une ligne par élément du tableau lu dans
 * l'enregistrement, une cellule par entrée du schéma.
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
