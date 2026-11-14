// Panel navigation: items, groups, the navigation builder (`panel.navigation((builder) => …)`) and the views the sidebar
// and topbar render. Labels may be HTML (`new HtmlString('<b>Shop</b>')`), written as-is: build them from escaped values.
import { createHash } from 'node:crypto';
import { Attributes, e, HtmlString, isEnumCase, type EnumCase } from '@navette-js/support';

export type NavigationLabel = string | HtmlString;
/** What `visible()`, `hidden()` and computed badges receive. */
export type NavigationContext = { user: { id: string | number; [key: string]: unknown } | null; panel: unknown };
type Condition = boolean | ((context: NavigationContext) => boolean);
/** A navigation group reference: its label, an HTML label, or an enum case (`NavigationGroup.fromEnum()`). */
export type NavigationGroupReference = string | HtmlString | EnumCase<string | number> | null;

/** Plain text of a label (tooltips, `aria-label`): HTML labels lose their tags. */
export function navigationLabelText(label: NavigationLabel | null | undefined): string {
    if (label instanceof HtmlString) return label.html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').trim();
    return String(label ?? '');
}
/** Label as HTML: escaped text, or the HTML of an `HtmlString`. */
export const navigationLabelHtml = (label: NavigationLabel | null | undefined): string => (label instanceof HtmlString ? label.html : e(label ?? ''));
/** Key identifying a group (what items reference in `group()`): its label, the HTML of an HTML label, an enum case's label. */
export function navigationGroupKey(group: NavigationGroupReference | NavigationGroup): string | null {
    if (group === null || group === undefined) return null;
    if (group instanceof NavigationGroup) return navigationGroupKey(group.getLabel());
    if (group instanceof HtmlString) return group.html;
    if (isEnumCase(group)) return group.getLabel();
    return String(group);
}
const evaluateCondition = (condition: Condition, context: NavigationContext) => (typeof condition === 'function' ? Boolean(condition(context)) : condition);

/** One link of the navigation (Filament's `NavigationItem`). */
export class NavigationItem {
    _label: NavigationLabel;
    _key: string | null = null;
    _url: string | null = '#';
    _newTab = false;
    _icon: string | null = null;
    _activeIcon: string | null = null;
    _group: NavigationGroupReference = null;
    _sort = 0;
    _isActive: ((path: string) => boolean) | boolean | null = null;
    _badge: string | number | null | (() => string | number | null) = null;
    _badgeColor: string | ((badge: string | number | null) => string | null) | null = 'primary';
    _badgeTooltip: string | ((badge: string | number | null) => string | null) | null = null;
    _parentItem: string | null = null;
    _childItems: NavigationItem[] = [];
    _visible: Condition = true;
    _hidden: Condition = false;
    _extraAttributes: Record<string, string | number | boolean | null> = {};
    /** Slug of the page the item links to (`Page.getNavigationItems()`): its computed badge and its access apply. */
    _page: string | null = null;
    constructor(label: NavigationLabel) { this._label = label; }
    static make(label: NavigationLabel): NavigationItem { return new NavigationItem(label); }
    /** Identifies the item (`parentItem()` of other items may use it); defaults to the label. */
    key(key: string | null): this { this._key = key; return this; }
    getKey(): string { return this._key ?? (this._label instanceof HtmlString ? this._label.html : this._label); }
    /** Text, or HTML (`new HtmlString(...)`), inserted as-is. */
    label(label: NavigationLabel): this { this._label = label; return this; }
    getLabel(): NavigationLabel { return this._label; }
    /** Shows the item below another item of its group, by that item's key or label. */
    parentItem(label: string | null): this { this._parentItem = label; return this; }
    getParentItem(): string | null { return this._parentItem; }
    /** Items shown below this one, when it (or one of them) is active, or when it has no URL. */
    childItems(items: NavigationItem[]): this { this._childItems = items; return this; }
    getChildItems(): NavigationItem[] { return this._childItems; }
    /** Link target; `shouldOpenInNewTab` opens it in a new tab (`target="_blank"`, without SPA navigation). */
    url(url: string | null, shouldOpenInNewTab: boolean | null = null): this { this._url = url; if (shouldOpenInNewTab !== null) this._newTab = shouldOpenInNewTab; return this; }
    getUrl(): string | null { return this._url; }
    openUrlInNewTab(condition = true): this { this._newTab = condition; return this; }
    shouldOpenUrlInNewTab(): boolean { return this._newTab; }
    icon(icon: string | null): this { this._icon = icon; return this; }
    getIcon(): string | null { return this._icon; }
    /** Icon shown instead of `icon()` while the item is active (a solid variant, for example). */
    activeIcon(icon: string | null): this { this._activeIcon = icon; return this; }
    getActiveIcon(): string | null { return this._activeIcon; }
    /** Group of the item: its label, or an enum case of the panel's navigation groups. */
    group(group: NavigationGroupReference): this { this._group = group; return this; }
    getGroup(): NavigationGroupReference { return this._group; }
    sort(sort: number | null): this { this._sort = sort ?? 0; return this; }
    getSort(): number { return this._sort; }
    /** Counter shown next to the label; a function is evaluated when the navigation is rendered. A color function receives the badge. */
    badge(badge: string | number | null | (() => string | number | null), color: string | ((badge: string | number | null) => string | null) | null = 'primary'): this { this._badge = badge; this._badgeColor = color; return this; }
    getBadge(): string | number | null { return typeof this._badge === 'function' ? this._badge() : this._badge; }
    getBadgeColor(badge: string | number | null = this.getBadge()): string { return (typeof this._badgeColor === 'function' ? this._badgeColor(badge) : this._badgeColor) ?? 'primary'; }
    /** Tooltip of the badge; a function receives the badge. */
    badgeTooltip(tooltip: string | ((badge: string | number | null) => string | null) | null): this { this._badgeTooltip = tooltip; return this; }
    getBadgeTooltip(badge: string | number | null = this.getBadge()): string | null { return typeof this._badgeTooltip === 'function' ? this._badgeTooltip(badge) : this._badgeTooltip; }
    /** By default an item is active on its exact URL: a function receives the current path, a boolean forces it. */
    isActiveWhen(fn: ((path: string) => boolean) | boolean | null): this { this._isActive = fn; return this; }
    /** Filament's name for `isActiveWhen()`. */
    activeWhen(fn: ((path: string) => boolean) | boolean | null): this { return this.isActiveWhen(fn); }
    isActive(path: string): boolean {
        if (typeof this._isActive === 'boolean') return this._isActive;
        return this._isActive ? this._isActive(path) : this._url !== null && path === this._url;
    }
    /** Shows the item only when the condition holds; a function receives `{ user, panel }`. */
    visible(condition: Condition = true): this { this._visible = condition; return this; }
    hidden(condition: Condition = true): this { this._hidden = condition; return this; }
    isVisible(context: NavigationContext = { user: null, panel: null }): boolean { return !this.isHidden(context); }
    isHidden(context: NavigationContext = { user: null, panel: null }): boolean { return evaluateCondition(this._hidden, context) || !evaluateCondition(this._visible, context); }
    /** HTML attributes of the item's `<li>` (inserted as written: never from user input). */
    extraAttributes(attributes: Record<string, string | number | boolean | null>): this { this._extraAttributes = { ...this._extraAttributes, ...attributes }; return this; }
    getExtraAttributes(): Record<string, string | number | boolean | null> { return this._extraAttributes; }
}

/** A navigation group: label (text or HTML), icon (then its items have none, as in Filament), collapsible and collapsed by default. */
export class NavigationGroup {
    private _label: NavigationLabel | null;
    private _icon: string | null = null;
    private _collapsible: boolean | null = null;
    private _collapsed = false;
    private _items: NavigationItem[] = [];
    private _extraSidebarAttributes: Record<string, string | number | boolean | null> = {};
    private _extraTopbarAttributes: Record<string, string | number | boolean | null> = {};
    constructor(label: NavigationLabel | null = null) { this._label = label; }
    static make(label: NavigationLabel | null = null): NavigationGroup { return new NavigationGroup(label); }
    /** A group from an enum case: its label and icon, and `collapsed` / `collapsible` when the case defines them. */
    static fromEnum(item: EnumCase<string | number>): NavigationGroup {
        const group = NavigationGroup.make(item.getLabel()).icon(item.getIcon());
        const definition = item as unknown as { isCollapsed?: () => boolean | null; isCollapsible?: () => boolean | null };
        const collapsed = definition.isCollapsed?.() ?? null;
        const collapsible = definition.isCollapsible?.() ?? null;
        if (collapsed !== null) group.collapsed(collapsed);
        if (collapsible !== null) group.collapsible(collapsible);
        return group;
    }
    label(label: NavigationLabel | null): this { this._label = label; return this; }
    icon(name: string | null): this { this._icon = name; return this; }
    /** `null`: the panel's default (`collapsibleNavigationGroups()`). */
    collapsible(condition: boolean | null = true): this { this._collapsible = condition; return this; }
    /** Collapsed until the user opens it (the browser then remembers the user's choice). Also makes the group collapsible. */
    collapsed(condition = true): this { this._collapsed = condition; this._collapsible = condition ? true : this._collapsible; return this; }
    /** Items of the group, for the navigation builder. */
    items(items: NavigationItem[]): this { this._items = items; return this; }
    getItems(): NavigationItem[] { return this._items; }
    /** HTML attributes of the group's `<li>` in the sidebar (inserted as written: never from user input). */
    extraSidebarAttributes(attributes: Record<string, string | number | boolean | null>): this { this._extraSidebarAttributes = { ...this._extraSidebarAttributes, ...attributes }; return this; }
    /** HTML attributes of the group's dropdown in the top navigation. */
    extraTopbarAttributes(attributes: Record<string, string | number | boolean | null>): this { this._extraTopbarAttributes = { ...this._extraTopbarAttributes, ...attributes }; return this; }
    getExtraSidebarAttributes(): Record<string, string | number | boolean | null> { return this._extraSidebarAttributes; }
    getExtraTopbarAttributes(): Record<string, string | number | boolean | null> { return this._extraTopbarAttributes; }
    getLabel(): NavigationLabel | null { return this._label; }
    getIcon(): string | null { return this._icon; }
    /** Whether the group can be collapsed: its own setting, otherwise the panel's (`true` by default). */
    isCollapsible(panelDefault = true): boolean { return this._collapsible ?? panelDefault; }
    hasCollapsibleSetting(): boolean { return this._collapsible !== null; }
    isCollapsed(): boolean { return this._collapsed; }
}

/**
 * Builds the whole navigation by hand: `panel.navigation((builder) => builder.items([...]).groups([...]))`. Items outside
 * a group come first; groups keep their order; hidden items, and groups left empty, are left out.
 */
export class NavigationBuilder {
    private _groups: NavigationGroup[] = [];
    private _items: NavigationItem[] = [];
    /** Adds a group: a `NavigationGroup`, or a label with its items. */
    group(group: NavigationGroup | NavigationLabel, items: NavigationItem[] = [], collapsible: boolean | null = null): this {
        this._groups.push(group instanceof NavigationGroup ? group : NavigationGroup.make(group).items(items).collapsible(collapsible));
        return this;
    }
    groups(groups: NavigationGroup[]): this { this._groups.push(...groups); return this; }
    item(item: NavigationItem): this { this._items.push(item); return this; }
    items(items: NavigationItem[]): this { this._items.push(...items); return this; }
    /** Runs `fn` only when the condition holds (Laravel's `when()`). */
    when(condition: unknown, fn: (builder: this) => unknown): this { if (condition) fn(this); return this; }
    /** The groups to render, the ungrouped items first. */
    getNavigation(context: NavigationContext = { user: null, panel: null }): NavigationGroup[] {
        const visible = (items: NavigationItem[]) => items.filter((item) => item.isVisible(context));
        const groups = this._groups.map((group) => ({ group, items: visible(group.getItems()) })).filter(({ items }) => items.length).map(({ group, items }) => group.items(items));
        const items = visible(this._items);
        return items.length ? [NavigationGroup.make(null).items(items), ...groups] : groups;
    }
}

export type NavigationItemView = {
    /** Plain text of the label. */
    label: string;
    /** The label as HTML: escaped text, or an `HtmlString`'s HTML. */
    labelHtml: string;
    isHtmlLabel: boolean;
    url: string; icon: string | null; isActive: boolean; badge: string | number | null; badgeColorClasses: string[]; badgeTooltip: string | null;
    childItems: NavigationItemView[]; activeChildItems: boolean; newTab: boolean;
    /** Extra attributes of the item, as HTML. */
    extraAttributes: string;
};
export type NavigationGroupView = {
    label: string | null; labelHtml: string | null; isHtmlLabel: boolean; key: string; itemsId: string; isActive: boolean; icon: string | null;
    collapsible: boolean; collapsed: boolean; items: NavigationItemView[]; dropdownItems: NavigationItemView[]; extraSidebarAttributes: string; extraTopbarAttributes: string;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const attributesHtml = (attributes: Record<string, string | number | boolean | null>) => (Object.keys(attributes).length ? new Attributes(attributes as any).toHtml() : '');
/** `id` of a group's item list: the label's slug and a short hash, so that two labels never share one. */
export const navigationGroupItemsId = (key: string) => `fi-sidebar-group-items-${slug(key)}-${createHash('md5').update(key).digest('hex').slice(0, 8)}`;

export type NavigationViewOptions = {
    path: string;
    badgeColorClasses: (color: string) => string[];
    /** Computed page badges, by page slug. */
    badges: Map<string, string | number | null>;
};
/** The view of an item (and its children): label, active state, icon (the active icon while active), badge. */
export function navigationItemView(item: NavigationItem, children: NavigationItem[], options: NavigationViewOptions): NavigationItemView {
    const childItems = children.map((child) => navigationItemView(child, child._childItems, options));
    const activeChildItems = childItems.some((child) => child.isActive || child.activeChildItems);
    const isActive = !activeChildItems && item.isActive(options.path);
    const badge = item._page !== null && options.badges.has(item._page) ? options.badges.get(item._page)! : item.getBadge();
    return {
        label: navigationLabelText(item._label), labelHtml: navigationLabelHtml(item._label), isHtmlLabel: item._label instanceof HtmlString,
        url: item._url ?? '', icon: isActive && item._activeIcon ? item._activeIcon : item._icon, isActive,
        badge: badge === '' ? null : badge ?? null, badgeColorClasses: options.badgeColorClasses(item.getBadgeColor(badge ?? null)), badgeTooltip: item.getBadgeTooltip(badge ?? null),
        childItems, activeChildItems, newTab: item._newTab, extraAttributes: attributesHtml(item._extraAttributes),
    };
}
/** The view of a group with its (already grouped) items. */
export function navigationGroupView(group: NavigationGroup | null, items: NavigationItemView[], panelCollapsibleDefault: boolean): NavigationGroupView {
    const label = group?.getLabel() ?? null;
    const key = navigationGroupKey(label) ?? '';
    const icon = group?.getIcon() ?? null;
    return {
        label: label === null ? null : navigationLabelText(label), labelHtml: label === null ? null : navigationLabelHtml(label), isHtmlLabel: label instanceof HtmlString,
        key, itemsId: label === null ? '' : navigationGroupItemsId(key), isActive: items.some((item) => item.isActive || item.activeChildItems), icon,
        // Items of a group with an icon have none (as in Filament).
        items: icon ? items.map((item) => ({ ...item, icon: null })) : items, dropdownItems: items,
        collapsible: group?.isCollapsible(panelCollapsibleDefault) ?? panelCollapsibleDefault, collapsed: group?.isCollapsed() ?? false,
        extraSidebarAttributes: attributesHtml(group?.getExtraSidebarAttributes() ?? {}), extraTopbarAttributes: attributesHtml(group?.getExtraTopbarAttributes() ?? {}),
    };
}
/** Groups built with the navigation builder, as views. */
export function builtNavigationViews(groups: NavigationGroup[], options: NavigationViewOptions & { hiddenPages: Set<string>; panelCollapsibleDefault: boolean }): NavigationGroupView[] {
    return groups.map((group) => {
        const items = group.getItems().filter((item) => item._page === null || !options.hiddenPages.has(item._page));
        return navigationGroupView(group.getLabel() === null ? null : group, items.map((item) => navigationItemView(item, item._childItems, options)), options.panelCollapsibleDefault);
    }).filter((group) => group.items.length);
}

/**
 * Breadcrumbs leading to a navigation item (Filament's navigation hierarchy in breadcrumbs): the group label, then the
 * parent items. `null` when no item links to this URL.
 */
export function navigationHierarchyBreadcrumbs(groups: NavigationGroupView[], url: string): { label: string; url: string | null }[] | null {
    const find = (items: NavigationItemView[]): { label: string; url: string | null }[] | null => {
        for (const item of items) {
            if (item.url && item.url === url) return [];
            const below = find(item.childItems);
            if (below !== null) return [{ label: item.label, url: item.url || null }, ...below];
        }
        return null;
    };
    for (const group of groups) {
        const crumbs = find(group.dropdownItems);
        if (crumbs === null) continue;
        return group.label ? [{ label: group.label, url: null }, ...crumbs] : crumbs;
    }
    return null;
}

/** A CSS length for a layout option (`20rem`, `320px`, `calc(...)` with no character that could leave the declaration). */
export function cssLength(value: string, option: string): string {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9.%()+\-*/ ]{1,60}$/.test(value)) throw new Error(`${option}(): invalid CSS length "${String(value)}".`);
    return value;
}
/** A content width name (`lg`, `7xl`, `full`, `screen-2xl`…), used in a `fi-width-*` class. */
export function contentWidth(value: string): string {
    if (typeof value !== 'string' || !/^[a-z0-9-]{1,30}$/.test(value)) throw new Error(`Invalid content width "${String(value)}": use a width name such as "lg", "7xl" or "full".`);
    return value;
}
