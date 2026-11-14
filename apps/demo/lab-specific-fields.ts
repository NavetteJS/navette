// `/lab` "Specific fields": options of specific fields (text input masks and stripped characters, select relationships
// searched on several columns with labels from the record, pivot data and reordering, grid directions, date-time picker
// affixes, read-only and datalist) exercised by e2e/specific-fields.e2e.mjs. Not in the parity screenshots (registered
// only without NAVETTE_NO_THEMES).
import { Model, ObjectionAdapter } from '@navette-js/database';
import { CheckboxList, DateTimePicker, RawJs, Select, Textarea, TextInput, ToggleButtons } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import { Section } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

class LabSpecificBrand extends Model { static tableName = 'brands'; }
class LabSpecificCategory extends Model { static tableName = 'product_categories'; }
class LabSpecificProduct extends Model {
    static tableName = 'products';
    static get relationMappings() {
        return {
            brand: { relation: Model.BelongsToOneRelation, modelClass: LabSpecificBrand, join: { from: 'products.brand_id', to: 'brands.id' } },
            // `created_at` is written in the pivot table by `pivotData()`.
            categories: { relation: Model.ManyToManyRelation, modelClass: LabSpecificCategory, join: { from: 'products.id', through: { from: 'product_category_product.product_id', to: 'product_category_product.product_category_id', extra: ['created_at'] }, to: 'product_categories.id' } },
        };
    }
}

export class LabSpecificFields extends Resource {
    static slug = 'specific-fields';
    static modelLabel = 'product';
    static navigationIcon = 'o-adjustments-horizontal';
    static navigationLabel = 'Specific fields';
    static navigationGroup = 'Forms';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(LabSpecificProduct);

    static form(schema: any) {
        return schema.columns(2).components([
            Section.make('Text').columns(2).schema([
                TextInput.make('name').required(),
                // Typed as "1,234.5"; saved as "1234.5".
                TextInput.make('price').mask(RawJs.make('$money($input)')).stripCharacters(',').numeric().prefix('$'),
                // The mask depends on another field: a function evaluated on each render.
                TextInput.make('barcode').live().mask(({ get }: any) => (get('type') === 'downloadable' ? 'aaa-9999' : '9999 9999 9999')),
                Select.make('type').options({ deliverable: 'Deliverable', downloadable: 'Downloadable' }).live(),
                TextInput.make('support_phone').tel().telRegex('/^\\+[0-9]{6,15}$/').helperText('International format, e.g. +33612345678.').dehydrated(false),
                Textarea.make('description').rows(3).cols(40).stripCharacters('*'),
            ]).columnSpanFull(),
            Section.make('Relationships').columns(2).schema([
                // Searched on the name and the website; labels computed from the whole brand record.
                Select.make('brand_id').label('Brand').relationship('brand', 'name').searchable(['name', 'website'])
                    .getOptionLabelFromRecordUsing((record: any) => `${record.name} (${String(record.website ?? '').replace(/^https?:\/\/(www\.)?/, '')})`),
                Select.make('categories').multiple().relationship('categories', 'name').preload().reorderable().wrapOptionLabels(false)
                    .pivotData(() => ({ created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') })),
            ]).columnSpanFull(),
            Section.make('Layout').columns(2).schema([
                CheckboxList.make('shipping_zones').options({ eu: 'Europe', na: 'North America', sa: 'South America', af: 'Africa', as: 'Asia', oc: 'Oceania' }).columns(3).gridDirection('row').dehydrated(false),
                ToggleButtons.make('weight_unit').options({ g: 'Grams', kg: 'Kilograms', lb: 'Pounds', oz: 'Ounces' }).columns(2).gridDirection('row'),
                DateTimePicker.make('published_at').prefix('From').suffixIcon('m-calendar-days', true).suffixIconColor('primary').seconds(false),
                DateTimePicker.make('restock_time').label('Restock time').date(false).seconds(false).datalist(['08:00', '12:00', '18:00']).dehydrated(false),
                DateTimePicker.make('created_at').native(false).readOnly().dehydrated(false),
            ]).columnSpanFull(),
        ]);
    }

    static table(table: Table<any>): Table<any> {
        return table.columns([TextColumn.make('name').searchable(), TextColumn.make('price')]);
    }
}
