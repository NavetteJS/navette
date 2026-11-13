import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WireRuntime } from '@navette-js/wire';
import { Panel, panelRouter, type AuthProvider, type User } from '../src/index.ts';

const provider = (users: User[]): AuthProvider => ({ attempt: () => null, find: (id) => users.find((user) => user.id === id) ?? null });
const staff: User = { id: 1, name: 'Staff', email: 'staff@example.test', role: 'admin' };
const customer: User = { id: 2, name: 'Customer', email: 'customer@example.test', role: 'customer' };

test('panels share one session by default; `authGuard(null)` gives a panel its own', () => {
    assert.equal(Panel.make().id('admin').getSessionCookieName(), 'navette_web_session');
    assert.equal(Panel.make().id('app').getSessionCookieName(), 'navette_web_session');
    assert.equal(Panel.make().id('admin').authGuard('staff').getSessionCookieName(), 'navette_staff_session');
    assert.equal(Panel.make().id('admin').authGuard(null).getSessionCookieName(), 'navette_admin_session');
    assert.throws(() => Panel.make().authGuard('Bad guard'), /Invalid auth guard/);
});

test('`canAccess()` and the provider\'s `canAccessPanel()` must both allow the user', async () => {
    const users = provider([staff, customer]);
    const admin = Panel.make().id('admin').key('k').auth(users).canAccess((user) => user.role === 'admin');
    assert.equal(await admin.userCanAccess(staff), true);
    assert.equal(await admin.userCanAccess(customer), false);
    const withProvider = Panel.make().id('admin2').key('k').auth({ ...users, canAccessPanel: (user, panel) => panel.getId() !== 'admin2' || user.id === 1 });
    assert.equal(await withProvider.userCanAccess(staff), true);
    assert.equal(await withProvider.userCanAccess(customer), false);
    assert.equal(await Panel.make().id('open').key('k').auth(users).userCanAccess(customer), true);
});

test('panels sharing a guard must share the key and the auth provider', () => {
    const users = provider([staff]);
    panelRouter(Panel.make().id('one').path('one').key('same').authGuard('g1').auth(users), new WireRuntime({ key: 'same' }));
    panelRouter(Panel.make().id('two').path('two').key('same').authGuard('g1').auth(users), new WireRuntime({ key: 'same' }));
    assert.throws(() => panelRouter(Panel.make().id('three').path('three').key('other').authGuard('g1').auth(users), new WireRuntime({ key: 'other' })), /same key/);
    // Another user table under the same guard: a user id of one panel would be read as a user of the other.
    assert.throws(() => panelRouter(Panel.make().id('four').path('four').key('same').authGuard('g1').auth(provider([customer])), new WireRuntime({ key: 'same' })), /same auth provider/);
    panelRouter(Panel.make().id('five').path('five').key('other').authGuard(null).auth(provider([customer])), new WireRuntime({ key: 'other' }));
});
