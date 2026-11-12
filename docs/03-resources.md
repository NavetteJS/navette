# 3. Resources

Une resource regroupe tout ce qui concerne une entité : ses pages (liste, création, édition), sa table, son formulaire.

```ts
import { ObjectionAdapter } from '@navette/database';
import { Resource } from '@navette/panels';
import type { Schema } from '@navette/schemas';
import type { Table } from '@navette/tables';

export class TaskResource extends Resource {
    static slug = 'tasks';
    static modelLabel = 'task';
    static adapter = new ObjectionAdapter(Task);

    static form(schema: Schema): Schema { return schema.components([/* champs */]); }
    static table(table: Table<Task>): Table<Task> { return table.columns([/* colonnes */]); }
}
```

Enregistrée par `panel.resources([TaskResource])`, elle crée trois pages : `/tasks`, `/tasks/create`, `/tasks/{id}/edit`.

## Propriétés statiques

| Propriété | Rôle |
|---|---|
| `slug` | Chemin des pages. Peut contenir des `/` (`shop/products`). |
| `modelLabel`, `pluralModelLabel` | Nom de l'entité dans les titres et boutons. Le pluriel est déduit s'il est absent. |
| `recordTitleAttribute` | Attribut servant de titre à un enregistrement (fil d'Ariane, modales). |
| `adapter` | Accès aux données. Voir [Données](08-donnees.md). |
| `navigationIcon`, `navigationGroup`, `navigationSort`, `navigationBadge`, `getNavigationBadge()` | Voir [Le panel](02-panel.md). |
| `isSimple = true` | Une seule page : création et édition s'ouvrent en modales (équivalent de `ManageRecords`). |
| `relations = [...]` | Relation managers affichés sous le formulaire d'édition. |
| `widgets`, `headerWidgets` | Voir [Widgets](07-widgets.md). |
| `tabs()` | Onglets de la liste. |
| `listHeaderActions()`, `editHeaderActions()` | Actions supplémentaires dans l'en-tête de la liste ou de la page d'édition. |

## Une resource simple (tout en modales)

Pour une entité à peu de champs, évitez les pages de création et d'édition :

```ts
export class TagResource extends Resource {
    static slug = 'tags';
    static modelLabel = 'tag';
    static isSimple = true;
    static adapter = new ObjectionAdapter(Tag);
    static form(schema: Schema): Schema { return schema.components([TextInput.make('name').required()]); }
    static table(table: Table): Table {
        return table.columns([TextColumn.make('name').searchable()]).recordActions([EditAction.make(), DeleteAction.make()]);
    }
}
```

Cliquer une ligne ouvre l'édition. `EditAction`, `DeleteAction`, `CreateAction`, `DeleteBulkAction`, `RestoreAction`, `ForceDeleteAction` viennent de `@navette/panels`.

## Onglets de liste

Chaque onglet restreint la requête et peut afficher un compteur, calculé après l'affichage de la page.

```ts
static tabs(): Record<string, Tab> {
    return {
        '': Tab.make('Toutes'),                                   // la clé vide est l'onglet par défaut
        open: Tab.make('À faire').badge(() => Task.query().where('is_done', 0).resultSize()).badgeColor('warning')
            .query((query) => { query.where('is_done', 0); }),
        done: Tab.make('Terminées').query((query) => { query.where('is_done', 1); }),
    };
}
```

`query` reçoit le constructeur de requête Objection de l'adaptateur.

## Opération en cours

Dans un formulaire, `operation` vaut `'create'` ou `'edit'`, et `record` est l'enregistrement édité (ou `null`).

```ts
TextInput.make('slug').disabled().dehydrated()            // affiché, non modifiable, mais enregistré
    .hiddenOn('create'),
Section.make('Historique').hidden(({ record }) => record === null),
TextInput.make('name').live({ onBlur: true })
    .afterStateUpdated(({ operation, state, set }) => { if (operation === 'create') set('slug', slugify(String(state))); }),
```

## Relation managers

Un relation manager est une table d'enregistrements liés, affichée sous le formulaire d'édition, dans un onglet par relation.

```ts
import { CreateAction, DeleteAction, EditAction, RelationManager } from '@navette/panels';

export class CommentsRelationManager extends RelationManager {
    static relationship = 'comments';            // sert au titre de l'onglet : « Comments »
    static modelLabel = 'comment';
    static recordTitleAttribute = 'title';

    // L'adaptateur est restreint au propriétaire : c'est lui qui garantit qu'on ne voit et ne modifie que ses enregistrements.
    static adapterFor(ownerKey: string) {
        return new ObjectionAdapter(Comment, { modify: (query) => { query.where('task_id', ownerKey); } });
    }
    static form(schema: Schema): Schema { return schema.components([TextInput.make('title').required(), Textarea.make('content')]); }
    static table(table: Table): Table {
        return table
            .columns([TextColumn.make('title'), TextColumn.make('created_at').date()])
            .headerActions([CreateAction.make()])
            .recordActions([EditAction.make(), DeleteAction.make()]);
    }
}

class TaskResource extends Resource {
    static relations = [CommentsRelationManager];
}
```

Points d'attention :

- À la création, l'adaptateur doit rattacher l'enregistrement au propriétaire. Avec une clé étrangère simple, sous-classez l'adaptateur et forcez la valeur dans `create` (voir `Products` dans `apps/demo/resources/ProductResource.ts`). **Ne faites pas confiance à une clé étrangère envoyée par le formulaire.**
- Sans action groupée (`.groupedBulkActions([])`) ni action de ligne, la table est en lecture seule : ni cases à cocher, ni colonne d'actions.
- Relation plusieurs-à-plusieurs : définissez `attach`, `detach`, `searchAttachable`, `attachableLabel` sur le manager et utilisez `AttachAction`, `DetachAction`, `DetachBulkAction` (exemple complet : `AddressesRelationManager` dans `apps/demo/resources/CustomerResource.ts`).
- Un manager se réutilise par héritage, par exemple pour changer seulement le type de propriétaire (`BrandAddressesRelationManager`).

## Actions d'en-tête de page

```ts
static listHeaderActions = () => [
    Action.make('import').label('Importer').color('gray').icon('m-arrow-up-tray').url('/tasks/import'),
];
static editHeaderActions = () => [
    Action.make('preview').label('Voir').color('gray').url(({ record }) => `/public/tasks/${record.id}`).openUrlInNewTab(),
];
```

La liste garde son bouton « New … », la page d'édition ses actions par défaut (suppression, et restauration si l'adaptateur gère la suppression douce).
