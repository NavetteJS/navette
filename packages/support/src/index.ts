import { AsyncLocalStorage } from 'node:async_hooks';
// @navette/support — briques transverses portées de filament/support : échappement, sac d'attributs, sérialisation JS,
// évaluation paresseuse, couleurs, icônes, vues EJS à espaces de noms.
import ejs from 'ejs';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ échappement (équivalent de e() / htmlspecialchars)
export function e(value: unknown): string {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/** Chaîne HTML sûre : n'est pas ré-échappée par les vues. */
export class HtmlString {
    html: string;
    constructor(html: string) { this.html = html; }
    toString(): string { return this.html; }
}
export const raw = (html: string) => new HtmlString(html);

// ------------------------------------------------------------------ Js::from (Illuminate\Support\Js)
// Chaîne JS entre apostrophes, comme json_encode(JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) de PHP.
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
/**
 * `json_encode($value, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT)` : dans les chaînes, `'`, `"`, `<`, `>` et `&`
 * sont écrits en `\uXXXX` (les guillemets de structure restent tels quels), et `/` est échappé.
 */
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
/** Sérialise une valeur en expression JavaScript, au même format que `Js::from()` de Laravel. */
export function js(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return "'" + phpString(value) + "'";
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return "JSON.parse('" + phpString(phpJson(value)) + "')";
}

// ------------------------------------------------------------------ classes et styles conditionnels (Arr::toCssClasses)
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

// ------------------------------------------------------------------ sac d'attributs (Illuminate\View\ComponentAttributeBag + Filament)
export type AttrValue = string | number | boolean | null | undefined;
export class Attributes {
    private map = new Map<string, AttrValue>();
    constructor(initial: Record<string, AttrValue> = {}) { for (const [k, v] of Object.entries(initial)) this.map.set(k, v); }

    get(key: string): AttrValue { return this.map.get(key); }
    has(key: string): boolean { return this.map.has(key); }

    /** Port de merge() : les valeurs par défaut passent en premier, puis les attributs existants ; null/false sont ignorés. */
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
    /** Ajoute (ou remplace) un attribut en fin de liste. */
    set(key: string, value: AttrValue): Attributes { const out = this.clone(); out.map.delete(key); out.map.set(key, value); return out; }
    private clone(): Attributes { const out = new Attributes(); for (const [k, v] of this.map) out.map.set(k, v); return out; }
    /** Port de class() : les classes s'ajoutent après les classes existantes ; l'attribut garde sa place, ou va en fin. */
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

    /** Grille conteneur : port de ComponentAttributeBag::grid(). */
    grid(columns: Record<string, number> | number | null = {}): Attributes {
        const cols: Record<string, number> = typeof columns === 'number' ? { lg: columns } : { ...(columns ?? {}) };
        for (const k of Object.keys(cols)) if (!cols[k]) delete cols[k];
        cols.default ??= 1;
        const v = (bp: string) => bp.replace(/@/g, 'c').replace(/!/g, 'n');
        return this
            .class(['fi-grid', ...Object.keys(cols).map((bp) => (bp === 'default' ? (cols[bp] > 1 ? 'fi-grid-cols' : '') : `${bp}:fi-grid-cols`))])
            .style(Object.entries(cols).map(([bp, n]) => `--cols-${v(bp)}: repeat(${n}, minmax(0, 1fr))`));
    }
    /** Colonne de grille : port de ComponentAttributeBag::gridColumn(). */
    gridColumn(span: Record<string, number | string> | number | string | null = {}, isHidden = false): Attributes {
        const s: Record<string, number | string> = span !== null && typeof span === 'object' ? { ...span } : span ? { lg: span } : {};
        for (const k of Object.keys(s)) if (!s[k]) delete s[k];
        const v = (bp: string) => bp.replace(/@/g, 'c').replace(/!/g, 'n');
        return this
            .class(['fi-grid-col', { 'fi-hidden': isHidden || s.default === 'hidden' }, ...Object.keys(s).map((bp) => (bp === 'default' ? '' : `${bp}:fi-grid-col-span`))])
            .style(Object.entries(s).map(([bp, n]) => `--col-span-${v(bp)}: ${n === 'full' ? '1 / -1' : `span ${n} / span ${n}`}`));
    }

    /** Rendu `clé="valeur"` ; `true` devient `clé="clé"` (ou `""` pour x-data et wire:*), comme dans Laravel. Les valeurs ne sont pas ré-échappées. */
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

// ------------------------------------------------------------------ évaluation paresseuse (EvaluatesClosures)
export type Lazy<T, C = any> = T | ((ctx: C) => T | Promise<T>);
export async function evaluate<T, C>(value: Lazy<T, C>, ctx: C): Promise<T> {
    return typeof value === 'function' ? await (value as (ctx: C) => T | Promise<T>)(ctx) : value;
}

// ------------------------------------------------------------------ couleurs (Filament\Support\Colors)
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export type Palette = Record<number, string>;
export const Color: Record<string, Palette> = JSON.parse(readFileSync(here('../data/palettes.json'), 'utf8'));
export const WCAG_AA_TEXT = 4.5;

/** Port de Color::convertToOklch : `#rrggbb`, `rgb(r, g, b)` ou `r, g, b` → `oklch(L C h)`, arrondi à trois décimales. */
export function convertToOklch(color: string): string {
    if (color.startsWith('oklch(')) return color;
    const compact = color.replace(/\s+/g, '');
    const [r, g, b] = (compact.startsWith('#') ? convertToRgb(compact) : compact.replace(/^rgb\(|\)$/g, '').split(',').map(Number)).map((channel) => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    if (![r, g, b].every(Number.isFinite)) throw new Error(`Couleur non prise en charge : ${color}`);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    let hue = (Math.atan2(bb, a) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    const round = (n: number) => String(Math.round(n * 1000) / 1000);
    return `oklch(${round(lightness)} ${round(Math.sqrt(a * a + bb * bb))} ${round(hue)})`;
}
/** Clarté et saturation de chaque nuance d'une palette générée (constantes de Color::generatePalette). */
const GENERATED_SHADES: [number, string, string][] = [
    [50, '0.97717647058824', '0.01395454545455'], [100, '0.95035294117647', '0.03272727272727'], [200, '0.90547058823529', '0.06318181818182'],
    [300, '0.84047058823529', '0.10604545454546'], [400, '0.75352941176471', '0.15027272727273'], [500, '0.68270588235294', '0.17009090909091'],
    [600, '0.59782352941176', '0.16913636363636'], [700, '0.51494117647059', '0.14940909090909'], [800, '0.44611764705882', '0.12331818181818'],
    [900, '0.39458823529412', '0.09963636363636'], [950, '0.27788235294118', '0.07136363636364'],
];
/** Port de Color::generatePalette (`Color::hex()`, `Color::rgb()`) : onze nuances à partir d'une seule couleur, dont on garde la teinte. */
export function generatePalette(color: string): Palette {
    const [, , chroma, hue] = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(convertToOklch(color))!.map(Number);
    const achromatic = chroma < 0.03;
    return Object.fromEntries(GENERATED_SHADES.map(([shade, lightness, saturation]) => [shade, `oklch(${lightness} ${achromatic ? '0' : saturation} ${hue})`])) as Palette;
}
/** Une palette toute faite, ou une couleur (`#6366f1`, `rgb(…)`) dont la palette est générée. */
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
    if (!m) throw new Error(`Couleur non prise en charge : ${color}`);
    const L = +m[1], C = +m[2], h = ((+m[3] || 0) * Math.PI) / 180;
    const a = C * Math.cos(h), b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, md = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [4.0767416621 * l - 3.3077115913 * md + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * md - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * md + 1.707614701 * s];
    return lin.map((x) => Math.max(0, Math.min(255, Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255)))) as [number, number, number];
}
/** Rapport de contraste de Filament : luminance approchée par un gamma 2,2 (reproduit tel quel, ce n'est pas la formule WCAG exacte). */
export function calculateContrastRatio(c1: string, c2: string): number {
    const lum = (c: string) => { const [r, g, b] = convertToRgb(c); return 0.2126 * (r / 255) ** 2.2 + 0.7152 * (g / 255) ** 2.2 + 0.0722 * (b / 255) ** 2.2; };
    const a = lum(c1), b = lum(c2);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function isLight(color: string): boolean {
    const m = /^oklch\(([\d.]+)/.exec(color);
    if (!m) throw new Error(`isLight : seule la notation oklch est prise en charge pour l'instant (${color})`);
    return +m[1] >= 0.65;
}

type Candidate = { bg: number; hover: number; alternateHover: number | null };
/** Port de ButtonComponentColorMap : choisit les nuances de fond et de texte accessibles d'un bouton plein. */
export function buttonColorMap(palette: Palette, minRatio = WCAG_AA_TEXT): Record<string, number> {
    const light: Candidate[] = [{ bg: 600, hover: 500, alternateHover: null }, { bg: 400, hover: 300, alternateHover: 500 }];
    const dark: Candidate[] = [{ bg: 600, hover: 500, alternateHover: 700 }];
    const shades = Object.keys(palette).map(Number).sort((a, b) => a - b);
    const textForBg: Record<number, number> = {};
    const possibleDark = shades.slice(1);
    let fallbackOk = true;
    outer: for (const bg of shades) {
        while (possibleDark.length) {
            const t = possibleDark[0];
            if (t >= 800 && calculateContrastRatio(palette[bg], palette[t]) >= minRatio) { textForBg[bg] = t; continue outer; }
            possibleDark.shift();
        }
        if (fallbackOk && palette[50] !== undefined) {
            if (calculateContrastRatio(palette[bg], palette[50]) >= minRatio) { textForBg[bg] = 50; continue; }
            fallbackOk = false;
        }
        textForBg[bg] = 0;
    }
    const lightness: Record<number, boolean> = {};
    for (const c of [...light, ...dark]) for (const s of [c.bg, c.hover, c.alternateHover]) {
        if (s === null) continue;
        const t = textForBg[s] ?? 0;
        lightness[s] = t === 0 || isLight(palette[t] ?? 'oklch(1 0 0)');
    }
    const pick = (cands: Candidate[]): [number, number] => {
        for (const c of cands) {
            if (!lightness[c.bg]) continue;
            if (lightness[c.hover]) return [c.bg, c.hover];
            if (c.alternateHover !== null && lightness[c.alternateHover]) return [c.bg, c.alternateHover];
        }
        const f = cands[cands.length - 1];
        return [f.bg, lightness[f.bg] === lightness[f.hover] ? f.hover : (f.alternateHover ?? f.hover)];
    };
    const [bg, hoverBg] = pick(light), [darkBg, darkHoverBg] = pick(dark);
    return { bg, 'hover:bg': hoverBg, 'dark:bg': darkBg, 'dark:hover:bg': darkHoverBg, text: textForBg[bg] ?? 0, 'hover:text': textForBg[hoverBg] ?? 0, 'dark:text': textForBg[darkBg] ?? 0, 'dark:hover:text': textForBg[darkHoverBg] ?? 0 };
}

/** Port de Color::findShade : première nuance de la palette assez contrastée sur une surface. */
export function findShade(palette: Palette, surface: string, options: { minRatio?: number; maxShade?: number; minShade?: number; fromDarkest?: boolean } = {}): number | null {
    const shades = Object.keys(palette).map(Number).sort((a, b) => (options.fromDarkest ? b - a : a - b));
    for (const shade of shades) {
        if (options.maxShade !== undefined && shade > options.maxShade) continue;
        if (options.minShade !== undefined && shade < options.minShade) continue;
        if (calculateContrastRatio(surface, palette[shade]) >= (options.minRatio ?? WCAG_AA_TEXT)) return shade;
    }
    return null;
}
/** Cartes de couleurs des composants à texte coloré (BadgeComponent, LinkComponent). */
export function badgeColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { text: findShade(palette, palette[50]) ?? 900, 'dark:text': findShade(palette, gray[600], { maxShade: 500, fromDarkest: true }) ?? 200 };
}
/** Port de DropdownComponent\ItemComponent::getColorMap. */
export function dropdownItemColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return {
        text: findShade(palette, 'oklch(1 0 0)', { minShade: 600 }) ?? 950,
        'hover:text': findShade(palette, palette[50], { minShade: 600 }) ?? 950,
        'dark:text': findShade(palette, gray[900], { maxShade: 400, fromDarkest: true }) ?? 200,
        'dark:hover:text': findShade(palette, palette[950], { maxShade: 400, fromDarkest: true }) ?? 100,
    };
}
/** Port de IconColumnComponent\IconComponent::getColorMap (contraste non textuel, 3:1). */
export function iconColumnColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { text: findShade(palette, 'oklch(1 0 0)', { minRatio: 3 }) ?? 900, 'dark:text': findShade(palette, gray[800], { minRatio: 3, maxShade: 600, fromDarkest: true }) ?? 200 };
}
/** Port de IconButtonComponentColorMap (contraste non textuel 3:1, surfaces gray-50 / gray-700). */
export function iconButtonColorMap(palette: Palette, gray: Palette): Record<string, number> {
    const light = findShade(palette, gray[50], { minRatio: 3 });
    const dark = findShade(palette, gray[700], { minRatio: 3, maxShade: 500, fromDarkest: true });
    // Au-delà de 500 la teinte est déjà sombre : au survol on l'assombrit au lieu de l'éclaircir.
    const [text, hoverText] = light === null ? [900, 800] : light > 500 ? [light, light + 100] : [light + 100, light];
    return { text, 'hover:text': hoverText, 'dark:text': dark ?? 200, 'dark:hover:text': dark === null ? 100 : dark - 100 };
}
/** Port de ToggleComponent::getColorMap (contraste non textuel 3:1). */
export function toggleColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { bg: findShade(palette, gray[50], { minRatio: 3 }) ?? 900, text: findShade(palette, 'oklch(1 0 0)', { minRatio: 3 }) ?? 900, 'dark:bg': findShade(palette, gray[700], { minRatio: 3, fromDarkest: true }) ?? 200 };
}
export function linkColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { text: findShade(palette, gray[50]) ?? 900, 'dark:text': findShade(palette, gray[700], { maxShade: 400, fromDarkest: true }) ?? 200 };
}

/** Bouton à contour : seule la couleur du texte dépend de la palette (ButtonComponent, `isOutlined`). */
export function outlinedButtonColorMap(palette: Palette, gray: Palette): Record<string, number> {
    return { text: findShade(palette, gray[50]) ?? 900, 'dark:text': findShade(palette, gray[700], { maxShade: 500, fromDarkest: true }) ?? 200 };
}
/** Carte de couleurs de chaque composant coloré (équivalent des classes `*Component::getColorMap`). */
const COMPONENT_COLOR_MAPS = {
    button: (palette: Palette) => buttonColorMap(palette),
    'button-outlined': outlinedButtonColorMap,
    badge: badgeColorMap,
    link: linkColorMap,
    'dropdown-item': dropdownItemColorMap,
    'icon-column': iconColumnColorMap,
    'icon-button': iconButtonColorMap,
    toggle: toggleColorMap,
    // Port de StatsOverviewWidgetComponentStatComponentDescriptionComponent et ChartComponent (ce dernier ne pose que `fi-color`).
    'stat-description': (palette: Palette, gray: Palette) => ({ text: findShade(palette, 'oklch(1 0 0)', { minShade: 600 }) ?? 950, 'dark:text': findShade(palette, gray[900], { maxShade: 400, fromDarkest: true }) ?? 200 }),
    'stat-chart': () => ({}),
    // Texte coloré d'une colonne ou d'une entrée. Gris : 500 / 400, relevé sur Filament ; autres couleurs : même recherche de contraste que la description d'une statistique (non comparé à Filament).
    text: (palette: Palette, gray: Palette) => (palette === gray ? { text: 500, 'dark:text': 400 } : { text: findShade(palette, 'oklch(1 0 0)', { minShade: 600 }) ?? 950, 'dark:text': findShade(palette, gray[900], { maxShade: 400, fromDarkest: true }) ?? 50 }),
} satisfies Record<string, (palette: Palette, gray: Palette) => Record<string, number>>;
export type ColoredComponent = keyof typeof COMPONENT_COLOR_MAPS;

const CLASS_FOR: Record<string, (s: number) => string> = {
    bg: (s) => `fi-bg-color-${s}`, 'hover:bg': (s) => `hover:fi-bg-color-${s}`, 'dark:bg': (s) => `dark:fi-bg-color-${s}`, 'dark:hover:bg': (s) => `dark:hover:fi-bg-color-${s}`,
    text: (s) => `fi-text-color-${s}`, 'hover:text': (s) => `hover:fi-text-color-${s}`, 'dark:text': (s) => `dark:fi-text-color-${s}`, 'dark:hover:text': (s) => `dark:hover:fi-text-color-${s}`,
};
/** Port de ColorManager. */
export class ColorManager {
    static DEFAULT_COLORS: Record<string, Palette> = { danger: Color.Red, gray: Color.Zinc, info: Color.Blue, primary: Color.Amber, success: Color.Green, warning: Color.Amber };
    private colors: Record<string, Palette> = { ...ColorManager.DEFAULT_COLORS };
    private cache = new Map<string, string[]>();
    /** Couleurs propres à la requête en cours (thème choisi par l'utilisateur) : elles priment sur celles du panel. */
    private scope = new AsyncLocalStorage<{ key: string; colors: Record<string, Palette> }>();

    register(colors: Record<string, ColorInput>): this { for (const [name, color] of Object.entries(colors)) this.colors[name] = toPalette(color); this.cache.clear(); return this; }
    /** Exécute `fn` avec des couleurs qui ne valent que pour cette requête ; `key` identifie le jeu de couleurs (cache). */
    runWith<T>(key: string, colors: Record<string, ColorInput>, fn: () => T): T {
        return this.scope.run({ key, colors: Object.fromEntries(Object.entries(colors).map(([name, color]) => [name, toPalette(color)])) }, fn);
    }
    getColors(): Record<string, Palette> { return { ...this.colors, ...(this.scope.getStore()?.colors ?? {}) }; }
    getColor(name: string): Palette | undefined { return this.scope.getStore()?.colors[name] ?? this.colors[name]; }

    /** Classes d'un composant coloré (`getComponentClasses`). Seul le bouton plein est porté pour l'instant. */
    getComponentClasses(component: ColoredComponent, color: string | null): string[] {
        if (!color) return [];
        const key = `${this.scope.getStore()?.key ?? ''}:${component}:${color}`;
        const hit = this.cache.get(key);
        if (hit) return hit;
        let classes: string[] = [];
        // Seul le bouton a le gris pour couleur par défaut sans classe (HasDefaultGrayColor).
        if (color !== 'gray' || component !== 'button') {
            classes = ['fi-color', 'fi-color-' + color.replace(/[^a-zA-Z0-9_-]/g, '')];
            const palette = this.getColor(color);
            if (palette) {
                const gray = this.getColor('gray')!;
                const map = COMPONENT_COLOR_MAPS[component](palette, gray);
                classes.push(...Object.entries(map).map(([k, shade]) => CLASS_FOR[k](shade)));
            }
        }
        this.cache.set(key, classes);
        return classes;
    }
    /** Bloc `<style>` des variables `--<couleur>-<nuance>` injecté dans `<head>`. */
    renderCssVariables(): string {
        const vars = Object.entries(this.getColors()).map(([name, palette]) => Object.entries(palette).map(([shade, value]) => ` --${name}-${shade}:${value}; `).join('')).join('');
        return `<style>\n    :root {\n        ${vars}}\n</style>`;
    }
}

// ------------------------------------------------------------------ icônes (generate_icon_html + Heroicons)
const iconCache = new Map<string, string>();
/** Icône Heroicons (`m-eye`, `o-user`, `s-…`, `c-…`) avec les classes `fi-icon fi-size-<taille>`. */
export function icon(name: string, options: { size?: string; attributes?: Attributes } = {}): string {
    let svg = iconCache.get(name);
    if (svg === undefined) {
        const file = here(`../icons/heroicons/${name.replace(/^heroicon-/, '')}.svg`);
        if (!existsSync(file)) throw new Error(`Icône introuvable : ${name}`);
        svg = readFileSync(file, 'utf8').trim();
        iconCache.set(name, svg);
    }
    const a = (options.attributes ?? new Attributes()).class(['fi-icon', `fi-size-${options.size ?? 'md'}`]);
    return svg.replace(/^<svg/, `<svg ${a.toHtml()}`);
}
/** Déclare une icône hors Heroicons (logo de marque, pictogramme maison) : un `<svg>` complet, fourni par l'application et non par l'utilisateur. */
export function registerIcon(name: string, svg: string): void {
    if (!/^<svg[\s>]/.test(svg.trim())) throw new Error(`registerIcon(${name}) attend un élément <svg>.`);
    iconCache.set(name, svg.trim());
}
/** Indicateur de chargement (`generate_loading_indicator_html`). */
export function loadingIndicator(attributes: Attributes = new Attributes(), size = 'md'): string {
    const a = attributes.class(['fi-icon fi-loading-indicator', `fi-size-${size}`]);
    return `<svg fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${a.toHtml()}><path clip-rule="evenodd" d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19ZM12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill-rule="evenodd" fill="currentColor" opacity="0.2"></path><path d="M2 12C2 6.47715 6.47715 2 12 2V5C8.13401 5 5 8.13401 5 12H2Z" fill="currentColor"></path></svg>`;
}

// ------------------------------------------------------------------ vues EJS à espaces de noms, surchargeables
/** Registre de vues : `filament-forms::components.text-input` → fichier EJS ; les dossiers de surcharge passent en premier. */
export class ViewRegistry {
    private namespaces = new Map<string, string>();
    private overrides: string[] = [];
    private compiled = new Map<string, ejs.TemplateFunction>();
    private shared: Record<string, unknown> = {};

    namespace(name: string, dir: string): this { this.namespaces.set(name, dir); return this; }
    /** Dossier de surcharge de l'application : `<dir>/<espace>/<chemin>.ejs` remplace la vue du paquet. */
    overrideFrom(dir: string): this { this.overrides.unshift(dir); this.compiled.clear(); return this; }
    share(data: Record<string, unknown>): this { Object.assign(this.shared, data); return this; }

    resolve(view: string): string {
        const [ns, name] = view.split('::');
        const rel = name.replace(/\./g, '/') + '.ejs';
        for (const dir of this.overrides) { const f = path.join(dir, ns, rel); if (existsSync(f)) return f; }
        const base = this.namespaces.get(ns);
        if (!base) throw new Error(`Espace de noms de vues inconnu : ${ns}`);
        return path.join(base, rel);
    }
    render(view: string, data: Record<string, unknown> = {}): string {
        let fn = this.compiled.get(view);
        if (!fn) {
            const file = this.resolve(view);
            fn = ejs.compile(readFileSync(file, 'utf8'), { filename: file });
            this.compiled.set(view, fn);
        }
        return fn({ e, js, cls, attrs, icon, loadingIndicator, view: (v: string, d?: Record<string, unknown>) => this.render(v, d), ...this.shared, ...data });
    }
}
export const views = new ViewRegistry();

// ------------------------------------------------------------------ réglages globaux (équivalent de configureUsing)
const configurators = new Map<Function, ((instance: any) => void)[]>();
/** Enregistre un réglage appliqué à chaque instance de la classe (et de ses sous-classes) créée ensuite par `make()`. */
export function configureUsing<T>(cls: abstract new (...args: any[]) => T, configure: (instance: T) => void): void {
    configurators.set(cls, [...(configurators.get(cls) ?? []), configure]);
}
/** Applique les réglages globaux à une instance fraîchement créée, de la classe la plus générale à la plus précise. */
export function configured<T extends object>(instance: T): T {
    if (!configurators.size) return instance;
    const chain: Function[] = [];
    for (let cls: any = instance.constructor; cls && cls !== Object && cls !== Function.prototype; cls = Object.getPrototypeOf(cls)) chain.unshift(cls);
    for (const cls of chain) for (const configure of configurators.get(cls) ?? []) configure(instance);
    return instance;
}
/** Oublie tous les réglages globaux (tests). */
export function resetConfigurators(): void { configurators.clear(); }

// ------------------------------------------------------------------ render hooks (port de FilamentView::registerRenderHook / renderHook)
/** Ce qu'un render hook reçoit : les portées de l'appel (page, resource…) et les données de l'emplacement (`action`, `column`…). */
export type RenderHookContext = { scopes: unknown[]; data: Record<string, any> };
export type RenderHookCallback = (context: RenderHookContext) => string | null | undefined;
const UNSCOPED = Symbol('unscoped');
/** Registre de render hooks. Un hook sans portée est rendu partout ; avec portées, seulement quand l'appel porte l'une d'elles. */
export class RenderHookRegistry {
    private hooks = new Map<string, Map<unknown, RenderHookCallback[]>>();
    register(name: string, hook: RenderHookCallback, scopes: unknown | unknown[] | null = null): this {
        const byScope = this.hooks.get(name) ?? new Map<unknown, RenderHookCallback[]>();
        this.hooks.set(name, byScope);
        const list = scopes === null || scopes === undefined ? [UNSCOPED] : Array.isArray(scopes) ? scopes : [scopes];
        for (const scope of list) byScope.set(scope, [...(byScope.get(scope) ?? []), hook]);
        return this;
    }
    /** Hooks à rendre pour cet appel, dans l'ordre de Filament : sans portée d'abord, puis portée par portée, chacun une seule fois. */
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
/** Hooks communs à tout le processus (tous les panels). */
export const renderHooks = new RenderHookRegistry();
const renderHookScope = new AsyncLocalStorage<RenderHookRegistry>();
/** Exécute un rendu avec, en plus des hooks communs, ceux d'un registre propre (celui du panel de la requête). */
export function runWithRenderHooks<T>(registry: RenderHookRegistry, fn: () => T): T { return renderHookScope.run(registry, fn); }
const activeRegistries = (): RenderHookRegistry[] => { const own = renderHookScope.getStore(); return own && own !== renderHooks ? [renderHooks, own] : [renderHooks]; };
/** Rend un emplacement : hooks communs, puis hooks du panel en cours. */
export function renderHook(name: string, scopes: unknown | unknown[] | null = null, data: Record<string, any> = {}): string {
    return activeRegistries().map((registry) => registry.render(name, scopes, data)).join('');
}
export function hasRenderHook(name: string, scopes: unknown | unknown[] | null = null): boolean {
    return activeRegistries().some((registry) => registry.has(name, scopes));
}
views.share({ renderHook, hasRenderHook });
