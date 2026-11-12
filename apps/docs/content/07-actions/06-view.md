---
title: View action
---

## Introduction

Navette includes an action that is able to view records. You may use it like so:

```ts
import { ViewAction } from '@navette-js/panels';

ViewAction.make()
```

```preview
ViewAction.make()
```

It is usually placed in the row actions of a table:

```ts
import { DeleteAction, EditAction, ViewAction } from '@navette-js/panels';

table.recordActions([
    ViewAction.make(),
    EditAction.make(),
    DeleteAction.make(),
])
```

The action behaves differently depending on the resource:

- When the resource has a "View" page, the action is a link to that page.
- Otherwise (a simple resource, a relation manager), the action opens a modal displaying the resource's `infolist()` schema for the record, with a "Close" button and no submit button. If the resource has no `infolist()`, the modal has no content.

Without an argument, the action uses the resource (or relation manager) of the component that hosts it. You may pass another resource explicitly: `ViewAction.make(PostResource)`.

The action is only visible for records the user is allowed to `view` according to the resource policy. To make a click on the row open it, call `recordAction('view')` on the table.

A list page also opens this action when its URL has `?tableAction=view&tableActionRecord=<key>`, after the same visibility and authorization checks. Global search results of simple resources use this to open the record.

## Displaying the modal as a slide-over

Every modal method still applies. For example, to open the infolist in a slide-over:

```ts
import { ViewAction } from '@navette-js/panels';

ViewAction.make()
    .slideOver()
    .modalWidth('md')
```
