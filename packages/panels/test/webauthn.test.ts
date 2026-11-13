import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticationOptions, decodeCbor, generateChallenge, registrationOptions, verifyAuthentication, verifyRegistration, WebAuthnError } from '../src/webauthn.ts';
import { encodeCbor, SoftAuthenticator } from './helpers/authenticator.ts';

const origin = 'https://admin.example.com', rpId = 'example.com';

test('CBOR decoding: integers, strings, arrays, maps, simple values', () => {
    const value = decodeCbor(encodeCbor(new Map<unknown, unknown>([[1, 'one'], [-7, Buffer.from([1, 2])], ['list', [0, 23, 24, 255, 256, 65536, -1, -25]]])));
    assert.ok(value instanceof Map);
    assert.equal(value.get(1), 'one');
    assert.deepEqual(value.get(-7), Buffer.from([1, 2]));
    assert.deepEqual(value.get('list'), [0, 23, 24, 255, 256, 65536, -1, -25]);
    assert.deepEqual(decodeCbor(Buffer.from([0x83, 0xf4, 0xf5, 0xf6])), [false, true, null]);
    assert.throws(() => decodeCbor(Buffer.from([0x5f])), WebAuthnError, 'indefinite lengths are refused');
    assert.throws(() => decodeCbor(Buffer.from([0x45, 1, 2])), /Truncated/);
});

for (const type of ['es256', 'ed25519', 'rs256'] as const) {
    test(`registration then authentication with an ${type} key`, () => {
        const authenticator = new SoftAuthenticator(type);
        const challenge = generateChallenge();
        const options = registrationOptions({ rpId, rpName: 'Admin', userId: '42', userName: 'ada@example.com', challenge });
        assert.equal(options.user.id, Buffer.from('42').toString('base64url'));
        const credential = verifyRegistration(authenticator.create(options, origin), { challenge, origin, rpId });
        assert.equal(credential.credentialId, authenticator.credentialId.toString('base64url'));
        assert.equal(credential.signCount, 1);
        assert.deepEqual(credential.transports, ['usb']);

        const loginChallenge = generateChallenge();
        const request = authenticationOptions({ rpId, challenge: loginChallenge, allowCredentials: [credential] });
        const result = verifyAuthentication(authenticator.get(request, origin), { challenge: loginChallenge, origin, rpId, credential });
        assert.equal(result.signCount, 2);
    });
}

test('registration is refused for another challenge, origin, relying party or ceremony type', () => {
    const authenticator = new SoftAuthenticator();
    const challenge = generateChallenge();
    const options = registrationOptions({ rpId, rpName: 'Admin', userId: '1', userName: 'a', challenge });
    const response = authenticator.create(options, origin);
    assert.throws(() => verifyRegistration(response, { challenge: generateChallenge(), origin, rpId }), /challenge/);
    assert.throws(() => verifyRegistration(response, { challenge, origin: 'https://evil.example', rpId }), /origin/);
    assert.throws(() => verifyRegistration(response, { challenge, origin, rpId: 'other.com' }), /relying party/);
    const assertion = authenticator.get({ challenge, rpId }, origin);
    assert.throws(() => verifyRegistration({ ...assertion, response: { ...assertion.response, attestationObject: '' } }, { challenge, origin, rpId }), /ceremony type/);
    assert.throws(() => verifyRegistration(null, { challenge, origin, rpId }), WebAuthnError);
});

test('authentication is refused for a bad signature, a replayed counter, another key, or a missing user verification', () => {
    const authenticator = new SoftAuthenticator();
    const challenge = generateChallenge();
    const credential = verifyRegistration(authenticator.create(registrationOptions({ rpId, rpName: 'A', userId: '1', userName: 'a', challenge }), origin), { challenge, origin, rpId });
    const login = generateChallenge();
    const response = authenticator.get({ challenge: login, rpId }, origin);
    const tampered = { ...response, response: { ...response.response, signature: Buffer.from('nope').toString('base64url') } };
    assert.throws(() => verifyAuthentication(tampered, { challenge: login, origin, rpId, credential }), /signature/);
    const { signCount } = verifyAuthentication(response, { challenge: login, origin, rpId, credential });
    // The same response again: the counter does not increase.
    assert.throws(() => verifyAuthentication(response, { challenge: login, origin, rpId, credential: { ...credential, signCount } }), /counter/);
    const other = new SoftAuthenticator();
    assert.throws(() => verifyAuthentication(other.get({ challenge: login, rpId }, origin), { challenge: login, origin, rpId, credential }), /Unknown credential/);
    const noVerification = new SoftAuthenticator('es256', { userVerified: false, counter: false });
    const stored = verifyRegistration(noVerification.create(registrationOptions({ rpId, rpName: 'A', userId: '1', userName: 'a', challenge }), origin), { challenge, origin, rpId });
    assert.equal(stored.signCount, 0);
    const answer = noVerification.get({ challenge: login, rpId }, origin);
    assert.throws(() => verifyAuthentication(answer, { challenge: login, origin, rpId, credential: stored, requireUserVerification: true }), /not verified/);
    // An authenticator without a counter (always 0) is accepted.
    assert.equal(verifyAuthentication(answer, { challenge: login, origin, rpId, credential: stored }).signCount, 0);
});
