// Array format of actions and action groups (`toArray()` / `fromArray()`), used by notifications: their actions are stored
// in the notifications table, in the page state and in broadcast messages.
import type { Action, ActionGroup } from './index.ts';

/** Array of an action. Values that cannot be computed without a component (functions returning promises) are left out. */
export type ActionArray = {
    name: string; alpineClickHandler: string | null; color: string | null; event: string | null; eventData: Record<string, unknown> | unknown[];
    dispatchDirection: 'self' | 'to' | false; dispatchToComponent: string | null; extraAttributes: Record<string, unknown>; icon: string | null;
    iconPosition: 'before' | 'after'; iconSize: string | null; isOutlined: boolean; isDisabled: boolean; label: string | null; shouldClose: boolean;
    shouldMarkAsRead: boolean; shouldMarkAsUnread: boolean; shouldOpenUrlInNewTab: boolean; shouldPostToUrl: boolean; size: string;
    tooltip: string | null; url: string | null; view: 'button' | 'link' | 'icon-button' | 'badge' | null;
    /** Present (`false`) only for a link that never uses SPA navigation (`spa(false)`). */
    isSpa?: false;
};
/** Array of an action group: its `actions` key tells it apart from an action. */
export type ActionGroupArray = {
    actions: (ActionArray | ActionGroupArray)[]; color: string | null; dropdownMaxHeight: string | null; dropdownOffset: number | null; dropdownPlacement: string | null;
    dropdownWidth: string | null; extraAttributes: Record<string, unknown>; hasDropdown: boolean; icon: string | null; iconPosition: 'before' | 'after';
    iconSize: string | null; isOutlined: boolean; label: string | null; size: string; tooltip: string | null; triggerView: 'button' | 'link' | 'icon-button'; view: null;
};

/** A value that may be a function of the context: evaluated without a component; an asynchronous result is ignored. */
function now<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'function') return (value ?? fallback) as T;
    try {
        const result = value({});
        if (result instanceof Promise) { result.catch(() => {}); return fallback; }
        return (result ?? fallback) as T;
    } catch { return fallback; }
}
const str = (value: unknown, max = 2000): string | null => (typeof value === 'string' && value !== '' ? value.slice(0, max) : typeof value === 'number' ? String(value) : null);
const labelFromName = (name: string): string => {
    const words = name.split('.')[0].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[-_]+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
};
/**
 * Extra attributes without a component context: `extraAttributes()` keeps a list of sets (objects or functions of the context,
 * merged in order); a set computed asynchronously is ignored. A `getExtraAttributes()` returning an object directly also works.
 */
const extraAttributesOf = (target: any): Record<string, unknown> => {
    // A copy: pushing the fallback below into the action's own list would make `getExtraAttributes()` call itself forever.
    const sets: unknown[] = Array.isArray(target._extraAttributes) ? [...target._extraAttributes] : target._extraAttributes ? [target._extraAttributes] : [];
    if (!sets.length && typeof target.getExtraAttributes === 'function') sets.push(() => target.getExtraAttributes({}));
    const out: Record<string, unknown> = {};
    for (const set of sets) {
        const value = now<unknown>(set, null);
        if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(out, value);
    }
    return out;
};

export function actionToArray(action: Action): ActionArray {
    const a = action as any;
    return {
        name: a.getName(),
        alpineClickHandler: a._alpineClick ?? null,
        color: a._lazyColor ? now(a._lazyColor, a._color) : a._color ?? null,
        event: a._event ?? null,
        eventData: a._eventData ?? [],
        dispatchDirection: a._dispatchDirection ?? false,
        dispatchToComponent: a._dispatchToComponent ?? null,
        extraAttributes: extraAttributesOf(a),
        icon: a._lazyIcon ? now(a._lazyIcon, null) : a._icon ?? null,
        iconPosition: a._iconAfter ? 'after' : 'before',
        iconSize: null,
        isOutlined: a._outlined === true,
        isDisabled: Boolean(now(a._disabled, false)),
        // Default label: the name in words (`undoEdit` becomes "Undo edit").
        label: str(now(a._label, null)) ?? labelFromName(a.getName()),
        shouldClose: a._shouldClose === true,
        shouldMarkAsRead: a._shouldMarkAsRead === true,
        shouldMarkAsUnread: a._shouldMarkAsUnread === true,
        shouldOpenUrlInNewTab: a._newTab === true,
        ...(a._spa === false ? { isSpa: false as const } : {}),
        shouldPostToUrl: false,
        size: a._size ?? 'md',
        tooltip: str(now(a._tooltip, null)),
        url: a._lazyUrl ? now(a._lazyUrl, null) : a._url ?? null,
        view: a._view ?? null,
    };
}

export function actionGroupToArray(group: ActionGroup): ActionGroupArray {
    const g = group as any;
    return {
        // The direct items (`getActions()` flattens nested groups).
        actions: ((g.actions ?? []) as any[]).map((item: any) => (typeof item.getActions === 'function' ? actionGroupToArray(item) : actionToArray(item))),
        color: g._color ?? null, dropdownMaxHeight: g._maxHeight ?? null, dropdownOffset: g._offset ?? null, dropdownPlacement: g._placement ?? null,
        dropdownWidth: g._width ?? null, extraAttributes: extraAttributesOf(g), hasDropdown: g._dropdown !== false, icon: g._icon ?? null,
        iconPosition: 'before', iconSize: null, isOutlined: false, label: g._label ?? null, size: g._size ?? 'md', tooltip: g._tooltip ?? null,
        triggerView: g._view ?? 'icon-button', view: null,
    };
}

const NAME = /^[A-Za-z0-9_.:-]{1,100}$/;
const COLOR = /^[a-z][a-z0-9-]{0,30}$/;
const ICON = /^[a-z0-9-]+(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/;
const SIZE = /^(xs|sm|md|lg|xl)$/;

/**
 * Rebuilds an action from its array. The data may come from the database or the browser:
 * only well-formed names, colors, icons and sizes are kept; URLs are checked again when the action is rendered.
 */
export function actionFromArray(ActionClass: typeof Action, raw: unknown): Action {
    const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const action = ActionClass.make(typeof data.name === 'string' && NAME.test(data.name) ? data.name : 'action') as any;
    const label = str(data.label, 200);
    if (label !== null) action.label(label);
    if (typeof data.color === 'string' && COLOR.test(data.color)) action.color(data.color);
    const icon = typeof data.icon === 'string' ? data.icon.replace(/^heroicon-/, '') : null;
    if (icon && ICON.test(icon)) action.icon(icon);
    if (data.iconPosition === 'after') action.iconPosition('after');
    if (typeof data.size === 'string' && SIZE.test(data.size)) action.size(data.size);
    const tooltip = str(data.tooltip, 500);
    if (tooltip !== null) action.tooltip(tooltip);
    const url = str(data.url);
    if (url !== null) action.url(url);
    if (data.shouldOpenUrlInNewTab === true) action.openUrlInNewTab();
    if (data.isSpa === false) action.spa(false);
    if (data.isOutlined === true) action.outlined();
    if (data.isDisabled === true) action.disabled();
    const view = data.view === 'navette::components.button.index' ? 'button' : data.view === 'navette::components.link' ? 'link' : data.view;
    if (view === 'button') action.button(); else if (view === 'link') action.link(); else if (view === 'icon-button') action.iconButton(); else if (view === 'badge') action.badge?.();
    if (data.shouldClose === true) action.close();
    if (data.shouldMarkAsRead === true) action.markAsRead();
    if (data.shouldMarkAsUnread === true) action.markAsUnread();
    const event = typeof data.event === 'string' && NAME.test(data.event) ? data.event : null;
    const eventData = data.eventData && typeof data.eventData === 'object' ? data.eventData as Record<string, unknown> | unknown[] : [];
    if (event) {
        if (data.dispatchDirection === 'to' && typeof data.dispatchToComponent === 'string' && /^[A-Za-z0-9_.:\\-]{1,200}$/.test(data.dispatchToComponent)) action.dispatchTo(data.dispatchToComponent, event, eventData);
        else if (data.dispatchDirection === 'self') action.dispatchSelf(event, eventData);
        else action.dispatch(event, eventData);
    }
    if (data.extraAttributes && typeof data.extraAttributes === 'object' && !Array.isArray(data.extraAttributes) && typeof action.extraAttributes === 'function') action.extraAttributes(data.extraAttributes);
    return action;
}

/** Rebuilds an action group from its array, nested groups included. */
export function actionGroupFromArray(ActionClass: typeof Action, GroupClass: typeof ActionGroup, raw: unknown, depth = 0): ActionGroup {
    const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const items = (Array.isArray(data.actions) ? data.actions : []).slice(0, 20)
        .map((item) => (item && typeof item === 'object' && 'actions' in item && depth < 2 ? actionGroupFromArray(ActionClass, GroupClass, item, depth + 1) : actionFromArray(ActionClass, item)));
    const group = GroupClass.make(items) as any;
    const label = str(data.label, 200);
    if (label !== null) group.label(label);
    const icon = typeof data.icon === 'string' ? data.icon.replace(/^heroicon-/, '') : null;
    if (icon && ICON.test(icon)) group.icon(icon);
    if (typeof data.color === 'string' && COLOR.test(data.color)) group.color(data.color);
    if (typeof data.size === 'string' && SIZE.test(data.size)) group.size(data.size);
    const tooltip = str(data.tooltip, 500);
    if (tooltip !== null) group.tooltip(tooltip);
    if (data.triggerView === 'button') group.button(); else if (data.triggerView === 'link') group.link(); else if (data.triggerView === 'icon-button') group.iconButton();
    if (data.hasDropdown === false) group.dropdown(false);
    if (typeof data.dropdownPlacement === 'string') group.dropdownPlacement(data.dropdownPlacement);
    if (typeof data.dropdownWidth === 'string') group.dropdownWidth(data.dropdownWidth);
    if (typeof data.dropdownOffset === 'number') group.dropdownOffset(data.dropdownOffset);
    if (typeof data.dropdownMaxHeight === 'string') group.maxHeight(data.dropdownMaxHeight);
    return group;
}
