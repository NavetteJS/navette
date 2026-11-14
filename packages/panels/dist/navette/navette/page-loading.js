// Page loading overlay (`Panel.pageLoadingIndicator()`): covers the content area, or the whole screen, while the next page loads.
// It reads its settings from the `.nv-page-loading` element of the current page, so each page (and panel) decides.
(() => {
    // Full-page loads that never unload the page (a link answered by a download) give the screen back after this long.
    const FULL_PAGE_TIMEOUT = 15000;
    let timer = null;
    let fallback = null;
    let active = false;

    const root = () => document.querySelector('.nv-page-loading');
    const region = () => document.getElementById('nv-main-content');

    // The visible part of the content area: below a sticky topbar, beside the sidebar, inside the viewport.
    const place = (overlay) => {
        const content = document.querySelector('.nv-main-ctn');
        if (overlay.parentElement.dataset.mode !== 'content' || !content) {
            overlay.style.cssText = '';
            return;
        }
        const rect = content.getBoundingClientRect();
        const topbar = document.querySelector('.nv-topbar-ctn')?.getBoundingClientRect();
        const top = Math.max(rect.top, topbar && topbar.bottom <= rect.bottom ? topbar.bottom : 0, 0);
        const left = Math.max(rect.left, 0);
        const right = Math.min(rect.right, document.documentElement.clientWidth);
        const bottom = Math.min(rect.bottom, window.innerHeight);
        overlay.style.top = `${top}px`;
        overlay.style.left = `${left}px`;
        overlay.style.width = `${Math.max(right - left, 0)}px`;
        overlay.style.height = `${Math.max(bottom - top, 0)}px`;
    };

    const show = () => {
        const element = root();
        if (!element) return;
        const overlay = element.querySelector('.nv-page-loading-overlay');
        const status = element.querySelector('.nv-page-loading-status');
        place(overlay);
        overlay.setAttribute('data-active', '');
        if (status) status.textContent = status.dataset.label ?? '';
        region()?.setAttribute('aria-busy', 'true');
    };

    const hide = () => {
        active = false;
        if (timer !== null) { clearTimeout(timer); timer = null; }
        if (fallback !== null) { clearTimeout(fallback); fallback = null; }
        const element = root();
        element?.querySelector('.nv-page-loading-overlay')?.removeAttribute('data-active');
        const status = element?.querySelector('.nv-page-loading-status');
        if (status) status.textContent = '';
        region()?.removeAttribute('aria-busy');
    };

    // `cancelled` is read when the delay ends, after every other listener had its say on the event.
    const begin = (cancelled = () => false, fullPage = false) => {
        const element = root();
        if (!element) return;
        if (timer !== null) clearTimeout(timer);
        active = true;
        timer = setTimeout(() => {
            timer = null;
            if (!active) return;
            if (cancelled()) { active = false; return; }
            show();
        }, Number(element.dataset.delay ?? 150));
        if (fullPage) {
            if (fallback !== null) clearTimeout(fallback);
            fallback = setTimeout(hide, FULL_PAGE_TIMEOUT);
            // Registered after the page's own listeners: an "unsaved changes" prompt may keep the user here.
            window.addEventListener('beforeunload', (event) => {
                if (event.defaultPrevented || (typeof event.returnValue === 'string' && event.returnValue !== '')) hide();
            }, { once: true });
        }
    };

    window.addEventListener('resize', () => {
        const overlay = root()?.querySelector('.nv-page-loading-overlay[data-active]');
        if (overlay) place(overlay);
    });

    // SPA navigation.
    document.addEventListener('livewire:navigate', (event) => begin(() => event.defaultPrevented));
    document.addEventListener('livewire:navigated', hide);

    // A failed SPA request (network error) fires no event: watch the request itself.
    const nativeFetch = window.fetch;
    window.fetch = function (input, init) {
        const promise = nativeFetch.apply(this, arguments);
        const headers = init?.headers;
        const navigating = headers && (headers instanceof Headers ? headers.has('X-Livewire-Navigate') : 'X-Livewire-Navigate' in headers);
        if (navigating) promise.catch((error) => { if (error?.name !== 'AbortError') hide(); });
        return promise;
    };

    // Full-page navigations started from the panel: plain links and forms, redirects of component requests.
    const sameDocument = (url) => url.pathname === location.pathname && url.search === location.search && url.hash !== '';
    document.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!link || link.hasAttribute('download') || link.hasAttribute('data-no-page-loading')) return;
        if (link.target && link.target !== '_self') return;
        if ([...link.attributes].some((attribute) => attribute.name.startsWith('wire:navigate'))) return;
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || sameDocument(url)) return;
        begin(() => event.defaultPrevented, true);
    });
    document.addEventListener('submit', (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.hasAttribute('data-no-page-loading')) return;
        const target = event.submitter?.getAttribute('formtarget') ?? form.target;
        if ((target && target !== '_self') || form.method === 'dialog') return;
        begin(() => event.defaultPrevented, true);
    });
    document.addEventListener('livewire:init', () => {
        window.Livewire.hook('commit', ({ succeed }) => {
            succeed(({ effects }) => {
                if (effects?.redirect && !effects.redirectUsingNavigate) begin(() => false, true);
            });
        });
    });

    // Back to a page kept by the browser (back / forward cache): nothing is loading any more.
    window.addEventListener('pageshow', (event) => { if (event.persisted) hide(); });
})();
