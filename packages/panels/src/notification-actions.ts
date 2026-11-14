// Actions of notifications (flash, database and broadcast): their array format, checked, and their markup.
import { Attributes, cls, e, icon, icons, js, type ColorManager, isSpaNavigableUrl, localOrHttpUrl } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { Action, ActionGroup } from '@navette-js/actions';

/** A Livewire event dispatched by a notification action: to every component, to the component showing it (`self`), or to a component by name (`to`). */
export type NotificationActionDispatch = { event: string; data: Record<string, unknown> | unknown[]; direction?: 'self' | 'to' | null; component?: string | null };
export type NotificationActionView = 'link' | 'button' | 'icon-button' | 'badge';
export type NotificationActionData = {
    name?: string;
    label: string; url: string | null; openUrlInNewTab: boolean; spa?: boolean; close?: boolean; dispatch?: NotificationActionDispatch | null; color?: string | null; button?: boolean; outlined?: boolean;
    /** Database notifications only: marks the notification as read (or unread) when clicked. */
    markAsRead?: boolean; markAsUnread?: boolean;
    /** Trigger style: a link by default (`button: true` is the same as `view: 'button'`). */
    view?: NotificationActionView;
    icon?: string | null; iconPosition?: 'before' | 'after'; size?: string; tooltip?: string | null; disabled?: boolean;
    /** Extra HTML attributes: `data-*`, `aria-*`, `id`, `class`, `title`, `role`, `rel`, `lang`, `dir` only (never event handlers or directives). */
    extraAttributes?: Record<string, string | true>;
};
/** An action group of a notification: a dropdown (a link "Actions" by default) or a section of the dropdown. */
export type NotificationActionGroupData = {
    group: true; actions: NotificationActionItem[]; label: string | null; icon: string | null; color: string | null; size: string; tooltip: string | null;
    view: 'link' | 'button' | 'icon-button'; dropdown: boolean; placement: string | null; width: string | null; offset: number | null; maxHeight: string | null;
    extraAttributes?: Record<string, string | true>;
};
export type NotificationActionItem = NotificationActionData | NotificationActionGroupData;
export const isNotificationActionGroup = (item: NotificationActionItem): item is NotificationActionGroupData => (item as NotificationActionGroupData).group === true;

const EVENT_NAME = /^[A-Za-z0-9_.:-]{1,100}$/;
const COMPONENT_NAME = /^[A-Za-z0-9_.:\\-]{1,200}$/;
const COLOR = /^[a-z][a-z0-9-]{0,30}$/;
const ICON = /^[a-z0-9-]+(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/;
const SIZE = /^(xs|sm|md|lg|xl)$/;
const PLACEMENT = /^(top|bottom|left|right)(-(start|end))?$/;
const WIDTH = /^(xs|sm|md|lg|xl|[2-7]xl)$/;
const LENGTH = /^[0-9.]+(px|rem|em|vh|%)$/;
/** Extra attributes kept on notification actions: nothing that runs code or changes where a click leads. */
const SAFE_ATTRIBUTE = /^(?:data-[a-z0-9_.-]{1,60}|aria-[a-z]{1,30}|id|class|title|role|rel|lang|dir)$/;

/** Only a same-site path (`/…`) or an http(s) URL can become a link (no `javascript:`, `data:` or protocol-relative URLs). */
export const safeNotificationUrl = (url: unknown): string | null => localOrHttpUrl(url);
/** Icon names that come from the browser or the database are untrusted: only a Heroicons-like name or `prefix:name` (an icon of a registered set). */
export const safeNotificationIcon = (name: string | null | undefined, size: string, classes: string[], alias?: string): string => {
    if (!name || !ICON.test(name)) return '';
    try { return icon(name, { size, alias, attributes: new Attributes().class(classes) }); } catch { return ''; }
};
/** Extra attributes of an action, filtered (see `SAFE_ATTRIBUTE`) and limited in number and length. */
export function safeNotificationAttributes(raw: unknown): Record<string, string | true> | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const out: Record<string, string | true> = {};
    for (const [name, value] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
        const key = name.toLowerCase();
        if (!SAFE_ATTRIBUTE.test(key)) continue;
        if (value === true || value === '') out[key] = true;
        else if (typeof value === 'string' || typeof value === 'number') out[key] = String(value).slice(0, 500);
    }
    return Object.keys(out).length ? out : undefined;
}

let colorManager: ColorManager | null = null;
/** Sets the color manager used for the notification action buttons and links (the panel's). */
export const useNotificationsColorManager = (manager: ColorManager) => { colorManager = manager; };
type ColoredView = 'button' | 'button-outlined' | 'link' | 'icon-button' | 'badge' | 'dropdown-item';
const actionColorClasses = (component: ColoredView, color: string): string[] => {
    if (colorManager) return color === 'gray' && (component === 'button' || component === 'dropdown-item') ? [] : colorManager.getComponentClasses(component, color);
    if (component === 'link') return ['nv-color', `nv-color-${color}`, 'nv-text-color-600', 'dark:nv-text-color-300'];
    return component === 'button' || component === 'button-outlined' ? [] : ['nv-color', `nv-color-${color}`];
};

/** Default action label: the name, in words, capitalized (`undoEdit` → "Undo edit"). */
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
const viewOf = (view: unknown): NotificationActionView | null => {
    if (view === 'navette::components.button.index' || view === 'button') return 'button';
    if (view === 'navette::components.link' || view === 'link') return 'link';
    if (view === 'navette::components.icon-button' || view === 'icon-button') return 'icon-button';
    if (view === 'navette::components.badge' || view === 'badge') return 'badge';
    return null;
};

/**
 * Reads an action or an action group (`actions` key) in the notification array format (`NavetteNotificationAction.toJSON()`), as stored in the `notifications` table or sent from the browser. Untrusted: unknown
 * values are dropped, URLs are checked when rendered. Groups nest two levels deep at most.
 */
export function notificationActionFromArray(raw: unknown, mapUrl?: (url: string) => string, depth = 0): NotificationActionItem | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const action = raw as Record<string, unknown>;
    if ('actions' in action) {
        if (depth >= 2 || !Array.isArray(action.actions)) return null;
        const actions = action.actions.slice(0, 20).map((item) => notificationActionFromArray(item, mapUrl, depth + 1)).filter((item): item is NotificationActionItem => item !== null);
        if (!actions.length) return null;
        const icon = typeof action.icon === 'string' ? action.icon.replace(/^heroicon-/, '') : null;
        const triggerView = viewOf(action.triggerView);
        return {
            group: true, actions, label: text(action.label, 200), icon: icon && ICON.test(icon) ? icon : null,
            color: typeof action.color === 'string' && COLOR.test(action.color) ? action.color : null,
            size: typeof action.size === 'string' && SIZE.test(action.size) ? action.size : 'sm', tooltip: text(action.tooltip, 500),
            view: triggerView === 'button' || triggerView === 'icon-button' ? triggerView : 'link', dropdown: action.hasDropdown !== false,
            placement: typeof action.dropdownPlacement === 'string' && PLACEMENT.test(action.dropdownPlacement) ? action.dropdownPlacement : null,
            width: typeof action.dropdownWidth === 'string' && WIDTH.test(action.dropdownWidth) ? action.dropdownWidth : null,
            offset: typeof action.dropdownOffset === 'number' && Number.isFinite(action.dropdownOffset) ? Math.max(0, Math.min(100, Math.round(action.dropdownOffset))) : null,
            maxHeight: typeof action.dropdownMaxHeight === 'string' && LENGTH.test(action.dropdownMaxHeight) ? action.dropdownMaxHeight : null,
            extraAttributes: safeNotificationAttributes(action.extraAttributes),
        };
    }
    const name = text(action.name, 100);
    const label = text(action.label, 200) ?? (name ? labelFromName(name) : null);
    if (!label) return null;
    const event = typeof action.event === 'string' && EVENT_NAME.test(action.event) ? action.event : null;
    const direction = action.dispatchDirection === 'self' || action.dispatchDirection === 'to' ? action.dispatchDirection : null;
    const component = typeof action.dispatchToComponent === 'string' && COMPONENT_NAME.test(action.dispatchToComponent) ? action.dispatchToComponent : null;
    const url = typeof action.url === 'string' && action.url !== '' ? (mapUrl ? mapUrl(action.url) : action.url).slice(0, 2000) : null;
    const view = viewOf(action.view) ?? 'link';
    const icon = typeof action.icon === 'string' ? action.icon.replace(/^heroicon-/, '') : null;
    const data: NotificationActionData = {
        label, url, openUrlInNewTab: action.shouldOpenUrlInNewTab === true, ...(action.isSpa === false ? { spa: false } : {}), close: action.shouldClose === true,
        dispatch: event && (direction !== 'to' || component) ? { event, data: eventData(action.eventData), direction, component: direction === 'to' ? component : null } : null,
        color: typeof action.color === 'string' && COLOR.test(action.color) ? action.color : null,
        button: view === 'button', outlined: action.isOutlined === true,
        markAsRead: action.shouldMarkAsRead === true, markAsUnread: action.shouldMarkAsUnread === true,
    };
    if (name && /^[A-Za-z0-9_.:-]{1,100}$/.test(name)) data.name = name;
    if (view !== 'link' && view !== 'button') data.view = view;
    if (icon && ICON.test(icon) && icon.length <= 100) data.icon = icon;
    if (action.iconPosition === 'after') data.iconPosition = 'after';
    if (typeof action.size === 'string' && SIZE.test(action.size) && action.size !== 'sm') data.size = action.size;
    const tooltip = text(action.tooltip, 500);
    if (tooltip) data.tooltip = tooltip;
    if (action.isDisabled === true) data.disabled = true;
    const extra = safeNotificationAttributes(action.extraAttributes);
    if (extra) data.extraAttributes = extra;
    return data;
}

const viewName = (view: NotificationActionView): string => (view === 'button' ? 'navette::components.button.index' : view === 'icon-button' ? 'navette::components.icon-button' : view === 'badge' ? 'navette::components.badge' : 'navette::components.link');
const actionView = (action: NotificationActionData): NotificationActionView => action.view ?? (action.button ? 'button' : 'link');

/** Writes an action or a group in the notification array format (for the `notifications` table and broadcast messages). */
export function notificationActionToArray(action: NotificationActionItem): Record<string, unknown> {
    if (isNotificationActionGroup(action)) {
        return {
            actions: action.actions.map(notificationActionToArray), color: action.color, dropdownMaxHeight: action.maxHeight, dropdownOffset: action.offset,
            dropdownPlacement: action.placement, dropdownWidth: action.width, extraAttributes: action.extraAttributes ?? [], hasDropdown: action.dropdown,
            icon: action.icon, iconPosition: 'before', iconSize: null, isOutlined: false, label: action.label, size: action.size, tooltip: action.tooltip,
            triggerView: viewName(action.view), view: null,
        };
    }
    return {
        name: action.name ?? action.label, color: action.color ?? null, event: action.dispatch?.event ?? null, eventData: action.dispatch?.data ?? [], dispatchDirection: action.dispatch?.direction ?? false,
        dispatchToComponent: action.dispatch?.component ?? null, extraAttributes: action.extraAttributes ?? [], icon: action.icon ?? null, iconPosition: action.iconPosition ?? 'before', iconSize: null,
        isOutlined: action.outlined === true, isDisabled: action.disabled === true, label: action.label, shouldClose: action.close === true, shouldMarkAsRead: action.markAsRead === true,
        shouldMarkAsUnread: action.markAsUnread === true, shouldOpenUrlInNewTab: action.openUrlInNewTab, ...(action.spa === false ? { isSpa: false as const } : {}), size: action.size ?? 'sm', tooltip: action.tooltip ?? null, url: action.url,
        view: viewName(actionView(action)),
    };
}

export type NotificationActionInput = {
    label: string; url?: string | null; openUrlInNewTab?: boolean; close?: boolean; color?: string | null; button?: boolean; outlined?: boolean; markAsRead?: boolean; markAsUnread?: boolean;
    /** `to`: name of the component receiving the event; `self`: only the component showing the notification. */
    dispatch?: { event: string; data?: Record<string, unknown> | unknown[]; to?: string; self?: boolean } | null;
    view?: NotificationActionView; icon?: string | null; iconPosition?: 'before' | 'after'; size?: string; tooltip?: string | null; disabled?: boolean; extraAttributes?: Record<string, string | number | boolean>;
};

/**
 * One item of `Notification.actions()`: an `Action` or an `ActionGroup` of `@navette-js/actions` (a small link by default), or a
 * plain object. Event and component names are checked; the rest goes through `notificationActionFromArray()`.
 */
export function normalizeNotificationAction(input: Action | ActionGroup | NotificationActionInput): NotificationActionItem | null {
    if (input instanceof ActionGroup) return notificationActionFromArray(prepareGroup(input).toArray());
    if (input instanceof Action) return notificationActionFromArray(prepareAction(input).toArray());
    const event = input.dispatch?.event;
    if (event !== undefined && !EVENT_NAME.test(event)) throw new Error(`Invalid notification event name: ${event}`);
    const to = input.dispatch?.to;
    if (to !== undefined && !COMPONENT_NAME.test(to)) throw new Error(`Invalid component name: ${to}`);
    return notificationActionFromArray({
        name: input.label, label: String(input.label), url: input.url ?? null, shouldOpenUrlInNewTab: input.openUrlInNewTab === true, shouldClose: input.close === true,
        event: event ?? null, eventData: input.dispatch?.data ?? {}, dispatchDirection: to ? 'to' : input.dispatch?.self ? 'self' : false, dispatchToComponent: to ?? null,
        color: input.color ?? null, view: input.view ?? (input.button ? 'button' : 'link'), isOutlined: input.outlined === true,
        shouldMarkAsRead: input.markAsRead === true, shouldMarkAsUnread: input.markAsUnread === true, icon: input.icon ?? null, iconPosition: input.iconPosition ?? 'before',
        size: input.size ?? 'sm', tooltip: input.tooltip ?? null, isDisabled: input.disabled === true, extraAttributes: input.extraAttributes ?? {},
    });
}
/** Notification defaults: small links, unless the action chose its style or size. */
function prepareAction(action: Action): Action {
    action.defaultSize('sm');
    if (action.getView() === null) action.link();
    return action;
}
function prepareGroup(group: ActionGroup): ActionGroup {
    group.defaultTriggerView('link').defaultSize('sm');
    for (const item of (group as any).actions as (Action | ActionGroup)[]) if (item instanceof ActionGroup) prepareGroup(item); else prepareAction(item);
    return group;
}

type RenderOptions = { navigate?: boolean; inGroup?: boolean };
const tooltipAttribute = (tooltip: string | null | undefined): string => (tooltip ? ` x-tooltip="${e(`{ content: ${js(tooltip)}, theme: $store.theme, allowHTML: false }`)}"` : '');
const extraAttributesHtml = (extra: Record<string, string | true> | undefined, skip: string[] = []): string => {
    const safe = safeNotificationAttributes(extra) ?? {};
    return Object.entries(safe).filter(([name]) => !skip.includes(name)).map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${e(value)}"`)).join('');
};
/** Icon size of a trigger, from its size (as the button, link and icon button components choose it). */
const iconSizeFor = (view: NotificationActionView, size: string): string => (view === 'icon-button' ? (size === 'xs' ? 'sm' : size === 'lg' || size === 'xl' ? 'lg' : 'md') : size === 'xs' || size === 'sm' ? 'sm' : 'md');

/**
 * One action of a notification: a link (only a local or http(s) URL), a button, an icon button or a badge. The Alpine handler
 * closes the notification or changes its read state, and the Livewire handler dispatches the event. A disabled
 * action has neither a link nor a click handler. `navigate`: links to paths of this site use `wire:navigate`, unless the action has `spa: false`.
 */
export function renderNotificationAction(action: NotificationActionData, options: RenderOptions = {}): string {
    const url = safeNotificationUrl(action.url);
    if (action.label === '' || !(url || action.close || action.dispatch || action.markAsRead || action.markAsUnread || action.disabled)) return '';
    const color = action.color ?? 'primary';
    const size = action.size && SIZE.test(action.size) ? action.size : 'sm';
    let view = actionView(action);
    if (view === 'icon-button' && !(action.icon && ICON.test(action.icon))) view = 'link';
    const disabled = action.disabled === true;
    const dispatch = action.dispatch;
    const livewire = dispatch
        ? dispatch.direction === 'to' && dispatch.component ? `Livewire.dispatchTo(${js(dispatch.component)}, ${js(dispatch.event)}, ${js(dispatch.data)})`
        : dispatch.direction === 'self' ? `$wire.$dispatchSelf(${js(dispatch.event)}, ${js(dispatch.data)})`
        : `Livewire.dispatch(${js(dispatch.event)}, ${js(dispatch.data)})`
        : null;
    // Inside a dropdown, `close()` is the dropdown's: the notification's is reached through `closeNotification()`.
    const close = options.inGroup ? 'closeNotification' : 'close';
    const alpine = action.close ? (url && !action.openUrlInNewTab ? `${close}(true)` : `${close}()`) : action.markAsRead ? 'markAsRead()' : action.markAsUnread ? 'markAsUnread()' : null;
    const click = disabled ? '' : [livewire, alpine].filter(Boolean).join('; ');
    const onClick = click ? ` x-on:click="${e(click)}"` : '';
    const href = url && !disabled ? `href="${e(url)}"${action.openUrlInNewTab ? ' target="_blank" rel="noopener noreferrer"' : isSpaNavigableUrl(url) && action.spa !== false && options.navigate ? ' wire:navigate' : ''}` : '';
    const tag = url ? 'a' : 'button';
    const opening = tag === 'a' ? `<a ${href}`.replace(/ $/, '') : `<button type="button"${disabled ? ' disabled' : ''}`;
    const iconHtml = safeNotificationIcon(action.icon, options.inGroup ? 'md' : iconSizeFor(view, size), []);
    const before = action.iconPosition === 'after' ? '' : iconHtml, after = action.iconPosition === 'after' ? iconHtml : '';
    const trailing = `${tooltipAttribute(action.tooltip)}${disabled ? ' aria-disabled="true"' : ''}${extraAttributesHtml(action.extraAttributes, ['class'])}`;
    const extraClass = typeof action.extraAttributes?.class === 'string' ? [action.extraAttributes.class] : [];
    if (options.inGroup) {
        // Menu items are gray unless they have another color than the default one (like the panel menus).
        const classes = cls(['nv-dropdown-list-item', 'nv-ac-grouped-action', { 'nv-disabled': disabled }, ...(color === 'primary' || color === 'gray' ? [] : actionColorClasses('dropdown-item', color)), ...extraClass]);
        return `${opening}${onClick} role="menuitem" tabindex="-1" class="${e(classes)}"${trailing}>${before}<span class="nv-dropdown-list-item-label">${e(action.label)}</span>${after}</${tag}>`;
    }
    if (view === 'button') {
        const classes = cls(['nv-ac-btn-action', 'nv-btn', { 'nv-disabled': disabled }, `nv-size-${size}`, ...(action.outlined ? ['nv-outlined', ...actionColorClasses('button-outlined', color)] : actionColorClasses('button', color)), ...extraClass]);
        return `${opening}${onClick} class="${e(classes)}"${trailing}>${before}${e(action.label)}${after}</${tag}>`;
    }
    if (view === 'icon-button') {
        const classes = cls(['nv-ac-icon-btn-action', 'nv-icon-btn', { 'nv-disabled': disabled }, `nv-size-${size}`, ...actionColorClasses('icon-button', color), ...extraClass]);
        return `${opening}${onClick} title="${e(action.label)}" aria-label="${e(action.label)}" class="${e(classes)}"${trailing}>${iconHtml}</${tag}>`;
    }
    if (view === 'badge') {
        const classes = cls(['nv-ac-badge-action', 'nv-badge', { 'nv-disabled': disabled }, `nv-size-${size}`, ...actionColorClasses('badge', color), ...extraClass]);
        return `${opening}${onClick} class="${e(classes)}"${trailing}>${before}<span class="nv-badge-label-ctn"><span class="nv-badge-label">${e(action.label)}</span></span>${after}</${tag}>`;
    }
    const classes = cls(['nv-ac-link-action', 'nv-link', { 'nv-disabled': disabled }, `nv-size-${size}`, ...actionColorClasses('link', color), ...extraClass]);
    return `${opening}${onClick} class="${e(classes)}"${trailing}>${before}<span class="nv-link-label">${e(action.label)}</span>${after}</${tag}>`;
}

/** Menu items of a group, one list per section (nested groups). */
function groupLists(group: NotificationActionGroupData, options: RenderOptions): string[][] {
    const lists: string[][] = [];
    let current: string[] = [];
    for (const item of group.actions) {
        if (isNotificationActionGroup(item)) {
            if (current.length) { lists.push(current); current = []; }
            lists.push(...groupLists(item, options));
            continue;
        }
        const html = renderNotificationAction(item, { ...options, inGroup: true });
        if (html) current.push(html);
    }
    if (current.length) lists.push(current);
    return lists.filter((list) => list.length);
}
const hasCloseAction = (group: NotificationActionGroupData): boolean => group.actions.some((item) => (isNotificationActionGroup(item) ? hasCloseAction(item) : item.close === true));

/** An action group of a notification: a dropdown of its actions, or its actions side by side with `dropdown(false)`. */
export function renderNotificationActionGroup(group: NotificationActionGroupData, options: RenderOptions = {}): string {
    if (!group.dropdown) return group.actions.map((item) => (isNotificationActionGroup(item) ? renderNotificationActionGroup(item, options) : renderNotificationAction(item, options))).join('');
    const lists = groupLists(group, options);
    if (!lists.length) return '';
    const label = group.label ?? t('navette-actions::group.trigger.label');
    const color = group.color ?? 'primary';
    const glyph = safeNotificationIcon(group.icon ?? icons.resolve('actions::action-group') ?? 'm-ellipsis-vertical', iconSizeFor(group.view, group.size), []);
    const extra = extraAttributesHtml(group.extraAttributes, ['class']);
    const tooltip = tooltipAttribute(group.tooltip);
    const trigger = group.view === 'button'
        ? `<button${tooltip} type="button" class="${cls(['nv-ac-btn-group', 'nv-btn', `nv-size-${group.size}`, ...actionColorClasses('button', color)])}"${extra}>${glyph}${e(label)}</button>`
        : group.view === 'icon-button'
            ? `<button title="${e(label)}" aria-label="${e(label)}"${tooltip} type="button" class="${cls(['nv-ac-icon-btn-group', 'nv-icon-btn', `nv-size-${group.size}`, ...actionColorClasses('icon-button', color)])}"${extra}>${glyph}</button>`
            : `<button${tooltip} type="button" class="${cls(['nv-ac-link-group', 'nv-link', `nv-size-${group.size}`, ...actionColorClasses('link', color)])}"${extra}>${glyph}<span class="nv-link-label">${e(label)}</span></button>`;
    const panelClasses = cls(['nv-dropdown-panel', group.width ? `nv-width-${group.width}` : null, { 'nv-scrollable': group.maxHeight !== null }]);
    const style = group.maxHeight ? ` style="max-height: ${e(group.maxHeight)}"` : '';
    const dropdown = `<div x-data="navetteDropdown" class="nv-dropdown"><div x-on:mousedown="if ($event.button === 0) toggle($event)" class="nv-dropdown-trigger">${trigger}</div><div x-cloak x-float.placement.${group.placement ?? 'bottom-end'}.flip.teleport.offset="{ offset: ${group.offset ?? 8} }" x-ref="panel" x-transition:enter-start="nv-opacity-0" x-transition:leave-end="nv-opacity-0" role="menu" class="${panelClasses}"${style}>${lists.map((items) => `<div class="nv-dropdown-list" role="group">${items.join('')}</div>`).join('')}</div></div>`;
    // The dropdown's own `close()` hides the notification's: items closing the notification call `closeNotification()`, the
    // `close()` of the notification element, found outside of the (teleported) dropdown.
    return hasCloseAction(group) ? `<div x-data="{ notificationElement: null, closeNotification(...args) { return Alpine.$data(this.notificationElement).close(...args) } }" x-init="notificationElement = $el.closest(&#039;.nv-no-notification&#039;)" style="display: contents">${dropdown}</div>` : dropdown;
}

/** Actions of a notification: links, buttons and groups closing it, dispatching a Livewire event, or changing its read state. */
export function notificationActionsHtml(actions: NotificationActionItem[] | undefined, options: { navigate?: boolean } = {}): string {
    const items = (actions ?? []).map((item) => (isNotificationActionGroup(item) ? renderNotificationActionGroup(item, options) : renderNotificationAction(item, options))).filter(Boolean);
    return items.length ? `<div class="nv-ac nv-no-notification-actions">${items.join('')}</div>` : '';
}
