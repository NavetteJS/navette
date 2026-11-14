// `/lab` table-level features: reordering (paginated, custom trigger, callbacks), extreme
// pagination links, enforced page options, the page in the URL under a query string identifier, table search options,
// sort queries, striped rows, the row loop, a reorderable live column manager with a column group; and on a large table,
// cursor pagination, lazy loading, a loading skeleton, polling, a custom header and a column manager in a modal.
// Left out of the parity screenshots (NAVETTE_NO_THEMES): see lab-panel.ts.
import { Model, ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { Notification, Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { ColumnGroup, ColumnManagerLayout, PaginationMode, TextColumn, type Table } from '@navette-js/tables';

class LabTask extends Model {
    static tableName = 'tasks';
    id!: number;
    title!: string;
    description!: string | null;
    status!: string | null;
    priority!: string | null;
    sort!: number | null;
}

class LabTimesheet extends Model {
    static tableName = 'timesheets';
    id!: number;
    date!: string;
    description!: string | null;
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export class LabTasks extends Resource {
    static slug = 'tasks';
    static modelLabel = 'task';
    static navigationIcon = 'o-queue-list';
    static navigationLabel = 'Tasks lab';
    static navigationGroup = 'Table features';
    static recordTitleAttribute = 'title';
    static adapter = new ObjectionAdapter(LabTask);

    static form(schema: Schema): Schema {
        return schema.components([TextInput.make('title').required().maxLength(255)]);
    }

    static table(table: Table<LabTask>): Table<LabTask> {
        return table
            .heading('Tasks')
            .description('Drag rows to reorder them; the column manager reorders columns.')
            .striped()
            .columns([
                TextColumn.make('position').label('#').state((_record, { rowLoop }) => rowLoop?.iteration ?? null),
                TextColumn.make('title').searchable(['title', 'description']).sortable().limit(40),
                TextColumn.make('status').badge().toggleable(),
                // Priorities sort by their rank, not alphabetically.
                TextColumn.make('priority').sortable(true, (query, direction) => query.orderByRaw(`case priority ${PRIORITIES.map((priority, index) => `when '${priority}' then ${index}`).join(' ')} else 9 end ${direction === 'desc' ? 'desc' : 'asc'}`)),
                ColumnGroup.make('Effort').columns([
                    TextColumn.make('estimated_hours').label('Estimated').numeric(1).toggleable(),
                    TextColumn.make('actual_hours').label('Actual').numeric(1).toggleable(true, { isToggledHiddenByDefault: true }),
                ]),
                TextColumn.make('sort').label('Position').sortable(),
            ])
            .searchPlaceholder('Search tasks')
            .searchDebounce('300ms')
            .defaultSort('sort')
            .reorderable('sort')
            .paginatedWhileReordering()
            .reorderRecordsTriggerAction((action, isReordering) => action.button().label(isReordering ? 'Done reordering' : 'Reorder tasks'))
            .afterReordering((order) => { Notification.make().success().title(`Moved ${order.length} tasks`).send(); })
            .paginationPageOptions([5, 10, 25])
            .defaultPaginationPageOption(10)
            .enforcePaginationPageOptions()
            .extremePaginationLinks()
            .queryStringIdentifier('tasks')
            .reorderableColumns()
            .deferColumnManager(false)
            .columnManagerColumns(2)
            .columnManagerResetActionPosition('footer')
            .recordUrl((record) => LabTasks.getUrl('edit', record.id), true);
    }
}

export class LabTimesheets extends Resource {
    static slug = 'timesheets';
    static modelLabel = 'timesheet';
    static navigationIcon = 'o-clock';
    static navigationLabel = 'Timesheets lab';
    static navigationGroup = 'Table features';
    static isSimple = true;
    static adapter = new ObjectionAdapter(LabTimesheet);

    static form(schema: Schema): Schema {
        return schema.components([TextInput.make('description').maxLength(255)]);
    }

    static table(table: Table<LabTimesheet>): Table<LabTimesheet> {
        return table
            .header('<div class="nv-ta-header" data-cy="timesheets-header"><div><h2 class="nv-ta-header-heading">Timesheets</h2><p class="nv-ta-header-description">Thousands of rows: cursor pagination, lazy loading.</p></div></div>')
            .columns([
                TextColumn.make('date').date().sortable(),
                TextColumn.make('description').searchable().limit(50),
                TextColumn.make('hours').numeric(2).toggleable(),
                TextColumn.make('total_cost').money('usd').toggleable(),
            ])
            .defaultSort('date', 'desc')
            .paginationMode(PaginationMode.Cursor)
            .paginationPageOptions([10, 25])
            .lazyLoaded()
            .loadingSkeleton()
            .poll('60s')
            .searchOnBlur()
            .splitSearchTerms(false)
            .columnManagerLayout(ColumnManagerLayout.Modal)
            .columnManagerTriggerAction((action) => action.button().label('Columns'));
    }
}

/** The resources of this file, registered by the lab panel. */
export const labTableFeatureResources = [LabTasks, LabTimesheets];
