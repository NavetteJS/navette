// `/lab` "Tabs lab": lazy-loaded tab badges, tabs bound to a Livewire property (with and without content panels).
// Left out of the parity screenshots (NAVETTE_NO_THEMES).
import { Page } from '@navette-js/panels';
import { Tab, Tabs, Text, type Schema } from '@navette-js/schemas';

const STATUSES: Record<string, string> = { all: 'All posts', published: 'Published posts', draft: 'Draft posts' };

export class LabTabsPage extends Page {
    static slug = 'tabs';
    static title = 'Tabs lab';
    static navigationIcon = 'o-folder';
    static navigationGroup = 'Forms';
    static navigationSort = 30;

    /** Written by the "Status" tabs (`$set('activeStatus', …)`): a public property, so its value comes from the browser. */
    activeStatus = 'all';
    /** Written by the "Period" tabs, which have no content panels. */
    activePeriod = 'week';

    contentSchema(schema: Schema): Schema {
        const status = () => (Object.hasOwn(STATUSES, this.activeStatus) ? this.activeStatus : 'all');
        return schema.components([
            Tabs.make('Inbox').schema([
                Tab.make('All').badge(12).schema([Text.make('Every message.')]),
                // The badge is computed in a second request, after the page has rendered (an expensive query, simulated).
                Tab.make('Unread').badge(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); return 7; })
                    .badgeColor('danger').badgeIcon('m-bell').badgeTooltip('Unread messages').lazyLoadedBadge()
                    .schema([Text.make('Unread messages.')]),
                Tab.make('Spam').badge(async () => null).lazyLoadedBadge().schema([Text.make('No spam.')]),
            ]),
            Tabs.make('Status').livewireProperty('activeStatus').schema(Object.fromEntries(Object.entries(STATUSES).map(([key, label]) => [
                key, Tab.make(label.replace(' posts', '')).schema([Text.make(() => `Showing: ${STATUSES[status()]}.`).key(`status-${key}`)]),
            ]))),
            Tabs.make('Period').livewireProperty('activePeriod').tabPanels(false).schema({
                week: Tab.make('This week'),
                month: Tab.make('This month'),
                year: Tab.make('This year'),
            }),
            Text.make(() => `Selected period: ${['week', 'month', 'year'].includes(this.activePeriod) ? this.activePeriod : 'week'}.`).key('selectedPeriod'),
        ]);
    }
}
