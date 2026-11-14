// @navette-js/panels/livewire — forms, tables, infolists, actions, widgets and notifications outside a panel:
// components rendered from your own EJS views, served by your own Express routes.
//
//     const livewire = new Livewire({ key: process.env.APP_KEY! });
//     livewire.components([CreatePost, ListProducts]);
//     app.use(livewire.router());
//     app.get('/posts/create', livewire.page(CreatePost, { title: 'Create a post' }));
//
// The components go through the same runtime as panel pages: signed snapshots, CSRF-protected updates, `static callable`,
// `static locked`, and the authorization hooks of actions, tables and pages (`static canAccess(user)`).
import type { Request, RequestHandler, Response, Router } from 'express';
import { ActionGroup, type Action } from '@navette-js/actions';
import type { DataAdapter } from '@navette-js/database';
import { e, type Palette } from '@navette-js/support';
import { intlLocale, localeDirection } from '@navette-js/support/i18n';
import { Table } from '@navette-js/tables';
import { UploadStore, WireError, WireRuntime, type Component } from '@navette-js/wire';
import { csrfToken, wireScripts, wireStyles } from '@navette-js/wire/express';
import { ListRecords, NavetteAsset, Page, Panel, panelRouter, type PanelContext, type User } from './index.ts';
import { publish, runInRequest } from './notifications.ts';
import { actionsFromMethods } from './view-helpers.ts';
export { actionFromMethod, actionsFromMethods, componentViewData } from './view-helpers.ts';

const flatten = (actions: (Action | ActionGroup)[]): Action[] => actions.flatMap((action) => (action instanceof ActionGroup ? action.getActions() as Action[] : [action]));

/** Renders a component: its view (`static view`), or else its `content` schema; a single root element either way. */
async function renderComponent(component: any, fallback: () => Promise<string>): Promise<string> {
    const view = (component.constructor as typeof Page).view;
    if (view !== null && view !== undefined) {
        const html = await component.renderContent();
        if (!/^\s*</.test(html)) throw new WireError(500, `${component.constructor.name}: the view must have a single root element.`);
        return html;
    }
    return `<div>${await fallback()}</div>`;
}

/**
 * A component hosting schemas (forms, infolists) and actions, rendered outside a panel.
 *
 * - Schemas are methods named after them, followed by `Schema`: `formSchema(schema)` (state path `data`), `infolistSchema()`…
 * - Actions are methods named after them, followed by `Action`: `deleteAction()` returns `Action.make('delete')`.
 * - The view (`static view`) is an async EJS template: `<%- await schema('form') %>`, `<%- await action('delete') %>`,
 *   `<%- await modals() %>`, `<%- await livewire(StatsWidget) %>`. Without a view, the `content` schema is rendered.
 * - Methods called from the browser (`wire:submit="create"`) are listed in `static callable`.
 */
export abstract class LivewireComponent extends Page {
    /** Framework base: only the methods of subclasses are read as action methods. */
    static isFrameworkBase = true;
    /** Actions the browser may mount: header actions, and the actions of the `<name>Action()` methods. */
    protected getMountableActions(context: Record<string, unknown>): Action[] | Promise<Action[]> {
        if (typeof context.schemaComponent === 'string') return this.getSchemaComponentActions(context.schemaComponent);
        return flatten([...this.getHeaderActions(), ...actionsFromMethods(this)]);
    }
    async render(): Promise<string> {
        return renderComponent(this, async () => `${await (await this.getSchema('content')).toHtml()}${await this.renderActionModals()}`);
    }
}

/**
 * A component with a table, rendered outside a panel. It defines
 * `table(table)` and `getDataAdapterForTable()` (the records), and may host schemas and actions like `LivewireComponent`.
 * Without a view it renders the table; a view renders it with `<%- await table() %>` (the action modals come with it).
 */
export abstract class TableComponent extends ListRecords {
    static isFrameworkBase = true;
    /** Configures the table: columns, filters, actions… */
    table(table: Table): Table { return table; }
    /** The records of the table. */
    getDataAdapterForTable(): DataAdapter { throw new Error(`${this.constructor.name}: define getDataAdapterForTable(), the data adapter of the table's records.`); }
    getDataAdapter(): DataAdapter { return this.getDataAdapterForTable(); }
    private _facade: any = null;
    /** What a list page expects from its resource: the adapter, and no labels, URLs, tabs or default actions. */
    get resource(): any {
        if (this._facade) return this._facade;
        const component = this;
        return (this._facade = {
            isSimple: true, slug: '', relations: [], headerWidgets: [], cluster: null, modelLabel: 'record',
            get adapter() { return component.getDataAdapterForTable(); },
            can: () => true, getUrl: () => '', getPluralModelLabel: () => 'records', getTitleCasePluralModelLabel: () => 'Records', table: (table: Table) => table,
        });
    }
    getTable(): Table { return this.table(new Table()); }
    getTabs(): Record<string, any> { return {}; }
    getHeaderWidgets(): any[] { return []; }
    getSubNavigation(): any[] { return []; }
    getBreadcrumbs(): { label: string; url: string | null }[] { return []; }
    getBulkActions(): Action[] { return this.getTable().getBulkActions() ?? []; }
    getHeaderActions(): Action[] { return []; }
    protected getMountableActions(context: Record<string, unknown>): Action[] | Promise<Action[]> {
        if (context.table === true || typeof context.schemaComponent === 'string') return super.getMountableActions(context);
        return flatten([...this.getHeaderActions(), ...actionsFromMethods(this)]);
    }
    async render(): Promise<string> { return renderComponent(this, () => this.renderTable()); }
}

export type LivewireOptions = {
    /** Secret key signing the component snapshots (at least 32 random characters). */
    key: string;
    /** Path of the component endpoints: `/<path>/livewire/update`… (`_navette` by default). */
    path?: string;
    /** Signed-in user of a request (your own authentication), or `null` for a guest; guests by default. */
    user?: (req: Request) => User | null | Promise<User | null>;
    /** Directory of temporary file uploads (FileUpload fields); without it, uploads are refused. Uploads need a signed-in user. */
    uploads?: string | UploadStore;
    /** Colors of the components: `{ primary: Color.Indigo }`. */
    colors?: Record<string, Palette | string>;
    /** Locale of the runtime (`en` by default). */
    locale?: string;
};
/** Name of a component in Livewire's style: `CreatePost` → `create-post`. */
export const componentNameOf = (cls: { name: string }): string => cls.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();

/** The panel serving components outside any panel: no login, no pages, the user of `options.user`. */
export class ComponentsPanel extends Panel {
    resolveUser: ((req: Request) => User | null | Promise<User | null>) | null = null;
    /** Components registered by name (the testing helpers register them in their own runtime). */
    readonly registeredComponents = new Map<string, ComponentClass>();
    async user(req: Request): Promise<User | null> { return this.resolveUser ? (await this.resolveUser(req)) ?? null : null; }
    async userCanAccess(): Promise<boolean> { return true; }
}

type ComponentClass = new () => Component;
export type PageOptions = {
    /** Document title (the component's `getTitle()` by default). */
    title?: string;
    /** Mount params from the request: route parameters by default (`/posts/:post` → `{ post }`). */
    params?: (req: Request) => Record<string, unknown>;
    /** Wraps the component in your layout instead of the default document: receives the HTML of each part. */
    layout?: (parts: { title: string; component: string; styles: string; scripts: string; notifications: string }, req: Request, res: Response) => string;
};

/**
 * Serves components outside a panel. Register them (`components()`), mount the router (`router()`), then serve a component
 * as a full page (`page()`) or embed it in your own page (`mount()`, with `styles()`, `scripts()` and `notifications()`).
 */
export class Livewire {
    readonly panel: ComponentsPanel;
    readonly runtime: WireRuntime;
    private _router: Router | null = null;

    constructor(options: LivewireOptions) {
        if (!options?.key || options.key.length < 32) throw new Error('Livewire: pass a secret key of at least 32 characters.');
        this.panel = new ComponentsPanel().id('livewire').path(options.path ?? '_navette').key(options.key).authGuard(null).guestAccess();
        this.panel.resolveUser = options.user ?? null;
        if (options.colors) this.panel.setColors(options.colors as any);
        const uploads = typeof options.uploads === 'string' ? new UploadStore(options.uploads, options.key) : options.uploads;
        this.runtime = new WireRuntime({ key: options.key, locale: options.locale, ...(uploads ? { uploads } : {}) });
    }
    /** Registers a component under a name (`'create-post'`), for `mount()`, `page()` and child components (`livewire()`). */
    component(name: string, cls: ComponentClass): this {
        if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name) || name.startsWith('navette.')) throw new Error(`Invalid component name: ${name}`);
        this.runtime.register(name, cls as any);
        this.panel.registeredComponents.set(name, cls);
        return this;
    }
    /** Registers components under their Livewire-style names (`CreatePost` → `create-post`). */
    components(classes: ComponentClass[]): this { for (const cls of classes) this.component(componentNameOf(cls), cls); return this; }
    /** Routes of the components: update and upload endpoints, livewire.js, the stylesheets, scripts and fonts. Mount it once. */
    router(): Router { return (this._router ??= panelRouter(this.panel, this.runtime)); }

    private nameOf(component: string | ComponentClass): string {
        const name = typeof component === 'string' ? component : this.runtime.nameOf(component as any);
        if (!name || !this.runtime.has(name)) throw new Error(`Livewire: the component ${typeof component === 'string' ? component : component.name} is not registered (call components()).`);
        return name;
    }
    private async context(req: Request, res: Response): Promise<PanelContext> {
        return { req, res, panel: this.panel, user: await this.panel.user(req), mailbox: csrfToken(req, res), tenant: null };
    }
    /** Runs a render with the components' colors, sending the notifications it queues to the browser. */
    private async inRequest<T>(ctx: PanelContext, fn: () => Promise<T>): Promise<T> {
        await this.panel.boot(ctx.req);
        const { result, pending } = await runInRequest(ctx.mailbox, () => this.panel.withTheme(ctx.req, fn));
        if (pending.length) publish(ctx.mailbox, pending);
        return result;
    }
    /** HTML of a component, to embed in your page. Throws a `WireError` (403…) when refused. */
    async mount(component: string | ComponentClass, params: Record<string, unknown> = {}, req: Request, res: Response): Promise<string> {
        if (!this._router) this.router();
        const name = this.nameOf(component);
        const ctx = await this.context(req, res);
        return this.inRequest(ctx, async () => (await this.runtime.mountWithInstance(name, params, { path: req.path, method: req.method, ctx })).html);
    }
    /** The notifications container: once per page, in your layout. */
    async notifications(req: Request, res: Response): Promise<string> {
        if (!this._router) this.router();
        const ctx = await this.context(req, res);
        return this.inRequest(ctx, () => this.runtime.mount('navette.notifications', {}, { path: req.path, method: req.method, ctx }));
    }
    /** Tags for your layout's `<head>`: CSRF meta, fonts, colors, the panel stylesheet and Livewire's styles. */
    styles(req: Request, res: Response): string {
        const panel = this.panel;
        const theme = panel.resolveTheme(req);
        return [
            `<meta name="csrf-token" content="${e(csrfToken(req, res))}" />`,
            `<style>[x-cloak=''],[x-cloak='x-cloak'],[x-cloak='1']{display:none !important;}[x-cloak='inline-flex']{display:inline-flex !important;}</style>`,
            `<link href="${e(panel.assetUrl('fonts/navette/navette/inter/index.css'))}" rel="stylesheet" />`,
            panel.withTheme(req, () => panel.colors.renderCssVariables()),
            NavetteAsset.renderStyles(null, { panel: panel.getId() }),
            `<link rel="stylesheet" href="${e(panel.getTheme() ?? panel.assetUrl('css/navette/navette/app.css'))}" />`,
            `<style>:root{--font-family:'${panel.getFont().family.replace(/['\\<>]/g, '')}';--font-family-mono:'ui-monospace';--font-family-serif:'ui-serif';}html.nv{--livewire-progress-bar-color:var(--primary-500);}</style>`,
            theme?.css ? `<style data-navette-theme>${theme.css}</style>` : '',
            `<script>if (localStorage.getItem('navette:theme:mode') === 'dark' || ((localStorage.getItem('navette:theme:mode') ?? 'system') === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark')</script>`,
            wireStyles(),
        ].filter(Boolean).join('\n');
    }
    /** Tags for the end of your layout's `<body>`: the panel scripts and livewire.js (with Alpine.js). */
    scripts(req: Request, res: Response): string {
        const panel = this.panel;
        return [
            `<script>${NavetteAsset.renderScriptData(null, { panel: panel.getId() }) || 'window.navetteData = []'}</script>`,
            NavetteAsset.renderScripts(null, { panel: panel.getId(), spa: false }),
            ...['js/navette/actions/actions.js', 'js/navette/notifications/notifications.js', 'js/navette/schemas/schemas.js', 'js/navette/support/support.js', 'js/navette/tables/tables.js', 'js/navette/navette/app.js'].map((src) => `<script src="${e(panel.assetUrl(src))}"></script>`),
            wireScripts(req, res, panel.getLivewirePrefix()),
        ].filter(Boolean).join('\n');
    }
    /**
     * A route handler serving the component as a full page: a simple document with the component, the notifications and the assets, or your `layout`. 403 and 404 answer as such.
     */
    page(component: string | ComponentClass, options: PageOptions = {}): RequestHandler {
        return async (req, res, next) => {
            try {
                if (!this._router) this.router();
                const ctx = await this.context(req, res);
                const name = this.nameOf(component);
                const params = options.params ? options.params(req) : { ...req.params };
                const mounted = await this.inRequest(ctx, () => this.runtime.mountWithInstance(name, params, { path: req.path, method: req.method, ctx }));
                const redirect = (mounted.component as any)._effects?.redirect;
                if (typeof redirect === 'string') return void res.redirect(redirect);
                const title = options.title ?? (mounted.component as any).getTitle?.() ?? name;
                const parts = { title, component: mounted.html, styles: this.styles(req, res), scripts: this.scripts(req, res), notifications: await this.notifications(req, res) };
                res.setHeader('Cache-Control', 'no-store');
                res.send(options.layout ? options.layout(parts, req, res) : `<!DOCTYPE html>\n<html lang="${e(intlLocale())}" dir="${localeDirection()}" class="nv">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>${e(title)}</title>\n${parts.styles}\n</head>\n<body class="nv-body nv-livewire-page">\n<main class="nv-livewire-page-main" style="max-width: 80rem; margin: 0 auto; padding: 2rem 1rem;">${parts.component}</main>\n${parts.notifications}\n${parts.scripts}\n</body>\n</html>`);
            } catch (error) {
                if (error instanceof WireError && [401, 403, 404].includes(error.status)) return void res.status(error.status).type('text/plain').send(error.status === 404 ? 'Not Found' : error.status === 401 ? 'Unauthorized' : 'Forbidden');
                next(error);
            }
        };
    }
}
