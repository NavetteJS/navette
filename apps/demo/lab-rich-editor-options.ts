// `/lab` "Rich editor options": dropdown groups and floating toolbars, sticky toolbar and panels, height, link protocols, a
// plugin, and private image attachments (signed temporary URLs), exercised by e2e/rich-editor-options.e2e.mjs.
// Not in the parity screenshots (registered only without NAVETTE_NO_THEMES).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import type { Request, Response } from 'express';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { LocalFileStorage, RichEditor, RichEditorTool, TextInput, ToolbarButtonGroup, type RichContentPlugin } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import { TextColumn, type Table } from '@navette-js/tables';

class LabRichProduct extends Model { static tableName = 'products'; }

/**
 * Private attachments of the lab: a `LocalFileStorage` outside any static folder whose `temporaryUrl()` signs a URL, served by
 * `handler()`. Any `FileStorage` with a `temporaryUrl()` method works the same (a bucket's signed URLs, for example).
 */
export class LabPrivateStorage extends LocalFileStorage {
    private secret: string;
    private folder: string;
    constructor(root: string, baseUrl: string, secret: string) { super(root, baseUrl); this.folder = root; this.secret = secret; }
    private signature(key: string, expires: number): string { return createHmac('sha256', this.secret).update(`lab-private:${key}:${expires}`).digest('hex'); }
    temporaryUrl(key: string, expiresAt: Date): string | null {
        const url = this.url(key);
        return url ? `${url}?expires=${expiresAt.getTime()}&signature=${this.signature(key, expiresAt.getTime())}` : null;
    }
    /** Serves a stored file for a valid, unexpired signature; anything else gets a 404. */
    handler() {
        return (req: Request, res: Response) => {
            const key = decodeURIComponent(req.path.replace(/^\//, ''));
            const expires = Number(req.query.expires);
            const expected = Buffer.from(this.signature(key, expires)), given = Buffer.from(String(req.query.signature ?? ''));
            const valid = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,250}$/.test(key) && !key.split('/').some((part) => part === '..' || part === '.') && Number.isFinite(expires) && expires > Date.now() && expected.length === given.length && timingSafeEqual(expected, given);
            const file = nodePath.join(this.folder, ...key.split('/'));
            if (!valid || !existsSync(file)) { res.status(404).end(); return; }
            let type = 'application/octet-stream';
            try { type = JSON.parse(readFileSync(`${file}.meta.json`, 'utf8')).type ?? type; } catch { /* no metadata */ }
            res.set({ 'Content-Type': /^image\/(png|jpeg|gif|webp)$/.test(type) ? type : 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=1800' }).send(readFileSync(file));
        };
    }
}
let privateStorage: LabPrivateStorage | null = null;
/** Called by the demo server: where private attachments go, and the route serving their temporary URLs. */
export function labPrivateAttachments(root: string, secret: string): { path: string; handler: (req: Request, res: Response) => void } {
    privateStorage = new LabPrivateStorage(root, '/lab-private-attachments', secret);
    return { path: '/lab-private-attachments', handler: privateStorage.handler() };
}

/** A plugin adding a toolbar button (and enabling the built-in `highlight` one). */
class ShoutPlugin implements RichContentPlugin {
    getTipTapServerExtensions() { return []; }
    getTipTapJsExtensions() { return []; }
    getEditorTools() { return [RichEditorTool.make('shout').label('Uppercase the selection').icon('m-megaphone').jsHandler("(() => { const { from, to } = $getEditor().state.selection; const text = $getEditor().state.doc.textBetween(from, to, ' '); if (text) $getEditor().chain().focus().insertContentAt({ from, to }, text.toUpperCase()).run() })()")]; }
    getEditorActions() { return []; }
    getEnabledToolbarButtons() { return [['highlight', 'shout']]; }
    getDisabledToolbarButtons() { return ['strike']; }
}

export class LabRichEditorOptions extends Resource {
    static slug = 'rich-editor-options';
    static modelLabel = 'product';
    static navigationIcon = 'o-document-text';
    static navigationLabel = 'Rich editor options';
    static navigationGroup = 'Forms';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(LabRichProduct);

    static form(schema: any) {
        return schema.components([
            TextInput.make('name').required(),
            RichEditor.make('description')
                .plugins([new ShoutPlugin()])
                .toolbarButtons([
                    ['bold', 'italic', 'strike', 'link'],
                    [ToolbarButtonGroup.make('Heading', ['paragraph', 'h2', 'h3']).textualButtons()],
                    [ToolbarButtonGroup.make('Alignment', ['alignStart', 'alignCenter', 'alignEnd']).icon('m-bars-3-bottom-left')],
                    ['bulletList', 'table', 'attachFiles', 'mergeTags'],
                    ['undo', 'redo'],
                ])
                .floatingToolbars({
                    paragraph: ['bold', 'italic', 'link'],
                    table: ['tableAddRowAfter', 'tableDeleteRow', 'tableDelete'],
                })
                .mergeTags({ name: 'Product name', sku: 'SKU' })
                .linkProtocols(['https', 'mailto'])
                .minHeight('8rem')
                .maxHeight('16rem')
                .stickyToolbar()
                .stickyPanels()
                .stickyOffset('4rem')
                .fileAttachmentsStorage(privateStorage)
                .fileAttachmentsDirectory('lab-rich')
                .fileAttachmentsVisibility('private'),
        ]);
    }

    static table(table: Table<any>): Table<any> {
        return table.columns([TextColumn.make('name').searchable()]);
    }
}
