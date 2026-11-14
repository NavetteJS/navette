---
title: Rendering an action outside a panel
---

## Introduction

An [action](/actions/overview) is a button that runs code, optionally after a modal: a confirmation, a form. In a component outside a panel, declare it in a method and render it in the view. Set up the `Livewire` instance first: see [rendering a form outside a panel](/components/outside-a-panel/form#setting-up-the-components).

## Adding the action

Add a method returning the action. It is named after the action, followed by `Action`:

```ts
import { Action } from '@navette-js/actions';
import { LivewireComponent } from '@navette-js/panels/livewire';

export class ManagePost extends LivewireComponent {
    static view = new URL('./manage-post.ejs', import.meta.url);
    static locked = ['postId'];

    postId = '';

    deleteAction(): Action {
        return Action.make('delete')
            .color('danger')
            .requiresConfirmation()
            .action(async () => {
                // Authorize the user again here: the component is a public endpoint.
                await Post.query().deleteById(this.postId);
                this.redirect('/posts');
            });
    }
}
```

The method `delete()` would work too. A method with another name, such as `deletePost()`, is not an action of the component: the browser can only mount the actions of these methods, the header actions (`getHeaderActions()`), and the actions of the schemas' components.

Render the action in the view with `action()`, and the modals once with `modals()`:

```html
<div>
    <%- await action('delete') %>

    <%- await modals() %>
</div>
```

`action()` renders nothing when the action is hidden (`hidden()`, `visible()`, or unauthorized without `authorizationTooltip()`), so the view needs no visibility check of its own. To hide markup around the action too, test the rendered string, or ask the action itself: `isVisible(ctx)` is asynchronous and needs a context (`{ livewire: this, record: null }`), so call it from the component, for instance in a method the view awaits.

```html
<% const button = await action('delete') %>
<% if (button) { %>
    <div class="danger-zone"><%- button %></div>
<% } %>
```

## Chaining actions

From an action's function, `replaceMountedAction(name, args)` closes the running action and opens another action of the same component in its place, with its own arguments, for instance to show a result once a form is submitted. The other action may be hidden: it only needs to be an action of the component:

```ts
export class ManagePost extends LivewireComponent {
    publishAction(): Action {
        return Action.make('publish')
            .schema([DateTimePicker.make('publish_at')])
            .action(async ({ data, livewire }) => {
                const post = await publishPost(this.postId, data.publish_at);
                await livewire.replaceMountedAction('share', { url: post.url });
            });
    }

    shareAction(): Action {
        return Action.make('share')
            .hidden()
            .modalHeading('Share your post')
            .modalContent(({ arguments: args }) => `Your post is live at ${String(args.url)}`)
            .modalSubmitAction(false);
    }
}
```

The same works in panel pages, resource pages and relation managers (`ctx.livewire.replaceMountedAction()`). To open a child action on top of the running one instead, see [nested actions](/actions/modals#running-an-action-on-top-of-the-modal).

## Passing action arguments

To render the same action several times, for different items, pass arguments to `action()`. The action receives them as `arguments`:

```html
<% for (const post of posts) { %>
    <h2><%= post.title %></h2>
    <%- await action('delete', { post: post.id }) %>
<% } %>
```

```ts
deleteAction(): Action {
    return Action.make('delete')
        .requiresConfirmation()
        .action(async ({ arguments: args }) => {
            // The arguments come from the browser: check them.
            await Post.query().deleteById(String(args.post)).where('author_id', this.userId);
        });
}
```

## Grouping actions

A method may return an `ActionGroup`: `action('more')` renders its dropdown, and each of its actions can be mounted.

## Testing actions

```ts
await test(ManagePost, { postId: post.id }, { panel: livewire.panel })
    .callAction('delete')
    .assertRedirect('/posts');
```

See [testing actions](/testing/actions).
