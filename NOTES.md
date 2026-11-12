# Navette

Clone de FilamentPHP v5 en Node.js (Express + EJS + Tailwind). Nom arrêté le 2026-11-12 (auparavant « Ourdi »). Logo : `apps/demo/brand/build-logo.mjs`.
Architecture : `../ARCHITECTURE.md` et `../adr/`. Base de connaissance : `../filament-kb/`.

> **Vous voulez construire votre propre dashboard ?** Lisez la [documentation](docs/README.md) et partez de `apps/starter`.
> La démo (`apps/demo`) n'est qu'une vitrine et un banc de test de parité avec Filament ; ce fichier-ci suit l'avancement du portage.

## État au 2026-11-12

Neuf tranches verticales, comparées au vrai Filament 5.11.2 (l'oracle, démo locale).

### Page de connexion

| Mesure | Résultat |
|---|---|
| Diff de DOM du `<body>` (98 nœuds, attributs et ordre compris) | 1 écart : le préfixe d'URL du runtime (`/livewire` au lieu de `/livewire-<hash>`) |
| Diff de pixels, desktop clair / sombre (1440×900) | 364 / 385 pixels sur 1 296 000 (0,03 %) |
| Diff de pixels, mobile clair / sombre (390×844) | 364 / 385 pixels sur 329 160 (0,11 %) |
| Origine des pixels différents | Uniquement le texte de l'adresse e-mail préremplie (compte de démonstration différent) |
| Comportement vérifié dans un navigateur | Champs préremplis, bouton « afficher le mot de passe », validation serveur, identifiants refusés, connexion et redirection |

Le `<head>` diffère encore de l'oracle : la démo Filament charge un thème compilé par Vite, Navette charge le thème par défaut précompilé.

### Mise en page du panel (tableau de bord)

| Zone comparée (HTML brut servi) | Nœuds | Écarts |
|---|---|---|
| Navigation latérale (`.fi-sidebar-nav` : 5 groupes, 18 éléments, 6 badges) | 176 | 0 |
| Menu utilisateur (`.fi-user-menu` : avatar, sélecteur de thème, déconnexion) | 34 | 0 |
| En-tête de sidebar (logo) | 6 | 0 |
| Bouton d'ouverture mobile | 4 | 0 |
| En-tête de page (`.fi-header`) | 4 | 0 |

Comportement vérifié dans un navigateur : repli des groupes (mémorisé), menu utilisateur, changement de thème, navigation sans rechargement (`wire:navigate`), élément actif, déconnexion protégée par jeton CSRF.

**Non comparé** : le contenu du tableau de bord (les widgets ne sont pas portés), la recherche globale et le bouton des notifications en base, absents d'Navette ; aucun diff de pixels sur cet écran. Les 17 autres pages de la démo sont des pages d'attente vides ; leurs libellés et badges sont écrits en dur pour reproduire la navigation de l'oracle.

### Liste d'une resource (`Customers`, 1 067 enregistrements, base copiée de la démo Filament)

| Zone comparée (HTML brut servi) | Nœuds | Écarts |
|---|---|---|
| En-tête de page (fil d'Ariane, bouton « New customer ») | 18 | 0 |
| Pagination (aperçu, taille de page, 9 éléments) | 68 | 0 |
| Champ de recherche globale | 9 | 0 |
| Navigation latérale | 153 | 0 |
| Corps de table (en-tête, tri mobile, recherche par colonne, 10 lignes) | 434 | 20 |

Les 20 écarts du corps de table sont l'action de ligne « Send email » (10 lignes × 2 nœuds), qui ouvre une modale et n'est pas portée.
Les icônes sont désormais comparées par leur tracé.

Comportement vérifié dans un navigateur : tri (non trié → croissant → décroissant → non trié), pagination, taille de page, recherche globale, recherche par colonne, colonne calculée par relation (pays).

**Non porté sur cet écran** : barre d'actions groupées, menu des filtres, gestionnaire de colonnes, indicateur de sélection, action « Send email », pages de création et d'édition (les liens « New customer » et « Edit » mènent à une 404), état vide, filtre « corbeille ». Aucun diff de pixels.

### Création et édition d'un enregistrement (`Customers`)

| Zone comparée (HTML brut servi) | Nœuds | Écarts |
|---|---|---|
| Page de création, entière (`.fi-page`) | 102 | 0 |
| Page d'édition : fil d'Ariane | 15 | 0 |
| Page d'édition : formulaire | 81 | 2 |
| Page d'édition : en-tête | 19 | 1 |

Écarts de la page d'édition : la seconde section (« créé le / modifié le », composant `TextEntry` non porté), les actions d'en-tête (envoi d'e-mail, suppression) et la cible du bouton « Cancel » (Filament revient à l'URL précédente, Navette à la liste).

Parcours de bout en bout dans un navigateur Playwright (`tools/parity/e2e-customers.mjs`, 5 étapes, toutes vertes) : liste → création → redirection vers l'édition avec la notification « Created » → modification avec « Saved » → fermeture d'une notification → retour à la liste et recherche du client créé.
Vérifié aussi : erreurs « champ requis », unicité de l'e-mail (y compris en excluant l'enregistrement édité), « créer et créer un autre », 404 sur un enregistrement inexistant.

**Non porté** : relation managers, actions d'en-tête de l'édition, suppression, `TextEntry`, sélecteur de date JavaScript (le sélecteur natif est utilisé, comme dans la démo), avertissement de modifications non enregistrées. Les notifications n'ont pas été comparées au DOM de l'oracle. Le formulaire ne charge que les champs déclarés, alors que Filament y place tous les attributs de l'enregistrement.

### Modales d'action (suppression avec confirmation)

Le protocole a été relevé sur l'oracle (`../filament-kb/_captures/demo-local-modals/exchanges.json`) : `mountAction(nom, arguments, contexte)` répond sans HTML complet, avec le seul fragment `effects.partials["action-modals"]` et l'événement `sync-action-modals` ; `unmountAction` re-rend le composant. Navette suit le même échange : pile `mountedActions` dans l'état du composant, modales rendues côté serveur, JavaScript de Filament inchangé.

| Mesure | Résultat |
|---|---|
| DOM de la modale ouverte, comparé à l'oracle (25 nœuds, après exécution du JS) | 1 écart : le nom du client dans le titre (enregistrement différent) |
| Parcours Playwright, 7 étapes | toutes vertes |

Étapes ajoutées au parcours : ouverture de la modale, fermeture par « Cancel », fermeture par Échap, confirmation → suppression en base, retour à la liste avec la notification « Deleted », client introuvable à la recherche.

**Non porté** : modales avec formulaire (action « Send email »), modales imbriquées, slide-overs, largeurs et alignements autres que la confirmation centrée, actions de table et actions groupées, `requiresConfirmation` sur autre chose qu'une action d'en-tête de page. Pas d'autorisation : toute personne connectée peut supprimer.

### Sélection de lignes et actions groupées

Protocole relevé sur l'oracle (`../filament-kb/_captures/demo-local-table/exchanges.json`) : la sélection vit dans le navigateur et part avec l'appel (`updates: { selectedTableRecords: [...] }` + `mountAction('delete', {}, { table: true, bulk: true })`).

| Zone comparée | Nœuds | Écarts |
|---|---|---|
| Indicateur de sélection | 12 | 1 (artefact du normaliseur du diff sur une clé ; balisage identique) |
| Barre d'outils de la table (menu groupé + recherche) | 26 | 2 : les menus « filtres » et « colonnes », non portés |
| Modale de suppression groupée, ouverte | 25 | 1 (attribut `style=""` posé par le JS au moment de la capture) |

Parcours Playwright `e2e-bulk.mjs`, 6 étapes vertes : compteur de sélection, « Select all » / « Deselect all », annulation de la modale sans suppression, suppression groupée de 2 lignes (vérifiée en base : exactement 2 de moins), suppression du dernier résultat filtré.

**Sécurité des tests** : les parcours tournent désormais par `node tools/parity/run-e2e.mjs`, sur une instance jetable et une **copie** de la base ; `e2e-bulk.mjs` refuse de s'exécuter sur une autre base. Cette règle vient d'un incident : une première version du test a supprimé 10 vrais clients de la base de démo (restaurée depuis la base d'origine).

**Écart avec la démo Filament** : celle-ci remplace la suppression groupée des clients par une notification humoristique ; la démo Navette supprime réellement.

**Non porté** : filtres, gestionnaire de colonnes, autres actions groupées, sélection par groupe, limite de sélection. Le mode « tout sélectionner » (suivi des désélections) est codé côté serveur mais n'est couvert par aucun test de suppression.

### Filtres, suppression douce et gestionnaire de colonnes

| Zone comparée (HTML brut servi) | Nœuds | Écarts |
|---|---|---|
| Barre d'outils complète de la table | 89 | 0 |
| Menu des filtres (formulaire du filtre « corbeille » compris) | 44 | 0 |
| Gestionnaire de colonnes | 19 | 0 |
| **Page de liste entière** (`.fi-page`) | 636 | 23 |

Les 23 écarts de la page entière : l'action de ligne « Send email » (20), l'emplacement du conteneur des modales (2 ; Filament le place dans la table, Navette au niveau de la page) et un artefact du normaliseur du diff (1).

Portés : champ `Select` natif, groupe à état de schéma, filtres différés (`tableDeferredFilters` → « Apply filters » → `tableFilters`), `TrashedFilter`, badge du nombre de filtres actifs, suppression douce dans l'adaptateur (`deleted_at`), colonnes masquables (`toggleable()`), état `tableColumns`.
La vue du gestionnaire de colonnes est reprise telle quelle du HTML servi par Filament (elle est rendue par Alpine), avec identifiant, libellés et classes de couleur substitués.

Parcours Playwright `e2e-filters.mjs`, 8 étapes vertes : liste par défaut sans les supprimés, filtre choisi mais non appliqué, « Only deleted », « With deleted », « Reset », masquage puis rétablissement d'une colonne, suppression douce vérifiée en base.
Suite complète : `node tools/parity/run-e2e.mjs`, 21 étapes sur 21, trois exécutions de suite.

**Non porté** : indicateurs de filtres actifs au-dessus de la table, autres types de filtres, restauration et suppression définitive d'un enregistrement supprimé, réordonnancement des colonnes, persistance des filtres et colonnes en session ou dans l'URL, état vide de la table. Le sélecteur avec recherche de Filament n'est pas porté : seul le `<select>` natif existe.

### État vide, section d'information, restauration et suppression définitive

- **État vide de la table** (recherche sans résultat) : en-tête et ligne de recherche par colonne conservés, sans cases à cocher ni pagination, bloc « No customers ». Comparé au HTML réel : 0 écart sur le bloc d'état vide (7 nœuds).
- **`TextEntry`** (nouveau paquet `infolists`) et dates relatives à la manière de `diffForHumans()` : la section « Created at / Last modified at » de la page d'édition est identique à celle de Filament, textes compris (« 2 months ago », « 1 month ago »).
- **`RestoreAction`** et **`ForceDeleteAction`** sur la page d'édition, visibles seulement pour un enregistrement supprimé ; `DeleteAction` masquée dans ce cas.
- **Sécurité** : une action masquée ne peut être ni montée ni exécutée. Un test forge l'appel `mountAction('forceDelete')` sur un client non supprimé et vérifie le refus (403).

Parcours Playwright `e2e-trash.mjs`, 7 étapes vertes. Suite complète : 28 étapes sur 28.

**Non comparé à l'oracle** : les boutons et modales « Restore » et « Force delete » (aucun client supprimé dans la base de l'oracle, que je n'ai pas voulu modifier) ; leurs libellés viennent des traductions de Filament, leur icône de modale est une supposition.

### Deuxième resource : « Departments » (resource simple)

- **Resource simple** (`static isSimple = true`, équivalent de `ManageRecords`) : une seule page, la ligne monte l'action `edit` au lieu de mener à une page.
- **Colonnes** : base commune `Column`, `alignEnd()`, `money('usd')`, `placeholder()`, **`ColorColumn`**, **`IconColumn().boolean()`**.
- **`ActionGroup`** en menu déroulant de ligne, actions à libellé, icône et couleur dépendant de l'enregistrement, `recordClasses()` (ligne rouge en dépassement d'effectif).
- Actions de ligne montées avec la clé de l'enregistrement, revérifiée en base : un appel forgé sur une clé inexistante est refusé (404).
- Comparé au HTML réel : table **0 écart sur 649 nœuds** ; page entière 3 écarts sur 772, déjà connus (conteneur des modales, normaliseur).

- **Formulaire dans la modale d'une action** : `Action.schema()`, `fillForm()`, `modalWidth()` ; état sous `mountedActions.<n>.data`, schéma `mountedActionSchema<n>` (comme Filament) ; validation côté serveur avant exécution.
- `TextInput` : `numeric()`, `integer()`, `minValue()`, `maxValue()`, `prefix()`, `live({ onBlur })`.
- « Adjust budget » fonctionne de bout en bout ; sa modale comparée à l'oracle : 39 nœuds, 2 écarts (attribut `style=""` posé par Alpine, selon l'instant de capture).

- **« New department » et « Edit » en modale** (`CreateAction`, `EditAction`) avec le formulaire de la resource ; « Create & create another » garde la modale ouverte sur un formulaire remis à zéro.
- **Nouveaux champs** : `Textarea`, `Toggle`, `ColorPicker`, `Select.searchable()` (sélecteur JavaScript de Filament, qui interroge le serveur par `callSchemaComponentMethod` ; seules les méthodes que le champ déclare exposées sont appelables).
- **Champ réactif** : `live({ onBlur })` + `afterStateUpdated(({ set }) => …)` — le slug suit le nom à la création ; le serveur ne renvoie alors que la modale (`action-modals.<n>`), comme Filament.
- `disabled().dehydrated()`, `columnStart()`, règle `unique` dans une modale (le slug déjà pris est refusé).
- Modales comparées à l'oracle : « Edit » 163 nœuds, « New department » 165 nœuds ; les seuls écarts (9 et 10) sont les identifiants aléatoires que le JavaScript du sélecteur génère à chaque chargement, et un `style=""` posé par Alpine.

Parcours `e2e-departments.mjs`, 18 étapes vertes. Suite complète : 46 étapes sur 46.

**Écart assumé** : le `wire:key` du sélecteur porte une empreinte des options calculée autrement que par `md5(serialize())` de PHP (même rôle, valeur différente).

La ligne en dépassement d'effectif (`bg-danger-50 dark:bg-danger-950/50`) s'affiche depuis l'arrivée du thème compilé (voir « Thème Tailwind »).

### Relation managers (composants imbriqués, chargement différé)

- **Runtime** : composants enfants (`mountChild()`, `memo.children`, souche `<div wire:id wire:name wire:key>` au re-rendu) et chargement différé (`placeholder()`, `x-intersect="$wire.__lazyLoad(…)"`, paramètres de montage signés, `memo.lazyLoaded`), comme Livewire.
- **`RelationManager`** : table des enregistrements liés, composant enfant « lazy » de la page d'édition ; `Resource.relations` ; onglets (`tabs.js` de Filament, propriété `activeRelationManager`) — seul le manager de l'onglet actif est monté.
- Table : `heading()`, barre d'outils masquée quand elle est vide, tri empilé seulement s'il y a des colonnes triables.
- Démo : « Addresses » (relation polymorphe) et « Payments » (à travers les commandes) sur la page d'édition d'un client.
- **Sécurité** : toute requête de mise à jour d'une page ou d'un relation manager exige désormais une session authentifiée (un snapshot conservé après déconnexion ne suffit plus) ; la clé du propriétaire est verrouillée ; des paramètres de montage modifiés, ou signés pour un autre composant, sont refusés ; `memo.children` (non signé) est filtré avant d'être réécrit dans le HTML.
- Comparé à l'oracle : onglets, structure identique (18 nœuds ; écarts = noms de composants et identifiants d'onglet, que Filament calcule en xxh128) ; pagination du manager 0 écart sur 33 nœuds ; table 16 écarts sur 68, tous dus aux actions non portées.

- **Actions du relation manager** : en-tête de table (`Table.headerActions()` : `AttachAction`, `CreateAction`), liens de ligne (`EditAction`, `DetachAction`, `DeleteAction`), actions groupées (`groupedBulkActions()` : `DetachBulkAction`, `DeleteBulkAction`). Cliquer une ligne ouvre l'édition.
- `Action.tableIcon()` / `groupedIcon()` ; `Select.getSearchResultsUsing()` / `getOptionLabelUsing()` (recherche calculée par le serveur) ; `Field.hiddenLabel()`.
- Le manager déclare ses opérations de relation : `attach()`, `detach()`, `searchAttachable()`, `attachableLabel()`.
- **Sécurité** : une sélection envoyée par le navigateur est ramenée aux enregistrements de la portée de l'adaptateur (`keysInScope()`) avant toute action groupée — auparavant une sélection forgée pouvait viser un enregistrement hors de la table ; un rattachement n'est accepté que si le serveur reconnaît l'enregistrement comme rattachable.
- Comparé à l'oracle : table du manager **114 nœuds, 2 écarts** (identifiants posés par Alpine à l'exécution) ; modales « Create Address » et « Attach Address » : mêmes champs, boutons et structure, écarts restants = identifiants et états d'exécution.

Parcours `e2e-relations.mjs`, 15 étapes vertes. Suite complète : 61 étapes sur 61. Tests unitaires : 28.

**Pas encore fait** : la pagination propre au manager dans l'URL ; « Attach & attach another » et les actions groupées sur une vraie sélection ne sont pas testés.

### Relation manager « Payments »

- **`ColumnGroup`** (ligne d'intitulés au-dessus des en-têtes), **`Column.url()`** (lien de cellule), `sortable({ column })` pour trier sur un alias de requête, `money()` avec devise par enregistrement, libellé par défaut d'une colonne `relation.attribut`.
- **`ToggleButtons`** (`inline()`, `grouped()`), `hiddenOn()` / `visibleOn()`, largeur de colonne dépendant de l'opération.
- Création, édition et suppression d'un paiement ; la commande se choisit par recherche parmi celles du client, à la création seulement.
- **Sécurité** : un paiement forgé pour la commande d'un autre client, un montant mal formé ou un moyen de paiement inconnu sont refusés par la validation serveur (testé).
- Comparé à l'oracle : table **253 nœuds, 6 écarts** ; modale de création 143 nœuds, 8 écarts — dans les deux cas des identifiants et états posés à l'exécution par Alpine et le sélecteur.

Parcours `e2e-payments.mjs`, 6 étapes vertes. Suite complète : 68 étapes sur 68.

**Écarts assumés** : le lien de la colonne « Order » reprend l'adresse de Filament (`/shop/orders/<id>/edit`), mais la page des commandes n'est pas encore portée (404) ; la recherche globale du manager ne porte pas sur le numéro de commande. Depuis l'arrivée de la resource Orders, le lien ne mène plus à une 404 mais à sa page d'édition (formulaire provisoire).

### Troisième resource : « Orders » (liste)

- **Colonnes** : `TextColumn.badge()` avec couleur et icône par enregistrement, `formatStateUsing()`, `date()`, `money()` (USD par défaut), recherche et tri sur un alias de requête (`customer.name`).
- **Totaux** : `summarize(Sum.make().money())` — lignes « This page » et « All orders », calculées sur la requête courante (recherche, filtres et onglet compris).
- **Onglets de liste** : `Resource.tabs()` / `Tab` (`query()`, `badge()`, `badgeColor()`) ; les compteurs sont demandés par le navigateur après l'affichage, comme `lazyLoadedBadge()`.
- **Actions de ligne conditionnelles** : `Action.visible()`, `Action.disabled()`, action-lien dans un groupe (`url()`). Une action masquée ou désactivée est aussi refusée par le serveur (403, testé).
- Comparé à l'oracle : table **569 nœuds, 0 écart**, totaux compris ; onglets 40 nœuds, 6 écarts (identifiants d'onglet, que Filament calcule en xxh128).

Tests unitaires : 29.

#### Formulaire de commande (pages de création et d'édition)

- **Mise en page** : `Group`, `Grid`, `Section` à en-tête (titre, `afterHeader()`), comme `Schemas\OrderForm`.
- **État imbriqué** : un champ placé dans un groupe à état se lit, se valide et s'enregistre à son chemin (`address.city`). L'adresse de la commande (`AddressForm` de la démo) est stockée dans `order_addresses`.
- `ToggleButtons` avec couleur et icône par valeur (statut) ; sélecteur de client par recherche serveur ; numéro proposé, verrouillé mais enregistré.
- Les pages de création et d'édition n'enregistrent plus l'état brut du navigateur mais **seulement les champs déclarés** par le formulaire (`getSchemaState`).
- **Lignes de commande** : `Repeater` en table (`table()`, `TableColumn`, `defaultItems()`, `extraItemLink()`) ; ajout, suppression, déplacement (boutons et glisser-déposer) par des **actions de composant de schéma** (`mountAction(nom, args, { schemaComponent })`) ; bouton « Reset » dans l'en-tête de section, avec confirmation.
- `Select.live()`, `disableOptionWhen()` (produit déjà choisi grisé), champ réactif sur une page (`afterStateUpdated` : le prix unitaire suit le produit).
- Les lignes sont enregistrées avec la commande : mises à jour, créées ou supprimées selon le formulaire, dans l'ordre affiché.
- **Sécurité** :
  - le runtime refuse tout chemin d'état passant par `__proto__`, `constructor` ou `prototype` — sans ce garde-fou, une mise à jour forgée pouvait modifier le prototype de tous les objets du serveur (testé) ;
  - une clé de ligne forgée visant la ligne d'une autre commande ne la modifie pas : elle crée une ligne pour la commande en cours (testé) ;
  - un produit en double et un réordonnancement qui n'est pas une permutation des lignes existantes sont refusés.
- Comparé à l'oracle (édition de la commande 353) : **472 nœuds, 14 écarts, tous dus à des éléments non portés** — éditeur riche des notes (12), création de client depuis le sélecteur (1), cible du bouton « Cancel » (1). La section « Order items » est identique.

Parcours `e2e-orders.mjs`, 18 étapes vertes. Suite complète : 86 étapes sur 86. Tests unitaires : 30.

Les lanceurs `run-e2e.mjs` et `run-diff.mjs` attendent maintenant que leur port soit libre et que leur serveur soit arrêté : enchaînés trop vite, ils donnaient parfois de fausses régressions.

**Pas encore fait sur Orders** : l'**éditeur riche** des notes (remplacé par une zone de texte) ; la création de client depuis le sélecteur ; l'action « Replicate » de la page d'édition ; l'assistant en étapes de la page de création ; le widget de statistiques, le regroupement par date, le filtre par période ; le panneau latéral et le second bouton de « Ship ». Le lien « Open product » d'une ligne mène à une page non portée. Le compteur de la barre latérale (155) est encore une valeur figée.

### Écran Employees (liste, création, édition, relation managers)

Équivalent de `EmployeeResource` — `apps/demo/resources/EmployeeResource.ts`. Liste (1 107 nœuds), création et édition conformes à l'oracle ; écarts attendus : clés du widget, identifiants d'onglets (aléatoires dans Filament).

- **Filtres** — `SelectFilter` (options fixes ou chargées, colonne distincte du nom) et `TernaryFilter`. Une valeur hors des options fixes ne filtre pas ; une valeur chargée passe en paramètre lié.
- **Actions** — `slideOver()`, `modalSubmitAction(false)` (modale de consultation), `badge()` / `badgeColor()` sur un bouton, `Resource.listHeaderActions`.
- **Infolists** — `TextEntry` (pastille, couleur, icône, montant, date, texte de remplacement, chemin pointé) et `IconEntry`.
- **Schémas** — `Tabs` / `Tab` (onglets de formulaire avec icônes), `columnSpanFull()`.
- **Formulaires** — `CheckboxList`, `KeyValue`, `TextInput.email()`, `.tel()`, `.mask()`, `ToggleButtons.live()`, champs affichés selon la valeur d'un autre (`visible(({ get }) => …)`).
- **Tables** — `numeric(1)` ; pas de cases à cocher sans action groupée, pas de colonne d'actions sans action de ligne (relation managers en lecture seule).
- **Statistiques** — `aggregatePageTable(colonnes, restriction)` : une statistique peut porter sur une partie des lignes affichées.

Vérifié par `e2e-employees.mjs` (10 étapes, dont un état de filtres forgé). Non vérifié : le balisage du panneau « View profile » et des relation managers n'est pas comparé automatiquement aux captures de l'oracle (`filament-kb/_captures/demo-local-rendered/employee_*.html`).

### Outils de vérification ajoutés

- `PARITY_LANE=1` devant `run-diff.mjs` ou `run-e2e.mjs` : seconde voie (autre port, autre copie de base), pour lancer deux vérifications en même temps.
- `run-diff.mjs --only=<fragment>` : ne compare que les écrans dont le nom contient le fragment.
- `tools/parity/outline.mjs`, `slice.mjs`, `first-diff.mjs` : plan d'une zone d'une capture, extrait brut, première différence entre deux valeurs d'attribut.
- `tools/oracle-capture/rendered.mjs` : HTML d'une zone de l'oracle après exécution du JavaScript (composants différés, clic préalable).
- Les compteurs de navigation sont calculés (`static getNavigationBadge()` sur une resource).

### Écran Brands (liste, création, édition, relation managers)

Équivalent de `BrandResource` — `apps/demo/resources/BrandResource.ts`. Liste (509 nœuds), création, formulaire et en-tête d'édition conformes à l'oracle ; seul écart : l'action d'en-tête « Export » (exports en file d'attente), non portée.

- **Tri manuel des lignes** — `table.reorderable('sort')` : bouton « Reorder records », mode affichant toutes les lignes avec poignées (sans pagination, sélection ni actions), ordre enregistré par `reorderTable`. Seules les clés de la table sont retenues, et rien n'est écrit hors du mode tri. Limite : 1 000 lignes.
- **Actions** — `tooltip()`, `openUrlInNewTab()`, adresse paresseuse sur un bouton d'en-tête ; une adresse qui n'est ni locale ni http(s) n'est pas rendue en lien.
- **Formulaires** — `TextInput.url()` (http ou https seulement).
- **Relation managers** — « Products » réutilise la table et le formulaire de `ProductResource`, restreints à la marque (le produit créé lui est rattaché, le choix de la marque est masqué) ; « Addresses » réutilise celui des clients avec un autre type de propriétaire.

Vérifié par `e2e-brands.mjs` (8 étapes). Non vérifié : le glisser-déposer lui-même (le parcours appelle `reorderTable` comme le fait le navigateur après un dépôt), et le balisage du mode tri n'est pas comparé automatiquement à la capture de l'oracle (`filament-kb/_captures/demo-local-rendered/brands_reordering.html`).

### Écran Products (liste, création, édition)

Équivalent de `ProductResource` de la démo Filament — `apps/demo/resources/ProductResource.ts`. Les trois pages sont conformes à l'oracle (`run-diff` : liste 997 nœuds, création 451, édition 448 ; seuls écarts, attendus : le nom de classe PHP du widget dans ses clés et la charge signée de son chargement différé).

Ce que cette tranche a apporté aux paquets :

- **Widgets** (`@navette/panels`) — `Widget`, `StatsOverviewWidget`, `Stat` (description, icône, couleur, courbe), `PageTableStatsWidget` (port de `InteractsWithPageTable` : le widget agrège exactement ce que la table affiche). Une resource déclare `static widgets` et `static headerWidgets` ; ils sont chargés quand ils deviennent visibles.
- **Propriétés réactives** (`@navette/wire`) — `static reactive = [...]` : le parent passe ses valeurs à l'enfant dans la même requête (équivalent de `#[Reactive]`), le navigateur ne peut pas les modifier. C'est ce qui fait suivre la recherche et les filtres aux statistiques.
- **Téléversement de fichiers** — côté runtime : `UploadStore` (adresse d'envoi signée et limitée dans le temps, jeton CSRF, utilisateur connecté, taille bornée, type déterminé par le contenu du fichier, extension jamais reprise du nom envoyé) et les appels `_startUpload` / `_finishUpload` de Livewire. Côté formulaires : `FileUpload` (multiple, `maxFiles`, `maxSize`, `acceptedFileTypes`, `reorderable`, `directory`, `storeFiles(false)`), `LocalFileStorage`. Une clé de fichier déjà enregistré n'est acceptée que si l'enregistrement en cours la possède.
- **Filtre QueryBuilder** (`@navette/tables/query-builder`) et champ **Builder** (`@navette/forms/builder`) — contraintes texte, nombre, booléen, date, bloc OR, filtres « au-dessus du contenu », filtres différés. Types de blocs, opérateurs et colonnes sont validés contre ce que le filtre déclare ; les valeurs sont toujours des paramètres liés.
- Colonnes `ImageColumn` et `TextColumn.numeric()` ; `Field.helperText()` ; `Section.collapsible()` ; `Select.multiple()` ; agrégats `adapter.aggregate()`.

Vérifié par `e2e-products.mjs` (12 étapes : statistiques, recherche qui les met à jour, actions de ligne et groupées, création avec image téléversée, retrait d'une image, faux JPEG refusé, références forgées refusées), `e2e-query-builder.mjs` (29 étapes) et les tests unitaires de `packages/wire/test/uploads.test.ts` et `packages/tables/test/query-builder.test.ts`.

**Écarts et restes de cette tranche**

- Images : la miniature d'un média téléversé est une copie de l'image (pas de redimensionnement). Un fichier retiré du formulaire n'est supprimé qu'à l'enregistrement, pas immédiatement comme dans Filament.
- Les images fournies avec la base de démonstration sont lues dans `sources/demo/storage` ; les nouvelles vont dans `apps/demo/storage` (`NAVETTE_UPLOADS`).
- QueryBuilder : pas de contraintes de relation ou de sélection, pas de « Is filled », dates sans heure, champs de date personnalisée côte à côte (pas fusionnés), SQL de date pour SQLite seulement. Le balisage après ajout de règles suit les captures mais n'est pas comparé automatiquement.
- Non portés : le relation manager « Comments » de la page d'édition, la recherche globale.
- `tools/gen-rich-editor-view.mjs` ne connaît pas encore le libellé dynamique de l'éditeur riche : à reporter si la vue est régénérée.

### Thèmes

Deux niveaux, comme dans Filament, plus un écart assumé :

- **Couleurs du panel** — `panel.setColors({ primary: Color.Blue, gray: '#57534e' })`. Une palette Tailwind (`Color.*`) ou une simple couleur (`#hex`, `rgb(…)`) : dans ce cas les onze nuances sont générées (port de `Color::generatePalette`, `generatePalette()` et `convertToOklch()` dans `@navette/support`).
- **Feuille de thème compilée** — `panel.theme(url)`, équivalent de `->viteTheme()` (`npm run build:theme -w @navette/demo`).
- **Thèmes prédéfinis au choix de l'utilisateur** (écart : Filament n'a pas cela en standard) — `panel.themes([{ id, label, colors, font?, css? }, …])`. Avec plus d'un thème, le menu utilisateur liste les thèmes sous le sélecteur clair/sombre. Le choix (`Sidebar.setTheme`) est gardé dans le cookie `navette_<panel>_theme`, validé contre la liste déclarée ; un identifiant inconnu retombe sur le premier thème. Les couleurs du thème ne valent que pour la requête (`ColorManager.runWith`, `AsyncLocalStorage`) : deux utilisateurs avec deux thèmes ne se marchent pas dessus.

La démo en déclare cinq (Navette, Alpage, Glacier, Crépuscule avec sa police, Cuivre généré depuis `#b45309`). Les comparaisons avec l'oracle tournent sans thèmes (`NAVETTE_NO_THEMES=1`), donc le menu reste conforme. Vérifié par `e2e-themes.mjs` (9 étapes) et `packages/support/test/themes.test.ts`.

### Jalon 1 fermé : les 87 scènes de composants sont vertes

- **Second oracle** : l'application de documentation de Filament (`sources/filament/docs-assets/app`) tourne en local sur le port 8001 (entrée `filament-docs-oracle` du lanceur). Ses 87 scènes `components/*` (18 pages) sont capturées par `tools/oracle-capture/components.mjs`.
- **`@navette/support/ui`** : les composants d'interface de base, utilisables seuls — `button`, `iconButton`, `badge`, `link`, `avatar`, `breadcrumbs`, `checkbox`, `input`, `inputWrapper`, `select`, `fieldset`, `callout`, `emptyState`, `section`, `tabs`, `dropdown`, `modal`, `pagination`, `spinner`. Chacun suit la vue Blade d'origine.
- **Playground** : `apps/playground` sert les mêmes pages que la documentation (`/components/<famille>`, `/pagination`), avec les mêmes identifiants de scène.
- `node tools/parity/run-scenes.mjs [--details] [famille…]` compare chaque scène à l'oracle : **87 scènes vertes sur 87**, 1 404 nœuds, 0 écart. `tools/parity/scene-source.mjs <famille>` affiche la vue Blade et le HTML de l'oracle pour porter une famille.

**Portée de ce « vert »** : c'est une comparaison du **balisage** (structure, classes, attributs, tracé des icônes). Les styles calculés et les pixels de ces scènes ne sont pas encore comparés, et les modales sont comparées fermées (leur ouverture n'est pas jouée). La scène « slide-over », que la documentation photographie en pleine page, est comparée sur sa fenêtre.

### Jalon 2 fermé : `CustomerResource` identique à l'oracle

- **Éditeur riche** (`RichEditor`) : le balisage est celui de Filament, repris de l'oracle par `tools/gen-rich-editor-view.mjs` ; le navigateur travaille sur un document TipTap, la base reçoit du HTML. La conversion se fait côté serveur avec TipTap 3 (`@tiptap/html`).
- **« Send email »** sur chaque ligne et sur la page d'édition d'un client ; les notes d'une commande utilisent le même éditeur.
- **Lien** de la barre d'outils : modale imbriquée (URL, nouvel onglet), puis commandes renvoyées à l'éditeur du navigateur — y compris quand l'éditeur est lui-même dans une modale.
- Modales des actions rendues dans la table (comme Filament) ; « Cancel » d'une page d'édition revient à la page précédente ; l'outil de comparaison ne signale plus de faux écart sur les clés de sélection.
- **Sécurité** : un document forgé par le navigateur est rendu puis ré-analysé par le schéma du serveur avant enregistrement — scripts, attributs d'événement et liens `javascript:` n'atteignent pas la base (tests unitaires et parcours) ; l'URL d'un lien doit être en http(s), mailto, tel, relative ou une ancre.
- Comparé à l'oracle : liste des clients **717 nœuds, 0 écart** ; création 0 ; formulaire d'édition 0 ; en-tête de la page d'édition 0. Liste des services : page entière 0 écart. Édition d'une commande : 579 nœuds, 1 écart (création de client depuis le sélecteur).

Parcours `e2e-rich.mjs`, 8 étapes vertes. Suite complète : 95 étapes sur 95. Tests unitaires : 33.

**Limites de l'éditeur riche** : les pièces jointes (bouton d'image) ne sont pas portées — le bouton est affiché mais l'envoi de fichiers n'existe pas encore ; grilles, blocs personnalisés, mentions, balises de fusion et couleur de texte ne sont pas dans le schéma du serveur, donc un contenu qui en contient les perdrait à l'enregistrement ; le champ désactivé ou en erreur n'a pas son habillage.

### Mouvement et indicateurs de chargement (écart volontaire)

Décision du 2026-11-12 : Navette ajoute, par-dessus l'interface de Filament, des animations dans l'esprit d'iOS et des indicateurs de chargement.

- `dist/navette/navette/motion.css` : arrivée de page, pression des boutons, ressort des modales et fond flouté, ouverture des menus, roue dans les zones chargées à la demande, estompage de la table pendant une requête. Neutralisé avec `prefers-reduced-motion`.
- `dist/navette/navette/motion.js` : pastille « Loading… » en haut de l'écran quand une requête ou une navigation dépasse 350 ms.
- Aucun changement de balisage ni de dimensions : la comparaison de DOM avec l'oracle est inchangée. `Panel.motion(false)` retire les deux fichiers et rend l'interface d'origine.
- Vérifié : la feuille et le script sont chargés, l'animation d'arrivée s'applique, aucune erreur ; les 95 étapes de parcours passent avec les animations. **Non vérifié à l'œil** : la pastille d'activité et la roue des zones différées en conditions réelles, ni le rendu en thème clair.

### Thème Tailwind

- Les sources CSS de Filament (131 feuilles, MIT) sont copiées telles quelles dans `packages/panels/resources/filament/` par `tools/vendor-filament-css.mjs`.
- `@navette/panels/theme.css` : le thème de base ; une application l'importe dans sa propre feuille, déclare ses sources (`@source`) et compile avec Tailwind 4.
- `Panel.theme(url)` (équivalent de `viteTheme()`) sert la feuille compilée à la place de la feuille par défaut.
- Démo : `npm run build:theme -w @navette/demo` produit `apps/demo/public/css/theme.css` (à relancer quand on ajoute des classes utilitaires ; le fichier n'est pas recompilé automatiquement).
- Comparé au thème compilé de l'oracle (`node tools/parity/css-diff.mjs`) : 4 112 sélecteurs communs sur 4 340. Les autres diffèrent par l'outillage (l'oracle est compilé par Vite, qui réécrit `:dir(rtl)` en listes `:lang(…)` et déplie l'imbrication autrement) ; je n'ai pas vérifié un par un les 228 restants.
- Effet visible : les classes utilitaires de l'application s'affichent enfin (fond rouge des services en dépassement d'effectif — testé dans `e2e-departments.mjs`).

### Render hooks : la liste de Filament (2026-11-12)

- **111 emplacements déclarés** sous les mêmes noms que Filament 5.11.2 : `PanelsRenderHook` (83), `TablesRenderHook` (20, plus deux anciens noms), `ActionsRenderHook` (6), `WidgetsRenderHook` (2).
- **73 sont rendus** (75 depuis le widget de table), chacun au même endroit du balisage que dans les vues Blade de Filament. Les autres attendent leur brique (barre du haut, recherche globale, sous-navigation, locataire, inscription, mot de passe oublié, enregistrements liés, widgets de pied de page) ; `UNPLACED_RENDER_HOOKS` en tient la liste, avec la raison. Quatre d'entre eux (« tabs ») ne sont rendus par aucune vue de Filament non plus.
- **Portées** (`getRenderHookScopes()`) : une page porte sa classe, une page de resource porte aussi sa resource ; `panel.renderHook(nom, fonction, portées)`. Ordre de Filament : hooks sans portée, puis portée par portée, chaque hook une seule fois.
- **Données** : le hook reçoit `{ scopes, data }` (`data.action` dans une modale, `data.column` pour une cellule d'en-tête, `data.filterIndicators`).
- **Emplacements de remplacement**, comme Filament : `tables::filter.indicators` et `tables::header.cell` remplacent le balisage par défaut quand ils rendent quelque chose.
- **Registre par panel** : `panel.renderHook()` ne vaut plus que pour les requêtes de ce panel (auparavant un registre commun à tout le processus). `renderHooks` (`@navette/support`) reste disponible pour un hook commun.

Écarts corrigés au passage, pour suivre Filament :

- `panels::content.start` / `content.end` étaient dans `.fi-page-content` ; ils sont dans `<main>`, autour de la page.
- `panels::sidebar.footer` était dans le pied de sidebar, au-dessus du menu utilisateur ; il est après le pied.
- Un relation manager rendait les emplacements de la page de liste ; il rend `panels::resource.relation-manager.before` / `after`.
- Le conteneur des actions d'en-tête apparaît aussi quand seul un hook `page.header.actions.*` rend quelque chose.

Vérifié : 5 tests unitaires (portées, ordre, données, isolation de deux panels dans des rendus entrelacés) ; parcours `e2e-render-hooks.mjs`, 9 étapes, qui lance la démo avec une sonde (`apps/demo/hook-probe.ts`, activée par `NAVETTE_HOOK_PROBE`) et contrôle le voisinage de chaque marqueur sur la connexion, une liste, une liste à widgets, une édition avec relation manager, une modale de confirmation et une modale à formulaire. La dernière étape échoue si un emplacement déclaré « rendu » n'a été vu nulle part.

**Non vérifié** : la position n'est comparée qu'aux vues Blade lues dans `sources/filament`, pas à un rendu réel de l'oracle avec des hooks (PHP n'est pas installé sur le poste actuel). Sans hook enregistré, le balisage est inchangé : 32 zones de parité conformes. Deux panels dans un même processus ne sont éprouvés que pour les render hooks ; couleurs, vues partagées et `assetUrl` restent communs au processus.

État de la batterie après cette tranche : 59 tests unitaires, 32 zones de parité, 184 étapes e2e, 87 scènes.

### Graphiques et tableaux de bord (2026-11-12)

Les trois tableaux de bord de la démo (Welcome `/`, Shop `/shop`, HR `/hr`) sont remplis, comme dans l'oracle. PHP est maintenant installé sur le poste : l'oracle tourne en local et a servi aux captures (`filament-kb/_captures/demo-local-raw` pour le HTML brut, `demo-local-rendered` pour les pages une fois les widgets « lazy » chargés).

Briques ajoutées à `@navette/panels` :

- **`ChartWidget`** : `getType()`, `getData()`, `getOptions()`, `getFilters()`, statiques `heading`, `description`, `color`, `maxHeight`, `pollingInterval`, `isCollapsible`. Le graphique est dessiné par le composant Chart.js de Filament ; `updateChartData()` ne renvoie des données au navigateur (événement `updateChartData`) que si leur empreinte a changé.
- **`TableWidget`** : une table dans un widget (`table(table)`, `getDataAdapterForTable()`), tri, recherche, pagination. Rend les deux render hooks `widgets::table-widget.start` / `end`, retirés de `UNPLACED_RENDER_HOOKS`.
- **`Dashboard`** : `getWidgets()`, `getColumns()`, et un formulaire de filtres de page (`filtersFormSchema`) dont l'état est transmis aux widgets par la propriété réactive `pageFilters` (`static reactive = PAGE_FILTERS`). Un widget se redessine quand un filtre change, sans rechargement.
- **`AccountWidget`** et **`NavetteInfoWidget`** (équivalent de `FilamentInfoWidget` : même balisage, logo, version et liens de Navette).
- `StatsOverviewWidget` : courbes (`Stat.chart()`), descriptions et icônes désormais comparées à l'oracle.

Ailleurs :

- `@navette/forms` : `DatePicker.live()`, `minDate` / `maxDate` calculés (`({ get }) => get('endDate') || 'today'`).
- `@navette/schemas` : `Schema.partialName()`.
- `@navette/tables` : `sortable({ column, inverted })`, `paginationMode('simple')` (pas de total, pas de numéros de page), `defaultPaginationPageOption()`.

Démo : `apps/demo/widgets/` — `hr.ts` (statistiques et 4 graphiques), `shop.ts` (statistiques à courbes, 6 graphiques, table « Flagged Orders »), `welcome.ts` (aperçu des 61 fonctionnalités, données extraites de l'oracle dans `fixtures/features.json`), `dates.ts` (arithmétique de dates de Carbon 3 reproduite en UTC : `diffInMonths` fractionnaire, débordement de `subMonths`, semaine commençant le lundi).

Vérifié :

- `run-diff` : trois zones `.fi-page` de plus (HTML brut, widgets en attente) — Welcome 823 nœuds, Shop 107, HR 34. Écarts attendus seulement : nom de classe PHP du widget dans ses clés et son `x-data`, charge signée de `x-intersect`, jeton CSRF, marque et widget d'information.
- `e2e-dashboards.mjs`, 16 étapes, lecture seule, sur une copie de la base d'origine : widgets chargés et graphiques dessinés sans erreur JavaScript ; balisage des pages chargées comparé aux captures rendues (17, 18 et 10 écarts, tous du type ci-dessus) ; types, options, séries et couleurs des graphiques identiques ; à la date des captures, **données identiques pour les 10 graphiques et les 4 courbes** ; filtres de statut, de période et de catégorie qui mettent à jour statistiques et graphiques ; table « Flagged Orders » (page suivante, tri inversé « Days old », recherche).

**Non vérifié ou non porté** :

- Les filtres de page ne sont gardés ni en session ni dans l'URL (Filament : `persistsFiltersInSession`, `#[Url]`) : ils reviennent à vide au rechargement.
- Filtre intégré d'un graphique (`getFilters()`), état vide et repli (`isCollapsible`) : portés d'après les vues Blade, aucun graphique de l'oracle ne les utilise, donc jamais comparés.
- `TableWidget` : sans actions, filtres ni sélection ; ses deux render hooks suivent la vue Blade mais ne sont contrôlés par aucun parcours (`e2e-render-hooks.mjs` ne couvre pas `WidgetsRenderHook`).
- Interrogation périodique (`wire:poll.5s`) : l'attribut est émis comme dans l'oracle, le rafraîchissement n'est pas testé.
- Les données des graphiques dépendent de la date du jour (fenêtres glissantes) : l'identité avec l'oracle vaut pour le jour des captures ; le parcours ne fait que signaler un écart de valeurs, il n'échoue pas.
- Plusieurs liens de « Features Overview » mènent à des écrans pas encore portés (pages d'attente).
- Rendu comparé en balisage et par un canevas non vide, pas en pixels.

État de la batterie après cette tranche : 59 tests unitaires, 35 zones de parité, 200 étapes e2e (17 parcours), 87 scènes. Le tableau de bord de `apps/starter` n'a plus besoin de `getHeaderWidgets()` : comme dans Filament, un `Dashboard` affiche par défaut les widgets du panel.

### Liste Orders : statistiques, Product Categories, fond de modale (2026-11-12)

- **`OrderStats`** (liste Orders) : trois statistiques à courbe sur les commandes affichées par la table, tendance mensuelle sur un an (`ObjectionAdapter.trendPerMonth()`, `PageTableStatsWidget.trendPageTable()` — équivalent de flowframe/laravel-trend, SQL SQLite). Page chargée comparée à l'oracle (`demo-local-rendered/orders.page.html`) : les trois courbes sont identiques ; écarts restants connus (regroupement, filtre par date).
- Badge d'onglet chargé après coup : sans `badgeColor()`, aucune classe de couleur (comme Filament).
- **Product Categories** (`apps/demo/resources/CategoryResource.ts`) : liste, création, édition, relation manager « Products » (plusieurs-à-plusieurs). Quatre zones de parité conformes ; seul écart, l'action « Import » non portée. Le relation manager n'a pas de parcours e2e propre.
- **Fond de modale** : le flou ajouté par `motion.css` est retiré (voile sombre de Filament seul), et le voile couvre de nouveau toute la fenêtre — l'animation d'arrivée de `.fi-page` restait appliquée (`both`) et faisait de la page le bloc conteneur des éléments `position: fixed`. Contrôle : `node tools/parity/check-overlay.mjs <baseUrl>`.

Batterie : 59 tests unitaires, 39 zones de parité ; parcours Orders, Brands, Products et Dashboards rejoués (verts), pas la batterie e2e entière.

### Écrans Projects et Blog, barre de recherche, notifications, calendrier (2026-11-12)

**Écrans portés** (plus aucune page d'attente dans la démo) :

- **Projects, Tasks, Timesheets** (`ProjectResource.ts`, `TaskResource.ts`, `TimesheetResource.ts`) : listes, création, édition, page « View » des projets avec ses actions de suivi, plan en blocs (`Builder`). Parcours `e2e-projects.mjs`, `e2e-tasks.mjs`, `e2e-timesheets.mjs`.
- **Blog** : Post Categories et Authors (`BlogResources.ts`, resources simples), Posts (`PostResource.ts` : liste, création, « View », édition, page « Manage comments »). Sept zones de parité ; parcours `e2e-blog.mjs` (13 étapes).
- **Création d'une commande** en assistant à deux étapes (`Wizard`), validée étape par étape côté serveur.

**Briques ajoutées au framework** pour ces écrans :

| Brique | Paquet | Rôle |
|---|---|---|
| `Builder` : numéros, icônes et titre des blocs, « Insert between blocks » | forms | défauts de Filament (`blockNumbers()`, `blockIcons()`, `addBetweenAction()`) |
| `Select` natif avec option vide, `TagsInput` (suggestions, libellés), `DatePicker.placeholder()` | forms | |
| `Split`, `Stack`, `Table.getColumnsLayout()` | tables | lignes en cartes (liste des auteurs) |
| `TextColumn.icon()`, `color()` hors pastille, `Column.alignLeft()` | tables | |
| `ImageEntry`, pastilles multiples de `TextEntry`, listes « serrées » de `markdown()` | infolists | |
| `Flex`, `Component.grow()` | schemas | composants côte à côte |
| `registerIcon(nom, svg)` | support | icônes hors Heroicons (GitHub, Twitter) |
| `ViewAction` en modale | panels | quand la resource n'a pas de page « View » ; s'ouvre aussi par `?tableAction=view&tableActionRecord=…` |
| Sous-navigation d'enregistrement (`Resource.recordSubNavigation`, `Page.getSubNavigation()`) | panels | onglets View / Edit / Comments |
| `ManageRelatedRecords` (`Resource.relatedPages`) | panels | page d'enregistrements liés, bornée au propriétaire |
| Action à adresse calculée | actions | `url(fn)` qui rend `null` : l'action se monte ; sinon elle reste un lien et son montage est refusé |

**Recherche globale** (port de `Filament\Livewire\GlobalSearch`, `packages/panels/src/topbar.ts`). Le champ apparaît dans la sidebar dès qu'une resource a un `recordTitleAttribute`. Par resource : `globallySearchableAttributes`, `getGlobalSearchResultDetails()`, `getGlobalSearchResultUrl()`, `globalSearchSort`, `globalSearchResultsLimit` (50). Par panel : `globalSearch(false)`, `globalSearchKeyBindings()`, `globalSearchFieldKeyBindingSuffix()`, `globalSearchDebounce()`. Seules les resources que l'utilisateur peut lister sont interrogées, et un résultat sans accès « view » ni « update » est écarté. Réponse à la saisie « an » comparée à l'oracle : 2 728 nœuds, mêmes groupes, mêmes résultats, mêmes adresses.

**Notifications en base** (port de `DatabaseNotifications`) : `Panel.databaseNotifications(knexNotificationStore(knex))` affiche la cloche et le panneau latéral (pastille des non lues, « Mark all as read », « Clear », fermeture = suppression, rafraîchissement toutes les 30 s). Le stockage lit et écrit la table `notifications` de Laravel au format de Filament ; `DatabaseNotificationStore` est une interface, pour brancher autre chose. Envoi : `await Notification.make().title('New order').actions([{ label: 'View', url }]).sendToDatabase(panel.getDatabaseNotifications(), user.id)` — la démo le fait à la création d'une commande, comme celle de Filament. Balisage du panneau fermé et ouvert comparé à l'oracle : identique.

**Calendrier — `CalendarWidget`** (composant propre à Navette, Filament n'en a pas ; `packages/panels/src/calendar.ts`, styles `dist/navette/navette/calendar.css`). Vues mois, semaine et liste, navigation rendue par le serveur, aucune bibliothèque JavaScript. Le minimum :

```ts
class LeaveCalendar extends CalendarWidget {
    static heading = 'Leave';
    async getEvents({ start, end }) {            // période affichée, YYYY-MM-DD inclus
        return [{ id: 1, title: 'Ada', start: '2026-11-12', end: '2026-11-14', color: 'success', url: '/hr/leave-requests/1' }];
    }
}
```

Tout le reste se redéfinit méthode par méthode :

| Méthode | Effet |
|---|---|
| `getViews()` | vues proposées (`month`, `week`, `list`) ; une seule : pas de sélecteur |
| `getFirstDayOfWeek()`, `getLocale()`, `getLabels()`, `getToday()` | lundi ou dimanche, langue des mois et des jours, libellés des boutons, fuseau |
| `getMaxEventsPerDay()` | au-delà : « +N more », qui ouvre la liste sur ce jour |
| `onDateClick(date)` | la redéfinir rend les jours cliquables (ouvrir une page, notifier…) |
| `onEventClick(event)` | clic sur un événement sans adresse ; l'événement est relu côté serveur (`event.extra` disponible) |
| `renderEvent(event, ctx)` | HTML d'un événement (`null` : rendu par défaut, `renderCalendarEvent`) |
| `renderDayFooter(day, events)`, `renderToolbarEnd()` | pied de case, boutons à droite de la barre d'outils |
| `getExtraClasses()`, `getStyle()` | classes et variables CSS (`--nv-cal-day-min-height`, `--nv-cal-radius`, `--nv-cal-border`…) |

**`CalendarPage`** est le même calendrier sur une page entière, avec les actions de Filament : `dateAction()` (clic sur un jour, reçoit `arguments.date`) et `eventAction()` (clic sur un événement, reçoit `arguments.event`) rendent une `Action` — donc une modale, un formulaire (`schema`, `fillForm`), une confirmation ; `getHeaderActions()` pose des boutons en tête de page et `getCalendarActions()` déclare d'autres actions montables depuis votre propre HTML. Le développeur choisit donc, clic par clic : une **adresse** (`url` de l'événement : page dédiée), une **action en modale**, ou du **code libre** (`onDateClick` / `onEventClick` : rediriger, notifier, écrire en base, `this.mountAction(…)`). Les arguments viennent du navigateur : `CalendarPage.dateOf(args)` ne rend qu'une vraie date, `findEvent(id)` ne rend qu'un événement de la période affichée.

Les couleurs sont celles du panel (`fi-color-<nom>`). La vue et la date ne changent que par des méthodes qui les valident ; l'identifiant d'événement reçu du navigateur est recherché parmi les événements de la période. Exemples complets : `LeaveCalendarPage` (`apps/demo/pages/calendar.ts`, menu HR → Leave Calendar : création d'une demande au clic sur un jour, changement de statut au clic sur un événement) et le widget `LeaveCalendar` (`apps/demo/widgets/hr.ts`, page `/hr/calendar-widget`). Ces deux pages sont retirées quand `NAVETTE_NO_THEMES` est posé (comparaisons avec l'oracle, dont le menu n'a pas cette entrée). Parcours `e2e-calendar.mjs` (12 étapes), tests `packages/panels/test/calendar.test.ts`. Le rendu sans le widget est disponible (`renderCalendar(model)`) pour l'utiliser dans une page ou un autre composant.

**Limites connues de cette tranche** : « Import » (catégories) et « Export » (auteurs) sont des ports partiels (CSV collé / fichier CSV, sans file d'attente ni correspondance de colonnes) ; `markdown()` ne convertit pas la syntaxe Markdown et perd le gras autour d'un code en ligne (3 écarts attendus) ; le panneau des notifications n'est pas paginé au-delà de 50, n'a pas de diffusion en temps réel, et le corps est échappé (Filament accepte du HTML nettoyé) ; les actions d'une notification ne sont pas rendues dans les notifications flash ; la recherche globale découpe le terme en mots (Filament ne le fait que sur option) et n'a pas d'actions par résultat ; `CalendarWidget` n'a pas d'actions en modale (elles demandent une page : `CalendarPage`) ; le calendrier n'a ni vue jour avec heures, ni glisser-déposer, ni barres continues sur plusieurs jours (l'événement est répété dans chaque case) ; il n'a été regardé qu'en mode sombre, sur écran large.

Batterie : 64 tests unitaires, 65 zones de parité conformes (0 régression), 87 scènes, 25 parcours e2e (247 étapes) — tout vert après correction d'un défaut d'isolation de `e2e-tasks.mjs` (rejoué avec `e2e-projects.mjs`, pas la batterie entière une troisième fois).

### Tableau de parité

`node tools/parity/run-diff.mjs` démarre une instance jetable sur une copie de la base d'origine et compare douze zones à l'oracle ; `--details` liste les écarts. État actuel : douze zones conformes, 2 639 nœuds comparés, 27 écarts, tous expliqués.

Les parcours et le tableau de parité ne dépendent plus de la base de démo : ils partent d'une copie de `sources/demo/database/database.sqlite`.

Tests unitaires : 33 (runtime, support, adaptateur de données, tables, texte riche).

### Paquets

| Paquet | Contenu porté |
|---|---|
| `packages/wire` | Runtime de composants à état compatible avec `livewire.js` 4.4.8 (embarqué, non modifié) : snapshot signé, mises à jour, appels, effets, erreurs, CSRF |
| `packages/support` | Échappement, sac d'attributs (dont `grid` / `gridColumn`), `Js::from`, évaluation paresseuse, 26 palettes, calcul de contraste, classes de couleur du bouton, Heroicons, traductions en/fr, vues EJS à espaces de noms surchargeables |
| `packages/schemas` | `Schema`, `Component`, `Form`, `EmbeddedSchema`, `Actions`, `RenderHook` |
| `packages/forms` | `Field` et son enveloppe, `TextInput` (email, mot de passe révélable, longueurs), `Checkbox`, validation (`required`, `email`, `min`, `max`) |
| `packages/actions` | `Action` rendue en bouton plein de soumission |
| `packages/panels` | `Panel` (marque, couleurs, police, auth, pages, groupes de navigation), mises en page « simple » et complète, sidebar, navigation avec badges, menu utilisateur, `Page`, `Dashboard`, `Resource`, `ListRecords`, `CreateRecord`, `EditRecord`, notifications flash (`Notification`, boîte aux lettres par navigateur, lots), fil d'Ariane, actions d'en-tête, `Login`, session par cookie signé, assets compilés de Filament (`dist/`, MIT) |
| `packages/database` | Contrat `DataAdapter` et adaptateur Knex + Objection : pagination, tri, recherche globale et par colonne (insensible à la casse, jokers échappés), lecture, écriture |
| `packages/tables` | `Table`, `TextColumn` (deux balisages, copiable, état calculé), état de table, tri, fenêtre de pagination, vue de table |
| `apps/demo` | Reprend la configuration du panel `admin` de `filamentphp/demo` |
| `apps/playground` | Deux composants d'essai du runtime |

### Pas encore fait

- Tout le reste de la roadmap : widgets, topbar, recherche globale, formulaires de resource (création, édition), filtres et actions de table, les autres champs et colonnes, modales d'action, notifications.
- Les utilisateurs de la démo sont encore une fixture JSON avec mot de passe en clair, alors que la base contient une table `users`.
- La base de la démo est une copie de celle de Filament (`apps/demo/database/database.sqlite`, non versionnée) : il n'y a ni migrations ni seeders côté Navette.
- `better-sqlite3` s'installe par un binaire précompilé ; npm signale son script d'installation comme non approuvé.
- L'avatar par défaut appelle le service externe ui-avatars.com avec les initiales de l'utilisateur, comme Filament.
- Les notifications en attente sont gardées en mémoire du processus (Filament utilise le cache) : elles ne survivent pas à un redémarrage et ne se partagent pas entre plusieurs processus.
- Runtime : composants imbriqués, lazy loading, uploads, `#[Url]`, pagination nommée, rendu partiel par composant de schéma (`schema-component::…` ; seul le fragment `action-modals` est partiel), rendu partiel Filament (`wire:partial` est émis dans le HTML mais le serveur renvoie toujours le HTML complet).
- Build Tailwind et thèmes custom : le CSS est le thème par défaut précompilé de Filament.
- Squelette généré depuis `classes.json`, compteur de parité, CLI, harnais de test.
- Décorateurs : Node exécute les `.ts` directement, donc syntaxe TypeScript « effaçable » uniquement.

## Commandes

```bash
npm install
npm test
node apps/demo/server.ts
node ../tools/parity/run-e2e.mjs
node ../tools/parity/run-diff.mjs
```

Démo : `http://127.0.0.1:3200/login` (compte de test dans `apps/demo/fixtures/users.json`).

## Vérifier la fidélité

L'oracle doit tourner (`php -S 127.0.0.1:8000 -t sources/demo/public sources/demo/server.php`, barre de débogage désactivée).

```bash
node ../tools/parity/dom-diff.mjs http://127.0.0.1:8000/login http://127.0.0.1:3200/login body
node ../tools/parity/visual-diff.mjs http://127.0.0.1:8000/login http://127.0.0.1:3200/login login ../tools/parity/out
```

## Protocole du runtime (lu dans les sources de Livewire 4.4.8)

- Premier rendu : la racine du composant porte `wire:snapshot`, `wire:effects`, `wire:id`, `wire:name`.
- Snapshot : `{ data, memo: { id, name, path, method, release, children, errors, locale, … }, checksum }` ; tableaux et objets encodés `[valeur, { "s": "arr" }]` ; `checksum` = HMAC-SHA256 du snapshot sans `memo.children`.
- Requête `POST <update-uri>` : `{ _token, components: [{ snapshot, updates, calls }] }` ; réponse : `{ components: [{ snapshot, effects }], assets }`.
- `$refresh`, `$set`, `$sync`, `$commit` sont sans effet côté serveur : les valeurs voyagent dans `updates`.
- Échanges réels enregistrés : `../filament-kb/_captures/demo-local/protocol/exchanges.jsonl`.
