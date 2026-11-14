import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { Dashboard, DatabaseNotifications, MemoryBroadcaster, Notification, Notifications, Panel, panelRouter, useBroadcaster, userBroadcastChannel, type AuthProvider, type BroadcastMessage, type DatabaseNotificationStore, type TenantProvider, type User } from '../src/index.ts';
import { getBroadcastHub } from '../src/broadcasting.ts';

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const grace: User = { id: 2, name: 'Grace', email: 'grace@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => [ada, grace].find((user) => String(user.id) === String(id)) ?? null };
type Team = { id: number; name: string; members: number[] };
const teams: Team[] = [{ id: 1, name: 'One', members: [1, 2] }, { id: 2, name: 'Two', members: [2] }];
const teamProvider: TenantProvider<Team> = {
    getTenants: (user) => teams.filter((team) => team.members.includes(Number(user.id))),
    find: (key) => teams.find((team) => String(team.id) === key) ?? null,
    canAccess: (user, team) => team.members.includes(Number(user.id)),
    getKey: (team) => String(team.id),
    getName: (team) => team.name,
};

type Stream = { status: number; events: { id: string; channel: string; event: string; data: any }[]; text: () => string; closed: Promise<void>; next: (count?: number, timeout?: number) => Promise<void>; close: () => void };
/** Opens an SSE stream and collects its events. */
const openStream = (port: number, path: string, headers: Record<string, string>): Promise<Stream> => new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path, headers: { accept: 'text/event-stream', ...headers } }, (res) => {
        let raw = '';
        const events: Stream['events'] = [];
        const waiters: (() => void)[] = [];
        let done!: () => void;
        const closed = new Promise<void>((r) => { done = r; });
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
            raw += chunk;
            let index;
            while ((index = raw.indexOf('\n\n')) !== -1) {
                const block = raw.slice(0, index);
                raw = raw.slice(index + 2);
                const id = /^id: (.*)$/m.exec(block)?.[1];
                const data = /^data: (.*)$/m.exec(block)?.[1];
                if (id && data) events.push({ id, ...JSON.parse(data) });
            }
            for (const waiter of waiters.splice(0)) waiter();
        });
        res.on('end', () => { done(); for (const waiter of waiters.splice(0)) waiter(); });
        res.on('close', () => done());
        let all = '';
        res.on('data', (chunk: string) => { all += chunk; });
        // Events already waited for: `next()` waits for the following ones, even if they arrived before the call.
        let consumed = 0;
        resolve({
            status: res.statusCode ?? 0, events, text: () => all, closed,
            next: (count = 1, timeout = 2000) => new Promise((ok, fail) => {
                const target = (consumed += count);
                const timer = setTimeout(() => fail(new Error(`timed out waiting for ${count} event(s); got ${JSON.stringify(events)}`)), timeout);
                const check = () => { if (events.length >= target) { clearTimeout(timer); ok(); } else waiters.push(check); };
                check();
            }),
            close: () => request.destroy(),
        });
    });
    request.on('error', (error) => { if ((error as any).code !== 'ECONNRESET') reject(error); });
});
const tick = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

const serve = async (panel: Panel, fn: (helpers: { port: number; cookieOf: (user: User) => string; get: (path: string, cookie?: string) => Promise<{ status: number; text: string }> }) => Promise<void>) => {
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    const port = (server.address() as any).port;
    const cookieOf = (user: User) => { let cookie = ''; panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, user, false); return cookie; };
    const get = (path: string, cookie = '') => new Promise<{ status: number; text: string }>((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path, headers: { cookie, 'sec-fetch-dest': 'document' } }, (res) => {
            let text = '';
            res.setEncoding('utf8').on('data', (chunk) => { text += chunk; }).on('end', () => resolve({ status: res.statusCode ?? 0, text }));
        }).on('error', reject);
    });
    try { await fn({ port, cookieOf, get }); } finally { server.closeAllConnections(); server.close(); }
};

test('channels: `<guard>.users.<id>` by default, or the user\'s own `receivesBroadcastNotificationsOn()`', () => {
    assert.equal(userBroadcastChannel(ada), 'web.users.1');
    assert.equal(userBroadcastChannel(7, 'staff'), 'staff.users.7');
    assert.equal(userBroadcastChannel({ id: 3, receivesBroadcastNotificationsOn: () => 'customers.3' }), 'customers.3');
    assert.throws(() => userBroadcastChannel({ id: 'a b' }), /Invalid broadcast channel/);
    assert.equal(Panel.make().id('p').getBroadcastChannel(ada), 'web.users.1');
    assert.equal(Panel.make().id('p').authGuard(null).getBroadcastChannel(ada), 'panel-p.users.1');
    assert.equal(Panel.make().id('p').getBroadcastingUrl(), '/livewire/broadcasting');
    assert.equal(Panel.make().id('p').path('admin').getBroadcastingUrl(), '/admin/livewire/broadcasting');
});

test('the stream refuses guests, cross-site requests and users without access; it is only served with broadcasting()', async () => {
    let allowed = true;
    const panel = Panel.make().id('refuse').key('k').auth(auth).pages([Dashboard]).broadcasting().canAccess((user) => user.id !== 2 || allowed);
    await serve(panel, async ({ port, cookieOf }) => {
        const guest = await openStream(port, '/livewire/broadcasting', {});
        assert.equal(guest.status, 401);
        const crossSite = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada), 'sec-fetch-site': 'cross-site' });
        assert.equal(crossSite.status, 403);
        allowed = false;
        const denied = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(grace) });
        assert.equal(denied.status, 403);
        // A forged session cookie is a guest.
        const forged = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada).replace(/\.[^.]+$/, '.forged') });
        assert.equal(forged.status, 401);
        const ok = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada) });
        assert.equal(ok.status, 200);
        ok.close();
    });
    await serve(Panel.make().id('off').key('k').auth(auth).pages([Dashboard]), async ({ port, cookieOf }) => {
        const stream = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada) });
        assert.notEqual(stream.status, 200);
        stream.close();
    });
});

test('a user never receives another user\'s notification on the stream', async () => {
    const panel = Panel.make().id('own').key('k').auth(auth).pages([Dashboard]).broadcasting();
    await serve(panel, async ({ port, cookieOf }) => {
        const adaStream = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada) });
        const graceStream = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(grace) });
        assert.equal(adaStream.status, 200);
        assert.match(adaStream.headers?.['content-type'] ?? 'text/event-stream', /text\/event-stream/);
        await tick();
        await Notification.make().title('For Ada only').success().broadcast(ada);
        await adaStream.next();
        await Notification.make().title('For Grace').broadcast(2);
        await graceStream.next();
        await tick();
        assert.deepEqual(adaStream.events.map((event) => event.data.title), ['For Ada only']);
        assert.deepEqual(graceStream.events.map((event) => event.data.title), ['For Grace']);
        assert.equal(adaStream.events[0].channel, 'web.users.1');
        assert.equal(adaStream.events[0].event, 'notification.broadcast');
        assert.equal(adaStream.events[0].data.format, 'filament');
        assert.equal(adaStream.events[0].data.status, 'success');
        // Several recipients at once.
        await Notification.make().title('Everyone').broadcast([ada, grace]);
        await Promise.all([adaStream.next(), graceStream.next()]);
        adaStream.close();
        graceStream.close();
    });
});

test('per tenant: a member gets the notifications of the tenant of the page; a non-member is refused', async () => {
    const panel = Panel.make().id('teams').key('k').authGuard('teams').auth(auth).pages([Dashboard]).tenant(teamProvider).broadcasting();
    assert.equal(panel.getBroadcastingUrl(teams[1]), '/livewire/broadcasting?tenant=2');
    await serve(panel, async ({ port, cookieOf }) => {
        const refused = await openStream(port, '/livewire/broadcasting?tenant=2', { cookie: cookieOf(ada) });
        assert.equal(refused.status, 403);
        const unknown = await openStream(port, '/livewire/broadcasting?tenant=99', { cookie: cookieOf(grace) });
        assert.equal(unknown.status, 403);
        const one = await openStream(port, '/livewire/broadcasting?tenant=1', { cookie: cookieOf(grace) });
        const two = await openStream(port, '/livewire/broadcasting?tenant=2', { cookie: cookieOf(grace) });
        assert.equal(one.status, 200);
        await tick();
        await Notification.make().title('Team two').broadcast(grace, { panel, tenant: 2 });
        await two.next();
        await Notification.make().title('Any team').broadcast(grace, { panel });
        await Promise.all([one.next(), two.next()]);
        await tick();
        assert.deepEqual(one.events.map((event) => event.data.title), ['Any team']);
        assert.deepEqual(two.events.map((event) => event.data.title), ['Team two', 'Any team']);
        // The `teams` guard has its own channels: a broadcast for the default guard does not reach them.
        await Notification.make().title('Other guard').broadcast(grace);
        await tick(100);
        assert.equal(one.events.length, 1);
        one.close();
        two.close();
    });
});

test('a notification restricted to another panel is not delivered', async () => {
    const panel = Panel.make().id('first').key('k').auth(auth).pages([Dashboard]).broadcasting();
    await serve(panel, async ({ port, cookieOf }) => {
        const stream = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada) });
        await tick();
        await Notification.make().title('Elsewhere').broadcast(ada, { panel: { getId: () => 'second', getBroadcastChannel: (user) => userBroadcastChannel(user) } });
        await Notification.make().title('Here').broadcast(ada, { panel });
        await stream.next();
        await tick();
        assert.deepEqual(stream.events.map((event) => event.data.title), ['Here']);
        stream.close();
    });
});

test('reconnecting with Last-Event-ID replays the messages missed meanwhile', async () => {
    const panel = Panel.make().id('replay').key('k').auth(auth).pages([Dashboard]).broadcasting();
    await serve(panel, async ({ port, cookieOf }) => {
        const first = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada) });
        await tick();
        await Notification.make().title('Before').broadcast(ada);
        await first.next();
        const lastId = first.events[0].id;
        first.close();
        await first.closed;
        await Notification.make().title('Missed one').broadcast(ada);
        await Notification.make().title('Missed two').broadcast(ada);
        const second = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada), 'last-event-id': lastId });
        await second.next(2);
        assert.deepEqual(second.events.map((event) => event.data.title), ['Missed one', 'Missed two']);
        // An unknown or foreign id replays nothing.
        const third = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada), 'last-event-id': 'abc-1' });
        await tick(100);
        assert.equal(third.events.length, 0);
        assert.match(third.text(), /^retry: 3000/);
        second.close();
        third.close();
    });
    assert.ok(getBroadcastHub().replaySize > 0);
});

test('the stream ends once the user loses access (checked at each heartbeat)', async () => {
    let allowed = true;
    const panel = Panel.make().id('revoke').key('k').auth(auth).pages([Dashboard]).broadcasting(true, { heartbeat: 1000 }).canAccess(() => allowed);
    await serve(panel, async ({ port, cookieOf }) => {
        const stream = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada) });
        assert.equal(stream.status, 200);
        allowed = false;
        await Promise.race([stream.closed, tick(3000).then(() => { throw new Error('the stream stayed open'); })]);
    });
});

test('database notifications: `sendToDatabase(store, user, true)` tells the bell to refresh; the bell does not poll with broadcasting', async () => {
    const stored: unknown[] = [];
    const store: DatabaseNotificationStore = {
        list: async () => [], count: async () => stored.length, unreadCount: async () => stored.length, send: async (_user, notification) => { stored.push(notification); },
        delete: async () => {}, markAsRead: async () => {}, markAllAsRead: async () => {}, clear: async () => {},
    };
    const panel = Panel.make().id('bell').key('k').auth(auth).pages([Dashboard]).databaseNotifications(store).broadcasting();
    await serve(panel, async ({ port, cookieOf, get }) => {
        const stream = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada) });
        await tick();
        await Notification.make().title('Saved').sendToDatabase(store, ada.id);
        await tick(100);
        assert.equal(stream.events.length, 0);
        await Notification.make().title('Saved').sendToDatabase(store, ada, true);
        await stream.next();
        assert.equal(stream.events[0].event, 'database-notifications.sent');
        assert.equal(stored.length, 2);
        stream.close();

        const page = await get('/', cookieOf(ada));
        assert.equal(page.status, 200);
        assert.match(page.text, /navette\/broadcasting\.js/);
        assert.match(page.text, /window\.navetteBroadcasting\.configure\(JSON\.parse\('.*url.*livewire.*broadcasting.*'\)\)/);
        // The flash notifications component listens to the user's channel.
        assert.match(page.text, /setUpFilamentBroadcastNotifications\(\{ \$wire, broadcastChannel: .{1,8}web\.users\.1.{1,8} event: .{1,8}\.notification\.broadcast/);
    });
    const bell = new DatabaseNotifications() as any;
    bell._ctx = { panel, user: ada };
    const html = await bell.render();
    assert.doesNotMatch(html, /wire:poll/);
    assert.match(String(bell._effects.scripts['database-notifications-broadcast']), /database-notifications\.sent/);
    assert.match(String(bell._effects.scripts['database-notifications-broadcast']), /setInterval\(.*30000\)/);
    const polling = new DatabaseNotifications() as any;
    polling._ctx = { panel: Panel.make().id('poll').databaseNotifications(store), user: ada };
    assert.match(await polling.render(), /wire:poll\.30s/);
    assert.equal(polling._effects.scripts, undefined);
});

test('without broadcasting, pages render no stream script', async () => {
    const panel = Panel.make().id('quiet').key('k').auth(auth).pages([Dashboard]);
    await serve(panel, async ({ cookieOf, get }) => {
        const page = await get('/', cookieOf(ada));
        assert.equal(page.status, 200);
        assert.doesNotMatch(page.text, /navetteBroadcasting|setUpFilamentBroadcastNotifications/);
        assert.match(page.text, /window\.filamentData = \[\]/);
    });
});

test('a notification coming back from the browser is rebuilt from checked values', () => {
    const component = new Notifications() as any;
    component.handleBroadcastNotification({ format: 'other', id: 'x', title: 'Ignored' });
    assert.deepEqual(component.notifications, {});
    component.handleBroadcastNotification({
        format: 'filament', id: 'abc', title: '<img src=x onerror=alert(1)>', body: 'Body', status: 'evil" onclick="x', icon: 'not an icon!', iconColor: 'red;', duration: 1e12,
        actions: [{ label: 'Bad', url: 'javascript:alert(1)' }, { label: 'Event', dispatch: { event: 'bad event()' } }, { label: 'Open', url: '/orders/1' }],
    });
    const stored = component.notifications.abc;
    assert.equal(stored.status, null);
    assert.equal(stored.icon, null);
    assert.equal(stored.iconColor, null);
    assert.equal(stored.duration, 86_400_000);
    assert.deepEqual(stored.actions.map((action: any) => action.label), ['Bad', 'Event', 'Open']);
    assert.equal(stored.actions[1].dispatch, null);
    const html = component.render();
    assert.doesNotMatch(html, /<img/);
    assert.doesNotMatch(html, /javascript:/);
    assert.match(html, /href="\/orders\/1"/);
    // An unknown (but well-formed) icon is dropped instead of failing.
    component.handleBroadcastNotification({ format: 'filament', id: 'def', title: 'Icon', icon: 'o-does-not-exist-anywhere' });
    assert.ok(component.notifications.def);
    assert.doesNotThrow(() => component.render());
    const copy = Notification.fromArray(Notification.make().title('Round trip').warning().persistent().getBroadcastMessage()).getData();
    assert.equal(copy.title, 'Round trip');
    assert.equal(copy.status, 'warning');
    assert.equal(copy.duration, 'persistent');
});

test('a custom broadcaster carries the messages (an adapter for several processes)', async () => {
    const published: BroadcastMessage[] = [];
    const memory = new MemoryBroadcaster();
    useBroadcaster({ publish: (message) => { published.push(message); memory.publish(message); }, subscribe: (channel, listener) => memory.subscribe(channel, listener) });
    try {
        const panel = Panel.make().id('adapter').key('k').auth(auth).pages([Dashboard]).broadcasting();
        await serve(panel, async ({ port, cookieOf }) => {
            const stream = await openStream(port, '/livewire/broadcasting', { cookie: cookieOf(ada) });
            await tick();
            await Notification.make().title('Through the adapter').broadcast(ada, { tenant: 'acme' });
            await Notification.make().title('Delivered').broadcast(ada);
            await stream.next();
            assert.deepEqual(stream.events.map((event) => event.data.title), ['Delivered']);
            assert.equal(published[0].channel, 'web.users.1');
            assert.equal(published[0].tenant, 'acme');
            stream.close();
        });
    } finally { useBroadcaster(new MemoryBroadcaster()); }
});
