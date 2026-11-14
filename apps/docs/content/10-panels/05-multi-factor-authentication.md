---
title: Multi-factor authentication
---

## Introduction

Users sign in with their email address and password. Multi-factor authentication (MFA) adds a second step: after the password, a user who has set up a second factor must prove their identity again before the panel signs them in.

Navette includes three methods, which you can enable together:

- [App authentication](#app-authentication): a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…), generated from a shared secret (time-based one-time passwords, RFC 6238), with optional single-use [recovery codes](#setting-up-recovery-codes).
- [Email authentication](#email-authentication): a code sent to the user's email address.
- [Security keys](#security-keys): a hardware key (YubiKey, Titan…) or a passkey saved by the device or a password manager (WebAuthn).

Users set up their methods on their [profile page](/panels/users#editing-the-profile): enabling MFA adds a "Two-factor authentication" section to it, with the status of each method and the actions to set it up or turn it off.

```ts
import { AppAuthentication, EmailAuthentication, knexAuthProvider, Panel, SecurityKeyAuthentication } from '@navette-js/panels';

Panel.make()
    .auth(knexAuthProvider(knex))
    .login()
    .profile()
    .multiFactorAuthentication([
        AppAuthentication.make().recoverable(),
        EmailAuthentication.make(),
        SecurityKeyAuthentication.make(),
    ]);
```

When a user with at least one method set up signs in, the login page asks for their password as usual, then shows "Verify your identity" with the fields of their method. A user with several methods first picks one. The session cookie is only set once the second step succeeds; the password is checked again at that point, so a password changed in the meantime ends the attempt.

## Storing the data

The methods store their data through the panel's user provider. [`knexAuthProvider()`](/panels/users#using-the-knex-user-provider) implements everything they need, in three columns of the `users` table (`app_authentication_secret`, `app_authentication_recovery_codes`, `has_email_authentication`) and a `security_keys` table. Create them with `multiFactorAuthenticationSchema()` in a migration; it only adds what is missing, so it can run more than once:

```ts
import type { Knex } from '@navette-js/database';
import { multiFactorAuthenticationSchema } from '@navette-js/panels';

export async function up(db: Knex): Promise<void> {
    await multiFactorAuthenticationSchema(db);
}
```

Projects created with `npm create navette` already have this migration, and their panels enable the three methods.

The column and table names can be changed, as long as the migration and the provider agree:

```ts
import { knexAuthProvider, multiFactorAuthenticationSchema } from '@navette-js/panels';

await multiFactorAuthenticationSchema(db, { usersTable: 'accounts', securityKeysTable: 'account_keys', appAuthenticationSecretColumn: 'totp_secret', appAuthenticationRecoveryCodesColumn: 'totp_recovery_codes' });

const users = knexAuthProvider((table) => knex(table), { table: 'accounts', securityKeysTable: 'account_keys', appAuthenticationSecretColumn: 'totp_secret', appAuthenticationRecoveryCodesColumn: 'totp_recovery_codes' });
```

### Using your own storage

With your own user provider, implement the methods of the methods you enable. Navette encrypts the secret and hashes the recovery codes before handing them over: store the strings as they are.

```ts
import type { AuthProvider } from '@navette-js/panels';

const users: AuthProvider = {
    // attempt(), find()… as usual

    // App authentication
    getAppAuthenticationSecret: async (user) => (await db.users.find(user.id)).totpSecret,
    saveAppAuthenticationSecret: async (user, secret) => { await db.users.update(user.id, { totpSecret: secret }); },
    // Recovery codes (with recoverable())
    getAppAuthenticationRecoveryCodes: async (user) => (await db.users.find(user.id)).recoveryCodes,
    saveAppAuthenticationRecoveryCodes: async (user, codes) => { await db.users.update(user.id, { recoveryCodes: codes }); },

    // Email authentication
    hasEmailAuthentication: async (user) => (await db.users.find(user.id)).emailCodes,
    saveEmailAuthentication: async (user, enabled) => { await db.users.update(user.id, { emailCodes: enabled }); },

    // Security keys
    getSecurityKeys: async (user) => db.securityKeys.where({ userId: user.id }),
    createSecurityKey: async (user, key) => { await db.securityKeys.insert({ ...key, userId: user.id }); },
    updateSecurityKey: async (user, id, changes) => { await db.securityKeys.update({ id, userId: user.id }, changes); },
    deleteSecurityKey: async (user, id) => { await db.securityKeys.delete({ id, userId: user.id }); },
};
```

A method may also keep its data elsewhere than the user provider, with `store()`:

```ts
import { AppAuthentication, SecurityKeyAuthentication } from '@navette-js/panels';

AppAuthentication.make().store({
    getAppAuthenticationSecret: (user) => vault.read(`totp/${user.id}`),
    saveAppAuthenticationSecret: (user, secret) => vault.write(`totp/${user.id}`, secret),
});

SecurityKeyAuthentication.make().store(mySecurityKeyRepository);
```

The panel checks at startup that the storage it needs exists, and refuses to start otherwise.

<Aside variant="warning">
`updateSecurityKey()` and `deleteSecurityKey()` receive the user: only change the keys of that user. The credential id of a key must be unique across all users (`multiFactorAuthenticationSchema()` adds a unique index).
</Aside>

## App authentication

`AppAuthentication` asks for a 6-digit code from an authenticator app. To set it up, the user scans a QR code (or types the secret), enters a code from the app and their current password. To turn it off, they enter a code (or a recovery code) and their password.

```ts
import { AppAuthentication, Panel } from '@navette-js/panels';

Panel.make()
    .multiFactorAuthentication([
        AppAuthentication.make(),
    ]);
```

The QR code is generated by Navette, as an SVG image: no external service sees the secret.

### Setting up recovery codes

A user who loses their phone can no longer sign in. `recoverable()` gives them single-use recovery codes when they set the app up, to sign in without it. They are shown once; Navette only stores their hash, and removes each code when it is used.

```ts
AppAuthentication.make()
    .recoverable()
```

#### Changing the number of recovery codes

Eight codes are generated by default:

```ts
AppAuthentication.make()
    .recoverable()
    .recoveryCodeCount(10)
```

To generate them yourself, return them from `generateRecoveryCodesUsing()`:

```ts
import { randomBytes } from 'node:crypto';

AppAuthentication.make()
    .recoverable()
    .generateRecoveryCodesUsing(() => Array.from({ length: 8 }, () => randomBytes(6).toString('hex')))
```

#### Preventing users from regenerating their recovery codes

Users can regenerate their codes from their profile (after entering a code from the app and their password); the old codes stop working at once. To remove that option:

```ts
AppAuthentication.make()
    .recoverable()
    .regenerableRecoveryCodes(false)
```

### Changing the app code window

A code changes every 30 seconds. To allow for clocks that are slightly off, the code before and the code after the current one are also accepted. `codeWindow()` sets how many codes are accepted on each side:

```ts
AppAuthentication.make()
    .codeWindow(2) // ±60 seconds
```

Each code is accepted once: after a successful sign-in, that code and the earlier ones are refused, so a code seen over a shoulder cannot be replayed.

Authenticator apps expect 6 digits, 30 seconds and SHA-1. Change them only if all the apps your users have support it:

```ts
AppAuthentication.make()
    .codeOptions({ digits: 8, period: 30, algorithm: 'sha256' })
```

### Customizing the app authentication brand name

The app shows the account under the name of the panel ([`brandName()`](/panels/configuration)). To show another name:

```ts
AppAuthentication.make()
    .brandName('Acme Admin')
```

### Encryption of the secret

The secret is encrypted (AES-256-GCM) with a key derived from the panel's [`key()`](/panels/configuration) before it is stored. Changing the panel key makes the stored secrets unreadable: the users concerned can then only sign in with a recovery code, and set the app up again.

## Email authentication

`EmailAuthentication` sends a 6-digit code to the user's email address, through the panel's [mailer](/panels/users#sending-emails). The code is sent when the challenge appears (or when the user picks this method), and the user can ask for a new one. To turn the method on or off, the user enters a code sent when the modal opens.

```ts
import { EmailAuthentication, Panel } from '@navette-js/panels';

Panel.make()
    .mailer(smtpMailer)
    .multiFactorAuthentication([
        EmailAuthentication.make(),
    ]);
```

A code works once, only for the user it was sent to, and only the last code sent is valid. At most two codes are sent per minute and per user.

### Changing the email code expiration time

A code is valid for 4 minutes:

```ts
EmailAuthentication.make()
    .codeExpiryMinutes(2)
```

### Customizing email code generation

```ts
import { randomInt } from 'node:crypto';

EmailAuthentication.make()
    .generateCodeUsing(() => String(randomInt(100_000_000)).padStart(8, '0'))
```

Pass `null` to restore the default generator. Codes of 4 to 12 digits are accepted.

### Sending the code yourself

To use your own email template, or another channel, send the code with `sendCodeUsing()`; the panel's mailer is then not used:

```ts
EmailAuthentication.make()
    .sendCodeUsing(async (user, code, minutes) => {
        await mailer.send({ to: user.email, template: 'sign-in-code', data: { code, minutes } });
    })
```

Pending codes are kept in memory, hashed; with several instances, use a [shared cache store](#running-several-instances).

## Security keys

`SecurityKeyAuthentication` lets users register security keys and passkeys, and use one of them to sign in. A user can register several keys (10 at most by default), each with a name; the profile lists them with the date they were added or last used.

```ts
import { Panel, SecurityKeyAuthentication } from '@navette-js/panels';

Panel.make()
    .multiFactorAuthentication([
        SecurityKeyAuthentication.make(),
    ]);
```

To add a key, the user names it, clicks "Use my security key" and follows the browser's instructions (touch the key, use a fingerprint…), then confirms with their password. At sign-in, the browser asks for the key as soon as the challenge appears.

<Aside variant="warning">
Browsers only offer WebAuthn in a secure context: HTTPS, or `http://localhost` in development. Keys are bound to a domain: an IP address such as `127.0.0.1` cannot be used, open the panel through `localhost` instead.
</Aside>

### Setting the relying party

Keys are bound to a domain, the relying party id. By default, Navette uses the host the user's browser asked for, and the scheme of the [application URL](/panels/users#setting-the-application-url) when it has the same host (behind a proxy that terminates TLS, the request itself says `http`). To share keys between subdomains, or behind a proxy that changes the host, set them explicitly:

```ts
SecurityKeyAuthentication.make()
    .relyingPartyId('example.com')
    .relyingPartyName('Acme')
    .origins(['https://admin.example.com', 'https://app.example.com'])
```

### Requiring user verification

By default, the key verifies the user (PIN, fingerprint) when it can. To require it:

```ts
SecurityKeyAuthentication.make()
    .userVerification('required')
```

### Choosing the kind of key

```ts
SecurityKeyAuthentication.make()
    // Only keys built into the device (Touch ID, Windows Hello…), or only removable ones: 'cross-platform'.
    .authenticatorAttachment('platform')
    // Ask for a passkey (a discoverable credential) when registering.
    .residentKey('preferred')
    .maxKeys(5)
    .timeout(60_000) // milliseconds the browser waits for the key
```

Navette verifies the signature of every sign-in with the public key saved at registration, and the key's counter: a counter that goes backwards reveals a cloned key, which is refused. Attestation statements are not checked: a key proves that the user holds it, not which model it is.

## Requiring multi-factor authentication

By default, multi-factor authentication is optional. To require it, pass `isRequired: true`: a signed-in user who has not set up any method is sent to a "Set up two-factor authentication" page, and cannot open any other page of the panel (their profile included) until they have.

```ts
import { AppAuthentication, Panel } from '@navette-js/panels';

Panel.make()
    .multiFactorAuthentication([
        AppAuthentication.make().recoverable(),
    ], { isRequired: true });
```

The page is served at `/multi-factor-authentication/set-up`. To change it, extend `SetUpRequiredMultiFactorAuthentication` and pass it as `setUpPage`:

```ts
import { SetUpRequiredMultiFactorAuthentication } from '@navette-js/panels';

class SetUpSecurity extends SetUpRequiredMultiFactorAuthentication {
    getSubheading(): string | null { return 'Our security policy requires a second factor for every account.'; }
}

panel.multiFactorAuthentication([AppAuthentication.make()], { isRequired: true, setUpPage: SetUpSecurity });
```

## Running several instances

Short-lived values are kept in memory by default: the last accepted app code of each secret (so that it cannot be used twice), the pending email codes, and the pending security key challenges (between the page asking for the key and the answer). With several processes behind a load balancer, keep them in a shared store, such as Redis:

```ts
import { useMultiFactorCacheStore, type MultiFactorCacheStore } from '@navette-js/panels';

const store: MultiFactorCacheStore = {
    get: async (key) => JSON.parse((await redis.get(key)) ?? 'null') ?? undefined,
    put: async (key, value, ttlSeconds) => { await redis.set(key, JSON.stringify(value), { EX: ttlSeconds }); },
    forget: async (key) => { await redis.del(key); },
};

// For every method…
useMultiFactorCacheStore(store);
// … or for one of them.
AppAuthentication.make().cacheStore(store);
```

The attempt counters (five challenge answers per minute and per user) are kept per process too: see [security](/panels/users#security).

## Creating a custom multi-factor authentication provider

A method is an object implementing `MultiFactorAuthenticationProvider`: an SMS code, a code sent by email, a push notification… Here, a code sent by SMS (for an email code, use the built-in [email authentication](#email-authentication)):

```ts
import { randomInt } from 'node:crypto';
import { Actions, Text } from '@navette-js/schemas';
import { Action } from '@navette-js/actions';
import { OneTimeCodeInput } from '@navette-js/forms';
import type { MultiFactorAuthenticationProvider, Panel, User } from '@navette-js/panels';

export class SmsAuthentication implements MultiFactorAuthenticationProvider {
    private codes = new Map<string, { code: string; expires: number }>();

    getId(): string { return 'sms'; }

    getLoginFormLabel(): string { return 'Text me a code'; }

    async isEnabled(user: User): Promise<boolean> {
        return Boolean(await phones.numberOf(user.id));
    }

    async beforeChallenge(user: User): Promise<void> {
        const code = String(randomInt(1_000_000)).padStart(6, '0');
        this.codes.set(String(user.id), { code, expires: Date.now() + 5 * 60_000 });
        await sms.send(await phones.numberOf(user.id), `Your code: ${code}`);
    }

    getChallengeFormComponents(user: User) {
        return [
            OneTimeCodeInput.make('code').label('Code sent by SMS').required()
                .rule({
                    name: 'sms_code',
                    passes: (value) => {
                        const pending = this.codes.get(String(user.id));
                        const valid = Boolean(pending && pending.expires > Date.now() && pending.code === value);
                        if (valid) this.codes.delete(String(user.id));
                        return valid;
                    },
                    message: () => 'The code is invalid or expired.',
                }),
        ];
    }

    getManagementSchemaComponents(user: User, panel: Panel) {
        return [
            Actions.make([
                Action.make('removePhone').label('Remove my phone number').color('danger').link().requiresConfirmation()
                    .visible(() => this.isEnabled(user))
                    .action(async () => { await phones.remove(user.id); }),
            ]).key('sms-actions').label('Text messages')
                .belowContent('Receive a code by SMS when you sign in.'),
        ];
    }
}
```

| Method | Role |
|---|---|
| `getId()` | Unique id (letters, digits, `-`, `_`): the challenge fields live under `data.multiFactor.<id>`. |
| `getLoginFormLabel()` | The option shown in the picker, when the user has several methods. |
| `isEnabled(user, panel)` | Whether the user has set the method up. |
| `getChallengeFormComponents(user, panel)` | Fields of the challenge. Their validation rules decide: the user is signed in only if they pass. |
| `beforeChallenge(user, panel)` | Optional: runs when the challenge appears (send the code). |
| `getManagementSchemaComponents(user, panel)` | Components of the profile section. Give an `Actions` component a `key()`: its actions can then open modals. |
| `checkConfiguration(panel)` | Optional: called when the panel starts; throw if something is missing. |

Register it like the built-in methods:

```ts
panel.multiFactorAuthentication([AppAuthentication.make(), new SmsAuthentication()]);
```

### The one-time code field

`OneTimeCodeInput` shows one box per digit, with the browser's one-time code autocompletion on the first box. Its state is a string of digits, validated on the server: it must have exactly `length()` digits (6 by default; leading zeros are kept). `submitOnCompletion()` submits the form as soon as the last digit is typed, and `readOnly()` shows the code without letting the user change it:

```ts
import { OneTimeCodeInput } from '@navette-js/forms';

OneTimeCodeInput.make('code')
    .label('Code sent by SMS')
    .length(8)
    .submitOnCompletion()
    .required()
```

```preview
// state: {"code": "1234"}
OneTimeCodeInput.make('code')
    .label('Code sent by SMS')
    .length(8)
    .submitOnCompletion()
```

### Extending the built-in methods

`AppAuthentication` and `SecurityKeyAuthentication` are classes: extend them to change one part, such as the actions of the profile section or the fields of the challenge.

```ts
import { AppAuthentication, type Panel, type User } from '@navette-js/panels';

class CompanyAppAuthentication extends AppAuthentication {
    getManagementSchemaComponents(user: User, panel: Panel) {
        return [...super.getManagementSchemaComponents(user, panel), helpLink()];
    }
}
```

Each method can also be registered twice with different settings, under another `id()`.

## Using the building blocks

The pieces of the built-in methods are exported, to build your own flows (a confirmation before a sensitive action, an API sign-in…).

```ts
import { generateTotpSecret, totpCode, totpUri, verifyTotp, qrCodeSvg, qrCodeDataUri } from '@navette-js/panels';

const secret = generateTotpSecret();
const uri = totpUri(secret, 'ada@example.com', 'Acme');
const svg = qrCodeSvg(uri);          // an <svg> document
const src = qrCodeDataUri(uri);      // for an <img src>

// The matched time step, or null. Store it and pass it as `after` to refuse a code that was already used.
const step = verifyTotp(secret, '492039', { window: 1, after: lastStep });
```

```ts
import { authenticationOptions, generateChallenge, registrationOptions, verifyAuthentication, verifyRegistration } from '@navette-js/panels';

// Registration: send the options to navigator.credentials.create(), then check the answer.
const challenge = generateChallenge();
const options = registrationOptions({ rpId: 'example.com', rpName: 'Acme', userId: String(user.id), userName: user.email, challenge });
const credential = verifyRegistration(response, { challenge, origin: 'https://example.com', rpId: 'example.com' });
// → { credentialId, publicKey, algorithm, signCount, transports, … }: store it.

// Sign-in: navigator.credentials.get(), then check the answer against the stored credential.
const result = verifyAuthentication(answer, { challenge, origin: 'https://example.com', rpId: 'example.com', credential });
// → { signCount }: store the new counter.
```

`verifyRegistration()` and `verifyAuthentication()` throw a `WebAuthnError` when the answer is not valid. Your code must keep each challenge for one use only, and for the user it was issued to.

The `SecurityKeyInput` form field runs the browser side of a ceremony: its state is the answer of the browser, as JSON.

```ts
import { SecurityKeyInput } from '@navette-js/panels';

SecurityKeyInput.make('credential')
    .mode('authenticate') // or 'register'
    .optionsUsing(async (field) => authenticationOptions({ rpId: 'example.com', challenge: await issueChallengeFor(user), allowCredentials: keys }))
    .submitOnSuccess()
```

## Security

What Navette does for you:

- the session is only created after the second step, and the password is checked again then;
- five challenge answers per minute and per user, on top of the five login attempts per minute and per IP address;
- each app code accepted once; recovery codes hashed, single use, and removed atomically within a process;
- the app secret encrypted at rest, and never sent to a third party (the QR code is generated by the server);
- setting up, regenerating and turning off require the current password, and a code for the last two (`confirmsPassword(false)` removes the password, for accounts without one);
- security key challenges random, single use, bound to the user, the panel and the purpose; origin, relying party, user presence, signature and counter checked at every use.

What remains for you to do:

- serve the panel over HTTPS, with a long random [`key()`](/panels/configuration);
- with several instances, a [shared cache store](#running-several-instances), and attempt limits at the proxy level;
- decide how users who lost every factor get their account back: an administrator can clear `app_authentication_secret` and delete their security keys.
