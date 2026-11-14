// `/lab` "Specific fields": options of specific fields (text input masks, selects, repeaters, builders…) exercised by
// e2e/specific-fields.e2e.mjs. Not in the parity screenshots (registered only without NAVETTE_NO_THEMES).
import { Model, ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import { Section } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

class LabSpecificProduct extends Model { static tableName = 'products'; }

export class LabSpecificFields extends Resource {
    static slug = 'specific-fields';
    static modelLabel = 'product';
    static navigationIcon = 'o-adjustments-horizontal';
    static navigationLabel = 'Specific fields';
    static navigationGroup = 'Forms';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(LabSpecificProduct);

    static form(schema: any) {
        return schema.components([
            Section.make('Text').schema([
                TextInput.make('name').required(),
            ]),
        ]);
    }

    static table(table: Table<any>): Table<any> {
        return table.columns([TextColumn.make('name').searchable()]);
    }
}
