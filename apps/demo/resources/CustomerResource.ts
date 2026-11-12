// Équivalent de App\Filament\Resources\Shop\Customers\CustomerResource + Tables\CustomersTable de la démo Filament.
import { Model, ObjectionAdapter, type DataAdapter } from '@navette/database';
import { Action } from '@navette/actions';
import { DatePicker, RichEditor, Select, TextInput, ToggleButtons } from '@navette/forms';
import { TextEntry } from '@navette/infolists';
import { AttachAction, CreateAction, DeleteAction, DeleteBulkAction, DetachAction, DetachBulkAction, EditAction, Notification, RelationManager, Resource } from '@navette/panels';
import { diffForHumans } from '@navette/support/i18n';
import { Section, type Schema } from '@navette/schemas';
import { ColumnGroup, TextColumn, TrashedFilter, type Table } from '@navette/tables';

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
    // Horodatage automatique, comme Eloquent.
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    /** Équivalent du cast `date` d'Eloquent : une date sans heure est stockée à minuit. */
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.birthday === 'string' && out.birthday.length === 10) out.birthday += ' 00:00:00';
        return out;
    }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
/** `$record->addresses->first()?->country?->getLabel()` : première adresse du client (relation polymorphe `addressables`). */
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
    /** Colonne calculée par la base (`street, zip city`) : en lecture seule. */
    full_address!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
}
const CUSTOMER_TYPE = 'App\\Models\\Shop\\Customer';
/** Enum CountryCode de la démo, dans son ordre de déclaration. */
const COUNTRIES: [string, string][] = [['us', 'United States'], ['gb', 'United Kingdom'], ['de', 'Germany'], ['fr', 'France'], ['ca', 'Canada'], ['au', 'Australia'], ['nl', 'Netherlands'], ['br', 'Brazil'], ['jp', 'Japan'], ['in', 'India']];
const attachedTo = (ownerKey: string, ownerType: string = CUSTOMER_TYPE) => Address.knex()('addressables').select('address_id').where({ addressable_type: ownerType, addressable_id: ownerKey });
/** Adresses d'un client (relation polymorphe `addressables`) : créer rattache, supprimer retire aussi le rattachement. */
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
/** Enums CurrencyCode et PaymentMethod de la démo, dans leur ordre de déclaration. */
const CURRENCIES: [string, string][] = [['usd', 'US Dollar'], ['eur', 'Euro'], ['gbp', 'British Pound'], ['cad', 'Canadian Dollar'], ['aud', 'Australian Dollar'], ['jpy', 'Japanese Yen'], ['brl', 'Brazilian Real'], ['inr', 'Indian Rupee']];
const PAYMENT_METHODS: [string, string][] = [['credit_card', 'Credit Card'], ['bank_transfer', 'Bank Transfer'], ['paypal', 'PayPal'], ['apple_pay', 'Apple Pay'], ['google_pay', 'Google Pay']];
const ordersOf = (ownerKey: string) => Payment.knex()('orders').where({ customer_id: ownerKey }).whereNull('deleted_at');
const headline = (text: string) => text.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Équivalent de RelationManagers\AddressesRelationManager. */
export class AddressesRelationManager extends RelationManager {
    static relationship = 'addresses';
    static modelLabel = 'address';
    static recordTitleAttribute = 'full_address';
    // Relation polymorphe `addressables` : les adresses rattachées à ce client.
    /** Type du propriétaire dans la relation polymorphe (client par défaut ; une sous-classe peut viser un autre modèle). */
    static ownerType = CUSTOMER_TYPE;
    static adapterFor(ownerKey: string): DataAdapter { return new CustomerAddresses(ownerKey, this.ownerType); }
    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('street'), TextInput.make('zip'), TextInput.make('city'), TextInput.make('state'),
            Select.make('country').options(COUNTRIES).searchable(),
        ]);
    }
    // --- rattachement : seules les adresses qui ne sont pas déjà à ce client sont proposées
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
                // Enum CountryCode : le libellé du pays.
                TextColumn.make<Address>('country').getStateUsing(({ record }) => (record.country ? (regionNames.of(record.country.toUpperCase()) ?? record.country) : null)),
            ])
            .defaultSort('city')
            .stackedOnMobile()
            .headerActions([AttachAction.make(), CreateAction.make()])
            .recordActions([EditAction.make(), DetachAction.make(), DeleteAction.make()])
            .groupedBulkActions([DetachBulkAction.make(), DeleteBulkAction.make()]);
    }
}

/** Équivalent de RelationManagers\PaymentsRelationManager. */
export class PaymentsRelationManager extends RelationManager {
    static relationship = 'payments';
    static modelLabel = 'payment';
    static recordTitleAttribute = 'reference';
    // `hasManyThrough` : les paiements des commandes de ce client.
    static adapterFor(ownerKey: string): DataAdapter {
        return new ObjectionAdapter(Payment, {
            modify: (query) => {
                const knex = Payment.knex();
                query.select('payments.*', knex('orders').select('orders.number').whereRaw('orders.id = payments.order_id').as('order_number'))
                    .whereIn('payments.order_id', knex('orders').select('id').where({ customer_id: ownerKey }));
            },
        });
    }
    /** Formulaire : la commande n'est choisie qu'à la création, parmi celles du client. */
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
                // La page d'édition des commandes n'est pas encore portée : le lien reprend l'adresse de Filament.
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

/** Action « Send email » de la démo : un formulaire en modale ; comme dans Filament, rien n'est réellement envoyé. */
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
    // Comme la démo : suppression douce, et l'édition reste accessible pour un client supprimé.
    static adapter = new ObjectionAdapter(Customer, { softDeletes: 'deleted_at', findsTrashed: true });

    /** Équivalent de Schemas\CustomerForm. */
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
            ])
            .filters([TrashedFilter.make()]);
    }
}
