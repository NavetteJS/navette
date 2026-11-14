// Files offered for download to one user (exports, failed import rows, example files): where they are kept, for how long,
// and how the download route sends them.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

/** A file offered for download. `downloader`: name of the downloader that sends it (`registerDownloader()`), if not the default one. */
export type StoredDownload = { owner: string; name: string; type: string; content: Buffer; expires: number; downloader?: string | null };
/** Options of one stored file: its own lifetime (milliseconds), and the downloader that sends it. */
export type DownloadPutOptions = { ttl?: number; downloader?: string | null };

/**
 * Where files offered for download are kept. `put()` returns a random token, part of the download URL; `get()` only returns
 * the file to the user who created it, until it expires. Both may be asynchronous (a remote store).
 */
export interface DownloadStorage {
    put(owner: string | number, name: string, type: string, content: string | Buffer, options?: DownloadPutOptions): string | Promise<string>;
    get(token: string, owner: string | number): StoredDownload | null | Promise<StoredDownload | null>;
    /** Removes a file before it expires. */
    delete?(token: string): void | Promise<void>;
    /** Removes the expired files; returns how many were removed. */
    prune?(): number | Promise<number>;
}

const DAY = 24 * 60 * 60 * 1000;
const newToken = () => randomBytes(24).toString('base64url');
/** Tokens are made by `newToken()`: anything else (a path, dots) is refused before it reaches the disk. */
const isToken = (token: string) => /^[A-Za-z0-9_-]{32}$/.test(token);
const bufferOf = (content: string | Buffer) => (Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'));

/**
 * Files kept in memory for a limited time (24 hours by default). They are lost when the process restarts and are not shared
 * between processes: use it in tests, or give the panel a `DiskDownloadStore` (its default) or your own `DownloadStorage`.
 */
export class DownloadStore implements DownloadStorage {
    private files = new Map<string, StoredDownload>();
    private readonly ttl: number;
    private readonly maxFiles: number;
    constructor(options: { ttl?: number; maxFiles?: number } = {}) { this.ttl = options.ttl ?? DAY; this.maxFiles = options.maxFiles ?? 500; }
    /** Stores a file for a user and returns its token (part of the download URL). */
    put(owner: string | number, name: string, type: string, content: string | Buffer, options: DownloadPutOptions = {}): string {
        this.prune();
        while (this.files.size >= this.maxFiles) this.files.delete(this.files.keys().next().value!);
        const token = newToken();
        this.files.set(token, { owner: String(owner), name, type, content: bufferOf(content), expires: Date.now() + (options.ttl ?? this.ttl), downloader: options.downloader ?? null });
        return token;
    }
    /** The file of a token, only for the user who created it. */
    get(token: string, owner: string | number): StoredDownload | null {
        const file = this.files.get(token);
        if (!file || file.expires < Date.now() || file.owner !== String(owner)) return null;
        return file;
    }
    delete(token: string): void { this.files.delete(token); }
    prune(): number {
        const now = Date.now();
        let removed = 0;
        for (const [token, file] of this.files) if (file.expires < now) { this.files.delete(token); removed++; }
        return removed;
    }
}

type DiskMeta = { owner: string; name: string; type: string; expires: number; downloader: string | null };
/**
 * Files kept on the disk, in a private directory (never serve it statically): they survive restarts and are shared by the
 * processes using the same directory. Each file is `<token>.bin`, with its owner, name, type and expiry in `<token>.json`.
 * Expired files are removed when files are stored (at most once a minute), on `prune()`, and when they are requested.
 */
export class DiskDownloadStore implements DownloadStorage {
    readonly directory: string;
    private readonly ttl: number;
    private readonly maxFiles: number;
    private lastPrune = 0;
    /** `directory`: where the files go (created when the first file is stored). `ttl`: lifetime in milliseconds (24 hours). */
    constructor(options: { directory: string; ttl?: number; maxFiles?: number }) {
        this.directory = nodePath.resolve(options.directory);
        this.ttl = options.ttl ?? DAY;
        this.maxFiles = options.maxFiles ?? 10000;
    }
    private pathOf(token: string, extension: 'bin' | 'json'): string { return nodePath.join(this.directory, `${token}.${extension}`); }
    private readMeta(token: string): DiskMeta | null {
        try { return JSON.parse(readFileSync(this.pathOf(token, 'json'), 'utf8')) as DiskMeta; } catch { return null; }
    }
    put(owner: string | number, name: string, type: string, content: string | Buffer, options: DownloadPutOptions = {}): string {
        mkdirSync(this.directory, { recursive: true });
        if (Date.now() - this.lastPrune > 60_000) this.prune();
        const token = newToken();
        const meta: DiskMeta = { owner: String(owner), name, type, expires: Date.now() + (options.ttl ?? this.ttl), downloader: options.downloader ?? null };
        // The content first, then the metadata (written to a temporary name and renamed): a file is only listed once complete.
        writeFileSync(this.pathOf(token, 'bin'), bufferOf(content), { mode: 0o600 });
        const temporary = nodePath.join(this.directory, `${token}.json.tmp`);
        writeFileSync(temporary, JSON.stringify(meta), { mode: 0o600 });
        renameSync(temporary, this.pathOf(token, 'json'));
        return token;
    }
    get(token: string, owner: string | number): StoredDownload | null {
        if (!isToken(token)) return null;
        const meta = this.readMeta(token);
        if (!meta) return null;
        if (meta.expires < Date.now()) { this.delete(token); return null; }
        if (meta.owner !== String(owner)) return null;
        let content: Buffer;
        try { content = readFileSync(this.pathOf(token, 'bin')); } catch { return null; }
        return { ...meta, content };
    }
    delete(token: string): void {
        if (!isToken(token)) return;
        rmSync(this.pathOf(token, 'json'), { force: true });
        rmSync(this.pathOf(token, 'bin'), { force: true });
    }
    prune(): number {
        this.lastPrune = Date.now();
        if (!existsSync(this.directory)) return 0;
        const now = Date.now();
        let removed = 0;
        const kept: { token: string; expires: number }[] = [];
        for (const entry of readdirSync(this.directory)) {
            const token = entry.replace(/\.(json|bin|json\.tmp)$/, '');
            if (!isToken(token)) continue;
            if (entry.endsWith('.json')) {
                const meta = this.readMeta(token);
                if (!meta || meta.expires < now) { this.delete(token); removed++; } else kept.push({ token, expires: meta.expires });
            } else if (!existsSync(this.pathOf(token, 'json'))) {
                // Content without metadata (an interrupted write), once it is older than a minute.
                try { if (now - statSync(nodePath.join(this.directory, entry)).mtimeMs > 60_000) { rmSync(nodePath.join(this.directory, entry), { force: true }); } } catch { /* removed meanwhile */ }
            }
        }
        // Over the limit: the files closest to expiry go first.
        if (kept.length > this.maxFiles) for (const { token } of kept.sort((a, b) => a.expires - b.expires).slice(0, kept.length - this.maxFiles)) { this.delete(token); removed++; }
        return removed;
    }
}

/** Sends a stored file: `(file, response) => void`. The default one sends it as an attachment. */
export type Downloader = (file: StoredDownload, response: any) => void | Promise<void>;
const downloaders = new Map<string, Downloader>();
/** Makes a downloader available by name, for the files stored with `{ downloader: name }`. */
export function registerDownloader(name: string, downloader: Downloader): void { downloaders.set(name, downloader); }
/** The downloader of a stored file. */
export function downloaderOf(file: StoredDownload): Downloader { return (file.downloader ? downloaders.get(file.downloader) : null) ?? sendDownload; }
/** Default downloader: the file as an attachment, never rendered by the browser, never cached. */
export const sendDownload: Downloader = (file, res) => {
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.content);
};
