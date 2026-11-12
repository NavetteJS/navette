// @navette-js/support/ui — les composants d'interface de base de Filament, utilisables seuls (équivalent des composants Blade
// `<x-filament::button>`, `<x-filament::badge>`…). Chaque fonction rend le même balisage que la vue Blade d'origine
// (sources/filament/packages/support/resources/views/components) ; elles sont vérifiées scène par scène contre l'application
// de documentation de Filament (`node tools/parity/run-scenes.mjs`).
import { Attributes, cls, e, icon, js, loadingIndicator, views, type ColorManager } from './index.ts';
import { t, tc } from './i18n.ts';
import { fileURLToPath } from 'node:url';

// Les vues de base (`filament::components.*`) vivent dans ce paquet : elles sont utilisables sans panel.
views.namespace('filament', fileURLToPath(new URL('../views', import.meta.url)));

let manager: ColorManager | null = null;
/** Gestionnaire de couleurs utilisé par les composants (celui du panel, ou un gestionnaire par défaut). */
export const useColorManager = (colors: ColorManager) => { manager = colors; };
const colorsOf = (component: Parameters<ColorManager['getComponentClasses']>[0], color: string | null | undefined): string[] => {
    if (!manager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
    return color && color !== 'gray' ? manager.getComponentClasses(component, color) : [];
};

export type Attrs = Record<string, string | number | boolean | null | undefined>;
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// ------------------------------------------------------------------ badge
export type BadgeProps = { color?: string; size?: Size; icon?: string | null; iconPosition?: 'before' | 'after'; tag?: string; attributes?: Attrs };
/** Pastille (`<x-filament::badge>`). */
export function badge(props: BadgeProps = {}, slot = ''): string {
    const { color = 'primary', size = 'md', tag = 'span' } = props;
    const attributes = new Attributes(props.attributes ?? {}).class([...colorsOf('badge', color), 'fi-badge', `fi-size-${size}`]);
    const iconHtml = props.icon ? icon(props.icon, { size: 'sm' }) : '';
    return `<${tag} ${attributes.toHtml()}>${props.iconPosition === 'after' ? '' : iconHtml}<span class="fi-badge-label-ctn"><span class="fi-badge-label">${slot}</span></span>${props.iconPosition === 'after' ? iconHtml : ''}</${tag}>`;
}
/** Petit compteur posé sur un bouton ou un lien (rendu sans enveloppe de libellé, comme dans Filament). */
const counter = (value: string | number, color = 'primary'): string => `<span class="${cls([...colorsOf('badge', color), 'fi-badge', 'fi-size-xs'])}">${e(String(value))}</span>`;

// ------------------------------------------------------------------ icon-button
export type IconButtonProps = { icon: string; label: string; color?: string; size?: Size; disabled?: boolean; tag?: 'button' | 'a'; href?: string | null; badge?: string | number | null; badgeColor?: string; attributes?: Attrs };
/** Taille de l'icône selon celle du bouton (comme la vue Blade). */
const ICON_BUTTON_ICON_SIZE: Record<Size, string> = { xs: 'sm', sm: 'md', md: 'md', lg: 'lg', xl: 'lg' };
/** Bouton réduit à une icône (`<x-filament::icon-button>`) ; le libellé sert d'info-bulle et de nom accessible. */
export function iconButton(props: IconButtonProps): string {
    const { color = 'primary', size = 'md', disabled = false, tag = 'button' } = props;
    // Les classes de l'appelant viennent après celles du composant (comme `$attributes->class()` de Laravel).
    const { class: extraClass = null, ...rest } = (props.attributes ?? {}) as Attrs & { class?: string };
    const attributes = new Attributes(rest)
        .merge({
            'aria-disabled': disabled ? 'true' : null, 'aria-label': props.label, disabled, href: tag === 'a' ? (props.href ?? null) : null, title: props.label,
            type: tag === 'button' ? 'button' : null, 'wire:loading.attr': tag === 'button' ? 'aria-disabled' : null, 'wire:loading.class': tag === 'button' ? 'fi-disabled' : null,
        })
        .class([...colorsOf('icon-button', color), 'fi-icon-btn', { 'fi-disabled': disabled }, `fi-size-${size}`, extraClass]);
    const badgeHtml = props.badge !== null && props.badge !== undefined ? `<div class="fi-icon-btn-badge-ctn">${counter(props.badge, props.badgeColor)}</div>` : '';
    return `<${tag} ${attributes.toHtml()}>${icon(props.icon, { size: ICON_BUTTON_ICON_SIZE[size] })}${badgeHtml}</${tag}>`;
}

// ------------------------------------------------------------------ button
export type ButtonProps = {
    color?: string; size?: Size; outlined?: boolean; disabled?: boolean; tag?: 'button' | 'a'; type?: string; href?: string | null;
    icon?: string | null; iconPosition?: 'before' | 'after'; badge?: string | number | null; badgeColor?: string; attributes?: Attrs;
};
/** Bouton (`<x-filament::button>`). */
export function button(props: ButtonProps = {}, slot = ''): string {
    const { color = 'primary', size = 'md', outlined = false, disabled = false, tag = 'button', type = 'button', iconPosition = 'before' } = props;
    const attributes = new Attributes(props.attributes ?? {})
        .merge({
            'aria-disabled': disabled ? 'true' : null, disabled, href: tag === 'a' ? (props.href ?? null) : null,
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
    badge?: string | number | null; badgeColor?: string; attributes?: Attrs;
};
/** Lien (`<x-filament::link>`). */
export function link(props: LinkProps = {}, slot = ''): string {
    const { color = 'primary', size = 'md', tag = 'a', iconPosition = 'before' } = props;
    const attributes = new Attributes(props.attributes ?? {})
        .merge({ href: tag === 'a' ? (props.href ?? null) : null, type: tag === 'button' ? 'button' : null })
        .class([...colorsOf('link', color), 'fi-link', `fi-size-${size}`, props.weight ? `fi-font-${props.weight}` : null]);
    const iconHtml = props.icon ? icon(props.icon) : '';
    const badgeHtml = props.badge !== null && props.badge !== undefined ? `<div class="fi-link-badge-ctn">${counter(props.badge, props.badgeColor)}</div>` : '';
    return `<${tag} ${attributes.toHtml()}>${iconPosition === 'before' ? iconHtml : ''}<span class="fi-link-label">${slot}</span>${iconPosition === 'after' ? iconHtml : ''}${badgeHtml}</${tag}>`;
}

// ------------------------------------------------------------------ avatar
/** Avatar (`<x-filament::avatar>`) : rond par défaut. */
export function avatar(props: { src: string; alt?: string; size?: Size; circular?: boolean; attributes?: Attrs }): string {
    const attributes = new Attributes(props.attributes ?? {}).merge({ alt: props.alt ?? null, src: props.src }).class(['fi-avatar', { 'fi-circular': props.circular !== false }, `fi-size-${props.size ?? 'md'}`]);
    return `<img ${attributes.toHtml()} />`;
}

// ------------------------------------------------------------------ breadcrumbs
/**
 * Fil d'Ariane (`<x-filament::breadcrumbs>`). Comme dans Filament : un élément sans `url` est un simple texte ;
 * un élément dont l'`url` est vide reste un lien, mais sans adresse. Le dernier élément est la page courante.
 */
export function breadcrumbs(items: { label: string; url?: string | null }[], label = 'Breadcrumb'): string {
    const separators = icon('m-chevron-right', { attributes: new Attributes({ 'aria-hidden': 'true', class: 'fi-breadcrumbs-item-separator fi-ltr' }) }) + icon('m-chevron-left', { attributes: new Attributes({ 'aria-hidden': 'true', class: 'fi-breadcrumbs-item-separator fi-rtl' }) });
    const list = items.map((item, index) => `<li class="fi-breadcrumbs-item">${index > 0 ? separators : ''}${((current) => (item.url === undefined || item.url === null ? `<span${current} class="fi-breadcrumbs-item-label">${e(item.label)}</span>` : `<a${item.url ? ` href="${e(item.url)}"` : ''}${current} class="fi-breadcrumbs-item-label">${e(item.label)}</a>`))(index === items.length - 1 ? ' aria-current="page"' : '')}</li>`);
    return `<nav class="fi-breadcrumbs" aria-label="${e(label)}"><ol class="fi-breadcrumbs-list">${list.join('')}</ol></nav>`;
}

// ------------------------------------------------------------------ champs de base
/** Case à cocher nue (`<x-filament::input.checkbox>`). */
export function checkbox(props: { checked?: boolean; valid?: boolean; attributes?: Attrs } = {}): string {
    const attributes = new Attributes(props.attributes ?? {}).merge({ type: 'checkbox', checked: props.checked === true }).class(['fi-checkbox-input', props.valid === false ? 'fi-invalid' : 'fi-valid']);
    return `<input ${attributes.toHtml()} />`;
}
/** Roue d'attente (`<x-filament::loading-indicator>`). */
export function spinner(attributes: Attrs = {}): string {
    // Les classes de l'appelant viennent après celles du composant.
    const { class: extra, ...rest } = attributes;
    const html = loadingIndicator(new Attributes(rest));
    return extra ? html.replace(/class="([^"]*)"/, (_, own) => `class="${own} ${e(String(extra))}"`) : html;
}

// ------------------------------------------------------------------ champ de saisie et son habillage
export type InputWrapperProps = {
    prefix?: string | null; suffix?: string | null; prefixIcon?: string | null; suffixIcon?: string | null; prefixIconColor?: string; suffixIconColor?: string;
    disabled?: boolean; valid?: boolean; inlinePrefix?: boolean; inlineSuffix?: boolean; attributes?: Attrs;
};
const FOCUS_INPUT = "if (! $event.target.closest('.fi-input-wrp-actions')) $dispatch('focus-input')";
const affixIcon = (name: string, color: string | undefined) => icon(name, { attributes: new Attributes().class(color && color !== 'gray' ? ['fi-color', `fi-color-${color}`] : []) });
/** Habillage d'un champ (`<x-filament::input.wrapper>`) : bordure, préfixe et suffixe (texte ou icône). */
export function inputWrapper(props: InputWrapperProps = {}, slot = ''): string {
    const hasPrefix = !!(props.prefix || props.prefixIcon), hasSuffix = !!(props.suffix || props.suffixIcon);
    const attributes = new Attributes(props.attributes ?? {}).class(['fi-input-wrp', { 'fi-disabled': props.disabled === true, 'fi-invalid': props.valid === false }]);
    const prefix = hasPrefix ? `<div x-on:click="${FOCUS_INPUT}" class="${cls(['fi-input-wrp-prefix', 'fi-input-wrp-prefix-has-content', { 'fi-inline': props.inlinePrefix === true, 'fi-input-wrp-prefix-has-label': !!props.prefix }])}">${props.prefixIcon ? affixIcon(props.prefixIcon, props.prefixIconColor) : ''}${props.prefix ? `<span class="fi-input-wrp-label">${e(props.prefix)}</span>` : ''}</div>` : '';
    const suffix = hasSuffix ? `<div x-on:click="${FOCUS_INPUT}" class="${cls(['fi-input-wrp-suffix', { 'fi-inline': props.inlineSuffix === true, 'fi-input-wrp-suffix-has-label': !!props.suffix }])}">${props.suffix ? `<span class="fi-input-wrp-label">${e(props.suffix)}</span>` : ''}${props.suffixIcon ? affixIcon(props.suffixIcon, props.suffixIconColor) : ''}</div>` : '';
    return `<div ${attributes.toHtml()}>${prefix}<div class="fi-input-wrp-content-ctn">${slot}</div>${suffix}</div>`;
}
/** Champ texte nu (`<x-filament::input>`), à placer dans `inputWrapper`. */
export function input(attributes: Attrs = {}): string { return `<input ${new Attributes(attributes).class(['fi-input']).toHtml()} />`; }
/** Liste déroulante native nue (`<x-filament::input.select>`) ; `slot` contient les `<option>`. */
export function select(attributes: Attrs = {}, slot = ''): string { return `<select ${new Attributes(attributes).class(['fi-select-input']).toHtml()}>${slot}</select>`; }
/** Groupe de champs encadré (`<x-filament::fieldset>`). */
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
/** Encart d'information (`<x-filament::callout>`). `footer` et `controls` reçoivent du HTML déjà rendu (boutons…). */
export function callout(props: CalloutProps = {}): string {
    const attributes = new Attributes(props.attributes ?? {}).class(['fi-callout', ...colorMark(props.color)]);
    const iconHtml = props.icon ? icon(props.icon, { size: props.iconSize ?? 'lg', attributes: new Attributes().class([...colorMark(props.iconColor ?? props.color), 'fi-callout-icon']) }) : '';
    const text = `<div class="fi-callout-text">${props.heading ? `<h4 class="fi-callout-heading">${e(props.heading)}</h4>` : ''}${props.description ? `<p class="fi-callout-description">${e(props.description)}</p>` : ''}</div>`;
    return `<div ${attributes.toHtml()}>${iconHtml}<div class="fi-callout-main">${text}${props.footer ? `<div class="fi-callout-footer">${props.footer}</div>` : ''}</div>${props.controls ? `<div class="fi-callout-controls">${props.controls}</div>` : ''}</div>`;
}

// ------------------------------------------------------------------ empty-state
export type EmptyStateProps = { heading: string; description?: string | null; icon?: string | null; iconColor?: string; iconSize?: 'sm' | 'md' | 'lg'; footer?: string | null; contained?: boolean; attributes?: Attrs };
/** État vide (`<x-filament::empty-state>`) : icône, titre, description, pied (actions déjà rendues). */
export function emptyState(props: EmptyStateProps): string {
    const color = props.iconColor ?? 'primary';
    const attributes = new Attributes(props.attributes ?? {}).class(['fi-empty-state', { 'fi-empty-state-not-contained': props.contained === false }]);
    const iconHtml = props.icon ? `<div class="${cls(['fi-empty-state-icon-bg', ...colorMark(color)])}">${icon(props.icon, { size: props.iconSize ?? 'lg', attributes: new Attributes().class(colorMark(color)) })}</div>` : '';
    return `<div ${attributes.toHtml()}><div class="fi-empty-state-content">${iconHtml}<div class="fi-empty-state-text-ctn"><h2 class="fi-empty-state-heading">${e(props.heading)}</h2>${props.description ? `<p class="fi-empty-state-description">${e(props.description)}</p>` : ''}${props.footer ? `<footer class="fi-empty-state-footer">${props.footer}</footer>` : ''}</div></div></div>`;
}

// ------------------------------------------------------------------ pagination
export type PaginationProps = {
    /** Identifiant du composant hôte (préfixe des clés `wire:key`). */
    id: string; page: number; perPage: number;
    /** Nombre total d'enregistrements ; absent pour une pagination simple (précédent / suivant). */
    total?: number; hasMore?: boolean; pageOptions?: (number | 'all')[]; extremeLinks?: boolean; property?: string;
};
/** Numéros de page affichés : tous jusqu'à onze pages, sinon une fenêtre autour de la page courante. */
function pageElements(current: number, last: number): (number | '...')[] {
    if (last <= 11) return Array.from({ length: last }, (_, i) => i + 1);
    const pages = new Set([1, 2, last - 1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
    const out: (number | '...')[] = [];
    for (const p of [...pages].sort((a, b) => a - b)) { if (out.length && p - (out[out.length - 1] as number) > 1) out.push('...'); out.push(p); }
    return out;
}
/** Pagination (`<x-filament::pagination>`), liée aux méthodes `previousPage`, `nextPage` et `gotoPage` du composant hôte. */
export function pagination(props: PaginationProps): string {
    const simple = props.total === undefined;
    const lastPage = simple ? props.page + (props.hasMore ? 1 : 0) : Math.max(1, Math.ceil(props.total! / props.perPage));
    const from = (props.page - 1) * props.perPage + 1;
    const property = props.property ?? 'tableRecordsPerPage';
    return views.render('filament::components.pagination', {
        id: props.id, simple, extremeLinks: props.extremeLinks === true, property, t, tc,
        targets: `previousPage,gotoPage,setPage,nextPage,paginators,${property}`,
        page: { page: props.page, lastPage, total: props.total ?? 0, from, to: simple ? from + props.perPage - 1 : Math.min(props.total!, from + props.perPage - 1) },
        number: (n: number) => n.toLocaleString('en-US'), pageOptions: props.pageOptions ?? [], elements: pageElements(props.page, lastPage),
        attrs: (o: Attrs) => new Attributes(o),
    });
}

// ------------------------------------------------------------------ section
export type SectionProps = {
    heading?: string | null; description?: string | null; icon?: string | null; iconColor?: string | null; iconSize?: 'sm' | 'md' | 'lg'; headingTag?: string;
    afterHeader?: string | null; footer?: string | null; collapsible?: boolean; collapsed?: boolean; aside?: boolean; contentBefore?: boolean;
    compact?: boolean; contained?: boolean; divided?: boolean; secondary?: boolean; attributes?: Attrs;
};
/** Section (`<x-filament::section>`) : carte avec en-tête facultatif (icône, titre, description, zone d'actions), repliable. */
export function section(props: SectionProps = {}, slot = ''): string {
    const collapsible = props.collapsible === true, collapsed = collapsible && props.collapsed === true;
    const hasText = !!props.heading || !!props.description;
    const hasHeader = !!props.icon || hasText || collapsible || !!props.afterHeader;
    const tag = props.headingTag ?? 'h2';
    const expand = t('filament::components/section.actions.expand.label'), collapse = t('filament::components/section.actions.collapse.label');
    const attributes = new Attributes(props.attributes ?? {})
        .merge({
            'x-data': `{ isCollapsed: ${collapsed ? 'true' : 'false'} , }`,
            ...(collapsible ? {
                'x-id': "['fi-section-content']",
                'x-on:collapse-section.window': 'if ($event.detail.id == (null ?? $el.id)) isCollapsed = true',
                'x-on:expand': 'isCollapsed = false',
                'x-on:expand-section.window': 'if ($event.detail.id == (null ?? $el.id)) isCollapsed = false',
                'x-on:open-section.window': 'if ($event.detail.id == (null ?? $el.id)) isCollapsed = false',
                'x-on:toggle-section.window': 'if ($event.detail.id == (null ?? $el.id)) isCollapsed = ! isCollapsed',
                'x-bind:class': "isCollapsed && 'fi-collapsed'",
            } : {}),
        })
        .class(['fi-section', {
            'fi-section-not-contained': props.contained === false, 'fi-section-has-content-before': props.contentBefore === true, 'fi-section-has-header': hasHeader,
            'fi-aside': props.aside === true, 'fi-compact': props.compact === true, 'fi-collapsible': collapsible, 'fi-divided': props.divided === true, 'fi-secondary': props.secondary === true,
        }]);
    const text = hasText ? `<div class="fi-section-header-text-ctn">${props.heading ? `<${tag} class="fi-section-header-heading">${e(props.heading)}</${tag}>` : ''}${props.description ? `<p class="fi-section-header-description">${e(props.description)}</p>` : ''}</div>` : '';
    const content = hasText || props.afterHeader ? `<div class="${cls(['fi-section-header-content', { 'fi-section-header-content-has-heading': hasText }])}">${text}${props.afterHeader ? `<div class="fi-section-header-after-ctn">${props.afterHeader}</div>` : ''}</div>` : '';
    const toggle = collapsible ? iconButton({ color: 'gray', icon: 'm-chevron-up', label: collapsed ? expand : collapse, attributes: {
        'x-bind:aria-label': `isCollapsed ? ${js(expand)} : ${js(collapse)}`, 'aria-expanded': collapsed ? 'false' : 'true', 'x-bind:aria-expanded': '(! isCollapsed).toString()',
        'x-bind:aria-controls': "$id('fi-section-content')", 'x-on:click.stop': 'isCollapsed = ! isCollapsed', class: 'fi-section-collapse-btn',
    } }) : '';
    const header = hasHeader ? `<header${collapsible ? ` x-on:click="if (! $event.target.closest('.fi-section-header-after-ctn')) isCollapsed = ! isCollapsed"` : ''} class="fi-section-header">${props.icon ? icon(props.icon, { size: props.iconSize ?? 'lg', attributes: new Attributes().class(colorMark(props.iconColor)) }) : ''}${content}${toggle}</header>` : '';
    const body = slot !== '' || props.footer ? `<div${collapsible ? ` x-bind:id="$id('fi-section-content')"${collapsed ? ' x-cloak' : ''}` : ''} class="fi-section-content-ctn">${slot !== '' ? `<div class="fi-section-content">${slot}</div>` : ''}${props.footer ? `<footer class="fi-section-footer">${props.footer}</footer>` : ''}</div>` : '';
    return `<section ${attributes.toHtml()}>${header}${body}</section>`;
}

// ------------------------------------------------------------------ tabs
export type TabItem = { label: string; active?: boolean; icon?: string | null; iconPosition?: 'before' | 'after'; badge?: string | number | null; badgeColor?: string; tag?: 'button' | 'a'; href?: string | null; attributes?: Attrs };
/** Onglets (`<x-filament::tabs>` et `<x-filament::tabs.item>`). */
export function tabs(props: { label?: string | null; vertical?: boolean; contained?: boolean; attributes?: Attrs }, items: TabItem[]): string {
    const attributes = new Attributes(props.attributes ?? {}).merge({ 'aria-label': props.label ?? null }).class(['fi-tabs', { 'fi-contained': props.contained === true, 'fi-vertical': props.vertical === true }]);
    const html = items.map((item) => {
        const tag = item.tag ?? 'button';
        const itemAttributes = new Attributes(item.attributes ?? {})
            .merge({ type: tag === 'button' ? 'button' : null, href: tag === 'a' ? (item.href ?? null) : null, 'aria-current': item.active ? 'true' : null })
            .class(['fi-tabs-item', { 'fi-active': item.active === true }]);
        const iconHtml = item.icon ? icon(item.icon) : '';
        const badgeHtml = item.badge !== null && item.badge !== undefined ? badge({ color: item.badgeColor ?? 'primary', size: 'sm' }, e(String(item.badge))) : '';
        return `<${tag} ${itemAttributes.toHtml()}>${item.iconPosition === 'after' ? '' : iconHtml}<span class="fi-tabs-item-label">${e(item.label)}</span>${item.iconPosition === 'after' ? iconHtml : ''}${badgeHtml}</${tag}>`;
    });
    return `<nav ${attributes.toHtml()}>${html.join('')}</nav>`;
}

// ------------------------------------------------------------------ dropdown
export type DropdownItem = {
    label: string; icon?: string | null; color?: string; iconColor?: string | null; image?: string | null; badge?: string | number | null; badgeColor?: string;
    tag?: 'button' | 'a'; href?: string | null; disabled?: boolean; attributes?: Attrs;
};
/** Élément de menu (`<x-filament::dropdown.list.item>`). */
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
    return `<${tag} ${attributes.toHtml()}>${lead}<span class="fi-dropdown-list-item-label">${e(item.label)}</span>${badgeHtml}</${tag}>`;
}
/** Liste d'éléments de menu (`<x-filament::dropdown.list>`). */
export function dropdownList(items: DropdownItem[]): string { return `<div class="fi-dropdown-list">${items.map(dropdownItem).join('')}</div>`; }
/** Menu déroulant (`<x-filament::dropdown>`) : `trigger` est le HTML du déclencheur, `slot` le contenu du panneau. */
export function dropdown(props: { trigger: string; width?: string | null; maxHeight?: string | null; placement?: string | null; offset?: number; attributes?: Attrs }, slot = ''): string {
    const attributes = new Attributes(props.attributes ?? {}).merge({ 'x-data': 'filamentDropdown({ isMenu: true })' }).class(['fi-dropdown']);
    const float = `x-float${props.placement ? `.placement.${props.placement}` : ''}.flip.offset`;
    return `<div ${attributes.toHtml()}><div x-on:mousedown="if ($event.button === 0) toggle($event)" class="fi-dropdown-trigger">${props.trigger}</div><div x-cloak ${float}="{ offset: ${props.offset ?? 8}, }" x-ref="panel" x-transition:enter-start="fi-opacity-0" x-transition:leave-end="fi-opacity-0" role="menu" class="${cls(['fi-dropdown-panel', props.width ? `fi-width-${props.width}` : null, { 'fi-scrollable': !!props.maxHeight }])}" style="${props.maxHeight ? `max-height: ${e(props.maxHeight)};` : ''}">${slot}</div></div>`;
}

// ------------------------------------------------------------------ modal
export type ModalProps = {
    id: string; heading?: string | null; description?: string | null; eyebrow?: string | null; icon?: string | null; iconColor?: string;
    /** Boutons du pied (HTML déjà rendu), ou `footer` pour un pied entièrement libre. */
    footerActions?: string[]; footer?: string | null; footerActionsAlignment?: 'start' | 'center' | 'end';
    alignment?: 'start' | 'center'; width?: string; slideOver?: boolean; stickyHeader?: boolean; stickyFooter?: boolean; alert?: boolean;
    closeButton?: boolean; closeByClickingAway?: boolean; closeByEscaping?: boolean;
    /** Identifiant du composant hôte, préfixe des clés `wire:key` quand la modale vit dans un composant à état. */
    livewireId?: string | null;
};
/** Fenêtre modale (`<x-filament::modal>`), ouverte par l'événement `open-modal` portant son identifiant. */
export function modal(props: ModalProps, slot = ''): string {
    const { id, alignment = 'start', width = 'sm', closeButton = true, closeByClickingAway = true, closeByEscaping = true } = props;
    const hasHeading = !!props.heading, hasDescription = !!props.description && hasHeading;
    const hasFooter = !!props.footer || (props.footerActions?.length ?? 0) > 0;
    const hasContent = slot !== '';
    const key = (part: string) => `${props.livewireId ? `${props.livewireId}.` : ''}modal.${id}.${part}`;
    const close = `$dispatch('close-modal', { id: ${js(id)} })`;
    const iconColor = props.iconColor ?? 'primary';
    // Fenêtre défilante (panneau latéral, en-tête ou pied fixes) : le piège de focus est posé sur la fenêtre elle-même, pas sur son conteneur.
    const trapOnWindow = props.slideOver === true || props.stickyHeader === true || props.stickyFooter === true;
    const closeHtml = closeButton ? iconButton({ color: 'gray', icon: 'o-x-mark', label: t('filament::components/modal.actions.close.label'), attributes: { tabindex: closeByEscaping ? '-1' : null, 'x-on:click': close, class: 'fi-modal-close-btn' } }).replace('fi-icon fi-size-md', 'fi-icon fi-size-lg') : '';
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
    return `<div ${outer.toHtml()}><div aria-hidden="true" x-show="isOpen" x-transition.duration.300ms.opacity class="fi-modal-close-overlay"></div><div${trapOnWindow ? '' : ' tabindex="-1"'}${closeByClickingAway ? ` x-on:click.self="${e(close)}"` : ''}${trapOnWindow ? '' : ' x-trap.noreturn="isTrapActive"'} class="${cls(['fi-modal-window-ctn', { 'fi-clickable': closeByClickingAway }])}"><div${closeByEscaping ? ` x-on:keydown.window.escape="if (isTopmost()) ${e(close)}"` : ''} x-show="isWindowVisible" x-transition:enter="fi-transition-enter" x-transition:leave="fi-transition-leave" x-transition:enter-start="fi-transition-enter-start" x-transition:enter-end="fi-transition-enter-end" x-transition:leave-start="fi-transition-leave-start" x-transition:leave-end="fi-transition-leave-end" wire:key="${e(key('window'))}"${trapOnWindow ? ' x-trap.noreturn="isTrapActive" tabindex="0"' : ''} class="${windowClasses}">${header}${content}${footer}</div></div></div>`;
}

export const ui = { avatar, badge, breadcrumbs, button, callout, checkbox, dropdown, dropdownItem, dropdownList, emptyState, fieldset, iconButton, input, inputWrapper, link, modal, pagination, section, select, spinner, tabs };
export { cls, e, js, loadingIndicator };
