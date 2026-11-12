// Calculs de dates des widgets de la démo, alignés sur Carbon 3 (fuseau UTC, comme la démo Filament) pour donner les mêmes chiffres que l'oracle.
import { Model } from '@navette/database';

export const knex = () => Model.knex();
const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const now = () => new Date();
/** `Y-m-d H:i:s`, le format des dates en base. */
export const sql = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
/** Lit une date de la base (`Y-m-d H:i:s` ou `Y-m-d`) en UTC. */
export const parse = (value: string) => new Date(`${value.slice(0, 10)}T${value.length > 10 ? value.slice(11, 19) : '00:00:00'}Z`);
export const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
export const endOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1000);
/** Comme `subMonths()` de Carbon : le jour déborde sur le mois suivant quand le mois visé est plus court (31 mars − 1 mois = 3 mars). */
export const addMonths = (d: Date, n: number) => { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + n); return r; };
export const subMonths = (d: Date, n: number) => addMonths(d, -n);
export const subDays = (d: Date, n: number) => new Date(d.getTime() - n * 86400000);
/** Lundi 00:00:00 de la semaine de `d`. */
export const startOfWeek = (d: Date) => subDays(startOfDay(d), (d.getUTCDay() + 6) % 7);
/** Dimanche 23:59:59 de la semaine de `d`. */
export const endOfWeek = (d: Date) => new Date(startOfWeek(d).getTime() + 7 * 86400000 - 1000);
/** `Y-m` */
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
/** `M Y` (« Nov 2026 ») */
export const monthLabel = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
/** `M d` (« Nov 09 ») */
export const dayLabel = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}`;
/** Les `count` derniers débuts de mois, du plus ancien au mois courant : `range(count - 1, 0)->map(subMonths()->startOfMonth())`. */
export const lastMonths = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => startOfMonth(subMonths(now(), count - 1 - i + offset)));

/** `diffInDays()` de Carbon 3 : un nombre décimal, signé. */
export const diffInDays = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 86400000;
const daysInMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
/** `diffInMonths()` de Carbon 3 : mois entiers, plus la fraction du mois entamé. */
export function diffInMonths(from: Date, to: Date): number {
    const ascending = from <= to;
    const [start, end] = ascending ? [from, to] : [to, from];
    const rest = (d: Date) => sql(d).slice(8);
    let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
    if (months > 0 && rest(start) > rest(end)) months -= 1;
    const sign = ascending ? 1 : -1;
    const floorEnd = addMonths(start, months);
    if (floorEnd >= end) return sign * months;
    const nextMonth = new Date(Date.UTC(floorEnd.getUTCFullYear(), floorEnd.getUTCMonth() + 1, 1));
    if (nextMonth > end) return sign * (months + diffInDays(floorEnd, end) / daysInMonth(floorEnd));
    return sign * (months + diffInDays(floorEnd, nextMonth) / daysInMonth(floorEnd) + diffInDays(nextMonth, end) / daysInMonth(nextMonth));
}

/** `round()` de PHP : arrondi au plus proche, la demie s'éloignant de zéro. */
export function round(value: number, precision = 0): number {
    const factor = 10 ** precision;
    const scaled = Number((Math.abs(value) * factor).toPrecision(15));
    return (Math.sign(value) * Math.round(scaled)) / factor;
}
/** `Number::currency($value, in: 'USD')` */
export const usd = (value: number, precision = 2) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: precision, maximumFractionDigits: precision }).format(value);
/** Tronque comme `strlen($name) > $max ? substr($name, 0, $max) . '...' : $name` (en octets, comme PHP). */
export function truncate(name: string, max: number): string {
    const bytes = Buffer.from(name, 'utf8');
    return bytes.length > max ? bytes.subarray(0, max).toString('utf8') + '...' : name;
}
