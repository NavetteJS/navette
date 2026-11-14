// Upload targets of a component's schemas: a temporary upload is only accepted for the state path of a file upload field or of an editor that stores file attachments.
import type { Component, Schema } from '@navette-js/schemas';
import { FileUpload, MarkdownEditor, RichEditor } from './index.ts';

/** Prefix of the uploads of rich and Markdown editors: `componentFileAttachments.<state path>[.<id>]`. */
const ATTACHMENTS_PREFIX = 'componentFileAttachments.';

/**
 * Whether a schema component accepts temporary uploads: a `FileUpload` (and its subclasses), a `RichEditor` or a
 * `MarkdownEditor`, or a custom field declaring `acceptsFileUploads(): boolean` (returning `true`).
 */
export function acceptsFileUploads(component: Component): boolean {
    const custom = (component as { acceptsFileUploads?: () => unknown }).acceptsFileUploads;
    if (typeof custom === 'function') return Boolean(custom.call(component));
    return component instanceof FileUpload || component instanceof RichEditor || component instanceof MarkdownEditor;
}

/** The visible component of these schemas that accepts uploads for exactly this state path, if any. */
export async function findFileUploadComponent(schemas: Iterable<Schema | null | undefined>, statePath: string): Promise<Component | null> {
    for (const schema of schemas) {
        if (!schema) continue;
        for (const component of await schema.getVisibleFlatComponents()) {
            if (!component.hasStatePath() || component.getStatePath() !== statePath) continue;
            if (acceptsFileUploads(component)) return component;
        }
    }
    return null;
}

/**
 * Whether an upload name sent by the browser (`_startUpload` / `_finishUpload`) targets a visible upload field of these
 * schemas: its state path, a key under it (`data.photos.<uuid>`), or the attachments holder of an editor
 * (`componentFileAttachments.data.content[.<id>]`).
 */
export async function isFileUploadForSchemas(schemas: Iterable<Schema | null | undefined>, name: string): Promise<boolean> {
    if (typeof name !== 'string' || !name) return false;
    const list = [...schemas];
    const path = name.startsWith(ATTACHMENTS_PREFIX) ? name.slice(ATTACHMENTS_PREFIX.length) : name;
    if (await findFileUploadComponent(list, path)) return true;
    const lastDot = path.lastIndexOf('.');
    return lastDot > 0 && (await findFileUploadComponent(list, path.slice(0, lastDot))) !== null;
}
