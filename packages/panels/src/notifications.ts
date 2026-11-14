// Flash notifications: the Notification builder, a per-browser mailbox, and the component that displays them.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';
import { Attributes, HtmlString, e, icon, icons, js, sanitizeHtml } from '@navette-js/support';
import type { Action, ActionGroup } from '@navette-js/actions';
import { normalizeNotificationAction, notificationActionFromArray, notificationActionsHtml, notificationActionToArray, type NotificationActionInput, type NotificationActionItem } from './notification-actions.ts';
export {
    isNotificationActionGroup, normalizeNotificationAction, notificationActionFromArray, notificationActionsHtml, notificationActionToArray, renderNotificationAction,
    renderNotificationActionGroup, safeNotificationAttributes, safeNotificationIcon, safeNotificationUrl, useNotificationsColorManager,
    type NotificationActionData, type NotificationActionDispatch, type NotificationActionGroupData, type NotificationActionInput, type NotificationActionItem, type NotificationActionView,
} from './notification-actions.ts';
import { t } from '@navette-js/support/i18n';
import { Component, WireError } from '@navette-js/wire';
import { broadcastToUsers, dispatchDatabaseNotificationsSent, NOTIFICATION_BROADCAST_EVENT, type BroadcastOptions, type BroadcastRecipient } from './broadcasting.ts';

/** `title` and `body` may hold HTML (Markdown converted with `markdownToHtml()`, for instance): it is sanitized when rendered. */
export type NotificationData = { id: string; title: string | null; body: string | null; status: string | null; color?: string | null; duration: number | 'persistent'; icon: string | null; iconColor: string | null; actions?: NotificationActionItem[] };
/** The part of a notification store needed to write to it (see `DatabaseNotificationStore`). */
type NotificationSink = { send(user: string | number, notification: NotificationData): Promise<void> };
type RequestStore = { mailbox: string; pending: NotificationData[] };

const requestStore = new AsyncLocalStorage<RequestStore>();
let sentNotificationsListener: ((notification: NotificationData) => void) | null = null;
/**
 * Calls `listener` with every notification sent (`null` stops). Used by the testing helpers' `assertNotified()`; while a
 * listener is set, `send()` outside a request records the notification instead of throwing.
 */
export function listenToSentNotifications(listener: ((notification: NotificationData) => void) | null): void { sentNotificationsListener = listener; }
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
const STATUSES = ['success', 'danger', 'warning', 'info'];
/** Notification ids end up in `wire:key` and in an Alpine expression: letters, digits and `_ . : -` only. */
const NOTIFICATION_ID = /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z0-9_.:-]{1,100}$/;
const COLOR = /^[a-z][a-z0-9-]{0,30}$/;
const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value !== '' ? value.slice(0, max) : typeof value === 'number' ? String(value) : null);

export class Notification {
    private data: NotificationData;
    /** `id`: a custom id, to close the notification from JavaScript (`$dispatch('close-notification', { id })`); random by default. */
    constructor(id?: string) {
        if (id !== undefined && !NOTIFICATION_ID.test(id)) throw new Error(`Invalid notification id: ${id}`);
        this.data = { id: id ?? randomUUID(), title: null, body: null, status: null, duration: 6000, icon: null, iconColor: null };
    }
    static make(id?: string): Notification { return new Notification(id); }
    /**
     * A notification in array format (as produced by `NavetteNotification.toJSON()`), e.g. sent from the
     * browser. The data is untrusted: unknown values are dropped and the id is replaced when it is not a safe one.
     */
    static fromArray(raw: unknown): Notification {
        const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        const notification = new Notification(typeof data.id === 'string' && NOTIFICATION_ID.test(data.id) ? data.id : undefined);
        const n = notification.data;
        n.title = text(data.title, 1000);
        n.body = text(data.body, 5000);
        n.status = typeof data.status === 'string' && STATUSES.includes(data.status) ? data.status : null;
        n.color = typeof data.color === 'string' && COLOR.test(data.color) ? data.color : null;
        const icon = typeof data.icon === 'string' ? data.icon.replace(/^heroicon-/, '') : null;
        n.icon = icon && /^[a-z0-9-]+(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/.test(icon) && icon.length <= 100 ? icon : null;
        n.iconColor = typeof data.iconColor === 'string' && COLOR.test(data.iconColor) ? data.iconColor : null;
        n.duration = data.duration === 'persistent' ? 'persistent' : typeof data.duration === 'number' && Number.isFinite(data.duration) && data.duration > 0 ? Math.min(Math.round(data.duration), 86_400_000) : 6000;
        const actions = (Array.isArray(data.actions) ? data.actions : []).slice(0, 10).map((action) => notificationActionFromArray(action)).filter((action): action is NotificationActionItem => action !== null);
        if (actions.length) n.actions = actions;
        return notification;
    }
    getId(): string { return this.data.id; }
    id(id: string): this { if (!NOTIFICATION_ID.test(id)) throw new Error(`Invalid notification id: ${id}`); this.data.id = id; return this; }
    /** Title: text or HTML (an `HtmlString`, or Markdown through `markdownToHtml()`), sanitized when rendered. */
    title(title: string | HtmlString | null): this { this.data.title = title instanceof HtmlString ? title.html : title; return this; }
    /** Body under the title: text or HTML, sanitized when rendered. */
    body(body: string | HtmlString | null): this { this.data.body = body instanceof HtmlString ? body.html : body; return this; }
    getTitle(): string | null { return this.data.title; }
    getBody(): string | null { return this.data.body; }
    status(status: 'success' | 'danger' | 'warning' | 'info'): this { this.data.status = status; return this; }
    success(): this { return this.status('success'); }
    danger(): this { return this.status('danger'); }
    warning(): this { return this.status('warning'); }
    info(): this { return this.status('info'); }
    /** Background color of the notification (`'success'`, `'primary'`…). */
    color(color: string | null): this { this.data.color = color && COLOR.test(color) ? color : null; return this; }
    icon(name: string): this { this.data.icon = name; return this; }
    iconColor(color: string): this { this.data.iconColor = color; return this; }
    duration(ms: number): this { this.data.duration = ms; return this; }
    seconds(seconds: number): this { return this.duration(seconds * 1000); }
    persistent(): this { this.data.duration = 'persistent'; return this; }
    /**
     * Actions under the text: `Action`s of `@navette-js/actions` (`Action.make('view').button().url('/posts/1')`,
     * `.close()`, `.dispatch('undo', { id })`, `.dispatchTo()`, `.dispatchSelf()`, `.markAsRead()`, with `icon()`, `iconPosition()`,
     * `size()`, `tooltip()`, `extraAttributes()`, `disabled()`), `ActionGroup`s (a dropdown), or plain objects
     * (`{ label, url, close, dispatch: { event, data, to | self }, button, … }`). Actions are small links unless they chose a style.
     */
    actions(actions: (Action | ActionGroup | NotificationActionInput)[]): this {
        this.data.actions = actions.slice(0, 10).map((action) => normalizeNotificationAction(action)).filter((action): action is NotificationActionItem => action !== null);
        return this;
    }
    getActions(): NotificationActionItem[] { return [...(this.data.actions ?? [])]; }
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
    /** The notification as sent to the browser by `broadcast()`: its actions in array format, read back by `fromArray()`. */
    getBroadcastMessage(): Omit<NotificationData, 'actions'> & { actions?: Record<string, unknown>[]; format: 'navette' } {
        const { actions, ...data } = this.data;
        return { ...data, ...(actions ? { actions: actions.map(notificationActionToArray) } : {}), format: 'navette' };
    }
    /**
     * Shows the notification live on the open pages of these users (a user object or id), wherever it is sent from: a request of
     * another user, a queued job, a timer. `options.tenant` limits it to the pages of a tenant (its key), `options.panel` to a panel.
     */
    async broadcast(users: BroadcastRecipient | BroadcastRecipient[], options: BroadcastOptions = {}): Promise<this> {
        await broadcastToUsers(users, NOTIFICATION_BROADCAST_EVENT, this.getBroadcastMessage(), options);
        return this;
    }
    /** Queues the notification for the browser of the current request. */
    send(): this {
        const store = requestStore.getStore();
        if (sentNotificationsListener) sentNotificationsListener({ ...this.data });
        if (!store) {
            // Tests (`@navette-js/panels/testing`) record notifications sent outside a request instead of failing.
            if (sentNotificationsListener) return this;
            throw new Error('Notification.send() must be called while handling a request.');
        }
        store.pending.push({ ...this.data });
        return this;
    }
}

/** Classes of a notification's background color (none for gray, the default). */
export const notificationColorClasses = (color: string | null | undefined): string[] => (color && color !== 'gray' && COLOR.test(color) ? ['nv-color', `nv-color-${color}`] : []);

/** Renders a flash notification (no date or inline mode). Title and body are sanitized HTML; action labels are escaped. */
export function renderNotification(n: NotificationData): string {
    const closeLabel = t('navette-notifications::notification.actions.close.label');
    const attributes = new Attributes()
        .merge({ role: n.status === 'danger' ? 'alert' : null, 'wire:key': `${n.id}.notifications.${n.id}`, 'x-on:close-notification.window': `if ($event.detail.id == ${js(n.id)}) close()` })
        .class([...notificationColorClasses(n.color), 'nv-no-notification', n.status ? `nv-status-${n.status}` : null]);
    const iconName = n.icon ?? (n.status && Object.hasOwn(STATUS_ICON, n.status) ? icons.resolve(`notifications::notification.${n.status}`) ?? STATUS_ICON[n.status] : null);
    const iconColor = n.iconColor ?? n.status;
    const iconClasses = [...(iconColor && iconColor !== 'gray' ? ['nv-color', `nv-color-${iconColor}`] : []), 'nv-no-notification-icon'];
    // An icon that does not exist (a name sent from the browser) is left out instead of failing the whole render.
    let iconHtml = '';
    try { iconHtml = iconName ? icon(iconName, { size: 'lg', attributes: new Attributes().class(iconClasses) }) : ''; } catch { iconHtml = ''; }
    return `<div x-data="notificationComponent({ notification: ${e(js({ id: n.id, duration: n.duration }))} })" x-transition:enter-start="nv-transition-enter-start" x-transition:enter-end="nv-transition-enter-end" x-transition:leave-start="nv-transition-leave-start" x-transition:leave-end="nv-transition-leave-end" x-on:mouseenter="pauseDuration('hover')" x-on:mouseleave="resumeDuration('hover')" x-on:focusin="handleFocusIn($event)" x-on:focusout="handleFocusOut($event)" x-on:keydown.escape="handleEscape($event)" ${attributes.toHtml().replace(/"if \(\$event\.detail\.id == '([^']*)'\) close\(\)"/, (_m, id) => `"if ($event.detail.id == '${id}') close()"`)}>${iconHtml}<div class="nv-no-notification-main">${n.title !== null || n.body !== null ? `<div class="nv-no-notification-text">${n.title !== null ? `<h3 class="nv-no-notification-title">${sanitizeHtml(n.title)}</h3>` : ''}${n.body !== null ? `<div class="nv-no-notification-body">${sanitizeHtml(n.body)}</div>` : ''}</div>` : ''}${notificationActionsHtml(n.actions)}</div><button type="button" x-on:click="dismiss()" aria-label="${e(closeLabel)}" title="${e(closeLabel)}" class="nv-icon-btn nv-no-notification-close-btn">${icon('m-x-mark', { alias: 'notifications::notification.close-button' })}</button></div>`;
}

export type NotificationsAlignment = 'start' | 'center' | 'end' | 'left' | 'right';
export type NotificationsVerticalAlignment = 'start' | 'center' | 'end';
/** At most this many flash notifications are kept on the page: the oldest go first. */
const MAX_NOTIFICATIONS = 20;

/** Container component for flash notifications. */
export class Notifications extends Component {
    static callable = ['pullNotifications', 'pushNotificationFromEvent', 'removeNotification', 'handleBroadcastNotification'];
    isNavetteNotificationsComponent = true;
    notifications: Record<string, NotificationData> = {};
    hasPulledNotificationsOnMount = false;
    static locked = ['isNavetteNotificationsComponent', 'notifications', 'hasPulledNotificationsOnMount'];
    static listeners = { notificationsSent: 'pullNotifications', notificationSent: 'pushNotificationFromEvent', notificationClosed: 'removeNotification' };
    private static _alignment: NotificationsAlignment = 'right';
    private static _verticalAlignment: NotificationsVerticalAlignment = 'start';
    /** Horizontal position of the notifications (`'right'` by default), for every panel of the process. */
    static alignment(alignment: NotificationsAlignment): void {
        if (!['start', 'center', 'end', 'left', 'right'].includes(alignment)) throw new Error(`Invalid notifications alignment: ${alignment}`);
        Notifications._alignment = alignment;
    }
    /** Vertical position of the notifications (`'start'`, the top, by default). */
    static verticalAlignment(alignment: NotificationsVerticalAlignment): void {
        if (!['start', 'center', 'end'].includes(alignment)) throw new Error(`Invalid notifications vertical alignment: ${alignment}`);
        Notifications._verticalAlignment = alignment;
    }
    static getAlignment(): NotificationsAlignment { return Notifications._alignment; }
    static getVerticalAlignment(): NotificationsVerticalAlignment { return Notifications._verticalAlignment; }

    private get mailbox(): string { return String((this._ctx as any)?.mailbox ?? ''); }

    /** On a full document load (not SPA navigation or prefetch), pending notifications are pulled right away. */
    mount(): void {
        const req = (this._ctx as any)?.req;
        if (!req || req.method !== 'GET' || req.headers['sec-fetch-dest'] !== 'document' || req.headers['x-livewire-navigate'] !== undefined || String(req.headers['sec-purpose'] ?? '').toLowerCase().includes('prefetch')) return;
        for (const n of pull(this.mailbox, null)) this.pushNotification(n);
        this.hasPulledNotificationsOnMount = true;
    }
    pullNotifications(batches: unknown = []): void {
        if (!Array.isArray(batches) || batches.length > 50 || batches.some((b) => typeof b !== 'string' || !/^[a-f0-9]{40}$/.test(b))) throw new WireError(422, 'Invalid notification batches.');
        for (const n of pull(this.mailbox, batches as string[])) this.pushNotification(n);
    }
    pullNotificationsFromSession(batches: unknown = []): void { this.pullNotifications(batches); }
    /** A notification sent from JavaScript (`new NavetteNotification().title('Saved').send()`): its data comes from the browser and is checked. */
    pushNotificationFromEvent(notification: unknown): void {
        if (!notification || typeof notification !== 'object' || Array.isArray(notification)) return;
        this.pushNotification(Notification.fromArray(notification).getData());
    }
    removeNotification(id: unknown): void { if (typeof id === 'string') delete this.notifications[id]; }
    protected pushNotification(notification: NotificationData): void {
        delete this.notifications[notification.id];
        this.notifications[notification.id] = notification;
        const ids = Object.keys(this.notifications);
        for (const id of ids.slice(0, Math.max(0, ids.length - MAX_NOTIFICATIONS))) delete this.notifications[id];
    }
    /** A notification received live (`Notification.broadcast()`). It comes from the browser: it is rebuilt from checked values. */
    handleBroadcastNotification(notification: unknown = {}): void {
        if (!notification || typeof notification !== 'object' || (notification as Record<string, unknown>).format !== 'navette') return;
        const data = Notification.fromArray(notification).getData();
        // An icon name that is not a known icon is dropped rather than failing the update.
        try { renderNotification(data); } catch { data.icon = null; }
        this.pushNotification(data);
    }
    /** Listens to the user's broadcast channel when the panel has broadcasting (`panel.broadcasting()`). */
    protected registerBroadcastListener(): void {
        const { panel, user } = (this._ctx ?? {}) as any;
        if (!user || typeof panel?.hasBroadcasting !== 'function' || !panel.hasBroadcasting()) return;
        this.addScript('broadcast-notifications', `setUpNavetteBroadcastNotifications({ $wire, broadcastChannel: ${js(panel.getBroadcastChannel(user))}, event: ${js('.' + NOTIFICATION_BROADCAST_EVENT)}, onNotification: (notification) => $wire.handleBroadcastNotification(notification), })`);
    }
    render(): string {
        this.registerBroadcastListener();
        return `<div x-data="notificationsComponent()" data-navette-notifications="${this.hasPulledNotificationsOnMount ? 'mounted' : 'pending'}"><div class="nv-no nv-align-${Notifications._alignment} nv-vertical-align-${Notifications._verticalAlignment}" role="status" aria-atomic="false">${Object.values(this.notifications).map(renderNotification).join('')}</div></div>`;
    }
}
