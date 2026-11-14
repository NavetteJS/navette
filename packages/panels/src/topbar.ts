// Global search and database notifications: two components that live in the panel sidebar.
import { Attributes, e, icon, js, loadingIndicator, renderHook } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { Component, WireError } from '@navette-js/wire';
import { notificationActionFromArray, notificationActionsHtml, notificationActionToArray, notificationColorClasses, type NotificationActionData, type NotificationData } from './notifications.ts';
import { richDocumentToHtml, richHtmlToDocument } from '@navette-js/forms';
import { pagination } from '@navette-js/support/ui';

/** Notification body: HTML is sanitized (rich editor tags only), plain text is escaped. */
export const notificationBodyHtml = (body: string): string => (/<[a-z][\s\S]*>/i.test(body) ? (richDocumentToHtml(richHtmlToDocument(body)) ?? '') : e(body));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Icon names stored in the database are untrusted: only a Heroicons-like name or `prefix:name` (an icon of a registered set).
const safeIcon = (name: string | null, size: string, classes: string[], alias?: string): string => {
    if (!name || !/^[a-z0-9-]+(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/.test(name)) return '';
    try { return icon(name, { size, alias, attributes: new Attributes().class(classes) }); } catch { return ''; }
};
const STATUS_ICONS: Record<string, string> = { danger: 'o-x-circle', info: 'o-information-circle', success: 'o-check-circle', warning: 'o-exclamation-circle' };
export type GlobalSearchResult = { title: string; url: string; details: Record<string, string>; /** Buttons under the result: links (`url()`) or Livewire events (`dispatch()`). */ actions?: any[]; record?: unknown };
export type GlobalSearchCategory = { label: string; results: GlobalSearchResult[] };

/** Search field suffix showing the first key binding for the browser's platform; `null` if the platform is unknown. */
export function keyBindingSuffix(keyBindings: string[], userAgent: string): string | null {
    const first = keyBindings[0];
    if (!first) return null;
    if (/Macintosh|Mac OS/i.test(userAgent)) return first.replace(/alt|option/g, '⌥').replace(/meta|command|mod/g, '⌘').replace(/ctrl/g, '⌃').toUpperCase();
    if (!/Windows|Linux/i.test(userAgent)) return null;
    return first.replace(/option/g, 'alt').replace(/command/g, 'meta').replace(/mod/g, 'ctrl').toUpperCase();
}

export class GlobalSearch extends Component {
    search = '';

    async render(): Promise<string> {
        const { panel, user, req } = (this._ctx ?? {}) as any;
        if (!user || !panel) return '<div class="fi-global-search-ctn"></div>';
        const search = (typeof this.search === 'string' ? this.search : '').slice(0, 1000).trim();
        this.search = typeof this.search === 'string' ? this.search.slice(0, 1000) : '';
        const categories: GlobalSearchCategory[] | null = search === '' ? null : await panel.getGlobalSearchResults(search, user);
        if (categories !== null) this.dispatch('open-global-search-results');
        const count = categories?.reduce((total, category) => total + category.results.length, 0) ?? 0;
        const [one, many] = t('filament-panels::global-search.results_count').split('|');
        const message = count ? (count === 1 ? one : (many ?? one)).replace(':count', String(count)) : t('filament-panels::global-search.no_results_message');
        const id = `global-search-${this.id}`;
        const bindings: string[] = panel.getGlobalSearchKeyBindings();
        const suffix: string | null = panel.getGlobalSearchFieldSuffix(String(req?.headers?.['user-agent'] ?? ''));

        const input = `<input ${new Attributes({
            autocomplete: 'off', maxlength: '1000', placeholder: t('filament-panels::global-search.field.placeholder'), type: 'search', 'wire:key': 'global-search.field.input', id: `${id}-input`,
            'aria-controls': `${id}-results`, 'aria-describedby': `${id}-instructions`, 'x-ref': 'input', [`wire:model.live.debounce.${panel.getGlobalSearchDebounce()}`]: 'search',
            ...(bindings.length ? { [`x-mousetrap.global.${bindings.map((binding) => binding.replace(/\+/g, '-')).join('.')}`]: '$refs.input?.focus()' } : {}),
        }).class(['fi-input', 'fi-input-has-inline-prefix']).toHtml()} />`;
        const focus = "if (! $event.target.closest('.fi-input-wrp-actions')) $dispatch('focus-input')";
        const field = `<div class="fi-input-wrp"><div x-on:click="${e(focus)}" class="fi-input-wrp-prefix fi-input-wrp-prefix-has-content fi-inline">${icon('m-magnifying-glass', { alias: 'panels::global-search.field', attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': 'search' }) })}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': 'search' }))}</div><div class="fi-input-wrp-content-ctn">${input}</div>${suffix ? `<div x-on:click="${e(focus)}" class="fi-input-wrp-suffix fi-inline fi-input-wrp-suffix-has-label"><span class="fi-input-wrp-label">${e(suffix)}</span></div>` : ''}</div>`;

        // Actions of each result: rendered first (async), then placed under the result's link.
        const actionsHtml = new Map<GlobalSearchResult, string[]>();
        for (const [groupIndex, category] of (categories ?? []).entries()) {
            for (const [index, result] of category.results.entries()) {
                const rendered: string[] = [];
                for (const action of result.actions ?? []) {
                    const ctx = { livewire: this as any, component: null as any, operation: null, record: result.record ?? null, get: () => undefined, state: undefined };
                    if (!(await action.isVisible(ctx))) continue;
                    const describedBy = `${id}-group-${groupIndex} ${id}-group-${groupIndex}-result-${index}`;
                    rendered.push(String(await action.toHtml(ctx)).replace(/^<(a|button)\s/, (_m: string, tag: string) => `<${tag} aria-describedby="${e(describedBy)}" data-global-search-action="1" `));
                }
                if (rendered.length) actionsHtml.set(result, rendered);
            }
        }
        let results = '';
        if (categories !== null) {
            results = categories.length === 0
                ? `<p class="fi-global-search-no-results-message">${e(t('filament-panels::global-search.no_results_message'))}</p>`
                : `<ul class="fi-global-search-results">${categories.map((category, groupIndex) => {
                    const groupId = `${id}-group-${groupIndex}`;
                    return `<li class="fi-global-search-result-group"><h3 id="${e(groupId)}" class="fi-global-search-result-group-header">${e(category.label)}</h3><ul class="fi-global-search-result-group-results">${category.results.map((result, index) => {
                        const details = Object.entries(result.details);
                        const actions = actionsHtml.get(result);
                        return `<li class="${actions ? 'fi-global-search-result fi-global-search-result-has-actions' : 'fi-global-search-result'}"><a href="${e(result.url)}" wire:navigate class="fi-global-search-result-link"><h4 id="${e(`${groupId}-result-${index}`)}" class="fi-global-search-result-heading">${e(result.title)}</h4>${details.length ? `<dl class="fi-global-search-result-details">${details.map(([label, value]) => `<div class="fi-global-search-result-detail"><dt class="fi-global-search-result-detail-label">${e(label)}:</dt><dd class="fi-global-search-result-detail-value">${e(value)}</dd></div>`).join('')}</dl>` : ''}</a>${actions ? `<div class="fi-global-search-result-actions">${actions.join('')}</div>` : ''}</li>`;
                    }).join('')}</ul></li>`;
                }).join('')}</ul>`;
        }

        const root = new Attributes({
            'x-data': `filamentGlobalSearch({ loadingMessage: ${js(t('filament-panels::global-search.loading_message'))}, failureMessage: ${js(t('filament-panels::global-search.failure_message'))}, })`,
            'x-on:input': 'if ($event.target === $refs.input) inputChanged($event.target.value)', 'x-on:focusin': 'if ($event.target === $refs.input) reopen()', 'x-on:focusout': 'focusLeft($event)',
            'x-on:keydown': 'keydown($event)', 'x-on:click.outside': 'dismiss()',
            'x-on:open-modal.window.capture': 'if ($refs.results.contains(document.activeElement)) {\n dismiss()\n restoreFocus()\n }',
            'x-on:livewire:navigate.window': 'navigationStarted($event)', 'x-on:livewire:navigated.window': 'navigationCompleted()',
        }).class(['fi-global-search']);
        const region = new Attributes({
            id: `${id}-results`, role: 'region', 'aria-label': t('filament-panels::global-search.results_label'), 'data-query': search, 'data-has-results': categories !== null ? 'true' : 'false', 'data-message': message,
            'x-ref': 'results', 'x-show': 'isOpen', 'x-bind:inert': '! isOpen', 'x-bind:aria-hidden': '! isOpen', 'x-cloak': '', 'x-on:mousedown.self.prevent': '', 'x-on:click': 'linkActivated($event)',
            'x-transition:enter-start': 'fi-transition-enter-start', 'x-transition:leave-end': 'fi-transition-leave-end',
        }).class(['fi-global-search-results-ctn']);
        return `<div class="fi-global-search-ctn">${renderHook('panels::global-search.start')}<div ${root.toHtml()}><div class="fi-global-search-field"><label for="${e(id)}-input" class="fi-sr-only">${e(t('filament-panels::global-search.field.label'))}</label>${field}</div><p id="${e(id)}-instructions" class="fi-sr-only">${e(t('filament-panels::global-search.field.instructions'))}</p><p wire:ignore role="status" aria-atomic="true" x-text="status" class="fi-sr-only"></p><div ${region.toHtml()}>${results}</div></div>${renderHook('panels::global-search.end')}</div>`;
    }
}

/** An action of a database notification: a link or a button (`button`), which may close the notification, dispatch a Livewire event or change its read state. */
export type DatabaseNotificationAction = NotificationActionData;
export type DatabaseNotificationRecord = { id: string; title: string | null; body: string | null; icon: string | null; iconColor: string | null; status: string | null; color?: string | null; actions: DatabaseNotificationAction[]; createdAt: Date | null; unread: boolean };
/** Storage for a user's notifications. `knexNotificationStore()` provides one backed by a `notifications` table. */
export interface DatabaseNotificationStore {
    /** Most recent first; `offset` is the number of notifications to skip (pagination). */
    list(user: string | number, limit: number, offset?: number): Promise<DatabaseNotificationRecord[]>;
    count(user: string | number): Promise<number>;
    unreadCount(user: string | number): Promise<number>;
    send(user: string | number, notification: NotificationData & { actions?: DatabaseNotificationAction[] }): Promise<void>;
    delete(user: string | number, id: string): Promise<void>;
    markAsRead(user: string | number, id: string, read: boolean): Promise<void>;
    markAllAsRead(user: string | number): Promise<void>;
    clear(user: string | number): Promise<void>;
}

const stamp = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');
/**
 * Store backed by a `notifications` table (polymorphic `notifiable_type`/`notifiable_id`, JSON `data` with `format: 'filament'`).
 * Existing rows in that format are read as-is. `mapUrl` rewrites action URLs read from the table.
 */
export function knexNotificationStore(knex: any, options: { table?: string; notifiableType?: string; mapUrl?: (url: string) => string } = {}): DatabaseNotificationStore {
    const table = options.table ?? 'notifications';
    const notifiableType = options.notifiableType ?? 'App\\Models\\User';
    const scope = (user: string | number) => knex(table).where({ notifiable_type: notifiableType, notifiable_id: user }).whereRaw("json_extract(data, '$.format') = ?", ['filament']);
    const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
    return {
        async list(user, limit, offset = 0) {
            const rows = await scope(user).orderBy('created_at', 'desc').limit(limit).offset(Math.max(0, Math.floor(offset)));
            return rows.map((row: any): DatabaseNotificationRecord => {
                let data: any = {};
                try { data = JSON.parse(row.data) ?? {}; } catch { /* unreadable data: empty notification */ }
                const iconName = text(data.icon)?.replace(/^heroicon-/, '') ?? null;
                return {
                    id: String(row.id), title: text(data.title), body: text(data.body), icon: iconName, iconColor: text(data.iconColor), status: text(data.status), color: text(data.color),
                    actions: (Array.isArray(data.actions) ? data.actions : []).slice(0, 10).map((action: unknown) => notificationActionFromArray(action, options.mapUrl)).filter((action: DatabaseNotificationAction | null): action is DatabaseNotificationAction => action !== null),
                    createdAt: row.created_at ? new Date(`${String(row.created_at).replace(' ', 'T').slice(0, 19)}Z`) : null, unread: row.read_at === null || row.read_at === undefined,
                };
            });
        },
        async count(user) { return Number(((await scope(user).count({ n: '*' }).first()) as any)?.n ?? 0); },
        async unreadCount(user) { return Number(((await scope(user).whereNull('read_at').count({ n: '*' }).first()) as any)?.n ?? 0); },
        async send(user, notification) {
            const at = stamp(new Date());
            const data = {
                actions: (notification.actions ?? []).map(notificationActionToArray),
                body: notification.body, color: notification.color ?? null, duration: 'persistent', icon: notification.icon ? `heroicon-${notification.icon}` : null, iconColor: notification.iconColor, status: notification.status, title: notification.title, view: null, viewData: [], format: 'filament',
            };
            await knex(table).insert({ id: notification.id, type: 'Filament\\Notifications\\DatabaseNotification', notifiable_type: notifiableType, notifiable_id: user, data: JSON.stringify(data), read_at: null, created_at: at, updated_at: at });
        },
        async delete(user, id) { await scope(user).where({ id }).delete(); },
        async markAsRead(user, id, read) { await scope(user).where({ id }).update({ read_at: read ? stamp(new Date()) : null }); },
        async markAllAsRead(user) { await scope(user).whereNull('read_at').update({ read_at: stamp(new Date()) }); },
        async clear(user) { await scope(user).delete(); },
    };
}

/** Relative time in English, e.g. "2 days ago". */
export function timeAgo(date: Date, now = new Date()): string {
    const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
    const units: [number, string][] = [[365 * 86400, 'year'], [30 * 86400, 'month'], [7 * 86400, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']];
    for (const [size, name] of units) {
        if (seconds >= size) { const n = Math.floor(seconds / size); return `${n} ${name}${n === 1 ? '' : 's'} ago`; }
    }
    return '0 seconds ago';
}

/** A notification rendered inline in the panel. Title and body are escaped. */
function renderDatabaseNotification(n: DatabaseNotificationRecord): string {
    const color = n.iconColor ?? n.status;
    const status = n.status && Object.hasOwn(STATUS_ICONS, n.status) ? n.status : null;
    const iconHtml = safeIcon(n.icon ?? (status ? STATUS_ICONS[status] : null), 'md', [...(color && color !== 'gray' && /^[a-z]+$/.test(color) ? ['fi-color', `fi-color-${color}`] : []), 'fi-no-notification-icon'], !n.icon && status ? `notifications::notification.${status}` : undefined);
    const closeLabel = t('filament-notifications::notification.actions.close.label');
    const attributes = new Attributes({
        'x-data': `notificationComponent({ notification: ${js({ id: n.id, duration: 'persistent' })} })`,
        'x-transition:enter-start': 'fi-transition-enter-start', 'x-transition:enter-end': 'fi-transition-enter-end', 'x-transition:leave-start': 'fi-transition-leave-start', 'x-transition:leave-end': 'fi-transition-leave-end',
        'wire:key': `${n.id}.notifications.${n.id}`, 'x-on:close-notification.window': `if ($event.detail.id == ${js(n.id)}) close()`,
    }).class([...notificationColorClasses(n.color), 'fi-no-notification', n.status && /^[a-z]+$/.test(n.status) ? `fi-status-${n.status}` : null, 'fi-inline']);
    return `<div ${attributes.toHtml()}>${iconHtml}<div class="fi-no-notification-main"><div class="fi-no-notification-text">${n.title ? `<h3 class="fi-no-notification-title">${e(n.title)}</h3>` : ''}${n.createdAt ? `<time class="fi-no-notification-date">${e(timeAgo(n.createdAt))}</time>` : ''}${n.body ? `<div class="fi-no-notification-body">${notificationBodyHtml(n.body)}</div>` : ''}</div>${notificationActionsHtml(n.actions, { navigate: true })}</div><button type="button" x-on:click="close" aria-label="${e(closeLabel)}" title="${e(closeLabel)}" class="fi-icon-btn fi-no-notification-close-btn">${icon('m-x-mark', { alias: 'notifications::notification.close-button' })}</button></div>`;
}

const BADGE = 'fi-color fi-color-primary fi-text-color-600 dark:fi-text-color-200 fi-badge';
const linkAction = (label: string, method: string, color: string, extra = '') => `<button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-ac-link-action fi-link fi-size-md fi-color fi-color-${color} fi-text-color-600 dark:fi-text-color-300" wire:click="${method}"${extra}>${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': method }))}<span class="fi-link-label">${e(label)}</span></button>`;

/** Bell and slide-over listing the signed-in user's database notifications. */
export class DatabaseNotifications extends Component {
    static callable = ['refresh', 'removeNotification', 'markNotificationAsRead', 'markNotificationAsUnread', 'clearNotifications', 'markAllNotificationsAsRead', 'previousPage', 'nextPage', 'gotoPage'];
    /** Current page of the panel (simple pagination). */
    paginators: Record<string, number> = { 'database-notifications-page': 1 };
    private get notificationsPage(): number { return Math.max(1, Math.min(10_000, Math.floor(Number(this.paginators?.['database-notifications-page']) || 1))); }
    previousPage(): void { this.paginators = { 'database-notifications-page': Math.max(1, this.notificationsPage - 1) }; }
    nextPage(): void { this.paginators = { 'database-notifications-page': this.notificationsPage + 1 }; }
    gotoPage(page: unknown): void { this.paginators = { 'database-notifications-page': Math.max(1, Math.floor(Number(page)) || 1) }; }
    static listeners = { databaseNotificationsSent: 'refresh', notificationClosed: 'removeNotification', markedNotificationAsRead: 'markNotificationAsRead', markedNotificationAsUnread: 'markNotificationAsUnread' };
    /** Notifications per page. */
    static limit = 50;
    isOpen = false;

    /** Store and user come from the server: every operation is restricted to this user's notifications. */
    private get scope(): { store: DatabaseNotificationStore; user: string | number; interval: string | null } {
        const { panel, user } = (this._ctx ?? {}) as any;
        const store: DatabaseNotificationStore | null = panel?.getDatabaseNotifications() ?? null;
        if (!user || !store) throw new WireError(401, 'Unauthenticated.');
        return { store, user: user.id, interval: panel.getDatabaseNotificationsPollingInterval() };
    }
    refresh(): void {}
    async removeNotification(id: unknown): Promise<void> { if (typeof id === 'string' && UUID.test(id)) await this.scope.store.delete(this.scope.user, id); }
    async markNotificationAsRead(id: unknown): Promise<void> { if (typeof id === 'string' && UUID.test(id)) await this.scope.store.markAsRead(this.scope.user, id, true); }
    async markNotificationAsUnread(id: unknown): Promise<void> { if (typeof id === 'string' && UUID.test(id)) await this.scope.store.markAsRead(this.scope.user, id, false); }
    async clearNotifications(): Promise<void> { await this.scope.store.clear(this.scope.user); }
    async markAllNotificationsAsRead(): Promise<void> { await this.scope.store.markAllAsRead(this.scope.user); }

    private trigger(unread: number): string {
        return `<button class="fi-sidebar-database-notifications-btn">${icon('o-bell', { size: 'lg', alias: 'panels::sidebar.open-database-notifications-button' })}<span class="fi-sidebar-database-notifications-btn-label">${e(t('filament-panels::layout.actions.open_database_notifications.label'))}</span>${unread ? `<span class="fi-sidebar-database-notifications-btn-badge-ctn"><span class="${BADGE} fi-size-md"><span class="fi-badge-label-ctn"><span class="fi-badge-label">${unread}</span></span></span></span>` : ''}</button>`;
    }
    async placeholder(): Promise<string> {
        const { panel, user } = (this._ctx ?? {}) as any;
        const store: DatabaseNotificationStore | null = panel?.getDatabaseNotifications() ?? null;
        return `<div>${user && store ? this.trigger(await store.unreadCount(user.id)) : ''}</div>`;
    }

    async render(): Promise<string> {
        const { store, user, interval } = this.scope;
        this.isOpen = this.isOpen === true;
        const limit = (this.constructor as typeof DatabaseNotifications).limit;
        const page = this.notificationsPage;
        const fetched = this.isOpen ? await store.list(user, limit + 1, (page - 1) * limit) : null;
        const hasMore = fetched !== null && fetched.length > limit;
        const notifications = fetched ? fetched.slice(0, limit) : null;
        const unread = await store.unreadCount(user);
        const has = notifications ? notifications.length > 0 : (await store.count(user)) > 0;
        const id = 'database-notifications';
        const close = `$dispatch('close-modal', { id: ${js(id)} })`;
        const key = (part: string) => `${this.id}.modal.${id}.${part}`;
        const closeLabel = t('filament::components/modal.actions.close.label');
        const closeButton = `<button class="fi-icon-btn fi-size-md fi-modal-close-btn" title="${e(closeLabel)}" aria-label="${e(closeLabel)}" tabindex="-1" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" x-on:click="${e(close)}">${icon('o-x-mark', { size: 'lg', alias: 'modal.close-button' })}</button>`;
        const heading = t('filament-notifications::database.modal.heading');

        let header: string;
        let content = '';
        if (has) {
            header = `<div wire:key="${e(key('header'))}" class="fi-modal-header">${closeButton}<div><h2 id="${id}.heading" class="fi-modal-heading">${e(heading)}${unread ? ` <span class="${BADGE} fi-size-xs">${unread}</span>` : ''}</h2><div class="fi-ac">${unread ? linkAction(t('filament-notifications::database.modal.actions.mark_all_as_read.label'), 'markAllNotificationsAsRead', 'primary') : ''}${linkAction(t('filament-notifications::database.modal.actions.clear.label'), 'clearNotifications', 'danger', ' x-on:click="close()"')}</div></div></div>`;
            const body = notifications
                ? `<div aria-label="${e(heading)}" role="list" class="fi-no-notifications">${notifications.map((n) => `<div role="listitem" wire:key="${e(n.id)}.database-notifications.ctn" class="${n.unread ? 'fi-no-notification-unread-ctn' : 'fi-no-notification-read-ctn'}">${n.unread ? `<span class="fi-sr-only">${e(t('filament-notifications::database.modal.unread_label'))}</span>` : ''}${renderDatabaseNotification(n)}</div>`).join('')}</div>`
                : `<div role="status" aria-busy="true" class="fi-no-notifications-loading-ctn">${loadingIndicator()}<span class="fi-sr-only">${e(t('filament::components/loading-section.label'))}</span></div>`;
            content = `<div wire:key="${e(key('content'))}" class="fi-modal-content">${body}</div>`;
            if (notifications && (page > 1 || hasMore)) content += `<div wire:key="${e(key('footer'))}" class="fi-modal-footer fi-align-start">${pagination({ id: this.id, page, perPage: limit, hasMore })}</div>`;
        } else {
            header = `<div wire:key="${e(key('header'))}" class="fi-modal-header">${closeButton}<div class="fi-modal-icon-ctn"><div class="fi-modal-icon-bg">${icon('o-bell-slash', { size: 'lg', alias: 'notifications::database.modal.empty-state' })}</div></div><div><h2 id="${id}.heading" class="fi-modal-heading">${e(t('filament-notifications::database.modal.empty.heading'))}</h2><p id="${id}.description" class="fi-modal-description">${e(t('filament-notifications::database.modal.empty.description'))}</p></div></div>`;
        }

        const modal = new Attributes({
            'aria-labelledby': `${id}.heading`, 'aria-modal': 'true', id, role: 'dialog', tabindex: '-1',
            'x-data': `filamentModal({ id: ${js(id)}, isScrollLocked: true, shouldRestoreFocus: true, })`, 'data-fi-modal-id': id,
            'x-on:close-modal.window': `if (($event.detail.id === ${js(id)}) && isOpen) close()`, 'x-on:close-modal-quietly.window': `if (($event.detail.id === ${js(id)}) && isOpen) closeQuietly()`,
            'x-on:open-modal.window': `if (($event.detail.id === ${js(id)}) && (! isOpen)) open()`, 'x-bind:class': "{ 'fi-modal-open': isOpen, }", 'x-cloak': '', 'x-show': 'isOpen',
        }).class(['fi-modal', 'fi-absolute-positioning-context', 'fi-modal-slide-over', 'fi-modal-slide-over-from-end', has ? 'fi-modal-has-sticky-header' : null, 'fi-no-database']);
        const poll = interval && /^[0-9]+(ms|s)$/.test(interval) ? ` wire:poll.${interval}=""` : '';
        const windowClasses = ['fi-modal-window', 'fi-modal-window-has-close-btn', has ? 'fi-modal-window-has-content' : 'fi-modal-window-has-icon', `fi-align-${has ? 'start' : 'center'}`, 'fi-width-md'].join(' ');
        const transitions = 'x-transition:enter="fi-transition-enter" x-transition:leave="fi-transition-leave" x-transition:enter-start="fi-transition-enter-start" x-transition:enter-end="fi-transition-enter-end" x-transition:leave-start="fi-transition-leave-start" x-transition:leave-end="fi-transition-leave-end"';
        // The window has `autofocus` so the focus trap lands on it, not on "Mark all as read", which Enter would trigger at once.
        const dialog = `<div ${modal.toHtml()}${poll}><div aria-hidden="true" x-show="isOpen" x-transition.duration.300ms.opacity class="fi-modal-close-overlay"></div><div tabindex="-1" x-on:click.self="${e(close)}" x-trap.noreturn="isTrapActive" class="fi-modal-window-ctn fi-clickable"><div x-on:keydown.window.escape="if (isTopmost()) ${e(close)}" x-show="isWindowVisible" ${transitions} wire:key="${e(key('window'))}" tabindex="-1" autofocus="autofocus" class="${windowClasses}">${header}${content}</div></div></div>`;
        const opened = "if ($event.detail.id === 'database-notifications' && ! $wire.isOpen) $wire.set('isOpen', true)";
        const closed = "if ($event.detail.id === 'database-notifications') $wire.set('isOpen', false, false)";
        return `<div x-data x-on:x-modal-opened.window="${e(opened)}" x-on:modal-closed.window="${e(closed)}" class="fi-no-database"><div><div x-on:click="$dispatch('open-modal', { id: 'database-notifications' })" class="fi-modal-trigger">${this.trigger(unread)}</div><template x-teleport="body">${dialog}</template></div></div>`;
    }
}
