// The demo's second panel: registration, password reset, email verification,
// teams (multi-tenancy) and a per-team Settings page.
import path from 'node:path';
import { AppAuthentication, EmailVerificationPrompt, fileMailer, SecurityKeyAuthentication, knexAuthProvider, knexTenantProvider, Login, Page, Panel, RegisterTenant, type AuthProvider, type User } from '@navette-js/panels';
import { TextInput } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';
import { Model } from '@navette-js/database';

/** Creates a team and makes the current user a member. */
export class RegisterTeam extends RegisterTenant {
    static getLabel(): string { return 'New team'; }
    formSchema(schema: Schema): Schema { return schema.components([TextInput.make('name').required()]); }
}

/** An empty page, scoped to each team. */
export class Settings extends Page {
    static slug = 'settings';
    static title = 'Settings';
    static navigationIcon = 'o-document-text';
}

/**
 * Accounts of both panels: the `users` table. The two panels share one session (auth guard `web`), so they must share this
 * provider. The fixture demo account signs in as database user #1 directly, without checking the stored bcrypt hash.
 */
export function demoAuthProvider(demoUser: User & { password: string }): AuthProvider {
    const users = knexAuthProvider((name: string) => Model.knex()(name));
    return { ...users, attempt: async (email, password) => (email === demoUser.email && password === demoUser.password ? users.find(demoUser.id) : users.attempt(email, password)) };
}

/** `profile`: adds the profile page (off for screenshot comparisons). */
export function appPanel(options: { key: string; login: typeof Login; auth: AuthProvider; mailLog: string; appUrl: string; profile?: boolean }): Panel {
    const table = (name: string) => Model.knex()(name);
    const panel = Panel.make()
        .id('app')
        .path('app')
        .key(options.key)
        .brandName('Navette Demo')
        .appUrl(options.appUrl)
        .login(options.login)
        .registration()
        .passwordReset()
        .emailVerification(EmailVerificationPrompt)
        .mailer(fileMailer(path.resolve(options.mailLog)))
        .tenant(knexTenantProvider(table, { label: 'Current team' }))
        .tenantRegistration(RegisterTeam)
        .pages([Settings])
        // Second factor after the password: an authenticator app (with recovery codes) or a security key, set up from the profile.
        .multiFactorAuthentication([AppAuthentication.make().recoverable(), SecurityKeyAuthentication.make()])
        .auth(options.auth);
    return options.profile ? panel.profile() : panel;
}
