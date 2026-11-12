# 13. Permissions

Navette distingue deux questions :

- **Qui est connecté ?** C'est l'authentification (`panel.auth`, voir [Le panel](02-panel.md)).
- **Qu'a-t-il le droit de faire ?** C'est le sujet de cette page.

Comme Filament, Navette ne fournit pas de rôles. Il fournit des **points de contrôle**, qu'il applique partout (menu, boutons, adresses directes, requêtes forgées), et vous y branchez votre logique : une colonne `role`, une table de permissions, un service externe, ce que vous voulez.

## L'utilisateur

`auth.attempt` et `auth.find` rendent l'utilisateur. Ajoutez-y ce dont vos règles ont besoin : il est transmis tel quel à toutes les vérifications.

```ts
panel.auth({
    find: async (id) => {
        const row = await knex('users').where({ id }).first();
        return row ? { id: row.id, name: row.name, email: row.email, role: row.role, teamId: row.team_id } : null;
    },
    attempt: …,
});
```

`find` est appelé à chaque requête : un changement de rôle prend effet immédiatement.

## Politique d'une resource

Une fonction par capacité. Les noms sont ceux de Laravel et Filament.

```ts
import type { Policy } from '@navette/panels';

class TaskResource extends Resource {
    static policy: Policy<Task> = {
        viewAny: (user) => true,
        create: (user) => user.role !== 'reader',
        update: (user, task) => user.role === 'admin' || task?.owner_id === user.id,
        delete: (user) => user.role === 'admin',
        deleteAny: (user) => user.role === 'admin',
    };
}
```

| Capacité | Ce qu'elle gouverne |
|---|---|
| `viewAny` | L'entrée du menu et la page de liste. |
| `create` | Le bouton « New », la page de création, `CreateAction`. |
| `update` | La page d'édition (vérifiée sur l'enregistrement), `EditAction`, le lien « Edit » par défaut. |
| `delete` | `DeleteAction` (ligne et en-tête de la page d'édition). |
| `deleteAny` | `DeleteBulkAction`. |
| `restore`, `forceDelete` | `RestoreAction`, `ForceDeleteAction`. |
| `reorder` | Le tri manuel des lignes. |

Règles :

- **Capacité absente : autorisée.** Sans `policy`, tout utilisateur connecté peut tout.
- Une fonction peut être asynchrone.
- Le second argument est l'enregistrement quand il y en a un (`update`, `delete`…), sinon `null`.
- Un refus masque l'élément **et** fait échouer la requête : la page répond 403, l'action est introuvable pour le serveur.

Un relation manager a sa propre `static policy`, avec les mêmes capacités.

## Vos propres actions

Une action que vous écrivez ne sait pas quelle capacité elle exige : dites-le avec `authorize`.

```ts
import { can } from '@navette/panels';

Action.make('publish')
    .authorize(({ livewire, record }) => can(livewire, 'update', record))     // une capacité de la politique
    .action(…),

Action.make('export')
    .authorize(({ livewire }) => can(livewire, 'export'))                     // ou une capacité à vous : ajoutez `export` à la politique
    .action(…),
```

`authorize` s'ajoute à `visible` / `hidden` : utilisez ces derniers pour l'état des données (« déjà publié »), `authorize` pour les droits. Dans les deux cas le serveur revérifie avant d'exécuter.

## Pages et widgets

```ts
class AuditPage extends Page {
    static slug = 'audit';
    static canAccess(user: User): boolean { return user.role === 'admin'; }   // absent du menu, 403 en accès direct
}

class RevenueStats extends StatsOverviewWidget {
    static canView(user: User): boolean { return user.role !== 'reader'; }    // absent de la page, chargement refusé
}
```

## Brancher votre propre système

Si vos droits vivent ailleurs (table de permissions, service d'autorisation, règles par locataire), un seul crochet reçoit **toutes** les questions, avant toute politique :

```ts
panel.authorizeUsing(async ({ user, ability, resource, record, page, widget }) => {
    if (user.role === 'superadmin') return true;                  // décide : oui

    if (resource) {
        const name = (resource as typeof Resource).slug;          // 'tasks', 'shop/products'…
        return permissions.has(user.id, `${name}.${ability}`);    // décide : oui ou non
    }
    return undefined;                                             // ne décide pas : canAccess / canView / politique répondent
});
```

| Champ | Contenu |
|---|---|
| `user` | L'utilisateur connecté. |
| `ability` | `viewAny`, `create`, `update`…, vos propres noms, `access` pour une page libre, `view` pour un widget. |
| `resource` | La resource ou le relation manager concerné, sinon `null`. |
| `record` | L'enregistrement visé, sinon `null`. |
| `page`, `widget` | La classe de page ou de widget concernée, sinon `null`. |

Valeur rendue : `true` autorise, `false` refuse, `undefined` laisse répondre la règle locale (politique, `canAccess`, `canView`). Vous pouvez donc tout centraliser dans le crochet, ou ne l'utiliser que pour des règles transversales (super-administrateur, compte suspendu, mode maintenance) et garder des politiques par resource.

## Restreindre les lignes

Une politique répond à « peut-il modifier **cet** enregistrement ? ». Elle ne filtre pas la liste. Pour qu'un utilisateur ne **voie** que ses enregistrements, restreignez l'adaptateur (voir [Données](08-donnees.md)) :

```ts
import { currentUser } from './auth.ts';   // votre façon de connaître l'utilisateur de la requête

static adapter = new ObjectionAdapter(Task, {
    modify: (query) => { const user = currentUser(); if (user?.role !== 'admin') query.where('tasks.team_id', user?.teamId ?? -1); },
});
```

C'est la protection la plus forte : un enregistrement hors de la portée n'existe pas pour la resource, quelle que soit la requête.

> L'adaptateur est un objet partagé : il ne connaît pas l'utilisateur. Rendez-le disponible pendant la requête avec un `AsyncLocalStorage` rempli par un middleware Express placé avant `panelRouter`.

## Ce que le framework ne vérifie pas pour vous

- **Les actions que vous écrivez** sans `authorize` : elles sont ouvertes à tout utilisateur qui voit la table.
- **Les actions groupées** vérifient `deleteAny`, pas `delete` enregistrement par enregistrement. Si vos droits dépendent de la ligne, filtrez les clés dans votre action.
- **Les champs d'un formulaire** : pour réserver un champ, `visible(({ livewire }) => …)` ; un champ masqué n'est pas enregistré.
- **`Attach` / `Detach`** d'un relation manager ne consultent pas la politique : ajoutez `authorize`.

## Tester

Écrivez au moins un parcours par rôle. `tools/parity/e2e-starter.mjs` en donne le modèle : un compte en lecture seule vérifie que les boutons ont disparu, que les adresses directes répondent 403 et que des requêtes forgées ne modifient rien.
