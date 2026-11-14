---
title: Nested resources
---

## Introduction

[Relation managers](/resources/managing-relationships#creating-a-relation-manager) and [relation pages](/resources/managing-relationships#relation-pages) give you a table of related records inside a resource. In a `ProjectResource`, a relation manager for `tasks` lists the tasks of the project, and creates and edits them in modals.

Tasks may be too complex to be created and edited in a modal. You may want them to have their own resource, so that creating and editing a task is a full page experience, while staying under its project: `/projects/12/tasks/create`, `/projects/12/tasks/48/edit`. This is a nested resource.

A nested resource has no list page and no navigation item: its records are listed by a relation manager or a relation page of the parent resource, which links to the nested pages.

## Creating a nested resource

A nested resource is a resource with a `parentResource`:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { TextInput, Textarea } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';
import { ProjectResource } from './ProjectResource.ts';

export class TaskResource extends Resource {
    static slug = 'tasks';
    static modelLabel = 'task';
    static recordTitleAttribute = 'title';
    static parentResource = () => ProjectResource;
    static adapter = new ObjectionAdapter(Task);

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('title').required(),
            Textarea.make('description'),
        ]);
    }

    static table(table: Table): Table {
        return table.columns([TextColumn.make('title')]);
    }
}
```

Register it in the panel like any resource, next to its parent:

```ts
panel.resources([ProjectResource, TaskResource]);
```

Its pages are served under a record of the parent resource:

| Page | URL |
|---|---|
| Create | `/projects/{project}/tasks/create` |
| Edit | `/projects/{project}/tasks/{record}/edit` |
| View (with `hasViewPage`) | `/projects/{project}/tasks/{record}` |
| [Relation pages](/resources/managing-relationships#relation-pages) | `/projects/{project}/tasks/{record}/<name>` |

`parentResource` may be the resource class itself (`static parentResource = ProjectResource`), or a function returning it. Use the function when the two resources import each other (the parent's relation manager points to the nested resource, see below): with a circular import, one of the two classes is not defined yet when the other one is.

<Aside variant="info">
The pages work as the [create](/resources/creating-records), [edit](/resources/editing-records) and [view](/resources/viewing-records) pages of any resource: `static pages = { edit: EditTask }` replaces them with your subclasses, and the lifecycle hooks are the same.
</Aside>

## Listing the records of a nested resource

To list the tasks under a project, give the project's relation manager (or relation page) a `relatedResource`:

```ts
import { CreateAction, EditAction, RelationManager } from '@navette-js/panels';
import type { Table } from '@navette-js/tables';

export class TasksRelationManager extends RelationManager {
    static relatedResource = () => TaskResource;

    static table(table: Table): Table {
        return TaskResource.table(table)
            .headerActions([CreateAction.make()])
            .recordActions([EditAction.make()]);
    }
}
```

With a related resource, the relation manager:

- uses the related resource's `table()` and `form()` (and `infolist()` on a relation page), unless it defines its own;
- uses the related resource's labels and policy;
- reads the related records with the related resource's adapter, [limited to the owner record](#scoping-the-records-to-the-parent-record), unless it defines `adapterFor()`;
- takes its relationship name from the nesting (`tasks` here), so `relationship` may be left out;
- links `CreateAction` to the create page, `EditAction` to the edit page, and `ViewAction` to the view page of the nested resource, instead of opening modals. A table row links to the view page, or the edit page, when the table has that action.

The same `relatedResource` property is available on `ManageRelatedRecords` relation pages.

## Scoping the records to the parent record

Every query of a nested page is limited to the parent record of the URL. By default, the nested resource's adapter is scoped with `scopedTo(foreignKey, parentKey)`, where the foreign key is the inverse relationship name in snake case followed by `_id` (`project_id`). The scoped adapter of `ObjectionAdapter`:

- only reads the records whose `project_id` is the parent's key;
- fills `project_id` with the parent's key when a record is created, whatever the form sends;
- never changes `project_id` when a record is updated, so a record cannot be moved to another parent through the form;
- refuses to update or delete a record outside the scope.

You may scope the adapter yourself by overriding `scopeAdapterToParent()`. It receives the resource's adapter, the parent's key and the parent record (`null` when it is called for a relation manager, which only knows the owner's key). For example, comments attached to posts through a polymorphic relationship (`commentable_type` and `commentable_id` columns) are scoped on both columns:

```ts
import { ObjectionAdapter, type DataAdapter } from '@navette-js/database';

export class CommentResource extends Resource {
    static parentResource = () => PostResource;
    static adapter = new ObjectionAdapter(Comment);

    static scopeAdapterToParent(adapter: DataAdapter, parentKey: string): DataAdapter {
        return adapter.scopedTo!('commentable_type', 'post').scopedTo!('commentable_id', parentKey);
    }
}
```

<Aside variant="warning">
When you write your own scope, make sure creating a record attaches it to the parent, and that updating it cannot move it out of the scope: the `create()` and `update()` methods of your adapter receive the form data as sent by the browser, after validation.
</Aside>

## Authorizing nested resources

To open a nested page, the user must be able to access every ancestor resource: the `viewAny` ability of each parent resource's policy is checked on the initial page load and again on every request of the page.

Operations on the nested records are authorized with the nested resource's own policy: editing a task requires the `update` ability on the task, but not the `view` or `update` abilities on its project. This allows you to let users manage the tasks without letting them edit the projects.

The records of the URL must still belong to one another. On every request, Navette reloads each parent record through the parent resource's adapter (with its own scope: its parent, the tenant...), then the nested record through the adapter scoped to its parent. A URL combining a project with a task of another project, or an unknown project, answers with a 404 error. The parent keys are kept in the page's locked state: the browser cannot change them.

See [authorization](/resources/authorization) for policies.

## Customizing the relationship names

The parent's route parameter, the foreign key and the relationship name are guessed from the model labels: `project` and `project_id` from the parent's `modelLabel`, `tasks` from the nested resource's plural model label. When they do not fit, remove `parentResource` and define `getParentResourceRegistration()` instead:

```ts
import { ParentResourceRegistration, Resource } from '@navette-js/panels';

export class TaskResource extends Resource {
    // ...

    static getParentResourceRegistration(): ParentResourceRegistration {
        return ProjectResource.asParent()
            .relationship('tasks')
            .inverseRelationship('project')
            .foreignKey('project_id');
    }
}
```

| Method | Default | Used for |
|---|---|---|
| `relationship()` | The nested resource's plural model label, in camel case | The relation manager's name, and the `?relation=` parameter of the index URL |
| `inverseRelationship()` | The parent's model label, in camel case | The parent's route parameter, in snake case: `{project}` |
| `foreignKey()` | The inverse relationship in snake case, followed by `_id` | The column scoped by `scopedTo()` |
| `page()` | The relationship name in kebab case | The parent's relation page listing the records (see below) |

You may omit the calls whose defaults suit you.

## Generating URLs

`getUrl()` of a nested resource needs the parent record, or its key, under the parent's route parameter name. Pass named parameters, with `record` for the nested record:

```ts
TaskResource.getUrl('create', { project: 12 });
TaskResource.getUrl('edit', { project: 12, record: 48 });
TaskResource.getUrl('edit', 48, { project: 12 });
```

Records work as well as keys (`{ project, record: task }`), and any other parameter is added to the query string. On a nested page, the resource of the page (`livewire.resource`) already carries the parent keys: `livewire.resource.getUrl('edit', 48)` builds the URL under the current parent.

The records of a nested resource are listed on the parent record's page, so its "index" URL (used by the breadcrumbs, and by the redirect after a deletion) is:

- the parent's relation page registered under the name given to `page()`, if there is one;
- otherwise the parent's view page, or its edit page, with the relation manager's tab open: `/projects/12?relation=tasks`.

`?relation=` accepts the relationship name of a relation manager (or its position in `relations`, from `0`), on any view or edit page.

## Breadcrumbs

The breadcrumbs of a nested page start with those of its parent records: the parent resource, then the parent record, linked to its view page (or edit page) when the user may open it. For a task: Projects > Website > Tasks > Homepage > Edit.

## Nesting several levels

A nested resource may itself be the parent of another one. The URLs include every parent (`/projects/{project}/tasks/{task}/notes/{record}/edit`), every parent record is checked against the one above it, and `getUrl()` needs every parent key:

```ts
export class NoteResource extends Resource {
    static slug = 'notes';
    static modelLabel = 'note';

    static getParentResourceRegistration(): ParentResourceRegistration {
        return TaskResource.asParent().relationship('notes').inverseRelationship('task');
    }
}

NoteResource.getUrl('edit', { project: 12, task: 48, record: 3 });
```

The notes of a task are then listed by a relation page of `TaskResource` with `relatedResource`.

<Aside variant="warning">
A nested resource is left out of [global search](/resources/global-search), since its results would need the parent records to build their URLs.
</Aside>
