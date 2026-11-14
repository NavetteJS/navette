// @navette-js/support — shared building blocks: escaping, attribute bags, JS serialization, lazy evaluation, colors, icons,
// namespaced EJS views.
import { AsyncLocalStorage } from 'node:async_hooks';
import { camel, compileComponentTags, isHtmlAttribute } from './components.ts';
import { cspNonceAttribute } from './csp.ts';
import ejs from 'ejs';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ escaping
/** Escapes `&`, `<`, `>`, `"` and `'` for HTML. */
export function e(value: unknown): string {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/** Trusted HTML string: views do not escape it again. */
export class HtmlString {
    html: string;
    constructor(html: string) { this.html = html; }
    toString(): string { return this.html; }
}
export const raw = (html: string) => new HtmlString(html);

// ------------------------------------------------------------------ JS serialization
// Quotes, `<`, `>` and `&` are written as `\uXXXX` so the output is safe inside HTML attributes and `<script>`.
const BS = String.fromCharCode(92);
const HEX: Record<string, string> = { '"': 'u0022', "'": 'u0027', '<': 'u003C', '>': 'u003E', '&': 'u0026', '/': '/' };
function phpString(value: string): string {
    let out = '';
    for (const ch of value) {
        if (ch in HEX) out += BS + HEX[ch];
        else if (ch === BS) out += BS + BS;
        else if (ch < ' ') out += JSON.stringify(ch).slice(1, -1);
        else out += ch;
    }
    return out;
}
/** JSON where `'`, `"`, `<`, `>` and `&` inside strings become `\uXXXX` (structural quotes are kept) and `/` is escaped. */
function phpJson(value: unknown): string {
    const json = JSON.stringify(value);
    const HEX: Record<string, string> = { "'": BS + 'u0027', '<': BS + 'u003C', '>': BS + 'u003E', '&': BS + 'u0026', '/': BS + '/' };
    let out = '';
    for (let i = 0; i < json.length; i++) {
        const c = json[i];
        if (c === BS) { const next = json[++i]; out += next === '"' ? BS + 'u0022' : BS + next; continue; }
        out += HEX[c] ?? c;
    }
    return out;
}
/** Serializes a value into a JavaScript expression that is safe to embed in HTML. */
export function js(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return "'" + phpString(value) + "'";
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return "JSON.parse('" + phpString(phpJson(value)) + "')";
}

// ------------------------------------------------------------------ conditional classes
export type ClassList = (string | false | null | undefined | Record<string, unknown>)[] | Record<string, unknown>;
export function cls(list: ClassList): string {
    const out: string[] = [];
    const items = Array.isArray(list) ? list : [list];
    for (const item of items) {
        if (!item) continue;
        if (typeof item === 'string') out.push(item);
        else for (const [k, on] of Object.entries(item)) if (on) out.push(k);
    }
    return out.join(' ');
}

// ------------------------------------------------------------------ attribute bag
export type AttrValue = string | number | boolean | null | undefined;
export class Attributes {
    private map = new Map<string, AttrValue>();
    constructor(initial: Record<string, AttrValue> = {}) { for (const [k, v] of Object.entries(initial)) this.map.set(k, v); }

    get(key: string): AttrValue { return this.map.get(key); }
    has(key: string): boolean { return this.map.has(key); }

    /** Defaults come first, then existing attributes (`class` and `style` are concatenated); null/false defaults are skipped. */
    merge(defaults: Record<string, AttrValue>): Attributes {
        const out = new Attributes();
        for (const [k, v] of Object.entries(defaults)) {
            if (v === null || v === undefined || v === false) continue;
            out.map.set(k, v);
        }
        for (const [k, v] of this.map) {
            const merged = (k === 'class' || k === 'style') && out.map.has(k) ? [out.map.get(k), v].filter((x) => x !== '' && x != null).join(' ') : v;
            out.map.delete(k);
            out.map.set(k, merged);
        }
        return out;
    }
    /** Adds (or replaces) an attribute at the end. */
    set(key: string, value: AttrValue): Attributes { const out = this.clone(); out.map.delete(key); out.map.set(key, value); return out; }
    private clone(): Attributes { const out = new Attributes(); for (const [k, v] of this.map) out.map.set(k, v); return out; }
    /** Appends classes after the existing ones; the attribute keeps its position, or goes last. */
    class(list: ClassList): Attributes {
        const out = this.clone();
        out.map.set('class', [out.map.get('class'), cls(list)].filter((x) => x !== '' && x != null).join(' '));
        return out;
    }
    style(list: (string | false | null | undefined)[]): Attributes {
        const added = list.filter(Boolean).join('; ');
        if (!added) return this;
        const out = this.clone();
        const existing = String(out.map.get('style') ?? '').replace(/;+$/, '');
        out.map.set('style', [existing, added].filter(Boolean).join('; ') + ';');
        return out;
    }
    when(condition: unknown, fn: (a: Attributes) => Attributes): Attributes { return condition ? fn(this) : this; }

    /** Grid container: `nv-grid` classes and `--cols-*` variables per breakpoint. */
    grid(columns: Record<string, number> | number | null = {}): Attributes {
        const cols: Record<string, number> = typeof columns === 'number' ? { lg: columns } : { ...(columns ?? {}) };
        for (const k of Object.keys(cols)) if (!cols[k]) delete cols[k];
        cols.default ??= 1;
        const v = (bp: string) => bp.replace(/@/g, 'c').replace(/!/g, 'n');
        return this
            .class(['nv-grid', ...Object.keys(cols).map((bp) => (bp === 'default' ? (cols[bp] > 1 ? 'nv-grid-cols' : '') : `${bp}:nv-grid-cols`))])
            .style(Object.entries(cols).map(([bp, n]) => `--cols-${v(bp)}: repeat(${n}, minmax(0, 1fr))`));
    }
    /** Grid column: `nv-grid-col` classes and `--col-span-*` variables per breakpoint. */
    gridColumn(span: Record<string, number | string> | number | string | null = {}, isHidden = false): Attributes {
        const s: Record<string, number | string> = span !== null && typeof span === 'object' ? { ...span } : span ? { lg: span } : {};
        for (const k of Object.keys(s)) if (!s[k]) delete s[k];
        const v = (bp: string) => bp.replace(/@/g, 'c').replace(/!/g, 'n');
        return this
            .class(['nv-grid-col', { 'nv-hidden': isHidden || s.default === 'hidden' }, ...Object.keys(s).map((bp) => (bp === 'default' ? '' : `${bp}:nv-grid-col-span`))])
            .style(Object.entries(s).map(([bp, n]) => `--col-span-${v(bp)}: ${n === 'full' ? '1 / -1' : `span ${n} / span ${n}`}`));
    }

    /** Renders `key="value"` pairs; `true` becomes `key="key"` (or `""` for x-data and wire:*). Values are not escaped again, except `"`. */
    toHtml(): string {
        const parts: string[] = [];
        for (const [k, v] of this.map) {
            if (v === false || v === null || v === undefined) continue;
            const value = v === true ? (k === 'x-data' || k.startsWith('wire:') ? '' : k) : String(v);
            parts.push(`${k}="${value.replace(/"/g, '&quot;')}"`);
        }
        return parts.join(' ');
    }
    toString(): string { return this.toHtml(); }
}
export const attrs = (initial: Record<string, AttrValue> = {}) => new Attributes(initial);

// ------------------------------------------------------------------ lazy evaluation
export type Lazy<T, C = any> = T | ((ctx: C) => T | Promise<T>);
export async function evaluate<T, C>(value: Lazy<T, C>, ctx: C): Promise<T> {
    return typeof value === 'function' ? await (value as (ctx: C) => T | Promise<T>)(ctx) : value;
}

// ------------------------------------------------------------------ colors
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export type Palette = Record<number, string>;
export const Color: Record<string, Palette> = JSON.parse(readFileSync(here('../data/palettes.json'), 'utf8'));
export const WCAG_AA_TEXT = 4.5;

/** Converts `#rrggbb`, `rgb(r, g, b)` or `r, g, b` to `oklch(L C h)`, rounded to three decimals. */
export function convertToOklch(color: string): string {
    if (color.startsWith('oklch(')) return color;
    const compact = color.replace(/\s+/g, '');
    const [r, g, b] = (compact.startsWith('#') ? convertToRgb(compact) : compact.replace(/^rgb\(|\)$/g, '').split(',').map(Number)).map((channel) => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    if (![r, g, b].every(Number.isFinite)) throw new Error(`Unsupported color: ${color}`);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    let hue = (Math.atan2(bb, a) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    const round = (n: number) => String(Math.round(n * 1000) / 1000);
    return `oklch(${round(lightness)} ${round(Math.sqrt(a * a + bb * bb))} ${round(hue)})`;
}
/** Lightness and chroma of each shade of a generated palette. */
const GENERATED_SHADES: [number, string, string][] = [
    [50, '0.97717647058824', '0.01395454545455'], [100, '0.95035294117647', '0.03272727272727'], [200, '0.90547058823529', '0.06318181818182'],
    [300, '0.84047058823529', '0.10604545454546'], [400, '0.75352941176471', '0.15027272727273'], [500, '0.68270588235294', '0.17009090909091'],
    [600, '0.59782352941176', '0.16913636363636'], [700, '0.51494117647059', '0.14940909090909'], [800, '0.44611764705882', '0.12331818181818'],
    [900, '0.39458823529412', '0.09963636363636'], [950, '0.27788235294118', '0.07136363636364'],
];
/** Builds an eleven-shade palette from a single color, keeping its hue. */
export function generatePalette(color: string): Palette {
    const [, , chroma, hue] = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(convertToOklch(color))!.map(Number);
    const achromatic = chroma < 0.03;
    return Object.fromEntries(GENERATED_SHADES.map(([shade, lightness, saturation]) => [shade, `oklch(${lightness} ${achromatic ? '0' : saturation} ${hue})`])) as Palette;
}
/** A ready-made palette, or a color (`#6366f1`, `rgb(…)`) from which a palette is generated. */
export type ColorInput = Palette | string;
const toPalette = (color: ColorInput): Palette => (typeof color === 'string' ? generatePalette(color) : color);

export function convertToRgb(color: string): [number, number, number] {
    const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color);
    if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
    if (color.startsWith('#')) {
        const hex = color.length === 4 ? color.replace(/[0-9a-f]/gi, (c) => c + c) : color;
        return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
    }
    const m = /^oklch\(([\d.]+)\s+([\d.]+)(?:\s+([\d.]+))?\)/.exec(color);
    if (!m) throw new Error(`Unsupported color: ${color}`);
    const L = +m[1], C = +m[2], h = ((+m[3] || 0) * Math.PI) / 180;
    const a = C * Math.cos(h), b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, md = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [4.0767416621 * l - 3.3077115913 * md + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * md - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * md + 1.707614701 * s];
    return lin.map((x) => Math.max(0, Math.min(255, Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255)))) as [number, number, number];
}
/** Contrast ratio with luminance approximated by a 2.2 gamma (intentionally not the exact WCAG formula; shade choices depend on it). */
export function calculateContrastRatio(c1: string, c2: string): number {
    const lum = (c: string) => { const [r, g, b] = convertToRgb(c); return 0.2126 * (r / 255) ** 2.2 + 0.7152 * (g / 255) ** 2.2 + 0.0722 * (b / 255) ** 2.2; };
    const a = lum(c1), b = lum(c2);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function isLight(color: string): boolean {
    const m = /^oklch\(([\d.]+)/.exec(color);
    if (!m) throw new Error(`isLight: only oklch colors are supported (${color})`);
    return +m[1] >= 0.65;
}

/** Picks accessible background and text shades for a filled button (the default `ButtonComponentColorMap` candidates). */
export function buttonColorMap(palette: Palette, minRatio = WCAG_AA_TEXT): Record<string, number> {
    return ButtonComponentColorMap.make(palette).minContrastRatio(minRatio).lightBackground(600, 500).lightBackground(400, 300, 500).darkBackground(600, 500, 700).get();
}

/** First shade of the palette with enough contrast against a surface. */
export function findShade(palette: Palette, surface: string, options: { minRatio?: number; maxShade?: number; minShade?: number; fromDarkest?: boolean } = {}): number | null {
    const shades = Object.keys(palette).map(Number).sort((a, b) => (options.fromDarkest ? b - a : a - b));
    for (const shade of shades) {
        if (options.maxShade !== undefined && shade > options.maxShade) continue;
        if (options.minShade !== undefined && shade < options.minShade) continue;
        if (calculateContrastRatio(surface, palette[shade]) >= (options.minRatio ?? WCAG_AA_TEXT)) return shade;
    }
    return null;
}
/** Color map of badges. */
export function badgeColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { text: findShade(palette, palette[50]) ?? 900, 'dark:text': findShade(palette, gray[600], { maxShade: 500, fromDarkest: true }) ?? 200 };
}
/** Color map of dropdown items. */
export function dropdownItemColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return {
        text: findShade(palette, 'oklch(1 0 0)', { minShade: 600 }) ?? 950,
        'hover:text': findShade(palette, palette[50], { minShade: 600 }) ?? 950,
        'dark:text': findShade(palette, gray[900], { maxShade: 400, fromDarkest: true }) ?? 200,
        'dark:hover:text': findShade(palette, palette[950], { maxShade: 400, fromDarkest: true }) ?? 100,
    };
}
/** Color map of icon columns (non-text contrast, 3:1). */
export function iconColumnColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { text: findShade(palette, 'oklch(1 0 0)', { minRatio: 3 }) ?? 900, 'dark:text': findShade(palette, gray[800], { minRatio: 3, maxShade: 600, fromDarkest: true }) ?? 200 };
}
/** Color map of icon buttons (non-text contrast 3:1 on gray-50 / gray-700). */
export function iconButtonColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return IconButtonComponentColorMap.make(palette).lightSurface(gray[50]).darkSurface(gray[700]).darkMaxShade(500).get();
}
/** Color map of toggles (non-text contrast, 3:1). */
export function toggleColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { bg: findShade(palette, gray[50], { minRatio: 3 }) ?? 900, text: findShade(palette, 'oklch(1 0 0)', { minRatio: 3 }) ?? 900, 'dark:bg': findShade(palette, gray[700], { minRatio: 3, fromDarkest: true }) ?? 200 };
}
export function linkColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { text: findShade(palette, gray[50]) ?? 900, 'dark:text': findShade(palette, gray[700], { maxShade: 400, fromDarkest: true }) ?? 200 };
}

/** Outlined button: only the text color depends on the palette. */
export function outlinedButtonColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { text: findShade(palette, gray[50]) ?? 900, 'dark:text': findShade(palette, gray[700], { maxShade: 500, fromDarkest: true }) ?? 200 };
}
/** Color map of each colored component. */
const COMPONENT_COLOR_MAPS = {
    button: (palette: Palette) => buttonColorMap(palette),
    'button-outlined': outlinedButtonColorMap,
    badge: badgeColorMap,
    link: linkColorMap,
    'dropdown-item': dropdownItemColorMap,
    'icon-column': iconColumnColorMap,
    // Icons of a count summary (non-text contrast, 3:1, on gray-900 in dark mode).
    'icon-count-summary': (palette: Palette, gray: Palette) => ({ text: findShade(palette, 'oklch(1 0 0)', { minRatio: 3 }) ?? 900, 'dark:text': findShade(palette, gray[900], { minRatio: 3, fromDarkest: true }) ?? 200 }),
    'icon-button': iconButtonColorMap,
    toggle: toggleColorMap,
    // Stat description and stat chart (the chart only gets `nv-color`).
    'stat-description': (palette: Palette, gray: Palette) => ({ text: findShade(palette, 'oklch(1 0 0)', { minShade: 600 }) ?? 950, 'dark:text': findShade(palette, gray[900], { maxShade: 400, fromDarkest: true }) ?? 200 }),
    'stat-chart': () => ({}),
    // Colored text of a column or entry: fixed 500 / 400 for gray, otherwise the same contrast search as stat descriptions.
    text: (palette: Palette, gray: Palette) => (palette === gray ? { text: 500, 'dark:text': 400 } : { text: findShade(palette, 'oklch(1 0 0)', { minShade: 600 }) ?? 950, 'dark:text': findShade(palette, gray[900], { maxShade: 400, fromDarkest: true }) ?? 50 }),
} satisfies Record<string, (palette: Palette, gray: Palette) => Record<string, number>>;
export type ColoredComponent = keyof typeof COMPONENT_COLOR_MAPS;
/** Computes the color map of a component, given its palette (see `ColorManager.overrideColorMap()`). */
export type ColorMapResolver = (palette: Palette, context: { gray: Palette; color: string; getDefault: () => Record<string, number> }) => Record<string, number>;

const CLASS_FOR: Record<string, (s: number) => string> = {
    bg: (s) => `nv-bg-color-${s}`, 'hover:bg': (s) => `hover:nv-bg-color-${s}`, 'dark:bg': (s) => `dark:nv-bg-color-${s}`, 'dark:hover:bg': (s) => `dark:hover:nv-bg-color-${s}`,
    text: (s) => `nv-text-color-${s}`, 'hover:text': (s) => `hover:nv-text-color-${s}`, 'dark:text': (s) => `dark:nv-text-color-${s}`, 'dark:hover:text': (s) => `dark:hover:nv-text-color-${s}`,
};
import { ButtonComponentColorMap, IconButtonComponentColorMap } from './color-maps.ts';
export { ButtonComponentColorMap, ComponentColorMap, IconButtonComponentColorMap, WCAG_AA_NON_TEXT, WCAG_AAA_TEXT, type ColorMap, type ColorMapSlotOptions } from './color-maps.ts';
/** Registers named palettes and computes the color classes of components. */
export class ColorManager {
    static DEFAULT_COLORS: Record<string, Palette> = { danger: Color.Red, gray: Color.Zinc, info: Color.Blue, primary: Color.Amber, success: Color.Green, warning: Color.Amber };
    private colors: Record<string, Palette> = { ...ColorManager.DEFAULT_COLORS };
    private static colorMapOverrides = new Map<string, ColorMapResolver>();
    /** Bumped by `overrideColorMap()`: the class caches of every color manager are keyed by it. */
    private static colorMapGeneration = 0;
    /**
     * Replaces the shade selection of a component, for every panel. `null` restores the default. The resolver receives the palette,
     * the gray palette, the color name and the default map, and returns slots (`bg`, `text`, `dark:hover:text`…) mapped to shades.
     */
    static overrideColorMap(component: ColoredComponent, resolver: ColorMapResolver | null): void {
        if (!(component in COMPONENT_COLOR_MAPS)) throw new Error(`Unknown colored component [${component}].`);
        if (resolver) ColorManager.colorMapOverrides.set(component, resolver); else ColorManager.colorMapOverrides.delete(component);
        ColorManager.colorMapGeneration++;
    }
    /** Color map of a component for a palette: the override of `overrideColorMap()`, or the default one. */
    static getColorMap(component: ColoredComponent, palette: Palette, gray: Palette, color = ''): Record<string, number> {
        const getDefault = () => COMPONENT_COLOR_MAPS[component](palette, gray);
        const override = ColorManager.colorMapOverrides.get(component);
        if (!override) return getDefault();
        const map = override(palette, { gray, color, getDefault });
        for (const [key, shade] of Object.entries(map ?? {})) {
            if (!CLASS_FOR[key]) throw new Error(`Invalid color mapping key [${key}].`);
            if (!Number.isInteger(shade) || shade < 0 || shade > 1000) throw new Error(`Invalid shade [${shade}] for the color mapping key [${key}].`);
        }
        return map ?? {};
    }
    private cache = new Map<string, string[]>();
    /** Per-request colors (theme picked by the user); they take precedence over the panel's colors. */
    private scope = new AsyncLocalStorage<{ key: string; colors: Record<string, Palette> }>();

    register(colors: Record<string, ColorInput>): this { for (const [name, color] of Object.entries(colors)) this.colors[name] = toPalette(color); this.cache.clear(); return this; }
    /** Runs `fn` with colors that only apply to this request; `key` identifies the color set for caching. */
    runWith<T>(key: string, colors: Record<string, ColorInput>, fn: () => T): T {
        return this.scope.run({ key, colors: Object.fromEntries(Object.entries(colors).map(([name, color]) => [name, toPalette(color)])) }, fn);
    }
    getColors(): Record<string, Palette> { return { ...this.colors, ...(this.scope.getStore()?.colors ?? {}) }; }
    getColor(name: string): Palette | undefined { return this.scope.getStore()?.colors[name] ?? this.colors[name]; }

    /** Color classes of a colored component. */
    getComponentClasses(component: ColoredComponent, color: string | null): string[] {
        if (!color) return [];
        const key = `${ColorManager.colorMapGeneration}:${this.scope.getStore()?.key ?? ''}:${component}:${color}`;
        const hit = this.cache.get(key);
        if (hit) return hit;
        let classes: string[] = [];
        // Gray is the button's default color and gets no color classes; other components still get them.
        if (color !== 'gray' || component !== 'button') {
            classes = ['nv-color', 'nv-color-' + color.replace(/[^a-zA-Z0-9_-]/g, '')];
            const palette = this.getColor(color);
            if (palette) {
                const gray = this.getColor('gray')!;
                const map = ColorManager.getColorMap(component, palette, gray, color);
                classes.push(...Object.entries(map).map(([k, shade]) => CLASS_FOR[k](shade)));
            }
        }
        this.cache.set(key, classes);
        return classes;
    }
    /**
     * `<style>` block defining the `--<color>-<shade>` variables, injected into `<head>`. A color registered under a new name
     * (`brand`) also gets the rule mapping `nv-color-brand` to the component color variables (`--color-50: var(--brand-50)`…):
     * the stylesheet only has these rules for the default colors.
     */
    renderCssVariables(): string {
        const colors = this.getColors();
        const vars = Object.entries(colors).map(([name, palette]) => Object.entries(palette).map(([shade, value]) => ` --${name}-${shade}:${value}; `).join('')).join('');
        return `<style${cspNonceAttribute()}>\n    :root {\n        ${vars}}\n${this.renderCustomColorRules(colors)}</style>`;
    }
    /** `.nv-color-<name> { --color-<shade>: var(--<name>-<shade>); … }` for each registered color that is not a default one. */
    renderCustomColorRules(colors: Record<string, Palette> = this.getColors()): string {
        return Object.entries(colors)
            .filter(([name]) => !Object.hasOwn(ColorManager.DEFAULT_COLORS, name) && /^[a-zA-Z0-9_-]+$/.test(name))
            .map(([name, palette]) => `    .nv-color-${name} { ${Object.keys(palette).filter((shade) => /^\d+$/.test(shade)).map((shade) => `--color-${shade}:var(--${name}-${shade});`).join(' ')} }\n`)
            .join('');
    }
}

// ------------------------------------------------------------------ icons
/** An icon: a name (`m-eye`, `lucide:house`, a name given to `registerIcon()`), or HTML rendered inside a `nv-icon` span. */
export type IconValue = string | HtmlString;
/** Resolves the name of an icon of a set (`house` for `lucide:house`) to a full `<svg>`; `null` or `undefined`: unknown icon. */
export type IconSetResolver = (name: string) => string | null | undefined;
/** Icon of an Iconify JSON set (`@iconify-json/*` packages). */
export type IconifyIcon = { body: string; width?: number; height?: number; left?: number; top?: number; rotate?: number; hFlip?: boolean; vFlip?: boolean };
/** Iconify JSON set: the `icons.json` file of an `@iconify-json/*` package. */
export type IconifyJson = {
    prefix: string; icons: Record<string, IconifyIcon>; width?: number; height?: number; left?: number; top?: number;
    aliases?: Record<string, Partial<IconifyIcon> & { parent: string }>;
};

const iconCache = new Map<string, string>();
const iconAliases = new Map<string, string>();
const iconAliasHtml = new Map<string, string>();
const iconSets = new Map<string, IconSetResolver>();
const ICON_SET_PREFIX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ICON_SET_NAME = /^[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*$/;

// Alternative spellings of some icon aliases: both resolve to the same icon.
const RICH_EDITOR_TOOLS = 'align-center align-end align-justify align-start attach-files blockquote bold bullet-list clear_formatting code code-block custom-blocks details grid grid_add_column_after grid_add_column_before grid_delete grid_delete_column h1 h2 h3 h4 h5 h6 highlight horizontal-rule italic lead link merge-tags ordered-list paragraph redo small strike subscript superscript table table_add_column_after table_add_column_before table_add_row_after table_add_row_before table_delete table_delete_column table_delete_row table_merge_cells table_split_cell table_toggle_header_cell table_toggle_header_row text-color underline undo'.split(' ');
const ALIAS_SPELLINGS: Record<string, string> = {
    ...Object.fromEntries(RICH_EDITOR_TOOLS.map((tool) => [`forms::components.rich-editor.toolbar.${tool.replace(/_/g, '-')}`, `forms:components.rich-editor.toolbar.${tool}`])),
    ...Object.fromEntries(['callout.danger', 'callout.info', 'callout.success', 'callout.warning', 'tabs.dropdown-trigger-button', 'tabs.more-tabs-button', 'wizard.completed-step'].map((key) => [`schemas::components.${key}`, `schema::components.${key}`])),
    ...Object.fromEntries(['boolean', 'date', 'number', 'relationship', 'select', 'text'].map((key) => [`tables::filters.query-builder.constraints.${key}`, `query-builder::constraints.${key}`])),
};
const normalizeIconAlias = (alias: string) => ALIAS_SPELLINGS[alias] ?? alias;

/**
 * `<svg>` of an Iconify icon, aliases and their flips and rotations included. The transformations are adapted from
 * `iconToSVG()` of `@iconify/utils`, © Vjacheslav Trushkin, MIT license (`icons/ICONIFY-UTILS-LICENSE.md`).
 */
export function iconifyToSvg(set: IconifyJson, name: string): string | null {
    let current = name;
    let hFlip = false, vFlip = false, rotate = 0;
    let size: Partial<IconifyIcon> = {};
    for (let depth = 0; !Object.prototype.hasOwnProperty.call(set.icons, current); depth++) {
        const alias = set.aliases && Object.prototype.hasOwnProperty.call(set.aliases, current) ? set.aliases[current] : null;
        if (!alias || depth > 32) return null;
        if (alias.hFlip) hFlip = !hFlip;
        if (alias.vFlip) vFlip = !vFlip;
        rotate += alias.rotate ?? 0;
        size = { width: alias.width, height: alias.height, left: alias.left, top: alias.top, ...Object.fromEntries(Object.entries(size).filter(([, v]) => v !== undefined)) };
        current = alias.parent;
    }
    const data = set.icons[current];
    if (!data || typeof data.body !== 'string') return null;
    const number = (...values: unknown[]) => values.find((v): v is number => typeof v === 'number' && Number.isFinite(v));
    let left = number(size.left, data.left, set.left) ?? 0, top = number(size.top, data.top, set.top) ?? 0;
    let width = number(size.width, data.width, set.width) ?? 16, height = number(size.height, data.height, set.height) ?? 16;
    if (data.hFlip) hFlip = !hFlip;
    if (data.vFlip) vFlip = !vFlip;
    rotate += data.rotate ?? 0;
    const transforms: string[] = [];
    if (hFlip) {
        if (vFlip) rotate += 2;
        else { transforms.push(`translate(${width + left} ${-top})`, 'scale(-1 1)'); top = left = 0; }
    } else if (vFlip) {
        transforms.push(`translate(${-left} ${height + top})`, 'scale(1 -1)'); top = left = 0;
    }
    rotate = ((rotate % 4) + 4) % 4;
    if (rotate === 1) transforms.unshift(`rotate(90 ${height / 2 + top} ${height / 2 + top})`);
    else if (rotate === 2) transforms.unshift(`rotate(180 ${width / 2 + left} ${height / 2 + top})`);
    else if (rotate === 3) transforms.unshift(`rotate(-90 ${width / 2 + left} ${width / 2 + left})`);
    if (rotate % 2 === 1) { [left, top] = [top, left]; [width, height] = [height, width]; }
    const body = transforms.length ? `<g transform="${transforms.join(' ')}">${data.body}</g>` : data.body;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" aria-hidden="true" data-slot="icon">${body}</svg>`;
}

/** Reads the `icons.json` of an installed Iconify package: `@iconify-json/lucide`, or `lucide` for short. */
function loadIconifyPackage(name: string): IconifyJson {
    const pkg = name.includes('/') ? name : `@iconify-json/${name}`;
    if (!/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(pkg)) throw new Error(`Invalid Iconify package name: ${name}`);
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    return JSON.parse(readFileSync(require.resolve(`${pkg}/icons.json`), 'utf8'));
}

/**
 * Icon registry:
 * - `alias()` replaces an icon of the interface by its alias (`panels::sidebar.collapse-button`),
 * - `registerSet()` and `registerIconify()` add other icon sets, used as `prefix:name` (`lucide:house`),
 * - `register()` adds a single icon.
 * The SVG of registered icons and sets is inserted as is: it is trusted application input, never user input.
 */
export const icons = {
    /**
     * Replaces interface icons: `{ alias: icon }`, the icon being a name (`o-chevron-left`, `lucide:panel-left-close`)
     * or HTML (`new HtmlString('<svg…>')`); `null` removes the replacement.
     */
    alias(map: Record<string, IconValue | null>): void {
        for (const [key, value] of Object.entries(map)) {
            const alias = normalizeIconAlias(key);
            iconAliasHtml.delete(`@${alias}`);
            if (value === null || value === undefined) { iconAliases.delete(alias); continue; }
            if (value instanceof HtmlString) {
                iconAliasHtml.set(`@${alias}`, value.html);
                iconAliases.set(alias, `@${alias}`);
            } else if (typeof value === 'string' && value !== '') iconAliases.set(alias, value);
            else throw new Error(`icons.alias(${key}) expects an icon name or an HtmlString.`);
        }
    },
    /** Icon registered for the first alias that has one, or `null`. */
    resolve(alias: string | string[]): string | null {
        for (const key of Array.isArray(alias) ? alias : [alias]) {
            const name = iconAliases.get(normalizeIconAlias(key));
            if (name !== undefined) return name;
        }
        return null;
    },
    /** Registers a set of icons used as `prefix:name`: the resolver returns the `<svg>` of a name, or `null`. Names are validated first. */
    registerSet(prefix: string, resolver: IconSetResolver): void {
        if (!ICON_SET_PREFIX.test(prefix)) throw new Error(`Invalid icon set prefix: ${prefix}`);
        if (typeof resolver !== 'function') throw new Error(`icons.registerSet(${prefix}) expects a resolver function.`);
        iconSets.set(prefix, resolver);
        for (const name of iconCache.keys()) if (name.startsWith(`${prefix}:`)) iconCache.delete(name);
    },
    /**
     * Registers an Iconify set: an installed `@iconify-json/*` package (`'lucide'` or `'@iconify-json/lucide'`) or its
     * JSON. Its icons are used as `prefix:name` (`lucide:house`); the prefix is the set's own unless another is given.
     */
    registerIconify(source: string | IconifyJson, options: { prefix?: string } = {}): void {
        const set = typeof source === 'string' ? loadIconifyPackage(source) : source;
        if (!set || typeof set !== 'object' || typeof set.icons !== 'object') throw new Error('icons.registerIconify() expects an Iconify JSON set.');
        const prefix = options.prefix ?? set.prefix;
        this.registerSet(prefix, (name) => iconifyToSvg(set, name));
    },
    /** Registers a single icon (same as `registerIcon()`). */
    register(name: string, svg: string): void { registerIcon(name, svg); },
    /** Whether the name designates an icon that can be rendered (Heroicons, `nv-` icons, registered icons and sets). */
    has(name: string): boolean {
        try { iconSvg(name); return true; } catch { return false; }
    },
};

function iconSvg(name: string): string {
    let svg = iconCache.get(name);
    if (svg !== undefined) return svg;
    if (name.startsWith('@')) throw new Error(`Icon not found: ${name}`);
    const colon = name.indexOf(':');
    if (colon > 0) {
        const prefix = name.slice(0, colon), local = name.slice(colon + 1);
        const resolver = iconSets.get(prefix);
        if (!resolver) throw new Error(`Icon not found: ${name} (no icon set registered for the "${prefix}" prefix)`);
        if (!ICON_SET_NAME.test(local)) throw new Error(`Invalid icon name: ${name}`);
        const resolved = resolver(local);
        if (typeof resolved !== 'string' || !/^<svg[\s>]/.test(resolved.trim())) throw new Error(`Icon not found: ${name}`);
        svg = resolved.trim();
    } else {
        // `nv-o-crop`: the icons of `icons/navette` (MIT, see its LICENSE.md), shipped next to Heroicons.
        const file = name.startsWith('nv-') ? here(`../icons/navette/${name.slice(3).replace(/[^a-z0-9-]/g, '')}.svg`) : here(`../icons/heroicons/${name.replace(/^heroicon-/, '').replace(/[^a-z0-9-]/g, '')}.svg`);
        if (!existsSync(file)) throw new Error(`Icon not found: ${name}`);
        svg = readFileSync(file, 'utf8').trim();
    }
    iconCache.set(name, svg);
    return svg;
}

/**
 * Icon markup with the `nv-icon nv-size-<size>` classes: a Heroicons name (`m-eye`, `o-user`, `s-…`, `c-…`), a Navette
 * icon (`nv-o-crop`), a registered icon, an icon of a registered set (`lucide:house`) or HTML. With `alias`, the icon
 * registered for that alias (`icons.alias()`) replaces the given one.
 */
export function icon(name: IconValue, options: { size?: string; attributes?: Attributes; alias?: string | string[] } = {}): string {
    if (options.alias) name = icons.resolve(options.alias) ?? name;
    const a = (options.attributes ?? new Attributes()).class(['nv-icon', `nv-size-${options.size ?? 'md'}`]);
    const html = name instanceof HtmlString ? name.html : iconAliasHtml.get(name);
    if (html !== undefined) return `<span ${a.toHtml()}>${html}</span>`;
    return iconSvg(name as string).replace(/^<svg/, `<svg ${a.toHtml()}`);
}
/** Registers a non-Heroicons icon (brand logo, custom glyph): a full `<svg>` supplied by the application, never by end users (it is not sanitized). */
export function registerIcon(name: string, svg: string): void {
    if (!/^<svg[\s>]/.test(svg.trim())) throw new Error(`registerIcon(${name}) expects an <svg> element.`);
    iconCache.set(name, svg.trim());
}
/** Renders the loading indicator from its attributes, which already hold the `nv-icon nv-loading-indicator nv-size-*` classes. */
export type LoadingIndicatorRenderer = (attributes: Attributes) => string;
let loadingIndicatorRenderer: LoadingIndicatorRenderer | null = null;
/**
 * Replaces the loading indicator everywhere (buttons, tables, modals, `<x-loading-indicator>`).
 * `null` restores the default spinner.
 */
export function useLoadingIndicator(renderer: LoadingIndicatorRenderer | null): void { loadingIndicatorRenderer = renderer; }
/** Loading spinner SVG (or the indicator given to `useLoadingIndicator()`). */
export function loadingIndicator(attributes: Attributes = new Attributes(), size = 'md'): string {
    const a = attributes.class(['nv-icon nv-loading-indicator', `nv-size-${size}`]);
    if (loadingIndicatorRenderer) return loadingIndicatorRenderer(a);
    return `<svg fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${a.toHtml()}><path clip-rule="evenodd" d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19ZM12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill-rule="evenodd" fill="currentColor" opacity="0.2"></path><path d="M2 12C2 6.47715 6.47715 2 12 2V5C8.13401 5 5 8.13401 5 12H2Z" fill="currentColor"></path></svg>`;
}

// ------------------------------------------------------------------ namespaced, overridable EJS views
/** Renders a component from its props (camelCased, named slots included), its attribute bag and its default slot (HTML). */
export type ComponentRenderer = (props: Record<string, any> & { attributes: Record<string, any> }, slot: string) => string;

/**
 * View registry: `navette-forms::components.text-input` resolves to an EJS file; override directories are checked first.
 * Views may use component tags (`<x-section heading="Orders">…</x-section>`): built-in components, components registered with
 * `component()`, and EJS files of the directories given to `components()`.
 */
export class ViewRegistry {
    private namespaces = new Map<string, string>();
    private overrides: string[] = [];
    private compiled = new Map<string, ejs.TemplateFunction>();
    private compiledAsync = new Map<string, ejs.AsyncTemplateFunction>();
    private shared: Record<string, unknown> = {};
    private componentRenderers = new Map<string, ComponentRenderer>();
    private componentDirectories: string[] = [];

    /** Registers a component rendered by a function: `<x-name>` in any view. Registering an existing name replaces it. */
    component(name: string, renderer: ComponentRenderer): this {
        if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error(`Invalid component name: ${name}`);
        this.componentRenderers.set(name, renderer);
        return this;
    }
    /**
     * Directory of EJS components: `<x-card>` renders `<dir>/card.ejs`, `<x-forms.field>` renders `<dir>/forms/field.ejs`.
     * The view receives its props, `slot` (the content, already rendered), `slots` (named slots) and `attributes` (HTML attributes).
     * Directories registered later win, and files win over components registered with `component()`.
     */
    components(directory: string | URL): this {
        this.componentDirectories.unshift(directory instanceof URL ? fileURLToPath(directory) : directory);
        return this;
    }
    hasComponent(name: string): boolean { return this.componentRenderers.has(name) || this.componentFile(name) !== null; }
    private componentFile(name: string): string | null {
        if (!/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(name)) return null;
        for (const dir of this.componentDirectories) { const file = path.join(dir, ...name.split('.')) + '.ejs'; if (existsSync(file)) return file; }
        return null;
    }
    /** Renders a component tag. HTML, Alpine and Livewire attributes go to the attribute bag; the others become camelCased props. */
    renderComponent(name: string, raw: Record<string, unknown>, slot = '', slots: Record<string, string> = {}): string {
        const props: Record<string, any> = {};
        const attributes: Record<string, any> = {};
        for (const [key, value] of Object.entries(raw)) { if (isHtmlAttribute(key)) attributes[key] = value; else props[camel(key)] = value; }
        // A slot made of whitespace only (line breaks around named slots) counts as empty.
        for (const [key, value] of Object.entries(slots)) {
            // `<x-slot name="trigger" disabled>`: the slot's own attributes, as `triggerAttributes`.
            if (key.endsWith('::attributes')) { props[`${camel(key.slice(0, -'::attributes'.length))}Attributes`] = value; continue; }
            props[camel(key)] = (value as string).trim() === '' ? '' : value;
        }
        if (slot.trim() === '') slot = '';
        const file = this.componentFile(name);
        if (file) return this.renderFile(file, { ...props, slot, slots, attributes: new Attributes(attributes) });
        const renderer = this.componentRenderers.get(name);
        if (!renderer) throw new Error(`Unknown component <x-${name}>: register it with views.component() or views.components(directory).`);
        return renderer({ ...props, attributes }, slot);
    }

    /** Registers a view namespace: `views.namespace('blog', new URL('../views', import.meta.url))` resolves `blog::posts.card`. */
    namespace(name: string, dir: string | URL): this { this.namespaces.set(name, dir instanceof URL ? fileURLToPath(dir) : dir); return this; }
    /** Application override directory: `<dir>/<namespace>/<path>.ejs` replaces the package view. */
    overrideFrom(dir: string): this { this.overrides.unshift(dir); this.compiled.clear(); this.compiledAsync.clear(); return this; }
    share(data: Record<string, unknown>): this { Object.assign(this.shared, data); return this; }

    resolve(view: string): string {
        const [ns, name] = view.split('::');
        const rel = name.replace(/\./g, '/') + '.ejs';
        for (const dir of this.overrides) { const f = path.join(dir, ns, rel); if (existsSync(f)) return f; }
        const base = this.namespaces.get(ns);
        if (!base) throw new Error(`Unknown view namespace: ${ns}`);
        return path.join(base, rel);
    }
    render(view: string, data: Record<string, unknown> = {}): string { return this.renderFile(this.resolve(view), data, view); }
    /** Renders an EJS file directly (component files, page views given by path). */
    renderFile(file: string, data: Record<string, unknown> = {}, cacheKey = file): string {
        let fn = this.compiled.get(cacheKey);
        if (!fn) {
            fn = ejs.compile(compileComponentTags(readFileSync(file, 'utf8'), file), { filename: file });
            this.compiled.set(cacheKey, fn);
        }
        return fn(this.templateData(data));
    }
    /**
     * Renders a view as an async template: it may `await` in its tags (`<%- await schema('form') %>`). Page views and the
     * views of components rendered outside a panel are rendered this way.
     */
    renderAsync(view: string, data: Record<string, unknown> = {}): Promise<string> { return this.renderFileAsync(this.resolve(view), data, view); }
    /** Renders an EJS file as an async template (see `renderAsync()`). */
    async renderFileAsync(file: string, data: Record<string, unknown> = {}, cacheKey = file): Promise<string> {
        let fn = this.compiledAsync.get(cacheKey);
        if (!fn) {
            fn = ejs.compile(compileComponentTags(readFileSync(file, 'utf8'), file), { filename: file, async: true });
            this.compiledAsync.set(cacheKey, fn);
        }
        return fn(this.templateData(data));
    }
    private templateData(data: Record<string, unknown>): Record<string, unknown> {
        return { e, js, cls, attrs, icon, loadingIndicator, view: (v: string, d?: Record<string, unknown>) => this.render(v, d), __component: (name: string, props: Record<string, unknown>, slot: string, slots: Record<string, string>) => this.renderComponent(name, props, slot, slots), ...this.shared, ...data };
    }
}
export const views = new ViewRegistry();

// ------------------------------------------------------------------ global configuration
const configurators = new Map<Function, ((instance: any) => void)[]>();
/**
 * Registers a callback applied to every instance of the class (and its subclasses) created afterwards by `make()`.
 * Returns a function that removes the callback again.
 */
export function configureUsing<T>(cls: abstract new (...args: any[]) => T, configure: (instance: T) => void): () => void {
    configurators.set(cls, [...(configurators.get(cls) ?? []), configure]);
    return () => {
        const remaining = (configurators.get(cls) ?? []).filter((callback) => callback !== configure);
        if (remaining.length) configurators.set(cls, remaining); else configurators.delete(cls);
    };
}
/** Applies the global callbacks to a new instance, from the most general class to the most specific. */
export function configured<T extends object>(instance: T): T {
    if (!configurators.size) return instance;
    const chain: Function[] = [];
    for (let cls: any = instance.constructor; cls && cls !== Object && cls !== Function.prototype; cls = Object.getPrototypeOf(cls)) chain.unshift(cls);
    for (const cls of chain) for (const configure of configurators.get(cls) ?? []) configure(instance);
    return instance;
}
/** Forgets all global callbacks (for tests). */
export function resetConfigurators(): void { configurators.clear(); }

// ------------------------------------------------------------------ render hooks
/** What a render hook receives: the call's scopes (page, resource…) and the slot's data (`action`, `column`…). */
export type RenderHookContext = { scopes: unknown[]; data: Record<string, any> };
export type RenderHookCallback = (context: RenderHookContext) => string | null | undefined;
const UNSCOPED = Symbol('unscoped');
/** Render hook registry. Unscoped hooks render everywhere; scoped hooks only when the call carries one of their scopes. */
export class RenderHookRegistry {
    private hooks = new Map<string, Map<unknown, RenderHookCallback[]>>();
    register(name: string, hook: RenderHookCallback, scopes: unknown | unknown[] | null = null): this {
        const byScope = this.hooks.get(name) ?? new Map<unknown, RenderHookCallback[]>();
        this.hooks.set(name, byScope);
        const list = scopes === null || scopes === undefined ? [UNSCOPED] : Array.isArray(scopes) ? scopes : [scopes];
        for (const scope of list) byScope.set(scope, [...(byScope.get(scope) ?? []), hook]);
        return this;
    }
    /** Hooks to render for a call: unscoped first, then scope by scope, each hook once. */
    collect(name: string, scopes: unknown[]): RenderHookCallback[] {
        const byScope = this.hooks.get(name);
        if (!byScope) return [];
        const found: RenderHookCallback[] = [];
        for (const scope of [UNSCOPED, ...scopes]) for (const hook of byScope.get(scope) ?? []) if (!found.includes(hook)) found.push(hook);
        return found;
    }
    has(name: string, scopes: unknown | unknown[] | null = null): boolean { return this.collect(name, toScopes(scopes)).length > 0; }
    render(name: string, scopes: unknown | unknown[] | null = null, data: Record<string, any> = {}): string {
        const list = toScopes(scopes);
        return this.collect(name, list).map((hook) => hook({ scopes: list, data }) ?? '').join('');
    }
    clear(): void { this.hooks.clear(); }
}
const toScopes = (scopes: unknown | unknown[] | null | undefined): unknown[] => (scopes === null || scopes === undefined ? [] : Array.isArray(scopes) ? scopes : [scopes]);
/** Process-wide hooks (all panels). */
export const renderHooks = new RenderHookRegistry();
const renderHookScope = new AsyncLocalStorage<RenderHookRegistry>();
/** Renders with an extra registry (the request panel's) on top of the process-wide hooks. */
export function runWithRenderHooks<T>(registry: RenderHookRegistry, fn: () => T): T { return renderHookScope.run(registry, fn); }
const activeRegistries = (): RenderHookRegistry[] => { const own = renderHookScope.getStore(); return own && own !== renderHooks ? [renderHooks, own] : [renderHooks]; };
/** Renders a slot: process-wide hooks, then the current panel's hooks. */
export function renderHook(name: string, scopes: unknown | unknown[] | null = null, data: Record<string, any> = {}): string {
    return activeRegistries().map((registry) => registry.render(name, scopes, data)).join('');
}
export function hasRenderHook(name: string, scopes: unknown | unknown[] | null = null): boolean {
    return activeRegistries().some((registry) => registry.has(name, scopes));
}
views.share({ renderHook, hasRenderHook, cspNonceAttribute });
export { isLocalOrHttpUrl, isSpaNavigableUrl, localOrHttpUrl } from './url-guard.ts';
export { getHtmlSanitizerConfig, hasCustomHtmlSanitizerConfig, HtmlSanitizerConfig, isSafeUrl, markdownToHtml, sanitizeHtml, sanitizeUrl, useHtmlSanitizerConfig } from './html.ts';
export { cspNonce, cspNonceAttribute, getResponseCspNonce, runWithCspNonce, useCspNonce } from './csp.ts';
export * from './enums.ts';
export * from './relationships.ts';
export { Platform } from './platform.ts';
export { ModalComponent } from './modal-component.ts';
export { fileUrlConfig, isSafeStorageKey, resolveStoredFileUrl, signedFileUrl, signFileUrl, temporaryFileUrlExpiry, verifyFileUrlSignature, type FileUrlStorage } from './file-urls.ts';
export { NavetteTimezone } from './timezone.ts';
export { getRegisteredRichContent, RenderedRichContent, type RegisteredRichContent } from './rich-content-registry.ts';
