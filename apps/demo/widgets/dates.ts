// Date helpers for the demo widgets. Everything is in UTC.
import { Model } from '@navette-js/database';

export const knex = () => Model.knex();
const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const now = () => new Date();
/** `Y-m-d H:i:s`, the date format stored in the database. */
export const sql = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
/** Parses a database date (`Y-m-d H:i:s` or `Y-m-d`) as UTC. */
export const parse = (value: string) => new Date(`${value.slice(0, 10)}T${value.length > 10 ? value.slice(11, 19) : '00:00:00'}Z`);
export const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
export const endOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1000);
/** The day overflows into the next month when the target month is shorter (March 31 − 1 month = March 3). */
export const addMonths = (d: Date, n: number) => { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + n); return r; };
export const subMonths = (d: Date, n: number) => addMonths(d, -n);
export const subDays = (d: Date, n: number) => new Date(d.getTime() - n * 86400000);
/** Monday 00:00:00 of the week of `d`. */
export const startOfWeek = (d: Date) => subDays(startOfDay(d), (d.getUTCDay() + 6) % 7);
/** Sunday 23:59:59 of the week of `d`. */
export const endOfWeek = (d: Date) => new Date(startOfWeek(d).getTime() + 7 * 86400000 - 1000);
/** `Y-m` */
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
/** `M Y` ("Nov 2026") */
export const monthLabel = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
/** `M d` ("Nov 09") */
export const dayLabel = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}`;
/** Start of each of the last `count` months, oldest first, ending with the current month. */
export const lastMonths = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => startOfMonth(subMonths(now(), count - 1 - i + offset)));

/** Signed, fractional number of days. */
export const diffInDays = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 86400000;
const daysInMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
/** Signed number of months: whole months plus the fraction of the month in progress. */
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

/** Rounds half away from zero, ignoring floating-point noise. */
export function round(value: number, precision = 0): number {
    const factor = 10 ** precision;
    const scaled = Number((Math.abs(value) * factor).toPrecision(15));
    return (Math.sign(value) * Math.round(scaled)) / factor;
}
export const usd = (value: number, precision = 2) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: precision, maximumFractionDigits: precision }).format(value);
/** Truncates to `max` UTF-8 bytes (not characters) and appends '...'. */
export function truncate(name: string, max: number): string {
    const bytes = Buffer.from(name, 'utf8');
    return bytes.length > max ? bytes.subarray(0, max).toString('utf8') + '...' : name;
}
