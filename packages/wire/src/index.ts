// @navette-js/wire — server runtime for stateful components, speaking the Livewire client protocol (livewire.js 4.4.8).
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { UploadStore } from './uploads.ts';
export { UploadStore, type TemporaryFile } from './uploads.ts';

export type Effects = {
    html?: string;
    returns?: unknown[];
    dispatches?: { name: string; params: Record<string, unknown>; self?: boolean; to?: string }[];
    redirect?: string;
    redirectUsingNavigate?: boolean;
    partials?: Record<string, string>;
    [key: string]: unknown;
};
export type Snapshot = { data: Record<string, unknown>; memo: Record<string, any>; checksum: string };
export type Call = { method: string; params: unknown[]; metadata?: Record<string, unknown> };
/** Child property bound to a parent property (`wire:model` on a child component). */
export type ModelBinding = { property: string; outer: string; directive?: string };
type ComponentClass = (new () => Component) & { componentName?: string; callable?: string[]; locked?: string[]; reactive?: string[]; listeners?: Record<string, string> };

export class WireError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Base class of a component. Every own enumerable property not starting with `_` is public state. */
export abstract class Component {
    _id = '';
    _effects: Effects = {};
    _skipRender = false;
    _errors: Record<string, string[]> = {};
    /** Context of the current HTTP request (request, response, panel…), supplied by the integration. */
    _ctx: any = null;

    /** Runtime and originating request, used to mount child components while rendering. */
    _runtime: WireRuntime | null = null;
    _request: { path?: string; method?: string } = {};
    /** Children rendered during this request, and children already in the browser: key → [tag, id]. */
    _children: Record<string, [string, string]> = {};
    _previousChildren: Record<string, [string, string]> = {};
    /** Values of the properties updated in this request, before the update (by updated path): the `$old` state of form fields. */
    _oldValues: Map<string, unknown> = new Map();

    /** HTML shown until a lazy component is loaded; must have a single root. */
    placeholder(): string | Promise<string> { return '<div></div>'; }

    /**
     * Mounts a child component and returns its HTML, to insert into the parent's render.
     * If the browser already has this child (same key), only a stub is rendered and the client keeps the child as is.
     * `lazy`: the child shows its `placeholder()` and loads once it becomes visible.
     * `model`: binds a child property to a property of this component, like `wire:model` on a Livewire child with a
     * `#[Modelable]` property: `{ property: 'state', outer: 'data.categories' }`. Pass the current outer value in `params`
     * under the child property name; the parent sends it again whenever it renders the child's stub.
     */
    async mountChild(name: string, params: Record<string, unknown> = {}, key: string, options: { lazy?: boolean; model?: ModelBinding } = {}): Promise<string> {
        if (!this._runtime) throw new Error('mountChild(): component is not attached to a runtime.');
        const previous = this._previousChildren[key];
        if (previous) {
            this._children[key] = previous;
            // Reactive props: the child, updated later in the same request, picks these values up.
            this._runtime.passPropsToChild(previous[1], params);
            return `<${previous[0]} wire:id="${previous[1]}" wire:name="${escapeAttr(name)}" wire:key="${escapeAttr(key)}"></${previous[0]}>`;
        }
        const { html, component } = await this._runtime.mountWithInstance(name, params, { ...this._request, ctx: this._ctx, lazy: options.lazy, key, model: options.model });
        this._children[key] = [/^\s*<([a-zA-Z0-9-]+)/.exec(html)![1], component.id];
        return html;
    }

    /** Renders the component's HTML; must have a single root element. */
    abstract render(): string | Promise<string>;

    mount(_params: Record<string, unknown>): void | Promise<void> {}
    boot(): void | Promise<void> {}
    hydrate(): void | Promise<void> {}
    dehydrate(): void | Promise<void> {}

    get id(): string { return this._id; }

    /** Dispatches a browser event; with `self`, only this component receives it. */
    dispatch(name: string, params: Record<string, unknown> | unknown[] = {}, options: { self?: boolean } = {}): void {
        (this._effects.dispatches ??= []).push({ name, params: params as any, ...(options.self ? { self: true } : {}) });
    }
    redirect(url: string, navigate = false): void {
        this._effects.redirect = url;
        if (navigate) this._effects.redirectUsingNavigate = true;
    }
    skipRender(): void { this._skipRender = true; }
    /** Partial render: only the `wire:partial="<name>"` fragment is sent back (effects.partials), the component is not re-rendered. */
/**
     * JavaScript run once in the browser for this component, with `$wire` in scope (Livewire's `@script`). Call it while rendering;
     * `key` identifies the script: it is sent again only if the browser has not run it yet.
     */
    addScript(key: string, js: string): void { ((this._effects.scripts ??= {}) as Record<string, string>)[key] = `<script>${js}</script>`; }
    renderPartial(name: string, html: string): void { (this._effects.partials ??= {})[name] = html; this._skipRender = true; }
    addError(path: string, message: string): void { (this._errors[path] ??= []).push(message); }
    resetErrorBag(): void { this._errors = {}; }
}

const LIFECYCLE = new Set(['constructor', 'render', 'mount', 'boot', 'hydrate', 'dehydrate', 'dispatch', 'redirect', 'skipRender', 'renderPartial', 'addError', 'resetErrorBag', 'mountChild', 'placeholder']);
// Only property hooks (updatingFoo / updatedFoo) are reserved by prefix: `mountAction`, for example, is an ordinary public method.
const isLifecycleHook = (m: string) => LIFECYCLE.has(m) || /^(updating|updated)[A-Z]/.test(m) || m.startsWith('_');

/**
 * Methods callable from the browser: only those the class (or a parent class) lists in `static callable`.
 * TypeScript erases `protected` and `private` at runtime: without this allowlist, any internal method could be called by a
 * forged request and its return value sent back to the browser.
 */
export function callableMethods(component: Component): Set<string> {
    const out = new Set<string>();
    for (let cls: any = component.constructor; cls && cls !== Component; cls = Object.getPrototypeOf(cls)) {
        if (!Object.prototype.hasOwnProperty.call(cls, 'callable') || !Array.isArray(cls.callable)) continue;
        for (const name of cls.callable) if (typeof name === 'string' && !isLifecycleHook(name) && typeof (component as any)[name] === 'function') out.add(name);
    }
    return out;
}

/** Properties the browser may not change: those the class or any parent class lists in `static locked`. */
export function lockedProperties(component: Component): Set<string> {
    const out = new Set<string>();
    for (let cls: any = component.constructor; cls && cls !== Component; cls = Object.getPrototypeOf(cls)) {
        if (Object.prototype.hasOwnProperty.call(cls, 'locked') && Array.isArray(cls.locked)) for (const name of cls.locked) out.add(name);
    }
    return out;
}

export function publicProperties(component: Component): string[] {
    return Object.keys(component).filter((k) => !k.startsWith('_'));
}

// Wire format: arrays and objects travel as [value, { s: 'arr' }] tuples.
export function dehydrateValue(value: unknown): unknown {
    if (value === undefined) return null;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return [value.map(dehydrateValue), { s: 'arr' }];
    return [Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dehydrateValue(v)])), { s: 'arr' }];
}
export function hydrateValue(value: unknown): unknown {
    if (Array.isArray(value) && value.length === 2 && value[1] && typeof value[1] === 'object' && 's' in (value[1] as object)) {
        const inner = value[0];
        if (Array.isArray(inner)) return inner.map(hydrateValue);
        return Object.fromEntries(Object.entries(inner as object).map(([k, v]) => [k, hydrateValue(v)]));
    }
    return value;
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#039;');

/** Adds attributes to the root element of an HTML fragment. */
export function insertAttributesIntoHtmlRoot(html: string, attributes: Record<string, unknown>): string {
    const m = /^\s*<([a-zA-Z0-9-]+)/.exec(html);
    if (!m) throw new WireError(500, 'A component render must start with a root element.');
    const attrs = Object.entries(attributes)
        .map(([k, v]) => `${k}="${escapeAttr(typeof v === 'string' ? v : JSON.stringify(v))}"`)
        .join(' ');
    const at = m.index + m[0].length;
    return html.slice(0, at) + ' ' + attrs + html.slice(at);
}

function setByPath(target: any, segments: string[], value: unknown): void {
    let node = target;
    for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
        if (node[key] === null || typeof node[key] !== 'object') node[key] = {};
        node = node[key];
    }
    const last = segments[segments.length - 1];
    if (value === '__rm__') { Array.isArray(node) ? node.splice(Number(last), 1) : delete node[last]; } else node[last] = value;
}
/** 20-character alphanumeric id (used in HTML ids and CSS selectors, so no symbols). */
const randomId = () => Array.from(randomBytes(20), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
const MAGIC_ACTIONS = new Set(['$refresh', '$set', '$sync', '$commit']);
const studly =(s: string) => s.replace(/(^|[_.-])(\w)/g, (_, __, c) => c.toUpperCase());

export type RuntimeOptions = { key: string; locale?: string; /** Temporary upload store; without it, file uploads are refused. */ uploads?: UploadStore; uploadPrefix?: string };

/** False if the value contains, at any depth, a temporary file reference that does not point to a received file. */
function uploadReferencesAreValid(value: unknown, store: UploadStore | null, depth = 0): boolean {
    if (typeof value === 'string') return value.startsWith('livewire-files:') ? false : value.startsWith('livewire-file:') ? !!store?.resolve(value) : true;
    if (!value || typeof value !== 'object') return true;
    if (depth > 8) return false;
    return Object.values(value as object).every((v) => uploadReferencesAreValid(v, store, depth + 1));
}

/** Reactive props of a component (`static reactive`): set by the parent, never by the browser. */
const reactiveProps = (component: Component): string[] => (component.constructor as ComponentClass).reactive ?? [];
/** Alpine attributes binding a modelable child property to its parent's (`wire:model="$parent.x"`, `x-modelable`). */
const modelAttributes = (bindings: Record<string, string>, directives: Record<string, string>): Record<string, string> => {
    const [outer, inner] = Object.entries(bindings)[0] ?? [];
    return outer ? { [directives[outer] ?? 'wire:model']: `$parent.${outer}`, 'x-modelable': `$wire.${inner}` } : {};
};
const SAFE_PATH = /^[A-Za-z_][A-Za-z0-9_]*(.[A-Za-z0-9_-]+)*$/;
const SAFE_DIRECTIVE = /^wire:model(.[a-z]+)*$/;

export class WireRuntime {
    private registry = new Map<string, ComponentClass>();
    private options: RuntimeOptions;
    constructor(options: RuntimeOptions) { this.options = options; }
    get uploads(): UploadStore | null { return this.options.uploads ?? null; }
    /** Prefix of the upload and preview endpoints (`/livewire` by default). */
    get uploadPrefix(): string { return this.options.uploadPrefix ?? '/livewire'; }

    /** Params passed by a parent to its existing children during the current request: child id → params. */
    private requestScope = new AsyncLocalStorage<{ childProps: Map<string, Record<string, unknown>> }>();
    passPropsToChild(childId: string, params: Record<string, unknown>): void { this.requestScope.getStore()?.childProps.set(childId, params); }

    private names = new Map<ComponentClass, string>();
    /** Whether a component is registered under this name. */
    has(name: string): boolean { return this.registry.has(name); }
    register(name: string, cls: ComponentClass): this { this.registry.set(name, cls); if (!this.names.has(cls)) this.names.set(cls, name); cls.componentName = name; return this; }
    /** Name under which this runtime registered a class. A class shared by several runtimes (one per panel) keeps one name per runtime. */
    nameOf(cls: ComponentClass): string { return this.names.get(cls) ?? cls.componentName ?? ''; }

    private make(name: string): Component {
        const cls = this.registry.get(name);
        if (!cls) throw new WireError(404, `Unknown component: ${name}`);
        return new cls();
    }

    checksum(snapshot: Omit<Snapshot, 'checksum'>): string {
        const { children: _children, ...memo } = snapshot.memo; // the client may rewrite `children`, so it is not signed
        return createHmac('sha256', this.options.key).update(JSON.stringify({ data: snapshot.data, memo })).digest('hex');
    }

    private snapshot(component: Component, name: string, memo: Record<string, unknown>): Snapshot {
        const data: Record<string, unknown> = {};
        for (const k of publicProperties(component)) data[k] = dehydrateValue((component as any)[k]);
        const body = { data, memo: { id: component.id, name, ...memo, errors: component._errors } };
        return { ...body, checksum: this.checksum(body) };
    }

    /** Signed mount params of a lazy component, in a `__mountParamsContainer`: the browser sends them back unchanged to `__lazyLoad`. */
    private encodeMountParams(name: string, params: Record<string, unknown>, request: { path?: string; method?: string }): string {
        const body = { data: { forMount: dehydrateValue(params), forComponent: name }, memo: { id: randomId(), name: '__mountParamsContainer', path: request.path ?? '/', method: request.method ?? 'GET', release: 'a-a-a' } };
        return Buffer.from(JSON.stringify({ ...body, checksum: this.checksum(body) })).toString('base64');
    }
    private decodeMountParams(name: string, encoded: unknown): Record<string, unknown> {
        let container: any;
        try { container = JSON.parse(Buffer.from(String(encoded), 'base64').toString('utf8')); } catch { throw new WireError(404, 'Unreadable mount params.'); }
        if (!container || typeof container.data !== 'object' || typeof container.memo !== 'object' || typeof container.checksum !== 'string') throw new WireError(404, 'Invalid mount params.');
        const expected = Buffer.from(this.checksum(container)), given = Buffer.from(container.checksum);
        if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new WireError(419, 'Invalid mount params checksum.');
        // Params signed for one component are not valid for another.
        if (container.memo.name !== '__mountParamsContainer' || container.data.forComponent !== name) throw new WireError(403, 'Mount params were issued for another component.');
        return (hydrateValue(container.data.forMount) ?? {}) as Record<string, unknown>;
    }
    /** A mount param named like a public property is copied into it. */
    private assignMatchingProperties(component: Component, params: Record<string, unknown>): void {
        const known = new Set(publicProperties(component));
        for (const [k, v] of Object.entries(params)) if (known.has(k)) (component as any)[k] = v;
    }

    private async renderRoot(component: Component, name: string, bindings: { bindings: Record<string, string>; directives: Record<string, string> } | null = null): Promise<string> {
        const html = await component.render();
        return insertAttributesIntoHtmlRoot(html, { 'wire:id': component.id, 'wire:name': name, ...(bindings ? modelAttributes(bindings.bindings, bindings.directives) : {}) });
    }

    /**
     * Initial render: HTML with wire:snapshot and wire:effects on the root.
     * The memo only carries `lazyLoaded` / `lazyIsolated` for lazy components: their mere presence makes the client ignore events.
     */
    async mount(name: string, params: Record<string, unknown> = {}, request: { path?: string; method?: string; ctx?: unknown } = {}): Promise<string> {
        return (await this.mountWithInstance(name, params, request)).html;
    }
    /** Like mount(), but also returns the mounted instance (to read its title, for example). */
    async mountWithInstance(name: string, params: Record<string, unknown> = {}, request: { path?: string; method?: string; ctx?: unknown; lazy?: boolean; key?: string; model?: ModelBinding } = {}): Promise<{ html: string; component: Component; snapshot: Snapshot; effects: Effects }> {
        const component = this.make(name);
        const model = request.model ?? null;
        if (model && (!SAFE_PATH.test(model.outer) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(model.property) || !SAFE_DIRECTIVE.test(model.directive ?? 'wire:model'))) throw new Error(`mountChild(): invalid model binding for ${name}.`);
        const bindings = model ? { bindings: { [model.outer]: model.property }, directives: { [model.outer]: model.directive ?? 'wire:model' } } : null;
        component._ctx = request.ctx ?? null;
        component._id = randomId();
        component._runtime = this;
        component._request = { path: request.path, method: request.method };
        await component.boot();
        this.assignMatchingProperties(component, params);
        let html: string;
        if (request.lazy) {
            // Lazy component: `mount()` and rendering wait for the browser's `__lazyLoad` call.
            const placeholder = insertAttributesIntoHtmlRoot(await component.placeholder(), { 'x-intersect': `$wire.__lazyLoad('${this.encodeMountParams(name, params, request)}')` });
            html = insertAttributesIntoHtmlRoot(placeholder, { 'wire:id': component.id, 'wire:name': name });
        } else {
            await component.mount(params);
            html = await this.renderRoot(component, name, bindings);
        }
        await component.dehydrate();
        const snapshot = this.snapshot(component, name, {
            path: request.path ?? '/', method: request.method ?? 'GET', release: 'a-a-a', children: Object.keys(component._children).length ? component._children : [], scripts: Object.keys((component._effects.scripts as Record<string, string> | undefined) ?? {}), assets: [],
            ...(request.lazy ? { lazyLoaded: false, lazyIsolated: true } : {}), ...(reactiveProps(component).length ? { props: reactiveProps(component) } : {}), ...(bindings ? { bindings: bindings.bindings, bindingsDirectives: bindings.directives } : {}), locale: this.options.locale ?? 'en', islands: [],
        });
        const { html: _h, ...effects } = component._effects;
        // Event listeners: the client calls `__dispatch(event, params)` when one fires.
        const listeners = Object.keys((component.constructor as ComponentClass).listeners ?? {});
        if (listeners.length) effects.listeners = listeners;
        return { html: insertAttributesIntoHtmlRoot(html, { ...(request.key !== undefined ? { 'wire:key': request.key } : {}), 'wire:snapshot': JSON.stringify(snapshot), 'wire:effects': JSON.stringify(effects) }), component, snapshot, effects };
    }

    /** Component update request: hydrate, apply updates, run calls, render, dehydrate. */
    async update(snapshot: Snapshot, updates: Record<string, unknown>, calls: Call[], ctx: unknown = null): Promise<{ snapshot: Snapshot; effects: Effects }> {
        const { snapshot: next, effects } = await this.updateWithInstance(snapshot, updates, calls, ctx);
        return { snapshot: next, effects };
    }
    /** Like update(), but also returns the hydrated instance, as it was after the request (testing helpers read it). */
    async updateWithInstance(snapshot: Snapshot, updates: Record<string, unknown>, calls: Call[], ctx: unknown = null): Promise<{ snapshot: Snapshot; effects: Effects; component: Component }> {
        if (!snapshot || typeof snapshot.data !== 'object' || typeof snapshot.memo !== 'object' || typeof snapshot.checksum !== 'string') throw new WireError(404, 'Invalid snapshot.');
        const expected = Buffer.from(this.checksum(snapshot)), given = Buffer.from(snapshot.checksum);
        if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new WireError(419, 'Invalid snapshot checksum.');

        const name = snapshot.memo.name as string;
        const component = this.make(name);
        const cls = component.constructor as ComponentClass;
        component._id = snapshot.memo.id;
        component._ctx = ctx;
        component._errors = { ...(snapshot.memo.errors ?? {}) };
        component._runtime = this;
        component._request = { path: snapshot.memo.path, method: snapshot.memo.method };
        // `memo.children` is not covered by the checksum (the client maintains it): only well-formed entries are kept.
        if (snapshot.memo.children && typeof snapshot.memo.children === 'object' && !Array.isArray(snapshot.memo.children)) {
            for (const [key, value] of Object.entries(snapshot.memo.children as Record<string, unknown>)) {
                if (Array.isArray(value) && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(String(value[0])) && /^[A-Za-z0-9]{1,64}$/.test(String(value[1]))) component._previousChildren[key] = [String(value[0]), String(value[1])];
            }
        }
        const awaitsLazyLoad = snapshot.memo.lazyLoaded === false;
        let lazyLoaded = false;
        const known = new Set(publicProperties(component));
        for (const [k, v] of Object.entries(snapshot.data)) if (known.has(k)) (component as any)[k] = hydrateValue(v);
        // Reactive props only come from the parent, rendered earlier in the same request.
        const reactive = new Set(reactiveProps(component));
        const passed = this.requestScope.getStore()?.childProps.get(component.id);
        if (passed) for (const prop of reactive) if (Object.prototype.hasOwnProperty.call(passed, prop) && known.has(prop)) (component as any)[prop] = passed[prop];
        // Modelable property (`wire:model` on the child): seeded with the parent's value when the parent rendered it in this request.
        // The bindings are part of the signed memo, so the browser cannot choose which property the parent seeds.
        const bindings = snapshot.memo.bindings && typeof snapshot.memo.bindings === 'object' ? { bindings: snapshot.memo.bindings as Record<string, string>, directives: (snapshot.memo.bindingsDirectives ?? {}) as Record<string, string> } : null;
        if (passed && bindings) for (const prop of Object.values(bindings.bindings)) if (Object.prototype.hasOwnProperty.call(passed, prop) && known.has(prop)) (component as any)[prop] = passed[prop];
        await component.boot();
        await component.hydrate();

        const locked = lockedProperties(component);
        const applyUpdate = async (path: string, value: unknown): Promise<void> => {
            const segments = path.split('.');
            const prop = segments[0];
            if (!known.has(prop)) throw new WireError(404, `Public property not found: ${prop}`);
            if (locked.has(prop)) throw new WireError(403, `Locked property: ${prop}`);
            if (reactive.has(prop)) throw new WireError(403, `Reactive property, set by the parent component: ${prop}`);
            // A segment such as `__proto__` would write into the prototype shared by every object on the server.
            if (segments.some((segment) => segment === '__proto__' || segment === 'constructor' || segment === 'prototype')) throw new WireError(403, `State path rejected: ${path}`);
            const anyC = component as any;
            await anyC.updating?.(path, value);
            await anyC[`updating${studly(prop)}`]?.(value, segments.slice(1).join('.') || null);
            if (!component._oldValues.has(path)) {
                const previous = segments.reduce((node: any, key) => (node === null || node === undefined ? undefined : node[key]), component);
                let copy = previous;
                if (previous !== null && typeof previous === 'object') { try { copy = structuredClone(previous); } catch { copy = JSON.parse(JSON.stringify(previous)); } }
                component._oldValues.set(path, copy);
            }
            setByPath(component, segments, value);
            await anyC.updated?.(path, value);
            await anyC[`updated${studly(prop)}`]?.(value, segments.slice(1).join('.') || null);
        };
        for (const [path, value] of Object.entries(updates)) {
            // A temporary file reference sent by the browser must point to a file that was actually received.
            if (!uploadReferencesAreValid(value, this.uploads)) throw new WireError(403, `File reference rejected: ${path}`);
            await applyUpdate(path, value);
        }

        const allowed = callableMethods(component);
        const returns: unknown[] = [];
        for (const call of calls) {
            if (typeof call?.method !== 'string' || !Array.isArray(call.params)) throw new WireError(404, 'Invalid call.');
            // Magic actions are no-ops on the server: their values travel in `updates`.
            if (MAGIC_ACTIONS.has(call.method)) { returns.push(null); continue; }
            if (call.method === '__lazyLoad') {
                if (!awaitsLazyLoad || lazyLoaded) throw new WireError(404, 'This component is not waiting for a lazy load.');
                const params = this.decodeMountParams(name, call.params[0]);
                this.assignMatchingProperties(component, params);
                await component.mount(params);
                lazyLoaded = true;
                returns.push(null);
                continue;
            }
            // Until it is loaded, a lazy component has not been mounted: nothing else is callable.
            if (awaitsLazyLoad && !lazyLoaded) throw new WireError(404, 'Component not loaded yet.');
            // File uploads: the target is a state path, subject to the same guards as an update.
            if (call.method === '_startUpload' || call.method === '_finishUpload' || call.method === '_uploadErrored' || call.method === '_removeUpload') {
                const store = this.uploads;
                const target = call.params[0];
                if (!store || typeof target !== 'string' || target.length > 500) throw new WireError(404, 'Uploads are not available.');
                if (call.method === '_startUpload') {
                    component.dispatch('upload:generatedSignedUrl', { name: target, url: store.signedUrl(this.options.uploadPrefix ?? '/livewire') }, { self: true });
                    component._skipRender = true;
                } else if (call.method === '_finishUpload') {
                    const ids = Array.isArray(call.params[1]) ? call.params[1].map(String) : [];
                    if (!ids.length || ids.some((id) => !store.resolve(id))) throw new WireError(404, 'Temporary file not found.');
                    await applyUpdate(target, call.params[2] === true ? ids.map((id) => UploadStore.reference(id)) : UploadStore.reference(ids[0]));
                    component.dispatch('upload:finished', { name: target, tmpFilenames: ids }, { self: true });
                } else if (call.method === '_uploadErrored') {
                    component.dispatch('upload:errored', { name: target }, { self: true });
                    component.addError(target, 'The file failed to upload.');
                } else {
                    component.dispatch('upload:removed', { name: target, tmpFilename: String(call.params[1] ?? '') }, { self: true });
                    component._skipRender = true;
                }
                returns.push(null);
                continue;
            }
            if (call.method === '__dispatch') {
                const handler = cls.listeners?.[String(call.params[0])];
                if (!handler) throw new WireError(404, `No listener for event: ${String(call.params[0])}`);
                const args = call.params[1] && typeof call.params[1] === 'object' ? Object.values(call.params[1] as object) : [];
                returns.push((await (component as any)[handler](...args)) ?? null);
                continue;
            }
            if (!allowed.has(call.method)) {
                // Development hint: the method exists but is not declared callable.
                if (process.env.NODE_ENV !== 'production' && typeof (component as any)[call.method] === 'function' && !isLifecycleHook(call.method)) console.warn(`[wire] ${name}: "${call.method}" exists but is not listed in static callable; call rejected.`);
                throw new WireError(404, `Method not found: ${call.method}`);
            }
            returns.push((await (component as any)[call.method](...call.params)) ?? null);
        }

        const effects = component._effects;
        effects.returns = returns;
        if (awaitsLazyLoad && !lazyLoaded) component._skipRender = true;
        const rendered = !component._skipRender && !effects.redirect;
        if (rendered) { effects.html = await this.renderRoot(component, name, bindings); effects.partials ??= {}; }
        await component.dehydrate();
        const { id: _i, name: _n, errors: _e, ...memo } = snapshot.memo;
        // After a full render, the children list is the one just rendered; otherwise it is kept.
        if (rendered) memo.children = Object.keys(component._children).length ? component._children : [];
        // A partial render (a modal opened) may mount new children: they join the known ones, so the next render keeps them.
        else if (Object.keys(component._children).length) memo.children = { ...(memo.children && typeof memo.children === 'object' && !Array.isArray(memo.children) ? memo.children : {}), ...component._children };
        if (lazyLoaded) { memo.lazyLoaded = true; delete memo.lazyIsolated; }
        // Scripts already run by the browser are not sent again.
        if (effects.scripts) {
            const known = new Set<string>(Array.isArray(memo.scripts) ? memo.scripts : []);
            const fresh = Object.fromEntries(Object.entries(effects.scripts as Record<string, string>).filter(([key]) => !known.has(key)));
            if (Object.keys(fresh).length) { effects.scripts = fresh; memo.scripts = [...known, ...Object.keys(fresh)]; } else delete effects.scripts;
        }
        return { snapshot: this.snapshot(component, name, memo), effects, component };
    }

    /** HTTP entry point; body: `{ _token, components: [{ snapshot, updates, calls }] }`. */
    async handle(body: any, ctx: unknown = null): Promise<{ components: { snapshot: string; effects: Effects }[]; assets: unknown[] }> {
        const list = body?.components;
        if (!Array.isArray(list) || list.length === 0) throw new WireError(404, 'Invalid payload.');
        const components: { snapshot: string; effects: Effects }[] = [];
        // Components are processed in order so a parent can pass its reactive props to the children that follow it.
        await this.requestScope.run({ childProps: new Map() }, async () => {
        for (const c of list) {
            if (typeof c?.snapshot !== 'string' || typeof c.updates !== 'object' || !Array.isArray(c.calls)) throw new WireError(404, 'Invalid payload.');
            const { snapshot, effects } = await this.update(JSON.parse(c.snapshot), c.updates ?? {}, c.calls, ctx);
            components.push({ snapshot: JSON.stringify(snapshot), effects });
        }
        });
        return { components, assets: [] };
    }
}
