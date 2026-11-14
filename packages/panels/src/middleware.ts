// Panel middleware (`panel.middleware()`, `authMiddleware()`, `tenantMiddleware()`): ordinary Express middleware run by the
// panel at the right moment of a request, and again on component updates for the persistent ones.
import type { NextFunction, Request, Response } from 'express';

export type PanelMiddleware = (req: Request, res: Response, next: NextFunction) => unknown;
export type PanelMiddlewareEntry = { middleware: PanelMiddleware; isPersistent: boolean; componentOnly?: boolean };

/**
 * Runs middleware one after the other. Resolves `true` once the last one called `next()`, `false` when one answered the
 * request itself (the response finished without `next()`). An error passed to `next(error)` or thrown rejects.
 */
export function applyPanelMiddleware(middleware: PanelMiddleware[], req: Request, res: Response): Promise<boolean> {
    if (!middleware.length) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
        let index = 0;
        let settled = false;
        const finish = (outcome: () => void) => { if (settled) return; settled = true; res.off('finish', answered); res.off('close', answered); outcome(); };
        const answered = () => finish(() => resolve(false));
        res.once('finish', answered);
        res.once('close', answered);
        const step = (error?: unknown): void => {
            if (settled) return;
            if (error !== undefined && error !== null && error !== 'route' && error !== 'router') return finish(() => reject(error));
            // `next('route')` / `next('router')`: the remaining panel middleware are skipped.
            if (error === 'route' || error === 'router' || index >= middleware.length) return finish(() => resolve(true));
            if (res.headersSent) return answered();
            const current = middleware[index++];
            let called = false;
            const next: NextFunction = ((value?: unknown) => { if (called) return; called = true; step(value); }) as NextFunction;
            try {
                const result = current(req, res, next);
                if (result && typeof (result as Promise<unknown>).then === 'function') (result as Promise<unknown>).then(undefined, (failure) => step(failure ?? new Error('Panel middleware failed.')));
            } catch (failure) { step(failure ?? new Error('Panel middleware failed.')); }
        };
        step();
    });
}

/** The middleware of a list to run for a kind of request: pages (non-component only) or component updates (persistent ones). */
export function middlewareFor(entries: PanelMiddlewareEntry[], kind: 'page' | 'component'): PanelMiddleware[] {
    return entries.filter((entry) => (kind === 'component' ? entry.isPersistent : !entry.componentOnly)).map((entry) => entry.middleware);
}
