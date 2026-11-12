// Final code of the "Your first panel" tutorial (content/01-getting-started/03-your-first-panel.md).
// Run: ADMIN_PASSWORD=change-me node apps/docs/examples/first-panel.ts   then open http://127.0.0.1:3000/login
import express from 'express';
import { Model, ObjectionAdapter, sqlite } from '@navette-js/database';
import { DatePicker, Select, TextInput } from '@navette-js/forms';
import { CreateAction, Dashboard, DeleteAction, EditAction, knexAuthProvider, Panel, panelRouter, RelationManager, Resource, Stat, StatsOverviewWidget } from '@navette-js/panels';
import { Section, type Schema } from '@navette-js/schemas';
import { Color } from '@navette-js/support';
import { SelectFilter, TextColumn, type Table } from '@navette-js/tables';
import { WireRuntime } from '@navette-js/wire';

// ------------------------------------------------------------------ database
const knex = sqlite(process.env.DATABASE_FILE ?? 'database.sqlite');

if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
        table.increments('id');
        table.string('name');
        table.string('email').unique();
        table.string('password');
        table.timestamp('email_verified_at').nullable();
        table.timestamps();
    });
}
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
    declare id: number;
    declare name: string;
    declare email: string | null;
    declare country: string | null;
}

class Order extends Model {
    static tableName = 'orders';
    declare id: number;
    declare customer_id: number;
    declare number: string;
    declare status: string;
    declare ordered_at: string | null;
}

// ------------------------------------------------------------------ resource
const STATUSES: [string, string][] = [['new', 'New'], ['processing', 'Processing'], ['shipped', 'Shipped']];

/** The orders of one customer: reads are limited to that customer, and new orders belong to them. */
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
    static slug = 'customers';
    static modelLabel = 'customer';
    static navigationIcon = 'o-user-group';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(Customer);
    static relations = [OrdersRelationManager];

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

// ------------------------------------------------------------------ widget
class CustomerStats extends StatsOverviewWidget {
    static pollingInterval = null;

    async getStats(): Promise<Stat[]> {
        return [
            Stat.make('Customers', await Customer.query().resultSize()),
            Stat.make('Open orders', await Order.query().whereNot('status', 'shipped').resultSize()).color('warning'),
        ];
    }
}

// ------------------------------------------------------------------ panel
const key = process.env.APP_KEY ?? 'change-this-development-key';
const users = knexAuthProvider((table) => knex(table));

// Create the first account on the first run.
if (!(await users.findByEmail!('admin@example.com'))) {
    await users.create!({ name: 'Admin', email: 'admin@example.com', password: process.env.ADMIN_PASSWORD ?? 'change-me' });
}

const panel = Panel.make()
    .id('admin')
    .key(key)
    .brandName('My shop')
    .setColors({ primary: Color.Indigo })
    .login()
    .pages([Dashboard])
    .resources([CustomerResource])
    .widgets([CustomerStats])
    .auth(users);

const app = express();
app.use(panelRouter(panel, new WireRuntime({ key })));
const port = Number(process.env.PORT ?? 3000);
app.listen(port, '127.0.0.1', () => console.log(`My shop: http://127.0.0.1:${port}/login`));
