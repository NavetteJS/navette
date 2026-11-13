// Time-based one-time passwords (RFC 6238, on HOTP: RFC 4226), as used by authenticator apps
// (Google Authenticator, Microsoft Authenticator, 1Password, Authy…). No dependency: HMAC from `node:crypto`.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32, without padding (the format of authenticator app secrets). */
export function base32Encode(bytes: Uint8Array): string {
    let bits = 0, value = 0, output = '';
    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) { output += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
    return output;
}
/** Decodes base32 (case, spaces and padding ignored). Throws on any other character. */
export function base32Decode(text: string): Buffer {
    const clean = text.toUpperCase().replace(/[\s=-]/g, '');
    const bytes: number[] = [];
    let bits = 0, value = 0;
    for (const char of clean) {
        const index = ALPHABET.indexOf(char);
        if (index < 0) throw new Error('Invalid base32 character.');
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return Buffer.from(bytes);
}

export type TotpAlgorithm = 'sha1' | 'sha256' | 'sha512';
export type TotpOptions = {
    /** Seconds per code (30 by default, what every app expects). */
    period?: number;
    /** Code length (6 by default). */
    digits?: number;
    /** HMAC algorithm (`sha1` by default: most apps ignore any other value). */
    algorithm?: TotpAlgorithm;
};
const defaults = (options: TotpOptions = {}) => ({ period: options.period ?? 30, digits: options.digits ?? 6, algorithm: options.algorithm ?? 'sha1' as TotpAlgorithm });

/** Random base32 secret of `bytes` bytes (20 by default: 160 bits, as RFC 4226 recommends). */
export function generateTotpSecret(bytes = 20): string { return base32Encode(randomBytes(bytes)); }

/** HOTP value for a counter. */
export function hotp(secret: string | Uint8Array, counter: number, options: Pick<TotpOptions, 'digits' | 'algorithm'> = {}): string {
    const { digits, algorithm } = defaults(options);
    const key = typeof secret === 'string' ? base32Decode(secret) : Buffer.from(secret);
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const hash = createHmac(algorithm, key).update(message).digest();
    const offset = hash[hash.length - 1] & 15;
    const binary = ((hash[offset] & 127) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
    return String(binary % 10 ** digits).padStart(digits, '0');
}

/** Time step (counter) of a moment: `floor(unix seconds / period)`. */
export const totpTimestep = (at: number = Date.now(), period = 30): number => Math.floor(at / 1000 / period);

/** Current code of a secret (or the code at `at`, in milliseconds). */
export function totpCode(secret: string, options: TotpOptions & { at?: number } = {}): string {
    const { period } = defaults(options);
    return hotp(secret, totpTimestep(options.at, period), options);
}

/**
 * Checks a code against the secret, accepting `window` time steps before and after the current one (clock drift).
 * Returns the matched time step, or `null`. Pass the last accepted step as `after` to refuse a code that was already
 * used, or any older one (RFC 6238 §5.2): store the returned step and pass it next time.
 */
export function verifyTotp(secret: string, code: unknown, options: TotpOptions & { window?: number; at?: number; after?: number | null } = {}): number | null {
    const { period, digits } = defaults(options);
    const value = String(code ?? '').replace(/\s/g, '');
    if (!new RegExp(`^\\d{${digits}}$`).test(value)) return null;
    let key: Buffer;
    try { key = base32Decode(secret); } catch { return null; }
    if (!key.length) return null;
    const current = totpTimestep(options.at, period);
    const window = Math.max(0, Math.min(10, Math.floor(options.window ?? 1)));
    let matched: number | null = null;
    // Every candidate is computed and compared in constant time, so the response time does not reveal which step matched.
    for (let step = current - window; step <= current + window; step++) {
        const candidate = Buffer.from(hotp(key, step, options));
        if (timingSafeEqual(candidate, Buffer.from(value)) && matched === null && (options.after === null || options.after === undefined || step > options.after)) matched = step;
    }
    return matched;
}

/**
 * `otpauth://` URI to show as a QR code: `issuer` is the application name, `account` the user's (their email).
 * See https://github.com/google/google-authenticator/wiki/Key-Uri-Format.
 */
export function totpUri(secret: string, account: string, issuer: string, options: TotpOptions = {}): string {
    const { period, digits, algorithm } = defaults(options);
    const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
    const params = new URLSearchParams({ secret, issuer });
    if (algorithm !== 'sha1') params.set('algorithm', algorithm.toUpperCase());
    if (digits !== 6) params.set('digits', String(digits));
    if (period !== 30) params.set('period', String(period));
    return `otpauth://totp/${label}?${params.toString().replace(/\+/g, '%20')}`;
}
