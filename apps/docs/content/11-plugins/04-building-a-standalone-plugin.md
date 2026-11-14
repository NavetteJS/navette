---
title: Building a standalone plugin
---

## Introduction

In this walkthrough, you will build a plugin that adds a heading component, usable in any schema: forms, infolists and page content. A standalone plugin needs no plugin class and no registration on a panel: the application imports its components and uses them. The complete plugin is in the Navette repository, in `examples/headings`.

Read [getting started](/plugins/getting-started) and [custom components](/schemas/custom-components) first.

## Step 1: Creating the plugin

Generate a standalone package with the CLI:

```bash
npx navette make:plugin Heading --standalone
```

Rename the folder and the package to `headings`, and add a `resources` folder for the stylesheet. The `package.json` lists the folders shipped with the package and the Navette packages it uses:

```json
{
    "name": "navette-headings",
    "type": "module",
    "exports": {
        ".": "./src/index.ts"
    },
    "files": ["src", "views", "resources"],
    "peerDependencies": {
        "@navette-js/schemas": "*",
        "@navette-js/support": "*"
    }
}
```

The same steps apply to a form field, an infolist entry or a table column: see [custom fields](/forms/custom-fields), [custom entries](/infolists/custom-entries) and [custom columns](/tables/columns/custom-columns).

## Step 2: Registering the views

The entry point registers the package's view namespace when it is imported, and exports the component:

```ts
import { readFileSync } from 'node:fs';
import { views } from '@navette-js/support';

views.namespace('headings', new URL('../views', import.meta.url));

const stylesheet = readFileSync(new URL('../resources/headings.css', import.meta.url), 'utf8');

/** The component's stylesheet, as a `<style>` element. */
export function headingsStylesheet(): string {
    return `<style data-navette-headings>${stylesheet}</style>`;
}

export { Heading } from './Heading.ts';
```

## Step 3: Creating the component

The component extends `Component` from `@navette-js/schemas`. Its configuration methods store their value and return the component; `make()` passes the new instance to `configured()`, so applications may configure every heading with `configureUsing()`:

```ts
import { Component, type ComponentContext } from '@navette-js/schemas';
import { configured, evaluate, views, type Lazy } from '@navette-js/support';

const LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
type Level = (typeof LEVELS)[number];

export class Heading extends Component {
    protected _level: Level = 'h2';
    protected _content: Lazy<string, ComponentContext> = '';
    protected _color: Lazy<string | null, ComponentContext> = 'primary';

    constructor(level: number | Level) {
        super();
        this.level(level);
    }

    static make(level: number | Level = 2): Heading {
        return configured(new Heading(level));
    }

    level(level: number | Level): this {
        const tag = typeof level === 'number' ? `h${level}` : level;

        if (!(LEVELS as readonly string[]).includes(tag)) {
            throw new Error(`Heading: invalid level ${level}.`);
        }

        this._level = tag as Level;

        return this;
    }

    content(content: Lazy<string, ComponentContext>): this {
        this._content = content;

        return this;
    }

    color(color: Lazy<string | null, ComponentContext>): this {
        this._color = color;

        return this;
    }

    async toHtml(): Promise<string> {
        const context = this.context();
        const color = await evaluate(this._color, context);

        return views.render('headings::heading', {
            level: this._level,
            content: String((await evaluate(this._content, context)) ?? ''),
            // Only a color name can reach the style attribute.
            color: typeof color === 'string' && /^[a-z]+$/.test(color) ? color : null,
        });
    }
}
```

`content()` and `color()` accept a value or a function, evaluated with `evaluate()` and the schema's [context object](/schemas/overview#component-utility-injection) (`record`, `get`, `operation`…).

## Step 4: Rendering the component

The view, `views/heading.ejs`, prints the content with `<%= %>`, which escapes it. The color only reaches the `style` attribute as a color name, checked by the component:

```html
<<%= level %> class="headings-component<%= color ? ' headings-component-colored' : '' %>"<%- color ? ` style="--headings-color: var(--${color}-600); --headings-dark-color: var(--${color}-400);"` : '' %>><%= content %></<%= level %>>
```

## Step 5: Adding a stylesheet

The stylesheet, `resources/headings.css`, uses the color variables of the panel:

```css
.headings-component {
    color: var(--gray-950);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.1;
}
.headings-component-colored {
    color: var(--headings-color);
}
.dark .headings-component-colored {
    color: var(--headings-dark-color);
}
h2.headings-component { font-size: 1.75rem; }
```

### Loading the stylesheet

The application loads the stylesheet once, for each panel where the component is used, with a render hook:

```ts
import { headingsStylesheet } from 'navette-headings';

panel.renderHook('panels::styles.after', () => headingsStylesheet());
```

## Step 6: Using the component

The component is used like any schema component, in a form, an infolist or the content of a page:

```ts
import { Heading } from 'navette-headings';

schema.components([
    Heading.make(2).content('Product information').color('primary'),
    Heading.make(3).content(({ record }) => `Stock of ${record.name}`).color('warning'),
    TextInput.make('name'),
]);
```

Write these instructions in the plugin's `README.md`. The tests of the Navette repository render this component in `packages/panels/test/plugins.test.ts`, and the demo application uses it in the forms of its `/lab` panel.
