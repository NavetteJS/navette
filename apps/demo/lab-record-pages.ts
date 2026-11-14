// `/lab/brand-pages`: a custom page bound to a record (`InteractsWithRecord(Page)`) in the record sub-navigation, the default
// redirect after creating (the view page), a created notification with a body, and a relation manager reading its owner
// record (`getOwnerRecord()`) with record titles from the table (`recordTitle()`).
// Reached by URL only (not in the navigation, which other specs compare item by item). Left out with NAVETTE_NO_THEMES.
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import { CreateRecord, InteractsWithRecord, Notification, Page, RelationManager, Resource, ViewAction } from '@navette-js/panels';
import { Section, Text, type Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

class LabPageBrand extends Model { static tableName = 'brands'; id!: number; name!: string; slug!: string; website!: string | null; }
class LabPageProduct extends Model { static tableName = 'products'; id!: number; name!: string; sku!: string | null; brand_id!: number | null; }

/** Products of the brand: the view modal's heading uses the table's record title, a header action reads the owner record. */
class LabBrandProducts extends RelationManager {
    static relationship = 'products';
    static modelLabel = 'product';
    static adapterFor(ownerKey: string): DataAdapter { return new ObjectionAdapter(LabPageProduct, { modify: (query) => { query.where('brand_id', ownerKey); } }); }
    static form(schema: Schema): Schema { return schema.components([TextInput.make('name')]); }
    static table(table: Table<any>): Table<any> {
        return table
            .recordTitle((record) => `${record.name} (${record.sku ?? 'no SKU'})`)
            .columns([TextColumn.make('name'), TextColumn.make('sku').label('SKU')])
            .headerActions([
                Action.make('owner').label('Owner').color('gray').action(async ({ livewire }) => {
                    const brand = await (livewire as LabBrandProducts).getOwnerRecord();
                    Notification.make().title(`Owner: ${brand.name}`).send();
                }),
            ])
            .recordActions([ViewAction.make()]);
    }
}

/** A custom page of the brand, served at `/lab/brand-pages/{record}/summary`. */
class LabBrandSummary extends InteractsWithRecord(Page) {
    static title = 'Summary';
    static navigationIcon = 'o-document-text';
    getTitle(): string { return `Summary of ${this.getRecord().name}`; }
    contentSchema(schema: Schema): Schema {
        const brand = this.getRecord();
        return schema.components([
            Section.make('Brand').schema([
                TextEntry.make('slug').state(() => brand.slug),
                TextEntry.make('website').state(() => brand.website ?? '—'),
            ]),
            Text.make(`Record key: ${this.recordKey}`),
        ]);
    }
}

class CreateLabPageBrand extends CreateRecord {
    protected getCreatedNotification(record: any): Notification | null {
        return Notification.make().success().title('Brand created').body(`${record.name} is ready.`);
    }
}

export class LabBrandPages extends Resource {
    static slug = 'brand-pages';
    static modelLabel = 'brand';
    static navigationLabel = 'Brand pages';
    static shouldRegisterNavigation = false;
    static recordTitleAttribute = 'name';
    static hasViewPage = true;
    static adapter = new ObjectionAdapter(LabPageBrand);
    static pages = { create: CreateLabPageBrand };
    static relations = [LabBrandProducts];
    static relatedPages = { summary: LabBrandSummary };
    static recordSubNavigation = ['view', 'edit', 'summary'];

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('name').required().maxLength(255),
            TextInput.make('slug').required().maxLength(255),
        ]);
    }
    static infolist(schema: Schema): Schema { return schema.components([TextEntry.make('name'), TextEntry.make('slug')]); }
    static table(table: Table<any>): Table<any> { return table.columns([TextColumn.make('name').searchable()]); }
}
