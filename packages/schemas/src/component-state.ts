// State utilities shared by every schema component: relative state paths and keys, the `get()` / `set()` functions of the
// context object, `JsContent`, and aligned slot content (`Schema.start()`, `Schema.end()`, `Schema.between()`).
import { HtmlString, js } from '@navette-js/support';

/** Path segments that would reach the prototype of every object on the server. */
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
export const isSafeStatePath = (path: string): boolean => path.split('.').every((segment) => !FORBIDDEN_SEGMENTS.has(segment));

/** Reads a dotted path from an object (`data.items.0.name`); `undefined` when a step is missing. */
export function readStatePath(source: unknown, path: string): unknown {
    if (path === '') return source;
    return path.split('.').reduce((node: any, key) => (node === null || node === undefined ? undefined : node[key]), source);
}
/** Writes a dotted path into an object, creating the missing objects on the way. Refuses prototype segments. */
export function writeStatePath(target: unknown, path: string, value: unknown): void {
    if (!path || !isSafeStatePath(path) || target === null || typeof target !== 'object') return;
    const segments = path.split('.');
    let node: any = target;
    for (const key of segments.slice(0, -1)) {
        if (node[key] === null || typeof node[key] !== 'object') node[key] = {};
        node = node[key];
    }
    node[segments[segments.length - 1]] = value;
}

/**
 * Resolves a path relative to a container state path: `../` climbs one level, a leading `/` (or
 * `isAbsolute`) makes the path absolute (from the root of the Livewire component: `data.name`).
 */
export function resolveRelativePath(containerPath: string | null, path: string, isAbsolute = false): string {
    if (path.startsWith('/')) { isAbsolute = true; path = path.slice(1); }
    if (isAbsolute) return path;
    let base: string | null = containerPath || null;
    while (path.startsWith('../')) {
        base = base !== null && base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : null;
        path = path.slice(3);
    }
    if (path.startsWith('./')) path = path.slice(2);
    if (!base) return path;
    return path.replace(/^[./]+/, '') !== '' ? `${base}.${path}` : base;
}

/** Truthy as Laravel's `filled()`: not null, not an empty or blank string, not an empty list. */
const isFilled = (value: unknown): boolean => !(value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0));

/** `get()` of the context object, with typed helpers (`get.string('email')`…). */
export interface StateGetter {
    (path?: string, isAbsolute?: boolean): any;
    string(path: string, isNullable?: boolean, isAbsolute?: boolean): string | null;
    integer(path: string, isNullable?: boolean, isAbsolute?: boolean): number | null;
    float(path: string, isNullable?: boolean, isAbsolute?: boolean): number | null;
    boolean(path: string, isNullable?: boolean, isAbsolute?: boolean): boolean | null;
    array(path: string, isNullable?: boolean, isAbsolute?: boolean): unknown[] | Record<string, unknown> | null;
    date(path: string, isNullable?: boolean, isAbsolute?: boolean): Date | null;
    filled(path: string, isAbsolute?: boolean): boolean;
    blank(path: string, isAbsolute?: boolean): boolean;
}
/** `set()` of the context object: writes the state of another component (relative path, `../`, or absolute with `/`). */
export type StateSetter = (path: string, value: unknown, options?: { shouldCallUpdatedHooks?: boolean; isAbsolute?: boolean }) => void;

/** Builds the `get()` function of a component context: `source` is the Livewire component, or a reader of absolute paths. */
export function makeStateGetter(source: unknown, containerPath: string): StateGetter {
    const read = typeof source === 'function' ? (source as (path: string) => unknown) : (path: string) => readStatePath(source, path);
    const get = ((path = '', isAbsolute = false) => read(resolveRelativePath(containerPath, path, isAbsolute))) as StateGetter;
    get.string = (path, isNullable = false, isAbsolute = false) => { const value = get(path, isAbsolute); return isNullable && !isFilled(value) ? null : String(value ?? ''); };
    get.integer = (path, isNullable = false, isAbsolute = false) => { const value = get(path, isAbsolute); return isNullable && !isFilled(value) ? null : Math.trunc(Number(value) || 0); };
    get.float = (path, isNullable = false, isAbsolute = false) => { const value = get(path, isAbsolute); return isNullable && !isFilled(value) ? null : Number(value) || 0; };
    get.boolean = (path, isNullable = false, isAbsolute = false) => { const value = get(path, isAbsolute); return isNullable && (value === null || value === undefined) ? null : [true, 1, '1', 'true', 'on', 'yes'].includes(value); };
    get.array = (path, isNullable = false, isAbsolute = false) => { const value = get(path, isAbsolute); if (isNullable && !isFilled(value)) return null; return value !== null && typeof value === 'object' ? value : value === null || value === undefined ? [] : [value]; };
    get.date = (path, isNullable = false, isAbsolute = false) => {
        const value = get(path, isAbsolute);
        if (!isFilled(value)) return isNullable ? null : new Date();
        const date = value instanceof Date ? value : new Date(String(value));
        return Number.isNaN(date.getTime()) ? (isNullable ? null : new Date()) : date;
    };
    get.filled = (path, isAbsolute = false) => isFilled(get(path, isAbsolute));
    get.blank = (path, isAbsolute = false) => !isFilled(get(path, isAbsolute));
    return get;
}

/**
 * Text content computed in the browser by a JavaScript expression (`$state` and `$get()` are available), re-evaluated when
 * the state changes. Accepted wherever HTML is allowed (a field label, a `Text` in a slot…). The expression is evaluated with
 * `eval()`: only pass expressions written by the developer, never user input.
 */
export class JsContent extends HtmlString {
    readonly content: string;
    constructor(content: string) { super(`<span x-text="() => eval(${js(content).replace(/"/g, '&quot;')})"></span>`); this.content = content; }
    static make(content: string): JsContent { return new JsContent(content); }
}

/** Slot content with an alignment: built by `Schema.start()`, `Schema.end()` and `Schema.between()`. */
export class AlignedContent<T = unknown> {
    readonly alignment: 'start' | 'end' | 'between';
    readonly items: T[];
    constructor(alignment: 'start' | 'end' | 'between', items: T[]) { this.alignment = alignment; this.items = items; }
}
