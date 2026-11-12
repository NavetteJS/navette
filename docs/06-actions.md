# 6. Actions

Une action est un bouton qui fait quelque chose : ouvrir une adresse, exécuter un traitement, demander une confirmation, ouvrir un formulaire en modale.

```ts
import { Action, ActionGroup } from '@navette/actions';
import { Notification } from '@navette/panels';

Action.make('publish')
    .label('Publier').icon('m-rocket-launch').color('success')
    .requiresConfirmation()
    .action(async ({ record }) => {
        await PostResource.adapter.update(record.id, { published_at: new Date().toISOString() });
        Notification.make().success().title('Article publié').send();
    });
```

## Où placer une action

| Emplacement | Déclaration | Enregistrement visé |
|---|---|---|
| Ligne de table | `table.recordActions([...])` | la ligne (`record`) |
| Menu « ⋮ » d'une ligne | `table.recordActions([ActionGroup.make([...])])` | la ligne |
| Sélection | `table.groupedBulkActions([...])` | `await livewire.getSelectedRecordKeys()` |
| En-tête de table | `table.headerActions([...])` | aucun |
| En-tête de page | `getHeaderActions()` d'une page, `listHeaderActions` / `editHeaderActions` d'une resource | l'enregistrement édité, s'il y en a un |
| Titre d'une section | `Section.make('…').afterHeader([...])` | celui du formulaire |

## Apparence

| Méthode | Effet |
|---|---|
| `label('…')`, `icon('m-…')`, `color('danger')` | Acceptent une fonction du contexte : `label(({ record }) => (record.is_active ? 'Désactiver' : 'Activer'))`. |
| `tooltip('…')` | Infobulle. |
| `badge(valeur ou fonction)`, `badgeColor('warning')` | Pastille sur un bouton d'en-tête. |
| `visible(fn)`, `hidden(fn)` | Affichage conditionnel. Une action masquée ne peut pas être exécutée, même par une requête forgée. |
| `disabled(fn)` | Visible mais inactive. |
| `keyBindings(['mod+s'])` | Raccourci clavier. |
| `size('sm')` | Taille du bouton. |

## Trois sortes d'actions

### Lien

```ts
Action.make('edit').label('Modifier').icon('c-pencil-square').url(({ record }) => TaskResource.getUrl('edit', record.id)),
Action.make('site').url(({ record }) => record.website).openUrlInNewTab(),
```

Seules les adresses locales (`/…`) ou `http(s)` deviennent des liens.

### Traitement direct ou avec confirmation

```ts
Action.make('archive').action(async ({ record }) => { … }),                    // exécution immédiate
Action.make('delete').color('danger').requiresConfirmation()
    .modalHeading(({ record }) => `Supprimer ${record.title}`)
    .modalDescription('Cette action est définitive.')
    .modalSubmitActionLabel('Supprimer').modalIcon('o-trash')
    .action(async ({ record }) => { … }),
```

### Formulaire en modale

```ts
Action.make('adjust_price').icon('m-currency-euro').color('warning')
    .modalWidth('md').modalSubmitActionLabel('Enregistrer')
    .fillForm(({ record }) => ({ price: record.price }))          // valeurs initiales
    .schema(() => [TextInput.make('price').numeric().minValue(0).required()])
    .action(async ({ record, data }) => { await ProductResource.adapter.update(record.id, { price: data.price }); }),
```

`data` ne contient que les champs du schéma, validés. Variantes :

- `slideOver()` : la modale glisse depuis le bord de l'écran.
- `modalSubmitAction(false)` : modale de consultation, sans bouton de validation. Avec des `TextEntry` / `IconEntry` dans le schéma, c'est une fiche en lecture seule.

```ts
Action.make('view').icon('m-eye').color('gray').slideOver().modalSubmitAction(false)
    .schema(() => [
        TextEntry.make('name'),
        TextEntry.make('salary').money('usd'),
        TextEntry.make('hired_at').date(),
        TextEntry.make('status').badge().color((record) => STATUSES[record.status].color),
        IconEntry.make('is_active').boolean(),
    ]),
```

## Ce que reçoit le traitement

```ts
.action(async ({ record, data, livewire, arguments: args }) => { … })
```

- `record` : l'enregistrement visé, **relu en base par l'adaptateur** à partir de la clé envoyée. Si la clé ne désigne rien dans la portée de l'adaptateur, l'action est refusée.
- `data` : les valeurs du formulaire de la modale.
- `livewire` : le composant hôte (page de liste, relation manager). Utile pour les actions groupées.

## Actions groupées

```ts
table.groupedBulkActions([
    Action.make('mark_done').label('Terminer').icon('m-check')
        .action(async ({ livewire }) => {
            // Les clés sont ramenées à ce que la table peut réellement afficher.
            for (const key of await livewire.getSelectedRecordKeys()) await TaskResource.adapter.update(key, { is_done: true });
            livewire.deselectAllTableRecords();
        }),
    DeleteBulkAction.make(),
]);
```

Une action groupée peut aussi avoir un `schema` (choisir une valeur à appliquer à toute la sélection).

## Actions prêtes à l'emploi

De `@navette/panels` : `CreateAction`, `EditAction`, `DeleteAction`, `DeleteBulkAction`, `RestoreAction`, `ForceDeleteAction` (suppression douce), `AttachAction`, `DetachAction`, `DetachBulkAction` (relations plusieurs-à-plusieurs). Chacune rend une `Action` que vous pouvez encore configurer :

```ts
DeleteAction.make().visible(({ record }) => !record.is_locked),
```

## Notifications

```ts
Notification.make().success().title('Enregistré').body('Les changements sont en ligne.').send();
Notification.make().warning().title('Stock bas').persistent().send();
Notification.make().danger().title('Échec').duration(8000).send();
```

États : `success()`, `warning()`, `danger()`, `info()`. Une notification envoyée pendant un traitement s'affiche à la fin de la requête, y compris après une redirection.

## Sécurité des actions

- Le nom de l'action, son contexte et la clé de l'enregistrement viennent du navigateur. Le framework ne monte que les actions déclarées à l'emplacement demandé, relit l'enregistrement, et revérifie `visible` / `hidden` avant l'exécution.
- **Mettez vos règles d'autorisation dans `visible` / `hidden`** (ou refusez dans `action`) : masquer un bouton côté interface ne suffit que parce que le serveur applique la même condition.
