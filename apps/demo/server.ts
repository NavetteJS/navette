// App de démo Navette : reprend la configuration du panel `admin` de filamentphp/demo pour comparaison avec l'oracle.
import express from 'express';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Dashboard, knexNotificationStore, Login, NavigationItem, Page, Panel, panelRouter, type User } from '@navette/panels';
import { Color } from '@navette/support';
import { UploadStore, WireRuntime } from '@navette/wire';
import { sqlite } from '@navette/database';
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
import { appPanel } from './app-panel.ts';
import { shopWidgets } from './widgets/shop.ts';
import { welcomeWidgets } from './widgets/welcome.ts';
import { STATUSES } from './resources/OrderResource.ts';
import { DatePicker, Select } from '@navette/forms';
import { Section, type Schema } from '@navette/schemas';
import { Model } from '@navette/database';

const file = (p: string) => fileURLToPath(new URL(p, import.meta.url));
// Utilisateurs de test (fixture locale) : remplacés par l'adaptateur de données au jalon 2.
const users: (User & { password: string })[] = JSON.parse(readFileSync(file('./fixtures/users.json'), 'utf8'));
const key = process.env.APP_KEY ?? 'cle-de-developpement-a-remplacer';
// Base SQLite : copie de celle de la démo Filament (mêmes données que l'oracle).
// NAVETTE_DB : base alternative (les parcours de test tournent sur une copie jetable).
// Premier lancement : la base de travail est une copie de seed.sqlite (données de la démo Filament), jamais modifiée elle-même.
if (!process.env.NAVETTE_DB && !existsSync(file('./database/database.sqlite'))) copyFileSync(file('./database/seed.sqlite'), file('./database/database.sqlite'));
sqlite(process.env.NAVETTE_DB ?? file('./database/database.sqlite'));

/** Comme App\Filament\Pages\Auth\Login de la démo : formulaire prérempli avec le compte de démonstration. */
class DemoLogin extends Login {
    mount(): void {
        super.mount();
        Object.assign(this.data, { email: users[0].email, password: users[0].password, remember: true });
    }
}

/** Comme App\Filament\Pages\Dashboard de la démo. */
class DemoDashboard extends Dashboard {
    static navigationLabel = 'Welcome';
    getHeading(): string { return 'Welcome to the Navette Demo!'; }
    getWidgets() { return welcomeWidgets; }
}
/** Comme App\Filament\Pages\ShopDashboard de la démo : filtres de période, de statut et de catégorie, passés à tous les widgets. */
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
/** Comme App\Filament\Pages\HrDashboard de la démo. */
class HrDashboard extends Dashboard {
    static slug = 'hr';
    static title = 'HR Dashboard';
    static navigationIcon = 'o-briefcase';
    static navigationSort = 0;
    getWidgets() { return hrWidgets; }
}
/** Page d'attente pour les écrans de la démo Filament qui ne sont pas encore portés. */
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
    // Comme le panel `admin` de la démo Filament : pas de barre du haut, navigation sans rechargement.
    .topbar(false)
    .spa()
    .brandName('Navette Demo')
    .brandLogo('/images/logo/navette-light.svg')
    .darkModeBrandLogo('/images/logo/navette-dark.svg')
    .favicon('/images/logo/navette-icon.svg')
    // Thème Tailwind compilé par `npm run build:theme -w @navette/demo` ; sans le fichier, la feuille par défaut de Filament est servie.
    .theme(existsSync(file('./public/css/theme.css')) ? `/css/theme.css?v=${statSync(file('./public/css/theme.css')).mtimeMs.toFixed(0)}` : null)
    .setColors({ primary: Color.Blue })
    // Thèmes prédéfinis proposés dans le menu utilisateur (désactivés pour les comparaisons avec l'oracle).
    .themes(process.env.NAVETTE_NO_THEMES ? [] : [
        { id: 'navette', label: 'Navette', colors: { primary: Color.Blue } },
        { id: 'alpage', label: 'Alpage', colors: { primary: Color.Emerald, gray: Color.Stone } },
        { id: 'glacier', label: 'Glacier', colors: { primary: Color.Cyan, gray: Color.Slate } },
        { id: 'crepuscule', label: 'Crépuscule', colors: { primary: Color.Violet, gray: Color.Zinc }, font: { family: 'Outfit' } },
        // Une simple couleur suffit : la palette de onze nuances est générée.
        { id: 'cuivre', label: 'Cuivre', colors: { primary: '#b45309', gray: Color.Neutral } },
    ])
    .font('Albert Sans')
    .login(DemoLogin)
    .globalSearchKeyBindings(['command+k', 'ctrl+k'])
    .globalSearchFieldKeyBindingSuffix()
    // Notifications enregistrées par la démo Filament : leurs liens pointent vers son adresse, seul le chemin est gardé.
    .databaseNotifications(knexNotificationStore((table: string) => Model.knex()(table), { mapUrl: (url) => url.replace(/^https?:\/\/[^/]+/, '') || '/' }))
    .navigationGroups(['Shop', 'HR', 'Projects', 'Blog'])
    .pages([
        DemoDashboard,
        ShopDashboard, HrDashboard,
        // Calendrier (propre à Navette) : retiré pour les comparaisons avec l'oracle, dont le menu n'a pas cette entrée.
        ...(process.env.NAVETTE_NO_THEMES ? [] : calendarPages),
    ])
    .widgets([...welcomeWidgets, ...shopWidgets, ...hrWidgets, ...calendarWidgets])
    .resources([CustomerResource, DepartmentResource, OrderResource, ProductResource, BrandResource, EmployeeResource, CategoryResource, LeaveRequestResource, ExpenseResource, ProjectResource, TaskResource, TimesheetResource, PostResource, PostCategoryResource, AuthorResource])
    .auth({
        attempt: (email, password) => { const u = users.find((x) => x.email === email && x.password === password); return u ? { id: u.id, name: u.name, email: u.email } : null; },
        find: (id) => { const u = users.find((x) => x.id === id); return u ? { id: u.id, name: u.name, email: u.email } : null; },
    });

// Sonde des render hooks : seulement pour le parcours tools/parity/e2e-render-hooks.mjs.
if (process.env.NAVETTE_HOOK_PROBE) panel.plugin((await import('./hook-probe.ts')).hookProbe(CustomerResource));

const app = express();
app.use(express.static(file('./public')));
// Fichiers téléversés (images des produits). Par défaut : le disque public de la démo Filament, s'il est présent à côté du dépôt.
const storage = process.env.NAVETTE_STORAGE ?? file('../../../sources/demo/storage/app/public');
if (existsSync(storage)) app.use('/storage', express.static(storage, { dotfiles: 'deny', index: false }));
// Téléversements : dossier temporaire du runtime, et dossier public des fichiers enregistrés (`NAVETTE_UPLOADS`, servi sous /storage).
const uploads = process.env.NAVETTE_UPLOADS ?? file('./storage');
mkdirSync(path.join(uploads, 'public'), { recursive: true });
app.use('/storage', express.static(path.join(uploads, 'public'), { dotfiles: 'deny', index: false }));
ProductResource.mediaRoot = path.join(uploads, 'public');
AuthorResource.exportRoot = path.join(uploads, 'public');
PostResource.mediaRoot = path.join(uploads, 'public');
await PostResource.loadTagNames();
const port = Number(process.env.PORT ?? 3200);
// Second panel (`/app`) : son propre runtime, donc son propre endpoint Livewire. Monté avant le panel principal, dont les adresses ont des paramètres.
const mailLog = process.env.NAVETTE_MAIL_LOG ?? path.join(uploads, 'mail.log');
const secondPanel = appPanel({ key, login: DemoLogin, demoUser: users[0], mailLog, appUrl: `http://127.0.0.1:${port}`, profile: !process.env.NAVETTE_NO_THEMES });
if (process.env.NAVETTE_HOOK_PROBE) secondPanel.plugin((await import('./hook-probe.ts')).hookProbe(CustomerResource));
app.use(panelRouter(secondPanel, new WireRuntime({ key, uploads: new UploadStore(path.join(uploads, 'tmp'), key) })));
app.use(panelRouter(panel, new WireRuntime({ key, uploads: new UploadStore(path.join(uploads, 'tmp'), key) })));
app.listen(port, '127.0.0.1', () => console.log(`Navette demo : http://127.0.0.1:${port}/login`));
