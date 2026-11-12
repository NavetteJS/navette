// Équivalent de App\Filament\Resources\Shop\Categories\CategoryResource + Tables\CategoriesTable + Schemas\CategoryForm de la démo Filament.
// Écart : l'action d'en-tête « Import » (imports en file d'attente) n'est pas portée.
import { Action } from '@navette/actions';
import { Model, ObjectionAdapter, type DataAdapter } from '@navette/database';
import { RichEditor, Select, TextInput, Toggle } from '@navette/forms';
import { TextEntry } from '@navette/infolists';
import { CreateAction, DeleteAction, DeleteBulkAction, Notification, RelationManager, Resource } from '@navette/panels';
import { Grid, Section, type Schema } from '@navette/schemas';
import { diffForHumans } from '@navette/support/i18n';
import { IconColumn, TextColumn, type Table } from '@navette/tables';
import { ProductResource } from './ProductResource.ts';

export class ProductCategory extends Model {
    static tableName = 'product_categories';
    id!: number;
    parent_id!: number | null;
    parent_name?: string | null;
    name!: string;
    slug!: string;
    description!: string | null;
    is_visible!: number | boolean;
    created_at!: string;
    updated_at!: string;
    $beforeInsert(): void { this.created_at = this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $beforeUpdate(): void { this.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' '); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        if (typeof out.is_visible === 'boolean') out.is_visible = out.is_visible ? 1 : 0;
        delete out.parent_name;
        return out;
    }
}

const slugify = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
const like = (search: string) => `%${search.toLowerCase().replace(/[%_]/g, '')}%`;
/** Catégories de premier niveau : `relationship('parent', 'name', fn ($query) => $query->where('parent_id', null))`. */
const parents = () => ProductCategory.knex()('product_categories').whereNull('parent_id');

/** Le nom de la catégorie parente (`parent.name`) est lu par une sous-requête, pour être triable et cherchable. */
class Categories extends ObjectionAdapter<ProductCategory> {
    constructor() {
        super(ProductCategory, {
            modify: (query) => {
                query.select('product_categories.*', ProductCategory.knex()('product_categories as parents').select('parents.name').whereRaw('parents.id = product_categories.parent_id').as('parent_name'));
            },
        });
    }
}

/** Équivalent de RelationManagers\ProductsRelationManager : la table et le formulaire des produits, restreints à la catégorie. */
export class CategoryProductsRelationManager extends RelationManager {
    static relationship = 'products';
    static modelLabel = 'product';
    static recordTitleAttribute = 'name';
    static adapterFor(ownerKey: string): DataAdapter { return ProductResource.adapterForCategory(ownerKey); }
    static form(schema: Schema): Schema { return ProductResource.form(schema); }
    static table(table: Table): Table {
        return ProductResource.table(table)
            .headerActions([CreateAction.make()])
            .recordActions([DeleteAction.make()])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}

export class CategoryResource extends Resource {
    static slug = 'shop/categories';
    static modelLabel = 'product category';
    static navigationLabel = 'Product Categories';
    static navigationIcon = 'o-tag';
    static navigationGroup = 'Shop';
    static navigationSort = 4;
    static recordTitleAttribute = 'name';
    static globalSearchSort = 9;
    static adapter = new Categories();
    static relations = [CategoryProductsRelationManager];

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
                        Select.make('parent_id').label('Parent').searchable().placeholder('Select parent category')
                            .getSearchResultsUsing(async (search) => (await parents().whereRaw('lower(name) like ?', [like(search)]).orderBy('name').limit(50).select('id', 'name')).map((row: any): [string, string] => [String(row.id), row.name]))
                            .getOptionLabelUsing(async (value) => (await ProductCategory.knex()('product_categories').where({ id: value }).first('name'))?.name ?? null),
                        Toggle.make('is_visible').label('Visibility').default(true),
                        RichEditor.make('description'),
                    ])
                    .columnSpan({ lg: ({ record }) => (record === null ? 3 : 2) }),
                Section.make()
                    .schema([
                        TextEntry.make('created_at').state(({ record }) => diffForHumans((record as ProductCategory).created_at)),
                        TextEntry.make('updated_at').label('Last modified at').state(({ record }) => diffForHumans((record as ProductCategory).updated_at)),
                    ])
                    .columnSpan({ lg: 1 })
                    .hidden(({ record }) => record === null),
            ])
            .columns(3);
    }

    static table(table: Table<ProductCategory>): Table<ProductCategory> {
        return table
            .columns([
                TextColumn.make<ProductCategory>('name').searchable().sortable().weight('medium'),
                TextColumn.make<ProductCategory>('parent.name').getStateUsing(({ record }) => record.parent_name ?? null)
                    .searchable({ column: 'parent_name' }).sortable({ column: 'parent_name' }).toggleable(),
                IconColumn.make<ProductCategory>('is_visible').label('Visibility').boolean().sortable(),
                TextColumn.make<ProductCategory>('updated_at').label('Last modified at').date().sortable().toggleable(true, { isToggledHiddenByDefault: true }),
            ])
            .defaultSort('name')
            .recordActions([
                Action.make('toggle_visibility').icon('c-eye').color('gray')
                    .label(({ record }) => ((record as ProductCategory).is_visible ? 'Hide' : 'Show'))
                    .action(async ({ record }) => { await CategoryResource.adapter.update(record.id, { is_visible: !record.is_visible }); }),
                Action.make('edit').label('Edit').icon('c-pencil-square').color('primary').url(({ record }) => CategoryResource.getUrl('edit', (record as ProductCategory).id)),
            ])
            .groupedBulkActions([DeleteBulkAction.make().action(cheeky)]);
    }
}
