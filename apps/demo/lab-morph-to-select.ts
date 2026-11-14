// `/lab` "Comments": a `MorphToSelect` editing the polymorphic `commentable` of the seeded comments (a product or a blog
// post, stored as Laravel-style class names such as `App\Models\Shop\Product`), searchable, exercised by e2e/morph-to-select.e2e.mjs.
// Not in the parity screenshots (registered only without NAVETTE_NO_THEMES).
import { Model, ObjectionAdapter } from '@navette-js/database';
import { MorphToSelect, TextInput } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import { TextColumn, type Table } from '@navette-js/tables';

class LabMorphProduct extends Model { static tableName = 'products'; static morphClass = 'App\\Models\\Shop\\Product'; }
class LabMorphPost extends Model { static tableName = 'posts'; static morphClass = 'App\\Models\\Blog\\Post'; }
class LabComment extends Model { static tableName = 'comments'; }

const TYPE_LABELS: Record<string, string> = { 'App\\Models\\Shop\\Product': 'Product', 'App\\Models\\Blog\\Post': 'Blog post' };

export class LabComments extends Resource {
    static slug = 'comments';
    static modelLabel = 'comment';
    static navigationIcon = 'o-chat-bubble-left-right';
    static navigationLabel = 'Comments';
    static navigationGroup = 'Forms';
    static recordTitleAttribute = 'title';
    static adapter = new ObjectionAdapter(LabComment);

    static form(schema: any) {
        return schema.components([
            TextInput.make('title').required(),
            MorphToSelect.make('commentable')
                .label('Commented record')
                .types([
                    MorphToSelect.Type.make(LabMorphProduct).titleAttribute('name').label('Product'),
                    MorphToSelect.Type.make(LabMorphPost).titleAttribute('title').label('Blog post'),
                ])
                .searchable()
                .required(),
        ]);
    }

    static table(table: Table<any>): Table<any> {
        return table.defaultSort('id', 'desc').columns([
            TextColumn.make('title').searchable(),
            TextColumn.make('commentable_type').label('Type').formatStateUsing(({ state }: any) => TYPE_LABELS[String(state)] ?? String(state ?? '')),
            TextColumn.make('commentable_id').label('Record'),
        ]);
    }
}
