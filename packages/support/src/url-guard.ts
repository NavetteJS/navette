// Guard for URLs written into `href` / `src` attributes: a path of this site or an http(s) URL, nothing else.

/**
 * Leading part of an accepted URL: `/path` (but not `//host` nor `/\host`, which browsers read as protocol-relative URLs to
 * another site), `http://` or `https://`.
 */
const LOCAL_OR_HTTP = /^(\/(?![/\\])|https?:\/\/)/i;
/** Control characters, which browsers drop from URLs (`/<tab>/evil.example` would become `//evil.example`). */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Whether a URL is a path of this site (`/admin/posts`) or an absolute http(s) URL. Refuses `javascript:` and every other
 * scheme, protocol-relative URLs (`//evil.example`, `/\evil.example`) and URLs containing control characters.
 * `extraSchemes` also accepts URLs starting with these schemes (`['mailto']`).
 */
export function isLocalOrHttpUrl(url: unknown, options: { extraSchemes?: string[] } = {}): url is string {
    if (typeof url !== 'string' || url === '' || CONTROL_CHARACTERS.test(url)) return false;
    if (LOCAL_OR_HTTP.test(url)) return true;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
    return scheme !== undefined && (options.extraSchemes ?? []).some((allowed) => allowed.toLowerCase() === scheme);
}

/** The URL when `isLocalOrHttpUrl()` accepts it, otherwise `null`. */
export function localOrHttpUrl(url: unknown, options: { extraSchemes?: string[] } = {}): string | null {
    return isLocalOrHttpUrl(url, options) ? url : null;
}

/**
 * Whether a link may be followed with SPA navigation (`wire:navigate`): only a path of this site. An absolute URL may point
 * to another origin, which the background request of SPA navigation cannot load (CORS), so it gets a normal page load.
 */
export function isSpaNavigableUrl(url: unknown): url is string {
    return typeof url === 'string' && /^\/(?![/\\])/.test(url) && !CONTROL_CHARACTERS.test(url);
}
