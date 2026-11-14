// `/lab/relations`: relationship columns (dot notation) and relationship aggregates on orders, in a table, an infolist and
// an export. Left out of the navigation and of the parity screenshots (NAVETTE_NO_THEMES): it is reached by its URL.
import { Model, ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import { ExportAction, ExportColumn, Exporter, Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { IconColumn, Sum, TextColumn, TextInputColumn, type Table } from '@navette-js/tables';

class LabRelationCustomer extends Model { static tableName = 'customers'; }
class LabRelationProduct extends Model { static tableName = 'products'; }
class LabRelationPayment extends Model { static tableName = 'payments'; }
class LabRelationItem extends Model {
    static tableName = 'order_items';
    static get relationMappings() {
        return { product: { relation: Model.BelongsToOneRelation, modelClass: LabRelationProduct, join: { from: 'order_items.product_id', to: 'products.id' } } };
    }
}
export class LabRelationOrder extends Model {
    static tableName = 'orders';
    id!: number;
    number!: string;
    static get relationMappings() {
        return {
            customer: { relation: Model.BelongsToOneRelation, modelClass: LabRelationCustomer, join: { from: 'orders.customer_id', to: 'customers.id' } },
            items: { relation: Model.HasManyRelation, modelClass: LabRelationItem, join: { from: 'orders.id', to: 'order_items.order_id' } },
            payments: { relation: Model.HasManyRelation, modelClass: LabRelationPayment, join: { from: 'orders.id', to: 'payments.order_id' } },
        };
    }
}

class LabRelationOrderExporter extends Exporter {
    static getColumns(): ExportColumn[] {
        return [
            ExportColumn.make('number'),
            ExportColumn.make('customer.name').label('Customer'),
            ExportColumn.make('items_count').counts('items').label('Items'),
            ExportColumn.make('items_sum_qty').sum('items', 'qty').label('Quantity'),
            ExportColumn.make('payments_exists').exists('payments').label('Paid'),
        ];
    }
}

export class LabRelations extends Resource {
    static slug = 'relations';
    static modelLabel = 'order';
    static navigationLabel = 'Relations lab';
    static shouldRegisterNavigation = false;
    static recordTitleAttribute = 'number';
    static hasViewPage = true;
    static adapter = new ObjectionAdapter(LabRelationOrder, { softDeletes: 'deleted_at' });

    static form(schema: Schema): Schema {
        return schema.components([TextInput.make('number').required().maxLength(32)]);
    }

    static infolist(schema: Schema): Schema {
        return schema.columns(2).components([
            TextEntry.make('number'),
            TextEntry.make('customer.name').label('Customer'),
            TextEntry.make('customer.email').label('Customer email'),
            TextEntry.make('items.product.name').label('Products').badge(),
            TextEntry.make('items_count').counts('items').label('Items'),
            TextEntry.make('items_sum_qty').sum('items', 'qty').label('Quantity'),
            TextEntry.make('payments_max_amount').max('payments', 'amount').label('Largest payment').money('usd'),
            TextEntry.make('payments_min_amount').min('payments', 'amount').label('Smallest payment').money('usd'),
            TextEntry.make('items_avg_unit_price').avg('items', 'unit_price').label('Average unit price').money('usd'),
        ]);
    }

    static table(table: Table<LabRelationOrder>): Table<LabRelationOrder> {
        return table
            .columns([
                TextColumn.make('number').searchable(),
                TextColumn.make('customer.name').label('Customer').searchable({ isIndividual: true }).sortable(),
                TextInputColumn.make('customer.phone').label('Customer phone').rules(['max:32']),
                TextColumn.make('items_count').counts('items').label('Items').sortable().summarize(Sum.make().label('Items')),
                TextColumn.make('items_sum_qty').sum('items', 'qty').label('Quantity').sortable(),
                IconColumn.make('payments_exists').exists('payments').label('Paid').boolean(),
                TextColumn.make('large_payments_count').counts({ 'payments as large_payments_count': (query) => query.where('amount', '>=', 1000) }).label('Large payments'),
            ])
            .defaultSort('number', 'asc')
            .headerActions([ExportAction.make().exporter(LabRelationOrderExporter)]);
    }
}
