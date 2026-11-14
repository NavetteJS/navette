// Translations: `namespace::group.key` keys, `:name` placeholders, English fallback.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Bundle = Record<string, Record<string, Record<string, Record<string, string>>>>;
const bundle: Bundle = JSON.parse(readFileSync(fileURLToPath(new URL('../data/lang.en-fr.json', import.meta.url)), 'utf8'));
const NAMESPACES: Record<string, string> = {
    'navette-panels': 'panels', 'navette-forms': 'forms', 'navette-tables': 'tables', 'navette-actions': 'actions', 'navette-schemas': 'schemas',
    'navette-notifications': 'notifications', 'navette-infolists': 'infolists', 'navette-widgets': 'widgets', 'navette-query-builder': 'query-builder', navette: 'support',
};
let currentLocale = 'en';
export const setLocale = (locale: string) => { currentLocale = locale; };
export const getLocale = () => currentLocale;

type Translations = { [key: string]: string | Translations };
/** Names that would reach the prototype of the translation objects. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const flatten = (entries: Translations, prefix = '', into: Record<string, string> = {}): Record<string, string> => {
    for (const [key, value] of Object.entries(entries)) {
        if (UNSAFE_KEYS.has(prefix + key)) continue;
        if (typeof value === 'string') into[prefix + key] = value;
        else if (value && typeof value === 'object') flatten(value, `${prefix}${key}.`, into);
    }
    return into;
};
/**
 * Adds translations to a namespace, by locale then group: `addTranslations('blog', { en: { posts: { title: 'Posts' } } })`
 * makes `t('blog::posts.title')` available. Nested objects give dotted keys. Keys added later replace earlier ones, so an
 * application may also override the translations of a plugin, or Navette's own (`navette-panels`, `navette-forms`…).
 */
export function addTranslations(namespace: string, translations: Record<string, Record<string, Translations>>): void {
    if (!/^[A-Za-z0-9_-]+$/.test(namespace) || UNSAFE_KEYS.has(namespace)) throw new Error(`Invalid translation namespace: ${namespace}`);
    const pkg = (bundle[Object.hasOwn(NAMESPACES, namespace) ? NAMESPACES[namespace] : namespace] ??= {});
    for (const [locale, groups] of Object.entries(translations)) {
        if (UNSAFE_KEYS.has(locale)) throw new Error(`Invalid locale: ${locale}`);
        for (const [group, entries] of Object.entries(groups)) {
            if (UNSAFE_KEYS.has(group)) throw new Error(`Invalid translation group: ${group}`);
            pkg[locale] ??= {};
            pkg[locale][group] = { ...pkg[locale][group], ...flatten(entries) };
        }
    }
}
/**
 * Loads a namespace's translations from a directory of JSON files, `<dir>/<locale>/<group>.json`:
 * `loadTranslationsFrom(new URL('../lang', import.meta.url), 'blog')` reads `lang/en/posts.json` as the group `posts`.
 */
export function loadTranslationsFrom(directory: string | URL, namespace: string): void {
    const root = directory instanceof URL ? fileURLToPath(directory) : directory;
    if (!existsSync(root)) throw new Error(`Translation directory not found: ${root}`);
    const translations: Record<string, Record<string, Translations>> = {};
    for (const locale of readdirSync(root)) {
        const folder = path.join(root, locale);
        if (!statSync(folder).isDirectory()) continue;
        for (const file of readdirSync(folder).filter((name) => name.endsWith('.json'))) {
            (translations[locale] ??= {})[file.slice(0, -'.json'.length)] = JSON.parse(readFileSync(path.join(folder, file), 'utf8'));
        }
    }
    addTranslations(namespace, translations);
}

/** Translates a key such as `t('navette-panels::auth/pages/login.form.email.label')`; returns the key when it is missing. */
export function t(key: string, params: Record<string, string | number> = {}, locale = currentLocale): string {
    const [ns, rest] = key.split('::');
    const dot = rest.indexOf('.');
    const group = rest.slice(0, dot), item = rest.slice(dot + 1);
    const pkg = bundle[NAMESPACES[ns] ?? ns];
    let value = pkg?.[locale]?.[group]?.[item] ?? pkg?.en?.[group]?.[item] ?? key;
    for (const [k, v] of Object.entries(params)) {
        value = value.replaceAll(`:${k}`, String(v)).replaceAll(`:${k[0].toUpperCase()}${k.slice(1)}`, String(v).replace(/^./, (c) => c.toUpperCase()));
    }
    return value;
}

/** BCP 47 tag of a locale for `Intl` (`pt_BR` → `pt-BR`); falls back to `en` when `Intl` does not accept it. */
export function intlLocale(locale = currentLocale): string {
    try { return Intl.getCanonicalLocales(locale.replace(/_/g, '-'))[0] ?? 'en'; } catch { return 'en'; }
}
const RTL_LANGUAGES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi']);
/** Text direction of a locale: `rtl` for Arabic, Hebrew, Persian, Urdu…, `ltr` otherwise. */
export function localeDirection(locale = currentLocale): 'ltr' | 'rtl' {
    const tag = intlLocale(locale);
    try {
        const info = new Intl.Locale(tag) as Intl.Locale & { getTextInfo?: () => { direction?: string }; textInfo?: { direction?: string } };
        const direction = info.getTextInfo?.().direction ?? info.textInfo?.direction;
        if (direction === 'rtl' || direction === 'ltr') return direction;
    } catch { /* unknown locale: guess from the language below */ }
    return RTL_LANGUAGES.has(tag.split('-')[0].toLowerCase()) ? 'rtl' : 'ltr';
}

/**
 * Relative duration in the current locale, e.g. "2 months ago" or "il y a 2 mois"; a future date gives "in 3 days".
 * Dates without a time zone are read as UTC.
 */
export function diffForHumans(value: string | Date | null | undefined, now: Date = new Date(), locale = currentLocale): string | null {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
    if (Number.isNaN(date.getTime())) return null;
    const future = date.getTime() > now.getTime();
    const [from, to] = future ? [now, date] : [date, now];
    const seconds = Math.floor((to.getTime() - from.getTime()) / 1000);
    const format = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'always' });
    // `-0` keeps "0 seconds ago" in the past tense.
    const unit = (n: number, name: Intl.RelativeTimeFormatUnit) => format.format(future ? n : -n, name);
    if (seconds < 60) return unit(seconds, 'second');
    if (seconds < 3600) return unit(Math.floor(seconds / 60), 'minute');
    if (seconds < 86400) return unit(Math.floor(seconds / 3600), 'hour');
    const days = Math.floor(seconds / 86400);
    if (days < 7) return unit(days, 'day');
    // Whole calendar months elapsed, not 30-day blocks.
    let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
    if (to.getUTCDate() < from.getUTCDate() || (to.getUTCDate() === from.getUTCDate() && to.getTime() % 86400000 < from.getTime() % 86400000)) months--;
    if (months < 1) return unit(Math.floor(days / 7), 'week');
    if (months < 12) return unit(months, 'month');
    return unit(Math.floor(months / 12), 'year');
}

/** Pluralized translation: `{0} …|{1} …|[2,*] …` or `singular|plural`. `:count` is always available. */
export function tc(key: string, count: number, params: Record<string, string | number> = {}, locale = currentLocale): string {
    const segments = t(key, {}, locale).split('|');
    let chosen: string | null = null;
    for (const segment of segments) {
        const m = /^\s*(?:\{(\d+)\}|\[(\d+),(\d+|\*)\])\s*(.*)$/s.exec(segment);
        if (!m) continue;
        const hit = m[1] !== undefined ? count === Number(m[1]) : count >= Number(m[2]) && (m[3] === '*' || count <= Number(m[3]));
        if (hit) { chosen = m[4]; break; }
    }
    chosen ??= segments.length > 1 && !/^\s*[{[]/.test(segments[0]) ? (count === 1 ? segments[0] : segments[1]) : segments[segments.length - 1].replace(/^\s*(?:\{\d+\}|\[\d+,(?:\d+|\*)\])\s*/, '');
    for (const [k, v] of Object.entries({ count, ...params })) chosen = chosen.replaceAll(`:${k}`, String(v));
    return chosen;
}
