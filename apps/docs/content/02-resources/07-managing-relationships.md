---
title: Managing relationships
---

## Introduction

A record often has related records: the comments of a post, the addresses of a customer, the payments of an order. Navette has no ORM relationships to read: you describe each relationship with a [data adapter](/advanced/data-adapters) limited to the records of one owner, and Navette builds the interface around it.

## Choosing the right tool for the job

There are several ways to manage related records:

| Tool | When to use it |
|---|---|
| Relation manager | An interactive table of related records, under the edit (or View) form of the owner, in a tab. Create, edit, delete, attach and detach in modals. |
| Relation page | The same table on its own page, reached from the [sub-navigation](/resources/overview#resource-sub-navigation) of the record. |
| `Select` or `CheckboxList` field | Choosing existing records from the owner's form, for example the categories of a product. The [adapter](/advanced/data-adapters#saving-data-that-does-not-fit-in-one-row) saves the choice. |
| `Repeater` field | Editing a few related rows inside the owner's form, saved together with it, such as the lines of an order. |

This page covers relation managers and relation pages.

## Creating a relation manager

A relation manager is a class that extends `RelationManager`. It declares the name of the relationship, the labels of its records, the adapter that reads them, and its form and table:

```ts
import { ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { TextInput, Textarea } from '@navette-js/forms';
import { CreateAction, DeleteAction, DeleteBulkAction, EditAction, RelationManager } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

export class CommentsRelationManager extends RelationManager {
    static relationship = 'comments';
    static modelLabel = 'comment';
    static recordTitleAttribute = 'title';

    static adapterFor(ownerKey: string): DataAdapter {
        return new ObjectionAdapter(Comment, {
            modify: (query) => { query.where('comments.task_id', ownerKey); },
        });
    }

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('title').required(),
            Textarea.make('content'),
        ]);
    }

    static table(table: Table): Table {
        return table
            .columns([
                TextColumn.make('title'),
                TextColumn.make('created_at').date(),
            ])
            .headerActions([CreateAction.make()])
            .recordActions([EditAction.make(), DeleteAction.make()])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}
```

Register it in the `relations` array of the resource:

```ts
export class TaskResource extends Resource {
    static relations = [CommentsRelationManager];
}
```

The relation managers of a resource are displayed under the form of the edit page, and under the infolist of the [View page](/resources/viewing-records), one tab per manager. Only the manager of the active tab is loaded, after the page is displayed.

`adapterFor()` is the most important part. It receives the key of the owner record and returns an adapter that only sees the related records. Everything the manager does goes through it: a key sent by the browser that does not belong to the owner is not found, cannot be edited and cannot be deleted. The owner key itself is set by the page and locked: the browser cannot change it.

### Read-only mode

A relation manager without actions is read-only. As the list page offers `DeleteBulkAction` when no bulk action is declared, remove it explicitly:

```ts
static table(table: Table): Table {
    return table
        .columns([/* ... */])
        .groupedBulkActions([]);
}
```

## Listing related records

The table of a relation manager is a normal [table](/tables/overview): search, sort, filters and pagination all go through the adapter returned by `adapterFor()`. To display a column of another table, add it to the query with a subquery:

```ts
static adapterFor(ownerKey: string): DataAdapter {
    return new ObjectionAdapter(Payment, {
        modify: (query) => {
            const knex = Payment.knex();
            query
                .select('payments.*', knex('orders').select('orders.number').whereRaw('orders.id = payments.order_id').as('order_number'))
                .whereIn('payments.order_id', knex('orders').select('id').where({ customer_id: ownerKey }));
        },
    });
}
```

A click on a row opens the `edit` row action when the table has one.

## Creating related records

`CreateAction.make()`, in the header actions of the table, opens the form of the manager in a modal and calls `create()` on the manager's adapter. That adapter must attach the new record to its owner.

**Never trust a foreign key sent by the form.** Set it in the adapter, from the owner key, and remove it from the data of an update:

```ts
import { ObjectionAdapter } from '@navette-js/database';

class PostComments extends ObjectionAdapter<Comment> {
    private post: number;

    constructor(post: string) {
        super(Comment, { modify: (query) => { query.where('comments.post_id', Number(post)); } });
        this.post = Number(post);
    }

    create(data: Record<string, unknown>) {
        return super.create({ ...data, post_id: this.post });
    }

    update(key: string | number, data: Record<string, unknown>) {
        const { post_id, ...columns } = data;
        return super.update(key, columns);
    }
}

export class CommentsRelationManager extends RelationManager {
    static adapterFor(ownerKey: string) { return new PostComments(ownerKey); }
}
```

## Editing related records

`EditAction.make()`, in the row actions, opens the form of the manager filled with the record, and calls `update()` on the adapter. The record is read through the manager's adapter first, so only a related record can be edited.

## Attaching and detaching records

For a many-to-many relationship, a record can be attached to the owner, or detached from it without being deleted. Define four static methods on the manager, then add `AttachAction`, `DetachAction` and `DetachBulkAction` to the table:

```ts
import { AttachAction, CreateAction, DeleteAction, DetachAction, DetachBulkAction, EditAction, RelationManager } from '@navette-js/panels';

export class ProductCategoriesRelationManager extends RelationManager {
    static relationship = 'categories';
    static modelLabel = 'category';

    static adapterFor(ownerKey: string) {
        return new ObjectionAdapter(Category, {
            modify: (query) => { query.whereIn('categories.id', attachedTo(ownerKey)); },
        });
    }

    // Records that can be attached, matching the search: [key, label] pairs.
    static async searchAttachable(ownerKey: string, search: string): Promise<[string, string][]> {
        const rows = await Category.query()
            .whereNotIn('id', attachedTo(ownerKey))
            .whereRaw('lower(name) like ?', [`%${search.toLowerCase()}%`])
            .limit(50);

        return rows.map((row) => [String(row.id), row.name]);
    }

    // Label of an attachable record, or null if it cannot be attached.
    static async attachableLabel(ownerKey: string, recordKey: string): Promise<string | null> {
        return (await Category.query().whereNotIn('id', attachedTo(ownerKey)).findById(recordKey))?.name ?? null;
    }

    static async attach(ownerKey: string, recordKey: string): Promise<void> {
        if (!(await this.attachableLabel(ownerKey, recordKey))) return;
        await Category.knex()('category_product').insert({ product_id: ownerKey, category_id: recordKey });
    }

    static async detach(ownerKey: string, recordKeys: string[]): Promise<void> {
        await Category.knex()('category_product').where({ product_id: ownerKey }).whereIn('category_id', recordKeys).delete();
    }

    static table(table: Table): Table {
        return table
            .columns([TextColumn.make('name')])
            .headerActions([AttachAction.make(), CreateAction.make()])
            .recordActions([EditAction.make(), DetachAction.make(), DeleteAction.make()])
            .groupedBulkActions([DetachBulkAction.make()]);
    }
}

const attachedTo = (ownerKey: string) => Category.knex()('category_product').select('category_id').where({ product_id: ownerKey });
```

The attach modal contains a searchable select. Its options come from `searchAttachable()`, and the chosen key is checked again with `attachableLabel()` before `attach()` is called: a key sent by the browser that is not attachable is rejected by validation. `DetachBulkAction` only receives keys that belong to the owner, since the selection is reduced to the records of the manager's adapter.

### Scoping the options to attach

`searchAttachable()` decides which records may be attached: filter them as you need, and keep `attachableLabel()` consistent with it, since it is the server-side check.

<Aside variant="warning">
`AttachAction`, `DetachAction` and `DetachBulkAction` do not consult the policy of the manager. Add `authorize()` to them when not every user may attach or detach.
</Aside>

## Associating and dissociating records

For a one-to-many relationship, an existing record can be associated with the owner (its foreign key is set), or dissociated from it (the foreign key is cleared) without being deleted. Define four static methods on the manager, then add `AssociateAction`, `DissociateAction` and `DissociateBulkAction` to the table:

```ts
import { AssociateAction, DissociateAction, DissociateBulkAction, RelationManager } from '@navette-js/panels';

export class TeamMembersRelationManager extends RelationManager {
    static relationship = 'members';
    static modelLabel = 'member';

    static adapterFor(ownerKey: string) {
        return new ObjectionAdapter(User, { modify: (query) => { query.where('users.team_id', ownerKey); } });
    }

    // Records without a team, matching the search: [key, label] pairs.
    static async searchAssociable(ownerKey: string, search: string): Promise<[string, string][]> {
        const rows = await User.query().whereNull('team_id').whereRaw('lower(name) like ?', [`%${search.toLowerCase()}%`]).limit(50);

        return rows.map((row) => [String(row.id), row.name]);
    }

    // Label of an associable record, or null if it cannot be associated.
    static async associableLabel(ownerKey: string, recordKey: string): Promise<string | null> {
        return (await User.query().whereNull('team_id').findById(recordKey))?.name ?? null;
    }

    static async associate(ownerKey: string, recordKey: string): Promise<void> {
        if (!(await this.associableLabel(ownerKey, recordKey))) return;
        await User.query().findById(recordKey).patch({ team_id: Number(ownerKey) });
    }

    static async dissociate(ownerKey: string, recordKeys: string[]): Promise<void> {
        await User.query().where('team_id', ownerKey).whereIn('id', recordKeys).patch({ team_id: null });
    }

    static table(table: Table): Table {
        return table
            .columns([TextColumn.make('name')])
            .headerActions([AssociateAction.make()])
            .recordActions([DissociateAction.make()])
            .groupedBulkActions([DissociateBulkAction.make()]);
    }
}
```

As with attaching, the chosen key is checked again with `associableLabel()` before `associate()` is called, and `DissociateBulkAction` only receives keys of the manager's records. These actions do not consult the policy of the manager: add `authorize()` to them when not every user may use them.

## Deleting related records

`DeleteAction` and `DeleteBulkAction` call `delete()` and `deleteMany()` on the manager's adapter. When deleting must also remove a pivot row, override those methods in the adapter, after checking that the record is in scope:

```ts
class CustomerAddresses extends ObjectionAdapter<Address> {
    async delete(key: string | number): Promise<boolean> {
        if (!(await this.find(key))) return false;
        await Address.knex()('addressables').where({ address_id: key }).delete();

        return super.delete(key);
    }
}
```

## Accessing the relationship's owner record

The key of the owner record is passed to `adapterFor()`. Inside the manager, it is `this.ownerRecord`; in the closures of the form, the table and the actions, read it from the component:

```ts
static form(schema: Schema): Schema {
    const owner = String((schema.livewire as any).ownerRecord);

    return schema.components([
        Select.make('order_id')
            .required()
            .getSearchResultsUsing(async (search) => searchOrdersOf(owner, search))
            .getOptionLabelUsing(async (value) => orderLabelOf(owner, value)),
    ]);
}
```

## Sharing a resource's form and table with a relation manager

The form and table of a manager are static methods: a manager may reuse those of a resource:

```ts
export class ProductsRelationManager extends RelationManager {
    static relationship = 'products';

    static form(schema: Schema): Schema { return ProductResource.form(schema); }
    static table(table: Table): Table { return ProductResource.table(table); }
}
```

A manager can also be reused by inheritance, for example to change only the owner type of a polymorphic relationship.

## Customizing the relation manager title

The title of the tab and the heading of the table are generated from `relationship`: `leaveRequests` becomes "Leave requests". To set it yourself, use `title`:

```ts
static title = 'Customer payments';
```

## Customizing the relation manager record title

`recordTitleAttribute` names the column used in the headings of the edit, delete and detach modals:

```ts
static recordTitleAttribute = 'full_address';
```

## Authorizing relation managers

A relation manager has its own `policy`, with the same abilities as a [resource policy](/resources/authorization): `create` for `CreateAction`, `update` for `EditAction`, `delete` for `DeleteAction`, `deleteAny` for `DeleteBulkAction`.

```ts
static policy: Policy = {
    create: (user) => user.role !== 'reader',
    update: (user) => user.role !== 'reader',
    delete: (user) => user.role === 'admin',
    deleteAny: (user) => user.role === 'admin',
};
```

<Aside variant="danger">
Do not deny `viewAny` in the policy of a relation manager to hide it: the manager is loaded with the page, and the whole edit page then answers 403. Conditionally showing relation managers is not available yet; deny the actions instead, or restrict the manager's adapter.
</Aside>

## Relation pages

A relation page displays the related records of one record on a page of their own, under `/<slug>/{record}/<name>`, instead of a tab under the form. Extend `ManageRelatedRecords`, which takes the same static members as a relation manager plus `infolist()`, and declare it in `relatedPages`:

```ts
import { CreateAction, DeleteAction, EditAction, ManageRelatedRecords, ViewAction } from '@navette-js/panels';

export class ManagePostComments extends ManageRelatedRecords {
    static relationship = 'comments';
    static modelLabel = 'comment';
    static recordTitleAttribute = 'title';
    static navigationIcon = 'o-chat-bubble-left-ellipsis';

    static adapterFor(ownerKey: string) { return new PostComments(ownerKey); }

    static form(schema: Schema): Schema { /* ... */ }
    static infolist(schema: Schema): Schema { /* ... */ }

    static table(table: Table): Table {
        return table
            .columns([/* ... */])
            .headerActions([CreateAction.make()])
            .recordActions([ViewAction.make(), EditAction.make(), DeleteAction.make()]);
    }
}

export class PostResource extends Resource {
    static relatedPages = { comments: ManagePostComments };
}
```

The page title is "Manage {record title} Comments", and its breadcrumbs lead back to the list and to the record. `ViewAction` opens the infolist in a modal. `PostResource.getUrl('comments', post.id)` generates its URL.

On every request, the owner record is read again with the adapter of the resource, and the user must have the `view` ability on it; otherwise the page answers 404 or 403.

### Adding relation pages to resource sub-navigation

List the page in `recordSubNavigation` to show it next to the View and Edit pages of the record. Its item uses `navigationLabel` (or the title) and `navigationIcon`:

```ts
static recordSubNavigation = ['view', 'edit', 'comments'];
```

<Aside variant="warning">
Pivot attributes, grouping relation managers, combining them with the form in tabs, and tab badges are not available yet.
</Aside>
