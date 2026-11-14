---
title: Rendering a form outside a panel
---

## Introduction

Forms, tables, infolists, actions and widgets are not limited to panels. Any Express application may render them in a **component** of its own: a class holding the state, rendered by an EJS view, and updated by the browser through the same runtime as the panel pages. Signed state, CSRF tokens, the methods listed in `static callable` and the authorization of actions protect these components like they protect panel pages.

`@navette-js/panels/livewire` provides:

- `LivewireComponent`, the base class of a component with forms, infolists and actions;
- `TableComponent`, the base class of a component with a table (see [rendering a table outside a panel](/components/outside-a-panel/table));
- `Livewire`, which registers your components and serves them from your Express application.

## Setting up the components

Create one `Livewire` instance, register your components, and mount its router once, before your own routes:

```ts
import express from 'express';
import { Color } from '@navette-js/support';
import { Livewire } from '@navette-js/panels/livewire';
import { CreatePost } from './livewire/CreatePost.ts';

const livewire = new Livewire({ key: process.env.APP_KEY!, colors: { primary: Color.Indigo } });
livewire.components([CreatePost]);

const app = express();
app.use(livewire.router());

// A full page showing the component:
app.get('/posts/create', livewire.page(CreatePost, { title: 'Create a post' }));
```

`components()` registers each class under a name made from the class name: `CreatePost` is `create-post`. `component('name', Class)` gives another name. The router serves the endpoints of the components (under `/_navette/livewire` by default; change it with the `path` option), the stylesheet, the scripts and the fonts.

The options of `Livewire` are:

| Option | Description |
| --- | --- |
| `key` | Secret key signing the state of the components, at least 32 characters. Keep it secret, like a panel's key. |
| `path` | Path of the endpoints, `_navette` by default. |
| `user` | A function returning the signed-in user of a request, from your own authentication, or `null` for a guest. Components are open to guests by default. |
| `colors` | The colors of the components, like a panel's `setColors()`. |
| `uploads` | Directory of the temporary files of upload fields. Without it, uploads are refused; with it, they are accepted from signed-in users only. |
| `locale` | Locale of the runtime. |

`livewire.panel` holds the remaining configuration (font, theme, dark mode), with the methods of a panel.

## Adding the form

A component with a form needs:

1. a public property holding the state of the form, `data`;
2. a `formSchema()` method building the form; the schema named `form` keeps its state in `data`;
3. a `mount()` method filling the form, with `fillSchema()`, even when it starts empty;
4. a method handling the submission, listed in `static callable`. It validates the form with `validateSchema()` and reads the validated state with `getSchemaState()`.

```ts
import { fillSchema, getSchemaState, MarkdownEditor, TextInput, validateSchema } from '@navette-js/forms';
import { Notification } from '@navette-js/panels';
import { LivewireComponent } from '@navette-js/panels/livewire';
import type { Schema } from '@navette-js/schemas';

export class CreatePost extends LivewireComponent {
    static view = new URL('./create-post.ejs', import.meta.url);
    static callable = ['create'];

    data: Record<string, unknown> = {};

    mount(): void {
        fillSchema(this.getSchema('form'), this.data);
    }

    formSchema(schema: Schema): Schema {
        return schema.components([
            TextInput.make('title').required(),
            MarkdownEditor.make('content'),
        ]);
    }

    async create(): Promise<void> {
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) return;
        const post = await Post.query().insert(await getSchemaState(form));
        Notification.make().success().title('Post created').send();
    }
}
```

Then render the form in the component's view:

```html
<div>
    <form wire:submit="create">
        <%- await schema('form') %>

        <x-button type="submit">Submit</x-button>
    </form>

    <%- await modals() %>
</div>
```

The view of a component is an async template, with a single root element. It receives the component as `page`, and these helpers, each awaited:

| Helper | Renders |
| --- | --- |
| `schema(name)` | The schema built by the `<name>Schema()` method: `schema('form')` |
| `table()` | The table of a [table component](/components/outside-a-panel/table) |
| `action(name, args)` | The button of an [action](/components/outside-a-panel/action) |
| `modals()` | The modals of the mounted actions, once per component, anywhere outside the `<form>` |
| `livewire(Component, params)` | A child component, such as a [widget](/components/outside-a-panel/widget) |

Visit the page: the form shows its fields, validates them on the server and saves the post.

<Aside variant="warning">
`data` is a public property: the browser can send any value in it. Always read the submitted values with `validateSchema()` and `getSchemaState()`, which keep only the fields of the form, validated, and authorize the operation in your method.
</Aside>

## Initializing the form with data

To edit a record, fill the form from it with `fillSchemaFromRecord()`. Keep the key of the record in a locked property, so that the browser cannot change it, and load the record again in the method that saves it:

```ts
import { fillSchemaFromRecord, getSchemaState, validateSchema } from '@navette-js/forms';
import { WireError } from '@navette-js/wire';

export class EditPost extends LivewireComponent {
    static view = new URL('./edit-post.ejs', import.meta.url);
    static callable = ['save'];
    static locked = ['record'];

    record = '';
    data: Record<string, unknown> = {};

    async mount({ record }: Record<string, unknown>): Promise<void> {
        const post = await Post.query().findById(String(record));
        if (!post) throw new WireError(404, 'Post not found.');
        this.record = String(post.id);
        fillSchemaFromRecord(this.getSchema('form'), this.data, post);
    }

    async save(): Promise<void> {
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) return;
        await Post.query().patchAndFetchById(this.record, await getSchemaState(form));
    }
}
```

The route parameters are the mount parameters: `app.get('/posts/:record/edit', livewire.page(EditPost))` passes `{ record }`. Authorize the user in `mount()` and again in `save()`: the component is a public endpoint.

## Setting a form record

`schema.record(record)` gives the fields and their functions the record being edited, as on a resource page:

```ts
formSchema(schema: Schema): Schema {
    return schema.record(this.post).components([/* ... */]);
}
```

## Saving relationships

Fields that write a relationship, such as a `Select` or `CheckboxList` with `relationship()`, a `Repeater` with `relationship()`, or a layout component saving to a singular relationship, are left out of `getSchemaState()`: they are saved once the record exists. On a resource page, the page does it; in your own component, call `saveSchemaRelationships(form, record)` after creating or updating the record:

```ts
import { getSchemaState, saveSchemaRelationships, validateSchema } from '@navette-js/forms';

async create(): Promise<void> {
    const form = this.getSchema('form');
    this._errors = await validateSchema(form);
    if (Object.keys(this._errors).length) return;
    const post = await Post.query().insert(await getSchemaState(form));
    await saveSchemaRelationships(form, post);
}
```

When editing, give the form the record (see [setting a form record](#setting-a-form-record)) before validating it, so that relationship fields load and validate against it, and call `saveSchemaRelationships(form, post)` after saving the record's own attributes.

## Saving form data to individual properties

Without a state path, each field keeps its value in the public property of the same name. Only the schema named `form` gets the `data` state path; give the schema another name, or call `statePath(null)`:

```ts
export class Subscribe extends LivewireComponent {
    email: string | null = null;

    subscribeSchema(schema: Schema): Schema {
        return schema.components([TextInput.make('email').email().required()]);
    }
}
```

The view renders it with `<%- await schema('subscribe') %>`.

## Using multiple forms

A component may host several forms: each one is a method named after it, followed by `Schema`, with its own state path:

```ts
postData: Record<string, unknown> = {};
commentData: Record<string, unknown> = {};

editPostSchema(schema: Schema): Schema {
    return schema.statePath('postData').components([TextInput.make('title').required()]);
}

createCommentSchema(schema: Schema): Schema {
    return schema.statePath('commentData').components([TextInput.make('name').required()]);
}
```

Render each one with `<%- await schema('editPost') %>` and `<%- await schema('createComment') %>`.

## Embedding a component in your own page

`livewire.page()` serves the component in a simple document. To place it in a page of your own, with your layout, render the parts yourself: `styles()` goes in the `<head>`, `mount()` renders the component, `notifications()` the notifications, and `scripts()` goes at the end of the `<body>`:

```ts
app.get('/shop', async (req, res) => {
    res.send(`<!DOCTYPE html>
<html class="nv">
<head>${livewire.styles(req, res)}</head>
<body class="nv-body">
    <h1>Our shop</h1>
    ${await livewire.mount('list-products', {}, req, res)}
    ${await livewire.notifications(req, res)}
    ${livewire.scripts(req, res)}
</body>
</html>`);
});
```

`page()` also accepts a `layout` function, which receives these parts and returns the document. A component that refuses access throws a `WireError` from `mount()`; `page()` answers it with its status (403, 404).

## Generating a form component

The CLI creates a component and its view in `src/livewire`:

```bash
npx navette make:livewire-form CreatePost
npx navette make:livewire-form CreatePost Post --generate
npx navette make:livewire-form EditPost Post --edit --generate
```

With a model, the form creates a record of it, or edits one with `--edit`. `--generate` builds the fields from the columns of the model's table (`--table=` names another table).

## Testing a component

The [testing helpers](/testing/overview) mount these components too. Pass the panel of your `Livewire` instance:

```ts
import { livewire as test } from '@navette-js/panels/testing';

await test(CreatePost, {}, { panel: livewire.panel, user: null })
    .fillForm({ title: 'Hello' })
    .call('create')
    .assertHasNoFormErrors()
    .assertNotified('Post created');
```
