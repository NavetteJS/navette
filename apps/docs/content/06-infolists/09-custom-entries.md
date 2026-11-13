---
title: Custom entries
---

## Introduction

You may create your own entries, to display the state of an entry however you wish. For a one-off entry, use a [`ViewEntry`](#rendering-an-entry-with-a-function) and pass it a rendering function. For a reusable entry with its own configuration, write a [custom entry class](#custom-entry-classes).

## Rendering an entry with a function

The `ViewEntry` renders the content returned by the function passed to its `view()` method. Navette places this content in the usual entry wrapper, with the label:

```ts
import { ViewEntry } from '@navette-js/infolists';
import { e } from '@navette-js/support';

ViewEntry.make('recording')
    .view(({ state }) => `<audio controls src="${e(state)}"></audio>`)
```

The function may be `async`. It receives the [context object](/schemas/overview#component-utility-injection), plus:

- `state`, the [state](/infolists/overview#entry-content-state) of the entry, read from the record or computed by `state()`.
- `entry`, the entry instance.

<Aside variant="danger">
The HTML returned by the function is inserted as is. Escape every value that comes from a user or from the database with `e()` from `@navette-js/support`, otherwise your application will be vulnerable to XSS attacks. For URLs, also check the scheme: `e()` does not prevent a `javascript:` URL.
</Aside>

`view()` is required: rendering a `ViewEntry` without it throws an error.

### Accessing the record in the function

The context object contains the current `record`, which is useful to display several attributes in one entry:

```ts
import { ViewEntry } from '@navette-js/infolists';
import { e } from '@navette-js/support';

ViewEntry.make('author')
    .view(({ record }) => {
        const post = record as Post;

        return `<span>${e(post.author_name)}</span> <span>(${e(post.author_email)})</span>`;
    })
```

```preview
// record: {"author_name": "Ada Lovelace", "author_email": "ada@example.com"}
ViewEntry.make('author')
    .view(({ record }) => `<span>${e(record.author_name)}</span> <span>(${e(record.author_email)})</span>`)
```

The context object also contains the current `operation`, the `get()` function and the page (`livewire`).

### Rendering the entry without its wrapper

By default, the content is placed inside the entry wrapper, which renders the label. If your function renders the whole entry, including its label, use `wrapped(false)`:

```ts
import { ViewEntry } from '@navette-js/infolists';
import { e } from '@navette-js/support';

ViewEntry.make('status')
    .wrapped(false)
    .view(({ state }) => `<p><strong>Status:</strong> ${e(state)}</p>`)
```

### Rendering an EJS view

When your HTML grows beyond a few lines, you may move it to an EJS view. Register a namespace for your views once when your application starts, then render a view in the function. In a view, `<%= value %>` escapes the value and `<%- html %>` inserts it as is:

```ts
import path from 'node:path';
import { ViewEntry } from '@navette-js/infolists';
import { views } from '@navette-js/support';

views.namespace('app', path.resolve('./views'));

ViewEntry.make('recording')
    .view(({ state, record }) => views.render('app::entries.audio-player', { src: state, record }))
```

## Custom entry classes

You may create your own entry classes, which you can reuse across your project. Extend `ViewEntry`, declare a static `make()` method, and override the asynchronous `toHtml()` method. `this.getState()` returns the state of the entry, and `this.wrap()` places your content in the entry wrapper, with the label:

```ts
import { ViewEntry } from '@navette-js/infolists';
import { configured, e } from '@navette-js/support';

export class AudioPlayerEntry extends ViewEntry {
    static make(name: string): AudioPlayerEntry {
        return configured(new AudioPlayerEntry(name));
    }

    async toHtml(): Promise<string> {
        const src = await this.getState();

        return this.wrap(`<audio controls src="${e(src)}"></audio>`);
    }
}
```

Use the entry in your infolist:

```ts
import { AudioPlayerEntry } from './entries/AudioPlayerEntry.ts';

AudioPlayerEntry.make('recording')
```

Your entry inherits the features shared by all entries: `label()`, `hiddenLabel()`, `inlineLabel()`, `state()`, `default()`, `url()`, `alignment()`, the [extra content slots](/infolists/overview#adding-extra-content-to-an-entry), `hidden()`, `visible()`, `hiddenJs()`, `columnSpan()`… `this.wrap()` renders the label, the slots and the link around your content. `configured()` applies the [global settings](/infolists/overview#global-settings) registered with `AudioPlayerEntry.configureUsing()`.

<Aside variant="info">
Navette entries are not stateful components. Defining public properties on an entry class does not send them to the browser: the entry is rebuilt from your schema on every request.
</Aside>

### Accessing the context in a custom entry class

Inside the class, `this.context()` returns the [context object](/schemas/overview#component-utility-injection), with the current `record`, `operation`, the `get()` function and the page (`livewire`):

```ts
import { ViewEntry } from '@navette-js/infolists';
import { e } from '@navette-js/support';

export class AuthorEntry extends ViewEntry {
    static make(name: string): AuthorEntry {
        return new AuthorEntry(name);
    }

    async toHtml(): Promise<string> {
        const { record } = this.context();

        return this.wrap(`${e((record as Post).author_name)}`);
    }
}
```

### Adding a configuration method to a custom entry class

You may add a public method to the custom entry class that accepts a configuration value, stores it in a property, and returns the entry:

```ts
import { ViewEntry } from '@navette-js/infolists';
import { e } from '@navette-js/support';

export class AudioPlayerEntry extends ViewEntry {
    private speedValue = 1;

    static make(name: string): AudioPlayerEntry {
        return new AudioPlayerEntry(name);
    }

    speed(speed: number): this {
        this.speedValue = speed;

        return this;
    }

    async toHtml(): Promise<string> {
        const src = await this.getState();

        return this.wrap(`<audio controls src="${e(src)}" x-init="$el.playbackRate = ${Number(this.speedValue)}"></audio>`);
    }
}
```

To pass the configuration value to the custom entry class, you may use the public method:

```ts
import { AudioPlayerEntry } from './entries/AudioPlayerEntry.ts';

AudioPlayerEntry.make('recording')
    .speed(0.5)
```

#### Allowing utility injection in a custom entry configuration method

You can allow users to pass a function instead of a static value by typing the parameter with `Lazy` from `@navette-js/support`, and resolving it with `evaluate()`, which calls the function with the context object if the user passed one, or returns the value if it is static:

```ts
import { ViewEntry } from '@navette-js/infolists';
import { type ComponentContext } from '@navette-js/schemas';
import { e, evaluate, type Lazy } from '@navette-js/support';

export class AudioPlayerEntry extends ViewEntry {
    private speedValue: Lazy<number, ComponentContext> = 1;

    static make(name: string): AudioPlayerEntry {
        return new AudioPlayerEntry(name);
    }

    speed(speed: Lazy<number, ComponentContext>): this {
        this.speedValue = speed;

        return this;
    }

    async toHtml(): Promise<string> {
        const src = await this.getState();
        const speed = await evaluate(this.speedValue, this.context());

        return this.wrap(`<audio controls src="${e(src)}" x-init="$el.playbackRate = ${Number(speed)}"></audio>`);
    }
}
```

Now, you can pass a static value or a function to the `speed()` method:

```ts
import { AudioPlayerEntry } from './entries/AudioPlayerEntry.ts';

AudioPlayerEntry.make('recording')
    .speed(({ record }) => ((record as Recording).is_lecture ? 1.5 : 1))
```

## Calling entry methods from JavaScript

Sometimes you need to call a method on the entry class from JavaScript in its HTML. For example, you might want to fetch data asynchronously or perform some server-side computation.

### Exposing a method

To expose a method to JavaScript, return its name from `getExposedMethods()`:

```ts
import { ViewEntry } from '@navette-js/infolists';

export class AudioPlayerEntry extends ViewEntry {
    getExposedMethods(): string[] {
        return ['getWaveform'];
    }

    async getWaveform(): Promise<number[]> {
        const { record } = this.context();

        // Compute the waveform of the recording...

        return waveform;
    }

    // ...
}
```

<Aside variant="warning">
Only the methods returned by `getExposedMethods()` can be called from JavaScript, but being exposed does not authorize access to the method's data or operations. The arguments come from the browser: validate them, and authorize sensitive operations inside the method. Navette finds the entry in the schema even when it is hidden, so do not rely on `hidden()` to protect an exposed method.
</Aside>

### Calling the method from JavaScript

In the HTML of the entry, call the exposed method using its `$`-prefixed name. The utility is bound to this entry, which Navette locates using the entry's name:

```html
<div
    x-data="{
        waveform: null,
        async loadWaveform() {
            this.waveform = await this.$getWaveform()
        },
    }"
    x-init="loadWaveform"
>
    <!-- Render the waveform using the data -->
</div>
```

You can also use `$callSchemaComponentMethod('getWaveform')`. Arguments are passed as an object, whose values Navette passes to the method in the order of their keys.

### Preventing re-renders

By default, calling an exposed method does not re-render the page. If the page must be re-rendered after the method, override `isRenderlessMethod()` and return `false` for that method.
