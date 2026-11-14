// `/lab` panel: the example plugins of `examples/` (a panel plugin and a standalone component) and a configurable resource,
// registered twice with different options.
import { Model, ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { Resource, ResourceConfiguration, type Panel, type Plugin } from '@navette-js/panels';
import { TextColumn, type Table } from '@navette-js/tables';
import { ClockPage, ClockWidgetPlugin } from '../../examples/clock-widget/src/index.ts';
import { Heading, headingsStylesheet } from '../../examples/headings/src/index.ts';

class StockProduct extends Model {
    static tableName = 'products';
    id!: number;
    name!: string;
    qty!: number;
}

/** Options of a stock list: which products it lists. */
export class StockResourceConfiguration extends ResourceConfiguration {
    protected _lowStock = false;

    lowStock(condition = true): this {
        this._lowStock = condition;
        return this;
    }

    isLowStock(): boolean {
        return this._lowStock;
    }
}

/** Products and their stock. Registered as `StockResource.make('all')` and `StockResource.make('low').lowStock()`. */
export class StockResource extends Resource {
    static configurationClass = StockResourceConfiguration;
    static slug = 'stock';
    static modelLabel = 'stock item';
    static navigationIcon = 'o-archive-box';
    static navigationGroup = 'Plugins';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(StockProduct);

    static form(schema: any) {
        return schema.components([
            Heading.make(3).content(() => (this.getConfiguration()?.isLowStock() ? 'Low stock product' : 'Product')).color(this.getConfiguration()?.isLowStock() ? 'warning' : 'primary'),
            TextInput.make('name').required(),
            TextInput.make('qty').label('Quantity').integer().required(),
        ]);
    }

    static table(table: Table<StockProduct>): Table<StockProduct> {
        const lowStock = this.getConfiguration()?.isLowStock() ?? false;
        return table
            .columns([TextColumn.make('name').searchable(), TextColumn.make('qty').label('Quantity').numeric().sortable()])
            .modifyQueryUsing((query) => (lowStock ? query.where('qty', '<', 10) : query))
            .defaultSort('qty');
    }
}

/** Everything above, as one plugin of the application. */
export const labPluginExamples = (): Plugin => ({
    id: 'lab-plugin-examples',
    register(panel: Panel) {
        panel
            .plugin(ClockWidgetPlugin.make().timezone('Europe/Paris').navigationGroup('Plugins').clocks([
                ClockPage.make('tokyo').timezone('Asia/Tokyo').title('Tokyo').navigationSort(1),
                ClockPage.make('new-york').timezone('America/New_York').title('New York').slug('new-york-time').navigationSort(2),
            ]))
            .resources([
                StockResource.make('all').navigationLabel('Stock').navigationSort(3),
                StockResource.make('low').lowStock().navigationLabel('Low stock').navigationSort(4).slug('low-stock'),
            ])
            .renderHook('panels::styles.after', () => headingsStylesheet());
    },
});
