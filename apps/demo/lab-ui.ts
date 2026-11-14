// `/lab` "UI lab": notification actions (real Actions: icons, tooltips, groups, disabled state, safe HTML body), text entry
// affix actions, and images of a private storage shown through temporary signed URLs.
// Left out of the parity screenshots (NAVETTE_NO_THEMES).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Action, ActionGroup } from '@navette-js/actions';
import { LocalFileStorage } from '@navette-js/forms';
import { ImageEntry, TextEntry } from '@navette-js/infolists';
import { Notification, Page } from '@navette-js/panels';
import { Section, Text, type Schema } from '@navette-js/schemas';
import { markdownToHtml } from '@navette-js/support';

/** URL under which the private files of the lab are served (`serve()` checks every signature). */
export const LAB_PRIVATE_FILES_URL = '/lab-private-files';
/** A 2×2 PNG, written into the private storage at startup. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
let privateFiles: LocalFileStorage | null = null;
/** The lab's private storage (created once, with the panel key), holding `scans/receipt.png`. */
export function labPrivateFiles(key: string): LocalFileStorage {
    if (privateFiles) return privateFiles;
    const uploads = process.env.NAVETTE_UPLOADS ?? fileURLToPath(new URL('./storage', import.meta.url));
    const root = path.join(uploads, 'lab-private');
    mkdirSync(path.join(root, 'scans'), { recursive: true });
    writeFileSync(path.join(root, 'scans', 'receipt.png'), PNG);
    writeFileSync(path.join(root, 'scans', 'receipt.png.meta.json'), JSON.stringify({ name: 'Receipt.png', type: 'image/png' }));
    privateFiles = new LocalFileStorage(root, LAB_PRIVATE_FILES_URL, { visibility: 'private', key });
    return privateFiles;
}

export class LabUiPage extends Page {
    static slug = 'ui';
    static title = 'UI lab';
    static navigationIcon = 'o-bell-alert';
    static navigationGroup = 'Forms';
    static navigationSort = 31;
    static listeners = { labCommentApproved: 'onCommentApproved' };

    /** Number of "Approve" clicks in notifications (a Livewire event dispatched by the notification action). */
    approvals = 0;
    onCommentApproved(): void { this.approvals++; }

    contentSchema(schema: Schema): Schema {
        // Created by the panel with its key (`labPanel()`).
        const storage = privateFiles ?? labPrivateFiles('navette-lab-private-files-key');
        return schema.components([
            Text.make(() => `Approvals: ${this.approvals}`).key('approvals'),
            Section.make('Entries').schema([
                TextEntry.make('cost').state(() => 12).prefix('€')
                    .suffixAction(Action.make('copyCostToPrice').label('Copy cost to price').icon('o-clipboard').tooltip('Copy to price')
                        .action(() => { Notification.make().success().title('Cost copied to the price').send(); })),
                TextEntry.make('description').state(() => 'A long description that is cut by the character limit.').limit(20)
                    .tooltip((_record, state) => String(state)),
                ImageEntry.make('scan').label('Private scan').state(() => 'scans/receipt.png').storage(storage).imageHeight(40),
                ImageEntry.make('missing').label('Missing scan').state(() => 'scans/missing.png').storage(storage).defaultImageUrl('/images/logo/navette-icon.svg').imageHeight(40),
            ]),
        ]);
    }

    getHeaderActions(): Action[] {
        return [
            Action.make('sendRichNotification').label('Send a notification').icon('m-bell')
                .action(() => {
                    Notification.make().persistent().info()
                        .title(markdownToHtml('New **comment** on <em>Navette</em>').replace(/^<p>|<\/p>\s*$/g, ''))
                        .body(markdownToHtml('A visitor wrote: *"Great release!"* <img src=x onerror="window.injected = true">'))
                        .actions([
                            Action.make('view').button().icon('o-eye').url('/lab'),
                            Action.make('locked').label('Locked').icon('o-lock-closed').disabled().tooltip('You may not do this'),
                            // A plain object works too; only harmless extra attributes are kept (`onclick` is dropped).
                            { label: 'Flag', view: 'icon-button', icon: 'o-flag', color: 'warning', dispatch: { event: 'labCommentFlagged' }, extraAttributes: { 'data-test': 'flag', onclick: 'window.injected = true' } },
                            ActionGroup.make([
                                Action.make('approve').icon('o-check').dispatch('labCommentApproved', { id: 5 }),
                                Action.make('dismiss').icon('o-x-mark').close(),
                            ]).label('More'),
                        ])
                        .send();
                }),
        ];
    }
}
