# 5. Formulaires

Un formulaire est un schéma : des champs, rangés par des composants de mise en page.

```ts
import { Checkbox, CheckboxList, ColorPicker, DatePicker, FileUpload, KeyValue, Repeater, RichEditor, Select, TableColumn, Textarea, TextInput, Toggle, ToggleButtons } from '@navette-js/forms';
import { Grid, Group, Section, Tab, Tabs, type Schema } from '@navette-js/schemas';

static form(schema: Schema): Schema {
    return schema
        .components([
            Section.make('Identité').schema([
                TextInput.make('name').required().maxLength(255),
                TextInput.make('email').email().required().unique({ ignoreRecord: true }),
            ]).columns(2),
        ])
        .columns(2);
}
```

Le nom d'un champ est le nom de l'attribut lu dans l'enregistrement et écrit à l'enregistrement.

## Options communes à tous les champs

| Méthode | Effet |
|---|---|
| `label('…')`, `hiddenLabel()` | Intitulé ; `hiddenLabel` le réserve aux lecteurs d'écran. |
| `helperText('…')` | Texte d'aide sous le champ. |
| `default(valeur)` ou `default(() => valeur)` | Valeur initiale à la création. |
| `required()` | Obligatoire. Accepte une fonction : `required(({ get }) => get('type') === 'pro')`. |
| `disabled()` | Non modifiable ; n'est alors ni validé ni enregistré, sauf avec `dehydrated()`. |
| `dehydrated(false)` | Champ de saisie qui ne doit pas être enregistré. |
| `hidden(...)`, `visible(...)`, `hiddenOn('create')`, `visibleOn('edit')` | Affichage conditionnel. Un champ masqué n'est ni validé ni enregistré. |
| `columnSpan(2)`, `columnSpan('full')`, `columnSpanFull()`, `columnStart(1)` | Place dans la grille. |
| `unique({ ignoreRecord: true })` | Valeur absente des autres enregistrements (`{ column }` si la colonne diffère du nom). |
| `rule({ name, passes, message })` | Règle de validation libre. |
| `afterStateUpdated(fn)` | Réagit côté serveur à un changement (champ `live()`). |

Les fonctions reçoivent un contexte : `{ record, operation, state, get, livewire }`. `get('autre_champ')` lit un autre champ du formulaire.

## Champs

### Texte

```ts
TextInput.make('name').required().maxLength(255).minLength(2).placeholder('Nom complet'),
TextInput.make('email').email(),
TextInput.make('website').url(),                     // http ou https seulement
TextInput.make('phone').tel().mask('(999) 999-9999'),
TextInput.make('password').password().revealable(),
TextInput.make('price').numeric().prefix('€').minValue(0).maxValue(99999.99),
TextInput.make('qty').integer().minValue(0),
Textarea.make('notes').rows(4).maxLength(2000),
RichEditor.make('description'),                      // enregistré en HTML, nettoyé côté serveur
```

### Choix

```ts
Select.make('status').options([['draft', 'Brouillon'], ['published', 'Publié']]).placeholder('Choisir'),
Select.make('country').options(COUNTRIES).searchable(),                          // sélecteur avec recherche
Select.make('customer_id').label('Client').searchable()                          // recherche côté serveur
    .getSearchResultsUsing(async (search) => (await knex('customers').whereRaw('lower(name) like ?', [`%${search.toLowerCase()}%`]).limit(50)).map((c) => [String(c.id), c.name]))
    .getOptionLabelUsing(async (value) => (await knex('customers').where({ id: value }).first())?.name ?? null),
Select.make('tags').multiple()                                                   // plusieurs valeurs : l'état est une liste
    .getSearchResultsUsing(searchTags).getOptionLabelsUsing(labelsOfTags),
ToggleButtons.make('priority').options([['low', 'Basse'], ['high', 'Haute']]).inline()
    .colors({ low: 'gray', high: 'danger' }).icons({ high: 'm-fire' }),
CheckboxList.make('skills').options([['php', 'PHP'], ['ts', 'TypeScript']]).columns(3),   // l'état est une liste
Checkbox.make('accept'),
Toggle.make('is_active').default(true),
```

Une valeur choisie est toujours revérifiée : elle doit figurer dans les options, ou, avec une recherche serveur, recevoir un libellé de `getOptionLabelUsing` / `getOptionLabelsUsing`. Ces fonctions servent donc aussi de validation : ne leur faites rendre un libellé que pour une valeur que l'utilisateur a le droit de choisir.

### Dates, couleurs, paires

```ts
DatePicker.make('due_date').minDate('today').maxDate('2030-12-31'),
ColorPicker.make('color'),                                             // hexadécimal
KeyValue.make('metadata').keyLabel('Propriété').valueLabel('Valeur').reorderable(),   // enregistré comme un objet
```

`CheckboxList` et `KeyValue` produisent une liste et un objet : déclarez la colonne en JSON dans le modèle (`static jsonAttributes = ['skills', 'metadata']`).

### Lignes répétées

```ts
Repeater.make('items').label('Lignes').defaultItems(1).maxItems(50)
    .table([TableColumn.make('Produit'), TableColumn.make('Quantité').width(100)])
    .schema(() => [
        Select.make('product_id').options(products).required(),
        TextInput.make('qty').integer().minValue(1).default(1).required(),
    ]),
```

L'état est un objet de lignes indexé par clé. L'enregistrement des lignes revient à votre adaptateur (voir `Orders` dans `apps/demo/resources/OrderResource.ts`).

### Fichiers

Voir [Fichiers](10-fichiers.md).

## Champs dépendants

`live()` envoie la valeur au serveur dès qu'elle change ; le formulaire est alors recalculé.

```ts
ToggleButtons.make('type').options([['person', 'Particulier'], ['company', 'Société']]).live().default('person'),
TextInput.make('company_name').visible(({ get }) => get('type') === 'company').required(),
TextInput.make('name').live({ onBlur: true })          // envoi à la sortie du champ
    .afterStateUpdated(({ state, set }) => set('slug', slugify(String(state ?? '')))),
```

## Mise en page

```ts
schema.components([
    Group.make().schema([                       // colonne principale
        Section.make('Contenu').schema([...]).columns(2),
        Section.make('Images').schema([...]).collapsible(),     // .collapsed() : repliée d'emblée
    ]).columnSpan({ lg: 2 }),
    Section.make('Publication').schema([...]).columnSpan({ lg: 1 }),
]).columns(3);
```

| Composant | Rôle |
|---|---|
| `Section.make('Titre')` | Carte avec titre. Sans titre : carte nue. `.afterHeader([actions])` place des actions à droite du titre. |
| `Group.make()` | Regroupe sans cadre, pour composer des colonnes. |
| `Grid.make(3)` | Grille de n colonnes. |
| `Tabs.make('Nom').schema([Tab.make('Général').icon('m-user').schema([...]).columns(2), …])` | Onglets ; tous les champs restent dans le même formulaire. |
| `Html.make('…')` | Balisage libre, inséré tel quel (à échapper vous-même). |

`columns(n)` vaut à partir de l'écran `lg` ; pour régler par taille d'écran : `columns({ sm: 2, lg: 3 })`. `columnSpan('full')` occupe toute la largeur à partir de `lg`, `columnSpanFull()` à toutes les tailles.

Dans un formulaire, `TextEntry` (de `@navette-js/infolists`) affiche une valeur en lecture seule :

```ts
TextEntry.make('created_at').label('Créé').state(({ record }) => diffForHumans(record.created_at)),
```

## Validation

La validation se fait côté serveur à l'enregistrement ; les attributs HTML (`required`, `max`…) ne sont qu'un confort. Une règle libre :

```ts
TextInput.make('code').rule({
    name: 'code_format',
    passes: (value) => /^[A-Z]{3}-\d{4}$/.test(String(value)),
    message: (attribute) => `The ${attribute} field format is invalid.`,
}),
```

`passes` peut être asynchrone et reçoit le contexte en second argument. Une règle autre que `required` n'est pas évaluée sur une valeur vide.

## Ce que reçoit l'adaptateur

À l'enregistrement, l'adaptateur reçoit un objet ne contenant que les champs déclarés, visibles et actifs du formulaire : un champ que le navigateur ajouterait à la requête n'y figure pas. Les champs composés (`Repeater`, `FileUpload` sans stockage, sélection multiple d'une relation) arrivent sous leur nom ; à l'adaptateur de les répartir (voir [Données](08-donnees.md)).
