// Configurable resources and pages: one class registered several times in a panel, each registration with a key of its own,
// its own slug, navigation item and options. Each registration is served by a generated subclass of the resource or page,
// which carries its configuration: `this.getConfiguration()` in the class's static methods returns it.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Page, Panel, Resource } from './index.ts';
import { getCurrentPanel } from './plugins.ts';

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const checkKey = (owner: string, key: string): string => {
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) throw new Error(`${owner}: invalid configuration key "${key}" (letters, digits, "-" and "_").`);
    return key;
};
const cleanSlug = (slug: string | null): string | null => (slug === null ? null : slug.replace(/^\/+|\/+$/g, ''));

/**
 * Options of one registration of a resource: `OrderResource.make('archived')` creates it (with the resource's
 * `configurationClass`), `panel.resources([...])` registers it. Extend it with your own options: setters return `this`.
 */
export class ResourceConfiguration {
    protected readonly resource: typeof Resource;
    protected readonly key: string;
    protected _slug: string | null = null;
    protected _navigationLabel: string | null = null;
    protected _navigationIcon: string | null = null;
    protected _navigationGroup: string | null = null;
    protected _navigationSort: number | null = null;
    protected _modelLabel: string | null = null;
    protected _pluralModelLabel: string | null = null;

    constructor(resource: typeof Resource, key: string) {
        this.resource = resource;
        this.key = checkKey(resource.name, key);
    }
    static make<T extends ResourceConfiguration>(this: new (resource: typeof Resource, key: string) => T, resource: typeof Resource, key: string): T { return new this(resource, key); }

    getKey(): string { return this.key; }
    getResource(): typeof Resource { return this.resource; }
    /** URL slug of this registration; by default the resource's slug followed by the key (`orders/archived`). */
    slug(slug: string | null): this { this._slug = cleanSlug(slug); return this; }
    getSlug(): string | null { return this._slug; }
    navigationLabel(label: string | null): this { this._navigationLabel = label; return this; }
    getNavigationLabel(): string | null { return this._navigationLabel; }
    navigationIcon(icon: string | null): this { this._navigationIcon = icon; return this; }
    getNavigationIcon(): string | null { return this._navigationIcon; }
    navigationGroup(group: string | null): this { this._navigationGroup = group; return this; }
    getNavigationGroup(): string | null { return this._navigationGroup; }
    navigationSort(sort: number | null): this { this._navigationSort = sort; return this; }
    getNavigationSort(): number | null { return this._navigationSort; }
    modelLabel(label: string | null): this { this._modelLabel = label; return this; }
    getModelLabel(): string | null { return this._modelLabel; }
    pluralModelLabel(label: string | null): this { this._pluralModelLabel = label; return this; }
    getPluralModelLabel(): string | null { return this._pluralModelLabel; }

    /**
     * Applies the options to the class serving this registration (a subclass of the resource), before its pages are built.
     * Override it to set other static properties: call `super.apply(resource)` first.
     */
    apply(resource: typeof Resource): void {
        const target = resource as any;
        if (this.getNavigationLabel() !== null) target.navigationLabel = this.getNavigationLabel();
        if (this.getNavigationIcon() !== null) target.navigationIcon = this.getNavigationIcon();
        if (this.getNavigationGroup() !== null) target.navigationGroup = this.getNavigationGroup();
        if (this.getNavigationSort() !== null) target.navigationSort = this.getNavigationSort();
        if (this.getModelLabel() !== null) target.modelLabel = this.getModelLabel();
        if (this.getPluralModelLabel() !== null) target.pluralModelLabel = this.getPluralModelLabel();
    }
}

/** Options of one registration of a page: `SettingsPage.make('advanced')`, registered with `panel.pages([...])`. */
export class PageConfiguration {
    protected readonly page: typeof Page;
    protected readonly key: string;
    protected _slug: string | null = null;
    protected _title: string | null = null;
    protected _navigationLabel: string | null = null;
    protected _navigationIcon: string | null = null;
    protected _navigationGroup: string | null = null;
    protected _navigationSort: number | null = null;

    constructor(page: typeof Page, key: string) {
        this.page = page;
        this.key = checkKey(page.name, key);
    }
    static make<T extends PageConfiguration>(this: new (page: typeof Page, key: string) => T, page: typeof Page, key: string): T { return new this(page, key); }

    getKey(): string { return this.key; }
    getPage(): typeof Page { return this.page; }
    /** URL slug of this registration; by default the page's slug followed by the key (`settings/advanced`). */
    slug(slug: string | null): this { this._slug = cleanSlug(slug); return this; }
    getSlug(): string | null { return this._slug; }
    title(title: string | null): this { this._title = title; return this; }
    getTitle(): string | null { return this._title; }
    navigationLabel(label: string | null): this { this._navigationLabel = label; return this; }
    getNavigationLabel(): string | null { return this._navigationLabel; }
    navigationIcon(icon: string | null): this { this._navigationIcon = icon; return this; }
    getNavigationIcon(): string | null { return this._navigationIcon; }
    navigationGroup(group: string | null): this { this._navigationGroup = group; return this; }
    getNavigationGroup(): string | null { return this._navigationGroup; }
    navigationSort(sort: number | null): this { this._navigationSort = sort; return this; }
    getNavigationSort(): number | null { return this._navigationSort; }

    /** Applies the options to the class serving this registration (a subclass of the page). Override it for other options. */
    apply(page: typeof Page): void {
        const target = page as any;
        if (this.getTitle() !== null) target.title = this.getTitle();
        if (this.getNavigationLabel() !== null) target.navigationLabel = this.getNavigationLabel();
        if (this.getNavigationIcon() !== null) target.navigationIcon = this.getNavigationIcon();
        if (this.getNavigationGroup() !== null) target.navigationGroup = this.getNavigationGroup();
        if (this.getNavigationSort() !== null) target.navigationSort = this.getNavigationSort();
    }
}

type Configuration = ResourceConfiguration | PageConfiguration;
type Registration = { panel: Panel; configuration: Configuration; base: Function; target: Function };

/** Configuration carried by a generated subclass (own static property). */
const OWN = Symbol('navette.configuration');
const registrations = new WeakMap<Configuration, Registration>();
const byPanel = new WeakMap<Panel, Registration[]>();
const byBase = new WeakMap<Function, Registration[]>();

const ownConfiguration = (cls: Function): Configuration | null => (Object.hasOwn(cls, OWN) ? (cls as any)[OWN] : null);
/** The class a registration is configuring: the resource or page itself for a generated subclass. */
const baseOf = (cls: Function): Function => {
    const own = ownConfiguration(cls);
    return own ? (own instanceof ResourceConfiguration ? own.getResource() : own.getPage()) : cls;
};
/** The resource or page class configured by a registration's generated subclass (the class itself otherwise). */
export const configuredBaseOf = (cls: Function): Function => baseOf(cls);
const baseFor = (configuration: Configuration): Function => (configuration instanceof ResourceConfiguration ? configuration.getResource() : configuration.getPage());

/** A subclass keeping the class's name (titles and labels may be derived from it). */
function configuredSubclass<T extends Function>(base: T, configuration: Configuration, panel: Panel): T {
    if (registrations.has(configuration)) throw new Error(`${base.name}: the configuration "${configuration.getKey()}" is already registered. Create one configuration per panel.`);
    const existing = byPanel.get(panel) ?? [];
    if (existing.some((registration) => registration.base === base && registration.configuration.getKey() === configuration.getKey())) {
        throw new Error(`${base.name}: a configuration with the key "${configuration.getKey()}" is already registered on panel "${panel.getId()}".`);
    }
    const Base = base as any;
    const target = ({ [base.name]: class extends Base {} })[base.name] as unknown as T;
    Object.defineProperty(target, OWN, { value: configuration, enumerable: false });
    (target as any).slug = configuration.getSlug() ?? [Base.slug, configuration.getKey()].filter(Boolean).join('/');
    const registration: Registration = { panel, configuration, base, target };
    registrations.set(configuration, registration);
    byPanel.set(panel, [...existing, registration]);
    byBase.set(base, [...(byBase.get(base) ?? []), registration]);
    return target;
}

/** Resource class to register for an entry of `panel.resources()`: the class itself, or a configured subclass. */
export function resolveResourceRegistration(panel: Panel, entry: typeof Resource | ResourceConfiguration): typeof Resource {
    if (!(entry instanceof ResourceConfiguration)) return entry;
    const target = configuredSubclass(entry.getResource(), entry, panel);
    entry.apply(target);
    return target;
}
/** Page class to register for an entry of `panel.pages()`. */
export function resolvePageRegistration(panel: Panel, entry: typeof Page | PageConfiguration): typeof Page {
    if (!(entry instanceof PageConfiguration)) return entry;
    const target = configuredSubclass(entry.getPage(), entry, panel);
    entry.apply(target);
    return target;
}

/** Configurations registered on a panel. */
export function getPanelConfigurations(panel: Panel, kind: 'resource'): ResourceConfiguration[];
export function getPanelConfigurations(panel: Panel, kind: 'page'): PageConfiguration[];
export function getPanelConfigurations(panel: Panel, kind: 'resource' | 'page'): Configuration[] {
    const type = kind === 'resource' ? ResourceConfiguration : PageConfiguration;
    return (byPanel.get(panel) ?? []).map((registration) => registration.configuration).filter((configuration) => configuration instanceof type);
}
/** A configuration of a resource or page (or one of its registrations) on a panel, by key. */
export function findConfiguration(panel: Panel, cls: Function, key: string): Configuration | null {
    const base = baseOf(cls);
    return (byPanel.get(panel) ?? []).find((registration) => registration.base === base && registration.configuration.getKey() === key)?.configuration ?? null;
}
/** The class serving a configuration. */
export function getConfiguredClass<T extends Function>(configuration: Configuration): T | null { return (registrations.get(configuration)?.target as T | undefined) ?? null; }

type Scope = { explicit: Map<Function, Configuration>; request: Map<Function, Configuration> };
const scope = new AsyncLocalStorage<Scope>();

/**
 * Active configuration of a resource or page class: the one selected by `withConfiguration()`, otherwise the class's own
 * (a registration's class), otherwise the one of the current request (a page of that registration is being served).
 */
export function getActiveConfiguration(cls: Function): Configuration | null {
    const store = scope.getStore();
    const base = baseOf(cls);
    return store?.explicit.get(base) ?? ownConfiguration(cls) ?? store?.request.get(base) ?? null;
}

/** Panel to look configurations up in: the current request's, the registration's, or the only panel the class is configured on. */
const panelOf = (cls: Function): Panel | null => {
    const current = getCurrentPanel();
    if (current) return current;
    const own = ownConfiguration(cls);
    if (own) return registrations.get(own)?.panel ?? null;
    const panels = new Set((byBase.get(cls) ?? []).map((registration) => registration.panel));
    return panels.size === 1 ? [...panels][0] : (((cls as any).panel as Panel | undefined) ?? null);
};

/** Runs `fn` with the configuration `key` of this resource or page active. */
export function withConfiguration<T>(cls: Function, key: string, fn: () => T, panel: Panel | null = panelOf(cls)): T {
    const configuration = panel ? findConfiguration(panel, cls, key) : null;
    if (!configuration) throw new Error(`Configuration "${key}" not found for ${cls.name}${panel ? ` on panel "${panel.getId()}"` : ''}.`);
    const store = scope.getStore();
    const explicit = new Map(store?.explicit);
    explicit.set(baseOf(cls), configuration);
    return scope.run({ explicit, request: store?.request ?? new Map() }, fn);
}

/** Runs a request of a page with its registration (and its resource's) as the request's configurations. */
export function withRequestConfiguration<T>(page: Function | null | undefined, fn: () => T): T {
    if (!page) return fn();
    const request = new Map<Function, Configuration>();
    for (const cls of [page, (page as any).resource, (page as any).parentResource]) {
        const own = cls ? ownConfiguration(cls) : null;
        if (own) request.set(baseFor(own), own);
    }
    if (!request.size) return fn();
    const store = scope.getStore();
    return scope.run({ explicit: store?.explicit ?? new Map(), request }, fn);
}

/**
 * Class to generate a URL with: `configuration: 'archived'` targets that registration, `null` the class's own (default)
 * registration, `undefined` the active configuration.
 */
export function resolveUrlTarget<T extends Function>(cls: T, configuration: string | null | undefined, panel: Panel | null = panelOf(cls)): T {
    if (configuration === null) return baseOf(cls) as T;
    const selected = configuration === undefined ? getActiveConfiguration(cls) : panel ? findConfiguration(panel, cls, configuration) : null;
    if (configuration !== undefined && !selected) throw new Error(`Configuration "${configuration}" not found for ${cls.name}${panel ? ` on panel "${panel.getId()}"` : ''}.`);
    return selected ? (getConfiguredClass<T>(selected) ?? cls) : cls;
}

/** Whether a page is served for a configured registration (its own, or its resource's). */
const isConfigured = (page: unknown): boolean => [page, (page as any)?.resource, (page as any)?.parentResource].some((cls) => typeof cls === 'function' && ownConfiguration(cls) !== null);

/**
 * Order in which page routes are added: fixed slugs before slugs with parameters, so `orders/archived` (a configuration)
 * is not taken for the record `archived` of `orders/{record}`.
 */
export function routeOrder<T extends { slug: string }>(pages: T[]): T[] {
    const seen = new Map<string, T>();
    for (const page of pages) {
        const other = seen.get(page.slug);
        if (other && other !== page && (isConfigured(page) || isConfigured(other))) {
            throw new Error(`Two registrations are served at "${page.slug}": give the configuration another key or a slug() of its own.`);
        }
        seen.set(page.slug, page);
    }
    const parameters = (page: T) => (page.slug.match(/\{/g) ?? []).length;
    return pages.map((page, index) => ({ page, index })).sort((a, b) => parameters(a.page) - parameters(b.page) || a.index - b.index).map(({ page }) => page);
}

/**
 * Whether a menu item whose pages live under `base` is the active one for the URL `current`: the URL is `base` or below it,
 * and not below the URL of another, more specific menu item (a configuration served at `orders/archived`).
 */
export function isClosestNavigationUrl(base: string, current: string, menuUrls: string[]): boolean {
    const under = (url: string) => current === url || current.startsWith(url === '/' ? '/' : `${url}/`);
    if (!under(base)) return false;
    return !menuUrls.some((url) => url.length > base.length && url.startsWith(base === '/' ? '/' : `${base}/`) && under(url));
}
