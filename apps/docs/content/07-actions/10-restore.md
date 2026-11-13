---
title: Restore action
---

## Introduction

Navette includes an action that is able to restore soft-deleted records. When the trigger button is clicked, a modal asks the user for confirmation. You may use it like so:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
```

```preview
RestoreAction.make()
```

The action is visible only when the page's record is in the trash, and only to users allowed to `restore` it according to the resource policy. It restores the record with the adapter's `restore()`, reloads it, and sends a "Restored" notification. The user stays on the page.

Records can be restored when the resource's data adapter has soft deletes enabled. Set `findsTrashed: true` too, so that the edit and view pages can still load a record once it is in the trash:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { Resource } from '@navette-js/panels';

export class ProjectResource extends Resource {
    static adapter = new ObjectionAdapter(Project, { softDeletes: 'deleted_at', findsTrashed: true });
}
```

Users reach deleted records through a `TrashedFilter` on the table. The edit page of such a resource already has `DeleteAction`, `RestoreAction` and `ForceDeleteAction` in its header. When you override `getHeaderActions()` of an edit or view page, include the actions you want to keep:

```ts
import { DeleteAction, ForceDeleteAction, RestoreAction, ViewRecord } from '@navette-js/panels';

class ViewProject extends ViewRecord {
    static resource = ProjectResource;

    getHeaderActions() {
        return [this.editAction(), DeleteAction.make(), RestoreAction.make(), ForceDeleteAction.make()];
    }
}
```

<Aside variant="warning">
`RestoreAction` works in the header of an edit or view page only, not in table rows, and there is no `RestoreBulkAction` yet.
</Aside>

## Lifecycle hooks

You can use the `before()` and `after()` methods to execute code before and after a record is restored:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .before(async ({ record }) => {
        // Runs before the record is restored.
    })
    .after(async ({ livewire }) => {
        // Runs after the record is restored.
    })
```

## Redirecting after restoring

You may redirect the user after the record is restored from the `after()` hook:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .after(({ livewire }) => livewire.redirect(ProjectResource.getUrl(), true))
```

## Customizing the restored notification

When the record is restored, a notification is sent. To change its title, use `successNotificationTitle()`:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .successNotificationTitle('Post restored')
```

To change the whole notification, pass a function to `successNotification()`. It receives the notification and returns it, or `null` to send none:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .successNotification((notification) => notification
        .title('Post restored')
        .body('The change is visible to everyone.'))
```

## Redirecting after success

`successRedirectUrl()` sets the page opened after the action. It takes a URL, or a function receiving the context:

```ts
import { RestoreAction } from '@navette-js/panels';

RestoreAction.make()
    .successRedirectUrl('/admin/posts')
```

Only URLs starting with a single `/`, `http://` or `https://` are followed.
