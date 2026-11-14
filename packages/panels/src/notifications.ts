// Flash notifications: the Notification builder, a per-browser mailbox, and the component that displays them.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';
import { Attributes, e, icon, icons, js } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { Component, WireError } from '@navette-js/wire';
import { broadcastToUsers, dispatchDatabaseNotificationsSent, NOTIFICATION_BROADCAST_EVENT, type BroadcastOptions, type BroadcastRecipient } from './broadcasting.ts';

export type NotificationActionData = { label: string; url: string | null; openUrlInNewTab: boolean; close?: boolean; dispatch?: { event: string; data: Record<string, unknown> } | null; color?: string | null; button?: boolean };
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
    /**
     * Actions under the text: links (`url`), or buttons that `close` the notification and/or `dispatch` a Livewire event
     * (`{ event: 'undoDelete', data: { id: 5 } }`). `button: true` renders a button instead of a link. Buttons are only shown in
     * flash notifications; the database notifications panel shows the links.
     */
    actions(actions: { label: string; url?: string | null; openUrlInNewTab?: boolean; close?: boolean; dispatch?: { event: string; data?: Record<string, unknown> } | null; color?: string | null; button?: boolean }[]): this {
        this.data.actions = actions.slice(0, 10).map((action) => {
            const event = action.dispatch?.event;
            if (event !== undefined && !/^[A-Za-z0-9_.:-]{1,100}$/.test(event)) throw new Error(`Invalid notification event name: ${event}`);
            return {
                label: String(action.label), url: action.url ?? null, openUrlInNewTab: action.openUrlInNewTab === true, close: action.close === true,
                dispatch: event ? { event, data: action.dispatch?.data ?? {} } : null,
                color: action.color && /^[a-z]+$/.test(action.color) ? action.color : null, button: action.button === true,
            };
        });
        return this;
    }
    getData(): NotificationData { return { ...this.data }; }
    /**
     * Stores the notification for this user (panel bell): `await Notification.make()….sendToDatabase(panel.getDatabaseNotifications(), user)`.
     * Does nothing without a store. With `isEventDispatched`, the user's open pages fetch their notifications at once (broadcasting).
     */
    async sendToDatabase(store: NotificationSink | null, user: BroadcastRecipient, isEventDispatched = false, options: BroadcastOptions = {}): Promise<this> {
        if (!store) return this;
        await store.send(typeof user === 'object' ? user.id : user, { ...this.data, id: randomUUID() });
        if (isEventDispatched) await dispatchDatabaseNotificationsSent(user, options);
        return this;
    }
    /** The notification as sent to the browser by `broadcast()`. */
    getBroadcastMessage(): NotificationData & { format: 'filament' } { return { ...this.data, format: 'filament' }; }
    /**
     * Shows the notification live on the open pages of these users (a user object or id), wherever it is sent from: a request of
     * another user, a queued job, a timer. `options.tenant` limits it to the pages of a tenant (its key), `options.panel` to a panel.
     */
    async broadcast(users: BroadcastRecipient | BroadcastRecipient[], options: BroadcastOptions = {}): Promise<this> {
        await broadcastToUsers(users, NOTIFICATION_BROADCAST_EVENT, this.getBroadcastMessage(), options);
        return this;
    }
    /** Rebuilds a notification from its data (`getBroadcastMessage()`), which may come from the browser: every value is checked. */
    static fromArray(data: unknown): Notification {
        const source = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : null);
        const name = (value: unknown) => (typeof value === 'string' && /^[a-z0-9-]+(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/.test(value) ? value : null);
        const notification = new Notification();
        const id = text(source.id, 100);
        if (id && /^[A-Za-z0-9_-]+$/.test(id)) notification.data.id = id;
        notification.data.title = text(source.title, 1000);
        notification.data.body = text(source.body, 5000);
        notification.data.status = typeof source.status === 'string' && Object.hasOwn(STATUS_ICON, source.status) ? source.status : null;
        notification.data.icon = name(source.icon);
        notification.data.iconColor = typeof source.iconColor === 'string' && /^[a-z]+$/.test(source.iconColor) ? source.iconColor : null;
        notification.data.duration = source.duration === 'persistent' ? 'persistent' : typeof source.duration === 'number' && Number.isFinite(source.duration) ? Math.max(0, Math.min(source.duration, 3_600_000)) : 6000;
        if (Array.isArray(source.actions)) {
            notification.actions(source.actions.filter((action) => action && typeof action === 'object' && typeof (action as any).label === 'string').map((action: any) => ({
                label: action.label.slice(0, 200), url: typeof action.url === 'string' ? action.url : null, openUrlInNewTab: action.openUrlInNewTab === true, close: action.close === true,
                dispatch: action.dispatch && typeof action.dispatch.event === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(action.dispatch.event) ? { event: action.dispatch.event, data: action.dispatch.data && typeof action.dispatch.data === 'object' && !Array.isArray(action.dispatch.data) ? action.dispatch.data : {} } : null,
                color: typeof action.color === 'string' ? action.color : null, button: action.button === true,
            })));
        }
        return notification;
    }
    /** Queues the notification for the browser of the current request. */
    send(): this {
        const store = requestStore.getStore();
        if (!store) throw new Error('Notification.send() must be called while handling a request.');
        store.pending.push({ ...this.data });
        return this;
    }
}

/** Actions of a notification: links (only local or http(s) URLs) and buttons closing it or dispatching a Livewire event. */
function notificationActionsHtml(n: NotificationData): string {
    const safeUrl = (url: string | null) => typeof url === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(url);
    const items = (n.actions ?? []).filter((action) => action.label !== '' && (safeUrl(action.url) || action.close || action.dispatch)).map((action) => {
        const color = action.color ?? 'primary';
        const classes = action.button ? `fi-ac-btn-action fi-btn fi-size-sm` : `fi-ac-link-action fi-link fi-size-sm fi-color fi-color-${color} fi-text-color-600 dark:fi-text-color-400`;
        const label = action.button ? e(action.label) : `<span class="fi-link-label">${e(action.label)}</span>`;
        const clicks = [action.dispatch ? `Livewire.dispatch(${js(action.dispatch.event)}, ${js(action.dispatch.data)})` : null, action.close ? 'close()' : null].filter(Boolean).join('; ');
        if (safeUrl(action.url)) return `<a href="${e(action.url!)}"${action.openUrlInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ''}${clicks ? ` x-on:click="${e(clicks)}"` : ''} class="${classes}">${label}</a>`;
        return `<button type="button" x-on:click="${e(clicks)}" class="${classes}">${label}</button>`;
    });
    return items.length ? `<div class="fi-ac fi-no-notification-actions">${items.join('')}</div>` : '';
}

/** Renders a flash notification (no date or inline mode). Title, body and action labels are escaped. */
export function renderNotification(n: NotificationData): string {
    const closeLabel = t('filament-notifications::notification.actions.close.label');
    const attributes = new Attributes()
        .merge({ role: n.status === 'danger' ? 'alert' : null, 'wire:key': `${n.id}.notifications.${n.id}`, 'x-on:close-notification.window': `if ($event.detail.id == ${js(n.id)}) close()` })
        .class(['fi-no-notification', n.status ? `fi-status-${n.status}` : null]);
    const iconName = n.icon ?? (n.status && Object.hasOwn(STATUS_ICON, n.status) ? icons.resolve(`notifications::notification.${n.status}`) ?? STATUS_ICON[n.status] : null);
    const iconColor = n.iconColor ?? n.status;
    const iconHtml = iconName ? icon(iconName, { size: 'lg', attributes: new Attributes().class([...(iconColor && iconColor !== 'gray' ? ['fi-color', `fi-color-${iconColor}`] : []), 'fi-no-notification-icon']) }) : '';
    return `<div x-data="notificationComponent({ notification: ${e(js({ id: n.id, duration: n.duration }))} })" x-transition:enter-start="fi-transition-enter-start" x-transition:enter-end="fi-transition-enter-end" x-transition:leave-start="fi-transition-leave-start" x-transition:leave-end="fi-transition-leave-end" x-on:mouseenter="pauseDuration('hover')" x-on:mouseleave="resumeDuration('hover')" x-on:focusin="handleFocusIn($event)" x-on:focusout="handleFocusOut($event)" x-on:keydown.escape="handleEscape($event)" ${attributes.toHtml().replace(/"if \(\$event\.detail\.id == '([^']*)'\) close\(\)"/, (_m, id) => `"if ($event.detail.id == '${id}') close()"`)}>${iconHtml}<div class="fi-no-notification-main">${n.title !== null || n.body !== null ? `<div class="fi-no-notification-text">${n.title !== null ? `<h3 class="fi-no-notification-title">${e(n.title)}</h3>` : ''}${n.body !== null ? `<div class="fi-no-notification-body">${e(n.body)}</div>` : ''}</div>` : ''}${notificationActionsHtml(n)}</div><button type="button" x-on:click="dismiss()" aria-label="${e(closeLabel)}" title="${e(closeLabel)}" class="fi-icon-btn fi-no-notification-close-btn">${icon('m-x-mark', { alias: 'notifications::notification.close-button' })}</button></div>`;
}

/** Container component for flash notifications. */
export class Notifications extends Component {
    static callable = ['pullNotifications', 'handleBroadcastNotification'];
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
    /** A notification received live (`Notification.broadcast()`). It comes from the browser: it is rebuilt from checked values. */
    handleBroadcastNotification(notification: unknown = {}): void {
        if (!notification || typeof notification !== 'object' || (notification as Record<string, unknown>).format !== 'filament') return;
        const data = Notification.fromArray(notification).getData();
        // An icon name that is not a known icon is dropped rather than failing the update.
        try { renderNotification(data); } catch { data.icon = null; }
        if (Object.keys(this.notifications).length >= 50) delete this.notifications[Object.keys(this.notifications)[0]];
        this.notifications[data.id] = data;
    }
    /** Listens to the user's broadcast channel when the panel has broadcasting (`panel.broadcasting()`). */
    protected registerBroadcastListener(): void {
        const { panel, user } = (this._ctx ?? {}) as any;
        if (!user || typeof panel?.hasBroadcasting !== 'function' || !panel.hasBroadcasting()) return;
        this.addScript('broadcast-notifications', `setUpFilamentBroadcastNotifications({ $wire, broadcastChannel: ${js(panel.getBroadcastChannel(user))}, event: ${js('.' + NOTIFICATION_BROADCAST_EVENT)}, onNotification: (notification) => $wire.handleBroadcastNotification(notification), })`);
    }
    render(): string {
        this.registerBroadcastListener();
        return `<div x-data="notificationsComponent()" data-filament-notifications="${this.hasPulledNotificationsOnMount ? 'mounted' : 'pending'}"><div class="fi-no fi-align-right fi-vertical-align-start" role="status" aria-atomic="false">${Object.values(this.notifications).map(renderNotification).join('')}</div></div>`;
    }
}
