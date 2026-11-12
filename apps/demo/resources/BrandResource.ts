// Équivalent de App\Filament\Resources\Shop\Brands\BrandResource + Tables\BrandsTable + Schemas\BrandForm de la démo Filament.
// Écart : l'action d'en-tête « Export » (exports en file d'attente) n'est pas portée.
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { RichEditor, TextInput, Toggle } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import { CreateAction, DeleteAction, DeleteBulkAction, Notification, RelationManager, Resource } from '@navette-js/panels';
import { Grid, Section, type Schema } from '@navette-js/schemas';
import { diffForHumans } from '@navette-js/support/i18n';
import { IconColumn, TextColumn, type Table } from '@navette-js/tables';
import { AddressesRelationManager } from './CustomerResource.ts';
import { ProductResource } from './ProductResource.ts';

export class Brand extends Model {
    static tableName = 'brands';
    id!: number;
    name!: string;
    slug!: string;
    website!: string | null;
    description!: string | null;
    is_visible!: number | boolean;
    sort!: number | null;
    created_at!: string;
    updated_at!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.is_visible === 'boolean') out.is_visible = out.is_visible ? 1 : 0;
        return out;
    }
}

const BRAND_TYPE = 'App\\Models\\Shop\\Brand';
const slugify = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
/** Action « Visit website » : lien vers le site de la marque, masqué quand il n'y en a pas. */
const visitWebsite = (icon = 'm-arrow-top-right-on-square') => Action.make('visit_website').icon(icon).color('gray').tooltip('Open brand website')
    .url(({ record }) => (record as Brand | null)?.website ?? null).openUrlInNewTab()
    .hidden(({ record }) => !(record as Brand | null)?.website);

/** Équivalent de RelationManagers\ProductsRelationManager : la table et le formulaire des produits, restreints à la marque. */
export class BrandProductsRelationManager extends RelationManager {
    static relationship = 'products';
    static modelLabel = 'product';
    static recordTitleAttribute = 'name';
    static adapterFor(ownerKey: string): DataAdapter { return ProductResource.adapterForBrand(ownerKey); }
    static form(schema: Schema): Schema { return ProductResource.form(schema, { withBrand: false }); }
    static table(table: Table): Table {
        return ProductResource.table(table)
            .headerActions([CreateAction.make()])
            .recordActions([DeleteAction.make()])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}
/** Adresses de la marque : même relation polymorphe que pour les clients. */
export class BrandAddressesRelationManager extends AddressesRelationManager {
    static ownerType = BRAND_TYPE;
}

export class BrandResource extends Resource {
    static slug = 'shop/brands';
    static modelLabel = 'brand';
    static navigationIcon = 'o-bookmark-square';
    static navigationGroup = 'Shop';
    static navigationSort = 3;
    static recordTitleAttribute = 'name';
    static globalSearchSort = 8;
    static adapter = new ObjectionAdapter(Brand);
    static relations = [BrandProductsRelationManager, BrandAddressesRelationManager];
    /** Actions d'en-tête de la page d'édition (équivalent de EditBrand::getActions()). */
    static editHeaderActions = () => [visitWebsite()];

    static form(schema: Schema): Schema {
        return schema
            .components([
                Section.make()
                    .schema([
                        Grid.make().schema([
                            TextInput.make('name').required().maxLength(255).live({ onBlur: true })
                                .afterStateUpdated(({ operation, state, set }) => { if (operation === 'create') set('slug', slugify(String(state ?? ''))); }),
                            TextInput.make('slug').disabled().dehydrated().required().maxLength(255).unique({ ignoreRecord: true }),
                        ]),
                        TextInput.make('website').required().maxLength(255).url(),
                        Toggle.make('is_visible').label('Visibility').default(true),
                        RichEditor.make('description'),
                    ])
                    .columnSpan({ lg: ({ record }) => (record === null ? 3 : 2) }),
                Section.make()
                    .schema([
                        TextEntry.make('created_at').state(({ record }) => diffForHumans((record as Brand).created_at)),
                        TextEntry.make('updated_at').label('Last modified at').state(({ record }) => diffForHumans((record as Brand).updated_at)),
                    ])
                    .columnSpan({ lg: 1 })
                    .hidden(({ record }) => record === null),
            ])
            .columns(3);
    }

    static table(table: Table<Brand>): Table<Brand> {
        return table
            .columns([
                TextColumn.make<Brand>('name').searchable().sortable().weight('medium'),
                TextColumn.make<Brand>('website').searchable().sortable().toggleable(),
                IconColumn.make<Brand>('is_visible').label('Visibility').boolean().sortable(),
                TextColumn.make<Brand>('updated_at').label('Last modified at').date().sortable().toggleable(true, { isToggledHiddenByDefault: true }),
            ])
            .recordActions([
                visitWebsite('c-arrow-top-right-on-square'),
                Action.make('toggle_visibility')
                    .icon(({ record }) => ((record as Brand).is_visible ? 'c-eye-slash' : 'c-eye')).color('gray')
                    .tooltip(({ record }) => ((record as Brand).is_visible ? 'Hide brand' : 'Show brand'))
                    .action(async ({ record }) => { await BrandResource.adapter.update(record.id, { is_visible: !record.is_visible }); }),
                Action.make('edit').label('Edit').icon('c-pencil-square').color('primary').url(({ record }) => BrandResource.getUrl('edit', (record as Brand).id)),
            ])
            .groupedBulkActions([DeleteBulkAction.make().action(cheeky)])
            .defaultSort('sort')
            .reorderable('sort');
    }
}
