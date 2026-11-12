// Équivalent de App\Filament\Resources\Shop\Orders\OrderResource + Tables\OrdersTable + Pages\ListOrders de la démo Filament.
// Porté : la liste (colonnes, totaux, onglets, actions de ligne). À porter : widget de statistiques, regroupement, filtre par date,
// panneau latéral de l'action « Ship », formulaire réel (assistant, lignes de commande).
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { Repeater, RichEditor, Select, Step, TableColumn, Textarea, TextInput, ToggleButtons } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import { diffForHumans } from '@navette-js/support/i18n';
import { CreateRecord, Notification, PageTableStatsWidget, Resource, Stat, Tab } from '@navette-js/panels';
import { Grid, Group, Section, StatefulGroup, type Component, type Schema } from '@navette-js/schemas';
import { Sum, TextColumn, TrashedFilter, type Table } from '@navette-js/tables';

export class Order extends Model {
    static tableName = 'orders';
    id!: number;
    customer_id!: number | null;
    number!: string;
    total_price!: number;
    status!: string;
    shipping_price!: number | null;
    shipping_method!: string | null;
    notes!: string | null;
    created_at!: string;
    updated_at!: string;
    deleted_at!: string | null;
    customer_name?: string | null;
    /** Adresse de la commande (table `order_addresses`), jointe par l'adaptateur. */
    address?: Record<string, string | null> | null;
    /** Lignes de la commande (`order_items`), jointes par l'adaptateur. */
    items?: Record<string, unknown>[];
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
}

/** Enum OrderStatus de la démo : libellé, couleur et icône. */
export const STATUSES: Record<string, { label: string; color: string; icon: string }> = {
    new: { label: 'New', color: 'info', icon: 'c-sparkles' },
    processing: { label: 'Processing', color: 'warning', icon: 'c-arrow-path' },
    shipped: { label: 'Shipped', color: 'success', icon: 'c-truck' },
    delivered: { label: 'Delivered', color: 'success', icon: 'c-check-badge' },
    cancelled: { label: 'Cancelled', color: 'danger', icon: 'c-x-circle' },
};
const countWhere = (status: string | null) => async () => Number(((await Order.query().whereNull('deleted_at').modify((q) => { if (status) q.where('status', status); }).count({ n: '*' }).first()) as any)?.n ?? 0);
const setStatus = (status: string, title: string, level: 'success' | 'danger' = 'success', extra: (data: Record<string, unknown>) => Record<string, unknown> = () => ({})) => async ({ record, data }: { record: Order; data: Record<string, unknown> }) => {
    await OrderResource.adapter.update(record.id, { status, ...extra(data) });
    Notification.make()[level]().title(title).send();
};

const ORDER_TYPE = 'App\\Models\\Shop\\Order';
const ADDRESS_FIELDS = ['country', 'street', 'city', 'state', 'zip'] as const;
const COUNTRIES: [string, string][] = [['us', 'United States'], ['gb', 'United Kingdom'], ['de', 'Germany'], ['fr', 'France'], ['ca', 'Canada'], ['au', 'Australia'], ['nl', 'Netherlands'], ['br', 'Brazil'], ['jp', 'Japan'], ['in', 'India']];
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
/** Commandes : l'adresse (`AddressForm` de la démo) est enregistrée dans `order_addresses`. */
class Orders extends ObjectionAdapter<Order> {
    constructor() {
        super(Order, {
            softDeletes: 'deleted_at', findsTrashed: true,
            // `customer.name` : sous-requête, utilisable pour le tri et la recherche.
            modify: (query) => { query.select('orders.*', Order.knex()('customers').select('customers.name').whereRaw('customers.id = orders.customer_id').as('customer_name')); },
        });
    }
    /** Relation `morphOne` : une ligne de `order_addresses` par commande. */
    private addressOf(orderKey: string | number) {
        return Order.knex()('order_addresses').where({ addressable_type: ORDER_TYPE, addressable_id: orderKey }).orderBy('id').first();
    }
    async find(key: string | number): Promise<Order | null> {
        const order = await super.find(key);
        if (order) {
            const address = await this.addressOf(key);
            order.address = Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, address?.[field] ?? null]));
            order.items = await Order.knex()('order_items').where({ order_id: key }).orderBy('sort').orderBy('id').select('id', 'product_id', 'qty', 'unit_price');
        }
        return order;
    }
    /**
     * Lignes de commande : celles qui portent la clé `record-<id>` d'une ligne de CETTE commande sont mises à jour,
     * les autres sont créées, et les lignes absentes du formulaire sont supprimées.
     */
    private async saveItems(orderKey: string | number, items: unknown): Promise<void> {
        if (!items || typeof items !== 'object' || Array.isArray(items)) return;
        const knex = Order.knex();
        const existing = new Set<number>((await knex('order_items').where({ order_id: orderKey }).select('id')).map((row: any) => Number(row.id)));
        const kept: number[] = [];
        let sort = 0;
        for (const [key, raw] of Object.entries(items as Record<string, any>)) {
            const values = { product_id: Number(raw.product_id), qty: Number(raw.qty), unit_price: Number(raw.unit_price), sort: sort++, updated_at: now() };
            const id = Number(/^record-(\d+)$/.exec(key)?.[1] ?? NaN);
            if (existing.has(id)) { await knex('order_items').where({ id, order_id: orderKey }).update(values); kept.push(id); }
            else kept.push((await knex('order_items').insert({ ...values, order_id: orderKey, created_at: now() }))[0]);
        }
        await knex('order_items').where({ order_id: orderKey }).whereNotIn('id', kept).delete();
    }
    private async saveAddress(orderKey: string | number, address: unknown): Promise<void> {
        if (!address || typeof address !== 'object') return;
        const values = Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, (address as any)[field] ?? null]));
        const existing = await this.addressOf(orderKey);
        if (existing) { await Order.knex()('order_addresses').where({ id: existing.id }).update({ ...values, updated_at: now() }); return; }
        await Order.knex()('order_addresses').insert({ ...values, addressable_type: ORDER_TYPE, addressable_id: orderKey, created_at: now(), updated_at: now() });
    }
    async create(data: Record<string, unknown>): Promise<Order> {
        const { address, items, ...attributes } = data;
        const order = await super.create(attributes);
        await this.saveAddress(order.id, address);
        await this.saveItems(order.id, items);
        return order;
    }
    async update(key: string | number, data: Record<string, unknown>): Promise<Order | null> {
        const { address, items, ...attributes } = data;
        // La commande doit appartenir à la portée de l'adaptateur avant toute écriture.
        if (!(await super.find(key))) return null;
        await super.update(key, attributes);
        await this.saveAddress(key, address);
        await this.saveItems(key, items);
        return this.find(key);
    }
}

/** Équivalent de Widgets\OrderStats : agrégats et tendances mensuelles (un an) sur les commandes affichées par la table. */
export class OrderStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => OrderResource.getPages().index as any;
    async getStats(): Promise<Stat[]> {
        const end = new Date();
        // `subYear()` de Carbon : même jour, un an plus tôt (le 29 février déborde sur le 1er mars).
        const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes(), end.getUTCSeconds()));
        const open = ['new', 'processing'];
        const [all, opened, orders, openOrders, averages] = await Promise.all([
            this.aggregatePageTable({ avg: ['total_price'] }),
            this.aggregatePageTable({}, (query) => query.whereIn('status', open)),
            this.trendPageTable({ start, end }),
            this.trendPageTable({ start, end, modify: (query) => query.whereIn('t.status', open) }),
            this.trendPageTable({ start, end, average: 'total_price' }),
        ]);
        return [
            Stat.make('Orders', all.count).chart(orders),
            Stat.make('Open orders', opened.count).chart(openOrders),
            Stat.make('Average order value', new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(all.avg.total_price)).chart(averages),
        ];
    }
}

/** Équivalent de PagesCreateOrder : la création se fait en deux étapes (détails, puis lignes de commande). */
class CreateOrder extends CreateRecord {
    /** Comme la démo Filament : une notification « New order » est enregistrée pour l'utilisateur qui vient de créer la commande. */
    protected async afterCreate(record: Order): Promise<void> {
        const { panel, user } = this._ctx as any;
        if (!user) return;
        const order = (await OrderResource.adapter.find(record.id)) as Order | null;
        await Notification.make().title('New order').icon('o-shopping-bag')
            .body(`${order?.customer_name ?? ''} ordered ${order?.items?.length ?? 0} products.`)
            .actions([{ label: 'View', url: OrderResource.getUrl('edit', record.id) }])
            .sendToDatabase(panel.getDatabaseNotifications(), user.id);
    }
    protected getSteps(): Step[] {
        return [
            Step.make('Order Details').schema([Section.make().schema(OrderResource.detailsComponents()).columns(2)]),
            Step.make('Order Items').schema([Section.make().schema([OrderResource.itemsRepeater()])]),
        ];
    }
}

export class OrderResource extends Resource {
    static pages = { create: CreateOrder };
    static widgets = [OrderStats];
    static headerWidgets = [OrderStats];
    static slug = 'shop/orders';
    static modelLabel = 'order';
    static navigationIcon = 'o-shopping-bag';
    static navigationGroup = 'Shop';
    static navigationSort = 1;
    /** Commandes « New » (équivalent de getNavigationBadge()). */
    static async getNavigationBadge(): Promise<string> { return String(await countWhere('new')()); }
    static recordTitleAttribute = 'number';
    static globalSearchSort = 11;
    static globallySearchableAttributes = ['number', 'customer_name'];
    static getGlobalSearchResultDetails(record: Order): Record<string, unknown> { return { Customer: record.customer_name }; }
    static adapter = new Orders();

    /**
     * Équivalent de Schemas\OrderForm. Écart : le client ne peut pas être créé depuis le sélecteur.
     */
    static form(schema: Schema): Schema {
        return schema
            .components([
                Group.make()
                    .schema([
                        Section.make()
                            .schema(OrderResource.detailsComponents())
                            .columns(2),
                        Section.make('Order items')
                            .afterHeader([
                                Action.make('reset').color('danger').requiresConfirmation()
                                    .modalHeading('Are you sure?').modalDescription('All existing items will be removed from the order.')
                                    .action(({ livewire }) => { livewire.data.items = {}; }),
                            ])
                            .schema([OrderResource.itemsRepeater()]),
                    ])
                    .columnSpan({ lg: ({ record }) => (record === null ? 3 : 2) }),
                Section.make()
                    .schema([
                        TextEntry.make('created_at').label('Order date').state(({ record }) => diffForHumans((record as Order).created_at)),
                        TextEntry.make('updated_at').label('Last modified at').state(({ record }) => diffForHumans((record as Order).updated_at)),
                    ])
                    .columnSpan({ lg: 1 })
                    .hidden(({ record }) => record === null),
            ])
            .columns(3);
    }

    /** Équivalent de OrderForm::getDetailsComponents() : repris tel quel par la première étape de l'assistant de création. */
    static detailsComponents(): Component[] {
        const statuses = Object.entries(STATUSES);
        return [
            TextInput.make('number').default(`OR-${Math.floor(100000 + Math.random() * 900000)}`).disabled().dehydrated().required().maxLength(32).unique({ ignoreRecord: true }),
            Select.make('customer_id').label('Customer').required()
                .getSearchResultsUsing(async (search) => (await Order.knex()('customers').whereNull('deleted_at').whereRaw('lower(name) like ?', [`%${search.toLowerCase().replace(/[%_]/g, '')}%`]).orderBy('name').limit(50).select('id', 'name')).map((c: any): [string, string] => [String(c.id), c.name]))
                .getOptionLabelUsing(async (value) => (await Order.knex()('customers').where({ id: value }).first('name'))?.name ?? null),
            ToggleButtons.make('status').inline().required()
                .options(statuses.map(([value, status]): [string, string] => [value, status.label]))
                .colors(Object.fromEntries(statuses.map(([value, status]) => [value, status.color])))
                .icons(Object.fromEntries(statuses.map(([value, status]) => [value, status.icon.replace(/^c-/, 'm-')]))),
            // AddressForm de la démo : pays, rue, puis ville / État / code postal.
            StatefulGroup.make('address', [
                Grid.make().schema([Select.make('country').options(COUNTRIES).searchable()]),
                TextInput.make('street').label('Street address').maxLength(255),
                Grid.make(3).schema([
                    TextInput.make('city').maxLength(255),
                    TextInput.make('state').label('State / Province').maxLength(255),
                    TextInput.make('zip').label('Zip / Postal code').maxLength(255),
                ]),
            ]).columnSpan('full'),
            RichEditor.make('notes').columnSpan('full'),
        ];
    }

    /** Équivalent de OrderForm::getItemsRepeater() : produit (une seule fois par commande), quantité, prix unitaire repris du produit. */
    static itemsRepeater(): Repeater {
        const productsOf = (livewire: any): string[] => Object.values((livewire.data?.items ?? {}) as Record<string, any>).map((item) => String(item?.product_id ?? '')).filter(Boolean);
        return Repeater.make('items').label('Order items').hiddenLabel().required().defaultItems(1)
            .table([TableColumn.make('Product'), TableColumn.make('Quantity').width(100), TableColumn.make('Unit Price').width(110)])
            .schema(() => [
                Select.make('product_id').label('Product').required().live().searchable()
                    .options(async () => (await Order.knex()('products').orderBy('id').select('id', 'name')).map((p: any): [string, string] => [String(p.id), p.name]), { searchOnServer: false })
                    .afterStateUpdated(async ({ state, set }) => { set('unit_price', (state ? (await Order.knex()('products').where({ id: state }).first('price'))?.price : null) ?? 0); })
                    // Un produit déjà choisi dans une autre ligne est grisé, et refusé à l'enregistrement.
                    .disableOptionWhen((value, ctx) => value !== String(ctx.state ?? '') && productsOf(ctx.livewire).includes(value))
                    .rule({ name: 'distinct', passes: (value, ctx) => productsOf(ctx.livewire).filter((id) => id === String(value)).length <= 1, message: (attribute) => `The ${attribute} field has a duplicate value.` }),
                TextInput.make('qty').label('Quantity').integer().minValue(1).maxValue(2147483647).default(1).required(),
                TextInput.make('unit_price').disabled().dehydrated().numeric().minValue(0).maxValue(99999999.99).required(),
            ])
            // La page des produits n'est pas encore portée : le lien reprend l'adresse de Filament.
            .extraItemLink(({ item }) => (item.product_id ? { label: 'Open product', icon: 'm-arrow-top-right-on-square', url: `/shop/products/${Number(item.product_id)}/edit` } : null));
    }

    static tabs(): Record<string, Tab> {
        const tab = (status: string) => Tab.make().badge(countWhere(status)).badgeColor(STATUSES[status].color).query((query) => { query.where('status', status); });
        return { '': Tab.make('All').badge(countWhere(null)), new: tab('new'), processing: tab('processing'), shipped: tab('shipped'), delivered: tab('delivered'), cancelled: tab('cancelled') };
    }

    static table(table: Table<Order>): Table<Order> {
        return table
            .columns([
                TextColumn.make<Order>('number').searchable().sortable().copyable().weight('medium'),
                TextColumn.make<Order>('customer.name').getStateUsing(({ record }) => record.customer_name ?? null)
                    .searchable({ column: 'customer_name' }).sortable({ column: 'customer_name' }).toggleable(),
                TextColumn.make<Order>('status').badge()
                    .formatStateUsing(({ record }) => STATUSES[record.status]?.label ?? record.status)
                    .color((record) => STATUSES[record.status]?.color ?? 'gray').icon((record) => STATUSES[record.status]?.icon ?? null),
                TextColumn.make<Order>('total_price').money().alignEnd().searchable().sortable().summarize(Sum.make().money()),
                TextColumn.make<Order>('shipping_price').label('Shipping cost').money().alignEnd().searchable().sortable().toggleable().summarize(Sum.make().money()),
                TextColumn.make<Order>('created_at').label('Order date').date().sortable().toggleable(),
            ])
            .defaultSort('created_at', 'desc')
            .filters([TrashedFilter.make()])
            .recordActions([
                ActionGroup.make([
                    Action.make('process').icon('m-arrow-path').color('warning')
                        .visible(({ record }) => (record as Order).status === 'new')
                        .action(setStatus('processing', 'Order is now processing')),
                    Action.make('ship').icon('m-truck').color('success')
                        .visible(({ record }) => (record as Order).status === 'processing')
                        .modalSubmitActionLabel('Ship')
                        .schema(() => [Textarea.make('notes').label('Shipping notes').rows(3)])
                        .action(setStatus('shipped', 'Order shipped', 'success', (data) => ({ notes: data.notes ?? null }))),
                    Action.make('deliver').icon('m-check-badge').color('success')
                        .visible(({ record }) => (record as Order).status === 'shipped')
                        .requiresConfirmation()
                        .action(setStatus('delivered', 'Order marked as delivered')),
                    // La resource a une page d'édition : « Edit » est un lien, pas une modale.
                    Action.make('edit').label('Edit').icon('m-pencil-square').url(({ record }) => OrderResource.getUrl('edit', (record as Order).id)),
                    Action.make('cancel').icon('m-x-circle').color('danger')
                        .visible(({ record }) => !['delivered', 'cancelled'].includes((record as Order).status))
                        .disabled(({ record }) => (record as Order).status === 'shipped')
                        .requiresConfirmation()
                        .action(setStatus('cancelled', 'Order cancelled', 'danger')),
                    Action.make('delete').label('Delete').icon('m-trash').color('danger').keyBindings(['mod+d'])
                        .requiresConfirmation().modalIcon('o-trash')
                        .modalHeading(({ record }) => `Delete ${record.number}`).modalSubmitActionLabel('Delete')
                        // Comme la démo Filament : la suppression est remplacée par une notification.
                        .action(() => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); }),
                ]),
            ]);
    }
}
