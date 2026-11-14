// `/lab` "Rich editor options": rich editor toolbars, panels, link protocols, private attachments and plugins, exercised by
// e2e/rich-editor-options.e2e.mjs. Not in the parity screenshots (registered only without NAVETTE_NO_THEMES).
import { Model, ObjectionAdapter } from '@navette-js/database';
import { RichEditor, TextInput } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import { TextColumn, type Table } from '@navette-js/tables';

class LabRichProduct extends Model { static tableName = 'products'; }

export class LabRichEditorOptions extends Resource {
    static slug = 'rich-editor-options';
    static modelLabel = 'product';
    static navigationIcon = 'o-document-text';
    static navigationLabel = 'Rich editor options';
    static navigationGroup = 'Forms';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(LabRichProduct);

    static form(schema: any) {
        return schema.components([
            TextInput.make('name').required(),
            RichEditor.make('description'),
        ]);
    }

    static table(table: Table<any>): Table<any> {
        return table.columns([TextColumn.make('name').searchable()]);
    }
}
