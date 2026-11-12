// Authentification complète : hachage des mots de passe, jetons signés (réinitialisation, vérification de l'adresse),
// envoi des e-mails, et fournisseurs prêts à l'emploi sur une base knex (utilisateurs, locataires).
import { appendFileSync } from 'node:fs';
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import type { AuthProvider, TenantProvider, User } from './index.ts';

// ------------------------------------------------------------------ mots de passe
const SCRYPT_COST = { N: 16384, r: 8, p: 1 };
const scrypt = (password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number }): Promise<Buffer> =>
    new Promise((resolve, reject) => scryptCallback(password, salt, length, { ...options, maxmem: 256 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key))));

/** Empreinte d'un mot de passe (scrypt, sel aléatoire) : `$scrypt$N$r$p$sel$empreinte`. */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, 32, SCRYPT_COST);
    return `$scrypt$${SCRYPT_COST.N}$${SCRYPT_COST.r}$${SCRYPT_COST.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}
/** Compare un mot de passe à une empreinte produite par `hashPassword` (en temps constant). Toute autre empreinte est refusée. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
    const parts = String(stored ?? '').split('$');
    if (parts.length !== 7 || parts[1] !== 'scrypt') return false;
    const [N, r, p] = parts.slice(2, 5).map(Number);
    // Paramètres bornés : une empreinte forgée ne peut pas faire travailler le serveur indéfiniment.
    if (![N, r, p].every(Number.isInteger) || N < 2 || N > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;
    const expected = Buffer.from(parts[6], 'base64url');
    if (expected.length < 16 || expected.length > 64) return false;
    const actual = await scrypt(password, Buffer.from(parts[5], 'base64url'), expected.length, { N, r, p });
    return timingSafeEqual(expected, actual);
}
/** Empreinte de référence : vérifiée quand l'adresse est inconnue, pour que la réponse prenne le même temps. */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<void> { await verifyPassword(password, await (dummyHash ??= hashPassword(randomBytes(16).toString('hex')))); }

// ------------------------------------------------------------------ jetons signés
const sign = (key: string, value: string) => createHmac('sha256', key).update(value).digest('base64url');
const sameText = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
/** Jeton signé à durée de vie limitée : `charge.signature`. `purpose` empêche de réutiliser un jeton pour un autre usage. */
export function signToken(key: string, purpose: string, payload: Record<string, unknown>, ttlSeconds: number): string {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
    return `${body}.${sign(key, `${purpose}.${body}`)}`;
}
/** Charge d'un jeton valide et non expiré, sinon `null`. */
export function readToken(key: string, purpose: string, token: unknown): Record<string, unknown> | null {
    if (typeof token !== 'string' || token.length > 2000) return null;
    const [body, mac] = token.split('.');
    if (!body || !mac || !sameText(mac, sign(key, `${purpose}.${body}`))) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        return typeof payload === 'object' && payload && Number(payload.exp) > Date.now() / 1000 ? payload : null;
    } catch { return null; }
}
/** Empreinte courte d'une valeur secrète (mot de passe enregistré) : un jeton qui la contient meurt quand elle change. */
export const fingerprint = (value: unknown): string => createHash('sha256').update(String(value ?? '')).digest('base64url').slice(0, 22);
/** Signature des adresses de vérification d'e-mail (comme `URL::temporarySignedRoute` de Laravel). */
export function signVerificationUrl(key: string, id: string | number, email: string, expires: number): { hash: string; signature: string } {
    const hash = createHash('sha1').update(email).digest('hex');
    return { hash, signature: sign(key, `verify-email.${id}.${hash}.${expires}`) };
}
export function checkVerificationUrl(key: string, id: string, hash: string, expires: unknown, signature: unknown): boolean {
    const at = Number(expires);
    return Number.isFinite(at) && at > Date.now() / 1000 && typeof signature === 'string' && sameText(signature, sign(key, `verify-email.${id}.${hash}.${at}`));
}

// ------------------------------------------------------------------ e-mails
export type MailMessage = { to: string; subject: string; lines: string[]; action?: { label: string; url: string }; outro?: string[] };
/** Envoi d'un e-mail : branchez votre service (SMTP, API…). Le texte est fourni prêt à l'emploi, en lignes. */
export interface Mailer { send(message: MailMessage): void | Promise<void> }
/** Rendu texte d'un message (comme les notifications « mail » de Laravel). */
export const mailText = (message: MailMessage): string => [...message.lines, ...(message.action ? ['', `${message.action.label} : ${message.action.url}`, ''] : []), ...(message.outro ?? [])].join('\n');
/** Par défaut : le message est écrit dans la console (développement). */
export const consoleMailer: Mailer = { send(message) { console.log(`[navette:mail] À ${message.to} — ${message.subject}\n${mailText(message)}`); } };
/** Écrit chaque message sur une ligne JSON d'un fichier (tests, démonstration). */
export const fileMailer = (file: string): Mailer => ({ send(message) { appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...message }) + '\n'); } });

// ------------------------------------------------------------------ fournisseurs knex
/** Accès à une table : `(table) => knex(table)`. */
export type TableQuery = (table: string) => any;
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/**
 * Utilisateurs dans une table au format de Laravel (`users` : id, name, email, password, email_verified_at).
 * Les mots de passe sont hachés par `hashPassword` (scrypt). Pour accepter d'autres empreintes (bcrypt de Laravel…),
 * fournissez `verify(motDePasse, empreinte)` : il est consulté pour toute empreinte qui n'est pas au format scrypt.
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
 * Locataires (équipes) dans une table, liés aux utilisateurs par une table pivot — comme `teams` et `team_user` de la démo Filament.
 * `label` : texte au-dessus du nom dans le menu (« Current team »), comme `HasCurrentTenantLabel`.
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
