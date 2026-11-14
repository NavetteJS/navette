// @navette-js/panels/testing — test pages, forms, tables and actions without a browser, like Filament's Livewire testing helpers.
// `livewire(Page, params, { panel, user })` mounts the page in a real WireRuntime: every later call is a browser-like update
// (signed snapshot, `static callable`, `static locked`), so tests go through the same security checks as the browser.
import { AssertionError, deepStrictEqual } from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { Field, recordFailedRules } from '@navette-js/forms';
import { makeStateGetter } from '@navette-js/schemas';
import { getTableQuery, getTableRecords, getVisibleColumns, TernaryFilter, SelectFilter, type Summarizer } from '@navette-js/tables';
import { hydrateValue, UploadStore, WireError, WireRuntime, type Call, type Component, type Effects, type Snapshot } from '@navette-js/wire';
import { Notification, runInRequest, type NotificationData } from './notifications.ts';
import { panelRouter, RelationManager, type Panel, type PanelContext, type User } from './index.ts';
import { installTestingExtras, normalizeListLikeState, type TestableExtras } from './testing-extras.ts';
export { assertNotified, assertNotNotified, clearSentNotifications, type TestableExtras } from './testing-extras.ts';

// ------------------------------------------------------------------ defaults (Filament: actingAs(), setCurrentPanel(), setTenant())
let defaultPanel: Panel | null = null;
let defaultUser: User | null = null;
let defaultTenant: unknown = undefined;
/** Signs this user in for the next `livewire()` calls that do not pass `user`; `null` tests as a guest. */
export function actingAs(user: User | null): void { defaultUser = user; }
/** Panel used by the next `livewire()` calls that do not pass `panel`. */
export function setCurrentPanel(panel: Panel | null): void { defaultPanel = panel; }
/** Tenant used by the next `livewire()` calls that do not pass `tenant` (multi-tenant panels; defaults to the user's first). */
export function setTenant(tenant: unknown): void { defaultTenant = tenant; }

// ------------------------------------------------------------------ runtime: one per panel, routed like the application's
const runtimes = new WeakMap<Panel, WireRuntime>();
const uploadDirectories: string[] = [];
process.once('exit', () => { for (const directory of uploadDirectories) rmSync(directory, { recursive: true, force: true }); });
function runtimeFor(panel: Panel): WireRuntime {
    let runtime = runtimes.get(panel);
    if (runtime) return runtime;
    const key = randomBytes(32).toString('hex');
    const directory = mkdtempSync(path.join(tmpdir(), 'navette-testing-'));
    uploadDirectories.push(directory);
    runtime = new WireRuntime({ key, uploads: new UploadStore(directory, key) });
    // The panel's router registers its pages, relation managers and widgets, as in the application.
    panelRouter(panel, runtime);
    // Components served outside a panel (`@navette-js/panels/livewire`) keep their names.
    for (const [name, cls] of ((panel as any).registeredComponents ?? new Map()) as Map<string, any>) runtime.register(name, cls);
    runtimes.set(panel, runtime);
    return runtime;
}
/**
 * The class the panel serves for this one: a resource's page classes (`pages.index`, or the defaults) are served through a
 * subclass bound to the resource (`TaskResource.getPages().index`); passing either works.
 */
function servedClassOf(panel: Panel, cls: any): any {
    const pages = panel.getPages() as any[];
    if (pages.includes(cls)) return cls;
    return pages.find((page) => Object.getPrototypeOf(page) === cls) ?? cls;
}
/** Name of a component in the runtime: the one given by the panel, or a testing name for a class the panel does not register. */
function componentNameOf(runtime: WireRuntime, panel: Panel, cls: any): string {
    const name = runtime.nameOf(cls);
    if (name && runtime.has(name)) return name;
    const fallback = `navette.${panel.getId()}.testing.${cls.name || 'component'}`;
    if (!runtime.has(fallback)) runtime.register(fallback, cls);
    return fallback;
}

// ------------------------------------------------------------------ fake files (Laravel: UploadedFile::fake())
/** A file to put in a FileUpload field with `fillForm()` or `set()`: it is uploaded like the browser would. */
export class UploadedFile {
    readonly name: string;
    readonly content: Buffer;
    constructor(name: string, content: string | Buffer) { this.name = name; this.content = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'); }
    static fake(): { create(name: string, kilobytes?: number): UploadedFile; createWithContent(name: string, content: string | Buffer): UploadedFile; image(name: string, width?: number, height?: number): UploadedFile } {
        return {
            create: (name, kilobytes = 0) => new UploadedFile(name, Buffer.alloc(Math.max(0, Math.round(kilobytes * 1024)), ' ')),
            createWithContent: (name, content) => new UploadedFile(name, content),
            image: (name, width = 10, height = 10) => new UploadedFile(name, png(width, height)),
        };
    }
}
/** A blank PNG image of the given size. */
function png(width: number, height: number): Buffer {
    const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (buffer: Buffer) => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type: string, data: Buffer) => { const head = Buffer.alloc(4); head.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, 'latin1'), data]); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(body)); return Buffer.concat([head, body, tail]); };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
    const rows = Buffer.alloc((width * 3 + 1) * height, 0xff);
    for (let y = 0; y < height; y++) rows[y * (width * 3 + 1)] = 0;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------ TestAction (Filament\Actions\Testing\TestAction)
type ActionName = string | { getDefaultName?(): string | null; make(...args: any[]): { getName(): string } };
/** An action name, or an action class: its `getDefaultName()` (or the name of an instance made without arguments). */
const actionNameOf = (name: ActionName): string => (typeof name === 'string' ? name : name.getDefaultName?.() ?? name.make().getName());
/** Designates an action to mount or assert: a table row or bulk action, an action of a schema component, with arguments. */
export class TestAction {
    readonly name: string;
    private _arguments: Record<string, unknown> | ((args: Record<string, unknown>) => boolean) | null = null;
    private _schemaComponent: string | boolean | null = null;
    private _schema: string | null = null;
    private _table: unknown = null;
    private _bulk = false;
    private _context: Record<string, unknown> = {};
    constructor(name: ActionName) { this.name = actionNameOf(name); }
    /** An action name, or an action class with a static `make()` (`TestAction.make(DeleteBulkAction)`). */
    static make(name: ActionName): TestAction { return new TestAction(name); }
    /** Arguments to mount the action with, or a function checking the mounted arguments (`assertActionMounted()`). */
    arguments(args: Record<string, unknown> | ((args: Record<string, unknown>) => boolean) | null): this { this._arguments = args; return this; }
    /** An action of a schema component: its key (`'items'`, relative to the schema) or `true` for the schema itself. */
    schemaComponent(component: string | boolean | null = true, schema: string | null = null): this { this._schemaComponent = component; this._schema = schema; return this; }
    /** A table action: `true` for a header or toolbar action, or a record (or its key) for a row action. */
    table(record: unknown = true): this { this._table = record; return this; }
    /** A bulk action of the table (selected records: `selectTableRecords()`). */
    bulk(condition = true): this { this._bulk = condition; return this; }
    /** Extra mount context. */
    context(context: Record<string, unknown>): this { this._context = context; return this; }
    checkArguments(actual: Record<string, unknown>): boolean { return typeof this._arguments === 'function' ? this._arguments(actual) : true; }
    /** Name, arguments and mount context, as sent by the browser. `recordKeyOf` turns a record into its key. */
    toArray(defaultSchema: string, recordKeyOf: (record: unknown) => string): ActionSpec {
        const schema = this._schema ?? defaultSchema;
        const schemaComponent = typeof this._schemaComponent === 'string' ? (schema ? `${schema}.${this._schemaComponent}` : this._schemaComponent) : this._schemaComponent === true ? schema : null;
        const context: Record<string, unknown> = { ...(this._bulk ? { bulk: true } : {}), ...(schemaComponent ? { schemaComponent } : {}), ...this._context };
        if (this._table !== null && this._table !== false && this._table !== undefined) {
            context.table = true;
            if (this._table !== true) context.recordKey = recordKeyOf(this._table);
        }
        return { name: this.name, ...(this._arguments && typeof this._arguments === 'object' ? { arguments: this._arguments } : {}), context, test: this };
    }
}
type ActionSpec = { name: string; arguments?: Record<string, unknown>; context: Record<string, unknown>; test?: TestAction };
type Actions = ActionName | TestAction | (ActionName | TestAction)[];

// ------------------------------------------------------------------ helpers
const fail = (message: string): never => { throw new AssertionError({ message }); };
const isPlainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const readPath = (target: unknown, dotted: string): unknown => (dotted === '' ? target : dotted.split('.').reduce((node: any, key) => (node === null || node === undefined ? undefined : node[key]), target));
/** `{ 'a.b': 1, c: { d: 2 } }` → `{ 'a.b': 1, 'c.d': 2 }` (lists and other values are leaves). */
function flatten(state: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
    for (const [key, value] of Object.entries(state)) {
        const dotted = prefix ? `${prefix}.${key}` : key;
        if (isPlainObject(value) && Object.keys(value).length) flatten(value, dotted, out);
        else out[dotted] = value;
    }
    return out;
}
/** JSON copy, as values travel between the browser and the server. */
const wire = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
/** Same value once both cross the wire; a list is equal to an object keyed '0', '1'… (faked repeater and builder item keys). */
const sameValue = (actual: unknown, expected: unknown): boolean => { try { deepStrictEqual(normalizeListLikeState(wire(actual), wire(expected)), wire(expected)); return true; } catch { return false; } };
const show = (value: unknown) => { try { return JSON.stringify(value); } catch { return String(value); } };
const decodeEntities = (html: string) => html.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[lower];
});
const textOf = (html: string) => decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const ejsEscape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' } as Record<string, string>)[c]);
const normalizeSummary = (state: unknown): unknown => {
    const one = (value: unknown) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) ? String(Math.round(Number(value) * 10000) / 10000) : String(value ?? ''));
    return Array.isArray(state) ? state.map(one).sort() : one(state);
};

export type LivewireOptions = {
    /** Panel serving the page (or `setCurrentPanel()`). */
    panel?: Panel;
    /** Signed-in user (or `actingAs()`); `null` for a guest. */
    user?: User | null;
    /** Tenant of the request, in a multi-tenant panel (or `setTenant()`); defaults to the user's first tenant. */
    tenant?: unknown;
    /** Query string of the page URL (`{ tableAction: 'view', tableActionRecord: '1' }`). */
    query?: Record<string, string>;
};

/**
 * Mounts a page (or a relation manager, widget, any registered component) and returns its tester. Every method is chainable
 * and queued; `await` the chain to run it: `await livewire(CreatePost, {}, { panel, user }).fillForm({ title: 'Hi' }).call('create').assertNotified()`.
 * `params` are the route parameters (`{ record: post.id }`), passed to `mount()`.
 */
export function livewire<C extends Component = any>(componentClass: new () => C, params: Record<string, unknown> = {}, options: LivewireOptions = {}): Testable<C> {
    return new Testable<C>(componentClass, params, options);
}

/** A mounted component under test (Livewire's `Testable`); the methods of `TestableExtras` are added by `testing-extras.ts`. */
export interface Testable<C extends Component = any> extends TestableExtras {}
export class Testable<C extends Component = any> implements PromiseLike<void> {
    private queue: Promise<void>;
    private readonly panel: Panel;
    private readonly runtime: WireRuntime;
    private readonly user: User | null;
    private tenant: unknown;
    private readonly mailbox = randomBytes(16).toString('hex');
    private readonly componentClass: any;
    private snapshot: Snapshot | null = null;
    private component: C | null = null;
    private effects: Effects = {};
    private lastHtml = '';
    private lastPartials: Record<string, string> = {};
    private status = 200;
    private failure: string | null = null;
    private failureAcknowledged = true;
    private failedRules: Record<string, string[]> = {};
    /** Notifications sent and not asserted yet (`assertNotified()` and `assertNotNotified()` consume them). */
    private notifications: NotificationData[] = [];
    /** Every notification sent during the test. */
    private allNotifications: NotificationData[] = [];

    constructor(componentClass: new () => C, params: Record<string, unknown>, options: LivewireOptions) {
        const panel = options.panel ?? defaultPanel;
        if (!panel) throw new Error('livewire(): pass { panel } or call setCurrentPanel(panel) first.');
        this.panel = panel;
        this.runtime = runtimeFor(panel);
        this.componentClass = servedClassOf(panel, componentClass);
        this.user = options.user !== undefined ? options.user : defaultUser;
        this.tenant = options.tenant !== undefined ? options.tenant : defaultTenant;
        this.queue = this.mount(params, options.query ?? {});
    }

    /** Runs the queued steps; resolves once they are all done (rejects with the first failed assertion). */
    then<A = void, B = never>(onFulfilled?: ((value: void) => A | PromiseLike<A>) | null, onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
        return this.queue.then(onFulfilled, onRejected);
    }
    catch<B = never>(onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<void | B> { return this.queue.catch(onRejected); }
    finally(onFinally?: (() => void) | null): Promise<void> { return this.queue.finally(onFinally); }
    private enqueue(step: () => unknown): this { this.queue = this.queue.then(async () => { await step(); }); return this; }

    // ---------------------------------------------------------------- requests
    private fakeRequest(url: string, query: Record<string, string> = {}): { req: any; res: any } {
        const headers: Record<string, string> = { host: 'localhost', accept: 'text/html' };
        const req: any = { method: 'GET', path: url.split('?')[0], originalUrl: url, url, query, params: {}, body: {}, headers, hostname: 'localhost', ip: '127.0.0.1', protocol: 'http', secure: false, cookies: {}, get: (name: string) => headers[name.toLowerCase()], header: (name: string) => headers[name.toLowerCase()], accepts: () => false };
        const res: any = { locals: {}, statusCode: 200, headersSent: false, req, setHeader: () => res, getHeader: () => undefined, cookie: () => res, clearCookie: () => res, status: (code: number) => { res.statusCode = code; return res; } };
        req.res = res;
        return { req, res };
    }
    /** Runs `fn` like a request of the panel: boot callbacks, theme, tenant, notifications and validation tracking. */
    private async inRequest<T>(url: string, fn: (ctx: PanelContext) => Promise<T>, query: Record<string, string> = {}): Promise<{ result: T; pending: NotificationData[]; failedRules: Record<string, string[]> }> {
        const { req, res } = this.fakeRequest(url, query);
        await this.panel.boot(req);
        const ctx: PanelContext = { req, res, panel: this.panel, user: this.user, denied: false, mailbox: this.mailbox, tenant: this.tenant ?? null };
        const { result, pending } = await runInRequest(this.mailbox, () => this.panel.withTheme(req, () => this.panel.withTenant(ctx.tenant ?? null, () => recordFailedRules(() => fn(ctx)))));
        return { result: result.result, pending, failedRules: result.failedRules };
    }
    private recordFailure(error: unknown): void {
        if (!(error instanceof WireError)) throw error;
        this.status = error.status;
        this.failure = error.message;
        this.failureAcknowledged = false;
    }
    private received(pending: NotificationData[]): void { this.notifications.push(...pending); this.allNotifications.push(...pending); }

    private async mount(params: Record<string, unknown>, query: Record<string, string>): Promise<void> {
        const panel = this.panel;
        // The router's checks before a page: panel access, then the tenant (a member's).
        if (this.user && !(await panel.userCanAccess(this.user))) { this.recordFailure(new WireError(403, 'This user cannot access the panel.')); return; }
        if (panel.hasTenancy() && this.user) {
            const provider = panel.getTenantProvider();
            if (this.tenant === undefined || this.tenant === null) this.tenant = (await provider.getTenants(this.user))[0] ?? null;
            if (!this.tenant || !(await provider.canAccess(this.user, this.tenant))) { this.recordFailure(new WireError(404, 'Tenant not found.')); return; }
        }
        const routeParams = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, this.routeParam(value)]));
        const url = this.urlOf(routeParams);
        const name = componentNameOf(this.runtime, panel, this.componentClass);
        // Relation managers (unless `isLazyLoaded = false`) and lazy widgets are loaded by the browser once visible (related records pages are not): a placeholder first, then `__lazyLoad`.
        const lazy = this.componentClass.prototype instanceof RelationManager ? (this.componentClass as any).isLazy() : this.componentClass.isLazy === true;
        try {
            const { result, pending, failedRules } = await this.inRequest(url, (ctx) => this.runtime.mountWithInstance(name, routeParams, { path: url.split('?')[0], method: 'GET', ctx, lazy }), query);
            this.snapshot = result.snapshot;
            this.component = result.component as C;
            this.effects = result.effects;
            this.lastHtml = result.html;
            this.failedRules = failedRules;
            this.received(pending);
        } catch (error) { this.recordFailure(error); return; }
        // The placeholder's `x-intersect` holds the signed mount params (the quote is escaped in the attribute).
        const load = lazy ? /__lazyLoad\((?:'|&#0*39;)([A-Za-z0-9+/=]+)/.exec(this.lastHtml) : null;
        if (load) await this.request({}, [{ method: '__lazyLoad', params: [load[1]] }]);
    }
    /** A record passed as a route parameter becomes its key, as in a URL. */
    private routeParam(value: unknown): unknown {
        if (value === null || value === undefined || typeof value !== 'object') return value === null || value === undefined ? value : String(value);
        const adapter = this.componentClass.resource?.adapter;
        return adapter && typeof adapter.getKey === 'function' ? adapter.getKey(value) : value;
    }
    private urlOf(params: Record<string, unknown>): string {
        const slug = String(this.componentClass.slug ?? '').replace(/\{(\w+)\}/g, (_: string, key: string) => encodeURIComponent(String(params[key] ?? '')));
        try { return this.panel.getUrl(slug, this.panel.hasTenancy() ? this.tenant : null); } catch { return this.panel.getBaseUrl(slug); }
    }

    /** A browser update: state changes then method calls, on the last snapshot. A refused request keeps the previous state. */
    private async request(updates: Record<string, unknown>, calls: Call[]): Promise<void> {
        if (!this.snapshot) throw new Error(`The component could not be mounted (status ${this.status}: ${this.failure}).`);
        const payload = wire({ snapshot: this.snapshot, updates, calls });
        try {
            const { result, pending, failedRules } = await this.inRequest(String(this.snapshot.memo.path ?? '/'), (ctx) => this.runtime.updateWithInstance(payload.snapshot, payload.updates, payload.calls, ctx));
            this.snapshot = result.snapshot;
            this.component = result.component as C;
            this.effects = result.effects;
            if (typeof result.effects.html === 'string') this.lastHtml = result.effects.html;
            this.lastPartials = { ...(result.effects.partials ?? {}) };
            this.failedRules = failedRules;
            this.status = 200;
            this.received(pending);
        } catch (error) {
            this.effects = {};
            this.failedRules = {};
            this.recordFailure(error);
        }
    }
    /** Runs `fn` on the component as it is after the last request (read-only inspection, in a request context). */
    private async inspect<T>(fn: (component: any) => T | Promise<T>): Promise<T> {
        const component = this.instance();
        const { result } = await this.inRequest(String(this.snapshot?.memo.path ?? '/'), async (ctx) => {
            const previous = component._ctx;
            component._ctx = ctx;
            try { return await fn(component); } finally { component._ctx = previous; }
        });
        return result;
    }
    /** The last request must have succeeded: an assertion on a refused request would pass for the wrong reason. */
    private ensureSucceeded(): void {
        if (this.failure !== null && !this.failureAcknowledged) fail(`The last request to the component failed with status ${this.status} (${this.failure}). Assert it with assertStatus(), assertForbidden() or assertNotFound() first.`);
        if (!this.snapshot) fail(`The component was not mounted (status ${this.status}: ${this.failure}).`);
    }
    private get className(): string { return this.componentClass.name || 'component'; }

    // ---------------------------------------------------------------- state
    /** The component instance as it was after the last request (await the chain first). */
    instance(): C {
        if (!this.component) throw new Error(`The component was not mounted (status ${this.status}: ${this.failure}).`);
        return this.component;
    }
    /** Public state at a dotted path, as the browser holds it (await the chain first). */
    get(dotted: string): unknown { return readPath(this.snapshot ? hydrateValue(this.snapshot.data[dotted.split('.')[0]]) : undefined, dotted.split('.').slice(1).join('.')); }
    /** Last full render of the component (await the chain first). */
    html(): string { return this.lastHtml; }
    /** Effects of the last request: dispatches, redirect, returns... (await the chain first). */
    getEffects(): Effects { return this.effects; }
    /** Notifications sent during the test (await the chain first). */
    getNotifications(): NotificationData[] { return [...this.allNotifications]; }
    /** Files offered for download by the notifications sent so far (exports, failed import rows). */
    getDownloads(): { name: string; type: string; content: Buffer }[] {
        const prefix = `${this.panel.getBaseUrl('downloads')}/`;
        const files: { name: string; type: string; content: Buffer }[] = [];
        for (const notification of this.allNotifications) for (const action of notification.actions ?? []) {
            if (!action.url?.startsWith(prefix) || !this.user) continue;
            const file = this.panel.getDownloads().get(decodeURIComponent(action.url.slice(prefix.length)), this.user.id);
            // Read synchronously: the built-in stores (memory, disk). An asynchronous store is read with its own get().
            if (file && !(file instanceof Promise)) files.push({ name: file.name, type: file.type, content: file.content });
        }
        return files;
    }

    /** Sets public state (`'data.title'`, or an object of paths), like `wire:model`. An `UploadedFile` is uploaded first. */
    set(name: string | Record<string, unknown>, value?: unknown): this {
        return this.enqueue(() => this.applyState(typeof name === 'string' ? { [name]: value } : name));
    }
    private async applyState(updates: Record<string, unknown>): Promise<void> {
        const files: [string, UploadedFile[]][] = [];
        const plain: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            const list = Array.isArray(value) && value.length && value.every((item) => item instanceof UploadedFile) ? value as UploadedFile[] : value instanceof UploadedFile ? [value] : null;
            if (list) files.push([key, list]); else plain[key] = value;
        }
        // Files: stored as temporary uploads, then reported with `_finishUpload`, one key per file (FileUpload state).
        if (files.length) {
            const store = this.runtime.uploads!;
            const calls: Call[] = [];
            for (const [key, list] of files) for (const file of list) calls.push({ method: '_finishUpload', params: [`${key}.${randomUUID()}`, [await store.storeContent(file.name, file.content)], false] });
            await this.request({}, calls);
        }
        if (Object.keys(plain).length) await this.request(plain, []);
    }
    /** Calls a public method listed in `static callable`, like `wire:click`. */
    call(method: string, ...params: unknown[]): this { return this.enqueue(() => this.request({}, [{ method, params }])); }
    /** Re-renders the component without changes (`$refresh`). */
    refresh(): this { return this.enqueue(() => this.request({}, [{ method: '$refresh', params: [] }])); }
    /** Dispatches an event to the component's listeners (`static listeners`). */
    dispatch(event: string, params: Record<string, unknown> = {}): this { return this.enqueue(() => this.request({}, [{ method: '__dispatch', params: [event, params] }])); }

    assertSet(dotted: string, expected: unknown): this {
        return this.enqueue(() => {
            this.ensureSucceeded();
            const actual = this.get(dotted);
            if (typeof expected === 'function' ? !(expected as (value: unknown) => boolean)(actual) : !sameValue(actual, expected)) fail(`Failed asserting that [${dotted}] is set to ${show(expected)} on the [${this.className}] component: it is ${show(actual)}.`);
        });
    }
    assertNotSet(dotted: string, expected: unknown): this {
        return this.enqueue(() => {
            this.ensureSucceeded();
            if (sameValue(this.get(dotted), expected)) fail(`Failed asserting that [${dotted}] is not set to ${show(expected)} on the [${this.className}] component.`);
        });
    }
    private haystack(): string { return [this.lastHtml, ...Object.values(this.lastPartials)].join('\n'); }
    /** The rendered component contains these texts (HTML entities decoded). */
    assertSee(values: string | string[]): this { return this.enqueue(() => { this.ensureSucceeded(); const html = decodeEntities(this.haystack()); for (const value of [values].flat()) if (!html.includes(String(value))) fail(`Failed asserting that the [${this.className}] component shows [${value}].`); }); }
    assertDontSee(values: string | string[]): this { return this.enqueue(() => { this.ensureSucceeded(); const html = decodeEntities(this.haystack()); for (const value of [values].flat()) if (html.includes(String(value))) fail(`Failed asserting that the [${this.className}] component does not show [${value}].`); }); }
    /** The visible text (tags removed) contains these texts. */
    assertSeeText(values: string | string[]): this { return this.enqueue(() => { this.ensureSucceeded(); const text = textOf(this.haystack()); for (const value of [values].flat()) if (!text.includes(String(value))) fail(`Failed asserting that the [${this.className}] component shows the text [${value}].`); }); }
    assertDontSeeText(values: string | string[]): this { return this.enqueue(() => { this.ensureSucceeded(); const text = textOf(this.haystack()); for (const value of [values].flat()) if (text.includes(String(value))) fail(`Failed asserting that the [${this.className}] component does not show the text [${value}].`); }); }
    /** The raw HTML contains these fragments. */
    assertSeeHtml(values: string | string[]): this { return this.enqueue(() => { this.ensureSucceeded(); const html = this.haystack(); for (const value of [values].flat()) if (!html.includes(value)) fail(`Failed asserting that the [${this.className}] component HTML contains [${value}].`); }); }
    assertDontSeeHtml(values: string | string[]): this { return this.enqueue(() => { this.ensureSucceeded(); const html = this.haystack(); for (const value of [values].flat()) if (html.includes(value)) fail(`Failed asserting that the [${this.className}] component HTML does not contain [${value}].`); }); }

    // ---------------------------------------------------------------- status, redirects, events
    assertStatus(status: number): this {
        return this.enqueue(() => {
            this.failureAcknowledged = true;
            if (this.status !== status) fail(`Expected response status [${status}] but received [${this.status}]${this.failure ? ` (${this.failure})` : ''}.`);
        });
    }
    /** The component mounted (or the last request succeeded). */
    assertOk(): this { return this.assertStatus(200); }
    assertSuccessful(): this { return this.assertStatus(200); }
    assertForbidden(): this { return this.assertStatus(403); }
    assertNotFound(): this { return this.assertStatus(404); }
    assertUnauthorized(): this { return this.assertStatus(401); }
    /** The last request redirected (to this URL, if given). */
    assertRedirect(url: string | null = null): this {
        return this.enqueue(() => {
            this.ensureSucceeded();
            const redirect = this.effects.redirect;
            if (typeof redirect !== 'string') fail(`Failed asserting that the [${this.className}] component redirected.`);
            if (url !== null && redirect !== url) fail(`Failed asserting that the [${this.className}] component redirected to [${url}]: it redirected to [${redirect}].`);
        });
    }
    assertNoRedirect(): this {
        return this.enqueue(() => {
            this.ensureSucceeded();
            if (typeof this.effects.redirect === 'string') fail(`Failed asserting that the [${this.className}] component did not redirect: it redirected to [${this.effects.redirect}].`);
        });
    }
    private dispatched(event: string, params?: Record<string, unknown> | ((name: string, params: any) => boolean)) {
        return (this.effects.dispatches ?? []).filter((dispatch) => dispatch.name === event && (params === undefined || (typeof params === 'function' ? params(dispatch.name, dispatch.params) : Object.entries(params).every(([key, value]) => sameValue((dispatch.params as any)?.[key], value)))));
    }
    /** The last request dispatched this browser event (with these params, or matching a function `(name, params) => boolean`). */
    assertDispatched(event: string, params?: Record<string, unknown> | ((name: string, params: any) => boolean)): this {
        return this.enqueue(() => { this.ensureSucceeded(); if (!this.dispatched(event, params).length) fail(`Failed asserting that an event [${event}]${params && typeof params === 'object' ? ` with ${show(params)}` : ''} was dispatched by the [${this.className}] component.`); });
    }
    assertNotDispatched(event: string, params?: Record<string, unknown> | ((name: string, params: any) => boolean)): this {
        return this.enqueue(() => { this.ensureSucceeded(); if (this.dispatched(event, params).length) fail(`Failed asserting that an event [${event}] was not dispatched by the [${this.className}] component.`); });
    }

    // ---------------------------------------------------------------- notifications
    private matching(expected: string | Notification | null): NotificationData[] {
        if (expected === null) return this.notifications;
        if (typeof expected === 'string') return this.notifications.filter((notification) => notification.title === expected);
        const { id: _id, ...wanted } = expected.getData();
        return this.notifications.filter((notification) => { const { id: _other, ...sent } = notification; return sameValue(sent, wanted); });
    }
    /** A notification was sent (with this title, or exactly this notification). Consumes the notifications sent so far. */
    assertNotified(expected: string | Notification | null = null): this {
        return this.enqueue(() => {
            const found = this.matching(expected).length > 0;
            const sent = this.notifications.map((notification) => notification.title);
            this.notifications = [];
            if (!found) fail(expected === null ? 'A notification was expected but none were sent.' : `A notification was expected [${typeof expected === 'string' ? expected : expected.getData().title}] but not sent${sent.length ? ` (sent: ${sent.map((title) => `[${title}]`).join(', ')})` : ''}.`);
        });
    }
    /** No notification was sent (or none with this title, or not this exact one). Consumes the notifications sent so far. */
    assertNotNotified(expected: string | Notification | null = null): this {
        return this.enqueue(() => {
            const found = this.matching(expected);
            this.notifications = [];
            if (found.length) fail(expected === null ? `No notification was expected but at least one was sent ([${found[0].title}]).` : `The notification [${found[0].title}] was sent.`);
        });
    }

    // ---------------------------------------------------------------- schemas and forms
    private mountedCount(): number { return Array.isArray((this.component as any)?.mountedActions) ? (this.component as any).mountedActions.length : 0; }
    private defaultSchemaName(): string {
        const component = this.component as any;
        return typeof component?.formSchema === 'function' ? 'form' : typeof component?.infolistSchema === 'function' ? 'infolist' : 'content';
    }
    /** The schema a form helper targets: the given one, the form of the last mounted action, or the page's main schema. */
    private schemaNameFor(schema: string | null | undefined): string { return schema ?? (this.mountedCount() ? `mountedActionSchema${this.mountedCount() - 1}` : this.defaultSchemaName()); }
    private async resolveSchema(component: any, name: string): Promise<any | null> {
        const mounted = /^mountedActionSchema(\d+)$/.exec(name);
        if (mounted) return component.getMountedActionSchema(Number(mounted[1]));
        if (!/^[A-Za-z]+$/.test(name) || typeof component[`${name}Schema`] !== 'function') return null;
        return component.getSchema(name);
    }
    private async schemaOrFail(component: any, name: string): Promise<any> {
        const schema = await this.resolveSchema(component, name);
        if (!schema) fail(`Failed asserting that a schema with the name [${name}] exists on the [${this.className}] component.`);
        return schema;
    }
    private async statePathOf(name: string): Promise<string> { return this.inspect(async (component) => (await this.schemaOrFail(component, name)).getStatePath()); }
    private prefixed(statePath: string, key: string): string { return statePath ? `${statePath}.${key}` : key; }

    /** Fills the form (of the mounted action, if any) with these values, like typing in its fields. */
    fillForm(state: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>) = {}, schema: string | null = null): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const name = this.schemaNameFor(schema);
            const statePath = await this.statePathOf(name);
            const values = typeof state === 'function' ? state((readPath(this.instance(), statePath) ?? {}) as Record<string, unknown>) : state;
            const updates = Object.fromEntries(Object.entries(flatten(values)).map(([key, value]) => [this.prefixed(statePath, key), value]));
            await this.applyState(updates);
        });
    }
    /** Same as `fillForm()`, for the form of the mounted action. */
    setActionData(data: Record<string, unknown>): this { return this.fillForm(data); }
    assertSchemaExists(name: string): this { return this.enqueue(async () => { this.ensureSucceeded(); await this.inspect((component) => this.schemaOrFail(component, name)); }); }
    assertFormExists(name = 'form'): this { return this.assertSchemaExists(name); }
    /** The schema state holds these values (keys relative to the schema), or `state(raw)` returns true / the expected values. */
    assertSchemaStateSet(state: Record<string, unknown> | ((raw: Record<string, unknown>) => Record<string, unknown> | boolean | void), schema: string | null = null): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const name = this.schemaNameFor(schema);
            const statePath = await this.statePathOf(name);
            const raw = (readPath(this.instance(), statePath) ?? {}) as Record<string, unknown>;
            const expected = typeof state === 'function' ? state(wire(raw)) : state;
            if (expected === false) fail(`Failed asserting that the [${name}] schema state matches on the [${this.className}] component.`);
            if (!expected || expected === true) return;
            for (const [key, value] of Object.entries(expected)) {
                const actual = readPath(raw, key);
                if (!sameValue(actual, value)) fail(`Failed asserting that a component [${key}] has the expected state in the [${name}] schema on the [${this.className}] component: expected ${show(value)}, got ${show(actual)}.`);
            }
        });
    }
    assertFormSet(state: Record<string, unknown> | ((raw: Record<string, unknown>) => Record<string, unknown> | boolean | void), schema: string | null = null): this { return this.assertSchemaStateSet(state, schema); }
    assertActionDataSet(state: Record<string, unknown> | ((raw: Record<string, unknown>) => Record<string, unknown> | boolean | void)): this { return this.assertSchemaStateSet(state); }

    private errorBag(): Record<string, string[]> { return (this.snapshot?.memo.errors ?? {}) as Record<string, string[]>; }
    private checkErrors(keys: string | string[] | Record<string, string | string[]>, expectErrors: boolean, prefix: string | null): void {
        this.ensureSucceeded();
        const bag = this.errorBag();
        const full = (key: string) => (prefix === null ? key : this.prefixed(prefix, key));
        const list: [string, string[]][] = typeof keys === 'string' ? [[full(keys), []]] : Array.isArray(keys) ? keys.map((key): [string, string[]] => [full(key), []]) : Object.entries(keys).map(([key, rules]): [string, string[]] => [full(key), [rules].flat()]);
        const scoped = Object.keys(bag).filter((key) => prefix === null || prefix === '' || key === prefix || key.startsWith(`${prefix}.`));
        if (!list.length) {
            if (expectErrors && !scoped.length) fail(`Component has no errors${prefix ? ` in [${prefix}]` : ''}.`);
            if (!expectErrors && scoped.length) fail(`Component has errors: ${scoped.map((key) => `[${key}] ${bag[key].join(' ')}`).join(', ')}`);
            return;
        }
        for (const [key, rules] of list) {
            const messages = bag[key] ?? [];
            const failed = this.failedRules[key] ?? [];
            const matches = (rule: string) => failed.includes(rule.split(':')[0]) || messages.includes(rule);
            if (expectErrors) {
                if (!messages.length) fail(`Component missing error: [${key}]${scoped.length ? ` (errors: ${scoped.map((other) => `[${other}]`).join(', ')})` : ''}.`);
                for (const rule of rules) if (!matches(rule)) fail(`Failed asserting that [${key}] fails the [${rule}] rule: ${messages.join(' ')}${failed.length ? ` (failed rules: ${failed.join(', ')})` : ''}.`);
            } else if (rules.length ? rules.some(matches) : messages.length) fail(`Component has an error on [${key}]: ${messages.join(' ')}`);
        }
    }
    /** Validation errors on the component: any, on these state paths, or failing these rules (`{ 'data.title': 'required' }`). */
    assertHasErrors(keys: string | string[] | Record<string, string | string[]> = []): this { return this.enqueue(() => this.checkErrors(keys, true, null)); }
    assertHasNoErrors(keys: string | string[] | Record<string, string | string[]> = []): this { return this.enqueue(() => this.checkErrors(keys, false, null)); }
    /** Validation errors of the form (of the mounted action, if any): keys relative to it, `['title']` or `{ title: 'required' }`. */
    assertHasFormErrors(keys: string[] | Record<string, string | string[]> = [], schema: string | null = null): this {
        return this.enqueue(async () => { this.ensureSucceeded(); this.checkErrors(keys, true, await this.statePathOf(this.schemaNameFor(schema))); });
    }
    assertHasNoFormErrors(keys: string[] | Record<string, string | string[]> = [], schema: string | null = null): this {
        return this.enqueue(async () => { this.ensureSucceeded(); this.checkErrors(keys, false, await this.statePathOf(this.schemaNameFor(schema))); });
    }
    assertHasActionErrors(keys: string[] | Record<string, string | string[]> = []): this { return this.assertHasFormErrors(keys); }
    assertHasNoActionErrors(keys: string[] | Record<string, string | string[]> = []): this { return this.assertHasNoFormErrors(keys); }

    /** A field of the schema, by its state path relative to the schema (`'title'`, `'address.city'`) or its name. */
    private async findField(component: any, name: string, schemaName: string): Promise<{ field: any; visible: boolean } | null> {
        const schema = await this.schemaOrFail(component, schemaName);
        const statePath = schema.getStatePath();
        const path = this.prefixed(statePath, name);
        const fields = (schema.getFlatComponents() as any[]).filter((c) => c instanceof Field);
        const field = fields.find((c) => c.getStatePath() === path) ?? fields.find((c) => c.getName?.() === name);
        if (!field) return null;
        const visible = ((await schema.getVisibleFlatComponents()) as any[]).some((c) => c instanceof Field && c.getStatePath() === field.getStatePath());
        return { field, visible };
    }
    private fieldAssertion(name: string, schemaOrCheck: string | ((field: any) => boolean | Promise<boolean>) | null, check: ((field: any) => boolean | Promise<boolean>) | null, expect: (found: { field: any; visible: boolean }) => Promise<string | null>): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const schemaName = this.schemaNameFor(typeof schemaOrCheck === 'string' ? schemaOrCheck : null);
            const callback = typeof schemaOrCheck === 'function' ? schemaOrCheck : check;
            await this.inspect(async (component) => {
                const found = await this.findField(component, name, schemaName);
                if (!found) fail(`Failed asserting that a field with the name [${name}] exists on the form with the name [${schemaName}] on the [${this.className}] component.`);
                if (callback && !(await callback(found!.field))) fail(`Failed asserting that a field with the name [${name}] and provided configuration exists on the form with the name [${schemaName}] on the [${this.className}] component.`);
                const problem = await expect(found!);
                if (problem) fail(`Failed asserting that a field with the name [${name}] is ${problem} on the form named [${schemaName}] of the [${this.className}] component.`);
            });
        });
    }
    /** The field exists in the form (optionally `check(field)` returns true). */
    assertFormFieldExists(name: string, schemaOrCheck: string | ((field: any) => boolean | Promise<boolean>) | null = null, check: ((field: any) => boolean | Promise<boolean>) | null = null): this { return this.fieldAssertion(name, schemaOrCheck, check, async () => null); }
    assertFormFieldDoesNotExist(name: string, schema: string | null = null): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const schemaName = this.schemaNameFor(schema);
            await this.inspect(async (component) => { if (await this.findField(component, name, schemaName)) fail(`Failed asserting that a field with the name [${name}] does not exist on the form named [${schemaName}] of the [${this.className}] component.`); });
        });
    }
    assertFormFieldVisible(name: string, schema: string | null = null): this { return this.fieldAssertion(name, schema, null, async ({ visible }) => (visible ? null : 'visible')); }
    assertFormFieldHidden(name: string, schema: string | null = null): this { return this.fieldAssertion(name, schema, null, async ({ visible }) => (visible ? 'hidden' : null)); }
    assertFormFieldEnabled(name: string, schema: string | null = null): this { return this.fieldAssertion(name, schema, null, async ({ field }) => ((await field.isDisabled()) ? 'enabled' : null)); }
    assertFormFieldDisabled(name: string, schema: string | null = null): this { return this.fieldAssertion(name, schema, null, async ({ field }) => ((await field.isDisabled()) ? null : 'disabled')); }
    assertFormFieldIsVisible(name: string, schema: string | null = null): this { return this.assertFormFieldVisible(name, schema); }
    assertFormFieldIsHidden(name: string, schema: string | null = null): this { return this.assertFormFieldHidden(name, schema); }
    assertFormFieldIsEnabled(name: string, schema: string | null = null): this { return this.assertFormFieldEnabled(name, schema); }
    assertFormFieldIsDisabled(name: string, schema: string | null = null): this { return this.assertFormFieldDisabled(name, schema); }

    /** A component of the schema, by its key relative to the schema (`'contact'`, or a nested `'contact.phone'`). */
    private async findComponent(component: any, key: string, schemaName: string): Promise<{ component: any; visible: boolean } | null> {
        const schema = await this.schemaOrFail(component, schemaName);
        const absolute = `${schema.getKey()}.${key}`;
        const all = schema.getFlatComponents() as any[];
        const found = all.find((c) => c.getKey?.() === absolute) ?? all.find((c) => c.getKey?.()?.endsWith(`.${key}`));
        if (!found) return null;
        const foundKey = found.getKey();
        const visible = ((await schema.getVisibleFlatComponents()) as any[]).some((c) => c.getKey?.() === foundKey);
        return { component: found, visible };
    }
    private componentAssertion(key: string, schemaOrCheck: string | ((component: any) => boolean | Promise<boolean>) | null, check: ((component: any) => boolean | Promise<boolean>) | null, expect: (found: { component: any; visible: boolean }) => string | null): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const schemaName = this.schemaNameFor(typeof schemaOrCheck === 'string' ? schemaOrCheck : null);
            const callback = typeof schemaOrCheck === 'function' ? schemaOrCheck : check;
            await this.inspect(async (instance) => {
                const found = await this.findComponent(instance, key, schemaName);
                if (!found) fail(`Failed asserting that a component with the key [${key}] exists on the schema with the name [${schemaName}] on the [${this.className}] component.`);
                if (callback && !(await callback(found!.component))) fail(`Failed asserting that a component with the key [${key}] and provided configuration exists on the schema with the name [${schemaName}] on the [${this.className}] component.`);
                const problem = expect(found!);
                if (problem) fail(`Failed asserting that a component with the key [${key}] is ${problem} on the schema named [${schemaName}] of the [${this.className}] component.`);
            });
        });
    }
    assertSchemaComponentExists(key: string, schemaOrCheck: string | ((component: any) => boolean | Promise<boolean>) | null = null, check: ((component: any) => boolean | Promise<boolean>) | null = null): this { return this.componentAssertion(key, schemaOrCheck, check, () => null); }
    assertSchemaComponentDoesNotExist(key: string, schema: string | null = null): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const schemaName = this.schemaNameFor(schema);
            await this.inspect(async (instance) => { if (await this.findComponent(instance, key, schemaName)) fail(`Failed asserting that a component with the key [${key}] does not exist on the schema named [${schemaName}] of the [${this.className}] component.`); });
        });
    }
    assertSchemaComponentVisible(key: string, schema: string | null = null): this { return this.componentAssertion(key, schema, null, ({ visible }) => (visible ? null : 'visible')); }
    assertSchemaComponentHidden(key: string, schema: string | null = null): this { return this.componentAssertion(key, schema, null, ({ visible }) => (visible ? 'hidden' : null)); }
    assertFormComponentExists(key: string, schemaOrCheck: string | ((component: any) => boolean | Promise<boolean>) | null = null, check: ((component: any) => boolean | Promise<boolean>) | null = null): this { return this.assertSchemaComponentExists(key, schemaOrCheck, check); }

    // ---------------------------------------------------------------- actions
    private recordKeyOf(record: unknown): string {
        if (record === null || typeof record !== 'object') return String(record);
        const component = this.component as any;
        const adapter = component?.getDataAdapterForTable?.() ?? component?.getDataAdapter?.() ?? this.componentClass.resource?.adapter;
        if (!adapter) throw new Error('A record was given but the component has no data adapter: pass the record key instead.');
        return String(adapter.getKey(record));
    }
    /** Actions designated by a name (`'edit'`, nested `'edit.confirm'`), a TestAction, or a list of them (nested actions). */
    private parseActions(actions: Actions, args: Record<string, unknown> = {}, relativeToMounted = true): ActionSpec[] {
        const list: (ActionName | TestAction)[] = typeof actions === 'string' ? actions.split('.') : Array.isArray(actions) ? actions : [actions];
        const offset = relativeToMounted ? this.mountedCount() : 0;
        const specs = list.map((action, index): ActionSpec => {
            const nesting = offset + index;
            if (action instanceof TestAction) return action.toArray(nesting ? `mountedActionSchema${nesting - 1}` : this.defaultSchemaName(), (record) => this.recordKeyOf(record));
            return { name: actionNameOf(action), context: {} };
        });
        // Arguments keyed by action name (several actions), or for the last action.
        const names = specs.map((spec) => spec.name);
        const keyed = specs.length > 1 && Object.keys(args).length > 0 && Object.keys(args).every((key) => names.includes(key));
        specs.forEach((spec, index) => {
            const own = keyed ? (args[spec.name] as Record<string, unknown> | undefined) : index === specs.length - 1 && Object.keys(args).length ? args : undefined;
            if (own) spec.arguments = { ...(spec.arguments ?? {}), ...own };
        });
        return specs;
    }
    /**
     * Resolves actions after those already mounted: a nested action is one of the extra footer actions of the action before it
     * (its modal); others come from the page, the table (row, bulk) or a schema component. Returns `null` when one is missing.
     */
    private async resolveChain(component: any, specs: ActionSpec[]): Promise<{ action: any; context: Record<string, unknown>; spec: ActionSpec }[] | null> {
        const chain: { action: any; context: Record<string, unknown>; spec: ActionSpec }[] = [];
        const mounted = (component.mountedActions ?? []) as { name: string; arguments: Record<string, unknown>; context: Record<string, unknown> }[];
        for (const entry of mounted) {
            const parent = typeof entry.context.parentAction === 'number' ? chain[entry.context.parentAction] : null;
            const action = parent ? parent.action.getModalActions().find((a: any) => a.getName() === entry.name) : (await component.getMountableActions(entry.context)).find((a: any) => a.getName() === entry.name);
            if (!action) return null;
            chain.push({ action, context: entry.context, spec: { name: entry.name, arguments: entry.arguments, context: entry.context } });
        }
        for (const spec of specs) {
            const previous = chain[chain.length - 1];
            const explicit = spec.context.table !== undefined || spec.context.schemaComponent !== undefined || spec.context.bulk !== undefined;
            const nested = !explicit && previous ? (previous.action.getModalActions?.() ?? previous.action.getExtraModalFooterActions?.()).find((a: any) => a.getName() === spec.name) : undefined;
            if (nested) {
                const context = { ...previous.context, parentAction: chain.length - 1 };
                spec.context = { ...spec.context, parentAction: chain.length - 1 };
                chain.push({ action: nested, context, spec });
                continue;
            }
            const context = component.resolveMountContext(spec.context);
            const action = (await component.getMountableActions(context)).find((a: any) => a.getName() === spec.name);
            if (!action) return null;
            chain.push({ action, context, spec });
        }
        return chain;
    }
    private async actionState(component: any, entry: { action: any; context: Record<string, unknown>; spec: ActionSpec }): Promise<{ ctx: any }> {
        const record = await component.resolveActionRecord(entry.context);
        return { ctx: { livewire: component, component: null, operation: null, record, get: makeStateGetter(null, ''), state: undefined, arguments: entry.spec.arguments ?? {} } };
    }
    private prettyName(specs: ActionSpec[]): string { return specs.map((spec) => spec.name).join(' > '); }
    private actionAssertion(actions: Actions, args: Record<string, unknown>, check: ((action: any, ctx: any) => Promise<boolean> | boolean) | null, message: (pretty: string) => string): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const specs = this.parseActions(actions, args);
            await this.inspect(async (component) => {
                const chain = await this.resolveChain(component, specs);
                if (!chain) fail(`Failed asserting that an action with name [${this.prettyName(specs)}] exists on the [${this.className}] component.`);
                const last = chain![chain!.length - 1];
                if (check) {
                    const { ctx } = await this.actionState(component, last);
                    // `action.getModalDescription()`… without arguments evaluate with the action's context.
                    last.action.useEvaluationContext?.(ctx);
                    let passed: boolean;
                    try { passed = await check(last.action, ctx); } finally { last.action.useEvaluationContext?.(null); }
                    if (!passed) fail(message(this.prettyName(specs)));
                }
            });
        });
    }
    /** The action exists (optionally `check(action)` returns true). */
    assertActionExists(actions: Actions, check: ((action: any, ctx: any) => boolean | Promise<boolean>) | null = null, args: Record<string, unknown> = {}): this {
        return this.actionAssertion(actions, args, check ? (action, ctx) => check(action, ctx) : null, (name) => `Failed asserting that an action with the name [${name}] and provided configuration exists on the [${this.className}] component.`);
    }
    assertActionDoesNotExist(actions: Actions): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const specs = this.parseActions(actions);
            await this.inspect(async (component) => { if (await this.resolveChain(component, specs)) fail(`Failed asserting that an action with the name [${this.prettyName(specs)}] does not exist on the [${this.className}] component.`); });
        });
    }
    assertActionVisible(actions: Actions, args: Record<string, unknown> = {}): this { return this.actionAssertion(actions, args, (action, ctx) => action.isVisible(ctx), (name) => `Failed asserting that an action with name [${name}] is visible on the [${this.className}] component.`); }
    assertActionHidden(actions: Actions, args: Record<string, unknown> = {}): this { return this.actionAssertion(actions, args, async (action, ctx) => !(await action.isVisible(ctx)), (name) => `Failed asserting that an action with name [${name}] is hidden on the [${this.className}] component.`); }
    assertActionEnabled(actions: Actions, args: Record<string, unknown> = {}): this { return this.actionAssertion(actions, args, async (action, ctx) => !(await action.isDisabled(ctx)), (name) => `Failed asserting that an action with name [${name}] is enabled on the [${this.className}] component.`); }
    assertActionDisabled(actions: Actions, args: Record<string, unknown> = {}): this { return this.actionAssertion(actions, args, (action, ctx) => action.isDisabled(ctx), (name) => `Failed asserting that an action with name [${name}] is disabled on the [${this.className}] component.`); }
    assertActionHasLabel(actions: Actions, label: string): this { return this.actionAssertion(actions, {}, async (action, ctx) => (await action.getLabel(ctx)) === label, (name) => `Failed asserting that an action with name [${name}] has label [${label}] on the [${this.className}] component.`); }
    assertActionDoesNotHaveLabel(actions: Actions, label: string): this { return this.actionAssertion(actions, {}, async (action, ctx) => (await action.getLabel(ctx)) !== label, (name) => `Failed asserting that an action with name [${name}] does not have label [${label}] on the [${this.className}] component.`); }
    assertActionHasIcon(actions: Actions, icon: string): this { return this.actionAssertion(actions, {}, async (action, ctx) => (await action.getIcon(ctx)) === icon, (name) => `Failed asserting that an action with name [${name}] has icon [${icon}] on the [${this.className}] component.`); }
    assertActionDoesNotHaveIcon(actions: Actions, icon: string): this { return this.actionAssertion(actions, {}, async (action, ctx) => (await action.getIcon(ctx)) !== icon, (name) => `Failed asserting that an action with name [${name}] does not have icon [${icon}] on the [${this.className}] component.`); }
    assertActionHasColor(actions: Actions, color: string): this { return this.actionAssertion(actions, {}, (action) => action.getColor() === color, (name) => `Failed asserting that an action with name [${name}] has color [${color}] on the [${this.className}] component.`); }
    assertActionDoesNotHaveColor(actions: Actions, color: string): this { return this.actionAssertion(actions, {}, (action) => action.getColor() !== color, (name) => `Failed asserting that an action with name [${name}] does not have color [${color}] on the [${this.className}] component.`); }
    assertActionHasUrl(actions: Actions, url: string): this { return this.actionAssertion(actions, {}, (action, ctx) => action.resolveUrl(ctx) === url, (name) => `Failed asserting that an action with name [${name}] has URL [${url}] on the [${this.className}] component.`); }
    assertActionDoesNotHaveUrl(actions: Actions, url: string): this { return this.actionAssertion(actions, {}, (action, ctx) => action.resolveUrl(ctx) !== url, (name) => `Failed asserting that an action with name [${name}] does not have URL [${url}] on the [${this.className}] component.`); }
    assertActionShouldOpenUrlInNewTab(actions: Actions): this { return this.actionAssertion(actions, {}, (action) => action._newTab === true, (name) => `Failed asserting that an action with name [${name}] should open its URL in a new tab on the [${this.className}] component.`); }
    assertActionShouldNotOpenUrlInNewTab(actions: Actions): this { return this.actionAssertion(actions, {}, (action) => action._newTab !== true, (name) => `Failed asserting that an action with name [${name}] should not open its URL in a new tab on the [${this.className}] component.`); }

    /** Mounts actions one after the other, like clicking them (a nested action is clicked in the modal of the one before). */
    mountAction(actions: Actions, args: Record<string, unknown> = {}): this { return this.enqueue(() => this.mountActions(actions, args)); }
    private async mountActions(actions: Actions, args: Record<string, unknown>): Promise<ActionSpec[]> {
        this.ensureSucceeded();
        const specs = this.parseActions(actions, args);
        // Nested actions get their parent's index (resolved against the actions already mounted).
        await this.inspect((component) => this.resolveChain(component, specs));
        for (const spec of specs) {
            const before = this.mountedCount();
            const context = Object.fromEntries(Object.entries(spec.context).filter(([key]) => key !== 'test'));
            await this.request({}, [{ method: 'mountAction', params: [spec.name, spec.arguments ?? {}, context] }]);
            // An action without a modal ran at once; a refused one did not mount: the next ones cannot be clicked.
            if (this.status !== 200 || this.mountedCount() !== before + 1) break;
        }
        return specs;
    }
    /** Mounts the actions, fills the last one's form with `data`, then submits it (an action without a modal just runs). */
    callAction(actions: Actions, data: Record<string, unknown> = {}, args: Record<string, unknown> = {}): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const initial = this.mountedCount();
            const specs = this.parseActions(actions, args);
            await this.inspect(async (component) => {
                const chain = await this.resolveChain(component, specs);
                if (!chain) fail(`Failed asserting that an action with name [${this.prettyName(specs)}] exists on the [${this.className}] component.`);
                const last = chain![chain!.length - 1];
                if (!(await last.action.isVisible((await this.actionState(component, last)).ctx))) fail(`Failed asserting that an action with name [${this.prettyName(specs)}] is visible on the [${this.className}] component.`);
            });
            await this.mountActions(actions, args);
            if (this.status !== 200 || this.mountedCount() !== initial + specs.length) return;
            const mounted = (this.instance() as any).mountedActions;
            if (mounted[mounted.length - 1]?.name !== specs[specs.length - 1].name) return;
            if (typeof this.effects.redirect === 'string') return;
            if (Object.keys(data).length) {
                const statePath = await this.statePathOf(`mountedActionSchema${mounted.length - 1}`).catch(() => `mountedActions.${mounted.length - 1}.data`);
                await this.applyState(Object.fromEntries(Object.entries(flatten(data)).map(([key, value]) => [this.prefixed(statePath, key), value])));
            }
            await this.request({}, [{ method: 'callMountedAction', params: [specs[specs.length - 1].arguments ?? {}] }]);
        });
    }
    /** Submits the last mounted action (its modal's submit button). */
    callMountedAction(args: Record<string, unknown> = {}): this { return this.enqueue(async () => { if (this.mountedCount()) await this.request({}, [{ method: 'callMountedAction', params: [args] }]); }); }
    /** Closes the last mounted action's modal. */
    unmountAction(): this { return this.call('unmountAction'); }
    /** These actions are mounted, last ones of the stack (any mounted action without argument). */
    assertActionMounted(actions: Actions | null = null): this {
        return this.enqueue(() => {
            this.ensureSucceeded();
            const mounted = ((this.instance() as any).mountedActions ?? []) as { name: string; arguments: Record<string, unknown> }[];
            if (actions === null || (Array.isArray(actions) && !actions.length)) { if (!mounted.length) fail(`Failed asserting that an action is mounted on the [${this.className}] component.`); return; }
            const specs = this.parseActions(actions, {}, false);
            const offset = mounted.length - specs.length;
            if (offset < 0) fail(`Failed asserting that the action [${this.prettyName(specs)}] is mounted on the [${this.className}] component: ${mounted.length ? `mounted: [${mounted.map((m) => m.name).join(' > ')}]` : 'no action is mounted'}.`);
            specs.forEach((spec, index) => {
                const entry = mounted[offset + index];
                if (entry.name !== spec.name) fail(`Failed asserting that the action [${this.prettyName(specs)}] is mounted on the [${this.className}] component: mounted: [${mounted.map((m) => m.name).join(' > ')}].`);
                if (spec.arguments && !sameValue(entry.arguments, spec.arguments)) fail(`Failed asserting that the mounted arguments for the action [${spec.name}] match the expected arguments.`);
                if (spec.test && !spec.test.checkArguments(entry.arguments ?? {})) fail(`Failed asserting that the mounted arguments for the action [${spec.name}] match the expected arguments.`);
            });
        });
    }
    assertActionNotMounted(actions: Actions | null = null): this {
        return this.enqueue(() => {
            this.ensureSucceeded();
            const mounted = ((this.instance() as any).mountedActions ?? []) as { name: string }[];
            if (actions === null) { if (mounted.length) fail(`Failed asserting that no action is mounted on the [${this.className}] component: [${mounted.map((m) => m.name).join(' > ')}] is.`); return; }
            const names = this.parseActions(actions, {}, false).map((spec) => spec.name);
            const tail = mounted.slice(-names.length).map((m) => m.name);
            if (mounted.length >= names.length && sameValue(tail, names)) fail(`Failed asserting that the action [${names.join(' > ')}] is not mounted on the [${this.className}] component.`);
        });
    }
    /** The action stopped with `halt()`: its modal is still open. */
    assertActionHalted(actions: Actions | null = null): this { return this.assertActionMounted(actions); }
    assertActionHeld(actions: Actions | null = null): this { return this.assertActionMounted(actions); }
    /** The modal of the mounted action shows these texts. */
    assertMountedActionModalSee(values: string | string[]): this { return this.modalAssertion(values, true); }
    assertMountedActionModalDontSee(values: string | string[]): this { return this.modalAssertion(values, false); }
    private modalAssertion(values: string | string[], see: boolean): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            if (!this.mountedCount()) fail(`Failed asserting that an action is mounted on the [${this.className}] component.`);
            const html = decodeEntities(await this.inspect((component) => component.renderActionModals()));
            for (const value of [values].flat()) if (html.includes(value) !== see) fail(`Failed asserting that the mounted action modal ${see ? 'shows' : 'does not show'} [${value}].`);
        });
    }

    // ---------------------------------------------------------------- tables
    /** Selects table records (or their keys) for a bulk action, like ticking their checkboxes. */
    selectTableRecords(records: unknown[]): this { return this.enqueue(() => this.request({ selectedTableRecords: records.map((record) => this.recordKeyOf(record)), isTrackingDeselectedTableRecords: false }, [])); }
    mountTableAction(name: ActionName, record: unknown = null, args: Record<string, unknown> = {}): this { return this.mountAction(TestAction.make(name).table(record ?? true), args); }
    /** Calls a row action (with a record), or a header action (without). */
    callTableAction(name: ActionName, record: unknown = null, data: Record<string, unknown> = {}, args: Record<string, unknown> = {}): this { return this.callAction(TestAction.make(name).table(record ?? true), data, args); }
    callTableColumnAction(name: string, record: unknown): this { return this.callAction(TestAction.make(name).table(record)); }
    /** Selects the records, then calls the bulk action. */
    callTableBulkAction(name: ActionName, records: unknown[], data: Record<string, unknown> = {}, args: Record<string, unknown> = {}): this { return this.selectTableRecords(records).callAction(TestAction.make(name).table().bulk(), data, args); }
    mountTableBulkAction(name: ActionName, records: unknown[]): this { return this.selectTableRecords(records).mountAction(TestAction.make(name).table().bulk()); }
    callMountedTableAction(args: Record<string, unknown> = {}): this { return this.callMountedAction(args); }
    assertTableActionExists(name: ActionName, record: unknown = null): this { return this.assertActionExists(TestAction.make(name).table(record ?? true)); }
    assertTableActionDoesNotExist(name: ActionName, record: unknown = null): this { return this.assertActionDoesNotExist(TestAction.make(name).table(record ?? true)); }
    assertTableActionVisible(name: ActionName, record: unknown = null): this { return this.assertActionVisible(TestAction.make(name).table(record ?? true)); }
    assertTableActionHidden(name: ActionName, record: unknown = null): this { return this.assertActionHidden(TestAction.make(name).table(record ?? true)); }
    assertTableActionEnabled(name: ActionName, record: unknown = null): this { return this.assertActionEnabled(TestAction.make(name).table(record ?? true)); }
    assertTableActionDisabled(name: ActionName, record: unknown = null): this { return this.assertActionDisabled(TestAction.make(name).table(record ?? true)); }
    assertTableBulkActionExists(name: ActionName): this { return this.assertActionExists(TestAction.make(name).table().bulk()); }
    assertTableBulkActionDoesNotExist(name: ActionName): this { return this.assertActionDoesNotExist(TestAction.make(name).table().bulk()); }
    assertTableBulkActionVisible(name: ActionName): this { return this.assertActionVisible(TestAction.make(name).table().bulk()); }
    assertTableBulkActionHidden(name: ActionName): this { return this.assertActionHidden(TestAction.make(name).table().bulk()); }

    private recordRowKey(record: unknown): string { return `wire:key="${ejsEscape(`${this.snapshot!.memo.id}.table.records.${this.recordKeyOf(record)}`)}"`; }
    /** These records are shown in the table (in this order, with `{ inOrder: true }`). */
    assertCanSeeTableRecords(records: unknown[], options: boolean | { inOrder?: boolean } = false): this {
        return this.enqueue(() => {
            this.ensureSucceeded();
            const inOrder = typeof options === 'boolean' ? options : options.inOrder === true;
            let from = 0;
            for (const record of records) {
                const needle = this.recordRowKey(record);
                const at = this.lastHtml.indexOf(needle, inOrder ? from : 0);
                if (at < 0) fail(inOrder && this.lastHtml.includes(needle) ? `Failed asserting that the table shows the record [${this.recordKeyOf(record)}] in the expected order.` : `Failed asserting that the table shows the record [${this.recordKeyOf(record)}].`);
                from = at + needle.length;
            }
        });
    }
    assertCanNotSeeTableRecords(records: unknown[]): this {
        return this.enqueue(() => {
            this.ensureSucceeded();
            for (const record of records) if (this.lastHtml.includes(this.recordRowKey(record))) fail(`Failed asserting that the table does not show the record [${this.recordKeyOf(record)}].`);
        });
    }
    /** Number of records the table query returns (all pages). */
    assertCountTableRecords(count: number): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const total = await this.inspect(async (component) => (await getTableRecords(component.getTable(), component, component.getDataAdapterForTable())).total);
            if (total !== count) fail(`Failed asserting that the table has [${count}] records: it has [${total}].`);
        });
    }
    /** Searches the table, like typing in its search field. */
    searchTable(search: string | null = null): this { return this.set('tableSearch', search ?? ''); }
    /** Searches individual columns: `{ title: 'Hello' }`. */
    searchTableColumns(searches: Record<string, string>): this { return this.set(Object.fromEntries(Object.entries(searches).map(([name, search]) => [`tableColumnSearches.${name}`, search]))); }
    /** Sorts the table by a column (`'asc'` / `'desc'`; without a direction, like clicking the header). */
    sortTable(name: string | null = null, direction: 'asc' | 'desc' | null = null): this { return this.call('sortTable', name, direction); }
    /**
     * Applies a filter. A select filter takes its value (a list for `multiple()`), a ternary filter `true` / `false`, a toggle
     * filter nothing (on) or `false`; a filter with its own form takes its state (`{ from: '2024-01-01' }`).
     */
    filterTable(name: string, ...rest: unknown[]): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const data = rest[0];
            const filter = await this.inspect((component) => component.getTable().getFilters().find((candidate: any) => candidate.name === name));
            if (!filter) fail(`Failed asserting that a table filter with name [${name}] exists on the [${this.className}] component.`);
            let state: unknown;
            if (filter instanceof TernaryFilter) state = { value: data === true || (data === undefined && rest.length === 0) ? '1' : data === false ? '0' : data === null || data === undefined ? null : String(data) };
            else if (filter instanceof SelectFilter) state = filter.isMultiple() ? { values: [data ?? []].flat().map((value) => (value !== null && typeof value === 'object' ? this.recordKeyOf(value) : String(value))) } : { value: data === null || data === undefined ? null : typeof data === 'object' ? this.recordKeyOf(data) : String(data) };
            else if (isPlainObject(data)) state = data;
            else state = { isActive: data === true || data === undefined || data === null };
            await this.request({ [`tableFilters.${name}`]: state }, []);
        });
    }
    /** Resets the filters to their defaults. */
    resetTableFilters(): this { return this.call('resetTableFiltersForm'); }
    removeTableFilter(name: string, field: string | null = null): this { return this.call('removeTableFilter', name, field); }
    removeTableFilters(): this { return this.call('removeTableFilters'); }
    /** Tables load with the page: kept for compatibility. */
    loadTable(): this { return this; }
    /** Shows (or hides) every toggleable column, through the column manager. */
    toggleAllTableColumns(condition = true): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const state = ((this.instance() as any).tableColumns ?? []).map((column: any) => (column.isToggleable ? { ...column, isToggled: condition } : column));
            await this.request({}, [{ method: 'applyTableColumnManager', params: [state, false] }]);
        });
    }
    private columnAssertion(name: string, check: ((column: any, component: any) => boolean | Promise<boolean>) | null, message: string): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            await this.inspect(async (component) => {
                const column = component.getTable().getColumn(name);
                if (!column) fail(`Failed asserting that a table column with name [${name}] exists on the [${this.className}] component.`);
                if (check && !(await check(column, component))) fail(message);
            });
        });
    }
    private async loadRecord(component: any, record: unknown): Promise<unknown> {
        if (record !== null && typeof record === 'object') return record;
        // Loaded like a row of the table: relationships of dot-notation columns and relationship aggregates included.
        const adapter = component.getDataAdapterForTable();
        const row = (await adapter.paginate({ ...getTableQuery(component.getTable(), component), keys: [String(record)], page: 1, perPage: 1 })).records[0];
        if (row) return row;
        const found = await adapter.find(String(record));
        if (!found) fail(`Failed asserting that the record [${String(record)}] exists in the table of the [${this.className}] component.`);
        return found;
    }
    /** The column exists (optionally `check(column)` returns true, given the record if one is passed). */
    assertTableColumnExists(name: string, check: ((column: any) => boolean | Promise<boolean>) | null = null, record: unknown = null): this {
        return this.columnAssertion(name, check ? async (column, component) => { if (record !== null) await this.loadRecord(component, record); return check(column); } : null, `Failed asserting that a table column with name [${name}] and provided configuration exists on the [${this.className}] component.`);
    }
    assertTableColumnDoesNotExist(name: string): this {
        return this.enqueue(async () => { this.ensureSucceeded(); await this.inspect((component) => { if (component.getTable().getColumn(name)) fail(`Failed asserting that a table column with name [${name}] does not exist on the [${this.className}] component.`); }); });
    }
    /** The column is shown (not toggled hidden). */
    assertTableColumnVisible(name: string): this { return this.columnAssertion(name, (_column, component) => getVisibleColumns(component.getTable(), component).some((c: any) => c.name === name), `Failed asserting that a table column with name [${name}] is visible on the [${this.className}] component.`); }
    assertTableColumnHidden(name: string): this { return this.columnAssertion(name, (_column, component) => !getVisibleColumns(component.getTable(), component).some((c: any) => c.name === name), `Failed asserting that a table column with name [${name}] is hidden on the [${this.className}] component.`); }
    /** The column's state for a record (or its key). */
    assertTableColumnStateSet(name: string, value: unknown, record: unknown): this {
        return this.columnAssertion(name, async (column, component) => sameValue(await column.getState(await this.loadRecord(component, record)), value), `Failed asserting that a table column with name [${name}] has the state ${show(value)} for the record [${this.recordKeyOf(record)}] on the [${this.className}] component.`);
    }
    assertTableColumnStateNotSet(name: string, value: unknown, record: unknown): this {
        return this.columnAssertion(name, async (column, component) => !sameValue(await column.getState(await this.loadRecord(component, record)), value), `Failed asserting that a table column with name [${name}] does not have the state ${show(value)} for the record [${this.recordKeyOf(record)}] on the [${this.className}] component.`);
    }
    /** Description of a text column for a record, below the value (default) or `'above'`. */
    private async descriptionOf(column: any, component: any, record: unknown, position: 'above' | 'below'): Promise<string | null> {
        const description = position === 'above' ? column._descriptionAbove : column._descriptionBelow;
        const value = typeof description === 'function' ? description(await this.loadRecord(component, record)) : description;
        return value ?? null;
    }
    assertTableColumnHasDescription(name: string, description: string, record: unknown, position: 'above' | 'below' = 'below'): this {
        return this.columnAssertion(name, async (column, component) => (await this.descriptionOf(column, component, record, position)) === description, `Failed asserting that a table column with name [${name}] has the description [${description}] on the [${this.className}] component.`);
    }
    assertTableColumnDoesNotHaveDescription(name: string, description: string, record: unknown, position: 'above' | 'below' = 'below'): this {
        return this.columnAssertion(name, async (column, component) => (await this.descriptionOf(column, component, record, position)) !== description, `Failed asserting that a table column with name [${name}] does not have the description [${description}] on the [${this.className}] component.`);
    }
    /** Summarizer of a column, by its kind (`sum`, `average`, `count`, `range`, `values`) or its label. */
    private summarizerOf(column: any, id: string): Summarizer | undefined {
        const kind = id === 'average' ? 'avg' : id;
        return (column.getSummarizers?.() ?? []).find((summarizer: any) => summarizer.kind === kind || summarizer.getLabel?.() === id);
    }
    assertTableColumnSummarizerExists(name: string, id: string): this {
        return this.columnAssertion(name, (column) => this.summarizerOf(column, id) !== undefined, `Failed asserting that a table column with name [${name}] has a summarizer [${id}] on the [${this.className}] component.`);
    }
    private async summaryState(component: any, name: string, id: string, pageOnly: boolean): Promise<unknown> {
        const table = component.getTable(), adapter = component.getDataAdapterForTable();
        const column = table.getColumn(name);
        const summarizer: any = this.summarizerOf(column, id);
        if (!summarizer) fail(`Failed asserting that a table column with name [${name}] has a summarizer [${id}] on the [${this.className}] component.`);
        const field = column.getSortColumn?.() ?? column.name;
        let query: any = getTableQuery(table, component);
        if (pageOnly) query = { ...query, keys: (await getTableRecords(table, component, adapter)).records.map((record: unknown) => adapter.getKey(record)) };
        const scope = summarizer.getQueryScope?.();
        if (scope) query = { ...query, modifiers: [...(query.modifiers ?? []), (q: any) => { scope(q); }] };
        const records = async () => (await adapter.paginate({ ...query, page: 1, perPage: 10000 })).records;
        if (summarizer.hasCustomCalculation()) return summarizer.compute({ column: column.name, records });
        const values = await adapter.aggregate(query, { sum: [field], avg: [field], min: [field], max: [field] });
        if (summarizer.kind === 'sum') return values.sum[field] ?? 0;
        if (summarizer.kind === 'avg') return values.avg[field] ?? 0;
        if (summarizer.kind === 'count') return values.count;
        if (summarizer.kind === 'range') return [values.min[field], values.max[field]];
        return null;
    }
    /** The column summary (all records, or only the current page) equals this value (numbers rounded to 4 decimals). */
    assertTableColumnSummarySet(name: string, id: string, state: unknown, isCurrentPaginationPageOnly = false): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const actual = await this.inspect((component) => this.summaryState(component, name, id, isCurrentPaginationPageOnly));
            if (!sameValue(normalizeSummary(actual), normalizeSummary(state))) fail(`Failed asserting that summarizer [${id}], for column [${name}], on the [${this.className}] component, is set: expected ${show(state)}, got ${show(actual)}.`);
        });
    }
    assertTableColumnSummaryNotSet(name: string, id: string, state: unknown, isCurrentPaginationPageOnly = false): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const actual = await this.inspect((component) => this.summaryState(component, name, id, isCurrentPaginationPageOnly));
            if (sameValue(normalizeSummary(actual), normalizeSummary(state))) fail(`Failed asserting that summarizer [${id}], for column [${name}], on the [${this.className}] component, is not set.`);
        });
    }
    /** The filter exists (optionally `check(filter)` returns true). */
    assertTableFilterExists(name: string, check: ((filter: any) => boolean | Promise<boolean>) | null = null): this {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            await this.inspect(async (component) => {
                const filter = component.getTable().getFilters().find((candidate: any) => candidate.name === name);
                if (!filter) fail(`Failed asserting that a table filter with name [${name}] exists on the [${this.className}] component.`);
                if (check && !(await check(filter))) fail(`Failed asserting that a table filter with name [${name}] and provided configuration exists on the [${this.className}] component.`);
            });
        });
    }
}
installTestingExtras(Testable);
