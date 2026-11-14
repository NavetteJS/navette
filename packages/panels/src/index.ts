// @navette-js/panels: Panel, layouts, pages, resources, navigation, authentication and session.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Throttle } from './throttle.ts';
export { Throttle } from './throttle.ts';
import { checkVerificationUrl, consoleMailer, fingerprint, readToken, signToken, signVerificationUrl, type Mailer, type MailMessage } from './auth.ts';
export { consoleMailer, fileMailer, hashPassword, knexAuthProvider, knexTenantProvider, mailText, multiFactorAuthenticationSchema, verifyPassword, type Mailer, type MailMessage, type TableQuery } from './auth.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express, { type Request, type Response, type Router } from 'express';
import { Action, ActionHalt, useColorManager, ActionGroup } from '@navette-js/actions';
import { Checkbox, Field, RawJs, Select, Step, TextInput, Wizard, richDocumentToHtml, richHtmlToDocument, fillSchema, fillSchemaFromRecord, getSchemaState, loadSchemaRelationships, saveSchemaRelationships, validateSchema, useColorManager as useFormsColorManager } from '@navette-js/forms';
import { Actions, childSchema, Component as SchemaComponent, EmbeddedSchema, Form, Group, Html, RenderHook, Schema, Section, StatefulGroup, type SchemaHost } from '@navette-js/schemas';
import { WireError } from '@navette-js/wire';
import { useColorManager as useInfolistsColorManager, useHtmlSanitizer } from '@navette-js/infolists';
import { Notification, Notifications, publish, runInRequest, useNotificationsColorManager } from './notifications.ts';
import { getTableSelectDataAdapter, getTableSelectDefinition, type TableSelectDefinition } from '@navette-js/forms';
import { BulkActionGroup as TableBulkActionGroup, MAX_UNPAGINATED_RECORDS, makeTableSelectTable, type BulkActionMenu } from '@navette-js/tables';
export { Notification, Notifications, type NotificationActionData, type NotificationActionInput, type NotificationData, type NotificationsAlignment, type NotificationsVerticalAlignment } from './notifications.ts';
import { streamBroadcasts, userBroadcastChannel, type BroadcastRecipient } from './broadcasting.ts';
export { broadcastToUsers, DATABASE_NOTIFICATIONS_SENT_EVENT, dispatchDatabaseNotificationsSent, getBroadcaster, MemoryBroadcaster, NOTIFICATION_BROADCAST_EVENT, useBroadcaster, userBroadcastChannel, type BroadcastMessage, type BroadcastOptions, type BroadcastRecipient, type Broadcaster } from './broadcasting.ts';
import { NavetteAsset, type Asset } from './assets.ts';
export { AlpineComponent, Asset, AssetManager, Css, Js, NavetteAsset } from './assets.ts';
import { getDefaultCacheStore, MultiFactorChallenge, SecurityKeyAuthentication, type MultiFactorAuthenticationProvider, type SecurityKey } from './multi-factor.ts';
export { AppAuthentication, EmailAuthentication, EmailCodeInput, type EmailAuthenticationStore, decryptSecret, encryptSecret, MemoryCacheStore, MultiFactorChallenge, SecurityKeyAuthentication, SecurityKeyInput, useMultiFactorCacheStore, type AppAuthenticationStore, type MultiFactorAuthenticationProvider, type MultiFactorCacheStore, type SecurityKey, type SecurityKeyStore } from './multi-factor.ts';
export { base32Decode, base32Encode, generateTotpSecret, hotp, totpCode, totpTimestep, totpUri, verifyTotp, type TotpAlgorithm, type TotpOptions } from './totp.ts';
export { qrCodeDataUri, qrCodeMatrix, qrCodeSvg, type QrCodeSvgOptions, type QrErrorCorrection } from './qr-code.ts';
export { authenticationOptions, decodeCbor, generateChallenge, registrationOptions, verifyAuthentication, verifyRegistration, WebAuthnError, type AuthenticationResponseJSON, type RegistrationResponseJSON, type StoredCredential, type UserVerification } from './webauthn.ts';
export { MemorySessionStore, type SessionStore } from './session-store.ts';
export { csvCell, csvLine, DownloadStore, ExportAction, ExportBulkAction, ExportColumn, Exporter, ImportAction, ImportColumn, Importer, importExportSchema, knexImportExportHistory, parseCsv, readSpreadsheet, RowImportFailedError, runInBackground, TestableExport, TestableImport, useBackgroundRunner, type BackgroundTask, type ExportActionInstance, type ImportActionInstance, type ImportExportHistory } from './import-export.ts';
export { buildXlsx, readXlsx } from './xlsx.ts';
import { fillFiltersSchema, isFilterAction, normalizeFilterValuesFromQueryString, readQueryStringProperty, sanitizeFilterState } from './dashboard-filters.ts';
export { FilterAction, isFilterAction } from './dashboard-filters.ts';
import { DownloadStore, type ImportExportHistory } from './import-export.ts';
import { MemorySessionStore, type SessionStore } from './session-store.ts';
import { addDays, addMonths, CALENDAR_LABELS, CALENDAR_VIEWS, isDate, renderCalendar, visibleRange, type CalendarEvent, type CalendarLabels, type CalendarView } from './calendar.ts';
export { addDays, addMonths, CALENDAR_LABELS, dayOf, daysBetween, eventsOn, renderCalendar, renderCalendarEvent, timeOf, visibleRange, type CalendarEvent, type CalendarLabels, type CalendarModel, type CalendarView } from './calendar.ts';
import { DatabaseNotifications, GlobalSearch, keyBindingSuffix, type DatabaseNotificationStore, type GlobalSearchCategory, type GlobalSearchResult } from './topbar.ts';
export { getCurrentPanel, getPluginId, PanelPlugin, type Plugin } from './plugins.ts';
import { getCurrentPanel, getPluginId, runWithPanel, type Plugin } from './plugins.ts';
export { PageConfiguration, ResourceConfiguration } from './configurable.ts';
import { findConfiguration, getActiveConfiguration, isClosestNavigationUrl, getPanelConfigurations, PageConfiguration, resolvePageRegistration, resolveResourceRegistration, resolveUrlTarget, ResourceConfiguration, routeOrder, withConfiguration, withRequestConfiguration } from './configurable.ts';
import { buildNestedResourcePages, linkRelatedRecords, nestedRoutePath, ParentResourceRegistration, parentChainOf, parentRegistrationOf, relatedResourceAdapter, relationManagerTabFromQuery, relationshipNameOf, resolveResourceReference, resourceUrl, scopeAdapterByForeignKey, withRelatedResource, type ResourceReference } from './nested-resources.ts';
export { ParentResourceRegistration } from './nested-resources.ts';
import { buildSingularResourcePages, singularResourceUrl } from './singular-resources.ts';
export { DatabaseNotifications, GlobalSearch, knexNotificationStore, timeAgo, type DatabaseNotificationAction, type DatabaseNotificationRecord, type DatabaseNotificationStore, type GlobalSearchCategory, type GlobalSearchResult } from './topbar.ts';
import { Attributes, ColorManager, HtmlString, RenderHookRegistry, cls, configured, configureUsing, convertToRgb, e, icon, icons, js, loadingIndicator, renderHook, runWithRenderHooks, views, type AttrValue, type Palette, type RenderHookCallback } from '@navette-js/support';
import { getLocale, t, tc } from '@navette-js/support/i18n';
import { ERROR_PAGE_CSS, errorIllustration, errorPageScene } from './error-pages.ts';
import { badge as uiBadge, button as uiButton, emptyState, useColorManager as useUiColorManager } from '@navette-js/support/ui';
import type { DataAdapter } from '@navette-js/database';
import { REORDER_LIMIT, Table, TrashedFilter, callTableColumnMethod, filterSelectableKeys, recordMatchesTableFilters, getTableRecords, initializeTableGrouping, isTableFilterRemovable, updateTableColumnState as updateEditableColumnState, getTableQuery, getVisibleColumns, renderTable, sanitizeColumnState, sortTable, useColorManager as useTableColorManager, type ColumnState, type FilterState, type TableHost } from '@navette-js/tables';
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
    // --- multi-factor authentication (`AppAuthentication`, `SecurityKeyAuthentication`): `knexAuthProvider` implements them all.
    /** Stored authenticator app secret (encrypted by Navette), or `null`. */
    getAppAuthenticationSecret?(user: User): MaybePromise<string | null>;
    /** Saves the secret; `null` turns app authentication off. */
    saveAppAuthenticationSecret?(user: User, secret: string | null): MaybePromise<void>;
    /** Stored recovery codes (hashed by Navette), or `null`. */
    getAppAuthenticationRecoveryCodes?(user: User): MaybePromise<string[] | null>;
    saveAppAuthenticationRecoveryCodes?(user: User, codes: string[] | null): MaybePromise<void>;
    /** Whether the user receives sign-in codes by email (`EmailAuthentication`). */
    hasEmailAuthentication?(user: User): MaybePromise<boolean>;
    saveEmailAuthentication?(user: User, enabled: boolean): MaybePromise<void>;
    /** The user's security keys. */
    getSecurityKeys?(user: User): MaybePromise<SecurityKey[]>;
    createSecurityKey?(user: User, key: Omit<SecurityKey, 'id' | 'createdAt' | 'lastUsedAt'>): MaybePromise<void>;
    /** Updates a key of this user (counter and last use after a sign-in). */
    updateSecurityKey?(user: User, id: SecurityKey['id'], changes: { signCount?: number; lastUsedAt?: string; name?: string }): MaybePromise<void>;
    /** Deletes a key of this user. */
    deleteSecurityKey?(user: User, id: SecurityKey['id']): MaybePromise<void>;
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
    /** Tenant the user lands on after signing in (instead of their first one), or `null`. */
    getDefaultTenant?(user: User): MaybePromise<T | null>;
}
/** Subscriptions of tenants (`panel.tenantBillingProvider()`): Stripe, Paddle, your own… */
export interface TenantBillingProvider<T = any> {
    /** The billing page of a tenant (`/<tenant>/billing`): usually a redirect to the payment provider's customer portal. */
    handle(req: Request, res: Response, tenant: T): void | Promise<void>;
    /** Whether the tenant has an active subscription; required by `panel.requiresTenantSubscription()`. */
    isSubscribed?(tenant: T): MaybePromise<boolean>;
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

/** Navigation group: label, icon (then its items have none, as in Filament) and whether it can be collapsed. */
export class NavigationGroup {
    private _label: string;
    private _icon: string | null = null;
    private _collapsible = true;
    constructor(label: string) { this._label = label; }
    static make(label: string): NavigationGroup { return new NavigationGroup(label); }
    icon(name: string | null): this { this._icon = name; return this; }
    collapsible(condition = true): this { this._collapsible = condition; return this; }
    getLabel(): string { return this._label; }
    getIcon(): string | null { return this._icon; }
    isCollapsible(): boolean { return this._collapsible; }
}

export class NavigationItem {
    label: string;
    _url = '#';
    _icon: string | null = null;
    _group: string | null = null;
    _sort = 0;
    _isActive: ((path: string) => boolean) | null = null;
    _badge: string | number | null = null;
    _badgeColor = 'primary';
    _parentItem: string | null = null;
    _childItems: NavigationItem[] = [];
    constructor(label: string) { this.label = label; }
    static make(label: string): NavigationItem { return new NavigationItem(label); }
    /** Shows the item below another item of its group, by that item's label. */
    parentItem(label: string | null): this { this._parentItem = label; return this; }
    /** Items shown below this one, when it (or one of them) is active, or when it has no URL. */
    childItems(items: NavigationItem[]): this { this._childItems = items; return this; }
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
    private _importExportHistory: ImportExportHistory | null = null;
    /** Records each import and export run (`knexImportExportHistory(db)`): who, which file, how many rows, failed import rows. */
    importExportHistory(store: ImportExportHistory | null): this { this._importExportHistory = store; return this; }
    getImportExportHistory(): ImportExportHistory | null { return this._importExportHistory; }
    getDownloads(): DownloadStore { return (this._downloads ??= new DownloadStore()); }
    getDownloadUrl(token: string): string { return this.getBaseUrl(`downloads/${encodeURIComponent(token)}`); }
    private _pages: (typeof Page)[] = [];
    private _resources: (typeof Resource)[] = [];
    private _navigationItems: NavigationItem[] = [];
    private _navigationGroups: string[] = [];
    private _navigationGroupOptions = new Map<string, { icon: string | null; collapsible: boolean }>();
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
        return runWithPanel(this, () => runWithRenderHooks(this._renderHooks, () => (theme?.colors ? this.colors.runWith(theme.id, theme.colors, withPanelColors) : withPanelColors())));
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
    /** Registers pages; a configuration (`SettingsPage.make('advanced')`) registers the page once more, with its options. */
    pages(pages: (typeof Page | PageConfiguration)[]): this {
        for (const page of pages.map((entry) => resolvePageRegistration(this, entry))) { this.registerCluster(page); this._pages.push(page); }
        return this;
    }
    /** Registers resources: their pages and navigation items. */
    resources(resources: (typeof Resource | ResourceConfiguration)[]): this {
        // A configuration (`OrderResource.make('archived')`) registers the resource once more, with its own slug and options.
        // A nested resource's URLs start with its parent's slug (cluster included): parents are registered first.
        const ordered = resources.map((entry) => resolveResourceRegistration(this, entry)).sort((a, b) => parentChainOf(a).length - parentChainOf(b).length);
        for (const resource of ordered) { resource.panel = this; this.registerCluster(resource); this._resources.push(resource); this._pages.push(...Object.values(resource.getPages())); }
        return this;
    }
    /** A page or resource in a cluster is served under the cluster's slug; the cluster page is registered with it. */
    private registerCluster(component: typeof Page | typeof Resource): void {
        const cluster = (component as any).cluster as typeof Cluster | null;
        if (!cluster) return;
        if (!(cluster.prototype instanceof Cluster)) throw new Error(`${component.name}.cluster must be a Cluster subclass.`);
        cluster.slug = cluster.getSlug();
        if (!component.slug.startsWith(`${cluster.slug}/`)) component.slug = `${cluster.slug}/${component.slug}`;
        if (!this._pages.includes(cluster)) this._pages.push(cluster);
    }
    /** Pages (resource list pages included) shown in a cluster's sub-navigation. */
    getClusteredComponents(cluster: typeof Cluster): (typeof Page)[] {
        return this._pages.filter((page) => page !== cluster && page.shouldRegisterNavigation && clusterOf(page) === cluster);
    }
    /** Sub-navigation of a cluster, for one of its pages: the components the user can open, sorted, with their groups. */
    async getClusterSubNavigation(cluster: typeof Cluster, current: Page, user: User | null): Promise<SubNavigationItem[]> {
        const components: (typeof Page)[] = [];
        for (const component of this.getClusteredComponents(cluster)) if (await this.canAccessPage(component, user)) components.push(component);
        const items: (SubNavigationItem & { sort: number })[] = [];
        for (const component of components.sort((a, b) => a.navigationSort - b.navigationSort)) {
            const badge = typeof (component as any).getNavigationBadge === 'function' ? await (component as any).getNavigationBadge() : component.navigationBadge;
            items.push({ label: component.getNavigationLabel(), icon: typeof (component as any).getNavigationIcon === 'function' ? (component as any).getNavigationIcon() : component.navigationIcon, url: this.getUrl(component.slug), active: current instanceof component, group: component.navigationGroup, badge: badge ?? null, badgeColor: component.navigationBadgeColor, sort: component.navigationSort });
        }
        return items.map(({ sort: _sort, ...item }) => item);
    }
    navigationItems(items: NavigationItem[]): this { this._navigationItems.push(...items); return this; }
    /** Order of navigation groups. */
    /** Order of the navigation groups: labels, or `NavigationGroup.make('Shop').icon('o-shopping-cart').collapsible(false)`. */
    private _darkMode = true;
    private _darkModeForced = false;
    private _defaultThemeMode: 'light' | 'dark' | 'system' = 'system';
    /** `false`: light mode only (no switcher); `darkMode(true, true)`: dark mode only. */
    darkMode(condition = true, isForced = false): this { this._darkMode = condition; this._darkModeForced = condition && isForced; return this; }
    /** Mode used until the user picks one in the switcher: `'system'` (default), `'light'` or `'dark'`. */
    defaultThemeMode(mode: 'light' | 'dark' | 'system'): this { if (!['light', 'dark', 'system'].includes(mode)) throw new Error(`Invalid theme mode: ${mode}`); this._defaultThemeMode = mode; return this; }
    hasDarkMode(): boolean { return this._darkMode; }
    hasDarkModeForced(): boolean { return this._darkModeForced; }
    getDefaultThemeMode(): 'light' | 'dark' | 'system' { return this._defaultThemeMode; }
    navigationGroups(groups: (string | NavigationGroup)[]): this {
        this._navigationGroups = groups.map((group) => (typeof group === 'string' ? group : group.getLabel()));
        this._navigationGroupOptions = new Map(groups.filter((group): group is NavigationGroup => typeof group !== 'string').map((group) => [group.getLabel(), { icon: group.getIcon(), collapsible: group.isCollapsible() }]));
        return this;
    }
    private _plugins: Plugin[] = [];
    /** Applies a plugin: an object that configures the panel (resources, pages, render hooks, themes…). */
    plugin(plugin: Plugin): this {
        const id = getPluginId(plugin);
        if (this.hasPlugin(id)) throw new Error(`Plugin already registered: ${id}`);
        this._plugins.push(plugin);
        plugin.register(this);
        return this;
    }
    plugins(plugins: Plugin[]): this { for (const plugin of plugins) this.plugin(plugin); return this; }
    getPlugins(): Plugin[] { return this._plugins; }
    /** The plugin registered with this identifier: `panel.getPlugin('blog')`. Throws when it is not registered. */
    getPlugin<T extends Plugin = Plugin>(id: string): T {
        const plugin = this._plugins.find((candidate) => getPluginId(candidate) === id);
        if (!plugin) throw new Error(`Plugin [${id}] is not registered for panel [${this._id}].`);
        return plugin as T;
    }
    hasPlugin(id: string): boolean { return this._plugins.some((candidate) => getPluginId(candidate) === id); }
    /** Configurations of resources registered on this panel (`OrderResource.make('archived')`). */
    getResourceConfigurations(): ResourceConfiguration[] { return getPanelConfigurations(this, 'resource'); }
    getResourceConfiguration(resource: typeof Resource, key: string): ResourceConfiguration | null { return findConfiguration(this, resource, key) as ResourceConfiguration | null; }
    getPageConfigurations(): PageConfiguration[] { return getPanelConfigurations(this, 'page'); }
    getPageConfiguration(page: typeof Page, key: string): PageConfiguration | null { return findConfiguration(this, page, key) as PageConfiguration | null; }
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
    private _guestAccess = false;
    /**
     * Lets visitors who are not signed in use the panel's pages. Policies, `canAccess()` and the authorization hook then receive
     * a `null` user: return `true` there for what guests may see. Not available with tenancy.
     */
    guestAccess(condition = true): this { this._guestAccess = condition; return this; }
    allowsGuests(): boolean { return this._guestAccess; }
    /** Authorization decision: the panel hook first, then the given rule. Without a user: `false`, unless the panel allows guests. */
    async authorize(user: User | null, ability: string, subject: { resource?: unknown; record?: unknown; page?: typeof Page; widget?: typeof Widget; rule?: (() => boolean | Promise<boolean>) | null } = {}): Promise<boolean> {
        if (!user && !this._guestAccess) return false;
        const decided = await this._authorizer?.({ user: user as User, ability, resource: subject.resource ?? null, record: subject.record ?? null, page: subject.page ?? null, widget: subject.widget ?? null });
        if (typeof decided === 'boolean') return decided;
        if (!subject.rule && subject.resource && !subject.page && !subject.widget && this._strictAuthorization) {
            throw new Error(`Strict authorization mode is enabled, but ${(subject.resource as { name?: string }).name ?? 'the resource'} has no "${ability}" rule in its policy.`);
        }
        return subject.rule ? Boolean(await subject.rule()) : true;
    }
    /** Whether the user can open a page. List: `viewAny`; create: `create`; edit: checked against the record; custom page: `canAccess`. */
    async canAccessPage(PageClass: typeof Page, user: User | null): Promise<boolean> {
        if (PageClass.prototype instanceof Cluster) {
            if (!(await this.authorize(user, 'access', { page: PageClass, rule: () => PageClass.canAccess(user!) }))) return false;
            for (const component of this.getClusteredComponents(PageClass as typeof Cluster)) if (await this.canAccessPage(component, user)) return true;
            return false;
        }
        const resource = (PageClass as any).resource as typeof Resource | undefined;
        if (resource && PageClass.prototype instanceof EditRecord && !resource.isSingular) return user !== null || this._guestAccess;
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

    // -------------------------------------------------------------- broadcasting and assets
    private _broadcasting: { heartbeat: number } | null = null;
    /**
     * Pushes notifications live to the open pages of their users: `Notification.broadcast()` and database notifications sent with
     * `isEventDispatched`. The panel serves a Server-Sent Events stream to signed-in users; database notifications only poll while it is down.
     */
    broadcasting(condition = true, options: { heartbeat?: number } = {}): this { this._broadcasting = condition ? { heartbeat: Math.max(1000, options.heartbeat ?? 25_000) } : null; return this; }
    hasBroadcasting(): boolean { return this._broadcasting !== null; }
    getBroadcastingHeartbeat(): number { return this._broadcasting?.heartbeat ?? 25_000; }
    /** Private broadcast channel of a user of this panel: `<auth guard>.users.<id>` unless the user has `receivesBroadcastNotificationsOn()`. */
    getBroadcastChannel(user: BroadcastRecipient): string { return userBroadcastChannel(user, this._authGuard ?? `panel-${this._id}`); }
    /** URL of the panel's broadcast stream, for a tenant's pages. */
    getBroadcastingUrl(tenant: unknown = this.getTenant()): string {
        const url = `${this.getLivewirePrefix()}/broadcasting`;
        return this._tenant && tenant && !this._tenantDomain ? `${url}?tenant=${encodeURIComponent(this.getTenantUrlKey(tenant))}` : url;
    }
    private _assets: { assets: Asset[]; packageName: string }[] = [];
    /** Registers stylesheets, scripts and Alpine components for this panel only (`NavetteAsset.register()` registers them for all panels). */
    assets(assets: Asset[], packageName = 'app'): this { this._assets.push({ assets, packageName }); return this; }
    getAssets(): { assets: Asset[]; packageName: string }[] { return this._assets; }

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
    /** Whether the profile page uses the simple layout (`profile(page, false)`: the full layout, with the navigation). */
    isProfileSimple(): boolean { return this._profile?.isSimple !== false; }
    private _multiFactor: { providers: MultiFactorAuthenticationProvider[]; isRequired: boolean; setUpPage: typeof SetUpRequiredMultiFactorAuthentication } | null = null;
    /**
     * Multi-factor authentication: after the password, users with a provider set up must pass its challenge. They set providers
     * up on their profile page (`profile()`). `isRequired`: users without any provider are sent to a setup page first.
     */
    multiFactorAuthentication(providers: MultiFactorAuthenticationProvider[], options: { isRequired?: boolean; setUpPage?: typeof SetUpRequiredMultiFactorAuthentication } = {}): this {
        const ids = providers.map((provider) => provider.getId());
        for (const id of ids) if (!/^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(id)) throw new Error(`Invalid multi-factor provider id: ${id}`);
        if (new Set(ids).size !== ids.length) throw new Error('Two multi-factor providers share the same id: give one another id with id().');
        this._multiFactor = providers.length ? { providers, isRequired: options.isRequired === true, setUpPage: options.setUpPage ?? SetUpRequiredMultiFactorAuthentication } : null;
        return this;
    }
    hasMultiFactorAuthentication(): boolean { return this._multiFactor !== null; }
    getMultiFactorAuthenticationProviders(): MultiFactorAuthenticationProvider[] { return this._multiFactor?.providers ?? []; }
    isMultiFactorAuthenticationRequired(): boolean { return this._multiFactor?.isRequired === true; }
    getSetUpRequiredMultiFactorAuthenticationPage(): typeof SetUpRequiredMultiFactorAuthentication | null { return this._multiFactor?.isRequired ? this._multiFactor.setUpPage : null; }
    getSetUpRequiredMultiFactorAuthenticationUrl(): string { return this.getBaseUrl(this.getAuthPaths().setUpRequiredMultiFactor); }
    /** The login challenge of this panel (enabled providers, rate limiting). */
    getMultiFactorChallenge(): MultiFactorChallenge { return MultiFactorChallenge.make(this); }
    /** Whether the user must set up multi-factor authentication before using the panel. */
    async mustSetUpMultiFactorAuthentication(user: User | null): Promise<boolean> {
        if (!user || !this.isMultiFactorAuthenticationRequired()) return false;
        return !(await this.getMultiFactorChallenge().hasEnabledProviders(user));
    }
    usesSecurityKeys(): boolean { return this.getMultiFactorAuthenticationProviders().some((provider) => provider instanceof SecurityKeyAuthentication); }
    /** Mailer for password reset and verification emails. Defaults to the console. */
    mailer(mailer: Mailer): this { this._mailer = mailer; return this; }
    async sendMail(message: MailMessage): Promise<void> { await this._mailer.send(message); }
    getAuthKey(): string { return this._key; }
    private _authSlugs = {
        login: 'login', registration: 'register', passwordResetPrefix: 'password-reset', passwordResetRequest: 'request', passwordReset: 'reset', logout: 'logout',
        emailVerificationPrefix: 'email-verification', emailVerificationPrompt: 'prompt', emailVerification: 'verify',
        emailChangeVerificationPrefix: 'email-change-verification', emailChangeVerification: 'verify',
        multiFactorPrefix: 'multi-factor-authentication', setUpRequiredMultiFactor: 'set-up',
    };
    private authSlug(slug: string): string { if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(slug)) throw new Error(`Invalid route slug: ${slug}`); return slug; }
    /** URL segment of the login page (`login` by default). */
    loginRouteSlug(slug: string): this { this._authSlugs.login = this.authSlug(slug); return this; }
    /** URL segment of the registration page (`register` by default). */
    registrationRouteSlug(slug: string): this { this._authSlugs.registration = this.authSlug(slug); return this; }
    /** URL segments of the password reset pages: `<prefix>/<request>` and `<prefix>/<reset>` (`password-reset/request` and `password-reset/reset` by default). */
    passwordResetRoutePrefix(prefix: string): this { this._authSlugs.passwordResetPrefix = this.authSlug(prefix); return this; }
    passwordResetRequestRouteSlug(slug: string): this { this._authSlugs.passwordResetRequest = this.authSlug(slug); return this; }
    passwordResetRouteSlug(slug: string): this { this._authSlugs.passwordReset = this.authSlug(slug); return this; }
    /** Paths of the authentication pages, relative to the panel. */
    /** URL segment of the logout route (`logout` by default). */
    logoutRouteSlug(slug: string): this { this._authSlugs.logout = this.authSlug(slug); return this; }
    /** URL segments of email verification: `<prefix>/<prompt>` and `<prefix>/<verify>/…` (`email-verification/prompt`, `email-verification/verify`). */
    emailVerificationRoutePrefix(prefix: string): this { this._authSlugs.emailVerificationPrefix = this.authSlug(prefix); return this; }
    emailVerificationPromptRouteSlug(slug: string): this { this._authSlugs.emailVerificationPrompt = this.authSlug(slug); return this; }
    emailVerificationRouteSlug(slug: string): this { this._authSlugs.emailVerification = this.authSlug(slug); return this; }
    /** URL segments of the email change links: `<prefix>/<verify>` and `<prefix>/block` (`email-change-verification/verify`). */
    emailChangeVerificationRoutePrefix(prefix: string): this { this._authSlugs.emailChangeVerificationPrefix = this.authSlug(prefix); return this; }
    emailChangeVerificationRouteSlug(slug: string): this { this._authSlugs.emailChangeVerification = this.authSlug(slug); return this; }
    /** URL segments of the required multi-factor setup page (`multi-factor-authentication/set-up`). */
    multiFactorAuthenticationRoutePrefix(prefix: string): this { this._authSlugs.multiFactorPrefix = this.authSlug(prefix); return this; }
    setUpRequiredMultiFactorAuthenticationRouteSlug(slug: string): this { this._authSlugs.setUpRequiredMultiFactor = this.authSlug(slug); return this; }
    getAuthPaths(): { login: string; registration: string; passwordResetRequest: string; passwordReset: string; logout: string; emailVerificationPrompt: string; emailVerification: string; emailChangeVerification: string; blockEmailChange: string; setUpRequiredMultiFactor: string } {
        const slugs = this._authSlugs;
        return {
            login: slugs.login, registration: slugs.registration, passwordResetRequest: `${slugs.passwordResetPrefix}/${slugs.passwordResetRequest}`, passwordReset: `${slugs.passwordResetPrefix}/${slugs.passwordReset}`, logout: slugs.logout,
            emailVerificationPrompt: `${slugs.emailVerificationPrefix}/${slugs.emailVerificationPrompt}`, emailVerification: `${slugs.emailVerificationPrefix}/${slugs.emailVerification}`,
            emailChangeVerification: `${slugs.emailChangeVerificationPrefix}/${slugs.emailChangeVerification}`, blockEmailChange: `${slugs.emailChangeVerificationPrefix}/block`,
            setUpRequiredMultiFactor: `${slugs.multiFactorPrefix}/${slugs.setUpRequiredMultiFactor}`,
        };
    }
    /** First URL segments used by the panel itself (never page slugs or tenant keys). */
    getReservedSegments(): Set<string> { const slugs = this._authSlugs; return new Set([...RESERVED_SEGMENTS, slugs.login, slugs.registration, slugs.passwordResetPrefix, slugs.logout, slugs.emailVerificationPrefix, slugs.emailChangeVerificationPrefix, slugs.multiFactorPrefix]); }
    getRegistrationUrl(): string { return this.getBaseUrl(this.getAuthPaths().registration); }
    getRequestPasswordResetUrl(): string { return this.getBaseUrl(this.getAuthPaths().passwordResetRequest); }
    getResetPasswordUrl(user: User, fingerprint: string): string {
        const token = signToken(this._key, `${this._id}.password-reset`, { uid: user.id, fp: fingerprint }, 60 * 60);
        return `${this.getBaseUrl(this.getAuthPaths().passwordReset)}?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`;
    }
    /** Payload of a password reset token valid for this panel, otherwise `null`. */
    readResetPasswordToken(token: unknown): { uid: string | number; fp: string } | null { return readToken(this._key, `${this._id}.password-reset`, token) as any; }
    getVerifyEmailUrl(user: User): string {
        const expires = Math.floor(Date.now() / 1000) + 60 * 60;
        const { hash, signature } = signVerificationUrl(`${this._key}.${this._id}`, user.id, user.email, expires);
        return `${this.getBaseUrl(`${this.getAuthPaths().emailVerification}/${encodeURIComponent(String(user.id))}/${hash}`)}?expires=${expires}&signature=${encodeURIComponent(signature)}`;
    }
    checkVerifyEmailUrl(id: string, hash: string, expires: unknown, signature: unknown): boolean { return checkVerificationUrl(`${this._key}.${this._id}`, id, hash, expires, signature); }
    getEmailVerificationPromptUrl(): string { return this.getBaseUrl(this.getAuthPaths().emailVerificationPrompt); }
    private _emailChangeVerification = false;
    /**
     * A new email address set on the profile page is only saved once confirmed: a link is sent to the new address, and a link
     * to block the change to the old one. Both are valid for 60 minutes.
     */
    emailChangeVerification(condition = true): this { this._emailChangeVerification = condition; return this; }
    hasEmailChangeVerification(): boolean { return this._emailChangeVerification; }
    /** Links of an email change request: to confirm the new address, and to block the change. */
    getEmailChangeUrls(user: User, newEmail: string): { verify: string; block: string } {
        const nonce = randomBytes(12).toString('base64url');
        const verify = signToken(this._key, `${this._id}.email-change`, { uid: user.id, email: newEmail, from: fingerprint(user.email), nonce }, 60 * 60);
        const block = signToken(this._key, `${this._id}.email-change-block`, { uid: user.id, email: newEmail, nonce }, 60 * 60);
        return { verify: `${this.getBaseUrl(this.getAuthPaths().emailChangeVerification)}?token=${encodeURIComponent(verify)}`, block: `${this.getBaseUrl(this.getAuthPaths().blockEmailChange)}?token=${encodeURIComponent(block)}` };
    }
    readEmailChangeToken(kind: 'verify' | 'block', token: unknown): { uid: string | number; email: string; from?: string; nonce: string } | null {
        const payload = readToken(this._key, `${this._id}.${kind === 'verify' ? 'email-change' : 'email-change-block'}`, token) as any;
        return payload && typeof payload.email === 'string' && typeof payload.nonce === 'string' ? payload : null;
    }
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
    private _searchableTenantMenu: boolean | null = null;
    /** A search field above the tenants of the menu. By default (`null`), it is shown from ten tenants to switch to. */
    searchableTenantMenu(condition: boolean | null = true): this { this._searchableTenantMenu = condition; return this; }
    isTenantMenuSearchable(): boolean | null { return this._searchableTenantMenu; }
    private _tenantRoutePrefix: string | null = null;
    /** A segment before the tenant key in URLs: `tenantRoutePrefix('team')` serves `/app/team/1/projects`. */
    tenantRoutePrefix(prefix: string | null): this {
        if (prefix !== null && !/^[a-z0-9][a-z0-9-]*$/.test(prefix)) throw new Error(`Invalid tenant route prefix: ${prefix}`);
        this._tenantRoutePrefix = prefix;
        return this;
    }
    getTenantRoutePrefix(): string | null { return this._tenantRoutePrefix; }
    private _tenantDomain: string | null = null;
    /**
     * Identifies the tenant by the host instead of the path: `tenantDomain('{tenant}.example.com')` serves the tenant `acme` at
     * `acme.example.com/app/projects`. A port may follow (`{tenant}.localhost:3000`).
     */
    tenantDomain(pattern: string | null): this {
        if (pattern !== null && !pattern.includes('{tenant}')) throw new Error('tenantDomain(): the pattern must contain {tenant}.');
        this._tenantDomain = pattern;
        return this;
    }
    getTenantDomain(): string | null { return this._tenantDomain; }
    /** Domain of a tenant, with its port if the pattern has one. */
    getTenantDomainFor(tenant: unknown): string { return this._tenantDomain!.replace('{tenant}', encodeURIComponent(this.getTenantUrlKey(tenant)).toLowerCase()); }
    /** Key of the tenant designated by a request (its path, or its host with `tenantDomain()`), unchecked; `null` if none. */
    getTenantKeyFromRequest(path: string, hostname: string): string | null {
        if (this._tenantDomain) {
            const host = this._tenantDomain.replace(/:\d+$/, '').toLowerCase();
            const [before, after] = host.split('{tenant}').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const match = new RegExp(`^${before}([^.]+)${after}$`).exec(hostname.toLowerCase());
            if (!match) return null;
            try { return decodeURIComponent(match[1]); } catch { return null; }
        }
        const base = this.getBaseUrl();
        const prefix = base === '/' ? '/' : `${base}/`;
        if (!path.startsWith(prefix)) return null;
        const segments = path.slice(prefix.length).split('/');
        if (this._tenantRoutePrefix !== null && segments.shift() !== this._tenantRoutePrefix) return null;
        let key: string;
        try { key = decodeURIComponent(segments[0] ?? ''); } catch { return null; }
        if (!key || key.length > 200) return null;
        if (this._tenantRoutePrefix === null && (this.getReservedSegments().has(key) || key === this._tenantRegistration?.slug)) return null;
        return key;
    }
    private _tenantBilling: TenantBillingProvider | null = null;
    private _tenantBillingRouteSlug = 'billing';
    private _requiresTenantSubscription = false;
    /** Adds a "Manage subscription" link to the tenant menu, served by the provider at `/<tenant>/billing`. */
    tenantBillingProvider(provider: TenantBillingProvider | null): this { this._tenantBilling = provider; return this; }
    getTenantBillingProvider(): TenantBillingProvider | null { return this._tenantBilling; }
    hasTenantBilling(): boolean { return this._tenantBilling !== null; }
    tenantBillingRouteSlug(slug: string): this { this._tenantBillingRouteSlug = slug.replace(/^\/|\/$/g, ''); return this; }
    getTenantBillingRouteSlug(): string { return this._tenantBillingRouteSlug; }
    getTenantBillingUrl(tenant: unknown = this.getTenant()): string | null { return this._tenantBilling && tenant ? this.getUrl(this._tenantBillingRouteSlug, tenant) : null; }
    /** The pages of a tenant without an active subscription (`isSubscribed()`) redirect to its billing page. */
    requiresTenantSubscription(condition = true): this { this._requiresTenantSubscription = condition; return this; }
    isTenantSubscriptionRequired(): boolean { return this._requiresTenantSubscription && this._tenantBilling !== null; }
    private _sessionCookieDomain: string | null = null;
    /** Domain of the session cookie (`.example.com`): with `tenantDomain()`, a sign-in then holds on every tenant's host. */
    sessionCookieDomain(domain: string | null): this { this._sessionCookieDomain = domain; return this; }
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
        if (this._tenant && tenant && this._tenantDomain) {
            // On the tenant's own host, a path; another tenant's pages are on its host.
            const current = this.getTenant();
            const path = this.getBaseUrl(sub);
            return current && this.getTenantUrlKey(current) === this.getTenantUrlKey(tenant) ? path : `//${this.getTenantDomainFor(tenant)}${path}`;
        }
        if (this._tenant && tenant) return '/' + [this._path, this._tenantRoutePrefix, encodeURIComponent(this.getTenantUrlKey(tenant)), sub.replace(/^\/|\/$/g, '')].filter(Boolean).join('/');
        return this.getBaseUrl(sub);
    }
    /** URL outside any tenant (login, registration, profile, tenant registration). */
    getBaseUrl(sub = ''): string { return '/' + [this._path, sub.replace(/^\/|\/$/g, '')].filter(Boolean).join('/'); }
    getLoginUrl(): string { return this.getBaseUrl(this.getAuthPaths().login); }
    getLogoutUrl(): string { return this.getBaseUrl(this.getAuthPaths().logout); }
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
    private _spaPrefetching = false;
    /**
     * SPA mode: navigate between panel pages without full reloads (`wire:navigate`). `{ prefetch: true }` loads a page as soon
     * as its link is hovered (`wire:navigate.hover`).
     */
    spa(condition = true, options: { prefetch?: boolean } = {}): this { this._spa = condition; this._spaPrefetching = options.prefetch === true; return this; }
    hasSpaMode(): boolean { return this._spa; }
    hasSpaPrefetching(): boolean { return this._spa && this._spaPrefetching; }
    private _domains: string[] = [];
    /** Serves the panel on this domain only (`admin.example.com`): requests for other hosts go to the next routes. */
    domain(host: string | null): this { this._domains = host ? [host] : []; return this; }
    /** Serves the panel on these domains only. */
    domains(hosts: string[]): this { this._domains = [...hosts]; return this; }
    getDomains(): string[] { return this._domains; }
    private _unsavedChangesAlerts = false;
    /** Warns the user before leaving a create or edit page whose form has unsaved changes. */
    unsavedChangesAlerts(condition = true): this { this._unsavedChangesAlerts = condition; return this; }
    hasUnsavedChangesAlerts(): boolean { return this._unsavedChangesAlerts; }
    private _databaseTransactions = false;
    /**
     * Wraps the creation and the saving of records (from `beforeCreate()` / `beforeSave()` to `afterCreate()` / `afterSave()`)
     * in a database transaction, rolled back when anything throws. Pages can opt in or out with `static hasDatabaseTransactions`.
     */
    databaseTransactions(condition = true): this { this._databaseTransactions = condition; return this; }
    hasDatabaseTransactions(): boolean { return this._databaseTransactions; }
    private _strictAuthorization = false;
    /** Throws when a resource is checked for an ability its policy does not define, instead of allowing it. */
    strictAuthorization(condition = true): this { this._strictAuthorization = condition; return this; }
    isAuthorizationStrict(): boolean { return this._strictAuthorization; }
    private _bootCallbacks: ((panel: Panel, req: Request) => void | Promise<void>)[] = [];
    /** Runs on every request handled by the panel (its pages and their updates), before them. */
    bootUsing(callback: (panel: Panel, req: Request) => void | Promise<void>): this { this._bootCallbacks.push(callback); return this; }
    async boot(req: Request): Promise<void> { for (const callback of this._bootCallbacks) await callback(this, req); }
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
    getNavigation(path: string, badges: Map<string, string | number | null> = new Map(), hidden: Set<string> = new Set()): { label: string | null; itemsId: string; isActive: boolean; icon: string | null; collapsible: boolean; items: NavigationItemView[]; dropdownItems: NavigationItemView[] }[] {
        const menuUrls = this._pages.filter((p) => p.shouldRegisterNavigation && !hidden.has(p.slug) && clusterOf(p) === null).map((p) => this.getUrl(p.slug));
        const items = [
            // The pages of a cluster are in its sub-navigation: the menu only shows the cluster.
            ...this._pages.filter((p) => p.shouldRegisterNavigation && !hidden.has(p.slug) && clusterOf(p) === null).map((p) => {
                const item = NavigationItem.make(p.getNavigationLabel()).url(this.getUrl(p.slug)).icon(typeof (p as any).getNavigationIcon === 'function' ? (p as any).getNavigationIcon() : p.navigationIcon).group(p.navigationGroup).sort(p.navigationSort).badge(badges.has(p.slug) ? badges.get(p.slug)! : p.navigationBadge, p.navigationBadgeColor).parentItem(p.navigationParentItem);
                const base = this.getUrl(p.slug);
                // Below another item's URL (`orders/archived` under `orders`), only that item is active.
                return (p as any).resource || p.prototype instanceof Cluster ? item.isActiveWhen((current) => isClosestNavigationUrl(base, current, menuUrls)) : item;
            }),
            ...this._navigationItems,
        ].sort((a, b) => a._sort - b._sort);
        const view = (item: NavigationItem, children: NavigationItem[]): NavigationItemView => {
            const childItems = children.map((child) => view(child, child._childItems));
            const activeChildItems = childItems.some((child) => child.isActive || child.activeChildItems);
            return { label: item.label, url: item._url, icon: item._icon, isActive: !activeChildItems && item.isActive(path), badge: item._badge, badgeColorClasses: this.colors.getComponentClasses('badge', item._badgeColor), childItems, activeChildItems };
        };
        const order = [null, ...this._navigationGroups, ...items.map((i) => i._group).filter((g): g is string => g !== null && !this._navigationGroups.includes(g))];
        return [...new Set(order)].map((label) => {
            const inGroup = items.filter((i) => i._group === label);
            // An item with a parent item is shown below it (an unknown parent hides it, as in Filament).
            const own = inGroup.filter((i) => i._parentItem === null).map((i) => view(i, [...i._childItems, ...inGroup.filter((child) => child._parentItem === i.label)]));
            const options = label ? this._navigationGroupOptions.get(label) : undefined;
            return { label, itemsId: label ? `fi-sidebar-group-items-${slug(label)}-${createHash('md5').update(label).digest('hex').slice(0, 8)}` : '', isActive: own.some((i) => i.isActive || i.activeChildItems), items: options?.icon ? own.map((i) => ({ ...i, icon: null })) : own, dropdownItems: own, icon: options?.icon ?? null, collapsible: options?.collapsible ?? true };
        }).filter((g) => g.items.length);
    }

    // --- session: an HMAC-signed cookie holding the user id
    private sign(value: string): string { return createHmac('sha256', this._key).update(value).digest('base64url'); }
    logIn(res: Response, user: User, remember: boolean): void {
        const value = Buffer.from(JSON.stringify({ uid: user.id })).toString('base64url');
        res.cookie(this.getSessionCookieName(), `${value}.${this.sign(value)}`, { httpOnly: true, sameSite: 'lax', secure: res.req?.secure === true, ...(this._sessionCookieDomain ? { domain: this._sessionCookieDomain } : {}), ...(remember ? { maxAge: 1000 * 60 * 60 * 24 * 30 } : {}) });
    }
    logOut(res: Response): void { res.clearCookie(this.getSessionCookieName(), this._sessionCookieDomain ? { domain: this._sessionCookieDomain } : {}); }
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
    /** Actions of the page header (full layout). */
    getHeaderActions(): Action[] { return []; }
    /** Name of the child component showing a `TableSelect`'s table in this panel. */
    getTableSelectComponentName(): string { return `navette.${this.panel.getId()}.table-select`; }

    // --- lazy loaded schemas (`lazyLoaded()`): loaded when they enter the viewport, then kept loaded
    static callable = ['loadDeferredSchema'];
    loadedDeferredSchemas: Record<string, boolean> = {};
    /** Whether a lazy schema is rendered: loaded already, or holding a field with a validation error (loaded so it shows). */
    async isDeferredSchemaLoaded(schema: Schema): Promise<boolean> {
        const key = schema.getLazyKey();
        if (this.loadedDeferredSchemas[key]) return true;
        const errorKeys = Object.keys(this._errors ?? {});
        if (!errorKeys.length) return false;
        for (const component of schema.getFlatComponents() as any[]) {
            const path = component.hasStatePath?.() ? component.getStatePath() : '';
            if (path && errorKeys.some((error) => error === path || error.startsWith(`${path}.`))) { this.loadedDeferredSchemas[key] = true; return true; }
        }
        return false;
    }
    /** Called by the loading indicator of a lazy schema: renders only that schema. */
    async loadDeferredSchema(schemaKey: unknown): Promise<void> {
        if (typeof schemaKey !== 'string' || schemaKey.length > 300 || this.loadedDeferredSchemas[schemaKey]) { this.skipRender(); return; }
        const rootName = schemaKey.split('.')[0];
        const mountedIndex = /^mountedActionSchema(\d+)$/.exec(rootName);
        const root = mountedIndex ? await this.getMountedActionSchema(Number(mountedIndex[1])) : /^[A-Za-z]+$/.test(rootName) && typeof (this as any)[`${rootName}Schema`] === 'function' ? this.getSchema(rootName) : null;
        // Only a lazy schema reachable through visible components can be loaded.
        const find = async (schema: Schema): Promise<Schema | null> => {
            if (schema.getLazyKey() === schemaKey && (await schema.isLazyLoaded())) return schema;
            for (const component of schema.getComponents() as any[]) {
                if (!(await component.isVisible())) continue;
                for (const child of (component.getChildSchemas?.() ?? []) as Schema[]) { const found = await find(child); if (found) return found; }
            }
            return null;
        };
        const schema = root ? await find(root) : null;
        if (!schema) { this.skipRender(); return; }
        this.loadedDeferredSchemas[schemaKey] = true;
        const html = await schema.toHtml();
        this.renderPartial(`schema.${schemaKey}`, html || `<div wire:partial="${e(`schema.${schemaKey}`)}" hidden></div>`);
    }

    // --- mounted actions: the stack lives in the component state, modals are rendered server-side
    mountedActions: { name: string; arguments: Record<string, unknown>; context: Record<string, unknown>; data?: Record<string, unknown> }[] = [];
    /** Files uploaded by rich editors (`componentFileAttachments.<state path>.<id>`), stored by the editor when it asks for their URL. */
    componentFileAttachments: Record<string, unknown> = {};
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
            // Item actions of a layout or list component (Repeater, Builder) get it as `component` too.
            if (component) fieldAccess = { component };
            const path = typeof component?.getStatePath === 'function' && component.hasStatePath() ? String(component.getStatePath()) : null;
            if (path) {
                const container = path.split('.').slice(0, -1);
                const nodeOf = () => container.reduce((node: any, segment) => (node && typeof node === 'object' ? node[segment] : undefined), this as any);
                fieldAccess = {
                    component,
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
        return action.applySchema(Schema.make(this).key(`mountedActionSchema${index}`).statePath(`mountedActions.${index}.data`).operation(mounted.name).record(await this.resolveActionRecord(mounted.context)), mounted.arguments ?? {});
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
        const path = `mountedActions.${index}.data.${m[2]}`;
        const field = schema?.getFlatComponents().find((c) => c instanceof Field && (c.getStatePath() === path || path.startsWith(`${c.getStatePath()}.`))) as Field | undefined;
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
    private async assertActionVisible(action: Action, context: Record<string, unknown> = {}, args: Record<string, unknown> = {}): Promise<void> {
        const record = await this.resolveActionRecord(context);
        if (context.recordKey !== undefined && record === null) throw new WireError(404, 'Record not found.');
        // An item action of a schema component (Repeater, Builder): the component checks the arguments (the item key exists).
        const component = typeof context.schemaComponent === 'string' && typeof context.parentAction !== 'number' ? await this.findSchemaComponent(context.schemaComponent) : null;
        if (component && typeof component.authorizeActionArguments === 'function' && !(await component.authorizeActionArguments(action.getName(), args))) throw new WireError(404, `Action not found: ${action.getName()}`);
        const ctx = { livewire: this as any, component: component ?? (null as any), operation: null, record, get: () => undefined, state: undefined, arguments: args };
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
        const mountArguments = args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
        await this.assertActionVisible(action, context, mountArguments);
        const mounted = { name: String(name), arguments: mountArguments, context };
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
    /**
     * Replaces the action being run with another action of the same component, opened in its place (to show a result, as
     * the new recovery codes). Call it from the running action; `name` must be mountable in the same context (it may be hidden).
     */
    async replaceMountedAction(name: string, args: Record<string, unknown> = {}): Promise<void> {
        const index = this.mountedActions.length - 1;
        if (index < 0) return;
        const context = this.mountedActions[index].context;
        const action = await this.findMountableAction(name, context);
        const mounted: { name: string; arguments: Record<string, unknown>; context: Record<string, unknown>; data?: Record<string, unknown> } = { name, arguments: args, context };
        this.mountedActions[index] = mounted;
        this._errors = {};
        const schema = await this.getMountedActionSchema(index);
        if (schema) { const data: Record<string, unknown> = {}; mounted.data = data; fillSchema(schema, data); }
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
        await this.assertActionVisible(action, mounted.context, mounted.arguments ?? {});
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
        // The action replaced itself with another one (`replaceMountedAction()`): that one stays open.
        if (this.mountedActions[this.mountedActions.length - 1] !== mounted) return;
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
}

const coloredNavigationItem = (item: NavigationItemView) => ({ ...item, colorClasses: item.isActive ? sharedColors.getComponentClasses('dropdown-item', 'primary') : [] });
/** The lists of a navigation group's dropdown: an item with children forms its own list with them (Filament's `$lists`). */
function navigationDropdownLists(items: NavigationItemView[]): (NavigationItemView & { colorClasses: string[] })[][] {
    const lists: (NavigationItemView & { colorClasses: string[] })[][] = [];
    for (const item of items) {
        if (item.childItems.length) { lists.push([coloredNavigationItem(item), ...item.childItems.map(coloredNavigationItem)], []); continue; }
        if (!lists.length) lists.push([]);
        lists[lists.length - 1].push(coloredNavigationItem(item));
    }
    if (lists.length && !lists[lists.length - 1].length) lists.pop();
    return lists;
}
/** A navigation group for the topbar: in a dropdown, an item with children forms its own list with them. */
function topNavigationGroup<G extends { items: NavigationItemView[] }>(group: G): G & { lists: (NavigationItemView & { colorClasses: string[] })[][] } {
    return { ...group, items: group.items.map(coloredNavigationItem), lists: navigationDropdownLists(group.items) };
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
    /** Label of another menu item of the group, below which this page is shown. */
    static navigationParentItem: string | null = null;
    /** Cluster of the page: it is served under the cluster's URL and listed in its sub-navigation. */
    static cluster: typeof Cluster | null = null;
    static shouldRegisterNavigation = true;
    /** Restricts the page to some users: returning `false` hides it from the menu and denies it (403). */
    static canAccess(_user: User): boolean | Promise<boolean> { return true; }
    /** Whether the page needs the tenant's subscription (`panel.requiresTenantSubscription()`); `false` keeps it open. */
    static isTenantSubscriptionRequired(panel: Panel): boolean { return panel.isTenantSubscriptionRequired(); }
    static getTitle(): string { return this.title ?? this.name.replace(/([a-z])([A-Z])/g, '$1 $2'); }
    static getNavigationLabel(): string { return this.navigationLabel ?? this.getTitle(); }
    /** Class of the options of the page's registrations (`PageConfiguration` or a subclass): enables `make()`. */
    static configurationClass: typeof PageConfiguration | null = null;
    /** A registration of this page with its own options: `panel.pages([SettingsPage.make('advanced').slug('advanced-settings')])`. */
    static make<P extends typeof Page>(this: P, key = 'default'): InstanceType<NonNullable<P['configurationClass']>> {
        if (!this.configurationClass) throw new Error(`Page ${this.name} does not define a configurationClass.`);
        return this.configurationClass.make(this, key) as InstanceType<NonNullable<P['configurationClass']>>;
    }
    /** Options of the registration being used, or `null` for the page's own (default) registration. */
    static getConfiguration<P extends typeof Page>(this: P): InstanceType<NonNullable<P['configurationClass']>> | null { return getActiveConfiguration(this) as InstanceType<NonNullable<P['configurationClass']>> | null; }
    static hasConfiguration(): boolean { return this.getConfiguration() !== null; }
    /** Runs `fn` with the registration `key` of this page active (URLs, `getConfiguration()`). */
    static withConfiguration<T>(key: string, fn: () => T): T { return withConfiguration(this, key, fn); }
    /**
     * URL of the page in the current panel (or `options.panel`): `{record}`-style parameters of the slug are filled from
     * `parameters`, the others go to the query string. `options.configuration` targets a registration (`null`: the default one).
     */
    static getUrl(parameters: Record<string, string | number> = {}, options: { configuration?: string | null; panel?: Panel } = {}): string {
        const panel = options.panel ?? getCurrentPanel();
        const target = resolveUrlTarget(this, options.configuration, panel ?? undefined);
        if (!panel) throw new Error(`${this.name}.getUrl() was called outside a panel request: pass options.panel.`);
        const query = new URLSearchParams();
        const path = target.slug.replace(/\{(\w+)\}/g, (_match, name: string) => encodeURIComponent(String(parameters[name] ?? '')));
        for (const [name, value] of Object.entries(parameters)) if (!target.slug.includes(`{${name}}`)) query.set(name, String(value));
        const search = query.toString();
        return panel.getUrl(path) + (search ? `?${search}` : '');
    }

    /** Every request, including browser updates, requires an authenticated user: a snapshot kept after logout is not enough. */
    async boot(): Promise<void> {
        const ctx = this._ctx as PanelContext | null;
        if (!ctx?.user && !ctx?.panel.allowsGuests()) throw new WireError(401, 'Unauthenticated.');
        // In a multi-tenant panel, every page belongs to a tenant the user is a member of (checked by the router).
        if (ctx.panel.hasTenancy() && !ctx.tenant) throw new WireError(404, 'Tenant not found.');
        if (ctx.tenant && (this.constructor as typeof Page).isTenantSubscriptionRequired(ctx.panel) && !(await ctx.panel.getTenantBillingProvider()!.isSubscribed!(ctx.tenant))) throw new WireError(403, 'Subscription required.');
        if (await ctx.panel.mustVerifyEmail(ctx.user)) throw new WireError(403, 'Email address not verified.');
        if (await ctx.panel.mustSetUpMultiFactorAuthentication(ctx.user)) throw new WireError(403, 'Multi-factor authentication must be set up.');
        // Checked on every request, not only on display: a forged request to a forbidden page is denied.
        if (!(await this.isAccessAuthorized(ctx))) throw new WireError(403, 'Forbidden.');
    }
    protected isAccessAuthorized(ctx: PanelContext): boolean | Promise<boolean> { return ctx.panel.canAccessPage(this.constructor as typeof Page, ctx.user); }
    getTitle(): string { return (this.constructor as typeof Page).getTitle(); }
    getHeading(): string { return this.getTitle(); }
    getBreadcrumbs(): { label: string; url: string | null }[] { return []; }
    getHeaderActions(): Action[] { return []; }
    getPageClasses(): string[] { return []; }
    /** Page sub-navigation: its cluster's pages, for a page in a cluster; empty otherwise. */
    getSubNavigation(): SubNavigationItem[] | Promise<SubNavigationItem[]> {
        const cluster = (this.constructor as typeof Page).cluster;
        return cluster?.shouldRegisterSubNavigation ? this.panel.getClusterSubNavigation(cluster, this, (this._ctx as PanelContext).user) : [];
    }
    /** Breadcrumbs, preceded by the cluster's for a page in a cluster. */
    protected getBreadcrumbsWithCluster(): { label: string; url: string | null }[] {
        const breadcrumbs = this.getBreadcrumbs();
        const cluster = clusterOf(this.constructor);
        if (!cluster || this instanceof Cluster) return breadcrumbs;
        const crumb = cluster.getClusterBreadcrumb();
        return breadcrumbs[0]?.label === crumb ? breadcrumbs : [{ label: crumb, url: this.panel.getUrl(cluster.slug) }, ...breadcrumbs];
    }
    /** Sub-navigation position: `start` (column before the content), `end` (after) or `top` (tabs). Defaults to the resource's, then the panel's. */
    static subNavigationPosition: 'start' | 'end' | 'top' | null = null;
    getSubNavigationPosition(): 'start' | 'end' | 'top' {
        const own = (this.constructor as typeof Page).subNavigationPosition;
        const resource = (this.constructor as any).resource ?? (this.constructor as any).parentResource;
        return own ?? resource?.subNavigationPosition ?? clusterOf(this.constructor)?.subNavigationPosition ?? this.panel.getSubNavigationPosition();
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
    /**
     * Content rendered from an EJS view instead of the `content` schema: a namespaced view (`'app::pages.report'`), or a file
     * (path or `new URL('./report.ejs', import.meta.url)`). The view receives `page` (this page) and `getViewData()`, and may use
     * component tags (`<x-section>`, `<x-button>`…). Elements calling the server use `wire:click` on a method listed in `static callable`.
     */
    static view: string | URL | null = null;
    /** Extra variables for the page view. */
    getViewData(): Record<string, unknown> | Promise<Record<string, unknown>> { return {}; }
    protected async renderContent(): Promise<string> {
        const view = (this.constructor as typeof Page).view;
        if (view === null) return (await this.getSchema('content')).toHtml();
        const data = { page: this, livewireId: this.id, ...(await this.getViewData()) };
        return typeof view === 'string' && view.includes('::') ? views.render(view, data) : views.renderFile(view instanceof URL ? fileURLToPath(view) : view, data);
    }

    async render(): Promise<string> {
        const ctx = { livewire: this as any, component: null as any, operation: null, record: this.getActionRecord(), get: () => undefined, state: undefined };
        const headerActions: string[] = [];
        for (const action of this.getHeaderActions()) if (await action.isVisible(ctx)) headerActions.push(await action.toHtml(ctx));
        return views.render('filament-panels::pages.page', {
            heading: this.getHeading(), headerWidgets: await this.renderHeaderWidgets(), content: await this.renderContent(), footerWidgets: await this.renderFooterWidgets(), livewireId: this.id, renderHookScopes: this.getRenderHookScopes(),
            subNavigation: (await this.getSubNavigation()).map((item) => ({ ...item, badgeColorClasses: sharedColors.getComponentClasses('badge', item.badgeColor ?? 'primary') })), subNavigationPosition: this.getSubNavigationPosition(),
            breadcrumbs: this.getBreadcrumbsWithCluster(), headerActions, pageClasses: this.getPageClasses(), actionModals: this.rendersActionModalsInPage() ? await this.renderActionModals() : '',
            headerActionsKey: createHash('md5').update(this.getHeaderActions().map((a) => a.getName()).join(',')).digest('hex'),
        });
    }
}
/**
 * Cluster: a menu item gathering pages and resources (`static cluster = Settings`), listed in its sub-navigation and served
 * under its URL (`/settings/...`). Opening the cluster goes to its first page.
 */
export class Cluster extends Page {
    /** Breadcrumb before those of its pages; defaults to the title. */
    static clusterBreadcrumb: string | null = null;
    /** `false`: the pages of the cluster have no sub-navigation. */
    static shouldRegisterSubNavigation = true;
    static getTitle(): string { return this.title ?? this.name.replace(/Cluster$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'); }
    /** URL segment: `slug`, or the class name without "Cluster" in kebab case (`ProductsCluster` → `products`). */
    static getSlug(): string { return this.slug || this.name.replace(/Cluster$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); }
    static getClusterBreadcrumb(): string { return this.clusterBreadcrumb ?? this.getTitle(); }
    async mount(): Promise<void> {
        const [first] = await this.getSubNavigation();
        if (first) this.redirect(first.url);
    }
    getSubNavigation(): SubNavigationItem[] | Promise<SubNavigationItem[]> {
        return this.panel.getClusterSubNavigation(this.constructor as typeof Cluster, this, (this._ctx as PanelContext).user);
    }
}

/**
 * Dashboard: a widget grid, preceded by a filters form when the page defines `filtersFormSchema(schema)`.
 * The filters are passed to widgets as `pageFilters`.
 */
export class Dashboard extends Page {
    static slug = '';
    static title = 'Dashboard';
    static navigationIcon: string | null = 'o-home';
    /** The `panels::pages.dashboard.navigation-item` alias replaces the default icon. */
    static getNavigationIcon(): string | null { return this.navigationIcon === 'o-home' ? icons.resolve('panels::pages.dashboard.navigation-item') ?? 'o-home' : this.navigationIcon; }
    static navigationSort = -2;
    /** Filters form state. Stays `null` while the page has no filters. */
    filters: Record<string, unknown> | null = null;
    /** Dashboard widgets. Defaults to the panel's (`panel.widgets([...])`). */
    /** The panel's widgets, ordered by their `sort` (stable). */
    getWidgets(): (typeof Widget)[] { return [...this.panel.getWidgets()].map((widget, index) => ({ widget, index })).sort((a, b) => (a.widget.sort ?? Infinity) - (b.widget.sort ?? Infinity) || a.index - b.index).map(({ widget }) => widget); }
    /** Grid columns: a number (at the `lg` breakpoint), or one number per breakpoint. */
    getColumns(): number | Record<string, number> { return 2; }
    hasFiltersForm(): boolean { return typeof (this as any).filtersFormSchema === 'function'; }
    /** Filters edited in a modal: a `FilterAction` among the header actions. */
    hasFiltersAction(): boolean { return flattenActions(this.getHeaderActions()).some(isFilterAction); }
    hasFilters(): boolean { return this.hasFiltersForm() || this.hasFiltersAction(); }
    /** The filters are kept in the user's session between page loads (per tenant). `false` turns this off. */
    static persistsFiltersInSession = true;
    persistsFiltersInSession(): boolean { return (this.constructor as typeof Dashboard).persistsFiltersInSession; }
    /** Session key of the persisted filters: per dashboard class, and per tenant. */
    getFiltersSessionKey(): string {
        const tenant = (this._ctx as PanelContext | null)?.tenant;
        const tenantKey = tenant ? encodeURIComponent(this.panel.getTenantUrlKey(tenant)) : '';
        return ['dashboard', (this.constructor as typeof Dashboard).name, encodeURIComponent((this.constructor as typeof Dashboard).slug), tenantKey, 'filters'].join(':');
    }
    /** Session of the persisted filters: the browser (its CSRF token) and the signed-in user. */
    private filtersSession(): string | null {
        const ctx = this._ctx as PanelContext | null;
        return ctx?.mailbox ? `${ctx.panel.getId()}:${ctx.user?.id ?? ''}:${ctx.mailbox}` : null;
    }
    getSchema(name: string): Schema {
        if (name !== 'filtersForm') return super.getSchema(name);
        // 2 / 3 / 4 column grid, state under `filters`, live fields.
        const schema = (this as any).filtersFormSchema(Schema.make(this).key('filtersForm').columns({ md: 2, xl: 3, '2xl': 4 }).statePath('filters').partialName('table-filters-form')) as Schema;
        for (const component of schema.getFlatComponents() as any[]) if (component instanceof Field && typeof (component as any).live === 'function') (component as any).live();
        return schema;
    }
    /**
     * Initial filters: from the URL (`?filters[startDate]=…`), or else from the session, or else the form defaults.
     * Both sources are written by the browser: the values are sanitized, and only the form's fields are kept.
     */
    mount(): void | Promise<void> { return this.mountFilters(); }
    protected async mountFilters(): Promise<void> {
        if (!this.hasFilters()) return;
        const ctx = this._ctx as PanelContext | null;
        let restored = readQueryStringProperty((ctx?.req?.query ?? null) as Record<string, unknown> | null, 'filters');
        const session = this.filtersSession();
        if (!restored && session && this.persistsFiltersInSession()) {
            const saved = sanitizeFilterState(await this.panel.getSessionStore().get(session, this.getFiltersSessionKey()));
            if (saved && typeof saved === 'object' && !Array.isArray(saved) && Object.keys(saved).length) restored = saved as Record<string, unknown>;
        }
        if (restored) restored = normalizeFilterValuesFromQueryString(restored) as Record<string, unknown>;
        if (this.hasFiltersForm()) {
            this.filters = {};
            if (restored) fillFiltersSchema(this.getSchema('filtersForm'), this.filters, restored);
            else fillSchema(this.getSchema('filtersForm'), this.filters);
        } else {
            this.filters = restored;
        }
        // Kept in the URL (Livewire `#[Url]`): the browser updates the query string when the filters change.
        (this._effects as Record<string, unknown>).url = { filters: { as: 'filters', use: 'replace', alwaysShow: false, except: null } };
    }
    async dehydrate(): Promise<void> {
        await super.dehydrate?.();
        const session = this.filtersSession();
        if (!session || !this.hasFilters() || !this.persistsFiltersInSession()) return;
        await this.panel.getSessionStore().set(session, this.getFiltersSessionKey(), sanitizeFilterState(this.filters) ?? null);
    }
    getWidgetData(): Record<string, unknown> { return this.hasFilters() ? { pageFilters: this.filters } : {}; }
    protected async renderContent(): Promise<string> {
        const filters = this.hasFiltersForm() ? `<div ${ANONYMOUS_SCHEMA_COMPONENT} class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component">${await this.getSchema('filtersForm').toHtml()}</div></div>` : '';
        const widgets = await this.renderWidgetsGrid(await this.filterVisibleWidgets(this.getWidgets()), this.getColumns(), 'content');
        return `<div x-data="filamentSchema({ livewireId: ${e(js(this.id))}, schemaKey: 'content' })" x-on:form-validation-error.window="handleFormValidationError" x-on:reset-schema-component-state.window="handleClientSideStateReset" class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));">${filters}${widgets}</div>`;
    }
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
        return views.render('filament-panels::pages.simple', { brand: this.panel.getBrand(), heading: this.getHeading(), subheading: this.getSubheading(), hasLogo: this.hasLogo(), content: await this.getSchema('content').toHtml(), livewireId: this.id, renderHookScopes: this.getRenderHookScopes(), actionModals: await this.renderActionModals() });
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
        return this.panel.getLoginPage() ? authLink(this.panel.getLoginUrl(), t('filament-panels::auth/pages/password-reset/request-password-reset.actions.login.label'), { iconName: icons.resolve('panels::pages.password-reset.request-password-reset.actions.login') ?? 'm-arrow-left' }) : null;
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
    static callable = ['save', 'mountAction', 'unmountAction', 'callMountedAction', 'callSchemaComponentMethod'];
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
    /** Whether the page uses the full layout (`panel.profile(EditProfile, false)`): its form is then split into sections. */
    usesFullLayout(): boolean { return !this.panel.isProfileSimple(); }
    async render(): Promise<string> {
        if (!this.usesFullLayout()) return super.render();
        return views.render('filament-panels::pages.page', {
            heading: this.getTitle(), headerWidgets: '', content: await this.getSchema('content').toHtml(), footerWidgets: '', livewireId: this.id, renderHookScopes: this.getRenderHookScopes(),
            subNavigation: [], subNavigationPosition: 'top', breadcrumbs: [], headerActions: [], pageClasses: ['fi-auth-edit-profile-page'], actionModals: await this.renderActionModals(), headerActionsKey: '',
        });
    }
    formSchema(schema: Schema): Schema {
        const fields = this.getFormComponents();
        if (!this.usesFullLayout()) return schema.operation('edit').components(fields);
        const [name, email, ...password] = fields;
        const group = 'filament-panels::auth/pages/edit-profile.sections';
        return schema.operation('edit').components([
            Section.make(t(`${group}.information.heading`)).description(t(`${group}.information.description`)).schema([name, email]),
            Section.make(t(`${group}.password.heading`)).description(t(`${group}.password.description`)).schema(password),
        ]);
    }
    /** Fields of the form: name, email, new password, its confirmation, current password. */
    protected getFormComponents(): SchemaComponent[] {
        const { panel, user } = this._ctx as PanelContext;
        const auth = panel.getAuth();
        return [
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
        ];
    }
    contentSchema(schema: Schema): Schema {
        const { panel, user } = this._ctx as PanelContext;
        return schema.components([
            ...formContent('save', [
                Action.make('save').label(t('filament-panels::auth/pages/edit-profile.form.actions.save.label')).submit('save').keyBindings(['mod+s']),
                Action.make('back').label(t('filament-panels::auth/pages/edit-profile.actions.cancel.label')).color('gray').alpineClickHandler(`document.referrer ? window.history.back() : (window.location.href = ${JSON.stringify(this.panel.getUrl())})`),
            ], { fullWidth: false, alignment: 'start' }),
            ...(panel.hasMultiFactorAuthentication() && user ? [this.multiFactorAuthenticationSection(panel, user)] : []),
        ]);
    }
    /** Emails of an email change: a confirmation link to the new address, a link to block it to the old one. */
    protected async sendEmailChangeVerification(user: User, newEmail: string): Promise<void> {
        const { panel, req } = this._ctx as PanelContext;
        const urls = panel.getEmailChangeUrls(user, newEmail);
        await panel.sendMail({
            to: newEmail, subject: 'Verify Email Address',
            lines: ['Please click the button below to verify your new email address.'],
            action: { label: 'Verify Email Address', url: absoluteUrl(panel, req, urls.verify) },
            outro: ['This link will expire in 60 minutes.', 'If you did not request this change, no further action is required.'],
        });
        const notice = 'filament-panels::auth/notifications/notice-of-email-change-request';
        await panel.sendMail({
            to: user.email, subject: t(`${notice}.subject`),
            lines: [0, 1, 2].map((index) => t(`${notice}.lines.${index}`, { email: newEmail })),
            action: { label: t(`${notice}.action`), url: absoluteUrl(panel, req, urls.block) },
            outro: [t(`${notice}.lines.3`, { email: newEmail })],
        });
        Notification.make().success().title(t('filament-panels::auth/pages/edit-profile.notifications.email_change_verification_sent.title')).body(t('filament-panels::auth/pages/edit-profile.notifications.email_change_verification_sent.body', { email: newEmail })).send();
    }
    /** Multi-factor authentication settings: each provider's status and actions (set up, turn off…). */
    protected multiFactorAuthenticationSection(panel: Panel, user: User): SchemaComponent {
        if (!this.usesFullLayout()) return multiFactorManagementSection(panel, user);
        const group = 'filament-panels::auth/pages/edit-profile.multi_factor_authentication';
        return Section.make(t(`${group}.label`)).description(t(`${group}.description`)).divided()
            .schema(panel.getMultiFactorAuthenticationProviders().map((provider) => Group.make(provider.getManagementSchemaComponents(user, panel)).statePath(provider.getId())));
    }
    async save(): Promise<void> {
        const { panel, user } = this._ctx as PanelContext;
        if (!user) throw new WireError(401, 'Unauthenticated.');
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        const data = await getSchemaState(form);
        const newEmail = String(data.email);
        const verifyEmailChange = panel.hasEmailChangeVerification() && newEmail !== user.email;
        await panel.getAuth().update!(user, { name: String(data.name), email: verifyEmailChange ? user.email : newEmail, password: blankValue(data.password) ? undefined : String(data.password) });
        if (verifyEmailChange) {
            await this.sendEmailChangeVerification(user, newEmail);
            this.data = { ...this.data, email: user.email };
        }
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
    /** Signed token naming the user undertaking the multi-factor challenge: set by the server only. */
    static locked = ['userUndertakingMultiFactorAuthentication'];
    data: Record<string, unknown> = {};
    userUndertakingMultiFactorAuthentication: string | null = null;
    /** User of the pending challenge, resolved from the token on each request. */
    protected _multiFactorUser: User | null = null;
    protected _multiFactorProviders: MultiFactorAuthenticationProvider[] = [];

    mount(): void { fillSchema(this.getSchema('form'), this.data); }
    async boot(): Promise<void> {
        const payload = this.readMultiFactorToken();
        const { panel } = this._ctx as PanelContext;
        this._multiFactorUser = payload ? await panel.getAuth().find(payload.uid as string | number) : null;
        const ids = Array.isArray(payload?.providers) ? (payload!.providers as unknown[]).map(String) : [];
        this._multiFactorProviders = this._multiFactorUser ? panel.getMultiFactorAuthenticationProviders().filter((provider) => ids.includes(provider.getId())) : [];
    }
    protected readMultiFactorToken(): Record<string, unknown> | null {
        const { panel } = this._ctx as PanelContext;
        return this.userUndertakingMultiFactorAuthentication ? readToken(panel.getAuthKey(), `${panel.getId()}.mfa-login`, this.userUndertakingMultiFactorAuthentication) : null;
    }
    /** Whether the multi-factor challenge is shown. */
    isUndertakingMultiFactorAuthentication(): boolean { return this._multiFactorUser !== null && this._multiFactorProviders.length > 0; }
    getTitle(): string { return t('filament-panels::auth/pages/login.title'); }
    getHeading(): string { return this.isUndertakingMultiFactorAuthentication() ? t('filament-panels::auth/pages/login.multi_factor.heading') : t('filament-panels::auth/pages/login.heading'); }
    getSubheading(): string | null {
        if (this.isUndertakingMultiFactorAuthentication()) return e(t('filament-panels::auth/pages/login.multi_factor.subheading'));
        if (!this.panel.hasRegistration()) return null;
        return `${e(t('filament-panels::auth/pages/login.actions.register.before'))} ${authLink(this.panel.getRegistrationUrl(), t('filament-panels::auth/pages/login.actions.register.label'))}`;
    }
    getSchema(name: string): Schema {
        if (name === 'multiFactorChallengeForm') return this.multiFactorChallengeFormSchema(Schema.make(this).key(name).statePath('data.multiFactor'));
        return super.getSchema(name);
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
    /** Challenge fields of the user's enabled providers (with a picker when there are several). */
    multiFactorChallengeFormSchema(schema: Schema): Schema {
        if (!this.isUndertakingMultiFactorAuthentication()) return schema.components([]);
        return schema.components(this.panel.getMultiFactorChallenge().getFormComponents(this._multiFactorUser!, this._multiFactorProviders));
    }
    contentSchema(schema: Schema): Schema {
        const challenging = this.isUndertakingMultiFactorAuthentication();
        return schema.components([
            RenderHook.make(PanelsRenderHook.AUTH_LOGIN_FORM_BEFORE),
            Form.make([EmbeddedSchema.make('form')]).id('form').livewireSubmitHandler('authenticate')
                .footer([Actions.make([Action.make('authenticate').label(t('filament-panels::auth/pages/login.form.actions.authenticate.label')).submit('authenticate')]).fullWidth().key('form-actions')])
                .hidden(challenging),
            Form.make(challenging ? [EmbeddedSchema.make('multiFactorChallengeForm')] : []).id('multiFactorChallengeForm').livewireSubmitHandler('authenticate')
                .footer(challenging ? [Actions.make([Action.make('authenticate').label(t('filament-panels::auth/pages/login.multi_factor.form.actions.authenticate.label')).submit('authenticate')]).fullWidth()] : [])
                .hidden(!challenging),
            RenderHook.make(PanelsRenderHook.AUTH_LOGIN_FORM_AFTER),
        ]);
    }
    /** Starts a challenge for this user if one of their providers is set up; returns whether it did. */
    protected async startMultiFactorChallenge(user: User): Promise<boolean> {
        const { panel } = this._ctx as PanelContext;
        if (!panel.hasMultiFactorAuthentication()) return false;
        const challenge = panel.getMultiFactorChallenge();
        const enabled = await challenge.getEnabledProviders(user);
        if (!enabled.length) return false;
        // Ten minutes to answer; the password is checked again when the challenge is answered.
        this.userUndertakingMultiFactorAuthentication = signToken(panel.getAuthKey(), `${panel.getId()}.mfa-login`, { uid: user.id, providers: enabled.map((provider) => provider.getId()) }, 60 * 10);
        this._multiFactorUser = user;
        this._multiFactorProviders = enabled;
        await challenge.beforeChallenge(user, enabled[0]);
        const state: Record<string, unknown> = {};
        this.data = { ...this.data, multiFactor: state };
        fillSchema(this.getSchema('multiFactorChallengeForm'), state);
        return true;
    }

    async authenticate(): Promise<void> {
        this._errors = await validateSchema(this.getSchema('form'));
        if (Object.keys(this._errors).length) { this.cancelMultiFactorChallenge(); this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        const { req, res, panel } = this._ctx as PanelContext;
        // Five attempts per minute per IP address, then wait.
        const wait = loginThrottle.hit(`${panel.getId()}:${req.ip ?? ''}`);
        if (wait > 0) {
            Notification.make().danger().title(t('filament-actions::notifications.throttled.title', { seconds: wait, minutes: Math.ceil(wait / 60) })).body(t('filament-actions::notifications.throttled.body', { seconds: wait, minutes: Math.ceil(wait / 60) })).send();
            return;
        }
        // The password is checked on every submission, the challenge's included: a password changed meanwhile ends it.
        const user = await panel.getAuth().attempt(String(this.data.email), String(this.data.password));
        // As in Filament: a valid account that may not use this panel gets the same message as wrong credentials.
        if (!user || !(await panel.userCanAccess(user))) { this.cancelMultiFactorChallenge(); this.addError('data.email', t('filament-panels::auth/pages/login.messages.failed')); return; }
        if (this.isUndertakingMultiFactorAuthentication() && String(this._multiFactorUser!.id) === String(user.id)) {
            const challenge = panel.getMultiFactorChallenge();
            const challengeWait = challenge.hitRateLimiter(user);
            if (challengeWait > 0) {
                Notification.make().danger().title(t('filament-actions::notifications.throttled.title', { seconds: challengeWait, minutes: Math.ceil(challengeWait / 60) })).body(t('filament-actions::notifications.throttled.body', { seconds: challengeWait, minutes: Math.ceil(challengeWait / 60) })).send();
                return;
            }
            const challengeForm = this.getSchema('multiFactorChallengeForm');
            this._errors = await validateSchema(challengeForm);
            if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
            // Defense in depth: the answered provider is one of the user's, and at least one of its fields was validated.
            const state = (this.data.multiFactor ?? {}) as Record<string, unknown>;
            const picked = this._multiFactorProviders.length > 1 ? String(state.provider ?? '') : this._multiFactorProviders[0].getId();
            const answered = this._multiFactorProviders.some((provider) => provider.getId() === picked)
                && (await challengeForm.getVisibleFlatComponents()).some((component) => component instanceof Field && component.getStatePath().startsWith(`data.multiFactor.${picked}.`));
            if (!answered) { this.addError('data.multiFactor.provider', t('filament-panels::auth/pages/login.messages.failed')); return; }
            challenge.clearRateLimiter(user);
        } else if (await this.startMultiFactorChallenge(user)) {
            return;
        }
        loginThrottle.clear(`${panel.getId()}:${req.ip ?? ''}`);
        panel.logIn(res, user, Boolean(this.data.remember));
        this.userUndertakingMultiFactorAuthentication = null;
        this.redirect(panel.getUrl());
    }
    /** The user picked another provider in the challenge: run its `beforeChallenge` (an email code is sent). */
    async updatedData(value: unknown, key: string | null): Promise<void> {
        if (key !== 'multiFactor.provider' || !this.isUndertakingMultiFactorAuthentication()) return;
        const provider = this._multiFactorProviders.find((candidate) => candidate.getId() === value);
        if (provider) await this.panel.getMultiFactorChallenge().beforeChallenge(this._multiFactorUser!, provider);
    }
    protected cancelMultiFactorChallenge(): void {
        this.userUndertakingMultiFactorAuthentication = null;
        this._multiFactorUser = null;
        this._multiFactorProviders = [];
    }
}

/** Shown after sign-in when the panel requires multi-factor authentication and the user has not set any provider up. */
export class SetUpRequiredMultiFactorAuthentication extends SimplePage {
    static callable = ['mountAction', 'unmountAction', 'callMountedAction', 'callSchemaComponentMethod'];
    async boot(): Promise<void> { if (!(this._ctx as PanelContext | null)?.user) throw new WireError(401, 'Unauthenticated.'); }
    async mount(): Promise<void> {
        const { panel, user } = this._ctx as PanelContext;
        if (!panel.hasMultiFactorAuthentication() || (await panel.getMultiFactorChallenge().hasEnabledProviders(user!))) this.redirect(panel.getUrl());
    }
    getTitle(): string { return t('filament-panels::auth/multi-factor/pages/set-up-required-multi-factor-authentication.title'); }
    getHeading(): string { return t('filament-panels::auth/multi-factor/pages/set-up-required-multi-factor-authentication.heading'); }
    getSubheading(): string | null { return e(t('filament-panels::auth/multi-factor/pages/set-up-required-multi-factor-authentication.subheading')); }
    contentSchema(schema: Schema): Schema {
        const { panel, user } = this._ctx as PanelContext;
        return schema.components([
            multiFactorManagementSection(panel, user!),
            Actions.make([
                Action.make('continue').label(t('filament-panels::auth/multi-factor/pages/set-up-required-multi-factor-authentication.actions.continue.label')).url(panel.getUrl())
                    .visible(() => panel.getMultiFactorChallenge().hasEnabledProviders(user!)),
            ]).fullWidth().key('footer-actions'),
        ]);
    }
}
/** Profile section listing the providers: each one's status and actions, under its id. */
function multiFactorManagementSection(panel: Panel, user: User): Section {
    return Section.make().compact().divided().secondary().key('multi-factor-authentication')
        .schema(panel.getMultiFactorAuthenticationProviders().map((provider) => Group.make(provider.getManagementSchemaComponents(user, panel)).statePath(provider.getId())));
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
    /** Menu label; defaults to the plural model label in title case. */
    static navigationLabel: string | null = null;
    /** Label of another menu item of the group, below which the resource is shown. */
    static navigationParentItem: string | null = null;
    /** Cluster of the resource: its pages are served under the cluster's URL, and its list is in the cluster's sub-navigation. */
    static cluster: typeof Cluster | null = null;
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
    /** Relation managers shown below the edit form (and the view page), or groups of them (`RelationGroup`). */
    static relations: (typeof RelationManager | RelationGroup)[] = [];
    static getRelations(): (typeof RelationManager | RelationGroup)[] { return this.relations; }
    /** Tabs of the list page. */
    static tabs(): Record<string, Tab> { return {}; }
    /** Simple resource: a single page, with create and edit in modals. */
    static isSimple = false;

    // -------------------------------------------------------------- nesting (Filament's $parentResource)
    /**
     * Nested resource: the parent resource under whose records this one is served (`/projects/{project}/tasks/create`).
     * It has no list nor menu item: its records are listed by a relation manager or related page of the parent
     * (`static relatedResource = TaskResource`). A function returning the resource (`() => ProjectResource`) breaks circular imports.
     */
    static parentResource: ResourceReference | null = null;
    /** This resource as the parent of `childResource`: `ProjectResource.asParent().relationship('tasks').inverseRelationship('project')`. */
    static asParent(childResource: typeof Resource | null = null): ParentResourceRegistration { return new ParentResourceRegistration(this, childResource); }
    /** How this resource is nested: from `parentResource` by default; override it to change the relationship names or the foreign key. */
    static getParentResourceRegistration(): ParentResourceRegistration | null { return resolveResourceReference(this.parentResource)?.asParent(this) ?? null; }
    /**
     * Limits the adapter to the records of a parent record (Filament's `scopeEloquentQueryToParent()`). Defaults to
     * `adapter.scopedTo(<foreign key>, parentKey)`; `parentRecord` is `null` when called for a relation manager.
     */
    static scopeAdapterToParent(adapter: DataAdapter, parentKey: string, _parentRecord: unknown = null): DataAdapter { return scopeAdapterByForeignKey(this, adapter, parentKey); }

    // -------------------------------------------------------------- singular resource
    /**
     * Singular resource: bound to a single record (site settings...), managed from its edit page at the resource URL, without
     * a list. If the record does not exist yet, the form shows its defaults and the first save creates it.
     */
    static isSingular = false;
    /** The record of a singular resource, or `null` if it does not exist yet; defaults to the first record of the adapter. */
    static async resolveSingularRecord(adapter: DataAdapter = this.adapter): Promise<unknown | null> { return (await adapter.paginate({ page: 1, perPage: 1 })).records[0] ?? null; }
    /** Attributes given to the record of a singular resource when the first save creates it (`{ group: 'site' }`). */
    static getSingularRecordAttributes(): Record<string, unknown> { return {}; }

    static getPluralModelLabel(): string { return this.pluralModelLabel ?? plural(this.modelLabel); }
    static getTitleCasePluralModelLabel(): string { return this.getPluralModelLabel().split(' ').map(ucfirst).join(' '); }
    /** Class of the options of the resource's registrations (`ResourceConfiguration` or a subclass): enables `make()`. */
    static configurationClass: typeof ResourceConfiguration | null = null;
    /** A registration of this resource with its own options: `panel.resources([OrderResource.make('archived').archived()])`. */
    static make<R extends typeof Resource>(this: R, key = 'default'): InstanceType<NonNullable<R['configurationClass']>> {
        if (!this.configurationClass) throw new Error(`Resource ${this.name} does not define a configurationClass.`);
        return this.configurationClass.make(this, key) as InstanceType<NonNullable<R['configurationClass']>>;
    }
    /** Options of the registration being used, or `null` for the resource's own (default) registration. */
    static getConfiguration<R extends typeof Resource>(this: R): InstanceType<NonNullable<R['configurationClass']>> | null { return getActiveConfiguration(this) as InstanceType<NonNullable<R['configurationClass']>> | null; }
    static hasConfiguration(): boolean { return this.getConfiguration() !== null; }
    /** Runs `fn` with the registration `key` of this resource active (URLs, `getConfiguration()`). */
    static withConfiguration<T>(key: string, fn: () => T): T { return withConfiguration(this, key, fn); }
    /**
     * URL of a page: `getUrl('edit', 12)`, or with named parameters `getUrl('edit', { record: 12, project: 3 })` (a nested
     * resource needs its parent's key, under the parent's route parameter name; other parameters go to the query string).
     * `options.configuration` targets a registration (`null`: the default one); without it, the active one.
     */
    static getUrl(page: string = 'index', record?: string | number | Record<string, unknown>, parameters: Record<string, unknown> = {}, options: { configuration?: string | null } = {}): string {
        const target = resolveUrlTarget(this, options.configuration);
        if (target !== this) return target.getUrl(page, record, parameters);
        if (this.isSingular) return singularResourceUrl(this, page);
        if ((record !== null && typeof record === 'object') || Object.keys(parameters).length || parentRegistrationOf(this)) {
            return resourceUrl(this, page, record !== null && typeof record === 'object' ? { ...record, ...parameters } : { ...parameters, ...(record !== undefined ? { record } : {}) });
        }
        const base = this.panel.getUrl(this.slug);
        if (page in this.relatedPages) return `${base}/${record}/${page}`;
        return page === 'index' ? base : page === 'create' ? `${base}/create` : page === 'view' ? `${base}/${record}` : `${base}/${record}/edit`;
    }
    /** Related records pages: `{ comments: ManagePostComments }` is served at `<slug>/{record}/comments`. */
    static relatedPages: Record<string, typeof ManageRelatedRecords | typeof EditRecord | typeof ViewRecord> = {};
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
                icon: related ? (related.navigationIcon ?? icons.resolve('panels::resources.pages.manage-related-records.navigation-item') ?? 'o-rectangle-stack') : name === 'view' ? icons.resolve('panels::resources.pages.view-record.navigation-item') ?? 'o-eye' : icons.resolve('panels::resources.pages.edit-record.navigation-item') ?? 'o-pencil-square',
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
    /** `false`: the resource is left out of global search. */
    static isGloballySearchable = true;
    /** `false`: the search term is matched as a whole instead of word by word. */
    static shouldSplitGlobalSearchTerms = true;
    static canGloballySearch(): boolean { return this.isGloballySearchable && this.getGloballySearchableAttributes().length > 0 && !parentRegistrationOf(this); }
    /** Position of this resource's group in the results; without one, after the others in registration order. */
    static globalSearchSort: number | null = null;
    /** Maximum results rendered per resource. */
    static globalSearchResultsLimit = 50;
    static getGlobalSearchResultTitle(record: any): string { return this.getRecordTitle(record); }
    /** Details shown under the title: `{ Author: 'Jane' }`. Empty values are skipped. */
    static getGlobalSearchResultDetails(_record: any): Record<string, unknown> | Promise<Record<string, unknown>> { return {}; }
    /**
     * Buttons under a result: links (`Action.make('edit').url(…)`) or Livewire events (`.dispatch('quickView', [id])`).
     * They are not mounted: an action needing a modal belongs on the record's pages.
     */
    static getGlobalSearchResultActions(_record: any): Action[] | Promise<Action[]> { return []; }
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
        const page = await this.adapter.paginate({ search, searchColumns: this.getGloballySearchableAttributes(), splitSearchTerms: this.shouldSplitGlobalSearchTerms, page: 1, perPage: Math.min(Math.max(this.globalSearchResultsLimit, 1), 200) });
        const results: GlobalSearchResult[] = [];
        for (const record of page.records) {
            const url = await this.getGlobalSearchResultUrl(record, user);
            if (url === null) continue;
            const details: Record<string, string> = {};
            for (const [label, value] of Object.entries(await this.getGlobalSearchResultDetails(record))) if (value !== null && value !== undefined && value !== '') details[label] = String(value);
            results.push({ title: this.getGlobalSearchResultTitle(record), url, details, actions: await this.getGlobalSearchResultActions(record), record });
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
        if (resource.isSingular) return buildSingularResourcePages(resource, { EditRecord, ViewRecord });
        if (parentRegistrationOf(resource)) return buildNestedResourcePages(resource, { CreateRecord, EditRecord, ViewRecord, ManageRelatedRecords } as any);
        const List = class extends (resource.pages.index ?? ListRecords) {
            static resource = resource;
            static slug = resource.slug;
            static title = resource.getTitleCasePluralModelLabel();
            static navigationIcon = resource.navigationIcon;
            static navigationGroup = resource.navigationGroup;
            static navigationSort = resource.navigationSort;
            static navigationBadge = resource.navigationBadge;
            static navigationParentItem = resource.navigationParentItem;
            static navigationLabel = resource.navigationLabel;
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
            // Another edit or view page of the record (`EditCustomerContact extends EditRecord`): served at `<slug>/{record}/<name>`.
            if ((RelatedPage as any).prototype instanceof EditRecord || (RelatedPage as any).prototype instanceof ViewRecord) {
                related[name] = class extends (RelatedPage as any) { static resource = resource; static slug = `${resource.slug}/{record}/${name}`; static shouldRegisterNavigation = false; } as unknown as typeof Page;
                continue;
            }
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

/** Sub-navigation tab of a page; items with a `group` are gathered under its label. */
export type SubNavigationItem = { label: string; icon: string | null; url: string; active: boolean; group?: string | null; badge?: string | number | null; badgeColor?: string };
/** A sidebar item, as rendered. */
export type NavigationItemView = { label: string; url: string; icon: string | null; isActive: boolean; badge: string | number | null; badgeColorClasses: string[]; childItems: NavigationItemView[]; activeChildItems: boolean };
/** The cluster a page belongs to: its own, or its resource's. */
export const clusterOf = (page: unknown): typeof Cluster | null => (page as any)?.cluster ?? (page as any)?.resource?.cluster ?? (page as any)?.parentResource?.cluster ?? null;
type ColumnSpan = number | 'full' | Record<string, number | 'full'>;
/**
 * Widget: a component displayed in a page's widget grid. Like a page, it may host schemas (`<name>Schema(schema)`) and
 * actions; the built-in widgets only expose what they use (chart filters, empty state actions).
 */
export abstract class Widget extends BasePage {
    static componentName: string;
    /** Width in the widget grid: a number of columns or `'full'` (from `lg`), or a span per breakpoint (`{ md: 2, xl: 3 }`). */
    static columnSpan: ColumnSpan = 1;
    /** Position on the dashboard (lower first); widgets without a sort keep their order, after the sorted ones. */
    static sort: number | null = null;
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
    /** Grid column classes and style: at the `lg` breakpoint, or per breakpoint. */
    protected gridColumn(): { classes: string[]; style: string } {
        const span = (this.constructor as typeof Widget).columnSpan;
        if (typeof span === 'object') {
            const entries = Object.entries(span).filter(([breakpoint, value]) => /^(default|sm|md|lg|xl|2xl)$/.test(breakpoint) && (value === 'full' || (Number.isInteger(value) && value > 0)));
            return {
                classes: ['fi-grid-col', ...entries.map(([breakpoint]) => (breakpoint === 'default' ? 'fi-grid-col-span' : `${breakpoint}:fi-grid-col-span`))],
                style: entries.map(([breakpoint, value]) => `--col-span-${breakpoint}: ${value === 'full' ? '1 / -1' : `span ${value} / span ${value}`};`).join(' '),
            };
        }
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
        return this.wrap(widgetSection(`<img alt="${e(t('filament-panels::layout.avatar.alt', { name: user!.name }))}" class="fi-avatar fi-circular fi-size-lg fi-user-avatar" src="${e(panel.getUserAvatarUrl(user!))}" loading="lazy" /><div class="fi-account-widget-main"><h2 class="fi-account-widget-heading">${e(t('filament-panels::widgets/account-widget.welcome'))}</h2><p class="fi-account-widget-user-name">${e(user!.name)}</p></div><form action="${e(panel.getLogoutUrl())}" method="post" class="fi-account-widget-logout-form"><input type="hidden" name="_token" value="${e(csrfToken(req, res))}" autocomplete="off"><button class="fi-icon-btn fi-size-md" title="${e(logout)}" aria-label="${e(logout)}" type="submit" ${loading}>${icon('m-arrow-left-end-on-rectangle', { alias: 'panels::widgets.account.logout-button' })}</button><button class="fi-btn fi-size-md fi-labeled-from-sm" type="submit" ${loading}>${icon('m-arrow-left-end-on-rectangle', { alias: 'panels::widgets.account.logout-button' })}${e(logout)}</button></form>`), ['fi-account-widget']);
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
        const githubIcon = icons.resolve('panels::widgets.filament-info.open-github-button');
        const github = githubIcon ? icon(githubIcon) : '<span class="fi-icon fi-size-md"><svg viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" fill="currentColor" fill-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"></path></svg></span>';
        return this.wrap(widgetSection(`<div class="fi-filament-info-widget-main"><a href="${e(WidgetClass.homeUrl)}" rel="noopener noreferrer" target="_blank"><svg aria-label="Navette" fill="currentColor" role="img" viewBox="0 0 96 24" xmlns="http://www.w3.org/2000/svg" class="fi-filament-info-widget-logo"><text x="0" y="19" font-size="22" font-weight="700" letter-spacing="-0.5">Navette</text></svg></a><p class="fi-filament-info-widget-version">v${e(WidgetClass.version)}</p></div><div class="fi-filament-info-widget-links">${link(WidgetClass.documentationUrl, icon('m-book-open', { alias: 'panels::widgets.filament-info.open-documentation-button' }), t('filament-panels::widgets/filament-info-widget.actions.open_documentation.label'))}${link(WidgetClass.githubUrl, github, t('filament-panels::widgets/filament-info-widget.actions.open_github.label'))}</div>`), ['fi-filament-info-widget']);
    }
}

/** Table properties a list page exposes to its widgets. */
const PAGE_TABLE_PROPERTIES = ['activeTab', 'paginators', 'tableColumnSearches', 'tableFilters', 'tableRecordsPerPage', 'tableSearch', 'tableSort'];

/** Valid HTML attribute names, Alpine and Livewire directives included (`x-on:click`, `@click`, `wire:click.prevent`). */
const STAT_ATTRIBUTE_NAME = /^[a-zA-Z_:@][a-zA-Z0-9_:.@-]*$/;
/** One stat of a StatsOverviewWidget. */
export class Stat {
    private _description: string | null = null;
    private _descriptionIcon: string | null = null;
    private _descriptionIconPosition: 'before' | 'after' = 'after';
    private _color: string | null = null;
    private _icon: string | null = null;
    private _chart: Record<string, number> | number[] | null = null;
    private _url: string | null = null;
    private _placeholder: string | null = null;
    private _extraAttributes: Record<string, AttrValue> = {};
    private label: string;
    private value: string | number | null;
    constructor(label: string, value: string | number | null) { this.label = label; this.value = value; }
    static make(label: string, value: string | number | null): Stat { return configured(new Stat(label, value)); }
    /** Registers a callback applied to every stat created afterwards (`Stat.configureUsing((stat) => stat.placeholder('-'))`). */
    static configureUsing(configure: (stat: Stat) => void): void { configureUsing(Stat, configure); }
    /** Shown instead of the value when it is blank (`null`, `undefined` or an empty string; `0` is not blank). Escaped. */
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    getPlaceholder(): string | null { return this._placeholder; }
    /**
     * Extra HTML attributes of the stat (`class`, `wire:click`, `x-on:click`…), written by the developer: names must be
     * valid attribute names, values are escaped. They replace the previous ones, unless `merge` is `true`.
     */
    extraAttributes(attributes: Record<string, AttrValue>, merge = false): this { this._extraAttributes = merge ? { ...this._extraAttributes, ...attributes } : { ...attributes }; return this; }
    getExtraAttributes(): Record<string, AttrValue> { return this._extraAttributes; }
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
        const filled = this.value !== null && this.value !== undefined && String(this.value).trim() !== '';
        const extra = Object.fromEntries(Object.entries(this._extraAttributes)
            .filter(([name, value]) => STAT_ATTRIBUTE_NAME.test(name) && !(this._url && name === 'href') && value !== null && value !== undefined && value !== false)
            .map(([name, value]) => [name, value === true ? true : e(String(value))]));
        const attributes = new Attributes(extra).merge({ class: 'fi-wi-stats-overview-stat' }).toHtml();
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
        return `<${tag}${this._url ? ` href="${e(this._url)}"` : ''} ${attributes}><div class="fi-wi-stats-overview-stat-content"><div class="fi-wi-stats-overview-stat-label-ctn">${this._icon ? icon(this._icon) : ''}<span class="fi-wi-stats-overview-stat-label">${e(this.label)}</span></div>${filled ? `<div class="fi-wi-stats-overview-stat-value">${e(String(this.value))}</div>` : `<div class="fi-wi-stats-overview-stat-placeholder">${e(this._placeholder ?? '')}</div>`}${description}</div>${chart}</${tag}>`;
    }
}

/** A row of stats. */
export abstract class StatsOverviewWidget extends Widget {
    static columnSpan: ColumnSpan = 'full';
    /** Polling interval, or `null` to disable polling. */
    static pollingInterval: string | null = '5s';
    abstract getStats(): Stat[] | Promise<Stat[]>;
    /** Heading shown above the stats. */
    protected getHeading(): string | null { return null; }
    /** Description under the heading. */
    protected getDescription(): string | null { return null; }
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
        const heading = this.getHeading(), description = this.getDescription();
        const header = heading !== null || description !== null ? `<header class="fi-section-header"><div class="fi-section-header-content fi-section-header-content-has-heading"><div class="fi-section-header-text-ctn">${heading !== null ? `<h3 class="fi-section-header-heading">${e(heading)}</h3>` : ''}${description !== null ? `<p class="fi-section-header-description">${e(description)}</p>` : ''}</div></div></header>` : '';
        const interval = (this.constructor as typeof StatsOverviewWidget).pollingInterval;
        const poll = interval && /^[0-9]+(ms|s)$/.test(interval) ? ` wire:poll.${interval}` : '';
        return this.wrap(`<div x-data="filamentSchema({ livewireId: ${e(js(this.id))}, schemaKey: 'content' })" x-on:form-validation-error.window="handleFormValidationError" x-on:reset-schema-component-state.window="handleClientSideStateReset" class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));"><div ${anonymous} class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component fi-grid-ctn"><div${poll} class="fi-sc-section"><section x-data="{
        isCollapsed: false,
    }" class="fi-section fi-section-not-contained${header ? ' fi-section-has-header' : ''}">${header}<div class="fi-section-content-ctn"><div class="fi-section-content fi-grid @xl:fi-grid-cols !@lg:fi-grid-cols fi-sc fi-sc-has-gap" style="--cols-cxl: repeat(${columns}, minmax(0, 1fr)); --cols-nclg: repeat(${columns}, minmax(0, 1fr)); --cols-default: repeat(1, minmax(0, 1fr));">${cells}</div></div></section></div></div></div></div>`, ['fi-wi-stats-overview']);
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
    /** Empty state shown when `getData()` returns nothing (see `isEmpty()`). */
    protected getEmptyStateHeading(): string { return t('filament-widgets::chart.empty.heading'); }
    protected getEmptyStateDescription(): string | null { return null; }
    protected getEmptyStateIcon(): string | null { return icons.resolve('widgets::chart-widget.empty-state') ?? 'o-x-mark'; }
    /** Actions in the footer of the empty state. They are mounted on the widget, so they may open a modal. */
    getEmptyStateActions(): (Action | ActionGroup)[] { return []; }
    /** Custom empty state, as trusted HTML (escape the data you put in it), replacing the default one. */
    getEmptyState(): string | null | Promise<string | null> { return null; }
    /** Whether the empty state is shown instead of the chart: when `getData()` returns an empty object by default. */
    isEmpty(): boolean | Promise<boolean> { return this.getCachedData().then((data) => Object.keys(data).length === 0); }
    static callable = ['updateChartData', 'mountAction', 'unmountAction', 'callMountedAction', 'callSchemaComponentMethod', 'applyFilters', 'resetFilters'];
    static locked = ['dataChecksum'];
    /**
     * Filters form state (`filtersFormSchema()`), read in `getData()`. Updated by the browser: validate it before use.
     * With deferred filters, the form edits `deferredFilters`, copied here by the "Apply" button.
     */
    filters: Record<string, unknown> | null = null;
    deferredFilters: Record<string, unknown> | null = null;
    /** `true`: the filters form only applies its changes when the user clicks "Apply". */
    static hasDeferredFilters = false;
    hasDeferredFilters(): boolean { return (this.constructor as typeof ChartWidget).hasDeferredFilters; }
    /** A custom filters form, in a dropdown of the header: the widget defines `filtersFormSchema(schema)` (or `filtersSchema(schema)`). */
    hasFiltersForm(): boolean { return typeof (this as any).filtersFormSchema === 'function' || typeof (this as any).filtersSchema === 'function'; }
    /** Name of the filters schema: `filtersForm` (`filtersFormSchema()`), or `filters` (`filtersSchema()`). */
    private filtersSchemaName(): string { return typeof (this as any).filtersFormSchema === 'function' ? 'filtersForm' : 'filters'; }
    getSchema(name: string): Schema {
        if (!this.hasFiltersForm() || name !== this.filtersSchemaName()) return super.getSchema(name);
        const schema = super.getSchema(name);
        if (this.hasDeferredFilters()) return schema.statePath('deferredFilters').partiallyRendered();
        schema.statePath('filters');
        for (const component of schema.getFlatComponents() as any[]) if (component instanceof Field && typeof (component as any).live === 'function') (component as any).live();
        return schema;
    }
    getFiltersForm(): Schema { return this.getSchema(this.filtersSchemaName()); }
    /** Fills the filters form with its defaults (and applies them, when deferred). */
    protected fillFilters(): void {
        const state: Record<string, unknown> = {};
        fillSchema(this.getFiltersForm(), state);
        if (this.hasDeferredFilters()) { this.deferredFilters = state; this.filters = JSON.parse(JSON.stringify(state)); }
        else this.filters = state;
    }
    /** "Apply" button of deferred filters. */
    applyFilters(): void {
        if (!this.hasFiltersForm()) return;
        this.filters = sanitizeFilterState(this.deferredFilters ?? {}) as Record<string, unknown>;
        this._cachedData = null;
    }
    /** Restores the default filters, and applies them at once. */
    resetFilters(): void {
        if (!this.hasFiltersForm()) return;
        this.fillFilters();
        this._cachedData = null;
    }
    /** Header button opening the filters dropdown (it calls nothing on the server). */
    getFiltersTriggerAction(): Action {
        return Action.make('filter').label(t('filament-widgets::chart.actions.filter.label')).iconButton().icon(icons.resolve('widgets::chart-widget.filter') ?? 'm-funnel').color('gray');
    }
    /** "Apply" button of deferred filters; customize it with `filtersApplyAction(action)`. */
    getFiltersApplyAction(): Action {
        const action = Action.make('applyFilters').label(t('filament-widgets::chart.filters.actions.apply.label')).action('applyFilters').button();
        return typeof (this as any).filtersApplyAction === 'function' ? (this as any).filtersApplyAction(action) : action;
    }
    /** "Reset" button of deferred filters; customize it with `filtersResetAction(action)`. */
    getFiltersResetAction(): Action {
        const action = Action.make('resetFilters').label(t('filament-widgets::chart.filters.actions.reset.label')).action('resetFilters').color('danger').button();
        return typeof (this as any).filtersResetAction === 'function' ? (this as any).filtersResetAction(action) : action;
    }
    /** Actions the browser may mount: those of the empty state (and of the filter fields). */
    protected getMountableActions(context: Record<string, unknown>): Action[] | Promise<Action[]> {
        return typeof context.schemaComponent === 'string' ? super.getMountableActions(context) : flattenActions(this.getEmptyStateActions());
    }
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
    /** Chart.js options: an object (serialized to JSON), or `RawJs.make('{ … }')` for JavaScript (callbacks). */
    getOptions(): Record<string, unknown> | RawJs | null { return null; }
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
    async mount(): Promise<void> {
        if (this.hasFiltersForm()) this.fillFilters();
        this.dataChecksum = await this.generateDataChecksum();
    }
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
        const isEmpty = await this.isEmpty();
        const actionCtx = { livewire: this as any, component: null as any, operation: null, record: null, get: () => undefined, state: undefined };
        const filtersDropdown = this.hasFiltersForm() ? await this.renderFiltersDropdown(actionCtx) : '';
        const assistive = isEmpty ? null : this.getChartAssistiveContent();
        const label = [heading, description].filter((value) => value !== null && value !== '').join('. ').trim();
        const collapsible = WidgetClass.isCollapsible;
        const interval = WidgetClass.pollingInterval;
        const poll = interval && /^[0-9]+(ms|s)$/.test(interval) ? ` wire:poll.${interval}="updateChartData"` : '';
        const filter = filters
            ? `<div class="fi-input-wrp fi-wi-chart-filter"><div wire:loading.delay.default.flex wire:target="filter" wire:key="${e(createHash('md5').update(`${this.id}.filter.loading`).digest('hex').slice(0, 16))}" class="fi-input-wrp-prefix fi-inline">${loadingIndicator(new Attributes({ class: 'fi-color fi-color-gray' }))}</div><div wire:loading.delay.default.class.remove="fi-input-wrp-content-ctn-ps" wire:target="filter" class="fi-input-wrp-content-ctn fi-input-wrp-content-ctn-ps"><select aria-label="${e(t('filament-widgets::chart.filter.label'))}" wire:model.live="filter" class="fi-select-input fi-select-input-has-inline-prefix">${Object.entries(filters).map(([value, text]) => `<option value="${e(value)}">${e(text)}</option>`).join('')}</select></div></div>`
            : '';
        const hasText = (heading !== null && heading !== '') || (description !== null && description !== '');
        const hasHeader = hasText || filter !== '' || filtersDropdown !== '';
        const header = hasHeader
            ? `<header${collapsible ? ` x-on:click="if (! $event.target.closest('.fi-section-header-after-ctn')) isCollapsed = ! isCollapsed"` : ''} class="fi-section-header"><div class="${cls(['fi-section-header-content', { 'fi-section-header-content-has-heading': hasText }])}">${hasText ? `<div class="fi-section-header-text-ctn">${heading ? `<h2 class="fi-section-header-heading">${e(heading)}</h2>` : ''}${description ? `<p class="fi-section-header-description">${e(description)}</p>` : ''}</div>` : ''}${filter || filtersDropdown ? `<div class="fi-section-header-after-ctn">${filter}${filtersDropdown}</div>` : ''}</div>${collapsible ? `<button aria-expanded="true" x-bind:aria-expanded="(! isCollapsed).toString()" x-bind:aria-controls="$id('fi-section-content')" x-bind:aria-label="isCollapsed ? ${e(js(t('filament::components/section.actions.expand.label')))} : ${e(js(t('filament::components/section.actions.collapse.label')))}" aria-label="${e(t('filament::components/section.actions.collapse.label'))}" type="button" x-on:click.stop="isCollapsed = ! isCollapsed" class="fi-icon-btn fi-size-md fi-section-collapse-btn">${icon('m-chevron-up', { alias: 'section.collapse-button' })}</button>` : ''}</header>`
            : '';
        const options = this.getOptions();
        const colors = ['bg', 'border', 'grid', 'text', 'tooltip-bg', 'tooltip-text', 'tooltip-border'];
        const refs = ['background', 'border', 'grid', 'text', 'tooltipBackground', 'tooltipText', 'tooltipBorder'];
        const frame = `<div x-load x-load-src="${e(this.panel.assetUrl('js/filament/widgets/components/chart.js'))}" wire:ignore data-chart-type="${e(type)}" x-data="chart({
                                cachedData: ${e(js(data))},
                                options: ${options instanceof RawJs ? e(options.js) : e(js(options))},
                                type: ${e(js(type))},
                            })" class="${cls([...this.panel.colors.getComponentClasses('stat-chart', this.getColor()), 'fi-wi-chart-frame', 'fi-wi-chart-canvas-ctn', { 'fi-wi-chart-frame-no-aspect-ratio': hasMaxHeight }])}"><canvas x-ref="canvas" aria-hidden="true" style="width: 100%; ${hasMaxHeight ? `max-height: ${e(maxHeight)}` : 'height: 100%; max-height: 100%'}"></canvas>${colors.map((name, index) => `<span aria-hidden="true" x-ref="${refs[index]}ColorElement" class="fi-wi-chart-${name}-color"></span>`).join('')}</div>`;
        const emptyStateActions = this.getEmptyStateActions();
        let empty = '';
        if (isEmpty) {
            const custom = await this.getEmptyState();
            if (custom !== null && custom !== undefined) empty = String(custom);
            else {
                const actions: string[] = [];
                for (const action of emptyStateActions) if (await action.isVisible(actionCtx)) actions.push(await action.toHtml(actionCtx));
                const footer = actions.length ? `<div class="fi-ac fi-align-center">${actions.join('')}</div>` : undefined;
                empty = `<div class="${cls(['fi-wi-chart-frame', { 'fi-wi-chart-frame-no-aspect-ratio': hasMaxHeight }])}"${hasMaxHeight ? ` style="min-height: ${e(maxHeight)}"` : ''}>${emptyState({ heading: this.getEmptyStateHeading(), description: this.getEmptyStateDescription() ?? undefined, icon: this.getEmptyStateIcon() ?? undefined, iconColor: 'gray', contained: false, footer })}</div>`;
            }
        }
        // Modals of the mounted actions (empty state actions, actions of filter fields).
        const modals = emptyStateActions.length || this.hasFiltersForm() ? await this.renderActionModals() : '';
        const body = `<div${poll}${isEmpty ? ' style="display: none"' : ''}><div class="fi-wi-chart-image"${label ? ` role="img" aria-label="${e(label)}"` : ''}>${frame}</div>${assistive ? `<div class="fi-wi-chart-assistive-content fi-sr-only"><p>${e(assistive)}</p></div>` : ''}</div>${empty}`;
        return this.wrap(`<section x-data="{
        isCollapsed:  false ,
    }"${collapsible ? ` x-id="['fi-section-content']" x-on:collapse-section.window="if ($event.detail.id == (null ?? $el.id)) isCollapsed = true" x-on:expand="isCollapsed = false" x-on:expand-section.window="if ($event.detail.id == (null ?? $el.id)) isCollapsed = false" x-on:open-section.window="if ($event.detail.id == (null ?? $el.id)) isCollapsed = false" x-on:toggle-section.window="if ($event.detail.id == (null ?? $el.id)) isCollapsed = ! isCollapsed" x-bind:class="isCollapsed &amp;&amp; 'fi-collapsed'"` : ''} class="${cls(['fi-section', { 'fi-section-has-header': hasHeader, 'fi-collapsible': collapsible }])}">${header}<div${collapsible ? ` x-bind:id="$id('fi-section-content')"` : ''} class="fi-section-content-ctn"><div class="fi-section-content">${body}</div></div></section>${modals}`, ['fi-wi-chart']);
    }
    /** Filters dropdown of the header: the trigger button, the form, and the "Apply" / "Reset" buttons when deferred. */
    protected async renderFiltersDropdown(ctx: any): Promise<string> {
        const buttons = this.hasDeferredFilters() ? `<div class="fi-wi-chart-filter-content-actions-ctn">${await this.getFiltersApplyAction().toHtml(ctx)}${await this.getFiltersResetAction().toHtml(ctx)}</div>` : '';
        return `<div x-data="filamentDropdown({ isMenu: false })" class="fi-dropdown fi-wi-chart-filter"><div x-on:mousedown="if ($event.button === 0) toggle($event)" class="fi-dropdown-trigger">${await this.getFiltersTriggerAction().toHtml(ctx)}</div><div x-cloak x-float.placement.bottom-end.flip.shift.offset="{ offset: 8,  }" x-ref="panel" x-transition:enter-start="fi-opacity-0" x-transition:leave-end="fi-opacity-0" class="fi-dropdown-panel fi-width-xs"><div class="fi-wi-chart-filter-content">${await this.getFiltersForm().toHtml()}${buttons}</div></div></div>`;
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
/**
 * Several relation managers under one tab of a record page: `RelationGroup.make('Contacts', [PhonesManager, EmailsManager])`.
 * The managers are shown one below the other.
 */
export class RelationGroup {
    private _label: string;
    private _managers: (typeof RelationManager)[];
    private _icon: string | null = null;
    private _badge: string | number | null | (() => string | number | null | Promise<string | number | null>) = null;
    private _badgeColor = 'primary';
    constructor(label: string, managers: (typeof RelationManager)[]) { this._label = label; this._managers = managers; }
    static make(label: string, managers: (typeof RelationManager)[]): RelationGroup { return new RelationGroup(label, managers); }
    icon(name: string | null): this { this._icon = name; return this; }
    badge(badge: string | number | null | (() => string | number | null | Promise<string | number | null>)): this { this._badge = badge; return this; }
    badgeColor(color: string): this { this._badgeColor = color; return this; }
    getLabel(): string { return this._label; }
    getIcon(): string | null { return this._icon; }
    getManagers(): (typeof RelationManager)[] { return this._managers; }
    async getBadge(): Promise<string | number | null> { return typeof this._badge === 'function' ? this._badge() : this._badge; }
    getBadgeColor(): string { return this._badgeColor; }
}
/** A tab of a record page's relation managers: a manager, a group of them, or the page's own content. */
type RelationTab = { key: string; label: string; icon: string | null; badge: string | number | null; badgeColor: string; managers: (typeof RelationManager)[]; isContent: boolean };
/** Relation manager tabs of a record page: only the active tab's managers are mounted, as lazy child components. */
class RelationManagerTabs extends SchemaComponent {
    private content: SchemaComponent[] = [];
    constructor(content: SchemaComponent[] = []) { super(); this._keyName = 'relationManagerTabs'; this.content = content; }
    /** With content (the form or infolist), it is the first tab: `hasCombinedRelationManagerTabsWithContent()`. */
    getChildSchemas(): Schema[] { return this.content.length ? [childSchema(this, this.content)] : []; }
    getExposedMethods(): string[] { return ['getLazyLoadedTabBadges', 'getDeferredTabBadges']; }
    getLazyLoadedTabBadges(): Record<string, unknown> { return {}; }
    getDeferredTabBadges(): Record<string, unknown> { return {}; }
    /** Tabs the user can see on this record: managers and groups whose `canViewForRecord()` allows it. */
    private async tabs(page: EditRecord | ViewRecord): Promise<RelationTab[]> {
        const owner = (page as any)._record;
        const PageClass = page.constructor as typeof Page;
        const visible = async (manager: typeof RelationManager) => Boolean(await manager.canViewForRecord(owner, PageClass));
        const tabs: RelationTab[] = [];
        if (this.content.length) tabs.push({ key: '-1', label: page.getContentTabLabel(), icon: page.getContentTabIcon(), badge: null, badgeColor: 'primary', managers: [], isContent: true });
        for (const [index, entry] of page.getRelationManagers().entries()) {
            if (entry instanceof RelationGroup) {
                const managers: (typeof RelationManager)[] = [];
                for (const manager of entry.getManagers()) if (await visible(manager)) managers.push(manager);
                if (managers.length) tabs.push({ key: String(index), label: entry.getLabel(), icon: entry.getIcon(), badge: await entry.getBadge(), badgeColor: entry.getBadgeColor(), managers, isContent: false });
            } else if (await visible(entry)) {
                tabs.push({ key: String(index), label: entry.getTitle(), icon: entry.getIcon(), badge: await entry.getBadge(owner, PageClass), badgeColor: entry.getBadgeColor(), managers: [entry], isContent: false });
            }
        }
        return tabs;
    }
    async isVisible(): Promise<boolean> { return (await super.isVisible()) && (this.content.length > 0 || (await this.tabs(this.livewire as any)).length > 0); }
    async toHtml(): Promise<string> {
        const page = this.livewire as unknown as EditRecord;
        const tabs = await this.tabs(page);
        if (!tabs.length) return '';
        const key = this.getKey()!;
        const id = page.id;
        const active = tabs.find((tab) => tab.key === String(page.activeRelationManager)) ?? tabs[0];
        const tabId = (tab: RelationTab) => `fi-sc-tab-${createHash('md5').update(`${key}.${tab.key}`).digest('hex')}`;
        const header = tabs.map((tab) => {
            const isActive = tab === active;
            const iconHtml = tab.icon ? icon(tab.icon) : '';
            const badgeHtml = tab.badge !== null && tab.badge !== undefined && tab.badge !== '' ? uiBadge({ color: tab.badgeColor, size: 'sm' }, e(String(tab.badge))) : '';
            return `<button id="${tabId(tab)}" role="tab" aria-controls="${key}.${tab.key}" aria-selected="${isActive ? 'true' : 'false'}" x-bind:aria-selected="isTabSelected('${tab.key}')" tabindex="${isActive ? '0' : '-1'}" x-bind:tabindex="getTabIndex('${tab.key}')" data-tab-key="${tab.key}" x-bind:data-tab-available="Boolean(true).toString()" x-show="true" x-on:click.capture="if (! selectTab('${tab.key}', $event)) { $event.preventDefault(); $event.stopImmediatePropagation() }" x-bind:class="{ 'fi-active': isTabSelected('${tab.key}') }" type="button" wire:click="$set('activeRelationManager', '${tab.key}')" class="${cls(['fi-tabs-item', { 'fi-active': isActive }])}">${iconHtml}<span class="fi-tabs-item-label">${e(tab.label)}</span>${badgeHtml}</button>`;
        });
        const panels: string[] = [];
        for (const tab of tabs) {
            let content = '';
            if (tab.isContent) {
                // The form or infolist: always rendered, so that its state and actions stay in the page.
                content = (await this.getChildSchemas()[0]?.toHtml()) ?? '';
            } else if (tab === active) {
                const parts: string[] = [];
                for (const manager of tab.managers) {
                    const componentName = (page as any)._runtime.nameOf(manager);
                    const childKey = `${key}.${tab.key}.${componentName}`;
                    const child = await page.mountChild(componentName, { ownerRecord: page.recordKey }, `${id}.${childKey}`, { lazy: true });
                    parts.push(`<div wire:partial="schema-component::${e(childKey)}" x-data="filamentSchemaComponent(${e(js({ key: childKey, exposedMethods: [], path: '', containerPath: '' }))})" wire:key="${e(`${id}.${childKey}`)}" class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component">${child}</div></div>`);
                }
                content = `<div class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));">${parts.join('')}</div>`;
            }
            const isActive = tab === active;
            panels.push(`<div aria-labelledby="${tabId(tab)}" id="${key}.${tab.key}" role="tabpanel" tabindex="0" wire:key="${id}.${key}.${tab.key}.container" x-show="true" x-bind:class="{ 'fi-active': isTabSelected('${tab.key}') }" x-on:expand="revealTab('${tab.key}')" x-data="filamentSchemaComponent(${e(js({ key: `${key}.${tab.key}`, exposedMethods: [], path: '', containerPath: '' }))})" class="${cls(['fi-sc-tabs-tab', { 'fi-active': isActive && tab.isContent }])}">${content}</div>`);
        }
        const activeIndex = tabs.indexOf(active);
        return `<div x-data="tabsSchemaComponent({
 activeTab: ${activeIndex + 1},
 hasTabPanels: true,
 isScrollable: true,
 isVertical: false,
 livewireId: ${e(js(id))},
 livewireProperty: 'activeRelationManager',
 tab: '${active.key}',
 })" x-load x-load-src="${e(page.panel.assetUrl('js/filament/schemas/components/tabs.js'))}" wire:ignore.self id="${key}" wire:key="${id}.${key}.container" class="fi-sc-tabs"><input type="hidden" x-ref="tabsData" data-active-tab="${active.key}" /><div x-ref="tabsHeader" class="fi-tabs"><div x-ref="tablist" role="tablist" x-bind:role="hasVisibleTabHeaders ? 'tablist' : 'group'" aria-label="${e(t('filament::components/tabs.label'))}" x-on:keydown="handleKeydown($event)" data-prevent-disabled-clicks wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" wire:target="activeRelationManager" class="fi-sc-tabs-tablist">${header.join('')}</div></div>${panels.join('')}</div>`;
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
    private _icon: string | null = null;
    private _iconPosition: 'before' | 'after' = 'before';
    /** Icon of the tab, before its label (or after, with `iconPosition('after')`). */
    icon(name: string | null): this { this._icon = name; return this; }
    iconPosition(position: 'before' | 'after'): this { this._iconPosition = position; return this; }
    getIcon(): string | null { return this._icon; }
    getIconPosition(): 'before' | 'after' { return this._iconPosition; }
    getLabel(key: string): string { return this._label ?? ucfirst(key.replace(/[_-]+/g, ' ')); }
    hasBadge(): boolean { return this._badge !== null; }
    async getBadge(): Promise<number | string | null> { return this._badge ? this._badge() : null; }
    getBadgeColor(): string { return this._badgeColor; }
    /** False until `badgeColor()` is called: a lazy-loaded badge then gets no color class. */
    hasBadgeColor(): boolean { return this._hasBadgeColor; }
    getQuery(): ((query: any) => void) | null { return this._query; }
    private _extraAttributes: Record<string, string | number | boolean | null> = {};
    /** Extra HTML attributes of the tab button, e.g. `{ 'data-cy': 'statement-confirmed-tab' }`; `class` is added to its classes. */
    extraAttributes(attributes: Record<string, string | number | boolean | null>, merge = false): this { this._extraAttributes = merge ? { ...this._extraAttributes, ...attributes } : { ...attributes }; return this; }
    getExtraAttributes(): Record<string, string | number | boolean | null> { return this._extraAttributes; }
    private _excludeQueryWhenResolvingRecord = false;
    /**
     * Row actions of the active tab normally only find records that still match the tab's query: with this, a record
     * that left the tab (e.g. deactivated by the previous action) can still be acted upon. Never use it on a tab that restricts
     * access (tenant, ownership): the tab is chosen by the browser.
     */
    excludeQueryWhenResolvingRecord(condition = true): this { this._excludeQueryWhenResolvingRecord = condition; return this; }
    shouldExcludeQueryWhenResolvingRecord(): boolean { return this._excludeQueryWhenResolvingRecord; }
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
        // Extra attributes (`Tab.extraAttributes()`): those the button already has are not repeated; `class` joins its classes.
        const reserved = new Set(['id', 'type', 'class', 'tabindex', 'data-tab-key', 'wire:click', 'x-show']);
        const tabExtraAttributes = (tab: Tab) => { const extra = Object.entries(tab.getExtraAttributes()).filter(([name]) => !reserved.has(name)); return extra.length ? ` ${new Attributes(Object.fromEntries(extra)).toHtml()}` : ''; };
        const extraTabClass = (tab: Tab) => { const value = tab.getExtraAttributes().class; return typeof value === 'string' ? value : null; };
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
            return `<button id="fi-sc-tab-${createHash('md5').update(`${key}.${k}`).digest('hex')}" aria-pressed="${k === active ? 'true' : 'false'}" x-bind:aria-pressed="isTabSelected(${q(k)})" tabindex="0" x-bind:tabindex="getTabIndex(${q(k)})" data-tab-key="${e(k)}" x-bind:data-tab-available="Boolean(true).toString()" x-show="true" x-on:click.capture="if (! selectTab(${q(k)}, $event)) { $event.preventDefault(); $event.stopImmediatePropagation() }" x-bind:class="{ 'fi-active': isTabSelected(${q(k)}) }" type="button" wire:click="$set('activeTab', ${k === '' ? 'null' : q(k)})"${tabExtraAttributes(tab)} class="${cls(['fi-tabs-item', { 'fi-active': k === active }, extraTabClass(tab)])}">${tab.getIcon() && tab.getIconPosition() === 'before' ? icon(tab.getIcon()!, { attributes: new Attributes().class(['fi-tabs-item-icon']) }) : ''}<span class="fi-tabs-item-label">${e(tab.getLabel(k))}</span>${tab.getIcon() && tab.getIconPosition() === 'after' ? icon(tab.getIcon()!, { attributes: new Attributes().class(['fi-tabs-item-icon']) }) : ''}${badge}</button>`;
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
    static callable = ['updateTableColumnState', 'callTableColumnMethod', 'sortTable', 'gotoPage', 'nextPage', 'previousPage', 'applyTableFilters', 'resetTableFiltersForm', 'removeTableFilters', 'removeTableFilter', 'applyTableColumnManager', 'resetTableColumnManager', 'toggleTableReordering', 'reorderTable'];
    static resource: typeof Resource;
    /** In a cluster, the list page shows the cluster's sub-navigation. */
    getSubNavigation(): SubNavigationItem[] | Promise<SubNavigationItem[]> {
        const cluster = this.resource.cluster;
        return cluster?.shouldRegisterSubNavigation ? this.panel.getClusterSubNavigation(cluster, this, (this._ctx as PanelContext).user) : [];
    }
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
        return ['tables', page.name, page.resource?.slug ?? '', relationshipNameOf(page), part].join(':');
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
        this.deselectTableRecordsWhenFiltered();
    }
    /** Filters or searches changed: the selection is cleared, unless the table says `deselectAllRecordsWhenFiltered(false)`. */
    protected deselectTableRecordsWhenFiltered(): void {
        if (this.getTable().shouldDeselectAllRecordsWhenFiltered()) this.dispatch('deselectAllTableRecords', [], { self: true });
    }
    applyTableFilters(): void {
        // Only filters declared by the table reach the applied state: each sanitizes its own state, or else only its known keys are kept.
        this.tableFilters = this.sanitizeTableFilters(this.tableDeferredFilters);
        this.paginators.page = 1;
        this.deselectTableRecordsWhenFiltered();
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
        this.deselectTableRecordsWhenFiltered();
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
        this.deselectTableRecordsWhenFiltered();
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
        this.deselectTableRecordsWhenFiltered();
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
    getBulkActions(): Action[] { return (this.getTable().getBulkActions() ?? [DeleteBulkAction.make()]).map((action: any) => (typeof action?.bulk === 'function' ? action.bulk() : action)); }
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
        if (typeof context.recordKey !== 'string') return null;
        const adapter = this.resource.adapter;
        // The trashed filter shows deleted records: their row actions must find them, no other key is reachable this way.
        const record = trashedFilterValue(this) !== null && adapter.findWithTrashed ? await adapter.findWithTrashed(context.recordKey) : await adapter.find(context.recordKey);
        if (!record) return null;
        // As in Filament, the record must still match the active tab, unless the tab is `excludeQueryWhenResolvingRecord()`.
        // As in Filament, it must also match the applied filters, except those marked `excludeWhenResolvingRecord()`.
        if (!(await recordMatchesTableFilters(this.getTable(), this, adapter, adapter.getKey(record)))) return null;
        const tab = this.getTabs()[this.getActiveTabKey()];
        const modifier = tab?.getQuery();
        if (!modifier || tab!.shouldExcludeQueryWhenResolvingRecord()) return record;
        const keys = await adapter.listKeys({ keys: [adapter.getKey(record)], trashed: trashedFilterValue(this) !== null ? 'with' : 'without', modifiers: [modifier] });
        return keys.length ? record : null;
    }
    /**
     * Calls a method of a column's JavaScript (the server-side search of a `SelectColumn`...). Only exposed, read-only methods of a
     * visible column, for a record within the table's scope; nothing is re-rendered.
     */
    async callTableColumnMethod(columnName: unknown, recordKey: unknown, method: unknown, args: unknown = null): Promise<unknown> {
        this.skipRender();
        return callTableColumnMethod(this.getTable(), this, this.getDataAdapterForTable(), columnName, recordKey, method, args);
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
        if (!this.isTrackingDeselectedTableRecords) {
            keys = await adapter.keysInScope(clean(this.selectedTableRecords));
            // As in Filament, the selection is narrowed to the filtered query unless `deselectAllRecordsWhenFiltered(false)`.
            if (keys.length && table.shouldDeselectAllRecordsWhenFiltered() && table.getFilters().length) keys = await adapter.listKeys({ ...getTableQuery(table, this), keys });
        } else {
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
    /**
     * The selected records, for an action using `accessSelectedRecords()` (`action.getSelectedRecords()`): loaded by chunks, or
     * only their keys when `fetch` is `false` (and the table has no selectability check).
     */
    async getSelectedTableRecords(fetch = true, chunkSize = 100): Promise<any[]> {
        const keys = await this.getSelectedRecordKeys();
        if (!fetch) return keys;
        const adapter = this.getDataAdapterForTable();
        const records: any[] = [];
        const size = Math.max(1, Math.floor(chunkSize) || 100);
        for (let index = 0; index < keys.length; index += size) records.push(...(await Promise.all(keys.slice(index, index + size).map((key) => adapter.find(key)))).filter((record) => record !== null));
        return records;
    }
    /** A query of the selected records (`action.getSelectedRecordsQuery()`): the adapter's query builder, restricted to the selected keys. */
    async getSelectedTableRecordsQuery(): Promise<any> {
        const adapter = this.getDataAdapterForTable();
        if (typeof adapter.newQuery !== 'function') throw new Error('getSelectedRecordsQuery() needs a data adapter with newQuery() (ObjectionAdapter).');
        return adapter.newQuery({ keys: await this.getSelectedRecordKeys(), trashed: 'with' });
    }
    /**
     * After an action that used the selected records: the success notification (`successNotificationTitle()`), or the failure
     * notification with the messages of `reportBulkProcessingFailure()`.
     */
    async notifySelectedRecordsOutcome(action: Action): Promise<void> {
        action.markSelectedRecordsOutcomeNotified();
        const total = action.getTotalSelectedRecordsCount(), success = action.getSuccessfulSelectedRecordsCount();
        if (success >= total) {
            const title = action.getSuccessNotificationTitle();
            if (title) Notification.make().success().title(title).send();
            return;
        }
        const withoutMessage = action.getBulkProcessingFailureWithoutMessageCount();
        const body = [...action.getBulkProcessingFailureMessages(), ...(withoutMessage ? [action.getMissingBulkProcessingFailureNotificationMessage(withoutMessage, total)] : [])].filter(Boolean).join(' ');
        const title = action.getFailureNotificationTitle(success, total) ?? action.getSuccessNotificationTitle() ?? '';
        if (!title && !body) return;
        const notification = Notification.make().title(title);
        (success ? notification.warning() : notification.danger()).body(body || null).send();
    }
    async processSelectedRecords(action: Action, process: (record: any) => unknown | Promise<unknown>): Promise<{ total: number; success: number; unauthorized: number; failed: number }> {
        const keys = await this.getSelectedRecordKeys();
        // `reportBulkProcessingFailure()` calls made by `process` count as failures with their own message.
        action.startSelectedRecordsRun(keys.length);
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
                const reportedBefore = action.getSuccessfulSelectedRecordsCount();
                try {
                    const result = await process(record);
                    if (action.getSuccessfulSelectedRecordsCount() < reportedBefore) failed++;
                    else if (result === false) failed++; else success++;
                } catch (error) { failed++; if (failed === 1) console.error(error); }
            }
        }
        const total = keys.length;
        if (unauthorized + failed === 0) {
            const title = action.getSuccessNotificationTitle();
            if (title) Notification.make().success().title(title).send();
        } else {
            const reported = action.getBulkProcessingFailureMessages();
            const reportedCount = action.getTotalSelectedRecordsCount() - action.getSuccessfulSelectedRecordsCount() - action.getBulkProcessingFailureWithoutMessageCount();
            const unreported = Math.max(0, failed - reportedCount);
            const body = [action.getMissingBulkAuthorizationFailureNotificationMessage(unauthorized, total) && unauthorized ? action.getMissingBulkAuthorizationFailureNotificationMessage(unauthorized, total) : null, ...reported, unreported ? action.getMissingBulkProcessingFailureNotificationMessage(unreported, total) : null].filter(Boolean).join(' ');
            const notification = Notification.make().title(action.getFailureNotificationTitle(success, total) ?? action.getSuccessNotificationTitle() ?? '');
            (success ? notification.warning() : notification.danger()).body(body || null).send();
        }
        action.markSelectedRecordsOutcomeNotified();
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
        const table = this.getTable();
        // One menu per `BulkActionGroup` (the default "Bulk actions" menu when the table declares none).
        const bulkActionGroups: BulkActionMenu[] = [];
        for (const group of table.getBulkActionGroups() ?? [TableBulkActionGroup.make(this.getBulkActions())]) {
            const html: string[] = [];
            for (const action of group.getActions()) if (await action.isVisible(ctx)) html.push(await action.toGroupedHtml(ctx, { table: true, bulk: true }));
            bulkActionGroups.push(group.toMenu(html));
        }
        return renderTable(table, this, resource.adapter, {
            bulkActionGroups, headerActions: await this.renderTableHeaderActions(ctx), toolbarActions: await this.renderTableToolbarActions(ctx), emptyStateActions: await this.renderTableEmptyStateActions(ctx), after: await this.renderActionModals(),
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
            rowActions: async (record) => resource.isSimple || table.getRecordActions().length || !(await canOn(this, 'update', record)) ? [] : [{ label: t('filament-actions::edit.single.label'), url: resource.getUrl('edit', resource.adapter.getKey(record)), icon: icons.resolve('actions::edit-action') ?? 'c-pencil-square', key: `edit.${createHash('md5').update(resource.adapter.getKey(record)).digest('hex')}` }],
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
    updatedTableSearch(): void { this.paginators.page = 1; this.deselectTableRecordsWhenFiltered(); }
    getDataAdapterForTable(): DataAdapter { return this.resource.adapter; }
    getDataAdapter(): DataAdapter { return this.resource.adapter; }
    updatedTableColumnSearches(): void { this.paginators.page = 1; this.deselectTableRecordsWhenFiltered(); }
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
 * Child component showing the table of a form's `TableSelect` (and of a `ModalTableSelect`'s modal). It is a list page
 * without actions: search, filters, sorting, pagination and the column manager, plus record checkboxes bound to the field's
 * state (`wire:model` on the child, `state` here).
 */
export class TableSelectComponent extends ListRecords {
    static callable = ['getAllSelectableTableRecordKeys'];
    static locked = ['definition', 'isMultiple', 'maxSelectableRecords', 'tableArguments'];
    /** Set by the form on every render, never by the browser. */
    static reactive = ['isDisabled'];
    /** Id of the field's table definition (see `getTableSelectDefinition()`). */
    definition = '';
    isDisabled = false;
    isMultiple = false;
    maxSelectableRecords: number | null = null;
    tableArguments: Record<string, unknown> = {};
    /** Selected key (or keys): bound to the field's state. Checked by the field on the server, never trusted here. */
    state: string | string[] | null = null;
    _definition: TableSelectDefinition | null = null;
    _selectFacade: any = null;

    getDefinition(): TableSelectDefinition {
        if (this._definition) return this._definition;
        const definition = getTableSelectDefinition(String(this.definition));
        // Registered when the form is built: missing after a restart until the page is reloaded.
        if (!definition) throw new WireError(419, 'Table select definition not found: reload the page.');
        return (this._definition = definition);
    }
    /** What ListRecords expects from a resource: the configuration's adapter and labels; viewing only. */
    get resource(): any {
        if (this._selectFacade) return this._selectFacade;
        const definition = this.getDefinition();
        const configuration = definition.configuration as any;
        const plural = typeof configuration.getPluralModelLabel === 'function' ? configuration.getPluralModelLabel() : (configuration.pluralModelLabel ?? 'records');
        return (this._selectFacade = {
            isSimple: true, slug: '', modelLabel: configuration.modelLabel ?? 'record', relations: [], adapter: getTableSelectDataAdapter(definition),
            // The table only shows records: editing cells, reordering or deleting from it is refused.
            can: (ability: string, user: unknown) => (ability === 'viewAny' && typeof configuration.can === 'function' ? configuration.can('viewAny', user) : ability === 'viewAny' || ability === 'view'),
            getPluralModelLabel: () => plural,
            getTitleCasePluralModelLabel: () => plural,
            getRecordTitle: () => configuration.modelLabel ?? 'record',
            table: (table: Table) => table, getUrl: () => '', form: (schema: any) => schema,
        });
    }
    /** On mount, `boot()` runs before the props are set: access is then checked in `mount()`. */
    protected isAccessAuthorized(ctx: any): Promise<boolean> { return Promise.resolve(this.definition === '' ? true : this.resource.can('viewAny', ctx.user)); }
    getTable(): Table {
        const definition = this.getDefinition();
        const table = makeTableSelectTable(definition.configuration, this.tableArguments && typeof this.tableArguments === 'object' ? this.tableArguments : {});
        if (table.getPluralModelLabel() === 'records') table.pluralModelLabel(this.resource.getPluralModelLabel());
        return table
            .headerActions([]).recordActions([]).toolbarActions([]).emptyStateActions([]).groupedBulkActions([])
            .recordAction(null)
            .reorderable(null)
            .persistFiltersInSession(false).persistSearchInSession(false).persistColumnSearchesInSession(false).persistSortInSession(false).persistGroupingInSession(false)
            .maxSelectableRecords(this.isMultiple ? this.maxSelectableRecords : 1);
    }
    async mount(): Promise<void> {
        if (!(await this.resource.can('viewAny', (this._ctx as any)?.user ?? null))) throw new WireError(403, 'Forbidden.');
        const table = this.getTable();
        this.tableFilters = table.getDefaultFilterState();
        this.tableDeferredFilters = table.getDefaultFilterState();
        this.tableColumns = table.getDefaultColumnState();
        this.tableRecordsPerPage = table.getDefaultPageOption() as number;
        initializeTableGrouping(table, this as any);
    }
    /** Relationship constraints of the field, on top of the table's own query. */
    modifyTableQuery(query: { modifiers?: ((q: any) => void)[] }): void {
        for (const modifier of this.getDefinition().modifiers) (query.modifiers ??= []).push((q) => { modifier(q); });
    }
    getTabs(): Record<string, any> { return {}; }
    getHeaderActions(): any[] { return []; }
    getBulkActions(): any[] { return []; }
    getRecordActions(): any[] { return []; }
    protected getMountableActions(context: Record<string, unknown>): any[] | Promise<any[]> {
        // Only the actions of the filters form fields (a searchable filter select…).
        return typeof context.schemaComponent === 'string' ? this.getSchemaComponentActions(context.schemaComponent) : [];
    }
    protected async resolveActionRecord(): Promise<unknown> { return null; }
    /** The selection survives filtering and searching (Filament's `deselectAllRecordsWhenFiltered(false)`). */
    dispatch(name: string, params: Record<string, unknown> | unknown[] = {}, options: { self?: boolean } = {}): void {
        if (name === 'deselectAllTableRecords') return;
        super.dispatch(name, params, options);
    }
    /** "Select all": every selectable record of the current query (or page), up to the selection limit. */
    async getAllSelectableTableRecordKeys(): Promise<string[]> {
        if (this.isDisabled) return [];
        const table = this.getTable(), adapter = this.resource.adapter;
        const keys = table.selectsCurrentPageOnly()
            ? (await getTableRecords(table, this, adapter)).records.map((record: any) => adapter.getKey(record))
            : (await adapter.listKeys(getTableQuery(table, this))).slice(0, MAX_UNPAGINATED_RECORDS);
        const selectable = await filterSelectableKeys(table, adapter, keys);
        const max = table.getMaxSelectableRecords();
        return max !== null ? selectable.slice(0, max) : selectable;
    }
    async renderTable(): Promise<string> {
        const table = this.getTable();
        return renderTable(table, this, this.resource.adapter, {
            selection: { property: 'state', disabled: this.isDisabled },
            canReorder: false,
            filtersForm: table.getFilters().length ? await this.getSchema('tableFiltersForm').toHtml() : null,
            after: await this.renderActionModals(),
        });
    }
    async render(): Promise<string> { return this.renderTable(); }
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
    /**
     * Nested resource managing these records (Filament's `$relatedResource`): its table, form, labels and policy are used, the
     * relationship comes from its nesting, and the create, edit and view actions open its pages instead of modals.
     * A function returning the resource (`() => TaskResource`) breaks circular imports.
     */
    static relatedResource: ResourceReference | null = null;
    static getRelatedResource(): typeof Resource | null { return resolveResourceReference(this.relatedResource); }
    /** Data adapter limited to records related to the given owner (the related resource's adapter scoped to the owner, if any). */
    static adapterFor(ownerKey: string): DataAdapter {
        const related = this.getRelatedResource();
        if (related) return relatedResourceAdapter(related, ownerKey);
        throw new Error('RelationManager.adapterFor() must be defined.');
    }
    /** Policy for related records (same abilities as a resource policy). */
    static policy: Policy | null = null;
    protected isAccessAuthorized(ctx: PanelContext): Promise<boolean> { return this.resource.can('viewAny', ctx.user); }
    static table(table: Table): Table { return this.getRelatedResource()?.table(table) ?? table; }
    static form(schema: Schema): Schema { return this.getRelatedResource()?.form(schema) ?? schema; }
    static getTitle(): string { return this.title ?? (this.getRelatedResource()?.getTitleCasePluralModelLabel() ?? ucfirst(relationshipNameOf(this).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase())); }
    /** Icon of the manager's tab. */
    static icon: string | null = null;
    static getIcon(): string | null { return this.icon; }
    /** Badge of the manager's tab (a count of related records…), and its color. */
    static badge: string | number | null = null;
    static badgeColor = 'primary';
    static getBadge(_ownerRecord: any, _pageClass: typeof Page): string | number | null | Promise<string | number | null> { return this.badge; }
    static getBadgeColor(): string { return this.badgeColor; }
    /**
     * Whether the manager is shown for this record and page (all by default). Hide it here rather than by denying `viewAny`,
     * which would forbid the whole page.
     */
    static canViewForRecord(_ownerRecord: any, _pageClass: typeof Page): boolean | Promise<boolean> { return true; }

    /** Owner record key: set on mount by the page, never writable from the browser. */
    ownerRecord = '';
    static locked = ['ownerRecord'];
    _facade: any = null;
    /** What ListRecords expects from a resource, provided here by the relation manager. */
    get resource(): any {
        const manager = this.constructor as typeof RelationManager;
        return (this._facade ??= withRelatedResource({
            isSimple: true, slug: '', modelLabel: manager.modelLabel, relations: [], adapter: manager.adapterFor(this.ownerRecord),
            can: (ability: string, user: User | null, record: unknown = null) => { const rule = manager.policy?.[ability]; return this.panel.authorize(user, ability, { resource: manager, record, rule: rule ? () => rule(user!, record) : null }); },
            getPluralModelLabel: () => manager.pluralModelLabel ?? plural(manager.modelLabel),
            getTitleCasePluralModelLabel: () => (manager.pluralModelLabel ?? plural(manager.modelLabel)).split(' ').map(ucfirst).join(' '),
            getRecordTitle: (record: any) => (manager.recordTitleAttribute ? String(record?.[manager.recordTitleAttribute] ?? '') : manager.modelLabel),
            table: (table: Table) => manager.table(table), getUrl: () => '',
            form: (schema: Schema) => {
                const form = manager.form(schema.columns(2));
                const pivot = manager.pivotForm(form);
                return pivot.length ? form.components([...form.getComponents(), ...pivot]) : form;
            },
            pivotFieldNames: () => manager.pivotForm(Schema.make(this)).filter((component): component is Field => component instanceof Field).map((field) => field.getName()),
        }, manager.getRelatedResource(), this.ownerRecord));
    }
    getTable(): Table {
        const manager = this.constructor as typeof RelationManager;
        const table = manager.table(new Table().pluralModelLabel(this.resource.getPluralModelLabel()).heading(manager.getTitle()));
        // With a related resource, rows link to its view or edit page.
        if (manager.getRelatedResource()) return linkRelatedRecords(table, this.resource);
        // If there is an "edit" row action, clicking the row opens it.
        const hasEdit = table.getRecordActions().flatMap((a: any) => (a instanceof ActionGroup ? a.getActions() : [a])).some((a: Action) => a.getName() === 'edit');
        return hasEdit ? table.recordAction('edit') : table;
    }
    // --- many-to-many: to be defined by managers offering Attach / Detach
    /** Attaches an existing record to the owner; `pivot` holds the values of the `pivotForm()` fields. */
    static attach(_ownerKey: string, _recordKey: string, _pivot: Record<string, unknown> = {}): Promise<void> { throw new Error('RelationManager.attach() must be defined.'); }
    /**
     * Fields stored on the pivot table (a role, a quantity…): added to the attach modal and to the edit form of a row.
     * Their values go to `attach()` and `updatePivot()`, never to the related record. List the pivot columns in the
     * relation's query (`adapterFor()`) so that the table and the edit form can read them.
     */
    static pivotForm(_schema: Schema): SchemaComponent[] { return []; }
    /** Saves the pivot fields of an attached record (edit form of a row). */
    static updatePivot(_ownerKey: string, _recordKey: string, _pivot: Record<string, unknown>): Promise<void> { throw new Error('RelationManager.updatePivot() must be defined when pivotForm() returns fields.'); }
    /** Detaches records from the owner without deleting them. */
    static detach(_ownerKey: string, _recordKeys: string[]): Promise<void> { throw new Error('RelationManager.detach() must be defined.'); }
    /** Attachable records matching the search: [key, label]. */
    static searchAttachable(_ownerKey: string, _search: string): Promise<[string, string][]> { throw new Error('RelationManager.searchAttachable() must be defined.'); }
    /** Label of an attachable record, or `null` if it is not attachable (also used as validation). */
    static attachableLabel(_ownerKey: string, _recordKey: string): Promise<string | null> { throw new Error('RelationManager.attachableLabel() must be defined.'); }
    // --- one-to-many: to be defined by managers offering Associate / Dissociate
    /** Sets the owner of an existing record (its foreign key). */
    static associate(_ownerKey: string, _recordKey: string): Promise<void> { throw new Error('RelationManager.associate() must be defined.'); }
    /** Clears the owner of records (their foreign key), without deleting them. */
    static dissociate(_ownerKey: string, _recordKeys: string[]): Promise<void> { throw new Error('RelationManager.dissociate() must be defined.'); }
    /** Associable records matching the search: [key, label]. */
    static searchAssociable(_ownerKey: string, _search: string): Promise<[string, string][]> { throw new Error('RelationManager.searchAssociable() must be defined.'); }
    /** Label of an associable record, or `null` if it is not associable (also used as validation). */
    static associableLabel(_ownerKey: string, _recordKey: string): Promise<string | null> { throw new Error('RelationManager.associableLabel() must be defined.'); }
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
    /** Nested resource managing these records (Filament's `$relatedResource`), as for a relation manager. */
    static relatedResource: ResourceReference | null = null;
    static getRelatedResource(): typeof Resource | null { return resolveResourceReference(this.relatedResource); }
    /** Data adapter limited to records related to the given owner (the related resource's adapter scoped to the owner, if any). */
    static adapterFor(ownerKey: string): DataAdapter {
        const related = this.getRelatedResource();
        if (related) return relatedResourceAdapter(related, ownerKey);
        throw new Error('ManageRelatedRecords.adapterFor() must be defined.');
    }
    static table(table: Table): Table { return this.getRelatedResource()?.table(table) ?? table; }
    static form(schema: Schema): Schema { return this.getRelatedResource()?.form(schema) ?? schema; }
    static infolist(schema: Schema): Schema { return this.getRelatedResource()?.infolist(schema) ?? schema; }
    static getTitle(): string { return this.title ?? (this.getRelatedResource()?.getTitleCasePluralModelLabel() ?? ucfirst(relationshipNameOf(this).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase())); }
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
        return (this._facade ??= withRelatedResource({
            isSimple: true, hasViewPage: false, slug: page.parentResource.slug, modelLabel: page.modelLabel, relations: [], recordTitleAttribute: page.recordTitleAttribute, adapter: page.adapterFor(this.recordKey),
            can: (ability: string, user: User | null, record: unknown = null) => { const rule = page.policy?.[ability]; return this.panel.authorize(user, ability, { resource: page, record, rule: rule ? () => rule(user!, record) : null }); },
            getPluralModelLabel: () => page.pluralModelLabel ?? plural(page.modelLabel),
            getTitleCasePluralModelLabel: () => (page.pluralModelLabel ?? plural(page.modelLabel)).split(' ').map(ucfirst).join(' '),
            getRecordTitle: (record: any) => (page.recordTitleAttribute ? String(record?.[page.recordTitleAttribute] ?? '') : page.modelLabel),
            table: (table: Table) => page.table(table), form: (schema: Schema) => page.form(schema), infolist: (schema: Schema) => page.infolist(schema), getUrl: () => '',
        }, page.getRelatedResource(), this.recordKey, (this as any).parentRecordKeys ?? {}));
    }
    getTable(): Table {
        const table = this.related.table(new Table().pluralModelLabel(this.resource.getPluralModelLabel()));
        return this.related.getRelatedResource() ? linkRelatedRecords(table, this.resource) : table;
    }
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
    /** Hash of the form data as last saved: the browser compares it with the current data (unsaved changes alert). */
    savedDataHash = '';
    static locked = ['savedDataHash'];
    /** `true` / `false` overrides the panel's `databaseTransactions()` for this page. */
    static hasDatabaseTransactions: boolean | null = null;
    /** `true` / `false` overrides the panel's `unsavedChangesAlerts()` for this page. */
    static hasUnsavedDataChangesAlert: boolean | null = null;
    protected hasDatabaseTransactions(): boolean { return (this.constructor as typeof ResourceFormPage).hasDatabaseTransactions ?? this.panel.hasDatabaseTransactions(); }
    protected hasUnsavedDataChangesAlert(): boolean { return (this.constructor as typeof ResourceFormPage).hasUnsavedDataChangesAlert ?? this.panel.hasUnsavedChangesAlerts(); }
    /** Runs `fn` in a database transaction of the resource's adapter, when the page uses them. */
    protected wrapInDatabaseTransaction<T>(fn: () => Promise<T>): Promise<T> {
        const adapter = this.getDataAdapter();
        return this.hasDatabaseTransactions() && typeof adapter.transaction === 'function' ? adapter.transaction(fn) : fn();
    }
    /** Remembers the form data as saved: leaving the page with other data asks for confirmation. */
    protected rememberData(): void {
        if (!this.hasUnsavedDataChangesAlert()) return;
        this.savedDataHash = createHash('md5').update(JSON.stringify(this.data).replace(/\\/g, '')).digest('hex');
    }
    async render(): Promise<string> {
        if (this.hasUnsavedDataChangesAlert()) {
            this.addScript('unsaved-data-changes-alert', this.panel.hasSpaMode()
                ? `setUpFilamentSpaModeUnsavedDataChangesAlert({ body: ${js(t('filament-panels::unsaved-changes-alert.body'))}, resolveLivewireComponentUsing: () => window.Livewire.find(${js(this.id)}), $wire })`
                : 'setUpFilamentUnsavedDataChangesAlert({ $wire })');
        }
        return super.render();
    }
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
    // --- lifecycle hooks around filling and validation (to override; none can be called from the browser)
    /** Before the form is filled (with defaults, or with the record on the edit page). */
    protected beforeFill(): void | Promise<void> {}
    /** After the form is filled. */
    protected afterFill(): void | Promise<void> {}
    /** Before the form is validated, when it is submitted. */
    protected beforeValidate(): void | Promise<void> {}
    /** After the form is validated successfully, before the data is transformed and saved. */
    protected afterValidate(): void | Promise<void> {}
    /** Validates the form; on error, sets the errors on the component and notifies the browser. */
    protected async validateForm(): Promise<boolean> {
        await this.beforeValidate();
        this._errors = await validateSchema(this.getSchema('form'));
        if (!Object.keys(this._errors).length) { await this.afterValidate(); return true; }
        this.dispatch('form-validation-error', { livewireId: this.id });
        return false;
    }
}

/** Record creation page. */
export class CreateRecord extends ResourceFormPage {
    static callable = ['create', 'createAnother'];
    async mount(): Promise<void> { await this.beforeFill(); fillSchema(this.getSchema('form'), this.data); await this.afterFill(); this.rememberData(); }
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
        const record = await this.wrapInDatabaseTransaction(async () => {
            await this.beforeCreate(data);
            const created = await this.handleRecordCreation(data);
            await saveSchemaRelationships(this.getSchema('form'), created);
            await this.afterCreate(created);
            return created;
        });
        this.rememberData();
        const title = this.getCreatedNotificationTitle();
        if (title !== null) Notification.make().success().title(title).send();
        if (another === true) { this.data = {}; fillSchema(this.getSchema('form'), this.data); this.rememberData(); return; }
        this.redirect(this.getRedirectUrl(record), true);
    }
    createAnother(): Promise<void> { return this.create(true); }
}

/** Delete action with confirmation. */
export class DeleteAction {
    /** On an edit page, deletes the page's record and returns to the list. On a table row, deletes the row. */
    static make(): Action {
        return Action.make('delete').authorize(({ livewire, record }) => canOn(livewire, 'delete', record))
            .label(t('filament-actions::delete.single.label')).color('danger').keyBindings(['mod+d']).tableIcon(icons.resolve('actions::delete-action') ?? 'c-trash').groupedIcon(icons.resolve('actions::delete-action.grouped') ?? 'm-trash')
            .requiresConfirmation().modalIcon(icons.resolve('actions::delete-action.modal') ?? 'o-trash')
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
            .label(t('filament-actions::replicate.single.label')).tableIcon(icons.resolve('actions::replicate-action') ?? 'c-square-2-stack').groupedIcon(icons.resolve('actions::replicate-action.grouped') ?? 'm-square-2-stack')
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
            // A relation manager with a related resource: its create page instead of the modal.
            .url(({ livewire }) => (resource ? null : ((livewire as any)?.resource?.getRelatedResourceUrl?.('create') ?? null)))
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
            .label(t('filament-actions::edit.single.label')).tableIcon(icons.resolve('actions::edit-action') ?? 'c-pencil-square').groupedIcon(icons.resolve('actions::edit-action.grouped') ?? 'm-pencil-square')
            .modalHeading(({ livewire, record }) => t('filament-actions::edit.single.modal.heading', { label: of(livewire).getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::edit.single.modal.actions.save.label'))
            // A relation manager with a related resource: its edit page instead of the modal.
            .url(({ livewire, record }) => (resource || !record ? null : ((livewire as any)?.resource?.getRelatedResourceUrl?.('edit', (livewire as any).resource.adapter.getKey(record)) ?? null)))
            .schema((schema: Schema) => of(schema.livewire).form(schema))
            .fillForm(({ record }) => ({ ...record }))
            .action(async (ctx) => {
                const adapter = of(ctx.livewire).adapter;
                const pivotNames: string[] = of(ctx.livewire).pivotFieldNames?.() ?? [];
                let data = ctx.data;
                if (pivotNames.length) {
                    const pivot = Object.fromEntries(Object.entries(data ?? {}).filter(([name]) => pivotNames.includes(name)));
                    data = Object.fromEntries(Object.entries(data ?? {}).filter(([name]) => !pivotNames.includes(name)));
                    await managerOf(ctx.livewire).updatePivot(ctx.livewire.ownerRecord, adapter.getKey(ctx.record), pivot);
                }
                const saved = Object.keys(data ?? {}).length ? await adapter.update(adapter.getKey(ctx.record), data) : ctx.record;
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
            .label(t('filament-actions::view.single.label')).color('gray').tableIcon(icons.resolve('actions::view-action') ?? 'c-eye').groupedIcon(icons.resolve('actions::view-action.grouped') ?? 'm-eye')
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
                    .getOptionLabelUsing((value) => managerOf(livewire).attachableLabel(livewire.ownerRecord, value)),
                    ...managerOf(livewire).pivotForm(schema)];
            })
            .action(async ({ livewire, data }) => {
                const { recordId, ...pivot } = data ?? {};
                await managerOf(livewire).attach(livewire.ownerRecord, String(recordId), pivot);
                Notification.make().success().title(t('filament-actions::attach.single.notifications.attached.title')).send();
            });
    }
}
/** Detaches a row from the owner without deleting it. */
export class DetachAction {
    static make(): Action {
        return Action.make('detach')
            .label(t('filament-actions::detach.single.label')).color('danger').icon(icons.resolve('actions::detach-action') ?? 'c-x-mark').groupedIcon(icons.resolve('actions::detach-action') ?? 'm-x-mark')
            .requiresConfirmation().modalIcon(icons.resolve('actions::detach-action.modal') ?? 'o-x-mark')
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
            .label(t('filament-actions::detach.multiple.label')).color('danger').icon(icons.resolve('actions::detach-action') ?? 'm-x-mark')
            .requiresConfirmation().modalIcon(icons.resolve('actions::detach-action.modal') ?? 'o-x-mark')
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

/** Gives an existing record to the owner of a one-to-many relation manager (its foreign key). */
export class AssociateAction {
    static make(): Action {
        return Action.make('associate')
            .label(t('filament-actions::associate.single.label')).color('gray').modalWidth('lg')
            .modalHeading(({ livewire }) => t('filament-actions::associate.single.modal.heading', { label: String(livewire.resource.modelLabel).split(' ').map(ucfirst).join(' ') }))
            .modalSubmitActionLabel(t('filament-actions::associate.single.modal.actions.associate.label'))
            .extraModalFooterActions([Action.make('associateAnother').label(t('filament-actions::associate.single.modal.actions.associate_another.label')).color('gray').action(`callMountedAction(${js({ another: true })})`)])
            .schema((schema: Schema) => {
                const livewire = schema.livewire as any;
                return [Select.make('recordId').label(t('filament-actions::associate.single.modal.fields.record_id.label')).hiddenLabel().required()
                    .getSearchResultsUsing((search) => managerOf(livewire).searchAssociable(livewire.ownerRecord, search))
                    .getOptionLabelUsing((value) => managerOf(livewire).associableLabel(livewire.ownerRecord, value))];
            })
            .action(async ({ livewire, data }) => {
                await managerOf(livewire).associate(livewire.ownerRecord, String(data.recordId));
                Notification.make().success().title(t('filament-actions::associate.single.notifications.associated.title')).send();
            });
    }
}
/** Removes a row from the owner (clears its foreign key) without deleting it. */
export class DissociateAction {
    static make(): Action {
        return Action.make('dissociate')
            .label(t('filament-actions::dissociate.single.label')).color('danger').icon(icons.resolve('actions::dissociate-action') ?? 'c-x-mark').groupedIcon(icons.resolve('actions::dissociate-action') ?? 'm-x-mark')
            .requiresConfirmation().modalIcon(icons.resolve('actions::dissociate-action.modal') ?? 'o-x-mark')
            .modalHeading(({ livewire, record }) => t('filament-actions::dissociate.single.modal.heading', { label: livewire.resource.getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::dissociate.single.modal.actions.dissociate.label'))
            .action(async ({ livewire, record }) => {
                await managerOf(livewire).dissociate(livewire.ownerRecord, [livewire.resource.adapter.getKey(record)]);
                Notification.make().success().title(t('filament-actions::dissociate.single.notifications.dissociated.title')).send();
            });
    }
}
/** Dissociates the selected rows. */
export class DissociateBulkAction {
    static make(): Action {
        return Action.make('dissociate')
            .label(t('filament-actions::dissociate.multiple.label')).color('danger').icon(icons.resolve('actions::dissociate-action') ?? 'm-x-mark')
            .requiresConfirmation().modalIcon(icons.resolve('actions::dissociate-action.modal') ?? 'o-x-mark')
            .modalHeading(({ livewire }) => t('filament-actions::dissociate.multiple.modal.heading', { label: livewire.resource.getPluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::dissociate.multiple.modal.actions.dissociate.label'))
            .action(async ({ livewire }) => {
                // Selected keys come from the manager's current query, so they belong to the owner.
                await managerOf(livewire).dissociate(livewire.ownerRecord, await livewire.getSelectedRecordKeys());
                Notification.make().success().title(t('filament-actions::dissociate.multiple.notifications.dissociated.title')).send();
                livewire.deselectAllTableRecords();
            });
    }
}

/** Restores a soft-deleted record. Only visible when the record is deleted. */
/** Restores a soft-deleted record: the page's record, or a table row. Only visible when the record is deleted. */
export class RestoreAction {
    static make(): Action {
        return Action.make('restore').authorize(({ livewire, record }) => canOn(livewire, 'restore', record ?? (livewire as any)._record))
            .label(t('filament-actions::restore.single.label')).color('gray').tableIcon(icons.resolve('actions::restore-action') ?? 'c-arrow-uturn-left').groupedIcon(icons.resolve('actions::restore-action.grouped') ?? 'm-arrow-uturn-left')
            .requiresConfirmation().modalIcon(icons.resolve('actions::restore-action.modal') ?? 'o-arrow-uturn-left')
            .hidden(({ livewire, record }) => { const target = record ?? (livewire as any)._record; return !target || !(livewire as any).getDataAdapter().isTrashed(target); })
            .modalHeading(({ livewire, record }) => t('filament-actions::restore.single.modal.heading', { label: livewire.resource.getRecordTitle(record ?? livewire._record) }))
            .modalSubmitActionLabel(t('filament-actions::restore.single.modal.actions.restore.label'))
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const adapter = livewire.getDataAdapter();
                if (typeof livewire.getTable === 'function') {
                    await adapter.restore(adapter.getKey(record));
                } else {
                    await adapter.restore(livewire.recordKey);
                    await livewire.hydrate();
                }
                await finishAction(ctx.action!, ctx, t('filament-actions::restore.single.notifications.restored.title'));
            });
    }
}
/** Permanently deletes a soft-deleted record. Only visible when the record is deleted. */
export class ForceDeleteAction {
    static make(): Action {
        return Action.make('forceDelete').authorize(({ livewire, record }) => canOn(livewire, 'forceDelete', record ?? (livewire as any)._record))
            .label(t('filament-actions::force-delete.single.label')).color('danger').tableIcon(icons.resolve('actions::force-delete-action') ?? 'c-trash').groupedIcon(icons.resolve('actions::force-delete-action.grouped') ?? 'm-trash')
            .requiresConfirmation().modalIcon(icons.resolve('actions::force-delete-action.modal') ?? 'o-trash')
            .hidden(({ livewire, record }) => { const target = record ?? (livewire as any)._record; return !target || !(livewire as any).getDataAdapter().isTrashed(target); })
            .modalHeading(({ livewire, record }) => t('filament-actions::force-delete.single.modal.heading', { label: livewire.resource.getRecordTitle(record ?? livewire._record) }))
            .modalSubmitActionLabel(t('filament-actions::force-delete.single.modal.actions.delete.label'))
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const adapter = livewire.getDataAdapter();
                const inTable = typeof livewire.getTable === 'function';
                await adapter.forceDelete(inTable ? adapter.getKey(record) : livewire.recordKey);
                await finishAction(ctx.action!, ctx, t('filament-actions::force-delete.single.notifications.deleted.title'), inTable ? null : livewire.resource.getUrl());
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
            .label(t('filament-actions::delete.multiple.label')).color('danger').icon(icons.resolve('actions::delete-action') ?? 'm-trash')
            .requiresConfirmation().modalIcon(icons.resolve('actions::delete-action.modal') ?? 'o-trash')
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
            .label(t('filament-actions::restore.multiple.label')).color('gray').icon(icons.resolve('actions::restore-action') ?? 'm-arrow-uturn-left')
            .requiresConfirmation().modalIcon(icons.resolve('actions::restore-action.modal') ?? 'o-arrow-uturn-left')
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
            .label(t('filament-actions::force-delete.multiple.label')).color('danger').icon(icons.resolve('actions::force-delete-action') ?? 'm-trash')
            .requiresConfirmation().modalIcon(icons.resolve('actions::force-delete-action.modal') ?? 'o-trash')
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
    /** Relation managers of this page: the resource's by default (`static relationManagers` on the page replaces them). */
    getRelationManagers(): (typeof RelationManager | RelationGroup)[] { return (this.constructor as any).relationManagers ?? this.resource.getRelations(); }
    /** `true`: the form becomes the first tab, next to the relation managers. */
    hasCombinedRelationManagerTabsWithContent(): boolean { return false; }
    getContentTabLabel(): string { return t('filament-panels::resources/pages/edit-record.content.tab.label'); }
    getContentTabIcon(): string | null { return null; }
    protected withRelationManagers(content: Schema): Schema {
        const components = content.getComponents();
        if (!this.getRelationManagers().length) return content.components([...components, new RelationManagerTabs().key(null).hidden()]);
        if (this.hasCombinedRelationManagerTabsWithContent()) return content.components([new RelationManagerTabs(components)]);
        return content.components([...components, new RelationManagerTabs()]);
    }
    contentSchema(schema: Schema): Schema {
        // The tabs are always present: hidden (empty column) when the page has no relation manager.
        return this.withRelationManagers(super.contentSchema(schema));
    }
    /**
     * Saves the fields of one component of the form (a section with its own "Save" action), after validating them only:
     * `livewire.saveFormComponentOnly('contact')` (the component's `key()`, or the component).
     */
    async saveFormComponentOnly(component: SchemaComponent | string, notificationTitle: string | null = null): Promise<void> {
        const form = this.getSchema('form');
        const wanted = typeof component === 'string' ? component : component.getKey();
        const target = ((await form.getVisibleFlatComponents()) as SchemaComponent[]).find((candidate) => { const key = candidate.getKey(); return key !== null && wanted !== null && (key === wanted || key.endsWith(`.${wanted}`)); });
        const part = target?.getChildSchemas()[0];
        if (!part) throw new Error(`saveFormComponentOnly(): no component ${String(wanted)} with fields in the form.`);
        const errors = await validateSchema(part);
        if (Object.keys(errors).length) { this._errors = errors; this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        this._errors = {};
        const data = await this.mutateFormDataBeforeSave(await getSchemaState(part));
        this._record = await this.wrapInDatabaseTransaction(async () => {
            const record = await this.handleRecordUpdate(this._record, data);
            await saveSchemaRelationships(part, record);
            return record;
        });
        const title = notificationTitle ?? this.getSavedNotificationTitle();
        if (title !== null) Notification.make().success().title(title).send();
    }
    static locked = ['recordKey', 'previousUrl'];
    _record: any = null;

    async mount(params: Record<string, unknown>): Promise<void> {
        this.recordKey = String(params.record ?? '');
        this.previousUrl = previousUrlOf((this._ctx as PanelContext | null)?.req);
        // Combined tabs: the form's tab is open first, unless the URL names a relation manager (`?relation=tasks`).
        if (this.hasCombinedRelationManagerTabsWithContent()) this.activeRelationManager = '-1';
        this.activeRelationManager = relationManagerTabFromQuery(this) ?? this.activeRelationManager;
        await this.hydrate();
        await this.beforeFill();
        fillSchemaFromRecord(this.getSchema('form'), this.data, await this.mutateFormDataBeforeFill({ ...this._record }));
        await loadSchemaRelationships(this.getSchema('form'), this.data, this._record);
        await this.afterFill();
        this.rememberData();
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
        this._record = await this.wrapInDatabaseTransaction(async () => {
            await this.beforeSave(data);
            const record = await this.handleRecordUpdate(this._record, data);
            await saveSchemaRelationships(this.getSchema('form'), record);
            await this.afterSave(record);
            return record;
        });
        this.rememberData();
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
        if (this.hasCombinedRelationManagerTabsWithContent()) this.activeRelationManager = '-1';
        this.activeRelationManager = relationManagerTabFromQuery(this) ?? this.activeRelationManager;
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
    /** Relation managers of this page: the resource's by default (`static relationManagers` on the page replaces them). */
    getRelationManagers(): (typeof RelationManager | RelationGroup)[] { return (this.constructor as any).relationManagers ?? this.resource.getRelations(); }
    /** `true`: the infolist becomes the first tab, next to the relation managers. */
    hasCombinedRelationManagerTabsWithContent(): boolean { return false; }
    getContentTabLabel(): string { return t('filament-panels::resources/pages/view-record.content.tab.label'); }
    getContentTabIcon(): string | null { return null; }
    protected withRelationManagers(content: Schema): Schema {
        const components = content.getComponents();
        if (!this.getRelationManagers().length) return content.components([...components, new RelationManagerTabs().key(null).hidden()]);
        if (this.hasCombinedRelationManagerTabsWithContent()) return content.components([new RelationManagerTabs(components)]);
        return content.components([...components, new RelationManagerTabs()]);
    }
    contentSchema(schema: Schema): Schema {
        return this.withRelationManagers(schema.components([EmbeddedSchema.make('infolist')]));
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
    if (profileUrl && !custom.profile) items.push(Action.make('profile').label(panel.getProfile()!.page.getLabel()).icon(icons.resolve('panels::user-menu.profile-item') ?? 'm-user-circle').url(profileUrl).color('gray').sort(-1));
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
        hasThemeSwitcher: panel.hasDarkMode() && !panel.hasDarkModeForced(), defaultThemeMode: panel.getDefaultThemeMode(),
    });
}
/** Tenant menu: current tenant, other tenants, registration, profile. */
/** Options of an error page: a description replacing the status's own, and the error (its stack is shown in development). */
export type ErrorPageOptions = { description?: string; error?: unknown };
/**
 * Answers with the panel's error page for a status (404, 403, 500…): the cable car in trouble, in the request's theme.
 * Requests that do not accept HTML get plain text. Use it in your own middleware, a maintenance mode answering 503 for example.
 */
export function renderErrorPage(panel: Panel, req: Request, res: Response, status: number, options: ErrorPageOptions = {}): void {
    res.status(status);
    if (!req.accepts('html')) return void res.type('text').send(`${status}`);
    const scene = errorPageScene(status);
    const text = (name: string) => t(`filament-panels::errors.${scene}.${name}`);
    // Inside the request's theme: the buttons' color classes depend on its palette.
    const html = panel.withTheme(req, () => {
        const home = uiButton({ tag: 'a', href: panel.getBaseUrl(), icon: icons.resolve('panels::error-page.actions.home') ?? 'm-home', color: 'primary' }, t('filament-panels::errors.actions.home'));
        const homeGray = uiButton({ tag: 'a', href: panel.getBaseUrl(), icon: icons.resolve('panels::error-page.actions.home') ?? 'm-home', color: 'gray' }, t('filament-panels::errors.actions.home'));
        const back = uiButton({ icon: icons.resolve('panels::error-page.actions.back') ?? 'm-arrow-left', color: 'gray', attributes: { onclick: 'history.back()' } }, t('filament-panels::errors.actions.back'));
        const retry = uiButton({ tag: 'a', href: req.method === 'GET' ? req.originalUrl : panel.getBaseUrl(), icon: icons.resolve('panels::error-page.actions.retry') ?? 'm-arrow-path', color: 'primary' }, t('filament-panels::errors.actions.retry'));
        const login = panel.getLoginPage() ? uiButton({ tag: 'a', href: panel.getLoginUrl(), icon: icons.resolve('panels::error-page.actions.login') ?? 'm-arrow-right-end-on-rectangle', color: 'primary' }, t('filament-panels::errors.actions.login')) : home;
        const actions = scene === 401 ? (panel.getLoginPage() ? [login, homeGray] : [home]) : scene === 403 || scene === 404 ? [home, back] : scene === 503 ? [retry] : [retry, homeGray];
        const badgeColor = scene >= 500 ? 'danger' : scene === 419 || scene === 429 ? 'warning' : 'gray';
        const label = t('filament-panels::errors.label', { code: status });
        const error = options.error instanceof Error ? options.error : null;
        const theme = panel.resolveTheme(req);
        return views.render('filament-panels::errors.page', {
            status, locale: getLocale(), title: text('title'), heading: text('title'), description: options.description ?? text('description'),
            illustration: errorIllustration(status, `${label}: ${text('title')}`), badge: uiBadge({ color: badgeColor, size: 'lg' }, e(label)), actions, css: ERROR_PAGE_CSS,
            // The stack only helps while developing: never shown otherwise.
            details: error && process.env.NODE_ENV === 'development' ? (error.stack ?? String(error)) : null,
            brandName: panel.getBrandName(), favicon: panel.getFavicon(), theme: panel.getTheme(), panelId: panel.getId(),
            font: theme?.font ? { ...panel.getFont(), ...fontOf(theme.font) } : panel.getFont(), themeCss: theme?.css ?? '', colorVariables: panel.colors.renderCssVariables(),
            darkMode: panel.hasDarkMode(), darkModeForced: panel.hasDarkModeForced(), defaultThemeMode: panel.getDefaultThemeMode(),
        });
    });
    res.type('html').send(html);
}

async function renderTenantMenu(component: Component, options: { teleport: boolean }): Promise<string> {
    const { panel, user } = component._ctx as PanelContext;
    const tenant = panel.getTenant();
    if (!panel.hasTenancy() || !panel.hasTenantMenu() || !tenant || !user) return '';
    const provider = panel.getTenantProvider();
    const ctx = menuContext(component);
    const items: Action[] = [];
    const custom = panel.getTenantMenuItems();
    const ProfilePage = panel.getTenantProfilePage();
    if (ProfilePage && provider.update && !custom.profile) items.push(Action.make('profile').label(ProfilePage.getLabel()).icon(icons.resolve('panels::tenant-menu.profile-button') ?? 'm-cog-6-tooth').url(panel.getUrl(ProfilePage.slug)).color('gray').sort(-1));
    const billingUrl = panel.getTenantBillingUrl(tenant);
    if (billingUrl && !custom.billing) items.push(Action.make('billing').label(t('filament-panels::layout.actions.billing.label')).icon(icons.resolve('panels::tenant-menu.billing-button') ?? 'm-credit-card').url(billingUrl).color('gray').sort(-1));
    const RegistrationPage = panel.getTenantRegistrationPage();
    if (RegistrationPage && !custom.register && (await RegistrationPage.canView(panel, user))) items.push(Action.make('register').label(RegistrationPage.getLabel()).icon(icons.resolve('panels::tenant-menu.registration-button') ?? 'm-plus').url(panel.getBaseUrl(RegistrationPage.slug)).color('gray').sort(Number.MAX_SAFE_INTEGER));
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
        isSearchable: canSwitch && (panel.isTenantMenuSearchable() ?? others.length >= 10),
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
        if (!user && !panel.allowsGuests()) return '<div></div>';
        const inSidebar = (position: 'topbar' | 'sidebar') => position === 'sidebar' && user !== null;
        return views.render('filament-panels::livewire.sidebar', {
            hasTopbar: panel.hasTopbar(), hasTopNavigation: panel.hasTopNavigation(), spa: panel.hasSpaMode(),
            isSidebarCollapsibleOnDesktop: panel.isSidebarCollapsibleOnDesktop(), isSidebarFullyCollapsibleOnDesktop: panel.isSidebarFullyCollapsibleOnDesktop(),
            tenantMenu: (await renderTenantMenu(this, { teleport: false })) || null,
            globalSearch: panel.hasGlobalSearch() && inSidebar(panel.getGlobalSearchPosition()) ? await this.mountChild(`navette.${panel.getId()}.global-search`, {}, `${this.id}.global-search`) : null,
            databaseNotifications: panel.getDatabaseNotifications() && inSidebar(panel.getDatabaseNotificationsPosition()) ? await this.mountChild(`navette.${panel.getId()}.database-notifications`, {}, `${this.id}.database-notifications`, { lazy: true }) : null,
            userMenu: inSidebar(panel.getUserMenuPosition()) ? await renderUserMenu(this, 'sidebar') : null,
            homeUrl: panel.getUrl(), brand: panel.getBrand(),
            // With a sidebar collapsible to icons, a group with an icon and a label opens a dropdown of its items while collapsed.
            groups: panel.getNavigation(this.currentPath, await panel.resolveNavigationBadges(), await panel.resolveInaccessiblePages(user))
                .map((group) => ({ ...group, lists: panel.isSidebarCollapsibleOnDesktop() && group.label && group.icon ? navigationDropdownLists(group.dropdownItems) : null })),
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
        if (!user && !panel.allowsGuests()) return '<div></div>';
        const inTopbar = (position: 'topbar' | 'sidebar') => position === 'topbar' && user !== null;
        const hasNavigation = panel.hasNavigation();
        const showsNavigationHere = panel.hasTopNavigation() || !hasNavigation;
        const tenant = panel.getTenant();
        const groups = showsNavigationHere && hasNavigation ? panel.getNavigation(this.currentPath, await panel.resolveNavigationBadges(), await panel.resolveInaccessiblePages(user)) : null;
        return views.render('filament-panels::livewire.topbar', {
            hasNavigation, spa: panel.hasSpaMode(), isSidebarCollapsibleOnDesktop: panel.isSidebarCollapsibleOnDesktop(), isSidebarFullyCollapsibleOnDesktop: panel.isSidebarFullyCollapsibleOnDesktop(),
            homeUrl: panel.getUrl(), brand: panel.getBrand(), livewireId: this.id,
            tenantMenu: showsNavigationHere ? (await renderTenantMenu(this, { teleport: true })) || null : null,
            topNavigation: groups?.map((group) => topNavigationGroup(group)) ?? null,
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
const RESERVED_SEGMENTS = new Set(['login', 'logout', 'register', 'password-reset', 'email-verification', 'multi-factor-authentication', 'profile', 'livewire']);

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
    useNotificationsColorManager(sharedColors);
    useFormsColorManager(sharedColors);
    useTableColorManager(sharedColors);
    useInfolistsColorManager(sharedColors);
    // View components (<x-badge>, <x-button>…) use the same colors.
    useUiColorManager(sharedColors);
    // HTML rendered by an infolist entry is sanitized through the rich editor schema, which only keeps its own tags.
    useHtmlSanitizer((html) => richDocumentToHtml(richHtmlToDocument(html)) ?? '');
    views.share({ assetUrl: (file: string) => panel.assetUrl(file) });
    for (const plugin of panel.getPlugins()) plugin.boot?.(panel);
    for (const { assets, packageName } of panel.getAssets()) NavetteAsset.register(assets, packageName, { panel: panel.getId() });
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
    const forbidden = (req: Request, res: Response) => renderErrorPage(panel, req, res, 403);

    /** Tenant designated by a panel URL (or its host, with `tenantDomain()`), if the user is a member. */
    const tenantFromPath = async (path: string, user: User | null, hostname = ''): Promise<unknown> => {
        if (!panel.hasTenancy() || !user) return null;
        const key = panel.getTenantKeyFromRequest(path, hostname);
        if (key === null) return null;
        const provider = panel.getTenantProvider();
        const tenant = await provider.find(key);
        return tenant && (await provider.canAccess(user, tenant)) ? tenant : null;
    };
    /** User's home: the panel root or, in a multi-tenant panel, their default tenant's root, their first one's, or tenant registration. */
    const homeUrl = async (user: User): Promise<string | null> => {
        if (!panel.hasTenancy()) return panel.getUrl();
        const provider = panel.getTenantProvider();
        const preferred = (await provider.getDefaultTenant?.(user)) ?? null;
        if (preferred && (await provider.canAccess(user, preferred))) return panel.getUrl('', preferred);
        const [first] = await provider.getTenants(user);
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
    const MultiFactorSetUpPage = panel.getSetUpRequiredMultiFactorAuthenticationPage();
    if (MultiFactorSetUpPage) runtime.register(name('auth.multi-factor-authentication.set-up-required'), MultiFactorSetUpPage);
    const TenantRegistration = panel.getTenantRegistrationPage();
    if (TenantRegistration) runtime.register(name('tenancy.registration'), TenantRegistration as any);
    const TenantProfile = panel.getTenantProfilePage();
    if (TenantProfile && !panel.getPages().includes(TenantProfile)) panel.pages([TenantProfile]);
    runtime.register(name('sidebar'), Sidebar);
    runtime.register(name('topbar'), Topbar);
    runtime.register(name('simple-user-menu'), SimpleUserMenu);
    runtime.register(name('global-search'), GlobalSearch);
    runtime.register(name('database-notifications'), DatabaseNotifications);
    runtime.register(name('table-select'), TableSelectComponent);
    runtime.register('navette.notifications', Notifications);
    for (const [index, widget] of panel.getWidgets().entries()) runtime.register(name(`widgets.panel.${index}`), widget);
    // Component names follow the resource's URL path (a nested resource's includes its parents'): two resources never share one.
    const componentPath = (resource: typeof Resource) => nestedRoutePath(resource).replace(/[{}]/g, '').replace(/\//g, '.');
    for (const resource of panel.getResources()) for (const [index, widget] of resource.widgets.entries()) runtime.register(name(`widgets.${componentPath(resource)}.${index}`), widget);
    for (const resource of panel.getResources()) {
        const managers = new Set<typeof RelationManager>();
        const add = (entries: (typeof RelationManager | RelationGroup)[] | undefined) => { for (const entry of entries ?? []) for (const manager of entry instanceof RelationGroup ? entry.getManagers() : [entry]) managers.add(manager); };
        add(resource.getRelations());
        for (const page of Object.values(resource.getPages())) add((page as any).relationManagers);
        for (const manager of managers) runtime.register(name(`relation-managers.${componentPath(resource)}.${relationshipNameOf(manager)}`), manager);
    }

    // A panel on its own domains: other hosts go to the next routes (another panel, the application).
    const domains = panel.getDomains();
    if (domains.length) router.use((req, _res, next) => next(domains.includes(req.hostname) ? undefined : 'router'));
    router.use(express.static(dir('../dist/filament'), { maxAge: '1y' }));
    // Navette's own front-end files.
    router.use(express.static(dir('../dist/navette')));
    // Registered assets (`NavetteAsset.register()`, `panel.assets()`).
    router.use(NavetteAsset.middleware());
    // `bootUsing()`: before every request of the panel (its pages, their updates).
    const panelBase = panel.getBaseUrl();
    const belongsToPanel = (path: string) => panelBase === '/' || path === panelBase || path.startsWith(`${panelBase}/`) || path.startsWith(`${livewire}/`);
    router.use((req, _res, next) => { if (!belongsToPanel(req.path)) return next(); panel.boot(req).then(() => next(), next); });
    // SPA prefetching: links load their page as soon as they are hovered.
    const prefetch = (html: string): string => (panel.hasSpaPrefetching() ? html.replace(/ wire:navigate(?=[\s>/])/g, ' wire:navigate.hover') : html);
    // An update's tenant is the one of the page sending it (from the signed snapshot URL), if the user is a member.
    const wireContext = async (req: Request, res: Response): Promise<PanelContext> => {
        const ctx = await context(req, res);
        let path = '';
        try { path = String(JSON.parse(req.body?.components?.[0]?.snapshot ?? '{}')?.memo?.path ?? ''); } catch { path = ''; }
        ctx.tenant = await tenantFromPath(path, ctx.user, req.hostname);
        return ctx;
    };
    // Broadcast stream of the signed-in user (`panel.broadcasting()`): only their own channel, for a tenant they belong to.
    if (panel.hasBroadcasting()) {
        router.get(`${livewire}/broadcasting`, async (req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            if (req.headers['sec-fetch-site'] === 'cross-site') return void res.status(403).end();
            const ctx = await context(req, res);
            if (ctx.denied) return void res.status(403).end();
            if (!ctx.user) return void res.status(401).end();
            if ((await panel.mustVerifyEmail(ctx.user)) || (await panel.mustSetUpMultiFactorAuthentication(ctx.user))) return void res.status(403).end();
            let tenant: string | null = null;
            if (panel.hasTenancy()) {
                const key = panel.getTenantDomain() ? panel.getTenantKeyFromRequest(req.path, req.hostname) : (typeof req.query.tenant === 'string' && req.query.tenant.length <= 200 ? req.query.tenant : null);
                if (key !== null) {
                    const provider = panel.getTenantProvider();
                    const found = await provider.find(key);
                    if (!found || !(await provider.canAccess(ctx.user, found))) return void res.status(403).end();
                    tenant = provider.getKey(found);
                }
            }
            const id = String(ctx.user.id);
            streamBroadcasts(req, res, {
                channel: panel.getBroadcastChannel(ctx.user), tenant, panel: panel.getId(), heartbeat: panel.getBroadcastingHeartbeat(),
                // The session is checked again at every heartbeat: signing out (or losing access) ends the stream.
                revalidate: async () => { const user = await panel.user(req); return user !== null && String(user.id) === id && (await panel.userCanAccess(user)); },
            });
        });
    }
    // Notifications sent during the request go into a batch announced to the browser.
    // Page components by name: an update of a configured page runs with its registration's configuration.
    const pageComponents = new Map<string, typeof Page>();
    const updatedPage = (req: Request): typeof Page | null => {
        try { return pageComponents.get(String(JSON.parse(req.body?.components?.[0]?.snapshot ?? '{}')?.memo?.name ?? '')) ?? null; } catch { return null; }
    };
    router.use(wireRouter(runtime, livewire, wireContext, async (ctx: PanelContext, _req, res, handle) => {
        const { result, pending } = await withRequestConfiguration(updatedPage(ctx.req), () => runInRequest(ctx.mailbox, () => panel.withTheme(ctx.req, () => panel.withTenant(ctx.tenant ?? null, handle))));
        if (panel.hasSpaPrefetching()) {
            for (const component of result.components as { effects: Record<string, any> }[]) {
                if (typeof component.effects.html === 'string') component.effects.html = prefetch(component.effects.html);
                for (const [key, html] of Object.entries(component.effects.partials ?? {})) if (typeof html === 'string') component.effects.partials[key] = prefetch(html);
            }
        }
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
        res.send(prefetch(views.render('filament-panels::layout.base', {
            renderHookScopes, title: options.title, brandName: panel.getBrandName(), favicon: panel.getFavicon(), theme: panel.getTheme(), motion: panel.hasMotion(), securityKeys: panel.usesSecurityKeys(), panelId: panel.getId(), font: panel.resolveTheme(req)?.font ? { ...panel.getFont(), ...fontOf(panel.resolveTheme(req)!.font!) } : panel.getFont(), themeCss: panel.resolveTheme(req)?.css ?? '',
            bodyClass, body, spa: panel.hasSpaMode(), darkMode: panel.hasDarkMode(), darkModeForced: panel.hasDarkModeForced(), defaultThemeMode: panel.getDefaultThemeMode(),
            csrf: csrfToken(req, res), colorVariables: panel.colors.renderCssVariables(), wireStyles: wireStyles(), wireScripts: wireScripts(req, res, livewire),
            notifications: (await runtime.mount('navette.notifications', {}, request)).replace(/^<div /, '<div wire:key="lw-1-0-0" '),
            assetStyles: NavetteAsset.renderStyles(null, { panel: panel.getId() }), assetScripts: NavetteAsset.renderScripts(null, { panel: panel.getId(), spa: panel.hasSpaMode() }), scriptData: NavetteAsset.renderScriptData(null, { panel: panel.getId() }),
            broadcasting: panel.hasBroadcasting() && ctx.user ? { url: panel.getBroadcastingUrl(ctx.tenant ?? null) } : null,
        })));
    };
    /** Page access errors: 404 and 403 are answered directly, anything else is rethrown. */
    const guarded = async (res: Response, render: () => Promise<void>) => {
        try { await render(); } catch (error) {
            if (error instanceof WireError && (error.status === 404 || error.status === 403)) return renderErrorPage(panel, res.req, res, error.status);
            throw error;
        }
    };
    /** Guest-only simple page (login, registration, password reset). */
    const guestPage = (path: string, component: string, title: string, params: (req: Request) => Record<string, unknown> = () => ({})) => {
        router.get(panel.getBaseUrl(path), async (req, res) => {
            const ctx = await context(req, res);
            if (ctx.denied) return forbidden(req, res);
            if (ctx.user) return res.redirect((await homeUrl(ctx.user)) ?? panel.getBaseUrl());
            await guarded(res, () => document(req, res, ctx, { title, component, layout: 'simple', params: params(req) }));
        });
    };
    /** Simple page for a signed-in user, outside any tenant (profile, email verification, tenant registration). */
    const userPage = (path: string, component: string, title: string, layout: 'simple' | 'index' = 'simple', options: { beforeMultiFactorSetUp?: boolean } = {}) => {
        router.get(panel.getBaseUrl(path), async (req, res) => {
            const ctx = await context(req, res);
            if (ctx.denied) return forbidden(req, res);
            if (!ctx.user) return res.redirect(panel.getLoginUrl());
            // Required multi-factor authentication: nothing but its setup page (and email verification) until it is set up.
            if (!options.beforeMultiFactorSetUp && (await panel.mustSetUpMultiFactorAuthentication(ctx.user))) return res.redirect(panel.getSetUpRequiredMultiFactorAuthenticationUrl());
            // Full layout in a multi-tenant panel: the navigation links to the user's first tenant.
            if (layout === 'index' && panel.hasTenancy()) ctx.tenant = (await panel.getTenantProvider().getTenants(ctx.user))[0] ?? null;
            await guarded(res, () => document(req, res, ctx, { title, component, layout }));
        });
    };

    // Files offered to the signed-in user (exports, failed import rows): only the user who created them can download them.
    router.get(panel.getBaseUrl('downloads/:token'), async (req, res) => {
        const ctx = await context(req, res);
        if (!ctx.user || ctx.denied) return forbidden(req, res);
        const file = panel.getDownloads().get(String(req.params.token), ctx.user.id);
        if (!file) return renderErrorPage(panel, req, res, 404);
        res.setHeader('Content-Type', file.type);
        res.setHeader('Content-Disposition', `attachment; filename="${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(file.content);
    });

    if (LoginPage) {
        guestPage(panel.getAuthPaths().login, name('auth.login'), t('filament-panels::auth/pages/login.title'));
        router.post(panel.getLogoutUrl(), express.urlencoded({ extended: false }), (req, res) => {
            if (!verifyCsrf(req, req.body?._token)) return renderErrorPage(panel, req, res, 419);
            panel.logOut(res);
            res.redirect(panel.getLoginUrl());
        });
    }
    if (RegistrationPage) guestPage(panel.getAuthPaths().registration, name('auth.register'), t('filament-panels::auth/pages/register.title'));
    if (passwordReset) {
        guestPage(panel.getAuthPaths().passwordResetRequest, name('auth.password-reset.request'), t('filament-panels::auth/pages/password-reset/request-password-reset.title'));
        guestPage(panel.getAuthPaths().passwordReset, name('auth.password-reset.reset'), t('filament-panels::auth/pages/password-reset/reset-password.title'), (req) => ({ email: typeof req.query.email === 'string' ? req.query.email : null, token: typeof req.query.token === 'string' ? req.query.token : null }));
    }
    if (VerificationPrompt) {
        userPage(panel.getAuthPaths().emailVerificationPrompt, name('auth.email-verification.prompt'), t('filament-panels::auth/pages/email-verification/email-verification-prompt.title'), 'simple', { beforeMultiFactorSetUp: true });
        // Emailed link: signed, time-limited, and only valid for the signed-in user it designates.
        router.get(panel.getBaseUrl(`${panel.getAuthPaths().emailVerification}/:id/:hash`), async (req, res) => {
            const ctx = await context(req, res);
            if (ctx.denied) return forbidden(req, res);
            if (!ctx.user) return res.redirect(panel.getLoginUrl());
            const id = String(req.params.id), hash = String(req.params.hash);
            const expected = createHash('sha1').update(ctx.user.email).digest('hex');
            if (String(ctx.user.id) !== id || hash !== expected || !panel.checkVerifyEmailUrl(id, hash, req.query.expires, req.query.signature)) return renderErrorPage(panel, req, res, 403, { description: t('filament-panels::errors.403.invalid_link') });
            await panel.getAuth().markEmailAsVerified?.(ctx.user);
            res.redirect((await homeUrl(ctx.user)) ?? panel.getBaseUrl());
        });
    }
    if (profile) userPage(profile.page.slug, name('auth.profile'), profile.page.getLabel(), profile.isSimple ? 'simple' : 'index');
    if (panel.hasEmailChangeVerification()) {
        const flash = async (ctx: PanelContext, build: () => void) => { const { pending } = await runInRequest(ctx.mailbox, async () => build()); if (pending.length) publish(ctx.mailbox, pending); };
        const group = 'filament-panels::auth/http/controllers';
        // Link sent to the new address: only for the signed-in user who asked, while the old address is still theirs.
        router.get(panel.getBaseUrl(panel.getAuthPaths().emailChangeVerification), async (req, res) => {
            const ctx = await context(req, res);
            if (ctx.denied) return forbidden(req, res);
            if (!ctx.user) return res.redirect(panel.getLoginUrl());
            const payload = panel.readEmailChangeToken('verify', req.query.token);
            if (!payload || String(payload.uid) !== String(ctx.user.id) || payload.from !== fingerprint(ctx.user.email)) return renderErrorPage(panel, req, res, 403, { description: t('filament-panels::errors.403.invalid_link') });
            const store = getDefaultCacheStore();
            if (await store.get(`navette:email-change:blocked:${payload.nonce}`)) return renderErrorPage(panel, req, res, 403, { description: t('filament-panels::errors.403.email_change_blocked') });
            const auth = panel.getAuth();
            const other = await auth.findByEmail?.(payload.email);
            if (other && String(other.id) !== String(ctx.user.id)) {
                await flash(ctx, () => Notification.make().danger().title(t(`${group}/email-change-verification-controller.notifications.unavailable.title`)).body(t(`${group}/email-change-verification-controller.notifications.unavailable.body`)).send());
            } else {
                const updated = await auth.update!(ctx.user, { email: payload.email });
                // The new address was just proven by following the link.
                await auth.markEmailAsVerified?.(updated);
                await flash(ctx, () => Notification.make().success().title(t(`${group}/email-change-verification-controller.notifications.verified.title`)).body(t(`${group}/email-change-verification-controller.notifications.verified.body`, { email: payload.email })).send());
            }
            res.redirect(panel.getProfileUrl() ?? panel.getBaseUrl());
        });
        // Link sent to the old address: works without signing in, until the change is confirmed.
        router.get(panel.getBaseUrl(panel.getAuthPaths().blockEmailChange), async (req, res) => {
            const ctx = await context(req, res);
            const payload = panel.readEmailChangeToken('block', req.query.token);
            if (!payload) return renderErrorPage(panel, req, res, 403, { description: t('filament-panels::errors.403.invalid_link') });
            const user = await panel.getAuth().find(payload.uid);
            if (!user) return renderErrorPage(panel, req, res, 403, { description: t('filament-panels::errors.403.invalid_link') });
            const changed = user.email === payload.email;
            if (!changed) await getDefaultCacheStore().put(`navette:email-change:blocked:${payload.nonce}`, true, 60 * 60 + 60);
            await flash(ctx, () => (changed
                ? Notification.make().danger().persistent().title(t(`${group}/block-email-change-verification-controller.notifications.failed.title`)).body(t(`${group}/block-email-change-verification-controller.notifications.failed.body`, { email: payload.email }))
                : Notification.make().success().persistent().title(t(`${group}/block-email-change-verification-controller.notifications.blocked.title`)).body(t(`${group}/block-email-change-verification-controller.notifications.blocked.body`, { email: payload.email }))).send());
            res.redirect(ctx.user ? (panel.getProfileUrl() ?? panel.getBaseUrl()) : panel.getLoginUrl());
        });
    }
    if (TenantRegistration) userPage(TenantRegistration.slug, name('tenancy.registration'), TenantRegistration.getLabel());
    if (MultiFactorSetUpPage) userPage(panel.getAuthPaths().setUpRequiredMultiFactor, name('auth.multi-factor-authentication.set-up-required'), t('filament-panels::auth/multi-factor/pages/set-up-required-multi-factor-authentication.title'), 'simple', { beforeMultiFactorSetUp: true });

    /** Context of a protected page: login, email verification, tenant. Returns `null` after responding. */
    const pageContext = async (req: Request, res: Response): Promise<PanelContext | null> => {
        const ctx = await context(req, res);
        if (ctx.denied) { forbidden(req, res); return null; }
        if (!ctx.user) { if (panel.allowsGuests()) return ctx; res.redirect(panel.getLoginUrl()); return null; }
        if (await panel.mustVerifyEmail(ctx.user)) { res.redirect(panel.getEmailVerificationPromptUrl()); return null; }
        if (await panel.mustSetUpMultiFactorAuthentication(ctx.user)) { res.redirect(panel.getSetUpRequiredMultiFactorAuthenticationUrl()); return null; }
        if (panel.hasTenancy()) {
            ctx.tenant = await tenantFromPath(req.path, ctx.user, req.hostname);
            if (!ctx.tenant) { renderErrorPage(panel, req, res, 404); return null; }
        }
        return ctx;
    };
    // The tenant's segment in page routes: none on tenant domains, `<prefix>/:tenant/` with a route prefix.
    const tenantRoot = !panel.hasTenancy() || panel.getTenantDomain() ? '' : [panel.getTenantRoutePrefix(), ':tenant'].filter(Boolean).join('/');
    const tenantSegment = tenantRoot ? `${tenantRoot}/` : '';
    /** Whether a `:tenant` route parameter is really another route's segment (`login`…), without a route prefix. */
    const notATenant = (req: Request) => panel.hasTenancy() && tenantRoot !== '' && panel.getTenantRoutePrefix() === null && (panel.getReservedSegments().has(req.params.tenant) || req.params.tenant === TenantRegistration?.slug);
    /** A tenant page whose tenant has no subscription goes to the billing page. */
    const requiresSubscription = async (PageClass: typeof Page, ctx: PanelContext): Promise<boolean> =>
        Boolean(ctx.tenant) && PageClass.isTenantSubscriptionRequired(panel) && !(await panel.getTenantBillingProvider()!.isSubscribed!(ctx.tenant));
    if (!panel.hasTenancy() && !panel.getPages().some((page) => page.slug === '')) {
        // Panel root without a dashboard: the first menu page, as in Filament.
        router.get(panel.getBaseUrl(), async (req, res) => {
            const ctx = await pageContext(req, res);
            if (!ctx) return;
            const url = panel.getNavigation(req.path, new Map(), await panel.resolveInaccessiblePages(ctx.user))[0]?.items[0]?.url ?? null;
            if (!url) return renderErrorPage(panel, req, res, 404);
            res.redirect(url);
        });
    }
    if (panel.hasTenancy()) {
        // Panel root: the user's first tenant, otherwise tenant registration (on a tenant's own host: its pages).
        router.get(panel.getBaseUrl(), async (req, res, next) => {
            if (panel.getTenantDomain() && panel.getTenantKeyFromRequest(req.path, req.hostname) !== null) return next();
            const ctx = await context(req, res);
            if (ctx.denied) return forbidden(req, res);
            if (!ctx.user) return res.redirect(panel.getLoginUrl());
            if (await panel.mustVerifyEmail(ctx.user)) return res.redirect(panel.getEmailVerificationPromptUrl());
            if (await panel.mustSetUpMultiFactorAuthentication(ctx.user)) return res.redirect(panel.getSetUpRequiredMultiFactorAuthenticationUrl());
            const url = await homeUrl(ctx.user);
            if (!url) return renderErrorPage(panel, req, res, 404);
            res.redirect(url);
        });
        // Tenant root without a dashboard: the first menu page.
        if (!panel.getPages().some((page) => page.slug === '')) {
            router.get(panel.getBaseUrl(tenantRoot), async (req, res, next) => {
                if (notATenant(req)) return next();
                const ctx = await pageContext(req, res);
                if (!ctx) return;
                const url = await panel.withTenant(ctx.tenant, async () => panel.getNavigation(req.path, new Map(), await panel.resolveInaccessiblePages(ctx.user))[0]?.items[0]?.url ?? null);
                if (!url) return renderErrorPage(panel, req, res, 404);
                res.redirect(url);
            });
        }
    }
    // Billing page of a tenant, served by the billing provider.
    const billing = panel.getTenantBillingProvider();
    if (panel.hasTenancy() && billing) {
        if (panel.isTenantSubscriptionRequired() && typeof billing.isSubscribed !== 'function') throw new Error('requiresTenantSubscription(): the billing provider must implement isSubscribed().');
        router.get(panel.getBaseUrl(tenantSegment + panel.getTenantBillingRouteSlug()), async (req, res, next) => {
            if (notATenant(req)) return next();
            const ctx = await pageContext(req, res);
            if (!ctx) return;
            await panel.withTenant(ctx.tenant, () => billing.handle(req, res, ctx.tenant));
        });
    }
    for (const PageClass of routeOrder(panel.getPages())) {
        const component = name(`pages.${(PageClass.slug || 'dashboard').replace(/[{}]/g, '')}`);
        runtime.register(component, PageClass);
        pageComponents.set(component, PageClass);
        // `{record}` in the slug becomes a route parameter, passed to mount().
        router.get(panel.getBaseUrl(tenantSegment + PageClass.slug).replace(/\{(\w+)\}/g, ':$1'), async (req, res, next) => {
            if (notATenant(req)) return next();
            const ctx = await pageContext(req, res);
            if (!ctx) return;
            if (await requiresSubscription(PageClass, ctx)) return res.redirect(panel.getTenantBillingUrl(ctx.tenant)!);
            const { tenant: _tenant, ...params } = req.params;
            await guarded(res, () => withRequestConfiguration(PageClass, () => document(req, res, ctx, { title: PageClass.getTitle(), component, layout: 'index', params })));
        });
    }
    // Any other URL of a panel with a path is unknown. A panel at the root leaves them to the application (`panelNotFound()`).
    if (panelBase !== '/') router.get([panelBase, `${panelBase}/*path`], (req, res) => renderErrorPage(panel, req, res, 404));
    // An error thrown while rendering a page of the panel: the 500 page. Component updates keep Livewire's error handling.
    router.use((error: unknown, req: Request, res: Response, next: (error?: unknown) => void) => {
        if (res.headersSent || req.method !== 'GET' || !belongsToPanel(req.path) || req.path.startsWith(`${livewire}/`)) return next(error);
        console.error(error);
        const status = typeof (error as { status?: unknown })?.status === 'number' && (error as { status: number }).status >= 400 ? (error as { status: number }).status : 500;
        renderErrorPage(panel, req, res, status, { error });
    });
    return router;
}

/** The panel's 404 page for URLs nothing else answered: mount it after your routes, for a panel served at the root. */
export function panelNotFound(panel: Panel): (req: Request, res: Response) => void {
    return (req, res) => renderErrorPage(panel, req, res, 404);
}

/** Each auth feature requires some auth provider methods: fail at startup rather than on first click. */
function assertAuthCapabilities(panel: Panel): void {
    if (panel.allowsGuests() && panel.hasTenancy()) throw new Error('guestAccess() is not available in a multi-tenant panel: tenants belong to signed-in users.');
    for (const provider of panel.getMultiFactorAuthenticationProviders()) provider.checkConfiguration?.(panel);
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
    if (panel.hasEmailChangeVerification()) missing('Email change verification', ['update', 'findByEmail']);
}
