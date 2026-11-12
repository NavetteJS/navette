// Téléversements temporaires (équivalent de WithFileUploads / TemporaryUploadedFile de Livewire).
// Le navigateur demande une adresse signée (`_startUpload`), y envoie les fichiers, puis annonce leurs noms temporaires (`_finishUpload`) :
// la propriété visée reçoit alors `livewire-file:<identifiant>`. Le fichier ne quitte le dossier temporaire que si l'application l'enregistre.
import busboy from 'busboy';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';

export type TemporaryFile = { id: string; path: string; name: string; type: string; size: number; extension: string };
export type UploadOptions = { maxFileSize?: number; maxFiles?: number; ttl?: number; urlTtl?: number };

const PREFIX = 'livewire-file:';
const ID = /^[a-f0-9]{32}$/;
/** Types reconnus à leur signature binaire : le type annoncé par le navigateur n'est jamais cru. */
const SIGNATURES: { type: string; extension: string; test: (b: Buffer) => boolean }[] = [
    { type: 'image/jpeg', extension: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { type: 'image/png', extension: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { type: 'image/gif', extension: 'gif', test: (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')) },
    { type: 'image/webp', extension: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
    { type: 'application/pdf', extension: 'pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
    { type: 'application/zip', extension: 'zip', test: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 },
];
/** Texte brut : uniquement pour ces extensions, et seulement si le début du fichier ne contient pas d'octet nul. */
const TEXT: Record<string, string> = { txt: 'text/plain', csv: 'text/csv', json: 'application/json', md: 'text/markdown' };

export class UploadStore {
    readonly dir: string;
    private key: string;
    private maxFileSize: number;
    private maxFiles: number;
    private ttl: number;
    private urlTtl: number;
    constructor(dir: string, key: string, options: UploadOptions = {}) {
        this.dir = dir;
        this.key = key;
        this.maxFileSize = options.maxFileSize ?? 12 * 1024 * 1024; // 12 Mo, comme la règle par défaut de Livewire
        this.maxFiles = options.maxFiles ?? 20;
        this.ttl = options.ttl ?? 24 * 60 * 60 * 1000;
        this.urlTtl = options.urlTtl ?? 5 * 60 * 1000;
        mkdirSync(dir, { recursive: true });
    }

    private sign(expires: number): string { return createHmac('sha256', this.key).update(`upload:${expires}`).digest('hex'); }
    /** Adresse d'envoi signée, valable quelques minutes. */
    signedUrl(prefix = '/livewire'): string {
        const expires = Date.now() + this.urlTtl;
        return `${prefix}/upload-file?expires=${expires}&signature=${this.sign(expires)}`;
    }
    verifySignature(expires: unknown, signature: unknown): boolean {
        const at = Number(expires);
        if (!Number.isFinite(at) || at < Date.now()) return false;
        const expected = Buffer.from(this.sign(at)), given = Buffer.from(String(signature ?? ''));
        return expected.length === given.length && timingSafeEqual(expected, given);
    }

    /** Reçoit un envoi `multipart/form-data` (champ `files[]`) et rend les identifiants temporaires, dans l'ordre. */
    receive(req: IncomingMessage): Promise<string[]> {
        this.sweep();
        return new Promise((resolve, reject) => {
            const ids: string[] = [];
            const pending: Promise<void>[] = [];
            let failure: Error | null = null;
            const fail = (message: string) => { failure ??= Object.assign(new Error(message), { status: 422 }); };
            let parser: busboy.Busboy;
            try { parser = busboy({ headers: req.headers, limits: { fileSize: this.maxFileSize, files: this.maxFiles, fields: 5 } }); } catch { reject(Object.assign(new Error('Envoi invalide.'), { status: 422 })); return; }
            parser.on('file', (_field, stream, info) => {
                const id = randomBytes(16).toString('hex');
                const target = path.join(this.dir, id);
                ids.push(id);
                const out = createWriteStream(target, { flags: 'wx' });
                stream.on('limit', () => fail('Fichier trop volumineux.'));
                pending.push(new Promise<void>((done) => { out.on('close', done); out.on('error', () => { fail('Écriture impossible.'); done(); }); }).then(async () => {
                    if (failure) return;
                    const detected = await detect(target, info.filename);
                    writeFileSync(`${target}.json`, JSON.stringify({ name: path.basename(String(info.filename ?? 'file')).slice(0, 255), type: detected.type, extension: detected.extension }));
                }));
                stream.pipe(out);
            });
            parser.on('filesLimit', () => fail('Trop de fichiers.'));
            parser.on('error', () => fail('Envoi invalide.'));
            parser.on('close', async () => {
                await Promise.all(pending);
                if (failure || !ids.length) { for (const id of ids) this.remove(id); reject(failure ?? Object.assign(new Error('Aucun fichier.'), { status: 422 })); return; }
                resolve(ids);
            });
            req.pipe(parser);
        });
    }

    /** Fichier temporaire désigné par une valeur d'état (`livewire-file:<id>`) ou un identifiant, s'il existe encore. */
    resolve(value: unknown): TemporaryFile | null {
        const id = typeof value === 'string' ? (value.startsWith(PREFIX) ? value.slice(PREFIX.length) : value) : '';
        if (!ID.test(id)) return null;
        const file = path.join(this.dir, id);
        if (!existsSync(file) || !existsSync(`${file}.json`)) return null;
        try {
            const meta = JSON.parse(readFileSync(`${file}.json`, 'utf8'));
            return { id, path: file, name: String(meta.name), type: String(meta.type), extension: String(meta.extension), size: statSync(file).size };
        } catch { return null; }
    }
    static isTemporary(value: unknown): boolean { return typeof value === 'string' && value.startsWith(PREFIX) && ID.test(value.slice(PREFIX.length)); }
    static reference(id: string): string { return PREFIX + id; }
    remove(id: string): void {
        if (!ID.test(id)) return;
        for (const suffix of ['', '.json']) rmSync(path.join(this.dir, id + suffix), { force: true });
    }
    /** Supprime les fichiers temporaires plus vieux que la durée de conservation. */
    private sweep(): void {
        const limit = Date.now() - this.ttl;
        try { for (const name of readdirSync(this.dir)) { const file = path.join(this.dir, name); if (statSync(file).mtimeMs < limit) rmSync(file, { force: true }); } } catch { /* dossier inaccessible : rien à nettoyer */ }
    }
}

async function detect(file: string, filename: string): Promise<{ type: string; extension: string }> {
    const handle = await open(file, 'r');
    try {
        const { buffer, bytesRead } = await handle.read(Buffer.alloc(512), 0, 512, 0);
        const head = buffer.subarray(0, bytesRead);
        const known = SIGNATURES.find((signature) => signature.test(head));
        if (known) return { type: known.type, extension: known.extension };
        const extension = path.extname(String(filename ?? '')).slice(1).toLowerCase();
        if (TEXT[extension] && !head.includes(0)) return { type: TEXT[extension], extension };
        return { type: 'application/octet-stream', extension: 'bin' };
    } finally { await handle.close(); }
}
