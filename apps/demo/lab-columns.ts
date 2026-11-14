// `/lab/columns-lab`: column, filter and selection options of the demo's products (Filament's column URL in a new tab, header
// tooltips, column groups, extra cell attributes, number and money locales, select columns searched on the server, filter
// labels from records, `excludeWhenResolvingRecord()`, the remove-all filters action, `selectable()` with an action using
// `accessSelectedRecords()`, and record actions modified with `modifyUngroupedRecordActionsUsing()`).
// Reached by URL only (not in the navigation, which other specs compare item by item). Left out with NAVETTE_NO_THEMES.
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { Notification, Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { ColumnGroup, Filter, Range, SelectColumn, SelectFilter, Sum, TextColumn, type Table } from '@navette-js/tables';

class LabColumnBrand extends Model { static tableName = 'brands'; }
export class LabColumnProduct extends Model {
    static tableName = 'products';
    id!: number;
    name!: string;
    slug!: string;
    sku!: string | null;
    description!: string | null;
    qty!: number;
    price!: number | null;
    brand_id!: number | null;
    published_at!: string | null;
    static get relationMappings() {
        return { brand: { relation: Model.BelongsToOneRelation, modelClass: LabColumnBrand, join: { from: 'products.brand_id', to: 'brands.id' } } };
    }
}

export class LabColumns extends Resource {
    static slug = 'columns-lab';
    static modelLabel = 'product';
    static navigationLabel = 'Columns lab';
    static shouldRegisterNavigation = false;
    static adapter = new ObjectionAdapter(LabColumnProduct);

    static form(schema: Schema): Schema { return schema.components([TextInput.make('name').required().maxLength(255)]); }

    static table(table: Table<LabColumnProduct>): Table<LabColumnProduct> {
        return table
            .columns([
                TextColumn.make('name').searchable().headerTooltip('Name shown in the shop')
                    .url((record) => `https://example.com/products/${encodeURIComponent(record.slug)}`, true)
                    .summarize(Range.make().label('Names').minimalTextualDifference()),
                ColumnGroup.make<LabColumnProduct>('Stock', [
                    TextColumn.make('sku').label('SKU').extraCellAttributes({ 'data-cy': 'sku-cell' }).verticallyAlignStart(),
                    TextColumn.make('qty').label('Quantity').numeric({ locale: 'fr' }).alignEnd(),
                ]).alignment('center').wrapHeader().extraHeaderAttributes({ 'data-cy': 'stock-group' }),
                TextColumn.make('price').money('eur', 0, 'fr').summarize(Sum.make().money('eur', 0, 'fr')),
                TextColumn.make('published_at').label('Published').since().isoDateTimeTooltip().disabledClick(),
                TextColumn.make('description').limit(24, ' […]').extraAttributes({ 'data-cy': 'description' }).toggleable(),
                SelectColumn.make<LabColumnProduct>('brand_id').label('Brand').optionsRelationship('brand', 'name').searchableOptions().optionsSearchDebounce(200).optionsSearchPrompt('Type a brand name'),
            ])
            .filters([
                SelectFilter.make('brand').relationship('brand', 'name').getOptionLabelFromRecordUsing((brand) => `${brand.name} (#${brand.id})`),
                Filter.make('in_stock').label('In stock').query((query: any) => query.where('qty', '>', 0)).excludeWhenResolvingRecord(),
            ])
            .filtersRemoveAllAction((action) => action.button().label('Clear filters'))
            // The selection survives searches and filters.
            .deselectAllRecordsWhenFiltered(false)
            // Checkboxes without bulk actions (none instead of the default "Delete selected"), for the toolbar action below.
            .groupedBulkActions([])
            .selectable()
            .toolbarActions([
                Action.make('checkStock').label('Check stock').color('gray').accessSelectedRecords()
                    .successNotificationTitle('Every selected product is in stock')
                    .failureNotificationTitle((success, total) => `${success} of ${total} products in stock`)
                    .action(async ({ action }) => {
                        for (const product of await action!.getSelectedRecords()) if (Number(product.qty) <= 0) action!.reportBulkProcessingFailure('out_of_stock', (count) => `${count} product${count > 1 ? 's are' : ' is'} out of stock.`);
                    }),
            ])
            .modifyUngroupedRecordActionsUsing((action) => action.iconButton())
            .recordActions([
                Action.make('restock').label('Restock').icon('m-plus').action(async ({ record }) => {
                    await LabColumns.adapter.update(LabColumns.adapter.getKey(record), { qty: Number((record as any).qty) + 10 });
                    Notification.make().success().title(`${(record as any).name} restocked`).send();
                }),
            ])
            .defaultSort('id');
    }
}
