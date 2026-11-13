---
title: Users
---

## Introduction

A panel does not know your users. You give it a **user provider**, an object that checks credentials and finds users, and you choose which authentication pages it offers: login, registration, password reset, email verification and profile.

```ts
import { knexAuthProvider, Panel } from '@navette-js/panels';
import { sqlite } from '@navette-js/database';

const knex = sqlite('./database.sqlite');

const panel = Panel.make()
    .id('app')
    .path('app')
    .key(process.env.APP_KEY!)
    .appUrl('https://example.com')
    .auth(knexAuthProvider(knex))
    .login()
    .registration()
    .passwordReset()
    .emailVerification()
    .profile()
    .mailer(smtpMailer);
```

## Providing users

The user provider implements the `AuthProvider` interface. Two methods are enough for logging in:

```ts
import { verifyPassword, type AuthProvider } from '@navette-js/panels';

const users: AuthProvider = {
    // Login: returns the user when the credentials are right, otherwise null.
    async attempt(email, password) {
        const row = await knex('users').where({ email }).first();
        return row && (await verifyPassword(password, row.password)) ? { id: row.id, name: row.name, email: row.email } : null;
    },
    // Every request: finds the user of the session. Return null if they no longer exist or no longer have access.
    async find(id) {
        const row = await knex('users').where({ id, is_active: 1 }).first();
        return row ? { id: row.id, name: row.name, email: row.email } : null;
    },
};

panel.auth(users);
```

A user is an object with `id`, `name` and `email`. You may add anything your [authorization rules](/resources/authorization) need, such as a role: the object is passed as is to every check.

The other features need more methods:

| Feature | Methods of the provider |
|---|---|
| Login | `attempt(email, password)`, `find(id)` |
| Registration | `create({ name, email, password })`, `findByEmail(email)` |
| Password reset | `findByEmail(email)`, `update(user, { password })`, `getPasswordFingerprint(user)` |
| Email verification | `hasVerifiedEmail(user)`, `markEmailAsVerified(user)` |
| Profile | `update(user, { name, email, password })` |

`create()` and `update()` receive the password in clear text, and must hash it. `getPasswordFingerprint()` returns a value that changes when the stored password changes: a password reset link dies with the password it was sent for. When a feature is enabled and a method is missing, `panelRouter()` throws an error at startup.

### Using the Knex user provider

`knexAuthProvider()` implements every method for a `users` table in the format of Laravel (`id`, `name`, `email`, `password`, `email_verified_at`, `created_at`, `updated_at`):

```ts
import { knexAuthProvider } from '@navette-js/panels';

panel.auth(knexAuthProvider(knex));
```

The first argument is the Knex instance, or any function that returns a query builder for a table name. Options:

- `table`: the name of the table (`users` by default);
- `verify(password, hash)`: checks a password whose hash was not produced by Navette, for example a bcrypt hash written by a Laravel application. New and changed passwords are always hashed by Navette.

Changing the email address through `update()` clears `email_verified_at`.

### Hashing passwords

`hashPassword()` and `verifyPassword()` hash and check passwords with scrypt and a random salt per password. The comparison runs in constant time, and `verifyPassword()` refuses any hash that is not in its own format:

```ts
import { hashPassword, verifyPassword } from '@navette-js/panels';

const hash = await hashPassword('correct horse battery staple');
await verifyPassword('correct horse battery staple', hash); // true
```

Never store a password in clear text, and never log it.

## Authorizing access to the panel

Use `canAccess()` to choose who may use a panel. It is checked on every request and at login:

```ts
panel.canAccess((user) => user.role === 'admin');
```

A signed-in user who may not use the panel gets a `403` response on its pages, and its login form answers "These credentials do not match our records." for their account, as for a wrong password. Your user provider may also implement `canAccessPanel(user, panel)`, to keep the rule next to the users; when both are set, both must allow the user.

The user object passed to `canAccess()` is the one your provider's `find()` returns: add the fields your rules need (role, permissions, team…) there.

`find()` is called on every request: it is your access checkpoint. Return `null` for an account that must not use the panel (deactivated, not an employee…): the user loses access at their next request.

```ts
async find(id) {
    const row = await knex('users').where({ id }).whereNotNull('approved_at').first();
    return row ? { id: row.id, name: row.name, email: row.email, role: row.role } : null;
},
```

## Authentication features

Each feature is enabled with one method on the panel. They are served under the path of the panel:

| Method | Page | URL |
|---|---|---|
| `login()` | Login | `/login` |
| `registration()` | Registration | `/register` |
| `passwordReset()` | Request a reset link, choose a new password | `/password-reset/request`, `/password-reset/reset` |
| `emailVerification()` | Prompt to verify the address | `/email-verification/prompt` |
| `profile()` | Edit the name, email address and password | `/profile` |
| `multiFactorAuthentication([...])` | A second step after the password: authenticator app or security key ([multi-factor authentication](/panels/multi-factor-authentication)) | `/multi-factor-authentication/set-up` (when required) |

The login page shows a link to the registration page and a "Forgot password?" link when those features are enabled. A logged-in user who opens the login, registration or password reset pages is redirected to the panel.

### Login

`login()` enables the login page. It asks for the email address and the password, and has a "Remember me" checkbox. After five failed attempts in one minute from the same IP address, the page asks the user to wait.

### Registration

`registration()` enables the registration page: name, email address, password and its confirmation. The email address must not be taken, and the password must have at least 8 characters. The new user is logged in; when email verification is enabled, a verification email is sent.

### Password reset

`passwordReset()` adds the "Forgot password?" link. The user types their email address, and receives a link valid for 60 minutes. The link only works once: it stops working as soon as the password changes.

The request page always gives the same answer, whether an account exists for the address or not, so it cannot be used to find out who is registered.

### Email verification

`emailVerification()` sends a signed link to new users. Until they follow it, every page of the panel redirects them to a prompt, where they can ask for the email again (twice per minute at most). The link is valid for 60 minutes, and only for the logged-in user it was sent to.

To let unverified users into the panel while still sending the email, pass `false` as the second argument:

```ts
import { EmailVerificationPrompt } from '@navette-js/panels';

panel.emailVerification(EmailVerificationPrompt, false);
```

### Editing the profile

`profile()` adds a "Profile" item to the user menu, leading to a page where the user changes their name, email address and password. The current password is required to change the email address or the password. The page uses the simple layout by default; pass `false` as the second argument to use the full layout, with the navigation. The form is then split into sections (profile information, password), like the pages of a resource, and [multi-factor authentication](/panels/multi-factor-authentication) gets a section of its own. In a multi-tenant panel, the navigation is the one of the user's first tenant:

```ts
import { EditProfile } from '@navette-js/panels';

panel.profile(EditProfile, false);
```

### Email change verification

With `emailChangeVerification()`, users who change their email address on the profile page must confirm the new address before it is saved: a link is sent to the new address, and the address in the database only changes when the user follows it, signed in. At the same time, an email to the old address offers a link to block the change, which works without signing in, in case someone else made it.

```ts
import { Panel } from '@navette-js/panels';

Panel.make()
    .profile()
    .emailChangeVerification()
```

Both links are valid for 60 minutes. A confirmation link only works for the user who asked, while their address is still the one it was issued for, so it works once. If another account took the new address meanwhile, the change is refused. The new address is marked as verified when it is confirmed. The user provider must implement `update()` and `findByEmail()`; a blocked change is remembered in the [cache store](/panels/multi-factor-authentication#running-several-instances).

## Setting up guest access to a panel

By default, every page of a panel requires a signed-in user. `guestAccess()` lets visitors use the panel without signing in:

```ts
import { Panel } from '@navette-js/panels';

Panel.make()
    .guestAccess()
```

For a visitor, the layout has the navigation but no user menu, notifications or global search. Policies, the `canAccess()` of pages and the panel's [authorization hook](/resources/authorization) are still consulted, with a `null` user: decide there what guests may see.

```ts
import type { Policy } from '@navette-js/panels';

export const postPolicy: Policy = {
    viewAny: () => true,
    view: () => true,
    create: (user) => user !== null,
    update: (user) => user !== null,
    delete: (user) => user?.role === 'admin',
};
```

Guest access is not available in a multi-tenant panel. The login page stays available, so that a panel can serve both visitors and signed-in users.

## Customizing the authentication pages

Each method takes the page class as its first argument. Extend the class to change it:

```ts
import { Login, Register } from '@navette-js/panels';

class DemoLogin extends Login {
    mount(): void {
        super.mount();
        Object.assign(this.data, { email: 'demo@example.com', remember: true });
    }
}

class CompanyRegister extends Register {
    // Validated data, just before the user is created.
    protected mutateFormDataBeforeRegister(data: Record<string, unknown>) {
        return { ...data, email: String(data.email).toLowerCase() };
    }
}

panel.login(DemoLogin).registration(CompanyRegister);
```

The pages are `Login`, `Register`, `RequestPasswordReset`, `ResetPassword`, `EmailVerificationPrompt` and `EditProfile`. Their form is returned by `formSchema(schema)`, and `Register` also has `handleRegistration(data)`, which creates the user (by default with `create()` of the provider).

You can add content around the forms with the `panels::auth.*` [render hooks](/advanced/render-hooks).

## Sending emails

Password reset and email verification send emails. By default, they are written to the console, which is enough during development. In production, give the panel a mailer: an object with a `send(message)` method.

```ts
import nodemailer from 'nodemailer';
import { mailText, type Mailer } from '@navette-js/panels';

const transport = nodemailer.createTransport(process.env.SMTP_URL);

const smtpMailer: Mailer = {
    async send(message) {
        await transport.sendMail({
            from: 'Acme <no-reply@example.com>',
            to: message.to,
            subject: message.subject,
            text: mailText(message),
        });
    },
};

panel.mailer(smtpMailer);
```

A message has a `to` address, a `subject`, `lines` of text, an optional `action` (`label` and `url`) and `outro` lines. `mailText()` renders it as plain text. Navette does not depend on any email library: use the one you like.

`fileMailer(path)` writes each message as a line of JSON in a file. It is useful in tests: the demo's end-to-end tests read the verification links from it.

## Setting the application URL

The links sent by email must be absolute. Give the public address of your application to `appUrl()`:

```ts
panel.appUrl('https://example.com');
```

Without it, Navette uses the address of the request, built from the `Host` header. That header can be forged: in production, always set `appUrl()`, or a password reset link could point to another site.

## Sessions

When a user logs in, the panel sets a cookie named after its auth guard (`navette_web_session`). It contains the id of the user, signed with the key of the panel, and is `HttpOnly`, `SameSite=Lax`, and `Secure` when the request is made over HTTPS. With "Remember me", it lasts 30 days; otherwise, until the browser is closed.

On every request, the panel checks the signature and calls `find()` with the id.

### Sharing the session between panels

Panels share one session by default: they all use the `web` auth guard. A user who signs into one panel is signed into all of them, logging out of one logs out of all of them, and [`canAccess()`](#authorizing-access-to-the-panel) decides which panels they may enter. This is the usual setup for a customer area next to an admin area:

```ts
const users = knexAuthProvider((table) => db(table));

const appPanel = Panel.make().id('app').path('app').key(key).auth(users).login().registration();
const adminPanel = Panel.make().id('admin').path('admin').key(key).auth(users).login()
    .canAccess((user) => user.role === 'admin');
```

Customers sign up and sign in on `/app`. Administrators sign in once, on either panel, and reach `/admin` without signing in again. A customer who opens `/admin` gets a `403` response.

Panels that share a guard must use the same key and the same user provider: otherwise the user id stored in the session of one panel would be read as a user of the other. `panelRouter()` throws an error at startup when this is not the case.

To give panels separate sessions, for example when they use different user tables, give them different guards, or `null` for a session of the panel's own (`navette_<id>_session`):

```ts
const partnerPanel = Panel.make().id('partners').authGuard('partners').auth(partnerUsers);
const kioskPanel = Panel.make().id('kiosk').authGuard(null).auth(kioskUsers);
```

Navette does not add links between panels. To let administrators switch from one panel to the other, add an item to the [user menu](/panels/navigation#customizing-the-user-menu) of each panel, shown only to those who may use the other panel.

Logging out is a `POST` request to `/logout`, protected by a CSRF token.

<Aside variant="warning">
Sessions are not stored on the server. Logging out removes the cookie from the browser, but a copied cookie stays valid until `find()` returns `null` for the user or the key of the panel changes. Changing the password does not end the other sessions of the user.
</Aside>

## Setting up user avatars

By default, the avatar of a user is generated by the [ui-avatars.com](https://ui-avatars.com) service from their initials: the browser of the user sends their initials to that service. To use your own avatars, extend `Panel` and override `getUserAvatarUrl()`:

```ts
import { Panel, type User } from '@navette-js/panels';

class AppPanel extends Panel {
    getUserAvatarUrl(user: User): string {
        return typeof user.avatar_url === 'string' ? user.avatar_url : `/avatars/${user.id}.svg`;
    }
}

const panel = new AppPanel().id('app') /* ... */;
```

## Security

What Navette does for you:

- passwords hashed with scrypt by `knexAuthProvider()`, compared in constant time; an unknown email address takes as long to check as a known one;
- five login attempts per minute and per IP address; two registrations, two reset requests and two password changes per minute and per IP address; two verification emails per minute and per user;
- password reset and verification links signed with the key of the panel, limited to 60 minutes, and bound to their purpose and to their panel;
- the same answer to a password reset request whether the account exists or not;
- the current password required to change the email address or the password on the profile page;
- an optional second factor: see [multi-factor authentication](/panels/multi-factor-authentication).

What remains for you to do:

- set a long, random `key()` and `appUrl()` in production, and serve the panel over HTTPS (see [deployment](/advanced/deployment));
- configure a real [mailer](#sending-emails);
- behind a reverse proxy, set `app.set('trust proxy', 1)`: otherwise, every user has the IP address of the proxy, and the login limit applies to everybody at once;
- the attempt counters are kept in memory, per process: with several instances, add a limit at the proxy level.

## Customizing the authentication route slugs

The authentication routes are served under the panel's path. You may change their segments (lowercase letters, digits and dashes); the values shown are the defaults:

```ts
import { Panel } from '@navette-js/panels';

Panel.make()
    .loginRouteSlug('login')
    .logoutRouteSlug('logout')
    .registrationRouteSlug('register')
    .passwordResetRoutePrefix('password-reset')
    .passwordResetRequestRouteSlug('request')
    .passwordResetRouteSlug('reset')
    .emailVerificationRoutePrefix('email-verification')
    .emailVerificationPromptRouteSlug('prompt')
    .emailVerificationRouteSlug('verify')
    .emailChangeVerificationRoutePrefix('email-change-verification')
    .emailChangeVerificationRouteSlug('verify')
    .multiFactorAuthenticationRoutePrefix('multi-factor-authentication')
    .setUpRequiredMultiFactorAuthenticationRouteSlug('set-up')
```

These segments are reserved: in a multi-tenant panel, they are never read as tenant keys.

