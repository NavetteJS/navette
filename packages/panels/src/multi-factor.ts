// Multi-factor authentication: the provider contract, the login challenge, and two providers:
// authenticator apps (TOTP, with recovery codes) and security keys (WebAuthn: hardware keys and passkeys).
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Action } from '@navette-js/actions';
import { Field, Halt, OneTimeCodeInput, Radio, Step, TextInput } from '@navette-js/forms';
import { Actions, Component, Flex, Group, Html, Image, Section, Text, type ComponentContext } from '@navette-js/schemas';
import { HtmlString, e, js } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { button } from '@navette-js/support/ui';
import { readToken, signToken } from './auth.ts';
import { Notification } from './notifications.ts';
import { qrCodeDataUri } from './qr-code.ts';
import { Throttle } from './throttle.ts';
import { generateTotpSecret, totpUri, verifyTotp, type TotpAlgorithm } from './totp.ts';
import { authenticationOptions, generateChallenge, registrationOptions, verifyAuthentication, verifyRegistration, WebAuthnError, type UserVerification } from './webauthn.ts';
import type { AuthProvider, Panel, PanelContext, User } from './index.ts';

type MaybePromise<T> = T | Promise<T>;

/**
 * A way to prove one's identity after the password. Register providers with `panel.multiFactorAuthentication([...])`.
 * Each provider's state lives under its id: the challenge form fields under `data.multiFactor.<id>`.
 */
export interface MultiFactorAuthenticationProvider {
    /** Unique id, used as the state path of its components (`app`, `security-keys`…). Letters, digits, `-` and `_`. */
    getId(): string;
    /** Label of the provider in the picker shown when a user has several. */
    getLoginFormLabel(): string;
    /** Whether the user has set this provider up. */
    isEnabled(user: User, panel: Panel): MaybePromise<boolean>;
    /** Components shown on the profile page (and the required setup page): status and actions to set up or disable. */
    getManagementSchemaComponents(user: User, panel: Panel): Component[];
    /** Fields of the login challenge. Their validation rules decide whether the challenge passes. */
    getChallengeFormComponents(user: User, panel: Panel): Component[];
    /** Runs when the challenge is shown, or when the user picks this provider (send a code by SMS…). */
    beforeChallenge?(user: User, panel: Panel): MaybePromise<void>;
    /** Called when the panel router is built: throw if something the provider needs is missing (its storage…). */
    checkConfiguration?(panel: Panel): void;
}

// ------------------------------------------------------------------ cache store
/** Short-lived values: used codes (replay protection) and pending WebAuthn challenges. */
export interface MultiFactorCacheStore {
    get(key: string): MaybePromise<unknown>;
    put(key: string, value: unknown, ttlSeconds: number): MaybePromise<void>;
    forget(key: string): MaybePromise<void>;
}
/** In-memory store: fine for a single process. When running several, use a shared store (Redis…) with `cacheStore()`. */
export class MemoryCacheStore implements MultiFactorCacheStore {
    private entries = new Map<string, { value: unknown; expires: number }>();
    private max: number;
    constructor(max = 50_000) { this.max = max; }
    get(key: string): unknown {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expires <= Date.now()) { this.entries.delete(key); return undefined; }
        return entry.value;
    }
    put(key: string, value: unknown, ttlSeconds: number): void {
        this.entries.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
        if (this.entries.size > this.max) {
            const now = Date.now();
            for (const [k, v] of this.entries) if (v.expires <= now) this.entries.delete(k);
            // Still full: drop the oldest entries.
            for (const k of this.entries.keys()) { if (this.entries.size <= this.max) break; this.entries.delete(k); }
        }
    }
    forget(key: string): void { this.entries.delete(key); }
}
let defaultCacheStore: MultiFactorCacheStore = new MemoryCacheStore();
/** Store used by the providers that do not set their own `cacheStore()`. */
export const useMultiFactorCacheStore = (store: MultiFactorCacheStore): void => { defaultCacheStore = store; };

/** Runs `fn` after any other call holding the same key in this process (check-then-write sequences). */
const queues = new Map<string, Promise<unknown>>();
async function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const run = previous.catch(() => {}).then(fn);
    queues.set(key, run);
    try { return await run; } finally { if (queues.get(key) === run) queues.delete(key); }
}

// ------------------------------------------------------------------ helpers
const contextOf = (livewire: any): PanelContext => livewire?._ctx as PanelContext;
const userKey = (user: User) => createHash('sha256').update(String(user.id)).digest('base64url').slice(0, 22);
/** The signed-in user of the request the action runs in; the action stops if they changed since it was mounted. */
function currentUser(livewire: any): User {
    const user = contextOf(livewire)?.user;
    if (!user) throw new Halt();
    return user;
}
const fail = (livewire: any, path: string, message: string): never => { livewire.addError(path, message); throw new Halt(); };

/** "Current password" field: checked against the auth provider. Not saved. */
function currentPasswordInput(name: string, label: string, attribute: string): TextInput {
    return TextInput.make(name).label(label).validationAttribute(attribute).password().revealable().autocomplete('current-password').required().dehydrated(false)
        .rule({
            name: 'current_password',
            passes: async (value, ctx) => { const { panel, user } = contextOf(ctx.livewire); return Boolean(user && (await panel.getAuth().attempt(user.email, String(value)))); },
            message: () => 'The password is incorrect.',
        });
}
/** Link showing the recovery code field: it sets `useRecoveryCode` next to the field, in the browser state. */
function useRecoveryCodeLink(label: string, ctx: ComponentContext): Text {
    const path = [ctx.component.container.getStatePath(), 'useRecoveryCode'].filter(Boolean).join('.');
    return Text.make(new HtmlString(`<button type="button" class="fi-link fi-size-sm fi-color fi-color-primary fi-text-color-600 dark:fi-text-color-400" x-on:click="${e(`$wire.set(${js(path)}, true)`)}"><span class="fi-link-label">${e(label)}</span></button>`));
}
/** A rate limit as a validation rule: each validation counts as an attempt. */
const throttleRule = (throttle: Throttle, key: (ctx: ComponentContext) => string, message: string) => ({
    name: 'throttle', passes: (_value: unknown, ctx: ComponentContext) => throttle.hit(key(ctx)) === 0, message: () => message, implicit: true,
});
const statusBadge = (enabled: boolean, enabledLabel: string, disabledLabel: string) => (enabled ? Text.make(enabledLabel).badge().color('success') : Text.make(disabledLabel).badge());

// ------------------------------------------------------------------ the challenge
/** The login challenge: enabled providers, the picker, rate limiting. */
export class MultiFactorChallenge {
    /** Attempts per user and per minute. */
    static maxAttempts = 5;
    private static throttle: Throttle | null = null;
    private panel: Panel;
    constructor(panel: Panel) { this.panel = panel; }
    static make(panel: Panel): MultiFactorChallenge { return new this(panel); }
    getProviders(): MultiFactorAuthenticationProvider[] { return this.panel.getMultiFactorAuthenticationProviders(); }
    async getEnabledProviders(user: User): Promise<MultiFactorAuthenticationProvider[]> {
        const enabled: MultiFactorAuthenticationProvider[] = [];
        for (const provider of this.getProviders()) if (await provider.isEnabled(user, this.panel)) enabled.push(provider);
        return enabled;
    }
    async hasEnabledProviders(user: User): Promise<boolean> {
        for (const provider of this.getProviders()) if (await provider.isEnabled(user, this.panel)) return true;
        return false;
    }
    async beforeChallenge(user: User, provider?: MultiFactorAuthenticationProvider): Promise<void> {
        const target = provider ?? (await this.getEnabledProviders(user))[0];
        await target?.beforeChallenge?.(user, this.panel);
    }
    /**
     * Challenge fields for these enabled providers: a picker when there are several, then each provider's fields under its id
     * (only the picked provider's are shown and validated).
     */
    getFormComponents(user: User, enabled: MultiFactorAuthenticationProvider[]): Component[] {
        const several = enabled.length > 1;
        const picker = several ? [Section.make().compact().secondary().schema([
            Radio.make('provider').label(t('filament-panels::auth/pages/login.multi_factor.form.provider.label'))
                .options(Object.fromEntries(enabled.map((provider) => [provider.getId(), provider.getLoginFormLabel()])))
                .default(enabled[0].getId()).live().required().markAsRequired(false),
        ])] : [];
        return [
            ...picker,
            ...enabled.map((provider) => {
                const group = Group.make(provider.getChallengeFormComponents(user, this.panel)).statePath(provider.getId());
                return several ? group.visible(({ get }) => (get('provider') ?? enabled[0].getId()) === provider.getId()) : group;
            }),
        ];
    }
    private static limiter(): Throttle { return (this.throttle ??= new Throttle(this.maxAttempts)); }
    /** Records an attempt; returns 0 if allowed, otherwise the seconds to wait. */
    hitRateLimiter(user: User): number { return (this.constructor as typeof MultiFactorChallenge).limiter().hit(`${this.panel.getId()}:${userKey(user)}`); }
    clearRateLimiter(user: User): void { (this.constructor as typeof MultiFactorChallenge).limiter().clear(`${this.panel.getId()}:${userKey(user)}`); }
}

// ------------------------------------------------------------------ authenticator apps (TOTP)
/** Where app authentication data is kept; by default, the panel's auth provider (`knexAuthProvider` stores it in the users table). */
export type AppAuthenticationStore = Required<Pick<AuthProvider, 'getAppAuthenticationSecret' | 'saveAppAuthenticationSecret'>> & Partial<Pick<AuthProvider, 'getAppAuthenticationRecoveryCodes' | 'saveAppAuthenticationRecoveryCodes'>>;

const ENCRYPTED_PREFIX = 'enc:v1:';
const secretKey = (panel: Panel) => Buffer.from(hkdfSync('sha256', panel.getAuthKey(), 'navette', 'app-authentication-secret', 32));
/** Encrypts a TOTP secret at rest (AES-256-GCM, with a key derived from the panel key). */
export function encryptSecret(panel: Panel, secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', secretKey(panel), iv);
    const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')}`;
}
/** Decrypts a stored secret; a value without the prefix is returned as is (secrets stored in clear by your own code). `null` when it cannot be read. */
export function decryptSecret(panel: Panel, stored: string): string | null {
    if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;
    try {
        const raw = Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), 'base64url');
        const decipher = createDecipheriv('aes-256-gcm', secretKey(panel), raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    } catch { return null; }
}
const hashRecoveryCode = (code: string) => `sha256:${createHash('sha256').update(code.trim()).digest('hex')}`;
const RECOVERY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const randomString = (length: number) => Array.from({ length }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join('');

/**
 * Authentication with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…):
 * time-based one-time passwords (RFC 6238). `recoverable()` adds single-use recovery codes.
 */
export class AppAuthentication implements MultiFactorAuthenticationProvider {
    protected _id = 'app';
    protected _recoverable = false;
    protected _regenerableRecoveryCodes = true;
    protected _recoveryCodeCount = 8;
    protected _brandName: string | null = null;
    protected _codeWindow = 1;
    protected _digits = 6;
    protected _period = 30;
    protected _algorithm: TotpAlgorithm = 'sha1';
    protected _store: AppAuthenticationStore | null = null;
    protected _cacheStore: MultiFactorCacheStore | null = null;
    protected _confirmsPassword = true;
    protected _generateRecoveryCodes: (() => string[]) | null = null;
    protected setupThrottle = new Throttle(5);
    protected managementThrottle = new Throttle(5);

    static make(): AppAuthentication { return new this(); }
    getId(): string { return this._id; }
    /** Changes the id (to register two app providers with different settings). */
    id(id: string): this { this._id = id; return this; }
    getLoginFormLabel(): string { return t('filament-panels::auth/multi-factor/app/provider.login_form.label'); }

    /** Single-use recovery codes, shown once at setup, to sign in without the app. Needs `get`/`saveAppAuthenticationRecoveryCodes` on the store. */
    recoverable(condition = true): this { this._recoverable = condition; return this; }
    isRecoverable(): boolean { return this._recoverable; }
    /** `false`: users cannot regenerate their recovery codes. */
    regenerableRecoveryCodes(condition = true): this { this._regenerableRecoveryCodes = condition; return this; }
    canRegenerateRecoveryCodes(): boolean { return this._regenerableRecoveryCodes; }
    recoveryCodeCount(count: number): this { this._recoveryCodeCount = Math.max(1, Math.min(50, Math.floor(count))); return this; }
    getRecoveryCodeCount(): number { return this._recoveryCodeCount; }
    /** Generates the recovery codes (by default, `xxxxxxxxxx-xxxxxxxxxx` from 62 characters). */
    generateRecoveryCodesUsing(callback: (() => string[]) | null): this { this._generateRecoveryCodes = callback; return this; }
    /** Name shown in the app, next to the account (the panel's brand name by default). */
    brandName(name: string | null): this { this._brandName = name; return this; }
    getBrandName(panel: Panel): string { return this._brandName ?? panel.getBrandName().replace(/<[^>]*>/g, ''); }
    /** Codes accepted before and after the current one, to allow for clock drift (1 by default: ±30 seconds). */
    codeWindow(window: number): this { this._codeWindow = Math.max(0, Math.min(10, Math.floor(window))); return this; }
    getCodeWindow(): number { return this._codeWindow; }
    /** Code settings. Most apps only support the defaults (6 digits, 30 seconds, SHA-1). */
    codeOptions(options: { digits?: number; period?: number; algorithm?: TotpAlgorithm }): this {
        if (options.digits) this._digits = options.digits;
        if (options.period) this._period = options.period;
        if (options.algorithm) this._algorithm = options.algorithm;
        return this;
    }
    /** Where secrets and recovery codes are stored (the panel's auth provider by default). */
    store(store: AppAuthenticationStore | null): this { this._store = store; return this; }
    /** Where used codes are remembered (replay protection). */
    cacheStore(store: MultiFactorCacheStore | null): this { this._cacheStore = store; return this; }
    /** `false`: setting up and turning off do not ask for the current password (accounts without one). */
    confirmsPassword(condition = true): this { this._confirmsPassword = condition; return this; }

    protected getStore(panel: Panel): AppAuthenticationStore {
        const store = this._store ?? (panel.getAuth() as AppAuthenticationStore);
        if (typeof store.getAppAuthenticationSecret !== 'function' || typeof store.saveAppAuthenticationSecret !== 'function') {
            throw new Error('App authentication: the auth provider must implement getAppAuthenticationSecret and saveAppAuthenticationSecret (knexAuthProvider does), or pass a store with store().');
        }
        return store;
    }
    protected codeOptionsOf() { return { digits: this._digits, period: this._period, algorithm: this._algorithm }; }

    checkConfiguration(panel: Panel): void {
        const store = this.getStore(panel);
        if (this._recoverable && (typeof store.getAppAuthenticationRecoveryCodes !== 'function' || typeof store.saveAppAuthenticationRecoveryCodes !== 'function')) {
            throw new Error('App authentication: recoverable() needs getAppAuthenticationRecoveryCodes and saveAppAuthenticationRecoveryCodes on the store (knexAuthProvider has them).');
        }
    }
    async isEnabled(user: User, panel: Panel): Promise<boolean> {
        const stored = await this.getStore(panel).getAppAuthenticationSecret(user);
        return typeof stored === 'string' && stored !== '';
    }
    /** The user's secret, decrypted; `null` when none is set or it cannot be decrypted (the panel key changed). */
    async getSecret(user: User, panel: Panel): Promise<string | null> {
        const stored = await this.getStore(panel).getAppAuthenticationSecret(user);
        return typeof stored === 'string' && stored !== '' ? decryptSecret(panel, stored) : null;
    }
    async saveSecret(user: User, panel: Panel, secret: string | null): Promise<void> {
        await this.getStore(panel).saveAppAuthenticationSecret(user, secret === null ? null : encryptSecret(panel, secret));
    }
    generateSecret(): string { return generateTotpSecret(20); }
    generateRecoveryCodes(): string[] { return this._generateRecoveryCodes?.() ?? Array.from({ length: this._recoveryCodeCount }, () => `${randomString(10)}-${randomString(10)}`); }
    /** Saves recovery codes (hashed): `null` removes them. */
    async saveRecoveryCodes(user: User, panel: Panel, codes: string[] | null): Promise<void> {
        const store = this.getStore(panel);
        if (typeof store.saveAppAuthenticationRecoveryCodes !== 'function') throw new Error('App authentication: recoverable() needs saveAppAuthenticationRecoveryCodes on the store.');
        await store.saveAppAuthenticationRecoveryCodes(user, codes === null ? null : codes.map(hashRecoveryCode));
    }
    /** `otpauth://` URI of a secret, for the QR code. */
    getUri(user: User, panel: Panel, secret: string): string { return totpUri(secret, user.email, this.getBrandName(panel), this.codeOptionsOf()); }
    /** QR code of a secret, as a `data:` URI. */
    generateQrCodeDataUri(user: User, panel: Panel, secret: string): string { return qrCodeDataUri(this.getUri(user, panel, secret), { title: t('filament-panels::auth/multi-factor/app/actions/set-up.modal.content.qr_code.alt') }); }

    /**
     * Checks a code. With `preventReuse` (sign-in and sensitive actions), a code is accepted once: the time step of the last
     * accepted code is remembered, and that code and every earlier one are refused (RFC 6238 §5.2).
     */
    async verifyCode(code: unknown, secret: string, options: { preventReuse?: boolean } = {}): Promise<boolean> {
        const verify = (after: number | null) => verifyTotp(secret, code, { ...this.codeOptionsOf(), window: this._codeWindow, after });
        if (!options.preventReuse) return verify(null) !== null;
        const key = `navette:mfa:app:last-step:${createHash('sha256').update(secret).digest('base64url')}`;
        const cache = this._cacheStore ?? defaultCacheStore;
        return serialized(key, async () => {
            const last = await cache.get(key);
            const step = verify(typeof last === 'number' ? last : null);
            if (step === null) return false;
            await cache.put(key, step, (this._codeWindow * 2 + 2) * this._period);
            return true;
        });
    }
    /** Checks a recovery code and removes it: each one works once. */
    async verifyRecoveryCode(code: unknown, user: User, panel: Panel): Promise<boolean> {
        if (typeof code !== 'string' || code.trim() === '' || code.length > 200) return false;
        const store = this.getStore(panel);
        if (typeof store.getAppAuthenticationRecoveryCodes !== 'function' || typeof store.saveAppAuthenticationRecoveryCodes !== 'function') return false;
        return serialized(`navette:mfa:app:recovery:${panel.getId()}:${userKey(user)}`, async () => {
            const hashes = (await store.getAppAuthenticationRecoveryCodes!(user)) ?? [];
            const candidate = Buffer.from(hashRecoveryCode(code));
            let matched = -1;
            // Every stored hash is compared, in constant time.
            hashes.forEach((hash, index) => { const stored = Buffer.from(String(hash)); if (stored.length === candidate.length && timingSafeEqual(stored, candidate) && matched < 0) matched = index; });
            if (matched < 0) return false;
            await store.saveAppAuthenticationRecoveryCodes!(user, hashes.filter((_, index) => index !== matched));
            return true;
        });
    }

    getChallengeFormComponents(user: User, panel: Panel): Component[] {
        const recoverable = this._recoverable;
        const group = 'filament-panels::auth/multi-factor/app/provider.login_form';
        return [
            OneTimeCodeInput.make('code').length(this._digits).label(t(`${group}.code.label`)).validationAttribute(t(`${group}.code.validation_attribute`))
                .submitOnCompletion().autofocus()
                .belowContent(recoverable ? (ctx: ComponentContext) => (ctx.get('useRecoveryCode') ? null : useRecoveryCodeLink(t(`${group}.code.actions.use_recovery_code.label`), ctx)) : null)
                .required(({ get }) => !recoverable || !get('useRecoveryCode') || !get('recoveryCode'))
                .rule({ name: 'totp', passes: async (value) => { const secret = await this.getSecret(user, panel); return secret !== null && this.verifyCode(value, secret, { preventReuse: true }); }, message: () => t(`${group}.code.messages.invalid`) })
                .hidden(({ get }) => recoverable && Boolean(get('useRecoveryCode'))),
            TextInput.make('recoveryCode').label(t(`${group}.recovery_code.label`)).validationAttribute(t(`${group}.recovery_code.validation_attribute`))
                .password().revealable().autocomplete('one-time-code').required()
                .rule({ name: 'recovery_code', passes: (value) => this.verifyRecoveryCode(value, user, panel), message: () => t(`${group}.recovery_code.messages.invalid`) })
                .visible(({ get }) => recoverable && Boolean(get('useRecoveryCode'))),
        ];
    }

    getManagementSchemaComponents(user: User, panel: Panel): Component[] {
        const group = 'filament-panels::auth/multi-factor/app/provider.management_schema.actions';
        const enabled = () => this.isEnabled(user, panel);
        return [
            Actions.make(this.getActions(user, panel)).key(`${this._id}-actions`)
                .label(t(`${group}.label`)).belowContent(t(`${group}.below_content`))
                .afterLabel(async () => statusBadge(await enabled(), t(`${group}.messages.enabled`), t(`${group}.messages.disabled`))),
        ];
    }
    getActions(user: User, panel: Panel): Action[] {
        const enabled = () => this.isEnabled(user, panel);
        return [
            this.setUpAction(panel).hidden(enabled),
            this.regenerateRecoveryCodesAction(panel).visible(async () => this._recoverable && this._regenerableRecoveryCodes && (await enabled())),
            this.disableAction(panel).visible(enabled),
            ...(this._recoverable && this._regenerableRecoveryCodes ? [this.showNewRecoveryCodesAction(panel)] : []),
        ];
    }

    /** Setup modal: QR code and secret, a code from the app (and the password), then the recovery codes. */
    setUpAction(panel: Panel): Action {
        const group = 'filament-panels::auth/multi-factor/app/actions/set-up';
        const purpose = `${panel.getId()}.mfa-app-set-up`;
        // The secret and recovery codes travel with the mounted action, signed: the browser can show them but not change them.
        const pending = (ctx: { arguments?: Record<string, unknown>; livewire: any }) => {
            const payload = readToken(panel.getAuthKey(), purpose, ctx.arguments?.pending) as { secret?: string; codes?: string[]; user?: string } | null;
            const user = contextOf(ctx.livewire)?.user;
            return payload && user && payload.user === userKey(user) && typeof payload.secret === 'string' ? { secret: payload.secret, codes: Array.isArray(payload.codes) ? payload.codes.map(String) : [] } : null;
        };
        const argumentsOf = (ctx: ComponentContext) => (ctx.livewire as any).mountedActions?.find?.((mounted: any) => mounted.name === 'setUpAppAuthentication')?.arguments ?? {};
        const pendingFromSchema = (ctx: ComponentContext) => pending({ arguments: argumentsOf(ctx), livewire: ctx.livewire });
        const codeInput = OneTimeCodeInput.make('code').length(this._digits).label(t(`${group}.modal.form.code.label`)).validationAttribute(t(`${group}.modal.form.code.validation_attribute`))
            .helperText(t(`${group}.modal.form.code.below_content`)).required()
            .rule({ name: 'totp', passes: async (value, ctx) => { const state = pendingFromSchema(ctx); return state !== null && this.verifyCode(value, state.secret); }, message: () => t(`${group}.modal.form.code.messages.invalid`) });
        const steps = [
            Step.make('app')
                .beforeValidation((ctx) => {
                    const user = currentUser(ctx.livewire);
                    if (this.setupThrottle.hit(`${panel.getId()}:${userKey(user)}`) > 0) {
                        const codePath = (ctx.component as any).getChildSchemas()[0].getFlatComponents().find((component: any) => component instanceof OneTimeCodeInput)?.getStatePath();
                        if (codePath) fail(ctx.livewire, codePath, t(`${group}.modal.form.code.messages.rate_limited`));
                        throw new Halt();
                    }
                })
                .schema([
                    Group.make([
                        Text.make(t(`${group}.modal.content.qr_code.instruction`)).color('neutral'),
                        Image.make((ctx) => { const state = pendingFromSchema(ctx); const user = contextOf(ctx.livewire).user!; return state ? this.generateQrCodeDataUri(user, panel, state.secret) : ''; }, t(`${group}.modal.content.qr_code.alt`))
                            .imageHeight('12rem').alignCenter(),
                        Flex.make([
                            Text.make(t(`${group}.modal.content.text_code.instruction`)).color('neutral').grow(false),
                            Text.make((ctx) => pendingFromSchema(ctx)?.secret ?? '').fontFamily('mono').color('neutral').copyable().copyMessage(t(`${group}.modal.content.text_code.messages.copied`)).grow(false),
                        ]).from('sm'),
                    ]).dense(),
                    codeInput,
                    ...(this._confirmsPassword ? [currentPasswordInput('password', t(`${group}.modal.form.password.label`), t(`${group}.modal.form.password.validation_attribute`))] : []),
                ]),
            ...(this._recoverable ? [Step.make('recovery').schema(this.recoveryCodesContent((ctx) => pendingFromSchema(ctx)?.codes ?? [], t(`${group}.modal.content.recovery_codes.instruction`)))] : []),
        ];
        return Action.make('setUpAppAuthentication')
            .label(t(`${group}.label`)).color('primary').icon('m-lock-closed').link()
            .mountUsing((ctx) => {
                const user = currentUser(ctx.livewire);
                ctx.arguments.pending = signToken(panel.getAuthKey(), purpose, { secret: this.generateSecret(), ...(this._recoverable ? { codes: this.generateRecoveryCodes() } : {}), user: userKey(user) }, 60 * 30);
            })
            .modalWidth('lg').closeModalByClickingAway(false).closeModalByEscaping(false)
            .modalIcon('o-lock-closed').modalIconColor('primary')
            .modalHeading(t(`${group}.modal.heading`))
            .modalDescription(() => new HtmlString(t(`${group}.modal.description`)
                .replace(/<x-filament::link href="([^"]+)" target="_blank">([^<]+)<\/x-filament::link>/g, (_match, href: string, label: string) => `<a href="${e(href)}" target="_blank" rel="noopener" class="fi-link fi-size-md fi-color fi-color-primary fi-text-color-600 dark:fi-text-color-400"><span class="fi-link-label">${e(label)}</span></a>`)
                .trim()) as any)
            .modalSubmitActionLabel(t(`${group}.modal.actions.submit.label`))
            .steps(steps)
            .modifyWizardUsing((wizard) => wizard.hiddenHeader())
            .action(async (ctx) => {
                const user = currentUser(ctx.livewire);
                const state = pending(ctx);
                // Issued for another user, or expired: nothing is saved.
                if (!state) return;
                await this.saveSecret(user, panel, state.secret);
                if (this._recoverable) await this.saveRecoveryCodes(user, panel, state.codes);
                Notification.make().success().title(t(`${group}.notifications.enabled.title`)).icon('o-lock-closed').send();
            });
    }
    /** Recovery codes, with "copy" and "download" links. */
    protected recoveryCodesContent(codes: (ctx: ComponentContext) => string[], instruction: string): Component[] {
        const content = 'filament-panels::auth/multi-factor/recovery-codes-modal-content';
        return [
            Text.make(instruction).weight('bold').color('neutral'),
            Html.make((ctx) => `<ul class="fi-sc-unordered-list fi-size-xs">${codes(ctx).map((code) => `<li><span class="fi-sc-text fi-font-mono fi-size-xs fi-color-neutral">${e(code)}</span></li>`).join('')}</ul>`),
            Text.make((ctx) => {
                const text = codes(ctx).join('\n');
                const linkClass = 'fi-link fi-size-sm fi-color fi-color-primary fi-text-color-600 dark:fi-text-color-400';
                return new HtmlString(`<span>${e(t(`${content}.actions.0`))} <button type="button" class="${linkClass}" x-on:click="${e(`window.navigator.clipboard.writeText(${js(text)}); $tooltip(${js(t(`${content}.messages.copied`))}, { theme: $store.theme })`)}"><span class="fi-link-label">${e(t(`${content}.actions.copy.label`))}</span></button> ${e(t(`${content}.actions.1`))} <a href="${e(`data:application/octet-stream,${encodeURIComponent(text)}`)}" download="recovery-codes.txt" class="${linkClass}"><span class="fi-link-label">${e(t(`${content}.actions.download.label`))}</span></a> ${e(t(`${content}.actions.2`))}</span>`);
            }),
        ];
    }
    /** Fields confirming a sensitive action: a code from the app (or a recovery code) and, optionally, the password. */
    protected confirmationFields(panel: Panel, group: string, options: { recoveryCodes: boolean }): Component[] {
        const throttleKey = (ctx: ComponentContext) => `${panel.getId()}:${userKey(contextOf(ctx.livewire).user!)}`;
        const recoverable = options.recoveryCodes && this._recoverable;
        return [
            OneTimeCodeInput.make('code').length(this._digits).label(t(`${group}.modal.form.code.label`)).validationAttribute(t(`${group}.modal.form.code.validation_attribute`))
                .required(({ get }) => !recoverable || !get('recoveryCode'))
                .belowContent(recoverable ? (ctx: ComponentContext) => (ctx.get('useRecoveryCode') ? null : useRecoveryCodeLink(t(`${group}.modal.form.code.actions.use_recovery_code.label`), ctx)) : null)
                .rule(throttleRule(this.managementThrottle, throttleKey, t(`${group}.modal.form.code.messages.rate_limited`)))
                .rule({ name: 'totp', passes: async (value, ctx) => { const user = contextOf(ctx.livewire).user!; const secret = await this.getSecret(user, panel); return secret !== null && this.verifyCode(value, secret, { preventReuse: true }); }, message: () => t(`${group}.modal.form.code.messages.invalid`) })
                .hidden(({ get }) => recoverable && Boolean(get('useRecoveryCode'))),
            ...(recoverable ? [
                TextInput.make('recoveryCode').label(t(`${group}.modal.form.recovery_code.label`)).validationAttribute(t(`${group}.modal.form.recovery_code.validation_attribute`))
                    .password().revealable().autocomplete('one-time-code').required()
                    .rule({ name: 'recovery_code', passes: (value, ctx) => this.verifyRecoveryCode(value, contextOf(ctx.livewire).user!, panel), message: () => t(`${group}.modal.form.recovery_code.messages.invalid`) })
                    .visible(({ get }) => Boolean(get('useRecoveryCode'))),
            ] : []),
            ...(this._confirmsPassword ? [currentPasswordInput('password', t(`${group}.modal.form.password.label`), t(`${group}.modal.form.password.validation_attribute`))] : []),
        ];
    }
    /** Turns app authentication off, after a code (or a recovery code) and the password. */
    disableAction(panel: Panel): Action {
        const group = 'filament-panels::auth/multi-factor/app/actions/disable';
        return Action.make('disableAppAuthentication')
            .label(t(`${group}.label`)).color('danger').icon('m-lock-open').link()
            .modalWidth('md').modalIcon('o-lock-open').modalIconColor('danger')
            .modalHeading(t(`${group}.modal.heading`)).modalDescription(t(`${group}.modal.description`))
            .modalSubmitActionLabel(t(`${group}.modal.actions.submit.label`))
            .schema(this.confirmationFields(panel, group, { recoveryCodes: true }))
            .action(async (ctx) => {
                const user = currentUser(ctx.livewire);
                await this.saveSecret(user, panel, null);
                if (this._recoverable) await this.saveRecoveryCodes(user, panel, null);
                Notification.make().success().title(t(`${group}.notifications.disabled.title`)).icon('o-lock-open').send();
            });
    }
    /** Replaces the recovery codes, after a code from the app and the password; the new codes are shown once. */
    regenerateRecoveryCodesAction(panel: Panel): Action {
        const group = 'filament-panels::auth/multi-factor/app/actions/regenerate-recovery-codes';
        return Action.make('regenerateAppAuthenticationRecoveryCodes')
            .label(t(`${group}.label`)).color('gray').icon('m-arrow-path').link()
            .modalWidth('md').modalIcon('o-arrow-path')
            .modalHeading(t(`${group}.modal.heading`)).modalDescription(t(`${group}.modal.description`))
            .modalSubmitActionLabel(t(`${group}.modal.actions.submit.label`))
            .schema(this.confirmationFields(panel, group, { recoveryCodes: false }))
            .action(async (ctx) => {
                const user = currentUser(ctx.livewire);
                const codes = this.generateRecoveryCodes();
                await this.saveRecoveryCodes(user, panel, codes);
                Notification.make().success().title(t(`${group}.notifications.regenerated.title`)).icon('o-lock-closed').send();
                // The new codes, shown once, in a modal opened in place of this one.
                await ctx.livewire.replaceMountedAction('showNewAppAuthenticationRecoveryCodes', { codes: signToken(panel.getAuthKey(), `${panel.getId()}.mfa-app-recovery-codes`, { codes, user: userKey(user) }, 60 * 10) });
            });
    }
    /** Shows recovery codes just generated; only opened by `regenerateRecoveryCodesAction()`. */
    showNewRecoveryCodesAction(panel: Panel): Action {
        const group = 'filament-panels::auth/multi-factor/app/actions/regenerate-recovery-codes.show_new_recovery_codes.modal';
        const codes = (ctx: ComponentContext): string[] => {
            const mounted = (ctx.livewire as any).mountedActions?.find?.((candidate: any) => candidate.name === 'showNewAppAuthenticationRecoveryCodes');
            const payload = readToken(panel.getAuthKey(), `${panel.getId()}.mfa-app-recovery-codes`, mounted?.arguments?.codes) as { codes?: unknown; user?: string } | null;
            const user = contextOf(ctx.livewire)?.user;
            return payload && user && payload.user === userKey(user) && Array.isArray(payload.codes) ? payload.codes.map(String) : [];
        };
        return Action.make('showNewAppAuthenticationRecoveryCodes').hidden()
            .modalHeading(t(`${group}.heading`)).modalWidth('md').modalIcon('o-lock-closed').modalIconColor('primary')
            .closeModalByClickingAway(false).modalSubmitAction(false).modalCancelActionLabel(t(`${group}.actions.submit.label`))
            .schema(this.recoveryCodesContent(codes, t(`${group}.description`)));
    }
}

// ------------------------------------------------------------------ security keys (WebAuthn)
/** A registered security key or passkey. */
export type SecurityKey = {
    id: string | number; name: string; credentialId: string; publicKey: string; algorithm: number; signCount: number;
    transports: string[]; createdAt: string | null; lastUsedAt: string | null;
};
/** Where security keys are kept; by default, the panel's auth provider (`knexAuthProvider` uses a `security_keys` table). */
export type SecurityKeyStore = Required<Pick<AuthProvider, 'getSecurityKeys' | 'createSecurityKey' | 'updateSecurityKey' | 'deleteSecurityKey'>>;

/** Field running a WebAuthn ceremony in the browser; its state is the credential (JSON) the browser returns. */
export class SecurityKeyInput extends Field {
    protected _mode: 'register' | 'authenticate' = 'authenticate';
    protected _optionsUsing: ((field: SecurityKeyInput) => MaybePromise<Record<string, unknown> | null>) | null = null;
    protected _submitOnSuccess = false;
    protected _autoStart = false;
    protected _buttonLabel: string | null = null;
    static make(name: string): SecurityKeyInput { return new this(name); }
    /** `register`: adds a key (`navigator.credentials.create()`); `authenticate`: uses one (`navigator.credentials.get()`). */
    mode(mode: 'register' | 'authenticate'): this { this._mode = mode; return this; }
    /** Options of the ceremony, asked for by the browser when the user clicks the button. */
    optionsUsing(callback: (field: SecurityKeyInput) => MaybePromise<Record<string, unknown> | null>): this { this._optionsUsing = callback; return this; }
    /** Submits the form as soon as the key answered. */
    submitOnSuccess(condition = true): this { this._submitOnSuccess = condition; return this; }
    /** Starts the ceremony when the field appears (browsers may still require a click). */
    autoStart(condition = true): this { this._autoStart = condition; return this; }
    buttonLabel(label: string | null): this { this._buttonLabel = label; return this; }
    getExposedMethods(): string[] { return ['getPublicKeyOptions']; }
    async getPublicKeyOptions(): Promise<Record<string, unknown> | null> {
        if (!(await this.isVisible()) || (await this.isDisabled())) return null;
        return (await this._optionsUsing?.(this)) ?? null;
    }
    hydrateState(value: unknown): unknown { return typeof value === 'string' && value.length <= 100_000 ? value : null; }
    async toHtml(): Promise<string> {
        const group = 'filament-panels::auth/multi-factor/security-keys/field';
        const messages = {
            waiting: t(`${group}.messages.waiting`), success: t(`${group}.messages.${this._mode === 'register' ? 'registered' : 'verified'}`),
            cancelled: t(`${group}.messages.cancelled`), unsupported: t(`${group}.messages.unsupported`), failed: t(`${group}.messages.failed`),
        };
        const config = { mode: this._mode, key: this.getKey(), submitOnSuccess: this._submitOnSuccess, autoStart: this._autoStart, messages };
        const label = this._buttonLabel ?? t(`${group}.actions.${this._mode === 'register' ? 'register' : 'authenticate'}.label`);
        const control = button({ color: 'gray', icon: 'o-key', attributes: { 'x-on:click': 'start()', 'x-bind:disabled': 'isWaiting', id: this.getId(), 'aria-describedby': `${this.getId()}-status` } }, `<span class="fi-btn-label">${e(label)}</span>`);
        return this.wrap(`<div x-data="${e(`navetteSecurityKey({ state: $wire.$entangle(${js(this.getStatePath())}, false), ...${js(config)} })`)}" class="nv-security-key">${control}<p id="${e(this.getId())}-status" class="nv-security-key-status" role="status" aria-live="polite" x-show="message" x-text="message" x-bind:class="{ 'nv-security-key-status-error': isError }" x-cloak></p></div>`, { labelAsDiv: true });
    }
}

/**
 * Authentication with a security key: a hardware key (YubiKey, Titan…) or a passkey stored by the device or a password
 * manager (WebAuthn). Users can register several keys. Needs a secure context: HTTPS, or `localhost` in development.
 */
export class SecurityKeyAuthentication implements MultiFactorAuthenticationProvider {
    protected _id = 'security-keys';
    protected _rpId: string | null = null;
    protected _rpName: string | null = null;
    protected _origins: string[] | null = null;
    protected _userVerification: UserVerification = 'preferred';
    protected _authenticatorAttachment: 'platform' | 'cross-platform' | null = null;
    protected _residentKey: 'required' | 'preferred' | 'discouraged' = 'discouraged';
    protected _timeout = 120_000;
    protected _maxKeys = 10;
    protected _store: SecurityKeyStore | null = null;
    protected _cacheStore: MultiFactorCacheStore | null = null;
    protected _confirmsPassword = true;
    protected throttle = new Throttle(10);

    static make(): SecurityKeyAuthentication { return new this(); }
    getId(): string { return this._id; }
    id(id: string): this { this._id = id; return this; }
    getLoginFormLabel(): string { return t('filament-panels::auth/multi-factor/security-keys/provider.login_form.label'); }
    /** Relying party id: the domain the keys are bound to (by default, the host of `panel.appUrl()` or of the request). */
    relyingPartyId(id: string | null): this { this._rpId = id; return this; }
    /** Name shown by the browser while registering a key (the panel's brand name by default). */
    relyingPartyName(name: string | null): this { this._rpName = name; return this; }
    /** Origins allowed to use the keys (`https://admin.example.com`); by default, the origin of `panel.appUrl()` or of the request. */
    origins(origins: string[] | null): this { this._origins = origins; return this; }
    /** `required`: the key must check a PIN or biometrics; `preferred` (default): when it can. */
    userVerification(requirement: UserVerification): this { this._userVerification = requirement; return this; }
    /** Restricts registration to keys built into the device (`platform`) or to removable ones (`cross-platform`). */
    authenticatorAttachment(attachment: 'platform' | 'cross-platform' | null): this { this._authenticatorAttachment = attachment; return this; }
    /** Asks for a discoverable credential (passkey) when registering. */
    residentKey(requirement: 'required' | 'preferred' | 'discouraged'): this { this._residentKey = requirement; return this; }
    /** Milliseconds the browser waits for the key (2 minutes by default). */
    timeout(milliseconds: number): this { this._timeout = Math.max(10_000, Math.min(600_000, Math.floor(milliseconds))); return this; }
    /** Keys a user may register (10 by default). */
    maxKeys(count: number): this { this._maxKeys = Math.max(1, Math.floor(count)); return this; }
    store(store: SecurityKeyStore | null): this { this._store = store; return this; }
    /** Where pending challenges are kept between the two requests of a ceremony. */
    cacheStore(store: MultiFactorCacheStore | null): this { this._cacheStore = store; return this; }
    /** `false`: adding and removing keys do not ask for the current password. */
    confirmsPassword(condition = true): this { this._confirmsPassword = condition; return this; }

    protected getStore(panel: Panel): SecurityKeyStore {
        const store = this._store ?? (panel.getAuth() as SecurityKeyStore);
        for (const method of ['getSecurityKeys', 'createSecurityKey', 'updateSecurityKey', 'deleteSecurityKey'] as const) {
            if (typeof store[method] !== 'function') throw new Error(`Security keys: the auth provider must implement ${method} (knexAuthProvider does), or pass a store with store().`);
        }
        return store;
    }
    checkConfiguration(panel: Panel): void { this.getStore(panel); }
    getKeys(user: User, panel: Panel): Promise<SecurityKey[]> { return Promise.resolve(this.getStore(panel).getSecurityKeys(user)).then((keys) => keys ?? []); }
    async isEnabled(user: User, panel: Panel): Promise<boolean> { return (await this.getKeys(user, panel)).length > 0; }

    /** Relying party of a request: its id (domain) and allowed origins. */
    getRelyingParty(panel: Panel, req: { protocol?: string; hostname?: string; get?: (name: string) => string | undefined } | undefined): { id: string; name: string; origins: string[] } {
        // The host the browser used; the scheme of `appUrl` when it names the same host (behind a TLS proxy the request says http).
        const appUrl = panel.getAppUrl() ? new URL(panel.getAppUrl()!) : null;
        const host = req?.get?.('host') ?? null;
        const base = host ? (appUrl && appUrl.host === host ? appUrl : new URL(`${req!.protocol ?? 'http'}://${host}`)) : appUrl;
        const id = this._rpId ?? base?.hostname ?? 'localhost';
        return { id, name: this._rpName ?? panel.getBrandName().replace(/<[^>]*>/g, ''), origins: this._origins ?? (base ? [base.origin] : []) };
    }
    private cache(): MultiFactorCacheStore { return this._cacheStore ?? defaultCacheStore; }
    /** A new challenge, remembered for this user and purpose until it is used or expires. */
    protected async issueChallenge(user: User, panel: Panel, purpose: 'register' | 'authenticate'): Promise<string> {
        const challenge = generateChallenge();
        await this.cache().put(`navette:mfa:webauthn:${challenge}`, { purpose, user: userKey(user), panel: panel.getId() }, Math.ceil(this._timeout / 1000) + 60);
        return challenge;
    }
    /** The challenge a response answers, if it was issued for this user and purpose; it is consumed (single use). */
    protected async consumeChallenge(response: any, user: User, panel: Panel, purpose: 'register' | 'authenticate'): Promise<string | null> {
        let challenge: unknown;
        try { challenge = JSON.parse(Buffer.from(String(response?.response?.clientDataJSON ?? ''), 'base64url').toString('utf8'))?.challenge; } catch { return null; }
        if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{16,200}$/.test(challenge)) return null;
        const key = `navette:mfa:webauthn:${challenge}`;
        return serialized(key, async () => {
            const entry = (await this.cache().get(key)) as { purpose?: string; user?: string; panel?: string } | undefined;
            if (!entry || entry.purpose !== purpose || entry.user !== userKey(user) || entry.panel !== panel.getId()) return null;
            await this.cache().forget(key);
            return challenge as string;
        });
    }
    protected requestOf(field: { livewire: unknown }) { return contextOf(field.livewire)?.req as any; }

    /** Checks an assertion from the browser against the user's keys; updates the key's counter. */
    async verifyAssertion(value: unknown, user: User, panel: Panel, req: any): Promise<boolean> {
        if (typeof value !== 'string') return false;
        let response: any;
        try { response = JSON.parse(value); } catch { return false; }
        const keys = await this.getKeys(user, panel);
        const key = keys.find((candidate) => candidate.credentialId === response?.id || candidate.credentialId === response?.rawId);
        if (!key) return false;
        const challenge = await this.consumeChallenge(response, user, panel, 'authenticate');
        if (!challenge) return false;
        const party = this.getRelyingParty(panel, req);
        try {
            const result = verifyAuthentication(response, { challenge, origin: party.origins, rpId: party.id, requireUserVerification: this._userVerification === 'required', credential: key });
            await this.getStore(panel).updateSecurityKey(user, key.id, { signCount: result.signCount, lastUsedAt: new Date().toISOString() });
            return true;
        } catch (error) {
            if (error instanceof WebAuthnError) return false;
            throw error;
        }
    }

    getChallengeFormComponents(user: User, panel: Panel): Component[] {
        const group = 'filament-panels::auth/multi-factor/security-keys/provider.login_form';
        return [
            SecurityKeyInput.make('credential').mode('authenticate').label(t(`${group}.credential.label`)).validationAttribute(t(`${group}.credential.validation_attribute`))
                .submitOnSuccess().autoStart().required()
                .optionsUsing(async (field) => {
                    const party = this.getRelyingParty(panel, this.requestOf(field));
                    return authenticationOptions({ rpId: party.id, challenge: await this.issueChallenge(user, panel, 'authenticate'), allowCredentials: await this.getKeys(user, panel), userVerification: this._userVerification, timeout: this._timeout });
                })
                .rule({ name: 'security_key', passes: (value, ctx) => this.verifyAssertion(value, user, panel, contextOf(ctx.livewire)?.req), message: () => t(`${group}.credential.messages.invalid`) }),
        ];
    }

    getManagementSchemaComponents(user: User, panel: Panel): Component[] {
        const group = 'filament-panels::auth/multi-factor/security-keys/provider.management_schema.actions';
        const keys = () => this.getKeys(user, panel);
        return [
            Actions.make([this.registerAction(panel), this.removeAction(panel).visible(async () => (await keys()).length > 0)]).key(`${this._id}-actions`)
                .label(t(`${group}.label`))
                .afterLabel(async () => statusBadge((await keys()).length > 0, t(`${group}.messages.enabled`), t(`${group}.messages.disabled`)))
                .aboveContent(async () => {
                    const list = await keys();
                    if (!list.length) return t(`${group}.below_content`);
                    return new HtmlString(`<ul class="nv-security-keys">${list.map((key) => `<li><span class="nv-security-key-name">${e(key.name)}</span> <span class="nv-security-key-meta">${e(t(`${group}.messages.${key.lastUsedAt ? 'last_used' : 'added'}`, { date: String(key.lastUsedAt ?? key.createdAt ?? '').slice(0, 10) }))}</span></li>`).join('')}</ul>`);
                }),
        ];
    }

    /** Adds a key: a name, the ceremony in the browser, and the password. */
    registerAction(panel: Panel): Action {
        const group = 'filament-panels::auth/multi-factor/security-keys/actions/register';
        return Action.make('registerSecurityKey')
            .label(t(`${group}.label`)).color('primary').icon('m-key').link()
            .visible(async (ctx) => { const user = contextOf(ctx.livewire)?.user; return Boolean(user) && (await this.getKeys(user!, panel)).length < this._maxKeys; })
            .modalWidth('md').modalIcon('o-key').modalIconColor('primary')
            .modalHeading(t(`${group}.modal.heading`)).modalDescription(t(`${group}.modal.description`))
            .modalSubmitActionLabel(t(`${group}.modal.actions.submit.label`))
            .closeModalByClickingAway(false)
            .schema([
                TextInput.make('name').label(t(`${group}.modal.form.name.label`)).placeholder(t(`${group}.modal.form.name.placeholder`)).required().maxLength(60),
                SecurityKeyInput.make('credential').mode('register').label(t(`${group}.modal.form.credential.label`)).validationAttribute(t(`${group}.modal.form.credential.validation_attribute`)).required()
                    .optionsUsing(async (field) => {
                        const user = contextOf(field.livewire)?.user;
                        if (!user) return null;
                        const party = this.getRelyingParty(panel, this.requestOf(field));
                        return registrationOptions({
                            rpId: party.id, rpName: party.name, userId: `${panel.getId()}:${userKey(user)}`, userName: user.email, userDisplayName: user.name,
                            challenge: await this.issueChallenge(user, panel, 'register'), excludeCredentials: await this.getKeys(user, panel),
                            userVerification: this._userVerification, residentKey: this._residentKey, authenticatorAttachment: this._authenticatorAttachment, timeout: this._timeout,
                        });
                    }),
                ...(this._confirmsPassword ? [currentPasswordInput('password', t(`${group}.modal.form.password.label`), t(`${group}.modal.form.password.validation_attribute`))] : []),
            ])
            .action(async (ctx) => {
                const user = currentUser(ctx.livewire);
                const path = (ctx.schema?.getFlatComponents?.() ?? []).find((component: any) => component instanceof SecurityKeyInput)?.getStatePath() ?? 'credential';
                const invalid = () => fail(ctx.livewire, path, t(`${group}.modal.form.credential.messages.invalid`));
                if (this.throttle.hit(`${panel.getId()}:${userKey(user)}`) > 0) fail(ctx.livewire, path, t(`${group}.modal.form.credential.messages.rate_limited`));
                if ((await this.getKeys(user, panel)).length >= this._maxKeys) return;
                let response: any;
                try { response = JSON.parse(String(ctx.data.credential)); } catch { invalid(); }
                const challenge = await this.consumeChallenge(response, user, panel, 'register');
                if (!challenge) invalid();
                const party = this.getRelyingParty(panel, contextOf(ctx.livewire).req);
                let credential;
                try {
                    credential = verifyRegistration(response, { challenge: challenge!, origin: party.origins, rpId: party.id, requireUserVerification: this._userVerification === 'required' });
                } catch (error) {
                    if (error instanceof WebAuthnError) invalid();
                    throw error;
                }
                if ((await this.getKeys(user, panel)).some((key) => key.credentialId === credential!.credentialId)) invalid();
                await this.getStore(panel).createSecurityKey(user, {
                    name: String(ctx.data.name).trim().slice(0, 60), credentialId: credential!.credentialId, publicKey: credential!.publicKey, algorithm: credential!.algorithm,
                    signCount: credential!.signCount, transports: credential!.transports,
                });
                Notification.make().success().title(t(`${group}.notifications.registered.title`)).icon('o-key').send();
            });
    }
    /** Removes one of the user's keys, after the password. */
    removeAction(panel: Panel): Action {
        const group = 'filament-panels::auth/multi-factor/security-keys/actions/remove';
        return Action.make('removeSecurityKey')
            .label(t(`${group}.label`)).color('danger').icon('m-trash').link()
            .modalWidth('md').modalIcon('o-trash').modalIconColor('danger')
            .modalHeading(t(`${group}.modal.heading`)).modalDescription(t(`${group}.modal.description`))
            .modalSubmitActionLabel(t(`${group}.modal.actions.submit.label`))
            // The user's keys are read when the modal opens, then kept with the mounted action.
            .mountUsing(async (ctx) => {
                const user = currentUser(ctx.livewire);
                ctx.arguments.keys = (await this.getKeys(user, panel)).map((key) => [String(key.id), String(key.name)]);
            })
            .schema((schema: any) => {
                const mounted = (schema.livewire as any).mountedActions?.find?.((candidate: any) => candidate.name === 'removeSecurityKey');
                const options = Array.isArray(mounted?.arguments?.keys) ? (mounted.arguments.keys as unknown[]).filter((entry): entry is [string, string] => Array.isArray(entry) && entry.length === 2).map(([id, name]) => [String(id), String(name)] as [string, string]) : [];
                return schema.components([
                    Radio.make('key').label(t(`${group}.modal.form.key.label`)).required().options(options),
                    ...(this._confirmsPassword ? [currentPasswordInput('password', t(`${group}.modal.form.password.label`), t(`${group}.modal.form.password.validation_attribute`))] : []),
                ]);
            })
            .action(async (ctx) => {
                const user = currentUser(ctx.livewire);
                const key = (await this.getKeys(user, panel)).find((candidate) => String(candidate.id) === String(ctx.data.key));
                if (!key) return;
                await this.getStore(panel).deleteSecurityKey(user, key.id);
                Notification.make().success().title(t(`${group}.notifications.removed.title`)).send();
            });
    }
}
