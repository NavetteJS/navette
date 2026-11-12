# 4. Tables

```ts
import { ColorColumn, IconColumn, ImageColumn, SelectFilter, Sum, TernaryFilter, TextColumn, TrashedFilter, type Table } from '@navette-js/tables';

static table(table: Table<Order>): Table<Order> {
    return table
        .columns([...])
        .defaultSort('created_at', 'desc')
        .filters([...])
        .recordActions([...])
        .groupedBulkActions([...]);
}
```

L'état de la table (recherche, tri, page, filtres, colonnes masquées) vient du navigateur. Le framework n'en retient que ce que la table déclare : une colonne non triable n'est jamais triée, un filtre inconnu est ignoré, une sélection est ramenée aux lignes que l'adaptateur peut réellement voir.

## Colonnes

Options communes à toutes les colonnes :

| Méthode | Effet |
|---|---|
| `label('…')` | Intitulé (par défaut : déduit du nom). |
| `sortable()` | Tri par clic sur l'en-tête. `sortable({ column: 'customer_name' })` trie sur une autre colonne ou un alias. |
| `searchable()` | Incluse dans la recherche globale. `{ column }` pour chercher sur un alias, `{ isIndividual: true }` pour un champ de recherche propre à la colonne. |
| `toggleable()` | L'utilisateur peut la masquer. `toggleable(true, { isToggledHiddenByDefault: true })` la masque d'emblée. |
| `alignEnd()`, `alignCenter()` | Alignement. |
| `getStateUsing(({ record }) => …)` | Valeur calculée au lieu de l'attribut du même nom. |
| `url((record) => …)` | Lien propre à la cellule. |

### `TextColumn`

```ts
TextColumn.make('name').searchable().sortable().weight('medium'),
TextColumn.make('price').money('usd').alignEnd().summarize(Sum.make().money('usd')),
TextColumn.make('qty').numeric().alignEnd(),          // 1,234      numeric(1) → 12.0
TextColumn.make('created_at').date(),                 // Nov 9, 2026
TextColumn.make('sku').copyable(),                    // clic : copie dans le presse-papiers
TextColumn.make('notes').placeholder('—'),            // texte affiché quand la valeur est vide
TextColumn.make('status').badge()
    .formatStateUsing(({ record }) => STATUSES[record.status].label)
    .color((record) => STATUSES[record.status].color)
    .icon((record) => STATUSES[record.status].icon),   // icône « c- » (16 px)
```

`summarize(Sum.make())` ajoute une ligne de totaux : la page courante, puis tous les enregistrements de la requête.

### Autres colonnes

```ts
IconColumn.make('is_active').boolean(),                               // coche verte / croix rouge
ColorColumn.make('color'),                                            // pastille d'une couleur hexadécimale
ImageColumn.make('avatar').getStateUsing(({ record }) => record.avatar_url)
    .alt((record) => record.name).imageHeight('2.5rem').circular(),   // l'état est l'adresse de l'image
```

`ImageColumn` ne rend que des adresses locales (`/…`) ou `http(s)`.

### Colonne d'une relation

Le plus simple et le plus rapide : calculez la valeur dans la requête de l'adaptateur (voir [Données](08-donnees.md)), puis lisez l'alias.

```ts
TextColumn.make('customer.name')
    .getStateUsing(({ record }) => record.customer_name ?? null)
    .searchable({ column: 'customer_name' })
    .sortable({ column: 'customer_name' }),
```

### Groupes de colonnes

```ts
ColumnGroup.make('Adresse').columns([TextColumn.make('city'), TextColumn.make('zip')]),
```

## Tri, pagination, clic sur une ligne

```ts
table
    .defaultSort('name')                         // ou ('created_at', 'desc')
    .paginationPageOptions([10, 25, 50])
    .recordUrl((record) => `/tasks/${record.id}/edit`)   // par défaut : la page d'édition de la resource
    .recordAction('edit')                        // ou : ouvrir une action au clic
    .recordClasses((record) => (record.is_late ? 'bg-danger' : null))
    .stackedOnMobile();                          // cellules empilées avec leur intitulé sur petit écran
```

## Filtres

```ts
.filters([
    SelectFilter.make('status').options([['draft', 'Brouillon'], ['published', 'Publié']]),
    // Options chargées, sur une colonne dont le nom diffère de celui du filtre :
    SelectFilter.make('department').column('department_id')
        .options(async () => (await knex('departments').select('id', 'name')).map((d) => [String(d.id), d.name])),
    TernaryFilter.make('is_active'),             // tous / oui / non
    TrashedFilter.make(),                        // avec un adaptateur à suppression douce
])
```

Les filtres sont appliqués quand l'utilisateur clique « Apply ». Par défaut ils s'ouvrent dans un menu ; `filters([...], { layout: 'above-content-collapsible' })` les place au-dessus de la table, repliables.

### Filtre personnalisé

Un filtre est un objet qui respecte l'interface `TableFilter` : un nom, un état par défaut, et une fonction `apply` qui restreint la requête.

```ts
const overdue: TableFilter = {
    name: 'overdue',
    getLabel: () => 'Retard',
    getDefaultState: () => ({ value: null }),
    getFormDefinition: () => ({ placeholder: 'Toutes', options: [['1', 'En retard']] }),
    isActive: (state) => state.value === '1',
    apply: (query, state) => {
        if (state.value !== '1') return;
        (query.modifiers ??= []).push((q) => { q.where('due_date', '<', new Date().toISOString().slice(0, 10)).where('is_done', 0); });
    },
};
```

`state` vient du navigateur : comparez-le à des valeurs connues, et passez toute valeur libre en paramètre lié (`q.where(colonne, valeur)`), jamais par concaténation.

### Constructeur de requêtes

Laisse l'utilisateur composer ses propres règles, combinées en ET, avec des blocs OU.

```ts
import { BooleanConstraint, DateConstraint, NumberConstraint, QueryBuilder, TextConstraint } from '@navette-js/tables';

.filters([
    QueryBuilder.make()
        .constraints([
            TextConstraint.make('name'),
            NumberConstraint.make('price').icon('m-currency-dollar'),
            BooleanConstraint.make('is_visible').label('Visibilité'),
            DateConstraint.make('published_at'),
            TextConstraint.make('brand').attribute('brand_name'),   // colonne ou alias différent du nom
        ])
        .constraintPickerColumns(2),
], { layout: 'above-content-collapsible' })
```

Seules les colonnes déclarées par une contrainte sont interrogeables ; types de règle et opérateurs inconnus sont écartés ; 100 règles et 3 niveaux de blocs OU au plus. Les opérateurs de date utilisent des fonctions SQLite.

## Actions

Voir [Actions](06-actions.md) pour le détail.

```ts
table
    .headerActions([CreateAction.make()])                     // dans l'en-tête de la table (relation managers)
    .recordActions([EditAction.make(), DeleteAction.make()])  // sur chaque ligne ; ActionGroup.make([...]) pour un menu « ⋮ »
    .groupedBulkActions([DeleteBulkAction.make()]);           // menu des actions sur la sélection ; [] : aucune case à cocher
```

## Tri manuel des lignes

```ts
table.defaultSort('sort').reorderable('sort');
```

Un bouton fait passer la table en mode tri : toutes les lignes s'affichent avec une poignée, sans pagination ni actions, et l'ordre déposé est écrit dans la colonne indiquée (1, 2, 3…). Limite : 1 000 lignes.

## En-tête de table

`table.heading('Paiements')` affiche un titre au-dessus de la table (utilisé par les relation managers, qui prennent par défaut le nom de la relation).
