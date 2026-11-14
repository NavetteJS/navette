// `/lab` "Repeater options": repeater and builder relationship hooks, table mode options, sibling options, lazy items, exercised by
// e2e/repeater-options.e2e.mjs. Not in the parity screenshots (registered only without NAVETTE_NO_THEMES).
import { Model, ObjectionAdapter } from '@navette-js/database';
import { Radio, Repeater, Select, TableColumn, TextInput, Toggle } from '@navette-js/forms';
import { Block, Builder } from '@navette-js/forms/builder';
import { Resource } from '@navette-js/panels';
import { Schema, Section } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

class LabRepeaterProduct extends Model { static tableName = 'products'; }
class LabRepeaterItem extends Model { static tableName = 'order_items'; }
class LabRepeaterOrder extends Model {
    static tableName = 'orders';
    static get relationMappings() {
        return { items: { relation: Model.HasManyRelation, modelClass: LabRepeaterItem, join: { from: 'orders.id', to: 'order_items.order_id' } } };
    }
}

/** Appends a line to the order's notes: the relationship hooks leave a trace the e2e spec reads back. */
const logOnOrder = async (record: any, line: string) => {
    const order = await LabRepeaterOrder.query().findById(record.order_id);
    if (order) await LabRepeaterOrder.query().findById(record.order_id).patch({ notes: `${(order as any).notes ?? ''}\n${line}`.trim() } as any);
};

export class LabRepeaterOptions extends Resource {
    static slug = 'repeater-options';
    static modelLabel = 'order';
    static navigationIcon = 'o-queue-list';
    static navigationLabel = 'Repeater options';
    static navigationGroup = 'Forms';
    static recordTitleAttribute = 'number';
    static adapter = new ObjectionAdapter(LabRepeaterOrder);

    static form(schema: any) {
        return schema.components([
            TextInput.make('number').required(),
            Section.make('Order lines').schema([
                // A table repeater on a has-many relationship, with header options and hooks around each saved line.
                Repeater.make('items')
                    .hiddenLabel()
                    .relationship('items')
                    .orderColumn('sort')
                    .compact()
                    .table([
                        TableColumn.make('Product').markAsRequired(),
                        TableColumn.make('Quantity of this product in the order').wrapHeader().alignment('end').width(140),
                        TableColumn.make('Unit price').hiddenHeaderLabel().width(160),
                    ])
                    .schema([
                        Select.make('product_id')
                            .label('Product')
                            .options(async () => Object.fromEntries((await LabRepeaterProduct.query().select('id', 'name').orderBy('name')).map((product: any) => [String(product.id), product.name])))
                            .required()
                            .disableOptionsWhenSelectedInSiblingRepeaterItems(),
                        TextInput.make('qty').label('Quantity').integer().minValue(1).required(),
                        TextInput.make('unit_price').label('Unit price').numeric().prefix('$'),
                    ])
                    .mutateRelationshipDataBeforeFillUsing(({ data }) => ({ ...data, unit_price: data.unit_price === null ? null : Number(data.unit_price).toFixed(2) }))
                    // A new line without a price takes the product's price.
                    .mutateRelationshipDataBeforeCreateUsing(async ({ data }) => {
                        if (data.unit_price !== null && data.unit_price !== undefined && data.unit_price !== '') return data;
                        const product: any = await LabRepeaterProduct.query().findById(Number(data.product_id));
                        return { ...data, unit_price: product?.price ?? 0 };
                    })
                    .mutateRelationshipDataBeforeSaveUsing(({ data }) => ({ ...data, unit_price: Math.round(Number(data.unit_price ?? 0) * 100) / 100 }))
                    .afterCreate(({ record }) => logOnOrder(record, `line created: product ${record.product_id}`))
                    .afterUpdate(({ record }) => logOnOrder(record, `line updated: ${record.id} x${record.qty}`))
                    .afterDelete(({ record }) => logOnOrder(record, `line deleted: ${record.id}`)),
            ]),
            Section.make('Reviewers').description('Not saved: collapsed items, loaded lazily, with one lead and one role per reviewer.').schema([
                Repeater.make('reviewers')
                    .dehydrated(false)
                    .loadStateFromRelationshipsUsing(() => [
                        { name: 'Ada', is_lead: true, role: 'author' },
                        { name: 'Bob', is_lead: false, role: 'editor' },
                        { name: 'Cy', is_lead: false, role: null },
                    ])
                    .itemLabel(({ state }) => (state.name as string) || null)
                    .collapsed()
                    .schema(Schema.make().components([
                        TextInput.make('name'),
                        Toggle.make('is_lead').label('Lead').fixIndistinctState(),
                        Radio.make('role').options({ author: 'Author', editor: 'Editor', proofreader: 'Proofreader' }).inline().disableOptionsWhenSelectedInSiblingRepeaterItems(),
                    ]).lazyLoaded()),
                Builder.make('blocks')
                    .dehydrated(false)
                    .loadStateFromRelationshipsUsing(() => [{ type: 'note', data: { text: 'Lazy block' } }])
                    .blocks([Block.make('note').schema(Schema.make().components([TextInput.make('text')]).lazyLoaded())]),
            ]),
        ]);
    }

    static table(table: Table<any>): Table<any> {
        return table.columns([TextColumn.make('number').searchable()]);
    }
}
