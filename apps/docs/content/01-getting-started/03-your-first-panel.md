---
title: Your first panel
---

## Introduction

In this guide, you build a small shop back office: a list of customers, a form to create and edit them, their orders, and a dashboard widget. It covers the building blocks you use in every Navette application: [resources](/resources/overview), [forms](/forms/overview), [tables](/tables/overview), [relation managers](/resources/managing-relationships) and [widgets](/widgets/overview).

Start from the `server.ts` file of the [installation guide](/getting-started/installation). The complete code of this guide is also in the Navette repository, in `apps/docs/examples/first-panel.ts`.

## Creating the tables and models

Navette reads and writes data through Knex and Objection.js. Add two tables after the `users` table, and one Objection model per table:

```ts
import { Model } from '@navette-js/database';

if (!(await knex.schema.hasTable('customers'))) {
    await knex.schema.createTable('customers', (table) => {
        table.increments('id');
        table.string('name').notNullable();
        table.string('email');
        table.string('country');
        table.timestamps();
    });
    await knex.schema.createTable('orders', (table) => {
        table.increments('id');
        table.integer('customer_id').notNullable();
        table.string('number').notNullable();
        table.string('status').notNullable().defaultTo('new');
        table.date('ordered_at');
        table.timestamps();
    });
}

class Customer extends Model {
    static tableName = 'customers';
    id!: number;
    name!: string;
    email!: string | null;
    country!: string | null;
}

class Order extends Model {
    static tableName = 'orders';
    id!: number;
    customer_id!: number;
    number!: string;
    status!: string;
    ordered_at!: string | null;
}
```

In a real application, you would create tables with [Knex migrations](https://knexjs.org/guide/migrations.html) instead of at startup.

## Creating a resource

A resource is the set of pages that manage one kind of record. By default, a resource has three pages: a **list** with a table, a **create** page and an **edit** page. Its navigation item is added to the sidebar automatically.

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { Resource } from '@navette-js/panels';

class CustomerResource extends Resource {
    static slug = 'customers';
    static modelLabel = 'customer';
    static navigationIcon = 'o-user-group';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(Customer);
}
```

- `slug` is the URL of the resource: its pages are `/customers`, `/customers/create` and `/customers/{id}/edit`.
- `modelLabel` names a record in headings and buttons ("New customer"). The plural, "customers", is derived from it.
- `navigationIcon` is a [Heroicon](/styling/icons): `o-` for outline icons, `s-` for solid, `m-` for mini.
- `recordTitleAttribute` is the column that names a record in breadcrumbs and page titles.
- `adapter` tells the resource where its records come from. `ObjectionAdapter` reads and writes an Objection model; you can also [write your own adapter](/tables/custom-data).

Register the resource on the panel:

```ts
const panel = Panel.make()
    // ...
    .resources([CustomerResource]);
```

Restart the server: a "Customers" item appears in the sidebar. The list is empty for now, because the resource has no columns yet.

## Adding a form

The `form()` method describes the fields of the create and edit pages. It receives a [schema](/schemas/overview) and returns it with its components:

```ts
import { Select, TextInput } from '@navette-js/forms';
import { Section, type Schema } from '@navette-js/schemas';

class CustomerResource extends Resource {
    // ...

    static form(schema: Schema): Schema {
        return schema.components([
            Section.make('Customer')
                .schema([
                    TextInput.make('name').required().maxLength(255),
                    TextInput.make('email').email().maxLength(255),
                    Select.make('country').options([['fr', 'France'], ['de', 'Germany'], ['us', 'United States']]),
                ])
                .columns(2)
                .columnSpanFull(),
        ]);
    }
}
```

```preview
// state: {"name": "Ada Lovelace", "email": "ada@example.com", "country": "fr"}
// viewport: 1100
Section.make('Customer')
    .schema([
        TextInput.make('name').required().maxLength(255),
        TextInput.make('email').email().maxLength(255),
        Select.make('country').options([['fr', 'France'], ['de', 'Germany'], ['us', 'United States']]),
    ])
    .columns(2)
    .columnSpanFull()
```

Each field is bound to the column of the same name. The rules — `required()`, `email()`, `maxLength()` — are checked on the server when the form is submitted, and the errors are shown under each field. The `Section` groups the fields in a card, on two columns.

Visit `/customers/create`, fill the form and save: Navette validates the data, creates the record, and opens its edit page.

## Adding a table

The `table()` method describes the list page. Each column displays one attribute of the record:

```ts
import { SelectFilter, TextColumn, type Table } from '@navette-js/tables';

class CustomerResource extends Resource {
    // ...

    static table(table: Table<Customer>): Table<Customer> {
        return table
            .columns([
                TextColumn.make<Customer>('name').searchable().sortable(),
                TextColumn.make<Customer>('email').searchable(),
                TextColumn.make<Customer>('country').badge(),
            ])
            .filters([
                SelectFilter.make('country').options([['fr', 'France'], ['de', 'Germany'], ['us', 'United States']]),
            ]);
    }
}
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com", "country": "fr"}, {"name": "Grace Hopper", "email": "grace@example.com", "country": "us"}, {"name": "Konrad Zuse", "email": "konrad@example.com", "country": "de"}]
new Table()
    .pluralModelLabel('customers')
    .columns([
        TextColumn.make('name').searchable().sortable(),
        TextColumn.make('email').searchable(),
        TextColumn.make('country').badge(),
    ])
```

- `searchable()` adds the column to the table's search field.
- `sortable()` lets the user sort by clicking the column header.
- `badge()` displays the value in a colored badge.
- `SelectFilter` adds a filter on the country to the filters dropdown.

Clicking a row opens the edit page. The table also gets pagination and bulk deletion by default.

## Managing related records

Customers have orders. A **relation manager** displays the related records as a table on the edit page of the owner, with its own create, edit and delete actions.

A relation manager needs an adapter limited to one owner. Extend `ObjectionAdapter` so that it only reads the orders of one customer, and assigns new orders to that customer:

```ts
class CustomerOrders extends ObjectionAdapter<Order> {
    customerId: number;

    constructor(customerId: string) {
        super(Order, { modify: (query) => { query.where('customer_id', Number(customerId)); } });
        this.customerId = Number(customerId);
    }

    create(data: Record<string, unknown>) {
        return super.create({ ...data, customer_id: this.customerId });
    }
}
```

<Aside variant="danger">
The `modify` function is what keeps one customer's orders separate from another's: the table, the edit modal and the bulk actions only ever see records that it returns. Always scope a relation manager's adapter to its owner.
</Aside>

Then define the relation manager, with its own form and table, and register it on the resource:

```ts
import { DatePicker } from '@navette-js/forms';
import { CreateAction, DeleteAction, EditAction, RelationManager } from '@navette-js/panels';

const STATUSES: [string, string][] = [['new', 'New'], ['processing', 'Processing'], ['shipped', 'Shipped']];

class OrdersRelationManager extends RelationManager {
    static relationship = 'orders';
    static modelLabel = 'order';
    static recordTitleAttribute = 'number';

    static adapterFor(customerKey: string) {
        return new CustomerOrders(customerKey);
    }

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('number').required().maxLength(32),
            Select.make('status').options(STATUSES).default('new').required(),
            DatePicker.make('ordered_at').label('Order date'),
        ]);
    }

    static table(table: Table): Table {
        return table
            .columns([
                TextColumn.make('number').searchable(),
                TextColumn.make('status').badge(),
                TextColumn.make('ordered_at').label('Order date').date().sortable(),
            ])
            .headerActions([CreateAction.make()])
            .recordActions([EditAction.make(), DeleteAction.make()]);
    }
}

class CustomerResource extends Resource {
    // ...
    static relations = [OrdersRelationManager];
}
```

Open a customer: under the form, an "Orders" table lists their orders. "New order" opens the relation manager's form in a modal, and saves the order for this customer.

## Adding a widget

Widgets display information on the dashboard. A stats overview widget shows a row of numbers:

```ts
import { Stat, StatsOverviewWidget } from '@navette-js/panels';

class CustomerStats extends StatsOverviewWidget {
    static pollingInterval = null;

    async getStats(): Promise<Stat[]> {
        return [
            Stat.make('Customers', await Customer.query().resultSize()),
            Stat.make('Open orders', await Order.query().whereNot('status', 'shipped').resultSize()).color('warning'),
        ];
    }
}
```

```preview
// viewport: 1100
[
    Stat.make('Customers', 3),
    Stat.make('Open orders', 1).color('warning'),
]
```

By default, stats are refreshed every 5 seconds; `pollingInterval = null` turns this off. Register the widget on the panel: the dashboard displays the panel's widgets.

```ts
const panel = Panel.make()
    // ...
    .pages([Dashboard])
    .resources([CustomerResource])
    .widgets([CustomerStats]);
```

Widgets are loaded after the page, so a slow query never delays the rest of the dashboard.

## Customizing the panel

A few options change the look of the whole panel:

```ts
import { Color } from '@navette-js/support';

const panel = Panel.make()
    .id('admin')
    .key(key)
    .brandName('My shop')
    .setColors({ primary: Color.Indigo })
    // ...
```

`brandName()` replaces "Navette" in the sidebar and the page titles, and `setColors()` changes the primary color of buttons, links and active items. See [colors](/styling/colors) and [panel configuration](/panels/configuration) for everything else.

## Next steps

- Add a read-only [View page](/resources/viewing-records) to the resource.
- Protect the resource with [authorization](/resources/authorization).
- Add [actions](/actions/overview) to the table rows, and [notifications](/notifications/overview) when they succeed.
- Let users [register and manage their profile](/panels/users), or split your data by team with [multi-tenancy](/panels/tenancy).
