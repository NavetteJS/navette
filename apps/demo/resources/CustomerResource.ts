// Shop customers: list, form, addresses and payments.
import { Model, ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { Action } from '@navette-js/actions';
import { DatePicker, RichEditor, Select, TextInput, ToggleButtons } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import { AttachAction, CreateAction, DeleteAction, DeleteBulkAction, DetachAction, DetachBulkAction, EditAction, ForceDeleteAction, Notification, RelationManager, Resource, RestoreAction } from '@navette-js/panels';
import { diffForHumans } from '@navette-js/support/i18n';
import { Section, type Schema } from '@navette-js/schemas';
import { ColumnGroup, TextColumn, TrashedFilter, type Table } from '@navette-js/tables';

export class Customer extends Model {
    static tableName = 'customers';
    id!: number;
    name!: string;
    email!: string;
    phone!: string | null;
    birthday!: string | null;
    deleted_at!: string | null;
    created_at!: string;
    updated_at!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    /** A date without a time is stored at midnight. */
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.birthday === 'string' && out.birthday.length === 10) out.birthday += ' 00:00:00';
        return out;
    }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
/** Country of the customer's first address (polymorphic `addressables` relation). */
async function firstCountry(record: Customer): Promise<string | null> {
    const row = await Customer.knex()('addresses')
        .join('addressables', 'addressables.address_id', 'addresses.id')
        .where({ 'addressables.addressable_type': 'App\\Models\\Shop\\Customer', 'addressables.addressable_id': record.id })
        .orderBy('addresses.id')
        .first('addresses.country');
    return row?.country ? (regionNames.of(String(row.country).toUpperCase()) ?? null) : null;
}

class Address extends Model {
    static tableName = 'addresses';
    id!: number;
    country!: string | null;
    street!: string | null;
    city!: string | null;
    state!: string | null;
    zip!: string | null;
    created_at!: string;
    updated_at!: string;
    /** Computed by the database (`street, zip city`): read-only. */
    full_address!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
}
const CUSTOMER_TYPE = 'App\\Models\\Shop\\Customer';
/** Country codes, in declaration order. */
const COUNTRIES: [string, string][] = [['us', 'United States'], ['gb', 'United Kingdom'], ['de', 'Germany'], ['fr', 'France'], ['ca', 'Canada'], ['au', 'Australia'], ['nl', 'Netherlands'], ['br', 'Brazil'], ['jp', 'Japan'], ['in', 'India']];
const attachedTo = (ownerKey: string, ownerType: string = CUSTOMER_TYPE) => Address.knex()('addressables').select('address_id').where({ addressable_type: ownerType, addressable_id: ownerKey });
/** Customer addresses (polymorphic `addressables` relation): creating attaches, deleting also detaches. */
class CustomerAddresses extends ObjectionAdapter<Address> {
    private owner: string;
    private ownerType: string;
    constructor(owner: string, ownerType: string = CUSTOMER_TYPE) { super(Address, { modify: (query) => { query.whereIn('addresses.id', attachedTo(owner, ownerType)); } }); this.owner = owner; this.ownerType = ownerType; }
    async create(data: Record<string, unknown>): Promise<Address> {
        const address = await super.create(data);
        await Address.knex()('addressables').insert({ address_id: address.id, addressable_type: this.ownerType, addressable_id: this.owner });
        return address;
    }
    async delete(key: string | number): Promise<boolean> {
        if (!(await this.find(key))) return false;
        await Address.knex()('addressables').where({ address_id: key }).delete();
        return super.delete(key);
    }
    async deleteMany(keys: (string | number)[]): Promise<number> {
        const scoped = await this.keysInScope(keys);
        if (!scoped.length) return 0;
        await Address.knex()('addressables').whereIn('address_id', scoped).delete();
        return Address.query().delete().whereIn('id', scoped);
    }
}
class Payment extends Model {
    static tableName = 'payments';
    id!: number;
    order_id!: number;
    reference!: string;
    provider!: string;
    method!: string;
    amount!: number;
    currency!: string;
    created_at!: string;
    updated_at!: string;
    order_number?: string;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
}
/** Currency codes and payment methods, in declaration order. */
const CURRENCIES: [string, string][] = [['usd', 'US Dollar'], ['eur', 'Euro'], ['gbp', 'British Pound'], ['cad', 'Canadian Dollar'], ['aud', 'Australian Dollar'], ['jpy', 'Japanese Yen'], ['brl', 'Brazilian Real'], ['inr', 'Indian Rupee']];
const PAYMENT_METHODS: [string, string][] = [['credit_card', 'Credit Card'], ['bank_transfer', 'Bank Transfer'], ['paypal', 'PayPal'], ['apple_pay', 'Apple Pay'], ['google_pay', 'Google Pay']];
const ordersOf = (ownerKey: string) => Payment.knex()('orders').where({ customer_id: ownerKey }).whereNull('deleted_at');
const headline = (text: string) => text.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export class AddressesRelationManager extends RelationManager {
    static relationship = 'addresses';
    static modelLabel = 'address';
    static recordTitleAttribute = 'full_address';
    // Polymorphic `addressables` relation: the addresses attached to this customer.
    /** Owner type in the polymorphic relation (customer by default; a subclass can target another model). */
    static ownerType = CUSTOMER_TYPE;
    static adapterFor(ownerKey: string): DataAdapter { return new CustomerAddresses(ownerKey, this.ownerType); }
    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('street'), TextInput.make('zip'), TextInput.make('city'), TextInput.make('state'),
            Select.make('country').options(COUNTRIES).searchable(),
        ]);
    }
    // --- attach: only addresses not yet attached to this customer are offered
    private static attachable(ownerKey: string) { return Address.query().whereNotIn('addresses.id', attachedTo(ownerKey, this.ownerType)); }
    static async searchAttachable(ownerKey: string, search: string): Promise<[string, string][]> {
        const query = this.attachable(ownerKey).orderBy('street').limit(50);
        for (const word of search.toLowerCase().split(/\s+/).filter(Boolean)) query.where((q) => { for (const column of ['street', 'zip', 'city']) q.orWhereRaw('lower(??) like ?', [column, `%${word.replace(/[%_]/g, '')}%`]); });
        return (await query).map((a): [string, string] => [String(a.id), a.full_address]);
    }
    static async attachableLabel(ownerKey: string, recordKey: string): Promise<string | null> {
        return (await this.attachable(ownerKey).findById(recordKey))?.full_address ?? null;
    }
    static async attach(ownerKey: string, recordKey: string): Promise<void> {
        if (!(await this.attachable(ownerKey).findById(recordKey))) return;
        await Address.knex()('addressables').insert({ address_id: recordKey, addressable_type: this.ownerType, addressable_id: ownerKey });
    }
    static async detach(ownerKey: string, recordKeys: string[]): Promise<void> {
        if (recordKeys.length) await Address.knex()('addressables').where({ addressable_type: this.ownerType, addressable_id: ownerKey }).whereIn('address_id', recordKeys).delete();
    }
    static table(table: Table<Address>): Table<Address> {
        return table
            .columns([
                TextColumn.make<Address>('street').weight('medium'),
                TextColumn.make<Address>('zip'),
                TextColumn.make<Address>('city'),
                TextColumn.make<Address>('country').getStateUsing(({ record }) => (record.country ? (regionNames.of(record.country.toUpperCase()) ?? record.country) : null)),
            ])
            .defaultSort('city')
            .stackedOnMobile()
            .headerActions([AttachAction.make(), CreateAction.make()])
            .recordActions([EditAction.make(), DetachAction.make(), DeleteAction.make()])
            .groupedBulkActions([DetachBulkAction.make(), DeleteBulkAction.make()]);
    }
}

export class PaymentsRelationManager extends RelationManager {
    static relationship = 'payments';
    static modelLabel = 'payment';
    static recordTitleAttribute = 'reference';
    // Has-many-through: the payments of this customer's orders.
    static adapterFor(ownerKey: string): DataAdapter {
        return new ObjectionAdapter(Payment, {
            modify: (query) => {
                const knex = Payment.knex();
                query.select('payments.*', knex('orders').select('orders.number').whereRaw('orders.id = payments.order_id').as('order_number'))
                    .whereIn('payments.order_id', knex('orders').select('id').where({ customer_id: ownerKey }));
            },
        });
    }
    /** The order is picked on create only, among the customer's orders. */
    static form(schema: Schema): Schema {
        const owner = String((schema.livewire as any).ownerRecord);
        return schema.components([
            Select.make('order_id').label('Order').required().hiddenOn('edit')
                .getSearchResultsUsing(async (search) => (await ordersOf(owner).clone().whereRaw('lower(number) like ?', [`%${search.toLowerCase().replace(/[%_]/g, '')}%`]).orderBy('number').limit(50).select('id', 'number')).map((o: any): [string, string] => [String(o.id), o.number]))
                .getOptionLabelUsing(async (value) => (await ordersOf(owner).clone().where({ id: value }).first('number'))?.number ?? null),
            TextInput.make('reference').required().columnSpan({ default: ({ operation }) => (operation === 'edit' ? 2 : 1) }),
            TextInput.make('amount').numeric().minValue(0).maxValue(99999999.99).required()
                .rule({ name: 'regex', passes: (v) => /^\d{1,6}(\.\d{0,2})?$/.test(String(v)), message: (attribute) => `The ${attribute} field format is invalid.` }),
            Select.make('currency').options(CURRENCIES).searchable().required(),
            ToggleButtons.make('provider').inline().grouped().options([['stripe', 'Stripe'], ['paypal', 'PayPal']]).required(),
            ToggleButtons.make('method').inline().options(PAYMENT_METHODS).required(),
        ]);
    }
    static table(table: Table<Payment>): Table<Payment> {
        return table
            .columns([
                TextColumn.make<Payment>('order.number').getStateUsing(({ record }) => record.order_number ?? null)
                    .url((record) => `/shop/orders/${record.order_id}/edit`).sortable({ column: 'order_number' }).weight('medium'),
                ColumnGroup.make<Payment>('Details').columns([
                    TextColumn.make<Payment>('reference').searchable().copyable(),
                    TextColumn.make<Payment>('amount').sortable().money((record) => record.currency).alignEnd(),
                ]),
                ColumnGroup.make<Payment>('Context').columns([
                    TextColumn.make<Payment>('provider').getStateUsing(({ record }) => headline(record.provider ?? '')).sortable(),
                    TextColumn.make<Payment>('method').getStateUsing(({ record }) => PAYMENT_METHODS.find(([value]) => value === record.method)?.[1] ?? record.method).sortable(),
                ]),
            ])
            .defaultSort('created_at', 'desc')
            .headerActions([CreateAction.make()])
            .recordActions([EditAction.make(), DeleteAction.make()])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}

/** Send email action: a modal form; nothing is actually sent. */
const sendEmail = () => Action.make('send_email').icon('m-envelope').tableIcon('c-envelope').color('info').modalWidth('lg').modalSubmitActionLabel('Send')
    .fillForm(({ record }) => ({ to: record.email }))
    .schema(() => [
        TextInput.make('to').email().disabled().dehydrated(),
        TextInput.make('subject').required(),
        RichEditor.make('body').required().columnSpanFull(),
    ])
    .action(({ record }) => { Notification.make().success().title(`Email sent to ${record.name}`).send(); });

export class CustomerResource extends Resource {
    static editHeaderActions(): Action[] { return [sendEmail()]; }
    static relations = [AddressesRelationManager, PaymentsRelationManager];
    static slug = 'shop/customers';
    static modelLabel = 'customer';
    static navigationIcon = 'o-user-group';
    static navigationGroup = 'Shop';
    static navigationSort = 2;
    static recordTitleAttribute = 'name';
    static globalSearchSort = 10;
    static globallySearchableAttributes = ['name', 'email'];
    // Soft deletes; a deleted customer can still be edited.
    static adapter = new ObjectionAdapter(Customer, { softDeletes: 'deleted_at', findsTrashed: true });

    static form(schema: Schema): Schema {
        return schema
            .components([
                Section.make()
                    .schema([
                        TextInput.make('name').maxLength(255).required(),
                        TextInput.make('email').label('Email address').required().email().maxLength(255).unique({ ignoreRecord: true }),
                        TextInput.make('phone').maxLength(255),
                        DatePicker.make('birthday').maxDate('today'),
                    ])
                    .columns(2)
                    .columnSpan({ lg: ({ record }) => (record === null ? 3 : 2) }),
                Section.make()
                    .schema([
                        TextEntry.make('created_at').state(({ record }) => diffForHumans((record as Customer).created_at)),
                        TextEntry.make('updated_at').label('Last modified at').state(({ record }) => diffForHumans((record as Customer).updated_at)),
                    ])
                    .columnSpan({ lg: 1 })
                    .hidden(({ record }) => record === null),
            ])
            .columns(3);
    }

    static table(table: Table<Customer>): Table<Customer> {
        return table
            .columns([
                TextColumn.make<Customer>('name').searchable({ isIndividual: true }).sortable().weight('medium'),
                TextColumn.make<Customer>('email').label('Email address').searchable({ isIndividual: true, isGlobal: false }).sortable().copyable(),
                TextColumn.make<Customer>('country').getStateUsing(({ record }) => firstCountry(record)).toggleable(),
                TextColumn.make<Customer>('phone').searchable().sortable().toggleable(),
            ])
            .defaultSort('name')
            .stackedOnMobile()
            .recordActions([
                sendEmail(),
                Action.make('edit').label('Edit').tableIcon('c-pencil-square').url(({ record }) => CustomerResource.getUrl('edit', (record as Customer).id)),
                // Shown only on deleted customers ("With deleted records" filter).
                RestoreAction.make(),
                ForceDeleteAction.make(),
            ])
            .filters([TrashedFilter.make()]);
    }
}
