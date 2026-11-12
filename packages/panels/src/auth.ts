// Authentication building blocks: password hashing, signed tokens (password reset, email verification),
// mailers, and ready-made knex providers (users, tenants).
import { appendFileSync } from 'node:fs';
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import type { AuthProvider, TenantProvider, User } from './index.ts';

const SCRYPT_COST = { N: 16384, r: 8, p: 1 };
const scrypt = (password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number }): Promise<Buffer> =>
    new Promise((resolve, reject) => scryptCallback(password, salt, length, { ...options, maxmem: 256 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key))));

/** Hashes a password with scrypt and a random salt: `$scrypt$N$r$p$salt$hash`. */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, 32, SCRYPT_COST);
    return `$scrypt$${SCRYPT_COST.N}$${SCRYPT_COST.r}$${SCRYPT_COST.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}
/** Checks a password against a `hashPassword` hash in constant time. Any other hash format is rejected. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
    const parts = String(stored ?? '').split('$');
    if (parts.length !== 7 || parts[1] !== 'scrypt') return false;
    const [N, r, p] = parts.slice(2, 5).map(Number);
    // Bounded parameters: a forged hash cannot make the server work indefinitely.
    if (![N, r, p].every(Number.isInteger) || N < 2 || N > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;
    const expected = Buffer.from(parts[6], 'base64url');
    if (expected.length < 16 || expected.length > 64) return false;
    const actual = await scrypt(password, Buffer.from(parts[5], 'base64url'), expected.length, { N, r, p });
    return timingSafeEqual(expected, actual);
}
/** Verified when the email is unknown, so the response takes the same time (no user enumeration by timing). */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<void> { await verifyPassword(password, await (dummyHash ??= hashPassword(randomBytes(16).toString('hex')))); }

const sign = (key: string, value: string) => createHmac('sha256', key).update(value).digest('base64url');
const sameText = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
/** Signed, expiring token: `payload.signature`. `purpose` prevents reusing a token for another use. */
export function signToken(key: string, purpose: string, payload: Record<string, unknown>, ttlSeconds: number): string {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
    return `${body}.${sign(key, `${purpose}.${body}`)}`;
}
/** Payload of a valid, unexpired token, otherwise `null`. */
export function readToken(key: string, purpose: string, token: unknown): Record<string, unknown> | null {
    if (typeof token !== 'string' || token.length > 2000) return null;
    const [body, mac] = token.split('.');
    if (!body || !mac || !sameText(mac, sign(key, `${purpose}.${body}`))) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        return typeof payload === 'object' && payload && Number(payload.exp) > Date.now() / 1000 ? payload : null;
    } catch { return null; }
}
/** Short fingerprint of a secret (the stored password hash): a token embedding it dies when the secret changes. */
export const fingerprint = (value: unknown): string => createHash('sha256').update(String(value ?? '')).digest('base64url').slice(0, 22);
/** Signs an expiring email verification URL. */
export function signVerificationUrl(key: string, id: string | number, email: string, expires: number): { hash: string; signature: string } {
    const hash = createHash('sha1').update(email).digest('hex');
    return { hash, signature: sign(key, `verify-email.${id}.${hash}.${expires}`) };
}
export function checkVerificationUrl(key: string, id: string, hash: string, expires: unknown, signature: unknown): boolean {
    const at = Number(expires);
    return Number.isFinite(at) && at > Date.now() / 1000 && typeof signature === 'string' && sameText(signature, sign(key, `verify-email.${id}.${hash}.${at}`));
}

export type MailMessage = { to: string; subject: string; lines: string[]; action?: { label: string; url: string }; outro?: string[] };
/** Sends an email: plug in your own service (SMTP, API…). The text is provided ready to use, as lines. */
export interface Mailer { send(message: MailMessage): void | Promise<void> }
/** Plain-text rendering of a message. */
export const mailText = (message: MailMessage): string => [...message.lines, ...(message.action ? ['', `${message.action.label} : ${message.action.url}`, ''] : []), ...(message.outro ?? [])].join('\n');
/** Default mailer: writes the message to the console (development). */
export const consoleMailer: Mailer = { send(message) { console.log(`[navette:mail] To ${message.to} — ${message.subject}\n${mailText(message)}`); } };
/** Appends each message to a file as one JSON line (tests, demos). */
export const fileMailer = (file: string): Mailer => ({ send(message) { appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...message }) + '\n'); } });

/** Table accessor: `(table) => knex(table)`. */
export type TableQuery = (table: string) => any;
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/**
 * Users stored in a `users` table (id, name, email, password, email_verified_at).
 * Passwords are hashed with `hashPassword` (scrypt). To accept other hash formats (bcrypt…), pass
 * `verify(password, hash)`: it is called for any stored hash that is not in scrypt format.
 */
export function knexAuthProvider(db: TableQuery, options: { table?: string; verify?: (password: string, hash: string) => boolean | Promise<boolean> } = {}): AuthProvider {
    const table = options.table ?? 'users';
    const toUser = (row: any): User | null => (row ? { id: row.id, name: row.name, email: row.email, emailVerifiedAt: row.email_verified_at ?? null } : null);
    const byEmail = (email: string) => db(table).where('email', String(email)).first();
    return {
        async attempt(email, password) {
            const row = await byEmail(email);
            if (!row) { await verifyAgainstDummy(password); return null; }
            const stored = String(row.password ?? '');
            const ok = stored.startsWith('$scrypt$') ? await verifyPassword(password, stored) : Boolean(await options.verify?.(password, stored));
            return ok ? toUser(row) : null;
        },
        async find(id) { return toUser(await db(table).where('id', id).first()); },
        async findByEmail(email) { return toUser(await byEmail(email)); },
        async create(data) {
            await db(table).insert({ name: data.name, email: data.email, password: await hashPassword(data.password), created_at: now(), updated_at: now() });
            return toUser(await byEmail(data.email))!;
        },
        async update(user, data) {
            const changes: Record<string, unknown> = { updated_at: now() };
            if (typeof data.name === 'string') changes.name = data.name;
            if (typeof data.email === 'string' && data.email !== user.email) { changes.email = data.email; changes.email_verified_at = null; }
            if (typeof data.password === 'string' && data.password !== '') changes.password = await hashPassword(data.password);
            await db(table).where('id', user.id).update(changes);
            return toUser(await db(table).where('id', user.id).first())!;
        },
        async hasVerifiedEmail(user) { return Boolean((await db(table).where('id', user.id).first())?.email_verified_at); },
        async markEmailAsVerified(user) { await db(table).where('id', user.id).update({ email_verified_at: now(), updated_at: now() }); },
        async getPasswordFingerprint(user) { return fingerprint((await db(table).where('id', user.id).first())?.password); },
    };
}

/**
 * Tenants (teams) stored in a table and linked to users through a pivot table (`teams` and `team_user` by default).
 * `label`: text shown above the tenant name in the menu ("Current team").
 */
export function knexTenantProvider(db: TableQuery, options: { table?: string; pivot?: string; foreignKey?: string; userKey?: string; nameAttribute?: string; label?: string | null } = {}): TenantProvider {
    const table = options.table ?? 'teams', pivot = options.pivot ?? 'team_user';
    const foreignKey = options.foreignKey ?? 'team_id', userKey = options.userKey ?? 'user_id', nameAttribute = options.nameAttribute ?? 'name';
    return {
        async getTenants(user) { return db(table).join(pivot, `${pivot}.${foreignKey}`, `${table}.id`).where(`${pivot}.${userKey}`, user.id).select(`${table}.*`).orderBy(`${table}.id`); },
        async find(key) { return /^\d+$/.test(String(key)) ? (await db(table).where('id', Number(key)).first()) ?? null : null; },
        async canAccess(user, tenant) { return Boolean(await db(pivot).where({ [userKey]: user.id, [foreignKey]: (tenant as any).id }).first()); },
        getKey: (tenant) => String((tenant as any).id),
        getName: (tenant) => String((tenant as any)[nameAttribute] ?? ''),
        getCurrentTenantLabel: () => options.label ?? null,
        async create(data, user) {
            const [id] = await db(table).insert({ ...data, created_at: now(), updated_at: now() });
            const tenantId = typeof id === 'object' ? (id as any).id : id;
            await db(pivot).insert({ [foreignKey]: tenantId, [userKey]: user.id, created_at: now(), updated_at: now() });
            return db(table).where('id', tenantId).first();
        },
        async update(tenant, data) {
            await db(table).where('id', (tenant as any).id).update({ ...data, updated_at: now() });
            return db(table).where('id', (tenant as any).id).first();
        },
    };
}
