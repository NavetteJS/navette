import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';
import { configureUsing, views } from '@navette-js/support';
import { addTranslations, setLocale, t } from '@navette-js/support/i18n';
import { WireRuntime } from '@navette-js/wire';
import { getCurrentPanel, Page, PageConfiguration, Panel, PanelPlugin, panelRouter, Resource, ResourceConfiguration, type AuthProvider, type User } from '../src/index.ts';
import { ClockPage, ClockWidget, ClockWidgetPlugin } from '../../../examples/clock-widget/src/index.ts';
import { Heading, headingsStylesheet } from '../../../examples/headings/src/index.ts';

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => (String(id) === '1' ? ada : null) };
class Order extends Model { static tableName = 'orders'; }
let db: Knex;
before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('orders', (table) => { table.increments('id'); table.string('number'); table.boolean('archived'); });
    await db('orders').insert([{ number: 'ORD-1', archived: false }, { number: 'ORD-2', archived: true }, { number: 'ORD-3', archived: false }]);
});
after(() => db.destroy());

/** Serves a panel and returns a signed-in `get()`. */
type Get = (path: string) => Promise<Response>;
type Post = (path: string, body: unknown, cookies: string) => Promise<Response>;
async function serve(panel: Panel, run: (get: Get, post: Post) => Promise<void>): Promise<void> {
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'plugins-test' })));
    const server = app.listen(0);
    let cookie = '';
    panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
    const url = (path: string) => `http://127.0.0.1:${(server.address() as any).port}${path}`;
    try {
        await run(
            (path) => fetch(url(path), { headers: { cookie }, redirect: 'manual' }),
            (path, body, cookies) => fetch(url(path), { method: 'POST', headers: { cookie: [cookie, cookies].filter(Boolean).join('; '), 'content-type': 'application/json' }, body: JSON.stringify(body) }),
        );
    } finally { server.close(); }
}

test('plugins: register() runs in plugin(), boot() once when the router is built; getPlugin() and hasPlugin() find them by id', () => {
    const calls: string[] = [];
    class BlogPlugin extends PanelPlugin {
        protected _authors = false;
        getId(): string { return 'blog'; }
        authorResource(condition = true): this { this._authors = condition; return this; }
        hasAuthorResource(): boolean { return this._authors; }
        register(panel: Panel): void { calls.push(`register:${panel.getId()}:${this._authors}`); }
        boot(panel: Panel): void { calls.push(`boot:${panel.getId()}`); }
    }
    const objectPlugin = { id: 'footer', register: (panel: Panel) => { panel.renderHook('panels::content.end', () => '<p>footer</p>'); } };
    const panel = Panel.make().id('plugins-a').plugin(BlogPlugin.make().authorResource()).plugins([objectPlugin]);
    assert.deepEqual(calls, ['register:plugins-a:true']);
    assert.equal(panel.hasPlugin('blog'), true);
    assert.equal(panel.hasPlugin('missing'), false);
    assert.equal(panel.getPlugin<BlogPlugin>('blog').hasAuthorResource(), true);
    assert.equal(panel.getPlugin('footer'), objectPlugin);
    assert.throws(() => panel.getPlugin('missing'), /Plugin \[missing\] is not registered for panel \[plugins-a\]/);
    assert.throws(() => panel.plugin(BlogPlugin.make()), /Plugin already registered: blog/);
    assert.throws(() => panel.plugin({ register() {} } as any), /needs an identifier/);
    // get(): the instance of the given panel (or of the current request's panel).
    assert.equal(BlogPlugin.get(panel), panel.getPlugin('blog'));
    assert.throws(() => BlogPlugin.get(), /outside a panel request/);
    panelRouter(panel, new WireRuntime({ key: 'k' }));
    assert.deepEqual(calls, ['register:plugins-a:true', 'boot:plugins-a']);
    // make() applies the callbacks registered with configureUsing().
    configureUsing(BlogPlugin, (plugin) => plugin.authorResource(false));
    assert.equal(BlogPlugin.make().hasAuthorResource(), false);
});

test('translations: namespaces from objects or JSON files, nested keys, later additions override, locales fall back to English', () => {
    addTranslations('plugin-test', { en: { posts: { title: 'Posts', form: { title: { label: 'Title' } } } }, fr: { posts: { title: 'Articles' } } });
    assert.equal(t('plugin-test::posts.title'), 'Posts');
    assert.equal(t('plugin-test::posts.form.title.label'), 'Title');
    assert.equal(t('plugin-test::posts.title', {}, 'fr'), 'Articles');
    assert.equal(t('plugin-test::posts.form.title.label', {}, 'fr'), 'Title');
    addTranslations('plugin-test', { en: { posts: { title: 'Blog posts' } } });
    assert.equal(t('plugin-test::posts.title'), 'Blog posts');
    assert.equal(t('plugin-test::posts.form.title.label'), 'Title', 'other keys of the group are kept');
    // The example plugin's translations come from lang/<locale>/<group>.json.
    assert.equal(t('clock-widget::clock-widget.title'), 'Clock');
    assert.equal(t('clock-widget::clock-widget.description', { timezone: 'UTC' }, 'fr'), 'Heure actuelle (UTC)');
    // Navette's own translations may be overridden too.
    const original = t('filament-panels::pages/dashboard.title');
    addTranslations('filament-panels', { en: { 'pages/dashboard': { title: 'Home' } } });
    assert.equal(t('filament-panels::pages/dashboard.title'), 'Home');
    addTranslations('filament-panels', { en: { 'pages/dashboard': { title: original } } });
    assert.throws(() => addTranslations('bad namespace', {}), /Invalid translation namespace/);
    assert.throws(() => addTranslations('__proto__', {}), /Invalid translation namespace/);
    assert.throws(() => addTranslations('plugin-test', JSON.parse('{"__proto__": {"posts": {"x": "y"}}}')), /Invalid locale/);
    assert.equal(({} as any).posts, undefined);
});

test('standalone plugin: the heading component renders its view, escapes its content and only accepts color names', async () => {
    assert.ok(views.resolve('headings::heading').endsWith('heading.ejs'));
    const host: any = { id: 'test', _errors: {}, data: { name: 'Plain' }, getSchema: () => null, dispatch() {}, getActionMountContext: () => ({}) };
    const render = (component: Heading) => Schema.make(host).components([component]).toHtml();
    assert.ok((await render(Heading.make(3).content('<b>Stock</b>').color('success'))).includes('<h3 class="headings-component headings-component-colored" style="--headings-color: var(--success-600); --headings-dark-color: var(--success-400);">&lt;b&gt;Stock&lt;/b&gt;</h3>'));
    // A function receives the schema's context; a color that is not a name is ignored.
    assert.ok((await render(Heading.make().content(({ operation }) => (operation === null ? 'Plain' : 'Other')).color('red;}body{x:y'))).includes('<h2 class="headings-component">Plain</h2>'));
    assert.throws(() => Heading.make(7), /invalid level/);
    assert.match(headingsStylesheet(), /^<style data-navette-headings>[\s\S]*\.headings-component \{/);
});

class OrderConfiguration extends ResourceConfiguration {
    protected _archived = false;
    archived(condition = true): this { this._archived = condition; return this; }
    isArchived(): boolean { return this._archived; }
}
class OrderResource extends Resource {
    static configurationClass = OrderConfiguration;
    static slug = 'orders';
    static modelLabel = 'order';
    static hasViewPage = true;
    static recordTitleAttribute = 'number';
    static adapter = new ObjectionAdapter(Order);
    static table(table: Table): Table {
        const archived = this.getConfiguration()?.isArchived();
        return table.columns([TextColumn.make('number')]).modifyQueryUsing((query) => (archived === undefined ? query : query.where('archived', archived)));
    }
}

test('configurable resources: each registration has its own class, slug, navigation item, URLs and configuration', async () => {
    const panel = Panel.make().id('configurable').key('configurable-key').authGuard('configurable').auth(auth).resources([
        OrderResource,
        OrderResource.make('active').navigationLabel('Active orders').navigationGroup('Orders'),
        OrderResource.make('archived').archived().navigationLabel('Archived orders').navigationGroup('Orders').slug('order-archive'),
    ]);
    const [, active, archived] = panel.getResources();
    assert.equal(active.name, 'OrderResource', 'the generated class keeps the name of the resource');
    assert.ok(active.prototype instanceof OrderResource);
    assert.deepEqual(panel.getResources().map((resource) => resource.slug), ['orders', 'orders/active', 'order-archive']);
    assert.equal(OrderResource.getConfiguration(), null, 'default registration');
    assert.equal(active.getConfiguration()?.getKey(), 'active');
    assert.equal((archived.getConfiguration() as OrderConfiguration).isArchived(), true);
    assert.equal(active.hasConfiguration(), true);
    assert.equal(panel.getResourceConfiguration(OrderResource, 'archived'), archived.getConfiguration());
    assert.deepEqual(panel.getResourceConfigurations().map((configuration) => configuration.getKey()), ['active', 'archived']);
    // Navigation: one item per registration.
    const groups = panel.getNavigation('/orders/active');
    assert.deepEqual(groups.map((group) => [group.label, group.items.map((item) => [item.label, item.url, item.isActive])]), [
        [null, [['Orders', '/orders', false]]],
        ['Orders', [['Active orders', '/orders/active', true], ['Archived orders', '/order-archive', false]]],
    ]);
    // URLs: the active configuration, or the one asked for.
    assert.equal(OrderResource.getUrl(), '/orders');
    assert.equal(OrderResource.getUrl('index', undefined, { configuration: 'active' }), '/orders/active');
    assert.equal(OrderResource.getUrl('edit', 2, { configuration: 'archived' }), '/order-archive/2/edit');
    assert.equal(archived.getUrl('view', 2), '/order-archive/2');
    assert.equal(archived.getUrl('index', undefined, { configuration: null }), '/orders');
    assert.equal(OrderResource.withConfiguration('archived', () => OrderResource.getUrl('create')), '/order-archive/create');
    assert.equal(OrderResource.withConfiguration('archived', () => OrderResource.getConfiguration()?.getKey()), 'archived');
    assert.throws(() => OrderResource.getUrl('index', undefined, { configuration: 'missing' }), /Configuration "missing" not found for OrderResource/);
    assert.throws(() => OrderResource.withConfiguration('missing', () => null), /Configuration "missing" not found/);
    // Mistakes.
    assert.throws(() => panel.resources([OrderResource.make('active')]), /key "active" is already registered on panel "configurable"/);
    assert.throws(() => OrderResource.make('bad key'), /invalid configuration key/);
    class Plain extends Resource { static slug = 'plain'; }
    assert.throws(() => Plain.make('x'), /Resource Plain does not define a configurationClass/);

    await serve(panel, async (get) => {
        const rows = async (path: string) => [...(await (await get(path)).text()).matchAll(/ORD-\d/g)].map((match) => match[0]);
        // Each registration's table uses its configuration; `orders/active` is not taken for the record "active" of the view page.
        assert.deepEqual(await rows('/orders'), ['ORD-1', 'ORD-2', 'ORD-3']);
        assert.deepEqual(await rows('/orders/active'), ['ORD-1', 'ORD-3']);
        assert.deepEqual(await rows('/order-archive'), ['ORD-2']);
        const edit = await (await get('/order-archive/2/edit')).text();
        assert.match(edit, /href="\/order-archive"/, 'breadcrumb of the registration');
        assert.equal((await get('/orders/2')).status, 200, 'the default registration still has its view page');
    });
});

test('configurable resources: two registrations served at the same URL are refused', () => {
    const panel = Panel.make().id('configurable-clash').authGuard('clash').auth(auth).resources([OrderResource, OrderResource.make('main').slug('orders')]);
    assert.throws(() => panelRouter(panel, new WireRuntime({ key: 'k' })), /Two registrations are served at "orders"/);
});

class ReportConfiguration extends PageConfiguration {
    protected _category = 'general';
    category(category: string): this { this._category = category; return this; }
    getCategory(): string { return this._category; }
}
class ReportPage extends Page {
    static configurationClass = ReportConfiguration;
    static slug = 'reports';
    static view = null;
    static callable = [...Page.callable, 'reload'];
    category = '';
    reload(): void { this.category = `${ReportPage.getConfiguration()?.getCategory() ?? 'none'}-updated`; }
    async mount(): Promise<void> {
        // During the page's requests, the class itself resolves to the registration being served.
        this.category = ReportPage.getConfiguration()?.getCategory() ?? 'none';
    }
    protected async renderContent(): Promise<string> { return `<p data-category="${this.category}">${getCurrentPanel()?.getId()}</p>`; }
}

test('configurable pages: registrations with their own slug, title and options, read during their requests', async () => {
    const panel = Panel.make().id('configurable-pages').key('pages-key').authGuard('configurable-pages').auth(auth).pages([
        ReportPage.make('sales').category('sales').title('Sales report'),
        ReportPage.make('stock').category('stock').slug('stock-report').navigationLabel('Stock'),
    ]);
    const [sales, stock] = panel.getPages();
    assert.deepEqual([sales.slug, stock.slug], ['reports/sales', 'stock-report']);
    assert.deepEqual([sales.getTitle(), stock.getTitle(), stock.getNavigationLabel()], ['Sales report', 'Report Page', 'Stock']);
    assert.equal(ReportPage.getUrl({}, { panel, configuration: 'stock' }), '/stock-report');
    assert.equal(ReportPage.getUrl({ tab: 'x y' }, { panel, configuration: 'sales' }), '/reports/sales?tab=x+y');
    assert.equal(panel.getPageConfiguration(ReportPage, 'sales'), sales.getConfiguration());
    assert.throws(() => ReportPage.getUrl(), /outside a panel request/);
    await serve(panel, async (get, post) => {
        const response = await get('/reports/sales');
        const html = await response.text();
        assert.match(html, /<p data-category="sales">configurable-pages<\/p>/);
        assert.match(await (await get('/stock-report')).text(), /<p data-category="stock">/);
        // An update of the page (a call from the browser) runs with the same registration.
        const unescape = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        const snapshot = [...html.matchAll(/wire:snapshot="([^"]+)"/g)].map((match) => unescape(match[1])).find((value) => JSON.parse(value).memo.name.endsWith('pages.reports/sales'));
        assert.ok(snapshot, 'snapshot of the page');
        const token = html.match(/<meta name="csrf-token" content="([^"]+)"/)![1];
        const cookies = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
        const updated = await post('/livewire/update', { _token: token, components: [{ snapshot, updates: {}, calls: [{ method: 'reload', params: [] }] }] }, cookies);
        assert.equal(updated.status, 200);
        assert.ok(JSON.stringify(await updated.json()).includes('sales-updated'));
    });
});

test('example panel plugin: options, its widget on the dashboard and one configured clock page per time zone', async () => {
    const plugin = ClockWidgetPlugin.make().timezone('Europe/Paris').navigationGroup('Clocks').clocks([
        ClockPage.make('tokyo').timezone('Asia/Tokyo').title('Tokyo'),
        ClockPage.make('new-york').timezone('America/New_York').slug('new-york-time'),
        ClockPage.make('nowhere').timezone('Not/AZone'),
    ]);
    const panel = Panel.make().id('clock').key('clock-key').authGuard('clock').auth(auth).plugin(plugin);
    assert.deepEqual(panel.getWidgets(), [ClockWidget]);
    assert.deepEqual(panel.getPages().map((page) => [page.slug, page.navigationGroup]), [['clock/tokyo', 'Clocks'], ['new-york-time', 'Clocks'], ['clock/nowhere', 'Clocks']]);
    assert.equal(ClockWidgetPlugin.get(panel), plugin);
    await serve(panel, async (get) => {
        const tokyo = await (await get('/clock/tokyo')).text();
        assert.match(tokyo, /<title>\s*Tokyo/);
        assert.match(tokyo, /Current time in Asia\/Tokyo/);
        assert.match(tokyo, /data-timezone="Asia\/Tokyo"/);
        assert.match(tokyo, /<p\s+class="clock-widget-time"[\s\S]*?>\d\d:\d\d:\d\d<\/p>/);
        assert.match(await (await get('/new-york-time')).text(), /Current time in America\/New_York/);
        // An unknown time zone falls back to UTC instead of failing.
        assert.match(await (await get('/clock/nowhere')).text(), /Current time in UTC/);
        // The page title comes from the plugin's translations, in the current locale.
        setLocale('fr');
        try { assert.match(await (await get('/clock/nowhere')).text(), /<title>\s*Horloge/); } finally { setLocale('en'); }
    });
});
