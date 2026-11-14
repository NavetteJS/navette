---
title: Data adapters
---

## Introduction

Navette does not talk to the database directly. Each resource has an **adapter**: an object that lists, reads, creates, updates and deletes its records. Tables, forms, bulk actions, global search and widgets all go through it.

`@navette-js/database` provides the `DataAdapter` interface and an adapter for SQL databases, `ObjectionAdapter`, built on [Objection](https://vincit.github.io/objection.js/) and [Knex](https://knexjs.org/):

```ts
import { Model, ObjectionAdapter, sqlite } from '@navette-js/database';

sqlite('./database.sqlite');

class Task extends Model {
    static tableName = 'tasks';
}

export class TaskResource extends Resource {
    static adapter = new ObjectionAdapter(Task);
}
```

## Connecting to a database

`createConnection()` creates a Knex connection and binds the Objection models to it. It takes the configuration of Knex, so any database supported by Knex works, once its driver is installed (`pg`, `mysql2`…):

```ts
import { createConnection } from '@navette-js/database';

const knex = createConnection({ client: 'pg', connection: process.env.DATABASE_URL });
```

`sqlite()` is a shortcut for SQLite, with the `better-sqlite3` driver:

```ts
import { sqlite } from '@navette-js/database';

const knex = sqlite('./database.sqlite');
```

Both return the Knex instance, which you can use for your own queries. `Model` is the `Model` class of Objection, re-exported.

<Aside variant="warning">
SQLite is the database Navette is tested with. Most queries go through Knex and work elsewhere, but a few features write SQLite-specific SQL: the date operators of the query builder filter, and the monthly trends of `trendPageTable()`.
</Aside>

## Defining a model

A model is an Objection model. Set its table, and use the hooks of Objection for timestamps and conversions:

```ts
import { Model } from '@navette-js/database';

export class Task extends Model {
    static tableName = 'tasks';
    static jsonAttributes = ['metadata'];   // JSON columns, read and written as JavaScript values

    id!: number;
    title!: string;
    is_done!: number | boolean;
    created_at!: string;
    updated_at!: string;

    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }

    // SQLite has no boolean type.
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.is_done === 'boolean') out.is_done = out.is_done ? 1 : 0;
        return out;
    }
}
```

## Configuring the Objection adapter

`ObjectionAdapter` takes the model, and options:

```ts
new ObjectionAdapter(Order, {
    softDeletes: 'deleted_at',  // soft deletes: deleting fills this column
    findsTrashed: true,         // record pages also open soft-deleted records (to restore them)
    modify: (query) => { /* ... */ }, // scope and computed columns, applied to EVERY query
});
```

Searches are case-insensitive, every word must match one of the searchable columns, and the `%` and `_` characters typed by the user are escaped. Every value goes through bound parameters.

### Customizing the query

`modify` receives the Objection query builder of every read: lists, record pages, bulk selections, global search, aggregates. It is the most important option of the adapter.

**To restrict what is visible** (permissions, multi-tenancy):

```ts
modify: (query) => { query.where('tasks.team_id', currentTeamId()); },
```

A record outside of this scope cannot be found: it is neither displayed, nor editable, nor deletable, even if its key is sent by hand.

**To add computed columns**, usable for display, sorting and searching, select them with subqueries: they do not multiply rows, and keep the pagination right. Exclude computed columns from writes, for example in `$formatDatabaseJson()` of the model. Data from related records needs no such column: see [relationships](#relationships).

<Aside variant="info">
The adapter is shared by every request and does not know the user. To filter by user, make them available during the request with an `AsyncLocalStorage`, filled by an Express middleware mounted before `panelRouter()`. In a [multi-tenant panel](/panels/tenancy), the scope of the current tenant is applied for you.
</Aside>

### Relationships

Declare the relationships of a model in its `relationMappings`, as usual with Objection:

```ts
import { Model } from '@navette-js/database';

export class Order extends Model {
    static tableName = 'orders';

    static get relationMappings() {
        return {
            customer: { relation: Model.BelongsToOneRelation, modelClass: Customer, join: { from: 'orders.customer_id', to: 'customers.id' } },
            items: { relation: Model.HasManyRelation, modelClass: OrderItem, join: { from: 'orders.id', to: 'order_items.order_id' } },
        };
    }
}
```

The adapter then handles [relationship columns](/tables/columns/overview#displaying-data-from-relationships) and [relationship aggregates](/tables/columns/overview#counting-relationships) of tables, infolists and exports:

```ts
TextColumn.make('customer.name').sortable().searchable()

TextColumn.make('items_count').counts('items').sortable()
```

- The relationships of dot-notation columns are eager-loaded with each page (`withGraphFetched`), one query per relationship.
- Searching `customer.name` keeps the orders whose customer matches (a `whereExists` subquery); sorting by it orders by a correlated subquery of the customer's name, for relationships that hold a single record.
- `counts()`, `exists()`, `avg()`, `sum()`, `min()` and `max()` select a correlated subquery under the column's name (`items_count`), so the column can be sorted and summarized.

Relationship and column names come from your declarations, never from the browser, and must be plain identifiers; a dot-notation name whose first segment is not a relationship is a qualified column (`orders.number`) or a key of a JSON column.

## Saving data that does not fit in one row

When a form contains more than columns (repeated lines, categories, images), extend the adapter and dispatch the data:

```ts
import { ObjectionAdapter } from '@navette-js/database';

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
        if (!(await this.find(key))) return null; // the record must be in scope before any write
        await super.update(key, attributes);
        await this.syncCategories(key, categories);
        return this.find(key);
    }

    // The list comes from the browser: only attach categories that exist.
    private async syncCategories(key: string | number, categories: unknown) { /* ... */ }
}

export class ProductResource extends Resource {
    static adapter = new Products();
}
```

`update()`, `delete()`, `restore()` and `forceDelete()` of `ObjectionAdapter` act on a key. The pages always find the record through the adapter first, but when you call them yourself, or add writes in an override, check that the record is in scope with `find()` or `keysInScope()`, as above.

The demo application has complete examples: `Orders` (address and order lines), `Products` (categories and images), `CustomerAddresses` (polymorphic relationship).

## Writing your own adapter

To use a remote API or another ORM, implement the `DataAdapter` interface of `@navette-js/database`:

| Method | Role |
|---|---|
| `getKey(record)` | The key of a record, as a string. |
| `getLabel()` | The name of the records. |
| `paginate(query)` | A page of records for a `ListQuery`: search, column searches, sort, modifiers, trashed state, page. |
| `find(key)` | A record in scope, or `null`. |
| `create(data)`, `update(key, data)`, `delete(key)` | Writes. `update()` returns the record, or `null` if it is not in scope. |
| `listKeys(query)` | The keys of every record matching a query, for "select all". |
| `keysInScope(keys)` | Among keys sent by the browser, those in scope. |
| `deleteMany(keys)` | Bulk deletion; returns the number of deleted records. |
| `count()` | The number of records in scope. |
| `sum(query, columns)`, `aggregate(query, columns)` | Totals and statistics of the records matching a query. |
| `exists(column, value, exceptKey)` | Whether another record has this value, for the `unique()` rule. |
| `supportsSoftDeletes()`, `isTrashed(record)`, `restore(key)`, `forceDelete(key)` | Soft deletes. |
| `supportsRelationships()` | Optional. `true` when the adapter handles the relationships of a `ListQuery` (see below). |

Relationships are optional for a custom adapter. A `ListQuery` may carry:

- `with`: the relationship paths of dot-notation columns (`customer`, `customer.country`), to load with each record. An adapter may ignore it: a column named `customer.name` reads `record.customer.name`, so records that already contain nested objects display without anything else.
- dot-notation names (`customer.name`) in `searchColumns`, `columnSearches` and `sort`, to search or sort through the relationship.
- `aggregates`: the relationship aggregates of the columns (`{ relationship, function, column, alias, modify }`), whose values must be set on each record under `alias`. They are only sent to an adapter whose `supportsRelationships()` returns `true`: with any other adapter, a column that aggregates a relationship throws an error naming the column and the adapter.

The `modifiers` of a `ListQuery` are functions that receive the query builder of the adapter: they come from list tabs, from filters and from `modifyTableQuery()`. An adapter without a query builder must pass them an object that understands the calls they make, or the resource must avoid them.

To be used in a [multi-tenant panel](/panels/tenancy), an adapter must also implement `scopeToTenant(column, key)`, which receives the ownership column and a function that returns the key of the current tenant (or `null`): every read must filter on it, and every creation must set it.

## Using the data outside of resources

In an action, a widget or a custom page, use your models or Knex directly:

```ts
const open = await Task.query().where('is_done', 0).resultSize();
await knex('audit_log').insert({ user_id: user.id, action: 'export' });
```

Always with bound parameters (`where(column, value)`, `whereRaw('… like ?', [value])`), never by concatenating a received value into SQL. Such queries are not scoped by the adapter: filter them yourself.
