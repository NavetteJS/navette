// Translations: `namespace::group.key` keys, `:name` placeholders, English fallback.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Bundle = Record<string, Record<string, Record<string, Record<string, string>>>>;
const bundle: Bundle = JSON.parse(readFileSync(fileURLToPath(new URL('../data/lang.en-fr.json', import.meta.url)), 'utf8'));
const NAMESPACES: Record<string, string> = {
    'filament-panels': 'panels', 'filament-forms': 'forms', 'filament-tables': 'tables', 'filament-actions': 'actions', 'filament-schemas': 'schemas',
    'filament-notifications': 'notifications', 'filament-infolists': 'infolists', 'filament-widgets': 'widgets', 'filament-query-builder': 'query-builder', filament: 'support',
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
 * application may also override the translations of a plugin, or Navette's own (`filament-panels`, `filament-forms`…).
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

/** Translates a key such as `t('filament-panels::auth/pages/login.form.email.label')`; returns the key when it is missing. */
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

/** Relative past duration in English, e.g. "2 months ago". Dates without a time zone are read as UTC. */
export function diffForHumans(value: string | Date | null | undefined, now: Date = new Date()): string | null {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
    if (Number.isNaN(date.getTime())) return null;
    const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
    const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? '' : 's'} ago`;
    if (seconds < 60) return unit(seconds, 'second');
    if (seconds < 3600) return unit(Math.floor(seconds / 60), 'minute');
    if (seconds < 86400) return unit(Math.floor(seconds / 3600), 'hour');
    const days = Math.floor(seconds / 86400);
    if (days < 7) return unit(days, 'day');
    // Whole calendar months elapsed, not 30-day blocks.
    let months = (now.getUTCFullYear() - date.getUTCFullYear()) * 12 + now.getUTCMonth() - date.getUTCMonth();
    if (now.getUTCDate() < date.getUTCDate() || (now.getUTCDate() === date.getUTCDate() && now.getTime() % 86400000 < date.getTime() % 86400000)) months--;
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
