# 2. Le panel

Le panel est l'application d'administration : sa marque, sa navigation, ses pages, la façon de s'y connecter.

```ts
import { Dashboard, NavigationItem, Panel, panelRouter } from '@navette-js/panels';
import { Color } from '@navette-js/support';

const panel = Panel.make()
    .id('admin')
    .key(process.env.APP_KEY!)
    .brandName('Mon dashboard')
    .setColors({ primary: Color.Emerald })
    .login()
    .pages([Dashboard])
    .resources([TaskResource])
    .auth({ attempt, find });
```

## Options

| Méthode | Effet |
|---|---|
| `id('admin')` | Identifiant du panel (nom des cookies, classes CSS). |
| `key(secret)` | Secret de signature des sessions. Obligatoire, long et aléatoire en production. |
| `path('admin')` | Préfixe d'URL (`/admin/tasks`). Sans appel : à la racine. |
| `brandName('…')` | Nom affiché et suffixe des titres de page. |
| `brandLogo(url)`, `darkModeBrandLogo(url)`, `brandLogoHeight('2rem')` | Logo à la place du nom. |
| `favicon(url)` | Icône d'onglet. |
| `setColors({ primary: Color.Blue, gray: '#57534e' })` | Couleurs. Voir [Thèmes](09-themes.md). |
| `font('Inter')` | Police (chargée depuis Bunny Fonts ; second argument : votre propre URL de feuille). |
| `themes([...])`, `theme(url)`, `motion(false)` | Voir [Thèmes](09-themes.md). |
| `maxContentWidth('7xl')` | Largeur maximale du contenu. |
| `login()` | Active la page de connexion (`/login`). On peut passer une sous-classe de `Login`. |
| `auth(provider)` | Vérification des identifiants. Voir plus bas. |
| `pages([...])` | Pages libres (tableau de bord, pages personnalisées). |
| `resources([...])` | Resources. Voir [Resources](03-resources.md). |
| `navigationGroups(['Shop', 'HR'])` | Ordre des groupes du menu. |
| `navigationItems([...])` | Liens supplémentaires dans le menu. |

## Authentification

Le panel ne sait rien de vos utilisateurs. Vous fournissez deux fonctions (synchrones ou asynchrones) :

```ts
panel.auth({
    // Connexion : rend l'utilisateur si les identifiants sont bons, sinon null.
    attempt: async (email, password) => {
        const row = await knex('users').where({ email }).first();
        return row && verifyPassword(password, row.password_hash) ? { id: row.id, name: row.name, email: row.email } : null;
    },
    // À chaque requête : retrouve l'utilisateur de la session. Rendez null s'il n'existe plus ou n'a plus accès.
    find: async (id) => {
        const row = await knex('users').where({ id, is_admin: 1 }).first();
        return row ? { id: row.id, name: row.name, email: row.email } : null;
    },
});
```

- Ne stockez jamais un mot de passe en clair : gardez une empreinte (`scrypt`, `argon2`, `bcrypt`) et comparez en temps constant. L'application de départ montre `scryptSync` + `timingSafeEqual`.
- `find` est votre point de contrôle d'accès : un utilisateur désactivé y devient `null` et perd l'accès à la requête suivante.
- La session est un cookie signé, `HttpOnly`, `SameSite=Lax`. Voir [Sécurité](11-securite.md) pour la mise en production.

Pour préremplir ou personnaliser la page de connexion, héritez de `Login` :

```ts
class MyLogin extends Login {
    mount(): void { super.mount(); this.data.remember = true; }
}
panel.login(MyLogin);
```

## Navigation

Chaque page et chaque resource enregistrée apparaît dans le menu. Les propriétés statiques règlent sa place :

```ts
class TaskResource extends Resource {
    static navigationIcon = 'o-clipboard-document-check';
    static navigationGroup = 'Travail';     // groupe repliable
    static navigationSort = 1;              // ordre dans le groupe
    static navigationBadge = 3;             // pastille fixe…
    static async getNavigationBadge() {     // …ou calculée à chaque affichage
        return String(await Task.query().where('is_done', 0).resultSize());
    }
}
```

Lien libre :

```ts
panel.navigationItems([
    NavigationItem.make('Documentation').url('https://exemple.test/docs').icon('o-book-open').group('Aide').sort(10),
]);
```

Pour qu'une page n'apparaisse pas dans le menu : `static shouldRegisterNavigation = false`.

## Pages personnalisées

Une page est une classe. Son contenu est un schéma (voir [Formulaires](05-formulaires.md) pour la mise en page).

```ts
import { Page } from '@navette-js/panels';
import { Html, Section, type Schema } from '@navette-js/schemas';
import { TextEntry } from '@navette-js/infolists';
import { e } from '@navette-js/support';

class StatusPage extends Page {
    static slug = 'status';
    static title = 'État du service';
    static navigationIcon = 'o-signal';

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Section.make('Base de données').schema([
                TextEntry.make('tasks').label('Tâches').state(async () => String(await Task.query().resultSize())),
            ]),
            // Balisage libre : inséré tel quel. Échappez tout ce qui ne vient pas de vous.
            Html.make(async () => `<p>Dernier contrôle : ${e(new Date().toLocaleString('fr-FR'))}</p>`),
        ]);
    }
}
panel.pages([Dashboard, StatusPage]);
```

À surcharger au besoin : `getHeading()`, `getBreadcrumbs()`, `getHeaderActions()` (voir [Actions](06-actions.md)), `getHeaderWidgets()` (voir [Widgets](07-widgets.md)).

Le tableau de bord est une page comme une autre :

```ts
class Home extends Dashboard {
    static navigationLabel = 'Accueil';
    getHeading(): string { return 'Bonjour'; }
    getHeaderWidgets() { return [SalesStats]; }
}
```

Une page est un composant à état : ses propriétés publiques (celles qui ne commencent pas par `_`) voyagent entre le navigateur et le serveur. Ses méthodes, elles, ne sont appelables depuis le navigateur que si vous les nommez :

```ts
class StatusPage extends Page {
    static callable = ['refreshStatus'];          // s'ajoute aux méthodes appelables de Page
    refreshStatus(): void { … }                   // <button wire:click="refreshStatus">
    private loadSecrets() { … }                   // jamais appelable, quel que soit son nom
}
```

Sans cette liste, l'appel est refusé (et signalé dans la console en développement).

## Monter le panel

```ts
import express from 'express';
import { WireRuntime } from '@navette-js/wire';

const app = express();
app.use(express.static('./public'));                    // vos fichiers statiques
app.use(panelRouter(panel, new WireRuntime({ key })));  // le panel
app.get('/health', (_req, res) => res.send('ok'));      // vos propres routes
```

`WireRuntime` prend la même clé que le panel. Avec des téléversements, donnez-lui aussi un `UploadStore` : voir [Fichiers](10-fichiers.md).
