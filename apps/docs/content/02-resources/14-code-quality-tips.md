---
title: Code quality tips
---

## Introduction

A resource starts as one file holding its form, table and infolist. As they grow, the file becomes hard to read. These tips keep resources small, and let them share their pieces with relation managers, widgets and other resources.

## Using schema and table classes

Move the form, the infolist and the table into classes of their own, next to the resource, and keep only the configuration in the resource:

```text
src/admin/resources/
├── PostResource.ts
└── Post/
    ├── Schemas/
    │   ├── PostForm.ts
    │   └── PostInfolist.ts
    └── Tables/
        └── PostsTable.ts
```

Each class has one static method receiving the schema or the table, and returning it:

```ts
// src/admin/resources/Post/Schemas/PostForm.ts
import { RichEditor, Select, TextInput } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';

export class PostForm {
    static configure(schema: Schema): Schema {
        return schema.components([
            TextInput.make('title').required().maxLength(255),
            Select.make('status').options({ draft: 'Draft', published: 'Published' }).required(),
            RichEditor.make('body').columnSpanFull(),
        ]);
    }
}
```

```ts
// src/admin/resources/Post/Tables/PostsTable.ts
import { DeleteBulkAction, EditAction } from '@navette-js/panels';
import { SelectFilter, TextColumn, type Table } from '@navette-js/tables';

export class PostsTable {
    static configure(table: Table): Table {
        return table
            .columns([
                TextColumn.make('title').searchable().sortable(),
                TextColumn.make('status').badge(),
            ])
            .filters([SelectFilter.make('status').options({ draft: 'Draft', published: 'Published' })])
            .recordActions([EditAction.make()])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}
```

The resource only delegates to them:

```ts
// src/admin/resources/PostResource.ts
export class PostResource extends Resource {
    static slug = 'posts';
    static modelLabel = 'post';
    static adapter = new ObjectionAdapter(Post);

    static form(schema: Schema): Schema {
        return PostForm.configure(schema);
    }

    static infolist(schema: Schema): Schema {
        return PostInfolist.configure(schema);
    }

    static table(table: Table): Table {
        return PostsTable.configure(table);
    }
}
```

A relation manager listing the posts of an author uses the same classes, and hides what is useless there with [`hiddenOn()`](/resources/managing-relationships#hiding-a-field-column-or-filter-in-the-relation-manager):

```ts
export class PostsRelationManager extends RelationManager {
    static relationship = 'posts';

    static form(schema: Schema): Schema {
        return PostForm.configure(schema);
    }

    static table(table: Table): Table {
        return PostsTable.configure(table);
    }
}
```

## Using component functions

A field, column or entry used in several places, with the same options, is best written once. A function returning the configured component keeps every copy in line:

```ts
// src/admin/components/statusSelect.ts
import { Select } from '@navette-js/forms';

export const statusSelect = (name = 'status') =>
    Select.make(name).options({ draft: 'Draft', review: 'In review', published: 'Published' }).default('draft').required();
```

```ts
schema.components([TextInput.make('title'), statusSelect()]);
```

The returned component can still be changed where it is used: `statusSelect().label('State')`. For a component with its own markup or behavior, create a class instead, with `npx navette make:field`, `make:column`, `make:entry` or `make:schema-component` (see the [CLI](/getting-started/cli#generating-a-custom-field-entry-column-or-schema-component)).

## Keeping pages thin

Custom pages of a resource (`EditPost`, `ListPosts`…) hold what is specific to one page: header actions, lifecycle hooks, redirects. Put business rules in functions or services that pages, actions and jobs all call, rather than in a page method that only one of them can reach.
