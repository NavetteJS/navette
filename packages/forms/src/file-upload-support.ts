// Helpers of the FileUpload field: URL checks and lazy option mapping.
import { isLocalOrHttpUrl } from '@navette-js/support';
import type { Lazy } from '@navette-js/support';

/**
 * A URL that may be sent to the browser for a stored file: a local path (`/storage/a.png`) or an absolute http(s) URL.
 * Spaces are encoded (as Filament does); any other whitespace, control character or backslash is refused, because browsers
 * drop or rewrite them (`/\evil.example` or `/<tab>/evil.example` would open another site). Returns `null` when refused.
 */
export function safeFileUrl(url: unknown): string | null {
    if (typeof url !== 'string' || url === '') return null;
    const encoded = url.replaceAll(' ', '%20');
    if (/[\u0000-\u001f\u007f\\]/.test(encoded) || /\s/.test(encoded)) return null;
    if (encoded.startsWith('/')) return isLocalOrHttpUrl(encoded) ? encoded : null;
    return /^https?:\/\/[^/?#]/i.test(encoded) ? encoded : null;
}

/** Applies `map` to a static value now, or to the result of a function when it is evaluated. */
export function mapLazy<T, R, C>(value: Lazy<T, C>, map: (value: T) => R): Lazy<R, C> {
    return typeof value === 'function' ? async (ctx: C) => map(await (value as (ctx: C) => T | Promise<T>)(ctx)) : map(value);
}
