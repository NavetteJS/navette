// `/lab` panel: a playground of extra features (tables, filters, actions, forms) on the demo's products.
// It is kept apart from `/admin`, whose pages are compared with reference screenshots.
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { Checkbox, CheckboxList, ColorPicker, DatePicker, DateTimePicker, FileUpload, KeyValue, ModalTableSelect, Radio, Repeater, Select, Step, TagsInput, Textarea, TextInput, Toggle, ToggleButtons } from '@navette-js/forms';
import {
    Cluster, DeleteBulkAction, EditAction, EditRecord, NavigationGroup, ExportAction, ExportBulkAction, ExportColumn, Exporter, ImportAction, ImportColumn, Importer, Notification, Panel, Resource,
    ReplicateAction, Tab, type AuthProvider, type Login,
} from '@navette-js/panels';
import { Livewire, Section } from '@navette-js/schemas';
import { Color, e } from '@navette-js/support';
import { Component as WireComponent } from '@navette-js/wire';
import { LabOrders } from './lab-orders.ts';
import { labTableFeatureResources } from './lab-table-features.ts';
import { LabColumns } from './lab-columns.ts';
import { LabBrandPages } from './lab-record-pages.ts';
import { labWidgets, LabWidgetsDashboard } from './widgets/lab.ts';
import { labJsWidgets, LabJsWidgetsDashboard } from './widgets/lab-orders-js-widget.ts';
import { LabTabsPage } from './lab-tabs.ts';
import { labPrivateFiles, LabUiPage } from './lab-ui.ts';
import { LabFrameworkFields } from './lab-framework-fields.ts';
import { LabSpecificFields } from './lab-specific-fields.ts';
import { LabRichEditorOptions } from './lab-rich-editor-options.ts';
import { LabComments } from './lab-morph-to-select.ts';
import { LabRepeaterOptions } from './lab-repeater-options.ts';
import { LabRelations } from './lab-relations.ts';
import { LabRelationBrands, LabRelationProducts } from './lab-prebuilt-actions.ts';
import { labPluginExamples } from './lab-plugins.ts';
import { LabActionsPage } from './lab-actions.ts';
import { LabWelcomePage } from './lab-welcome.ts';
import {
    BulkActionGroup, Count, Filter, Group, IconColumn, Indicator, NumberConstraint, Panel as TablePanel, QueryBuilder, SelectColumn, SelectFilter, Split, Stack, Sum,
    TernaryFilter, TextColumn, TextConstraint, ToggleColumn, type Table,
} from '@navette-js/tables';

class LabBrand extends Model { static tableName = 'brands'; }
class LabCategory extends Model { static tableName = 'product_categories'; }
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
        return {
            brand: { relation: Model.BelongsToOneRelation, modelClass: LabBrand, join: { from: 'products.brand_id', to: 'brands.id' } },
            categories: { relation: Model.ManyToManyRelation, modelClass: LabCategory, join: { from: 'products.id', through: { from: 'product_category_product.product_id', to: 'product_category_product.product_category_id' }, to: 'product_categories.id' } },
        };
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
    // Import option (left out of the parity screenshots): only update existing products, skipping the rows of unknown SKUs.
    static getOptionsFormComponents() { return process.env.NAVETTE_NO_THEMES ? [] : [Checkbox.make('updateOnly').label('Only update existing products')]; }
    static async resolveRecord(data: Record<string, unknown>, ctx: { options: Record<string, unknown> }) {
        const existing = await LabProduct.query().findOne({ sku: String(data.sku) });
        return existing ?? (ctx.options.updateOnly ? null : {});
    }
}

/** Shows or hides the selected products (bulk actions of the "Visibility" menu). */
async function setVisibility(livewire: any, visible: 0 | 1): Promise<void> {
    const keys: string[] = await livewire.getSelectedRecordKeys();
    for (const key of keys) await LabProducts.adapter.update(key, { is_visible: visible });
    livewire.deselectAllTableRecords();
    Notification.make().success().title(`${keys.length} product(s) ${visible ? 'shown' : 'hidden'}`).send();
}

/** Table configurations of the "Select" modals of the product form (`ModalTableSelect`). */
class LabBrandsTable {
    static configure(table: Table<any>): Table<any> {
        return table
            .columns([TextColumn.make('name').searchable().sortable(), TextColumn.make('website').searchable().toggleable(), IconColumn.make('is_visible').label('Visible').boolean()])
            .filters([TernaryFilter.make('is_visible').label('Visibility').trueLabel('Visible').falseLabel('Hidden')])
            .defaultSort('name');
    }
}
class LabCategoriesTable {
    static configure(table: Table<any>): Table<any> {
        return table
            .columns([TextColumn.make('name').searchable().sortable(), TextColumn.make('slug').searchable()])
            .filters([TernaryFilter.make('is_visible').label('Visibility')])
            .defaultSort('name');
    }
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
            low: Tab.make('Low stock').icon('m-exclamation-triangle').iconPosition('after').query((query) => { query.where('qty', '<', 10); }).badge(async () => (await LabProduct.query().where('qty', '<', 10).resultSize())).badgeColor('warning')
                // A product restocked meanwhile can still be restocked from this tab. The attribute is left out of the parity screenshots.
                .excludeQueryWhenResolvingRecord().extraAttributes(process.env.NAVETTE_NO_THEMES ? {} : { 'data-cy': 'low-stock-tab' }),
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
            // Records picked in a table shown in a slide-over. Left out of the parity screenshots.
            ...(process.env.NAVETTE_NO_THEMES ? [] : [
                ModalTableSelect.make('brand_id').relationship('brand', 'name').tableConfiguration(LabBrandsTable).placeholder('No brand'),
                ModalTableSelect.make('categories').relationship('categories', 'name').multiple().maxItems(5).tableConfiguration(LabCategoriesTable),
            ]),
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
                // Icon count summary: left out of the parity screenshots.
                IconColumn.make('featured').boolean().summarize(process.env.NAVETTE_NO_THEMES ? [] : Count.make().icons()),
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
            .groupRecordsTriggerAction(process.env.NAVETTE_NO_THEMES ? null : (action) => action.button().label('Group records'))
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
                // A second bulk menu, with its own label and icon. Left out of the parity screenshots.
                ...(process.env.NAVETTE_NO_THEMES ? [] : [
                    BulkActionGroup.make([
                        Action.make('show').label('Show').icon('m-eye').action(async ({ livewire }) => setVisibility(livewire, 1)),
                        Action.make('hide').label('Hide').icon('m-eye-slash').action(async ({ livewire }) => setVisibility(livewire, 0)),
                    ]).label('Visibility').icon('m-eye'),
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
    // Shown below "Products lab" in the menu (nested navigation).
    static navigationParentItem = 'Products lab';
    static adapter = new ObjectionAdapter(LabProduct);
    // Many-to-many relationship: the links are saved in `product_category_product` with the record.
    static form(schema: any) {
        return schema.components([
            TextInput.make('name').required(),
            CheckboxList.make('categories').relationship('categories', 'name', (query) => query.whereNull('parent_id')).searchable().searchDebounce(300).bulkToggleable().columns(3).columnSpanFull(),
        ]);
    }
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

/** Nested Livewire component of the Fields lab form, with its own state and requests. */
class LabBrandNotes extends WireComponent {
    static callable = ['like'];
    static locked = ['brandName'];
    brandName: string | null = null;
    likes = 0;
    mount(params: Record<string, unknown>) { this.brandName ??= (params.record as { name?: string } | null)?.name ?? null; }
    like() { this.likes++; }
    placeholder() { return '<div class="lab-brand-notes-placeholder">Loading notes…</div>'; }
    render() { return `<div class="lab-brand-notes"><p>Notes for ${e(this.brandName ?? 'a new brand')}</p><button type="button" wire:click="like">Like</button> <span data-likes>${this.likes}</span></div>`; }
}

/** A form page with more field options. */
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
            // File upload options and nested Livewire components. Left out of the parity screenshots.
            ...(process.env.NAVETTE_NO_THEMES ? [] : [
                Section.make('Nested components').schema([
                    Livewire.make(LabBrandNotes).key('brand-notes'),
                    Livewire.make(LabBrandNotes, ({ record }) => ({ brandName: record ? `${(record as { name: string }).name} (lazy)` : null })).key('lazy-brand-notes').lazyLoaded(),
                ]).columnSpanFull().columns(2),
                Section.make('Upload options').schema([
                    // Saved in the `seo_description` column: moved from the temporary folder, listed without reading the file.
                    FileUpload.make('seo_description').label('Brand sheet').image()
                        .directory(({ operation }) => `lab-brands/${operation}`).moveFiles().fetchFileInformation(false)
                        .openable().downloadable()
                        .getOpenableFileUrlUsing((file) => `/storage/${file}?view=open`)
                        .getDownloadableFileUrlUsing((file) => `/storage/${file}?view=download`),
                    // Validated but not saved (no column): a crop editor opens for images that are not 16:9.
                    FileUpload.make('banner').image().imageAspectRatio('16:9').automaticallyOpenImageEditorForAspectRatio().saveRelationshipsUsing(() => {}),
                    FileUpload.make('documents').multiple().minFiles(({ operation }) => (operation === 'create' ? 2 : null)).maxFiles(({ get }) => (get('name') === 'Many' ? 4 : 3)).image().saveRelationshipsUsing(() => {}),
                ]).columnSpanFull().columns(2),
            ]),
            Repeater.make('contacts').schema([TextInput.make('name').required(), TextInput.make('email').email()]).columns(2)
                .itemLabel(({ state }) => (state.name as string) || null).collapsible().cloneable().reorderableWithButtons().defaultItems(1).columnSpanFull().dehydrated(false)
                // Item actions: a confirmed delete, "Insert between", and an extra action that validates its item.
                .deleteAction((action) => action.requiresConfirmation().modalHeading('Remove this contact?'))
                .addBetweenAction((action) => action.visible())
                .extraItemActions([
                    Action.make('greet').icon('m-hand-raised').requiresConfirmation().modalDescription('Checks the contact, then says hello.')
                        .action(async ({ arguments: args, component }: any) => { const contact = await component.getItemState(args.item); Notification.make().success().title(`Hello ${contact.name}`).send(); }),
                ]),
            TextInput.make('website').url(),
        ]);
    }
    static table(table: Table<any>): Table<any> { return table.columns([TextColumn.make('name').searchable(), TextColumn.make('website')]); }
}

/** The site settings: one row of the `settings` table (group "site", name "general"), its values in the JSON `payload` column. */
class LabSetting extends Model {
    static tableName = 'settings';
    static jsonAttributes = ['payload'];
    declare payload: Record<string, unknown> | null;
}
class EditSiteSettings extends EditRecord {
    /** The form edits the keys of the payload. */
    protected mutateFormDataBeforeFill(data: Record<string, unknown>): Record<string, unknown> { return { ...((data.payload as Record<string, unknown> | null) ?? {}) }; }
    protected mutateFormDataBeforeSave(data: Record<string, unknown>): Record<string, unknown> { return { payload: data, updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }; }
}
/**
 * Singular resource: a single record, edited at `/lab/site-settings`, without a list. Until the first save there is no row:
 * the form shows its defaults, and saving creates the row.
 */
class LabSiteSettings extends Resource {
    static slug = 'site-settings';
    static modelLabel = 'site settings';
    static navigationIcon = 'o-cog-6-tooth';
    static navigationGroup = 'Forms';
    static navigationSort = 10;
    static isSingular = true;
    static pages = { edit: EditSiteSettings };
    static adapter = new ObjectionAdapter(LabSetting, { modify: (query) => { query.where({ group: 'site', name: 'general' }); } });
    static getSingularRecordAttributes() { return { group: 'site', name: 'general', locked: 0 }; }
    static form(schema: any) {
        return schema.components([
            Section.make('General').columns(2).schema([
                TextInput.make('site_name').required().maxLength(100).default('Navette Lab'),
                TextInput.make('tagline').maxLength(200),
                TextInput.make('contact_email').email(),
                Select.make('locale').options({ en: 'English', fr: 'French' }).default('en').required(),
            ]),
            Section.make('Maintenance').schema([
                Toggle.make('maintenance_mode').live(),
                Textarea.make('maintenance_message').visible(({ get }: any) => Boolean(get('maintenance_mode'))).required(),
            ]),
        ]);
    }
}

/** Cluster: one menu item for the catalog pages, listed in its sub-navigation and served under `/lab/catalog`. */
class CatalogCluster extends Cluster {
    static navigationIcon = 'o-squares-2x2';
    static navigationSort = 10;
}
class LabCatalogBrands extends Resource {
    static slug = 'brands';
    static modelLabel = 'brand';
    static navigationIcon = 'o-tag';
    static cluster = CatalogCluster;
    static isSimple = true;
    static adapter = new ObjectionAdapter(LabBrand);
    static table(table: Table<any>): Table<any> { return table.columns([TextColumn.make('name').searchable().sortable(), TextColumn.make('website')]); }
}
class LabCatalogProducts extends Resource {
    static slug = 'products';
    static modelLabel = 'product';
    static navigationIcon = 'o-cube';
    static navigationGroup = 'Inventory';
    static cluster = CatalogCluster;
    static isSimple = true;
    static adapter = new ObjectionAdapter(LabProduct);
    static table(table: Table<any>): Table<any> { return table.columns([TextColumn.make('name').searchable(), TextColumn.make('qty').numeric()]); }
}

export function labPanel(options: { key: string; login: typeof Login; auth: AuthProvider; canAccess: (user: any) => boolean }): Panel {
    // The private storage of the UI lab signs its URLs with the panel key.
    labPrivateFiles(options.key);
    return Panel.make()
        .id('lab')
        .path('lab')
        .key(options.key)
        .brandName('Navette Lab')
        .setColors({ primary: Color.Violet })
        .login(options.login)
        // The framework-rendered field and singular settings examples are left out of the parity screenshots.
        .resources([LabProducts, LabCards, LabOrders, LabFields, ...(process.env.NAVETTE_NO_THEMES ? [] : [LabFrameworkFields, LabSpecificFields, LabRichEditorOptions, LabRepeaterOptions, LabComments]), LabCatalogBrands, LabCatalogProducts, ...(process.env.NAVETTE_NO_THEMES ? [] : [LabSiteSettings, LabRelations, ...labTableFeatureResources, LabColumns, LabRelationProducts, LabRelationBrands, LabBrandPages])])
        // Example plugins (`examples/`) and a configurable resource.
        .plugin(labPluginExamples())
        // Widgets lab: filters action, clickable stats, chart filters form, empty state actions, Chart.js plugins.
        // Action features (policy messages, rate limits, links, modal options), tabs, JavaScript widgets, notification actions and
        // private files labs: left out of the parity screenshots.
        .pages([LabWidgetsDashboard, ...(process.env.NAVETTE_NO_THEMES ? [] : [LabActionsPage, LabTabsPage, LabJsWidgetsDashboard, LabUiPage, LabWelcomePage])])
        .widgets([...labWidgets, ...(process.env.NAVETTE_NO_THEMES ? [] : labJsWidgets)])
        .renderHook('panels::scripts.before', () => '<script src="/js/lab-chart-plugins.js"></script>')
        .navigationGroups([NavigationGroup.make('Tables').icon('o-table-cells'), NavigationGroup.make('Forms').collapsible(false)])
        // Collapsed to icons, the "Tables" group (it has an icon) opens a dropdown of its items.
        .sidebarCollapsibleOnDesktop()
        .defaultThemeMode('dark')
        .auth(options.auth)
        .canAccess(options.canAccess);
}
