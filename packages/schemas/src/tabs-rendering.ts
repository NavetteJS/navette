// Markup shared by the Tabs component: lazy-loaded badges (Filament's `generateDeferredBadgePlaceholderHtml()`).
import { e, loadingIndicator, Attributes } from '@navette-js/support';

/** Badge data returned by `Tabs.getLazyLoadedTabBadges()`, keyed like the tabs (`deferredBadges[key]` in the browser). */
export type LazyLoadedTabBadge = {
    badge: string | null;
    badgeColorClasses: string;
    badgeColorStyles: string;
    badgeIconHtml: string | null;
    badgeIconPosition: 'before' | 'after';
    badgeTooltip: string | null;
};

/** Alpine data of the tabs header when some badges are lazy loaded: the badges are fetched once the page has rendered. */
export const DEFERRED_BADGES_X_DATA = `{
 deferredBadges: {},
 isLoadingDeferredBadges: true,
 async init() {
 try {
 const badges = await this.$getLazyLoadedTabBadges()
 this.deferredBadges = badges ?? {}
 } finally {
 this.isLoadingDeferredBadges = false
 }
 },
 }`;

/**
 * Placeholder of a lazy-loaded badge in a tab header: a loading indicator, then the badge. The label is inserted with
 * `x-text` (never as HTML); only the icon, rendered on the server from the tab's own icon name, uses `x-html`.
 * `indexJs` is a JavaScript literal (a number or a quoted key) produced by `js()`.
 */
export function deferredBadgePlaceholderHtml(indexJs: string): string {
    const d = `deferredBadges[${indexJs}]`;
    return `<span x-show="isLoadingDeferredBadges" x-cloak class="nv-tabs-item-badge-placeholder">${loadingIndicator(new Attributes(), 'sm')}</span>`
        + `<template x-if="${e(`! isLoadingDeferredBadges && ${d}?.badge != null`)}">`
        + `<span x-bind:class="${e(`'nv-badge nv-size-sm ' + (${d}?.badgeColorClasses ?? '')`)}" x-bind:style="${e(`${d}?.badgeColorStyles ?? ''`)}" x-init="${e(tooltipInit(d))}">`
        + `<template x-if="${e(`${d}?.badgeIconHtml && ${d}?.badgeIconPosition !== 'after'`)}"><span x-html="${e(`${d}.badgeIconHtml`)}"></span></template>`
        + `<span class="nv-badge-label-ctn"><span class="nv-badge-label" x-text="${e(`${d}?.badge`)}"></span></span>`
        + `<template x-if="${e(`${d}?.badgeIconHtml && ${d}?.badgeIconPosition === 'after'`)}"><span x-html="${e(`${d}.badgeIconHtml`)}"></span></template>`
        + '</span></template>';
}

/** Placeholder of a lazy-loaded badge in the overflow dropdown (no icon, no size). */
export function deferredDropdownBadgePlaceholderHtml(indexJs: string): string {
    const d = `deferredBadges[${indexJs}]`;
    return `<span x-show="isLoadingDeferredBadges" x-cloak class="nv-dropdown-list-item-badge-placeholder">${loadingIndicator(new Attributes(), 'sm')}</span>`
        + `<template x-if="${e(`! isLoadingDeferredBadges && ${d}?.badge != null`)}">`
        + `<span x-bind:class="${e(`'nv-badge ' + (${d}?.badgeColorClasses ?? '')`)}" x-bind:style="${e(`${d}?.badgeColorStyles ?? ''`)}" x-init="${e(tooltipInit(d))}">`
        + `<span class="nv-badge-label-ctn"><span class="nv-badge-label" x-text="${e(`${d}?.badge`)}"></span></span>`
        + '</span></template>';
}

/** The tooltip is plain text: tippy's `allowHTML` stays off. */
const tooltipInit = (d: string) => `let tooltip = ${d}?.badgeTooltip
 if (tooltip) {
 window.tippy?.($el, {
 content: tooltip,
 theme: $store.theme,
 })
 }`;

/** Name of a public property of the host component: it is written into JavaScript (`$set('…')`) and `wire:target`. */
export const LIVEWIRE_PROPERTY = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;
