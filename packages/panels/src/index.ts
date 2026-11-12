// @navette/panels — port de filament/panels : Panel, mises en page, pages, navigation, connexion, session.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { checkVerificationUrl, consoleMailer, readToken, signToken, signVerificationUrl, type Mailer, type MailMessage } from './auth.ts';
export { consoleMailer, fileMailer, hashPassword, knexAuthProvider, knexTenantProvider, mailText, verifyPassword, type Mailer, type MailMessage, type TableQuery } from './auth.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type Router } from 'express';
import { Action, useColorManager, ActionGroup } from '@navette/actions';
import { Checkbox, Field, Select, Step, TextInput, Wizard, richDocumentToHtml, richHtmlToDocument, fillSchema, fillSchemaFromRecord, getSchemaState, validateSchema, useColorManager as useFormsColorManager } from '@navette/forms';
import { Actions, Component as SchemaComponent, EmbeddedSchema, Form, Group, Html, RenderHook, Schema, StatefulGroup, type SchemaHost } from '@navette/schemas';
import { WireError } from '@navette/wire';
import { useColorManager as useInfolistsColorManager, useHtmlSanitizer } from '@navette/infolists';
import { Notification, Notifications, publish, runInRequest } from './notifications.ts';
export { Notification, Notifications } from './notifications.ts';
import { addDays, addMonths, CALENDAR_LABELS, CALENDAR_VIEWS, isDate, renderCalendar, visibleRange, type CalendarEvent, type CalendarLabels, type CalendarView } from './calendar.ts';
export { addDays, addMonths, CALENDAR_LABELS, dayOf, daysBetween, eventsOn, renderCalendar, renderCalendarEvent, timeOf, visibleRange, type CalendarEvent, type CalendarLabels, type CalendarModel, type CalendarView } from './calendar.ts';
import { DatabaseNotifications, GlobalSearch, keyBindingSuffix, type DatabaseNotificationStore, type GlobalSearchCategory, type GlobalSearchResult } from './topbar.ts';
export { DatabaseNotifications, GlobalSearch, knexNotificationStore, timeAgo, type DatabaseNotificationAction, type DatabaseNotificationRecord, type DatabaseNotificationStore, type GlobalSearchCategory, type GlobalSearchResult } from './topbar.ts';
import { Attributes, ColorManager, HtmlString, RenderHookRegistry, cls, convertToRgb, e, icon, js, loadingIndicator, renderHook, runWithRenderHooks, views, type Palette, type RenderHookCallback } from '@navette/support';
import { t, tc } from '@navette/support/i18n';
import { emptyState } from '@navette/support/ui';
import type { DataAdapter } from '@navette/database';
import { REORDER_LIMIT, Table, initializeTableGrouping, updateTableColumnState as updateEditableColumnState, getTableQuery, getVisibleColumns, renderTable, sanitizeColumnState, sortTable, useColorManager as useTableColorManager, type ColumnState, type FilterState, type TableHost } from '@navette/tables';
import { Component, type WireRuntime } from '@navette/wire';
import { csrfToken, verifyCsrf, wireRouter, wireScripts, wireStyles } from '@navette/wire/express';

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url));
views.namespace('filament-panels', dir('../views'));
views.namespace('filament', fileURLToPath(new URL('../views', import.meta.resolve('@navette/support'))));
views.share({ t, tc });
export const ASSET_VERSION = '5.11.2.0';

/** Utilisateur connecté. Votre fournisseur d'authentification peut y ajouter ce qu'il veut (rôle, équipe…) : les politiques le reçoivent tel quel. */
export type User = { id: string | number; name: string; email: string; [key: string]: unknown };

/**
 * Politique d'une resource : une fonction par capacité, nommée comme dans Laravel
 * (`viewAny`, `create`, `update`, `delete`, `deleteAny`, `restore`, `forceDelete`, `reorder`, ou vos propres noms).
 * Capacité absente : autorisée.
 */
export type Policy<R = any> = Partial<Record<string, (user: User, record: R | null) => boolean | Promise<boolean>>>;
/** Plugin : un paquet de configuration réutilisable. `register` reçoit le panel en cours de construction ; `boot` est appelé au montage du routeur. */
export type Plugin = { id: string; register(panel: Panel): void; boot?(panel: Panel): void };
/** Question posée au crochet d'autorisation du panel. `resource`, `page` ou `widget` dit sur quoi elle porte. */
export type AuthorizationCheck = { user: User; ability: string; resource: unknown | null; record: unknown | null; page: typeof Page | null; widget: typeof Widget | null };
/** Rend `true` ou `false` pour décider, `undefined` pour laisser la politique de la resource (ou `canAccess` / `canView`) répondre. */
export type Authorizer = (check: AuthorizationCheck) => boolean | undefined | Promise<boolean | undefined>;
type MaybePromise<T> = T | Promise<T>;
/**
 * Fournisseur d'utilisateurs. `attempt` et `find` suffisent pour la connexion ; les méthodes facultatives activent
 * l'inscription (`create`, `findByEmail`), la réinitialisation du mot de passe (`findByEmail`, `update`, `getPasswordFingerprint`),
 * la vérification de l'adresse (`hasVerifiedEmail`, `markEmailAsVerified`) et la page de profil (`update`).
 * `knexAuthProvider(knex)` les fournit toutes pour une table `users` au format de Laravel.
 */
export interface AuthProvider {
    attempt(email: string, password: string): MaybePromise<User | null>;
    find(id: string | number): MaybePromise<User | null>;
    findByEmail?(email: string): MaybePromise<User | null>;
    /** Crée l'utilisateur ; le mot de passe est reçu en clair, à hacher par le fournisseur. */
    create?(data: { name: string; email: string; password: string }): MaybePromise<User>;
    /** Met à jour nom, adresse ou mot de passe (en clair, à hacher). Changer d'adresse doit annuler sa vérification. */
    update?(user: User, data: { name?: string; email?: string; password?: string }): MaybePromise<User>;
    hasVerifiedEmail?(user: User): MaybePromise<boolean>;
    markEmailAsVerified?(user: User): MaybePromise<void>;
    /** Valeur qui change avec le mot de passe enregistré : un lien de réinitialisation déjà servi devient invalide. */
    getPasswordFingerprint?(user: User): MaybePromise<string>;
}
/**
 * Locataires d'un panel (équipes, organisations…) : port de `->tenant(Team::class)`. Chaque page du panel vit alors
 * sous `/<panel>/<clé du locataire>/…`, et seul un membre du locataire peut l'ouvrir.
 */
export interface TenantProvider<T = any> {
    /** Locataires dont l'utilisateur est membre. */
    getTenants(user: User): MaybePromise<T[]>;
    /** Locataire d'après sa clé dans l'adresse (venue du navigateur : à valider). */
    find(key: string): MaybePromise<T | null>;
    canAccess(user: User, tenant: T): MaybePromise<boolean>;
    getKey(tenant: T): string;
    getName(tenant: T): string;
    /** Texte au-dessus du nom dans le menu (« Current team »), ou `null`. */
    getCurrentTenantLabel?(tenant: T): string | null;
    getAvatarUrl?(tenant: T): string | null;
    /** Création (page d'inscription d'un locataire) : l'utilisateur en devient membre. */
    create?(data: Record<string, unknown>, user: User): MaybePromise<T>;
    update?(tenant: T, data: Record<string, unknown>): MaybePromise<T>;
}
export type PanelContext = { req: Request; res: Response; panel: Panel; user: User | null; mailbox: string; tenant?: unknown };

/**
 * Thème prédéfini d'un panel : un jeu de couleurs (palettes ou simples couleurs), éventuellement une police et du CSS.
 * Quand un panel en déclare plusieurs, l'utilisateur choisit le sien dans son menu ; le choix est gardé dans un cookie.
 */
export type Theme = {
    id: string; label: string;
    colors?: Record<string, Palette | string>;
    font?: { family: string; url?: string };
    /** CSS ajouté à la page pour ce thème (écrit par le développeur du panel, inséré tel quel). */
    css?: string;
};

// ------------------------------------------------------------------ navigation
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
    /** Par défaut un élément est actif sur son URL exacte, comme une page Filament (les resources fourniront leur propre règle). */
    isActiveWhen(fn: (path: string) => boolean): this { this._isActive = fn; return this; }
    isActive(path: string): boolean { return this._isActive ? this._isActive(path) : path === this._url; }
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ------------------------------------------------------------------ panel
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
    /** Icône d'onglet du navigateur. */
    favicon(url: string | null): this { this._favicon = url; return this; }
    getFavicon(): string | null { return this._favicon; }
    /**
     * Feuille de thème compilée par l'application (Tailwind) : elle remplace la feuille par défaut de Filament.
     * Équivalent de `->viteTheme()` : le thème importe `@navette/panels/theme.css` et déclare ses propres sources.
     */
    theme(url: string | null): this { this._theme = url; return this; }
    getTheme(): string | null { return this._theme; }
    /**
     * Mouvement et indicateurs de chargement propres à Navette (ressorts, pastille d'activité, roue des zones différées).
     * C'est un écart assumé avec Filament : `motion(false)` rend l'interface d'origine, sans rien d'ajouté.
     */
    motion(enabled = true): this { this._motion = enabled; return this; }
    hasMotion(): boolean { return this._motion; }
    /** Thèmes proposés à l'utilisateur ; le premier est le thème par défaut. */
    themes(themes: Theme[]): this {
        for (const theme of themes) if (!/^[a-z0-9-]{1,40}$/.test(theme.id)) throw new Error(`Identifiant de thème invalide : ${theme.id}`);
        this._themes = themes;
        return this;
    }
    getThemes(): Theme[] { return this._themes; }
    /** Thème de la requête : celui du cookie s'il est déclaré, sinon le premier. Null si le panel n'a pas de thèmes. */
    resolveTheme(req: Request): Theme | null {
        if (!this._themes.length) return null;
        const id = (req.headers.cookie ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`navette_${this._id}_theme=`))?.split('=')[1];
        return this._themes.find((theme) => theme.id === id) ?? this._themes[0];
    }
    rememberTheme(res: Response, theme: Theme): void { res.cookie(`navette_${this._id}_theme`, theme.id, { sameSite: 'lax', secure: res.req?.secure === true, maxAge: 1000 * 60 * 60 * 24 * 365 }); }
    /** Exécute un rendu avec les couleurs du thème de la requête. */
    withTheme<T>(req: Request, fn: () => T): T {
        const theme = this.resolveTheme(req);
        // Les composants des autres paquets lisent un gestionnaire de couleurs partagé par tous les panels :
        // les couleurs de ce panel (et de son thème) n'y valent que le temps de la requête.
        const withPanelColors = () => sharedColors.runWith(`${this._id}:${theme?.id ?? ''}`, this.colors.getColors(), fn);
        // Les render hooks du panel ne valent que pour ses propres requêtes.
        return runWithRenderHooks(this._renderHooks, () => (theme?.colors ? this.colors.runWith(theme.id, theme.colors, withPanelColors) : withPanelColors()));
    }
    setColors(colors: Record<string, Palette | string>): this { this.colors.register(colors); return this; }
    /** Police du panel. Sans URL : fournisseur Bunny Fonts, comme `->font('Albert Sans')` dans Filament. */
    font(family: string, url?: string): this {
        this._font = { family, url: url ?? `https://fonts.bunny.net/css?family=${slug(family)}:400,500,600,700&display=swap`, preconnect: url ? null : 'https://fonts.bunny.net' };
        return this;
    }
    login(page: typeof Login = Login): this { this._login = page; return this; }
    auth(provider: AuthProvider): this { this._auth = provider; return this; }
    key(key: string): this { this._key = key; return this; }
    pages(pages: (typeof Page)[]): this { this._pages.push(...pages); return this; }
    /** Enregistre des resources : leurs pages et leur élément de navigation. */
    resources(resources: (typeof Resource)[]): this {
        for (const resource of resources) { resource.panel = this; this._resources.push(resource); this._pages.push(...Object.values(resource.getPages())); }
        return this;
    }
    navigationItems(items: NavigationItem[]): this { this._navigationItems.push(...items); return this; }
    /** Ordre des groupes de navigation. */
    navigationGroups(groups: string[]): this { this._navigationGroups = groups; return this; }
    private _plugins: Plugin[] = [];
    /** Applique un plugin : un objet qui configure le panel (resources, pages, render hooks, thèmes…). */
    plugin(plugin: Plugin): this {
        if (this._plugins.some((p) => p.id === plugin.id)) throw new Error(`Plugin déjà enregistré : ${plugin.id}`);
        this._plugins.push(plugin);
        plugin.register(this);
        return this;
    }
    plugins(plugins: Plugin[]): this { for (const plugin of plugins) this.plugin(plugin); return this; }
    getPlugins(): Plugin[] { return this._plugins; }
    private _renderHooks = new RenderHookRegistry();
    /**
     * Insère du HTML à un emplacement nommé de l'interface de ce panel (noms : `PanelsRenderHook`, `TablesRenderHook`, `ActionsRenderHook`, `WidgetsRenderHook`).
     * `scopes` limite le hook à certaines pages ou resources (leur classe). Le HTML rendu est inséré tel quel : échappez toute donnée avec `e()`.
     */
    renderHook(name: string, render: RenderHookCallback, scopes: unknown | unknown[] | null = null): this { this._renderHooks.register(name, render, scopes); return this; }
    getRenderHooks(): RenderHookRegistry { return this._renderHooks; }
    private _authorizer: Authorizer | null = null;
    /** Branche votre propre système de permissions : consulté avant toute politique, pour chaque capacité, page et widget. */
    authorizeUsing(authorizer: Authorizer | null): this { this._authorizer = authorizer; return this; }
    /** Décision d'autorisation : le crochet du panel d'abord, puis la règle fournie ; sans utilisateur, toujours non. */
    async authorize(user: User | null, ability: string, subject: { resource?: unknown; record?: unknown; page?: typeof Page; widget?: typeof Widget; rule?: (() => boolean | Promise<boolean>) | null } = {}): Promise<boolean> {
        if (!user) return false;
        const decided = await this._authorizer?.({ user, ability, resource: subject.resource ?? null, record: subject.record ?? null, page: subject.page ?? null, widget: subject.widget ?? null });
        if (typeof decided === 'boolean') return decided;
        return subject.rule ? Boolean(await subject.rule()) : true;
    }
    /** Une page est-elle accessible à cet utilisateur ? Liste : `viewAny` ; création : `create` ; édition : vérifiée sur l'enregistrement ; page libre : `canAccess`. */
    async canAccessPage(PageClass: typeof Page, user: User | null): Promise<boolean> {
        const resource = (PageClass as any).resource as typeof Resource | undefined;
        if (resource && PageClass.prototype instanceof EditRecord) return user !== null;
        if (resource && PageClass.prototype instanceof CreateRecord) return resource.can('create', user);
        if (resource) return resource.can('viewAny', user);
        return this.authorize(user, 'access', { page: PageClass, rule: () => PageClass.canAccess(user!) });
    }
    private _widgets: (typeof Widget)[] = [];
    /** Widgets du panel (tableau de bord, pages libres) : enregistrés comme composants, à afficher par `getHeaderWidgets()` d'une page. */
    widgets(widgets: (typeof Widget)[]): this { this._widgets.push(...widgets); return this; }
    getWidgets(): (typeof Widget)[] { return this._widgets; }
    maxContentWidth(width: string): this { this._maxContentWidth = width; return this; }

    getId(): string { return this._id; }
    getBrandName(): string { return this._brandName; }
    getAuth(): AuthProvider { if (!this._auth) throw new Error('Aucun fournisseur d\'authentification : panel.auth(...).'); return this._auth; }
    getLoginPage(): typeof Login | null { return this._login; }
    getPages(): (typeof Page)[] { return this._pages; }
    getResources(): (typeof Resource)[] { return this._resources; }

    // -------------------------------------------------------------- recherche globale
    private _globalSearch = true;
    private _globalSearchKeyBindings: string[] = [];
    private _globalSearchDebounce = '500ms';
    private _globalSearchSuffix: string | null | ((userAgent: string) => string | null) = null;
    /** `false` retire le champ de recherche globale. Il n'apparaît de toute façon que si une resource est cherchable. */
    globalSearch(condition = true): this { this._globalSearch = condition; return this; }
    /** Raccourcis qui placent le curseur dans le champ : `['command+k', 'ctrl+k']`. */
    globalSearchKeyBindings(keyBindings: string[]): this { this._globalSearchKeyBindings = keyBindings.filter((binding) => /^[a-z0-9+]+$/.test(binding)); return this; }
    getGlobalSearchKeyBindings(): string[] { return this._globalSearchKeyBindings; }
    /** Délai entre la frappe et la recherche (`500ms` par défaut). */
    globalSearchDebounce(debounce: string): this { if (/^[0-9]+m?s$/.test(debounce)) this._globalSearchDebounce = debounce; return this; }
    getGlobalSearchDebounce(): string { return this._globalSearchDebounce; }
    globalSearchFieldSuffix(suffix: string | null): this { this._globalSearchSuffix = suffix; return this; }
    /** Affiche le premier raccourci dans le champ, écrit selon la plateforme du navigateur (comme Filament : « META+K » hors Mac pour `command+k`). */
    globalSearchFieldKeyBindingSuffix(): this { this._globalSearchSuffix = (userAgent) => keyBindingSuffix(this._globalSearchKeyBindings, userAgent); return this; }
    getGlobalSearchFieldSuffix(userAgent = ''): string | null { return typeof this._globalSearchSuffix === 'function' ? this._globalSearchSuffix(userAgent) : this._globalSearchSuffix; }
    hasGlobalSearch(): boolean { return this._globalSearch && this._resources.some((resource) => resource.canGloballySearch()); }
    /** Résultats par resource, dans l'ordre d'enregistrement ; seules les resources que l'utilisateur peut lister sont interrogées. */
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

    // -------------------------------------------------------------- notifications en base
    private _databaseNotifications: DatabaseNotificationStore | null = null;
    private _databaseNotificationsPolling: string | null = '30s';
    /** Active la cloche des notifications enregistrées en base, lues et écrites par ce stockage (`knexNotificationStore(knex)`). */
    databaseNotifications(store: DatabaseNotificationStore | null): this { this._databaseNotifications = store; return this; }
    getDatabaseNotifications(): DatabaseNotificationStore | null { return this._databaseNotifications; }
    /** Intervalle de rafraîchissement (`30s` par défaut) ; `null` pour ne pas interroger le serveur. */
    databaseNotificationsPolling(interval: string | null): this { this._databaseNotificationsPolling = interval; return this; }
    getDatabaseNotificationsPollingInterval(): string | null { return this._databaseNotificationsPolling; }

    // -------------------------------------------------------------- mise en page : barre du haut, navigation, sidebar
    private _topbar = true;
    private _topNavigation = false;
    private _navigation = true;
    private _sidebarCollapsibleOnDesktop = false;
    private _sidebarFullyCollapsibleOnDesktop = false;
    private _positions: { userMenu: 'topbar' | 'sidebar' | null; globalSearch: 'topbar' | 'sidebar' | null; databaseNotifications: 'topbar' | 'sidebar' | null } = { userMenu: null, globalSearch: null, databaseNotifications: null };
    /** Barre du haut (présente par défaut, comme dans Filament) : `topbar(false)` met logo, recherche, cloche et menu dans la sidebar. */
    topbar(condition = true): this { this._topbar = condition; return this; }
    hasTopbar(): boolean { return this._topbar; }
    /** Navigation dans la barre du haut (menus déroulants par groupe) au lieu de la sidebar. */
    topNavigation(condition = true): this { this._topNavigation = condition; return this; }
    hasTopNavigation(): boolean { return this._topNavigation; }
    /** `navigation(false)` retire toute navigation (ni sidebar ni menus). */
    navigation(condition = true): this { this._navigation = condition; return this; }
    hasNavigation(): boolean { return this._navigation; }
    /** Sidebar repliable sur grand écran en une colonne d'icônes. */
    sidebarCollapsibleOnDesktop(condition = true): this { this._sidebarCollapsibleOnDesktop = condition; return this; }
    isSidebarCollapsibleOnDesktop(): boolean { return this._sidebarCollapsibleOnDesktop; }
    /** Sidebar entièrement masquable sur grand écran. */
    sidebarFullyCollapsibleOnDesktop(condition = true): this { this._sidebarFullyCollapsibleOnDesktop = condition; return this; }
    isSidebarFullyCollapsibleOnDesktop(): boolean { return this._sidebarFullyCollapsibleOnDesktop; }
    /** Emplacement du menu utilisateur ; par défaut, la barre du haut si elle existe. */
    userMenuPosition(position: 'topbar' | 'sidebar' | null): this { this._positions.userMenu = position; return this; }
    getUserMenuPosition(): 'topbar' | 'sidebar' { return this._positions.userMenu ?? (this._topbar ? 'topbar' : 'sidebar'); }
    globalSearchPosition(position: 'topbar' | 'sidebar' | null): this { this._positions.globalSearch = position; return this; }
    getGlobalSearchPosition(): 'topbar' | 'sidebar' { return this._positions.globalSearch ?? (this._topbar ? 'topbar' : 'sidebar'); }
    databaseNotificationsPosition(position: 'topbar' | 'sidebar' | null): this { this._positions.databaseNotifications = position; return this; }
    getDatabaseNotificationsPosition(): 'topbar' | 'sidebar' { return this._positions.databaseNotifications ?? (this._topbar ? 'topbar' : 'sidebar'); }
    private _userMenuItems: Record<string, Action> = {};
    /** Éléments ajoutés au menu utilisateur (actions à adresse ou à modale). `sort()` négatif : au-dessus du choix du thème. Clés `profile` et `logout` : remplacent ceux par défaut. */
    userMenuItems(items: Record<string, Action> | Action[]): this {
        for (const [key, item] of Array.isArray(items) ? items.map((item) => [item.getName(), item] as const) : Object.entries(items)) this._userMenuItems[key] = item;
        return this;
    }
    getUserMenuItems(): Record<string, Action> { return this._userMenuItems; }

    // -------------------------------------------------------------- inscription, mot de passe oublié, vérification, profil
    private _registration: typeof Register | null = null;
    private _passwordReset: { request: typeof RequestPasswordReset; reset: typeof ResetPassword } | null = null;
    private _emailVerification: { prompt: typeof EmailVerificationPrompt; isRequired: boolean } | null = null;
    private _profile: { page: typeof EditProfile; isSimple: boolean } | null = null;
    private _mailer: Mailer = consoleMailer;
    /** Page d'inscription (`/register`). Le fournisseur d'utilisateurs doit savoir créer (`create`) et chercher par adresse (`findByEmail`). */
    registration(page: typeof Register | null = Register): this { this._registration = page; return this; }
    hasRegistration(): boolean { return this._registration !== null; }
    getRegistrationPage(): typeof Register | null { return this._registration; }
    /** Mot de passe oublié : demande (`/password-reset/request`) et réinitialisation par un lien signé envoyé par e-mail. */
    passwordReset(request: typeof RequestPasswordReset = RequestPasswordReset, reset: typeof ResetPassword = ResetPassword): this { this._passwordReset = { request, reset }; return this; }
    hasPasswordReset(): boolean { return this._passwordReset !== null; }
    getPasswordResetPages() { return this._passwordReset; }
    /** Vérification de l'adresse e-mail : un lien signé est envoyé à l'inscription ; tant qu'il n'est pas suivi, seule l'invitation à vérifier est accessible (`isRequired`). */
    emailVerification(prompt: typeof EmailVerificationPrompt = EmailVerificationPrompt, isRequired = true): this { this._emailVerification = { prompt, isRequired }; return this; }
    hasEmailVerification(): boolean { return this._emailVerification !== null; }
    isEmailVerificationRequired(): boolean { return this._emailVerification?.isRequired === true; }
    getEmailVerificationPrompt(): typeof EmailVerificationPrompt | null { return this._emailVerification?.prompt ?? null; }
    /** Page de profil (`/profile`) : nom, adresse, mot de passe. `isSimple` : mise en page simple (par défaut) ou complète. */
    profile(page: typeof EditProfile = EditProfile, isSimple = true): this { this._profile = { page, isSimple }; return this; }
    hasProfile(): boolean { return this._profile !== null; }
    getProfile() { return this._profile; }
    /** Envoi des e-mails (réinitialisation, vérification). Par défaut : écrits dans la console. */
    mailer(mailer: Mailer): this { this._mailer = mailer; return this; }
    async sendMail(message: MailMessage): Promise<void> { await this._mailer.send(message); }
    getAuthKey(): string { return this._key; }
    getRegistrationUrl(): string { return this.getBaseUrl('register'); }
    getRequestPasswordResetUrl(): string { return this.getBaseUrl('password-reset/request'); }
    getResetPasswordUrl(user: User, fingerprint: string): string {
        const token = signToken(this._key, `${this._id}.password-reset`, { uid: user.id, fp: fingerprint }, 60 * 60);
        return `${this.getBaseUrl('password-reset/reset')}?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`;
    }
    /** Charge d'un jeton de réinitialisation valide pour ce panel, sinon `null`. */
    readResetPasswordToken(token: unknown): { uid: string | number; fp: string } | null { return readToken(this._key, `${this._id}.password-reset`, token) as any; }
    getVerifyEmailUrl(user: User): string {
        const expires = Math.floor(Date.now() / 1000) + 60 * 60;
        const { hash, signature } = signVerificationUrl(`${this._key}.${this._id}`, user.id, user.email, expires);
        return `${this.getBaseUrl(`email-verification/verify/${encodeURIComponent(String(user.id))}/${hash}`)}?expires=${expires}&signature=${encodeURIComponent(signature)}`;
    }
    checkVerifyEmailUrl(id: string, hash: string, expires: unknown, signature: unknown): boolean { return checkVerificationUrl(`${this._key}.${this._id}`, id, hash, expires, signature); }
    getEmailVerificationPromptUrl(): string { return this.getBaseUrl('email-verification/prompt'); }
    getProfileUrl(): string | null { return this._profile ? this.getBaseUrl('profile') : null; }
    /** L'utilisateur doit-il encore vérifier son adresse avant d'utiliser le panel ? */
    async mustVerifyEmail(user: User | null): Promise<boolean> {
        if (!user || !this.isEmailVerificationRequired()) return false;
        const auth = this.getAuth();
        return auth.hasVerifiedEmail ? !(await auth.hasVerifiedEmail(user)) : false;
    }

    // -------------------------------------------------------------- locataires (multi-tenancy)
    private _tenant: TenantProvider | null = null;
    private _tenantOwnershipColumn: string | null = null;
    private _tenantRegistration: typeof RegisterTenant | null = null;
    private _tenantProfile: typeof EditTenantProfile | null = null;
    private _tenantMenu = true;
    private _tenantMenuItems: Record<string, Action> = {};
    private _tenantScope = new AsyncLocalStorage<{ tenant: unknown }>();
    /**
     * Rend le panel multi-locataire. `ownershipColumn` : colonne qui rattache un enregistrement à son locataire (`team_id`) ;
     * les resources du panel ne lisent et n'écrivent alors que les enregistrements du locataire courant (voir `Resource.isScopedToTenant`).
     */
    tenant(provider: TenantProvider | null, options: { ownershipColumn?: string } = {}): this { this._tenant = provider; this._tenantOwnershipColumn = options.ownershipColumn ?? null; return this; }
    hasTenancy(): boolean { return this._tenant !== null; }
    getTenantProvider(): TenantProvider { if (!this._tenant) throw new Error('Panel sans locataires : panel.tenant(...).'); return this._tenant; }
    getTenantOwnershipColumn(): string | null { return this._tenantOwnershipColumn; }
    /** Page de création d'un locataire (`/new`). */
    tenantRegistration(page: typeof RegisterTenant | null): this { this._tenantRegistration = page; return this; }
    getTenantRegistrationPage(): typeof RegisterTenant | null { return this._tenantRegistration; }
    /** Page de profil du locataire (`/<locataire>/profile`). */
    tenantProfile(page: typeof EditTenantProfile | null): this { this._tenantProfile = page; return this; }
    getTenantProfilePage(): typeof EditTenantProfile | null { return this._tenantProfile; }
    tenantMenu(condition = true): this { this._tenantMenu = condition; return this; }
    hasTenantMenu(): boolean { return this._tenantMenu; }
    tenantMenuItems(items: Record<string, Action> | Action[]): this {
        for (const [key, item] of Array.isArray(items) ? items.map((item) => [item.getName(), item] as const) : Object.entries(items)) this._tenantMenuItems[key] = item;
        return this;
    }
    getTenantMenuItems(): Record<string, Action> { return this._tenantMenuItems; }
    /** Exécute `fn` pour un locataire : les adresses produites (`getUrl`) et les requêtes des resources lui sont rattachées. */
    withTenant<T>(tenant: unknown, fn: () => T): T { return this._tenantScope.run({ tenant }, fn); }
    /** Locataire de la requête en cours (équivalent de `Filament::getTenant()`), ou `null`. */
    getTenant<T = any>(): T | null { return (this._tenantScope.getStore()?.tenant ?? null) as T | null; }
    getTenantUrlKey(tenant: unknown): string { return this.getTenantProvider().getKey(tenant); }

    private _subNavigationPosition: 'start' | 'end' | 'top' = 'start';
    /** Position par défaut de la sous-navigation des pages (`start`, comme Filament). */
    subNavigationPosition(position: 'start' | 'end' | 'top'): this { this._subNavigationPosition = position; return this; }
    getSubNavigationPosition(): 'start' | 'end' | 'top' { return this._subNavigationPosition; }
    private _appUrl: string | null = null;
    /** Adresse publique de l'application (`https://exemple.fr`), utilisée dans les liens envoyés par e-mail. Sans elle, l'origine de la requête est reprise : à éviter en production (en-tête `Host` falsifiable). */
    appUrl(url: string | null): this { this._appUrl = url ? url.replace(/\/$/, '') : null; return this; }
    getAppUrl(): string | null { return this._appUrl; }

    getMaxContentWidth(): string { return this._maxContentWidth; }
    /** Adresse dans le panel ; dans un panel à locataires, préfixée par le locataire courant (ou celui donné). */
    getUrl(sub = '', tenant: unknown = this.getTenant()): string {
        if (this._tenant && tenant) return '/' + [this._path, encodeURIComponent(this.getTenantUrlKey(tenant)), sub.replace(/^\/|\/$/g, '')].filter(Boolean).join('/');
        return this.getBaseUrl(sub);
    }
    /** Adresse hors locataire (connexion, inscription, profil, création d'un locataire). */
    getBaseUrl(sub = ''): string { return '/' + [this._path, sub.replace(/^\/|\/$/g, '')].filter(Boolean).join('/'); }
    getLoginUrl(): string { return this.getBaseUrl('login'); }
    getLogoutUrl(): string { return this.getBaseUrl('logout'); }
    /** Préfixe de l'endpoint Livewire de ce panel (`/livewire`, ou `/<chemin>/livewire`) : chaque panel a le sien. */
    getLivewirePrefix(): string { return this._path ? `/${this._path}/livewire` : '/livewire'; }
    assetUrl(file: string): string { return `/${file}?v=${ASSET_VERSION}`; }
    getBrand(): Record<string, unknown> { return { name: this._brandName, logo: this._brandLogo, darkLogo: this._darkModeBrandLogo, height: this._brandLogoHeight }; }
    getFont(): typeof this._font { return this._font; }

    /** Avatar par défaut : port de UiAvatarsProvider (service externe ui-avatars.com, initiales du nom). */
    getUserAvatarUrl(user: User): string { return this.getAvatarUrlFor(user.name); }
    /** Avatar d'un locataire : celui de son fournisseur (`getAvatarUrl`), sinon ses initiales. */
    getTenantAvatarUrl(tenant: unknown): string { return this.getTenantProvider().getAvatarUrl?.(tenant) ?? this.getAvatarUrlFor(this.getTenantProvider().getName(tenant)); }
    private _spa = false;
    /** Navigation sans rechargement (`wire:navigate`) entre les pages du panel, comme `->spa()`. */
    spa(condition = true): this { this._spa = condition; return this; }
    hasSpaMode(): boolean { return this._spa; }
    getAvatarUrlFor(name: string): string {
        const initials = name.trim().split(' ').map((s) => s.replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 1)).join(' ');
        const background = '#' + convertToRgb(this.colors.getColor('gray')![950]).map((n) => n.toString(16).padStart(2, '0')).join('');
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials).replace(/%20/g, '+')}&format=svg&color=FFFFFF&background=${encodeURIComponent(background)}`;
    }

    /** Groupes de navigation : pages enregistrées + éléments libres, triés, groupés dans l'ordre déclaré. */
    /** Compteurs de navigation calculés (équivalent de getNavigationBadge()) : adresse de la page → valeur. */
    async resolveNavigationBadges(): Promise<Map<string, string | number | null>> {
        const badges = new Map<string, string | number | null>();
        for (const page of this._pages) if (page.shouldRegisterNavigation && typeof (page as any).getNavigationBadge === 'function') badges.set(page.slug, await (page as any).getNavigationBadge());
        return badges;
    }
    /** Adresses des pages du menu que cet utilisateur ne peut pas ouvrir. */
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

    // --- session : cookie signé (identifiant d'utilisateur), suffisant pour le jalon 2
    private sign(value: string): string { return createHmac('sha256', this._key).update(value).digest('base64url'); }
    logIn(res: Response, user: User, remember: boolean): void {
        const value = Buffer.from(JSON.stringify({ uid: user.id })).toString('base64url');
        res.cookie(`navette_${this._id}_session`, `${value}.${this.sign(value)}`, { httpOnly: true, sameSite: 'lax', secure: res.req?.secure === true, ...(remember ? { maxAge: 1000 * 60 * 60 * 24 * 30 } : {}) });
    }
    logOut(res: Response): void { res.clearCookie(`navette_${this._id}_session`); }
    async user(req: Request): Promise<User | null> {
        const raw = (req.headers.cookie ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`navette_${this._id}_session=`))?.split('=')[1];
        if (!raw) return null;
        const [value, mac] = raw.split('.');
        const a = Buffer.from(mac ?? ''), b = Buffer.from(this.sign(value));
        if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
        try { return await this.getAuth().find(JSON.parse(Buffer.from(value, 'base64url').toString()).uid); } catch { return null; }
    }
}

// ------------------------------------------------------------------ render hooks
/**
 * Emplacements de render hook d'un panel — mêmes noms que `Filament\View\PanelsRenderHook`.
 * Ceux d'une brique pas encore portée (barre du haut, recherche globale, menu de locataire, sous-navigation, inscription,
 * réinitialisation du mot de passe, enregistrements liés) sont déclarés mais ne sont rendus nulle part pour l'instant : voir `UNPLACED_RENDER_HOOKS`.
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
    /** Le nom contient « module-menu » dans Filament : conservé tel quel. */
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
/** Emplacements de render hook des widgets — mêmes noms que `Filament\Widgets\View\WidgetsRenderHook`. Rendus par `TableWidget`. */
export const WidgetsRenderHook = {
    TABLE_WIDGET_END: 'widgets::table-widget.end',
    TABLE_WIDGET_START: 'widgets::table-widget.start',
} as const;
/**
 * Emplacements déclarés mais rendus nulle part pour l'instant, avec la brique qui leur manque.
 * Les quatre « tabs » ne sont rendus par aucune vue de Filament 5.11.2 non plus.
 */
export const UNPLACED_RENDER_HOOKS: Record<string, string> = {
    ...Object.fromEntries(['RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_AFTER', 'RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_BEFORE'].map((k) => [(PanelsRenderHook as any)[k], 'page ManageRelatedRecords'])),
    ...Object.fromEntries(['RESOURCE_PAGES_LIST_RECORDS_TABS_END', 'RESOURCE_PAGES_LIST_RECORDS_TABS_START', 'RESOURCE_TABS_END', 'RESOURCE_TABS_START'].map((k) => [(PanelsRenderHook as any)[k], 'non rendu par Filament 5.11.2'])),
};

// ------------------------------------------------------------------ pages
/** Portée Alpine d'un composant de schéma sans clé (cellule de grille anonyme). */
const ANONYMOUS_SCHEMA_COMPONENT = `x-data="filamentSchemaComponent(${e(js({ key: null, exposedMethods: [], path: '', containerPath: '' }))})"`;
/** Base commune : composant à état hébergeant des schémas (`<nom>Schema(schema)`). */
abstract class BasePage extends Component implements SchemaHost {
    get panel(): Panel { return (this._ctx as PanelContext).panel; }
    getSchema(name: string): Schema {
        const schema = Schema.make(this).key(name);
        if (name === 'form') schema.statePath('data');
        return (this as any)[`${name}Schema`](schema);
    }
    contentSchema(schema: Schema): Schema { return schema.components([]); }
    /** Portées des render hooks de cette page : sa classe (et sa resource pour une page de resource), comme `getRenderHookScopes()` dans Filament. */
    getRenderHookScopes(): unknown[] {
        const resource = (this.constructor as any).resource;
        return resource ? [this.constructor, resource] : [this.constructor];
    }
}

/** Page d'un panel, dans la mise en page complète (sidebar, en-tête). */
export class Page extends BasePage {
    /** Méthodes que le navigateur peut appeler. Une sous-classe ajoute les siennes : `static callable = ['approve']`. */
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
    /** Page réservée à certains utilisateurs : rendre `false` la retire du menu et la refuse (403). */
    static canAccess(_user: User): boolean | Promise<boolean> { return true; }
    static getTitle(): string { return this.title ?? this.name.replace(/([a-z])([A-Z])/g, '$1 $2'); }
    static getNavigationLabel(): string { return this.navigationLabel ?? this.getTitle(); }

    /** Chaque requête, y compris les mises à jour envoyées par le navigateur, exige un utilisateur authentifié : un snapshot conservé après déconnexion ne suffit pas. */
    async boot(): Promise<void> {
        const ctx = this._ctx as PanelContext | null;
        if (!ctx?.user) throw new WireError(401, 'Non authentifié.');
        // Dans un panel à locataires, toute page vit chez un locataire dont l'utilisateur est membre (vérifié par le routeur).
        if (ctx.panel.hasTenancy() && !ctx.tenant) throw new WireError(404, 'Locataire introuvable.');
        if (await ctx.panel.mustVerifyEmail(ctx.user)) throw new WireError(403, 'Adresse e-mail à vérifier.');
        // Vérifié à chaque requête, pas seulement à l'affichage : une requête forgée vers une page interdite est refusée.
        if (!(await this.isAccessAuthorized(ctx))) throw new WireError(403, 'Accès refusé.');
    }
    protected isAccessAuthorized(ctx: PanelContext): boolean | Promise<boolean> { return ctx.panel.canAccessPage(this.constructor as typeof Page, ctx.user); }
    getTitle(): string { return (this.constructor as typeof Page).getTitle(); }
    getHeading(): string { return this.getTitle(); }
    getBreadcrumbs(): { label: string; url: string | null }[] { return []; }
    getHeaderActions(): Action[] { return []; }
    getPageClasses(): string[] { return []; }
    /** Sous-navigation de la page : vide par défaut. */
    getSubNavigation(): SubNavigationItem[] | Promise<SubNavigationItem[]> { return []; }
    /** Position de la sous-navigation : `start` (colonne avant le contenu), `end` (après) ou `top` (onglets). Par défaut : celle de la resource, sinon du panel. */
    static subNavigationPosition: 'start' | 'end' | 'top' | null = null;
    getSubNavigationPosition(): 'start' | 'end' | 'top' {
        const own = (this.constructor as typeof Page).subNavigationPosition;
        const resource = (this.constructor as any).resource ?? (this.constructor as any).related?.parentResource;
        return own ?? resource?.subNavigationPosition ?? this.panel.getSubNavigationPosition();
    }
    /** Widgets affichés sous le contenu de la page (port de getFooterWidgets). */
    getFooterWidgets(): (typeof Widget)[] { return []; }
    getFooterWidgetsColumns(): number | Record<string, number> { return 2; }
    /** Port de filament-widgets::components.widgets, dans le schéma `footerWidgets` de la page. */
    protected async renderFooterWidgets(): Promise<string> {
        const widgets = await this.filterVisibleWidgets(this.getFooterWidgets());
        if (!widgets.length) return '';
        const liberate = (hook: string) => `<div class="fi-sc-liberated" wire:key="" ${ANONYMOUS_SCHEMA_COMPONENT}>${renderHook(hook, this.getRenderHookScopes())}</div>`;
        return `<div x-data="filamentSchema({ livewireId: ${e(js(this.id))}, schemaKey: 'footerWidgets' })" x-on:form-validation-error.window="handleFormValidationError" x-on:reset-schema-component-state.window="handleClientSideStateReset" class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));">${liberate(PanelsRenderHook.PAGE_FOOTER_WIDGETS_START)}${await this.renderWidgetsGrid(widgets, this.getFooterWidgetsColumns(), 'footerWidgets')}${liberate(PanelsRenderHook.PAGE_FOOTER_WIDGETS_END)}</div>`;
    }
    /** Widgets affichés au-dessus du contenu de la page, et données passées à chacun (propriétés du widget). */
    getHeaderWidgets(): (typeof Widget)[] { return []; }
    getHeaderWidgetsColumns(): number { return 2; }
    getWidgetData(): Record<string, unknown> { return {}; }
    /** Port de filament-widgets::components.widgets, dans le schéma `headerWidgets` de la page. */
    protected async renderHeaderWidgets(): Promise<string> {
        const widgets = await this.filterVisibleWidgets(this.getHeaderWidgets());
        if (!widgets.length) return '';
        const liberate = (hook: string) => `<div class="fi-sc-liberated" wire:key="" ${ANONYMOUS_SCHEMA_COMPONENT}>${renderHook(hook, this.getRenderHookScopes())}</div>`;
        return `<div x-data="filamentSchema({ livewireId: ${e(js(this.id))}, schemaKey: 'headerWidgets' })" x-on:form-validation-error.window="handleFormValidationError" x-on:reset-schema-component-state.window="handleClientSideStateReset" class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));">${liberate(PanelsRenderHook.PAGE_HEADER_WIDGETS_START)}${await this.renderWidgetsGrid(widgets, this.getHeaderWidgetsColumns(), 'headerWidgets')}${liberate(PanelsRenderHook.PAGE_HEADER_WIDGETS_END)}</div>`;
    }
    /** Widgets que l'utilisateur courant a le droit de voir (port de filterVisibleWidgets). */
    protected async filterVisibleWidgets(candidates: (typeof Widget)[]): Promise<(typeof Widget)[]> {
        const viewer = (this._ctx as PanelContext).user;
        const widgets: (typeof Widget)[] = [];
        for (const widget of candidates) if (await this.panel.authorize(viewer, 'view', { widget, rule: () => widget.canView(viewer!) })) widgets.push(widget);
        return widgets;
    }
    /** Grille de widgets d'un schéma (port de Grid + getWidgetsSchemaComponents) : chaque widget est un composant enfant, « lazy » par défaut. */
    protected async renderWidgetsGrid(widgets: (typeof Widget)[], columns: number | Record<string, number>, schemaKey: string): Promise<string> {
        const items: string[] = [];
        for (const [index, widget] of widgets.entries()) {
            const key = `${schemaKey}.${widget.componentName}-${index}`;
            const child = await this.mountChild(widget.componentName, this.getWidgetData(), `${this.id}.${key}`, { lazy: widget.isLazy });
            items.push(`<div class="fi-sc-liberated" wire:key="${e(`${this.id}.${key}`)}" x-data="filamentSchemaComponent(${e(js({ key, exposedMethods: [], path: '', containerPath: '' }))})">${child}</div>`);
        }
        const grid = new Attributes().grid(typeof columns === 'number' ? { lg: columns } : columns).class(['fi-sc', 'fi-sc-has-gap']);
        return `<div ${ANONYMOUS_SCHEMA_COMPONENT} class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component"><div><div ${grid.toHtml()}>${items.join('')}</div></div></div></div>`;
    }
    /** Contenu de la page : par défaut son schéma `content`. */
    protected async renderContent(): Promise<string> { return (await this.getSchema('content')).toHtml(); }

    // --- actions montées (port de InteractsWithActions) : la pile vit dans l'état du composant, les modales sont rendues côté serveur
    mountedActions: { name: string; arguments: Record<string, unknown>; context: Record<string, unknown>; data?: Record<string, unknown> }[] = [];
    getActionMountContext(): Record<string, unknown> { return {}; }
    protected getActionRecord(): unknown { return null; }
    /** Enregistrement visé par une action montée dans un contexte donné (ligne de table…). */
    protected async resolveActionRecord(_context: Record<string, unknown>): Promise<unknown> { return this.getActionRecord(); }
    /** Actions pouvant être montées dans un contexte donné (en-tête de page par défaut). */
    protected getMountableActions(context: Record<string, unknown>): Action[] | Promise<Action[]> {
        return typeof context.schemaComponent === 'string' ? this.getSchemaComponentActions(context.schemaComponent) : this.getHeaderActions();
    }
    /**
     * Actions portées par un composant de schéma (Repeater : ajouter, supprimer, déplacer ; Section : actions d'en-tête).
     * La clé vient du navigateur : elle doit désigner un composant réel du schéma, ou le schéma lui-même.
     */
    protected async getSchemaComponentActions(key: string): Promise<Action[]> {
        const name = key.split('.')[0];
        // Le composant peut appartenir au formulaire d'une action déjà montée (éditeur riche dans une modale).
        const mountedIndex = /^mountedActionSchema(\d+)$/.exec(name);
        if (!mountedIndex && (!/^[A-Za-z]+$/.test(name) || typeof (this as any)[`${name}Schema`] !== 'function')) return [];
        const schema = mountedIndex ? await this.getMountedActionSchema(Number(mountedIndex[1])) : this.getSchema(name);
        if (!schema) return [];
        const components = schema.getFlatComponents() as any[];
        const exact = components.find((c) => c.getKey() === key && typeof c.getActions === 'function');
        if (exact) return exact.getActions();
        return key === schema.getKey() ? components.filter((c) => !c.hasStatePath() && typeof c.getActions === 'function').flatMap((c) => c.getActions()) : [];
    }
    /** Contexte retenu pour une action montée : celui du serveur, jamais celui du navigateur tel quel. */
    protected resolveMountContext(clientContext: unknown): Record<string, unknown> {
        const component = (clientContext as any)?.schemaComponent;
        return typeof component === 'string' && component.length <= 200 ? { ...this.getActionMountContext(), schemaComponent: component } : this.getActionMountContext();
    }
    private async findMountableAction(name: unknown, context: Record<string, unknown> = this.getActionMountContext()): Promise<Action> {
        const action = (await this.getMountableActions(context)).find((a) => a.getName() === name && a.isMountable());
        if (!action) throw new WireError(404, `Action introuvable : ${String(name)}`);
        return action;
    }
    private async actionContext(mounted: { arguments: Record<string, unknown>; context: Record<string, unknown>; data?: Record<string, unknown> }) { return { livewire: this, record: await this.resolveActionRecord(mounted.context), arguments: mounted.arguments, data: emptyToNull(mounted.data ?? {}) }; }
    /** Schéma du formulaire d'une action montée : clé `mountedActionSchema<n>`, état sous `mountedActions.<n>.data` (comme Filament). */
    async getMountedActionSchema(index: number): Promise<Schema | null> {
        const mounted = this.mountedActions[index];
        if (!mounted) return null;
        const action = await this.findMountableAction(mounted.name, mounted.context);
        return action.applySchema(Schema.make(this).key(`mountedActionSchema${index}`).statePath(`mountedActions.${index}.data`).operation(mounted.name).record(await this.resolveActionRecord(mounted.context)));
    }
    private async renderActionModal(index: number): Promise<string> {
        const mounted = this.mountedActions[index];
        return (await this.findMountableAction(mounted.name, mounted.context)).toModalHtml(await this.actionContext(mounted), index, (await (await this.getMountedActionSchema(index))?.toHtml()) ?? null);
    }
    /** Annule un rendu partiel de modale préparé par un champ réactif, quand la même requête exécute ensuite une action. */
    private cancelModalPartialRender(): void {
        for (const name of Object.keys(this._effects.partials ?? {})) if (name.startsWith('action-modals.')) { delete this._effects.partials![name]; this._skipRender = false; }
    }
    /** Champ réactif du formulaire d'une action montée : exécute `afterStateUpdated`, puis ne renvoie que la modale concernée (comme Filament). */
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
    /** Appel, depuis le JavaScript d'un champ, d'une méthode que ce champ expose (ex. recherche d'un Select). Sans rendu. */
    async callSchemaComponentMethod(componentKey: unknown, method: unknown, args: unknown = []): Promise<unknown> {
        if (typeof componentKey !== 'string' || typeof method !== 'string') { this.skipRender(); return null; }
        const name = componentKey.split('.')[0];
        const mountedIndex = /^mountedActionSchema(\d+)$/.exec(name);
        const schema = mountedIndex ? await this.getMountedActionSchema(Number(mountedIndex[1])) : typeof (this as any)[`${name}Schema`] === 'function' ? await this.getSchema(name) : null;
        const component: any = schema?.getFlatComponents().find((c: any) => c.getKey() === componentKey);
        // Seules les méthodes que le composant déclare exposées sont appelables depuis le navigateur.
        if (!component || !component.getExposedMethods().includes(method) || typeof component[method] !== 'function') { this.skipRender(); return null; }
        if (component.isRenderlessMethod(method)) this.skipRender();
        // Arguments nommés (objet), comme les envoie le JavaScript de Filament : passés dans l'ordre de leurs clés.
        return component[method](...(Array.isArray(args) ? args : args && typeof args === 'object' ? Object.values(args) : []));
    }
    /** Une action masquée ne peut être ni montée ni exécutée, même par un appel forgé depuis le navigateur. */
    private async assertActionVisible(action: Action, context: Record<string, unknown> = {}): Promise<void> {
        const record = await this.resolveActionRecord(context);
        if (context.recordKey !== undefined && record === null) throw new WireError(404, 'Enregistrement introuvable');
        const ctx = { livewire: this as any, component: null as any, operation: null, record, get: () => undefined, state: undefined };
        if (!(await action.isVisible(ctx)) || (await action.isDisabled(ctx))) throw new WireError(403, `Action indisponible : ${action.getName()}`);
        // Une action qui mène à une adresse pour cet enregistrement est un lien : elle ne se monte pas.
        if (action.resolveUrl(ctx) !== null) throw new WireError(404, `Action introuvable : ${action.getName()}`);
    }
    private syncActionModals(): void {
        this.dispatch('sync-action-modals', { id: this.id, newActionNestingIndex: this.mountedActions.length ? this.mountedActions.length - 1 : null, shouldOverlayParentActions: false });
    }
    /** Faux pour un composant à table : ses modales sont rendues dans la table (comme Filament). */
    protected rendersActionModalsInPage(): boolean { return true; }
    async renderActionModals(): Promise<string> {
        const modals: string[] = [];
        for (const index of this.mountedActions.keys()) modals.push(await this.renderActionModal(index));
        return `<div wire:partial="action-modals" x-data="filamentActionModals({
                    livewireId: ${js(this.id)},
                })" style="height: 0">${modals.join('')}</div>`;
    }
    /** Monte une action : sans modale elle s'exécute tout de suite ; avec modale, seul le fragment des modales est renvoyé. */
    async mountAction(name: unknown, args: unknown = {}, _context: unknown = {}): Promise<void> {
        this.cancelModalPartialRender();
        const context = this.resolveMountContext(_context);
        const action = await this.findMountableAction(name, context);
        await this.assertActionVisible(action, context);
        const mounted = { name: String(name), arguments: args && typeof args === 'object' ? (args as Record<string, unknown>) : {}, context };
        if (!action.hasModal()) { await action.call(await this.actionContext(mounted)); return; }
        this.mountedActions.push(mounted);
        const schema = await this.getMountedActionSchema(this.mountedActions.length - 1);
        if (schema) {
            // État initial : valeurs par défaut des champs, puis `fillForm()`.
            const data: Record<string, unknown> = {};
            mounted.data = data;
            fillSchema(schema, data);
            const fill = await action.getFormFill(await this.actionContext(mounted));
            if (fill) fillSchemaFromRecord(schema, data, fill);
        }
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
        if (schema) callContext.data = await getSchemaState(schema);
        await action.call(callContext);
        // « … & create another » : la modale reste ouverte sur un formulaire remis à zéro.
        if (schema && _args && typeof _args === 'object' && (_args as any).another === true) {
            const data: Record<string, unknown> = {};
            mounted.data = data;
            fillSchema(schema, data);
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
 * Tableau de bord (port de Filament\Pages\Dashboard) : une grille de widgets, précédée d'un formulaire de filtres
 * quand la page définit `filtersFormSchema(schema)` (port de HasFiltersForm). Les filtres sont passés aux widgets sous `pageFilters`.
 */
export class Dashboard extends Page {
    static slug = '';
    static title = 'Dashboard';
    static navigationIcon = 'o-home';
    static navigationSort = -2;
    /** État du formulaire de filtres. Reste `null` tant que la page n'a pas de filtres. */
    filters: Record<string, unknown> | null = null;
    /** Widgets du tableau de bord. Par défaut : ceux du panel (`panel.widgets([...])`). */
    getWidgets(): (typeof Widget)[] { return this.panel.getWidgets(); }
    /** Colonnes de la grille : un nombre (au point de rupture `lg`), ou un nombre par point de rupture. */
    getColumns(): number | Record<string, number> { return 2; }
    hasFiltersForm(): boolean { return typeof (this as any).filtersFormSchema === 'function'; }
    getSchema(name: string): Schema {
        if (name !== 'filtersForm') return super.getSchema(name);
        // Comme getFiltersForm() : grille 2 / 3 / 4 colonnes, état sous `filters`, champs « live ».
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

/** Limiteur de tentatives en mémoire : `max` essais par fenêtre, par clé. Suffisant pour une instance ; à remplacer par un magasin partagé si le panel tourne sur plusieurs. */
export class Throttle {
    private hits = new Map<string, number[]>();
    private max: number;
    private windowMs: number;
    constructor(max = 5, windowMs = 60_000) { this.max = max; this.windowMs = windowMs; }
    /** Enregistre un essai ; rend 0 s'il est permis, sinon le nombre de secondes à attendre. */
    hit(key: string, now = Date.now()): number {
        const recent = (this.hits.get(key) ?? []).filter((at) => at > now - this.windowMs);
        if (recent.length >= this.max) { this.hits.set(key, recent); return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)); }
        recent.push(now);
        this.hits.set(key, recent);
        // Le magasin ne grossit pas indéfiniment.
        if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (!v.some((at) => at > now - this.windowMs)) this.hits.delete(k);
        return 0;
    }
    clear(key: string): void { this.hits.delete(key); }
}
const loginThrottle = new Throttle();

/** Page à mise en page « simple » (connexion, inscription…). */
export abstract class SimplePage extends BasePage {
    abstract getTitle(): string;
    getHeading(): string | null { return this.getTitle(); }
    /** Sous-titre, en HTML de confiance (composé par la page, données échappées). */
    getSubheading(): string | null { return null; }
    hasLogo(): boolean { return true; }
    async render(): Promise<string> {
        return views.render('filament-panels::pages.simple', { brand: this.panel.getBrand(), heading: this.getHeading(), subheading: this.getSubheading(), hasLogo: this.hasLogo(), content: await this.getSchema('content').toHtml(), livewireId: this.id, renderHookScopes: this.getRenderHookScopes() });
    }
}

/** Gestionnaire de couleurs lu par les autres paquets, partagé par tous les panels ; chaque requête y pose les couleurs de son panel (`Panel.withTheme`). */
const sharedColors = new ColorManager();
/** Lien « fi-link » d'une page d'authentification (port de `Action::make()->link()`). */
function authLink(url: string, label: string, options: { iconName?: string | null; size?: string } = {}): string {
    const classes = ['fi-ac-link-action', 'fi-link', `fi-size-${options.size ?? 'md'}`, ...sharedColors.getComponentClasses('link', 'primary')];
    return `<a href="${e(url)}" class="${classes.join(' ')}" >${options.iconName ? icon(options.iconName) : ''}<span class="fi-link-label"> ${e(label)} </span></a>`;
}
/** Adresse absolue pour un e-mail : celle déclarée par `panel.appUrl()`, sinon l'origine de la requête. */
function absoluteUrl(panel: Panel, req: Request, path: string): string { return `${panel.getAppUrl() ?? `${req.protocol}://${req.get('host')}`}${path}`; }
const registerThrottle = new Throttle(2);
const passwordResetThrottle = new Throttle(2);
const verificationThrottle = new Throttle(2);
const throttled = (group: string, wait: number) => Notification.make().danger().title(t(`${group}.notifications.throttled.title`, { seconds: wait, minutes: Math.ceil(wait / 60) })).body(t(`${group}.notifications.throttled.body`, { seconds: wait, minutes: Math.ceil(wait / 60) })).send();
/** Règles de mot de passe de Laravel (`Password::default()` : 8 caractères au moins) et de confirmation (`same`). */
const passwordRules = (confirmationField: string, confirmationLabel: string) => [
    { name: 'min', passes: (value: unknown) => String(value).length >= 8, message: (attribute: string) => `The ${attribute} field must be at least 8 characters.` },
    { name: 'same', passes: (value: unknown, ctx: any) => value === ctx.get(confirmationField), message: (attribute: string) => `The ${attribute} field must match ${confirmationLabel}.` },
];
/** E-mail de vérification de l'adresse (texte de la notification `VerifyEmail` de Laravel). */
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

/** Inscription (port de Filament\Auth\Pages\Register) : nom, adresse, mot de passe confirmé ; l'utilisateur est connecté, puis invité à vérifier son adresse si le panel l'exige. */
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
    /** Données validées, juste avant la création (ajouter une valeur, normaliser l'adresse…). */
    protected mutateFormDataBeforeRegister(data: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> { return data; }
    /** Création de l'utilisateur : par défaut `create()` du fournisseur d'utilisateurs. */
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

/** Demande de réinitialisation du mot de passe (port de RequestPasswordReset) : un lien signé, valable 60 minutes, part par e-mail. */
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
        // Écart de sécurité assumé : Filament (via Laravel) répond « adresse inconnue » quand aucun compte n'existe, ce qui
        // révèle quelles adresses sont inscrites. Navette répond toujours de la même façon.
        Notification.make().success().title('We have emailed your password reset link.').body(t('filament-panels::auth/pages/password-reset/request-password-reset.notifications.sent.body')).send();
        this.data = {};
        fillSchema(form, this.data);
    }
}

/** Nouveau mot de passe, depuis le lien reçu par e-mail (port de ResetPassword). Le lien ne sert qu'une fois : il meurt avec l'ancien mot de passe. */
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
    /** Comme Filament : le formulaire n'a pas de chemin d'état, ses champs sont des propriétés de la page. */
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
        // Le jeton désigne l'utilisateur ; l'adresse de l'URL doit être la sienne et son mot de passe ne doit pas avoir changé depuis l'envoi.
        if (!payload || !user || user.email !== this.email || (await auth.getPasswordFingerprint!(user)) !== payload.fp) {
            Notification.make().danger().title('This password reset token is invalid.').send();
            return;
        }
        await auth.update!(user, { password: this.password });
        Notification.make().success().title('Your password has been reset.').send();
        this.redirect(panel.getLoginUrl());
    }
}

/** Invitation à vérifier son adresse (port de EmailVerificationPrompt), avec le lien « Resend it. ». */
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
    /** Seule action de la page : renvoyer l'e-mail (deux fois par minute au plus). */
    async mountAction(name: unknown): Promise<void> {
        const { req, panel, user } = this._ctx as PanelContext;
        if (name !== 'resendNotification' || !user) throw new WireError(404, 'Action introuvable.');
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

/** Profil de l'utilisateur (port de EditProfile) : nom, adresse, nouveau mot de passe ; le mot de passe actuel est exigé pour changer l'adresse ou le mot de passe. */
export class EditProfile extends SimplePage {
    static callable = ['save', 'callSchemaComponentMethod'];
    static slug = 'profile';
    data: Record<string, unknown> = {};
    static getLabel(): string { return t('filament-panels::auth/pages/edit-profile.label'); }
    async mount(): Promise<void> {
        const { user } = this._ctx as PanelContext;
        if (!user) throw new WireError(401, 'Non authentifié.');
        this.data = { name: user.name, email: user.email, password: null, passwordConfirmation: null, currentPassword: null };
    }
    async boot(): Promise<void> { if (!(this._ctx as PanelContext | null)?.user) throw new WireError(401, 'Non authentifié.'); }
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
        if (!user) throw new WireError(401, 'Non authentifié.');
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

/** Création d'un locataire (port de RegisterTenant) : la sous-classe donne son libellé et son formulaire (`formSchema`). */
export abstract class RegisterTenant extends SimplePage {
    static callable = ['register', 'callSchemaComponentMethod'];
    static slug = 'new';
    data: Record<string, unknown> = {};
    static getLabel(): string { return 'Register tenant'; }
    /** Le panel accepte-t-il la création ? Par défaut : si le fournisseur de locataires sait créer. */
    static canView(panel: Panel, _user: User): boolean | Promise<boolean> { return typeof panel.getTenantProvider().create === 'function'; }
    async boot(): Promise<void> {
        const ctx = this._ctx as PanelContext | null;
        if (!ctx?.user) throw new WireError(401, 'Non authentifié.');
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

/** Profil du locataire courant (port de EditTenantProfile), dans la mise en page complète. */
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
            // Formulaire de défi multi-facteur : masqué tant que la MFA n'est pas portée (jalon 7).
            Form.make([]).id('multiFactorChallengeForm').hidden(),
            RenderHook.make(PanelsRenderHook.AUTH_LOGIN_FORM_AFTER),
        ]);
    }

    async authenticate(): Promise<void> {
        this._errors = await validateSchema(this.getSchema('form'));
        if (Object.keys(this._errors).length) { this.dispatch('form-validation-error', { livewireId: this.id }); return; }
        const { req, res, panel } = this._ctx as PanelContext;
        // Comme Filament : cinq tentatives par minute et par adresse IP, puis attente.
        const wait = loginThrottle.hit(`${panel.getId()}:${req.ip ?? ''}`);
        if (wait > 0) {
            Notification.make().danger().title(t('filament-actions::notifications.throttled.title', { seconds: wait, minutes: Math.ceil(wait / 60) })).body(t('filament-actions::notifications.throttled.body', { seconds: wait, minutes: Math.ceil(wait / 60) })).send();
            return;
        }
        const user = await panel.getAuth().attempt(String(this.data.email), String(this.data.password));
        if (!user) { this.addError('data.email', t('filament-panels::auth/pages/login.messages.failed')); return; }
        loginThrottle.clear(`${panel.getId()}:${req.ip ?? ''}`);
        panel.logIn(res, user, Boolean(this.data.remember));
        this.redirect(panel.getUrl());
    }
}

/** L'utilisateur du composant hôte a-t-il cette capacité sur la resource (ou le relation manager) du composant ? À utiliser dans `authorize()` de vos actions. */
export const can = (livewire: unknown, ability: string, record: unknown = null): Promise<boolean> | boolean => canOn(livewire, ability, record);
function canOn(livewire: any, ability: string, record: unknown = null): Promise<boolean> | boolean {
    const resource = livewire?.resource;
    return typeof resource?.can === 'function' ? resource.can(ability, livewire._ctx?.user ?? null, record) : true;
}



// ------------------------------------------------------------------ resources
const plural = (s: string) => (/[^aeiou]y$/.test(s) ? s.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/.test(s) ? s + 'es' : s + 's');
const ucfirst = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** Resource : un modèle, ses pages, sa table et sa navigation (port partiel de Filament\Resources\Resource). */
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
    /** Dans un panel à locataires : les enregistrements sont-ils propres à chaque locataire ? (vrai par défaut, comme Filament) */
    static isScopedToTenant = true;
    /** Colonne du locataire pour cette resource (par défaut celle du panel : `panel.tenant(provider, { ownershipColumn })`). */
    static tenantOwnershipColumn: string | null = null;
    /**
     * Pages de la resource, à remplacer par vos sous-classes pour en changer le comportement :
     * `static pages = { index: MyList, create: MyCreate, edit: MyEdit }`.
     */
    static pages: { index?: typeof ListRecords; create?: typeof CreateRecord; edit?: typeof EditRecord; view?: typeof ViewRecord } = {};
    /** Page de consultation (`ViewRecord`) : vrai pour l'ajouter aux pages de la resource ; la ligne d'une table y mène alors, comme dans Filament. */
    static hasViewPage = false;
    /** Qui peut faire quoi sur cette resource. Sans politique, tout utilisateur connecté peut tout. */
    static policy: Policy | null = null;
    /** L'utilisateur a-t-il cette capacité (sur cet enregistrement, s'il y en a un) ? */
    static can(ability: string, user: User | null, record: unknown = null): Promise<boolean> {
        const rule = this.policy?.[ability];
        return this.panel.authorize(user, ability, { resource: this, record, rule: rule ? () => rule(user!, record) : null });
    }
    /** Widgets de la resource (équivalent de getWidgets()) : enregistrés comme composants. */
    static widgets: (typeof Widget)[] = [];
    /** Widgets affichés au-dessus de la table de la page de liste (équivalent de ListRecords::getHeaderWidgets()). */
    static headerWidgets: (typeof Widget)[] = [];
    /** Relation managers affichés sous le formulaire d'édition (équivalent de getRelations()). */
    static relations: any[] = [];
    /** Onglets de la page de liste (équivalent de ListRecords::getTabs()). */
    static tabs(): Record<string, Tab> { return {}; }
    /** Resource « simple » (équivalent de ManageRecords) : une seule page, création et édition en modales. */
    static isSimple = false;

    static getPluralModelLabel(): string { return this.pluralModelLabel ?? plural(this.modelLabel); }
    static getTitleCasePluralModelLabel(): string { return this.getPluralModelLabel().split(' ').map(ucfirst).join(' '); }
    static getUrl(page: string = 'index', record?: string | number): string {
        const base = this.panel.getUrl(this.slug);
        if (page in this.relatedPages) return `${base}/${record}/${page}`;
        return page === 'index' ? base : page === 'create' ? `${base}/create` : page === 'view' ? `${base}/${record}` : `${base}/${record}/edit`;
    }
    /** Pages d'enregistrements liés (port de ManageRelatedRecords) : `{ comments: ManagePostComments }` répond sous `<slug>/{record}/comments`. */
    static relatedPages: Record<string, typeof ManageRelatedRecords> = {};
    /** Pages proposées dans la sous-navigation d'un enregistrement, dans l'ordre : `['view', 'edit', 'comments']`. Vide : pas de sous-navigation. */
    static recordSubNavigation: string[] = [];
    /** Port de getRecordSubNavigation() + generateNavigationItems() : un onglet par page déclarée, celui de la page courante actif. */
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
    /** Classe de page réellement enregistrée pour un nom (les pages sont générées une seule fois par resource). */
    static getRegisteredPage(name: string): typeof Page | undefined { return (this.getPages() as Record<string, typeof Page>)[name]; }
    static table(table: Table): Table { return table; }
    static form(schema: Schema): Schema { return schema; }
    /** Schéma de la page de consultation (équivalent de `infolist()`). */
    static infolist(schema: Schema): Schema { return schema; }

    // -------------------------------------------------------------- recherche globale
    /** Colonnes interrogées par la recherche globale ; par défaut, l'attribut de titre. Tableau vide : resource non cherchable. */
    static globallySearchableAttributes: string[] | null = null;
    static getGloballySearchableAttributes(): string[] { return this.globallySearchableAttributes ?? (this.recordTitleAttribute ? [this.recordTitleAttribute] : []); }
    static canGloballySearch(): boolean { return this.getGloballySearchableAttributes().length > 0; }
    /** Rang du groupe de cette resource dans les résultats (`$globalSearchSort`) ; sans rang : après les autres, dans l'ordre d'enregistrement. */
    static globalSearchSort: number | null = null;
    /** Nombre de résultats rendus par resource (50, comme Filament). */
    static globalSearchResultsLimit = 50;
    static getGlobalSearchResultTitle(record: any): string { return this.getRecordTitle(record); }
    /** Précisions affichées sous le titre : `{ Author: 'Jane' }`. Les valeurs vides sont écartées. */
    static getGlobalSearchResultDetails(_record: any): Record<string, unknown> | Promise<Record<string, unknown>> { return {}; }
    /** Adresse d'un résultat : page « View », sinon édition ; pour une resource simple, la liste avec l'action ouverte. Nul si l'utilisateur n'a aucun accès. */
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

    /** Attribut affiché comme titre d'un enregistrement (`$recordTitleAttribute`). */
    static recordTitleAttribute: string | null = null;
    /** Sans attribut de titre : le libellé du modèle, en capitales initiales (« Leave Request »), comme Filament. */
    static getRecordTitle(record: any): string { return this.recordTitleAttribute ? String(record?.[this.recordTitleAttribute] ?? '') : this.modelLabel.split(' ').map(ucfirst).join(' '); }

    /** Pages de la resource, générées : liste, création, édition. */
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

// ------------------------------------------------------------------ widgets
/** Onglet de sous-navigation d'une page. */
export type SubNavigationItem = { label: string; icon: string | null; url: string; active: boolean };
type ColumnSpan = number | 'full';
/** Widget : composant affiché dans une grille de page (port de Filament\Widgets\Widget). */
export abstract class Widget extends Component {
    static componentName: string;
    /** Largeur dans la grille de widgets : un nombre de colonnes, ou `'full'`. */
    static columnSpan: ColumnSpan = 1;
    /** Chargé quand il devient visible (comme `$isLazy`). */
    static isLazy = true;
    get panel(): Panel { return (this._ctx as PanelContext).panel; }
    /** Widget réservé à certains utilisateurs : rendre `false` le retire de la page et refuse son chargement. */
    static canView(_user: User): boolean | Promise<boolean> { return true; }
    async boot(): Promise<void> {
        const ctx = this._ctx as PanelContext | null;
        if (!ctx?.user) throw new WireError(401, 'Non authentifié.');
        const WidgetClass = this.constructor as typeof Widget;
        if (!(await ctx.panel.authorize(ctx.user, 'view', { widget: WidgetClass, rule: () => WidgetClass.canView(ctx.user!) }))) throw new WireError(403, 'Accès refusé.');
    }
    /** Classes et style de colonne de grille, au point de rupture `lg` comme Filament. */
    protected gridColumn(): { classes: string[]; style: string } {
        const span = (this.constructor as typeof Widget).columnSpan;
        // Comme Filament : la portée est toujours écrite, même pour une seule colonne.
        return { classes: ['fi-grid-col', 'lg:fi-grid-col-span'], style: `--col-span-lg: ${span === 'full' ? '1 / -1' : `span ${Math.floor(span)} / span ${Math.floor(span)}`};` };
    }
    placeholder(): string {
        const column = this.gridColumn();
        return `<div role="status" aria-busy="true" style="height: 8rem; ${column.style}" class="${cls(['fi-section', 'fi-loading-section', ...column.classes])}"><span class="fi-sr-only">${e(t('filament::components/loading-section.label'))}</span></div>`;
    }
    /** Enveloppe commune (port de filament-widgets::components.widget). */
    protected wrap(content: string, classes: string[] = []): string {
        const column = this.gridColumn();
        return `<div${column.style ? ` style="${column.style}"` : ''} class="${cls(['fi-wi-widget', ...column.classes, ...classes])}">${content}</div>`;
    }
}

/**
 * Calendrier (propre à Navette) : vues mois, semaine et liste, navigation rendue par le serveur, sans bibliothèque JavaScript.
 *
 * Le minimum : étendre la classe et rendre les événements de la période affichée.
 *
 *     class LeaveCalendar extends CalendarWidget {
 *         static heading = 'Leave';
 *         async getEvents({ start, end }) { return [{ id: 1, title: 'Ada — vacation', start: '2026-11-12', end: '2026-11-14', color: 'success' }]; }
 *     }
 *
 * Tout le reste se redéfinit méthode par méthode : vues proposées, premier jour de la semaine, langue, libellés, nombre
 * d'événements par case, réaction au clic sur un jour (`onDateClick`) ou sur un événement (`onEventClick`), rendu d'un
 * événement (`renderEvent`), pied de case (`renderDayFooter`), boutons de la barre d'outils (`renderToolbarEnd`), et
 * l'apparence par les variables CSS de `.nv-cal` (`getExtraClasses`, `getStyle`).
 */
export abstract class CalendarWidget extends Widget {
    static columnSpan: ColumnSpan = 'full';
    /** Titre affiché avant la période (« Leave — November 2026 »). */
    static heading: string | null = null;
    static callable = ['previousPeriod', 'nextPeriod', 'goToToday', 'setView', 'selectDate', 'selectEvent', 'showDay'];
    /** La vue et la date ne changent que par les méthodes ci-dessous, qui les valident. */
    static locked = ['view', 'date'];
    view: CalendarView = 'month';
    /** Date d'ancrage (`YYYY-MM-DD`) : le mois ou la semaine affichés la contiennent. Vide : aujourd'hui. */
    date = '';

    // ---------------------------------------------------------- à redéfinir
    /** Événements dont une partie tombe entre `start` et `end` (inclus, `YYYY-MM-DD`). Appelée à chaque rendu : filtrez en base. */
    abstract getEvents(range: { start: string; end: string; view: CalendarView }): CalendarEvent[] | Promise<CalendarEvent[]>;
    /** Vues proposées, la première étant celle d'arrivée. Une seule vue : le sélecteur disparaît. */
    getViews(): CalendarView[] { return ['month', 'week', 'list']; }
    /** 0 = dimanche, 1 = lundi… */
    getFirstDayOfWeek(): number { return 1; }
    /** Langue des noms de mois et de jours (`Intl`). */
    getLocale(): string { return 'en-US'; }
    getLabels(): CalendarLabels { return CALENDAR_LABELS; }
    /** En vue mois, au-delà de ce nombre, la case affiche « +N more » (qui ouvre la liste sur ce jour). */
    getMaxEventsPerDay(): number { return 3; }
    getHeading(): string | null { return (this.constructor as typeof CalendarWidget).heading; }
    /** Date du jour, `YYYY-MM-DD` (UTC par défaut ; à redéfinir pour un autre fuseau). */
    getToday(): string { return new Date().toISOString().slice(0, 10); }
    /** Clic sur un numéro de jour. Redéfinir cette méthode rend les jours cliquables : ouvrir une page (`this.redirect`), notifier, changer de vue… */
    onDateClick(_date: string): void | Promise<void> {}
    /** Clic sur un événement sans adresse. L'événement est relu côté serveur : `event.extra` est disponible. */
    onEventClick(_event: CalendarEvent): void | Promise<void> {}
    /** HTML d'un événement (déjà échappé), ou `null` pour le rendu par défaut (`renderCalendarEvent`). */
    renderEvent(_event: CalendarEvent, _context: { day: string; view: CalendarView }): string | null { return null; }
    /** HTML ajouté au bas de chaque case (déjà échappé). */
    renderDayFooter(_day: string, _events: CalendarEvent[]): string { return ''; }
    /** HTML placé à droite de la barre d'outils (déjà échappé) : un lien « New », un filtre… */
    renderToolbarEnd(): string { return ''; }
    /** Classes ajoutées au calendrier, pour y accrocher vos styles ou redéfinir ses variables CSS. */
    getExtraClasses(): string[] { return []; }
    /** Variables CSS posées sur le calendrier : `{ '--nv-cal-day-min-height': '9rem' }`. */
    getStyle(): Record<string, string> { return {}; }

    // ---------------------------------------------------------- navigation
    private anchor(): string { return isDate(this.date) ? this.date : this.getToday(); }
    private currentView(): CalendarView { const views = this.getViews().filter((view) => CALENDAR_VIEWS.includes(view)); return views.includes(this.view) ? this.view : (views[0] ?? 'month'); }
    private shift(direction: 1 | -1): void { this.date = this.currentView() === 'week' ? addDays(this.anchor(), 7 * direction) : addMonths(this.anchor().slice(0, 8) + '01', direction); }
    previousPeriod(): void { this.shift(-1); }
    nextPeriod(): void { this.shift(1); }
    goToToday(): void { this.date = this.getToday(); }
    setView(view: unknown): void { if (typeof view === 'string' && (this.getViews() as string[]).includes(view) && (CALENDAR_VIEWS as string[]).includes(view)) this.view = view as CalendarView; }
    /** « +N more » : la liste, ancrée sur ce jour (ou la semaine si la liste n'est pas proposée). */
    showDay(date: unknown): void {
        if (!isDate(date)) return;
        this.date = date;
        const views = this.getViews();
        this.view = views.includes('list') ? 'list' : views.includes('week') ? 'week' : this.currentView();
    }
    private datesClickable(): boolean { return this.onDateClick !== CalendarWidget.prototype.onDateClick; }
    private eventsClickable(): boolean { return this.onEventClick !== CalendarWidget.prototype.onEventClick; }
    async selectDate(date: unknown): Promise<void> { if (isDate(date) && this.datesClickable()) await this.onDateClick(date); }
    /** L'identifiant vient du navigateur : l'événement est recherché parmi ceux de la période affichée, jamais cru sur parole. */
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
 * Page calendrier (propre à Navette) : le même calendrier que `CalendarWidget`, sur une page entière, avec les actions de
 * Filament — donc des modales, des formulaires, des confirmations, des panneaux latéraux.
 *
 *     class Planning extends CalendarPage {
 *         static slug = 'planning';
 *         async getEvents({ start, end }) { return db('shifts').where('day', '>=', start).where('day', '<=', end)… }
 *         // Clic sur un jour : une modale avec un formulaire, prérempli avec la date.
 *         dateAction() {
 *             return Action.make('createShift').modalHeading('New shift')
 *                 .schema([Select.make('employee_id').options(…).required(), DatePicker.make('day').required()])
 *                 .fillForm(({ arguments: args }) => ({ day: CalendarPage.dateOf(args) }))
 *                 .action(async ({ data }) => { await db('shifts').insert(data); Notification.make().success().title('Saved').send(); });
 *         }
 *         // Clic sur un événement : une autre action ; l'événement est relu côté serveur.
 *         eventAction() {
 *             return Action.make('editShift').schema([…])
 *                 .fillForm(async ({ livewire, arguments: args }) => (await livewire.findEvent(args.event))?.extra ?? {})
 *                 .action(async ({ livewire, arguments: args, data }) => { const event = await livewire.findEvent(args.event); if (event) await db('shifts').where({ id: event.id }).update(data); });
 *         }
 *     }
 *
 * Trois façons de réagir à un clic, au choix : une **adresse** sur l'événement (`url` : page dédiée), une **action** (modale),
 * ou du **code libre** en redéfinissant `onDateClick()` / `onEventClick()` (rediriger, notifier, écrire en base, monter l'action
 * de son choix avec `this.mountAction(nom, arguments)`). `getHeaderActions()` ajoute des boutons en tête de page, et
 * `getCalendarActions()` déclare d'autres actions montables depuis votre propre rendu (`renderEvent`, `renderToolbarEnd`).
 */
export abstract class CalendarPage extends Page {
    static callable = ['mountAction', 'unmountAction', 'callMountedAction', 'callSchemaComponentMethod', 'previousPeriod', 'nextPeriod', 'goToToday', 'setView', 'selectDate', 'selectEvent', 'showDay'];
    static locked = ['view', 'date'];
    view: CalendarView = 'month';
    date = '';

    // ---------------------------------------------------------- à redéfinir (mêmes réglages que CalendarWidget)
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
    /** Action ouverte au clic sur un jour ; elle reçoit `arguments.date`. Nul : les jours ne sont pas cliquables (sauf `onDateClick` redéfini). */
    dateAction(): Action | null { return null; }
    /** Action ouverte au clic sur un événement sans adresse ; elle reçoit `arguments.event` (identifiant, à relire avec `findEvent`). */
    eventAction(): Action | null { return null; }
    /** Autres actions montables depuis votre propre HTML : `wire:click="mountAction('nom', { … })"`. */
    getCalendarActions(): Action[] { return []; }
    /** Par défaut : ouvre `dateAction()`. À redéfinir pour faire autre chose (rediriger vers une page de création, par exemple). */
    async onDateClick(date: string): Promise<void> { const action = this.dateAction(); if (action) await this.mountAction(action.getName(), { date }); }
    /** Par défaut : ouvre `eventAction()`. L'événement a été retrouvé côté serveur avant l'appel. */
    async onEventClick(event: CalendarEvent): Promise<void> { const action = this.eventAction(); if (action) await this.mountAction(action.getName(), { event: String(event.id) }); }

    /** Date d'un clic, relue dans les arguments d'une action : ils viennent du navigateur, seule une vraie date est rendue. */
    static dateOf(args: Record<string, unknown> | null | undefined): string | null { return isDate(args?.date) ? (args!.date as string) : null; }
    /** Événement de la période affichée portant cet identifiant, ou nul : ne jamais agir sur un identifiant reçu sans passer par ici. */
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

/** Section sans en-tête des widgets fournis (port de `<x-filament::section>`). */
const widgetSection = (content: string) => `<section x-data="{
        isCollapsed:  false ,
    }" class="fi-section"><div class="fi-section-content-ctn"><div class="fi-section-content">${content}</div></div></section>`;

/** Compte de l'utilisateur connecté : avatar, nom, déconnexion (port de Filament\Widgets\AccountWidget). */
export class AccountWidget extends Widget {
    static isLazy = false;
    render(): string {
        const { req, res, panel, user } = this._ctx as PanelContext;
        const logout = t('filament-panels::widgets/account-widget.actions.logout.label');
        const loading = 'wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled"';
        return this.wrap(widgetSection(`<img alt="${e(t('filament-panels::layout.avatar.alt', { name: user!.name }))}" class="fi-avatar fi-circular fi-size-lg fi-user-avatar" src="${e(panel.getUserAvatarUrl(user!))}" loading="lazy" /><div class="fi-account-widget-main"><h2 class="fi-account-widget-heading">${e(t('filament-panels::widgets/account-widget.welcome'))}</h2><p class="fi-account-widget-user-name">${e(user!.name)}</p></div><form action="${e(panel.getLogoutUrl())}" method="post" class="fi-account-widget-logout-form"><input type="hidden" name="_token" value="${e(csrfToken(req, res))}" autocomplete="off"><button class="fi-icon-btn fi-size-md" title="${e(logout)}" aria-label="${e(logout)}" type="submit" ${loading}>${icon('m-arrow-left-end-on-rectangle')}</button><button class="fi-btn fi-size-md fi-labeled-from-sm" type="submit" ${loading}>${icon('m-arrow-left-end-on-rectangle')}${e(logout)}</button></form>`), ['fi-account-widget']);
    }
}

/** Version de Navette et liens utiles (pendant de Filament\Widgets\FilamentInfoWidget, dont il reprend le balisage et les classes). */
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

/** Propriétés de table qu'une page de liste expose à ses widgets (port de InteractsWithPageTable / ExposesTableToWidgets). */
const PAGE_TABLE_PROPERTIES = ['activeTab', 'paginators', 'tableColumnSearches', 'tableFilters', 'tableRecordsPerPage', 'tableSearch', 'tableSort'];

/** Une statistique d'un StatsOverviewWidget (port de Stat). */
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
    /** Couleur de la description et de la courbe. */
    color(color: string | null): this { this._color = color; return this; }
    icon(name: string | null): this { this._icon = name; return this; }
    /** Courbe de tendance : une liste de valeurs, ou des valeurs par libellé. */
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

/** Rangée de statistiques (port de StatsOverviewWidget). */
export abstract class StatsOverviewWidget extends Widget {
    static columnSpan: ColumnSpan = 'full';
    /** Intervalle de rafraîchissement (`'5s'` dans Filament par défaut), ou null pour ne pas rafraîchir. */
    static pollingInterval: string | null = '5s';
    abstract getStats(): Stat[] | Promise<Stat[]>;
    /** Colonnes de la rangée : comme Filament, trois, ou quatre quand le nombre de statistiques s'y prête. */
    protected getColumns(count: number): number { return count < 3 ? 3 : count % 3 !== 1 ? 3 : 4; }
    async render(): Promise<string> {
        const stats = await this.getStats();
        const columns = this.getColumns(stats.length);
        const anonymous = `x-data="filamentSchemaComponent(${e(js({ key: null, exposedMethods: [], path: '', containerPath: '' }))})"`;
        // Comme Filament : une statistique à courbe reçoit un identifiant (`stats-overview-stat-<n>`), donc une clé de composant ; les autres restent anonymes.
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

/** Données d'un graphique, au format de Chart.js : `{ datasets: [{ label, data, … }], labels: [...] }`. */
export type ChartData = { datasets?: Record<string, unknown>[]; labels?: unknown[]; [key: string]: unknown };

/**
 * Graphique Chart.js (port de Filament\Widgets\ChartWidget). Une sous-classe donne `getType()` (`'line'`, `'bar'`, `'pie'`,
 * `'doughnut'`, `'radar'`, `'polarArea'`, `'scatter'`, `'bubble'`) et `getData()`. Le rendu est fait dans le navigateur par le
 * composant `chart.js` de Filament ; le serveur n'envoie de nouvelles données que si elles ont changé (somme de contrôle).
 */
export abstract class ChartWidget extends Widget {
    static callable = ['updateChartData'];
    static locked = ['dataChecksum'];
    /** Intervalle de rafraîchissement (`'5s'` par défaut dans Filament), ou null pour ne pas rafraîchir. */
    static pollingInterval: string | null = '5s';
    static heading: string | null = null;
    static description: string | null = null;
    /** Couleur des séries qui n'en précisent pas. */
    static color = 'primary';
    /** Hauteur maximale du graphique (`'300px'`). */
    static maxHeight: string | null = null;
    static isCollapsible = false;
    dataChecksum: string | null = null;
    /** Filtre choisi, parmi `getFilters()`. */
    filter: string | null = null;
    private _cachedData: ChartData | null = null;

    abstract getType(): string;
    getData(): ChartData | Promise<ChartData> { return {}; }
    /** Options de Chart.js. */
    getOptions(): Record<string, unknown> | null { return null; }
    /** Filtres proposés dans l'en-tête : valeur vers libellé. */
    getFilters(): Record<string, string> | null { return null; }
    getHeading(): string | null { return (this.constructor as typeof ChartWidget).heading; }
    getDescription(): string | null { return (this.constructor as typeof ChartWidget).description; }
    getColor(): string { return (this.constructor as typeof ChartWidget).color; }
    getMaxHeight(): string | null { return (this.constructor as typeof ChartWidget).maxHeight; }
    /** Texte lu par les lecteurs d'écran à la place du graphique. */
    getChartAssistiveContent(): string | null { return null; }
    protected async getCachedData(): Promise<ChartData> { return (this._cachedData ??= await this.getData()); }
    protected async generateDataChecksum(): Promise<string> { return createHash('md5').update(JSON.stringify(await this.getCachedData())).digest('hex'); }
    async mount(): Promise<void> { this.dataChecksum = await this.generateDataChecksum(); }
    /** Appelé par le rafraîchissement périodique et avant chaque rendu : n'émet les données que si elles ont changé. */
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
 * Table dans un widget (port de Filament\Widgets\TableWidget) : recherche, tri, pagination simple (précédent / suivant).
 * Une sous-classe donne `table(table)` et `getDataAdapterForTable()`. Pas d'actions ni de filtres pour l'instant.
 */
export abstract class TableWidget extends Widget implements TableHost {
    static columnSpan: ColumnSpan = 'full';
    static callable = ['sortTable', 'gotoPage', 'nextPage', 'previousPage', 'applyTableColumnManager', 'resetTableColumnManager'];
    /** Titre de la table ; par défaut tiré du nom de la classe (`FlaggedOrders` : « Flagged Orders »). */
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

/** Widgets qui reçoivent les filtres du tableau de bord (port de InteractsWithPageFilters) : `static reactive = PAGE_FILTERS` et une propriété `pageFilters`. */
export const PAGE_FILTERS = ['pageFilters'];

/**
 * Widget de statistiques lié à la table d'une page de liste (port de InteractsWithPageTable) : il reçoit l'état de la table
 * (recherche, filtres, onglet…) et peut agréger exactement les enregistrements qu'elle affiche.
 */
export abstract class PageTableStatsWidget extends StatsOverviewWidget {
    /** Page de liste dont la table est observée (équivalent de getTablePage()). */
    static tablePage: () => typeof ListRecords;
    static reactive = PAGE_TABLE_PROPERTIES;
    activeTab: string | null = null;
    paginators: Record<string, number> = { page: 1 };
    tableColumnSearches: Record<string, string> = {};
    tableFilters: Record<string, FilterState> = {};
    tableRecordsPerPage = 10;
    tableSearch = '';
    tableSort: string | null = null;
    /** Agrégats sur la requête courante de la table. L'état reçu passe par la même validation que sur la page. */
    protected async aggregatePageTable(columns: { sum?: string[]; avg?: string[] } = {}, modify: ((query: any) => void) | null = null): Promise<{ count: number; sum: Record<string, number>; avg: Record<string, number> }> {
        const PageClass = (this.constructor as typeof PageTableStatsWidget).tablePage();
        const page = new PageClass();
        for (const property of PAGE_TABLE_PROPERTIES) (page as any)[property] = (this as any)[property];
        const query = getTableQuery(page.getTable(), page);
        // Restriction supplémentaire propre à une statistique (« parmi les lignes affichées, celles qui… »).
        if (modify) (query.modifiers ??= []).push(modify);
        return PageClass.resource.adapter.aggregate(query, columns);
    }
    /** Tendance mensuelle sur la requête courante de la table (voir `ObjectionAdapter.trendPerMonth`). */
    protected async trendPageTable(options: { start: Date; end: Date; dateColumn?: string; average?: string; modify?: (query: any) => void }): Promise<number[]> {
        const PageClass = (this.constructor as typeof PageTableStatsWidget).tablePage();
        const page = new PageClass();
        for (const property of PAGE_TABLE_PROPERTIES) (page as any)[property] = (this as any)[property];
        return (PageClass.resource.adapter as any).trendPerMonth(getTableQuery(page.getTable(), page), options);
    }
}

/** Composant de schéma qui intègre la table du composant hôte (port de EmbeddedTable). */
export class EmbeddedTable extends SchemaComponent {
    static make(): EmbeddedTable { return new EmbeddedTable(); }
    async toHtml(): Promise<string> { return (this.livewire as unknown as ListRecords).renderTable(); }
}
/** Onglets des relation managers d'une page d'édition : seul le manager de l'onglet actif est monté, en composant enfant « lazy » (port de RelationManagers + Tabs). */
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
                const childKey = `${key}.${index}.${(manager as any).componentName}`;
                const child = await page.mountChild((manager as any).componentName, { ownerRecord: page.recordKey }, `${id}.${childKey}`, { lazy: true });
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
/** Onglet d'une page de liste : restreint la requête de la table et peut afficher un compteur (port de Tab). */
export class Tab {
    private _label: string | null;
    private _badge: (() => number | string | null | Promise<number | string | null>) | null = null;
    private _badgeColor = 'primary';
    private _hasBadgeColor = false;
    private _query: ((query: any) => void) | null = null;
    constructor(label: string | null = null) { this._label = label; }
    static make(label: string | null = null): Tab { return new Tab(label); }
    /** Compteur, calculé après l'affichage de la page (comme `lazyLoadedBadge()`). */
    badge(resolver: () => number | string | null | Promise<number | string | null>): this { this._badge = resolver; return this; }
    badgeColor(color: string): this { this._badgeColor = color; this._hasBadgeColor = true; return this; }
    query(modifier: (query: any) => void): this { this._query = modifier; return this; }
    getLabel(key: string): string { return this._label ?? ucfirst(key.replace(/[_-]+/g, ' ')); }
    hasBadge(): boolean { return this._badge !== null; }
    async getBadge(): Promise<number | string | null> { return this._badge ? this._badge() : null; }
    getBadgeColor(): string { return this._badgeColor; }
    /** Faux tant que `badgeColor()` n'a pas été appelé : un badge chargé après coup ne reçoit alors aucune classe de couleur, comme dans Filament. */
    hasBadgeColor(): boolean { return this._hasBadgeColor; }
    getQuery(): ((query: any) => void) | null { return this._query; }
}

/** Onglets de la page de liste (port de ResourceTabs) : masqués quand la page n'en déclare pas. */
class ResourceTabs extends SchemaComponent {
    constructor() { super(); this._keyName = 'resourceTabs'; this._hidden = ({ livewire }) => Object.keys((livewire as any).getTabs()).length === 0; }
    getExposedMethods(): string[] { return ['getLazyLoadedTabBadges', 'getDeferredTabBadges']; }
    getDeferredTabBadges(): Record<string, unknown> { return {}; }
    /** Compteurs des onglets, demandés par le navigateur une fois la page affichée. */
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

/** Page de liste d'une resource : état de table et méthodes appelées par le navigateur (port de ListRecords + InteractsWithTable). */
export class ListRecords extends Page implements TableHost {
    static callable = ['updateTableColumnState', 'sortTable', 'gotoPage', 'nextPage', 'previousPage', 'applyTableFilters', 'resetTableFiltersForm', 'removeTableFilters', 'removeTableFilter', 'applyTableColumnManager', 'resetTableColumnManager', 'toggleTableReordering', 'reorderTable'];
    static resource: typeof Resource;
    tableSearch = '';
    tableSort: string | null = null;
    tableColumnSearches: Record<string, string> = {};
    tableRecordsPerPage = 10;
    paginators: Record<string, number> = { page: 1 };
    // Sélection : tenue par le navigateur, envoyée avec l'appel de l'action groupée (port de CanSelectRecords).
    selectedTableRecords: string[] = [];
    deselectedTableRecords: string[] = [];
    isTrackingDeselectedTableRecords = false;
    // Filtres : `tableDeferredFilters` est l'état du formulaire, `tableFilters` l'état appliqué (filtres différés, comme Filament par défaut).
    tableFilters: Record<string, FilterState> = {};
    tableDeferredFilters: Record<string, FilterState> = {};
    tableColumns: ColumnState[] = [];
    isTableReordering = false;
    /** Regroupement courant de la table (`identifiant:direction`), choisi dans la barre d'outils. */
    tableGrouping: string | null = null;
    updatedTableGrouping(): void { this.paginators.page = 1; }
    /** Entre dans le mode « tri manuel » ou en sort (port de toggleTableReordering). */
    async toggleTableReordering(): Promise<void> { if (this.getTable().getReorderColumn() !== null && (await canOn(this, 'reorder'))) { this.isTableReordering = !this.isTableReordering; this.deselectAllTableRecords(); } }
    /** Enregistre le nouvel ordre : seules les clés de la table sont retenues, chacune reçoit son rang (port de reorderTable). */
    async reorderTable(order: unknown, _draggedRecordKey: unknown = null): Promise<void> {
        const column = this.getTable().getReorderColumn();
        if (column === null || !this.isTableReordering || !Array.isArray(order) || order.length > REORDER_LIMIT || !(await canOn(this, 'reorder'))) return;
        const adapter = this.getDataAdapterForTable();
        const allowed = new Set(await adapter.keysInScope(order.filter((key) => typeof key === 'string' || typeof key === 'number').map(String)));
        let rank = 0;
        for (const key of order.map(String)) if (allowed.delete(key)) await adapter.update(key, { [column]: ++rank });
    }

    async mount(_params: Record<string, unknown> = {}): Promise<void> {
        const table = this.getTable();
        this.tableFilters = table.getDefaultFilterState();
        this.tableDeferredFilters = table.getDefaultFilterState();
        this.tableColumns = table.getDefaultColumnState();
        // Groupe par défaut présélectionné, comme Filament.
        initializeTableGrouping(table, this as any);
        // `?tableAction=view&tableActionRecord=12` (lien d'un résultat de recherche globale) : l'action de ligne s'ouvre à l'arrivée, avec les contrôles habituels.
        const query = ((this._ctx as PanelContext | null)?.req?.query ?? {}) as Record<string, unknown>;
        if (typeof query.tableAction === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(query.tableAction) && typeof query.tableActionRecord === 'string' && query.tableActionRecord.length <= 64) {
            try { await this.mountAction(query.tableAction, {}, { table: true, recordKey: query.tableActionRecord }); } catch (error) { if (!(error instanceof WireError)) throw error; }
        }
    }
    /** Formulaire des filtres : un groupe par filtre, lié à `tableDeferredFilters.<filtre>`. */
    tableFiltersFormSchema(schema: Schema): Schema {
        const table = this.getTable();
        // Au-dessus du contenu, les filtres se répartissent sur plusieurs colonnes (comme Filament) ; dans le menu déroulant, sur une seule.
        const columns = table.getFiltersLayout() === 'above-content-collapsible' ? { sm: 2, lg: 3, xl: 4, '2xl': 5 } : 1;
        return schema.statePath('tableDeferredFilters').columns(columns).partiallyRendered().components(table.getFilters().map((filter) => {
            // Un filtre peut fournir son propre formulaire (constructeur de requêtes) ; sinon c'est un sélecteur.
            const custom = filter.getFormComponents?.() as SchemaComponent[] | undefined;
            if (custom) return StatefulGroup.make(filter.name, custom).columnSpan(filter.getColumnSpan?.() ?? { default: 1, lg: 1 });
            const definition = filter.getFormDefinition();
            return StatefulGroup.make(filter.name, [Select.make('value').label(filter.getLabel()).placeholder(definition.placeholder).options(filter.getFormOptions ? () => filter.getFormOptions!() : definition.options)]).columnSpan({ default: 1, lg: 1 });
        }));
    }
    applyTableFilters(): void {
        // Seuls les filtres déclarés par la table passent dans l'état appliqué : chacun nettoie son état, ou à défaut seules ses clés connues sont reprises.
        this.tableFilters = Object.fromEntries(this.getTable().getFilters().map((filter) => {
            const deferred = this.tableDeferredFilters?.[filter.name];
            if (filter.sanitizeState) return [filter.name, filter.sanitizeState(deferred)];
            return [filter.name, Object.fromEntries(Object.keys(filter.getDefaultState()).map((key) => [key, (deferred as any)?.[key] ?? null]))];
        }));
        this.paginators.page = 1;
    }
    /** Retrait d'un indicateur de filtre actif : le champ visé est effacé de l'état appliqué et du formulaire. */
    removeTableFilter(filterName: unknown, field: unknown = null): void {
        const filter = this.getTable().getFilters().find((candidate) => candidate.name === filterName);
        if (!filter) return;
        const current = this.tableFilters?.[filter.name];
        const next = filter.removeIndicator && typeof field === 'string' && current && typeof current === 'object' ? filter.removeIndicator(current, field) : filter.getDefaultState();
        this.tableFilters = { ...this.tableFilters, [filter.name]: next };
        this.tableDeferredFilters = { ...this.tableDeferredFilters, [filter.name]: JSON.parse(JSON.stringify(next)) };
        this.paginators.page = 1;
    }
    /** Champ réactif du formulaire des filtres (changement d'opérateur d'une règle) : exécute son `afterStateUpdated`. */
    async updatedTableDeferredFilters(_value: unknown, key: string | null): Promise<void> {
        if (!key) return;
        const path = `tableDeferredFilters.${key}`;
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
    removeTableFilters(): void { this.resetTableFiltersForm(); }
    applyTableColumnManager(state: unknown = null, _wasReordered: unknown = false): void { if (state) this.tableColumns = sanitizeColumnState(this.getTable(), state); }
    resetTableColumnManager(): void { this.tableColumns = this.getTable().getDefaultColumnState(); }

    // --- onglets de liste : la clé vide est l'onglet par défaut (`null` côté navigateur)
    activeTab: string | null = null;
    getTabs(): Record<string, Tab> { return (this.resource as any).tabs?.() ?? {}; }
    /** Onglet actif, ramené à une clé déclarée (une valeur inconnue envoyée par le navigateur vaut l'onglet par défaut). */
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
    /** Port de ExposesTableToWidgets : l'état de la table est passé aux widgets, qui peuvent refaire la même requête. */
    getWidgetData(): Record<string, unknown> { return Object.fromEntries(PAGE_TABLE_PROPERTIES.map((property) => [property, (this as any)[property]])); }
    protected rendersActionModalsInPage(): boolean { return false; }
    getBulkActions(): Action[] { return this.getTable().getBulkActions() ?? [DeleteBulkAction.make()]; }
    /** Actions de ligne déclarées par la table, groupes dépliés. */
    getRecordActions(): Action[] { return this.getTable().getRecordActions().flatMap((a: any) => (a instanceof ActionGroup ? a.getActions() : [a])); }
    protected getMountableActions(context: Record<string, unknown>): Action[] | Promise<Action[]> {
        if (typeof context.schemaComponent === 'string') return this.getSchemaComponentActions(context.schemaComponent);
        if (context.table === true && context.bulk === true) return this.getBulkActions();
        if (context.table === true && typeof context.recordKey === 'string') return this.getRecordActions();
        if (context.table === true) return this.getTable().getHeaderActions();
        return this.getHeaderActions();
    }
    /** Seules les formes de contexte connues sont retenues ; la clé d'enregistrement est revérifiée en base au montage. */
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
     * Écriture d'une cellule modifiable (port de `updateTableColumnState`). Tout vient du navigateur : la colonne doit exister, être
     * modifiable et visible, l'enregistrement être dans la portée de la table et modifiable par l'utilisateur, la valeur être valide.
     */
    async updateTableColumnState(columnName: unknown, recordKey: unknown, input: unknown): Promise<unknown> {
        // Toutes les vérifications (colonne visible et modifiable, portée, désactivation, autorisation, validation, crochets) sont dans le paquet tables.
        return updateEditableColumnState(this.getTable(), this, this.getDataAdapterForTable(), columnName, recordKey, input, { authorize: (record: unknown) => canOn(this, 'update', record) });
    }
    /** Clés sélectionnées : la liste envoyée, ou — en mode « tout sélectionner » — tous les enregistrements de la requête courante sauf ceux désélectionnés. */
    async getSelectedRecordKeys(): Promise<string[]> {
        const clean = (list: unknown) => (Array.isArray(list) ? list.filter((k) => typeof k === 'string' || typeof k === 'number').map(String) : []);
        // La sélection vient du navigateur : elle est ramenée aux enregistrements que cette table peut réellement afficher.
        if (!this.isTrackingDeselectedTableRecords) return this.resource.adapter.keysInScope(clean(this.selectedTableRecords));
        const excluded = new Set(clean(this.deselectedTableRecords));
        return (await this.resource.adapter.listKeys(getTableQuery(this.getTable(), this))).filter((k) => !excluded.has(k));
    }
    deselectAllTableRecords(): void {
        this.selectedTableRecords = []; this.deselectedTableRecords = []; this.isTrackingDeselectedTableRecords = false;
        this.dispatch('deselectAllTableRecords', [], { self: true });
    }
    getTable(): Table {
        const resource = this.resource;
        const table = new Table().pluralModelLabel(resource.getPluralModelLabel());
        // Resource simple : la ligne ouvre l'édition en modale ; sinon elle mène à la page d'édition.
        return resource.table(resource.isSimple ? table.recordAction('edit') : table.recordUrl((record) => resource.getUrl(resource.hasViewPage ? 'view' : 'edit', resource.adapter.getKey(record))));
    }
    async renderTable(): Promise<string> {
        const resource = this.resource;
        const ctx = { livewire: this as any, component: null as any, operation: null, record: null, get: () => undefined, state: undefined };
        const bulkActions: string[] = [];
        for (const action of this.getBulkActions()) if (await action.isVisible(ctx)) bulkActions.push(await action.toGroupedHtml(ctx, { table: true, bulk: true }));
        const table = this.getTable();
        return renderTable(table, this, resource.adapter, {
            bulkActions, headerActions: await this.renderTableHeaderActions(ctx), after: await this.renderActionModals(),
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

    /** Actions affichées dans l'en-tête de la table (aucune pour une page de liste : elles sont dans l'en-tête de page). */
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
        // Resource simple : création en modale ; sinon lien vers la page de création.
        if (this.resource.isSimple) return [CreateAction.make(this.resource)];
        return [...((this.resource as any).listHeaderActions?.() ?? []), Action.make('create').label(t('filament-actions::create.single.label', { label: this.resource.modelLabel })).url(this.resource.getUrl('create')).authorize(({ livewire }) => canOn(livewire, 'create'))];
    }
    getPageClasses(): string[] { return ['fi-resource-list-records-page', `fi-resource-${this.resource.slug.replace(/\//g, '-')}`]; }
    contentSchema(schema: Schema): Schema {
        return schema.components([new ResourceTabs(), RenderHook.make(PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE), EmbeddedTable.make(), RenderHook.make(PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABLE_AFTER)]);
    }
}

/**
 * Table des enregistrements liés à un autre (port de RelationManager) : composant enfant de la page d'édition, chargé quand il devient visible.
 * Les sous-classes déclarent `relationship`, `adapterFor()`, `table()` et `form()`.
 */
export class RelationManager extends ListRecords {
    static relationship = '';
    static modelLabel = 'record';
    static pluralModelLabel: string | null = null;
    static recordTitleAttribute: string | null = null;
    /** Adaptateur limité aux enregistrements liés au propriétaire donné. */
    static adapterFor(_ownerKey: string): DataAdapter { throw new Error('RelationManager.adapterFor() doit être défini.'); }
    /** Politique des enregistrements liés (mêmes capacités que celle d'une resource). */
    static policy: Policy | null = null;
    protected isAccessAuthorized(ctx: PanelContext): Promise<boolean> { return this.resource.can('viewAny', ctx.user); }
    static table(table: Table): Table { return table; }
    static form(schema: Schema): Schema { return schema; }
    static getTitle(): string { return this.title ?? ucfirst(this.relationship.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()); }

    /** Clé de l'enregistrement propriétaire : fixée au montage par la page, jamais modifiable depuis le navigateur. */
    ownerRecord = '';
    static locked = ['ownerRecord'];
    _facade: any = null;
    /** Ce que ListRecords attend d'une resource, fourni ici par le relation manager. */
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
        // Comme Filament : s'il existe une action de ligne « edit », cliquer la ligne l'ouvre.
        const hasEdit = table.getRecordActions().flatMap((a: any) => (a instanceof ActionGroup ? a.getActions() : [a])).some((a: Action) => a.getName() === 'edit');
        return hasEdit ? table.recordAction('edit') : table;
    }
    // --- relations plusieurs-à-plusieurs : à définir par le manager qui propose Attach / Detach
    /** Rattache un enregistrement existant au propriétaire. */
    static attach(_ownerKey: string, _recordKey: string): Promise<void> { throw new Error('RelationManager.attach() doit être défini.'); }
    /** Détache des enregistrements du propriétaire, sans les supprimer. */
    static detach(_ownerKey: string, _recordKeys: string[]): Promise<void> { throw new Error('RelationManager.detach() doit être défini.'); }
    /** Enregistrements rattachables correspondant à la recherche : [clé, libellé]. */
    static searchAttachable(_ownerKey: string, _search: string): Promise<[string, string][]> { throw new Error('RelationManager.searchAttachable() doit être défini.'); }
    /** Libellé d'un enregistrement rattachable, ou null s'il ne l'est pas (sert aussi de validation). */
    static attachableLabel(_ownerKey: string, _recordKey: string): Promise<string | null> { throw new Error('RelationManager.attachableLabel() doit être défini.'); }
    getHeaderActions(): Action[] { return []; }
    placeholder(): string {
        return `<div role="status" aria-busy="true" style="height: 8rem; ;" class="fi-section fi-loading-section fi-grid-col"><span class="fi-sr-only">${e(t('filament::components/loading-section.label'))}</span></div>`;
    }
    /** Comme Filament : un relation manager a ses propres emplacements, pas ceux de la page de liste. */
    contentSchema(schema: Schema): Schema {
        return schema.components([new ResourceTabs(), RenderHook.make(PanelsRenderHook.RESOURCE_RELATION_MANAGER_BEFORE), EmbeddedTable.make(), RenderHook.make(PanelsRenderHook.RESOURCE_RELATION_MANAGER_AFTER)]);
    }
    async render(): Promise<string> {
        return `<div class="fi-resource-relation-manager">${await this.getSchema('content').toHtml()}</div>`;
    }
}

/**
 * Page des enregistrements liés à un enregistrement (port de ManageRelatedRecords) : une table, avec création, consultation et
 * édition en modales. Déclarée par `static relatedPages` de la resource propriétaire, elle répond sous `<slug>/{record}/<nom>`.
 */
export class ManageRelatedRecords extends ListRecords {
    /** Resource propriétaire : fixée à l'enregistrement de la page. */
    static parentResource: typeof Resource;
    static relationship = '';
    static modelLabel = 'record';
    static pluralModelLabel: string | null = null;
    static recordTitleAttribute: string | null = null;
    static policy: Policy | null = null;
    /** Adaptateur limité aux enregistrements liés au propriétaire donné. */
    static adapterFor(_ownerKey: string): DataAdapter { throw new Error('ManageRelatedRecords.adapterFor() doit être défini.'); }
    static table(table: Table): Table { return table; }
    static form(schema: Schema): Schema { return schema; }
    static infolist(schema: Schema): Schema { return schema; }
    static getTitle(): string { return this.title ?? ucfirst(this.relationship.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()); }
    static getNavigationLabel(): string { return this.navigationLabel ?? this.getTitle(); }

    /** Clé de l'enregistrement propriétaire : tirée de l'adresse au montage, jamais modifiable depuis le navigateur. */
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
    /** Le propriétaire est relu et son accès vérifié à chaque requête. */
    async hydrate(): Promise<void> {
        const parent = this.related.parentResource;
        this._owner = await parent.adapter.find(this.recordKey);
        if (!this._owner) throw new WireError(404, 'Enregistrement introuvable.');
        if (!(await parent.can('view', (this._ctx as PanelContext | null)?.user ?? null, this._owner))) throw new WireError(403, 'Accès refusé.');
        await (ListRecords.prototype as any).hydrate?.call(this);
    }
    getRecordKey(): string | null { return this.recordKey; }
    /** Ce que ListRecords attend d'une resource, fourni ici par la page. */
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
    /** Comme Filament : le contenu de la page est un groupe (onglets éventuels, puis la table). */
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

/** Adresse de la page précédente si elle appartient à ce site, sinon la racine du site (sans barre finale, comme Laravel). */
function previousUrlOf(req: Request | undefined): string {
    if (!req) return '';
    const origin = `${req.protocol}://${req.get('host')}`;
    try {
        const referer = new URL(String(req.get('referer') ?? ''));
        if (referer.origin === origin) return `${origin}${referer.pathname === '/' ? '' : referer.pathname}${referer.search}`;
    } catch { /* pas de Referer exploitable */ }
    return origin;
}

/** Couleur représentative d'un thème (nuance 500 de sa couleur primaire), pour la pastille du menu. */
function swatchOf(theme: Theme, panel: Panel): string {
    const primary = theme.colors?.primary;
    return (typeof primary === 'string' ? primary : primary?.[500]) ?? panel.colors.getColor('primary')?.[500] ?? 'currentColor';
}

/** Police d'un thème : sans adresse, elle est servie par Bunny Fonts comme celle du panel. */
function fontOf(font: { family: string; url?: string }): { family: string; url: string; preconnect?: string } {
    return font.url ? { family: font.family, url: font.url } : { family: font.family, url: `https://fonts.bunny.net/css?family=${encodeURIComponent(font.family.toLowerCase().replace(/ /g, '-'))}:400,500,600,700&display=swap`, preconnect: 'https://fonts.bunny.net' };
}

function emptyToNull(data: Record<string, unknown>): Record<string, unknown> { return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])); }

/** Base des pages à formulaire d'une resource. */
abstract class ResourceFormPage extends Page {
    /** Champ réactif du formulaire (`live()` + `afterStateUpdated()`) : `set(nom, valeur)` écrit à côté du champ modifié. */
    async updatedData(_value: unknown, key: string | null): Promise<void> {
        if (!key) return;
        const path = `data.${key}`;
        // Le champ modifié d'abord, puis ses champs parents (un Repeater recalcule un total quand une de ses lignes change), comme Filament.
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

    /** Deux colonnes par défaut à partir de `lg`, comme `defaultForm()` de Filament ; la resource peut en décider autrement. */
    formSchema(schema: Schema): Schema {
        const form = this.resource.form(schema.columns(2).operation(this.getOperation()).record(this.getRecord()));
        const steps = this.getSteps();
        // Assistant : les étapes remplacent les composants du formulaire de la resource (comme le trait HasWizard).
        return steps === null ? form : form.columns(null).components([this.getWizardComponent(steps)]);
    }
    /**
     * Étapes d'un assistant (équivalent du trait HasWizard de Filament) : dès que la méthode en retourne, la page présente son formulaire
     * étape par étape, avec « Back » / « Next » et le bouton d'enregistrement sur la dernière étape.
     */
    protected getSteps(): Step[] | null { return null; }
    /** Vrai : les étapes sont accessibles dans n'importe quel ordre, sans validation au passage. */
    protected hasSkippableSteps(): boolean { return false; }
    /** Étape affichée à l'ouverture (à partir de 1). */
    protected getStartStep(): number { return 1; }
    protected getWizardComponent(steps: Step[]): Wizard {
        const [submit] = this.getFormActions();
        return Wizard.make(steps).startOnStep(this.getStartStep()).cancelAction(this.cancelAction())
            .submitAction(submit.submit(null).action(this.getSubmitMethod()))
            .alpineSubmitHandler(`$wire.${this.getSubmitMethod()}()`).skippable(this.hasSkippableSteps()).contained(false);
    }
    contentSchema(schema: Schema): Schema {
        // Assistant : pas de balise <form> autour, chaque étape a la sienne et l'assistant porte les actions.
        if (this.getSteps() !== null) return schema.components([EmbeddedSchema.make('form')]);
        return schema.components([
            Form.make([EmbeddedSchema.make('form')]).id('form').livewireSubmitHandler(this.getSubmitMethod())
                .footer([Actions.make(this.getFormActions()).alignment('start').key('form-actions')]),
        ]);
    }
    /** Destination de « Cancel » quand le navigateur n'a pas d'historique : la liste, sauf si la page en décide autrement. */
    protected getCancelUrl(): string { return this.resource.getUrl(); }
    protected cancelAction(): Action {
        return Action.make('cancel').label(t(`filament-panels::resources/pages/${this.getOperation()}-record.form.actions.cancel.label`)).color('gray')
            .alpineClickHandler(`document.referrer ? window.history.back() : Livewire.navigate(${js(this.getCancelUrl())})`);
    }
    /** Valide le formulaire ; en cas d'erreur, les pose sur le composant et prévient le navigateur. */
    protected async validateForm(): Promise<boolean> {
        this._errors = await validateSchema(this.getSchema('form'));
        if (!Object.keys(this._errors).length) return true;
        this.dispatch('form-validation-error', { livewireId: this.id });
        return false;
    }
}

/** Page de création d'un enregistrement (port de CreateRecord). */
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
    // --- crochets de cycle de vie, à surcharger dans une sous-classe (aucun n'est appelable depuis le navigateur)
    /** Transforme les données validées avant la création (ajouter l'auteur, calculer un champ…). */
    protected mutateFormDataBeforeCreate(data: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> { return data; }
    /** Juste avant la création ; lever une erreur l'annule. */
    protected beforeCreate(_data: Record<string, unknown>): void | Promise<void> {}
    /** La création elle-même : par défaut, l'adaptateur de la resource. */
    protected handleRecordCreation(data: Record<string, unknown>): Promise<any> { return this.getDataAdapter().create(data); }
    /** Après la création (journal, envoi d'un message…). */
    protected afterCreate(_record: any): void | Promise<void> {}
    /** Où aller ensuite : par défaut, la page d'édition du nouvel enregistrement. */
    protected getRedirectUrl(record: any): string { return this.resource.getUrl('edit', this.getDataAdapter().getKey(record)); }
    /** Titre de la notification de succès ; `null` pour ne rien afficher. */
    protected getCreatedNotificationTitle(): string | null { return t('filament-panels::resources/pages/create-record.notifications.created.title'); }

    async create(another = false): Promise<void> {
        if (!(await this.validateForm())) return;
        const data = await this.mutateFormDataBeforeCreate(await getSchemaState(this.getSchema('form')));
        await this.beforeCreate(data);
        const record = await this.handleRecordCreation(data);
        await this.afterCreate(record);
        const title = this.getCreatedNotificationTitle();
        if (title !== null) Notification.make().success().title(title).send();
        if (another === true) { this.data = {}; fillSchema(this.getSchema('form'), this.data); return; }
        this.redirect(this.getRedirectUrl(record), true);
    }
    createAnother(): Promise<void> { return this.create(true); }
}

/** Action de suppression d'un enregistrement, avec confirmation (port de Filament\Actions\DeleteAction dans une page de resource). */
export class DeleteAction {
    /** Sur une page d'édition : supprime l'enregistrement de la page puis revient à la liste. Sur une ligne de table : supprime la ligne. */
    static make(): Action {
        return Action.make('delete').authorize(({ livewire, record }) => canOn(livewire, 'delete', record))
            .label(t('filament-actions::delete.single.label')).color('danger').keyBindings(['mod+d']).tableIcon('c-trash').groupedIcon('m-trash')
            .requiresConfirmation().modalIcon('o-trash')
            // Masquée pour un enregistrement déjà supprimé (suppression douce).
            .hidden(({ livewire, record }) => { const target = record ?? (livewire as any)._record; return target ? (livewire as any).getDataAdapter().isTrashed(target) : false; })
            .modalHeading(({ livewire, record }) => t('filament-actions::delete.single.modal.heading', { label: livewire.resource.getRecordTitle(record ?? livewire._record) }))
            .modalSubmitActionLabel(t('filament-actions::delete.single.modal.actions.delete.label'))
            .action(async ({ livewire, record }) => {
                const adapter = livewire.getDataAdapter();
                const inTable = typeof livewire.getTable === 'function';
                await adapter.delete(inTable ? adapter.getKey(record) : livewire.recordKey);
                Notification.make().success().title(t('filament-actions::delete.single.notifications.deleted.title')).send();
                if (!inTable) livewire.redirect(livewire.resource.getUrl(), true);
            });
    }
}

/** Action de duplication : comme `Action`, avec la liste des attributs à ne pas recopier. */
export type ReplicateActionInstance = Action & { excludeAttributes(attributes: string[]): ReplicateActionInstance };

/** Duplication d'une ligne de table (port de ReplicateAction) : la copie reprend les attributs de l'enregistrement, sauf sa clé, ses dates et ceux exclus. */
export class ReplicateAction {
    static make(): ReplicateActionInstance {
        let excluded: string[] = [];
        const action = Action.make('replicate').authorize(({ livewire, record }) => canOn(livewire, 'replicate', record))
            .label(t('filament-actions::replicate.single.label')).tableIcon('c-square-2-stack').groupedIcon('m-square-2-stack')
            .modalHeading(({ livewire, record }) => t('filament-actions::replicate.single.modal.heading', { label: livewire.resource.getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::replicate.single.modal.actions.replicate.label'))
            .action(async ({ livewire, record }) => {
                const adapter = livewire.getDataAdapter();
                const source = typeof (record as any)?.toJSON === 'function' ? (record as any).toJSON() : { ...(record as any) };
                // Comme Model::replicate() : ni clé primaire ni dates de création et de modification.
                for (const attribute of ['id', 'created_at', 'updated_at', ...excluded]) delete source[attribute];
                await adapter.create(source);
                Notification.make().success().title(t('filament-actions::replicate.single.notifications.replicated.title')).send();
            }) as ReplicateActionInstance;
        action.excludeAttributes = (attributes: string[]) => { excluded = attributes; return action; };
        return action;
    }
}

/** Création en modale avec le formulaire de la resource (port de CreateAction). */
export class CreateAction {
    /** Sans argument, la resource (ou le relation manager) est celle du composant hôte. */
    static make(resource: typeof Resource | null = null): Action {
        const of = (livewire: any) => resource ?? livewire.resource;
        return Action.make('create').authorize(({ livewire, record }) => canOn(livewire, 'create', record))
            .label(({ livewire }) => t('filament-actions::create.single.label', { label: of(livewire).modelLabel }))
            .modalHeading(({ livewire }) => t('filament-actions::create.single.modal.heading', { label: String(of(livewire).modelLabel).split(' ').map(ucfirst).join(' ') }))
            .modalSubmitActionLabel(t('filament-actions::create.single.modal.actions.create.label'))
            .extraModalFooterActions([Action.make('createAnother').label(t('filament-actions::create.single.modal.actions.create_another.label')).color('gray').action(`callMountedAction(${js({ another: true })})`)])
            .schema((schema: Schema) => of(schema.livewire).form(schema))
            .action(async ({ livewire, data }) => {
                await of(livewire).adapter.create(data);
                Notification.make().success().title(t('filament-actions::create.single.notifications.created.title')).send();
            });
    }
}

/** Édition en modale d'une ligne de table, avec le formulaire de la resource (port de EditAction). */
export class EditAction {
    /** Sans argument, la resource (ou le relation manager) est celle du composant hôte. */
    static make(resource: typeof Resource | null = null): Action {
        const of = (livewire: any) => resource ?? livewire.resource;
        return Action.make('edit').authorize(({ livewire, record }) => canOn(livewire, 'update', record))
            .label(t('filament-actions::edit.single.label')).tableIcon('c-pencil-square').groupedIcon('m-pencil-square')
            .modalHeading(({ livewire, record }) => t('filament-actions::edit.single.modal.heading', { label: of(livewire).getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::edit.single.modal.actions.save.label'))
            .schema((schema: Schema) => of(schema.livewire).form(schema))
            .fillForm(({ record }) => ({ ...record }))
            .action(async ({ livewire, record, data }) => {
                const adapter = of(livewire).adapter;
                await adapter.update(adapter.getKey(record), data);
                Notification.make().success().title(t('filament-actions::edit.single.notifications.saved.title')).send();
            });
    }
}

/** Lien vers la page de consultation de l'enregistrement (port de ViewAction, quand la resource a une page « View »). */
export class ViewAction {
    static make(resource: typeof Resource | null = null): Action {
        const of = (livewire: any) => resource ?? livewire.resource;
        return Action.make('view').authorize(({ livewire, record }) => canOn(livewire, 'view', record))
            .label(t('filament-actions::view.single.label')).color('gray').tableIcon('c-eye').groupedIcon('m-eye')
            // Sans page « View » (resource simple, enregistrements liés) : l'infolist s'ouvre en modale, comme Filament.
            .url(({ livewire, record }) => (record && of(livewire).hasViewPage ? of(livewire).getUrl('view', of(livewire).adapter.getKey(record)) : null))
            .modalHeading(({ livewire, record }) => t('filament-actions::view.single.modal.heading', { label: of(livewire).getRecordTitle(record) }))
            .modalSubmitAction(false).modalCancelActionLabel(t('filament-actions::view.single.modal.actions.close.label'))
            .schema((schema: Schema) => (of(schema.livewire).hasViewPage || !of(schema.livewire).infolist ? null : of(schema.livewire).infolist(schema.operation('view'))));
    }
}

const managerOf = (livewire: any) => livewire.constructor as typeof RelationManager;
/** Rattache un enregistrement existant au propriétaire d'un relation manager (port de AttachAction). */
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
/** Détache une ligne du propriétaire sans la supprimer (port de DetachAction). */
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
/** Détache les lignes sélectionnées (port de DetachBulkAction). */
export class DetachBulkAction {
    static make(): Action {
        return Action.make('detach')
            .label(t('filament-actions::detach.multiple.label')).color('danger').icon('m-x-mark')
            .requiresConfirmation().modalIcon('o-x-mark')
            .modalHeading(({ livewire }) => t('filament-actions::detach.multiple.modal.heading', { label: livewire.resource.getPluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::detach.multiple.modal.actions.detach.label'))
            .action(async ({ livewire }) => {
                // Les clés sélectionnées sont celles de la requête courante du manager : elles appartiennent donc au propriétaire.
                await managerOf(livewire).detach(livewire.ownerRecord, await livewire.getSelectedRecordKeys());
                Notification.make().success().title(t('filament-actions::detach.multiple.notifications.detached.title')).send();
                livewire.deselectAllTableRecords();
            });
    }
}

/** Restauration d'un enregistrement supprimé (port de RestoreAction). Visible seulement s'il est supprimé. */
export class RestoreAction {
    static make(): Action {
        return Action.make('restore').authorize(({ livewire, record }) => canOn(livewire, 'restore', record))
            .label(t('filament-actions::restore.single.label')).color('gray')
            .requiresConfirmation().modalIcon('o-arrow-uturn-left')
            .hidden(({ livewire }) => !(livewire as any).getDataAdapter().isTrashed((livewire as any)._record))
            .modalHeading(({ livewire }) => t('filament-actions::restore.single.modal.heading', { label: livewire.resource.getRecordTitle(livewire._record) }))
            .modalSubmitActionLabel(t('filament-actions::restore.single.modal.actions.restore.label'))
            .action(async ({ livewire }) => {
                await livewire.getDataAdapter().restore(livewire.recordKey);
                await livewire.hydrate();
                Notification.make().success().title(t('filament-actions::restore.single.notifications.restored.title')).send();
            });
    }
}
/** Suppression définitive d'un enregistrement supprimé (port de ForceDeleteAction). Visible seulement s'il est supprimé. */
export class ForceDeleteAction {
    static make(): Action {
        return Action.make('forceDelete').authorize(({ livewire, record }) => canOn(livewire, 'forceDelete', record))
            .label(t('filament-actions::force-delete.single.label')).color('danger')
            .requiresConfirmation().modalIcon('o-trash')
            .hidden(({ livewire }) => !(livewire as any).getDataAdapter().isTrashed((livewire as any)._record))
            .modalHeading(({ livewire }) => t('filament-actions::force-delete.single.modal.heading', { label: livewire.resource.getRecordTitle(livewire._record) }))
            .modalSubmitActionLabel(t('filament-actions::force-delete.single.modal.actions.delete.label'))
            .action(async ({ livewire }) => {
                await livewire.getDataAdapter().forceDelete(livewire.recordKey);
                Notification.make().success().title(t('filament-actions::force-delete.single.notifications.deleted.title')).send();
                livewire.redirect(livewire.resource.getUrl(), true);
            });
    }
}

/** Suppression groupée des enregistrements sélectionnés dans une table (port de DeleteBulkAction). */
export class DeleteBulkAction {
    static make(): Action {
        return Action.make('delete').authorize(({ livewire, record }) => canOn(livewire, 'deleteAny', record))
            .label(t('filament-actions::delete.multiple.label')).color('danger').icon('m-trash')
            .requiresConfirmation().modalIcon('o-trash')
            .modalHeading(({ livewire }) => t('filament-actions::delete.multiple.modal.heading', { label: livewire.resource.getTitleCasePluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::delete.multiple.modal.actions.delete.label'))
            .action(async ({ livewire }) => {
                await livewire.getDataAdapterForTable().deleteMany(await livewire.getSelectedRecordKeys());
                Notification.make().success().title(t('filament-actions::delete.multiple.notifications.deleted.title')).send();
                livewire.deselectAllTableRecords();
            });
    }
}

/** Page d'édition d'un enregistrement (port de EditRecord). */
export class EditRecord extends ResourceFormPage {
    static callable = ['save'];
    recordKey = '';
    /** Onglet de relation manager actif (indice dans `Resource.relations`). */
    activeRelationManager = '0';
    /**
     * Page précédente (équivalent de `url()->previous()`), retenue au premier affichage. Elle vient de l'en-tête Referer :
     * seule une adresse de ce même site est acceptée, et elle n'est plus modifiable ensuite.
     */
    previousUrl = '';
    protected getCancelUrl(): string { return this.previousUrl; }
    contentSchema(schema: Schema): Schema {
        const content = super.contentSchema(schema);
        // Toujours présent, comme dans Filament : masqué (colonne vide) quand la resource n'a pas de relation manager.
        return content.components([...content.getComponents(), this.resource.relations.length ? new RelationManagerTabs() : new RelationManagerTabs().key(null).hidden()]);
    }
    static locked = ['recordKey', 'previousUrl'];
    _record: any = null;

    async mount(params: Record<string, unknown>): Promise<void> {
        this.recordKey = String(params.record ?? '');
        this.previousUrl = previousUrlOf((this._ctx as PanelContext | null)?.req);
        await this.hydrate();
        // Remplit le formulaire avec les valeurs de l'enregistrement pour chaque champ déclaré.
        fillSchemaFromRecord(this.getSchema('form'), this.data, await this.mutateFormDataBeforeFill({ ...this._record }));
    }
    /** L'enregistrement est relu à chaque requête, comme dans Filament (pas de liaison de route). */
    async hydrate(): Promise<void> {
        this._record = await this.getDataAdapter().find(this.recordKey);
        if (!this._record) throw new WireError(404, 'Enregistrement introuvable.');
        if (!(await canOn(this, 'update', this._record))) throw new WireError(403, 'Accès refusé.');
    }
    protected getRecord(): unknown { return this._record; }
    getRecordKey(): string | null { return this.recordKey; }
    getActionMountContext(): Record<string, unknown> { return { recordKey: this.recordKey }; }
    protected getActionRecord(): unknown { return this._record; }
    /** Comme une page générée par Filament : suppression, plus restauration et suppression définitive si le modèle a la suppression douce. */
    getHeaderActions(): Action[] {
        const defaults = this.getDataAdapter().supportsSoftDeletes() ? [DeleteAction.make(), RestoreAction.make(), ForceDeleteAction.make()] : [DeleteAction.make()];
        // Actions propres à la resource, placées avant les actions par défaut.
        return [...((this.resource as any).editHeaderActions?.() ?? []), ...defaults];
    }
    getOperation(): 'edit' { return 'edit'; }
    getSubmitMethod(): string { return 'save'; }
    getTitle(): string { return t('filament-panels::resources/pages/edit-record.title', { label: this.resource.getRecordTitle(this._record) }); }
    getBreadcrumbs(): { label: string; url: string | null }[] {
        return [
            { label: this.resource.getTitleCasePluralModelLabel(), url: this.resource.getUrl() },
            // Le titre de l'enregistrement n'apparaît que si la resource déclare `recordTitleAttribute` ; il mène à la page « View » quand elle existe.
            ...(this.resource.recordTitleAttribute ? [{ label: this.resource.getRecordTitle(this._record), url: this.resource.getUrl(this.resource.hasViewPage ? 'view' : 'edit', this.recordKey) }] : []),
            { label: t('filament-panels::resources/pages/edit-record.breadcrumb'), url: null },
        ];
    }
    getSubNavigation(): SubNavigationItem[] { return this.resource.getRecordSubNavigation(this); }
    getPageClasses(): string[] { return ['fi-resource-edit-record-page', `fi-resource-${this.resource.slug.replace(/\//g, '-')}`, `fi-resource-record-${this.recordKey}`]; }
    getFormActions(): Action[] {
        return [Action.make('save').label(t('filament-panels::resources/pages/edit-record.form.actions.save.label')).submit('save').keyBindings(['mod+s']), this.cancelAction()];
    }
    // --- crochets de cycle de vie, à surcharger dans une sous-classe (aucun n'est appelable depuis le navigateur)
    /** Transforme les valeurs de l'enregistrement avant de remplir le formulaire. */
    protected mutateFormDataBeforeFill(data: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> { return data; }
    /** Transforme les données validées avant l'enregistrement. */
    protected mutateFormDataBeforeSave(data: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>> { return data; }
    /** Juste avant l'enregistrement ; lever une erreur l'annule. */
    protected beforeSave(_data: Record<string, unknown>): void | Promise<void> {}
    /** L'enregistrement lui-même : par défaut, l'adaptateur de la resource. */
    protected handleRecordUpdate(record: any, data: Record<string, unknown>): Promise<any> { return this.getDataAdapter().update(this.getDataAdapter().getKey(record), data); }
    /** Après l'enregistrement. */
    protected afterSave(_record: any): void | Promise<void> {}
    /** Adresse où aller après l'enregistrement ; `null` (défaut) : rester sur la page. */
    protected getRedirectUrl(_record: any): string | null { return null; }
    /** Titre de la notification de succès ; `null` pour ne rien afficher. */
    protected getSavedNotificationTitle(): string | null { return t('filament-panels::resources/pages/edit-record.notifications.saved.title'); }

    async save(): Promise<void> {
        if (!(await this.validateForm())) return;
        const data = await this.mutateFormDataBeforeSave(await getSchemaState(this.getSchema('form')));
        await this.beforeSave(data);
        this._record = await this.handleRecordUpdate(this._record, data);
        await this.afterSave(this._record);
        const title = this.getSavedNotificationTitle();
        if (title !== null) Notification.make().success().title(title).send();
        const url = this.getRedirectUrl(this._record);
        if (url !== null) this.redirect(url, true);
    }
}

/** Page de consultation d'un enregistrement (port de ViewRecord) : le schéma `infolist()` de la resource, en lecture seule. */
export class ViewRecord extends Page {
    static resource: typeof Resource;
    static locked = ['recordKey'];
    recordKey = '';
    /** Onglet de relation manager actif (indice dans `Resource.relations`). */
    activeRelationManager = '0';
    _record: any = null;
    get resource(): typeof Resource { return (this.constructor as typeof ViewRecord).resource; }
    getDataAdapter(): DataAdapter { return this.resource.adapter; }
    async mount(params: Record<string, unknown>): Promise<void> {
        this.recordKey = String(params.record ?? '');
        await this.hydrate();
    }
    /** L'enregistrement est relu à chaque requête, comme sur la page d'édition. */
    async hydrate(): Promise<void> {
        this._record = await this.getDataAdapter().find(this.recordKey);
        if (!this._record) throw new WireError(404, 'Enregistrement introuvable.');
        if (!(await canOn(this, 'view', this._record))) throw new WireError(403, 'Accès refusé.');
    }
    getRecordKey(): string | null { return this.recordKey; }
    getActionMountContext(): Record<string, unknown> { return { recordKey: this.recordKey }; }
    protected getActionRecord(): unknown { return this._record; }
    infolistSchema(schema: Schema): Schema { return this.resource.infolist(schema.columns(2).operation('view').record(this._record)); }
    contentSchema(schema: Schema): Schema {
        const content = schema.components([EmbeddedSchema.make('infolist')]);
        // Toujours présent, comme dans Filament : masqué (colonne vide) quand la resource n'a pas de relation manager.
        return content.components([...content.getComponents(), this.resource.relations.length ? new RelationManagerTabs() : new RelationManagerTabs().key(null).hidden()]);
    }
    /** Par défaut : le lien vers la page d'édition (EditAction d'une page « View »). */
    getHeaderActions(): Action[] { return [this.editAction()]; }
    protected editAction(): Action {
        return Action.make('edit').authorize(({ livewire, record }) => canOn(livewire, 'update', record)).label(t('filament-actions::edit.single.label')).url(() => this.resource.getUrl('edit', this.recordKey));
    }
    getTitle(): string { return t('filament-panels::resources/pages/view-record.title', { label: this.resource.getRecordTitle(this._record) }); }
    getBreadcrumbs(): { label: string; url: string | null }[] {
        return [
            { label: this.resource.getTitleCasePluralModelLabel(), url: this.resource.getUrl() },
            // Le titre de l'enregistrement n'apparaît que si la resource déclare `recordTitleAttribute`.
            ...(this.resource.recordTitleAttribute ? [{ label: this.resource.getRecordTitle(this._record), url: this.resource.getUrl('view', this.recordKey) }] : []),
            { label: t('filament-panels::resources/pages/view-record.breadcrumb'), url: null },
        ];
    }
    getSubNavigation(): SubNavigationItem[] { return this.resource.getRecordSubNavigation(this); }
    getPageClasses(): string[] { return ['fi-resource-view-record-page', `fi-resource-${this.resource.slug.replace(/\//g, '-')}`, `fi-resource-record-${this.recordKey}`]; }
}

// ------------------------------------------------------------------ composants de mise en page
/** Contexte d'évaluation des actions d'un menu du panel (pas d'enregistrement). */
const menuContext = (livewire: unknown) => ({ livewire: livewire as any, component: null as any, operation: null, record: null, get: () => undefined, state: undefined });
/** Menu utilisateur (port de HasUserMenu et de la vue user-menu) : profil, éléments du panel, thèmes, déconnexion. */
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
/** Menu du locataire (port de la vue tenant-menu) : locataire courant, autres locataires, création, profil. */
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

/** Sidebar : logo, menu du locataire, recherche, navigation, et — sans barre du haut — cloche et menu utilisateur. */
export class Sidebar extends Component {
    static callable = ['setTheme'];
    currentPath = '/';
    static locked = ['currentPath'];
    mount(params: Record<string, unknown>): void { this.currentPath = String(params.path ?? '/'); }
    /** Un élément de resource reste actif sur ses pages de création et d'édition. */
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
    /** Choix d'un thème par l'utilisateur : seul un thème déclaré par le panel est accepté ; la page est rechargée pour l'appliquer. */
    setTheme(id: unknown): void { applyTheme(this, id); this.skipRender(); }
}
/** Choix d'un thème (sidebar ou barre du haut) : seul un thème déclaré par le panel est accepté ; la page est rechargée. */
function applyTheme(component: Component, id?: unknown): void {
    const { req, res, panel, user } = component._ctx as PanelContext;
    if (!user) throw new WireError(401, 'Non authentifié.');
    const theme = panel.getThemes().find((candidate) => candidate.id === id);
    if (!theme) throw new WireError(404, 'Thème inconnu.');
    panel.rememberTheme(res, theme);
    const referer = previousUrlOf(req);
    component.redirect(referer.replace(/^https?:\/\/[^/]+/, '') || '/');
}

/** Barre du haut (port de Filament\Livewire\Topbar) : logo, navigation éventuelle, recherche, cloche, menu utilisateur. */
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

/** Menu utilisateur des pages simples d'un utilisateur connecté (port de SimpleUserMenu). */
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

// ------------------------------------------------------------------ routage
/** Un runtime ne sert qu'un panel : chaque panel a son endpoint Livewire et ses composants. */
const runtimePanels = new WeakMap<WireRuntime, Panel>();
/** Segments réservés juste après le chemin d'un panel à locataires (ils ne sont pas des clés de locataire). */
const RESERVED_SEGMENTS = new Set(['login', 'logout', 'register', 'password-reset', 'email-verification', 'profile', 'livewire']);

/** Routeur Express d'un panel : assets, endpoint du runtime, authentification, locataires, pages protégées. */
export function panelRouter(panel: Panel, runtime: WireRuntime): Router {
    const owner = runtimePanels.get(runtime);
    if (owner && owner !== panel) throw new Error(`Ce WireRuntime sert déjà le panel « ${owner.getId()} » : créez un WireRuntime par panel.`);
    runtimePanels.set(runtime, panel);
    // Les envois de fichiers passent par l'endpoint de ce panel (session et utilisateur du panel).
    const runtimeOptions = (runtime as any).options as { uploadPrefix?: string };
    runtimeOptions.uploadPrefix ??= panel.getLivewirePrefix();
    // Un seul gestionnaire de couleurs pour tous les panels : chaque requête y pose les couleurs du sien.
    useColorManager(sharedColors);
    useFormsColorManager(sharedColors);
    useTableColorManager(sharedColors);
    useInfolistsColorManager(sharedColors);
    // HTML affiché tel quel par une entrée d'infolist : repassé par le schéma de l'éditeur de texte enrichi, qui ne garde que ses balises.
    useHtmlSanitizer((html) => richDocumentToHtml(richHtmlToDocument(html)) ?? '');
    views.share({ assetUrl: (file: string) => panel.assetUrl(file) });
    for (const plugin of panel.getPlugins()) plugin.boot?.(panel);
    assertAuthCapabilities(panel);
    // Locataires : les resources cloisonnées ne voient que les enregistrements du locataire de la requête.
    const ownership = panel.getTenantOwnershipColumn();
    if (panel.hasTenancy() && ownership) {
        for (const resource of panel.getResources()) {
            if (!resource.isScopedToTenant) continue;
            const adapter = resource.adapter as any;
            if (typeof adapter?.scopeToTenant !== 'function') throw new Error(`Resource ${resource.name} : son adaptateur ne sait pas se cloisonner par locataire (scopeToTenant).`);
            adapter.scopeToTenant(resource.tenantOwnershipColumn ?? ownership, () => { const tenant = panel.getTenant(); return tenant ? panel.getTenantUrlKey(tenant) : null; });
        }
    }
    const router = express.Router();
    const name = (suffix: string) => `navette.${panel.getId()}.${suffix}`;
    const livewire = panel.getLivewirePrefix();
    // La boîte aux lettres des notifications est propre au navigateur : on la rattache à son jeton CSRF.
    const context = async (req: Request, res: Response): Promise<PanelContext> => ({ req, res, panel, user: await panel.user(req), mailbox: csrfToken(req, res), tenant: null });

    /** Locataire désigné par une adresse du panel, si l'utilisateur en est membre. */
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
    /** Accueil de l'utilisateur : la racine du panel, ou dans un panel à locataires celle de son premier locataire (sinon la création d'un locataire). */
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
    // Fichiers propres à Navette (hors balisage et styles de Filament).
    router.use(express.static(dir('../dist/navette')));
    // Le locataire d'une mise à jour est celui de la page qui l'envoie (adresse du snapshot, signé), si l'utilisateur en est membre.
    const wireContext = async (req: Request, res: Response): Promise<PanelContext> => {
        const ctx = await context(req, res);
        let path = '';
        try { path = String(JSON.parse(req.body?.components?.[0]?.snapshot ?? '{}')?.memo?.path ?? ''); } catch { path = ''; }
        ctx.tenant = await tenantFromPath(path, ctx.user);
        return ctx;
    };
    // Port du middleware PublishNotifications : les notifications envoyées pendant la requête partent dans un lot annoncé au navigateur.
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
    // Seul un utilisateur connecté peut envoyer des fichiers.
    }, (ctx: PanelContext) => !!ctx.user));

    type DocumentOptions = { title: string; component: string; layout: 'simple' | 'index'; params?: Record<string, unknown> };
    // Tout le rendu d'une page se fait avec les couleurs du thème de la requête, et pour son locataire.
    const document = (req: Request, res: Response, ctx: PanelContext, options: DocumentOptions) => panel.withTheme(req, () => panel.withTenant(ctx.tenant ?? null, () => renderDocument(req, res, ctx, options)));
    const renderDocument = async (req: Request, res: Response, ctx: PanelContext, options: DocumentOptions) => {
        const request = { path: req.path, method: req.method, ctx };
        const mounted = await runtime.mountWithInstance(options.component, options.params ?? {}, request);
        // Une page qui redirige dès son montage (déjà connecté, adresse déjà vérifiée…) : redirection HTTP.
        const redirect = (mounted.component as any)._effects?.redirect;
        if (typeof redirect === 'string') return void res.redirect(redirect);
        const slot = mounted.html;
        // Le titre du document vient de l'instance (il peut dépendre de l'enregistrement).
        const instanceTitle = (mounted.component as any).getTitle?.();
        if (typeof instanceTitle === 'string') options.title = instanceTitle;
        // Les emplacements de la mise en page portent les portées de la page affichée.
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
    /** Erreurs d'accès d'une page : 404 et 403 en clair, le reste remonte. */
    const guarded = async (res: Response, render: () => Promise<void>) => {
        try { await render(); } catch (error) {
            if (error instanceof WireError && error.status === 404) return void res.status(404).send('Not Found');
            if (error instanceof WireError && error.status === 403) return void res.status(403).send('Forbidden');
            throw error;
        }
    };
    /** Page simple réservée aux invités (connexion, inscription, mot de passe oublié). */
    const guestPage = (path: string, component: string, title: string, params: (req: Request) => Record<string, unknown> = () => ({})) => {
        router.get(panel.getBaseUrl(path), async (req, res) => {
            const ctx = await context(req, res);
            if (ctx.user) return res.redirect((await homeUrl(ctx.user)) ?? panel.getBaseUrl());
            await guarded(res, () => document(req, res, ctx, { title, component, layout: 'simple', params: params(req) }));
        });
    };
    /** Page simple d'un utilisateur connecté, hors locataire (profil, vérification, création d'un locataire). */
    const userPage = (path: string, component: string, title: string, layout: 'simple' | 'index' = 'simple') => {
        router.get(panel.getBaseUrl(path), async (req, res) => {
            const ctx = await context(req, res);
            if (!ctx.user) return res.redirect(panel.getLoginUrl());
            await guarded(res, () => document(req, res, ctx, { title, component, layout }));
        });
    };

    if (LoginPage) {
        guestPage('login', name('auth.login'), t('filament-panels::auth/pages/login.title'));
        router.post(panel.getLogoutUrl(), express.urlencoded({ extended: false }), (req, res) => {
            if (!verifyCsrf(req, req.body?._token)) return res.status(419).send('Jeton CSRF invalide.');
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
        // Lien reçu par e-mail : signé, limité dans le temps, et valable seulement pour l'utilisateur connecté qu'il désigne.
        router.get(panel.getBaseUrl('email-verification/verify/:id/:hash'), async (req, res) => {
            const ctx = await context(req, res);
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

    /** Contexte d'une page protégée : connexion, vérification de l'adresse, locataire. Rend null après avoir répondu. */
    const pageContext = async (req: Request, res: Response): Promise<PanelContext | null> => {
        const ctx = await context(req, res);
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
        // Racine du panel : le premier locataire de l'utilisateur, sinon la création d'un locataire.
        router.get(panel.getBaseUrl(), async (req, res) => {
            const ctx = await context(req, res);
            if (!ctx.user) return res.redirect(panel.getLoginUrl());
            if (await panel.mustVerifyEmail(ctx.user)) return res.redirect(panel.getEmailVerificationPromptUrl());
            const url = await homeUrl(ctx.user);
            if (!url) return void res.status(404).send('Not Found');
            res.redirect(url);
        });
        // Racine d'un locataire sans tableau de bord : la première page du menu (comme Filament).
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
        // `{record}` dans le slug devient un paramètre de route, passé à mount().
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

/** Une option d'authentification exige certaines méthodes du fournisseur d'utilisateurs : on le dit au démarrage plutôt qu'au premier clic. */
function assertAuthCapabilities(panel: Panel): void {
    if (!panel.hasRegistration() && !panel.hasPasswordReset() && !panel.hasEmailVerification() && !panel.hasProfile()) return;
    const auth = panel.getAuth();
    const missing = (feature: string, methods: (keyof AuthProvider)[]) => {
        const absent = methods.filter((method) => typeof auth[method] !== 'function');
        if (absent.length) throw new Error(`${feature} : le fournisseur d'utilisateurs doit définir ${absent.join(', ')} (knexAuthProvider le fait).`);
    };
    if (panel.hasRegistration()) missing('Inscription', ['create', 'findByEmail']);
    if (panel.hasPasswordReset()) missing('Mot de passe oublié', ['findByEmail', 'update', 'getPasswordFingerprint']);
    if (panel.hasEmailVerification()) missing('Vérification de l\'adresse', ['hasVerifiedEmail', 'markEmailAsVerified']);
    if (panel.hasProfile()) missing('Profil', ['update']);
}
