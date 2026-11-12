# 8. Données

Le framework ne parle pas à la base directement : chaque resource a un **adaptateur**, qui sait lister, lire, créer, modifier et supprimer ses enregistrements. L'adaptateur fourni s'appuie sur [Objection](https://vincit.github.io/objection.js/) et [Knex](https://knexjs.org/).

## Connexion

```ts
import { createConnection, sqlite } from '@navette/database';

const knex = sqlite('./data.sqlite');                                   // développement
const knex = createConnection({ client: 'pg', connection: process.env.DATABASE_URL });   // tout pilote Knex
```

`sqlite` utilise le pilote `better-sqlite3`. Pour un autre moteur, installez son pilote (`pg`, `mysql2`…).

> Les fonctions de date du constructeur de requêtes et quelques exemples de la démo utilisent du SQL propre à SQLite. Le reste passe par Knex.

## Modèle

```ts
import { Model } from '@navette/database';

export class Task extends Model {
    static tableName = 'tasks';
    static jsonAttributes = ['metadata'];        // colonnes JSON lues et écrites comme des valeurs JavaScript
    id!: number;
    title!: string;
    is_done!: number | boolean;
    created_at!: string;
    updated_at!: string;

    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
    // SQLite n'a pas de type booléen.
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.is_done === 'boolean') out.is_done = out.is_done ? 1 : 0;
        return out;
    }
}
```

## `ObjectionAdapter`

```ts
static adapter = new ObjectionAdapter(Task);
```

Options :

```ts
new ObjectionAdapter(Order, {
    softDeletes: 'deleted_at',     // suppression douce : la suppression remplit cette colonne
    findsTrashed: true,            // la page d'édition ouvre aussi un enregistrement supprimé (pour le restaurer)
    modify: (query) => { … },      // portée et colonnes calculées, appliquées à TOUTES les requêtes
});
```

### `modify` : portée et colonnes calculées

`modify` est le point le plus important de l'adaptateur. Tout ce que la resource lit ou écrit passe par cette requête.

**Restreindre ce qui est visible** (multi-locataire, droits) :

```ts
modify: (query) => { query.where('tasks.team_id', currentTeamId()); },
```

Un enregistrement hors de cette portée est introuvable : ni affiché, ni modifiable, ni supprimable, même si sa clé est envoyée à la main.

**Ajouter des colonnes d'une relation**, utilisables pour l'affichage, le tri et la recherche :

```ts
modify: (query) => {
    query.select(
        'orders.*',
        knex('customers').select('customers.name').whereRaw('customers.id = orders.customer_id').as('customer_name'),
        knex('order_items').count('*').whereRaw('order_items.order_id = orders.id').as('items_count'),
    );
},
```

```ts
TextColumn.make('customer.name').getStateUsing(({ record }) => record.customer_name).sortable({ column: 'customer_name' }).searchable({ column: 'customer_name' }),
```

Préférez des sous-requêtes à des jointures : elles ne multiplient pas les lignes et gardent la pagination exacte.

## Données qui ne tiennent pas dans une ligne

Quand un formulaire contient autre chose que des colonnes (lignes répétées, catégories, images), sous-classez l'adaptateur et répartissez les données.

```ts
class Products extends ObjectionAdapter<Product> {
    constructor() { super(Product); }

    async find(key: string | number) {
        const product = await super.find(key);
        if (product) (product as any).categories = (await knex('category_product').where({ product_id: key })).map((row) => String(row.category_id));
        return product;
    }
    async create(data: Record<string, unknown>) {
        const { categories, ...attributes } = data;
        const product = await super.create(attributes);
        await this.syncCategories(product.id, categories);
        return product;
    }
    async update(key: string | number, data: Record<string, unknown>) {
        const { categories, ...attributes } = data;
        if (!(await super.find(key))) return null;            // l'enregistrement doit être dans la portée avant toute écriture
        await super.update(key, attributes);
        await this.syncCategories(key, categories);
        return this.find(key);
    }
    // Seules des catégories existantes sont rattachées : la liste vient du navigateur.
    private async syncCategories(key: string | number, categories: unknown) { … }
}
```

Exemples complets dans la démo : `Orders` (adresse et lignes de commande), `Products` (catégories et images), `CustomerAddresses` (relation polymorphe).

## Écrire son propre adaptateur

Pour une API distante ou un autre ORM, implémentez l'interface `DataAdapter` de `@navette/database` :

| Méthode | Rôle |
|---|---|
| `getKey(record)` | Clé d'un enregistrement, en chaîne. |
| `paginate(query)` | Page d'enregistrements pour une `ListQuery` (recherche, tri, filtres, page). |
| `find(key)`, `create(data)`, `update(key, data)`, `delete(key)` | Lecture et écriture unitaires. |
| `listKeys(query)`, `keysInScope(keys)`, `deleteMany(keys)` | Sélection et actions groupées. `keysInScope` ne rend que les clés réellement accessibles. |
| `count()`, `sum(query, colonnes)`, `aggregate(query, colonnes)` | Compteurs, totaux, statistiques. |
| `exists(colonne, valeur, saufClé)` | Règle `unique`. |
| `supportsSoftDeletes()`, `isTrashed(record)`, `restore(key)`, `forceDelete(key)` | Suppression douce. |
| `getLabel()` | Nom de l'entité. |

`ListQuery.modifiers` porte des fonctions qui reçoivent un constructeur de requête Objection : un adaptateur qui n'en a pas doit définir sa propre façon d'exprimer onglets et filtres.

## Hors des resources

Dans une action, un widget ou une page, utilisez directement vos modèles ou Knex :

```ts
const open = await Task.query().where('is_done', 0).resultSize();
await knex('audit_log').insert({ user_id: user.id, action: 'export' });
```

Toujours avec des paramètres liés (`where(colonne, valeur)`, `whereRaw('… like ?', [valeur])`), jamais en concaténant une valeur reçue.
