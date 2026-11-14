// Record-aware storage of the images attached in a rich editor: the provider stores each upload for the record being edited,
// gives the URL of the ids it manages, and deletes the files removed from the content.
import type { AttachmentsVisibility } from './rich-editor-attachments.ts';
import type { FileStorage, TemporaryUpload } from './index.ts';

/** What a provider is told about the content it serves. */
export type FileAttachmentContext = {
    /** The record whose content holds the attachments; `null` while it is being created. */
    record: unknown;
    /** Name of the content attribute (the editor's name). */
    attribute: string;
    /** Visibility of the attachments: `private` ones get temporary URLs. */
    visibility: AttachmentsVisibility;
};

export interface FileAttachmentProvider {
    /** URL of an attachment this provider manages for the record, or `null` (an id of another record must give `null`). */
    getFileAttachmentUrl(file: string, context: FileAttachmentContext): Promise<string | null> | string | null;
    /** Stores an image uploaded in the editor for the record; returns its id, saved in the image's `data-id`. */
    saveUploadedFileAttachment(file: TemporaryUpload, context: FileAttachmentContext): Promise<string | null> | string | null;
    /**
     * Deletes the record's attachments that are no longer in the content: `exceptIds` are the ids still used,
     * `previousIds` those of the content saved before (the record's attribute when it was loaded).
     */
    cleanUpFileAttachments(exceptIds: string[], context: FileAttachmentContext & { previousIds: string[] }): Promise<void> | void;
    /** Visibility used when the editor and the attribute set none (`private` for a provider serving temporary URLs). */
    getDefaultFileAttachmentVisibility?(): AttachmentsVisibility | null;
    /**
     * Whether new attachments need the record to exist (to be stored under its key). The editor then saves its content
     * after the record is created, with the uploads stored for it.
     */
    isExistingRecordRequiredToSaveNewFileAttachments(): boolean;
    /** Writes the content into the record after it was created, when attachments needed it (an Objection `patch()` otherwise). */
    saveContentToRecord?(record: unknown, attribute: string, content: unknown): Promise<void> | void;
}

const keyOf = (record: unknown): string | null => {
    if (!record || typeof record !== 'object') return null;
    const candidate = record as { $id?: () => unknown; id?: unknown };
    const id = typeof candidate.$id === 'function' ? candidate.$id() : candidate.id;
    return id === null || id === undefined || id === '' ? null : String(id);
};

/**
 * Stores each record's attachments in its own directory of a `FileStorage` (`posts/12/…` with
 * `directory((record) => \`posts/${record.id}\`)`). Only ids under the record's directory get a URL, so content cannot show
 * another record's files, and files removed from the content are deleted when it is saved.
 */
export class StorageFileAttachmentProvider implements FileAttachmentProvider {
    protected storage: FileStorage;
    protected _directory: (record: unknown, attribute: string) => string;
    protected _visibility: AttachmentsVisibility | null = null;

    constructor(storage: FileStorage) {
        this.storage = storage;
        this._directory = (record, attribute) => `rich-content/${attribute}/${keyOf(record)}`;
    }
    static make(storage: FileStorage): StorageFileAttachmentProvider { return new this(storage); }
    /** Directory of a record's attachments (`rich-content/<attribute>/<record key>` by default); it must be unique per record. */
    directory(directory: (record: unknown, attribute: string) => string): this { this._directory = directory; return this; }
    /** Default visibility of the attachments (`private` when the storage is private). */
    visibility(visibility: AttachmentsVisibility | null): this { this._visibility = visibility; return this; }

    protected directoryOf(context: FileAttachmentContext): string | null {
        if (keyOf(context.record) === null) return null;
        const directory = this._directory(context.record, context.attribute).replace(/^\/+|\/+$/g, '');
        return directory && !directory.split('/').some((segment) => segment === '..' || segment === '.' || segment === '') ? directory : null;
    }
    protected owns(file: string, context: FileAttachmentContext): boolean {
        const directory = this.directoryOf(context);
        return directory !== null && typeof file === 'string' && file.startsWith(`${directory}/`) && !file.slice(directory.length + 1).includes('/') && !file.includes('..');
    }
    async getFileAttachmentUrl(file: string, context: FileAttachmentContext): Promise<string | null> {
        if (!this.owns(file, context)) return null;
        const { attachmentUrl } = await import('./rich-editor-attachments.ts');
        return attachmentUrl(this.storage, context.visibility, file);
    }
    async saveUploadedFileAttachment(file: TemporaryUpload, context: FileAttachmentContext): Promise<string | null> {
        const directory = this.directoryOf(context);
        if (directory === null) return null;
        return this.storage.store(file, directory, null, { visibility: context.visibility });
    }
    async cleanUpFileAttachments(exceptIds: string[], context: FileAttachmentContext & { previousIds: string[] }): Promise<void> {
        if (typeof this.storage.delete !== 'function') return;
        for (const id of new Set(context.previousIds)) if (!exceptIds.includes(id) && this.owns(id, context)) await this.storage.delete(id);
    }
    getDefaultFileAttachmentVisibility(): AttachmentsVisibility | null { return this._visibility ?? (this.storage.visibility === 'private' ? 'private' : null); }
    isExistingRecordRequiredToSaveNewFileAttachments(): boolean { return true; }
}

/** Writes the content into a record after it was created: the provider's `saveContentToRecord()`, an Objection `patch()`, or the property. */
export async function saveContentToRecord(provider: FileAttachmentProvider, record: unknown, attribute: string, content: unknown): Promise<void> {
    if (provider.saveContentToRecord) { await provider.saveContentToRecord(record, attribute, content); return; }
    const model = record as { $query?: () => { patch(values: Record<string, unknown>): Promise<unknown> } } & Record<string, unknown>;
    if (typeof model.$query === 'function') await model.$query().patch({ [attribute]: content });
    model[attribute] = content;
}
