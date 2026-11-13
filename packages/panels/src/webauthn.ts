// WebAuthn (Web Authentication, level 2) relying party: registration and authentication ceremonies for security keys
// and passkeys. No dependency: CBOR and COSE parsing, signature checks with `node:crypto`.
// Attestation statements are not verified (`attestation: 'none'`): the key proves possession, not its make or model.
import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify, type KeyObject } from 'node:crypto';

export class WebAuthnError extends Error {}

const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const fromB64url = (value: unknown, what: string): Buffer => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*={0,2}$/.test(value) || value.length > 100_000) throw new WebAuthnError(`Invalid ${what}.`);
    return Buffer.from(value, 'base64url');
};

// --- CBOR (RFC 8949): the definite-length subset that authenticators produce.
/** Decodes one CBOR item at `offset`; returns it with the offset after it. Maps are returned as `Map`. */
export function decodeCborItem(bytes: Uint8Array, offset = 0, depth = 0): [unknown, number] {
    if (depth > 16) throw new WebAuthnError('CBOR nesting too deep.');
    const need = (count: number) => { if (offset + count > bytes.length) throw new WebAuthnError('Truncated CBOR data.'); };
    need(1);
    const initial = bytes[offset++];
    const major = initial >> 5, info = initial & 31;
    let length: number;
    if (info < 24) length = info;
    else if (info === 24) { need(1); length = bytes[offset]; offset += 1; }
    else if (info === 25) { need(2); length = (bytes[offset] << 8) | bytes[offset + 1]; offset += 2; }
    else if (info === 26) { need(4); length = Buffer.from(bytes.subarray(offset, offset + 4)).readUInt32BE(0); offset += 4; }
    else if (info === 27) {
        need(8);
        const big = Buffer.from(bytes.subarray(offset, offset + 8)).readBigUInt64BE(0);
        offset += 8;
        if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw new WebAuthnError('CBOR integer too large.');
        length = Number(big);
    } else throw new WebAuthnError('Unsupported CBOR encoding.');
    switch (major) {
        case 0: return [length, offset];
        case 1: return [-1 - length, offset];
        case 2: need(length); return [Buffer.from(bytes.subarray(offset, offset + length)), offset + length];
        case 3: need(length); return [Buffer.from(bytes.subarray(offset, offset + length)).toString('utf8'), offset + length];
        case 4: {
            if (length > 10_000) throw new WebAuthnError('CBOR array too long.');
            const items: unknown[] = [];
            for (let i = 0; i < length; i++) { const [item, next] = decodeCborItem(bytes, offset, depth + 1); items.push(item); offset = next; }
            return [items, offset];
        }
        case 5: {
            if (length > 10_000) throw new WebAuthnError('CBOR map too long.');
            const map = new Map<unknown, unknown>();
            for (let i = 0; i < length; i++) {
                const [key, afterKey] = decodeCborItem(bytes, offset, depth + 1);
                const [value, afterValue] = decodeCborItem(bytes, afterKey, depth + 1);
                map.set(key, value);
                offset = afterValue;
            }
            return [map, offset];
        }
        case 6: return decodeCborItem(bytes, offset, depth + 1); // tag: its content
        default: {
            if (info === 20) return [false, offset];
            if (info === 21) return [true, offset];
            if (info === 22 || info === 23) return [null, offset];
            if (info === 25) { const half = length, exponent = (half >> 10) & 31, fraction = half & 1023; const value = exponent === 0 ? fraction * 2 ** -24 : exponent === 31 ? (fraction ? NaN : Infinity) : (fraction + 1024) * 2 ** (exponent - 25); return [half & 0x8000 ? -value : value, offset]; }
            if (info === 26) { const buffer = Buffer.alloc(4); buffer.writeUInt32BE(length); return [buffer.readFloatBE(0), offset]; }
            if (info === 27) throw new WebAuthnError('Unsupported CBOR float.');
            return [length, offset];
        }
    }
}
export const decodeCbor = (bytes: Uint8Array): unknown => decodeCborItem(bytes, 0)[0];

// --- COSE keys (RFC 9053) and signatures.
/** COSE algorithms supported: ES256, EdDSA (Ed25519), ES384, ES512, RS256. */
export const SUPPORTED_ALGORITHMS = [-8, -7, -257, -35, -36] as const;
const EC_CURVES: Record<number, string> = { 1: 'P-256', 2: 'P-384', 3: 'P-521' };

/** Public key of a COSE key map. */
export function coseToPublicKey(cose: Map<unknown, unknown>): { algorithm: number; key: KeyObject } {
    const kty = cose.get(1), algorithm = Number(cose.get(3));
    if (!(SUPPORTED_ALGORITHMS as readonly number[]).includes(algorithm)) throw new WebAuthnError(`Unsupported key algorithm: ${algorithm}.`);
    const bytes = (label: number) => { const value = cose.get(label); if (!Buffer.isBuffer(value)) throw new WebAuthnError('Invalid public key.'); return b64url(value); };
    let jwk: Record<string, string>;
    if (kty === 2 && [-7, -35, -36].includes(algorithm)) {
        const curve = EC_CURVES[Number(cose.get(-1))];
        if (!curve || curve !== { [-7]: 'P-256', [-35]: 'P-384', [-36]: 'P-521' }[algorithm]) throw new WebAuthnError('Invalid elliptic curve.');
        jwk = { kty: 'EC', crv: curve, x: bytes(-2), y: bytes(-3) };
    } else if (kty === 1 && algorithm === -8) {
        if (cose.get(-1) !== 6) throw new WebAuthnError('Only the Ed25519 curve is supported for EdDSA.');
        jwk = { kty: 'OKP', crv: 'Ed25519', x: bytes(-2) };
    } else if (kty === 3 && algorithm === -257) {
        jwk = { kty: 'RSA', n: bytes(-1), e: bytes(-2) };
    } else throw new WebAuthnError('Invalid public key type.');
    try { return { algorithm, key: createPublicKey({ key: jwk as any, format: 'jwk' }) }; } catch { throw new WebAuthnError('Invalid public key.'); }
}
/** Checks an assertion signature with a stored public key (SPKI DER, base64url). */
export function verifySignature(algorithm: number, publicKey: string, data: Buffer, signature: Buffer): boolean {
    const key = createPublicKey({ key: fromB64url(publicKey, 'public key'), format: 'der', type: 'spki' });
    try {
        if (algorithm === -8) return verify(null, data, key, signature);
        if (algorithm === -7) return verify('sha256', data, { key, dsaEncoding: 'der' }, signature);
        if (algorithm === -35) return verify('sha384', data, { key, dsaEncoding: 'der' }, signature);
        if (algorithm === -36) return verify('sha512', data, { key, dsaEncoding: 'der' }, signature);
        if (algorithm === -257) return verify('sha256', data, key, signature);
    } catch { return false; }
    return false;
}

// --- Authenticator data (WebAuthn §6.1).
export type AuthenticatorData = {
    rpIdHash: Buffer; userPresent: boolean; userVerified: boolean; backupEligible: boolean; backedUp: boolean; signCount: number;
    attestedCredential: { aaguid: string; credentialId: Buffer; publicKey: Map<unknown, unknown> } | null;
};
export function parseAuthenticatorData(data: Buffer): AuthenticatorData {
    if (data.length < 37) throw new WebAuthnError('Authenticator data too short.');
    const flags = data[32];
    let offset = 37, attestedCredential: AuthenticatorData['attestedCredential'] = null;
    if (flags & 0x40) {
        if (data.length < offset + 18) throw new WebAuthnError('Attested credential data too short.');
        const aaguid = data.subarray(offset, offset + 16).toString('hex');
        const idLength = data.readUInt16BE(offset + 16);
        offset += 18;
        if (idLength > 1023 || data.length < offset + idLength) throw new WebAuthnError('Invalid credential id.');
        const credentialId = Buffer.from(data.subarray(offset, offset + idLength));
        offset += idLength;
        const [publicKey, next] = decodeCborItem(data, offset);
        if (!(publicKey instanceof Map)) throw new WebAuthnError('Invalid credential public key.');
        offset = next;
        attestedCredential = { aaguid: `${aaguid.slice(0, 8)}-${aaguid.slice(8, 12)}-${aaguid.slice(12, 16)}-${aaguid.slice(16, 20)}-${aaguid.slice(20)}`, credentialId, publicKey };
    }
    if (flags & 0x80) offset = decodeCborItem(data, offset)[1]; // extensions
    if (offset !== data.length) throw new WebAuthnError('Unexpected data after the authenticator data.');
    return { rpIdHash: data.subarray(0, 32), userPresent: Boolean(flags & 0x01), userVerified: Boolean(flags & 0x04), backupEligible: Boolean(flags & 0x08), backedUp: Boolean(flags & 0x10), signCount: data.readUInt32BE(33), attestedCredential };
}

// --- Ceremonies.
export type UserVerification = 'required' | 'preferred' | 'discouraged';
/** What the browser sends after `navigator.credentials.create()` (the credential's `toJSON()`). */
export type RegistrationResponseJSON = { id: string; rawId: string; type: string; response: { clientDataJSON: string; attestationObject: string; transports?: string[] } };
/** What the browser sends after `navigator.credentials.get()`. */
export type AuthenticationResponseJSON = { id: string; rawId: string; type: string; response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle?: string | null } };
export type ExpectedCeremony = {
    /** Challenge sent to the browser (base64url). */
    challenge: string;
    /** Origins allowed (`https://example.com`, with a port if not standard). */
    origin: string | string[];
    /** Relying party id: the domain (`example.com`), without scheme or port. */
    rpId: string;
    /** Require the authenticator to verify the user (PIN, biometrics): `true` for passkeys used without a password. */
    requireUserVerification?: boolean;
};
/** A registered credential, as stored. */
export type StoredCredential = { credentialId: string; publicKey: string; algorithm: number; signCount: number; transports?: string[] };

const sameBytes = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
function checkClientData(raw: Buffer, type: string, expected: ExpectedCeremony): void {
    let clientData: any;
    try { clientData = JSON.parse(raw.toString('utf8')); } catch { throw new WebAuthnError('Invalid client data.'); }
    if (clientData?.type !== type) throw new WebAuthnError('Unexpected ceremony type.');
    if (typeof clientData.challenge !== 'string' || !sameBytes(fromB64url(clientData.challenge, 'challenge'), fromB64url(expected.challenge, 'challenge'))) throw new WebAuthnError('The challenge does not match.');
    const origins = [expected.origin].flat();
    if (!origins.includes(clientData.origin)) throw new WebAuthnError(`Unexpected origin: ${String(clientData.origin)}.`);
    if (clientData.crossOrigin === true) throw new WebAuthnError('Cross-origin ceremonies are not allowed.');
}
function checkAuthenticatorData(data: AuthenticatorData, expected: ExpectedCeremony): void {
    if (!sameBytes(data.rpIdHash, createHash('sha256').update(expected.rpId).digest())) throw new WebAuthnError('The relying party id does not match.');
    if (!data.userPresent) throw new WebAuthnError('The user was not present.');
    if (expected.requireUserVerification && !data.userVerified) throw new WebAuthnError('The user was not verified.');
}

/** Verifies a registration (`navigator.credentials.create()`), and returns the credential to store. Throws `WebAuthnError`. */
export function verifyRegistration(response: unknown, expected: ExpectedCeremony): StoredCredential & { aaguid: string; backedUp: boolean; userVerified: boolean } {
    const body = response as RegistrationResponseJSON;
    if (!body || typeof body !== 'object' || body.type !== 'public-key' || !body.response) throw new WebAuthnError('Invalid credential.');
    checkClientData(fromB64url(body.response.clientDataJSON, 'client data'), 'webauthn.create', expected);
    const attestation = decodeCbor(fromB64url(body.response.attestationObject, 'attestation'));
    if (!(attestation instanceof Map) || !Buffer.isBuffer(attestation.get('authData'))) throw new WebAuthnError('Invalid attestation object.');
    const data = parseAuthenticatorData(attestation.get('authData') as Buffer);
    checkAuthenticatorData(data, expected);
    if (!data.attestedCredential) throw new WebAuthnError('No credential in the attestation.');
    const credentialId = b64url(data.attestedCredential.credentialId);
    if (credentialId !== b64url(fromB64url(body.rawId ?? body.id, 'credential id'))) throw new WebAuthnError('The credential id does not match.');
    const { algorithm, key } = coseToPublicKey(data.attestedCredential.publicKey);
    const transports = Array.isArray(body.response.transports) ? body.response.transports.filter((transport): transport is string => typeof transport === 'string' && /^[a-z-]{1,20}$/.test(transport)).slice(0, 10) : [];
    return {
        credentialId, publicKey: b64url(key.export({ type: 'spki', format: 'der' })), algorithm, signCount: data.signCount, transports,
        aaguid: data.attestedCredential.aaguid, backedUp: data.backedUp, userVerified: data.userVerified,
    };
}

/**
 * Verifies an authentication (`navigator.credentials.get()`) against the stored credential whose id the response carries.
 * Returns the new signature counter, to store. Throws `WebAuthnError`, notably when the counter went backwards (cloned key).
 */
export function verifyAuthentication(response: unknown, expected: ExpectedCeremony & { credential: StoredCredential }): { signCount: number; userVerified: boolean } {
    const body = response as AuthenticationResponseJSON;
    if (!body || typeof body !== 'object' || body.type !== 'public-key' || !body.response) throw new WebAuthnError('Invalid credential.');
    if (b64url(fromB64url(body.rawId ?? body.id, 'credential id')) !== expected.credential.credentialId) throw new WebAuthnError('Unknown credential.');
    const clientDataJSON = fromB64url(body.response.clientDataJSON, 'client data');
    checkClientData(clientDataJSON, 'webauthn.get', expected);
    const authenticatorData = fromB64url(body.response.authenticatorData, 'authenticator data');
    const data = parseAuthenticatorData(authenticatorData);
    checkAuthenticatorData(data, expected);
    const signed = Buffer.concat([authenticatorData, createHash('sha256').update(clientDataJSON).digest()]);
    if (!verifySignature(expected.credential.algorithm, expected.credential.publicKey, signed, fromB64url(body.response.signature, 'signature'))) throw new WebAuthnError('Invalid signature.');
    // A counter that does not increase means two copies of the key exist (§6.1.1); 0 means the authenticator keeps none.
    if ((data.signCount !== 0 || expected.credential.signCount !== 0) && data.signCount <= expected.credential.signCount) throw new WebAuthnError('The signature counter did not increase: this key may have been cloned.');
    return { signCount: data.signCount, userVerified: data.userVerified };
}

/** Random challenge (base64url, 32 bytes). */
export const generateChallenge = (): string => b64url(randomBytes(32));

/** Options for `navigator.credentials.create()`, as JSON (`PublicKeyCredential.parseCreationOptionsFromJSON()`). */
export function registrationOptions(options: {
    rpId: string; rpName: string; userId: string; userName: string; userDisplayName?: string; challenge: string;
    excludeCredentials?: { credentialId: string; transports?: string[] }[]; userVerification?: UserVerification;
    residentKey?: 'required' | 'preferred' | 'discouraged'; authenticatorAttachment?: 'platform' | 'cross-platform' | null; timeout?: number;
}) {
    return {
        rp: { id: options.rpId, name: options.rpName },
        user: { id: b64url(Buffer.from(options.userId)), name: options.userName, displayName: options.userDisplayName ?? options.userName },
        challenge: options.challenge,
        pubKeyCredParams: SUPPORTED_ALGORITHMS.map((alg) => ({ type: 'public-key', alg })),
        timeout: options.timeout ?? 120_000,
        excludeCredentials: (options.excludeCredentials ?? []).map((credential) => ({ type: 'public-key', id: credential.credentialId, ...(credential.transports?.length ? { transports: credential.transports } : {}) })),
        authenticatorSelection: { residentKey: options.residentKey ?? 'discouraged', requireResidentKey: options.residentKey === 'required', userVerification: options.userVerification ?? 'preferred', ...(options.authenticatorAttachment ? { authenticatorAttachment: options.authenticatorAttachment } : {}) },
        attestation: 'none',
    };
}
/** Options for `navigator.credentials.get()`, as JSON (`PublicKeyCredential.parseRequestOptionsFromJSON()`). */
export function authenticationOptions(options: { rpId: string; challenge: string; allowCredentials?: { credentialId: string; transports?: string[] }[]; userVerification?: UserVerification; timeout?: number }) {
    return {
        rpId: options.rpId,
        challenge: options.challenge,
        timeout: options.timeout ?? 120_000,
        allowCredentials: (options.allowCredentials ?? []).map((credential) => ({ type: 'public-key', id: credential.credentialId, ...(credential.transports?.length ? { transports: credential.transports } : {}) })),
        userVerification: options.userVerification ?? 'preferred',
    };
}
