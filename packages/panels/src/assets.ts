// Asset registration: stylesheets, scripts and asynchronous Alpine components of the application and its plugins,
// served by the panel router with versioned URLs and rendered in the panel layout (or loaded on request).
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import type { Request, Response, NextFunction } from 'express';
import { cspNonce, cspNonceAttribute, e } from '@navette-js/support';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}){0,9}$/;
const PACKAGE = /^@?[a-z0-9][a-z0-9._-]{0,99}(?:\/[a-z0-9][a-z0-9._-]{0,99})?$/;

/** A file of the asset system: an id unique within its package, and a local file path or an URL. */
export abstract class Asset {
    protected id: string;
    protected path: string | null;
    protected isLoadedOnRequestFlag = false;
    protected packageName: string | null = null;
    constructor(id: string, path: string | null = null) {
        if (!ID.test(id)) throw new Error(`Invalid asset id: ${id}`);
        this.id = id;
        this.path = path;
    }
    static make<T extends Asset>(this: new (id: string, path?: string | null) => T, id: string, path: string | null = null): T { return new this(id, path); }
    /** Not loaded on every page: the page loads it when needed (`x-load-css`, `x-load-js`, `x-load-src`). */
    loadedOnRequest(condition = true): this { this.isLoadedOnRequestFlag = condition; return this; }
    isLoadedOnRequest(): boolean { return this.isLoadedOnRequestFlag; }
    package(name: string | null): this {
        if (name !== null && !PACKAGE.test(name)) throw new Error(`Invalid asset package: ${name}`);
        this.packageName = name;
        return this;
    }
    getId(): string { return this.id; }
    getPackage(): string | null { return this.packageName; }
    getPath(): string | null { return this.path; }
    /** An URL (`https://…`, `//…` or a path of the application, `/js/local.js`): rendered as-is, not served by the panel. */
    isRemote(): boolean { return typeof this.path === 'string' && /^(https?:)?\/\//.test(this.path); }
    /**
     * An URL rather than a local file: remote, or a path starting with `/` that is not on disk. A missing file under an existing
     * top-level directory (`/tmp/x/missing.css` on Linux) stays a file path, so the typo is reported instead of becoming a broken URL.
     */
    isUrl(): boolean {
        if (this.isRemote()) return true;
        if (typeof this.path !== 'string' || !this.path.startsWith('/') || fileExists(this.path)) return false;
        const topLevel = this.path.split('/')[1];
        return !topLevel || !directoryExists(`/${topLevel}`);
    }
    /** Path of the file under the site root, as served: `css/<package>/<id>.css`. */
    abstract getRelativePublicPath(): string;
    /** Hash of the file's content, changing whenever the file does (cache busting). */
    getVersion(): string { return this.path && !this.isUrl() ? fileVersion(this.path) : '0'; }
    /** URL of the file: versioned when it is served by the panel. */
    getUrl(): string { return this.isUrl() ? this.path! : `/${this.getRelativePublicPath()}?v=${this.getVersion()}`; }
}

const fileExists = (path: string): boolean => { try { return statSync(path).isFile(); } catch { return false; } };
const directoryExists = (path: string): boolean => { try { return statSync(path).isDirectory(); } catch { return false; } };
const versions = new Map<string, { key: string; version: string }>();
function fileVersion(path: string): string {
    let stat;
    try { stat = statSync(path); } catch { throw new Error(`Asset file not found: ${path}`); }
    const key = `${stat.mtimeMs}:${stat.size}`;
    const cached = versions.get(path);
    if (cached?.key === key) return cached.version;
    const version = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);
    versions.set(path, { key, version });
    return version;
}

/** A stylesheet: `Css.make('custom-stylesheet', join(import.meta.dirname, '../resources/css/custom.css'))`. */
export class Css extends Asset {
    protected htmlValue: string | null = null;
    protected relativePublicPathValue: string | null = null;
    /** Markup rendered instead of the `<link>` (trusted: written by the application, never from end users). */
    html(html: string | null): this { this.htmlValue = html; return this; }
    relativePublicPath(path: string | null): this {
        if (path !== null && (!/^[A-Za-z0-9][A-Za-z0-9._/-]*\.css$/.test(path) || path.includes('..'))) throw new Error(`Invalid public path: ${path}`);
        this.relativePublicPathValue = path;
        return this;
    }
    getRelativePublicPath(): string { return this.relativePublicPathValue ?? `css/${this.packageName ?? 'app'}/${this.id}.css`; }
    getHref(): string { return this.getUrl(); }
    getHtml(): string {
        if (this.htmlValue?.includes('<link')) return this.htmlValue;
        return `<link href="${e(this.htmlValue ?? this.getHref())}" rel="stylesheet" data-navigate-track />`;
    }
}

/** A script, loaded on every page of the panel unless `loadedOnRequest()`. */
export class Js extends Asset {
    protected isAsyncFlag = false;
    protected isDeferredFlag = false;
    protected isCoreFlag = false;
    protected isNavigateOnceFlag = true;
    protected isModuleFlag = false;
    protected extraAttributesValue: Record<string, string> = {};
    protected htmlValue: string | null = null;
    async(condition = true): this { this.isAsyncFlag = condition; return this; }
    defer(condition = true): this { this.isDeferredFlag = condition; return this; }
    /** Loaded with the panel's own scripts, after the other registered scripts. */
    core(condition = true): this { this.isCoreFlag = condition; return this; }
    /** In SPA mode, run once rather than after each navigation (default). */
    navigateOnce(condition = true): this { this.isNavigateOnceFlag = condition; return this; }
    /** An ES module (`type="module"`). */
    module(condition = true): this { this.isModuleFlag = condition; return this; }
    /** Markup rendered instead of the `<script>` (trusted: written by the application, never from end users). */
    html(html: string | null): this { this.htmlValue = html; return this; }
    /** Extra attributes of the `<script>` tag. Names must be attribute names; values are escaped. */
    extraAttributes(attributes: Record<string, string>): this {
        for (const name of Object.keys(attributes)) if (!/^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/.test(name)) throw new Error(`Invalid attribute name: ${name}`);
        this.extraAttributesValue = { ...attributes };
        return this;
    }
    isAsync(): boolean { return this.isAsyncFlag; }
    isDeferred(): boolean { return this.isDeferredFlag; }
    isCore(): boolean { return this.isCoreFlag; }
    isNavigateOnce(): boolean { return this.isNavigateOnceFlag; }
    isModule(): boolean { return this.isModuleFlag; }
    getExtraAttributes(): Record<string, string> { return this.extraAttributesValue; }
    getRelativePublicPath(): string { return `js/${this.packageName ?? 'app'}/${this.id}.js`; }
    getSrc(): string { return this.getUrl(); }
    getHtml(spa = true): string {
        if (this.htmlValue?.includes('<script')) return this.htmlValue;
        const attributes = [
            `src="${e(this.htmlValue ?? this.getSrc())}"`,
            // A strict Content-Security-Policy: the request's nonce (`useCspNonce()`).
            cspNonce() ? `nonce="${cspNonce()}"` : null,
            this.isAsyncFlag ? 'async' : null, this.isDeferredFlag ? 'defer' : null, this.isModuleFlag ? 'type="module"' : null,
            ...Object.entries(this.extraAttributesValue).map(([name, value]) => `${name}="${e(String(value))}"`),
            spa && this.isNavigateOnceFlag ? 'data-navigate-once' : null, spa ? 'data-navigate-track' : null,
        ].filter(Boolean);
        return `<script ${attributes.join(' ')}></script>`;
    }
}

/** An Alpine component loaded on request: `<div x-load x-load-src="${NavetteAsset.getAlpineComponentSrc('chart')}" x-data="chart()">`. */
export class AlpineComponent extends Asset {
    constructor(id: string, path: string | null = null) { super(id, path); this.isLoadedOnRequestFlag = true; }
    getRelativePublicPath(): string { return `js/${this.packageName ?? 'app'}/components/${this.id}.js`; }
    getSrc(): string { return this.getUrl(); }
}

type Registered = { asset: Asset; panels: Set<string> | null };

/** CSS custom property names, and values that cannot leave their declaration or the `<style>` element. */
const cssVariable = (name: string, value: unknown): string | null => {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(name)) return null;
    const text = String(value ?? '').replace(/[<>{};\\]/g, '').replace(/[\r\n]/g, ' ');
    return `--${name}:${text};`;
};
/** JSON safe inside a `<script>` element. */
const scriptJson = (value: unknown): string => JSON.stringify(value ?? {}).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/**
 * Registry of the stylesheets, scripts, Alpine components, CSS variables and script data of the application and its plugins.
 * Assets registered here load on every panel; `panel.assets()` registers them for one panel.
 */
export class AssetManager {
    private assets: Registered[] = [];
    private cssVariables: { packageName: string | null; panels: Set<string> | null; variables: Record<string, unknown> }[] = [];
    private scriptData: { packageName: string | null; panels: Set<string> | null; data: Record<string, unknown> }[] = [];

    /** Registers assets for a package (`'app'` by default; a plugin passes its npm package name, `'acme/navette-blog'`). */
    register(assets: Asset[], packageName = 'app', options: { panel?: string | null } = {}): void {
        for (const asset of assets) {
            asset.package(packageName);
            if (!(asset instanceof Css) && !(asset instanceof Js) && !(asset instanceof AlpineComponent)) throw new Error('register(): only Css, Js and AlpineComponent assets can be registered.');
            if (!asset.getPath()) throw new Error(`Asset ${asset.getId()}: no path or URL.`);
            if (!asset.isUrl() && !fileExists(asset.getPath()!)) throw new Error(`Asset ${asset.getId()}: file not found: ${asset.getPath()}`);
            const existing = this.assets.find((entry) => entry.asset.constructor === asset.constructor && entry.asset.getPackage() === packageName && entry.asset.getId() === asset.getId());
            if (existing) {
                // The same file registered again (by another panel): one entry, available to both.
                if (existing.asset.getPath() !== asset.getPath()) throw new Error(`Asset ${asset.getId()} of package ${packageName} is already registered with another file.`);
                existing.panels = existing.panels === null || !options.panel ? null : existing.panels.add(options.panel);
                continue;
            }
            const clash = asset.isUrl() ? undefined : this.assets.find((entry) => !entry.asset.isUrl() && entry.asset.getRelativePublicPath() === asset.getRelativePublicPath());
            if (clash) throw new Error(`Asset ${asset.getId()}: its URL /${asset.getRelativePublicPath()} is already used by another asset.`);
            this.assets.push({ asset, panels: options.panel ? new Set([options.panel]) : null });
        }
    }
    /** CSS custom properties available to every stylesheet: `registerCssVariables({ 'background-image': 'url(/images/bg.jpg)' })`. */
    registerCssVariables(variables: Record<string, unknown>, packageName: string | null = null, options: { panel?: string | null } = {}): void {
        this.cssVariables.push({ packageName, panels: options.panel ? new Set([options.panel]) : null, variables: { ...variables } });
    }
    /** Values exposed to scripts as `window.navetteData`: `registerScriptData({ user: { name: 'Dan' } })`. Never put secrets here. */
    registerScriptData(data: Record<string, unknown>, packageName: string | null = null, options: { panel?: string | null } = {}): void {
        this.scriptData.push({ packageName, panels: options.panel ? new Set([options.panel]) : null, data: { ...data } });
    }

    private list<T extends Asset>(type: abstract new (...args: any[]) => T, packages: string[] | null = null, panel: string | null = null): T[] {
        return this.assets.filter((entry) => entry.asset instanceof type && (packages === null || packages.includes(entry.asset.getPackage()!)) && (panel === null || entry.panels === null || entry.panels.has(panel))).map((entry) => entry.asset as T);
    }
    getStyles(packages: string[] | null = null, panel: string | null = null): Css[] { return this.list(Css, packages, panel); }
    getScripts(packages: string[] | null = null, withCore = true, panel: string | null = null): Js[] { return this.list(Js, packages, panel).filter((asset) => withCore || !asset.isCore()); }
    getAlpineComponents(packages: string[] | null = null, panel: string | null = null): AlpineComponent[] { return this.list(AlpineComponent, packages, panel); }
    private find<T extends Asset>(assets: T[], kind: string, id: string, packageName: string): T {
        const asset = assets.find((candidate) => candidate.getId() === id);
        if (!asset) throw new Error(`${kind} with ID [${id}] not found for package [${packageName}].`);
        return asset;
    }
    /** Versioned URL of a stylesheet, for `x-load-css`. */
    getStyleHref(id: string, packageName = 'app'): string { return this.find(this.getStyles([packageName]), 'Stylesheet', id, packageName).getHref(); }
    /** Versioned URL of a script, for `x-load-js` or a dynamic `import()`. */
    getScriptSrc(id: string, packageName = 'app'): string { return this.find(this.getScripts([packageName]), 'Script', id, packageName).getSrc(); }
    /** Versioned URL of an Alpine component, for `x-load-src`. */
    getAlpineComponentSrc(id: string, packageName = 'app'): string { return this.find(this.getAlpineComponents([packageName]), 'Alpine component', id, packageName).getSrc(); }
    getCssVariables(packages: string[] | null = null, panel: string | null = null): Record<string, unknown> {
        return Object.assign({}, ...this.cssVariables.filter((entry) => (packages === null || entry.packageName === null || packages.includes(entry.packageName)) && (panel === null || entry.panels === null || entry.panels.has(panel))).map((entry) => entry.variables));
    }
    getScriptData(packages: string[] | null = null, panel: string | null = null): Record<string, unknown> {
        return Object.assign({}, ...this.scriptData.filter((entry) => (packages === null || entry.packageName === null || packages.includes(entry.packageName)) && (panel === null || entry.panels === null || entry.panels.has(panel))).map((entry) => entry.data));
    }

    /** Stylesheets loaded on every page, then the registered CSS variables. Empty when nothing is registered. */
    renderStyles(packages: string[] | null = null, options: { panel?: string | null } = {}): string {
        const links = this.getStyles(packages, options.panel ?? null).filter((asset) => !asset.isLoadedOnRequest()).map((asset) => asset.getHtml());
        const variables = Object.entries(this.getCssVariables(packages, options.panel ?? null)).map(([name, value]) => cssVariable(name, value)).filter(Boolean);
        return [...links, variables.length ? `<style${cspNonceAttribute()}>:root{${variables.join('')}}</style>` : ''].filter(Boolean).join('\n');
    }
    /** Scripts loaded on every page (core scripts last with `withCore`). */
    renderScripts(packages: string[] | null = null, options: { withCore?: boolean; panel?: string | null; spa?: boolean } = {}): string {
        const scripts = this.getScripts(packages, options.withCore ?? false, options.panel ?? null).filter((asset) => !asset.isLoadedOnRequest());
        scripts.sort((a, b) => Number(a.isCore()) - Number(b.isCore()));
        return scripts.map((asset) => asset.getHtml(options.spa ?? true)).join('\n');
    }
    /** `window.navetteData = …` for the registered script data (`[]` when there is none). */
    renderScriptData(packages: string[] | null = null, options: { panel?: string | null } = {}): string {
        const data = this.getScriptData(packages, options.panel ?? null);
        return `window.navetteData = ${Object.keys(data).length ? scriptJson(data) : '[]'}`;
    }

    /** The registered local file served at this path (`/css/app/custom.css`), if any. */
    resolve(path: string): Asset | null {
        const relative = path.replace(/^\//, '');
        return this.assets.find((entry) => !entry.asset.isUrl() && entry.asset.getRelativePublicPath() === relative)?.asset ?? null;
    }
    /** Middleware serving the registered files: cached for a year at their current version, revalidated otherwise. */
    middleware(): (req: Request, res: Response, next: NextFunction) => void {
        return (req, res, next) => {
            if ((req.method !== 'GET' && req.method !== 'HEAD') || !/^\/(css|js)\//.test(req.path)) return next();
            const asset = this.resolve(req.path);
            if (!asset) return next();
            const version = asset.getVersion();
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', req.query.v === version ? 'public, max-age=31536000, immutable' : 'no-cache');
            res.type(asset instanceof Css ? 'text/css' : 'text/javascript');
            res.sendFile(asset.getPath()!, { dotfiles: 'allow', cacheControl: false, lastModified: true }, (error) => { if (error && !res.headersSent) next(); });
        };
    }
    /** Forgets every registration (tests). */
    flush(): void { this.assets = []; this.cssVariables = []; this.scriptData = []; }
}

/** The application's asset registry: `NavetteAsset.register([Css.make(…), Js.make(…), AlpineComponent.make(…)])`. */
export const NavetteAsset = new AssetManager();
