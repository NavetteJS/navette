// Navette demo app: the `admin` panel (shop, HR, projects, blog) plus a second, multi-tenant `app` panel.
import express from 'express';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppAuthentication, Dashboard, EditProfile, EmailAuthentication, fileMailer, knexNotificationStore, Login, multiFactorAuthenticationSchema, SecurityKeyAuthentication, NavigationItem, Page, Panel, panelRouter, type User } from '@navette-js/panels';
import { Color } from '@navette-js/support';
import { UploadStore, WireRuntime } from '@navette-js/wire';
import { sqlite } from '@navette-js/database';
import { CustomerResource } from './resources/CustomerResource.ts';
import { DepartmentResource } from './resources/DepartmentResource.ts';
import { OrderResource } from './resources/OrderResource.ts';
import { ProductResource } from './resources/ProductResource.ts';
import { BrandResource } from './resources/BrandResource.ts';
import { EmployeeResource } from './resources/EmployeeResource.ts';
import { CategoryResource } from './resources/CategoryResource.ts';
import { LeaveRequestResource } from './resources/LeaveRequestResource.ts';
import { ExpenseResource } from './resources/ExpenseResource.ts';
import { ProjectResource } from './resources/ProjectResource.ts';
import { AuthorResource, PostCategoryResource } from './resources/BlogResources.ts';
import { PostResource } from './resources/PostResource.ts';
import { TaskResource } from './resources/TaskResource.ts';
import { TimesheetResource } from './resources/TimesheetResource.ts';
import { calendarWidgets, hrWidgets } from './widgets/hr.ts';
import { calendarPages } from './pages/calendar.ts';
import { appPanel, demoAuthProvider } from './app-panel.ts';
import { labPanel } from './lab-panel.ts';
import { shopWidgets } from './widgets/shop.ts';
import { welcomeWidgets } from './widgets/welcome.ts';
import { STATUSES } from './resources/OrderResource.ts';
import { DatePicker, FileUpload, LocalFileStorage, Select } from '@navette-js/forms';
import { Section, type Schema } from '@navette-js/schemas';
import { Model } from '@navette-js/database';

const file = (p: string) => fileURLToPath(new URL(p, import.meta.url));
// Demo accounts, from a local fixture.
const users: (User & { password: string })[] = JSON.parse(readFileSync(file('./fixtures/users.json'), 'utf8'));
const key = process.env.APP_KEY ?? 'cle-de-developpement-a-remplacer';
// NAVETTE_DB points to another database (end-to-end runs use a disposable copy).
// On first run, the working database is copied from seed.sqlite, which is never modified.
if (!process.env.NAVETTE_DB && !existsSync(file('./database/database.sqlite'))) copyFileSync(file('./database/seed.sqlite'), file('./database/database.sqlite'));
sqlite(process.env.NAVETTE_DB ?? file('./database/database.sqlite'));
// Multi-factor authentication storage (authenticator app columns, security keys table), added to the working database.
await multiFactorAuthenticationSchema(Model.knex());

const accounts = demoAuthProvider(users[0]);

/** Login form prefilled with the demo account. */
class DemoLogin extends Login {
    mount(): void {
        super.mount();
        Object.assign(this.data, { email: users[0].email, password: users[0].password, remember: true });
    }
}

class DemoDashboard extends Dashboard {
    static navigationLabel = 'Welcome';
    getHeading(): string { return 'Welcome to the Navette Demo!'; }
    getWidgets() { return welcomeWidgets; }
}
/** Date range, status and category filters, passed to every widget. */
class ShopDashboard extends Dashboard {
    static slug = 'shop';
    static title = 'Shop Dashboard';
    static navigationIcon = 'o-shopping-cart';
    static navigationSort = -1;
    filtersFormSchema(schema: Schema): Schema {
        return schema.components([
            Section.make().schema([
                DatePicker.make('startDate').maxDate(({ get }) => (get('endDate') as string) || 'today'),
                DatePicker.make('endDate').minDate(({ get }) => (get('startDate') as string) || 'today').maxDate('today'),
                Select.make('orderStatuses').label('Order status').options(Object.entries(STATUSES).map(([value, status]): [string, string] => [value, status.label])).multiple().searchable(),
                Select.make('productCategory').label('Product category').searchable()
                    .options(async () => (await Model.knex()('product_categories').select('id', 'name')).map((category: any): [string, string] => [String(category.id), category.name]), { searchOnServer: false }),
            ]).columns({ md: 2, xl: 4 }).columnSpanFull(),
        ]);
    }
    getWidgets() { return shopWidgets; }
}
class HrDashboard extends Dashboard {
    static slug = 'hr';
    static title = 'HR Dashboard';
    static navigationIcon = 'o-briefcase';
    static navigationSort = 0;
    getWidgets() { return hrWidgets; }
}
/** Placeholder page for screens that are not built yet. */
const pending = (slug: string, title: string, icon: string, group: string | null, sort = 0, badge: number | null = null): typeof Page => class extends Page {
    static navigationBadge = badge;
    static slug = slug;
    static title = title;
    static navigationIcon = icon;
    static navigationGroup = group;
    static navigationSort = sort;
};

const panel = Panel.make()
    .id('admin')
    .key(key)
    .topbar(false)
    .spa()
    .brandName('Navette Demo')
    .brandLogo('/images/logo/navette-light.svg')
    .darkModeBrandLogo('/images/logo/navette-dark.svg')
    .favicon('/images/logo/navette-icon.svg')
    // Tailwind theme built by `npm run build:theme -w @navette-js/demo`; without it, the default stylesheet is served.
    .theme(existsSync(file('./public/css/theme.css')) ? `/css/theme.css?v=${statSync(file('./public/css/theme.css')).mtimeMs.toFixed(0)}` : null)
    .setColors({ primary: Color.Blue })
    // Preset themes offered in the user menu. NAVETTE_NO_THEMES turns them off for screenshot comparisons.
    .themes(process.env.NAVETTE_NO_THEMES ? [] : [
        { id: 'navette', label: 'Navette', colors: { primary: Color.Blue } },
        { id: 'alpage', label: 'Meadow', colors: { primary: Color.Emerald, gray: Color.Stone } },
        { id: 'glacier', label: 'Glacier', colors: { primary: Color.Cyan, gray: Color.Slate } },
        { id: 'crepuscule', label: 'Dusk', colors: { primary: Color.Violet, gray: Color.Zinc }, font: { family: 'Outfit' } },
        // A single color is enough: the eleven-shade palette is generated from it.
        { id: 'cuivre', label: 'Copper', colors: { primary: '#b45309', gray: Color.Neutral } },
    ])
    .font('Albert Sans')
    .login(DemoLogin)
    .globalSearchKeyBindings(['command+k', 'ctrl+k'])
    .globalSearchFieldKeyBindingSuffix()
    // Seeded notifications link to absolute URLs on another host: keep only the path.
    .databaseNotifications(knexNotificationStore((table: string) => Model.knex()(table), { mapUrl: (url) => url.replace(/^https?:\/\/[^/]+/, '') || '/' }))
    .navigationGroups(['Shop', 'HR', 'Projects', 'Blog'])
    .pages([
        DemoDashboard,
        ShopDashboard, HrDashboard,
        // Left out with NAVETTE_NO_THEMES so the navigation matches the reference screenshots.
        ...(process.env.NAVETTE_NO_THEMES ? [] : calendarPages),
    ])
    .widgets([...welcomeWidgets, ...shopWidgets, ...hrWidgets, ...calendarWidgets])
    .resources([CustomerResource, DepartmentResource, OrderResource, ProductResource, BrandResource, EmployeeResource, CategoryResource, LeaveRequestResource, ExpenseResource, ProjectResource, TaskResource, TimesheetResource, PostResource, PostCategoryResource, AuthorResource])
    // Same accounts and same session as the `/app` panel; only the demo account (the staff) may enter `/admin`.
    .auth(accounts)
    .canAccess((user) => String(user.id) === String(users[0].id));

// Render hook probe, for end-to-end tests only.
if (process.env.NAVETTE_HOOK_PROBE) panel.plugin((await import('./hook-probe.ts')).hookProbe(CustomerResource));

const app = express();
app.use(express.static(file('./public')));
// Seeded uploads (product images). NAVETTE_STORAGE overrides the default location next to the repository; skipped if missing.
const storage = process.env.NAVETTE_STORAGE ?? file('../../../sources/demo/storage/app/public');
if (existsSync(storage)) app.use('/storage', express.static(storage, { dotfiles: 'deny', index: false }));
// New uploads: the runtime's temporary folder, and the public folder for saved files (`NAVETTE_UPLOADS`, served under /storage).
const uploads = process.env.NAVETTE_UPLOADS ?? file('./storage');
mkdirSync(path.join(uploads, 'public'), { recursive: true });
app.use('/storage', express.static(path.join(uploads, 'public'), { dotfiles: 'deny', index: false }));
// Files saved by upload fields and attached in the editors.
FileUpload.storage = new LocalFileStorage(path.join(uploads, 'public'), '/storage');
ProductResource.mediaRoot = path.join(uploads, 'public');
AuthorResource.exportRoot = path.join(uploads, 'public');
PostResource.mediaRoot = path.join(uploads, 'public');
await PostResource.loadTagNames();
const port = Number(process.env.PORT ?? 3200);
// Second panel (`/app`): its own runtime, hence its own Livewire endpoint. Mounted before the main panel, whose routes have parameters.
const mailLog = process.env.NAVETTE_MAIL_LOG ?? path.join(uploads, 'mail.log');
// Profile page in the full layout, with two-factor authentication (left out for screenshot comparisons).
if (!process.env.NAVETTE_NO_THEMES) panel.profile(EditProfile, false).mailer(fileMailer(mailLog)).multiFactorAuthentication([AppAuthentication.make().recoverable(), EmailAuthentication.make(), SecurityKeyAuthentication.make()]);
const secondPanel = appPanel({ key, login: DemoLogin, auth: accounts, mailLog, appUrl: `http://127.0.0.1:${port}`, profile: !process.env.NAVETTE_NO_THEMES });
if (process.env.NAVETTE_HOOK_PROBE) secondPanel.plugin((await import('./hook-probe.ts')).hookProbe(CustomerResource));
app.use(panelRouter(secondPanel, new WireRuntime({ key, uploads: new UploadStore(path.join(uploads, 'tmp'), key) })));
// Third panel (`/lab`): recent features on the demo data, outside the pages compared with Filament. NAVETTE_NO_LAB turns it off.
if (!process.env.NAVETTE_NO_LAB) app.use(panelRouter(labPanel({ key, login: DemoLogin, auth: accounts, canAccess: (user) => String(user.id) === String(users[0].id) }), new WireRuntime({ key, uploads: new UploadStore(path.join(uploads, 'tmp'), key) })));
app.use(panelRouter(panel, new WireRuntime({ key, uploads: new UploadStore(path.join(uploads, 'tmp'), key) })));
app.listen(port, '127.0.0.1', () => console.log(`Navette demo: http://127.0.0.1:${port}/login`));
