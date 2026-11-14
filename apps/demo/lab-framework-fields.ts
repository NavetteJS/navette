// `/lab` "Framework fields": a field and a schema component rendered by Vue components (`JsField`, `JsComponent`).
// The renderers are ES modules in `public/js/lab`, importing the vendored Vue runtime build from `public/vendor/vue`.
import { Model, ObjectionAdapter } from '@navette-js/database';
import { JsField, TextInput } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import { JsComponent, Section } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

class LabStockProduct extends Model { static tableName = 'products'; }

const MAX_QUANTITY = 1000;
const SECURITY_STOCK = 10;
const toQuantity = (value: unknown): number | null => (value === null || value === undefined || value === '' ? null : Number(value));

export class LabFrameworkFields extends Resource {
    static slug = 'framework-fields';
    static modelLabel = 'product';
    static navigationIcon = 'o-puzzle-piece';
    static navigationLabel = 'Framework fields';
    static navigationGroup = 'Forms';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(LabStockProduct);

    static form(schema: any) {
        return schema.components([
            Section.make('Stock').schema([
                TextInput.make('name').required(),
                // The control is a Vue component: it receives the state and calls `onChange()`; the value is saved with the form.
                JsField.make('qty')
                    .label('Quantity')
                    .renderer('/js/lab/quantity-stepper.js')
                    .rendererConfiguration({ min: 0, max: MAX_QUANTITY, step: 1 })
                    .required()
                    .helperText(`Between 0 and ${MAX_QUANTITY}.`)
                    .live({ debounce: 300 })
                    .rule({ name: 'integer', passes: (value) => Number.isInteger(toQuantity(value)), message: (attribute) => `The ${attribute} field must be an integer.` })
                    .rule({ name: 'between', passes: (value) => (toQuantity(value) ?? -1) >= 0 && (toQuantity(value) ?? -1) <= MAX_QUANTITY, message: (attribute) => `The ${attribute} field must be between 0 and ${MAX_QUANTITY}.` }),
                // A schema component rendered by Vue, configured on the server from the form state (updated after each render).
                JsComponent.make()
                    .key('stockGauge')
                    .renderer('/js/lab/stock-gauge.js')
                    .rendererConfiguration(({ get }) => ({ qty: toQuantity(get('qty')), securityStock: SECURITY_STOCK, max: MAX_QUANTITY })),
            ]),
        ]);
    }

    static table(table: Table<any>): Table<any> {
        return table.columns([TextColumn.make('name').searchable(), TextColumn.make('qty').label('Quantity').numeric()]);
    }
}
