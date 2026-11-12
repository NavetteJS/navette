// Second panel de la démo, comme `AppPanelProvider` de filamentphp/demo : inscription, mot de passe oublié,
// vérification de l'adresse, équipes (multi-locataire) et page « Settings » propre à chaque équipe.
import path from 'node:path';
import { EmailVerificationPrompt, fileMailer, knexAuthProvider, knexTenantProvider, Login, Page, Panel, RegisterTenant, type User } from '@navette/panels';
import { TextInput } from '@navette/forms';
import type { Schema } from '@navette/schemas';
import { Model } from '@navette/database';

/** Comme App\Filament\App\Pages\RegisterTeam : création d'une équipe, dont l'utilisateur devient membre. */
export class RegisterTeam extends RegisterTenant {
    static getLabel(): string { return 'New team'; }
    formSchema(schema: Schema): Schema { return schema.components([TextInput.make('name').required()]); }
}

/** Comme App\Filament\App\Pages\Settings : une page vide, propre à chaque équipe. */
export class Settings extends Page {
    static slug = 'settings';
    static title = 'Settings';
    static navigationIcon = 'o-document-text';
}

/** `profile` : page de profil (absente de la démo Filament : retirée pour les comparaisons avec l'oracle). */
export function appPanel(options: { key: string; login: typeof Login; demoUser: User & { password: string }; mailLog: string; appUrl: string; profile?: boolean }): Panel {
    const table = (name: string) => Model.knex()(name);
    const users = knexAuthProvider(table);
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
        .auth({
            ...users,
            // Le compte de démonstration (fixture) ouvre le compte n° 1 de la base, dont le mot de passe est une empreinte bcrypt de Laravel.
            attempt: async (email, password) => (email === options.demoUser.email && password === options.demoUser.password ? users.find(options.demoUser.id) : users.attempt(email, password)),
        });
    return options.profile ? panel.profile() : panel;
}
