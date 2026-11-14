// Content Security Policy nonce: the value of the `nonce` attribute that Navette adds to the inline `<script>` and `<style>`
// elements it renders, so that a policy without `'unsafe-inline'` lets them run.
import { AsyncLocalStorage } from 'node:async_hooks';

type NonceStore = { nonce: string | null };
type ResponseLike = { locals: Record<string, any> };

// One store shared by every package (support, wire, panels), even when they are loaded from different copies.
const STORE_KEY = Symbol.for('navette.csp-nonce');
const storage: AsyncLocalStorage<NonceStore> = ((globalThis as any)[STORE_KEY] ??= new AsyncLocalStorage<NonceStore>());

/** A nonce is base64 (or base64url) text: anything else could break out of the attribute, so it is refused. */
const NONCE_PATTERN = /^[A-Za-z0-9+/_-]{8,200}={0,2}$/;
function checkNonce(nonce: string | null | undefined): string | null {
    if (nonce === null || nonce === undefined || nonce === '') return null;
    if (typeof nonce !== 'string' || !NONCE_PATTERN.test(nonce)) throw new Error('Invalid CSP nonce: use 8 to 200 base64 characters, e.g. randomBytes(16).toString(\'base64\').');
    return nonce;
}

/**
 * Sets the nonce of the current request (Filament's `Vite::useCspNonce()`): call it in a middleware that runs before the
 * panel, with the nonce of the `Content-Security-Policy` header you send. It is kept in `res.locals.cspNonce`, where the
 * panel reads it. A new nonce must be generated for every request.
 */
export function useCspNonce(res: ResponseLike, nonce: string | null): void {
    res.locals.cspNonce = checkNonce(nonce);
}

/** Nonce set on a response by `useCspNonce()` (or written to `res.locals.cspNonce`), checked. */
export function getResponseCspNonce(res: ResponseLike | null | undefined): string | null {
    return checkNonce(res?.locals?.cspNonce ?? null);
}

/** Runs `fn` (and everything it starts) with this nonce: `cspNonce()` returns it inside. */
export function runWithCspNonce<T>(nonce: string | null, fn: () => T): T {
    return storage.run({ nonce: checkNonce(nonce) }, fn);
}

/** Nonce of the request being rendered, or `null` when none is configured (Filament's `Vite::cspNonce()`). */
export function cspNonce(): string | null {
    return storage.getStore()?.nonce ?? null;
}

/** ` nonce="…"` for an inline `<script>` or `<style>` element, or an empty string without a nonce. */
export function cspNonceAttribute(): string {
    const nonce = cspNonce();
    return nonce ? ` nonce="${nonce}"` : '';
}
