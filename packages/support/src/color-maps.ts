// Shade selection of colored components, as in Filament's `ColorMaps` (ComponentColorMap, ButtonComponentColorMap,
// IconButtonComponentColorMap): fluent builders returning a map of slots (`bg`, `text`, `dark:hover:bg`…) to shades.
import { calculateContrastRatio, findShade, isLight, WCAG_AA_TEXT, type Palette } from './index.ts';

/** Minimum contrast for non-text elements (icons, toggles): WCAG AA. */
export const WCAG_AA_NON_TEXT = 3;
/** Minimum contrast for normal text: WCAG AAA. */
export const WCAG_AAA_TEXT = 7;

/** Slots of a color map, mapped to shades (`0`: white). */
export type ColorMap = Record<string, number>;
export type ColorMapSlotOptions = { surface: string; minRatio?: number; maxShade?: number | null; minShade?: number | null; shouldStartFromDarkest?: boolean; fallback?: number };

/** One shade per slot: the first shade of the palette with enough contrast against a surface (badges, links, text, toggles…). */
export class ComponentColorMap {
    protected palette: Palette;
    protected resolved: ColorMap = {};
    constructor(palette: Palette) { this.palette = palette; }
    static make(palette: Palette): ComponentColorMap { return new ComponentColorMap(palette); }
    /**
     * `surface`: the color the shade must contrast against; `minRatio`: 4.5 by default (`WCAG_AA_NON_TEXT` for icons,
     * `WCAG_AAA_TEXT` for AAA); `shouldStartFromDarkest`: walk from the darkest shade (dark mode); `fallback`: 900 by default.
     */
    slot(name: string, options: ColorMapSlotOptions): this {
        this.resolved[name] = findShade(this.palette, options.surface, {
            minRatio: options.minRatio ?? WCAG_AA_TEXT,
            maxShade: options.maxShade ?? undefined,
            minShade: options.minShade ?? undefined,
            fromDarkest: options.shouldStartFromDarkest ?? false,
        }) ?? options.fallback ?? 900;
        return this;
    }
    get(): ColorMap { return { ...this.resolved }; }
}

type ButtonCandidate = { bg: number; hover: number; alternateHover: number | null };

/**
 * Filled buttons: background candidates in order of preference, each paired with an accessible text shade. Candidates
 * with light text in both resting and hover states win; the last candidate is the fallback.
 */
export class ButtonComponentColorMap {
    protected palette: Palette;
    protected minRatio = WCAG_AA_TEXT;
    protected lightBackgrounds: ButtonCandidate[] = [];
    protected darkBackgrounds: ButtonCandidate[] = [];
    constructor(palette: Palette) { this.palette = Object.fromEntries(Object.entries(palette).sort(([a], [b]) => Number(a) - Number(b))) as Palette; }
    static make(palette: Palette): ButtonComponentColorMap { return new ButtonComponentColorMap(palette); }
    /** Minimum contrast between the background and the text (4.5 by default). */
    minContrastRatio(ratio: number): this { this.minRatio = ratio; return this; }
    lightBackground(bg: number, hover: number, alternateHover: number | null = null): this { this.lightBackgrounds.push({ bg, hover, alternateHover }); return this; }
    darkBackground(bg: number, hover: number, alternateHover: number | null = null): this { this.darkBackgrounds.push({ bg, hover, alternateHover }); return this; }
    get(): ColorMap {
        if (!this.lightBackgrounds.length) throw new Error('At least one `lightBackground()` candidate must be configured before calling `get()`.');
        if (!this.darkBackgrounds.length) throw new Error('At least one `darkBackground()` candidate must be configured before calling `get()`.');
        const textForBg = this.resolveTextForEachBackground();
        const lightness = this.probeTextLightness(textForBg);
        const [bg, hoverBg] = this.pickBackgroundShades(lightness, this.lightBackgrounds);
        const [darkBg, darkHoverBg] = this.pickBackgroundShades(lightness, this.darkBackgrounds);
        return { bg, 'hover:bg': hoverBg, 'dark:bg': darkBg, 'dark:hover:bg': darkHoverBg, text: textForBg[bg] ?? 0, 'hover:text': textForBg[hoverBg] ?? 0, 'dark:text': textForBg[darkBg] ?? 0, 'dark:hover:text': textForBg[darkHoverBg] ?? 0 };
    }
    /** Darkest-first search of a dark text shade (800+), else shade 50 while it stays accessible, else white (`0`). */
    protected resolveTextForEachBackground(): Record<number, number> {
        const shades = Object.keys(this.palette).map(Number);
        const textForBg: Record<number, number> = {};
        const possibleDark = shades.slice(1);
        let isFallbackAccessible = true;
        outer: for (const bg of shades) {
            while (possibleDark.length) {
                const text = possibleDark[0];
                if (text >= 800 && calculateContrastRatio(this.palette[bg], this.palette[text]) >= this.minRatio) { textForBg[bg] = text; continue outer; }
                possibleDark.shift();
            }
            if (isFallbackAccessible && this.palette[50] !== undefined) {
                if (calculateContrastRatio(this.palette[bg], this.palette[50]) >= this.minRatio) { textForBg[bg] = 50; continue; }
                isFallbackAccessible = false;
            }
            textForBg[bg] = 0;
        }
        return textForBg;
    }
    protected probeTextLightness(textForBg: Record<number, number>): Record<number, boolean> {
        const lightness: Record<number, boolean> = {};
        for (const candidate of [...this.lightBackgrounds, ...this.darkBackgrounds]) for (const shade of [candidate.bg, candidate.hover, candidate.alternateHover]) {
            if (shade === null) continue;
            const text = textForBg[shade] ?? 0;
            lightness[shade] = text === 0 || isLight(this.palette[text] ?? 'oklch(1 0 0)');
        }
        return lightness;
    }
    protected pickBackgroundShades(lightness: Record<number, boolean>, candidates: ButtonCandidate[]): [number, number] {
        for (const candidate of candidates) {
            if (!lightness[candidate.bg]) continue;
            if (lightness[candidate.hover]) return [candidate.bg, candidate.hover];
            if (candidate.alternateHover !== null && lightness[candidate.alternateHover]) return [candidate.bg, candidate.alternateHover];
        }
        const fallback = candidates[candidates.length - 1];
        return [fallback.bg, (lightness[fallback.bg] ?? false) === (lightness[fallback.hover] ?? false) ? fallback.hover : (fallback.alternateHover ?? fallback.hover)];
    }
}

/** Icon-only buttons: one icon shade per mode, and a hover variant derived from it. */
export class IconButtonComponentColorMap {
    protected palette: Palette;
    protected minRatio = WCAG_AA_NON_TEXT;
    protected light: string | null = null;
    protected dark: string | null = null;
    protected darkMax = 500;
    constructor(palette: Palette) { this.palette = palette; }
    static make(palette: Palette): IconButtonComponentColorMap { return new IconButtonComponentColorMap(palette); }
    /** Minimum contrast between the icon and the surface (3 by default). */
    minContrastRatio(ratio: number): this { this.minRatio = ratio; return this; }
    lightSurface(color: string): this { this.light = color; return this; }
    darkSurface(color: string): this { this.dark = color; return this; }
    /** Darkest shade considered in dark mode (500 by default). */
    darkMaxShade(shade: number): this { this.darkMax = shade; return this; }
    get(): ColorMap {
        if (this.light === null) throw new Error('A `lightSurface()` must be configured before calling `get()`.');
        if (this.dark === null) throw new Error('A `darkSurface()` must be configured before calling `get()`.');
        const light = findShade(this.palette, this.light, { minRatio: this.minRatio });
        // Above 500 the shade is already dark: hover darkens it instead of lightening it.
        const [text, hoverText] = light === null ? [900, 800] : light > 500 ? [light, light + 100] : [light + 100, light];
        const dark = findShade(this.palette, this.dark, { minRatio: this.minRatio, maxShade: this.darkMax, fromDarkest: true });
        return { text, 'hover:text': hoverText, 'dark:text': dark ?? 200, 'dark:hover:text': dark === null ? 100 : dark - 100 };
    }
}
