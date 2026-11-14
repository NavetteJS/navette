import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { Dashboard, Notification, Page, Panel, panelRouter, type AuthProvider, type User } from '../src/index.ts';

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => (String(id) === '1' ? ada : null) };

class Welcome extends Page {
    static slug = 'welcome';
    async mount(): Promise<void> { Notification.make().title('Welcome back').success().send(); }
}
class Moved extends Page {
    static slug = 'moved';
    async mount(): Promise<void> {
        Notification.make().title('This page has moved').warning().send();
        this.redirect('/admin');
    }
}

test('a notification sent from mount() is shown on the page being rendered, or on the next one after a redirect', async () => {
    const panel = Panel.make().id('admin').path('admin').key('mount-key').authGuard('mount').auth(auth).pages([Dashboard, Welcome, Moved]);
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    let cookie = '';
    panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
    // The browser keeps its cookies: the CSRF token names its notification mailbox.
    const jar = new Map<string, string>();
    const get = async (path: string, headers: Record<string, string> = {}) => {
        const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`, { headers: { cookie: [cookie, ...[...jar].map(([name, value]) => `${name}=${value}`)].join('; '), accept: 'text/html', 'sec-fetch-dest': 'document', ...headers }, redirect: 'manual' });
        for (const line of response.headers.getSetCookie()) { const [pair] = line.split(';'); const at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
        return response;
    };
    try {
        const page = await get('/admin/welcome');
        assert.equal(page.status, 200);
        assert.match(await page.text(), /Welcome back/);
        // SPA navigation renders the page too: its notifications come with it.
        const navigated = await get('/admin/welcome', { 'x-livewire-navigate': '1', 'sec-fetch-dest': 'empty' });
        assert.match(await navigated.text(), /Welcome back/);
        // Shown once: not left in the browser's mailbox for the next page.
        assert.doesNotMatch(await (await get('/admin')).text(), /Welcome back/);

        const moved = await get('/admin/moved');
        assert.equal(moved.status, 302);
        const next = await get('/admin');
        assert.match(await next.text(), /This page has moved/);
    } finally { server.close(); }
});
