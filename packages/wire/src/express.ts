// Intégration Express du runtime : sert livewire.js embarqué, expose l'endpoint de mise à jour, protège par jeton CSRF.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Request, Response, Router } from 'express';
import express from 'express';
import { WireError, type WireRuntime } from './index.ts';

const vendor = (f: string) => fileURLToPath(new URL(`../vendor/${f}`, import.meta.url));
const versionHash = JSON.parse(readFileSync(vendor('manifest.json'), 'utf8'))['/livewire.js'] as string;
const COOKIE = 'navette_csrf';

const readCookie = (req: Request, name: string) =>
    (req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === name)?.[1];

/** Jeton CSRF par double soumission : cookie HttpOnly + jeton renvoyé dans le corps par livewire.js (`_token`). */
export function csrfToken(req: Request, res: Response): string {
    let token = readCookie(req, COOKIE) ?? (res.locals.navetteCsrf as string | undefined);
    if (!token) {
        token = randomBytes(24).toString('base64url');
        res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure === true });
        res.locals.navetteCsrf = token;
    }
    return token;
}

/** Vérifie le jeton envoyé (corps ou formulaire) contre le cookie, en temps constant. */
export function verifyCsrf(req: Request, token: unknown): boolean {
    const cookie = Buffer.from(readCookie(req, COOKIE) ?? ''), sent = Buffer.from(String(token ?? ''));
    return cookie.length > 0 && cookie.length === sent.length && timingSafeEqual(cookie, sent);
}

export function wireRouter(runtime: WireRuntime, prefix = '/livewire', makeContext: (req: Request, res: Response) => unknown | Promise<unknown> = (req, res) => ({ req, res }),
    /** Exécute le traitement dans un contexte de requête et permet d'enrichir la réponse (notifications…). */
    around: (ctx: any, req: Request, res: Response, handle: () => Promise<any>) => Promise<any> = (_ctx, _req, _res, handle) => handle(),
    /** Autorise un envoi de fichier (par exemple : utilisateur connecté). Sans cette fonction, tout porteur d'une adresse signée et du jeton CSRF peut envoyer. */
    canUpload: (ctx: any) => boolean | Promise<boolean> = () => true): Router {
    const router = express.Router();
    router.get(`${prefix}/livewire.js`, (_req, res) => {
        res.type('application/javascript').set('Cache-Control', 'public, max-age=31536000, immutable').sendFile(vendor('livewire.js'));
    });
    router.post(`${prefix}/update`, express.json({ limit: '2mb' }), async (req, res) => {
        try {
            if (!verifyCsrf(req, req.body?._token)) throw new WireError(419, 'Jeton CSRF invalide.');
            const ctx = await makeContext(req, res);
            res.json(await around(ctx, req, res, () => runtime.handle(req.body, ctx)));
        } catch (e) {
            const status = e instanceof WireError ? e.status : 500;
            if (status === 500) console.error(e);
            else if (process.env.NODE_ENV !== 'production') console.warn(`[wire] ${status} ${(e as Error).message} — calls=${JSON.stringify(req.body?.components?.map((c: any) => c.calls))} updates=${JSON.stringify(req.body?.components?.map((c: any) => c.updates))}`);
            res.status(status).send(e instanceof Error ? e.message : 'Erreur');
        }
    });
    // Envoi de fichiers : adresse signée par `_startUpload`, jeton CSRF en en-tête, fichiers reçus dans le dossier temporaire.
    router.post(`${prefix}/upload-file`, async (req, res) => {
        try {
            const store = runtime.uploads;
            if (!store) throw new WireError(404, 'Téléversement indisponible.');
            if (!store.verifySignature(req.query.expires, req.query.signature)) throw new WireError(401, 'Adresse d\'envoi invalide ou expirée.');
            if (!verifyCsrf(req, req.get('x-csrf-token'))) throw new WireError(419, 'Jeton CSRF invalide.');
            if (!(await canUpload(await makeContext(req, res)))) throw new WireError(401, 'Non authentifié.');
            res.json({ paths: await store.receive(req) });
        } catch (e) {
            const status = e instanceof WireError ? e.status : Number((e as any)?.status) || 500;
            if (status === 500) console.error(e);
            res.status(status).json({ message: e instanceof Error ? e.message : 'Erreur' });
        }
    });
    return router;
}

/** Balise <script> attendue par livewire.js (équivalent de FrontendAssets::js). */
export function wireScripts(req: Request, res: Response, prefix = '/livewire'): string {
    return `<script src="${prefix}/livewire.js?id=${versionHash}" data-csrf="${csrfToken(req, res)}" data-module-url="${prefix}" data-update-uri="${prefix}/update" data-navigate-once="true"></script>`;
}

/** Styles attendus par livewire.js (équivalent de FrontendAssets::styles) : à placer dans <head>. */
export function wireStyles(progressBarColor = '#2299dd'): string {
    const BS = String.fromCharCode(92); // barre oblique inverse : échappe « : » et « . » dans les sélecteurs CSS
    const sel = (n: string) => `[wire${BS}:${n.replaceAll('.', BS + '.')}]`;
    const doubled = (names: string[]) => names.map((n) => sel(n) + sel(n)).join(', ');
    return '<!-- Livewire Styles --><style>'
        + doubled(['loading', 'loading.delay', 'loading.list-item', 'loading.inline-block', 'loading.inline', 'loading.block', 'loading.flex', 'loading.table', 'loading.grid', 'loading.inline-flex']) + ' {display: none;}'
        + doubled(['loading.delay.none', 'loading.delay.shortest', 'loading.delay.shorter', 'loading.delay.short', 'loading.delay.default', 'loading.delay.long', 'loading.delay.longer', 'loading.delay.longest']) + ' {display: none;}'
        + doubled(['offline']) + ' {display: none;}'
        + sel('dirty') + ':not(textarea):not(input):not(select) {display: none;}'
        + `:root {--livewire-progress-bar-color: ${progressBarColor};}`
        + '[x-cloak="x-cloak"],[x-cloak=""] {display: none !important;}'
        + sel('cloak') .replace(']', '="wire:cloak"]') + ',' + sel('cloak').replace(']', '=""]') + ' {display: none !important;}'
        + 'dialog#livewire-error::backdrop {background-color: rgba(0, 0, 0, .6);}</style>';
}
