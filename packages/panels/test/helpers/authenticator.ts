// Software authenticator for tests: produces WebAuthn responses as a browser and a security key would.
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';

/** Minimal CBOR encoder (unsigned and negative integers, byte and text strings, arrays, maps). */
export function encodeCbor(value: unknown): Buffer {
    const head = (major: number, length: number) => {
        if (length < 24) return Buffer.from([(major << 5) | length]);
        if (length < 256) return Buffer.from([(major << 5) | 24, length]);
        if (length < 65536) { const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(length, 1); return b; }
        const b = Buffer.alloc(5); b[0] = (major << 5) | 26; b.writeUInt32BE(length, 1); return b;
    };
    if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
    if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
    if (typeof value === 'string') { const bytes = Buffer.from(value); return Buffer.concat([head(3, bytes.length), bytes]); }
    if (Array.isArray(value)) return Buffer.concat([head(4, value.length), ...value.map(encodeCbor)]);
    if (value instanceof Map) return Buffer.concat([head(5, value.size), ...[...value].flatMap(([k, v]) => [encodeCbor(k), encodeCbor(v)])]);
    throw new Error('Unsupported value');
}

const b64 = (bytes: Buffer) => bytes.toString('base64url');

export class SoftAuthenticator {
    credentialId = randomBytes(16);
    signCount = 0;
    private privateKey: KeyObject;
    private cose: Map<number, unknown>;
    type: 'es256' | 'ed25519' | 'rs256';
    options: { userVerified?: boolean; counter?: boolean };
    constructor(type: 'es256' | 'ed25519' | 'rs256' = 'es256', options: { userVerified?: boolean; counter?: boolean } = {}) {
        this.type = type;
        this.options = options;
        if (type === 'es256') {
            const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
            const jwk = publicKey.export({ format: 'jwk' }) as any;
            this.privateKey = privateKey;
            this.cose = new Map<number, unknown>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]);
        } else if (type === 'ed25519') {
            const { privateKey, publicKey } = generateKeyPairSync('ed25519');
            const jwk = publicKey.export({ format: 'jwk' }) as any;
            this.privateKey = privateKey;
            this.cose = new Map<number, unknown>([[1, 1], [3, -8], [-1, 6], [-2, Buffer.from(jwk.x, 'base64url')]]);
        } else {
            const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
            const jwk = publicKey.export({ format: 'jwk' }) as any;
            this.privateKey = privateKey;
            this.cose = new Map<number, unknown>([[1, 3], [3, -257], [-1, Buffer.from(jwk.n, 'base64url')], [-2, Buffer.from(jwk.e, 'base64url')]]);
        }
    }
    private authData(rpId: string, attested: boolean): Buffer {
        if (this.options.counter !== false) this.signCount++;
        const flags = 0x01 | (this.options.userVerified === false ? 0 : 0x04) | (attested ? 0x40 : 0);
        const count = Buffer.alloc(4); count.writeUInt32BE(this.options.counter === false ? 0 : this.signCount);
        const parts = [createHash('sha256').update(rpId).digest(), Buffer.from([flags]), count];
        if (attested) {
            const length = Buffer.alloc(2); length.writeUInt16BE(this.credentialId.length);
            parts.push(Buffer.alloc(16), length, this.credentialId, encodeCbor(this.cose));
        }
        return Buffer.concat(parts);
    }
    private clientData(type: string, challenge: string, origin: string): Buffer { return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false })); }
    /** Response to `navigator.credentials.create()`. */
    create(options: { challenge: string; rp: { id: string } }, origin: string) {
        const clientDataJSON = this.clientData('webauthn.create', options.challenge, origin);
        const attestationObject = encodeCbor(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', this.authData(options.rp.id, true)]]));
        return { id: b64(this.credentialId), rawId: b64(this.credentialId), type: 'public-key', response: { clientDataJSON: b64(clientDataJSON), attestationObject: b64(attestationObject), transports: ['usb'] } };
    }
    /** Response to `navigator.credentials.get()`. */
    get(options: { challenge: string; rpId: string }, origin: string) {
        const clientDataJSON = this.clientData('webauthn.get', options.challenge, origin);
        const authenticatorData = this.authData(options.rpId, false);
        const data = Buffer.concat([authenticatorData, createHash('sha256').update(clientDataJSON).digest()]);
        const signature = this.type === 'ed25519' ? sign(null, data, this.privateKey) : sign('sha256', data, this.privateKey);
        return { id: b64(this.credentialId), rawId: b64(this.credentialId), type: 'public-key', response: { clientDataJSON: b64(clientDataJSON), authenticatorData: b64(authenticatorData), signature: b64(signature), userHandle: null } };
    }
}
