// `/lab` "Repeater options": repeater and builder relationship hooks, table mode options, sibling options, lazy items, exercised by
// e2e/repeater-options.e2e.mjs. Not in the parity screenshots (registered only without NAVETTE_NO_THEMES).
import { Model, ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import { TextColumn, type Table } from '@navette-js/tables';

class LabRepeaterOrder extends Model { static tableName = 'orders'; }

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

        ]);
    }

    static table(table: Table<any>): Table<any> {
        return table.columns([TextColumn.make('number').searchable()]);
    }
}
