import { t } from '@navette-js/support/i18n';

/**
 * Overlay shown while the next page loads: over the content area only (`'content'`), over the whole screen (`'screen'`),
 * or none (`false`).
 */
export type PageLoadingIndicator = 'content' | 'screen' | false;

/** Delay before the overlay appears, so fast navigations do not flash. */
export const PAGE_LOADING_DELAY = 150;

export function normalizePageLoadingIndicator(value: PageLoadingIndicator | boolean): PageLoadingIndicator {
    if (value === true) return 'content';
    if (value === false) return false;
    if (value !== 'content' && value !== 'screen') throw new Error(`Invalid page loading indicator [${String(value)}]: use 'content', 'screen' or false.`);
    return value;
}

/** Markup of the overlay, placed at the end of the panel's `<body>` (page-loading.js shows it). */
export function renderPageLoadingIndicator(mode: PageLoadingIndicator, delay = PAGE_LOADING_DELAY): string {
    if (mode === false) return '';
    const label = t('navette-panels::layout.page_loading.label').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    return `<div class="nv-page-loading" data-mode="${mode}" data-delay="${Math.max(0, Math.round(delay))}">`
        + `<div class="nv-page-loading-overlay" aria-hidden="true"><div class="nv-page-loading-card"><span class="nv-page-loading-spinner"></span><span class="nv-page-loading-text">${label}</span></div></div>`
        + `<span class="nv-page-loading-status nv-sr-only" role="status" data-label="${label}"></span>`
        + '</div>';
}
