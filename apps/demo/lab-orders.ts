// `/lab` orders: an enum (`defineEnum()`) cast on the model, displayed by columns and entries, used for field and filter
// options and table groups.
import { Model, ObjectionAdapter } from '@navette-js/database';
import { Radio, TextInput, ToggleButtons } from '@navette-js/forms';
import { IconEntry, TextEntry } from '@navette-js/infolists';
import { Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { defineEnum, type EnumValue } from '@navette-js/support';
import { Group, IconColumn, SelectFilter, TextColumn, type Table } from '@navette-js/tables';

export const OrderStatus = defineEnum({
    new: { label: 'New', color: 'info', icon: 'm-sparkles', description: 'Placed by the customer, not handled yet.' },
    processing: { label: 'Processing', color: 'warning', icon: 'm-arrow-path', description: 'Being prepared in the warehouse.' },
    shipped: { label: 'Shipped', color: 'success', icon: 'm-truck', description: 'Handed over to the carrier.' },
    delivered: { label: 'Delivered', color: 'success', icon: 'm-check-badge', description: 'Received by the customer.' },
    cancelled: { label: 'Cancelled', color: 'danger', icon: 'm-x-circle', description: 'Will not be shipped.' },
});
export type OrderStatus = EnumValue<typeof OrderStatus>;

export class LabOrder extends Model {
    static tableName = 'orders';
    // The status column is displayed through the enum by every column and entry reading it.
    static casts = { status: OrderStatus };
    id!: number;
    number!: string;
    status!: OrderStatus;
    total_price!: number | null;
    created_at!: string | null;
}

export class LabOrders extends Resource {
    static slug = 'orders';
    static modelLabel = 'order';
    static navigationIcon = 'o-shopping-bag';
    static navigationLabel = 'Orders lab';
    static navigationGroup = 'Tables';
    static recordTitleAttribute = 'number';
    static hasViewPage = true;
    static adapter = new ObjectionAdapter(LabOrder);

    static form(schema: Schema): Schema {
        return schema.columns(2).components([
            TextInput.make('number').required().maxLength(32),
            ToggleButtons.make('status').options(OrderStatus).inline().required(),
            Radio.make('status_preview').label('Status descriptions').options(OrderStatus).dehydrated(false).columnSpanFull(),
        ]);
    }

    static infolist(schema: Schema): Schema {
        return schema.columns(2).components([
            TextEntry.make('number'),
            TextEntry.make('status').badge(),
            IconEntry.make('status').label('Status icon'),
            TextEntry.make('total_price').money('usd'),
        ]);
    }

    static table(table: Table<LabOrder>): Table<LabOrder> {
        return table
            .columns([
                TextColumn.make('number').searchable().sortable(),
                TextColumn.make('status').badge(),
                IconColumn.make('status').label('Icon'),
                TextColumn.make('total_price').money('usd').sortable(),
            ])
            .filters([SelectFilter.make('status').options(OrderStatus)])
            .groups([Group.make('status')])
            .defaultSort('id', 'desc');
    }
}
