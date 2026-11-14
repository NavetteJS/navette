// @navette-js/support/ui — base UI components (button, badge, modal…) usable on their own, outside a panel.
// Each function returns an HTML string.
import { ModalComponent } from './modal-component.ts';
import { Attributes, cls, e, icon, icons, js, loadingIndicator, views, type ColorManager } from './index.ts';
import { t, tc } from './i18n.ts';
import { fileURLToPath } from 'node:url';

// The base views (`filament::components.*`) live in this package so they work without a panel.
views.namespace('filament', fileURLToPath(new URL('../views', import.meta.url)));

let manager: ColorManager | null = null;
/** Sets the color manager used by the components (usually the panel's). */
export const useColorManager = (colors: ColorManager) => { manager = colors; };
const colorsOf = (component: Parameters<ColorManager['getComponentClasses']>[0], color: string | null | undefined): string[] => {
    if (!manager) throw new Error('No color manager: call useColorManager() first.');
    return color && color !== 'gray' ? manager.getComponentClasses(component, color) : [];
};

export type Attrs = Record<string, string | number | boolean | null | undefined>;
/** Alpine tooltip of a button, link or icon button (Filament's `tooltip` attribute). */
const tooltipAttribute = (tooltip: string | null | undefined): Attrs => (tooltip ? { 'x-tooltip': `{\n content: ${js(tooltip)},\n theme: $store.theme,\n allowHTML: false,\n }` } : {});
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// ------------------------------------------------------------------ badge
export type BadgeProps = { color?: string; size?: Size; icon?: string | null; iconPosition?: 'before' | 'after'; tag?: string; attributes?: Attrs };
/** Badge. */
export function badge(props: BadgeProps = {}, slot = ''): string {
    const { color = 'primary', size = 'md', tag = 'span' } = props;
    const attributes = new Attributes(props.attributes ?? {}).class([...colorsOf('badge', color), 'fi-badge', `fi-size-${size}`]);
    const iconHtml = props.icon ? icon(props.icon, { size: 'sm' }) : '';
    return `<${tag} ${attributes.toHtml()}>${props.iconPosition === 'after' ? '' : iconHtml}<span class="fi-badge-label-ctn"><span class="fi-badge-label">${slot}</span></span>${props.iconPosition === 'after' ? iconHtml : ''}</${tag}>`;
}
/** Small counter on a button or link (rendered without the badge label wrapper). */
const counter = (value: string | number, color = 'primary'): string => `<span class="${cls([...colorsOf('badge', color), 'fi-badge', 'fi-size-xs'])}">${e(String(value))}</span>`;

// ------------------------------------------------------------------ icon-button
export type IconButtonProps = { icon: string; label: string; color?: string; size?: Size; disabled?: boolean; tag?: 'button' | 'a'; href?: string | null; badge?: string | number | null; badgeColor?: string; tooltip?: string | null; attributes?: Attrs };
const ICON_BUTTON_ICON_SIZE: Record<Size, string> = { xs: 'sm', sm: 'md', md: 'md', lg: 'lg', xl: 'lg' };
/** Icon-only button; the label is used as tooltip and accessible name. */
export function iconButton(props: IconButtonProps): string {
    const { color = 'primary', size = 'md', disabled = false, tag = 'button' } = props;
    // The caller's classes go after the component's own classes.
    const { class: extraClass = null, ...rest } = (props.attributes ?? {}) as Attrs & { class?: string };
    const tooltip = props.tooltip || null;
    const attributes = new Attributes({ ...tooltipAttribute(tooltip), ...rest })
        .merge({
            // A disabled button with a tooltip stays focusable, so its tooltip can show.
            'aria-disabled': disabled ? 'true' : null, 'aria-label': props.label, disabled: disabled && !tooltip, href: tag === 'a' && !(disabled && tooltip) ? (props.href ?? null) : null, tabindex: tag === 'a' && disabled && tooltip ? '0' : null, title: tooltip ? null : props.label,
            type: tag === 'button' ? 'button' : null, 'wire:loading.attr': tag === 'button' ? 'aria-disabled' : null, 'wire:loading.class': tag === 'button' ? 'fi-disabled' : null,
        })
        .class([...colorsOf('icon-button', color), 'fi-icon-btn', { 'fi-disabled': disabled }, `fi-size-${size}`, extraClass]);
    const badgeHtml = props.badge !== null && props.badge !== undefined ? `<div class="fi-icon-btn-badge-ctn">${counter(props.badge, props.badgeColor)}</div>` : '';
    return `<${tag} ${attributes.toHtml()}>${icon(props.icon, { size: ICON_BUTTON_ICON_SIZE[size] })}${badgeHtml}</${tag}>`;
}

// ------------------------------------------------------------------ button
export type ButtonProps = {
    color?: string; size?: Size; outlined?: boolean; disabled?: boolean; tag?: 'button' | 'a'; type?: string; href?: string | null;
    icon?: string | null; iconPosition?: 'before' | 'after'; badge?: string | number | null; badgeColor?: string;
    /** Tooltip shown on hover (Alpine `x-tooltip`); a disabled button with a tooltip stays focusable. */
    tooltip?: string | null; attributes?: Attrs;
};
/** Button. */
export function button(props: ButtonProps = {}, slot = ''): string {
    const { color = 'primary', size = 'md', outlined = false, disabled = false, tag = 'button', type = 'button', iconPosition = 'before' } = props;
    const tooltip = props.tooltip || null;
    const attributes = new Attributes({ ...tooltipAttribute(tooltip), ...(props.attributes ?? {}) })
        .merge({
            'aria-disabled': disabled ? 'true' : null, disabled: disabled && !tooltip, href: tag === 'a' ? (props.href ?? null) : null, tabindex: tag === 'a' && disabled && tooltip ? '0' : null,
            type: tag === 'button' ? type : null, 'wire:loading.attr': tag === 'button' ? 'aria-disabled' : null, 'wire:loading.class': tag === 'button' ? 'fi-disabled' : null,
        })
        .class([...colorsOf(outlined ? 'button-outlined' : 'button', color), 'fi-btn', { 'fi-disabled': disabled, 'fi-outlined': outlined }, `fi-size-${size}`]);
    const iconHtml = props.icon ? icon(props.icon) : '';
    const badgeHtml = props.badge !== null && props.badge !== undefined ? `<div class="fi-btn-badge-ctn">${counter(props.badge, props.badgeColor)}</div>` : '';
    return `<${tag} ${attributes.toHtml()}>${iconPosition === 'before' ? iconHtml : ''}${slot}${iconPosition === 'after' ? iconHtml : ''}${badgeHtml}</${tag}>`;
}

// ------------------------------------------------------------------ link
export type LinkProps = {
    href?: string | null; color?: string; size?: Size; weight?: string | null; tag?: 'a' | 'button'; icon?: string | null; iconPosition?: 'before' | 'after';
    badge?: string | number | null; badgeColor?: string; disabled?: boolean;
    /** Tooltip shown on hover (Alpine `x-tooltip`). */
    tooltip?: string | null; attributes?: Attrs;
};
/** Link. */
export function link(props: LinkProps = {}, slot = ''): string {
    const { color = 'primary', size = 'md', tag = 'a', iconPosition = 'before' } = props;
    const tooltip = props.tooltip || null, disabled = props.disabled === true;
    const attributes = new Attributes({ ...tooltipAttribute(tooltip), ...(props.attributes ?? {}) })
        .merge({ 'aria-disabled': disabled ? 'true' : null, disabled: tag === 'button' && disabled && !tooltip, href: tag === 'a' ? (props.href ?? null) : null, tabindex: tag === 'a' && disabled && tooltip ? '0' : null, type: tag === 'button' ? 'button' : null })
        .class([...colorsOf('link', color), 'fi-link', { 'fi-disabled': disabled }, `fi-size-${size}`, props.weight ? `fi-font-${props.weight}` : null]);
    const iconHtml = props.icon ? icon(props.icon) : '';
    const badgeHtml = props.badge !== null && props.badge !== undefined ? `<div class="fi-link-badge-ctn">${counter(props.badge, props.badgeColor)}</div>` : '';
    return `<${tag} ${attributes.toHtml()}>${iconPosition === 'before' ? iconHtml : ''}<span class="fi-link-label">${slot}</span>${iconPosition === 'after' ? iconHtml : ''}${badgeHtml}</${tag}>`;
}

// ------------------------------------------------------------------ avatar
/** Avatar image, circular by default. */
export function avatar(props: { src: string; alt?: string; size?: Size; circular?: boolean; attributes?: Attrs }): string {
    const attributes = new Attributes(props.attributes ?? {}).merge({ alt: props.alt ?? null, src: props.src }).class(['fi-avatar', { 'fi-circular': props.circular !== false }, `fi-size-${props.size ?? 'md'}`]);
    return `<img ${attributes.toHtml()} />`;
}

// ------------------------------------------------------------------ breadcrumbs
/**
 * Breadcrumbs. An item without `url` is plain text; an item with an empty `url` is still a link, without `href`.
 * The last item is the current page.
 */
export function breadcrumbs(items: { label: string; url?: string | null }[], label = 'Breadcrumb'): string {
    const separators = icon('m-chevron-right', { alias: 'breadcrumbs.separator', attributes: new Attributes({ 'aria-hidden': 'true', class: 'fi-breadcrumbs-item-separator fi-ltr' }) }) + icon('m-chevron-left', { alias: 'breadcrumbs.separator.rtl', attributes: new Attributes({ 'aria-hidden': 'true', class: 'fi-breadcrumbs-item-separator fi-rtl' }) });
    const list = items.map((item, index) => `<li class="fi-breadcrumbs-item">${index > 0 ? separators : ''}${((current) => (item.url === undefined || item.url === null ? `<span${current} class="fi-breadcrumbs-item-label">${e(item.label)}</span>` : `<a${item.url ? ` href="${e(item.url)}"` : ''}${current} class="fi-breadcrumbs-item-label">${e(item.label)}</a>`))(index === items.length - 1 ? ' aria-current="page"' : '')}</li>`);
    return `<nav class="fi-breadcrumbs" aria-label="${e(label)}"><ol class="fi-breadcrumbs-list">${list.join('')}</ol></nav>`;
}

// ------------------------------------------------------------------ basic inputs
/** Bare checkbox. */
export function checkbox(props: { checked?: boolean; valid?: boolean; attributes?: Attrs } = {}): string {
    const attributes = new Attributes(props.attributes ?? {}).merge({ type: 'checkbox', checked: props.checked === true }).class(['fi-checkbox-input', props.valid === false ? 'fi-invalid' : 'fi-valid']);
    return `<input ${attributes.toHtml()} />`;
}
/** Loading spinner. */
export function spinner(attributes: Attrs = {}): string {
    // The caller's classes go after the component's own classes.
    const { class: extra, ...rest } = attributes;
    const html = loadingIndicator(new Attributes(rest));
    return extra ? html.replace(/class="([^"]*)"/, (_, own) => `class="${own} ${e(String(extra))}"`) : html;
}

// ------------------------------------------------------------------ text input and wrapper
export type InputWrapperProps = {
    prefix?: string | null; suffix?: string | null; prefixIcon?: string | null; suffixIcon?: string | null; prefixIconColor?: string; suffixIconColor?: string;
    disabled?: boolean; valid?: boolean; inlinePrefix?: boolean; inlineSuffix?: boolean;
    /** Alpine expressions for the error and disabled states, instead of `valid` and `disabled` (`alpine-valid="! errors.includes('name')"`). */
    alpineValid?: string | null; alpineDisabled?: string | null; attributes?: Attrs;
};
const FOCUS_INPUT = "if (! $event.target.closest('.fi-input-wrp-actions')) $dispatch('focus-input')";
const affixIcon = (name: string, color: string | undefined) => icon(name, { attributes: new Attributes().class(color && color !== 'gray' ? ['fi-color', `fi-color-${color}`] : []) });
/** Input wrapper: border, prefix and suffix (text or icon). */
export function inputWrapper(props: InputWrapperProps = {}, slot = ''): string {
    const hasPrefix = !!(props.prefix || props.prefixIcon), hasSuffix = !!(props.suffix || props.suffixIcon);
    const alpineValid = props.alpineValid || null, alpineDisabled = props.alpineDisabled || null;
    const alpineClasses: Attrs = alpineValid || alpineDisabled ? { 'x-bind:class': `{\n${alpineDisabled ? ` 'fi-disabled': ${alpineDisabled},\n` : ''}${alpineValid ? ` 'fi-invalid': ! (${alpineValid}),\n` : ''} }` } : {};
    const attributes = new Attributes({ ...alpineClasses, ...(props.attributes ?? {}) }).class(['fi-input-wrp', { 'fi-disabled': !alpineDisabled && props.disabled === true, 'fi-invalid': !alpineValid && props.valid === false }]);
    const prefix = hasPrefix ? `<div x-on:click="${FOCUS_INPUT}" class="${cls(['fi-input-wrp-prefix', 'fi-input-wrp-prefix-has-content', { 'fi-inline': props.inlinePrefix === true, 'fi-input-wrp-prefix-has-label': !!props.prefix }])}">${props.prefixIcon ? affixIcon(props.prefixIcon, props.prefixIconColor) : ''}${props.prefix ? `<span class="fi-input-wrp-label">${e(props.prefix)}</span>` : ''}</div>` : '';
    const suffix = hasSuffix ? `<div x-on:click="${FOCUS_INPUT}" class="${cls(['fi-input-wrp-suffix', { 'fi-inline': props.inlineSuffix === true, 'fi-input-wrp-suffix-has-label': !!props.suffix }])}">${props.suffix ? `<span class="fi-input-wrp-label">${e(props.suffix)}</span>` : ''}${props.suffixIcon ? affixIcon(props.suffixIcon, props.suffixIconColor) : ''}</div>` : '';
    return `<div ${attributes.toHtml()}>${prefix}<div class="fi-input-wrp-content-ctn">${slot}</div>${suffix}</div>`;
}
/** Bare text input, meant to be placed in `inputWrapper`. */
export function input(attributes: Attrs = {}): string { return `<input ${new Attributes(attributes).class(['fi-input']).toHtml()} />`; }
/** Bare native select; `slot` holds the `<option>` elements. */
export function select(attributes: Attrs = {}, slot = ''): string { return `<select ${new Attributes(attributes).class(['fi-select-input']).toHtml()}>${slot}</select>`; }
/** Fieldset with an optional legend. */
export function fieldset(props: { label?: string | null; labelHidden?: boolean; attributes?: Attrs } = {}, slot = ''): string {
    const attributes = new Attributes(props.attributes ?? {}).class(['fi-fieldset', { 'fi-fieldset-label-hidden': props.labelHidden === true }]);
    return `<fieldset ${attributes.toHtml()}>${props.label ? `<legend>${e(props.label)}</legend>` : ''}${slot}</fieldset>`;
}

// ------------------------------------------------------------------ callout
export type CalloutProps = {
    heading?: string | null; description?: string | null; color?: string | null; icon?: string | null; iconColor?: string | null; iconSize?: 'sm' | 'md' | 'lg';
    footer?: string | null; controls?: string | null; attributes?: Attrs;
};
const colorMark = (color: string | null | undefined) => (color && color !== 'gray' ? ['fi-color', `fi-color-${color}`] : []);
/** Callout box. `footer` and `controls` take already rendered HTML (buttons…). */
export function callout(props: CalloutProps = {}): string {
    const attributes = new Attributes(props.attributes ?? {}).class(['fi-callout', ...colorMark(props.color)]);
    const iconHtml = props.icon ? icon(props.icon, { size: props.iconSize ?? 'lg', attributes: new Attributes().class([...colorMark(props.iconColor ?? props.color), 'fi-callout-icon']) }) : '';
    const text = `<div class="fi-callout-text">${props.heading ? `<h4 class="fi-callout-heading">${e(props.heading)}</h4>` : ''}${props.description ? `<p class="fi-callout-description">${e(props.description)}</p>` : ''}</div>`;
    return `<div ${attributes.toHtml()}>${iconHtml}<div class="fi-callout-main">${text}${props.footer ? `<div class="fi-callout-footer">${props.footer}</div>` : ''}</div>${props.controls ? `<div class="fi-callout-controls">${props.controls}</div>` : ''}</div>`;
}

// ------------------------------------------------------------------ empty-state
export type EmptyStateProps = { heading: string; description?: string | null; icon?: string | null; iconColor?: string; iconSize?: 'sm' | 'md' | 'lg'; footer?: string | null; contained?: boolean; attributes?: Attrs };
/** Empty state: icon, heading, description and footer (already rendered actions). */
export function emptyState(props: EmptyStateProps): string {
    const color = props.iconColor ?? 'primary';
    const attributes = new Attributes(props.attributes ?? {}).class(['fi-empty-state', { 'fi-empty-state-not-contained': props.contained === false }]);
    const iconHtml = props.icon ? `<div class="${cls(['fi-empty-state-icon-bg', ...colorMark(color)])}">${icon(props.icon, { size: props.iconSize ?? 'lg', attributes: new Attributes().class(colorMark(color)) })}</div>` : '';
    return `<div ${attributes.toHtml()}><div class="fi-empty-state-content">${iconHtml}<div class="fi-empty-state-text-ctn"><h2 class="fi-empty-state-heading">${e(props.heading)}</h2>${props.description ? `<p class="fi-empty-state-description">${e(props.description)}</p>` : ''}${props.footer ? `<footer class="fi-empty-state-footer">${props.footer}</footer>` : ''}</div></div></div>`;
}

// ------------------------------------------------------------------ pagination
export type PaginationProps = {
    /** Host component id (prefix of the `wire:key` values). */
    id: string; page: number; perPage: number;
    /** Total record count; omit it for simple (previous / next) pagination. */
    total?: number; hasMore?: boolean; pageOptions?: (number | 'all')[]; extremeLinks?: boolean; property?: string;
    /** Other methods or properties whose requests disable the buttons too (`:loading-targets="['search']"`). */
    loadingTargets?: string[];
};
/** Page numbers to show: all of them up to eleven pages, otherwise a window around the current page. */
function pageElements(current: number, last: number): (number | '...')[] {
    if (last <= 11) return Array.from({ length: last }, (_, i) => i + 1);
    const pages = new Set([1, 2, last - 1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
    const out: (number | '...')[] = [];
    for (const p of [...pages].sort((a, b) => a - b)) { if (out.length && p - (out[out.length - 1] as number) > 1) out.push('...'); out.push(p); }
    return out;
}
/** Pagination bound to the host component's `previousPage`, `nextPage` and `gotoPage` methods. */
export function pagination(props: PaginationProps): string {
    const simple = props.total === undefined;
    const lastPage = simple ? props.page + (props.hasMore ? 1 : 0) : Math.max(1, Math.ceil(props.total! / props.perPage));
    const from = (props.page - 1) * props.perPage + 1;
    const property = props.property ?? 'tableRecordsPerPage';
    return views.render('filament::components.pagination', {
        id: props.id, simple, extremeLinks: props.extremeLinks === true, property, t, tc,
        targets: [...new Set([...(props.loadingTargets ?? []), 'previousPage', 'gotoPage', 'setPage', 'nextPage', 'paginators', property])].join(','),
        page: { page: props.page, lastPage, total: props.total ?? 0, from, to: simple ? from + props.perPage - 1 : Math.min(props.total!, from + props.perPage - 1) },
        number: (n: number) => n.toLocaleString('en-US'), pageOptions: props.pageOptions ?? [], elements: pageElements(props.page, lastPage),
        attrs: (o: Attrs) => new Attributes(o),
    });
}

// ------------------------------------------------------------------ section
export type SectionProps = {
    heading?: string | null; description?: string | null; icon?: string | null; iconColor?: string | null; iconSize?: 'sm' | 'md' | 'lg'; headingTag?: string;
    afterHeader?: string | null; footer?: string | null; collapsible?: boolean; collapsed?: boolean; aside?: boolean; contentBefore?: boolean;
    compact?: boolean; contained?: boolean; divided?: boolean; secondary?: boolean;
    /** Keeps the collapsed state in the browser's local storage, under the section's `id` (or `collapseId`). */
    persistCollapsed?: boolean; collapseId?: string | null; attributes?: Attrs;
};
/** Collapsible card with an optional header (icon, heading, description, after-header area). */
export function section(props: SectionProps = {}, slot = ''): string {
    const collapsible = props.collapsible === true, collapsed = collapsible && props.collapsed === true;
    const persistCollapsed = props.persistCollapsed === true, collapseId = js(props.collapseId ?? null);
    const hasText = !!props.heading || !!props.description;
    const hasHeader = !!props.icon || hasText || collapsible || !!props.afterHeader;
    const tag = props.headingTag ?? 'h2';
    const expand = t('filament::components/section.actions.expand.label'), collapse = t('filament::components/section.actions.collapse.label');
    const attributes = new Attributes(props.attributes ?? {})
        .merge({
            'x-data': persistCollapsed ? `{ isCollapsed: $persist(${collapsed ? 'true' : 'false'}).as(\`filament:section:collapsed:\${${collapseId} ?? $el.id}\`) , }` : `{ isCollapsed: ${collapsed ? 'true' : 'false'} , }`,
            ...(collapsible ? {
                'x-id': "['fi-section-content']",
                'x-on:collapse-section.window': `if ($event.detail.id == (${collapseId} ?? $el.id)) isCollapsed = true`,
                'x-on:expand': 'isCollapsed = false',
                'x-on:expand-section.window': `if ($event.detail.id == (${collapseId} ?? $el.id)) isCollapsed = false`,
                'x-on:open-section.window': `if ($event.detail.id == (${collapseId} ?? $el.id)) isCollapsed = false`,
                'x-on:toggle-section.window': `if ($event.detail.id == (${collapseId} ?? $el.id)) isCollapsed = ! isCollapsed`,
                'x-bind:class': "isCollapsed && 'fi-collapsed'",
            } : {}),
        })
        .class(['fi-section', {
            'fi-section-not-contained': props.contained === false, 'fi-section-has-content-before': props.contentBefore === true, 'fi-section-has-header': hasHeader,
            'fi-aside': props.aside === true, 'fi-compact': props.compact === true, 'fi-collapsible': collapsible, 'fi-divided': props.divided === true, 'fi-secondary': props.secondary === true,
        }]);
    const text = hasText ? `<div class="fi-section-header-text-ctn">${props.heading ? `<${tag} class="fi-section-header-heading">${e(props.heading)}</${tag}>` : ''}${props.description ? `<p class="fi-section-header-description">${e(props.description)}</p>` : ''}</div>` : '';
    const content = hasText || props.afterHeader ? `<div class="${cls(['fi-section-header-content', { 'fi-section-header-content-has-heading': hasText }])}">${text}${props.afterHeader ? `<div class="fi-section-header-after-ctn">${props.afterHeader}</div>` : ''}</div>` : '';
    const toggle = collapsible ? iconButton({ color: 'gray', icon: icons.resolve('section.collapse-button') ?? 'm-chevron-up', label: collapsed ? expand : collapse, attributes: {
        'x-bind:aria-label': `isCollapsed ? ${js(expand)} : ${js(collapse)}`, 'aria-expanded': collapsed ? 'false' : 'true', 'x-bind:aria-expanded': '(! isCollapsed).toString()',
        'x-bind:aria-controls': "$id('fi-section-content')", 'x-on:click.stop': 'isCollapsed = ! isCollapsed', class: 'fi-section-collapse-btn',
    } }) : '';
    const header = hasHeader ? `<header${collapsible ? ` x-on:click="if (! $event.target.closest('.fi-section-header-after-ctn')) isCollapsed = ! isCollapsed"` : ''} class="fi-section-header">${props.icon ? icon(props.icon, { size: props.iconSize ?? 'lg', attributes: new Attributes().class(colorMark(props.iconColor)) }) : ''}${content}${toggle}</header>` : '';
    const body = slot !== '' || props.footer ? `<div${collapsible ? ` x-bind:id="$id('fi-section-content')"${collapsed || persistCollapsed ? ' x-cloak' : ''}` : ''} class="fi-section-content-ctn">${slot !== '' ? `<div class="fi-section-content">${slot}</div>` : ''}${props.footer ? `<footer class="fi-section-footer">${props.footer}</footer>` : ''}</div>` : '';
    return `<section ${attributes.toHtml()}>${header}${body}</section>`;
}

// ------------------------------------------------------------------ tabs
export type TabItem = {
    label: string; active?: boolean; icon?: string | null; iconPosition?: 'before' | 'after'; badge?: string | number | null; badgeColor?: string; tag?: 'button' | 'a'; href?: string | null;
    /** Alpine expression making the tab active (`alpine-active="activeTab === 'tab1'"`), instead of `active`. */
    alpineActive?: string | null;
    /** Label as HTML already escaped (the content of a `<x-tabs.item>` tag), used instead of `label`. */
    labelHtml?: string | null;
    attributes?: Attrs;
};
/** One tab (`<x-tabs.item>`). */
export function tabItem(item: TabItem): string {
    const tag = item.tag ?? 'button';
    const alpineActive = item.alpineActive || null;
    const itemAttributes = new Attributes({ ...(alpineActive ? { 'x-bind:class': `{\n 'fi-active': ${alpineActive},\n }` } : {}), ...(item.attributes ?? {}) })
        .merge({ type: tag === 'button' ? 'button' : null, href: tag === 'a' ? (item.href ?? null) : null, 'aria-current': item.active ? (tag === 'a' ? 'page' : 'true') : null })
        .class(['fi-tabs-item', { 'fi-active': !alpineActive && item.active === true }]);
    const iconHtml = item.icon ? icon(item.icon) : '';
    const badgeHtml = item.badge !== null && item.badge !== undefined ? badge({ color: item.badgeColor ?? 'primary', size: 'sm' }, e(String(item.badge))) : '';
    return `<${tag} ${itemAttributes.toHtml()}>${item.iconPosition === 'after' ? '' : iconHtml}<span class="fi-tabs-item-label">${item.labelHtml ?? e(item.label)}</span>${item.iconPosition === 'after' ? iconHtml : ''}${badgeHtml}</${tag}>`;
}
/** Tabs: a list of items, or `slot` holding rendered `<x-tabs.item>` tags. */
export function tabs(props: { label?: string | null; vertical?: boolean; contained?: boolean; attributes?: Attrs }, items: TabItem[] = [], slot = ''): string {
    const attributes = new Attributes(props.attributes ?? {}).merge({ 'aria-label': props.label ?? null }).class(['fi-tabs', { 'fi-contained': props.contained === true, 'fi-vertical': props.vertical === true }]);
    return `<nav ${attributes.toHtml()}>${items.map(tabItem).join('')}${slot}</nav>`;
}

// ------------------------------------------------------------------ dropdown
export type DropdownItem = {
    label: string; icon?: string | null; color?: string; iconColor?: string | null; image?: string | null; badge?: string | number | null; badgeColor?: string;
    tag?: 'button' | 'a'; href?: string | null; disabled?: boolean; attributes?: Attrs;
    /** Label as HTML already escaped (the content of a `<x-dropdown-item>` tag), used instead of `label`. */
    labelHtml?: string | null;
};
/** Dropdown menu item. */
export function dropdownItem(item: DropdownItem): string {
    const tag = item.tag ?? 'button';
    const color = item.color ?? 'gray';
    const attributes = new Attributes(item.attributes ?? {})
        .merge({
            'aria-disabled': item.disabled ? 'true' : null, disabled: item.disabled === true && tag === 'button', href: tag === 'a' ? (item.href ?? null) : null, role: 'menuitem', tabindex: '-1',
            type: tag === 'button' ? 'button' : null, 'wire:loading.attr': tag === 'button' ? 'aria-disabled' : null, 'wire:loading.class': tag === 'button' ? 'fi-disabled' : null,
        })
        .class([...colorsOf('dropdown-item', color), 'fi-dropdown-list-item', { 'fi-disabled': item.disabled === true }]);
    const iconColor = item.iconColor ?? (color !== 'gray' ? color : null);
    const lead = item.icon ? icon(item.icon, { attributes: new Attributes().class(colorMark(iconColor)) }) : item.image ? `<div class="fi-dropdown-list-item-image" style="background-image: url('${e(item.image)}')"></div>` : '';
    const badgeHtml = item.badge !== null && item.badge !== undefined ? `<span class="${cls([...colorsOf('badge', item.badgeColor ?? 'primary'), 'fi-badge'])}">${e(String(item.badge))}</span>` : '';
    return `<${tag} ${attributes.toHtml()}>${lead}<span class="fi-dropdown-list-item-label">${item.labelHtml ?? e(item.label)}</span>${badgeHtml}</${tag}>`;
}
/** List of dropdown menu items. */
export function dropdownList(items: DropdownItem[]): string { return `<div class="fi-dropdown-list">${items.map(dropdownItem).join('')}</div>`; }
/** Dropdown: `trigger` is the trigger's HTML, `slot` the panel content. */
export function dropdown(props: {
    trigger: string; width?: string | null; maxHeight?: string | null; placement?: string | null; offset?: number;
    /** `false` for content other than a menu (form fields…): no menu role, native keyboard interactions. */
    menu?: boolean; attributes?: Attrs;
}, slot = ''): string {
    const menu = props.menu !== false;
    const attributes = new Attributes(props.attributes ?? {}).merge({ 'x-data': `filamentDropdown({ isMenu: ${menu ? 'true' : 'false'} })` }).class(['fi-dropdown']);
    const float = `x-float${props.placement ? `.placement.${props.placement}` : ''}.flip.offset`;
    return `<div ${attributes.toHtml()}><div x-on:mousedown="if ($event.button === 0) toggle($event)" class="fi-dropdown-trigger">${props.trigger}</div><div x-cloak ${float}="{ offset: ${props.offset ?? 8}, }" x-ref="panel" x-transition:enter-start="fi-opacity-0" x-transition:leave-end="fi-opacity-0"${menu ? ' role="menu"' : ''} class="${cls(['fi-dropdown-panel', props.width ? `fi-width-${props.width}` : null, { 'fi-scrollable': !!props.maxHeight }])}" style="${props.maxHeight ? `max-height: ${e(props.maxHeight)};` : ''}">${slot}</div></div>`;
}

// ------------------------------------------------------------------ modal
export type ModalProps = {
    id: string; heading?: string | null; description?: string | null; eyebrow?: string | null; icon?: string | null; iconColor?: string;
    /** Footer buttons (already rendered HTML), or `footer` for a fully custom footer. */
    footerActions?: string[]; footer?: string | null; footerActionsAlignment?: 'start' | 'center' | 'end';
    alignment?: 'start' | 'center'; width?: string; slideOver?: boolean; stickyHeader?: boolean; stickyFooter?: boolean; alert?: boolean;
    /** Unset: the app-wide default (`ModalComponent.closeButton()`, `closedByClickingAway()`, `closedByEscaping()`). */
    closeButton?: boolean; closeByClickingAway?: boolean; closeByEscaping?: boolean;
    /** Host component id, used to prefix `wire:key` values when the modal lives in a stateful component. */
    livewireId?: string | null;
    /** HTML of the element opening the modal on click (the `trigger` slot). */
    trigger?: string | null;
    /** Attributes of the trigger's wrapper; `disabled` stops it from opening the modal. */
    triggerAttributes?: Attrs;
    /** `false`: the first focusable element is not focused when the modal opens (unset: `ModalComponent.autofocus()`). */
    autofocus?: boolean;
};
/** Modal, opened by an `open-modal` event carrying its id. */
export function modal(props: ModalProps, slot = ''): string {
    const { alignment = 'start', width = 'sm', closeButton = ModalComponent.hasCloseButton, closeByClickingAway = ModalComponent.isClosedByClickingAway, closeByEscaping = ModalComponent.isClosedByEscaping } = props;
    const id = props.id || `fi-modal-${Math.random().toString(36).slice(2, 12)}`;
    const trap = (props.autofocus ?? ModalComponent.isAutofocused) === false ? 'x-trap.noreturn.noautofocus' : 'x-trap.noreturn';
    const hasHeading = !!props.heading, hasDescription = !!props.description && hasHeading;
    const hasFooter = !!props.footer || (props.footerActions?.length ?? 0) > 0;
    const hasContent = slot !== '';
    const key = (part: string) => `${props.livewireId ? `${props.livewireId}.` : ''}modal.${id}.${part}`;
    const close = `$dispatch('close-modal', { id: ${js(id)} })`;
    const iconColor = props.iconColor ?? 'primary';
    // Scrolling window (slide-over, sticky header or footer): the focus trap goes on the window itself, not its container.
    const trapOnWindow = props.slideOver === true || props.stickyHeader === true || props.stickyFooter === true;
    const closeHtml = closeButton ? iconButton({ color: 'gray', icon: icons.resolve('modal.close-button') ?? 'o-x-mark', label: t('filament::components/modal.actions.close.label'), attributes: { tabindex: closeByEscaping ? '-1' : null, 'x-on:click': close, class: 'fi-modal-close-btn' } }).replace('fi-icon fi-size-md', 'fi-icon fi-size-lg') : '';
    const iconHtml = props.icon ? `<div class="fi-modal-icon-ctn"><div class="${cls([...colorMark(iconColor), 'fi-modal-icon-bg'])}">${icon(props.icon, { size: 'lg' })}</div></div>` : '';
    const header = hasHeading ? `<div wire:key="${e(key('header'))}" class="${cls(['fi-modal-header', { 'fi-vertical-align-center': !!props.icon && !props.eyebrow && !hasDescription && alignment === 'start' }])}">${closeHtml}${iconHtml}<div>${props.eyebrow ? `<p class="fi-modal-eyebrow">${e(props.eyebrow)}</p>` : ''}<h2 id="${e(id)}.heading" class="fi-modal-heading">${e(props.heading!)}</h2>${hasDescription ? `<p id="${e(id)}.description" class="fi-modal-description">${e(props.description!)}</p>` : ''}</div></div>` : '';
    const content = hasContent ? `<div wire:key="${e(key('content'))}" class="fi-modal-content">${slot}</div>` : '';
    const footer = hasFooter ? `<div wire:key="${e(key('footer'))}" class="${cls(['fi-modal-footer', `fi-align-${props.footerActionsAlignment ?? 'start'}`])}">${props.footer ? props.footer : `<div class="fi-modal-footer-actions">${(props.footerActions ?? []).join('')}</div>`}</div>` : '';
    const windowClasses = cls(['fi-modal-window', { 'fi-modal-window-has-close-btn': closeButton, 'fi-modal-window-has-content': hasContent, 'fi-modal-window-has-footer': hasFooter, 'fi-modal-window-has-icon': !!props.icon }, `fi-align-${alignment}`, `fi-width-${width}`]);
    const outer = new Attributes()
        .merge({
            'aria-describedby': hasDescription ? `${id}.description` : null, 'aria-labelledby': hasHeading ? `${id}.heading` : null, 'aria-modal': 'true', id, role: props.alert ? 'alertdialog' : 'dialog', tabindex: '-1',
            'x-data': `filamentModal({ id: ${js(id)}, isScrollLocked: true, shouldRestoreFocus: true, })`, 'data-fi-modal-id': id,
            'x-on:close-modal.window': `if (($event.detail.id === ${js(id)}) && isOpen) close()`,
            'x-on:close-modal-quietly.window': `if (($event.detail.id === ${js(id)}) && isOpen) closeQuietly()`,
            'x-on:open-modal.window': `if (($event.detail.id === ${js(id)}) && (! isOpen)) open()`,
            'x-bind:class': "{ 'fi-modal-open': isOpen, }", 'x-cloak': true, 'x-show': 'isOpen',
        })
        .class(['fi-modal', { 'fi-absolute-positioning-context': !props.slideOver, 'fi-modal-slide-over': props.slideOver === true, 'fi-modal-has-sticky-header': props.stickyHeader === true, 'fi-modal-has-sticky-footer': props.stickyFooter === true }]);
    const html = `<div ${outer.toHtml()}><div aria-hidden="true" x-show="isOpen" x-transition.duration.300ms.opacity class="fi-modal-close-overlay"></div><div${trapOnWindow ? '' : ' tabindex="-1"'}${closeByClickingAway ? ` x-on:click.self="${e(close)}"` : ''}${trapOnWindow ? '' : ` ${trap}="isTrapActive"`} class="${cls(['fi-modal-window-ctn', { 'fi-clickable': closeByClickingAway }])}"><div${closeByEscaping ? ` x-on:keydown.window.escape="if (isTopmost()) ${e(close)}"` : ''} x-show="isWindowVisible" x-transition:enter="fi-transition-enter" x-transition:leave="fi-transition-leave" x-transition:enter-start="fi-transition-enter-start" x-transition:enter-end="fi-transition-enter-end" x-transition:leave-start="fi-transition-leave-start" x-transition:leave-end="fi-transition-leave-end" wire:key="${e(key('window'))}"${trapOnWindow ? ` ${trap}="isTrapActive" tabindex="0"` : ''} class="${windowClasses}">${header}${content}${footer}</div></div></div>`;
    if (!props.trigger) return html;
    // The trigger opens the modal unless it is disabled (`<x-slot name="trigger" disabled>`).
    const { disabled: triggerDisabled, ...triggerRest } = props.triggerAttributes ?? {};
    const trigger = new Attributes({ ...(triggerDisabled ? {} : { 'x-on:click': `$dispatch('open-modal', { id: ${js(id)} })` }), ...triggerRest }).class(['fi-modal-trigger']);
    return `<div><div ${trigger.toHtml()}>${props.trigger}</div>${html}</div>`;
}

// ------------------------------------------------------------------ component tags
// Built-in components for EJS views: `<x-button color="danger">Delete</x-button>`, `<x-section heading="Orders">…</x-section>`.
// The default slot is HTML already rendered by the template; props from `name="text"` are plain strings and are escaped by the components.
const withSlot = (render: (props: any, slot: string) => string) => (props: any, slot: string) => render(props, slot);
views
    .component('avatar', (props) => avatar(props as any))
    // A badge rendered as a link takes its `href` from the tag.
    .component('badge', (props, slot) => badge({ ...props, attributes: { ...props.attributes, href: props.href ?? props.attributes?.href } }, slot))
    .component('breadcrumbs', (props) => breadcrumbs(props.items ?? [], props.label))
    .component('button', withSlot(button))
    .component('callout', (props, slot) => callout({ ...props, footer: props.footer ?? (slot || null) }))
    // Every prop other than `checked` and `valid` is an attribute of the input (`name`, `value`, `disabled`…).
    .component('checkbox', ({ checked, valid, attributes, ...rest }) => checkbox({ checked, valid, attributes: { ...rest, ...attributes } }))
    .component('dropdown', withSlot(dropdown))
    .component('dropdown-list', (props, slot) => (props.items ? dropdownList(props.items) : `<div class="fi-dropdown-list">${slot}</div>`))
    .component('dropdown-item', (props, slot) => dropdownItem({ ...props, label: props.label ?? '', labelHtml: props.label === undefined ? slot.trim() : null } as DropdownItem))
    .component('empty-state', (props, slot) => emptyState({ ...props, footer: props.footer ?? (slot || null) } as EmptyStateProps))
    .component('fieldset', withSlot(fieldset))
    .component('icon', (props) => icon(props.name ?? props.icon, { size: props.size, attributes: new Attributes(props.attributes) }))
    .component('icon-button', (props) => iconButton(props as IconButtonProps))
    .component('input', (props) => input({ ...props.attributes, ...Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'attributes')) }))
    .component('input-wrapper', withSlot(inputWrapper))
    .component('link', withSlot(link))
    .component('loading-indicator', (props) => loadingIndicator(new Attributes(props.attributes), props.size))
    // `id` is an HTML attribute name, so it lands in the attribute bag: these two components need it as a prop.
    .component('modal', (props, slot) => modal({ ...props, id: props.id ?? props.attributes?.id } as ModalProps, slot))
    // The section's `id` (an HTML attribute) also names its persisted collapsed state.
    .component('pagination', (props) => pagination({ ...props, id: props.id ?? props.attributes?.id } as PaginationProps))
    .component('section', withSlot(section))
    .component('select', (props, slot) => select({ ...props.attributes, ...Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'attributes')) }, slot))
    .component('spinner', (props) => spinner(props.attributes))
    .component('tabs', (props, slot) => tabs(props as any, props.items ?? [], slot))
    .component('tabs.item', (props, slot) => tabItem({ ...props, label: props.label ?? '', labelHtml: props.label === undefined ? slot.trim() : null } as TabItem));
// Filament's names for the same components: `<x-input.wrapper>`, `<x-dropdown.list>`, `<x-dropdown.list.item>`.
views
    .component('input.wrapper', withSlot(inputWrapper))
    .component('dropdown.list', (props, slot) => (props.items ? dropdownList(props.items) : `<div class="fi-dropdown-list">${slot}</div>`))
    .component('dropdown.list.item', (props, slot) => dropdownItem({ ...props, label: props.label ?? '', labelHtml: props.label === undefined ? slot.trim() : null } as DropdownItem));

export const ui = { avatar, badge, breadcrumbs, button, callout, checkbox, dropdown, dropdownItem, dropdownList, emptyState, fieldset, iconButton, input, inputWrapper, link, modal, pagination, section, select, spinner, tabItem, tabs };
export { cls, e, js, loadingIndicator };
