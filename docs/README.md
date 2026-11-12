# Documentation Navette

Navette sert à construire des back-offices (panels d'administration) en Node.js : listes, formulaires, actions, widgets.
Son API suit celle de Filament (PHP) ; l'interface est la même, rendue côté serveur avec Express et EJS, animée par le client Livewire.

> La démo livrée (`apps/demo`) est une vitrine et un banc de test : elle reproduit la démo de Filament pour vérifier la parité.
> Pour votre projet, partez de `apps/starter`, que cette documentation construit pas à pas.

## Sommaire

1. [Démarrage](01-demarrage.md) — installer, lancer l'application de départ, comprendre sa structure
2. [Le panel](02-panel.md) — marque, couleurs, navigation, authentification, pages
3. [Resources](03-resources.md) — liste, création, édition, onglets, relation managers
4. [Tables](04-tables.md) — colonnes, tri, recherche, filtres, actions, tri manuel
5. [Formulaires](05-formulaires.md) — champs, validation, mise en page, champs dépendants
6. [Actions](06-actions.md) — boutons, modales, confirmations, actions groupées, notifications
7. [Widgets](07-widgets.md) — statistiques, statistiques liées à la table
8. [Données](08-donnees.md) — adaptateur, relations, colonnes calculées, suppression douce
9. [Thèmes](09-themes.md) — couleurs, thèmes au choix, feuille compilée, animations
10. [Fichiers](10-fichiers.md) — téléversement, stockage, médias
11. [Sécurité](11-securite.md) — ce que le framework garantit, ce qui reste à votre charge
12. [Limites actuelles](12-limites.md) — ce qui n'existe pas encore
13. [Permissions](13-permissions.md) — politiques, pages et widgets réservés, brancher son propre système
14. [Étendre le framework](14-etendre.md) — pages personnalisées, crochets, composants sur mesure, render hooks, plugins

## Les paquets

| Paquet | Rôle |
|---|---|
| `@navette-js/panels` | Panel, pages, resources, relation managers, widgets, notifications, routeur Express |
| `@navette-js/tables` | Table, colonnes, filtres, constructeur de requêtes |
| `@navette-js/forms` | Champs de formulaire, validation, téléversement |
| `@navette-js/schemas` | Mise en page : sections, grilles, onglets, groupes |
| `@navette-js/actions` | Actions et groupes d'actions |
| `@navette-js/infolists` | Entrées en lecture seule |
| `@navette-js/database` | Adaptateur de données (Objection / Knex) |
| `@navette-js/support` | Couleurs, icônes, traductions, composants d'interface de base |
| `@navette-js/wire` | Runtime des composants à état (protocole Livewire), téléversements temporaires |

## Conventions

- **Node 24 ou plus.** Les fichiers TypeScript sont exécutés directement par Node, sans compilation. Conséquence : pas d'`enum`, pas de décorateurs, pas de propriétés déclarées dans les paramètres d'un constructeur.
- **API fluente.** Chaque objet se crée par `X.make(...)` et se configure par des appels chaînés qui rendent l'objet.
- **Icônes Heroicons**, nommées par un préfixe et un nom : `o-` contour 24 px, `s-` plein 24 px, `m-` mini 20 px, `c-` micro 16 px. Exemples : `o-home`, `m-pencil-square`, `c-check`. Utilisez `m-` dans les menus et boutons, `c-` dans les liens d'action de ligne et les pastilles.
- **Couleurs sémantiques** : `primary`, `gray`, `info`, `success`, `warning`, `danger`.
