// Équivalent de App\Filament\Resources\Shop\Products\ProductResource + Tables\ProductsTable de la démo Filament.
import { Action, ActionGroup } from '@navette/actions';
import { Model, ObjectionAdapter } from '@navette/database';
import { Checkbox, DatePicker, FileUpload, RichEditor, Select, TextInput, Toggle, ToggleButtons, type FileUploadEntry } from '@navette/forms';
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Notification, PageTableStatsWidget, Resource, Stat } from '@navette/panels';
import { Group, Section, type Schema } from '@navette/schemas';
import { BooleanConstraint, DateConstraint, IconColumn, ImageColumn, NumberConstraint, QueryBuilder, TextColumn, TextConstraint, type Table } from '@navette/tables';

export class Product extends Model {
    static tableName = 'products';
    id!: number;
    brand_id!: number | null;
    name!: string;
    slug!: string | null;
    sku!: string | null;
    barcode!: string | null;
    description!: string | null;
    qty!: number;
    security_stock!: number;
    featured!: number | boolean;
    is_visible!: number | boolean;
    old_price!: number | null;
    price!: number | null;
    cost!: number | null;
    backorder!: number | boolean;
    requires_shipping!: number | boolean;
    published_at!: string | null;
    created_at!: string;
    updated_at!: string;
    // Colonnes calculées par la requête de liste.
    brand_name?: string | null;
    image_id?: number | null;
    image_name?: string | null;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    /** Équivalent du cast `boolean` d'Eloquent : SQLite stocke 0 ou 1. */
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        for (const key of ['featured', 'is_visible', 'backorder', 'requires_shipping']) if (typeof out[key] === 'boolean') out[key] = out[key] ? 1 : 0;
        return out;
    }
}

const slugify = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const PRODUCT_TYPE = 'App\\Models\\Shop\\Product';
/** Première image de la collection `product-images` (bibliothèque de médias de Spatie) : dossier `<id du média>/conversions`. */
const firstImage = (column: string) => Product.knex()('media').select(column)
    .where('media.model_type', PRODUCT_TYPE).whereRaw('media.model_id = products.id').where('media.collection_name', 'product-images')
    .orderBy('media.order_column').orderBy('media.id').limit(1);
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };

/** Produits : les catégories (relation plusieurs-à-plusieurs `productCategories`) sont lues et enregistrées dans `product_category_product`. */
class Products extends ObjectionAdapter<Product> {
    private brand: string | null;
    private category: string | null;
    /** `brand` : restreint aux produits d'une marque (relation manager de la marque) ; les créations lui sont rattachées. */
    constructor(brand: string | null = null, category: string | null = null) {
        super(Product, {
            modify: (query) => {
                if (brand !== null) query.where('products.brand_id', brand);
                // Relation plusieurs-à-plusieurs : produits rattachés à la catégorie (relation manager de la catégorie).
                if (category !== null) query.whereIn('products.id', Product.knex()('product_category_product').where('product_category_id', category).select('product_id'));
                query.select(
                    'products.*',
                    Product.knex()('brands').select('brands.name').whereRaw('brands.id = products.brand_id').as('brand_name'),
                    firstImage('media.id').as('image_id'), firstImage('media.name').as('image_name'),
                );
            },
        });
        this.brand = brand;
        this.category = category;
    }
    async find(key: string | number): Promise<Product | null> {
        const product = await super.find(key);
        if (product) (product as any).media = (await this.mediaOf(key)).map((media: any) => media.uuid);
        if (product) (product as any).productCategories = (await Product.knex()('product_category_product').where({ product_id: key }).orderBy('product_category_id').select('product_category_id')).map((row: any) => String(row.product_category_id));
        return product;
    }
    private mediaOf(key: string | number) {
        return Product.knex()('media').where({ model_type: PRODUCT_TYPE, model_id: key, collection_name: 'product-images' }).orderBy('order_column').orderBy('id');
    }
    /**
     * Images du produit (bibliothèque de médias de Spatie) : les médias absents du formulaire sont supprimés, les fichiers temporaires
     * deviennent des médias, et l'ordre du formulaire est enregistré. Écart : la miniature est une copie de l'image, sans redimensionnement.
     */
    private async syncMedia(key: string | number, entries: unknown): Promise<void> {
        if (!Array.isArray(entries)) return;
        const knex = Product.knex();
        const existing = new Map<string, any>((await this.mediaOf(key)).map((media: any) => [media.uuid, media]));
        const kept = new Set<string>();
        let order = 0;
        for (const entry of entries as FileUploadEntry[]) {
            order++;
            if ('key' in entry) {
                const media = existing.get(entry.key);
                if (media) { kept.add(media.uuid); await knex('media').where({ id: media.id }).update({ order_column: order }); }
                continue;
            }
            const root = ProductResource.mediaRoot;
            if (!root || entry.file.type !== 'image/jpeg') continue;
            const name = randomUUID();
            const [id] = await knex('media').insert({
                model_type: PRODUCT_TYPE, model_id: key, uuid: randomUUID(), collection_name: 'product-images', name, file_name: `${name}.jpg`, mime_type: 'image/jpeg',
                disk: 'public', conversions_disk: 'public', size: entry.file.size, manipulations: '[]', custom_properties: '[]', generated_conversions: '{"thumb":true}',
                responsive_images: '[]', order_column: order, created_at: now(), updated_at: now(),
            });
            mkdirSync(path.join(root, String(id), 'conversions'), { recursive: true });
            copyFileSync(entry.file.path, path.join(root, String(id), `${name}.jpg`));
            copyFileSync(entry.file.path, path.join(root, String(id), 'conversions', `${name}-thumb.jpg`));
        }
        for (const media of existing.values()) {
            if (kept.has(media.uuid)) continue;
            await knex('media').where({ id: media.id }).delete();
            // Seuls les fichiers du dossier de l'application sont effacés ; ceux fournis avec la base de démonstration restent en place.
            if (ProductResource.mediaRoot) rmSync(path.join(ProductResource.mediaRoot, String(Number(media.id))), { recursive: true, force: true });
        }
    }
    /** Remplace les catégories du produit par celles du formulaire ; seules des catégories existantes sont rattachées. */
    private async syncCategories(key: string | number, categories: unknown): Promise<void> {
        if (!Array.isArray(categories)) return;
        const knex = Product.knex();
        const ids = (await knex('product_categories').whereIn('id', categories.map(Number).filter(Number.isInteger)).select('id')).map((row: any) => Number(row.id));
        await knex('product_category_product').where({ product_id: key }).delete();
        if (ids.length) await knex('product_category_product').insert(ids.map((id) => ({ product_id: key, product_category_id: id })));
    }
    async create(data: Record<string, unknown>): Promise<Product> {
        const { productCategories, media, ...attributes } = data;
        if (this.brand !== null) attributes.brand_id = this.brand;
        const product = await super.create(attributes);
        await this.syncCategories(product.id, productCategories);
        // Créé depuis une catégorie : il lui est rattaché, comme `$relationship->save()` de Filament.
        if (this.category !== null) {
            const link = { product_id: product.id, product_category_id: this.category };
            await Product.knex()('product_category_product').where(link).delete();
            await Product.knex()('product_category_product').insert(link);
        }
        await this.syncMedia(product.id, media);
        return product;
    }
    async update(key: string | number, data: Record<string, unknown>): Promise<Product | null> {
        const { productCategories, media, ...attributes } = data;
        if (this.brand !== null) delete attributes.brand_id;
        if (!(await super.find(key))) return null;
        await super.update(key, attributes);
        await this.syncCategories(key, productCategories);
        await this.syncMedia(key, media);
        return this.find(key);
    }
}

/** Équivalent de Widgets\ProductStats : agrégats sur les produits affichés par la table. */
export class ProductStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => ProductResource.getPages().index as any;
    async getStats(): Promise<Stat[]> {
        const { count, sum, avg } = await this.aggregatePageTable({ sum: ['qty'], avg: ['price'] });
        return [
            Stat.make('Total products', count),
            Stat.make('Product inventory', sum.qty),
            Stat.make('Average price', new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(avg.price)),
        ];
    }
}

export class ProductResource extends Resource {
    /** Dossier public où sont écrites les images téléversées (défini par le serveur). */
    static mediaRoot: string | null = null;
    static widgets = [ProductStats];
    static headerWidgets = [ProductStats];
    static slug = 'shop/products';
    static modelLabel = 'product';
    static navigationIcon = 'o-bolt';
    static navigationGroup = 'Shop';
    static navigationSort = 0;
    /** Produits sous leur stock de sécurité (équivalent de getNavigationBadge()). */
    static async getNavigationBadge(): Promise<string> { return String(((await Product.query().whereRaw('qty < security_stock').count({ n: '*' }).first()) as any)?.n ?? 0); }
    static recordTitleAttribute = 'name';
    static globalSearchSort = 12;
    static globallySearchableAttributes = ['name', 'sku', 'brand_name'];
    static getGlobalSearchResultDetails(record: Product): Record<string, unknown> { return { Brand: record.brand_name }; }
    static adapter = new Products();
    static adapterForBrand(brandKey: string): Products { return new Products(brandKey); }
    static adapterForCategory(categoryKey: string): Products { return new Products(null, categoryKey); }

    /** Équivalent de Schemas\ProductForm. */
    static form(schema: Schema, options: { withBrand?: boolean } = {}): Schema {
        const price = (name: string) => TextInput.make(name).numeric().minValue(0).maxValue(99999999.99)
            .rule({ name: 'regex', passes: (value) => /^\d{1,6}(\.\d{0,2})?$/.test(String(value)), message: (attribute) => `The ${attribute} field format is invalid.` }).required();
        const stock = (name: string) => TextInput.make(name).numeric().minValue(0).maxValue(18446744073709551615).integer().required();
        const knex = () => Product.knex();
        const like = (search: string) => `%${search.toLowerCase().replace(/[%_]/g, '')}%`;
        return schema
            .components([
                Group.make()
                    .schema([
                        Section.make()
                            .schema([
                                TextInput.make('name').required().maxLength(255).live({ onBlur: true })
                                    .afterStateUpdated(({ operation, state, set }) => { if (operation === 'create') set('slug', slugify(String(state ?? ''))); }),
                                TextInput.make('slug').disabled().dehydrated().required().maxLength(255).unique({ ignoreRecord: true }),
                                RichEditor.make('description').columnSpan('full'),
                            ])
                            .columns(2),
                        Section.make('Images')
                            .schema([
                                // Équivalent de SpatieMediaLibraryFileUpload : l'état porte les uuid des médias, l'adaptateur enregistre les fichiers.
                                FileUpload.make('media').multiple().maxFiles(5).reorderable().acceptedFileTypes(['image/jpeg']).hiddenLabel().storeFiles(false)
                                    .getUploadedFileUsing(async (uuid) => {
                                        const media = await Product.knex()('media').where({ uuid, model_type: PRODUCT_TYPE }).first();
                                        return media ? { name: media.file_name, size: Number(media.size), type: media.mime_type, url: `/storage/${Number(media.id)}/${encodeURIComponent(media.file_name)}` } : null;
                                    }),
                            ])
                            .collapsible(),
                        Section.make('Pricing')
                            .schema([
                                price('price'),
                                price('old_price').label('Compare at price'),
                                price('cost').label('Cost per item').helperText("Customers won't see this price."),
                            ])
                            .columns(2),
                        Section.make('Inventory')
                            .schema([
                                TextInput.make('sku').label('SKU (Stock Keeping Unit)').unique({ ignoreRecord: true }).maxLength(255).required(),
                                TextInput.make('barcode').label('Barcode (ISBN, UPC, GTIN, etc.)').unique({ ignoreRecord: true }).maxLength(255).required(),
                                stock('qty').label('Quantity'),
                                stock('security_stock').helperText('The minimum quantity to keep before a low-stock warning is shown.'),
                            ])
                            .columns(2),
                        Section.make('Shipping')
                            .schema([
                                Checkbox.make('backorder').label('Allow purchases when out of stock'),
                                Checkbox.make('requires_shipping').label('This product will be shipped'),
                            ])
                            .columns(2),
                    ])
                    .columnSpan({ lg: 2 }),
                Group.make()
                    .schema([
                        Section.make('Status')
                            .schema([
                                Toggle.make('is_visible').label('Visibility').helperText('Controls whether this product appears in sales channels.').default(true),
                                DatePicker.make('published_at').label('Publishing date').default(() => new Date().toISOString().slice(0, 10)).required(),
                            ]),
                        Section.make('Associations')
                            .schema([
                                // `hiddenOn(ProductsRelationManager)` de la démo : pas de choix de marque depuis la page d'une marque.
                                Select.make('brand_id').label('Brand').searchable().hidden(() => options.withBrand === false)
                                    .getSearchResultsUsing(async (search) => (await knex()('brands').whereRaw('lower(name) like ?', [like(search)]).orderBy('name').limit(50).select('id', 'name')).map((b: any): [string, string] => [String(b.id), b.name]))
                                    .getOptionLabelUsing(async (value) => (await knex()('brands').where({ id: value }).first('name'))?.name ?? null),
                                Select.make('productCategories').label('Product categories').multiple().required()
                                    .getSearchResultsUsing(async (search) => (await knex()('product_categories').whereRaw('lower(name) like ?', [like(search)]).orderBy('name').limit(50).select('id', 'name')).map((c: any): [string, string] => [String(c.id), c.name]))
                                    .getOptionLabelsUsing(async (values) => (await knex()('product_categories').whereIn('id', values).select('id', 'name')).map((c: any): [string, string] => [String(c.id), c.name])),
                            ]),
                    ])
                    .columnSpan({ lg: 1 }),
            ])
            .columns(3);
    }

    static table(table: Table<Product>): Table<Product> {
        return table
            .columns([
                ImageColumn.make<Product>('image')
                    .getStateUsing(({ record }) => (record.image_id ? `/storage/${Number(record.image_id)}/conversions/${encodeURIComponent(String(record.image_name))}-thumb.jpg` : null))
                    .alt((record) => `Edit ${record.name}`),
                TextColumn.make<Product>('name').searchable().sortable().weight('medium'),
                TextColumn.make<Product>('brand.name').getStateUsing(({ record }) => record.brand_name ?? null)
                    .searchable({ column: 'brand_name' }).sortable({ column: 'brand_name' }).toggleable(),
                IconColumn.make<Product>('is_visible').label('Visibility').boolean().sortable().toggleable(),
                TextColumn.make<Product>('price').money().alignEnd().searchable().sortable(),
                TextColumn.make<Product>('sku').label('SKU').searchable().sortable().copyable().toggleable(),
                TextColumn.make<Product>('qty').label('Quantity').numeric().alignEnd().searchable().sortable().toggleable(),
                TextColumn.make<Product>('security_stock').numeric().alignEnd().searchable().sortable().toggleable(true, { isToggledHiddenByDefault: true }),
                TextColumn.make<Product>('published_at').label('Publishing date').date().sortable().toggleable(true, { isToggledHiddenByDefault: true }),
            ])
            .filters([
                QueryBuilder.make()
                    .constraints([
                        TextConstraint.make('name'),
                        TextConstraint.make('slug'),
                        TextConstraint.make('sku').label('SKU (Stock Keeping Unit)'),
                        TextConstraint.make('barcode').label('Barcode (ISBN, UPC, GTIN, etc.)'),
                        TextConstraint.make('description'),
                        NumberConstraint.make('old_price').label('Compare at price').icon('m-currency-dollar'),
                        NumberConstraint.make('price').icon('m-currency-dollar'),
                        NumberConstraint.make('cost').label('Cost per item').icon('m-currency-dollar'),
                        NumberConstraint.make('qty').label('Quantity'),
                        NumberConstraint.make('security_stock'),
                        BooleanConstraint.make('is_visible').label('Visibility'),
                        BooleanConstraint.make('featured'),
                        BooleanConstraint.make('backorder'),
                        BooleanConstraint.make('requires_shipping').icon('m-truck'),
                        DateConstraint.make('published_at').label('Publishing date'),
                    ])
                    .constraintPickerColumns(2),
            ], { layout: 'above-content-collapsible' })
            .defaultSort('name')
            .deferFilters()
            .recordActions([
                ActionGroup.make([
                    Action.make('edit').label('Edit').icon('m-pencil-square').url(({ record }) => ProductResource.getUrl('edit', (record as Product).id)),
                    Action.make('toggle_visibility')
                        .icon(({ record }) => ((record as Product).is_visible ? 'm-eye-slash' : 'm-eye'))
                        .label(({ record }) => ((record as Product).is_visible ? 'Hide' : 'Show'))
                        .color('gray')
                        .action(async ({ record }) => { await ProductResource.adapter.update(record.id, { is_visible: !record.is_visible }); }),
                    Action.make('adjust_price').icon('m-currency-dollar').color('warning')
                        .modalWidth('md').modalSubmitActionLabel('Save').modalIcon('o-currency-dollar').modalIconColor('warning')
                        .fillForm(({ record }) => ({ price: record.price, old_price: record.old_price }))
                        .schema(() => [
                            TextInput.make('price').numeric().prefix('$').minValue(0).maxValue(99999999.99).required(),
                            TextInput.make('old_price').label('Compare at price').numeric().prefix('$').minValue(0).maxValue(99999999.99),
                        ])
                        .action(async ({ record, data }) => { await ProductResource.adapter.update(record.id, { price: data.price, old_price: data.old_price ?? null }); }),
                    Action.make('adjust_stock').icon('m-cube-transparent').color('info')
                        .modalWidth('md').modalSubmitActionLabel('Save')
                        .fillForm(({ record }) => ({ qty: record.qty }))
                        .schema(() => [TextInput.make('qty').label('Quantity').integer().required()])
                        .action(async ({ record, data }) => { await ProductResource.adapter.update(record.id, { qty: data.qty }); }),
                    Action.make('delete').label('Delete').icon('m-trash').color('danger').keyBindings(['mod+d'])
                        .requiresConfirmation().modalIcon('o-trash')
                        .modalHeading(({ record }) => `Delete ${record.name}`).modalSubmitActionLabel('Delete')
                        .action(cheeky),
                ]),
            ])
            .groupedBulkActions([
                Action.make('toggle_visibility').icon('m-eye').color('gray')
                    .schema(() => [ToggleButtons.make('is_visible').label('Visibility').options([['1', 'Visible'], ['0', 'Hidden']]).inline().required()])
                    .action(async ({ livewire, data }) => {
                        // La sélection est ramenée par l'hôte aux enregistrements de la table.
                        for (const key of await livewire.getSelectedRecordKeys()) await ProductResource.adapter.update(key, { is_visible: String(data.is_visible) === '1' });
                        livewire.deselectAllTableRecords();
                    }),
                Action.make('delete').label('Delete selected').color('danger').icon('m-trash')
                    .requiresConfirmation().modalIcon('o-trash').modalHeading('Delete selected products').modalSubmitActionLabel('Delete')
                    .action(cheeky),
            ]);
    }
}
