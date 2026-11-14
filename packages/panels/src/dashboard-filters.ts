// Dashboard filters: the filters action (`FilterAction`), and the helpers that restore the filters from the URL or the
// session. Everything read here comes from the browser (query string) or was written by it (session): it is bounded and
// sanitized, never trusted as-is.
import { Action } from '@navette-js/actions';
import { Field } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';
import { icons } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { Notification } from './notifications.ts';

/** Marks the actions made by `FilterAction.make()`, so the dashboard knows its filters are edited in a modal. */
const FILTER_ACTION = Symbol('navette.dashboard.filterAction');

/**
 * Dashboard filters in a modal, opened by a button of the page header: register it in the dashboard's
 * `getHeaderActions()` and give it the filter fields with `schema([...])`. The form is validated before the
 * filters are applied; "Cancel" discards the changes.
 */
export class FilterAction {
    static getDefaultName(): string { return 'filter'; }
    static make(name: string = FilterAction.getDefaultName()): Action {
        const action = Action.make(name)
            .label(t('navette-panels::pages/dashboard.actions.filter.label'))
            .modalHeading(() => t('navette-panels::pages/dashboard.actions.filter.modal.heading'))
            .modalSubmitActionLabel(t('navette-panels::pages/dashboard.actions.filter.modal.actions.apply.label'))
            .icon(icons.resolve('panels::pages.dashboard.actions.filter') ?? 'm-funnel')
            .color('gray')
            .fillForm(({ livewire }: any) => {
                if (!livewire || !('filters' in livewire)) throw new Error(`The [${livewire?.constructor?.name}] page must be a Dashboard to use FilterAction.`);
                return livewire.filters ?? {};
            })
            .action(({ data, livewire, action: self }: any) => {
                if (!livewire || !('filters' in livewire)) return;
                livewire.filters = data;
                const title = self?.getSuccessNotificationTitle?.();
                if (title) Notification.make().success().title(title).send();
            })
            .slideOver()
            .modalWidth('md');
        (action as any)[FILTER_ACTION] = true;
        return action;
    }
}
/** Whether an action was made by `FilterAction.make()`. */
export const isFilterAction = (action: unknown): boolean => !!action && (action as any)[FILTER_ACTION] === true;

const MAX_DEPTH = 4;
const MAX_KEYS = 100;
const MAX_STRING = 1000;
const KEY = /^[A-Za-z0-9_-]{1,100}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Filter state received from the browser (query string, session): plain objects, arrays, strings, numbers, booleans
 * and `null`, with a bounded depth, number of keys and string length. Anything else is dropped.
 */
export function sanitizeFilterState(value: unknown, depth = 0): unknown {
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') return value.slice(0, MAX_STRING);
    if (depth >= MAX_DEPTH || typeof value !== 'object') return undefined;
    if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((item) => sanitizeFilterState(item, depth + 1)).filter((item) => item !== undefined);
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
        if (!KEY.test(key) || FORBIDDEN_KEYS.has(key)) continue;
        const clean = sanitizeFilterState(item, depth + 1);
        if (clean !== undefined) out[key] = clean;
    }
    return out;
}

/** Query string values are strings: `'null'`, `'true'` and `'false'` become `null`, `true` and `false`. */
export function normalizeFilterValuesFromQueryString(data: unknown): unknown {
    if (Array.isArray(data)) return data.map(normalizeFilterValuesFromQueryString);
    if (data && typeof data === 'object') return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, normalizeFilterValuesFromQueryString(value)]));
    if (data === 'null') return null;
    if (data === 'true') return true;
    if (data === 'false') return false;
    return data;
}

/**
 * Reads the `<name>` property from a query string object, written by Livewire as `filters[startDate]=…` and
 * `filters[orderStatuses][0]=…`. Works with Express's simple parser (flat bracketed keys) and with the extended one
 * (nested objects). Returns `null` when absent or empty.
 */
export function readQueryStringProperty(query: Record<string, unknown> | null | undefined, name: string): Record<string, unknown> | null {
    if (!query || typeof query !== 'object') return null;
    let result: Record<string, unknown> | null = null;
    const nested = query[name];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) result = sanitizeFilterState(nested) as Record<string, unknown>;
    let count = 0;
    for (const [rawKey, rawValue] of Object.entries(query)) {
        if (!rawKey.startsWith(`${name}[`) || ++count > MAX_KEYS) continue;
        const segments = rawKey.slice(name.length).match(/^(\[[^[\]]*\])+$/) ? [...rawKey.slice(name.length).matchAll(/\[([^[\]]*)\]/g)].map((m) => m[1]) : null;
        if (!segments || segments.length > MAX_DEPTH || segments.some((segment) => !KEY.test(segment) || FORBIDDEN_KEYS.has(segment))) continue;
        const value = Array.isArray(rawValue) ? rawValue[rawValue.length - 1] : rawValue;
        if (typeof value !== 'string') continue;
        result ??= {};
        let node: any = result;
        for (const [index, segment] of segments.entries()) {
            if (index === segments.length - 1) { node[segment] = value.slice(0, MAX_STRING); break; }
            if (!node[segment] || typeof node[segment] !== 'object') node[segment] = /^\d+$/.test(segments[index + 1]) ? [] : {};
            node = node[segment];
        }
    }
    if (!result) return null;
    // Livewire writes lists as `[0]`, `[1]`…: arrays built above may have holes if indexes were skipped.
    const compact = (value: unknown): unknown => (Array.isArray(value) ? value.filter((item) => item !== undefined).map(compact) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compact(item)])) : value);
    const clean = compact(result) as Record<string, unknown>;
    return Object.keys(clean).length ? clean : null;
}

/**
 * Fills a filters form from restored filters: each field takes the restored value,
 * or `null` when it has none (defaults only apply when nothing was restored). Values that do not belong to a field
 * of the form are dropped.
 */
export function fillFiltersSchema(schema: Schema, target: Record<string, unknown>, restored: Record<string, unknown>): void {
    const prefix = schema.getStatePath();
    for (const component of schema.getFlatComponents() as any[]) {
        if (!(component instanceof Field)) continue;
        const path = String(component.getStatePath());
        const segments = (prefix && path.startsWith(`${prefix}.`) ? path.slice(prefix.length + 1) : path).split('.');
        let value: unknown = restored;
        for (const segment of segments) value = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, segment) ? (value as any)[segment] : undefined;
        let node: any = target;
        for (const segment of segments.slice(0, -1)) node = (node[segment] && typeof node[segment] === 'object') ? node[segment] : (node[segment] = {});
        node[segments[segments.length - 1]] = component.hydrateState(value ?? null);
    }
}
