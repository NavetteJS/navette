// Flash notifications: the Notification builder, a per-browser mailbox, and the component that displays them.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';
import { Attributes, e, icon, js } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { Component, WireError } from '@navette-js/wire';

export type NotificationActionData = { label: string; url: string | null; openUrlInNewTab: boolean };
export type NotificationData = { id: string; title: string | null; body: string | null; status: string | null; duration: number | 'persistent'; icon: string | null; iconColor: string | null; actions?: NotificationActionData[] };
/** The part of a notification store needed to write to it (see `DatabaseNotificationStore`). */
type NotificationSink = { send(user: string | number, notification: NotificationData): Promise<void> };
type RequestStore = { mailbox: string; pending: NotificationData[] };

const requestStore = new AsyncLocalStorage<RequestStore>();
/** Runs `fn` in a request context, where `Notification.send()` queues its notifications. */
export function runInRequest<T>(mailbox: string, fn: () => Promise<T>): Promise<{ result: T; pending: NotificationData[] }> {
    const store: RequestStore = { mailbox, pending: [] };
    return requestStore.run(store, async () => ({ result: await fn(), pending: store.pending }));
}

// In-memory mailbox, keyed by browser (the CSRF token) then by batch.
const mailboxes = new Map<string, Map<string, { at: number; notifications: NotificationData[] }>>();
const TTL = 5 * 60 * 1000;
export function publish(mailbox: string, notifications: NotificationData[]): string {
    const batch = randomBytes(20).toString('hex');
    const box = mailboxes.get(mailbox) ?? new Map();
    for (const [key, entry] of box) if (Date.now() - entry.at > TTL) box.delete(key);
    box.set(batch, { at: Date.now(), notifications });
    mailboxes.set(mailbox, box);
    return batch;
}
/** Removes and returns the notifications of the given batches (all of them if `batches` is null). */
export function pull(mailbox: string, batches: string[] | null): NotificationData[] {
    const box = mailboxes.get(mailbox);
    if (!box) return [];
    const out: NotificationData[] = [];
    for (const key of batches ?? [...box.keys()]) {
        const entry = box.get(key);
        if (entry) { out.push(...entry.notifications); box.delete(key); }
    }
    return out;
}

const STATUS_ICON: Record<string, string> = { danger: 'o-x-circle', info: 'o-information-circle', success: 'o-check-circle', warning: 'o-exclamation-circle' };

export class Notification {
    private data: NotificationData = { id: randomUUID(), title: null, body: null, status: null, duration: 6000, icon: null, iconColor: null };
    static make(): Notification { return new Notification(); }
    title(title: string): this { this.data.title = title; return this; }
    body(body: string): this { this.data.body = body; return this; }
    status(status: 'success' | 'danger' | 'warning' | 'info'): this { this.data.status = status; return this; }
    success(): this { return this.status('success'); }
    danger(): this { return this.status('danger'); }
    warning(): this { return this.status('warning'); }
    info(): this { return this.status('info'); }
    icon(name: string): this { this.data.icon = name; return this; }
    iconColor(color: string): this { this.data.iconColor = color; return this; }
    duration(ms: number): this { this.data.duration = ms; return this; }
    persistent(): this { this.data.duration = 'persistent'; return this; }
    /** Links shown under the text. Only displayed in the database notifications panel. */
    actions(actions: { label: string; url?: string | null; openUrlInNewTab?: boolean }[]): this { this.data.actions = actions.slice(0, 10).map((action) => ({ label: String(action.label), url: action.url ?? null, openUrlInNewTab: action.openUrlInNewTab === true })); return this; }
    getData(): NotificationData { return { ...this.data }; }
    /** Stores the notification for this user (panel bell): `await Notification.make()….sendToDatabase(panel.getDatabaseNotifications(), user.id)`. Does nothing without a store. */
    async sendToDatabase(store: NotificationSink | null, user: string | number): Promise<this> { if (store) await store.send(user, { ...this.data, id: randomUUID() }); return this; }
    /** Queues the notification for the browser of the current request. */
    send(): this {
        const store = requestStore.getStore();
        if (!store) throw new Error('Notification.send() must be called while handling a request.');
        store.pending.push({ ...this.data });
        return this;
    }
}

/** Links of a notification: only local or http(s) URLs. */
function notificationActionsHtml(n: NotificationData): string {
    const links = (n.actions ?? []).filter((action) => action.label !== '' && typeof action.url === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(action.url)).map((action) => `<a href="${e(action.url!)}"${action.openUrlInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ''} class="fi-ac-link-action fi-link fi-size-sm fi-color fi-color-primary fi-text-color-600 dark:fi-text-color-400"><span class="fi-link-label">${e(action.label)}</span></a>`);
    return links.length ? `<div class="fi-ac fi-no-notification-actions">${links.join('')}</div>` : '';
}

/** Renders a flash notification (no date or inline mode). Title, body and action labels are escaped. */
export function renderNotification(n: NotificationData): string {
    const closeLabel = t('filament-notifications::notification.actions.close.label');
    const attributes = new Attributes()
        .merge({ role: n.status === 'danger' ? 'alert' : null, 'wire:key': `${n.id}.notifications.${n.id}`, 'x-on:close-notification.window': `if ($event.detail.id == ${js(n.id)}) close()` })
        .class(['fi-no-notification', n.status ? `fi-status-${n.status}` : null]);
    const iconName = n.icon ?? (n.status ? STATUS_ICON[n.status] : null);
    const iconColor = n.iconColor ?? n.status;
    const iconHtml = iconName ? icon(iconName, { size: 'lg', attributes: new Attributes().class([...(iconColor && iconColor !== 'gray' ? ['fi-color', `fi-color-${iconColor}`] : []), 'fi-no-notification-icon']) }) : '';
    return `<div x-data="notificationComponent({ notification: ${e(js({ id: n.id, duration: n.duration }))} })" x-transition:enter-start="fi-transition-enter-start" x-transition:enter-end="fi-transition-enter-end" x-transition:leave-start="fi-transition-leave-start" x-transition:leave-end="fi-transition-leave-end" x-on:mouseenter="pauseDuration('hover')" x-on:mouseleave="resumeDuration('hover')" x-on:focusin="handleFocusIn($event)" x-on:focusout="handleFocusOut($event)" x-on:keydown.escape="handleEscape($event)" ${attributes.toHtml().replace(/"if \(\$event\.detail\.id == '([^']*)'\) close\(\)"/, (_m, id) => `"if ($event.detail.id == '${id}') close()"`)}>${iconHtml}<div class="fi-no-notification-main">${n.title !== null || n.body !== null ? `<div class="fi-no-notification-text">${n.title !== null ? `<h3 class="fi-no-notification-title">${e(n.title)}</h3>` : ''}${n.body !== null ? `<div class="fi-no-notification-body">${e(n.body)}</div>` : ''}</div>` : ''}${notificationActionsHtml(n)}</div><button type="button" x-on:click="dismiss()" aria-label="${e(closeLabel)}" title="${e(closeLabel)}" class="fi-icon-btn fi-no-notification-close-btn">${icon('m-x-mark')}</button></div>`;
}

/** Container component for flash notifications. */
export class Notifications extends Component {
    static callable = ['pullNotifications'];
    isFilamentNotificationsComponent = true;
    notifications: Record<string, NotificationData> = {};
    hasPulledNotificationsOnMount = false;
    static locked = ['isFilamentNotificationsComponent', 'notifications', 'hasPulledNotificationsOnMount'];
    static listeners = { notificationsSent: 'pullNotifications', notificationClosed: 'removeNotification' };

    private get mailbox(): string { return String((this._ctx as any)?.mailbox ?? ''); }

    /** On a full document load (not SPA navigation or prefetch), pending notifications are pulled right away. */
    mount(): void {
        const req = (this._ctx as any)?.req;
        if (!req || req.method !== 'GET' || req.headers['sec-fetch-dest'] !== 'document' || req.headers['x-livewire-navigate'] !== undefined || String(req.headers['sec-purpose'] ?? '').toLowerCase().includes('prefetch')) return;
        for (const n of pull(this.mailbox, null)) this.notifications[n.id] = n;
        this.hasPulledNotificationsOnMount = true;
    }
    pullNotifications(batches: unknown = []): void {
        if (!Array.isArray(batches) || batches.length > 50 || batches.some((b) => typeof b !== 'string' || !/^[a-f0-9]{40}$/.test(b))) throw new WireError(422, 'Invalid notification batches.');
        for (const n of pull(this.mailbox, batches as string[])) this.notifications[n.id] = n;
    }
    pullNotificationsFromSession(batches: unknown = []): void { this.pullNotifications(batches); }
    removeNotification(id: unknown): void { if (typeof id === 'string') delete this.notifications[id]; }
    render(): string {
        return `<div x-data="notificationsComponent()" data-filament-notifications="${this.hasPulledNotificationsOnMount ? 'mounted' : 'pending'}"><div class="fi-no fi-align-right fi-vertical-align-start" role="status" aria-atomic="false">${Object.values(this.notifications).map(renderNotification).join('')}</div></div>`;
    }
}
