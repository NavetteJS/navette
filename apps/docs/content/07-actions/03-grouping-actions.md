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

Action groups are available in the row actions of a table (`recordActions()`). A group can sit next to ungrouped actions in the same row.

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

<Aside variant="warning">
Customizing the group trigger (label, icon, button style, tooltip), the dropdown placement, width, offset and maximum height, dividers between actions, and action groups in page headers are not available yet.
</Aside>
