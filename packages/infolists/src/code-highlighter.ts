// Server-side syntax highlighting of the CodeEntry with Shiki (TextMate grammars and VS Code themes, the same as
// Filament's Phiki). Shiki is an optional peer dependency: it is imported on first use, and when it is not installed
// (or the grammar or a theme is unknown) the entry falls back to single-color rendering.
import { e } from '@navette-js/support';

/** One token of a line: its text and its style in the light and dark themes. */
export type HighlightedToken = { content: string; light: string; dark: string };
export type HighlightedCode = { lines: HighlightedToken[][]; preStyle: string };

type ShikiModule = { createHighlighter: (options: { themes: string[]; langs: string[] }) => Promise<any>; bundledLanguages: Record<string, unknown>; bundledThemes: Record<string, unknown> };
type Loaded = { shiki: ShikiModule; highlighter: any };

let loader: (() => Promise<unknown>) | null = () => import('shiki' as string);
let loading: Promise<Loaded | null> | null = null;

/**
 * Replaces how Shiki is loaded: a function returning the `shiki` module (or a compatible one), or `null` to turn
 * highlighting off. Mainly for tests.
 * @internal
 */
export function setCodeHighlighterLoader(load: (() => Promise<unknown>) | null): void {
    loader = load;
    loading = null;
}

async function load(): Promise<Loaded | null> {
    if (!loader) return null;
    const current = loader;
    loading ??= (async () => {
        try {
            const shiki = (await current()) as ShikiModule;
            if (typeof shiki?.createHighlighter !== 'function') return null;
            return { shiki, highlighter: await shiki.createHighlighter({ themes: [], langs: [] }) };
        } catch {
            return null; // Shiki is not installed: single-color rendering.
        }
    })();
    return loading;
}

// Shiki's font style flags.
const ITALIC = 1, BOLD = 2, UNDERLINE = 4, STRIKETHROUGH = 8;

/** Phiki's `TokenSettings::toStyleArray()`: CSS properties of a token in one theme. */
function styleArray(style: { color?: string; bgColor?: string; fontStyle?: number } | undefined): [string, string][] {
    if (!style) return [];
    const out: [string, string][] = [];
    if (style.bgColor) out.push(['background-color', style.bgColor]);
    if (style.color) out.push(['color', style.color]);
    const font = style.fontStyle ?? 0;
    if (font > 0) {
        if (font & ITALIC) out.push(['font-style', 'italic']);
        if (font & BOLD) out.push(['font-weight', 'bold']);
        if (font & STRIKETHROUGH) out.push(['text-decoration', 'line-through']);
        else if (font & UNDERLINE) out.push(['text-decoration', 'underline']);
    }
    return out;
}
const lightStyle = (pairs: [string, string][]) => pairs.map(([p, v]) => `${p}: ${v};`).join('');
const darkStyle = (pairs: [string, string][]) => pairs.map(([p, v]) => `--phiki-dark-${p}: ${v};`).join('');

/**
 * Highlights the code in both themes. Returns `null` when Shiki is not installed, or when the grammar or a theme is
 * not one of Shiki's bundled ones: the caller then renders the code in a single color.
 */
export async function highlightCode(code: string, grammar: string, lightTheme: string, darkTheme: string): Promise<HighlightedCode | null> {
    const loaded = await load();
    if (!loaded) return null;
    const { shiki, highlighter } = loaded;
    const has = (bundle: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(bundle, key);
    if (!has(shiki.bundledLanguages, grammar) || !has(shiki.bundledThemes, lightTheme) || !has(shiki.bundledThemes, darkTheme)) return null;
    try {
        if (!highlighter.getLoadedLanguages().includes(grammar)) await highlighter.loadLanguage(grammar);
        for (const theme of [lightTheme, darkTheme]) if (!highlighter.getLoadedThemes().includes(theme)) await highlighter.loadTheme(theme);
        const tokens: { content: string; variants: Record<string, any> }[][] = highlighter.codeToTokensWithThemes(code, { lang: grammar, themes: { light: lightTheme, dark: darkTheme } });
        const theme = (name: string) => highlighter.getTheme(name) as { bg?: string; fg?: string };
        const base = (name: string) => styleArray({ bgColor: theme(name).bg, color: theme(name).fg });
        return {
            lines: tokens.map((line) => line.map((token) => ({ content: token.content, light: lightStyle(styleArray(token.variants.light)), dark: darkStyle(styleArray(token.variants.dark)) }))),
            preStyle: lightStyle(base(lightTheme)) + darkStyle(base(darkTheme)),
        };
    } catch {
        return null;
    }
}

/** Markup of the highlighted lines, like Phiki's: one `<span class="line">` per line, a newline token ending each line but the last. */
export function highlightedLinesHtml(highlighted: HighlightedCode): string {
    const { lines } = highlighted;
    return lines
        .map((line, index) => {
            const tokens = line.map((token) => {
                const style = token.light + token.dark;
                return `<span class="token"${style ? ` style="${e(style)}"` : ''}>${e(token.content)}</span>`;
            }).join('');
            return `<span class="line">${tokens}${index < lines.length - 1 ? '<span class="token">\n</span>' : ''}</span>`;
        })
        .filter((_, index) => !(index === lines.length - 1 && lines[index].length === 0 && lines.length > 1))
        .join('');
}
