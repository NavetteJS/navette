// Traductions compatibles Laravel : `espace::groupe.clé`, paramètres `:nom`, repli sur l'anglais.
import { readFileSync } from 'node:fs';
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

/** `t('filament-panels::auth/pages/login.form.email.label')` */
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

/** Durée relative au passé, à la manière de Carbon::diffForHumans() en anglais : « 2 months ago ». Les dates sans fuseau sont lues en UTC. */
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
    // Mois calendaires entiers écoulés, comme Carbon.
    let months = (now.getUTCFullYear() - date.getUTCFullYear()) * 12 + now.getUTCMonth() - date.getUTCMonth();
    if (now.getUTCDate() < date.getUTCDate() || (now.getUTCDate() === date.getUTCDate() && now.getTime() % 86400000 < date.getTime() % 86400000)) months--;
    if (months < 1) return unit(Math.floor(days / 7), 'week');
    if (months < 12) return unit(months, 'month');
    return unit(Math.floor(months / 12), 'year');
}

/** Pluriels Laravel (`trans_choice`) : `{0} …|{1} …|[2,*] …` ou `singulier|pluriel`. `:count` est toujours disponible. */
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
