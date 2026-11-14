// Rich editor file attachments: images carry the stored file's key in `data-id` (the `id` attribute of the image node), so
// that their URL can be computed when the content is loaded or rendered: a temporary signed URL for private files.
import { temporaryFileUrlExpiry } from '@navette-js/support';
import { safeFileUrl } from './file-upload-support.ts';

/** Where attached files are stored (a `FileStorage` of `@navette-js/forms`). */
export type AttachmentStorage = {
    info(key: string): Promise<{ url: string } | null>;
    url?(key: string): string | null | Promise<string | null>;
    temporaryUrl?(key: string, expiresAt: Date): string | null | Promise<string | null>;
};
export type AttachmentsVisibility = 'public' | 'private';
type Node = { type?: string; attrs?: Record<string, any>; content?: Node[] };

/** Calls `callback` on every image node of a TipTap document (depth first); the callback may change its attributes. */
export async function eachImage(document: unknown, callback: (node: Node) => void | Promise<void>): Promise<void> {
    const visit = async (node: Node) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'image') await callback(node);
        if (Array.isArray(node.content)) for (const child of node.content) await visit(child);
    };
    await visit(document as Node);
}
/** `data-id` values of the images of a document (strings only, as sent by the editor). */
export async function attachmentIdsOf(document: unknown): Promise<string[]> {
    const ids: string[] = [];
    await eachImage(document, (node) => { const id = node.attrs?.id; if (typeof id === 'string' && id !== '') ids.push(id); });
    return ids;
}

/**
 * URL of a stored attachment: `null` if the storage does not have it. Private files get a temporary URL (until the end of the
 * hour following the next 30 minutes, as Filament), when the storage can sign one. Only local or http(s) URLs are returned.
 */
export async function attachmentUrl(storage: AttachmentStorage | null, visibility: AttachmentsVisibility, key: string): Promise<string | null> {
    if (!storage || typeof key !== 'string' || key === '') return null;
    let info: { url: string } | null;
    try { info = await storage.info(key); } catch { return null; }
    if (!info) return null;
    if (visibility === 'private' && typeof storage.temporaryUrl === 'function') {
        // Expiry as Filament's: 30 minutes from now (`fileUrlConfig`), rounded up to the end of the hour. A storage that cannot
        // sign (a public `LocalFileStorage` without a key) gives its usual URL.
        let temporary: string | null = null;
        try { temporary = await storage.temporaryUrl(key, temporaryFileUrlExpiry()); } catch { temporary = null; }
        if (temporary) return safeFileUrl(temporary);
    }
    return safeFileUrl(info.url);
}
