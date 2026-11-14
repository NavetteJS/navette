// Formatting helpers of table columns and summarizers: Carbon `isoFormat()` dates, PHP-style numbers, money, and Laravel's
// `Str::limit()` / `Str::words()`.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (value: number, length = 2) => String(value).padStart(length, '0');
const ordinal = (n: number) => { const tens = n % 100; if (tens >= 11 && tens <= 13) return 'th'; return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'; };
const isTimeZone = (zone: string) => { try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; } };

/** Date of a state: a `Date`, or a database value (read as UTC when it has no zone). `null` when it is not a date. */
export function parseDateState(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
    if (typeof value !== 'string' || value.trim() === '') return null;
    let text = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text = `${text}T00:00:00Z`;
    else if (/^\d{2}:\d{2}(:\d{2})?$/.test(text)) text = `1970-01-01T${text}Z`;
    else if (!/[zZ]$|[+-]\d\d:?\d\d$/.test(text)) text = `${text.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')}Z`;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; ms: number; weekday: number; offset: number; zone: string; timestamp: number };
function dateParts(date: Date, timeZone: string): DateParts {
    const zone = isTimeZone(timeZone) ? timeZone : 'UTC';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(date).map((part) => [part.type, part.value]));
    const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day), hour = Number(parts.hour) % 24, minute = Number(parts.minute), second = Number(parts.second);
    const offset = Math.round((Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
    return { year, month, day, hour, minute, second, ms: date.getUTCMilliseconds(), weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), offset, zone: parts.timeZoneName ?? zone, timestamp: Math.floor(date.getTime() / 1000) };
}
const offsetText = (minutes: number, colon: boolean) => `${minutes < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(minutes) / 60))}${colon ? ':' : ''}${pad(Math.abs(minutes) % 60)}`;

/** English macro formats of Carbon's `isoFormat()`. */
const ISO_MACROS: Record<string, string> = {
    LT: 'h:mm A', LTS: 'h:mm:ss A', L: 'MM/DD/YYYY', LL: 'MMMM D, YYYY', LLL: 'MMMM D, YYYY h:mm A', LLLL: 'dddd, MMMM D, YYYY h:mm A',
    l: 'M/D/YYYY', ll: 'MMM D, YYYY', lll: 'MMM D, YYYY h:mm A', llll: 'ddd, MMM D, YYYY h:mm A',
};
const ISO_TOKEN = /\[[^\]]*\]|LTS|LT|LLLL|LLL|LL|L|llll|lll|ll|l|YYYY|YY|Qo|Q|MMMM|MMM|MM|Mo|M|DDDD|DDDo|DDD|Do|DD|D|dddd|ddd|dd|do|d|E|e|HH|H|hh|h|kk|k|mm|m|ss|s|SSS|SS|S|A|a|ZZ|Z|X|x|zz|z/g;

/** Date in a Carbon `isoFormat()` format (`L`, `LLL`, `dddd D MMMM YYYY`…), in English. Text in `[brackets]` is kept as is. */
export function formatIsoDate(date: Date, format: string, timeZone = 'UTC'): string {
    const p = dateParts(date, timeZone);
    const hour12 = p.hour % 12 || 12;
    const dayOfYear = Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 1)) / 86400000) + 1;
    const tokens: Record<string, () => string> = {
        YYYY: () => String(p.year), YY: () => pad(p.year % 100), Q: () => String(Math.ceil(p.month / 3)), Qo: () => `${Math.ceil(p.month / 3)}${ordinal(Math.ceil(p.month / 3))}`,
        MMMM: () => MONTHS[p.month - 1], MMM: () => MONTHS[p.month - 1].slice(0, 3), MM: () => pad(p.month), Mo: () => `${p.month}${ordinal(p.month)}`, M: () => String(p.month),
        DDDD: () => pad(dayOfYear, 3), DDDo: () => `${dayOfYear}${ordinal(dayOfYear)}`, DDD: () => String(dayOfYear), Do: () => `${p.day}${ordinal(p.day)}`, DD: () => pad(p.day), D: () => String(p.day),
        dddd: () => DAYS[p.weekday], ddd: () => DAYS[p.weekday].slice(0, 3), dd: () => DAYS[p.weekday].slice(0, 2), do: () => `${p.weekday}${ordinal(p.weekday)}`, d: () => String(p.weekday), e: () => String(p.weekday), E: () => String(p.weekday || 7),
        HH: () => pad(p.hour), H: () => String(p.hour), hh: () => pad(hour12), h: () => String(hour12), kk: () => pad(p.hour || 24), k: () => String(p.hour || 24),
        mm: () => pad(p.minute), m: () => String(p.minute), ss: () => pad(p.second), s: () => String(p.second),
        SSS: () => pad(p.ms, 3), SS: () => pad(Math.floor(p.ms / 10)), S: () => String(Math.floor(p.ms / 100)),
        A: () => (p.hour < 12 ? 'AM' : 'PM'), a: () => (p.hour < 12 ? 'am' : 'pm'), Z: () => offsetText(p.offset, true), ZZ: () => offsetText(p.offset, false),
        X: () => String(p.timestamp), x: () => String(date.getTime()), z: () => p.zone, zz: () => p.zone,
    };
    return format.replace(ISO_TOKEN, (token) => {
        if (token.startsWith('[')) return token.slice(1, -1);
        if (Object.hasOwn(ISO_MACROS, token)) return formatIsoDate(date, ISO_MACROS[token], timeZone);
        return tokens[token]();
    });
}

/** PHP `number_format()`: rounded to `decimals`, with the given separators. */
export function numberFormat(value: number, decimals: number, decimalSeparator: string, thousandsSeparator: string): string {
    const fixed = Math.abs(value).toFixed(Math.max(0, Math.min(20, Math.floor(decimals))));
    const [integer, fraction] = fixed.split('.');
    const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
    return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator)}${fraction ? `${decimalSeparator}${fraction}` : ''}`;
}
const fractionDigits = (digits: number | null | undefined) => (typeof digits === 'number' && Number.isFinite(digits) ? Math.max(0, Math.min(20, Math.floor(digits))) : null);
/** A locale tag usable by `Intl` (an invalid one falls back to `en-US`). */
const safeLocale = (locale: string | null | undefined): string => {
    if (!locale) return 'en-US';
    try { return Intl.NumberFormat.supportedLocalesOf([locale.replace('_', '-')]).length ? locale.replace('_', '-') : 'en-US'; } catch { return 'en-US'; }
};

/** Options of `numeric()`: `decimalPlaces`, `decimalSeparator`, `thousandsSeparator`, `maxDecimalPlaces` and `locale`. */
export type NumericFormatOptions = { decimalPlaces?: number | null; decimalSeparator?: string | null; thousandsSeparator?: string | null; maxDecimalPlaces?: number | null; locale?: string | null };
/** Options of `money()`: `divideBy` (100 for cents), `locale` and `decimalPlaces`. */
export type MoneyFormatOptions = { divideBy?: number | null; locale?: string | null; decimalPlaces?: number | null };

/** Laravel's `Number::format()`, or `number_format()` when a separator is given. */
export function formatNumber(value: number, options: NumericFormatOptions = {}): string {
    const decimals = fractionDigits(options.decimalPlaces);
    if ((options.decimalSeparator ?? null) !== null || (options.thousandsSeparator ?? null) !== null) return numberFormat(value, decimals ?? 0, options.decimalSeparator ?? '.', options.thousandsSeparator ?? ',');
    const max = fractionDigits(options.maxDecimalPlaces);
    const digits = max !== null ? { maximumFractionDigits: max } : decimals !== null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : {};
    return new Intl.NumberFormat(safeLocale(options.locale), digits).format(value);
}
/** Laravel's `Number::currency()`; an unknown currency code is shown as a plain number followed by the code. */
export function formatMoney(value: number, currency: string, options: MoneyFormatOptions = {}): string {
    let amount = value;
    if (options.divideBy) amount /= options.divideBy;
    const decimals = fractionDigits(options.decimalPlaces);
    const code = (currency || 'usd').toUpperCase();
    try {
        return new Intl.NumberFormat(safeLocale(options.locale), { style: 'currency', currency: code, ...(decimals !== null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : {}) }).format(amount);
    } catch {
        return `${formatNumber(amount, { decimalPlaces: decimals ?? 2, locale: options.locale })} ${code}`;
    }
}

/** Laravel's `Str::limit()`: at most `length` characters (trailing spaces removed), followed by `end`. */
export function limitText(text: string, length: number, end: string | null = '...'): string {
    const characters = [...text];
    if (characters.length <= length) return text;
    return `${characters.slice(0, Math.max(0, length)).join('').trimEnd()}${end ?? ''}`;
}
/** Laravel's `Str::words()`: at most `words` words, followed by `end`. */
export function limitWords(text: string, words: number, end: string | null = '...'): string {
    const match = new RegExp(`^\\s*(?:\\S+\\s*){1,${Math.max(1, Math.floor(words))}}`, 'u').exec(text);
    if (!match || [...match[0]].length === [...text].length) return text;
    return `${match[0].trimEnd()}${end ?? ''}`;
}
