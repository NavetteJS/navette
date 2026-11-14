// Validation rules written as strings (`'max:255'`, `'regex:/^[a-z]+$/'`), as in Laravel, and their messages.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ComponentContext } from '@navette-js/schemas';
import { promises as dns } from 'node:dns';

const failedRules = new AsyncLocalStorage<Record<string, string[]>>();
/** Runs `fn` while recording the name of each validation rule that fails, by state path (read by the testing helpers). */
export async function recordFailedRules<T>(fn: () => Promise<T>): Promise<{ result: T; failedRules: Record<string, string[]> }> {
    const store: Record<string, string[]> = {};
    return failedRules.run(store, async () => ({ result: await fn(), failedRules: store }));
}
/** Records a failed rule, when `recordFailedRules()` is running. */
export function reportFailedRule(statePath: string, rule: string): void {
    const store = failedRules.getStore();
    if (store) (store[statePath] ??= []).push(rule);
}

/** `implicit`: the rule also runs on an empty value (required, accepted...); other rules are skipped when the value is empty. */
export type Rule = { name: string; passes: (value: unknown, ctx: ComponentContext) => boolean | Promise<boolean>; message: (attribute: string) => string; implicit?: boolean };
export const isBlank = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const isNumeric = (value: unknown) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
/** Size of a value: its number when numeric (for a numeric field), its length for text and lists. */
const sizeOf = (value: unknown, numeric: boolean) => (Array.isArray(value) ? value.length : numeric && isNumeric(value) ? Number(value) : String(value ?? '').length);
const unit = (value: unknown, numeric: boolean) => (Array.isArray(value) ? ' items' : numeric ? '' : ' characters');
const dateOf = (value: unknown): number | null => { const time = Date.parse(String(value ?? '')); return Number.isFinite(time) ? time : null; };
const list = (parameter: string) => parameter.split(',').map((item) => item.trim());
/** A Laravel `regex:` parameter (`/pattern/flags`) as a RegExp; only `i`, `m`, `s` and `u` flags. */
export function parseRegex(source: string): RegExp {
    const match = /^\/(.*)\/([imsu]*)$/s.exec(source.trim());
    if (!match) throw new Error(`Invalid regex rule: ${source} (expected /pattern/flags).`);
    return new RegExp(match[1], match[2]);
}
/** A sibling value of the same form, read from the component context (`confirmed`, `same`, `different`, `gt`...). */
const sibling = (ctx: ComponentContext, name: string) => ctx.get(name);
const compareTo = (parameter: string, ctx: ComponentContext): number | null => (isNumeric(parameter) ? Number(parameter) : isNumeric(sibling(ctx, parameter)) ? Number(sibling(ctx, parameter)) : null);

/**
 * Builds a rule from a string such as `'max:255'`. `numeric` tells whether sizes are compared as numbers (numeric fields).
 * An unknown rule throws when the field is declared, instead of being silently ignored.
 */
export function stringRule(spec: string, options: { numeric: boolean; name: string }): Rule | null {
    const colon = spec.indexOf(':');
    const name = (colon < 0 ? spec : spec.slice(0, colon)).trim();
    const parameter = colon < 0 ? '' : spec.slice(colon + 1);
    const numeric = options.numeric;
    const make = (passes: Rule['passes'], message: (attribute: string) => string): Rule => ({ name, passes, message });
    const implicit = (passes: Rule['passes'], message: (attribute: string) => string): Rule => ({ name, passes, message, implicit: true });
    const [otherField, ...otherValues] = list(parameter);
    const otherIs = (ctx: ComponentContext) => { const other = sibling(ctx, otherField); return (Array.isArray(other) ? other : [other]).some((item) => otherValues.includes(String(item ?? ''))); };
    const otherName = otherField?.replace(/_/g, ' ');
    switch (name) {
        case 'nullable': case 'sometimes': case 'bail': case 'present': return null;
        case 'string': return make((value) => typeof value === 'string', (a) => `The ${a} field must be a string.`);
        case 'active_url': return make((value) => hasDnsRecord(value), (a) => `The ${a} field must be a valid URL.`);
        case 'required': case 'filled': return implicit((value) => !isBlank(value), (a) => `The ${a} field is required.`);
        case 'required_if': return implicit((value, ctx) => !otherIs(ctx) || !isBlank(value), (a) => `The ${a} field is required when ${otherName} is ${otherValues.join(', ')}.`);
        case 'required_unless': return implicit((value, ctx) => otherIs(ctx) || !isBlank(value), (a) => `The ${a} field is required unless ${otherName} is in ${otherValues.join(', ')}.`);
        case 'required_if_declined': return implicit((value, ctx) => ![false, 0, '0', 'no', 'off', 'false'].includes(sibling(ctx, otherField) as any) || !isBlank(value), (a) => `The ${a} field is required when ${otherName} is declined.`);
        case 'required_if_accepted': return implicit((value, ctx) => ![true, 1, '1', 'yes', 'on', 'true'].includes(sibling(ctx, otherField) as any) || !isBlank(value), (a) => `The ${a} field is required when ${otherName} is accepted.`);
        case 'required_with': case 'required_with_all': case 'required_without': case 'required_without_all': {
            const fields = list(parameter);
            const present = (ctx: ComponentContext) => fields.map((field) => !isBlank(sibling(ctx, field)));
            const needed = { required_with: (p: boolean[]) => p.some(Boolean), required_with_all: (p: boolean[]) => p.every(Boolean), required_without: (p: boolean[]) => p.some((x) => !x), required_without_all: (p: boolean[]) => p.every((x) => !x) }[name];
            const words = { required_with: 'is present', required_with_all: 'are present', required_without: 'is not present', required_without_all: 'none of them are present' }[name];
            return implicit((value, ctx) => !needed(present(ctx)) || !isBlank(value), (a) => `The ${a} field is required when ${fields.map((field) => field.replace(/_/g, ' ')).join(' / ')} ${words}.`);
        }
        case 'prohibited': return implicit((value) => isBlank(value), (a) => `The ${a} field is prohibited.`);
        case 'prohibited_if': return implicit((value, ctx) => !otherIs(ctx) || isBlank(value), (a) => `The ${a} field is prohibited when ${otherName} is ${otherValues.join(', ')}.`);
        case 'prohibited_unless': return implicit((value, ctx) => otherIs(ctx) || isBlank(value), (a) => `The ${a} field is prohibited unless ${otherName} is in ${otherValues.join(', ')}.`);
        case 'prohibits': return make((_value, ctx) => list(parameter).every((field) => isBlank(sibling(ctx, field))), (a) => `The ${a} field prohibits ${list(parameter).map((field) => field.replace(/_/g, ' ')).join(' / ')} from being present.`);
        case 'accepted': return implicit((value) => [true, 1, '1', 'yes', 'on', 'true'].includes(value as any), (a) => `The ${a} field must be accepted.`);
        case 'declined': return implicit((value) => [false, 0, '0', 'no', 'off', 'false'].includes(value as any), (a) => `The ${a} field must be declined.`);
        case 'numeric': return make(isNumeric, (a) => `The ${a} field must be a number.`);
        case 'integer': return make((value) => /^-?\d+$/.test(String(value).trim()), (a) => `The ${a} field must be an integer.`);
        case 'boolean': return make((value) => [true, false, 0, 1, '0', '1'].includes(value as any), (a) => `The ${a} field must be true or false.`);
        case 'array': return make((value) => Array.isArray(value), (a) => `The ${a} field must be an array.`);
        case 'email': return make((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)), (a) => `The ${a} field must be a valid email address.`);
        case 'url': return make((value) => { try { return ['http:', 'https:'].includes(new URL(String(value)).protocol); } catch { return false; } }, (a) => `The ${a} field must be a valid URL.`);
        case 'uuid': return make((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value)), (a) => `The ${a} field must be a valid UUID.`);
        case 'ulid': return make((value) => /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(String(value)), (a) => `The ${a} field must be a valid ULID.`);
        case 'alpha': return make((value) => /^[\p{L}\p{M}]+$/u.test(String(value)), (a) => `The ${a} field must only contain letters.`);
        case 'alpha_dash': return make((value) => /^[\p{L}\p{M}\p{N}_-]+$/u.test(String(value)), (a) => `The ${a} field must only contain letters, numbers, dashes, and underscores.`);
        case 'alpha_num': return make((value) => /^[\p{L}\p{M}\p{N}]+$/u.test(String(value)), (a) => `The ${a} field must only contain letters and numbers.`);
        case 'ascii': return make((value) => /^[\x00-\x7F]*$/.test(String(value)), (a) => `The ${a} field must only contain single-byte alphanumeric characters and symbols.`);
        case 'lowercase': return make((value) => String(value) === String(value).toLowerCase(), (a) => `The ${a} field must be lowercase.`);
        case 'uppercase': return make((value) => String(value) === String(value).toUpperCase(), (a) => `The ${a} field must be uppercase.`);
        case 'json': return make((value) => { try { JSON.parse(String(value)); return true; } catch { return false; } }, (a) => `The ${a} field must be a valid JSON string.`);
        case 'ip': return make((value) => isIpv4(String(value)) || isIpv6(String(value)), (a) => `The ${a} field must be a valid IP address.`);
        case 'ipv4': return make((value) => isIpv4(String(value)), (a) => `The ${a} field must be a valid IPv4 address.`);
        case 'ipv6': return make((value) => isIpv6(String(value)), (a) => `The ${a} field must be a valid IPv6 address.`);
        case 'mac_address': return make((value) => /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(String(value)), (a) => `The ${a} field must be a valid MAC address.`);
        case 'hex_color': return make((value) => /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(value)), (a) => `The ${a} field must be a valid hexadecimal color.`);
        case 'date': return make((value) => dateOf(value) !== null, (a) => `The ${a} field must be a valid date.`);
        case 'min': return make((value) => sizeOf(value, numeric) >= Number(parameter), (a) => (numeric ? `The ${a} field must be at least ${parameter}.` : `The ${a} field must be at least ${parameter}${unit(undefined, numeric)}.`));
        case 'max': return make((value) => sizeOf(value, numeric) <= Number(parameter), (a) => (numeric ? `The ${a} field must not be greater than ${parameter}.` : `The ${a} field must not be greater than ${parameter}${unit(undefined, numeric)}.`));
        case 'size': return make((value) => sizeOf(value, numeric) === Number(parameter), (a) => (numeric ? `The ${a} field must be ${parameter}.` : `The ${a} field must be ${parameter}${unit(undefined, numeric)}.`));
        case 'between': { const [low, high] = list(parameter).map(Number); return make((value) => { const size = sizeOf(value, numeric); return size >= low && size <= high; }, (a) => `The ${a} field must be between ${low} and ${high}${unit(undefined, numeric)}.`); }
        case 'digits': return make((value) => new RegExp(`^\\d{${Number(parameter)}}$`).test(String(value)), (a) => `The ${a} field must be ${parameter} digits.`);
        case 'digits_between': { const [low, high] = list(parameter).map(Number); return make((value) => /^\d+$/.test(String(value)) && String(value).length >= low && String(value).length <= high, (a) => `The ${a} field must be between ${low} and ${high} digits.`); }
        case 'multiple_of': return make((value) => isNumeric(value) && Math.abs(Number(value) / Number(parameter) - Math.round(Number(value) / Number(parameter))) < 1e-9, (a) => `The ${a} field must be a multiple of ${parameter}.`);
        case 'in': return make((value) => (Array.isArray(value) ? value : [value]).every((item) => list(parameter).includes(String(item))), (a) => `The selected ${a} is invalid.`);
        case 'not_in': return make((value) => (Array.isArray(value) ? value : [value]).every((item) => !list(parameter).includes(String(item))), (a) => `The selected ${a} is invalid.`);
        case 'regex': { const pattern = parseRegex(parameter); return make((value) => pattern.test(String(value)), (a) => `The ${a} field format is invalid.`); }
        case 'not_regex': { const pattern = parseRegex(parameter); return make((value) => !pattern.test(String(value)), (a) => `The ${a} field format is invalid.`); }
        case 'starts_with': return make((value) => list(parameter).some((prefix) => String(value).startsWith(prefix)), (a) => `The ${a} field must start with one of the following: ${list(parameter).join(', ')}.`);
        case 'ends_with': return make((value) => list(parameter).some((suffix) => String(value).endsWith(suffix)), (a) => `The ${a} field must end with one of the following: ${list(parameter).join(', ')}.`);
        case 'doesnt_start_with': return make((value) => !list(parameter).some((prefix) => String(value).startsWith(prefix)), (a) => `The ${a} field must not start with one of the following: ${list(parameter).join(', ')}.`);
        case 'doesnt_end_with': return make((value) => !list(parameter).some((suffix) => String(value).endsWith(suffix)), (a) => `The ${a} field must not end with one of the following: ${list(parameter).join(', ')}.`);
        case 'distinct': return make((value) => !Array.isArray(value) || new Set(value.map(String)).size === value.length, (a) => `The ${a} field has a duplicate value.`);
        case 'confirmed': return make((value, ctx) => String(value) === String(sibling(ctx, parameter || `${options.name}_confirmation`) ?? ''), (a) => `The ${a} field confirmation does not match.`);
        case 'same': return make((value, ctx) => String(value) === String(sibling(ctx, parameter) ?? ''), (a) => `The ${a} field must match ${parameter.replace(/_/g, ' ')}.`);
        case 'different': return make((value, ctx) => String(value) !== String(sibling(ctx, parameter) ?? ''), (a) => `The ${a} field and ${parameter.replace(/_/g, ' ')} must be different.`);
        case 'gt': case 'gte': case 'lt': case 'lte': {
            const operator = { gt: (x: number, y: number) => x > y, gte: (x: number, y: number) => x >= y, lt: (x: number, y: number) => x < y, lte: (x: number, y: number) => x <= y }[name];
            const words = { gt: 'greater than', gte: 'greater than or equal to', lt: 'less than', lte: 'less than or equal to' }[name];
            return make((value, ctx) => { const other = compareTo(parameter, ctx); return other === null || operator(sizeOf(value, true), other); }, (a) => `The ${a} field must be ${words} ${isNumeric(parameter) ? parameter : parameter.replace(/_/g, ' ')}.`);
        }
        case 'after': case 'after_or_equal': case 'before': case 'before_or_equal': {
            const reference = (ctx: ComponentContext) => dateOf(parameter === 'today' ? new Date().toISOString().slice(0, 10) : parameter === 'tomorrow' ? new Date(Date.now() + 86400000).toISOString().slice(0, 10) : (dateOf(parameter) !== null ? parameter : sibling(ctx, parameter)));
            const test = { after: (x: number, y: number) => x > y, after_or_equal: (x: number, y: number) => x >= y, before: (x: number, y: number) => x < y, before_or_equal: (x: number, y: number) => x <= y }[name];
            const words = { after: 'after', after_or_equal: 'after or equal to', before: 'before', before_or_equal: 'before or equal to' }[name];
            return make((value, ctx) => { const own = dateOf(value), other = reference(ctx); return own !== null && (other === null || test(own, other)); }, (a) => `The ${a} field must be a date ${words} ${parameter.replace(/_/g, ' ')}.`);
        }
        default: throw new Error(`Unknown validation rule "${name}": write it as a custom rule with rule().`);
    }
}

function isIpv4(value: string): boolean { return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value); }
function isIpv6(value: string): boolean {
    if (!/^[0-9a-fA-F:.]+$/.test(value) || (value.match(/::/g) ?? []).length > 1) return false;
    const groups = value.split(':');
    return groups.length >= 3 && groups.length <= 8 && groups.every((group) => group === '' || /^[0-9a-fA-F]{1,4}$/.test(group) || isIpv4(group));
}

/** `active_url`: the host of the URL has a DNS A or AAAA record (looked up with a 5 second limit). */
async function hasDnsRecord(value: unknown): Promise<boolean> {
    let host: string;
    try { host = new URL(String(value)).hostname; } catch { return false; }
    if (!host) return false;
    const timeout = new Promise<false>((resolve) => { const timer = setTimeout(() => resolve(false), 5000); timer.unref?.(); });
    const lookup = (async () => {
        for (const resolve of [(name: string) => dns.resolve4(name), (name: string) => dns.resolve6(name)]) { try { if ((await resolve(host)).length) return true; } catch { /* no record of this type */ } }
        return false;
    })();
    return Promise.race([lookup, timeout]);
}
