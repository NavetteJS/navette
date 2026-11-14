// Live notifications: the buttons send notifications from the server to every open page of the signed-in user
// (`panel.broadcasting()`), as a background job would. Left out of the parity screenshots (NAVETTE_NO_THEMES).
import { Action } from '@navette-js/actions';
import { fileURLToPath } from 'node:url';
import { AlpineComponent, Notification, NavetteAsset, Page } from '@navette-js/panels';
import { Html, type Schema } from '@navette-js/schemas';

/** Assets of the page, registered by the panel (`panel.assets()`): an Alpine component loaded on request. */
export const liveNotificationsAssets = [AlpineComponent.make('live-clock', fileURLToPath(new URL('../assets/live-clock.js', import.meta.url)))];

export class LiveNotificationsPage extends Page {
    static slug = 'live-notifications';
    static title = 'Live notifications';
    static navigationIcon = 'o-bolt';
    static navigationSort = 20;

    getSubheading(): string { return 'Open this page in two tabs: notifications sent from the server appear in both, without reloading.'; }

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Html.make(() => `<div class="fi-section"><div class="fi-section-content-ctn"><div class="fi-section-content">Server time: <span wire:ignore x-load x-load-src="${NavetteAsset.getAlpineComponentSrc('live-clock')}" x-data="liveClock()" x-text="time" data-live-clock></span></div></div></div>`),
        ]);
    }

    getHeaderActions(): Action[] {
        return [
            Action.make('broadcastNow').label('Broadcast a notification').icon('m-bolt')
                .action(async ({ livewire }: any) => {
                    await Notification.make().success().title('Live notification').body(`Sent at ${new Date().toLocaleTimeString('en-GB')}`).broadcast(livewire._ctx.user, { panel: livewire.panel });
                }),
            Action.make('broadcastLater').label('Broadcast in 2 seconds').icon('m-clock').color('gray')
                .action(({ livewire }: any) => {
                    // Like a queued job: the notification is sent after the request has ended.
                    const user = livewire._ctx.user;
                    const panel = livewire.panel;
                    setTimeout(() => { void Notification.make().info().title('Background job finished').body('The export is ready.').broadcast(user, { panel }); }, 2000);
                    Notification.make().title('Job started').body('You will be notified when it is done.').send();
                }),
            Action.make('databaseNotification').label('Add to my notifications').icon('m-bell').color('gray')
                .action(async ({ livewire }: any) => {
                    const panel = livewire.panel;
                    await Notification.make().warning().title('Stock running low').body('Three products have fewer than 10 items.')
                        .sendToDatabase(panel.getDatabaseNotifications(), livewire._ctx.user, true, { panel });
                }),
        ];
    }
}
