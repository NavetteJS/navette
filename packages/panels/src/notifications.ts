// Flash notifications: the Notification builder, a per-browser mailbox, and the component that displays them.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';
import { Attributes, e, icon, icons, js, type ColorManager } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { Component, WireError } from '@navette-js/wire';

/** A Livewire event dispatched by a notification action: to every component, to the component showing it (`self`), or to a component by name (`to`). */
export type NotificationActionDispatch = { event: string; data: Record<string, unknown> | unknown[]; direction?: 'self' | 'to' | null; component?: string | null };
export type NotificationActionData = {
    label: string; url: string | null; openUrlInNewTab: boolean; close?: boolean; dispatch?: NotificationActionDispatch | null; color?: string | null; button?: boolean; outlined?: boolean;
    /** Database notifications only: marks the notification as read (or unread) when clicked. */
    markAsRead?: boolean; markAsUnread?: boolean;
};
export type NotificationData = { id: string; title: string | null; body: string | null; status: string | null; color?: string | null; duration: number | 'persistent'; icon: string | null; iconColor: string | null; actions?: NotificationActionData[] };
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
const STATUSES = ['success', 'danger', 'warning', 'info'];
/** Notification ids end up in `wire:key` and in an Alpine expression: letters, digits and `_ . : -` only. */
const NOTIFICATION_ID = /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z0-9_.:-]{1,100}$/;
const EVENT_NAME = /^[A-Za-z0-9_.:-]{1,100}$/;
const COMPONENT_NAME = /^[A-Za-z0-9_.:\\-]{1,200}$/;
const COLOR = /^[a-z][a-z0-9-]{0,30}$/;
/** Only a same-site path (`/…`) or an http(s) URL can become a link (no `javascript:`, `data:` or protocol-relative URLs). */
export const safeNotificationUrl = (url: unknown): string | null => (typeof url === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(url) ? url : null);
/** Icon names that come from the browser or the database are untrusted: only a Heroicons-like name or `prefix:name` (an icon of a registered set). */
export const safeNotificationIcon = (name: string | null, size: string, classes: string[], alias?: string): string => {
    if (!name || !/^[a-z0-9-]+(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/.test(name)) return '';
    try { return icon(name, { size, alias, attributes: new Attributes().class(classes) }); } catch { return ''; }
};

let colorManager: ColorManager | null = null;
/** Sets the color manager used for the notification action buttons and links (the panel's). */
export const useNotificationsColorManager = (manager: ColorManager) => { colorManager = manager; };
const actionColorClasses = (component: 'button' | 'button-outlined' | 'link', color: string): string[] => {
    if (colorManager) return color === 'gray' && component === 'button' ? [] : colorManager.getComponentClasses(component, color);
    return component === 'link' ? ['fi-color', `fi-color-${color}`, 'fi-text-color-600', 'dark:fi-text-color-300'] : [];
};

/** Filament's default action label: the name, in words, capitalized (`undoEdit` → "Undo edit"). */
const labelFromName = (name: string): string => {
    const words = name.split('.')[0].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[-_]+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
};
/** JSON data of an event, copied and kept small (it is rendered in the page). */
const eventData = (data: unknown): Record<string, unknown> | unknown[] => {
    if (data === null || data === undefined || typeof data !== 'object') return {};
    let json: string;
    try { json = JSON.stringify(data); } catch { return {}; }
    return json.length <= 2000 ? JSON.parse(json) : {};
};
const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value !== '' ? value.slice(0, max) : typeof value === 'number' ? String(value) : null);

/**
 * Reads an action in Filament's array format (`Action::toArray()`, `FilamentNotificationAction.toJSON()`), as stored in the
 * `notifications` table or sent from the browser. Untrusted: unknown values are dropped, URLs are checked when rendered.
 * Action groups (`actions` key) are not supported and give `null`.
 */
export function notificationActionFromArray(raw: unknown, mapUrl?: (url: string) => string): NotificationActionData | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || 'actions' in raw) return null;
    const action = raw as Record<string, unknown>;
    const name = text(action.name, 100);
    const label = text(action.label, 200) ?? (name ? labelFromName(name) : null);
    if (!label) return null;
    const event = typeof action.event === 'string' && EVENT_NAME.test(action.event) ? action.event : null;
    const direction = action.dispatchDirection === 'self' || action.dispatchDirection === 'to' ? action.dispatchDirection : null;
    const component = typeof action.dispatchToComponent === 'string' && COMPONENT_NAME.test(action.dispatchToComponent) ? action.dispatchToComponent : null;
    const url = typeof action.url === 'string' && action.url !== '' ? (mapUrl ? mapUrl(action.url) : action.url).slice(0, 2000) : null;
    return {
        label, url, openUrlInNewTab: action.shouldOpenUrlInNewTab === true, close: action.shouldClose === true,
        dispatch: event && (direction !== 'to' || component) ? { event, data: eventData(action.eventData), direction, component: direction === 'to' ? component : null } : null,
        color: typeof action.color === 'string' && COLOR.test(action.color) ? action.color : null,
        button: action.view === 'filament::components.button.index', outlined: action.isOutlined === true,
        markAsRead: action.shouldMarkAsRead === true, markAsUnread: action.shouldMarkAsUnread === true,
    };
}
/** Writes an action in Filament's array format (for the `notifications` table). */
export function notificationActionToArray(action: NotificationActionData): Record<string, unknown> {
    return {
        name: action.label, color: action.color ?? null, event: action.dispatch?.event ?? null, eventData: action.dispatch?.data ?? [], dispatchDirection: action.dispatch?.direction ?? false,
        dispatchToComponent: action.dispatch?.component ?? null, extraAttributes: [], icon: null, iconPosition: 'before', iconSize: null, isOutlined: action.outlined === true, isDisabled: false,
        label: action.label, shouldClose: action.close === true, shouldMarkAsRead: action.markAsRead === true, shouldMarkAsUnread: action.markAsUnread === true,
        shouldOpenUrlInNewTab: action.openUrlInNewTab, size: 'sm', tooltip: null, url: action.url, view: action.button ? 'filament::components.button.index' : 'filament::components.link',
    };
}

export type NotificationActionInput = {
    label: string; url?: string | null; openUrlInNewTab?: boolean; close?: boolean; color?: string | null; button?: boolean; outlined?: boolean; markAsRead?: boolean; markAsUnread?: boolean;
    /** `to`: name of the component receiving the event; `self`: only the component showing the notification. */
    dispatch?: { event: string; data?: Record<string, unknown> | unknown[]; to?: string; self?: boolean } | null;
};

export class Notification {
    private data: NotificationData;
    /** `id`: a custom id, to close the notification from JavaScript (`$dispatch('close-notification', { id })`); random by default. */
    constructor(id?: string) {
        if (id !== undefined && !NOTIFICATION_ID.test(id)) throw new Error(`Invalid notification id: ${id}`);
        this.data = { id: id ?? randomUUID(), title: null, body: null, status: null, duration: 6000, icon: null, iconColor: null };
    }
    static make(id?: string): Notification { return new Notification(id); }
    /**
     * A notification in Filament's array format (`Notification::toArray()`, `FilamentNotification.toJSON()`), e.g. sent from the
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
        const actions = (Array.isArray(data.actions) ? data.actions : []).slice(0, 10).map((action) => notificationActionFromArray(action)).filter((action): action is NotificationActionData => action !== null);
        if (actions.length) n.actions = actions;
        return notification;
    }
    getId(): string { return this.data.id; }
    id(id: string): this { if (!NOTIFICATION_ID.test(id)) throw new Error(`Invalid notification id: ${id}`); this.data.id = id; return this; }
    title(title: string): this { this.data.title = title; return this; }
    body(body: string): this { this.data.body = body; return this; }
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
     * Actions under the text: links (`url`), or buttons that `close` the notification and/or `dispatch` a Livewire event
     * (`{ event: 'undoDelete', data: { id: 5 } }`, `to: 'component-name'` or `self: true` to target one component). `button: true` renders
     * a button instead of a link. In database notifications, `markAsRead` / `markAsUnread` change the read state of the notification.
     */
    actions(actions: NotificationActionInput[]): this {
        this.data.actions = actions.slice(0, 10).map((action) => {
            const event = action.dispatch?.event;
            if (event !== undefined && !EVENT_NAME.test(event)) throw new Error(`Invalid notification event name: ${event}`);
            const to = action.dispatch?.to;
            if (to !== undefined && !COMPONENT_NAME.test(to)) throw new Error(`Invalid component name: ${to}`);
            return {
                label: String(action.label), url: action.url ?? null, openUrlInNewTab: action.openUrlInNewTab === true, close: action.close === true,
                dispatch: event ? { event, data: action.dispatch?.data ?? {}, direction: to ? 'to' : action.dispatch?.self ? 'self' : null, component: to ?? null } : null,
                color: action.color && COLOR.test(action.color) ? action.color : null, button: action.button === true, outlined: action.outlined === true,
                markAsRead: action.markAsRead === true, markAsUnread: action.markAsUnread === true,
            };
        });
        return this;
    }
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

/**
 * One action of a notification: a link (only a local or http(s) URL) or a button. Like Filament, the Alpine handler closes the
 * notification or changes its read state, and the Livewire handler dispatches the event. `navigate`: local links use `wire:navigate`.
 */
export function renderNotificationAction(action: NotificationActionData, options: { navigate?: boolean } = {}): string {
    const url = safeNotificationUrl(action.url);
    if (action.label === '' || !(url || action.close || action.dispatch || action.markAsRead || action.markAsUnread)) return '';
    const color = action.color ?? 'primary';
    const classes = action.button
        ? ['fi-ac-btn-action', 'fi-btn', 'fi-size-sm', ...(action.outlined ? ['fi-outlined', ...actionColorClasses('button-outlined', color)] : actionColorClasses('button', color))]
        : ['fi-ac-link-action', 'fi-link', 'fi-size-sm', ...actionColorClasses('link', color)];
    const dispatch = action.dispatch;
    const livewire = dispatch
        ? dispatch.direction === 'to' && dispatch.component ? `Livewire.dispatchTo(${js(dispatch.component)}, ${js(dispatch.event)}, ${js(dispatch.data)})`
        : dispatch.direction === 'self' ? `$wire.$dispatchSelf(${js(dispatch.event)}, ${js(dispatch.data)})`
        : `Livewire.dispatch(${js(dispatch.event)}, ${js(dispatch.data)})`
        : null;
    const alpine = action.close ? (url && !action.openUrlInNewTab ? 'close(true)' : 'close()') : action.markAsRead ? 'markAsRead()' : action.markAsUnread ? 'markAsUnread()' : null;
    const click = [livewire, alpine].filter(Boolean).join('; ');
    const label = action.button ? e(action.label) : `<span class="fi-link-label">${e(action.label)}</span>`;
    const onClick = click ? ` x-on:click="${e(click)}"` : '';
    if (url) return `<a href="${e(url)}"${action.openUrlInNewTab ? ' target="_blank" rel="noopener noreferrer"' : url.startsWith('/') && options.navigate ? ' wire:navigate' : ''}${onClick} class="${e(classes.join(' '))}">${label}</a>`;
    return `<button type="button"${onClick} class="${e(classes.join(' '))}">${label}</button>`;
}
/** Actions of a notification: links and buttons closing it, dispatching a Livewire event, or changing its read state. */
export function notificationActionsHtml(actions: NotificationActionData[] | undefined, options: { navigate?: boolean } = {}): string {
    const items = (actions ?? []).map((action) => renderNotificationAction(action, options)).filter(Boolean);
    return items.length ? `<div class="fi-ac fi-no-notification-actions">${items.join('')}</div>` : '';
}
/** Classes of a notification's background color (none for gray, the default). */
export const notificationColorClasses = (color: string | null | undefined): string[] => (color && color !== 'gray' && COLOR.test(color) ? ['fi-color', `fi-color-${color}`] : []);

/** Renders a flash notification (no date or inline mode). Title, body and action labels are escaped. */
export function renderNotification(n: NotificationData): string {
    const closeLabel = t('filament-notifications::notification.actions.close.label');
    const attributes = new Attributes()
        .merge({ role: n.status === 'danger' ? 'alert' : null, 'wire:key': `${n.id}.notifications.${n.id}`, 'x-on:close-notification.window': `if ($event.detail.id == ${js(n.id)}) close()` })
        .class([...notificationColorClasses(n.color), 'fi-no-notification', n.status ? `fi-status-${n.status}` : null]);
    const iconName = n.icon ?? (n.status && Object.hasOwn(STATUS_ICON, n.status) ? icons.resolve(`notifications::notification.${n.status}`) ?? STATUS_ICON[n.status] : null);
    const iconColor = n.iconColor ?? n.status;
    const iconClasses = [...(iconColor && iconColor !== 'gray' ? ['fi-color', `fi-color-${iconColor}`] : []), 'fi-no-notification-icon'];
    // An icon that does not exist (a name sent from the browser) is left out instead of failing the whole render.
    let iconHtml = '';
    try { iconHtml = iconName ? icon(iconName, { size: 'lg', attributes: new Attributes().class(iconClasses) }) : ''; } catch { iconHtml = ''; }
    return `<div x-data="notificationComponent({ notification: ${e(js({ id: n.id, duration: n.duration }))} })" x-transition:enter-start="fi-transition-enter-start" x-transition:enter-end="fi-transition-enter-end" x-transition:leave-start="fi-transition-leave-start" x-transition:leave-end="fi-transition-leave-end" x-on:mouseenter="pauseDuration('hover')" x-on:mouseleave="resumeDuration('hover')" x-on:focusin="handleFocusIn($event)" x-on:focusout="handleFocusOut($event)" x-on:keydown.escape="handleEscape($event)" ${attributes.toHtml().replace(/"if \(\$event\.detail\.id == '([^']*)'\) close\(\)"/, (_m, id) => `"if ($event.detail.id == '${id}') close()"`)}>${iconHtml}<div class="fi-no-notification-main">${n.title !== null || n.body !== null ? `<div class="fi-no-notification-text">${n.title !== null ? `<h3 class="fi-no-notification-title">${e(n.title)}</h3>` : ''}${n.body !== null ? `<div class="fi-no-notification-body">${e(n.body)}</div>` : ''}</div>` : ''}${notificationActionsHtml(n.actions)}</div><button type="button" x-on:click="dismiss()" aria-label="${e(closeLabel)}" title="${e(closeLabel)}" class="fi-icon-btn fi-no-notification-close-btn">${icon('m-x-mark', { alias: 'notifications::notification.close-button' })}</button></div>`;
}

export type NotificationsAlignment = 'start' | 'center' | 'end' | 'left' | 'right';
export type NotificationsVerticalAlignment = 'start' | 'center' | 'end';
/** At most this many flash notifications are kept on the page: the oldest go first. */
const MAX_NOTIFICATIONS = 20;

/** Container component for flash notifications. */
export class Notifications extends Component {
    static callable = ['pullNotifications', 'pushNotificationFromEvent', 'removeNotification'];
    isFilamentNotificationsComponent = true;
    notifications: Record<string, NotificationData> = {};
    hasPulledNotificationsOnMount = false;
    static locked = ['isFilamentNotificationsComponent', 'notifications', 'hasPulledNotificationsOnMount'];
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
    /** A notification sent from JavaScript (`new FilamentNotification().title('Saved').send()`): its data comes from the browser and is checked. */
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
    render(): string {
        return `<div x-data="notificationsComponent()" data-filament-notifications="${this.hasPulledNotificationsOnMount ? 'mounted' : 'pending'}"><div class="fi-no fi-align-${Notifications._alignment} fi-vertical-align-${Notifications._verticalAlignment}" role="status" aria-atomic="false">${Object.values(this.notifications).map(renderNotification).join('')}</div></div>`;
    }
}
