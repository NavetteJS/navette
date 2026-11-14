// Page loading overlay lab: four small panels, one per setting of `panel.pageLoadingIndicator()`, each with a page that the
// server answers slowly (1.5 s) so the overlay shows.
// - `/lab-loading`: 'content' (default), sidebar navigation collapsible on desktop, SPA;
// - `/lab-loading-top`: 'content', top navigation, full-page loads (no SPA);
// - `/lab-loading-screen`: 'screen', SPA;
// - `/lab-loading-off`: false, SPA.
// Left out of the parity screenshots (NAVETTE_NO_THEMES).
import { AccountWidget, Dashboard, NavetteInfoWidget, Page, Panel, type AuthProvider, type Login, type PageLoadingIndicator } from '@navette-js/panels';
import { Grid, Section, Text, type Schema } from '@navette-js/schemas';

export const SLOW_PAGE_DELAY = 1500;

class LoadingLabHome extends Dashboard {
    static title = 'Page loading lab';
}
class LoadingLabSlowPage extends Page {
    static slug = 'slow';
    static title = 'Slow page';
    static navigationIcon = 'o-clock';
    contentSchema(schema: Schema): Schema {
        return schema.components([
            Grid.make(2).schema([
                Section.make('Report').schema([Text.make(`The server took ${SLOW_PAGE_DELAY / 1000} s to answer this page.`)]),
                Section.make('Details').schema([Text.make('While it loads, an overlay covers the content area, the whole screen, or nothing.')]),
            ]),
        ]);
    }
}
class LoadingLabFastPage extends Page {
    static slug = 'fast';
    static title = 'Fast page';
    static navigationIcon = 'o-bolt';
    contentSchema(schema: Schema): Schema { return schema.components([Text.make('Answered at once: no overlay.')]); }
}

type LabOptions = { key: string; login: typeof Login; auth: AuthProvider; canAccess: (user: any) => boolean };

function loadingLabPanel(id: string, brandName: string, indicator: PageLoadingIndicator, options: LabOptions): Panel {
    return Panel.make()
        .id(id)
        .path(id)
        .key(options.key)
        .brandName(brandName)
        .login(options.login)
        .auth(options.auth)
        .canAccess(options.canAccess)
        .pages([LoadingLabHome, LoadingLabSlowPage, LoadingLabFastPage])
        .widgets([AccountWidget, NavetteInfoWidget])
        .pageLoadingIndicator(indicator)
        .middleware([(req: any, _res: any, next: () => void) => { if (/\/slow$/.test(req.path)) setTimeout(next, SLOW_PAGE_DELAY); else next(); }]);
}

export function pageLoadingLabPanels(options: LabOptions): Panel[] {
    return [
        loadingLabPanel('lab-loading', 'Loading Lab', 'content', options).spa().sidebarCollapsibleOnDesktop(),
        loadingLabPanel('lab-loading-top', 'Loading Lab (top navigation)', 'content', options).topNavigation(),
        loadingLabPanel('lab-loading-screen', 'Loading Lab (screen)', 'screen', options).spa(),
        loadingLabPanel('lab-loading-off', 'Loading Lab (off)', false, options).spa(),
    ];
}
