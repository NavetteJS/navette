---
title: Building a panel plugin
---

## Introduction

In this walkthrough, you will build a plugin that adds a clock widget to a panel, and pages showing the time of other time zones. The complete plugin is in the Navette repository, in `examples/clock-widget`.

Read [getting started](/plugins/getting-started) and [panel plugins](/plugins/panel-plugins) first.

## Step 1: Creating the plugin

Generate the package with the CLI, then remove the generated page, which this plugin does not need:

```bash
npx navette make:plugin ClockWidget
```

The package is in `plugins/clock-widget`. Its `package.json` declares the entry point and the Navette packages it uses; give it the name it will be published under:

```json
{
    "name": "navette-clock-widget",
    "type": "module",
    "exports": {
        ".": "./src/index.ts"
    },
    "files": ["src", "views", "lang"],
    "peerDependencies": {
        "@navette-js/panels": "*",
        "@navette-js/support": "*"
    }
}
```

## Step 2: Registering the views and translations

The entry point, `src/index.ts`, registers the package's views and translations when it is imported, and exports what the users of the plugin need:

```ts
import { views } from '@navette-js/support';
import { loadTranslationsFrom } from '@navette-js/support/i18n';

views.namespace('clock-widget', new URL('../views', import.meta.url));
loadTranslationsFrom(new URL('../lang', import.meta.url), 'clock-widget');

export { ClockWidgetPlugin } from './ClockWidgetPlugin.ts';
export { ClockWidget } from './ClockWidget.ts';
export { ClockPage, ClockPageConfiguration } from './ClockPage.ts';
```

The translations are in `lang/en/clock-widget.json`, and in `lang/fr/clock-widget.json` for French:

```json
{
    "title": "Clock",
    "description": "Current time in :timezone"
}
```

## Step 3: Creating the widget

The widget renders its view, `clock-widget::widget`. The time zone may be given by the page displaying the widget; otherwise, the widget reads the plugin's option with `ClockWidgetPlugin.get()`, which returns the plugin registered on the panel of the current request:

```ts
import { Widget } from '@navette-js/panels';
import { views } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { ClockWidgetPlugin } from './ClockWidgetPlugin.ts';
import { formatTime, safeTimezone } from './time.ts';

export class ClockWidget extends Widget {
    static isLazy = false;
    static columnSpan = 'full' as const;
    // Given by the page that shows the widget: the browser cannot change it.
    static locked = ['timezone'];

    timezone: string | null = null;

    async render(): Promise<string> {
        const timezone = safeTimezone(this.timezone ?? ClockWidgetPlugin.get().getTimezone());

        return this.wrap(views.render('clock-widget::widget', {
            heading: t('clock-widget::clock-widget.title'),
            description: t('clock-widget::clock-widget.description', { timezone }),
            timezone,
            time: formatTime(new Date(), timezone),
        }));
    }
}
```

`safeTimezone()` returns the time zone when the runtime knows it, and `UTC` otherwise, so a mistake in a configuration does not break the page. `formatTime()` formats the time with `Intl.DateTimeFormat`.

The view, `views/widget.ejs`, uses the `<x-section>` component. The server renders the current time, then Alpine.js updates it every second:

```html
<x-section :heading="heading" :description="description">
    <p
        class="clock-widget-time"
        x-data="{ time: <%= JSON.stringify(time) %>, timer: null }"
        x-init="timer = setInterval(() => { time = new Intl.DateTimeFormat('en-GB', { timeZone: <%= JSON.stringify(timezone) %>, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()) }, 1000)"
        x-on:remove="clearInterval(timer)"
        x-text="time"
    ><%= time %></p>
</x-section>
```

Every value is printed with `<%= %>`, which escapes it, including inside the Alpine.js expressions.

## Step 4: Creating a configurable page

A clock page shows the widget for one time zone. To let users add as many clock pages as they want, the page is [configurable](/plugins/configurable-resources-and-pages): each `ClockPage.make(key)` is a registration of the page, with its own slug, title and time zone. The configuration class adds the time zone to the options of every page configuration:

```ts
import { Page, PageConfiguration, type Widget } from '@navette-js/panels';
import { t } from '@navette-js/support/i18n';
import { ClockWidget } from './ClockWidget.ts';

export class ClockPageConfiguration extends PageConfiguration {
    protected _timezone = 'UTC';

    timezone(timezone: string): this {
        this._timezone = timezone;

        return this;
    }

    getTimezone(): string {
        return this._timezone;
    }
}

export class ClockPage extends Page {
    static configurationClass = ClockPageConfiguration;
    static slug = 'clock';
    static navigationIcon = 'o-clock';

    static getTitle(): string {
        return this.title ?? t('clock-widget::clock-widget.title');
    }

    getHeaderWidgets(): (typeof Widget)[] {
        return [ClockWidget];
    }

    getWidgetData(): Record<string, unknown> {
        return { timezone: ClockPage.getConfiguration()?.getTimezone() ?? null };
    }
}
```

`getWidgetData()` passes the time zone of the registration being served to the widget.

## Step 5: Creating the plugin class

The plugin class registers the widget, and the clock pages it was given. Its options have a setter, which returns the plugin, and a getter:

```ts
import { PanelPlugin, type Panel } from '@navette-js/panels';
import { type ClockPageConfiguration } from './ClockPage.ts';
import { ClockWidget } from './ClockWidget.ts';

export class ClockWidgetPlugin extends PanelPlugin {
    protected _timezone = 'UTC';
    protected _clocks: ClockPageConfiguration[] = [];
    protected _navigationGroup: string | null = null;

    getId(): string {
        return 'clock-widget';
    }

    timezone(timezone: string): this {
        this._timezone = timezone;

        return this;
    }

    getTimezone(): string {
        return this._timezone;
    }

    clocks(configurations: ClockPageConfiguration[]): this {
        this._clocks = configurations;

        return this;
    }

    navigationGroup(group: string | null): this {
        this._navigationGroup = group;

        return this;
    }

    register(panel: Panel): void {
        panel.widgets([ClockWidget]);

        if (this._clocks.length) {
            panel.pages(this._clocks.map((configuration) => configuration.getNavigationGroup() === null
                ? configuration.navigationGroup(this._navigationGroup)
                : configuration));
        }
    }
}
```

## Step 6: Using the plugin

The users of the plugin add it to their panels. The widget is shown on the dashboard, and each clock page is served at `/clock/<key>`, unless its configuration has a slug of its own:

```ts
import { ClockPage, ClockWidgetPlugin } from 'navette-clock-widget';

panel.plugin(
    ClockWidgetPlugin.make()
        .timezone('Europe/Paris')
        .navigationGroup('Clocks')
        .clocks([
            ClockPage.make('tokyo').timezone('Asia/Tokyo').title('Tokyo'),
            ClockPage.make('new-york').timezone('America/New_York').title('New York').slug('new-york-time'),
        ]),
);
```

Write these instructions in the plugin's `README.md`, with the translation keys and views an application may override.

## Step 7: Testing the plugin

Test the plugin on a panel served by `panelRouter()`, as an application would. The tests of the Navette repository do it for this plugin, in `packages/panels/test/plugins.test.ts`: they check the registered widget and pages, the time zone of each clock page, the fallback to `UTC`, and the French translation of the title. See [testing](/testing/overview) for the testing helpers.
