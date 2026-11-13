// @navette-js/panels: Panel, layouts, pages, resources, navigation, authentication and session.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { checkVerificationUrl, consoleMailer, readToken, signToken, signVerificationUrl, type Mailer, type MailMessage } from './auth.ts';
export { consoleMailer, fileMailer, hashPassword, knexAuthProvider, knexTenantProvider, mailText, verifyPassword, type Mailer, type MailMessage, type TableQuery } from './auth.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express, { type Request, type Response, type Router } from 'express';
import { Action, ActionHalt, useColorManager, ActionGroup } from '@navette-js/actions';
import { Checkbox, Field, Select, Step, TextInput, Wizard, richDocumentToHtml, richHtmlToDocument, fillSchema, fillSchemaFromRecord, getSchemaState, loadSchemaRelationships, saveSchemaRelationships, validateSchema, useColorManager as useFormsColorManager } from '@navette-js/forms';
import { Actions, Component as SchemaComponent, EmbeddedSchema, Form, Group, Html, RenderHook, Schema, StatefulGroup, type SchemaHost } from '@navette-js/schemas';
import { WireError } from '@navette-js/wire';
import { useColorManager as useInfolistsColorManager, useHtmlSanitizer } from '@navette-js/infolists';
import { Notification, Notifications, publish, runInRequest } from './notifications.ts';
export { Notification, Notifications } from './notifications.ts';
export { MemorySessionStore, type SessionStore } from './session-store.ts';
export { csvCell, csvLine, DownloadStore, ExportAction, ExportBulkAction, ExportColumn, Exporter, ImportAction, ImportColumn, Importer, parseCsv, type ExportActionInstance, type ImportActionInstance } from './import-export.ts';
import { DownloadStore } from './import-export.ts';
import { MemorySessionStore, type SessionStore } from './session-store.ts';
import { addDays, addMonths, CALENDAR_LABELS, CALENDAR_VIEWS, isDate, renderCalendar, visibleRange, type CalendarEvent, type CalendarLabels, type CalendarView } from './calendar.ts';
export { addDays, addMonths, CALENDAR_LABELS, dayOf, daysBetween, eventsOn, renderCalendar, renderCalendarEvent, timeOf, visibleRange, type CalendarEvent, type CalendarLabels, type CalendarModel, type CalendarView } from './calendar.ts';
import { DatabaseNotifications, GlobalSearch, keyBindingSuffix, type DatabaseNotificationStore, type GlobalSearchCategory, type GlobalSearchResult } from './topbar.ts';
export { DatabaseNotifications, GlobalSearch, knexNotificationStore, timeAgo, type DatabaseNotificationAction, type DatabaseNotificationRecord, type DatabaseNotificationStore, type GlobalSearchCategory, type GlobalSearchResult } from './topbar.ts';
import { Attributes, ColorManager, HtmlString, RenderHookRegistry, cls, convertToRgb, e, icon, js, loadingIndicator, renderHook, runWithRenderHooks, views, type Palette, type RenderHookCallback } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { emptyState } from '@navette-js/support/ui';
import type { DataAdapter } from '@navette-js/database';
import { REORDER_LIMIT, Table, TrashedFilter, filterSelectableKeys, getTableRecords, initializeTableGrouping, isTableFilterRemovable, updateTableColumnState as updateEditableColumnState, getTableQuery, getVisibleColumns, renderTable, sanitizeColumnState, sortTable, useColorManager as useTableColorManager, type ColumnState, type FilterState, type TableHost } from '@navette-js/tables';
import { Component, type WireRuntime } from '@navette-js/wire';
import { csrfToken, verifyCsrf, wireRouter, wireScripts, wireStyles } from '@navette-js/wire/express';

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url));
views.namespace('filament-panels', dir('../views'));
views.namespace('filament', fileURLToPath(new URL('../views', import.meta.resolve('@navette-js/support'))));
views.share({ t, tc });
export const ASSET_VERSION = '5.11.2.0';

/** The signed-in user. Your auth provider may add any field (role, team…): policies receive it as-is. */
export type User = { id: string | number; name: string; email: string; [key: string]: unknown };

/**
 * Resource policy: one function per ability
 * (`viewAny`, `create`, `update`, `delete`, `deleteAny`, `restore`, `forceDelete`, `reorder`, or your own names).
 * A missing ability is allowed.
 */
export type Policy<R = any> = Partial<Record<string, (user: User, record: R | null) => boolean | Promise<boolean>>>;
/** A reusable bundle of configuration. `register` receives the panel being built; `boot` is called when the router is mounted. */
export type Plugin = { id: string; register(panel: Panel): void; boot?(panel: Panel): void };
/** Question asked to the panel's authorization hook. `resource`, `page` or `widget` tells what it is about. */
export type AuthorizationCheck = { user: User; ability: string; resource: unknown | null; record: unknown | null; page: typeof Page | null; widget: typeof Widget | null };
/** Return `true` or `false` to decide, or `undefined` to let the resource policy (or `canAccess` / `canView`) answer. */
export type Authorizer = (check: AuthorizationCheck) => boolean | undefined | Promise<boolean | undefined>;
type MaybePromise<T> = T | Promise<T>;
/**
 * User provider. `attempt` and `find` are enough for login; the optional methods enable
 * registration (`create`, `findByEmail`), password reset (`findByEmail`, `update`, `getPasswordFingerprint`),
 * email verification (`hasVerifiedEmail`, `markEmailAsVerified`) and the profile page (`update`).
 * `knexAuthProvider(knex)` implements all of them for a `users` table.
 */
export interface AuthProvider {
    attempt(email: string, password: string): MaybePromise<User | null>;
    find(id: string | number): MaybePromise<User | null>;
    findByEmail?(email: string): MaybePromise<User | null>;
    /** Creates the user. The password is plain text; the provider must hash it. */
    create?(data: { name: string; email: string; password: string }): MaybePromise<User>;
    /** Updates name, email or password (plain text, to hash). Changing the email must reset its verification. */
    update?(user: User, data: { name?: string; email?: string; password?: string }): MaybePromise<User>;
    hasVerifiedEmail?(user: User): MaybePromise<boolean>;
    markEmailAsVerified?(user: User): MaybePromise<void>;
    /** A value that changes with the stored password, so a used reset link becomes invalid. */
    getPasswordFingerprint?(user: User): MaybePromise<string>;
    /** Can this user use this panel? Checked on every request and at login (`false`: 403, or "credentials do not match" at login). */
    canAccessPanel?(user: User, panel: Panel): MaybePromise<boolean>;
}
/**
 * Panel tenants (teams, organizations…). Every panel page then lives under
 * `/<panel>/<tenant key>/…`, and only a member of the tenant can open it.
 */
export interface TenantProvider<T = any> {
    /** Tenants the user is a member of. */
    getTenants(user: User): MaybePromise<T[]>;
    /** Tenant from its URL key (comes from the browser: validate it). */
    find(key: string): MaybePromise<T | null>;
    canAccess(user: User, tenant: T): MaybePromise<boolean>;
    getKey(tenant: T): string;
    getName(tenant: T): string;
    /** Text above the tenant name in the menu ("Current team"), or `null`. */
    getCurrentTenantLabel?(tenant: T): string | null;
    getAvatarUrl?(tenant: T): string | null;
    /** Creates a tenant (tenant registration page); the user becomes a member. */
    create?(data: Record<string, unknown>, user: User): MaybePromise<T>;
    update?(tenant: T, data: Record<string, unknown>): MaybePromise<T>;
}
export type PanelContext = { req: Request; res: Response; panel: Panel; user: User | null; mailbox: string; tenant?: unknown; /** Signed in through the shared session, but not allowed into this panel. */ denied?: boolean };

/**
 * Predefined panel theme: a set of colors (palettes or plain colors), optionally a font and some CSS.
 * When a panel declares several, users pick theirs from the user menu; the choice is kept in a cookie.
 */
export type Theme = {
    id: string; label: string;
    colors?: Record<string, Palette | string>;
    font?: { family: string; url?: string };
    /** CSS added to the page for this theme (written by the panel developer, inserted as-is). */
    css?: string;
};

export class NavigationItem {
    label: string;
    _url = '#';
    _icon: string | null = null;
    _group: string | null = null;
    _sort = 0;
    _isActive: ((path: string) => boolean) | null = null;
    _badge: string | number | null = null;
    _badgeColor = 'primary';
    constructor(label: string) { this.label = label; }
    static make(label: string): NavigationItem { return new NavigationItem(label); }
    url(url: string): this { this._url = url; return this; }
    icon(icon: string | null): this { this._icon = icon; return this; }
    group(group: string | null): this { this._group = group; return this; }
    sort(sort: number): this { this._sort = sort; return this; }
    badge(badge: string | number | null, color = 'primary'): this { this._badge = badge; this._badgeColor = color; return this; }
    /** By default an item is active on its exact URL; this overrides the rule. */
    isActiveWhen(fn: (path: string) => boolean): this { this._isActive = fn; return this; }
    isActive(path: string): boolean { return this._isActive ? this._isActive(path) : path === this._url; }
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export class Panel {
    private _id = 'admin';
    private _path = '';
    private _brandName = 'Navette';
    private _brandLogo: string | null = null;
    private _darkModeBrandLogo: string | null = null;
    private _brandLogoHeight = '1.5rem';
    private _favicon: string | null = null;
    private _theme: string | null = null;
    private _motion = true;
    private _themes: Theme[] = [];
    private _font = { family: 'Inter Variable', url: null as string | null, preconnect: null as string | null };
    private _login: typeof Login | null = null;
    private _auth: AuthProvider | null = null;
    private _key = 'cle-de-developpement-a-remplacer';
    private _sessionStore: SessionStore | null = null;
    /** Where per-browser data is kept (persisted table filters, search and sort): in memory by default. */
    sessionStore(store: SessionStore): this { this._sessionStore = store; return this; }
    getSessionStore(): SessionStore { return (this._sessionStore ??= new MemorySessionStore()); }
    private _downloads: DownloadStore | null = null;
    /** Where files offered for download (exports, failed import rows) are kept: in memory by default. */
    downloads(store: DownloadStore): this { this._downloads = store; return this; }
    getDownloads(): DownloadStore { return (this._downloads ??= new DownloadStore()); }
    getDownloadUrl(token: string): string { return this.getBaseUrl(`downloads/${encodeURIComponent(token)}`); }
    private _pages: (typeof Page)[] = [];
    private _resources: (typeof Resource)[] = [];
    private _navigationItems: NavigationItem[] = [];
    private _navigationGroups: string[] = [];
    private _maxContentWidth = '7xl';
    readonly colors = new ColorManager();

    static make(): Panel { return new Panel(); }
    id(id: string): this { this._id = id; return this; }
    path(path: string): this { this._path = path.replace(/^\/|\/$/g, ''); return this; }
    brandName(name: string): this { this._brandName = name; return this; }
    brandLogo(url: string): this { this._brandLogo = url; return this; }
    darkModeBrandLogo(url: string): this { this._darkModeBrandLogo = url; return this; }
    brandLogoHeight(height: string): this { this._brandLogoHeight = height; return this; }
    /** Browser tab icon. */
    favicon(url: string | null): this { this._favicon = url; return this; }
    getFavicon(): string | null { return this._favicon; }
    /**
     * Theme stylesheet compiled by the application (Tailwind); it replaces the default stylesheet.
     * The theme imports `@navette-js/panels/theme.css` and declares its own sources.
     */
    theme(url: string | null): this { this._theme = url; return this; }
    getTheme(): string | null { return this._theme; }
    /**
     * Navette's motion and loading indicators (springs, activity dot, spinner for deferred areas).
     * `motion(false)` renders the plain interface without them.
     */
    motion(enabled = true): this { this._motion = enabled; return this; }
    hasMotion(): boolean { return this._motion; }
    /** Themes offered to the user; the first one is the default. */
    themes(themes: Theme[]): this {
        for (const theme of themes) if (!/^[a-z0-9-]{1,40}$/.test(theme.id)) throw new Error(`Invalid theme id: ${theme.id}`);
        this._themes = themes;
        return this;
    }
    getThemes(): Theme[] { return this._themes; }
    /** Theme for the request: the cookie's theme if declared, otherwise the first one. `null` if the panel has no themes. */
    resolveTheme(req: Request): Theme | null {
        if (!this._themes.length) return null;
        const id = (req.headers.cookie ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`navette_${this._id}_theme=`))?.split('=')[1];
        return this._themes.find((theme) => theme.id === id) ?? this._themes[0];
    }
    rememberTheme(res: Response, theme: Theme): void { res.cookie(`navette_${this._id}_theme`, theme.id, { sameSite: 'lax', secure: res.req?.secure === true, maxAge: 1000 * 60 * 60 * 24 * 365 }); }
    /** Runs a render with the colors of the request's theme. */
    withTheme<T>(req: Request, fn: () => T): T {
        const theme = this.resolveTheme(req);
        // Components from other packages read a color manager shared by all panels:
        // this panel's (and its theme's) colors only apply for the duration of the request.
        const withPanelColors = () => sharedColors.runWith(`${this._id}:${theme?.id ?? ''}`, this.colors.getColors(), fn);
        // A panel's render hooks only apply to its own requests.
        return runWithRenderHooks(this._renderHooks, () => (theme?.colors ? this.colors.runWith(theme.id, theme.colors, withPanelColors) : withPanelColors()));
    }
    setColors(colors: Record<string, Palette | string>): this { this.colors.register(colors); return this; }
    /** Panel font. Without a URL, it is loaded from Bunny Fonts. */
    font(family: string, url?: string): this {
        this._font = { family, url: url ?? `https://fonts.bunny.net/css?family=${slug(family)}:400,500,600,700&display=swap`, preconnect: url ? null : 'https://fonts.bunny.net' };
        return this;
    }
    login(page: typeof Login = Login): this { this._login = page; return this; }
    auth(provider: AuthProvider): this { this._auth = provider; return this; }
    key(key: string): this { this._key = key; return this; }
    private _authGuard: string | null = 'web';
    private _canAccess: ((user: User, panel: Panel) => MaybePromise<boolean>) | null = null;
    /**
     * Session shared with the other panels that use the same guard (`'web'` by default): signing into one signs into all of
     * them, and `canAccess()` decides who may enter each one. `null` gives this panel a session of its own.
     * Panels sharing a guard must use the same key and the same auth provider.
     */
    authGuard(guard: string | null): this {
        if (guard !== null && !/^[a-z0-9_-]{1,40}$/.test(guard)) throw new Error(`Invalid auth guard name: ${guard}`);
        this._authGuard = guard;
        return this;
    }
    getAuthGuard(): string | null { return this._authGuard; }
    /** Who may use this panel, e.g. `panel.canAccess((user) => user.role === 'admin')`. Checked on every request and at login. */
    canAccess(rule: ((user: User, panel: Panel) => MaybePromise<boolean>) | null): this { this._canAccess = rule; return this; }
    /** True if this user may use this panel: the panel's rule and the provider's `canAccessPanel()`, when set, must both allow it. */
    async userCanAccess(user: User): Promise<boolean> {
        if (this._canAccess && !(await this._canAccess(user, this))) return false;
        const provider = this.getAuth();
        if (provider.canAccessPanel && !(await provider.canAccessPanel(user, this))) return false;
        return true;
    }
    /** Name of the session cookie: per guard (shared), or per panel. */
    getSessionCookieName(): string { return this._authGuard !== null ? `navette_${this._authGuard}_session` : `navette_${this._id}_session`; }
    pages(pages: (typeof Page)[]): this { this._pages.push(...pages); return this; }
    /** Registers resources: their pages and navigation items. */
    resources(resources: (typeof Resource)[]): this {
        for (const resource of resources) { resource.panel = this; this._resources.push(resource); this._pages.push(...Object.values(resource.getPages())); }
        return this;
    }
    navigationItems(items: NavigationItem[]): this { this._navigationItems.push(...items); return this; }
    /** Order of navigation groups. */
    navigationGroups(groups: string[]): this { this._navigationGroups = groups; return this; }
    private _plugins: Plugin[] = [];
    /** Applies a plugin: an object that configures the panel (resources, pages, render hooks, themes…). */
    plugin(plugin: Plugin): this {
        if (this._plugins.some((p) => p.id === plugin.id)) throw new Error(`Plugin already registered: ${plugin.id}`);
        this._plugins.push(plugin);
        plugin.register(this);
        return this;
    }
    plugins(plugins: Plugin[]): this { for (const plugin of plugins) this.plugin(plugin); return this; }
    getPlugins(): Plugin[] { return this._plugins; }
    private _renderHooks = new RenderHookRegistry();
    /**
     * Inserts HTML at a named location of this panel's UI (names: `PanelsRenderHook`, `TablesRenderHook`, `ActionsRenderHook`, `WidgetsRenderHook`).
     * `scopes` limits the hook to some pages or resources (their class). The HTML is inserted as-is: escape any data with `e()`.
     */
    renderHook(name: string, render: RenderHookCallback, scopes: unknown | unknown[] | null = null): this { this._renderHooks.register(name, render, scopes); return this; }
    getRenderHooks(): RenderHookRegistry { return this._renderHooks; }
    private _authorizer: Authorizer | null = null;
    /** Plugs in your own permission system: consulted before any policy, for every ability, page and widget. */
    authorizeUsing(authorizer: Authorizer | null): this { this._authorizer = authorizer; return this; }
    /** Authorization decision: the panel hook first, then the given rule. Always `false` without a user. */
    async authorize(user: User | null, ability: string, subject: { resource?: unknown; record?: unknown; page?: typeof Page; widget?: typeof Widget; rule?: (() => boolean | Promise<boolean>) | null } = {}): Promise<boolean> {
        if (!user) return false;
        const decided = await this._authorizer?.({ user, ability, resource: subject.resource ?? null, record: subject.record ?? null, page: subject.page ?? null, widget: subject.widget ?? null });
        if (typeof decided === 'boolean') return decided;
        return subject.rule ? Boolean(await subject.rule()) : true;
    }
    /** Whether the user can open a page. List: `viewAny`; create: `create`; edit: checked against the record; custom page: `canAccess`. */
    async canAccessPage(PageClass: typeof Page, user: User | null): Promise<boolean> {
        const resource = (PageClass as any).resource as typeof Resource | undefined;
        if (resource && PageClass.prototype instanceof EditRecord) return user !== null;
        if (resource && PageClass.prototype instanceof CreateRecord) return resource.can('create', user);
        if (resource) return resource.can('viewAny', user);
        return this.authorize(user, 'access', { page: PageClass, rule: () => PageClass.canAccess(user!) });
    }
    private _widgets: (typeof Widget)[] = [];
    /** Panel widgets (dashboard, custom pages): registered as components, displayed through a page's `getHeaderWidgets()`. */
    widgets(widgets: (typeof Widget)[]): this { this._widgets.push(...widgets); return this; }
    getWidgets(): (typeof Widget)[] { return this._widgets; }
    maxContentWidth(width: string): this { this._maxContentWidth = width; return this; }

    getId(): string { return this._id; }
    getBrandName(): string { return this._brandName; }
    getAuth(): AuthProvider { if (!this._auth) throw new Error('No auth provider: call panel.auth(...).'); return this._auth; }
    getLoginPage(): typeof Login | null { return this._login; }
    getPages(): (typeof Page)[] { return this._pages; }
    getResources(): (typeof Resource)[] { return this._resources; }

    // -------------------------------------------------------------- global search
    private _globalSearch = true;
    private _globalSearchKeyBindings: string[] = [];
    private _globalSearchDebounce = '500ms';
    private _globalSearchSuffix: string | null | ((userAgent: string) => string | null) = null;
    /** `false` removes the global search field. It only appears when at least one resource is searchable. */
    globalSearch(condition = true): this { this._globalSearch = condition; return this; }
    /** Keyboard shortcuts that focus the field: `['command+k', 'ctrl+k']`. */
    globalSearchKeyBindings(keyBindings: string[]): this { this._globalSearchKeyBindings = keyBindings.filter((binding) => /^[a-z0-9+]+$/.test(binding)); return this; }
    getGlobalSearchKeyBindings(): string[] { return this._globalSearchKeyBindings; }
    /** Delay between typing and searching (`500ms` by default). */
    globalSearchDebounce(debounce: string): this { if (/^[0-9]+m?s$/.test(debounce)) this._globalSearchDebounce = debounce; return this; }
    getGlobalSearchDebounce(): string { return this._globalSearchDebounce; }
    globalSearchFieldSuffix(suffix: string | null): this { this._globalSearchSuffix = suffix; return this; }
    /** Shows the first shortcut in the field, written for the browser's platform (`command+k` shows as "META+K" outside macOS). */
    globalSearchFieldKeyBindingSuffix(): this { this._globalSearchSuffix = (userAgent) => keyBindingSuffix(this._globalSearchKeyBindings, userAgent); return this; }
    getGlobalSearchFieldSuffix(userAgent = ''): string | null { return typeof this._globalSearchSuffix === 'function' ? this._globalSearchSuffix(userAgent) : this._globalSearchSuffix; }
    hasGlobalSearch(): boolean { return this._globalSearch && this._resources.some((resource) => resource.canGloballySearch()); }
    /** Results per resource, in registration order. Only resources the user can list are queried. */
    async getGlobalSearchResults(search: string, user: User | null): Promise<GlobalSearchCategory[]> {
        const categories: GlobalSearchCategory[] = [];
        if (!this._globalSearch) return categories;
        const ranked = this._resources.map((resource, index) => ({ resource, index })).sort((a, b) => (a.resource.globalSearchSort ?? Infinity) - (b.resource.globalSearchSort ?? Infinity) || a.index - b.index);
        for (const { resource } of ranked) {
            if (!resource.canGloballySearch() || !(await resource.can('viewAny', user))) continue;
            const results = await resource.getGlobalSearchResults(search, user);
            if (results.length) categories.push({ label: resource.getPluralModelLabel(), results });
        }
        return categories;
    }

    // -------------------------------------------------------------- database notifications
    private _databaseNotifications: DatabaseNotificationStore | null = null;
    private _databaseNotificationsPolling: string | null = '30s';
    /** Enables the database notifications bell, read from and written to this store (`knexNotificationStore(knex)`). */
    databaseNotifications(store: DatabaseNotificationStore | null): this { this._databaseNotifications = store; return this; }
    getDatabaseNotifications(): DatabaseNotificationStore | null { return this._databaseNotifications; }
    /** Polling interval (`30s` by default); `null` disables polling. */
    databaseNotificationsPolling(interval: string | null): this { this._databaseNotificationsPolling = interval; return this; }
    getDatabaseNotificationsPollingInterval(): string | null { return this._databaseNotificationsPolling; }

    // -------------------------------------------------------------- layout: topbar, navigation, sidebar
    private _topbar = true;
    private _topNavigation = false;
    private _navigation = true;
    private _sidebarCollapsibleOnDesktop = false;
    private _sidebarFullyCollapsibleOnDesktop = false;
    private _positions: { userMenu: 'topbar' | 'sidebar' | null; globalSearch: 'topbar' | 'sidebar' | null; databaseNotifications: 'topbar' | 'sidebar' | null } = { userMenu: null, globalSearch: null, databaseNotifications: null };
    /** Topbar, shown by default. `topbar(false)` moves the logo, search, bell and user menu into the sidebar. */
    topbar(condition = true): this { this._topbar = condition; return this; }
    hasTopbar(): boolean { return this._topbar; }
    /** Navigation in the topbar (one dropdown per group) instead of the sidebar. */
    topNavigation(condition = true): this { this._topNavigation = condition; return this; }
    hasTopNavigation(): boolean { return this._topNavigation; }
    /** `navigation(false)` removes all navigation (no sidebar, no menus). */
    navigation(condition = true): this { this._navigation = condition; return this; }
    hasNavigation(): boolean { return this._navigation; }
    /** On desktop, the sidebar can collapse to a column of icons. */
    sidebarCollapsibleOnDesktop(condition = true): this { this._sidebarCollapsibleOnDesktop = condition; return this; }
    isSidebarCollapsibleOnDesktop(): boolean { return this._sidebarCollapsibleOnDesktop; }
    /** On desktop, the sidebar can be fully hidden. */
    sidebarFullyCollapsibleOnDesktop(condition = true): this { this._sidebarFullyCollapsibleOnDesktop = condition; return this; }
    isSidebarFullyCollapsibleOnDesktop(): boolean { return this._sidebarFullyCollapsibleOnDesktop; }
    /** Where the user menu goes; defaults to the topbar when there is one. */
    userMenuPosition(position: 'topbar' | 'sidebar' | null): this { this._positions.userMenu = position; return this; }
    getUserMenuPosition(): 'topbar' | 'sidebar' { return this._positions.userMenu ?? (this._topbar ? 'topbar' : 'sidebar'); }
    globalSearchPosition(position: 'topbar' | 'sidebar' | null): this { this._positions.globalSearch = position; return this; }
    getGlobalSearchPosition(): 'topbar' | 'sidebar' { return this._positions.globalSearch ?? (this._topbar ? 'topbar' : 'sidebar'); }
    databaseNotificationsPosition(position: 'topbar' | 'sidebar' | null): this { this._positions.databaseNotifications = position; return this; }
    getDatabaseNotificationsPosition(): 'topbar' | 'sidebar' { return this._positions.databaseNotifications ?? (this._topbar ? 'topbar' : 'sidebar'); }
    private _userMenuItems: Record<string, Action> = {};
    /** Items added to the user menu (URL or modal actions). A negative `sort()` places them above the theme switcher. Keys `profile` and `logout` replace the defaults. */
    userMenuItems(items: Record<string, Action> | Action[]): this {
        for (const [key, item] of Array.isArray(items) ? items.map((item) => [item.getName(), item] as const) : Object.entries(items)) this._userMenuItems[key] = item;
        return this;
    }
    getUserMenuItems(): Record<string, Action> { return this._userMenuItems; }

    // -------------------------------------------------------------- registration, password reset, email verification, profile
    private _registration: typeof Register | null = null;
    private _passwordReset: { request: typeof RequestPasswordReset; reset: typeof ResetPassword } | null = null;
    private _emailVerification: { prompt: typeof EmailVerificationPrompt; isRequired: boolean } | null = null;
    private _profile: { page: typeof EditProfile; isSimple: boolean } | null = null;
    private _mailer: Mailer = consoleMailer;
    /** Registration page (`/register`). The auth provider must implement `create` and `findByEmail`. */
    registration(page: typeof Register | null = Register): this { this._registration = page; return this; }
    hasRegistration(): boolean { return this._registration !== null; }
    getRegistrationPage(): typeof Register | null { return this._registration; }
    /** Password reset: request page (`/password-reset/request`), then reset through a signed link sent by email. */
    passwordReset(request: typeof RequestPasswordReset = RequestPasswordReset, reset: typeof ResetPassword = ResetPassword): this { this._passwordReset = { request, reset }; return this; }
    hasPasswordReset(): boolean { return this._passwordReset !== null; }
    getPasswordResetPages() { return this._passwordReset; }
    /** Email verification: a signed link is sent on registration. Until it is followed, only the verification prompt is accessible (`isRequired`). */
    emailVerification(prompt: typeof EmailVerificationPrompt = EmailVerificationPrompt, isRequired = true): this { this._emailVerification = { prompt, isRequired }; return this; }
    hasEmailVerification(): boolean { return this._emailVerification !== null; }
    isEmailVerificationRequired(): boolean { return this._emailVerification?.isRequired === true; }
    getEmailVerificationPrompt(): typeof EmailVerificationPrompt | null { return this._emailVerification?.prompt ?? null; }
    /** Profile page (`/profile`): name, email, password. `isSimple`: simple layout (default) or full panel layout. */
    profile(page: typeof EditProfile = EditProfile, isSimple = true): this { this._profile = { page, isSimple }; return this; }
    hasProfile(): boolean { return this._profile !== null; }
    getProfile() { return this._profile; }
    /** Mailer for password reset and verification emails. Defaults to the console. */
    mailer(mailer: Mailer): this { this._mailer = mailer; return this; }
    async sendMail(message: MailMessage): Promise<void> { await this._mailer.send(message); }
    getAuthKey(): string { return this._key; }
    getRegistrationUrl(): string { return this.getBaseUrl('register'); }
    getRequestPasswordResetUrl(): string { return this.getBaseUrl('password-reset/request'); }
    getResetPasswordUrl(user: User, fingerprint: string): string {
        const token = signToken(this._key, `${this._id}.password-reset`, { uid: user.id, fp: fingerprint }, 60 * 60);
        return `${this.getBaseUrl('password-reset/reset')}?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`;
    }
    /** Payload of a password reset token valid for this panel, otherwise `null`. */
    readResetPasswordToken(token: unknown): { uid: string | number; fp: string } | null { return readToken(this._key, `${this._id}.password-reset`, token) as any; }
    getVerifyEmailUrl(user: User): string {
        const expires = Math.floor(Date.now() / 1000) + 60 * 60;
        const { hash, signature } = signVerificationUrl(`${this._key}.${this._id}`, user.id, user.email, expires);
        return `${this.getBaseUrl(`email-verification/verify/${encodeURIComponent(String(user.id))}/${hash}`)}?expires=${expires}&signature=${encodeURIComponent(signature)}`;
    }
    checkVerifyEmailUrl(id: string, hash: string, expires: unknown, signature: unknown): boolean { return checkVerificationUrl(`${this._key}.${this._id}`, id, hash, expires, signature); }
    getEmailVerificationPromptUrl(): string { return this.getBaseUrl('email-verification/prompt'); }
    getProfileUrl(): string | null { return this._profile ? this.getBaseUrl('profile') : null; }
    /** Whether the user must still verify their email before using the panel. */
    async mustVerifyEmail(user: User | null): Promise<boolean> {
        if (!user || !this.isEmailVerificationRequired()) return false;
        const auth = this.getAuth();
        return auth.hasVerifiedEmail ? !(await auth.hasVerifiedEmail(user)) : false;
    }

    // -------------------------------------------------------------- multi-tenancy
    private _tenant: TenantProvider | null = null;
    private _tenantOwnershipColumn: string | null = null;
    private _tenantRegistration: typeof RegisterTenant | null = null;
    private _tenantProfile: typeof EditTenantProfile | null = null;
    private _tenantMenu = true;
    private _tenantMenuItems: Record<string, Action> = {};
    private _tenantScope = new AsyncLocalStorage<{ tenant: unknown }>();
    /**
     * Makes the panel multi-tenant. `ownershipColumn` is the column linking a record to its tenant (`team_id`);
     * the panel's resources then only read and write the current tenant's records (see `Resource.isScopedToTenant`).
     */
    tenant(provider: TenantProvider | null, options: { ownershipColumn?: string } = {}): this { this._tenant = provider; this._tenantOwnershipColumn = options.ownershipColumn ?? null; return this; }
    hasTenancy(): boolean { return this._tenant !== null; }
    getTenantProvider(): TenantProvider { if (!this._tenant) throw new Error('Panel has no tenancy: call panel.tenant(...).'); return this._tenant; }
    getTenantOwnershipColumn(): string | null { return this._tenantOwnershipColumn; }
    /** Tenant registration page (`/new`). */
    tenantRegistration(page: typeof RegisterTenant | null): this { this._tenantRegistration = page; return this; }
    getTenantRegistrationPage(): typeof RegisterTenant | null { return this._tenantRegistration; }
    /** Tenant profile page (`/<tenant>/profile`). */
    tenantProfile(page: typeof EditTenantProfile | null): this { this._tenantProfile = page; return this; }
    getTenantProfilePage(): typeof EditTenantProfile | null { return this._tenantProfile; }
    tenantMenu(condition = true): this { this._tenantMenu = condition; return this; }
    hasTenantMenu(): boolean { return this._tenantMenu; }
    tenantMenuItems(items: Record<string, Action> | Action[]): this {
        for (const [key, item] of Array.isArray(items) ? items.map((item) => [item.getName(), item] as const) : Object.entries(items)) this._tenantMenuItems[key] = item;
        return this;
    }
    getTenantMenuItems(): Record<string, Action> { return this._tenantMenuItems; }
    /** Runs `fn` for a tenant: generated URLs (`getUrl`) and resource queries are scoped to it. */
    withTenant<T>(tenant: unknown, fn: () => T): T { return this._tenantScope.run({ tenant }, fn); }
    /** Tenant of the current request, or `null`. */
    getTenant<T = any>(): T | null { return (this._tenantScope.getStore()?.tenant ?? null) as T | null; }
    getTenantUrlKey(tenant: unknown): string { return this.getTenantProvider().getKey(tenant); }

    private _subNavigationPosition: 'start' | 'end' | 'top' = 'start';
    /** Default position of page sub-navigation (`start`). */
    subNavigationPosition(position: 'start' | 'end' | 'top'): this { this._subNavigationPosition = position; return this; }
    getSubNavigationPosition(): 'start' | 'end' | 'top' { return this._subNavigationPosition; }
    private _appUrl: string | null = null;
    /** Public URL of the application (`https://example.com`), used in emailed links. Without it the request origin is used, which should be avoided in production (the `Host` header can be forged). */
    appUrl(url: string | null): this { this._appUrl = url ? url.replace(/\/$/, '') : null; return this; }
    getAppUrl(): string | null { return this._appUrl; }

    getMaxContentWidth(): string { return this._maxContentWidth; }
    /** URL inside the panel; in a multi-tenant panel, prefixed with the current (or given) tenant. */
    getUrl(sub = '', tenant: unknown = this.getTenant()): string {
        if (this._tenant && tenant) return '/' + [this._path, encodeURIComponent(this.getTenantUrlKey(tenant)), sub.replace(/^\/|\/$/g, '')].filter(Boolean).join('/');
        return this.getBaseUrl(sub);
    }
    /** URL outside any tenant (login, registration, profile, tenant registration). */
    getBaseUrl(sub = ''): string { return '/' + [this._path, sub.replace(/^\/|\/$/g, '')].filter(Boolean).join('/'); }
    getLoginUrl(): string { return this.getBaseUrl('login'); }
    getLogoutUrl(): string { return this.getBaseUrl('logout'); }
    /** Prefix of this panel's Livewire endpoint (`/livewire` or `/<path>/livewire`): each panel has its own. */
    getLivewirePrefix(): string { return this._path ? `/${this._path}/livewire` : '/livewire'; }
    assetUrl(file: string): string { return `/${file}?v=${ASSET_VERSION}`; }
    getBrand(): Record<string, unknown> { return { name: this._brandName, logo: this._brandLogo, darkLogo: this._darkModeBrandLogo, height: this._brandLogoHeight }; }
    getFont(): typeof this._font { return this._font; }

    /** Default avatar: the name's initials from the external ui-avatars.com service. */
    getUserAvatarUrl(user: User): string { return this.getAvatarUrlFor(user.name); }
    /** Tenant avatar: from the tenant provider (`getAvatarUrl`), otherwise its initials. */
    getTenantAvatarUrl(tenant: unknown): string { return this.getTenantProvider().getAvatarUrl?.(tenant) ?? this.getAvatarUrlFor(this.getTenantProvider().getName(tenant)); }
    private _spa = false;
    /** SPA mode: navigate between panel pages without full reloads (`wire:navigate`). */
    spa(condition = true): this { this._spa = condition; return this; }
    hasSpaMode(): boolean { return this._spa; }
    getAvatarUrlFor(name: string): string {
        const initials = name.trim().split(' ').map((s) => s.replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 1)).join(' ');
        const background = '#' + convertToRgb(this.colors.getColor('gray')![950]).map((n) => n.toString(16).padStart(2, '0')).join('');
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials).replace(/%20/g, '+')}&format=svg&color=FFFFFF&background=${encodeURIComponent(background)}`;
    }

    /** Navigation groups: registered pages plus custom items, sorted, grouped in the declared order. */
    /** Computed navigation badges: page URL → value. */
    async resolveNavigationBadges(): Promise<Map<string, string | number | null>> {
        const badges = new Map<string, string | number | null>();
        for (const page of this._pages) if (page.shouldRegisterNavigation && typeof (page as any).getNavigationBadge === 'function') badges.set(page.slug, await (page as any).getNavigationBadge());
        return badges;
    }
    /** URLs of menu pages this user cannot open. */
    async resolveInaccessiblePages(user: User | null): Promise<Set<string>> {
        const hidden = new Set<string>();
        for (const page of this._pages) if (page.shouldRegisterNavigation && !(await this.canAccessPage(page, user))) hidden.add(page.slug);
        return hidden;
    }
    getNavigation(path: string, badges: Map<string, string | number | null> = new Map(), hidden: Set<string> = new Set()): { label: string | null; itemsId: string; isActive: boolean; items: { label: string; url: string; icon: string | null; isActive: boolean; badge: string | number | null; badgeColorClasses: string[] }[] }[] {
        const items = [
            ...this._pages.filter((p) => p.shouldRegisterNavigation && !hidden.has(p.slug)).map((p) => {
                const item = NavigationItem.make(p.getNavigationLabel()).url(this.getUrl(p.slug)).icon(p.navigationIcon).group(p.navigationGroup).sort(p.navigationSort).badge(badges.has(p.slug) ? badges.get(p.slug)! : p.navigationBadge, p.navigationBadgeColor);
                const base = this.getUrl(p.slug);
                return (p as any).resource ? item.isActiveWhen((current) => current === base || current.startsWith(base + '/')) : item;
            }),
            ...this._navigationItems,
        ].sort((a, b) => a._sort - b._sort);
        const order = [null, ...this._navigationGroups, ...items.map((i) => i._group).filter((g): g is string => g !== null && !this._navigationGroups.includes(g))];
        return [...new Set(order)].map((label) => {
            const own = items.filter((i) => i._group === label).map((i) => ({ label: i.label, url: i._url, icon: i._icon, isActive: i.isActive(path), badge: i._badge, badgeColorClasses: this.colors.getComponentClasses('badge', i._badgeColor) }));
            return { label, itemsId: label ? `fi-sidebar-group-items-${slug(label)}-${createHash('md5').update(label).digest('hex').slice(0, 8)}` : '', isActive: own.some((i) => i.isActive), items: own };
        }).filter((g) => g.items.length);
    }

    // --- session: an HMAC-signed cookie holding the user id
    private sign(value: string): string { return createHmac('sha256', this._key).update(value).digest('base64url'); }
    logIn(res: Response, user: User, remember: boolean): void {
        const value = Buffer.from(JSON.stringify({ uid: user.id })).toString('base64url');
        res.cookie(this.getSessionCookieName(), `${value}.${this.sign(value)}`, { httpOnly: true, sameSite: 'lax', secure: res.req?.secure === true, ...(remember ? { maxAge: 1000 * 60 * 60 * 24 * 30 } : {}) });
    }
    logOut(res: Response): void { res.clearCookie(this.getSessionCookieName()); }
    async user(req: Request): Promise<User | null> {
        const raw = (req.headers.cookie ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${this.getSessionCookieName()}=`))?.split('=')[1];
        if (!raw) return null;
        const [value, mac] = raw.split('.');
        const a = Buffer.from(mac ?? ''), b = Buffer.from(this.sign(value));
        if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
        try { return await this.getAuth().find(JSON.parse(Buffer.from(value, 'base64url').toString()).uid); } catch { return null; }
    }
}

/**
 * Render hook locations of a panel. A few are declared but not rendered anywhere yet: see `UNPLACED_RENDER_HOOKS`.
 */
export const PanelsRenderHook = {
    AUTH_LOGIN_FORM_AFTER: 'panels::auth.login.form.after',
    AUTH_LOGIN_FORM_BEFORE: 'panels::auth.login.form.before',
    AUTH_PASSWORD_RESET_REQUEST_FORM_AFTER: 'panels::auth.password-reset.request.form.after',
    AUTH_PASSWORD_RESET_REQUEST_FORM_BEFORE: 'panels::auth.password-reset.request.form.before',
    AUTH_PASSWORD_RESET_RESET_FORM_AFTER: 'panels::auth.password-reset.reset.form.after',
    AUTH_PASSWORD_RESET_RESET_FORM_BEFORE: 'panels::auth.password-reset.reset.form.before',
    AUTH_REGISTER_FORM_AFTER: 'panels::auth.register.form.after',
    AUTH_REGISTER_FORM_BEFORE: 'panels::auth.register.form.before',
    BODY_END: 'panels::body.end',
    BODY_START: 'panels::body.start',
    CONTENT_AFTER: 'panels::content.after',
    CONTENT_BEFORE: 'panels::content.before',
    CONTENT_END: 'panels::content.end',
    CONTENT_START: 'panels::content.start',
    FOOTER: 'panels::footer',
    GLOBAL_SEARCH_AFTER: 'panels::global-search.after',
    GLOBAL_SEARCH_BEFORE: 'panels::global-search.before',
    GLOBAL_SEARCH_END: 'panels::global-search.end',
    GLOBAL_SEARCH_START: 'panels::global-search.start',
    HEAD_END: 'panels::head.end',
    HEAD_START: 'panels::head.start',
    LAYOUT_END: 'panels::layout.end',
    LAYOUT_START: 'panels::layout.start',
    PAGE_END: 'panels::page.end',
    PAGE_FOOTER_WIDGETS_AFTER: 'panels::page.footer-widgets.after',
    PAGE_FOOTER_WIDGETS_BEFORE: 'panels::page.footer-widgets.before',
    PAGE_FOOTER_WIDGETS_END: 'panels::page.footer-widgets.end',
    PAGE_FOOTER_WIDGETS_START: 'panels::page.footer-widgets.start',
    PAGE_HEADER_ACTIONS_AFTER: 'panels::page.header.actions.after',
    PAGE_HEADER_ACTIONS_BEFORE: 'panels::page.header.actions.before',
    PAGE_HEADER_HEADING_AFTER: 'panels::page.header.heading.after',
    PAGE_HEADER_HEADING_BEFORE: 'panels::page.header.heading.before',
    PAGE_HEADER_WIDGETS_AFTER: 'panels::page.header-widgets.after',
    PAGE_HEADER_WIDGETS_BEFORE: 'panels::page.header-widgets.before',
    PAGE_HEADER_WIDGETS_END: 'panels::page.header-widgets.end',
    PAGE_HEADER_WIDGETS_START: 'panels::page.header-widgets.start',
    PAGE_START: 'panels::page.start',
    /** The hook name says "module-menu", not "mobile-menu": kept for compatibility. */
    PAGE_SUB_NAVIGATION_MOBILE_MENU_AFTER: 'panels::page.sub-navigation.module-menu.after',
    PAGE_SUB_NAVIGATION_MOBILE_MENU_BEFORE: 'panels::page.sub-navigation.module-menu.before',
    PAGE_SUB_NAVIGATION_SIDEBAR_AFTER: 'panels::page.sub-navigation.sidebar.after',
    PAGE_SUB_NAVIGATION_SIDEBAR_BEFORE: 'panels::page.sub-navigation.sidebar.before',
    PAGE_SUB_NAVIGATION_START_AFTER: 'panels::page.sub-navigation.start.after',
    PAGE_SUB_NAVIGATION_START_BEFORE: 'panels::page.sub-navigation.start.before',
    PAGE_SUB_NAVIGATION_TOP_AFTER: 'panels::page.sub-navigation.top.after',
    PAGE_SUB_NAVIGATION_TOP_BEFORE: 'panels::page.sub-navigation.top.before',
    PAGE_SUB_NAVIGATION_END_AFTER: 'panels::page.sub-navigation.end.after',
    PAGE_SUB_NAVIGATION_END_BEFORE: 'panels::page.sub-navigation.end.before',
    RESOURCE_PAGES_LIST_RECORDS_TABLE_AFTER: 'panels::resource.pages.list-records.table.after',
    RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE: 'panels::resource.pages.list-records.table.before',
    RESOURCE_PAGES_LIST_RECORDS_TABS_END: 'panels::resource.pages.list-records.tabs.end',
    RESOURCE_PAGES_LIST_RECORDS_TABS_START: 'panels::resource.pages.list-records.tabs.start',
    RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_AFTER: 'panels::resource.pages.manage-related-records.table.after',
    RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_BEFORE: 'panels::resource.pages.manage-related-records.table.before',
    RESOURCE_RELATION_MANAGER_AFTER: 'panels::resource.relation-manager.after',
    RESOURCE_RELATION_MANAGER_BEFORE: 'panels::resource.relation-manager.before',
    RESOURCE_TABS_END: 'panels::resource.tabs.end',
    RESOURCE_TABS_START: 'panels::resource.tabs.start',
    SCRIPTS_AFTER: 'panels::scripts.after',
    SCRIPTS_BEFORE: 'panels::scripts.before',
    SIDEBAR_FOOTER: 'panels::sidebar.footer',
    SIDEBAR_LOGO_AFTER: 'panels::sidebar.logo.after',
    SIDEBAR_LOGO_BEFORE: 'panels::sidebar.logo.before',
    SIDEBAR_START: 'panels::sidebar.start',
    SIDEBAR_NAV_END: 'panels::sidebar.nav.end',
    SIDEBAR_NAV_START: 'panels::sidebar.nav.start',
    SIMPLE_LAYOUT_END: 'panels::simple-layout.end',
    SIMPLE_LAYOUT_START: 'panels::simple-layout.start',
    SIMPLE_PAGE_END: 'panels::simple-page.end',
    SIMPLE_PAGE_START: 'panels::simple-page.start',
    STYLES_AFTER: 'panels::styles.after',
    STYLES_BEFORE: 'panels::styles.before',
    TENANT_MENU_AFTER: 'panels::tenant-menu.after',
    TENANT_MENU_BEFORE: 'panels::tenant-menu.before',
    TOPBAR_AFTER: 'panels::topbar.after',
    TOPBAR_BEFORE: 'panels::topbar.before',
    TOPBAR_END: 'panels::topbar.end',
    TOPBAR_LOGO_AFTER: 'panels::topbar.logo.after',
    TOPBAR_LOGO_BEFORE: 'panels::topbar.logo.before',
    TOPBAR_START: 'panels::topbar.start',
    USER_MENU_AFTER: 'panels::user-menu.after',
    USER_MENU_BEFORE: 'panels::user-menu.before',
    USER_MENU_PROFILE_AFTER: 'panels::user-menu.profile.after',
    USER_MENU_PROFILE_BEFORE: 'panels::user-menu.profile.before',
} as const;
/** Widget render hook locations, rendered by `TableWidget`. */
export const WidgetsRenderHook = {
    TABLE_WIDGET_END: 'widgets::table-widget.end',
    TABLE_WIDGET_START: 'widgets::table-widget.start',
} as const;
/**
 * Hook locations that are declared but not rendered anywhere yet, with the reason.
 */
export const UNPLACED_RENDER_HOOKS: Record<string, string> = {
    ...Object.fromEntries(['RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_AFTER', 'RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_BEFORE'].map((k) => [(PanelsRenderHook as any)[k], 'ManageRelatedRecords page not implemented'])),
    ...Object.fromEntries(['RESOURCE_PAGES_LIST_RECORDS_TABS_END', 'RESOURCE_PAGES_LIST_RECORDS_TABS_START', 'RESOURCE_TABS_END', 'RESOURCE_TABS_START'].map((k) => [(PanelsRenderHook as any)[k], 'reserved, no view renders it'])),
};

/** Alpine scope of a schema component without a key (anonymous grid cell). */
const ANONYMOUS_SCHEMA_COMPONENT = `x-data="filamentSchemaComponent(${e(js({ key: null, exposedMethods: [], path: '', containerPath: '' }))})"`;
/** Common base: a stateful component hosting schemas (`<name>Schema(schema)`). */
abstract class BasePage extends Component implements SchemaHost {
    get panel(): Panel { return (this._ctx as PanelContext).panel; }
    getSchema(name: string): Schema {
        const schema = Schema.make(this).key(name);
        if (name === 'form') schema.statePath('data');
        return (this as any)[`${name}Schema`](schema);
    }
    contentSchema(schema: Schema): Schema { return schema.components([]); }
    /** Render hook scopes of this page: its class (and its resource, for a resource page). */
    getRenderHookScopes(): unknown[] {
        const resource = (this.constructor as any).resource;
        return resource ? [this.constructor, resource] : [this.constructor];
    }
}

/** A panel page, in the full layout (sidebar, header). */
export class Page extends BasePage {
    /** Methods the browser may call. A subclass adds its own: `static callable = ['approve']`. */
    static callable = ['mountAction', 'unmountAction', 'callMountedAction', 'callSchemaComponentMethod'];
    static slug = '';
    static title: string | null = null;
    static navigationLabel: string | null = null;
    static navigationIcon: string | null = null;
    static navigationGroup: string | null = null;
    static navigationSort = 0;
    static navigationBadge: string | number | null = null;
    static navigationBadgeColor = 'primary';
    static shouldRegisterNavigation = true;
    /** Restricts the page to some users: returning `false` hides it from the menu and denies it (403). */
    static canAccess(_user: User): boolean | Promise<boolean> { return true; }
    static getTitle(): string { return this.title ?? this.name.replace(/([a-z])([A-Z])/g, '$1 $2'); }
    static getNavigationLabel(): string { return this.navigationLabel ?? this.getTitle(); }

    /** Every request, including browser updates, requires an authenticated user: a snapshot kept after logout is not enough. */
    async boot(): Promise<void> {
        const ctx = this._ctx as PanelContext | null;
        if (!ctx?.user) throw new WireError(401, 'Unauthenticated.');
        // In a multi-tenant panel, every page belongs to a tenant the user is a member of (checked by the router).
        if (ctx.panel.hasTenancy() && !ctx.tenant) throw new WireError(404, 'Tenant not found.');
        if (await ctx.panel.mustVerifyEmail(ctx.user)) throw new WireError(403, 'Email address not verified.');
        // Checked on every request, not only on display: a forged request to a forbidden page is denied.
        if (!(await this.isAccessAuthorized(ctx))) throw new WireError(403, 'Forbidden.');
    }
    protected isAccessAuthorized(ctx: PanelContext): boolean | Promise<boolean> { return ctx.panel.canAccessPage(this.constructor as typeof Page, ctx.user); }
    getTitle(): string { return (this.constructor as typeof Page).getTitle(); }
    getHeading(): string { return this.getTitle(); }
    getBreadcrumbs(): { label: string; url: string | null }[] { return []; }
    getHeaderActions(): Action[] { return []; }
    getPageClasses(): string[] { return []; }
    /** Page sub-navigation; empty by default. */
    getSubNavigation(): SubNavigationItem[] | Promise<SubNavigationItem[]> { return []; }
    /** Sub-navigation position: `start` (column before the content), `end` (after) or `top` (tabs). Defaults to the resource's, then the panel's. */
    static subNavigationPosition: 'start' | 'end' | 'top' | null = null;
    getSubNavigationPosition(): 'start' | 'end' | 'top' {
        const own = (this.constructor as typeof Page).subNavigationPosition;
        const resource = (this.constructor as any).resource ?? (this.constructor as any).parentResource;
        return own ?? resource?.subNavigationPosition ?? this.panel.getSubNavigationPosition();
    }
    /** Widgets shown below the page content. */
    getFooterWidgets(): (typeof Widget)[] { return []; }
    getFooterWidgetsColumns(): number | Record<string, number> { return 2; }
    /** Footer widget grid, in the page's `footerWidgets` schema. */
    protected async renderFooterWidgets(): Promise<string> {
        const widgets = await this.filterVisibleWidgets(this.getFooterWidgets());
        if (!widgets.length) return '';
        const liberate = (hook: string) => `<div class="fi-sc-liberated" wire:key="" ${ANONYMOUS_SCHEMA_COMPONENT}>${renderHook(hook, this.getRenderHookScopes())}</div>`;
        return `<div x-data="filamentSchema({ livewireId: ${e(js(this.id))}, schemaKey: 'footerWidgets' })" x-on:form-validation-error.window="handleFormValidationError" x-on:reset-schema-component-state.window="handleClientSideStateReset" class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));">${liberate(PanelsRenderHook.PAGE_FOOTER_WIDGETS_START)}${await this.renderWidgetsGrid(widgets, this.getFooterWidgetsColumns(), 'footerWidgets')}${liberate(PanelsRenderHook.PAGE_FOOTER_WIDGETS_END)}</div>`;
    }
    /** Widgets shown above the page content, with the data passed to each (widget properties). */
    getHeaderWidgets(): (typeof Widget)[] { return []; }
    getHeaderWidgetsColumns(): number { return 2; }
    getWidgetData(): Record<string, unknown> { return {}; }
    /** Header widget grid, in the page's `headerWidgets` schema. */
    protected async renderHeaderWidgets(): Promise<string> {
        const widgets = await this.filterVisibleWidgets(this.getHeaderWidgets());
        if (!widgets.length) return '';
        const liberate = (hook: string) => `<div class="fi-sc-liberated" wire:key="" ${ANONYMOUS_SCHEMA_COMPONENT}>${renderHook(hook, this.getRenderHookScopes())}</div>`;
        return `<div x-data="filamentSchema({ livewireId: ${e(js(this.id))}, schemaKey: 'headerWidgets' })" x-on:form-validation-error.window="handleFormValidationError" x-on:reset-schema-component-state.window="handleClientSideStateReset" class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));">${liberate(PanelsRenderHook.PAGE_HEADER_WIDGETS_START)}${await this.renderWidgetsGrid(widgets, this.getHeaderWidgetsColumns(), 'headerWidgets')}${liberate(PanelsRenderHook.PAGE_HEADER_WIDGETS_END)}</div>`;
    }
    /** Widgets the current user is allowed to see. */
    protected async filterVisibleWidgets(candidates: (typeof Widget)[]): Promise<(typeof Widget)[]> {
        const viewer = (this._ctx as PanelContext).user;
        const widgets: (typeof Widget)[] = [];
        for (const widget of candidates) if (await this.panel.authorize(viewer, 'view', { widget, rule: () => widget.canView(viewer!) })) widgets.push(widget);
        return widgets;
    }
    /** Widget grid of a schema: each widget is a child component, lazy-loaded by default. */
    protected async renderWidgetsGrid(widgets: (typeof Widget)[], columns: number | Record<string, number>, schemaKey: string): Promise<string> {
        const items: string[] = [];
        for (const [index, widget] of widgets.entries()) {
            const componentName = (this as any)._runtime.nameOf(widget);
            const key = `${schemaKey}.${componentName}-${index}`;
            const child = await this.mountChild(componentName, this.getWidgetData(), `${this.id}.${key}`, { lazy: widget.isLazy });
            items.push(`<div class="fi-sc-liberated" wire:key="${e(`${this.id}.${key}`)}" x-data="filamentSchemaComponent(${e(js({ key, exposedMethods: [], path: '', containerPath: '' }))})">${child}</div>`);
        }
        const grid = new Attributes().grid(typeof columns === 'number' ? { lg: columns } : columns).class(['fi-sc', 'fi-sc-has-gap']);
        return `<div ${ANONYMOUS_SCHEMA_COMPONENT} class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component"><div><div ${grid.toHtml()}>${items.join('')}</div></div></div></div>`;
    }
    /** Page content: its `content` schema by default. */
    protected async renderContent(): Promise<string> { return (await this.getSchema('content')).toHtml(); }

    // --- mounted actions: the stack lives in the component state, modals are rendered server-side
    mountedActions: { name: string; arguments: Record<string, unknown>; context: Record<string, unknown>; data?: Record<string, unknown> }[] = [];
    getActionMountContext(): Record<string, unknown> { return {}; }
    protected getActionRecord(): unknown { return null; }
    /** Record targeted by an action mounted in a given context (table row…). */
    protected async resolveActionRecord(_context: Record<string, unknown>): Promise<unknown> { return this.getActionRecord(); }
    /** Actions that can be mounted in a given context (page header by default). */
    protected getMountableActions(context: Record<string, unknown>): Action[] | Promise<Action[]> {
        return typeof context.schemaComponent === 'string' ? this.getSchemaComponentActions(context.schemaComponent) : flattenActions(this.getHeaderActions());
    }
    /**
     * Actions owned by a schema component (Repeater: add, delete, move; Section: header actions).
     * The key comes from the browser: it must match a real component of the schema, or the schema itself.
     */
    /** Visible component of a schema of this page (or of a mounted action's form) with this key. */
    protected async findSchemaComponent(key: string): Promise<any | null> {
        const name = key.split('.')[0];
        const mountedIndex = /^mountedActionSchema(\d+)$/.exec(name);
        if (!mountedIndex && (!/^[A-Za-z]+$/.test(name) || typeof (this as any)[`${name}Schema`] !== 'function')) return null;
        const schema = mountedIndex ? await this.getMountedActionSchema(Number(mountedIndex[1])) : this.getSchema(name);
        return schema ? ((await schema.getVisibleFlatComponents()) as any[]).find((c) => c.getKey() === key) ?? null : null;
    }
    protected async getSchemaComponentActions(key: string): Promise<Action[]> {
        const name = key.split('.')[0];
        // The component may belong to the form of an already mounted action (rich editor in a modal).
        const mountedIndex = /^mountedActionSchema(\d+)$/.exec(name);
        if (!mountedIndex && (!/^[A-Za-z]+$/.test(name) || typeof (this as any)[`${name}Schema`] !== 'function')) return [];
        const schema = mountedIndex ? await this.getMountedActionSchema(Number(mountedIndex[1])) : this.getSchema(name);
        if (!schema) return [];
        // Only visible components expose their actions: a hidden component (section, callout…) mounts none.
        const components = (await schema.getVisibleFlatComponents()) as any[];
        const exact = components.find((c) => c.getKey() === key && typeof c.getActions === 'function');
        if (exact) return exact.getActions();
        return key === schema.getKey() ? components.filter((c) => !c.hasStatePath() && typeof c.getActions === 'function').flatMap((c) => c.getActions()) : [];
    }
    /** Context kept for a mounted action: the server's, never the browser's as-is. */
    protected resolveMountContext(clientContext: unknown): Record<string, unknown> {
        const component = (clientContext as any)?.schemaComponent;
        return typeof component === 'string' && component.length <= 200 ? { ...this.getActionMountContext(), schemaComponent: component } : this.getActionMountContext();
    }
    private async findMountableAction(name: unknown, context: Record<string, unknown> = this.getActionMountContext()): Promise<Action> {
        // An action of a modal footer: found among the extra footer actions of its (mounted) parent action.
        if (typeof context.parentAction === 'number') {
            const parent = this.mountedActions[context.parentAction];
            const owner = parent ? await this.findMountableAction(parent.name, parent.context) : null;
            const child = owner?.getExtraModalFooterActions().find((a) => a.getName() === name && a.isMountable());
            if (!child) throw new WireError(404, `Action not found: ${String(name)}`);
            return child;
        }
        const action = (await this.getMountableActions(context)).find((a) => a.getName() === name && a.isMountable());
        if (!action) throw new WireError(404, `Action not found: ${String(name)}`);
        return action;
    }
    private async actionContext(mounted: { arguments: Record<string, unknown>; context: Record<string, unknown>; data?: Record<string, unknown> }) {
        const parentIndex = mounted.context.parentAction;
        const parent = typeof parentIndex === 'number' ? this.mountedActions[parentIndex] : undefined;
        const parentData = parent ? (parent.data ??= {}) : undefined;
        // An action of a form field (affix action): its state, and access to the other fields of the same form.
        let fieldAccess: Record<string, unknown> = {};
        if (typeof mounted.context.schemaComponent === 'string') {
            const component = await this.findSchemaComponent(mounted.context.schemaComponent);
            const path = typeof component?.getStatePath === 'function' && component.hasStatePath() ? String(component.getStatePath()) : null;
            if (path) {
                const container = path.split('.').slice(0, -1);
                const nodeOf = () => container.reduce((node: any, segment) => (node && typeof node === 'object' ? node[segment] : undefined), this as any);
                fieldAccess = {
                    state: path.split('.').reduce((node: any, segment) => (node && typeof node === 'object' ? node[segment] : undefined), this as any),
                    get: (name: string) => nodeOf()?.[name],
                    set: (name: string, value: unknown) => { const node = nodeOf(); if (node && typeof node === 'object' && /^[A-Za-z0-9_]+$/.test(name)) node[name] = value; },
                };
            }
        }
        return { livewire: this, record: await this.resolveActionRecord(mounted.context), arguments: mounted.arguments, data: emptyToNull(mounted.data ?? {}), ...(parentData ? { parentData } : {}), ...fieldAccess };
    }
    /** Form schema of a mounted action: key `mountedActionSchema<n>`, state under `mountedActions.<n>.data`. */
    async getMountedActionSchema(index: number): Promise<Schema | null> {
        const mounted = this.mountedActions[index];
        if (!mounted) return null;
        const action = await this.findMountableAction(mounted.name, mounted.context);
        return action.applySchema(Schema.make(this).key(`mountedActionSchema${index}`).statePath(`mountedActions.${index}.data`).operation(mounted.name).record(await this.resolveActionRecord(mounted.context)));
    }
    private async renderActionModal(index: number): Promise<string> {
        const mounted = this.mountedActions[index];
        return (await this.findMountableAction(mounted.name, mounted.context)).toModalHtml(await this.actionContext(mounted), index, (await (await this.getMountedActionSchema(index))?.toHtml()) ?? null, mounted.context);
    }
    /** Cancels a partial modal render prepared by a live field when the same request then runs an action. */
    private cancelModalPartialRender(): void {
        for (const name of Object.keys(this._effects.partials ?? {})) if (name.startsWith('action-modals.')) { delete this._effects.partials![name]; this._skipRender = false; }
    }
    /** Live field in a mounted action's form: runs `afterStateUpdated`, then only returns the affected modal. */
    async updatedMountedActions(_value: unknown, key: string | null): Promise<void> {
        const m = /^(\d+)\.data\.(.+)$/.exec(key ?? '');
        if (!m) return;
        const index = Number(m[1]);
        const schema = await this.getMountedActionSchema(index);
        const field = schema?.getFlatComponents().find((c) => c instanceof Field && c.getStatePath() === `mountedActions.${index}.data.${m[2]}`) as Field | undefined;
        if (!field?.hasAfterStateUpdated()) return;
        const data = (this.mountedActions[index].data ??= {});
        await field.callAfterStateUpdated((name, value) => { data[name] = value; });
        this.renderPartial(`action-modals.${index}`, await this.renderActionModal(index));
    }
    /** Calls a method exposed by a field, from that field's JavaScript (e.g. Select search). Does not re-render. */
    async callSchemaComponentMethod(componentKey: unknown, method: unknown, args: unknown = []): Promise<unknown> {
        if (typeof componentKey !== 'string' || typeof method !== 'string') { this.skipRender(); return null; }
        const name = componentKey.split('.')[0];
        const mountedIndex = /^mountedActionSchema(\d+)$/.exec(name);
        const schema = mountedIndex ? await this.getMountedActionSchema(Number(mountedIndex[1])) : typeof (this as any)[`${name}Schema`] === 'function' ? await this.getSchema(name) : null;
        // A hidden component exposes no method, even if the browser forges the call.
        const component: any = schema ? (await schema.getVisibleFlatComponents()).find((c: any) => c.getKey() === componentKey) : undefined;
        // Only methods the component declares as exposed can be called from the browser.
        if (!component || !component.getExposedMethods().includes(method) || typeof component[method] !== 'function') { this.skipRender(); return null; }
        if (component.isRenderlessMethod(method)) this.skipRender();
        // Named arguments (an object), as sent by the front-end JavaScript: passed in key order.
        return component[method](...(Array.isArray(args) ? args : args && typeof args === 'object' ? Object.values(args) : []));
    }
    /** A hidden action can be neither mounted nor run, even through a call forged by the browser. */
    private async assertActionVisible(action: Action, context: Record<string, unknown> = {}): Promise<void> {
        const record = await this.resolveActionRecord(context);
        if (context.recordKey !== undefined && record === null) throw new WireError(404, 'Record not found.');
        const ctx = { livewire: this as any, component: null as any, operation: null, record, get: () => undefined, state: undefined };
        if (!(await action.isVisible(ctx)) || (await action.isDisabled(ctx))) throw new WireError(403, `Action unavailable: ${action.getName()}`);
        // An action with a URL for this record is a link: it cannot be mounted.
        if (action.resolveUrl(ctx) !== null) throw new WireError(404, `Action not found: ${action.getName()}`);
    }
    private syncActionModals(): void {
        this.dispatch('sync-action-modals', { id: this.id, newActionNestingIndex: this.mountedActions.length ? this.mountedActions.length - 1 : null, shouldOverlayParentActions: false });
    }
    /** False for a table component: its modals are rendered inside the table. */
    protected rendersActionModalsInPage(): boolean { return true; }
    async renderActionModals(): Promise<string> {
        const modals: string[] = [];
        for (const index of this.mountedActions.keys()) modals.push(await this.renderActionModal(index));
        return `<div wire:partial="action-modals" x-data="filamentActionModals({
                    livewireId: ${js(this.id)},
                })" style="height: 0">${modals.join('')}</div>`;
    }
    /** Mounts an action: without a modal it runs immediately; with one, only the modals fragment is returned. */
    async mountAction(name: unknown, args: unknown = {}, _context: unknown = {}): Promise<void> {
        this.cancelModalPartialRender();
        // A modal footer action: its context is its parent's (kept by the server), plus the parent's index.
        const parentIndex = (_context as any)?.parentAction;
        const context = Number.isInteger(parentIndex) && parentIndex >= 0 && parentIndex < this.mountedActions.length
            ? { ...this.mountedActions[parentIndex].context, parentAction: parentIndex as number }
            : this.resolveMountContext(_context);
        const action = await this.findMountableAction(name, context);
        await this.assertActionVisible(action, context);
        const mounted = { name: String(name), arguments: args && typeof args === 'object' ? (args as Record<string, unknown>) : {}, context };
        if (!action.hasModal() || (await action.isModalHidden(await this.actionContext(mounted)))) {
            // Without a modal, `halt()` and `cancel()` simply stop the action.
            try { await action.call(await this.actionContext(mounted)); } catch (error) { if (!(error instanceof ActionHalt)) throw error; }
            return;
        }
        this.mountedActions.push(mounted);
        const schema = await this.getMountedActionSchema(this.mountedActions.length - 1);
        if (schema) {
            // Initial state: field defaults, then `fillForm()`.
            const data: Record<string, unknown> = {};
            mounted.data = data;
            fillSchema(schema, data);
            const fillContext = await this.actionContext(mounted);
            const fill = await action.getFormFill(fillContext);
            if (fill) { fillSchemaFromRecord(schema, data, fill); await loadSchemaRelationships(schema, data, fillContext.record); }
        }
        await action.runMountUsing({ ...(await this.actionContext(mounted)), data: (mounted.data ??= {}), action });
        this.renderPartial('action-modals', await this.renderActionModals());
        this.syncActionModals();
    }
    unmountAction(_shouldCancelParentActions: unknown = true): void {
        this.cancelModalPartialRender();
        this._errors = {};
        this.mountedActions.pop();
        this.syncActionModals();
    }
    async callMountedAction(_args: unknown = {}): Promise<void> {
        this.cancelModalPartialRender();
        const mounted = this.mountedActions[this.mountedActions.length - 1];
        if (!mounted) return;
        const action = await this.findMountableAction(mounted.name, mounted.context);
        await this.assertActionVisible(action, mounted.context);
        const schema = await this.getMountedActionSchema(this.mountedActions.length - 1);
        if (schema) {
            this._errors = await validateSchema(schema);
            if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        }
        const callContext = await this.actionContext(mounted);
        if (schema) { callContext.data = await getSchemaState(schema); callContext.schema = schema; }
        try {
            await action.call(callContext);
        } catch (error) {
            // `action.halt()`: the modal stays open; `action.cancel()`: it closes.
            if (!(error instanceof ActionHalt)) throw error;
            if (error.closesModal) { this.mountedActions.pop(); this.syncActionModals(); }
            return;
        }
        // "… & create another": the modal stays open with a reset form (except the preserved fields).
        if (schema && _args && typeof _args === 'object' && (_args as any).another === true) {
            const preserved = JSON.parse(JSON.stringify(action.getDataPreservedForAnother(callContext.data ?? {})));
            const data: Record<string, unknown> = {};
            mounted.data = data;
            fillSchema(schema, data);
            Object.assign(data, preserved);
            return;
        }
        this.mountedActions.pop();
        this.syncActionModals();
    }

    async render(): Promise<string> {
        const ctx = { livewire: this as any, component: null as any, operation: null, record: this.getActionRecord(), get: () => undefined, state: undefined };
        const headerActions: string[] = [];
        for (const action of this.getHeaderActions()) if (await action.isVisible(ctx)) headerActions.push(await action.toHtml(ctx));
        return views.render('filament-panels::pages.page', {
            heading: this.getHeading(), headerWidgets: await this.renderHeaderWidgets(), content: await this.renderContent(), footerWidgets: await this.renderFooterWidgets(), livewireId: this.id, renderHookScopes: this.getRenderHookScopes(),
            subNavigation: await this.getSubNavigation(), subNavigationPosition: this.getSubNavigationPosition(),
            breadcrumbs: this.getBreadcrumbs(), headerActions, pageClasses: this.getPageClasses(), actionModals: this.rendersActionModalsInPage() ? await this.renderActionModals() : '',
            headerActionsKey: createHash('md5').update(this.getHeaderActions().map((a) => a.getName()).join(',')).digest('hex'),
        });
    }
}
/**
 * Dashboard: a widget grid, preceded by a filters form when the page defines `filtersFormSchema(schema)`.
 * The filters are passed to widgets as `pageFilters`.
 */
export class Dashboard extends Page {
    static slug = '';
    static title = 'Dashboard';
    static navigationIcon = 'o-home';
    static navigationSort = -2;
    /** Filters form state. Stays `null` while the page has no filters. */
    filters: Record<string, unknown> | null = null;
    /** Dashboard widgets. Defaults to the panel's (`panel.widgets([...])`). */
    getWidgets(): (typeof Widget)[] { return this.panel.getWidgets(); }
    /** Grid columns: a number (at the `lg` breakpoint), or one number per breakpoint. */
    getColumns(): number | Record<string, number> { return 2; }
    hasFiltersForm(): boolean { return typeof (this as any).filtersFormSchema === 'function'; }
    getSchema(name: string): Schema {
        if (name !== 'filtersForm') return super.getSchema(name);
        // 2 / 3 / 4 column grid, state under `filters`, live fields.
        const schema = (this as any).filtersFormSchema(Schema.make(this).key('filtersForm').columns({ md: 2, xl: 3, '2xl': 4 }).statePath('filters').partialName('table-filters-form')) as Schema;
        for (const component of schema.getFlatComponents() as any[]) if (component instanceof Field && typeof (component as any).live === 'function') (component as any).live();
        return schema;
    }
    mount(): void {
        if (!this.hasFiltersForm()) return;
        this.filters = {};
        fillSchema(this.getSchema('filtersForm'), this.filters);
    }
    getWidgetData(): Record<string, unknown> { return this.hasFiltersForm() ? { pageFilters: this.filters } : {}; }
    protected async renderContent(): Promise<string> {
        const filters = this.hasFiltersForm() ? `<div ${ANONYMOUS_SCHEMA_COMPONENT} class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component">${await this.getSchema('filtersForm').toHtml()}</div></div>` : '';
        const widgets = await this.renderWidgetsGrid(await this.filterVisibleWidgets(this.getWidgets()), this.getColumns(), 'content');
        return `<div x-data="filamentSchema({ livewireId: ${e(js(this.id))}, schemaKey: 'content' })" x-on:form-validation-error.window="handleFormValidationError" x-on:reset-schema-component-state.window="handleClientSideStateReset" class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));">${filters}${widgets}</div>`;
    }
}

/** In-memory rate limiter: `max` attempts per window, per key. Fine for a single instance; use a shared store when running several. */
export class Throttle {
    private hits = new Map<string, number[]>();
    private max: number;
    private windowMs: number;
    constructor(max = 5, windowMs = 60_000) { this.max = max; this.windowMs = windowMs; }
    /** Records an attempt; returns 0 if allowed, otherwise the number of seconds to wait. */
    hit(key: string, now = Date.now()): number {
        const recent = (this.hits.get(key) ?? []).filter((at) => at > now - this.windowMs);
        if (recent.length >= this.max) { this.hits.set(key, recent); return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)); }
        recent.push(now);
        this.hits.set(key, recent);
        // Keep the store from growing forever.
        if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (!v.some((at) => at > now - this.windowMs)) this.hits.delete(k);
        return 0;
    }
    clear(key: string): void { this.hits.delete(key); }
}
const loginThrottle = new Throttle();

/** Page with the simple layout (login, registration…). */
export abstract class SimplePage extends BasePage {
    abstract getTitle(): string;
    getHeading(): string | null { return this.getTitle(); }
    /** Subheading, as trusted HTML (built by the page, with data escaped). */
    getSubheading(): string | null { return null; }
    hasLogo(): boolean { return true; }
    async render(): Promise<string> {
        return views.render('filament-panels::pages.simple', { brand: this.panel.getBrand(), heading: this.getHeading(), subheading: this.getSubheading(), hasLogo: this.hasLogo(), content: await this.getSchema('content').toHtml(), livewireId: this.id, renderHookScopes: this.getRenderHookScopes() });
    }
}

/** Color manager read by the other packages and shared by all panels; each request sets its panel's colors on it (`Panel.withTheme`). */
const sharedColors = new ColorManager();
/** `fi-link` link of an authentication page. */
function authLink(url: string, label: string, options: { iconName?: string | null; size?: string } = {}): string {
    const classes = ['fi-ac-link-action', 'fi-link', `fi-size-${options.size ?? 'md'}`, ...sharedColors.getComponentClasses('link', 'primary')];
    return `<a href="${e(url)}" class="${classes.join(' ')}" >${options.iconName ? icon(options.iconName) : ''}<span class="fi-link-label"> ${e(label)} </span></a>`;
}
/** Absolute URL for an email: based on `panel.appUrl()`, otherwise the request origin. */
function absoluteUrl(panel: Panel, req: Request, path: string): string { return `${panel.getAppUrl() ?? `${req.protocol}://${req.get('host')}`}${path}`; }
const registerThrottle = new Throttle(2);
const passwordResetThrottle = new Throttle(2);
const verificationThrottle = new Throttle(2);
const throttled = (group: string, wait: number) => Notification.make().danger().title(t(`${group}.notifications.throttled.title`, { seconds: wait, minutes: Math.ceil(wait / 60) })).body(t(`${group}.notifications.throttled.body`, { seconds: wait, minutes: Math.ceil(wait / 60) })).send();
/** Password rules (at least 8 characters) and confirmation rule (`same`). */
const passwordRules = (confirmationField: string, confirmationLabel: string) => [
    { name: 'min', passes: (value: unknown) => String(value).length >= 8, message: (attribute: string) => `The ${attribute} field must be at least 8 characters.` },
    { name: 'same', passes: (value: unknown, ctx: any) => value === ctx.get(confirmationField), message: (attribute: string) => `The ${attribute} field must match ${confirmationLabel}.` },
];
/** Email verification message. */
async function sendVerificationEmail(panel: Panel, req: Request, user: User): Promise<void> {
    await panel.sendMail({
        to: user.email, subject: 'Verify Email Address',
        lines: ['Please click the button below to verify your email address.'],
        action: { label: 'Verify Email Address', url: absoluteUrl(panel, req, panel.getVerifyEmailUrl(user)) },
        outro: ['If you did not create an account, no further action is required.'],
    });
}
const formContent = (submit: string, actions: Action[], options: { fullWidth?: boolean; alignment?: string | null; before?: string; after?: string } = {}) => [
    ...(options.before ? [RenderHook.make(options.before)] : []),
    Form.make([EmbeddedSchema.make('form')]).id('form').livewireSubmitHandler(submit)
        .footer([Actions.make(actions).alignment(options.alignment ?? null).fullWidth(options.fullWidth ?? true).key('form-actions')]),
    ...(options.after ? [RenderHook.make(options.after)] : []),
];

/** Registration page: name, email, confirmed password. The user is logged in, then asked to verify their email if the panel requires it. */
export class Register extends SimplePage {
    static callable = ['register', 'callSchemaComponentMethod'];
    data: Record<string, unknown> = {};
    mount(): void {
        if ((this._ctx as PanelContext).user) { this.redirect(this.panel.getUrl()); return; }
        fillSchema(this.getSchema('form'), this.data);
    }
    getTitle(): string { return t('filament-panels::auth/pages/register.title'); }
    getHeading(): string { return t('filament-panels::auth/pages/register.heading'); }
    getSubheading(): string | null {
        if (!this.panel.getLoginPage()) return null;
        return `${e(t('filament-panels::auth/pages/register.actions.login.before'))} ${authLink(this.panel.getLoginUrl(), t('filament-panels::auth/pages/register.actions.login.label'))}`;
    }
    formSchema(schema: Schema): Schema {
        const auth = this.panel.getAuth();
        return schema.components([
            TextInput.make('name').label(t('filament-panels::auth/pages/register.form.name.label')).required().maxLength(255).autofocus(),
            TextInput.make('email').label(t('filament-panels::auth/pages/register.form.email.label')).email().required().maxLength(255)
                .rule({ name: 'unique', passes: async (value) => !(await auth.findByEmail!(String(value))), message: (attribute) => `The ${attribute} has already been taken.` }),
            passwordRules('passwordConfirmation', 'password confirmation').reduce((input, rule) => input.rule(rule), TextInput.make('password').label(t('filament-panels::auth/pages/register.form.password.label')).password().revealable().required()),
            TextInput.make('passwordConfirmation').label(t('filament-panels::auth/pages/register.form.password_confirmation.label')).password().revealable().required().dehydrated(false),
        ]);
    }
    contentSchema(schema: Schema): Schema {
        return schema.components(formContent('register', [Action.make('register').label(t('filament-panels::auth/pages/register.form.actions.register.label')).submit('register')], { before: PanelsRenderHook.AUTH_REGISTER_FORM_BEFORE, after: PanelsRenderHook.AUTH_REGISTER_FORM_AFTER }));
    }
    /** Validated data, just before creation (add a value, normalize the email…). */
    protected mutateFormDataBeforeRegister(data: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> { return data; }
    /** Creates the user; defaults to the auth provider's `create()`. */
    protected handleRegistration(data: Record<string, unknown>): Promise<User> | User {
        return this.panel.getAuth().create!({ name: String(data.name), email: String(data.email), password: String(data.password) });
    }
    async register(): Promise<void> {
        const { req, res, panel } = this._ctx as PanelContext;
        const wait = registerThrottle.hit(`${panel.getId()}:${req.ip ?? ''}`);
        if (wait > 0) { throttled('filament-panels::auth/pages/register', wait); return; }
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        const user = await this.handleRegistration(await this.mutateFormDataBeforeRegister(await getSchemaState(form)));
        if (panel.hasEmailVerification()) await sendVerificationEmail(panel, req, user);
        panel.logIn(res, user, false);
        this.redirect(panel.getUrl());
    }
}

/** Password reset request page: a signed link, valid for 60 minutes, is sent by email. */
export class RequestPasswordReset extends SimplePage {
    static callable = ['request', 'callSchemaComponentMethod'];
    data: Record<string, unknown> = {};
    mount(): void {
        if ((this._ctx as PanelContext).user) { this.redirect(this.panel.getUrl()); return; }
        fillSchema(this.getSchema('form'), this.data);
    }
    getTitle(): string { return t('filament-panels::auth/pages/password-reset/request-password-reset.title'); }
    getHeading(): string { return t('filament-panels::auth/pages/password-reset/request-password-reset.heading'); }
    getSubheading(): string | null {
        return this.panel.getLoginPage() ? authLink(this.panel.getLoginUrl(), t('filament-panels::auth/pages/password-reset/request-password-reset.actions.login.label'), { iconName: 'm-arrow-left' }) : null;
    }
    formSchema(schema: Schema): Schema {
        return schema.components([TextInput.make('email').label(t('filament-panels::auth/pages/password-reset/request-password-reset.form.email.label')).email().required().autocomplete().autofocus()]);
    }
    contentSchema(schema: Schema): Schema {
        return schema.components(formContent('request', [Action.make('request').label(t('filament-panels::auth/pages/password-reset/request-password-reset.form.actions.request.label')).submit('request')], { before: PanelsRenderHook.AUTH_PASSWORD_RESET_REQUEST_FORM_BEFORE, after: PanelsRenderHook.AUTH_PASSWORD_RESET_REQUEST_FORM_AFTER }));
    }
    async request(): Promise<void> {
        const { req, panel } = this._ctx as PanelContext;
        const wait = passwordResetThrottle.hit(`${panel.getId()}:request:${req.ip ?? ''}`);
        if (wait > 0) { throttled('filament-panels::auth/pages/password-reset/request-password-reset', wait); return; }
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        const auth = panel.getAuth();
        const user = await auth.findByEmail!(String(this.data.email));
        if (user) {
            await panel.sendMail({
                to: user.email, subject: 'Reset Password Notification',
                lines: ['You are receiving this email because we received a password reset request for your account.'],
                action: { label: 'Reset Password', url: absoluteUrl(panel, req, panel.getResetPasswordUrl(user, await auth.getPasswordFingerprint!(user))) },
                outro: ['This password reset link will expire in 60 minutes.', 'If you did not request a password reset, no further action is required.'],
            });
        }
        // Security: always answer the same way, whether or not an account exists, so the response
        // does not reveal which email addresses are registered.
        Notification.make().success().title('We have emailed your password reset link.').body(t('filament-panels::auth/pages/password-reset/request-password-reset.notifications.sent.body')).send();
        this.data = {};
        fillSchema(form, this.data);
    }
}

/** Sets a new password from the emailed link. The link works once: it dies with the old password. */
export class ResetPassword extends SimplePage {
    static callable = ['resetPassword', 'callSchemaComponentMethod'];
    static locked = ['email', 'token'];
    email: string | null = null;
    password = '';
    passwordConfirmation = '';
    token: string | null = null;
    mount(params: Record<string, unknown>): void {
        if ((this._ctx as PanelContext).user) { this.redirect(this.panel.getUrl()); return; }
        this.token = typeof params.token === 'string' ? params.token : null;
        this.email = typeof params.email === 'string' ? params.email : null;
    }
    /** The form has no state path: its fields are page properties. */
    getSchema(name: string): Schema { return name === 'form' ? this.formSchema(Schema.make(this).key('form')) : super.getSchema(name); }
    getTitle(): string { return t('filament-panels::auth/pages/password-reset/reset-password.title'); }
    getHeading(): string { return t('filament-panels::auth/pages/password-reset/reset-password.heading'); }
    formSchema(schema: Schema): Schema {
        return schema.components([
            TextInput.make('email').label(t('filament-panels::auth/pages/password-reset/reset-password.form.email.label')).disabled().autofocus(),
            passwordRules('passwordConfirmation', 'password confirmation').reduce((input, rule) => input.rule(rule), TextInput.make('password').label(t('filament-panels::auth/pages/password-reset/reset-password.form.password.label')).password().autocomplete('new-password').revealable().required()),
            TextInput.make('passwordConfirmation').label(t('filament-panels::auth/pages/password-reset/reset-password.form.password_confirmation.label')).password().autocomplete('new-password').revealable().required().dehydrated(false),
        ]);
    }
    contentSchema(schema: Schema): Schema {
        return schema.components(formContent('resetPassword', [Action.make('resetPassword').label(t('filament-panels::auth/pages/password-reset/reset-password.form.actions.reset.label')).submit('resetPassword')], { before: PanelsRenderHook.AUTH_PASSWORD_RESET_RESET_FORM_BEFORE, after: PanelsRenderHook.AUTH_PASSWORD_RESET_RESET_FORM_AFTER }));
    }
    async resetPassword(): Promise<void> {
        const { req, panel } = this._ctx as PanelContext;
        const wait = passwordResetThrottle.hit(`${panel.getId()}:reset:${req.ip ?? ''}`);
        if (wait > 0) { throttled('filament-panels::auth/pages/password-reset/reset-password', wait); return; }
        this._errors = await validateSchema(this.getSchema('form'));
        if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        const auth = panel.getAuth();
        const payload = panel.readResetPasswordToken(this.token);
        const user = payload ? await auth.find(payload.uid) : null;
        // The token identifies the user; the URL's email must be theirs and their password must not have changed since the link was sent.
        if (!payload || !user || user.email !== this.email || (await auth.getPasswordFingerprint!(user)) !== payload.fp) {
            Notification.make().danger().title('This password reset token is invalid.').send();
            return;
        }
        await auth.update!(user, { password: this.password });
        Notification.make().success().title('Your password has been reset.').send();
        this.redirect(panel.getLoginUrl());
    }
}

/** Email verification prompt, with a "Resend it." link. */
export class EmailVerificationPrompt extends SimplePage {
    static callable = ['mountAction'];
    async mount(): Promise<void> {
        const { panel, user } = this._ctx as PanelContext;
        if (!user || !(await panel.mustVerifyEmail(user))) this.redirect(panel.getUrl());
    }
    getTitle(): string { return t('filament-panels::auth/pages/email-verification/email-verification-prompt.title'); }
    getHeading(): string { return t('filament-panels::auth/pages/email-verification/email-verification-prompt.heading'); }
    contentSchema(schema: Schema): Schema {
        const { user } = this._ctx as PanelContext;
        const expression = `mountAction('resendNotification')`;
        const link = `<button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-link-action', 'fi-link', 'fi-size-sm', ...sharedColors.getComponentClasses('link', 'primary')].join(' ')}" wire:click="${e(expression)}" >${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': expression }), 'sm')}<span class="fi-link-label"> ${e(t('filament-panels::auth/pages/email-verification/email-verification-prompt.actions.resend_notification.label'))}. </span></button>`;
        const text = (html: string) => Html.make(`<span class="fi-sc-text" > ${html} </span>`);
        return schema.components([
            text(e(t('filament-panels::auth/pages/email-verification/email-verification-prompt.messages.notification_sent', { email: user?.email ?? '' }))),
            text(`${e(t('filament-panels::auth/pages/email-verification/email-verification-prompt.messages.notification_not_received'))} ${link}`),
        ]);
    }
    /** The page's only action: resend the email (at most twice per minute). */
    async mountAction(name: unknown): Promise<void> {
        const { req, panel, user } = this._ctx as PanelContext;
        if (name !== 'resendNotification' || !user) throw new WireError(404, 'Action not found.');
        this.skipRender();
        const wait = verificationThrottle.hit(`${panel.getId()}:verify:${user.id}`);
        if (wait > 0) {
            Notification.make().danger().title(t('filament-panels::auth/pages/email-verification/email-verification-prompt.notifications.notification_resend_throttled.title', { seconds: wait, minutes: Math.ceil(wait / 60) })).body(t('filament-panels::auth/pages/email-verification/email-verification-prompt.notifications.notification_resend_throttled.body', { seconds: wait, minutes: Math.ceil(wait / 60) })).send();
            return;
        }
        if (await panel.mustVerifyEmail(user)) await sendVerificationEmail(panel, req, user);
        Notification.make().success().title(t('filament-panels::auth/pages/email-verification/email-verification-prompt.notifications.notification_resent.title')).send();
    }
}

/** User profile page: name, email, new password. The current password is required to change the email or password. */
export class EditProfile extends SimplePage {
    static callable = ['save', 'callSchemaComponentMethod'];
    static slug = 'profile';
    data: Record<string, unknown> = {};
    static getLabel(): string { return t('filament-panels::auth/pages/edit-profile.label'); }
    async mount(): Promise<void> {
        const { user } = this._ctx as PanelContext;
        if (!user) throw new WireError(401, 'Unauthenticated.');
        this.data = { name: user.name, email: user.email, password: null, passwordConfirmation: null, currentPassword: null };
    }
    async boot(): Promise<void> { if (!(this._ctx as PanelContext | null)?.user) throw new WireError(401, 'Unauthenticated.'); }
    getTitle(): string { return (this.constructor as typeof EditProfile).getLabel(); }
    hasLogo(): boolean { return false; }
    formSchema(schema: Schema): Schema {
        const { panel, user } = this._ctx as PanelContext;
        const auth = panel.getAuth();
        return schema.operation('edit').components([
            TextInput.make('name').label(t('filament-panels::auth/pages/edit-profile.form.name.label')).required().maxLength(255).autofocus(),
            TextInput.make('email').label(t('filament-panels::auth/pages/edit-profile.form.email.label')).email().required().maxLength(255).live()
                .rule({ name: 'unique', passes: async (value) => { const other = await auth.findByEmail?.(String(value)); return !other || String(other.id) === String(user?.id); }, message: (attribute) => `The ${attribute} has already been taken.` }),
            passwordRules('passwordConfirmation', 'password confirmation').reduce((input, rule) => input.rule(rule), TextInput.make('password').label(t('filament-panels::auth/pages/edit-profile.form.password.label')).password().revealable().autocomplete('new-password').live()),
            TextInput.make('passwordConfirmation').label(t('filament-panels::auth/pages/edit-profile.form.password_confirmation.label')).password().autocomplete('new-password').revealable().required()
                .visible(({ get }) => !blankValue(get('password'))).dehydrated(false),
            TextInput.make('currentPassword').label(t('filament-panels::auth/pages/edit-profile.form.current_password.label')).helperText(t('filament-panels::auth/pages/edit-profile.form.current_password.below_content'))
                .password().autocomplete('current-password').revealable().required()
                .rule({ name: 'current_password', passes: async (value) => Boolean(user && (await auth.attempt(user.email, String(value)))), message: () => 'The password is incorrect.' })
                .visible(({ get }) => !blankValue(get('password')) || get('email') !== user?.email).dehydrated(false),
        ]);
    }
    contentSchema(schema: Schema): Schema {
        return schema.components(formContent('save', [
            Action.make('save').label(t('filament-panels::auth/pages/edit-profile.form.actions.save.label')).submit('save').keyBindings(['mod+s']),
            Action.make('back').label(t('filament-panels::auth/pages/edit-profile.actions.cancel.label')).color('gray').alpineClickHandler(`document.referrer ? window.history.back() : (window.location.href = ${JSON.stringify(this.panel.getUrl())})`),
        ], { fullWidth: false, alignment: 'start' }));
    }
    async save(): Promise<void> {
        const { panel, user } = this._ctx as PanelContext;
        if (!user) throw new WireError(401, 'Unauthenticated.');
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        const data = await getSchemaState(form);
        await panel.getAuth().update!(user, { name: String(data.name), email: String(data.email), password: blankValue(data.password) ? undefined : String(data.password) });
        this.data = { ...this.data, password: null, passwordConfirmation: null, currentPassword: null };
        Notification.make().success().title(t('filament-panels::auth/pages/edit-profile.notifications.saved.title')).send();
    }
}
const blankValue = (value: unknown) => value === null || value === undefined || value === '';

/** Tenant registration page: the subclass provides its label and form (`formSchema`). */
export abstract class RegisterTenant extends SimplePage {
    static callable = ['register', 'callSchemaComponentMethod'];
    static slug = 'new';
    data: Record<string, unknown> = {};
    static getLabel(): string { return 'Register tenant'; }
    /** Whether tenants can be created; by default, if the tenant provider implements `create`. */
    static canView(panel: Panel, _user: User): boolean | Promise<boolean> { return typeof panel.getTenantProvider().create === 'function'; }
    async boot(): Promise<void> {
        const ctx = this._ctx as PanelContext | null;
        if (!ctx?.user) throw new WireError(401, 'Unauthenticated.');
        if (!(await (this.constructor as typeof RegisterTenant).canView(ctx.panel, ctx.user))) throw new WireError(404, 'Not Found');
    }
    mount(): void { fillSchema(this.getSchema('form'), this.data); }
    getTitle(): string { return (this.constructor as typeof RegisterTenant).getLabel(); }
    hasLogo(): boolean { return false; }
    formSchema(schema: Schema): Schema { return schema; }
    contentSchema(schema: Schema): Schema {
        return schema.components(formContent('register', [Action.make('register').label((this.constructor as typeof RegisterTenant).getLabel()).submit('register')]));
    }
    protected mutateFormDataBeforeRegister(data: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> { return data; }
    protected handleRegistration(data: Record<string, unknown>): unknown {
        const { panel, user } = this._ctx as PanelContext;
        return panel.getTenantProvider().create!(data, user!);
    }
    async register(): Promise<void> {
        const { panel } = this._ctx as PanelContext;
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        const tenant = await this.handleRegistration(await this.mutateFormDataBeforeRegister(await getSchemaState(form)));
        this.redirect(panel.getUrl('', tenant));
    }
}

/** Current tenant's profile page, in the full layout. */
export abstract class EditTenantProfile extends Page {
    static callable = [...Page.callable, 'save'];
    static slug = 'profile';
    static shouldRegisterNavigation = false;
    data: Record<string, unknown> = {};
    static getLabel(): string { return 'Tenant profile'; }
    static getTitle(): string { return this.getLabel(); }
    protected isAccessAuthorized(ctx: PanelContext): boolean | Promise<boolean> { return ctx.tenant !== undefined && ctx.tenant !== null && typeof ctx.panel.getTenantProvider().update === 'function'; }
    mount(): void {
        const tenant = this.panel.getTenant();
        fillSchemaFromRecord(this.getSchema('form'), this.data, tenant ?? {});
    }
    formSchema(schema: Schema): Schema { return schema; }
    contentSchema(schema: Schema): Schema {
        return schema.components(formContent('save', [Action.make('save').label(t('filament-panels::pages/tenancy/edit-tenant-profile.form.actions.save.label')).submit('save').keyBindings(['mod+s'])], { fullWidth: false, alignment: 'start' }));
    }
    async save(): Promise<void> {
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        await this.panel.getTenantProvider().update!(this.panel.getTenant(), await getSchemaState(form));
        Notification.make().success().title(t('filament-panels::pages/tenancy/edit-tenant-profile.notifications.saved.title')).send();
    }
}

export class Login extends SimplePage {
    static callable = ['authenticate', 'callSchemaComponentMethod'];
    data: Record<string, unknown> = {};

    mount(): void { fillSchema(this.getSchema('form'), this.data); }
    getTitle(): string { return t('filament-panels::auth/pages/login.title'); }
    getHeading(): string { return t('filament-panels::auth/pages/login.heading'); }
    getSubheading(): string | null {
        if (!this.panel.hasRegistration()) return null;
        return `${e(t('filament-panels::auth/pages/login.actions.register.before'))} ${authLink(this.panel.getRegistrationUrl(), t('filament-panels::auth/pages/login.actions.register.label'))}`;
    }

    formSchema(schema: Schema): Schema {
        return schema.components([
            TextInput.make('email').label(t('filament-panels::auth/pages/login.form.email.label')).email().required().autocomplete().autofocus(),
            TextInput.make('password').label(t('filament-panels::auth/pages/login.form.password.label'))
                .hint(this.panel.hasPasswordReset() ? new HtmlString(`<a href="${e(this.panel.getRequestPasswordResetUrl())}" class="${[...sharedColors.getComponentClasses('link', 'primary'), 'fi-link', 'fi-size-md'].join(' ')}" tabindex="-1" ><span class="fi-link-label"> ${e(t('filament-panels::auth/pages/login.actions.request_password_reset.label'))} </span></a>`) : null)
                .password().revealable().autocomplete('current-password').required(),
            Checkbox.make('remember').label(t('filament-panels::auth/pages/login.form.remember.label')),
        ]);
    }
    contentSchema(schema: Schema): Schema {
        return schema.components([
            RenderHook.make(PanelsRenderHook.AUTH_LOGIN_FORM_BEFORE),
            Form.make([EmbeddedSchema.make('form')]).id('form').livewireSubmitHandler('authenticate')
                .footer([Actions.make([Action.make('authenticate').label(t('filament-panels::auth/pages/login.form.actions.authenticate.label')).submit('authenticate')]).fullWidth().key('form-actions')]),
            // Multi-factor challenge form: hidden until MFA is implemented.
            Form.make([]).id('multiFactorChallengeForm').hidden(),
            RenderHook.make(PanelsRenderHook.AUTH_LOGIN_FORM_AFTER),
        ]);
    }

    async authenticate(): Promise<void> {
        this._errors = await validateSchema(this.getSchema('form'));
        if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        const { req, res, panel } = this._ctx as PanelContext;
        // Five attempts per minute per IP address, then wait.
        const wait = loginThrottle.hit(`${panel.getId()}:${req.ip ?? ''}`);
        if (wait > 0) {
            Notification.make().danger().title(t('filament-actions::notifications.throttled.title', { seconds: wait, minutes: Math.ceil(wait / 60) })).body(t('filament-actions::notifications.throttled.body', { seconds: wait, minutes: Math.ceil(wait / 60) })).send();
            return;
        }
        const user = await panel.getAuth().attempt(String(this.data.email), String(this.data.password));
        // As in Filament: a valid account that may not use this panel gets the same message as wrong credentials.
        if (!user || !(await panel.userCanAccess(user))) { this.addError('data.email', t('filament-panels::auth/pages/login.messages.failed')); return; }
        loginThrottle.clear(`${panel.getId()}:${req.ip ?? ''}`);
        panel.logIn(res, user, Boolean(this.data.remember));
        this.redirect(panel.getUrl());
    }
}

/** Whether the host component's user has this ability on the component's resource (or relation manager). Use it in your actions' `authorize()`. */
export const can = (livewire: unknown, ability: string, record: unknown = null): Promise<boolean> | boolean => canOn(livewire, ability, record);
function canOn(livewire: any, ability: string, record: unknown = null): Promise<boolean> | boolean {
    const resource = livewire?.resource;
    return typeof resource?.can === 'function' ? resource.can(ability, livewire._ctx?.user ?? null, record) : true;
}



const plural = (s: string) => (/[^aeiou]y$/.test(s) ? s.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/.test(s) ? s + 'es' : s + 's');
const ucfirst = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** Resource: a model with its pages, table and navigation. */
export abstract class Resource {
    static panel: Panel;
    static slug = '';
    static modelLabel = 'record';
    static pluralModelLabel: string | null = null;
    static navigationIcon: string | null = null;
    static navigationGroup: string | null = null;
    static navigationSort = 0;
    static navigationBadge: string | number | null = null;
    static adapter: DataAdapter;
    /** In a multi-tenant panel, whether records belong to each tenant (`true` by default). */
    static isScopedToTenant = true;
    /** Tenant column for this resource (defaults to the panel's: `panel.tenant(provider, { ownershipColumn })`). */
    static tenantOwnershipColumn: string | null = null;
    /**
     * Resource pages; replace them with your subclasses to change their behavior:
     * `static pages = { index: MyList, create: MyCreate, edit: MyEdit }`.
     */
    static pages: { index?: typeof ListRecords; create?: typeof CreateRecord; edit?: typeof EditRecord; view?: typeof ViewRecord } = {};
    /** `true` adds a view page (`ViewRecord`) to the resource; table rows then link to it. */
    static hasViewPage = false;
    /** Who can do what on this resource. Without a policy, any signed-in user can do everything. */
    static policy: Policy | null = null;
    /** Whether the user has this ability (on this record, if any). */
    static can(ability: string, user: User | null, record: unknown = null): Promise<boolean> {
        const rule = this.policy?.[ability];
        return this.panel.authorize(user, ability, { resource: this, record, rule: rule ? () => rule(user!, record) : null });
    }
    /** Resource widgets, registered as components. */
    static widgets: (typeof Widget)[] = [];
    /** Widgets shown above the table on the list page. */
    static headerWidgets: (typeof Widget)[] = [];
    /** Relation managers shown below the edit form. */
    static relations: any[] = [];
    /** Tabs of the list page. */
    static tabs(): Record<string, Tab> { return {}; }
    /** Simple resource: a single page, with create and edit in modals. */
    static isSimple = false;

    static getPluralModelLabel(): string { return this.pluralModelLabel ?? plural(this.modelLabel); }
    static getTitleCasePluralModelLabel(): string { return this.getPluralModelLabel().split(' ').map(ucfirst).join(' '); }
    static getUrl(page: string = 'index', record?: string | number): string {
        const base = this.panel.getUrl(this.slug);
        if (page in this.relatedPages) return `${base}/${record}/${page}`;
        return page === 'index' ? base : page === 'create' ? `${base}/create` : page === 'view' ? `${base}/${record}` : `${base}/${record}/edit`;
    }
    /** Related records pages: `{ comments: ManagePostComments }` is served at `<slug>/{record}/comments`. */
    static relatedPages: Record<string, typeof ManageRelatedRecords> = {};
    /** Pages listed in a record's sub-navigation, in order: `['view', 'edit', 'comments']`. Empty: no sub-navigation. */
    static recordSubNavigation: string[] = [];
    /** Record sub-navigation: one tab per declared page, the current page's tab active. */
    static getRecordSubNavigation(page: { getRecordKey(): string | null; constructor: Function }): SubNavigationItem[] {
        const pages = this.getPages() as Record<string, typeof Page>;
        const key = page.getRecordKey() ?? '';
        return this.recordSubNavigation.filter((name) => name in pages).map((name) => {
            const related = this.relatedPages[name];
            return {
                label: related ? related.getNavigationLabel() : name === 'view' ? t('filament-panels::resources/pages/view-record.navigation_label') : t('filament-panels::resources/pages/edit-record.navigation_label'),
                icon: related ? (related.navigationIcon ?? 'o-rectangle-stack') : name === 'view' ? 'o-eye' : 'o-pencil-square',
                url: this.getUrl(name, key),
                active: page instanceof (this.getRegisteredPage(name) as any),
            };
        });
    }
    private static _registered = new WeakMap<object, Record<string, typeof Page>>();
    /** Page class actually registered under a name (pages are generated once per resource). */
    static getRegisteredPage(name: string): typeof Page | undefined { return (this.getPages() as Record<string, typeof Page>)[name]; }
    static table(table: Table): Table { return table; }
    static form(schema: Schema): Schema { return schema; }
    /** Schema of the view page. */
    static infolist(schema: Schema): Schema { return schema; }

    // -------------------------------------------------------------- global search
    /** Columns searched by global search; defaults to the title attribute. Empty array: the resource is not searchable. */
    static globallySearchableAttributes: string[] | null = null;
    static getGloballySearchableAttributes(): string[] { return this.globallySearchableAttributes ?? (this.recordTitleAttribute ? [this.recordTitleAttribute] : []); }
    static canGloballySearch(): boolean { return this.getGloballySearchableAttributes().length > 0; }
    /** Position of this resource's group in the results; without one, after the others in registration order. */
    static globalSearchSort: number | null = null;
    /** Maximum results rendered per resource. */
    static globalSearchResultsLimit = 50;
    static getGlobalSearchResultTitle(record: any): string { return this.getRecordTitle(record); }
    /** Details shown under the title: `{ Author: 'Jane' }`. Empty values are skipped. */
    static getGlobalSearchResultDetails(_record: any): Record<string, unknown> | Promise<Record<string, unknown>> { return {}; }
    /** URL of a result: the view page, otherwise the edit page; for a simple resource, the list with the action open. `null` if the user has no access. */
    static async getGlobalSearchResultUrl(record: any, user: User | null): Promise<string | null> {
        const key = this.adapter.getKey(record);
        const canView = await this.can('view', user, record);
        if (this.hasViewPage && canView) return this.getUrl('view', key);
        const canEdit = await this.can('update', user, record);
        if (!this.isSimple && canEdit) return this.getUrl('edit', key);
        const action = canView ? 'view' : canEdit ? 'edit' : null;
        return action ? `${this.getUrl('index')}?tableAction=${action}&tableActionRecord=${encodeURIComponent(key)}` : null;
    }
    static async getGlobalSearchResults(search: string, user: User | null): Promise<GlobalSearchResult[]> {
        const page = await this.adapter.paginate({ search, searchColumns: this.getGloballySearchableAttributes(), page: 1, perPage: Math.min(Math.max(this.globalSearchResultsLimit, 1), 200) });
        const results: GlobalSearchResult[] = [];
        for (const record of page.records) {
            const url = await this.getGlobalSearchResultUrl(record, user);
            if (url === null) continue;
            const details: Record<string, string> = {};
            for (const [label, value] of Object.entries(await this.getGlobalSearchResultDetails(record))) if (value !== null && value !== undefined && value !== '') details[label] = String(value);
            results.push({ title: this.getGlobalSearchResultTitle(record), url, details });
        }
        return results;
    }

    /** Attribute used as a record's title. */
    static recordTitleAttribute: string | null = null;
    /** Without a title attribute: the model label in title case ("Leave Request"). */
    static getRecordTitle(record: any): string { return this.recordTitleAttribute ? String(record?.[this.recordTitleAttribute] ?? '') : this.modelLabel.split(' ').map(ucfirst).join(' '); }

    /** Generated resource pages: list, create, edit. */
    static getPages(): Record<string, typeof Page> {
        const known = Resource._registered.get(this);
        if (known) return known;
        const pages = this.buildPages();
        Resource._registered.set(this, pages);
        return pages;
    }
    private static buildPages(): Record<string, typeof Page> {
        const resource = this as unknown as typeof Resource;
        const List = class extends (resource.pages.index ?? ListRecords) {
            static resource = resource;
            static slug = resource.slug;
            static title = resource.getTitleCasePluralModelLabel();
            static navigationIcon = resource.navigationIcon;
            static navigationGroup = resource.navigationGroup;
            static navigationSort = resource.navigationSort;
            static navigationBadge = resource.navigationBadge;
            static getNavigationBadge = typeof (resource as any).getNavigationBadge === 'function' ? () => (resource as any).getNavigationBadge() : undefined;
        };
        const Create = class extends (resource.pages.create ?? CreateRecord) {
            static resource = resource;
            static slug = `${resource.slug}/create`;
            static shouldRegisterNavigation = false;
        };
        const Edit = class extends (resource.pages.edit ?? EditRecord) {
            static resource = resource;
            static slug = `${resource.slug}/{record}/edit`;
            static shouldRegisterNavigation = false;
        };
        if (resource.isSimple) return { index: List };
        const related: Record<string, typeof Page> = {};
        for (const [name, RelatedPage] of Object.entries(resource.relatedPages)) {
            related[name] = class extends RelatedPage {
                static parentResource = resource;
                static slug = `${resource.slug}/{record}/${name}`;
                static shouldRegisterNavigation = false;
            } as unknown as typeof Page;
        }
        if (!resource.hasViewPage) return { index: List, create: Create, edit: Edit, ...related };
        const View = class extends (resource.pages.view ?? ViewRecord) {
            static resource = resource;
            static slug = `${resource.slug}/{record}`;
            static shouldRegisterNavigation = false;
        };
        return { index: List, create: Create, edit: Edit, view: View, ...related };
    }
}

/** Sub-navigation tab of a page. */
export type SubNavigationItem = { label: string; icon: string | null; url: string; active: boolean };
type ColumnSpan = number | 'full';
/** Widget: a component displayed in a page's widget grid. */
export abstract class Widget extends Component {
    static componentName: string;
    /** Width in the widget grid: a number of columns, or `'full'`. */
    static columnSpan: ColumnSpan = 1;
    /** Loaded when it becomes visible. */
    static isLazy = true;
    get panel(): Panel { return (this._ctx as PanelContext).panel; }
    /** Restricts the widget to some users: returning `false` removes it from the page and refuses to load it. */
    static canView(_user: User): boolean | Promise<boolean> { return true; }
    async boot(): Promise<void> {
        const ctx = this._ctx as PanelContext | null;
        if (!ctx?.user) throw new WireError(401, 'Unauthenticated.');
        const WidgetClass = this.constructor as typeof Widget;
        if (!(await ctx.panel.authorize(ctx.user, 'view', { widget: WidgetClass, rule: () => WidgetClass.canView(ctx.user!) }))) throw new WireError(403, 'Forbidden.');
    }
    /** Grid column classes and style, at the `lg` breakpoint. */
    protected gridColumn(): { classes: string[]; style: string } {
        const span = (this.constructor as typeof Widget).columnSpan;
        // The span is always written, even for a single column.
        return { classes: ['fi-grid-col', 'lg:fi-grid-col-span'], style: `--col-span-lg: ${span === 'full' ? '1 / -1' : `span ${Math.floor(span)} / span ${Math.floor(span)}`};` };
    }
    placeholder(): string {
        const column = this.gridColumn();
        return `<div role="status" aria-busy="true" style="height: 8rem; ${column.style}" class="${cls(['fi-section', 'fi-loading-section', ...column.classes])}"><span class="fi-sr-only">${e(t('filament::components/loading-section.label'))}</span></div>`;
    }
    /** Common widget wrapper. */
    protected wrap(content: string, classes: string[] = []): string {
        const column = this.gridColumn();
        return `<div${column.style ? ` style="${column.style}"` : ''} class="${cls(['fi-wi-widget', ...column.classes, ...classes])}">${content}</div>`;
    }
}

/**
 * Calendar widget: month, week and list views, server-rendered navigation, no JavaScript library.
 *
 * Minimal use: extend the class and return the events of the displayed period.
 *
 *     class LeaveCalendar extends CalendarWidget {
 *         static heading = 'Leave';
 *         async getEvents({ start, end }) { return [{ id: 1, title: 'Ada — vacation', start: '2026-11-12', end: '2026-11-14', color: 'success' }]; }
 *     }
 *
 * Everything else can be overridden method by method: available views, first day of the week, locale, labels, events
 * per cell, day clicks (`onDateClick`) and event clicks (`onEventClick`), event rendering (`renderEvent`), cell footer
 * (`renderDayFooter`), toolbar buttons (`renderToolbarEnd`), and appearance through the `.nv-cal` CSS variables
 * (`getExtraClasses`, `getStyle`).
 */
export abstract class CalendarWidget extends Widget {
    static columnSpan: ColumnSpan = 'full';
    /** Heading shown before the period ("Leave — November 2026"). */
    static heading: string | null = null;
    static callable = ['previousPeriod', 'nextPeriod', 'goToToday', 'setView', 'selectDate', 'selectEvent', 'showDay'];
    /** View and date only change through the methods below, which validate them. */
    static locked = ['view', 'date'];
    view: CalendarView = 'month';
    /** Anchor date (`YYYY-MM-DD`): the displayed month or week contains it. Empty: today. */
    date = '';

    // ---------------------------------------------------------- overridable
    /** Events overlapping `start`–`end` (inclusive, `YYYY-MM-DD`). Called on every render: filter in the database. */
    abstract getEvents(range: { start: string; end: string; view: CalendarView }): CalendarEvent[] | Promise<CalendarEvent[]>;
    /** Available views; the first is the initial one. With a single view, the switcher is hidden. */
    getViews(): CalendarView[] { return ['month', 'week', 'list']; }
    /** 0 = Sunday, 1 = Monday… */
    getFirstDayOfWeek(): number { return 1; }
    /** Locale for month and day names (`Intl`). */
    getLocale(): string { return 'en-US'; }
    getLabels(): CalendarLabels { return CALENDAR_LABELS; }
    /** In month view, beyond this number the cell shows "+N more" (which opens the list on that day). */
    getMaxEventsPerDay(): number { return 3; }
    getHeading(): string | null { return (this.constructor as typeof CalendarWidget).heading; }
    /** Today's date, `YYYY-MM-DD` (UTC by default; override for another time zone). */
    getToday(): string { return new Date().toISOString().slice(0, 10); }
    /** Click on a day number. Overriding this makes days clickable: open a page (`this.redirect`), notify, switch view… */
    onDateClick(_date: string): void | Promise<void> {}
    /** Click on an event without a URL. The event is reloaded server-side, so `event.extra` is available. */
    onEventClick(_event: CalendarEvent): void | Promise<void> {}
    /** Already-escaped HTML for an event, or `null` for the default rendering (`renderCalendarEvent`). */
    renderEvent(_event: CalendarEvent, _context: { day: string; view: CalendarView }): string | null { return null; }
    /** Already-escaped HTML appended to the bottom of each cell. */
    renderDayFooter(_day: string, _events: CalendarEvent[]): string { return ''; }
    /** Already-escaped HTML at the end of the toolbar: a "New" link, a filter… */
    renderToolbarEnd(): string { return ''; }
    /** Extra classes on the calendar, to hook your styles or override its CSS variables. */
    getExtraClasses(): string[] { return []; }
    /** CSS variables set on the calendar: `{ '--nv-cal-day-min-height': '9rem' }`. */
    getStyle(): Record<string, string> { return {}; }

    // ---------------------------------------------------------- navigation
    private anchor(): string { return isDate(this.date) ? this.date : this.getToday(); }
    private currentView(): CalendarView { const views = this.getViews().filter((view) => CALENDAR_VIEWS.includes(view)); return views.includes(this.view) ? this.view : (views[0] ?? 'month'); }
    private shift(direction: 1 | -1): void { this.date = this.currentView() === 'week' ? addDays(this.anchor(), 7 * direction) : addMonths(this.anchor().slice(0, 8) + '01', direction); }
    previousPeriod(): void { this.shift(-1); }
    nextPeriod(): void { this.shift(1); }
    goToToday(): void { this.date = this.getToday(); }
    setView(view: unknown): void { if (typeof view === 'string' && (this.getViews() as string[]).includes(view) && (CALENDAR_VIEWS as string[]).includes(view)) this.view = view as CalendarView; }
    /** "+N more": the list view anchored on that day (or the week view if list is not available). */
    showDay(date: unknown): void {
        if (!isDate(date)) return;
        this.date = date;
        const views = this.getViews();
        this.view = views.includes('list') ? 'list' : views.includes('week') ? 'week' : this.currentView();
    }
    private datesClickable(): boolean { return this.onDateClick !== CalendarWidget.prototype.onDateClick; }
    private eventsClickable(): boolean { return this.onEventClick !== CalendarWidget.prototype.onEventClick; }
    async selectDate(date: unknown): Promise<void> { if (isDate(date) && this.datesClickable()) await this.onDateClick(date); }
    /** The id comes from the browser: the event is looked up among those of the displayed period, never trusted as-is. */
    async selectEvent(id: unknown): Promise<void> {
        if ((typeof id !== 'string' && typeof id !== 'number') || !this.eventsClickable()) return;
        const view = this.currentView();
        const event = (await this.getEvents({ ...visibleRange(view, this.anchor(), this.getFirstDayOfWeek()), view })).find((candidate) => String(candidate.id) === String(id));
        if (event) await this.onEventClick(event);
    }

    async render(): Promise<string> {
        const view = this.currentView();
        this.view = view;
        const anchor = this.anchor();
        const firstDay = ((Math.floor(this.getFirstDayOfWeek()) % 7) + 7) % 7;
        const events = await this.getEvents({ ...visibleRange(view, anchor, firstDay), view });
        const calendar = renderCalendar({
            heading: this.getHeading(), view, views: this.getViews().filter((candidate) => CALENDAR_VIEWS.includes(candidate)), anchor, today: this.getToday(), firstDay, locale: this.getLocale(), events,
            maxEventsPerDay: this.getMaxEventsPerDay(), datesClickable: this.datesClickable(), eventsClickable: this.eventsClickable(), labels: this.getLabels(),
            renderEvent: (event, context) => this.renderEvent(event, context), renderDayFooter: (day, dayEvents) => this.renderDayFooter(day, dayEvents), toolbarEnd: this.renderToolbarEnd(),
        });
        const extra = this.getExtraClasses().filter((name) => /^[A-Za-z0-9_:-]+$/.test(name));
        const style = Object.entries(this.getStyle()).filter(([name, value]) => /^--[a-z0-9-]+$/.test(name) && /^[^;{}<>]+$/.test(value)).map(([name, value]) => `${name}: ${value};`).join(' ');
        const decorated = calendar.replace('<div class="nv-cal ', `<div${style ? ` style="${e(style)}"` : ''} class="nv-cal ${extra.length ? `${extra.join(' ')} ` : ''}`);
        return this.wrap(widgetSection(decorated), ['nv-wi-calendar']);
    }
}

/**
 * Calendar page: the same calendar as `CalendarWidget`, on a full page, with actions — so modals, forms,
 * confirmations and slide-overs.
 *
 *     class Planning extends CalendarPage {
 *         static slug = 'planning';
 *         async getEvents({ start, end }) { return db('shifts').where('day', '>=', start).where('day', '<=', end)… }
 *         // Day click: a modal with a form, prefilled with the date.
 *         dateAction() {
 *             return Action.make('createShift').modalHeading('New shift')
 *                 .schema([Select.make('employee_id').options(…).required(), DatePicker.make('day').required()])
 *                 .fillForm(({ arguments: args }) => ({ day: CalendarPage.dateOf(args) }))
 *                 .action(async ({ data }) => { await db('shifts').insert(data); Notification.make().success().title('Saved').send(); });
 *         }
 *         // Event click: another action; the event is reloaded server-side.
 *         eventAction() {
 *             return Action.make('editShift').schema([…])
 *                 .fillForm(async ({ livewire, arguments: args }) => (await livewire.findEvent(args.event))?.extra ?? {})
 *                 .action(async ({ livewire, arguments: args, data }) => { const event = await livewire.findEvent(args.event); if (event) await db('shifts').where({ id: event.id }).update(data); });
 *         }
 *     }
 *
 * Three ways to handle a click: a **URL** on the event (`url`: dedicated page), an **action** (modal),
 * or **custom code** by overriding `onDateClick()` / `onEventClick()` (redirect, notify, write to the database, mount any
 * action with `this.mountAction(name, arguments)`). `getHeaderActions()` adds buttons to the page header, and
 * `getCalendarActions()` declares other actions mountable from your own rendering (`renderEvent`, `renderToolbarEnd`).
 */
export abstract class CalendarPage extends Page {
    static callable = ['mountAction', 'unmountAction', 'callMountedAction', 'callSchemaComponentMethod', 'previousPeriod', 'nextPeriod', 'goToToday', 'setView', 'selectDate', 'selectEvent', 'showDay'];
    static locked = ['view', 'date'];
    view: CalendarView = 'month';
    date = '';

    // ---------------------------------------------------------- overridable (same settings as CalendarWidget)
    abstract getEvents(range: { start: string; end: string; view: CalendarView }): CalendarEvent[] | Promise<CalendarEvent[]>;
    getViews(): CalendarView[] { return ['month', 'week', 'list']; }
    getFirstDayOfWeek(): number { return 1; }
    getLocale(): string { return 'en-US'; }
    getLabels(): CalendarLabels { return CALENDAR_LABELS; }
    getMaxEventsPerDay(): number { return 3; }
    getCalendarHeading(): string | null { return null; }
    getToday(): string { return new Date().toISOString().slice(0, 10); }
    renderEvent(_event: CalendarEvent, _context: { day: string; view: CalendarView }): string | null { return null; }
    renderDayFooter(_day: string, _events: CalendarEvent[]): string { return ''; }
    renderToolbarEnd(): string { return ''; }
    getExtraClasses(): string[] { return []; }
    getStyle(): Record<string, string> { return {}; }
    /** Action opened on day click; it receives `arguments.date`. `null`: days are not clickable (unless `onDateClick` is overridden). */
    dateAction(): Action | null { return null; }
    /** Action opened on click on an event without a URL; it receives `arguments.event` (an id, to resolve with `findEvent`). */
    eventAction(): Action | null { return null; }
    /** Other actions mountable from your own HTML: `wire:click="mountAction('name', { … })"`. */
    getCalendarActions(): Action[] { return []; }
    /** Opens `dateAction()` by default. Override to do something else (e.g. redirect to a create page). */
    async onDateClick(date: string): Promise<void> { const action = this.dateAction(); if (action) await this.mountAction(action.getName(), { date }); }
    /** Opens `eventAction()` by default. The event has been resolved server-side before the call. */
    async onEventClick(event: CalendarEvent): Promise<void> { const action = this.eventAction(); if (action) await this.mountAction(action.getName(), { event: String(event.id) }); }

    /** Clicked date, read from an action's arguments. They come from the browser: only a valid date is returned. */
    static dateOf(args: Record<string, unknown> | null | undefined): string | null { return isDate(args?.date) ? (args!.date as string) : null; }
    /** Event of the displayed period with this id, or `null`. Never act on a received id without going through this. */
    async findEvent(id: unknown): Promise<CalendarEvent | null> {
        if (typeof id !== 'string' && typeof id !== 'number') return null;
        const view = this.currentView();
        return (await this.getEvents({ ...visibleRange(view, this.anchor(), this.firstDay()), view })).find((candidate) => String(candidate.id) === String(id)) ?? null;
    }
    protected async getMountableActions(context: Record<string, unknown>): Promise<Action[]> {
        return [...(await super.getMountableActions(context)), ...[this.dateAction(), this.eventAction(), ...this.getCalendarActions()].filter((action): action is Action => action !== null)];
    }

    // ---------------------------------------------------------- navigation
    private firstDay(): number { return ((Math.floor(this.getFirstDayOfWeek()) % 7) + 7) % 7; }
    private anchor(): string { return isDate(this.date) ? this.date : this.getToday(); }
    private currentView(): CalendarView { const views = this.getViews().filter((view) => CALENDAR_VIEWS.includes(view)); return views.includes(this.view) ? this.view : (views[0] ?? 'month'); }
    private shift(direction: 1 | -1): void { this.date = this.currentView() === 'week' ? addDays(this.anchor(), 7 * direction) : addMonths(this.anchor().slice(0, 8) + '01', direction); }
    previousPeriod(): void { this.shift(-1); }
    nextPeriod(): void { this.shift(1); }
    goToToday(): void { this.date = this.getToday(); }
    setView(view: unknown): void { if (typeof view === 'string' && (this.getViews() as string[]).includes(view) && (CALENDAR_VIEWS as string[]).includes(view)) this.view = view as CalendarView; }
    showDay(date: unknown): void {
        if (!isDate(date)) return;
        this.date = date;
        const views = this.getViews();
        this.view = views.includes('list') ? 'list' : views.includes('week') ? 'week' : this.currentView();
    }
    private datesClickable(): boolean { return this.dateAction() !== null || this.onDateClick !== CalendarPage.prototype.onDateClick; }
    private eventsClickable(): boolean { return this.eventAction() !== null || this.onEventClick !== CalendarPage.prototype.onEventClick; }
    async selectDate(date: unknown): Promise<void> { if (isDate(date) && this.datesClickable()) await this.onDateClick(date); }
    async selectEvent(id: unknown): Promise<void> {
        if (!this.eventsClickable()) return;
        const event = await this.findEvent(id);
        if (event) await this.onEventClick(event);
    }

    protected async renderContent(): Promise<string> {
        const view = this.currentView();
        this.view = view;
        const anchor = this.anchor();
        const events = await this.getEvents({ ...visibleRange(view, anchor, this.firstDay()), view });
        const calendar = renderCalendar({
            heading: this.getCalendarHeading(), view, views: this.getViews().filter((candidate) => CALENDAR_VIEWS.includes(candidate)), anchor, today: this.getToday(), firstDay: this.firstDay(), locale: this.getLocale(), events,
            maxEventsPerDay: this.getMaxEventsPerDay(), datesClickable: this.datesClickable(), eventsClickable: this.eventsClickable(), labels: this.getLabels(),
            renderEvent: (event, context) => this.renderEvent(event, context), renderDayFooter: (day, dayEvents) => this.renderDayFooter(day, dayEvents), toolbarEnd: this.renderToolbarEnd(),
        });
        const extra = this.getExtraClasses().filter((name) => /^[A-Za-z0-9_:-]+$/.test(name));
        const style = Object.entries(this.getStyle()).filter(([name, value]) => /^--[a-z0-9-]+$/.test(name) && /^[^;{}<>]+$/.test(value)).map(([name, value]) => `${name}: ${value};`).join(' ');
        return widgetSection(calendar.replace('<div class="nv-cal ', `<div${style ? ` style="${e(style)}"` : ''} class="nv-cal ${extra.length ? `${extra.join(' ')} ` : ''}`));
    }
}

/** Header-less section used by the built-in widgets. */
const widgetSection = (content: string) => `<section x-data="{
        isCollapsed:  false ,
    }" class="fi-section"><div class="fi-section-content-ctn"><div class="fi-section-content">${content}</div></div></section>`;

/** Signed-in user's account: avatar, name, logout. */
export class AccountWidget extends Widget {
    static isLazy = false;
    render(): string {
        const { req, res, panel, user } = this._ctx as PanelContext;
        const logout = t('filament-panels::widgets/account-widget.actions.logout.label');
        const loading = 'wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled"';
        return this.wrap(widgetSection(`<img alt="${e(t('filament-panels::layout.avatar.alt', { name: user!.name }))}" class="fi-avatar fi-circular fi-size-lg fi-user-avatar" src="${e(panel.getUserAvatarUrl(user!))}" loading="lazy" /><div class="fi-account-widget-main"><h2 class="fi-account-widget-heading">${e(t('filament-panels::widgets/account-widget.welcome'))}</h2><p class="fi-account-widget-user-name">${e(user!.name)}</p></div><form action="${e(panel.getLogoutUrl())}" method="post" class="fi-account-widget-logout-form"><input type="hidden" name="_token" value="${e(csrfToken(req, res))}" autocomplete="off"><button class="fi-icon-btn fi-size-md" title="${e(logout)}" aria-label="${e(logout)}" type="submit" ${loading}>${icon('m-arrow-left-end-on-rectangle')}</button><button class="fi-btn fi-size-md fi-labeled-from-sm" type="submit" ${loading}>${icon('m-arrow-left-end-on-rectangle')}${e(logout)}</button></form>`), ['fi-account-widget']);
    }
}

/** Navette version and useful links. */
export class NavetteInfoWidget extends Widget {
    static isLazy = false;
    static homeUrl = 'https://github.com/NavetteJS';
    static documentationUrl = 'https://github.com/NavetteJS';
    static githubUrl = 'https://github.com/NavetteJS';
    static version: string = JSON.parse(readFileSync(dir('../package.json'), 'utf8')).version;
    render(): string {
        const WidgetClass = this.constructor as typeof NavetteInfoWidget;
        const link = (url: string, iconHtml: string, label: string) => `<a href="${e(url)}" target="_blank" class="fi-link fi-size-md" rel="noopener noreferrer">${iconHtml}<span class="fi-link-label">${e(label)}</span></a>`;
        const github = '<span class="fi-icon fi-size-md"><svg viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" fill="currentColor" fill-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"></path></svg></span>';
        return this.wrap(widgetSection(`<div class="fi-filament-info-widget-main"><a href="${e(WidgetClass.homeUrl)}" rel="noopener noreferrer" target="_blank"><svg aria-label="Navette" fill="currentColor" role="img" viewBox="0 0 96 24" xmlns="http://www.w3.org/2000/svg" class="fi-filament-info-widget-logo"><text x="0" y="19" font-size="22" font-weight="700" letter-spacing="-0.5">Navette</text></svg></a><p class="fi-filament-info-widget-version">v${e(WidgetClass.version)}</p></div><div class="fi-filament-info-widget-links">${link(WidgetClass.documentationUrl, icon('m-book-open'), t('filament-panels::widgets/filament-info-widget.actions.open_documentation.label'))}${link(WidgetClass.githubUrl, github, t('filament-panels::widgets/filament-info-widget.actions.open_github.label'))}</div>`), ['fi-filament-info-widget']);
    }
}

/** Table properties a list page exposes to its widgets. */
const PAGE_TABLE_PROPERTIES = ['activeTab', 'paginators', 'tableColumnSearches', 'tableFilters', 'tableRecordsPerPage', 'tableSearch', 'tableSort'];

/** One stat of a StatsOverviewWidget. */
export class Stat {
    private _description: string | null = null;
    private _descriptionIcon: string | null = null;
    private _descriptionIconPosition: 'before' | 'after' = 'after';
    private _color: string | null = null;
    private _icon: string | null = null;
    private _chart: Record<string, number> | number[] | null = null;
    private _url: string | null = null;
    private label: string;
    private value: string | number | null;
    constructor(label: string, value: string | number | null) { this.label = label; this.value = value; }
    static make(label: string, value: string | number | null): Stat { return new Stat(label, value); }
    description(text: string | null): this { this._description = text; return this; }
    descriptionIcon(name: string | null, position: 'before' | 'after' = 'after'): this { this._descriptionIcon = name; this._descriptionIconPosition = position; return this; }
    /** Color of the description and chart. */
    color(color: string | null): this { this._color = color; return this; }
    icon(name: string | null): this { this._icon = name; return this; }
    /** Trend chart: a list of values, or values keyed by label. */
    chart(values: Record<string, number> | number[] | null): this { this._chart = values; return this; }
    url(url: string | null): this { this._url = url; return this; }
    hasChart(): boolean { return this._chart !== null; }
    toHtml(panel: Panel, key: string): string {
        const tag = this._url ? 'a' : 'div';
        const color = this._color ?? 'gray';
        const filled = this.value !== null && this.value !== undefined && this.value !== '';
        const descriptionIcon = this._descriptionIcon ? icon(this._descriptionIcon) : '';
        const description = this._description
            ? `<div class="${cls([...(color !== 'gray' ? panel.colors.getComponentClasses('stat-description', color) : []), 'fi-wi-stats-overview-stat-description'])}">${this._descriptionIconPosition === 'before' ? descriptionIcon : ''}<span>${e(this._description)}</span>${this._descriptionIconPosition === 'after' ? descriptionIcon : ''}</div>`
            : '';
        const chart = this._chart
            ? `<div x-data="{ statsOverviewStatChart() {} }"><div x-load x-load-src="${e(panel.assetUrl('js/filament/widgets/components/stats-overview/stat/chart.js'))}" wire:ignore x-data="statsOverviewStatChart({
                            key: ${e(js(key))},
                            labels: ${e(js(Array.isArray(this._chart) ? this._chart.map((_, i) => i) : Object.keys(this._chart)))},
                            values: ${e(js(Object.values(this._chart)))},
                        })" class="${cls([...(color !== 'gray' ? panel.colors.getComponentClasses('stat-chart', color) : []), 'fi-wi-stats-overview-stat-chart'])}"><canvas x-ref="canvas" aria-hidden="true"></canvas><span aria-hidden="true" x-ref="backgroundColorElement" class="fi-wi-stats-overview-stat-chart-bg-color"></span><span aria-hidden="true" x-ref="borderColorElement" class="fi-wi-stats-overview-stat-chart-border-color"></span></div></div>`
            : '';
        return `<${tag}${this._url ? ` href="${e(this._url)}"` : ''} class="fi-wi-stats-overview-stat"><div class="fi-wi-stats-overview-stat-content"><div class="fi-wi-stats-overview-stat-label-ctn">${this._icon ? icon(this._icon) : ''}<span class="fi-wi-stats-overview-stat-label">${e(this.label)}</span></div>${filled ? `<div class="fi-wi-stats-overview-stat-value">${e(String(this.value))}</div>` : '<div class="fi-wi-stats-overview-stat-placeholder"></div>'}${description}</div>${chart}</${tag}>`;
    }
}

/** A row of stats. */
export abstract class StatsOverviewWidget extends Widget {
    static columnSpan: ColumnSpan = 'full';
    /** Polling interval, or `null` to disable polling. */
    static pollingInterval: string | null = '5s';
    abstract getStats(): Stat[] | Promise<Stat[]>;
    /** Row columns: three, or four when the number of stats fits better. */
    protected getColumns(count: number): number { return count < 3 ? 3 : count % 3 !== 1 ? 3 : 4; }
    async render(): Promise<string> {
        const stats = await this.getStats();
        const columns = this.getColumns(stats.length);
        const anonymous = `x-data="filamentSchemaComponent(${e(js({ key: null, exposedMethods: [], path: '', containerPath: '' }))})"`;
        // A stat with a chart gets an id (`stats-overview-stat-<n>`), hence a component key; the others stay anonymous.
        const cells = stats.map((stat, index) => {
            if (!stat.hasChart()) return `<div ${anonymous} class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component">${stat.toHtml(this.panel, `${this.id}.stats.${index}`)}</div></div>`;
            const id = `stats-overview-stat-${index}`, key = `content.${id}`;
            return `<div wire:partial="schema-component::${key}" x-data="filamentSchemaComponent(${e(js({ key, exposedMethods: [], path: '', containerPath: '' }))})" wire:key="${e(`${this.id}.${key}`)}" class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component">${stat.toHtml(this.panel, id)}</div></div>`;
        }).join('');
        const interval = (this.constructor as typeof StatsOverviewWidget).pollingInterval;
        const poll = interval && /^[0-9]+(ms|s)$/.test(interval) ? ` wire:poll.${interval}` : '';
        return this.wrap(`<div x-data="filamentSchema({ livewireId: ${e(js(this.id))}, schemaKey: 'content' })" x-on:form-validation-error.window="handleFormValidationError" x-on:reset-schema-component-state.window="handleClientSideStateReset" class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));"><div ${anonymous} class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component fi-grid-ctn"><div${poll} class="fi-sc-section"><section x-data="{
        isCollapsed: false,
    }" class="fi-section fi-section-not-contained"><div class="fi-section-content-ctn"><div class="fi-section-content fi-grid @xl:fi-grid-cols !@lg:fi-grid-cols fi-sc fi-sc-has-gap" style="--cols-cxl: repeat(${columns}, minmax(0, 1fr)); --cols-nclg: repeat(${columns}, minmax(0, 1fr)); --cols-default: repeat(1, minmax(0, 1fr));">${cells}</div></div></section></div></div></div></div>`, ['fi-wi-stats-overview']);
    }
}

/** Chart data in Chart.js format: `{ datasets: [{ label, data, … }], labels: [...] }`. */
export type ChartData = { datasets?: Record<string, unknown>[]; labels?: unknown[]; [key: string]: unknown };

/**
 * Chart.js chart. A subclass provides `getType()` (`'line'`, `'bar'`, `'pie'`, `'doughnut'`, `'radar'`, `'polarArea'`,
 * `'scatter'`, `'bubble'`) and `getData()`. Rendering happens in the browser; the server only sends new data when it
 * has changed (checksum).
 */
export abstract class ChartWidget extends Widget {
    static callable = ['updateChartData'];
    static locked = ['dataChecksum'];
    /** Polling interval, or `null` to disable polling. */
    static pollingInterval: string | null = '5s';
    static heading: string | null = null;
    static description: string | null = null;
    /** Color of datasets that do not set one. */
    static color = 'primary';
    /** Maximum chart height (`'300px'`). */
    static maxHeight: string | null = null;
    static isCollapsible = false;
    dataChecksum: string | null = null;
    /** Selected filter, one of `getFilters()`. */
    filter: string | null = null;
    private _cachedData: ChartData | null = null;

    abstract getType(): string;
    getData(): ChartData | Promise<ChartData> { return {}; }
    /** Chart.js options. */
    getOptions(): Record<string, unknown> | null { return null; }
    /** Filters offered in the header: value → label. */
    getFilters(): Record<string, string> | null { return null; }
    getHeading(): string | null { return (this.constructor as typeof ChartWidget).heading; }
    getDescription(): string | null { return (this.constructor as typeof ChartWidget).description; }
    getColor(): string { return (this.constructor as typeof ChartWidget).color; }
    getMaxHeight(): string | null { return (this.constructor as typeof ChartWidget).maxHeight; }
    /** Text read by screen readers instead of the chart. */
    getChartAssistiveContent(): string | null { return null; }
    protected async getCachedData(): Promise<ChartData> { return (this._cachedData ??= await this.getData()); }
    protected async generateDataChecksum(): Promise<string> { return createHash('md5').update(JSON.stringify(await this.getCachedData())).digest('hex'); }
    async mount(): Promise<void> { this.dataChecksum = await this.generateDataChecksum(); }
    /** Called by polling and before each render: only emits data when it has changed. */
    async updateChartData(): Promise<void> {
        const checksum = await this.generateDataChecksum();
        if (checksum === this.dataChecksum) return;
        this.dataChecksum = checksum;
        this.dispatch('updateChartData', { data: await this.getCachedData() });
    }
    async render(): Promise<string> {
        await this.updateChartData();
        const WidgetClass = this.constructor as typeof ChartWidget;
        const heading = this.getHeading(), description = this.getDescription(), filters = this.getFilters(), type = this.getType(), maxHeight = this.getMaxHeight();
        const hasMaxHeight = maxHeight !== null && maxHeight !== '' && maxHeight !== '100%';
        const data = await this.getCachedData();
        const isEmpty = Object.keys(data).length === 0;
        const assistive = isEmpty ? null : this.getChartAssistiveContent();
        const label = [heading, description].filter((value) => value !== null && value !== '').join('. ').trim();
        const collapsible = WidgetClass.isCollapsible;
        const interval = WidgetClass.pollingInterval;
        const poll = interval && /^[0-9]+(ms|s)$/.test(interval) ? ` wire:poll.${interval}="updateChartData"` : '';
        const filter = filters
            ? `<div class="fi-input-wrp fi-wi-chart-filter"><div wire:loading.delay.default.flex wire:target="filter" wire:key="${e(createHash('md5').update(`${this.id}.filter.loading`).digest('hex').slice(0, 16))}" class="fi-input-wrp-prefix fi-inline">${loadingIndicator(new Attributes({ class: 'fi-color fi-color-gray' }))}</div><div wire:loading.delay.default.class.remove="fi-input-wrp-content-ctn-ps" wire:target="filter" class="fi-input-wrp-content-ctn fi-input-wrp-content-ctn-ps"><select aria-label="${e(t('filament-widgets::chart.filter.label'))}" wire:model.live="filter" class="fi-select-input fi-select-input-has-inline-prefix">${Object.entries(filters).map(([value, text]) => `<option value="${e(value)}">${e(text)}</option>`).join('')}</select></div></div>`
            : '';
        const hasText = (heading !== null && heading !== '') || (description !== null && description !== '');
        const hasHeader = hasText || filter !== '';
        const header = hasHeader
            ? `<header${collapsible ? ` x-on:click="if (! $event.target.closest('.fi-section-header-after-ctn')) isCollapsed = ! isCollapsed"` : ''} class="fi-section-header"><div class="${cls(['fi-section-header-content', { 'fi-section-header-content-has-heading': hasText }])}">${hasText ? `<div class="fi-section-header-text-ctn">${heading ? `<h2 class="fi-section-header-heading">${e(heading)}</h2>` : ''}${description ? `<p class="fi-section-header-description">${e(description)}</p>` : ''}</div>` : ''}${filter ? `<div class="fi-section-header-after-ctn">${filter}</div>` : ''}</div>${collapsible ? `<button aria-expanded="true" x-bind:aria-expanded="(! isCollapsed).toString()" x-bind:aria-controls="$id('fi-section-content')" x-bind:aria-label="isCollapsed ? ${e(js(t('filament::components/section.actions.expand.label')))} : ${e(js(t('filament::components/section.actions.collapse.label')))}" aria-label="${e(t('filament::components/section.actions.collapse.label'))}" type="button" x-on:click.stop="isCollapsed = ! isCollapsed" class="fi-icon-btn fi-size-md fi-section-collapse-btn">${icon('m-chevron-up')}</button>` : ''}</header>`
            : '';
        const colors = ['bg', 'border', 'grid', 'text', 'tooltip-bg', 'tooltip-text', 'tooltip-border'];
        const refs = ['background', 'border', 'grid', 'text', 'tooltipBackground', 'tooltipText', 'tooltipBorder'];
        const frame = `<div x-load x-load-src="${e(this.panel.assetUrl('js/filament/widgets/components/chart.js'))}" wire:ignore data-chart-type="${e(type)}" x-data="chart({
                                cachedData: ${e(js(data))},
                                options: ${e(js(this.getOptions()))},
                                type: ${e(js(type))},
                            })" class="${cls([...this.panel.colors.getComponentClasses('stat-chart', this.getColor()), 'fi-wi-chart-frame', 'fi-wi-chart-canvas-ctn', { 'fi-wi-chart-frame-no-aspect-ratio': hasMaxHeight }])}"><canvas x-ref="canvas" aria-hidden="true" style="width: 100%; ${hasMaxHeight ? `max-height: ${e(maxHeight)}` : 'height: 100%; max-height: 100%'}"></canvas>${colors.map((name, index) => `<span aria-hidden="true" x-ref="${refs[index]}ColorElement" class="fi-wi-chart-${name}-color"></span>`).join('')}</div>`;
        const empty = isEmpty
            ? `<div class="${cls(['fi-wi-chart-frame', { 'fi-wi-chart-frame-no-aspect-ratio': hasMaxHeight }])}"${hasMaxHeight ? ` style="min-height: ${e(maxHeight)}"` : ''}>${emptyState({ heading: t('filament-widgets::chart.empty.heading'), icon: 'o-x-mark', iconColor: 'gray', contained: false })}</div>`
            : '';
        const body = `<div${poll}${isEmpty ? ' style="display: none"' : ''}><div class="fi-wi-chart-image"${label ? ` role="img" aria-label="${e(label)}"` : ''}>${frame}</div>${assistive ? `<div class="fi-wi-chart-assistive-content fi-sr-only"><p>${e(assistive)}</p></div>` : ''}</div>${empty}`;
        return this.wrap(`<section x-data="{
        isCollapsed:  false ,
    }"${collapsible ? ` x-id="['fi-section-content']" x-on:collapse-section.window="if ($event.detail.id == (null ?? $el.id)) isCollapsed = true" x-on:expand="isCollapsed = false" x-on:expand-section.window="if ($event.detail.id == (null ?? $el.id)) isCollapsed = false" x-on:open-section.window="if ($event.detail.id == (null ?? $el.id)) isCollapsed = false" x-on:toggle-section.window="if ($event.detail.id == (null ?? $el.id)) isCollapsed = ! isCollapsed" x-bind:class="isCollapsed &amp;&amp; 'fi-collapsed'"` : ''} class="${cls(['fi-section', { 'fi-section-has-header': hasHeader, 'fi-collapsible': collapsible }])}">${header}<div${collapsible ? ` x-bind:id="$id('fi-section-content')"` : ''} class="fi-section-content-ctn"><div class="fi-section-content">${body}</div></div></section>`, ['fi-wi-chart']);
    }
}

/**
 * Table in a widget: search, sort, simple pagination (previous / next).
 * A subclass provides `table(table)` and `getDataAdapterForTable()`. No actions or filters yet.
 */
export abstract class TableWidget extends Widget implements TableHost {
    static columnSpan: ColumnSpan = 'full';
    static callable = ['sortTable', 'gotoPage', 'nextPage', 'previousPage', 'applyTableColumnManager', 'resetTableColumnManager'];
    /** Table heading; derived from the class name by default (`FlaggedOrders` → "Flagged Orders"). */
    static heading: string | null = null;
    tableSearch = '';
    tableSort: string | null = null;
    tableColumnSearches: Record<string, string> = {};
    tableRecordsPerPage = 10;
    paginators: Record<string, number> = { page: 1 };
    tableColumns: ColumnState[] = [];
    abstract table(table: Table<any>): Table<any>;
    abstract getDataAdapterForTable(): DataAdapter;
    getTableHeading(): string {
        const WidgetClass = this.constructor as typeof TableWidget;
        return WidgetClass.heading ?? WidgetClass.name.replace(/Widget$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    }
    getTable(): Table<any> { return this.table(new Table().heading(this.getTableHeading()).paginationMode('simple')); }
    mount(): void {
        const table = this.getTable();
        this.tableRecordsPerPage = table.getDefaultPageOption();
        this.tableColumns = table.getDefaultColumnState();
        initializeTableGrouping(table, this as any);
    }
    tableGrouping: string | null = null;
    sortTable(column: string | null = null, direction: string | null = null): void { sortTable(this, column, direction); }
    gotoPage(page: number, _pageName = 'page'): void { this.paginators.page = Math.max(1, Math.floor(Number(page)) || 1); }
    nextPage(_pageName = 'page'): void { this.paginators.page = (Number(this.paginators.page) || 1) + 1; }
    previousPage(_pageName = 'page'): void { this.paginators.page = Math.max(1, (Number(this.paginators.page) || 1) - 1); }
    applyTableColumnManager(state: unknown = null, _wasReordered: unknown = false): void { if (state) this.tableColumns = sanitizeColumnState(this.getTable(), state); }
    resetTableColumnManager(): void { this.tableColumns = this.getTable().getDefaultColumnState(); }
    updatedTableSearch(): void { this.paginators.page = 1; }
    updatedTableColumnSearches(): void { this.paginators.page = 1; }
    updatedTableRecordsPerPage(): void { this.paginators.page = 1; }
    updatedTableSort(): void { this.paginators.page = 1; }
    async render(): Promise<string> {
        const scopes = [this.constructor];
        return this.wrap(`${renderHook(WidgetsRenderHook.TABLE_WIDGET_START, scopes)}${await renderTable(this.getTable(), this, this.getDataAdapterForTable(), { bulkActions: [], after: `<div wire:partial="action-modals" x-data="filamentActionModals({
                    livewireId: ${js(this.id)},
                })" style="height: 0"></div>` })}${renderHook(WidgetsRenderHook.TABLE_WIDGET_END, scopes)}`, ['fi-wi-table']);
    }
}

/** For widgets that receive the dashboard filters: `static reactive = PAGE_FILTERS` plus a `pageFilters` property. */
export const PAGE_FILTERS = ['pageFilters'];

/**
 * Stats widget bound to a list page's table: it receives the table state (search, filters, tab…)
 * and can aggregate exactly the records the table displays.
 */
export abstract class PageTableStatsWidget extends StatsOverviewWidget {
    /** List page whose table is observed. */
    static tablePage: () => typeof ListRecords;
    static reactive = PAGE_TABLE_PROPERTIES;
    activeTab: string | null = null;
    paginators: Record<string, number> = { page: 1 };
    tableColumnSearches: Record<string, string> = {};
    tableFilters: Record<string, FilterState> = {};
    tableRecordsPerPage = 10;
    tableSearch = '';
    tableSort: string | null = null;
    /** Aggregates over the table's current query. The received state goes through the same validation as on the page. */
    protected async aggregatePageTable(columns: { sum?: string[]; avg?: string[] } = {}, modify: ((query: any) => void) | null = null): Promise<{ count: number; sum: Record<string, number>; avg: Record<string, number> }> {
        const PageClass = (this.constructor as typeof PageTableStatsWidget).tablePage();
        const page = new PageClass();
        for (const property of PAGE_TABLE_PROPERTIES) (page as any)[property] = (this as any)[property];
        const query = getTableQuery(page.getTable(), page);
        // Extra restriction for one stat ("among the displayed rows, those that…").
        if (modify) (query.modifiers ??= []).push(modify);
        return PageClass.resource.adapter.aggregate(query, columns);
    }
    /** Monthly trend over the table's current query (see `ObjectionAdapter.trendPerMonth`). */
    protected async trendPageTable(options: { start: Date; end: Date; dateColumn?: string; average?: string; modify?: (query: any) => void }): Promise<number[]> {
        const PageClass = (this.constructor as typeof PageTableStatsWidget).tablePage();
        const page = new PageClass();
        for (const property of PAGE_TABLE_PROPERTIES) (page as any)[property] = (this as any)[property];
        return (PageClass.resource.adapter as any).trendPerMonth(getTableQuery(page.getTable(), page), options);
    }
}

/** Schema component that embeds the host component's table. */
export class EmbeddedTable extends SchemaComponent {
    static make(): EmbeddedTable { return new EmbeddedTable(); }
    async toHtml(): Promise<string> { return (this.livewire as unknown as ListRecords).renderTable(); }
}
/** Relation manager tabs of an edit page: only the active tab's manager is mounted, as a lazy child component. */
class RelationManagerTabs extends SchemaComponent {
    constructor() { super(); this._keyName = 'relationManagerTabs'; }
    getExposedMethods(): string[] { return ['getLazyLoadedTabBadges', 'getDeferredTabBadges']; }
    getLazyLoadedTabBadges(): Record<string, unknown> { return {}; }
    getDeferredTabBadges(): Record<string, unknown> { return {}; }
    async toHtml(): Promise<string> {
        const page = this.livewire as unknown as EditRecord;
        const managers: (typeof RelationManager)[] = page.resource.relations;
        const key = this.getKey()!;
        const id = page.id;
        const active = Math.min(Math.max(Math.floor(Number(page.activeRelationManager)) || 0, 0), managers.length - 1);
        const tabId = (index: number) => `fi-sc-tab-${createHash('md5').update(`${key}.${index}`).digest('hex')}`;
        const tabs = managers.map((manager, index) => `<button id="${tabId(index)}" role="tab" aria-controls="${key}.${index}" aria-selected="${index === active ? 'true' : 'false'}" x-bind:aria-selected="isTabSelected('${index}')" tabindex="${index === active ? '0' : '-1'}" x-bind:tabindex="getTabIndex('${index}')" data-tab-key="${index}" x-bind:data-tab-available="Boolean(true).toString()" x-show="true" x-on:click.capture="if (! selectTab('${index}', $event)) { $event.preventDefault(); $event.stopImmediatePropagation() }" x-bind:class="{ 'fi-active': isTabSelected('${index}') }" type="button" wire:click="$set('activeRelationManager', '${index}')" class="${cls(['fi-tabs-item', { 'fi-active': index === active }])}"><span class="fi-tabs-item-label">${e(manager.getTitle())}</span></button>`);
        const panels: string[] = [];
        for (const [index, manager] of managers.entries()) {
            let content = '';
            if (index === active) {
                const componentName = (page as any)._runtime.nameOf(manager);
                const childKey = `${key}.${index}.${componentName}`;
                const child = await page.mountChild(componentName, { ownerRecord: page.recordKey }, `${id}.${childKey}`, { lazy: true });
                content = `<div class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));"><div wire:partial="schema-component::${e(childKey)}" x-data="filamentSchemaComponent(${e(js({ key: childKey, exposedMethods: [], path: '', containerPath: '' }))})" wire:key="${e(`${id}.${childKey}`)}" class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component">${child}</div></div></div>`;
            }
            panels.push(`<div aria-labelledby="${tabId(index)}" id="${key}.${index}" role="tabpanel" tabindex="0" wire:key="${id}.${key}.${index}.container" x-show="true" x-bind:class="{ 'fi-active': isTabSelected('${index}') }" x-on:expand="revealTab('${index}')" x-data="filamentSchemaComponent(${e(js({ key: `${key}.${index}`, exposedMethods: [], path: '', containerPath: '' }))})" class="fi-sc-tabs-tab">${content}</div>`);
        }
        return `<div x-data="tabsSchemaComponent({
 activeTab: ${active + 1},
 hasTabPanels: true,
 isScrollable: true,
 isVertical: false,
 livewireId: ${e(js(id))},
 livewireProperty: 'activeRelationManager',
 tab: '${active}',
 })" x-load x-load-src="${e(page.panel.assetUrl('js/filament/schemas/components/tabs.js'))}" wire:ignore.self id="${key}" wire:key="${id}.${key}.container" class="fi-sc-tabs"><input type="hidden" x-ref="tabsData" data-active-tab="${active}" /><div x-ref="tabsHeader" class="fi-tabs"><div x-ref="tablist" role="tablist" x-bind:role="hasVisibleTabHeaders ? 'tablist' : 'group'" aria-label="${e(t('filament::components/tabs.label'))}" x-on:keydown="handleKeydown($event)" data-prevent-disabled-clicks wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" wire:target="activeRelationManager" class="fi-sc-tabs-tablist">${tabs.join('')}</div></div>${panels.join('')}</div>`;
    }
}
/** List page tab: restricts the table query and can show a badge. */
export class Tab {
    private _label: string | null;
    private _badge: (() => number | string | null | Promise<number | string | null>) | null = null;
    private _badgeColor = 'primary';
    private _hasBadgeColor = false;
    private _query: ((query: any) => void) | null = null;
    constructor(label: string | null = null) { this._label = label; }
    static make(label: string | null = null): Tab { return new Tab(label); }
    /** Badge computed after the page is displayed. */
    badge(resolver: () => number | string | null | Promise<number | string | null>): this { this._badge = resolver; return this; }
    badgeColor(color: string): this { this._badgeColor = color; this._hasBadgeColor = true; return this; }
    query(modifier: (query: any) => void): this { this._query = modifier; return this; }
    getLabel(key: string): string { return this._label ?? ucfirst(key.replace(/[_-]+/g, ' ')); }
    hasBadge(): boolean { return this._badge !== null; }
    async getBadge(): Promise<number | string | null> { return this._badge ? this._badge() : null; }
    getBadgeColor(): string { return this._badgeColor; }
    /** False until `badgeColor()` is called: a lazy-loaded badge then gets no color class. */
    hasBadgeColor(): boolean { return this._hasBadgeColor; }
    getQuery(): ((query: any) => void) | null { return this._query; }
}

/** List page tabs: hidden when the page declares none. */
class ResourceTabs extends SchemaComponent {
    constructor() { super(); this._keyName = 'resourceTabs'; this._hidden = ({ livewire }) => Object.keys((livewire as any).getTabs()).length === 0; }
    getExposedMethods(): string[] { return ['getLazyLoadedTabBadges', 'getDeferredTabBadges']; }
    getDeferredTabBadges(): Record<string, unknown> { return {}; }
    /** Tab badges, requested by the browser once the page is displayed. */
    async getLazyLoadedTabBadges(): Promise<Record<string, unknown>> {
        const page = this.livewire as unknown as ListRecords;
        const badges: Record<string, unknown> = {};
        for (const [key, tab] of Object.entries(page.getTabs())) {
            if (!tab.hasBadge()) continue;
            badges[key] = { badge: await tab.getBadge(), badgeColorClasses: tab.hasBadgeColor() ? page.panel.colors.getComponentClasses('badge', tab.getBadgeColor()).join(' ') : '', badgeColorStyles: '', badgeTooltip: null, badgeIconHtml: null, badgeIconPosition: 'before' };
        }
        return badges;
    }
    async toHtml(): Promise<string> {
        const page = this.livewire as unknown as ListRecords;
        const tabs = Object.entries(page.getTabs());
        const key = this.getKey()!;
        const id = page.id;
        const active = page.getActiveTabKey();
        const q = (k: string) => `'${k.replace(/[^A-Za-z0-9_-]/g, '')}'`;
        const buttons = tabs.map(([k, tab]) => {
            const d = `deferredBadges[${q(k)}]`;
            const badge = tab.hasBadge() ? `<span x-show="isLoadingDeferredBadges" x-cloak class="fi-tabs-item-badge-placeholder">${loadingIndicator(new Attributes(), 'sm')}</span><template x-if="
 ! isLoadingDeferredBadges &&
 ${d}?.badge != null
 "><span x-bind:class="
 'fi-badge fi-size-sm ' +
 (${d}?.badgeColorClasses ?? '')
 " x-bind:style="${d}?.badgeColorStyles ?? ''" x-init="
 let tooltip = ${d}?.badgeTooltip
 if (tooltip) {
 window.tippy?.($el, {
 content: tooltip,
 theme: $store.theme,
 })
 }
 "><template x-if="
 ${d}?.badgeIconHtml &&
 ${d}?.badgeIconPosition !== 'after'
 "><span x-html="${d}.badgeIconHtml"></span></template><span class="fi-badge-label-ctn"><span class="fi-badge-label" x-text="${d}?.badge"></span></span><template x-if="
 ${d}?.badgeIconHtml &&
 ${d}?.badgeIconPosition === 'after'
 "><span x-html="${d}.badgeIconHtml"></span></template></span></template>` : '';
            return `<button id="fi-sc-tab-${createHash('md5').update(`${key}.${k}`).digest('hex')}" aria-pressed="${k === active ? 'true' : 'false'}" x-bind:aria-pressed="isTabSelected(${q(k)})" tabindex="0" x-bind:tabindex="getTabIndex(${q(k)})" data-tab-key="${e(k)}" x-bind:data-tab-available="Boolean(true).toString()" x-show="true" x-on:click.capture="if (! selectTab(${q(k)}, $event)) { $event.preventDefault(); $event.stopImmediatePropagation() }" x-bind:class="{ 'fi-active': isTabSelected(${q(k)}) }" type="button" wire:click="$set('activeTab', ${k === '' ? 'null' : q(k)})" class="${cls(['fi-tabs-item', { 'fi-active': k === active }])}"><span class="fi-tabs-item-label">${e(tab.getLabel(k))}</span>${badge}</button>`;
        });
        return `<div x-data="tabsSchemaComponent({
 activeTab: ${Math.max(tabs.findIndex(([k]) => k === active), 0) + 1},
 hasTabPanels: false,
 isScrollable: true,
 isVertical: false,
 livewireId: ${e(js(id))},
 livewireProperty: 'activeTab',
 tab: ${q(active)},
 })" x-load x-load-src="${e(page.panel.assetUrl('js/filament/schemas/components/tabs.js'))}" wire:ignore.self id="${key}" wire:key="${id}.${key}.container" class="fi-sc-tabs"><input type="hidden" x-ref="tabsData" data-active-tab="${e(active)}" /><div x-data="{
 deferredBadges: {},
 isLoadingDeferredBadges: true,
 async init() {
 try {
 const badges = await this.$getLazyLoadedTabBadges()
 this.deferredBadges = badges ?? {}
 } finally {
 this.isLoadingDeferredBadges = false
 }
 },
 }" x-ref="tabsHeader" class="fi-tabs"><div x-ref="tablist" role="group" aria-label="${e(t('filament-panels::resources/pages/list-records.tabs.label'))}" x-on:keydown="handleKeydown($event)" data-prevent-disabled-clicks wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" wire:target="activeTab" class="fi-sc-tabs-tablist">${buttons.join('')}</div></div></div>`;
    }
}

/** Resource list page: table state and methods called by the browser. */
export class ListRecords extends Page implements TableHost {
    static callable = ['updateTableColumnState', 'sortTable', 'gotoPage', 'nextPage', 'previousPage', 'applyTableFilters', 'resetTableFiltersForm', 'removeTableFilters', 'removeTableFilter', 'applyTableColumnManager', 'resetTableColumnManager', 'toggleTableReordering', 'reorderTable'];
    static resource: typeof Resource;
    tableSearch = '';
    tableSort: string | null = null;
    tableColumnSearches: Record<string, string> = {};
    tableRecordsPerPage = 10;
    paginators: Record<string, number> = { page: 1 };
    // Selection: kept by the browser, sent along with the bulk action call.
    selectedTableRecords: string[] = [];
    deselectedTableRecords: string[] = [];
    isTrackingDeselectedTableRecords = false;
    // Filters: `tableDeferredFilters` is the form state, `tableFilters` the applied state (deferred filters by default).
    tableFilters: Record<string, FilterState> = {};
    tableDeferredFilters: Record<string, FilterState> = {};
    tableColumns: ColumnState[] = [];
    isTableReordering = false;
    /** Current table grouping (`id:direction`), chosen in the toolbar. */
    tableGrouping: string | null = null;
    updatedTableGrouping(): void { this.paginators.page = 1; }
    /** Toggles manual reordering mode. */
    async toggleTableReordering(): Promise<void> { if (this.getTable().getReorderColumn() !== null && (await canOn(this, 'reorder'))) { this.isTableReordering = !this.isTableReordering; this.deselectAllTableRecords(); } }
    /** Saves the new order: only keys belonging to the table are kept, each gets its position. */
    async reorderTable(order: unknown, _draggedRecordKey: unknown = null): Promise<void> {
        const column = this.getTable().getReorderColumn();
        if (column === null || !this.isTableReordering || !Array.isArray(order) || order.length > REORDER_LIMIT || !(await canOn(this, 'reorder'))) return;
        const adapter = this.getDataAdapterForTable();
        const allowed = new Set(await adapter.keysInScope(order.filter((key) => typeof key === 'string' || typeof key === 'number').map(String)));
        let rank = 0;
        for (const key of order.map(String)) if (allowed.delete(key)) await adapter.update(key, { [column]: ++rank });
    }

    /** Key of this table's persisted state: per page class (and resource or relationship). */
    protected tableSessionKey(part: string): string {
        const page = this.constructor as any;
        return ['tables', page.name, page.resource?.slug ?? '', page.relationship ?? '', part].join(':');
    }
    /** Session of the persisted table state: the browser (its CSRF token) and the signed-in user. */
    private tableSession(): string | null {
        const ctx = this._ctx as PanelContext | null;
        return ctx?.mailbox ? `${ctx.panel.getId()}:${ctx.user?.id ?? ''}:${ctx.mailbox}` : null;
    }
    async dehydrate(): Promise<void> {
        await super.dehydrate?.();
        const table = this.getTable(), session = this.tableSession();
        if (!session) return;
        const store = (this._ctx as PanelContext).panel.getSessionStore();
        if (table.persistsFiltersInSession()) await store.set(session, this.tableSessionKey('filters'), this.tableFilters);
        if (table.persistsSearchInSession()) await store.set(session, this.tableSessionKey('search'), this.tableSearch);
        if (table.persistsColumnSearchesInSession()) await store.set(session, this.tableSessionKey('column-searches'), this.tableColumnSearches);
        if (table.persistsSortInSession()) await store.set(session, this.tableSessionKey('sort'), this.tableSort);
        if (table.persistsGroupingInSession()) await store.set(session, this.tableSessionKey('grouping'), this.tableGrouping);
    }
    /** Restores the persisted table state; every value is sanitized like browser input. */
    private async restoreTableSession(table: Table): Promise<void> {
        const session = this.tableSession();
        if (!session) return;
        const store = (this._ctx as PanelContext).panel.getSessionStore();
        if (table.persistsFiltersInSession()) {
            const saved = await store.get(session, this.tableSessionKey('filters'));
            if (saved && typeof saved === 'object') { this.tableFilters = this.sanitizeTableFilters(saved as Record<string, unknown>); this.tableDeferredFilters = JSON.parse(JSON.stringify(this.tableFilters)); }
        }
        if (table.persistsSearchInSession()) { const saved = await store.get(session, this.tableSessionKey('search')); if (typeof saved === 'string') this.tableSearch = saved.slice(0, 1000); }
        if (table.persistsColumnSearchesInSession()) {
            const saved = await store.get(session, this.tableSessionKey('column-searches'));
            if (saved && typeof saved === 'object') this.tableColumnSearches = Object.fromEntries(Object.entries(saved as Record<string, unknown>).filter(([name, value]) => typeof value === 'string' && table.getColumn(name)?.isIndividuallySearchable()).map(([name, value]) => [name, (value as string).slice(0, 1000)]));
        }
        if (table.persistsSortInSession()) { const saved = await store.get(session, this.tableSessionKey('sort')); if (typeof saved === 'string' || saved === null) this.tableSort = saved as string | null; }
        // Only a group the table declares is kept: `getTableGrouping()` ignores anything else.
        if (table.persistsGroupingInSession()) { const saved = await store.get(session, this.tableSessionKey('grouping')); if (typeof saved === 'string' && saved.length <= 200) this.tableGrouping = saved; }
    }

    async mount(_params: Record<string, unknown> = {}): Promise<void> {
        const table = this.getTable();
        this.tableFilters = table.getDefaultFilterState();
        this.tableDeferredFilters = table.getDefaultFilterState();
        await this.restoreTableSession(table);
        this.tableColumns = table.getDefaultColumnState();
        // Preselect the default group.
        initializeTableGrouping(table, this as any);
        // `?tableAction=view&tableActionRecord=12` (global search result link): the row action opens on arrival, with the usual checks.
        const query = ((this._ctx as PanelContext | null)?.req?.query ?? {}) as Record<string, unknown>;
        if (typeof query.tableAction === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(query.tableAction) && typeof query.tableActionRecord === 'string' && query.tableActionRecord.length <= 64) {
            try { await this.mountAction(query.tableAction, {}, { table: true, recordKey: query.tableActionRecord }); } catch (error) { if (!(error instanceof WireError)) throw error; }
        }
    }
    /** Filters form: one group per filter, bound to `tableDeferredFilters.<filter>`. */
    tableFiltersFormSchema(schema: Schema): Schema {
        const table = this.getTable();
        // Deferred filters edit a copy applied by the "Apply" button; otherwise the form edits the applied state, field by field.
        const deferred = table.hasDeferredFilters();
        const groups = table.getFilters().map((filter) => {
            // A filter may provide its own form (query builder); otherwise it is a select.
            const custom = filter.getFormComponents?.() as SchemaComponent[] | undefined;
            if (custom) return StatefulGroup.make(filter.name, custom).columnSpan(filter.getColumnSpan?.() ?? { default: 1, lg: 1 });
            const definition = filter.getFormDefinition();
            return StatefulGroup.make(filter.name, [Select.make('value').label(filter.getLabel()).placeholder(definition.placeholder).options(filter.getFormOptions ? () => filter.getFormOptions!() : definition.options)]).columnSpan({ default: 1, lg: 1 });
        });
        // `filtersFormSchema()`: the application arranges the filter groups (sections, columns...).
        const arrange = table.getFiltersFormSchema();
        const components = arrange ? arrange(Object.fromEntries(table.getFilters().map((filter, index) => [filter.name, groups[index]]))) : groups;
        const built = schema.statePath(deferred ? 'tableDeferredFilters' : 'tableFilters').columns(table.getFiltersFormColumns()).partiallyRendered().components(components);
        if (!deferred) for (const component of built.getFlatComponents()) if (component instanceof Field) component.live();
        return built;
    }
    /** Applied state of every declared filter, sanitized from the given (browser) state. */
    protected sanitizeTableFilters(source: Record<string, unknown> | undefined): Record<string, FilterState> {
        return Object.fromEntries(this.getTable().getFilters().map((filter) => {
            const received = source?.[filter.name];
            if (filter.sanitizeState) return [filter.name, filter.sanitizeState(received)];
            return [filter.name, Object.fromEntries(Object.keys(filter.getDefaultState()).map((key) => [key, (received as any)?.[key] ?? null]))];
        }));
    }
    /** Live filters (`deferFilters(false)`): a changed field applies at once. */
    async updatedTableFilters(value: unknown, key: string | null): Promise<void> {
        if (this.getTable().hasDeferredFilters()) { this.tableFilters = this.sanitizeTableFilters(this.tableFilters); return; }
        await this.runFilterFieldHook('tableFilters', key);
        this.tableFilters = this.sanitizeTableFilters(this.tableFilters);
        this.tableDeferredFilters = JSON.parse(JSON.stringify(this.tableFilters));
        this.paginators.page = 1;
        this.dispatch('deselectAllTableRecords', [], { self: true });
    }
    applyTableFilters(): void {
        // Only filters declared by the table reach the applied state: each sanitizes its own state, or else only its known keys are kept.
        this.tableFilters = this.sanitizeTableFilters(this.tableDeferredFilters);
        this.paginators.page = 1;
    }
    /** Removes an active filter indicator: the field is cleared from both the applied state and the form. */
    async removeTableFilter(filterName: unknown, field: unknown = null): Promise<void> {
        const table = this.getTable();
        const filter = table.getFilters().find((candidate) => candidate.name === filterName);
        // A filter showing a non-removable indicator cannot be removed by a forged call either.
        if (!filter || !(await isTableFilterRemovable(table, this as any, filter.name))) return;
        const current = this.tableFilters?.[filter.name];
        const next = filter.removeIndicator && typeof field === 'string' && current && typeof current === 'object' ? filter.removeIndicator(current, field) : (filter.getResetState?.() ?? filter.getDefaultState());
        this.tableFilters = { ...this.tableFilters, [filter.name]: next };
        this.tableDeferredFilters = { ...this.tableDeferredFilters, [filter.name]: JSON.parse(JSON.stringify(next)) };
        this.paginators.page = 1;
    }
    /** Live field in the filters form (e.g. a rule's operator changed): runs its `afterStateUpdated`. */
    async updatedTableDeferredFilters(_value: unknown, key: string | null): Promise<void> { await this.runFilterFieldHook('tableDeferredFilters', key); }
    private async runFilterFieldHook(property: 'tableFilters' | 'tableDeferredFilters', key: string | null): Promise<void> {
        if (!key) return;
        const path = `${property}.${key}`;
        const field = this.getSchema('tableFiltersForm').getFlatComponents().find((c) => c instanceof Field && c.getStatePath() === path) as Field | undefined;
        if (!field?.hasAfterStateUpdated()) return;
        const container = path.split('.').slice(0, -1);
        await field.callAfterStateUpdated((name, value) => {
            if (!/^[A-Za-z0-9_]+$/.test(name)) return;
            let node: any = this;
            for (const segment of container) node = node?.[segment];
            if (node && typeof node === 'object') node[name] = value;
        });
    }
    resetTableFiltersForm(): void {
        this.tableFilters = this.getTable().getDefaultFilterState();
        this.tableDeferredFilters = this.getTable().getDefaultFilterState();
        this.paginators.page = 1;
        this.dispatch('deselectAllTableRecords', [], { self: true });
    }
    /** "Remove all": resets every removable filter (to its empty state, not its default), the search and the column searches. */
    async removeTableFilters(): Promise<void> {
        const table = this.getTable();
        for (const filter of table.getFilters()) {
            if (!(await isTableFilterRemovable(table, this as any, filter.name))) continue;
            const reset = filter.getResetState?.() ?? filter.getDefaultState();
            this.tableFilters = { ...this.tableFilters, [filter.name]: reset };
            this.tableDeferredFilters = { ...this.tableDeferredFilters, [filter.name]: JSON.parse(JSON.stringify(reset)) };
        }
        this.tableSearch = '';
        this.tableColumnSearches = {};
        this.paginators.page = 1;
        this.dispatch('deselectAllTableRecords', [], { self: true });
    }
    applyTableColumnManager(state: unknown = null, _wasReordered: unknown = false): void { if (state) this.tableColumns = sanitizeColumnState(this.getTable(), state); }
    resetTableColumnManager(): void { this.tableColumns = this.getTable().getDefaultColumnState(); }

    // --- list tabs: the empty key is the default tab (`null` in the browser)
    activeTab: string | null = null;
    getTabs(): Record<string, Tab> { return (this.resource as any).tabs?.() ?? {}; }
    /** Active tab, coerced to a declared key (an unknown value from the browser means the default tab). */
    getActiveTabKey(): string {
        const tabs = this.getTabs();
        const key = this.activeTab ?? '';
        return Object.prototype.hasOwnProperty.call(tabs, key) ? key : (Object.keys(tabs)[0] ?? '');
    }
    updatedActiveTab(): void { this.paginators.page = 1; this.deselectAllTableRecords(); }
    modifyTableQuery(query: { modifiers?: ((q: any) => void)[] }): void {
        const tab = this.getTabs()[this.getActiveTabKey()];
        const modifier = tab?.getQuery();
        if (modifier) (query.modifiers ??= []).push(modifier);
    }

    get resource(): typeof Resource { return (this.constructor as typeof ListRecords).resource; }
    getHeaderWidgets(): (typeof Widget)[] { return this.resource.headerWidgets ?? []; }
    /** The table state is passed to widgets, which can rerun the same query. */
    getWidgetData(): Record<string, unknown> { return Object.fromEntries(PAGE_TABLE_PROPERTIES.map((property) => [property, (this as any)[property]])); }
    protected rendersActionModalsInPage(): boolean { return false; }
    getBulkActions(): Action[] { return this.getTable().getBulkActions() ?? [DeleteBulkAction.make()]; }
    /** Row actions declared by the table, with groups flattened. */
    getRecordActions(): Action[] {
        const table = this.getTable();
        // Column actions are record actions too: mounted with the record key, and checked the same way.
        return [...table.getRecordActions().flatMap((a: any) => (a instanceof ActionGroup ? a.getActions() : [a])), ...table.getColumnActions()];
    }
    protected getMountableActions(context: Record<string, unknown>): Action[] | Promise<Action[]> {
        if (typeof context.schemaComponent === 'string') return this.getSchemaComponentActions(context.schemaComponent);
        if (context.table === true && context.bulk === true) return this.getBulkActions();
        if (context.table === true && typeof context.recordKey === 'string') return this.getRecordActions();
        if (context.table === true) return flattenActions([...this.getTable().getHeaderActions(), ...this.getTable().getToolbarActions(), ...this.getTable().getEmptyStateActions()]);
        return flattenActions(this.getHeaderActions());
    }
    /** Only known context shapes are kept; the record key is checked again in the database on mount. */
    protected resolveMountContext(clientContext: unknown): Record<string, unknown> {
        const c = clientContext && typeof clientContext === 'object' ? (clientContext as Record<string, unknown>) : {};
        if (typeof c.schemaComponent === 'string' && c.schemaComponent.length <= 200) return { schemaComponent: c.schemaComponent };
        if (c.table === true && c.bulk === true) return { table: true, bulk: true };
        if (c.table === true && (typeof c.recordKey === 'string' || typeof c.recordKey === 'number')) return { table: true, recordKey: String(c.recordKey) };
        if (c.table === true) return { table: true };
        return {};
    }
    protected async resolveActionRecord(context: Record<string, unknown>): Promise<unknown> {
        return typeof context.recordKey === 'string' ? ((await this.resource.adapter.find(context.recordKey)) ?? null) : null;
    }
    /**
     * Writes an editable cell. Everything comes from the browser: the column must exist and be editable and visible, the record
     * must be in the table's scope and editable by the user, and the value must be valid.
     */
    async updateTableColumnState(columnName: unknown, recordKey: unknown, input: unknown): Promise<unknown> {
        // All checks (visible and editable column, scope, disabled state, authorization, validation, hooks) live in the tables package.
        return updateEditableColumnState(this.getTable(), this, this.getDataAdapterForTable(), columnName, recordKey, input, { authorize: (record: unknown) => canOn(this, 'update', record) });
    }
    /** Selected keys: the sent list, or, in "select all" mode, every record of the current query except deselected ones. */
    async getSelectedRecordKeys(): Promise<string[]> {
        const clean = (list: unknown) => (Array.isArray(list) ? list.filter((k) => typeof k === 'string' || typeof k === 'number').map(String) : []);
        const table = this.getTable(), adapter = this.getDataAdapterForTable();
        let keys: string[];
        // The selection comes from the browser: it is narrowed to records this table can actually display.
        if (!this.isTrackingDeselectedTableRecords) keys = await adapter.keysInScope(clean(this.selectedTableRecords));
        else {
            const excluded = new Set(clean(this.deselectedTableRecords));
            // "Select all" covers the whole query, or only the current page with `selectCurrentPageOnly()`.
            const all = table.selectsCurrentPageOnly() ? (await getTableRecords(table, this, adapter)).records.map((record) => adapter.getKey(record)) : await adapter.listKeys(getTableQuery(table, this));
            keys = all.filter((k) => !excluded.has(k));
        }
        // Records that cannot be selected, and anything beyond `maxSelectableRecords()`, are dropped whatever the browser sent.
        keys = await filterSelectableKeys(table, adapter, keys);
        const max = table.getMaxSelectableRecords();
        return max !== null ? keys.slice(0, max) : keys;
    }
    /**
     * Runs `process` for each selected record, loaded in chunks of `chunkSelectedRecords()`. Records failing the action's
     * `authorizeIndividualRecords()` are skipped; `process` reports a failure by returning `false` or throwing. Then sends the
     * action's success notification, or its failure notification with the number of records skipped and failed.
     */
    async processSelectedRecords(action: Action, process: (record: any) => unknown | Promise<unknown>): Promise<{ total: number; success: number; unauthorized: number; failed: number }> {
        const keys = await this.getSelectedRecordKeys();
        const adapter = this.getDataAdapterForTable();
        const authorization = action.getIndividualRecordsAuthorization();
        const ctx = { livewire: this, record: null, arguments: {}, data: {}, action };
        let success = 0, unauthorized = 0, failed = 0;
        const size = action.getSelectedRecordsChunkSize();
        for (let index = 0; index < keys.length; index += size) {
            const records = await Promise.all(keys.slice(index, index + size).map((key) => adapter.find(key)));
            for (const record of records) {
                if (!record) { failed++; continue; }
                const allowed = authorization === null ? true : typeof authorization === 'string' ? await canOn(this, authorization, record) : await authorization(record, { ...ctx, record });
                if (!allowed) { unauthorized++; continue; }
                try { if ((await process(record)) === false) failed++; else success++; } catch (error) { failed++; if (failed === 1) console.error(error); }
            }
        }
        const total = keys.length;
        if (unauthorized + failed === 0) {
            const title = action.getSuccessNotificationTitle();
            if (title) Notification.make().success().title(title).send();
        } else {
            const body = [action.getMissingBulkAuthorizationFailureNotificationMessage(unauthorized, total) && unauthorized ? action.getMissingBulkAuthorizationFailureNotificationMessage(unauthorized, total) : null, failed ? action.getMissingBulkProcessingFailureNotificationMessage(failed, total) : null].filter(Boolean).join(' ');
            const notification = Notification.make().title(action.getFailureNotificationTitle(success, total) ?? action.getSuccessNotificationTitle() ?? '');
            (success ? notification.warning() : notification.danger()).body(body || null).send();
        }
        if (action.shouldDeselectRecordsAfterCompletion()) this.deselectAllTableRecords();
        return { total, success, unauthorized, failed };
    }
    deselectAllTableRecords(): void {
        this.selectedTableRecords = []; this.deselectedTableRecords = []; this.isTrackingDeselectedTableRecords = false;
        this.dispatch('deselectAllTableRecords', [], { self: true });
    }
    getTable(): Table {
        const resource = this.resource;
        const table = new Table().pluralModelLabel(resource.getPluralModelLabel());
        // Simple resource: the row opens the edit modal; otherwise it links to the edit page.
        return resource.table(resource.isSimple ? table.recordAction('edit') : table.recordUrl((record) => resource.getUrl(resource.hasViewPage ? 'view' : 'edit', resource.adapter.getKey(record))));
    }
    async renderTable(): Promise<string> {
        const resource = this.resource;
        const ctx = { livewire: this as any, component: null as any, operation: null, record: null, get: () => undefined, state: undefined };
        const bulkActions: string[] = [];
        for (const action of this.getBulkActions()) if (await action.isVisible(ctx)) bulkActions.push(await action.toGroupedHtml(ctx, { table: true, bulk: true }));
        const table = this.getTable();
        return renderTable(table, this, resource.adapter, {
            bulkActions, headerActions: await this.renderTableHeaderActions(ctx), toolbarActions: await this.renderTableToolbarActions(ctx), emptyStateActions: await this.renderTableEmptyStateActions(ctx), after: await this.renderActionModals(),
            filtersForm: table.getFilters().length ? await this.getSchema('tableFiltersForm').toHtml() : null,
            rowActionsHtml: table.getRecordActions().length ? async (record) => {
                const key = resource.adapter.getKey(record);
                const recordCtx = { ...ctx, record };
                const hash = createHash('md5').update(key).digest('hex');
                const parts: string[] = [];
                for (const action of table.getRecordActions()) {
                    if (action instanceof ActionGroup) parts.push(await action.toHtml(recordCtx, { recordKey: key, table: true }, (a) => `${this.id}.actions.${a.getName()}.${hash}`));
                    else if (await action.isVisible(recordCtx)) parts.push(await action.toLinkHtml(recordCtx, { recordKey: key, table: true }, `${this.id}.actions.${action.getName()}.${hash}`));
                }
                return parts.join('');
            } : undefined,
            canReorder: table.getReorderColumn() !== null ? await canOn(this, 'reorder') : undefined,
            rowActions: async (record) => resource.isSimple || table.getRecordActions().length || !(await canOn(this, 'update', record)) ? [] : [{ label: t('filament-actions::edit.single.label'), url: resource.getUrl('edit', resource.adapter.getKey(record)), icon: 'c-pencil-square', key: `edit.${createHash('md5').update(resource.adapter.getKey(record)).digest('hex')}` }],
        });
    }

    protected async renderTableEmptyStateActions(ctx: any): Promise<string[]> {
        const html: string[] = [];
        for (const action of this.getTable().getEmptyStateActions()) if (await action.isVisible(ctx)) html.push(await action.toHtml(ctx, { table: true }));
        return html;
    }
    /** Table header actions (none on a list page: they go in the page header). */
    protected async renderTableToolbarActions(ctx: any): Promise<string[]> {
        const html: string[] = [];
        for (const action of this.getTable().getToolbarActions()) if (await action.isVisible(ctx)) html.push(await action.toHtml(ctx, { table: true }));
        return html;
    }
    protected async renderTableHeaderActions(ctx: any): Promise<string[]> {
        const html: string[] = [];
        for (const action of this.getTable().getHeaderActions()) if (await action.isVisible(ctx)) html.push(await action.toHtml(ctx, { table: true }));
        return html;
    }
    sortTable(column: string | null = null, direction: string | null = null): void { sortTable(this, column, direction); }
    gotoPage(page: number, _pageName = 'page'): void { this.paginators.page = Math.max(1, Math.floor(Number(page)) || 1); }
    nextPage(_pageName = 'page'): void { this.paginators.page = (Number(this.paginators.page) || 1) + 1; }
    previousPage(_pageName = 'page'): void { this.paginators.page = Math.max(1, (Number(this.paginators.page) || 1) - 1); }
    updatedTableSearch(): void { this.paginators.page = 1; }
    getDataAdapterForTable(): DataAdapter { return this.resource.adapter; }
    getDataAdapter(): DataAdapter { return this.resource.adapter; }
    updatedTableColumnSearches(): void { this.paginators.page = 1; }
    updatedTableRecordsPerPage(): void { this.paginators.page = 1; }
    updatedTableSort(): void { this.paginators.page = 1; }

    getBreadcrumbs(): { label: string; url: string | null }[] {
        if (this.resource.isSimple) return [{ label: '', url: null }];
        return [{ label: this.resource.getTitleCasePluralModelLabel(), url: this.resource.getUrl() }, { label: t('filament-panels::resources/pages/list-records.breadcrumb'), url: null }];
    }
    getHeaderActions(): Action[] {
        // Simple resource: create in a modal; otherwise link to the create page.
        if (this.resource.isSimple) return [CreateAction.make(this.resource)];
        return [...((this.resource as any).listHeaderActions?.() ?? []), Action.make('create').label(t('filament-actions::create.single.label', { label: this.resource.modelLabel })).url(this.resource.getUrl('create')).authorize(({ livewire }) => canOn(livewire, 'create'))];
    }
    getPageClasses(): string[] { return ['fi-resource-list-records-page', `fi-resource-${this.resource.slug.replace(/\//g, '-')}`]; }
    contentSchema(schema: Schema): Schema {
        return schema.components([new ResourceTabs(), RenderHook.make(PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE), EmbeddedTable.make(), RenderHook.make(PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_AFTER)]);
    }
}

/**
 * Table of records related to another one: a child component of the edit page, loaded when it becomes visible.
 * Subclasses declare `relationship`, `adapterFor()`, `table()` and `form()`.
 */
export class RelationManager extends ListRecords {
    static relationship = '';
    static modelLabel = 'record';
    static pluralModelLabel: string | null = null;
    static recordTitleAttribute: string | null = null;
    /** Data adapter limited to records related to the given owner. */
    static adapterFor(_ownerKey: string): DataAdapter { throw new Error('RelationManager.adapterFor() must be defined.'); }
    /** Policy for related records (same abilities as a resource policy). */
    static policy: Policy | null = null;
    protected isAccessAuthorized(ctx: PanelContext): Promise<boolean> { return this.resource.can('viewAny', ctx.user); }
    static table(table: Table): Table { return table; }
    static form(schema: Schema): Schema { return schema; }
    static getTitle(): string { return this.title ?? ucfirst(this.relationship.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()); }

    /** Owner record key: set on mount by the page, never writable from the browser. */
    ownerRecord = '';
    static locked = ['ownerRecord'];
    _facade: any = null;
    /** What ListRecords expects from a resource, provided here by the relation manager. */
    get resource(): any {
        const manager = this.constructor as typeof RelationManager;
        return (this._facade ??= {
            isSimple: true, slug: '', modelLabel: manager.modelLabel, relations: [], adapter: manager.adapterFor(this.ownerRecord),
            can: (ability: string, user: User | null, record: unknown = null) => { const rule = manager.policy?.[ability]; return this.panel.authorize(user, ability, { resource: manager, record, rule: rule ? () => rule(user!, record) : null }); },
            getPluralModelLabel: () => manager.pluralModelLabel ?? plural(manager.modelLabel),
            getTitleCasePluralModelLabel: () => (manager.pluralModelLabel ?? plural(manager.modelLabel)).split(' ').map(ucfirst).join(' '),
            getRecordTitle: (record: any) => (manager.recordTitleAttribute ? String(record?.[manager.recordTitleAttribute] ?? '') : manager.modelLabel),
            table: (table: Table) => manager.table(table), form: (schema: Schema) => manager.form(schema.columns(2)), getUrl: () => '',
        });
    }
    getTable(): Table {
        const manager = this.constructor as typeof RelationManager;
        const table = manager.table(new Table().pluralModelLabel(this.resource.getPluralModelLabel()).heading(manager.getTitle()));
        // If there is an "edit" row action, clicking the row opens it.
        const hasEdit = table.getRecordActions().flatMap((a: any) => (a instanceof ActionGroup ? a.getActions() : [a])).some((a: Action) => a.getName() === 'edit');
        return hasEdit ? table.recordAction('edit') : table;
    }
    // --- many-to-many: to be defined by managers offering Attach / Detach
    /** Attaches an existing record to the owner. */
    static attach(_ownerKey: string, _recordKey: string): Promise<void> { throw new Error('RelationManager.attach() must be defined.'); }
    /** Detaches records from the owner without deleting them. */
    static detach(_ownerKey: string, _recordKeys: string[]): Promise<void> { throw new Error('RelationManager.detach() must be defined.'); }
    /** Attachable records matching the search: [key, label]. */
    static searchAttachable(_ownerKey: string, _search: string): Promise<[string, string][]> { throw new Error('RelationManager.searchAttachable() must be defined.'); }
    /** Label of an attachable record, or `null` if it is not attachable (also used as validation). */
    static attachableLabel(_ownerKey: string, _recordKey: string): Promise<string | null> { throw new Error('RelationManager.attachableLabel() must be defined.'); }
    getHeaderActions(): Action[] { return []; }
    placeholder(): string {
        return `<div role="status" aria-busy="true" style="height: 8rem; ;" class="fi-section fi-loading-section fi-grid-col"><span class="fi-sr-only">${e(t('filament::components/loading-section.label'))}</span></div>`;
    }
    /** A relation manager has its own render hook locations, not the list page's. */
    contentSchema(schema: Schema): Schema {
        return schema.components([new ResourceTabs(), RenderHook.make(PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE), EmbeddedTable.make(), RenderHook.make(PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER)]);
    }
    async render(): Promise<string> {
        return `<div class="fi-resource-relation-manager">${await this.getSchema('content').toHtml()}</div>`;
    }
}

/**
 * Page listing records related to a record: a table, with create, view and edit in modals.
 * Declared in the owner resource's `static relatedPages`, it is served at `<slug>/{record}/<name>`.
 */
export class ManageRelatedRecords extends ListRecords {
    /** Owner resource: set when the page is registered. */
    static parentResource: typeof Resource;
    static relationship = '';
    static modelLabel = 'record';
    static pluralModelLabel: string | null = null;
    static recordTitleAttribute: string | null = null;
    static policy: Policy | null = null;
    /** Data adapter limited to records related to the given owner. */
    static adapterFor(_ownerKey: string): DataAdapter { throw new Error('ManageRelatedRecords.adapterFor() must be defined.'); }
    static table(table: Table): Table { return table; }
    static form(schema: Schema): Schema { return schema; }
    static infolist(schema: Schema): Schema { return schema; }
    static getTitle(): string { return this.title ?? ucfirst(this.relationship.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()); }
    static getNavigationLabel(): string { return this.navigationLabel ?? this.getTitle(); }

    /** Owner record key: read from the URL on mount, never writable from the browser. */
    recordKey = '';
    static locked = ['recordKey'];
    _owner: any = null;
    _facade: any = null;
    private get related(): typeof ManageRelatedRecords { return this.constructor as typeof ManageRelatedRecords; }
    async mount(params: Record<string, unknown>): Promise<void> {
        this.recordKey = String(params.record ?? '');
        await this.hydrate();
        await (ListRecords.prototype as any).mount?.call(this, params);
    }
    /** The owner is reloaded and access to it checked on every request. */
    async hydrate(): Promise<void> {
        const parent = this.related.parentResource;
        this._owner = await parent.adapter.find(this.recordKey);
        if (!this._owner) throw new WireError(404, 'Record not found.');
        if (!(await parent.can('view', (this._ctx as PanelContext | null)?.user ?? null, this._owner))) throw new WireError(403, 'Forbidden.');
        await (ListRecords.prototype as any).hydrate?.call(this);
    }
    getRecordKey(): string | null { return this.recordKey; }
    /** What ListRecords expects from a resource, provided here by the page. */
    get resource(): any {
        const page = this.related;
        return (this._facade ??= {
            isSimple: true, hasViewPage: false, slug: page.parentResource.slug, modelLabel: page.modelLabel, relations: [], recordTitleAttribute: page.recordTitleAttribute, adapter: page.adapterFor(this.recordKey),
            can: (ability: string, user: User | null, record: unknown = null) => { const rule = page.policy?.[ability]; return this.panel.authorize(user, ability, { resource: page, record, rule: rule ? () => rule(user!, record) : null }); },
            getPluralModelLabel: () => page.pluralModelLabel ?? plural(page.modelLabel),
            getTitleCasePluralModelLabel: () => (page.pluralModelLabel ?? plural(page.modelLabel)).split(' ').map(ucfirst).join(' '),
            getRecordTitle: (record: any) => (page.recordTitleAttribute ? String(record?.[page.recordTitleAttribute] ?? '') : page.modelLabel),
            table: (table: Table) => page.table(table), form: (schema: Schema) => page.form(schema), infolist: (schema: Schema) => page.infolist(schema), getUrl: () => '',
        });
    }
    getTable(): Table { return this.related.table(new Table().pluralModelLabel(this.resource.getPluralModelLabel())); }
    getHeaderActions(): Action[] { return []; }
    /** The page content is a group (tabs, if any, then the table). */
    contentSchema(schema: Schema): Schema {
        return schema.components([Group.make([new ResourceTabs(), RenderHook.make(PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE), EmbeddedTable.make(), RenderHook.make(PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER)]), new RelationManagerTabs().key(null).hidden()]);
    }
    getTitle(): string { return t('filament-panels::resources/pages/manage-related-records.title', { label: this.related.parentResource.getRecordTitle(this._owner), relationship: this.related.getTitle() }); }
    getSubNavigation(): SubNavigationItem[] { return this.related.parentResource.getRecordSubNavigation(this); }
    getBreadcrumbs(): { label: string; url: string | null }[] {
        const parent = this.related.parentResource;
        return [
            { label: parent.getTitleCasePluralModelLabel(), url: parent.getUrl() },
            { label: parent.getRecordTitle(this._owner), url: parent.getUrl(parent.hasViewPage ? 'view' : 'edit', this.recordKey) },
            { label: this.related.getTitle(), url: null },
        ];
    }
    getPageClasses(): string[] { return ['fi-resource-manage-related-records-page', `fi-resource-${this.related.parentResource.slug.replace(/\//g, '-')}`, `fi-resource-record-${this.recordKey}`]; }
}

/** Previous page URL if it belongs to this site, otherwise the site root (without a trailing slash). */
function previousUrlOf(req: Request | undefined): string {
    if (!req) return '';
    const origin = `${req.protocol}://${req.get('host')}`;
    try {
        const referer = new URL(String(req.get('referer') ?? ''));
        if (referer.origin === origin) return `${origin}${referer.pathname === '/' ? '' : referer.pathname}${referer.search}`;
    } catch { /* no usable Referer */ }
    return origin;
}

/** A theme's representative color (shade 500 of its primary color), for the menu swatch. */
function swatchOf(theme: Theme, panel: Panel): string {
    const primary = theme.colors?.primary;
    return (typeof primary === 'string' ? primary : primary?.[500]) ?? panel.colors.getColor('primary')?.[500] ?? 'currentColor';
}

/** A theme's font: without a URL, it is served by Bunny Fonts like the panel font. */
function fontOf(font: { family: string; url?: string }): { family: string; url: string; preconnect?: string } {
    return font.url ? { family: font.family, url: font.url } : { family: font.family, url: `https://fonts.bunny.net/css?family=${encodeURIComponent(font.family.toLowerCase().replace(/ /g, '-'))}:400,500,600,700&display=swap`, preconnect: 'https://fonts.bunny.net' };
}

function emptyToNull(data: Record<string, unknown>): Record<string, unknown> { return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])); }

/** Base class for a resource's form pages. */
abstract class ResourceFormPage extends Page {
    /** Live form field (`live()` + `afterStateUpdated()`): `set(name, value)` writes next to the updated field. */
    async updatedData(_value: unknown, key: string | null): Promise<void> {
        if (!key) return;
        const path = `data.${key}`;
        // The updated field first, then its parent fields (a Repeater recomputes a total when one of its rows changes).
        const fields = (this.getSchema('form').getFlatComponents().filter((c) => c instanceof Field && c.hasAfterStateUpdated() && (c.getStatePath() === path || path.startsWith(`${c.getStatePath()}.`))) as Field[])
            .sort((a, b) => b.getStatePath().length - a.getStatePath().length);
        for (const field of fields) {
            const container = field.getStatePath().split('.').slice(0, -1);
            await field.callAfterStateUpdated((name, value) => {
                if (!/^[A-Za-z0-9_]+$/.test(name)) return;
                let node: any = this;
                for (const segment of container) node = node?.[segment];
                if (node && typeof node === 'object') node[name] = value;
            });
        }
    }
    static resource: typeof Resource;
    data: Record<string, unknown> = {};
    get resource(): typeof Resource { return (this.constructor as typeof ResourceFormPage).resource; }
    getDataAdapter(): DataAdapter { return this.resource.adapter; }
    getRecordKey(): string | null { return null; }
    abstract getOperation(): 'create' | 'edit';
    abstract getSubmitMethod(): string;
    abstract getFormActions(): Action[];
    protected getRecord(): unknown { return null; }

    /** Two columns from `lg` by default; the resource may decide otherwise. */
    formSchema(schema: Schema): Schema {
        const form = this.resource.form(schema.columns(2).operation(this.getOperation()).record(this.getRecord()));
        const steps = this.getSteps();
        // Wizard: the steps replace the resource form's components.
        return steps === null ? form : form.columns(null).components([this.getWizardComponent(steps)]);
    }
    /**
     * Wizard steps: as soon as this method returns some, the page shows its form step by step,
     * with "Back" / "Next" and the submit button on the last step.
     */
    protected getSteps(): Step[] | null { return null; }
    /** `true`: steps can be visited in any order, without validation along the way. */
    protected hasSkippableSteps(): boolean { return false; }
    /** Step shown on open (1-based). */
    protected getStartStep(): number { return 1; }
    protected getWizardComponent(steps: Step[]): Wizard {
        const [submit] = this.getFormActions();
        return Wizard.make(steps).startOnStep(this.getStartStep()).cancelAction(this.cancelAction())
            .submitAction(submit.submit(null).action(this.getSubmitMethod()))
            .alpineSubmitHandler(`$wire.${this.getSubmitMethod()}()`).skippable(this.hasSkippableSteps()).contained(false);
    }
    contentSchema(schema: Schema): Schema {
        // Wizard: no surrounding <form>; each step has its own and the wizard holds the actions.
        if (this.getSteps() !== null) return schema.components([EmbeddedSchema.make('form')]);
        return schema.components([
            Form.make([EmbeddedSchema.make('form')]).id('form').livewireSubmitHandler(this.getSubmitMethod())
                .footer([Actions.make(this.getFormActions()).alignment('start').key('form-actions')]),
        ]);
    }
    /** Where "Cancel" goes when the browser has no history: the list page, unless the page decides otherwise. */
    protected getCancelUrl(): string { return this.resource.getUrl(); }
    protected cancelAction(): Action {
        return Action.make('cancel').label(t(`filament-panels::resources/pages/${this.getOperation()}-record.form.actions.cancel.label`)).color('gray')
            .alpineClickHandler(`document.referrer ? window.history.back() : Livewire.navigate(${js(this.getCancelUrl())})`);
    }
    /** Validates the form; on error, sets the errors on the component and notifies the browser. */
    protected async validateForm(): Promise<boolean> {
        this._errors = await validateSchema(this.getSchema('form'));
        if (!Object.keys(this._errors).length) return true;
        this.dispatch('form-validation-error', { livewireId: this.id });
        return false;
    }
}

/** Record creation page. */
export class CreateRecord extends ResourceFormPage {
    static callable = ['create', 'createAnother'];
    mount(): void { fillSchema(this.getSchema('form'), this.data); }
    getOperation(): 'create' { return 'create'; }
    getSubmitMethod(): string { return 'create'; }
    getTitle(): string { return t('filament-panels::resources/pages/create-record.title', { label: this.resource.modelLabel.split(' ').map(ucfirst).join(' ') }); }
    getBreadcrumbs(): { label: string; url: string | null }[] {
        return [{ label: this.resource.getTitleCasePluralModelLabel(), url: this.resource.getUrl() }, { label: t('filament-panels::resources/pages/create-record.breadcrumb'), url: null }];
    }
    getPageClasses(): string[] { return ['fi-resource-create-record-page', `fi-resource-${this.resource.slug.replace(/\//g, '-')}`]; }
    getFormActions(): Action[] {
        return [
            Action.make('create').label(t('filament-panels::resources/pages/create-record.form.actions.create.label')).submit('create').keyBindings(['mod+s']),
            Action.make('createAnother').label(t('filament-panels::resources/pages/create-record.form.actions.create_another.label')).color('gray').action('createAnother').keyBindings(['mod+shift+s']),
            this.cancelAction(),
        ];
    }
    // --- lifecycle hooks, to override in a subclass (none can be called from the browser)
    /** Transforms validated data before creation (add the author, compute a field…). */
    protected mutateFormDataBeforeCreate(data: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> { return data; }
    /** Right before creation; throwing cancels it. */
    protected beforeCreate(_data: Record<string, unknown>): void | Promise<void> {}
    /** The creation itself; defaults to the resource's data adapter. */
    protected handleRecordCreation(data: Record<string, unknown>): Promise<any> { return this.getDataAdapter().create(data); }
    /** After creation (logging, sending a message…). */
    protected afterCreate(_record: any): void | Promise<void> {}
    /** Where to go next; defaults to the new record's edit page. */
    protected getRedirectUrl(record: any): string { return this.resource.getUrl('edit', this.getDataAdapter().getKey(record)); }
    /** Success notification title; `null` to show nothing. */
    protected getCreatedNotificationTitle(): string | null { return t('filament-panels::resources/pages/create-record.notifications.created.title'); }

    async create(another = false): Promise<void> {
        if (!(await this.validateForm())) return;
        const data = await this.mutateFormDataBeforeCreate(await getSchemaState(this.getSchema('form')));
        await this.beforeCreate(data);
        const record = await this.handleRecordCreation(data);
        await saveSchemaRelationships(this.getSchema('form'), record);
        await this.afterCreate(record);
        const title = this.getCreatedNotificationTitle();
        if (title !== null) Notification.make().success().title(title).send();
        if (another === true) { this.data = {}; fillSchema(this.getSchema('form'), this.data); return; }
        this.redirect(this.getRedirectUrl(record), true);
    }
    createAnother(): Promise<void> { return this.create(true); }
}

/** Delete action with confirmation. */
export class DeleteAction {
    /** On an edit page, deletes the page's record and returns to the list. On a table row, deletes the row. */
    static make(): Action {
        return Action.make('delete').authorize(({ livewire, record }) => canOn(livewire, 'delete', record))
            .label(t('filament-actions::delete.single.label')).color('danger').keyBindings(['mod+d']).tableIcon('c-trash').groupedIcon('m-trash')
            .requiresConfirmation().modalIcon('o-trash')
            // Hidden for an already soft-deleted record.
            .hidden(({ livewire, record }) => { const target = record ?? (livewire as any)._record; return target ? (livewire as any).getDataAdapter().isTrashed(target) : false; })
            .modalHeading(({ livewire, record }) => t('filament-actions::delete.single.modal.heading', { label: livewire.resource.getRecordTitle(record ?? livewire._record) }))
            .modalSubmitActionLabel(t('filament-actions::delete.single.modal.actions.delete.label'))
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const adapter = livewire.getDataAdapter();
                const inTable = typeof livewire.getTable === 'function';
                await adapter.delete(inTable ? adapter.getKey(record) : livewire.recordKey);
                await finishAction(ctx.action!, ctx, t('filament-actions::delete.single.notifications.deleted.title'), inTable ? null : livewire.resource.getUrl());
            });
    }
}

/**
 * Success outcome of a prebuilt action: its notification (`successNotificationTitle()`, `successNotification()`), then the
 * redirect (`successRedirectUrl()`, or `fallbackUrl`). Only local or http(s) URLs are followed.
 */
async function finishAction(action: Action, ctx: any, defaultTitle: string, fallbackUrl: string | null = null): Promise<void> {
    let notification: any = Notification.make().success().title(action.getSuccessNotificationTitle() ?? defaultTitle);
    const customize = action.getSuccessNotificationCustomizer();
    if (customize) notification = customize(notification, ctx);
    notification?.send();
    const url = (await action.getSuccessRedirectUrl(ctx)) ?? fallbackUrl;
    if (url && /^(\/(?!\/)|https?:\/\/)/.test(url)) ctx.livewire.redirect(url, true);
}

/** Replicate action: an `Action` with a list of attributes not to copy, and hooks around the saving of the copy. */
export type ReplicateActionInstance = Action & {
    excludeAttributes(attributes: string[]): ReplicateActionInstance;
    /** Runs before the copy is saved, with its attributes (`replica`, changeable) and the modal form's data. */
    beforeReplicaSaved(callback: (ctx: { replica: Record<string, unknown>; data: Record<string, unknown>; record: unknown }) => unknown): ReplicateActionInstance;
    /** Runs after the copy is saved, with the saved record. */
    afterReplicaSaved(callback: (ctx: { replica: unknown; data: Record<string, unknown>; record: unknown }) => unknown): ReplicateActionInstance;
};

/** Duplicates a table row: the copy takes the record's attributes, except its key, timestamps and excluded ones. */
export class ReplicateAction {
    static make(): ReplicateActionInstance {
        let excluded: string[] = [];
        let beforeSaved: ((ctx: any) => unknown) | null = null, afterSaved: ((ctx: any) => unknown) | null = null;
        const action = Action.make('replicate').authorize(({ livewire, record }) => canOn(livewire, 'replicate', record))
            .label(t('filament-actions::replicate.single.label')).tableIcon('c-square-2-stack').groupedIcon('m-square-2-stack')
            .modalHeading(({ livewire, record }) => t('filament-actions::replicate.single.modal.heading', { label: livewire.resource.getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::replicate.single.modal.actions.replicate.label'))
            // With a modal form (`schema()`), it is filled with the record's attributes; its data overrides them in the copy.
            .fillForm(({ record }) => {
                const source = typeof (record as any)?.toJSON === 'function' ? (record as any).toJSON() : { ...(record as any) };
                for (const attribute of ['id', 'created_at', 'updated_at', ...excluded]) delete source[attribute];
                return source;
            })
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const adapter = livewire.getDataAdapter();
                const source = typeof (record as any)?.toJSON === 'function' ? (record as any).toJSON() : { ...(record as any) };
                // No primary key, no created/updated timestamps.
                for (const attribute of ['id', 'created_at', 'updated_at', ...excluded]) delete source[attribute];
                const data = ctx.data ?? {};
                const replica: Record<string, unknown> = { ...source, ...data };
                await beforeSaved?.({ replica, data, record });
                const saved = await adapter.create(replica);
                await afterSaved?.({ replica: saved, data, record });
                await finishAction(ctx.action!, { ...ctx, replica: saved }, t('filament-actions::replicate.single.notifications.replicated.title'));
            }) as ReplicateActionInstance;
        action.excludeAttributes = (attributes: string[]) => { excluded = attributes; return action; };
        action.beforeReplicaSaved = (callback) => { beforeSaved = callback; return action; };
        action.afterReplicaSaved = (callback) => { afterSaved = callback; return action; };
        return action;
    }
}

/** Create in a modal with the resource form. */
export class CreateAction {
    /** Without an argument, the resource (or relation manager) is the host component's. */
    static make(resource: typeof Resource | null = null): Action {
        const of = (livewire: any) => resource ?? livewire.resource;
        return Action.make('create').authorize(({ livewire, record }) => canOn(livewire, 'create', record))
            .label(({ livewire }) => t('filament-actions::create.single.label', { label: of(livewire).modelLabel }))
            .modalHeading(({ livewire }) => t('filament-actions::create.single.modal.heading', { label: String(of(livewire).modelLabel).split(' ').map(ucfirst).join(' ') }))
            .modalSubmitActionLabel(t('filament-actions::create.single.modal.actions.create.label'))
            .extraModalFooterActions([Action.make('createAnother').label(t('filament-actions::create.single.modal.actions.create_another.label')).color('gray').action(`callMountedAction(${js({ another: true })})`)])
            .schema((schema: Schema) => of(schema.livewire).form(schema))
            .action(async (ctx) => {
                const record = await of(ctx.livewire).adapter.create(ctx.data);
                await saveSchemaRelationships(ctx.schema, record);
                await finishAction(ctx.action!, { ...ctx, record }, t('filament-actions::create.single.notifications.created.title'));
            });
    }
}

/** Edit a table row in a modal, with the resource form. */
export class EditAction {
    /** Without an argument, the resource (or relation manager) is the host component's. */
    static make(resource: typeof Resource | null = null): Action {
        const of = (livewire: any) => resource ?? livewire.resource;
        return Action.make('edit').authorize(({ livewire, record }) => canOn(livewire, 'update', record))
            .label(t('filament-actions::edit.single.label')).tableIcon('c-pencil-square').groupedIcon('m-pencil-square')
            .modalHeading(({ livewire, record }) => t('filament-actions::edit.single.modal.heading', { label: of(livewire).getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::edit.single.modal.actions.save.label'))
            .schema((schema: Schema) => of(schema.livewire).form(schema))
            .fillForm(({ record }) => ({ ...record }))
            .action(async (ctx) => {
                const adapter = of(ctx.livewire).adapter;
                const saved = await adapter.update(adapter.getKey(ctx.record), ctx.data);
                await saveSchemaRelationships(ctx.schema, saved ?? ctx.record);
                await finishAction(ctx.action!, ctx, t('filament-actions::edit.single.notifications.saved.title'));
            });
    }
}

/** Link to the record's view page (when the resource has one). */
export class ViewAction {
    static make(resource: typeof Resource | null = null): Action {
        const of = (livewire: any) => resource ?? livewire.resource;
        return Action.make('view').authorize(({ livewire, record }) => canOn(livewire, 'view', record))
            .label(t('filament-actions::view.single.label')).color('gray').tableIcon('c-eye').groupedIcon('m-eye')
            // Without a view page (simple resource, related records): the infolist opens in a modal.
            .url(({ livewire, record }) => (record && of(livewire).hasViewPage ? of(livewire).getUrl('view', of(livewire).adapter.getKey(record)) : null))
            .modalHeading(({ livewire, record }) => t('filament-actions::view.single.modal.heading', { label: of(livewire).getRecordTitle(record) }))
            .modalSubmitAction(false).modalCancelActionLabel(t('filament-actions::view.single.modal.actions.close.label'))
            .schema((schema: Schema) => (of(schema.livewire).hasViewPage || !of(schema.livewire).infolist ? null : of(schema.livewire).infolist(schema.operation('view'))));
    }
}

const managerOf = (livewire: any) => livewire.constructor as typeof RelationManager;
/** Attaches an existing record to a relation manager's owner. */
export class AttachAction {
    static make(): Action {
        return Action.make('attach')
            .label(t('filament-actions::attach.single.label')).color('gray').modalWidth('lg')
            .modalHeading(({ livewire }) => t('filament-actions::attach.single.modal.heading', { label: String(livewire.resource.modelLabel).split(' ').map(ucfirst).join(' ') }))
            .modalSubmitActionLabel(t('filament-actions::attach.single.modal.actions.attach.label'))
            .extraModalFooterActions([Action.make('attachAnother').label(t('filament-actions::attach.single.modal.actions.attach_another.label')).color('gray').action(`callMountedAction(${js({ another: true })})`)])
            .schema((schema: Schema) => {
                const livewire = schema.livewire as any;
                return [Select.make('recordId').label(t('filament-actions::attach.single.modal.fields.record_id.label')).hiddenLabel().required()
                    .getSearchResultsUsing((search) => managerOf(livewire).searchAttachable(livewire.ownerRecord, search))
                    .getOptionLabelUsing((value) => managerOf(livewire).attachableLabel(livewire.ownerRecord, value))];
            })
            .action(async ({ livewire, data }) => {
                await managerOf(livewire).attach(livewire.ownerRecord, String(data.recordId));
                Notification.make().success().title(t('filament-actions::attach.single.notifications.attached.title')).send();
            });
    }
}
/** Detaches a row from the owner without deleting it. */
export class DetachAction {
    static make(): Action {
        return Action.make('detach')
            .label(t('filament-actions::detach.single.label')).color('danger').icon('c-x-mark').groupedIcon('m-x-mark')
            .requiresConfirmation().modalIcon('o-x-mark')
            .modalHeading(({ livewire, record }) => t('filament-actions::detach.single.modal.heading', { label: livewire.resource.getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::detach.single.modal.actions.detach.label'))
            .action(async ({ livewire, record }) => {
                await managerOf(livewire).detach(livewire.ownerRecord, [livewire.resource.adapter.getKey(record)]);
                Notification.make().success().title(t('filament-actions::detach.single.notifications.detached.title')).send();
            });
    }
}
/** Detaches the selected rows. */
export class DetachBulkAction {
    static make(): Action {
        return Action.make('detach')
            .label(t('filament-actions::detach.multiple.label')).color('danger').icon('m-x-mark')
            .requiresConfirmation().modalIcon('o-x-mark')
            .modalHeading(({ livewire }) => t('filament-actions::detach.multiple.modal.heading', { label: livewire.resource.getPluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::detach.multiple.modal.actions.detach.label'))
            .action(async ({ livewire }) => {
                // Selected keys come from the manager's current query, so they belong to the owner.
                await managerOf(livewire).detach(livewire.ownerRecord, await livewire.getSelectedRecordKeys());
                Notification.make().success().title(t('filament-actions::detach.multiple.notifications.detached.title')).send();
                livewire.deselectAllTableRecords();
            });
    }
}

/** Restores a soft-deleted record. Only visible when the record is deleted. */
export class RestoreAction {
    static make(): Action {
        return Action.make('restore').authorize(({ livewire, record }) => canOn(livewire, 'restore', record))
            .label(t('filament-actions::restore.single.label')).color('gray')
            .requiresConfirmation().modalIcon('o-arrow-uturn-left')
            .hidden(({ livewire }) => !(livewire as any).getDataAdapter().isTrashed((livewire as any)._record))
            .modalHeading(({ livewire }) => t('filament-actions::restore.single.modal.heading', { label: livewire.resource.getRecordTitle(livewire._record) }))
            .modalSubmitActionLabel(t('filament-actions::restore.single.modal.actions.restore.label'))
            .action(async (ctx) => {
                await ctx.livewire.getDataAdapter().restore(ctx.livewire.recordKey);
                await ctx.livewire.hydrate();
                await finishAction(ctx.action!, ctx, t('filament-actions::restore.single.notifications.restored.title'));
            });
    }
}
/** Permanently deletes a soft-deleted record. Only visible when the record is deleted. */
export class ForceDeleteAction {
    static make(): Action {
        return Action.make('forceDelete').authorize(({ livewire, record }) => canOn(livewire, 'forceDelete', record))
            .label(t('filament-actions::force-delete.single.label')).color('danger')
            .requiresConfirmation().modalIcon('o-trash')
            .hidden(({ livewire }) => !(livewire as any).getDataAdapter().isTrashed((livewire as any)._record))
            .modalHeading(({ livewire }) => t('filament-actions::force-delete.single.modal.heading', { label: livewire.resource.getRecordTitle(livewire._record) }))
            .modalSubmitActionLabel(t('filament-actions::force-delete.single.modal.actions.delete.label'))
            .action(async (ctx) => {
                await ctx.livewire.getDataAdapter().forceDelete(ctx.livewire.recordKey);
                await finishAction(ctx.action!, ctx, t('filament-actions::force-delete.single.notifications.deleted.title'), ctx.livewire.resource.getUrl());
            });
    }
}

/** Actions of a list that may contain action groups: the groups' actions are mounted, never the groups. */
const flattenActions = (actions: (Action | ActionGroup)[]): Action[] => actions.flatMap((action) => (action instanceof ActionGroup ? action.getActions() : [action]));

/** Value of the table's trashed filter: `'1'` with deleted records, `'0'` only deleted records, `null` without. */
const trashedFilterValue = (livewire: any): string | null => {
    const filter = livewire.getTable?.().getFilters().find((candidate: any) => candidate instanceof TrashedFilter);
    const value = filter ? livewire.tableFilters?.[filter.name]?.value : null;
    return value === '1' || value === '0' ? value : null;
};

/**
 * Deletes the records selected in a table. Without `authorizeIndividualRecords()`, the selection is deleted in one query;
 * with it, record by record, and the notification reports the records that could not be deleted.
 */
export class DeleteBulkAction {
    static make(): Action {
        return Action.make('delete').authorize(({ livewire, record }) => canOn(livewire, 'deleteAny', record))
            .label(t('filament-actions::delete.multiple.label')).color('danger').icon('m-trash')
            .requiresConfirmation().modalIcon('o-trash')
            // Showing only deleted records: there is nothing left to delete.
            .hidden(({ livewire }) => trashedFilterValue(livewire) === '0')
            .modalHeading(({ livewire }) => t('filament-actions::delete.multiple.modal.heading', { label: livewire.resource.getTitleCasePluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::delete.multiple.modal.actions.delete.label'))
            .successNotificationTitle(t('filament-actions::delete.multiple.notifications.deleted.title'))
            .failureNotificationTitle((success, total) => (success ? tc('filament-actions::delete.multiple.notifications.deleted_partial.title', success, { count: success, total }) : tc('filament-actions::delete.multiple.notifications.deleted_none.title', total, { count: total, total })))
            .missingBulkAuthorizationFailureNotificationMessage((count, total) => tc(`filament-actions::delete.multiple.notifications.${count === total ? 'deleted_none' : 'deleted_partial'}.missing_authorization_failure_message`, count, { count }))
            .missingBulkProcessingFailureNotificationMessage((count, total) => tc(`filament-actions::delete.multiple.notifications.${count === total ? 'deleted_none' : 'deleted_partial'}.missing_processing_failure_message`, count, { count }))
            .deselectRecordsAfterCompletion()
            .action(async ({ livewire, action }) => {
                const adapter = livewire.getDataAdapterForTable();
                if (action!.getIndividualRecordsAuthorization() !== null) { await livewire.processSelectedRecords(action, (record: any) => adapter.delete(adapter.getKey(record))); return; }
                await adapter.deleteMany(await livewire.getSelectedRecordKeys());
                Notification.make().success().title(action!.getSuccessNotificationTitle() ?? t('filament-actions::delete.multiple.notifications.deleted.title')).send();
                livewire.deselectAllTableRecords();
            });
    }
}

/** Restores the soft-deleted records selected in a table, each one checked with the `restore` ability. */
export class RestoreBulkAction {
    static make(): Action {
        return Action.make('restore').authorize(({ livewire, record }) => canOn(livewire, 'restoreAny', record))
            .label(t('filament-actions::restore.multiple.label')).color('gray').icon('m-arrow-uturn-left')
            .requiresConfirmation().modalIcon('o-arrow-uturn-left')
            .hidden(({ livewire }) => trashedFilterValue(livewire) === null)
            .modalHeading(({ livewire }) => t('filament-actions::restore.multiple.modal.heading', { label: livewire.resource.getTitleCasePluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::restore.multiple.modal.actions.restore.label'))
            .authorizeIndividualRecords('restore')
            .successNotificationTitle(t('filament-actions::restore.multiple.notifications.restored.title'))
            .failureNotificationTitle((success, total) => (success ? tc('filament-actions::restore.multiple.notifications.restored_partial.title', success, { count: success, total }) : tc('filament-actions::restore.multiple.notifications.restored_none.title', total, { count: total, total })))
            .missingBulkAuthorizationFailureNotificationMessage((count, total) => tc(`filament-actions::restore.multiple.notifications.${count === total ? 'restored_none' : 'restored_partial'}.missing_authorization_failure_message`, count, { count }))
            .missingBulkProcessingFailureNotificationMessage((count, total) => tc(`filament-actions::restore.multiple.notifications.${count === total ? 'restored_none' : 'restored_partial'}.missing_processing_failure_message`, count, { count }))
            .deselectRecordsAfterCompletion()
            .action(async ({ livewire, action }) => {
                const adapter = livewire.getDataAdapterForTable();
                // Only deleted records are restored; the others count as failures.
                await livewire.processSelectedRecords(action, (record: any) => adapter.isTrashed(record) && adapter.restore(adapter.getKey(record)));
            });
    }
}

/** Permanently deletes the soft-deleted records selected in a table, each one checked with the `forceDelete` ability. */
export class ForceDeleteBulkAction {
    static make(): Action {
        return Action.make('forceDelete').authorize(({ livewire, record }) => canOn(livewire, 'forceDeleteAny', record))
            .label(t('filament-actions::force-delete.multiple.label')).color('danger').icon('m-trash')
            .requiresConfirmation().modalIcon('o-trash')
            .hidden(({ livewire }) => trashedFilterValue(livewire) === null)
            .modalHeading(({ livewire }) => t('filament-actions::force-delete.multiple.modal.heading', { label: livewire.resource.getTitleCasePluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::force-delete.multiple.modal.actions.delete.label'))
            .authorizeIndividualRecords('forceDelete')
            .successNotificationTitle(t('filament-actions::force-delete.multiple.notifications.deleted.title'))
            .failureNotificationTitle((success, total) => (success ? tc('filament-actions::force-delete.multiple.notifications.deleted_partial.title', success, { count: success, total }) : tc('filament-actions::force-delete.multiple.notifications.deleted_none.title', total, { count: total, total })))
            .missingBulkAuthorizationFailureNotificationMessage((count, total) => tc(`filament-actions::force-delete.multiple.notifications.${count === total ? 'deleted_none' : 'deleted_partial'}.missing_authorization_failure_message`, count, { count }))
            .missingBulkProcessingFailureNotificationMessage((count, total) => tc(`filament-actions::force-delete.multiple.notifications.${count === total ? 'deleted_none' : 'deleted_partial'}.missing_processing_failure_message`, count, { count }))
            .deselectRecordsAfterCompletion()
            .action(async ({ livewire, action }) => {
                const adapter = livewire.getDataAdapterForTable();
                await livewire.processSelectedRecords(action, (record: any) => adapter.forceDelete(adapter.getKey(record)));
            });
    }
}

/** Record edit page. */
export class EditRecord extends ResourceFormPage {
    static callable = ['save'];
    recordKey = '';
    /** Active relation manager tab (index in `Resource.relations`). */
    activeRelationManager = '0';
    /**
     * Previous page, captured on first display from the Referer header: only a same-site URL is accepted,
     * and it cannot be changed afterwards.
     */
    previousUrl = '';
    protected getCancelUrl(): string { return this.previousUrl; }
    contentSchema(schema: Schema): Schema {
        const content = super.contentSchema(schema);
        // Always present: hidden (empty column) when the resource has no relation manager.
        return content.components([...content.getComponents(), this.resource.relations.length ? new RelationManagerTabs() : new RelationManagerTabs().key(null).hidden()]);
    }
    static locked = ['recordKey', 'previousUrl'];
    _record: any = null;

    async mount(params: Record<string, unknown>): Promise<void> {
        this.recordKey = String(params.record ?? '');
        this.previousUrl = previousUrlOf((this._ctx as PanelContext | null)?.req);
        await this.hydrate();
        fillSchemaFromRecord(this.getSchema('form'), this.data, await this.mutateFormDataBeforeFill({ ...this._record }));
        await loadSchemaRelationships(this.getSchema('form'), this.data, this._record);
    }
    /** The record is reloaded on every request (no route model binding). */
    async hydrate(): Promise<void> {
        this._record = await this.getDataAdapter().find(this.recordKey);
        if (!this._record) throw new WireError(404, 'Record not found.');
        if (!(await canOn(this, 'update', this._record))) throw new WireError(403, 'Forbidden.');
    }
    protected getRecord(): unknown { return this._record; }
    getRecordKey(): string | null { return this.recordKey; }
    getActionMountContext(): Record<string, unknown> { return { recordKey: this.recordKey }; }
    protected getActionRecord(): unknown { return this._record; }
    /** Delete, plus restore and force-delete when the model uses soft deletes. */
    getHeaderActions(): Action[] {
        const defaults = this.getDataAdapter().supportsSoftDeletes() ? [DeleteAction.make(), RestoreAction.make(), ForceDeleteAction.make()] : [DeleteAction.make()];
        // Resource-specific actions come before the default ones.
        return [...((this.resource as any).editHeaderActions?.() ?? []), ...defaults];
    }
    getOperation(): 'edit' { return 'edit'; }
    getSubmitMethod(): string { return 'save'; }
    getTitle(): string { return t('filament-panels::resources/pages/edit-record.title', { label: this.resource.getRecordTitle(this._record) }); }
    getBreadcrumbs(): { label: string; url: string | null }[] {
        return [
            { label: this.resource.getTitleCasePluralModelLabel(), url: this.resource.getUrl() },
            // The record title only appears if the resource declares `recordTitleAttribute`; it links to the view page when there is one.
            ...(this.resource.recordTitleAttribute ? [{ label: this.resource.getRecordTitle(this._record), url: this.resource.getUrl(this.resource.hasViewPage ? 'view' : 'edit', this.recordKey) }] : []),
            { label: t('filament-panels::resources/pages/edit-record.breadcrumb'), url: null },
        ];
    }
    getSubNavigation(): SubNavigationItem[] { return this.resource.getRecordSubNavigation(this); }
    getPageClasses(): string[] { return ['fi-resource-edit-record-page', `fi-resource-${this.resource.slug.replace(/\//g, '-')}`, `fi-resource-record-${this.recordKey}`]; }
    getFormActions(): Action[] {
        return [Action.make('save').label(t('filament-panels::resources/pages/edit-record.form.actions.save.label')).submit('save').keyBindings(['mod+s']), this.cancelAction()];
    }
    // --- lifecycle hooks, to override in a subclass (none can be called from the browser)
    /** Transforms the record's values before filling the form. */
    protected mutateFormDataBeforeFill(data: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> { return data; }
    /** Transforms validated data before saving. */
    protected mutateFormDataBeforeSave(data: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> { return data; }
    /** Right before saving; throwing cancels it. */
    protected beforeSave(_data: Record<string, unknown>): void | Promise<void> {}
    /** The save itself; defaults to the resource's data adapter. */
    protected handleRecordUpdate(record: any, data: Record<string, unknown>): Promise<any> { return this.getDataAdapter().update(this.getDataAdapter().getKey(record), data); }
    /** After saving. */
    protected afterSave(_record: any): void | Promise<void> {}
    /** URL to go to after saving; `null` (default) stays on the page. */
    protected getRedirectUrl(_record: any): string | null { return null; }
    /** Success notification title; `null` to show nothing. */
    protected getSavedNotificationTitle(): string | null { return t('filament-panels::resources/pages/edit-record.notifications.saved.title'); }

    async save(): Promise<void> {
        if (!(await this.validateForm())) return;
        const data = await this.mutateFormDataBeforeSave(await getSchemaState(this.getSchema('form')));
        await this.beforeSave(data);
        this._record = await this.handleRecordUpdate(this._record, data);
        await saveSchemaRelationships(this.getSchema('form'), this._record);
        await this.afterSave(this._record);
        const title = this.getSavedNotificationTitle();
        if (title !== null) Notification.make().success().title(title).send();
        const url = this.getRedirectUrl(this._record);
        if (url !== null) this.redirect(url, true);
    }
}

/** Record view page: the resource's read-only `infolist()` schema. */
export class ViewRecord extends Page {
    static resource: typeof Resource;
    static locked = ['recordKey'];
    recordKey = '';
    /** Active relation manager tab (index in `Resource.relations`). */
    activeRelationManager = '0';
    _record: any = null;
    get resource(): typeof Resource { return (this.constructor as typeof ViewRecord).resource; }
    getDataAdapter(): DataAdapter { return this.resource.adapter; }
    async mount(params: Record<string, unknown>): Promise<void> {
        this.recordKey = String(params.record ?? '');
        await this.hydrate();
    }
    /** The record is reloaded on every request, as on the edit page. */
    async hydrate(): Promise<void> {
        this._record = await this.getDataAdapter().find(this.recordKey);
        if (!this._record) throw new WireError(404, 'Record not found.');
        if (!(await canOn(this, 'view', this._record))) throw new WireError(403, 'Forbidden.');
    }
    getRecordKey(): string | null { return this.recordKey; }
    getActionMountContext(): Record<string, unknown> { return { recordKey: this.recordKey }; }
    protected getActionRecord(): unknown { return this._record; }
    infolistSchema(schema: Schema): Schema { return this.resource.infolist(schema.columns(2).operation('view').record(this._record)); }
    contentSchema(schema: Schema): Schema {
        const content = schema.components([EmbeddedSchema.make('infolist')]);
        // Always present: hidden (empty column) when the resource has no relation manager.
        return content.components([...content.getComponents(), this.resource.relations.length ? new RelationManagerTabs() : new RelationManagerTabs().key(null).hidden()]);
    }
    /** Defaults to a link to the edit page. */
    getHeaderActions(): Action[] { return [this.editAction()]; }
    protected editAction(): Action {
        return Action.make('edit').authorize(({ livewire, record }) => canOn(livewire, 'update', record)).label(t('filament-actions::edit.single.label')).url(() => this.resource.getUrl('edit', this.recordKey));
    }
    getTitle(): string { return t('filament-panels::resources/pages/view-record.title', { label: this.resource.getRecordTitle(this._record) }); }
    getBreadcrumbs(): { label: string; url: string | null }[] {
        return [
            { label: this.resource.getTitleCasePluralModelLabel(), url: this.resource.getUrl() },
            // The record title only appears if the resource declares `recordTitleAttribute`.
            ...(this.resource.recordTitleAttribute ? [{ label: this.resource.getRecordTitle(this._record), url: this.resource.getUrl('view', this.recordKey) }] : []),
            { label: t('filament-panels::resources/pages/view-record.breadcrumb'), url: null },
        ];
    }
    getSubNavigation(): SubNavigationItem[] { return this.resource.getRecordSubNavigation(this); }
    getPageClasses(): string[] { return ['fi-resource-view-record-page', `fi-resource-${this.resource.slug.replace(/\//g, '-')}`, `fi-resource-record-${this.recordKey}`]; }
}

/** Evaluation context for panel menu actions (no record). */
const menuContext = (livewire: unknown) => ({ livewire: livewire as any, component: null as any, operation: null, record: null, get: () => undefined, state: undefined });
/** User menu: profile, panel items, themes, logout. */
async function renderUserMenu(component: Component, position: 'topbar' | 'sidebar'): Promise<string> {
    const { req, res, panel, user } = component._ctx as PanelContext;
    const ctx = menuContext(component);
    const items: Action[] = [];
    const profileUrl = panel.getProfileUrl();
    const custom = panel.getUserMenuItems();
    if (profileUrl && !custom.profile) items.push(Action.make('profile').label(panel.getProfile()!.page.getLabel()).icon('m-user-circle').url(profileUrl).color('gray').sort(-1));
    items.push(...Object.values(custom));
    const visible: Action[] = [];
    for (const item of items) if (await item.isVisible(ctx)) visible.push(item);
    visible.sort((a, b) => a.getSort() - b.getSort());
    const html = async (list: Action[]) => (await Promise.all(list.map((item) => item.toMenuItemHtml(ctx, { navigate: panel.hasSpaMode() })))).filter(Boolean);
    return views.render('filament-panels::components.user-menu', {
        position, isSidebarCollapsibleOnDesktop: panel.isSidebarCollapsibleOnDesktop(), user: user!, avatarUrl: panel.getUserAvatarUrl(user!), logoutUrl: panel.getLogoutUrl(), csrf: csrfToken(req, res),
        profileUrl: profileUrl && !custom.profile ? profileUrl : null,
        itemsBefore: await html(visible.filter((item) => item.getSort() < 0)), itemsAfter: await html(visible.filter((item) => item.getSort() >= 0)),
        themes: panel.getThemes().map((theme) => ({ id: theme.id, label: theme.label, swatch: swatchOf(theme, panel) })), activeTheme: panel.resolveTheme(req)?.id ?? null,
    });
}
/** Tenant menu: current tenant, other tenants, registration, profile. */
async function renderTenantMenu(component: Component, options: { teleport: boolean }): Promise<string> {
    const { panel, user } = component._ctx as PanelContext;
    const tenant = panel.getTenant();
    if (!panel.hasTenancy() || !panel.hasTenantMenu() || !tenant || !user) return '';
    const provider = panel.getTenantProvider();
    const ctx = menuContext(component);
    const items: Action[] = [];
    const custom = panel.getTenantMenuItems();
    const ProfilePage = panel.getTenantProfilePage();
    if (ProfilePage && provider.update && !custom.profile) items.push(Action.make('profile').label(ProfilePage.getLabel()).icon('m-cog-6-tooth').url(panel.getUrl(ProfilePage.slug)).color('gray').sort(-1));
    const RegistrationPage = panel.getTenantRegistrationPage();
    if (RegistrationPage && !custom.register && (await RegistrationPage.canView(panel, user))) items.push(Action.make('register').label(RegistrationPage.getLabel()).icon('m-plus').url(panel.getBaseUrl(RegistrationPage.slug)).color('gray').sort(Number.MAX_SAFE_INTEGER));
    items.push(...Object.values(custom));
    const visible: Action[] = [];
    for (const item of items) if (await item.isVisible(ctx)) visible.push(item);
    visible.sort((a, b) => a.getSort() - b.getSort());
    const others = (await provider.getTenants(user)).filter((candidate) => provider.getKey(candidate) !== provider.getKey(tenant));
    const canSwitch = others.length > 0;
    const html = async (list: Action[]) => (await Promise.all(list.map((item) => item.toMenuItemHtml(ctx, { navigate: panel.hasSpaMode() })))).filter(Boolean);
    return views.render('filament-panels::components.tenant-menu', {
        teleport: options.teleport, isSidebarCollapsibleOnDesktop: panel.isSidebarCollapsibleOnDesktop(),
        tenant: { name: provider.getName(tenant), label: provider.getCurrentTenantLabel?.(tenant) ?? null, avatarUrl: panel.getTenantAvatarUrl(tenant) },
        itemsBefore: canSwitch ? await html(visible.filter((item) => item.getSort() < 0)) : [],
        itemsAfter: await html(canSwitch ? visible.filter((item) => item.getSort() >= 0) : visible),
        switchable: others.map((other) => ({ name: provider.getName(other), url: panel.getUrl('', other), avatarUrl: panel.getTenantAvatarUrl(other) })),
    });
}

/** Sidebar: logo, tenant menu, search, navigation and, without a topbar, the bell and user menu. */
export class Sidebar extends Component {
    static callable = ['setTheme'];
    currentPath = '/';
    static locked = ['currentPath'];
    mount(params: Record<string, unknown>): void { this.currentPath = String(params.path ?? '/'); }
    /** A resource item stays active on its create and edit pages. */
    async render(): Promise<string> {
        const { panel, user } = this._ctx as PanelContext;
        if (!user) return '<div></div>';
        const inSidebar = (position: 'topbar' | 'sidebar') => position === 'sidebar';
        return views.render('filament-panels::livewire.sidebar', {
            hasTopbar: panel.hasTopbar(), hasTopNavigation: panel.hasTopNavigation(), spa: panel.hasSpaMode(),
            isSidebarCollapsibleOnDesktop: panel.isSidebarCollapsibleOnDesktop(), isSidebarFullyCollapsibleOnDesktop: panel.isSidebarFullyCollapsibleOnDesktop(),
            tenantMenu: (await renderTenantMenu(this, { teleport: false })) || null,
            globalSearch: panel.hasGlobalSearch() && inSidebar(panel.getGlobalSearchPosition()) ? await this.mountChild(`navette.${panel.getId()}.global-search`, {}, `${this.id}.global-search`) : null,
            databaseNotifications: panel.getDatabaseNotifications() && inSidebar(panel.getDatabaseNotificationsPosition()) ? await this.mountChild(`navette.${panel.getId()}.database-notifications`, {}, `${this.id}.database-notifications`, { lazy: true }) : null,
            userMenu: inSidebar(panel.getUserMenuPosition()) ? await renderUserMenu(this, 'sidebar') : null,
            homeUrl: panel.getUrl(), brand: panel.getBrand(), groups: panel.getNavigation(this.currentPath, await panel.resolveNavigationBadges(), await panel.resolveInaccessiblePages(user)),
            livewireId: this.id,
        });
    }
    /** Theme choice by the user: only a theme declared by the panel is accepted; the page reloads to apply it. */
    setTheme(id: unknown): void { applyTheme(this, id); this.skipRender(); }
}
/** Theme choice (sidebar or topbar): only a theme declared by the panel is accepted; the page reloads. */
function applyTheme(component: Component, id?: unknown): void {
    const { req, res, panel, user } = component._ctx as PanelContext;
    if (!user) throw new WireError(401, 'Unauthenticated.');
    const theme = panel.getThemes().find((candidate) => candidate.id === id);
    if (!theme) throw new WireError(404, 'Unknown theme.');
    panel.rememberTheme(res, theme);
    const referer = previousUrlOf(req);
    component.redirect(referer.replace(/^https?:\/\/[^/]+/, '') || '/');
}

/** Topbar: logo, optional navigation, search, bell, user menu. */
export class Topbar extends Component {
    static callable = ['setTheme'];
    currentPath = '/';
    static locked = ['currentPath'];
    mount(params: Record<string, unknown>): void { this.currentPath = String(params.path ?? '/'); }
    async render(): Promise<string> {
        const { panel, user } = this._ctx as PanelContext;
        if (!user) return '<div></div>';
        const inTopbar = (position: 'topbar' | 'sidebar') => position === 'topbar';
        const hasNavigation = panel.hasNavigation();
        const showsNavigationHere = panel.hasTopNavigation() || !hasNavigation;
        const tenant = panel.getTenant();
        const groups = showsNavigationHere && hasNavigation ? panel.getNavigation(this.currentPath, await panel.resolveNavigationBadges(), await panel.resolveInaccessiblePages(user)) : null;
        return views.render('filament-panels::livewire.topbar', {
            hasNavigation, spa: panel.hasSpaMode(), isSidebarCollapsibleOnDesktop: panel.isSidebarCollapsibleOnDesktop(), isSidebarFullyCollapsibleOnDesktop: panel.isSidebarFullyCollapsibleOnDesktop(),
            homeUrl: panel.getUrl(), brand: panel.getBrand(), livewireId: this.id,
            tenantMenu: showsNavigationHere ? (await renderTenantMenu(this, { teleport: true })) || null : null,
            topNavigation: groups?.map((group) => ({ ...group, items: group.items.map((item) => ({ ...item, colorClasses: item.isActive ? sharedColors.getComponentClasses('dropdown-item', 'primary') : [] })) })) ?? null,
            persistKey: panel.hasTenancy() ? `topbar.end.panel-${panel.getId()}.tenant-${tenant ? panel.getTenantUrlKey(tenant) : ''}` : `topbar.end.panel-${panel.getId()}`,
            globalSearch: panel.hasGlobalSearch() && inTopbar(panel.getGlobalSearchPosition()) ? await this.mountChild(`navette.${panel.getId()}.global-search`, {}, `${this.id}.global-search`) : null,
            databaseNotifications: panel.getDatabaseNotifications() && inTopbar(panel.getDatabaseNotificationsPosition()) ? await this.mountChild(`navette.${panel.getId()}.database-notifications`, {}, `${this.id}.database-notifications`, { lazy: true }) : null,
            userMenu: inTopbar(panel.getUserMenuPosition()) ? await renderUserMenu(this, 'topbar') : null,
        });
    }
    setTheme(id: unknown): void { applyTheme(this, id); this.skipRender(); }
}

/** User menu on simple pages for a signed-in user. */
export class SimpleUserMenu extends Component {
    static callable = ['setTheme'];
    async render(): Promise<string> {
        if (!(this._ctx as PanelContext).user) return '<div></div>';
        return `<div><div class="fi-simple-user-menu-ctn">${await renderUserMenu(this, 'topbar')}</div><div wire:partial="action-modals" x-data="filamentActionModals({
                    livewireId: ${js(this.id)},
                })" style="height: 0"></div></div>`;
    }
    setTheme(id: unknown): void { applyTheme(this, id); this.skipRender(); }
}

/** `.ts`, `.mts`, `.js`, `.mjs` modules of a folder and its subfolders, in alphabetical path order. */
function moduleFiles(directory: string | URL): string[] {
    const root = directory instanceof URL ? fileURLToPath(directory) : directory;
    if (!existsSync(root)) return [];
    const files: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(m?ts|m?js)$/.test(entry.name) && !/\.(d|test|spec)\.m?[tj]s$/.test(entry.name)) files.push(full);
        }
    };
    walk(root);
    return files;
}
/** Classes exported by a folder's modules that extend `base` (the base class itself, abstract or imported, is skipped). */
async function discoverClasses<T extends abstract new (...args: any[]) => any>(directory: string | URL, base: T): Promise<T[]> {
    const found: T[] = [];
    for (const file of moduleFiles(directory)) {
        const module = await import(pathToFileURL(file).href);
        for (const value of Object.values(module)) if (typeof value === 'function' && value.prototype instanceof base && !found.includes(value as T)) found.push(value as T);
    }
    return found;
}
/** Resources defined in a folder: `.resources(await discoverResources(new URL('./resources/', import.meta.url)))`. New files are picked up on the next start. */
export const discoverResources = (directory: string | URL) => discoverClasses(directory, Resource as any) as Promise<(typeof Resource)[]>;
/** Custom pages (and dashboards) defined in a folder. Resource and authentication pages are excluded. */
export const discoverPages = async (directory: string | URL) => (await discoverClasses(directory, Page as any)).filter((page: any) => !page.resource && !(page.prototype instanceof EditTenantProfile)) as (typeof Page)[];
/** Widgets defined in a folder. */
export const discoverWidgets = (directory: string | URL) => discoverClasses(directory, Widget as any) as Promise<(typeof Widget)[]>;
/** Panels default-exported (`export default Panel.make()…`) by a folder's modules. */
export async function discoverPanels(directory: string | URL): Promise<Panel[]> {
    const panels: Panel[] = [];
    for (const file of moduleFiles(directory)) {
        const module = await import(pathToFileURL(file).href);
        if (module.default instanceof Panel) panels.push(module.default);
    }
    return panels;
}

/** A runtime serves a single panel: each panel has its own Livewire endpoint and components. */
const runtimePanels = new WeakMap<WireRuntime, Panel>();
/** Reserved segments right after a multi-tenant panel's path (they are not tenant keys). */
const RESERVED_SEGMENTS = new Set(['login', 'logout', 'register', 'password-reset', 'email-verification', 'profile', 'livewire']);

/** Express router for a panel: assets, runtime endpoint, authentication, tenants, protected pages. */
/** Panels sharing an auth guard: same key and same auth provider, otherwise a user id of one could be read as a user of the other. */
const guardOwners = new Map<string, Panel>();
function checkSharedGuard(panel: Panel): void {
    const guard = panel.getAuthGuard();
    if (guard === null) return;
    const other = guardOwners.get(guard);
    if (!other || other === panel) { guardOwners.set(guard, panel); return; }
    if ((other as any)._key !== (panel as any)._key) throw new Error(`Panels "${other.getId()}" and "${panel.getId()}" share the auth guard "${guard}" but not the same key: give them the same key, or a different authGuard().`);
    if (other.getAuth() !== panel.getAuth()) throw new Error(`Panels "${other.getId()}" and "${panel.getId()}" share the auth guard "${guard}" but not the same auth provider: share the provider, or give one of them authGuard(null) or another guard.`);
}

export function panelRouter(panel: Panel, runtime: WireRuntime): Router {
    checkSharedGuard(panel);
    const owner = runtimePanels.get(runtime);
    if (owner && owner !== panel) throw new Error(`This WireRuntime already serves panel "${owner.getId()}": create one WireRuntime per panel.`);
    runtimePanels.set(runtime, panel);
    // File uploads go through this panel's endpoint (panel session and user).
    const runtimeOptions = (runtime as any).options as { uploadPrefix?: string };
    runtimeOptions.uploadPrefix ??= panel.getLivewirePrefix();
    // One color manager for all panels: each request sets its own panel's colors on it.
    useColorManager(sharedColors);
    useFormsColorManager(sharedColors);
    useTableColorManager(sharedColors);
    useInfolistsColorManager(sharedColors);
    // HTML rendered by an infolist entry is sanitized through the rich editor schema, which only keeps its own tags.
    useHtmlSanitizer((html) => richDocumentToHtml(richHtmlToDocument(html)) ?? '');
    views.share({ assetUrl: (file: string) => panel.assetUrl(file) });
    for (const plugin of panel.getPlugins()) plugin.boot?.(panel);
    assertAuthCapabilities(panel);
    // Tenancy: scoped resources only see the records of the request's tenant.
    const ownership = panel.getTenantOwnershipColumn();
    if (panel.hasTenancy() && ownership) {
        for (const resource of panel.getResources()) {
            if (!resource.isScopedToTenant) continue;
            const adapter = resource.adapter as any;
            if (typeof adapter?.scopeToTenant !== 'function') throw new Error(`Resource ${resource.name}: its adapter does not support tenant scoping (scopeToTenant).`);
            adapter.scopeToTenant(resource.tenantOwnershipColumn ?? ownership, () => { const tenant = panel.getTenant(); return tenant ? panel.getTenantUrlKey(tenant) : null; });
        }
    }
    const router = express.Router();
    const name = (suffix: string) => `navette.${panel.getId()}.${suffix}`;
    const livewire = panel.getLivewirePrefix();
    // The notifications mailbox is per browser: it is keyed by the CSRF token.
    const context = async (req: Request, res: Response): Promise<PanelContext> => {
        const user = await panel.user(req);
        // Signed in through a shared session, but not allowed into this panel: treated as a guest that gets 403 pages.
        const denied = user !== null && !(await panel.userCanAccess(user));
        return { req, res, panel, user: denied ? null : user, denied, mailbox: csrfToken(req, res), tenant: null };
    };
    const forbidden = (res: Response) => void res.status(403).send('Forbidden');

    /** Tenant designated by a panel URL, if the user is a member. */
    const tenantFromPath = async (path: string, user: User | null): Promise<unknown> => {
        if (!panel.hasTenancy() || !user) return null;
        const base = panel.getBaseUrl();
        const prefix = base === '/' ? '/' : `${base}/`;
        if (!path.startsWith(prefix)) return null;
        let key: string;
        try { key = decodeURIComponent(path.slice(prefix.length).split('/')[0] ?? ''); } catch { return null; }
        const registration = panel.getTenantRegistrationPage();
        if (!key || RESERVED_SEGMENTS.has(key) || key === registration?.slug || key.length > 200) return null;
        const provider = panel.getTenantProvider();
        const tenant = await provider.find(key);
        return tenant && (await provider.canAccess(user, tenant)) ? tenant : null;
    };
    /** User's home: the panel root or, in a multi-tenant panel, their first tenant's root (otherwise tenant registration). */
    const homeUrl = async (user: User): Promise<string | null> => {
        if (!panel.hasTenancy()) return panel.getUrl();
        const [first] = await panel.getTenantProvider().getTenants(user);
        if (first) return panel.getUrl('', first);
        const registration = panel.getTenantRegistrationPage();
        return registration && (await registration.canView(panel, user)) ? panel.getBaseUrl(registration.slug) : null;
    };

    const LoginPage = panel.getLoginPage();
    if (LoginPage) runtime.register(name('auth.login'), LoginPage);
    const RegistrationPage = panel.getRegistrationPage();
    if (RegistrationPage) runtime.register(name('auth.register'), RegistrationPage);
    const passwordReset = panel.getPasswordResetPages();
    if (passwordReset) { runtime.register(name('auth.password-reset.request'), passwordReset.request); runtime.register(name('auth.password-reset.reset'), passwordReset.reset); }
    const VerificationPrompt = panel.getEmailVerificationPrompt();
    if (VerificationPrompt) runtime.register(name('auth.email-verification.prompt'), VerificationPrompt);
    const profile = panel.getProfile();
    if (profile) runtime.register(name('auth.profile'), profile.page);
    const TenantRegistration = panel.getTenantRegistrationPage();
    if (TenantRegistration) runtime.register(name('tenancy.registration'), TenantRegistration as any);
    const TenantProfile = panel.getTenantProfilePage();
    if (TenantProfile && !panel.getPages().includes(TenantProfile)) panel.pages([TenantProfile]);
    runtime.register(name('sidebar'), Sidebar);
    runtime.register(name('topbar'), Topbar);
    runtime.register(name('simple-user-menu'), SimpleUserMenu);
    runtime.register(name('global-search'), GlobalSearch);
    runtime.register(name('database-notifications'), DatabaseNotifications);
    runtime.register('navette.notifications', Notifications);
    for (const [index, widget] of panel.getWidgets().entries()) runtime.register(name(`widgets.panel.${index}`), widget);
    for (const resource of panel.getResources()) for (const [index, widget] of resource.widgets.entries()) runtime.register(name(`widgets.${resource.slug.replace(/\//g, '.')}.${index}`), widget);
    for (const resource of panel.getResources()) for (const manager of resource.relations) runtime.register(name(`relation-managers.${resource.slug.replace(/\//g, '.')}.${manager.relationship}`), manager);

    router.use(express.static(dir('../dist/filament'), { maxAge: '1y' }));
    // Navette's own front-end files.
    router.use(express.static(dir('../dist/navette')));
    // An update's tenant is the one of the page sending it (from the signed snapshot URL), if the user is a member.
    const wireContext = async (req: Request, res: Response): Promise<PanelContext> => {
        const ctx = await context(req, res);
        let path = '';
        try { path = String(JSON.parse(req.body?.components?.[0]?.snapshot ?? '{}')?.memo?.path ?? ''); } catch { path = ''; }
        ctx.tenant = await tenantFromPath(path, ctx.user);
        return ctx;
    };
    // Notifications sent during the request go into a batch announced to the browser.
    router.use(wireRouter(runtime, livewire, wireContext, async (ctx: PanelContext, _req, res, handle) => {
        const { result, pending } = await runInRequest(ctx.mailbox, () => panel.withTheme(ctx.req, () => panel.withTenant(ctx.tenant ?? null, handle)));
        if (pending.length) {
            const batch = publish(ctx.mailbox, pending);
            result.filamentNotificationBatch = batch;
            result.filamentNotifications = true;
            res.setHeader('X-Filament-Notifications', batch);
            if (result.components.some((c: any) => c.effects?.redirect)) res.setHeader('X-Filament-Notifications-Redirect', 'true');
        }
        return result;
    // Only a signed-in user can upload files.
    }, (ctx: PanelContext) => !!ctx.user));

    type DocumentOptions = { title: string; component: string; layout: 'simple' | 'index'; params?: Record<string, unknown> };
    // A page renders entirely with the request theme's colors, for the request's tenant.
    const document = (req: Request, res: Response, ctx: PanelContext, options: DocumentOptions) => panel.withTheme(req, () => panel.withTenant(ctx.tenant ?? null, () => renderDocument(req, res, ctx, options)));
    const renderDocument = async (req: Request, res: Response, ctx: PanelContext, options: DocumentOptions) => {
        const request = { path: req.path, method: req.method, ctx };
        const mounted = await runtime.mountWithInstance(options.component, options.params ?? {}, request);
        // A page that redirects on mount (already logged in, email already verified…): HTTP redirect.
        const redirect = (mounted.component as any)._effects?.redirect;
        if (typeof redirect === 'string') return void res.redirect(redirect);
        const slot = mounted.html;
        // The document title comes from the instance (it may depend on the record).
        const instanceTitle = (mounted.component as any).getTitle?.();
        if (typeof instanceTitle === 'string') options.title = instanceTitle;
        // Layout render hooks use the scopes of the displayed page.
        const renderHookScopes = (mounted.component as any).getRenderHookScopes?.() ?? [];
        const hasNavigation = panel.hasNavigation();
        const body = options.layout === 'simple'
            ? views.render('filament-panels::layout.simple', {
                slot, renderHookScopes,
                header: panel.hasTopbar() && ctx.user ? (await runtime.mount(name('simple-user-menu'), {}, request)).replace(/^s*<div /, '<div wire:key="lw-1-1-0" ') : null,
            })
            : views.render('filament-panels::layout.index', {
                slot, maxContentWidth: panel.getMaxContentWidth(), renderHookScopes, hasNavigation, hasTopNavigation: panel.hasTopNavigation(),
                isSidebarCollapsibleOnDesktop: panel.isSidebarCollapsibleOnDesktop(), isSidebarFullyCollapsibleOnDesktop: panel.isSidebarFullyCollapsibleOnDesktop(),
                topbar: panel.hasTopbar() ? (await runtime.mount(name('topbar'), { path: req.path }, request)).replace(/^s*<div /, '<div wire:key="lw-1-0-1" ') : null,
                sidebar: hasNavigation ? (await runtime.mount(name('sidebar'), { path: req.path }, request)).replace(/^s*<div /, '<div wire:key="lw-1-1-1" ') : '',
            });
        const bodyClass = options.layout === 'index' ? cls([{ 'fi-body-has-navigation': hasNavigation, 'fi-body-has-sidebar-collapsible-on-desktop': panel.isSidebarCollapsibleOnDesktop(), 'fi-body-has-sidebar-fully-collapsible-on-desktop': panel.isSidebarFullyCollapsibleOnDesktop(), 'fi-body-has-topbar': panel.hasTopbar(), 'fi-body-has-top-navigation': panel.hasTopNavigation() }]) || null : null;
        res.send(views.render('filament-panels::layout.base', {
            renderHookScopes, title: options.title, brandName: panel.getBrandName(), favicon: panel.getFavicon(), theme: panel.getTheme(), motion: panel.hasMotion(), panelId: panel.getId(), font: panel.resolveTheme(req)?.font ? { ...panel.getFont(), ...fontOf(panel.resolveTheme(req)!.font!) } : panel.getFont(), themeCss: panel.resolveTheme(req)?.css ?? '',
            bodyClass, body, spa: panel.hasSpaMode(),
            csrf: csrfToken(req, res), colorVariables: panel.colors.renderCssVariables(), wireStyles: wireStyles(), wireScripts: wireScripts(req, res, livewire),
            notifications: (await runtime.mount('navette.notifications', {}, request)).replace(/^<div /, '<div wire:key="lw-1-0-0" '),
        }));
    };
    /** Page access errors: 404 and 403 are answered directly, anything else is rethrown. */
    const guarded = async (res: Response, render: () => Promise<void>) => {
        try { await render(); } catch (error) {
            if (error instanceof WireError && error.status === 404) return void res.status(404).send('Not Found');
            if (error instanceof WireError && error.status === 403) return void res.status(403).send('Forbidden');
            throw error;
        }
    };
    /** Guest-only simple page (login, registration, password reset). */
    const guestPage = (path: string, component: string, title: string, params: (req: Request) => Record<string, unknown> = () => ({})) => {
        router.get(panel.getBaseUrl(path), async (req, res) => {
            const ctx = await context(req, res);
            if (ctx.denied) return forbidden(res);
            if (ctx.user) return res.redirect((await homeUrl(ctx.user)) ?? panel.getBaseUrl());
            await guarded(res, () => document(req, res, ctx, { title, component, layout: 'simple', params: params(req) }));
        });
    };
    /** Simple page for a signed-in user, outside any tenant (profile, email verification, tenant registration). */
    const userPage = (path: string, component: string, title: string, layout: 'simple' | 'index' = 'simple') => {
        router.get(panel.getBaseUrl(path), async (req, res) => {
            const ctx = await context(req, res);
            if (ctx.denied) return forbidden(res);
            if (!ctx.user) return res.redirect(panel.getLoginUrl());
            await guarded(res, () => document(req, res, ctx, { title, component, layout }));
        });
    };

    // Files offered to the signed-in user (exports, failed import rows): only the user who created them can download them.
    router.get(panel.getBaseUrl('downloads/:token'), async (req, res) => {
        const ctx = await context(req, res);
        if (!ctx.user || ctx.denied) return forbidden(res);
        const file = panel.getDownloads().get(String(req.params.token), ctx.user.id);
        if (!file) return void res.status(404).send('Not Found');
        res.setHeader('Content-Type', file.type);
        res.setHeader('Content-Disposition', `attachment; filename="${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(file.content);
    });

    if (LoginPage) {
        guestPage('login', name('auth.login'), t('filament-panels::auth/pages/login.title'));
        router.post(panel.getLogoutUrl(), express.urlencoded({ extended: false }), (req, res) => {
            if (!verifyCsrf(req, req.body?._token)) return res.status(419).send('Invalid CSRF token.');
            panel.logOut(res);
            res.redirect(panel.getLoginUrl());
        });
    }
    if (RegistrationPage) guestPage('register', name('auth.register'), t('filament-panels::auth/pages/register.title'));
    if (passwordReset) {
        guestPage('password-reset/request', name('auth.password-reset.request'), t('filament-panels::auth/pages/password-reset/request-password-reset.title'));
        guestPage('password-reset/reset', name('auth.password-reset.reset'), t('filament-panels::auth/pages/password-reset/reset-password.title'), (req) => ({ email: typeof req.query.email === 'string' ? req.query.email : null, token: typeof req.query.token === 'string' ? req.query.token : null }));
    }
    if (VerificationPrompt) {
        userPage('email-verification/prompt', name('auth.email-verification.prompt'), t('filament-panels::auth/pages/email-verification/email-verification-prompt.title'));
        // Emailed link: signed, time-limited, and only valid for the signed-in user it designates.
        router.get(panel.getBaseUrl('email-verification/verify/:id/:hash'), async (req, res) => {
            const ctx = await context(req, res);
            if (ctx.denied) return forbidden(res);
            if (!ctx.user) return res.redirect(panel.getLoginUrl());
            const id = String(req.params.id), hash = String(req.params.hash);
            const expected = createHash('sha1').update(ctx.user.email).digest('hex');
            if (String(ctx.user.id) !== id || hash !== expected || !panel.checkVerifyEmailUrl(id, hash, req.query.expires, req.query.signature)) return void res.status(403).send('Invalid signature.');
            await panel.getAuth().markEmailAsVerified?.(ctx.user);
            res.redirect((await homeUrl(ctx.user)) ?? panel.getBaseUrl());
        });
    }
    if (profile) userPage(profile.page.slug, name('auth.profile'), profile.page.getLabel(), profile.isSimple || panel.hasTenancy() ? 'simple' : 'index');
    if (TenantRegistration) userPage(TenantRegistration.slug, name('tenancy.registration'), TenantRegistration.getLabel());

    /** Context of a protected page: login, email verification, tenant. Returns `null` after responding. */
    const pageContext = async (req: Request, res: Response): Promise<PanelContext | null> => {
        const ctx = await context(req, res);
        if (ctx.denied) { forbidden(res); return null; }
        if (!ctx.user) { res.redirect(panel.getLoginUrl()); return null; }
        if (await panel.mustVerifyEmail(ctx.user)) { res.redirect(panel.getEmailVerificationPromptUrl()); return null; }
        if (panel.hasTenancy()) {
            ctx.tenant = await tenantFromPath(req.path, ctx.user);
            if (!ctx.tenant) { res.status(404).send('Not Found'); return null; }
        }
        return ctx;
    };
    const tenantSegment = panel.hasTenancy() ? ':tenant/' : '';
    if (panel.hasTenancy()) {
        // Panel root: the user's first tenant, otherwise tenant registration.
        router.get(panel.getBaseUrl(), async (req, res) => {
            const ctx = await context(req, res);
            if (ctx.denied) return forbidden(res);
            if (!ctx.user) return res.redirect(panel.getLoginUrl());
            if (await panel.mustVerifyEmail(ctx.user)) return res.redirect(panel.getEmailVerificationPromptUrl());
            const url = await homeUrl(ctx.user);
            if (!url) return void res.status(404).send('Not Found');
            res.redirect(url);
        });
        // Tenant root without a dashboard: the first menu page.
        if (!panel.getPages().some((page) => page.slug === '')) {
            router.get(panel.getBaseUrl(':tenant'), async (req, res, next) => {
                if (RESERVED_SEGMENTS.has(req.params.tenant) || req.params.tenant === TenantRegistration?.slug) return next();
                const ctx = await pageContext(req, res);
                if (!ctx) return;
                const url = await panel.withTenant(ctx.tenant, async () => panel.getNavigation(req.path, new Map(), await panel.resolveInaccessiblePages(ctx.user))[0]?.items[0]?.url ?? null);
                if (!url) return void res.status(404).send('Not Found');
                res.redirect(url);
            });
        }
    }
    for (const PageClass of panel.getPages()) {
        const component = name(`pages.${(PageClass.slug || 'dashboard').replace(/[{}]/g, '')}`);
        runtime.register(component, PageClass);
        // `{record}` in the slug becomes a route parameter, passed to mount().
        router.get(panel.getBaseUrl(tenantSegment + PageClass.slug).replace(/\{(\w+)\}/g, ':$1'), async (req, res, next) => {
            if (panel.hasTenancy() && (RESERVED_SEGMENTS.has(req.params.tenant) || req.params.tenant === TenantRegistration?.slug)) return next();
            const ctx = await pageContext(req, res);
            if (!ctx) return;
            const { tenant: _tenant, ...params } = req.params;
            await guarded(res, () => document(req, res, ctx, { title: PageClass.getTitle(), component, layout: 'index', params }));
        });
    }
    return router;
}

/** Each auth feature requires some auth provider methods: fail at startup rather than on first click. */
function assertAuthCapabilities(panel: Panel): void {
    if (!panel.hasRegistration() && !panel.hasPasswordReset() && !panel.hasEmailVerification() && !panel.hasProfile()) return;
    const auth = panel.getAuth();
    const missing = (feature: string, methods: (keyof AuthProvider)[]) => {
        const absent = methods.filter((method) => typeof auth[method] !== 'function');
        if (absent.length) throw new Error(`${feature}: the auth provider must implement ${absent.join(', ')} (knexAuthProvider does).`);
    };
    if (panel.hasRegistration()) missing('Registration', ['create', 'findByEmail']);
    if (panel.hasPasswordReset()) missing('Password reset', ['findByEmail', 'update', 'getPasswordFingerprint']);
    if (panel.hasEmailVerification()) missing('Email verification', ['hasVerifiedEmail', 'markEmailAsVerified']);
    if (panel.hasProfile()) missing('Profile', ['update']);
}
