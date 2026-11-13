import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { hashPassword, knexAuthProvider, knexTenantProvider, Panel, verifyPassword } from '../src/index.ts';
import { readToken, signToken } from '../src/auth.ts';

let db: Knex;
class Project extends Model { static tableName = 'projects'; }
before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('users', (t) => { t.increments('id'); t.string('name'); t.string('email'); t.string('password'); t.string('email_verified_at').nullable(); t.string('created_at'); t.string('updated_at'); });
    await db.schema.createTable('teams', (t) => { t.increments('id'); t.string('name'); t.string('created_at'); t.string('updated_at'); });
    await db.schema.createTable('team_user', (t) => { t.increments('id'); t.integer('team_id'); t.integer('user_id'); t.string('created_at'); t.string('updated_at'); });
    await db.schema.createTable('projects', (t) => { t.increments('id'); t.string('name'); t.integer('team_id'); });
});
after(() => db.destroy());

test('passwords: salted scrypt hash, verification, foreign or forged hashes rejected', async () => {
    const hash = await hashPassword('correct horse');
    assert.match(hash, /^\$scrypt\$16384\$8\$1\$/);
    assert.notEqual(hash, await hashPassword('correct horse'));
    assert.equal(await verifyPassword('correct horse', hash), true);
    assert.equal(await verifyPassword('wrong', hash), false);
    assert.equal(await verifyPassword('x', '$2y$10$abcdefghijklmnopqrstuv'), false);
    // Excessive cost in a forged hash: rejected without computing it.
    assert.equal(await verifyPassword('x', '$scrypt$1073741824$8$1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaA'), false);
});

test('signed tokens: purpose, tampering and expiry', () => {
    const token = signToken('key', 'reset', { uid: 3 }, 60);
    assert.equal(readToken('key', 'reset', token)?.uid, 3);
    assert.equal(readToken('key', 'verify', token), null);
    assert.equal(readToken('other-key', 'reset', token), null);
    const [body, mac] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), uid: 1 })).toString('base64url');
    assert.equal(readToken('key', 'reset', `${forged}.${mac}`), null);
    assert.equal(readToken('key', 'reset', signToken('key', 'reset', { uid: 3 }, -1)), null);
});

test('knex auth provider: create, login, profile, verification, password fingerprint', async () => {
    const auth = knexAuthProvider((table) => db(table));
    const user = await auth.create!({ name: 'Ada', email: 'ada@example.test', password: 'first-password' });
    assert.equal((await auth.attempt('ada@example.test', 'first-password'))?.id, user.id);
    assert.equal(await auth.attempt('ada@example.test', 'nope'), null);
    assert.equal(await auth.attempt('nobody@example.test', 'first-password'), null);
    const before = await auth.getPasswordFingerprint!(user);
    assert.equal(await auth.hasVerifiedEmail!(user), false);
    await auth.markEmailAsVerified!(user);
    assert.equal(await auth.hasVerifiedEmail!(user), true);
    await auth.update!(user, { password: 'second-password' });
    assert.notEqual(await auth.getPasswordFingerprint!(user), before);
    assert.ok(await auth.attempt('ada@example.test', 'second-password'));
    // Changing the email resets its verification.
    const moved = await auth.update!(user, { email: 'ada@new.example.test' });
    assert.equal(await auth.hasVerifiedEmail!(moved), false);
});

test('knex tenant provider: creation and membership, access limited to members', async () => {
    const tenants = knexTenantProvider((table) => db(table), { label: 'Current team' });
    const owner = { id: 1, name: 'Ada', email: 'ada@example.test' };
    const stranger = { id: 2, name: 'Bob', email: 'bob@example.test' };
    const team = await tenants.create!({ name: 'Red' }, owner);
    assert.deepEqual((await tenants.getTenants(owner)).map((t: any) => t.name), ['Red']);
    assert.equal(await tenants.canAccess(owner, team), true);
    assert.equal(await tenants.canAccess(stranger, team), false);
    assert.equal(await tenants.find('abc'), null);
    assert.equal(tenants.getCurrentTenantLabel!(team), 'Current team');
});

test('multi-tenant panel URLs, data scoped per tenant', async () => {
    const panel = Panel.make().id('app').path('app').tenant(knexTenantProvider((table) => db(table)), { ownershipColumn: 'team_id' });
    const red = { id: 7, name: 'Red' }, blue = { id: 8, name: 'Blue' };
    assert.equal(panel.getUrl('settings'), '/app/settings');
    assert.equal(panel.withTenant(red, () => panel.getUrl('settings')), '/app/7/settings');
    assert.equal(panel.withTenant(red, () => panel.getLoginUrl()), '/app/login');
    const adapter = new ObjectionAdapter(Project).scopeToTenant('team_id', () => { const tenant = panel.getTenant(); return tenant ? panel.getTenantUrlKey(tenant) : null; });
    const created = await panel.withTenant(red, () => adapter.create({ name: 'Rocket', team_id: 8 }));
    assert.equal((created as any).team_id, 7, 'the tenant column is enforced');
    await panel.withTenant(blue, () => adapter.create({ name: 'Boat' }));
    assert.deepEqual((await panel.withTenant(red, () => adapter.paginate({ page: 1, perPage: 10 }))).records.map((r: any) => r.name), ['Rocket']);
    assert.equal(await panel.withTenant(blue, () => adapter.find((created as any).id)), null);
    assert.equal(await panel.withTenant(blue, () => adapter.update((created as any).id, { name: 'Stolen' })), null);
    assert.equal((await db('projects').where('id', (created as any).id).first()).name, 'Rocket');
});

test('authentication route slugs can be changed; they are reserved and validated', () => {
    const panel = Panel.make().id('slugs').path('app').loginRouteSlug('sign-in').registrationRouteSlug('sign-up').passwordResetRoutePrefix('forgot').passwordResetRequestRouteSlug('ask').passwordResetRouteSlug('new');
    assert.equal(panel.getLoginUrl(), '/app/sign-in');
    assert.equal(panel.getRegistrationUrl(), '/app/sign-up');
    assert.equal(panel.getRequestPasswordResetUrl(), '/app/forgot/ask');
    assert.ok(panel.getReservedSegments().has('sign-in') && panel.getReservedSegments().has('forgot') && panel.getReservedSegments().has('logout'));
    assert.throws(() => Panel.make().loginRouteSlug('../admin'), /Invalid route slug/);
});
