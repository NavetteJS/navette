// Private files of `LocalFileStorage`: serving them behind temporary signed URLs, and deleting them without leaving the storage folder.
import { createReadStream, existsSync, lstatSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import nodePath from 'node:path';
import { isSafeStorageKey, verifyFileUrlSignature } from '@navette-js/support';

/** Options of a `LocalFileStorage`. */
export type LocalFileStorageOptions = {
    /**
     * `'public'` (default): the folder is served as is (`express.static()` or `serve()`), URLs are permanent.
     * `'private'`: files are only served by `serve()` behind temporary signed URLs, built with `key`.
     */
    visibility?: 'public' | 'private';
    /** Application key signing temporary URLs (at least 16 characters): the same secret as the panel's. Required for private storages. */
    key?: string | Buffer;
};

/** The parts of an Express request and response used by `serve()`. */
export type FileRequest = { method?: string; path?: string; url?: string; query?: Record<string, unknown> };
export type FileResponse = { statusCode: number; setHeader(name: string, value: string): unknown; end(chunk?: unknown): unknown; on?(event: string, listener: (...args: unknown[]) => void): unknown };

/** Real path of a stored file, only when it is a regular file inside the storage folder (no symbolic link leading outside). */
export function containedFile(root: string, target: string): string | null {
    try {
        const realRoot = realpathSync(root);
        const real = realpathSync(target);
        const relative = nodePath.relative(realRoot, real);
        if (relative === '' || relative.startsWith('..') || nodePath.isAbsolute(relative)) return null;
        return statSync(real).isFile() ? real : null;
    } catch { return null; }
}

/** Metadata written next to a stored file (`<file>.meta.json`): original name and detected type. */
export function readFileMeta(target: string): { name?: string; type?: string } {
    try {
        const meta = JSON.parse(readFileSync(`${target}.meta.json`, 'utf8'));
        return meta && typeof meta === 'object' ? meta : {};
    } catch { return {}; }
}

/** Keys that designate a stored file (not its metadata file). */
export const isStoredFileKey = (key: unknown): key is string => isSafeStorageKey(key) && !key.endsWith('.meta.json');

/**
 * Deletes a stored file and its metadata. The key is checked (no `..`, no absolute path) and the file must really be inside
 * the storage folder: a symbolic link pointing elsewhere is never followed, only the link itself is removed.
 */
export function deleteContainedFile(root: string, key: string): boolean {
    if (!isStoredFileKey(key)) return false;
    const target = nodePath.join(root, ...key.split('/'));
    const relative = nodePath.relative(nodePath.resolve(root), nodePath.resolve(target));
    if (relative === '' || relative.startsWith('..') || nodePath.isAbsolute(relative)) return false;
    let stats;
    try { stats = lstatSync(target); } catch { return false; }
    // The parent folders must also stay inside the storage (a linked folder could lead outside).
    try {
        const parent = nodePath.relative(realpathSync(root), realpathSync(nodePath.dirname(target)));
        if (parent.startsWith('..') || nodePath.isAbsolute(parent)) return false;
    } catch { return false; }
    if (!stats.isFile() && !stats.isSymbolicLink()) return false;
    rmSync(target, { force: true });
    rmSync(`${target}.meta.json`, { force: true });
    return true;
}

const SAFE_TYPE = /^[a-z]+\/[a-z0-9.+-]{1,100}$/;
/** `Content-Disposition` with the original name, in ASCII and in RFC 5987 form. */
const disposition = (name: string): string => {
    const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_').slice(0, 200) || 'file';
    return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name.slice(0, 200))}`;
};

/**
 * Express handler serving the files of a storage folder: `app.use('/files', storage.serve())`. For a private storage, every
 * request needs a valid, unexpired signature bound to the file's key (`temporaryUrl()`), otherwise it gets a 403. Files are
 * sent with their detected type, `nosniff` and a sandboxing CSP, so an uploaded file is never run as a page of the site.
 */
export function serveContainedFiles(root: string, options: { isPrivate: boolean; key: string | Buffer | null; scope: string }) {
    return (req: FileRequest, res: FileResponse, next?: (error?: unknown) => void): void => {
        const fail = (status: number) => { res.statusCode = status; res.setHeader('Cache-Control', 'no-store'); res.end(); };
        if (req.method !== undefined && req.method !== 'GET' && req.method !== 'HEAD') return void (next ? next() : fail(405));
        const rawPath = (req.path ?? (req.url ?? '').split('?')[0]).replace(/^\/+/, '');
        let key: string;
        try { key = rawPath.split('/').map((part) => decodeURIComponent(part)).join('/'); } catch { return fail(404); }
        if (!isStoredFileKey(key)) return fail(404);
        if (options.isPrivate) {
            const query = req.query ?? Object.fromEntries(new URLSearchParams((req.url ?? '').split('?')[1] ?? ''));
            if (!options.key || !verifyFileUrlSignature(options.key, key, query.expires, query.signature, options.scope)) return fail(403);
        }
        const target = nodePath.join(root, ...key.split('/'));
        const real = existsSync(target) ? containedFile(root, target) : null;
        if (!real) return fail(404);
        const meta = readFileMeta(target);
        const size = statSync(real).size;
        res.statusCode = 200;
        res.setHeader('Content-Type', typeof meta.type === 'string' && SAFE_TYPE.test(meta.type) ? meta.type : 'application/octet-stream');
        res.setHeader('Content-Length', String(size));
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Content-Disposition', disposition(typeof meta.name === 'string' ? meta.name : nodePath.basename(key)));
        res.setHeader('Cache-Control', options.isPrivate ? 'private, max-age=300' : 'public, max-age=3600');
        if (req.method === 'HEAD') return void res.end();
        const stream = createReadStream(real);
        stream.on('error', () => { if (!res.statusCode || res.statusCode === 200) res.statusCode = 500; res.end(); });
        stream.pipe(res as any);
    };
}
