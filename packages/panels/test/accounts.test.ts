import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { Dashboard, EditProfile, Panel, panelRouter, type AuthProvider, type MailMessage, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

const people: (User & { email_verified?: boolean })[] = [{ id: 1, name: 'Ada', email: 'ada@example.com' }, { id: 2, name: 'Grace', email: 'grace@example.com' }];
const auth: AuthProvider = {
    attempt: async (email, password) => (password === 'secret' ? people.find((user) => user.email === email) ?? null : null),
    find: async (id) => people.find((user) => String(user.id) === String(id)) ?? null,
    findByEmail: async (email) => people.find((user) => user.email === email) ?? null,
    update: async (user, data) => { const row = people.find((candidate) => candidate.id === user.id)!; if (data.email && data.email !== row.email) { row.email = data.email; row.email_verified = false; } if (data.name) row.name = data.name; return row; },
    markEmailAsVerified: async (user) => { people.find((candidate) => candidate.id === user.id)!.email_verified = true; },
};
const serve = async (panel: Panel, fn: (get: (path: string, cookie?: string) => Promise<Response>, cookieOf: (user: User) => string) => Promise<void>) => {
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    try {
        const port = (server.address() as any).port;
        const cookieOf = (user: User) => { let cookie = ''; panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, user, false); return cookie; };
        await fn((path, cookie = '') => fetch(`http://127.0.0.1:${port}${path}`, { headers: { cookie }, redirect: 'manual' }), cookieOf);
    } finally { server.close(); }
};
const pathOf = (url: string) => { const parsed = new URL(url); return parsed.pathname + parsed.search; };

test('auth route slugs: email verification, logout and multi-factor setup can be renamed', () => {
    const panel = Panel.make().id('slugs').logoutRouteSlug('sign-out').emailVerificationRoutePrefix('verify-email').emailVerificationPromptRouteSlug('notice').emailVerificationRouteSlug('confirm')
        .emailChangeVerificationRoutePrefix('change-email').emailChangeVerificationRouteSlug('confirm').multiFactorAuthenticationRoutePrefix('two-factor').setUpRequiredMultiFactorAuthenticationRouteSlug('start');
    assert.equal(panel.getLogoutUrl(), '/sign-out');
    assert.equal(panel.getEmailVerificationPromptUrl(), '/verify-email/notice');
    assert.match(panel.getVerifyEmailUrl(people[0]), /^\/verify-email\/confirm\/1\/[0-9a-f]+\?expires=/);
    assert.equal(panel.getSetUpRequiredMultiFactorAuthenticationUrl(), '/two-factor/start');
    assert.match(panel.getEmailChangeUrls(people[0], 'new@example.com').verify, /^\/change-email\/confirm\?token=/);
    for (const segment of ['sign-out', 'verify-email', 'change-email', 'two-factor']) assert.ok(panel.getReservedSegments().has(segment), segment);
    assert.throws(() => Panel.make().logoutRouteSlug('Bad Slug'), /Invalid route slug/);
});

test('email change verification: the new address is saved only from its link; the old address can block it', async () => {
    const mails: MailMessage[] = [];
    const panel = Panel.make().id('change').path('change').key('change-key').authGuard('change').auth(auth).pages([Dashboard]).profile().emailChangeVerification().mailer({ send: (message) => { mails.push(message); } });
    await serve(panel, async (get, cookieOf) => {
        const profile = new EditProfile() as any;
        profile._id = 'profile';
        profile._ctx = { panel, user: { ...people[0] }, req: { protocol: 'http', get: () => 'example.test' }, res: {}, mailbox: 'change' };
        profile._errors = {};
        await profile.mount();
        profile.data = { ...profile.data, email: 'ada.new@example.com', currentPassword: 'secret' };
        const { pending } = await runInRequest('change', () => profile.save());
        assert.equal(people[0].email, 'ada@example.com', 'not changed yet');
        assert.equal(profile.data.email, 'ada@example.com');
        assert.equal(pending[0].title, 'Email address change request sent');
        assert.deepEqual(mails.map((mail) => mail.to), ['ada.new@example.com', 'ada@example.com']);
        const verify = pathOf(mails[0].action!.url), block = pathOf(mails[1].action!.url);
        // Another user cannot use the link, nor a visitor.
        assert.equal((await get(verify, cookieOf(people[1]))).status, 403);
        assert.match(String((await get(verify)).headers.get('location')), /\/change\/login$/);
        // Blocked from the old address (no sign-in needed): the link stops working.
        assert.equal((await get(block)).status, 302);
        assert.equal((await get(verify, cookieOf(people[0]))).status, 403);
        assert.equal(people[0].email, 'ada@example.com');
        // A new request, confirmed this time.
        mails.length = 0;
        profile.data = { ...profile.data, email: 'ada.new@example.com', currentPassword: 'secret' };
        await runInRequest('change', () => profile.save());
        const confirm = pathOf(mails[0].action!.url);
        assert.equal((await get(confirm, cookieOf(people[0]))).status, 302);
        assert.equal(people[0].email, 'ada.new@example.com');
        assert.equal(people[0].email_verified, true);
        // The link only works once: the old address it was issued for is gone.
        assert.equal((await get(confirm, cookieOf(people[0]))).status, 403);
        // An address taken meanwhile by another account is refused.
        mails.length = 0;
        profile._ctx.user = { ...people[0] };
        profile.data = { ...profile.data, email: 'grace.next@example.com', currentPassword: 'secret' };
        await runInRequest('change', () => profile.save());
        people[1].email = 'grace.next@example.com';
        await get(pathOf(mails[0].action!.url), cookieOf(people[0]));
        assert.equal(people[0].email, 'ada.new@example.com');
    });
});

test('guest access: pages open without signing in, policies decide with a null user', async () => {
    const panel = Panel.make().id('guests').path('guests').key('k').authGuard('guests').auth(auth).pages([Dashboard]).guestAccess();
    assert.equal(await panel.authorize(null, 'view'), true);
    assert.equal(await Panel.make().id('private').authorize(null, 'view'), false);
    await serve(panel, async (get) => {
        const response = await get('/guests');
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /nv-sidebar/);
        assert.doesNotMatch(html, /nv-user-menu/);
    });
    assert.throws(() => panelRouter(Panel.make().id('tenant-guests').path('tg').key('k').authGuard('tg').auth(auth).guestAccess().tenant({ getTenants: async () => [], find: async () => null, canAccess: async () => false, getKey: () => '', getName: () => '' }), new WireRuntime({ key: 'k' })), /not available in a multi-tenant panel/);
});
