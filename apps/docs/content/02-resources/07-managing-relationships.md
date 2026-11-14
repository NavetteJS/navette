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
| [Nested resource](/resources/nesting) | Related records created and edited on full pages under their owner (`/projects/12/tasks/48/edit`), listed by a relation manager or a relation page. |
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

On a [view page](/resources/viewing-records), relation managers are read-only: the actions that change the relationship (create, edit, delete, attach, detach, associate, dissociate, restore, force-delete, reorder) are hidden, and refused if they are called anyway. To keep them on the view pages of a panel:

```ts
panel.readOnlyRelationManagersOnResourceViewPagesByDefault(false)
```

A manager may decide for itself by overriding `isReadOnly()`. `getPageClass()` returns the class of the record page that shows it:

```ts
export class CommentsRelationManager extends RelationManager {
    isReadOnly(): boolean {
        return false;
    }
}
```

A manager without actions is read-only everywhere. As the list page offers `DeleteBulkAction` when no bulk action is declared, remove it explicitly:

```ts
static table(table: Table): Table {
    return table
        .columns([/* ... */])
        .groupedBulkActions([]);
}
```

### Hiding a field, column or filter in the relation manager

When a manager reuses the form or table of a resource, `hiddenOn()` and `visibleOn()` accept the class of a relation manager, besides an operation name. The owner's column is useless in the manager of its own records:

```ts
static table(table: Table): Table {
    return table.columns([
        TextColumn.make('title'),
        TextColumn.make('project.name').hiddenOn(TasksRelationManager),
    ]);
}
```

It works for form fields, table columns and filters, and also with a page class (`hiddenOn(EditProject)`).

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

### Saving pivot attributes

A pivot table can hold values of its own, such as the role of a member in a team. Return their fields from `pivotForm()`: they are added to the attach modal, after the record select, and to the edit form of each row. Their values reach `attach()` as its third argument, and `updatePivot()` when a row is edited; the other fields of the edit form are still saved on the related record. Select the pivot columns in the manager's query, so that the table can display them and the edit form can read them:

```ts
import { TextInput } from '@navette-js/forms';
import { AttachAction, DetachAction, EditAction, RelationManager } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

export class MembersRelationManager extends RelationManager {
    static relationship = 'members';
    static modelLabel = 'member';

    static adapterFor(ownerKey: string) {
        return new ObjectionAdapter(User, {
            modify: (query) => {
                query.select('users.*', 'team_user.role')
                    .join('team_user', 'team_user.user_id', 'users.id')
                    .where('team_user.team_id', ownerKey);
            },
        });
    }

    static pivotForm(schema: Schema) {
        return [TextInput.make('role').required().maxLength(50)];
    }

    static async attach(ownerKey: string, recordKey: string, pivot: Record<string, unknown> = {}): Promise<void> {
        if (!(await this.attachableLabel(ownerKey, recordKey))) return;
        await User.knex()('team_user').insert({ team_id: ownerKey, user_id: recordKey, role: pivot.role });
    }

    static async updatePivot(ownerKey: string, recordKey: string, pivot: Record<string, unknown>): Promise<void> {
        await User.knex()('team_user').where({ team_id: ownerKey, user_id: recordKey }).update({ role: pivot.role });
    }

    static table(table: Table): Table {
        return table
            .columns([TextColumn.make('name'), TextColumn.make('role')])
            .headerActions([AttachAction.make()])
            .recordActions([EditAction.make(), DetachAction.make()]);
    }

    // searchAttachable(), attachableLabel() and detach(), as above.
}
```

Only the fields declared in `pivotForm()` reach `attach()` and `updatePivot()`, after validation: a value the browser adds for another column is dropped. `updatePivot()` receives the owner key and the row key, so update the pivot row of this owner only, as above.

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
Do not deny `viewAny` in the policy of a relation manager to hide it: the manager is loaded with the page, and the whole edit page then answers 403. Hide a manager with [`canViewForRecord()`](#showing-a-relation-manager-conditionally) instead, deny the actions, or restrict the manager's adapter.
</Aside>

## Showing a relation manager conditionally

`canViewForRecord()` decides whether a manager is shown for a record, on a given page:

```ts
import { RelationManager, ViewRecord, type Page } from '@navette-js/panels';

export class InvoicesRelationManager extends RelationManager {
    static canViewForRecord(ownerRecord: Customer, pageClass: typeof Page): boolean {
        return ownerRecord.is_business && !(pageClass.prototype instanceof ViewRecord);
    }
}
```

## Passing properties to a relation manager

`make()` registers a manager with properties of its own, assigned to its public properties of the same name. The same manager can then appear twice with different settings. List these properties in `static locked`, so that the browser cannot change them:

```ts
export class CommentsRelationManager extends RelationManager {
    static relationship = 'comments';
    static locked = ['status'];
    status = 'approved';

    getTable(): Table {
        return super.getTable().modifyQueryUsing((query) => query.where('status', this.status));
    }
}

export class PostResource extends Resource {
    static relations = {
        approved: CommentsRelationManager.make({ status: 'approved' }),
        pending: CommentsRelationManager.make({ status: 'pending' }),
    };
}
```

`static getDefaultProperties()` returns properties given to every instance of the manager.

## Loading relation managers

A relation manager is loaded by the browser once its tab is displayed, after the page. Set `isLazyLoaded` to `false` to render it with the page instead:

```ts
export class TasksRelationManager extends RelationManager {
    static isLazyLoaded = false;
}
```

## Opening an action of a relation manager from a link

A page opens one of its actions from its URL (`?action=create`, or `?tableAction=edit&tableActionRecord=12` for a row action). A relation manager has no identifier in these links by default. Return a stable one from `getDefaultActionUrlIdentifier()`, and add `actionComponent=<identifier>` to the link:

```ts
export class CommentsRelationManager extends RelationManager {
    getDefaultActionUrlIdentifier(): string | null {
        return 'comments';
    }
}

// /admin/posts/1/edit?relation=comments&actionComponent=comments&tableAction=view&tableActionRecord=12
```

## Customizing the relation manager tabs

### Adding an icon and a badge

Each manager is a tab of the record page, with its title. Give it an icon, and a badge (a count of related records…) with its color:

```ts
export class TasksRelationManager extends RelationManager {
    static icon = 'm-clipboard-document-check';
    static badgeColor = 'warning';

    static async getBadge(ownerRecord: Project): Promise<number> {
        return knex('tasks').where('project_id', ownerRecord.id).whereNot('status', 'done').count({ n: '*' }).first().then((row) => Number(row?.n ?? 0));
    }
}
```

A fixed badge can be set with `static badge = 'New'`.

A badge that is expensive to compute can be loaded after the page is displayed, and given a tooltip:

```ts
export class TasksRelationManager extends RelationManager {
    static isBadgeLazyLoaded = true;
    static badgeTooltip = 'Open tasks';
}
```

Override `static shouldLazyLoadBadge(ownerRecord, pageClass)` to decide per record or per page.

### Grouping relation managers

`RelationGroup` shows several managers under one tab, one below the other:

```ts
import { RelationGroup, Resource } from '@navette-js/panels';

export class CustomerResource extends Resource {
    static relations = [
        RelationGroup.make('Contact', [PhonesRelationManager, EmailsRelationManager]).icon('m-user').badge(() => countContacts()),
        OrdersRelationManager,
    ];
}
```

The group's badge may be lazy loaded too, with `lazyLoadedBadge()`, and `badgeTooltip()` sets its tooltip. `tab()` builds the whole tab from the owner record:

```ts
RelationGroup.make('Contact', [PhonesRelationManager, EmailsRelationManager])
    .tab((customer) => Tab.make(`Contact of ${customer.name}`).icon('m-user'))
```

A manager may build its own tab the same way, with `static getTabComponent(ownerRecord, pageClass)`.

### Combining the managers with the form in tabs

To show the form as the first tab, next to the managers, return `true` from `hasCombinedRelationManagerTabsWithContent()` on the edit page (or the view page, for its infolist). The tab is named "Edit" ("View"); change its label and icon:

```ts
import { EditRecord } from '@navette-js/panels';

export class EditProject extends EditRecord {
    hasCombinedRelationManagerTabsWithContent(): boolean { return true; }
    getContentTabLabel(): string { return 'Project'; }
    getContentTabIcon(): string | null { return 'm-pencil-square'; }
}
```

#### Placing the content tab after the managers

The content tab comes first. `getContentTabPosition()` moves it after the managers:

```ts
import { ContentTabPosition, EditRecord } from '@navette-js/panels';

export class EditProject extends EditRecord {
    hasCombinedRelationManagerTabsWithContent(): boolean { return true; }
    getContentTabPosition(): ContentTabPosition | null { return ContentTabPosition.After; }
}
```

#### Adding your own tabs

`getTabComponents()` returns the tabs by key: the content tab under `''` (built by `getContentTabComponent()`), and the managers under their keys. Override it to reorder them or add tabs of your own. `getRelationManagerTabComponents(except)` returns the managers' tabs without some keys, and `getRelationManagerTabComponent(key)` the tab of one entry:

```ts
import { Tab, Text } from '@navette-js/schemas';

export class EditProject extends EditRecord {
    hasCombinedRelationManagerTabsWithContent(): boolean { return true; }

    getTabComponents(): Record<string, Tab> {
        return {
            tasks: this.getRelationManagerTabComponent('tasks')!,
            '': this.getContentTabComponent(),
            help: Tab.make('Help').schema([Text.make('Tasks are listed first.')]),
            ...this.getRelationManagerTabComponents(['tasks']),
        };
    }
}
```

The keys of the entries are those of `relations` when it is an object, and `'0'`, `'1'`… when it is a list.

### Keeping the active tab in the URL

The key of the active tab is kept in the query string (`?relation=tasks`), so that a reload or a shared link opens the same tab. Name the entries with an object to get readable keys, change the query string key, or set it to `null` to keep the tab out of the URL. With `relationManagerQueryStringHistory`, each tab change adds a browser history entry:

```ts
export class ProjectResource extends Resource {
    static relations = { tasks: TasksRelationManager, members: MembersRelationManager };
}

export class EditProject extends EditRecord {
    static relationManagerQueryStringKey: string | null = 'tab';
    static relationManagerQueryStringHistory = true;
}
```

### Choosing the managers of a page

By default, the edit and view pages show the resource's `relations`. A page can show its own list with `static relationManagers`:

```ts
export class ViewProject extends ViewRecord {
    static relationManagers = [TasksRelationManager];
}
```

To decide in code, override `getRelationManagers()` on the page. It returns the same entries as `relations`:

```ts
import { EditRecord, type RelationManagerEntries } from '@navette-js/panels';

export class EditProject extends EditRecord {
    getRelationManagers(): RelationManagerEntries {
        const project = this.getRecord() as Project;
        return project.archived ? [TasksRelationManager] : super.getRelationManagers();
    }
}
```

A manager can also hide itself for some records or pages with [`canViewForRecord()`](#showing-a-relation-manager-conditionally).

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

