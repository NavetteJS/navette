// `/lab` relationship actions: a product's categories (many-to-many: attach with a preloaded multiple select, or from a
// table; detach in one query) and a brand's products (one-to-many: associate several products, dissociate). The options are
// scoped with `recordSelectOptionsQuery()`, which the server also checks on submit. Not in the navigation; reached from the
// URLs `/lab/relation-products/{id}/edit` and `/lab/relation-brands/{id}/edit`, used by e2e/prebuilt-actions.e2e.mjs.
import { Model, ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { AssociateAction, AttachAction, CreateAction, DetachAction, DetachBulkAction, DissociateAction, DissociateBulkAction, EditAction, ListRecords, RelationManager, Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

class RelationLabCategory extends Model { static tableName = 'product_categories'; declare id: number; declare name: string; declare slug: string; declare is_visible: number; }
class RelationLabProduct extends Model { static tableName = 'products'; declare id: number; declare name: string; declare sku: string | null; declare brand_id: number | null; declare is_visible: number; }
class RelationLabBrand extends Model { static tableName = 'brands'; declare id: number; declare name: string; }

/** List pages left out of the navigation. */
class HiddenProductsList extends ListRecords { static shouldRegisterNavigation = false; }
class HiddenBrandsList extends ListRecords { static shouldRegisterNavigation = false; }

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const pivotOf = (product: string) => RelationLabCategory.knex()('product_category_product').select('product_category_id').where('product_id', product);

/** Table of the "Attach from table" modal: its filters only change what is shown. */
const CategoriesTable = {
    name: 'lab-relation-categories',
    configure: (table: Table) => table.columns([TextColumn.make('name').searchable(), TextColumn.make('slug')]).defaultSort('name').paginated([5, 10]),
};

export class ProductCategoriesRelationManager extends RelationManager {
    static relationship = 'categories';
    static modelLabel = 'category';
    static recordTitleAttribute = 'name';
    static adapterFor(ownerKey: string): DataAdapter { return new ObjectionAdapter(RelationLabCategory, { modify: (query) => { query.whereIn('product_categories.id', pivotOf(ownerKey)); } }); }
    /** Every category: the attach options and checks (`searchAttachable()`, `attachableLabel()`) come from it. */
    static relatedAdapter(): DataAdapter { return new ObjectionAdapter(RelationLabCategory); }
    static async attach(ownerKey: string, recordKey: string): Promise<void> {
        await RelationLabCategory.knex()('product_category_product').insert({ product_id: ownerKey, product_category_id: recordKey, created_at: now(), updated_at: now() });
    }
    static async detach(ownerKey: string, recordKeys: string[]): Promise<void> {
        await RelationLabCategory.knex()('product_category_product').where('product_id', ownerKey).whereIn('product_category_id', recordKeys).delete();
    }
    static table(table: Table): Table {
        return table
            .columns([TextColumn.make('name'), TextColumn.make('slug')])
            .defaultSort('name')
            .headerActions([
                // Only visible categories can be attached, several at once; the first options are loaded with the modal.
                AttachAction.make().multiple().preloadRecordSelect().attachAnother(false)
                    .recordSelectSearchColumns(['name', 'slug'])
                    .recordSelectOptionsQuery((query) => query.where('product_categories.is_visible', 1))
                    .recordSelect((select) => select.placeholder('Search visible categories')),
                AttachAction.make('attachFromTable').label('Attach from table').multiple().tableSelect(CategoriesTable)
                    .recordSelectOptionsQuery((query) => query.where('product_categories.is_visible', 1)),
            ])
            .recordActions([DetachAction.make()])
            .groupedBulkActions([DetachBulkAction.make().fetchSelectedRecords(false)]);
    }
}

export class LabRelationProducts extends Resource {
    static slug = 'relation-products';
    static modelLabel = 'product';
    static recordTitleAttribute = 'name';
    static pages = { index: HiddenProductsList };
    static adapter = new ObjectionAdapter(RelationLabProduct);
    static relations = [ProductCategoriesRelationManager];
    static form(schema: Schema): Schema { return schema.components([TextInput.make('name').required()]); }
    static table(table: Table): Table { return table.columns([TextColumn.make('name').searchable()]).recordActions([EditAction.make()]); }
}

export class BrandProductsRelationManager extends RelationManager {
    static relationship = 'products';
    static modelLabel = 'product';
    static recordTitleAttribute = 'name';
    static adapterFor(ownerKey: string): DataAdapter {
        const adapter = new ObjectionAdapter(RelationLabProduct, { modify: (query) => { query.where('products.brand_id', ownerKey); } });
        // A product created here belongs to the brand.
        const create = adapter.create.bind(adapter);
        adapter.create = (data) => create({ ...data, brand_id: ownerKey, slug: String(data.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), created_at: now(), updated_at: now() });
        return adapter;
    }
    /** Every product: the associate options and checks come from it. */
    static relatedAdapter(): DataAdapter { return new ObjectionAdapter(RelationLabProduct); }
    static async associate(ownerKey: string, recordKey: string): Promise<void> { await RelationLabProduct.query().patch({ brand_id: Number(ownerKey) } as any).where('id', recordKey); }
    static async dissociate(ownerKey: string, recordKeys: string[]): Promise<void> { await RelationLabProduct.query().patch({ brand_id: null } as any).where('brand_id', ownerKey).whereIn('id', recordKeys); }
    static form(schema: Schema): Schema { return schema.components([TextInput.make('name').required()]); }
    static table(table: Table): Table {
        return table
            .columns([TextColumn.make('name'), TextColumn.make('sku')])
            .defaultSort('name')
            .headerActions([
                // Visible products only, searched by name or SKU.
                AssociateAction.make().multiple().recordSelectSearchColumns(['name', 'sku'])
                    .recordSelectOptionsQuery((query) => query.where('products.is_visible', 1)),
                CreateAction.make().createAnotherAction((action) => action.label('Create & add another product')),
            ])
            .recordActions([DissociateAction.make()])
            .groupedBulkActions([DissociateBulkAction.make()]);
    }
}

export class LabRelationBrands extends Resource {
    static slug = 'relation-brands';
    static modelLabel = 'brand';
    static recordTitleAttribute = 'name';
    static pages = { index: HiddenBrandsList };
    static adapter = new ObjectionAdapter(RelationLabBrand);
    static relations = [BrandProductsRelationManager];
    static form(schema: Schema): Schema { return schema.components([TextInput.make('name').required()]); }
    static table(table: Table): Table { return table.columns([TextColumn.make('name').searchable()]).recordActions([EditAction.make()]); }
}
