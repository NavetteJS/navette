# 14. Étendre le framework

Quand une option ne suffit pas, vous n'avez pas à modifier Navette : chaque étage a un point d'extension.
`apps/starter/extensions.ts` en montre cinq, vérifiés par le parcours de l'application de départ : champ sur mesure, colonne sur mesure, page de création à crochets, plugin avec render hook, réglage global. Les autres exemples de cette page (crochets d'action, page de liste personnalisée, remplacement de vue) suivent la même API mais ne sont pas couverts par un test.

| Besoin | Point d'extension |
|---|---|
| Changer le comportement d'une page de resource | `static pages` + sous-classe |
| Agir avant ou après un enregistrement | crochets de cycle de vie |
| Un champ, une colonne ou une entrée qui n'existe pas | héritage de `Field`, `Column`, `Component` |
| Ajouter du HTML quelque part dans l'interface | render hooks |
| Changer un réglage par défaut partout | `configureUsing` |
| Remplacer une vue du framework | `views.overrideFrom` |
| Emballer une configuration réutilisable | plugins |

## Pages de resource personnalisées

Une resource génère ses pages à partir de `ListRecords`, `CreateRecord` et `EditRecord`. Remplacez celle que vous voulez par une sous-classe :

```ts
import { CreateRecord, EditRecord, ListRecords } from '@navette/panels';

class ListTasks extends ListRecords {
    getHeading(): string { return 'Mes tâches'; }
    getHeaderActions() { return [...super.getHeaderActions(), Action.make('archive').label('Archives').url('/tasks/archive')]; }
}

class TaskResource extends Resource {
    static pages = { index: ListTasks, create: CreateTask, edit: EditTask };
}
```

Tout ce qui se surcharge sur une page (`getHeading`, `getBreadcrumbs`, `getHeaderActions`, `getHeaderWidgets`, `getTabs`, `contentSchema`…) se surcharge ici.

Pour ajouter une méthode déclenchée depuis l'interface (`wire:click="approve"`), nommez-la dans `static callable` (voir [Sécurité](11-securite.md)).

## Crochets de cycle de vie

### Page de création

```ts
class CreateTask extends CreateRecord {
    // Compléter les données validées : ce que le serveur sait et que le formulaire ne doit pas décider.
    protected mutateFormDataBeforeCreate(data: Record<string, unknown>) {
        return { ...data, created_by: (this._ctx as PanelContext).user?.email ?? null };
    }
    protected async beforeCreate(data) { if (await quotaReached()) throw new WireError(403, 'Quota atteint.'); }
    protected handleRecordCreation(data) { return this.getDataAdapter().create(data); }   // la création elle-même
    protected async afterCreate(record) { await audit('task.created', record.id); }
    protected getRedirectUrl(record) { return this.resource.getUrl(); }                    // défaut : la page d'édition
    protected getCreatedNotificationTitle() { return 'Tâche créée'; }                      // null : pas de notification
}
```

### Page d'édition

| Crochet | Moment |
|---|---|
| `mutateFormDataBeforeFill(data)` | Avant de remplir le formulaire avec l'enregistrement. |
| `mutateFormDataBeforeSave(data)` | Après validation, avant l'enregistrement. |
| `beforeSave(data)` | Juste avant ; lever une erreur annule. |
| `handleRecordUpdate(record, data)` | L'enregistrement lui-même. |
| `afterSave(record)` | Après. |
| `getRedirectUrl(record)` | Où aller ensuite ; `null` (défaut) : rester sur la page. |
| `getSavedNotificationTitle()` | Titre de la notification ; `null` pour aucune. |

Ces méthodes sont internes : le navigateur ne peut pas les appeler.

### Actions

Toute action accepte les mêmes crochets, sans sous-classe :

```ts
CreateAction.make()
    .mutateDataUsing((data, { livewire }) => ({ ...data, team_id: currentTeamId() }))
    .before(async ({ data }) => { … })          // lever une erreur annule
    .after(async ({ record, data }) => { … }),
```

## Composants sur mesure

### Un champ

Héritez de `Field`. Rendez votre contrôle et confiez-le à `wrap()`, qui ajoute le libellé, le texte d'aide et le message d'erreur. Liez la valeur avec `wire:model`.

```ts
import { Field } from '@navette/forms';
import { e } from '@navette/support';

export class EffortField extends Field {
    static make(name: string): EffortField { return new EffortField(name); }
    getDefaultState(): unknown { return this._default ?? 1; }

    // La valeur vient du navigateur : validez-la.
    async getValidationRules() {
        return [...(await super.getValidationRules()), {
            name: 'between',
            passes: (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5,
            message: (attribute: string) => `The ${attribute} field must be between 1 and 5.`,
        }];
    }
    dehydrateState(state: unknown): unknown { return Number(state); }     // forme enregistrée

    async toHtml(): Promise<string> {
        return this.wrap(`<input type="range" min="1" max="5" id="${e(this.getId())}" wire:model="${e(this.getStatePath())}" />`);
    }
}
```

À connaître dans un champ :

| Membre | Rôle |
|---|---|
| `this.getId()`, `this.getStatePath()` | Identifiant HTML et chemin d'état (`data.effort`). |
| `this.context()` | `{ record, operation, state, get, livewire }`. `state` est la valeur courante. |
| `await this.isDisabled()`, `await this.isRequired()`, `this.hasError()` | État du champ. |
| `hydrateState(valeur)` | Met en forme la valeur de l'enregistrement à l'entrée dans le formulaire. |
| `dehydrateState(état)` | Met en forme l'état avant l'enregistrement. Peut être asynchrone. |
| `getValidationRules()` | Règles, en plus de `required`. |
| `getExposedMethods()` | Noms des méthodes du champ que son JavaScript peut appeler (recherche d'options, par exemple). |

Pour un champ interactif, écrivez un composant Alpine et liez-le à l'état : `x-data="{ state: $wire.$entangle('${this.getStatePath()}') }"`.

### Une colonne

```ts
import { Column } from '@navette/tables';

export class EffortColumn<R = any> extends Column<R> {
    static make<R = any>(name: string): EffortColumn<R> { return new EffortColumn<R>(name); }
    async toHtml(record: R): Promise<string> {
        const effort = Math.max(0, Math.min(5, Math.floor(Number(await this.getState(record)) || 0)));
        return `<div class="fi-ta-text fi-ta-text-item fi-size-sm" title="${effort}/5">${'●'.repeat(effort)}${'○'.repeat(5 - effort)}</div>`;
    }
}
```

La colonne hérite de `label`, `sortable`, `searchable`, `toggleable`, `alignEnd`, `getStateUsing`. Elle ne rend que le contenu de la cellule.

### Un composant de mise en page ou une entrée

Héritez de `Component` (de `@navette/schemas`) et implémentez `toHtml()`. Pour un simple bloc de HTML, `Html.make(...)` suffit.

### Avec une vue EJS

Dès que le HTML dépasse quelques lignes, sortez-le dans une vue :

```ts
import { views } from '@navette/support';

views.namespace('app', path.resolve('./views'));          // une fois, au démarrage

async toHtml() { return this.wrap(views.render('app::fields.effort', { id: this.getId(), path: this.getStatePath() })); }
```

`views/fields/effort.ejs` reçoit vos données, plus `t` (traductions) et `assetUrl`. Dans une vue, `<%= valeur %>` échappe, `<%- html %>` insère tel quel.

**Dans tous les cas, échappez les données avec `e()` (ou `<%= %>`)** : un composant sur mesure qui insère une valeur brute ouvre une faille XSS.

## Render hooks

Insèrent du HTML à un emplacement nommé, sans toucher aux vues.

```ts
import { e } from '@navette/support';

panel.renderHook('panels::content.end', () => `<p class="app-footer">${e(companyName)} — support : 01 23 45 67 89</p>`);
panel.renderHook('panels::head.end', () => '<link rel="stylesheet" href="/css/app.css">');
```

Les noms sont ceux de Filament, et chaque emplacement est au même endroit du balisage. Ils sont aussi disponibles en constantes : `PanelsRenderHook` et `WidgetsRenderHook` (`@navette/panels`), `TablesRenderHook` (`@navette/tables`), `ActionsRenderHook` (`@navette/actions`).

| Emplacement | Où |
|---|---|
| `panels::head.start`, `panels::head.end` | Début et fin de `<head>`. |
| `panels::styles.before`, `panels::styles.after` | Avant et après les feuilles de style du panel. |
| `panels::body.start`, `panels::body.end` | Début et fin de `<body>`. |
| `panels::scripts.before`, `panels::scripts.after` | Avant et après les scripts du panel. |
| `panels::layout.start`, `panels::layout.end` | Début et fin de la mise en page (`.fi-layout`). |
| `panels::content.before`, `panels::content.after` | Avant et après `<main>`. |
| `panels::content.start`, `panels::content.end` | Début et fin de `<main>`. |
| `panels::footer` | Pied de page, après le contenu (les deux mises en page). |
| `panels::simple-layout.start`, `panels::simple-layout.end` | Mise en page « simple » (connexion). |
| `panels::simple-page.start`, `panels::simple-page.end` | Page « simple ». |
| `panels::auth.login.form.before`, `…form.after` | Autour du formulaire de connexion. |
| `panels::sidebar.start`, `panels::sidebar.footer` | Tout en haut de la sidebar ; après son pied (sous le menu utilisateur). |
| `panels::sidebar.logo.before`, `panels::sidebar.logo.after` | Autour du logo. |
| `panels::sidebar.nav.start`, `panels::sidebar.nav.end` | Avant et après les entrées du menu. |
| `panels::user-menu.before`, `panels::user-menu.after` | Autour du menu utilisateur. |
| `panels::user-menu.profile.before`, `…profile.after` | Autour de l'en-tête du menu utilisateur. |
| `panels::page.start`, `panels::page.end` | Début et fin d'une page (`.fi-page`). |
| `panels::page.header.heading.before`, `…heading.after` | Autour du titre de la page. |
| `panels::page.header.actions.before`, `…actions.after` | Autour des actions d'en-tête. |
| `panels::page.header-widgets.before`, `.start`, `.end`, `.after` | Autour et à l'intérieur de la grille des widgets d'en-tête. |
| `panels::page.footer-widgets.before`, `…after` | Fin du contenu de la page (les widgets de pied de page ne sont pas portés). |
| `panels::resource.pages.list-records.table.before`, `…table.after` | Autour de la table d'une liste. |
| `panels::resource.relation-manager.before`, `…after` | Autour de la table d'un relation manager. |
| `tables::header.before`, `tables::header.after` | Autour de l'en-tête de la table (titre, actions). |
| `tables::toolbar.before`, `.start`, `.end`, `.after` | Autour et à l'intérieur de la barre d'outils. |
| `tables::toolbar.reorder-trigger.before`, `…after` | Autour du bouton de tri manuel. |
| `tables::toolbar.grouping-selector.before`, `…after` | À la place du sélecteur de regroupement (non porté). |
| `tables::toolbar.search.before`, `…after` | Autour du champ de recherche. |
| `tables::toolbar.toggle-column-trigger.before`, `…after` | Autour du gestionnaire de colonnes. |
| `tables::selection.indicator.actions.before`, `…after` | Autour de « Select all / Deselect all ». |
| `tables::filter.indicators` | **Remplace** les indicateurs de filtres actifs. Reçoit `data.filterIndicators`. |
| `tables::header.cell` | **Remplace** une cellule d'en-tête. Reçoit `data.column`, `data.isReordering` ; rendre `null` garde la cellule par défaut. |
| `tables::content.before`, `tables::content.after` | Avant et après les lignes. |
| `actions::modal.custom-content.before`, `…after` | Début du contenu d'une modale. Reçoit `data.action`. |
| `actions::modal.schema.before`, `…after` | Autour du formulaire d'une modale. |
| `actions::modal.custom-content-footer.before`, `…after` | Fin du contenu d'une modale. |

Déclarés mais pas encore rendus, parce que la brique manque (`UNPLACED_RENDER_HOOKS` en donne la liste) : barre du haut, recherche globale, menu de locataire, sous-navigation de page, inscription, réinitialisation du mot de passe, page des enregistrements liés, widget de table.

La fonction est appelée à chaque rendu et son résultat inséré tel quel. Elle reçoit `{ scopes, data }`.

**Portée.** Un troisième argument limite le hook à certaines pages : la classe d'une page, ou une resource (toutes ses pages).

```ts
panel.renderHook(PanelsRenderHook.PAGE_START, () => '<p class="notice">Import en cours</p>', OrderResource);
```

**Un panel, ses hooks.** `panel.renderHook()` ne vaut que pour ce panel. Pour un hook commun à tous les panels du processus : `renderHooks.register(nom, fonction)` (`@navette/support`).

## Réglages globaux

```ts
TextInput.configureUsing((input) => input.maxLength(255));
TextColumn.configureUsing((column) => column.placeholder('—'));
Section.configureUsing((section) => section.columns(2));
Action.configureUsing((action) => action.size('sm'));
```

Le réglage s'applique à chaque instance créée ensuite par `make()`, **avant** vos appels : une option posée explicitement l'emporte. Il vaut aussi pour les sous-classes (`Field.configureUsing` touche tous les champs). Posez-les au démarrage, avant de construire le panel.

## Remplacer une vue du framework

```ts
import { views } from '@navette/support';
views.overrideFrom(path.resolve('./views/vendor'));
```

Un fichier `views/vendor/<espace>/<chemin>.ejs` remplace la vue du même nom. Exemple : `views/vendor/filament-panels/components/user-menu.ejs` remplace le menu utilisateur. Les vues d'origine sont dans `packages/*/views`.

C'est le point d'extension le plus fragile : une vue remplacée ne suit plus les évolutions du framework. Préférez un render hook ou une feuille de thème quand ils suffisent.

## Plugins

Un plugin emballe une configuration pour la réutiliser d'un panel ou d'un projet à l'autre.

```ts
import type { Plugin } from '@navette/panels';

export const auditPlugin = (options: { retentionDays: number }): Plugin => ({
    id: 'audit',
    register(panel) {                       // pendant la construction du panel
        panel.resources([AuditLogResource]);
        panel.renderHook('panels::sidebar.footer', () => '<p class="audit-note">Actions journalisées</p>');
    },
    boot(panel) { … },                      // au montage du routeur, quand tout est enregistré
});

panel.plugin(auditPlugin({ retentionDays: 90 }));
```

`register` reçoit le panel : tout ce que vous faites à la main (`resources`, `pages`, `widgets`, `renderHook`, `themes`, `navigationItems`, `authorizeUsing`) est disponible. Deux plugins ne peuvent pas partager le même `id`.

## Accès à la requête

Dans une page, un widget ou un crochet, `this._ctx` donne le contexte de la requête : `{ req, res, panel, user }` (type `PanelContext`). Dans une fonction d'option (`visible`, `action`…), passez par `livewire._ctx`.

## Ce qui ne s'étend pas encore

- Les pages de connexion autres que `Login`, et la mise en page générale (barre latérale seule, pas de barre supérieure).
- La page de consultation (« View ») d'une resource.
- Un cycle de vie pour `DeleteAction` au-delà de `before` / `after`.
- Plusieurs panels dans la même application (non éprouvé ; render hooks et réglages globaux y seraient communs).
