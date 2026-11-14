---
title: Grouping actions
---

## Introduction

You may group actions together into a dropdown menu by using an `ActionGroup` object. Groups may contain many actions, and the user opens the menu with a "⋮" icon button:

```ts
import { Action, ActionGroup } from '@navette-js/actions';
import { DeleteAction, EditAction, ViewAction } from '@navette-js/panels';

table.recordActions([
    ActionGroup.make([
        ViewAction.make(),
        EditAction.make(),
        DeleteAction.make(),
    ]),
])
```

```preview
ActionGroup.make([
    ViewAction.make(),
    EditAction.make(),
    DeleteAction.make(),
])
```

Action groups are available in the row actions of a table (`recordActions()`), in its header and toolbar actions, and in page headers. A group can sit next to ungrouped actions.

Each action in the group is displayed as a menu item, with its label and icon. You may set an icon used only in menus with `groupedIcon()`. A menu item uses the color of the action, and the color and icon may be calculated from the record:

```ts
import { Action, ActionGroup } from '@navette-js/actions';

ActionGroup.make([
    Action.make('toggle_active')
        .icon(({ record }) => (record.is_active ? 'm-x-mark' : 'm-check'))
        .label(({ record }) => (record.is_active ? 'Deactivate' : 'Activate'))
        .color(({ record }) => (record.is_active ? 'danger' : 'success'))
        .requiresConfirmation()
        .action(async ({ record }) => {
            await EmployeeResource.adapter.update(record.id, { is_active: !record.is_active });
        }),
    Action.make('edit')
        .icon('m-pencil-square')
        .url(({ record }) => EmployeeResource.getUrl('edit', record.id)),
])
```

Hidden actions are left out of the menu, and the group is not rendered at all when none of its actions is visible. Actions in a group keep all their other behavior: confirmation, modal forms, URLs, keybindings and authorization work as for ungrouped actions.

## Grouping bulk actions

Bulk actions are always grouped: the actions passed to `groupedBulkActions()` are listed in the table's bulk actions menu, which appears when records are selected:

```ts
import { Action } from '@navette-js/actions';
import { DeleteBulkAction } from '@navette-js/panels';

table.groupedBulkActions([
    Action.make('mark_billable')
        .icon('m-currency-dollar')
        .color('success')
        .requiresConfirmation()
        .action(async ({ livewire }) => {
            for (const key of await livewire.getSelectedRecordKeys()) {
                await TimesheetResource.adapter.update(key, { is_billable: true });
            }
            livewire.deselectAllTableRecords();
        }),
    DeleteBulkAction.make(),
])
```

When a resource table does not call `groupedBulkActions()`, its list page offers `DeleteBulkAction` by default. Pass an empty array to remove bulk actions and the selection checkboxes.

## Customizing the group trigger

The trigger is an icon button labelled "Actions". You may change its label, icon, color, size and tooltip, and turn it into a labeled button or a link:

```ts
import { ActionGroup } from '@navette-js/actions';

ActionGroup.make([
    // ...
])
    .label('More actions')
    .icon('m-ellipsis-horizontal')
    .size('sm')
    .color('gray')
    .button()
    .tooltip('More actions')
```

## Setting the placement of the dropdown

The dropdown opens below the trigger, aligned to its end. `dropdownPlacement()` takes `top-start`, `top-end`, `bottom-start`, `bottom-end`, `left`, `right`... :

```ts
import { ActionGroup } from '@navette-js/actions';

ActionGroup.make([
    // ...
])
    .dropdownPlacement('top-start')
```

Without room for it, the menu flips to the other side; `dropdownFlip(false)` keeps its placement. `dropdownAutoPlacement()` places the menu on the side with the most space instead:

```ts
import { ActionGroup } from '@navette-js/actions';

ActionGroup.make([
    // ...
])
    .dropdownAutoPlacement()
```

## Changing the width, offset and maximum height of the dropdown

```ts
import { ActionGroup } from '@navette-js/actions';

ActionGroup.make([
    // ...
])
    .dropdownWidth('xs')
    .dropdownOffset(16)
    .dropdownMaxHeight('400px')
```

With a maximum height, the menu scrolls beyond it. `maxHeight()` is the same method under a shorter name.

## Adding dividers between actions

A nested group with `dropdown(false)` becomes a section of the menu, separated from the others by a divider:

```ts
import { ActionGroup } from '@navette-js/actions';
import { DeleteAction, EditAction, ViewAction } from '@navette-js/panels';

ActionGroup.make([
    ActionGroup.make([
        ViewAction.make(),
        EditAction.make(),
    ]).dropdown(false),
    DeleteAction.make(),
])
```

## Displaying actions as a group of buttons

`buttonGroup()` shows the actions side by side, as joined buttons, instead of a dropdown.

## Grouping actions in page headers

Action groups may also be used in the header actions of a page, and in the header and toolbar actions of a table. The actions of a group are mounted and authorized like any other action.

## Grouping bulk actions

In the toolbar of a table, a `BulkActionGroup` groups [bulk actions](/tables/actions#bulk-actions) in a dropdown, shown while records are selected. Each `BulkActionGroup` is its own dropdown, labeled "Bulk actions" by default. Like an action group, it accepts a `label()`, an `icon()`, a `color()`, a `tooltip()` and a `dropdownPlacement()`:

```ts
import { Action } from '@navette-js/actions';
import { DeleteBulkAction } from '@navette-js/panels';
import { BulkActionGroup, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .toolbarActions([
            BulkActionGroup.make([
                DeleteBulkAction.make(),
            ]),
            BulkActionGroup.make([
                Action.make('publish').action(async ({ livewire }) => { /* ... */ }),
                Action.make('unpublish').action(async ({ livewire }) => { /* ... */ }),
            ])
                .label('Status')
                .icon('m-flag'),
        ]);
}
```

```preview
// records: [{"title": "Introducing Navette", "status": "published"}, {"title": "Building your first panel", "status": "draft"}, {"title": "Ten tips for faster tables", "status": "published"}]
// selected: [1, 2]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('status'),
    ])
    .toolbarActions([
        BulkActionGroup.make([
            Action.make('delete').label('Delete selected').icon('m-trash').color('danger').action(() => {}),
        ]),
        BulkActionGroup.make([
            Action.make('publish').label('Publish').action(() => {}),
            Action.make('unpublish').label('Unpublish').action(() => {}),
        ])
            .label('Status')
            .icon('m-flag'),
    ])
```

The actions of `groupedBulkActions()` form a first "Bulk actions" dropdown, before those of the toolbar. A group whose actions are all hidden is not displayed.
