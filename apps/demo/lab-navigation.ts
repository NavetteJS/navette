// `/lab-nav` panel: navigation, menus and security options, served under a strict Content-Security-Policy.
// - the navigation is built by hand (`navigation((builder) => …)`), with an HTML label, a new-tab link and a collapsed group;
// - the user menu has groups, an action opening a modal, a POST item and a customized logout item;
// - every response carries a policy without `'unsafe-inline'` for scripts: the panel puts the request's nonce on its inline
//   scripts and styles (`useCspNonce()`).
// Left out of the parity screenshots (NAVETTE_NO_THEMES).
import { randomBytes } from 'node:crypto';
import { Action, ActionGroup } from '@navette-js/actions';
import { ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { Dashboard, NavigationGroup, NavigationItem, Notification, Page, Panel, Resource, type AuthProvider, type Login } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { Color, HtmlString, useCspNonce } from '@navette-js/support';
import { TextColumn, type Table } from '@navette-js/tables';
import { LabProduct } from './lab-panel.ts';

class NavLabHome extends Dashboard {
    static title = 'Navigation lab';
}
class NavLabProducts extends Resource {
    static slug = 'products';
    static modelLabel = 'product';
    static navigationIcon = 'o-cube';
    static activeNavigationIcon = 's-cube';
    static navigationBadgeTooltip = 'Products in stock';
    static isSimple = true;
    static adapter = new ObjectionAdapter(LabProduct);
    static getNavigationBadge(): string { return 'new'; }
    static table(table: Table<any>): Table<any> { return table.columns([TextColumn.make('name').searchable(), TextColumn.make('qty').numeric()]); }
}
class NavLabReport extends Page {
    static slug = 'stock-report';
    static title = 'Stock report';
    static navigationIcon = 'o-chart-bar';
    contentSchema(schema: Schema): Schema { return schema.components([]); }
}

/** Middleware sending a strict policy, with a nonce for the panel's inline scripts and styles. */
function strictContentSecurityPolicy(req: any, res: any, next: () => void): void {
    const nonce = randomBytes(16).toString('base64');
    useCspNonce(res, nonce);
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        // Alpine.js and Livewire evaluate the expressions of the markup: 'unsafe-eval' stays.
        `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`,
        `style-src-elem 'self' 'nonce-${nonce}' https://fonts.bunny.net`,
        // Style attributes (`style="…"`) cannot carry a nonce.
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: https://ui-avatars.com",
        "font-src 'self' data: https://fonts.bunny.net",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; '));
    next();
}

export function labNavigationPanel(options: { key: string; login: typeof Login; auth: AuthProvider; canAccess: (user: any) => boolean }): Panel {
    return Panel.make()
        .id('lab-nav')
        .path('lab-nav')
        .key(options.key)
        .brandName('Navigation Lab')
        .setColors({ primary: Color.Teal, brand: '#c026d3' })
        .login(options.login)
        .auth(options.auth)
        .canAccess(options.canAccess)
        .pages([NavLabHome, NavLabReport])
        .resources([NavLabProducts])
        // Persistent: component updates get the policy too.
        .middleware([strictContentSecurityPolicy], true)
        .sidebarWidth('17rem')
        .navigation((builder) => builder
            .items([...NavLabHome.getNavigationItems()])
            .groups([
                NavigationGroup.make('Catalog').items([
                    ...NavLabProducts.getNavigationItems(),
                    ...NavLabReport.getNavigationItems(),
                ]),
                NavigationGroup.make(new HtmlString('Links <span class="nv-badge nv-size-xs" data-nv-html-label>ext</span>')).collapsed().extraSidebarAttributes({ 'data-nv-group': 'links' }).items([
                    NavigationItem.make('Navette on GitHub').url('https://github.com/NavetteJS/navette', true).icon('o-arrow-top-right-on-square'),
                    NavigationItem.make('Filament documentation').url('https://filamentphp.com/docs', true).icon('o-book-open'),
                ]),
            ]))
        .breadcrumbs(true, true)
        .userMenuItems([
            [
                Action.make('feedback').label('Send feedback').icon('m-chat-bubble-left-right').modalHeading('Send feedback').modalSubmitActionLabel('Send')
                    .schema([TextInput.make('message').label('Message').required()])
                    .action(({ data }) => { Notification.make().success().title('Feedback sent').body(String(data.message ?? '')).send(); }),
                Action.make('report').label('Stock report').icon('m-chart-bar').url('/lab-nav/stock-report'),
            ],
            [ActionGroup.make([Action.make('docs').label('Documentation').icon('m-book-open').url('https://filamentphp.com/docs').openUrlInNewTab()])],
            { logout: (action: Action) => action.label('Leave the lab') },
        ]);
}
