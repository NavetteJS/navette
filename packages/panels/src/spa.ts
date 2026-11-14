// SPA mode links: `wire:navigate` is kept on links to the application's own pages, except the URLs of
// `panel.spaUrlExceptions()`; links to other sites load normally. With prefetching, it becomes `wire:navigate.hover`.
// Without SPA mode, every `wire:navigate` is removed.

/** `*` matches anything; the rest is literal (Laravel's `Str::is()`). */
function patternToRegExp(pattern: string): RegExp {
    return new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
}

const decodeAttribute = (value: string) => value.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export type SpaLinkOptions = {
    /** SPA mode of the panel; `false` removes every `wire:navigate`. Defaults to `true`. */
    enabled?: boolean;
    /** Patterns of `spaUrlExceptions()`, matched against the path and the absolute URL of each link. */
    exceptions: string[];
    prefetch: boolean;
    /** Origin of the request (`https://example.com`): absolute links to it are the application's. */
    origin: string | null;
};

/** Whether a link may use SPA navigation: a path, or an absolute URL of the application, outside the exceptions. */
export function isSpaUrl(url: string, options: SpaLinkOptions): boolean {
    let path = url;
    let absolute: string | null = null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) {
        let parsed: URL;
        try { parsed = new URL(url, options.origin ?? 'http://localhost'); } catch { return false; }
        if (!options.origin || parsed.origin !== options.origin) return false;
        path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        absolute = parsed.href;
    } else if (options.origin) absolute = `${options.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    const pathname = path.split(/[?#]/)[0];
    return !options.exceptions.some((pattern) => {
        const regexp = patternToRegExp(pattern);
        return regexp.test(path) || regexp.test(pathname) || (absolute !== null && (regexp.test(absolute) || regexp.test(absolute.split(/[?#]/)[0])));
    });
}

const ANCHOR = /<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
/** SPA navigation of links with nested click handlers (table rows and cells): `Alpine.navigate()` on a plain click. */
const SPA_CLICK = ` x-on:click="if (! ($event.altKey || $event.ctrlKey || $event.metaKey || $event.shiftKey)) { $event.preventDefault(); Alpine.navigate($el.getAttribute('href')) }"`;
/** Rewrites the `wire:navigate` attributes of the links of a page or a component update. */
export function rewriteSpaLinks(html: string, options: SpaLinkOptions): string {
    if (!html.includes('wire:navigate') && !html.includes(SPA_CLICK)) return html;
    return html.replace(ANCHOR, (tag) => {
        if (tag.includes(SPA_CLICK)) {
            const href = /\shref="([^"]*)"/.exec(tag)?.[1] ?? null;
            return options.enabled === false || (href !== null && !isSpaUrl(decodeAttribute(href), options)) ? tag.replace(SPA_CLICK, '') : tag;
        }
        if (!/ wire:navigate(?:\.hover)?(?=[\s>/=])/.test(tag)) return tag;
        const href = /\shref="([^"]*)"/.exec(tag)?.[1] ?? /\shref='([^']*)'/.exec(tag)?.[1] ?? null;
        if (options.enabled === false || (href !== null && !isSpaUrl(decodeAttribute(href), options))) return tag.replace(/ wire:navigate(?:\.hover)?(?:="[^"]*")?(?=[\s>/])/g, '');
        return options.prefetch ? tag.replace(/ wire:navigate(?=[\s>/])/g, ' wire:navigate.hover') : tag;
    });
}
