// Temporary signed URLs of stored files: shared by file storages (forms), image entries (infolists) and image columns (tables).
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Application-wide options of temporary file URLs. `temporaryFileUrlExpiryMinutes` is Filament's
 * `filament.temporary_file_url_expiry_minutes` setting (30 by default).
 */
export const fileUrlConfig = { temporaryFileUrlExpiryMinutes: 30 };

/**
 * Expiry of a temporary file URL, like Filament: in `temporaryFileUrlExpiryMinutes`, rounded up to the end of that hour, so
 * that the same URL is generated for a while and browsers can cache the file.
 */
export function temporaryFileUrlExpiry(minutes: number = fileUrlConfig.temporaryFileUrlExpiryMinutes, now: number = Date.now()): Date {
    const date = new Date(now + Math.max(1, Math.floor(Number.isFinite(minutes) ? minutes : 30)) * 60_000);
    date.setUTCMinutes(59, 59, 0);
    return date;
}

/** Keys of stored files: a relative path made of safe characters, without `.` or `..` segments. */
export function isSafeStorageKey(key: unknown): key is string {
    return typeof key === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,250}$/.test(key) && !key.split('/').some((part) => part === '' || part === '.' || part === '..');
}

const toSeconds = (expiresAt: Date | number): number => Math.floor((expiresAt instanceof Date ? expiresAt.getTime() : expiresAt) / 1000);
const mac = (secret: string | Buffer, scope: string, key: string, expires: number): Buffer => createHmac('sha256', secret).update(`navette-file-url\n${scope}\n${key}\n${expires}`).digest();

/**
 * Signature of a temporary URL: an HMAC-SHA256 with the application key over the scope (the storage's base URL), the file
 * key and the expiry. Changing any of them, or the key, invalidates it. `expires` is in seconds since the epoch.
 */
export function signFileUrl(secret: string | Buffer, key: string, expiresAt: Date | number, scope = ''): { expires: number; signature: string } {
    if (!secret || (typeof secret === 'string' && secret.length < 16)) throw new Error('Signing file URLs needs an application key of at least 16 characters.');
    const expires = toSeconds(expiresAt);
    return { expires, signature: mac(secret, scope, key, expires).toString('base64url') };
}

/** Checks a temporary URL's signature and expiry, in constant time. Anything malformed is refused. */
export function verifyFileUrlSignature(secret: string | Buffer, key: string, expires: unknown, signature: unknown, scope = '', now: number = Date.now()): boolean {
    if (!secret || typeof expires !== 'string' || typeof signature !== 'string' || !/^\d{1,12}$/.test(expires) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
    const seconds = Number(expires);
    if (seconds * 1000 <= now) return false;
    const expected = mac(secret, scope, key, seconds);
    const given = Buffer.from(signature, 'base64url');
    return given.length === expected.length && timingSafeEqual(given, expected);
}

/** `url` with the `expires` and `signature` query parameters of a temporary URL. */
export function signedFileUrl(secret: string | Buffer, url: string, key: string, expiresAt: Date | number, scope = ''): string {
    const { expires, signature } = signFileUrl(secret, key, expiresAt, scope);
    return `${url}${url.includes('?') ? '&' : '?'}expires=${expires}&signature=${signature}`;
}

/**
 * The URL part of a file storage that entries and columns use to display a stored file. `FileStorage` (forms) extends it.
 * `visibility`: `'private'` files are shown through `temporaryUrl()`; `exists()` backs `checkFileExistence()`.
 */
export interface FileUrlStorage {
    readonly visibility?: 'public' | 'private';
    url?(key: string): string | null | Promise<string | null>;
    temporaryUrl?(key: string, expiresAt: Date): string | null | Promise<string | null>;
    exists?(key: string): boolean | Promise<boolean>;
}

/**
 * URL of a stored file for display, like Filament's `getImageUrl()`: `null` when `checkExistence` is set and the file is
 * missing; a temporary URL for private files (when the storage supports them); the storage's URL otherwise.
 */
export async function resolveStoredFileUrl(storage: FileUrlStorage, key: string, options: { visibility?: 'public' | 'private' | null; checkExistence?: boolean } = {}): Promise<string | null> {
    if (options.checkExistence) {
        try { if (storage.exists && !(await storage.exists(key))) return null; } catch { return null; }
    }
    const visibility = options.visibility ?? storage.visibility ?? 'public';
    if (visibility === 'private' && storage.temporaryUrl) {
        try { const url = await storage.temporaryUrl(key, temporaryFileUrlExpiry()); if (url) return url; } catch { /* the storage cannot create temporary URLs */ }
    }
    return storage.url ? await storage.url(key) : null;
}
