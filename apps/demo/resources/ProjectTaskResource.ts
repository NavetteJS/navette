// Tasks nested under their project (a nested resource): created and edited on full pages under the project,
// `/projects/{project}/tasks/create` and `/projects/{project}/tasks/{record}/edit`. The project's Tasks relation manager
// lists them and links to these pages (`relatedResource`). Breadcrumbs: Projects > Project > Tasks > Task > Edit.
import type { Action } from '@navette-js/actions';
import { DeleteAction, EditRecord, Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import type { Table } from '@navette-js/tables';
import { ProjectResource } from './ProjectResource.ts';
import { Task, Tasks, taskDetailsSection, tasksTable } from './TaskResource.ts';

class EditProjectTask extends EditRecord {
    getHeaderActions(): Action[] { return [DeleteAction.make()]; }
}

export class ProjectTaskResource extends Resource {
    static slug = 'tasks';
    static modelLabel = 'task';
    static recordTitleAttribute = 'title';
    // A function: ProjectResource imports this file too (its relation manager links here).
    static parentResource = () => ProjectResource;
    static pages = { edit: EditProjectTask };
    // Scoped to the project of the URL by the panel: `project_id` is filled on creation and never changes.
    static adapter = new Tasks();

    static form(schema: Schema): Schema { return schema.components([taskDetailsSection(false)]); }
    static table(table: Table<Task>): Table<Task> {
        return tasksTable(table, true, (task) => ProjectTaskResource.getUrl('edit', { project: task.project_id, record: task.id }));
    }
}
