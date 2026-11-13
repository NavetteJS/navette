// `/lab` panel: a playground of recent features (tables, filters, actions, forms) on the demo's products.
// It is kept apart from `/admin`, whose pages are compared with Filament's demo.
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { Checkbox, ColorPicker, DatePicker, DateTimePicker, FileUpload, KeyValue, Radio, Repeater, Select, Step, TagsInput, Textarea, TextInput, Toggle, ToggleButtons } from '@navette-js/forms';
import {
    DeleteBulkAction, EditAction, NavigationGroup, ExportAction, ExportBulkAction, ExportColumn, Exporter, ImportAction, ImportColumn, Importer, Notification, Panel, Resource,
    ReplicateAction, Tab, type AuthProvider, type Login,
} from '@navette-js/panels';
import { Section } from '@navette-js/schemas';
import { Color } from '@navette-js/support';
import {
    BulkActionGroup, Count, Filter, Group, IconColumn, Indicator, NumberConstraint, Panel as TablePanel, QueryBuilder, SelectColumn, SelectFilter, Split, Stack, Sum,
    TernaryFilter, TextColumn, TextConstraint, ToggleColumn, type Table,
} from '@navette-js/tables';

class LabBrand extends Model { static tableName = 'brands'; }
export class LabProduct extends Model {
    static tableName = 'products';
    id!: number;
    name!: string;
    sku!: string | null;
    price!: number | null;
    qty!: number;
    featured!: number;
    is_visible!: number;
    brand_id!: number | null;
    static get relationMappings() {
        return { brand: { relation: Model.BelongsToOneRelation, modelClass: LabBrand, join: { from: 'products.brand_id', to: 'brands.id' } } };
    }
}

class LabProductExporter extends Exporter {
    static getColumns(): ExportColumn[] {
        return [ExportColumn.make('sku').label('SKU'), ExportColumn.make('name'), ExportColumn.make('price').formatStateUsing((price) => (price === null ? '' : Number(price).toFixed(2))), ExportColumn.make('qty').label('Quantity').enabledByDefault(false)];
    }
}
class LabProductImporter extends Importer {
    static getColumns(): ImportColumn[] {
        return [
            ImportColumn.make('name').requiredMapping().rules(['required', 'max:255']).example('Lab lamp'),
            ImportColumn.make('sku').label('SKU').rules(['required', 'max:32']).example('LAB-001'),
            ImportColumn.make('price').guess(['cost']).numeric().rules(['numeric']).example('19.90'),
        ];
    }
    static async resolveRecord(data: Record<string, unknown>) { return (await LabProduct.query().findOne({ sku: String(data.sku) })) ?? null; }
}

class LabProducts extends Resource {
    static slug = 'products';
    static modelLabel = 'product';
    static navigationIcon = 'o-beaker';
    static navigationLabel = 'Products lab';
    static navigationGroup = 'Tables';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(LabProduct);

    static tabs(): Record<string, Tab> {
        return {
            '': Tab.make('All').icon('m-squares-2x2'),
            visible: Tab.make('Visible').icon('m-eye').query((query) => { query.where('is_visible', 1); }),
            low: Tab.make('Low stock').icon('m-exclamation-triangle').iconPosition('after').query((query) => { query.where('qty', '<', 10); }).badge(async () => (await LabProduct.query().where('qty', '<', 10).resultSize())).badgeColor('warning'),
        };
    }

    static form(schema: any) {
        return schema.columns(2).components([
            TextInput.make('name').required().prefixIcon('m-cube').suffixAction(Action.make('uppercase').icon('m-arrow-up').action(({ state, set }) => set!('name', String(state ?? '').toUpperCase()))),
            TextInput.make('sku').label('SKU').copyable().trim().datalist(['LAB-001', 'LAB-002']),
            TextInput.make('price').numeric().prefix('$', true),
            Textarea.make('description').autosize().placeholder('A few words about the product'),
            Toggle.make('is_visible').label('Visible').onIcon('m-eye').offIcon('m-eye-slash').onColor('success'),
            Checkbox.make('featured').inline(false),
        ]);
    }

    static table(table: Table<LabProduct>): Table<LabProduct> {
        return table
            .columns([
                TextColumn.make('name').searchable().sortable().description((record: LabProduct) => record.sku ?? '')
                    .action(Action.make('quickLook').modalHeading((ctx: any) => ctx.record?.name ?? '').modalDescription((ctx: any) => `SKU ${ctx.record?.sku ?? '—'}, ${ctx.record?.qty ?? 0} in stock`).modalSubmitAction(false).action(() => {})),
                SelectColumn.make('brand_id').label('Brand').optionsRelationship('brand', 'name').searchableOptions(),
                TextColumn.make('price').money('usd').sortable().summarize([Sum.make().money('usd').label('Total'), Count.make().label('Over $100').query((query) => query.where('price', '>', 100))]),
                TextColumn.make('qty').label('Stock').numeric().visibleFrom('md').summarize(Sum.make().suffix(' items').hiddenLabel()),
                ToggleColumn.make('is_visible').label('Visible'),
                IconColumn.make('featured').boolean(),
            ])
            .filters([
                SelectFilter.make('brand').relationship('brand', 'name', null, true).multiple().searchable(),
                TernaryFilter.make('is_visible').label('Visibility').trueLabel('Visible').falseLabel('Hidden'),
                Filter.make('featured').toggle().query((query) => query.where('featured', 1)).indicator('Featured'),
                Filter.make('low_stock').label('Low stock').query((query) => query.where('qty', '<', 10))
                    .indicateUsing((data) => (data.isActive ? Indicator.make('Low stock').color('warning') : null)),
                QueryBuilder.make().constraintPickerColumns(2).constraints({ Text: [TextConstraint.make('name'), TextConstraint.make('sku').label('SKU')], Numbers: [NumberConstraint.make('price'), NumberConstraint.make('qty').integer()] }),
            ])
            .filtersLayout('above-content-collapsible')
            .filtersFormColumns(3)
            .persistFiltersInSession()
            .persistSearchInSession()
            .groups([Group.make('brand_id').label('Brand').getTitleFromRecordUsing((record: any) => (record.brand_id ? `Brand #${record.brand_id}` : 'No brand'))])
            .headerActions([
                ExportAction.make().exporter(LabProductExporter),
                ImportAction.make().importer(LabProductImporter),
                Action.make('createWizard').label('New product (wizard)').icon('m-sparkles')
                    .steps([
                        Step.make('Identity').schema([TextInput.make('name').required(), TextInput.make('sku').label('SKU').required()]),
                        Step.make('Price').schema([TextInput.make('price').numeric().required()]),
                    ])
                    .modalSubmitActionLabel('Create')
                    .action(async ({ data, action }) => {
                        await LabProducts.adapter.create({ name: data.name, sku: data.sku, price: data.price, slug: String(data.sku).toLowerCase() });
                        Notification.make().success().title('Product created').send();
                        void action;
                    }),
            ])
            .recordActions([
                ActionGroup.make([
                    ActionGroup.make([EditAction.make(), ReplicateAction.make().excludeAttributes(['slug', 'sku']).beforeReplicaSaved(({ replica }) => { replica.name = `${replica.name} (copy)`; })]).dropdown(false),
                    Action.make('restock').icon('m-plus-circle').color('success').requiresConfirmation().modalHidden(({ record }) => Number(record?.qty ?? 0) > 50)
                        .action(async ({ record }) => { await LabProducts.adapter.update(record.id, { qty: Number(record.qty) + 10 }); Notification.make().success().title('Restocked (+10)').send(); }),
                ]).label('More').button().size('sm').color('gray'),
            ])
            .recordActionsPosition('before-columns')
            .toolbarActions([
                BulkActionGroup.make([
                    ExportBulkAction.make().exporter(LabProductExporter),
                    DeleteBulkAction.make().authorizeIndividualRecords('delete'),
                ]),
            ])
            .checkIfRecordIsSelectableUsing((record) => Number(record.qty) >= 0)
            .maxSelectableRecords(25);
    }
}

/** A table shown as cards, to try the column layouts. */
class LabCards extends Resource {
    static slug = 'cards';
    static modelLabel = 'product';
    static pluralModelLabel = 'product cards';
    static navigationIcon = 'o-squares-2x2';
    static navigationLabel = 'Cards layout';
    static navigationGroup = 'Tables';
    static adapter = new ObjectionAdapter(LabProduct);
    static table(table: Table<LabProduct>): Table<LabProduct> {
        return table
            .columns([
                Split.make([
                    Stack.make([TextColumn.make('name').weight('bold').searchable(), TextColumn.make('sku').color('gray')]),
                    TextColumn.make('price').money('usd').grow(false),
                ]),
                TablePanel.make([Stack.make([TextColumn.make('qty').label('Stock').prefix('Stock: '), IconColumn.make('is_visible').boolean()])]).collapsible(),
            ])
            .contentGrid({ md: 2, xl: 3 })
            .paginationPageOptions([9, 18, 'all']);
    }
}

/** A form page with the new field options. */
class LabFields extends Resource {
    static slug = 'fields';
    static modelLabel = 'brand';
    static navigationIcon = 'o-pencil-square';
    static navigationLabel = 'Fields lab';
    static navigationGroup = 'Forms';
    static adapter = new ObjectionAdapter(LabBrand);
    static form(schema: any) {
        return schema.columns(2).components([
            Section.make('Text').schema([
                TextInput.make('name').required().prefixIcon('m-tag').suffix('.com', true),
                TextInput.make('slug').readOnly().copyable(),
            ]).columnSpanFull().columns(2),
            Section.make('Choices').schema([
                ToggleButtons.make('kind').options({ a: 'Apparel', b: 'Books', c: 'Coffee' }).multiple().icons({ a: 'm-shopping-bag', b: 'm-book-open', c: 'm-fire' }).tooltips({ c: 'Hot drinks' }).inline().dehydrated(false),
                Radio.make('tier').boolean('Premium', 'Standard').dehydrated(false),
                ColorPicker.make('color').rgb().dehydrated(false),
                TagsInput.make('tags').dehydrated(false),
                KeyValue.make('meta').addable(false).editableKeys(false).dehydrated(false),
            ]).columnSpanFull().columns(2),
            Section.make('Selects, dates and uploads').schema([
                Select.make('status').options({ 'In process': { draft: 'Draft', reviewing: 'Reviewing' }, Reviewed: { published: 'Published', rejected: 'Rejected' } }).native(false).dehydrated(false),
                Select.make('featured_brand').boolean('Featured', 'Regular').dehydrated(false),
                DatePicker.make('launch_date').native(false).displayFormat('d/m/Y').disabledDates(['2026-12-25']).closeOnDateSelection().dehydrated(false),
                DateTimePicker.make('launch_at').native(false).seconds(false).timezone('Europe/Paris').dehydrated(false),
                FileUpload.make('logo').avatar().imageEditor().imageEditorAspectRatioOptions(['1:1', '4:3', null]).dehydrated(false),
                FileUpload.make('gallery').multiple().image().panelLayout('grid').reorderable().imageDimensions({ minWidth: 200 }).dehydrated(false),
            ]).columnSpanFull().columns(2),
            Repeater.make('contacts').schema([TextInput.make('name').required(), TextInput.make('email').email()]).columns(2)
                .itemLabel(({ state }) => (state.name as string) || null).collapsible().cloneable().reorderableWithButtons().defaultItems(1).columnSpanFull().dehydrated(false),
            TextInput.make('website').url(),
        ]);
    }
    static table(table: Table<any>): Table<any> { return table.columns([TextColumn.make('name').searchable(), TextColumn.make('website')]); }
}

export function labPanel(options: { key: string; login: typeof Login; auth: AuthProvider; canAccess: (user: any) => boolean }): Panel {
    return Panel.make()
        .id('lab')
        .path('lab')
        .key(options.key)
        .brandName('Navette Lab')
        .setColors({ primary: Color.Violet })
        .login(options.login)
        .resources([LabProducts, LabCards, LabFields])
        .navigationGroups([NavigationGroup.make('Tables').icon('o-table-cells'), NavigationGroup.make('Forms').collapsible(false)])
        .defaultThemeMode('dark')
        .auth(options.auth)
        .canAccess(options.canAccess);
}
