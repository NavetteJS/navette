# 12. Limites actuelles

Navette est en cours de portage depuis Filament. Cette page liste ce qui n'existe pas encore, pour éviter de le chercher.

## Fonctions de Filament non portées

| Domaine | Manque |
|---|---|
| Autorisations | Pas de rôles ni d'écran de gestion des droits intégrés (comme Filament) : les points de contrôle existent, la logique est la vôtre. Voir [Permissions](13-permissions.md). |
| Pages | Page de consultation (« View ») d'une resource ; assistant de création en étapes (wizard) ; inscription, mot de passe oublié, profil. |
| Tables | Regroupement de lignes ; export et import ; colonnes modifiables en ligne ; mise en page en grille ou en cartes ; recherche globale du panel. |
| Filtres | Filtre par période prêt à l'emploi ; indicateurs de filtres actifs hors constructeur de requêtes ; contraintes de relation dans le constructeur de requêtes. |
| Formulaires | Champs date-heure et heure ; `Radio` ; étiquettes (`TagsInput`) ; éditeur Markdown ; `Builder` avec en-têtes de bloc (écrit, peu éprouvé) ; création d'une option depuis un sélecteur ; pièces jointes dans le texte riche. |
| Fichiers | Redimensionnement, recadrage, éditeur d'image ; suppression automatique des fichiers retirés. |
| Widgets | Graphiques ; widget de table ; les statistiques existent. |
| Infolists | `TextEntry` et `IconEntry` seulement. |
| Notifications | Notifications en base (cloche) et diffusion en temps réel. |
| Divers | Multi-locataire intégré ; plusieurs panels dans la même application (non éprouvé) ; traduction de vos propres libellés (l'interface du framework est en anglais et en français). |

## Particularités à connaître

- **Node 24 minimum**, TypeScript exécuté sans compilation : pas d'`enum`, de décorateurs ni de propriétés de paramètre.
- **SQLite est le moteur le mieux couvert.** Les opérateurs de date du constructeur de requêtes sont écrits pour lui.
- **Messages de validation en anglais**, au format de Laravel (« The name field is required. »).
- **Dates affichées au format américain** (« Nov 9, 2026 ») par `date()`. Pour un autre format, utilisez `formatStateUsing`.
- **Un widget doit être enregistré** (`static widgets` d'une resource ou `panel.widgets([...])`) avant d'être affiché.
- **La limitation des connexions est en mémoire** : par processus, remise à zéro au redémarrage.
- **Le client Livewire est embarqué** (`livewire.js` 4.4.8), ainsi que les feuilles de style et scripts de Filament 5.11.2, sous leurs licences MIT.

## Où regarder quand la documentation ne suffit pas

- `apps/starter/server.ts` : le cas minimal, testé par `tools/parity/e2e-starter.mjs`.
- `apps/demo/resources/*.ts` : chaque brique dans un cas réel.
- `README.md` à la racine de `navette/` : l'état du portage, tranche par tranche, avec ce qui a été vérifié et ce qui ne l'est pas.
- Les tests (`packages/*/test`) et les parcours (`tools/parity/e2e-*.mjs`) montrent le comportement attendu, cas limites compris.
- La [documentation de Filament](https://filamentphp.com/docs) reste une bonne référence pour l'intention de chaque option : les noms sont les mêmes.
