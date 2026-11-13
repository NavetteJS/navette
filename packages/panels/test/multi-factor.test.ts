import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppAuthentication, EmailAuthentication, base32Encode, decryptSecret, encryptSecret, hotp, MemoryCacheStore, Panel, qrCodeMatrix, qrCodeSvg, SecurityKeyAuthentication, totpCode, totpUri, verifyTotp, type AuthProvider, type SecurityKey, type User } from '../src/index.ts';
import { registrationOptions, verifyRegistration } from '../src/webauthn.ts';
import { SoftAuthenticator } from './helpers/authenticator.ts';

const user: User = { id: 7, name: 'Ada', email: 'ada@example.com' };
/** Auth provider keeping multi-factor data in memory. */
function memoryAuth(): AuthProvider & { secret: string | null; codes: string[] | null; keys: SecurityKey[]; email: boolean } {
    const state = {
        secret: null as string | null, codes: null as string[] | null, keys: [] as SecurityKey[], update: async () => user,
        attempt: async () => user, find: async () => user,
        getAppAuthenticationSecret: async () => state.secret,
        saveAppAuthenticationSecret: async (_user: User, secret: string | null) => { state.secret = secret; },
        getAppAuthenticationRecoveryCodes: async () => state.codes,
        saveAppAuthenticationRecoveryCodes: async (_user: User, codes: string[] | null) => { state.codes = codes; },
        email: false, hasEmailAuthentication: async () => state.email, saveEmailAuthentication: async (_user: User, enabled: boolean) => { state.email = enabled; },
        getSecurityKeys: async () => state.keys,
        createSecurityKey: async (_user: User, key: Omit<SecurityKey, 'id' | 'createdAt' | 'lastUsedAt'>) => { state.keys.push({ ...key, id: state.keys.length + 1, createdAt: null, lastUsedAt: null }); },
        updateSecurityKey: async (_user: User, id: SecurityKey['id'], changes: { signCount?: number; lastUsedAt?: string }) => { const key = state.keys.find((candidate) => candidate.id === id)!; if (changes.signCount !== undefined) key.signCount = changes.signCount; if (changes.lastUsedAt) key.lastUsedAt = changes.lastUsedAt; },
        deleteSecurityKey: async (_user: User, id: SecurityKey['id']) => { state.keys = state.keys.filter((key) => key.id !== id); },
    };
    return state;
}

test('TOTP: RFC 6238 vectors, drift window, single use, otpauth URI', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    assert.equal(totpCode(secret, { at: 59_000, digits: 8 }), '94287082');
    assert.equal(totpCode(secret, { at: 1_111_111_109_000, digits: 8 }), '07081804');
    assert.equal(hotp(secret, 1), '287082');
    const at = 1_700_000_000_000, step = Math.floor(at / 30_000);
    const previous = hotp(secret, step - 1);
    assert.equal(verifyTotp(secret, previous, { at }), step - 1, 'one step of drift is accepted');
    assert.equal(verifyTotp(secret, previous, { at, window: 0 }), null);
    assert.equal(verifyTotp(secret, previous, { at, after: step - 1 }), null, 'a used step and earlier ones are refused');
    assert.equal(verifyTotp(secret, 'abc', { at }), null);
    assert.equal(totpUri('ABC', 'ada@example.com', 'My App'), 'otpauth://totp/My%20App:ada%40example.com?secret=ABC&issuer=My%20App');
});

test('QR codes: sizes by version, finder patterns, SVG output', () => {
    const small = qrCodeMatrix('hello');
    assert.equal(small.length, 21);
    // Top-left finder pattern: dark ring, light ring, dark 3×3 center.
    assert.deepEqual(small[0].slice(0, 7), [true, true, true, true, true, true, true]);
    assert.deepEqual(small[1].slice(0, 7), [true, false, false, false, false, false, true]);
    assert.deepEqual(small[3].slice(0, 7), [true, false, true, true, true, false, true]);
    assert.equal(qrCodeMatrix('x'.repeat(200)).length, 4 * 10 + 17);
    assert.throws(() => qrCodeMatrix('x'.repeat(3000)), /too long/);
    const svg = qrCodeSvg('hello', { title: 'Scan <me>' });
    assert.match(svg, /^<svg [^>]*viewBox="0 0 29 29"/);
    assert.match(svg, /<title>Scan &#60;me&#62;<\/title>/);
});

test('app authentication: encrypted secret, codes used once, recovery codes hashed and used once', async () => {
    const auth = memoryAuth();
    const panel = Panel.make().id('mfa').key('test-key').auth(auth);
    const app = AppAuthentication.make().recoverable().cacheStore(new MemoryCacheStore());
    assert.equal(await app.isEnabled(user, panel), false);
    const secret = app.generateSecret();
    await app.saveSecret(user, panel, secret);
    assert.match(auth.secret!, /^enc:v1:/);
    assert.equal(await app.getSecret(user, panel), secret);
    assert.equal(decryptSecret(Panel.make().id('other').key('another-key'), auth.secret!), null, 'another key cannot read it');
    assert.equal(decryptSecret(panel, 'PLAINSECRET'), 'PLAINSECRET', 'a secret stored in clear is read as is');
    assert.equal(await app.isEnabled(user, panel), true);

    const code = totpCode(secret);
    assert.equal(await app.verifyCode(code, secret, { preventReuse: true }), true);
    assert.equal(await app.verifyCode(code, secret, { preventReuse: true }), false, 'the same code is refused the second time');
    assert.equal(await app.verifyCode(code, secret), true, 'without replay protection (setup), it is accepted');

    const codes = app.generateRecoveryCodes();
    assert.equal(codes.length, 8);
    assert.match(codes[0], /^[A-Za-z0-9]{10}-[A-Za-z0-9]{10}$/);
    await app.saveRecoveryCodes(user, panel, codes);
    assert.ok(auth.codes!.every((hash) => hash.startsWith('sha256:') && !codes.includes(hash)));
    // Two requests at once with the same code: only one succeeds.
    const results = await Promise.all([app.verifyRecoveryCode(codes[3], user, panel), app.verifyRecoveryCode(codes[3], user, panel)]);
    assert.deepEqual(results.sort(), [false, true]);
    assert.equal(auth.codes!.length, 7);
    assert.equal(await app.verifyRecoveryCode('nope', user, panel), false);
    assert.equal(AppAuthentication.make().recoveryCodeCount(3).generateRecoveryCodesUsing(() => ['a', 'b']).generateRecoveryCodes().length, 2);
});

test('security keys: an assertion answers one challenge only, for its user', async () => {
    const auth = memoryAuth();
    const panel = Panel.make().id('mfa').key('test-key').appUrl('https://admin.example.com').auth(auth);
    const keys = SecurityKeyAuthentication.make().cacheStore(new MemoryCacheStore());
    const req = { protocol: 'http', get: (name: string) => (name === 'host' ? 'admin.example.com' : undefined) };
    const party = keys.getRelyingParty(panel, req);
    assert.deepEqual([party.id, party.origins], ['admin.example.com', ['https://admin.example.com']], 'the scheme of appUrl is used for its host');
    assert.deepEqual(keys.getRelyingParty(panel, { protocol: 'http', get: () => 'localhost:3000' }).origins, ['http://localhost:3000']);

    const authenticator = new SoftAuthenticator();
    const challenge = 'Y2hhbGxlbmdlLWZvci1yZWdpc3RyYXRpb24';
    const credential = verifyRegistration(authenticator.create(registrationOptions({ rpId: party.id, rpName: 'A', userId: '7', userName: user.email, challenge }), party.origins[0]), { challenge, origin: party.origins, rpId: party.id });
    await auth.createSecurityKey!(user, { name: 'Key', ...credential });
    assert.equal(await keys.isEnabled(user, panel), true);

    const [field] = keys.getChallengeFormComponents(user, panel) as any[];
    const options = await field._optionsUsing({ livewire: { _ctx: { req } } });
    assert.deepEqual(options.allowCredentials.map((item: any) => item.id), [credential.credentialId]);
    const assertion = JSON.stringify(authenticator.get(options, party.origins[0]));
    assert.equal(await keys.verifyAssertion(assertion, { ...user, id: 8 }, panel, req), false, 'another user cannot use it');
    assert.equal(await keys.verifyAssertion(assertion, user, panel, req), true);
    assert.equal(auth.keys[0].signCount, 2);
    assert.ok(auth.keys[0].lastUsedAt);
    assert.equal(await keys.verifyAssertion(assertion, user, panel, req), false, 'the challenge was consumed');
});

test('panel: providers, ids, required setup', async () => {
    const auth = memoryAuth();
    assert.throws(() => Panel.make().multiFactorAuthentication([AppAuthentication.make(), AppAuthentication.make()]), /same id/);
    assert.throws(() => Panel.make().multiFactorAuthentication([AppAuthentication.make().id('a b')]), /Invalid/);
    const optional = Panel.make().id('a').auth(auth).multiFactorAuthentication([AppAuthentication.make()]);
    assert.equal(optional.hasMultiFactorAuthentication(), true);
    assert.equal(await optional.mustSetUpMultiFactorAuthentication(user), false);
    const required = Panel.make().id('b').key('k').auth(auth).multiFactorAuthentication([AppAuthentication.make(), SecurityKeyAuthentication.make()], { isRequired: true });
    assert.equal(required.usesSecurityKeys(), true);
    assert.equal(await required.mustSetUpMultiFactorAuthentication(user), true);
    assert.equal(required.getSetUpRequiredMultiFactorAuthenticationUrl(), '/multi-factor-authentication/set-up');
    await AppAuthentication.make().saveSecret(user, required, 'JBSWY3DPEHPK3PXP');
    assert.equal(await required.mustSetUpMultiFactorAuthentication(user), false);
    assert.deepEqual((await required.getMultiFactorChallenge().getEnabledProviders(user)).map((provider) => provider.getId()), ['app']);
});

test('required setup: panel pages redirect to the setup page until a provider is set up', async () => {
    const { default: express } = await import('express');
    const { WireRuntime } = await import('@navette-js/wire');
    const { panelRouter, Dashboard } = await import('../src/index.ts');
    const auth = memoryAuth();
    const panel = Panel.make().id('secure').path('secure').key('secure-key').auth(auth).pages([Dashboard]).profile()
        .multiFactorAuthentication([AppAuthentication.make()], { isRequired: true });
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'secure-key' })));
    const server = app.listen(0);
    try {
        const port = (server.address() as any).port;
        let cookie = '';
        panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, user, false);
        const get = (path: string) => fetch(`http://127.0.0.1:${port}${path}`, { headers: { cookie }, redirect: 'manual' });
        for (const path of ['/secure', '/secure/profile']) {
            const response = await get(path);
            assert.equal(response.status, 302, path);
            assert.equal(response.headers.get('location'), '/secure/multi-factor-authentication/set-up');
        }
        const page = await get('/secure/multi-factor-authentication/set-up');
        assert.equal(page.status, 200);
        const html = await page.text();
        assert.match(html, /Set up two-factor authentication/);
        assert.match(html, /Authenticator app/);
        await AppAuthentication.make().saveSecret(user, panel, 'JBSWY3DPEHPK3PXP');
        assert.equal((await get('/secure')).status, 200);
    } finally {
        server.close();
    }
});

test('email codes: sent through the mailer, valid once, expired after the delay, two sends per minute', async () => {
    const auth = memoryAuth();
    const mails: { to: string; subject: string; lines: string[] }[] = [];
    const panel = Panel.make().id('mail').key('k').auth(auth).mailer({ send: (message) => { mails.push(message); } });
    const email = EmailAuthentication.make().cacheStore(new MemoryCacheStore());
    assert.equal(await email.isEnabled(user, panel), false);
    await email.setEnabled(user, panel, true);
    assert.equal(await email.isEnabled(user, panel), true);
    assert.equal(await email.sendCode(user, panel), true);
    assert.equal(mails[0].to, user.email);
    assert.equal(mails[0].subject, "Here's your sign-in code");
    const code = /(\d{6})/.exec(mails[0].lines[0])![1];
    assert.match(mails[0].lines[1], /4 minutes/);
    assert.equal(await email.verifyCode('000000' === code ? '111111' : '000000', user, panel), false);
    assert.equal(await email.verifyCode(code, { ...user, id: 99 }, panel), false, 'another user cannot use it');
    assert.equal(await email.verifyCode(code, user, panel), true);
    assert.equal(await email.verifyCode(code, user, panel), false, 'a code works once');
    assert.equal(await email.sendCode(user, panel), true);
    assert.equal(await email.sendCode(user, panel), false, 'two codes per minute at most');
    const expiring = EmailAuthentication.make().cacheStore(new MemoryCacheStore()).codeExpiryMinutes(1).generateCodeUsing(() => '424242');
    const sent: string[] = [];
    expiring.sendCodeUsing((_user, value) => { sent.push(value); });
    await expiring.sendCode(user, panel);
    assert.deepEqual(sent, ['424242']);
    const realNow = Date.now;
    Date.now = () => realNow() + 61_000;
    try { assert.equal(await expiring.verifyCode('424242', user, panel), false, 'expired'); } finally { Date.now = realNow; }
});
