// Express integration: serves the bundled livewire.js and exposes the CSRF-protected update and upload endpoints.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Request, Response, Router } from 'express';
import express from 'express';
import { currentCspNonce, WireError, type WireRuntime } from './index.ts';

const vendor = (f: string) => fileURLToPath(new URL(`../vendor/${f}`, import.meta.url));
const versionHash = JSON.parse(readFileSync(vendor('manifest.json'), 'utf8'))['/livewire.js'] as string;
const COOKIE = 'navette_csrf';

const readCookie = (req: Request, name: string) =>
    (req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === name)?.[1];

/** Double-submit CSRF token: an HttpOnly cookie, plus the token livewire.js sends back in the body (`_token`). */
export function csrfToken(req: Request, res: Response): string {
    let token = readCookie(req, COOKIE) ?? (res.locals.navetteCsrf as string | undefined);
    if (!token) {
        token = randomBytes(24).toString('base64url');
        res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure === true });
        res.locals.navetteCsrf = token;
    }
    return token;
}

/** Checks the submitted token (body or form field) against the cookie, in constant time. */
export function verifyCsrf(req: Request, token: unknown): boolean {
    const cookie = Buffer.from(readCookie(req, COOKIE) ?? ''), sent = Buffer.from(String(token ?? ''));
    return cookie.length > 0 && cookie.length === sent.length && timingSafeEqual(cookie, sent);
}

export function wireRouter(runtime: WireRuntime, prefix = '/livewire', makeContext: (req: Request, res: Response) => unknown | Promise<unknown> = (req, res) => ({ req, res }),
    /** Wraps the handling in a request context and can enrich the response (notifications…). */
    around: (ctx: any, req: Request, res: Response, handle: () => Promise<any>) => Promise<any> = (_ctx, _req, _res, handle) => handle(),
    /** Authorizes a file upload (e.g. signed-in user). Without it, anyone holding a signed URL and the CSRF token can upload. */
    canUpload: (ctx: any) => boolean | Promise<boolean> = () => true): Router {
    const router = express.Router();
    router.get(`${prefix}/livewire.js`, (_req, res) => {
        res.type('application/javascript').set('Cache-Control', 'public, max-age=31536000, immutable').sendFile(vendor('livewire.js'));
    });
    router.post(`${prefix}/update`, express.json({ limit: '2mb' }), async (req, res) => {
        try {
            if (!verifyCsrf(req, req.body?._token)) throw new WireError(419, 'Invalid CSRF token.');
            const ctx = await makeContext(req, res);
            res.json(await around(ctx, req, res, () => runtime.handle(req.body, ctx)));
        } catch (e) {
            const status = e instanceof WireError ? e.status : 500;
            if (status === 500) console.error(e);
            else if (status !== 499 && process.env.NODE_ENV !== 'production') console.warn(`[wire] ${status} ${(e as Error).message} — calls=${JSON.stringify(req.body?.components?.map((c: any) => c.calls))} updates=${JSON.stringify(req.body?.components?.map((c: any) => c.updates))}`);
            // A panel middleware may have answered the request itself.
            if (!res.headersSent) res.status(status).send(e instanceof Error ? e.message : 'Error');
        }
    });
    // File uploads: URL signed by `_startUpload`, CSRF token in a header, files stored in the temporary directory.
    router.post(`${prefix}/upload-file`, async (req, res) => {
        try {
            const store = runtime.uploads;
            if (!store) throw new WireError(404, 'Uploads are not available.');
            if (!store.verifySignature(req.query.expires, req.query.signature)) throw new WireError(401, 'Invalid or expired upload URL.');
            if (!verifyCsrf(req, req.get('x-csrf-token'))) throw new WireError(419, 'Invalid CSRF token.');
            if (!(await canUpload(await makeContext(req, res)))) throw new WireError(401, 'Unauthenticated.');
            res.json({ paths: await store.receive(req) });
        } catch (e) {
            const status = e instanceof WireError ? e.status : Number((e as any)?.status) || 500;
            if (status === 500) console.error(e);
            if (!res.headersSent) res.status(status).json({ message: e instanceof Error ? e.message : 'Error' });
        }
    });
    return router;
}

/** `<script>` tag that loads livewire.js with its CSRF token and endpoint URLs. */
export function wireScripts(req: Request, res: Response, prefix = '/livewire'): string {
    const nonce = currentCspNonce();
    return `<script src="${prefix}/livewire.js?id=${versionHash}"${nonce ? ` nonce="${nonce}"` : ''} data-csrf="${csrfToken(req, res)}" data-module-url="${prefix}" data-update-uri="${prefix}/update" data-navigate-once="true"></script>`;
}

/** Styles livewire.js expects (loading states, cloak, progress bar); place them in `<head>`. */
export function wireStyles(progressBarColor = '#2299dd'): string {
    const BS = String.fromCharCode(92); // backslash: escapes `:` and `.` in CSS selectors
    const sel = (n: string) => `[wire${BS}:${n.replaceAll('.', BS + '.')}]`;
    const doubled = (names: string[]) => names.map((n) => sel(n) + sel(n)).join(', ');
    const nonce = currentCspNonce();
    // With a nonce, livewire.js reads it from this element for the styles and scripts it adds itself.
    return `<!-- Livewire Styles --><style${nonce ? ` nonce="${nonce}" data-livewire-style` : ''}>`
        + doubled(['loading', 'loading.delay', 'loading.list-item', 'loading.inline-block', 'loading.inline', 'loading.block', 'loading.flex', 'loading.table', 'loading.grid', 'loading.inline-flex']) + ' {display: none;}'
        + doubled(['loading.delay.none', 'loading.delay.shortest', 'loading.delay.shorter', 'loading.delay.short', 'loading.delay.default', 'loading.delay.long', 'loading.delay.longer', 'loading.delay.longest']) + ' {display: none;}'
        + doubled(['offline']) + ' {display: none;}'
        + sel('dirty') + ':not(textarea):not(input):not(select) {display: none;}'
        + `:root {--livewire-progress-bar-color: ${progressBarColor};}`
        + '[x-cloak="x-cloak"],[x-cloak=""] {display: none !important;}'
        + sel('cloak') .replace(']', '="wire:cloak"]') + ',' + sel('cloak').replace(']', '=""]') + ' {display: none !important;}'
        + 'dialog#livewire-error::backdrop {background-color: rgba(0, 0, 0, .6);}</style>';
}
