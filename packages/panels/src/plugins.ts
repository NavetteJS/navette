// Panel plugins: the `Plugin` contract, the `PanelPlugin` base class (`make()` / `get()`), and the panel of the current request.
import { AsyncLocalStorage } from 'node:async_hooks';
import { configured } from '@navette-js/support';
import type { Panel } from './index.ts';

/**
 * A plugin packages panel configuration so it can be reused: `panel.plugin(BlogPlugin.make())`.
 * - `register(panel)` runs inside `panel.plugin()`: register resources, pages, widgets, render hooks, navigation items, themes…
 * - `boot(panel)` runs once, when `panelRouter()` serves the panel and everything is registered. Per-request work goes in
 *   `panel.bootUsing()`, called from `register()` or `boot()`.
 */
export interface Plugin {
    /** Unique identifier among the panel's plugins, such as the package name. */
    getId?(): string;
    /** Identifier of a plugin written as a plain object (instead of `getId()`). */
    id?: string;
    register(panel: Panel): void;
    boot?(panel: Panel): void;
}

/** The identifier of a plugin: `getId()`, otherwise its `id` property. */
export function getPluginId(plugin: Plugin): string {
    const id = typeof plugin.getId === 'function' ? plugin.getId() : plugin.id;
    if (typeof id !== 'string' || id === '') throw new Error('A plugin needs an identifier: implement getId() or set an id property.');
    return id;
}

const panelScope = new AsyncLocalStorage<Panel>();
/** Runs `fn` as part of a request of this panel: `getCurrentPanel()` returns it. */
export function runWithPanel<T>(panel: Panel, fn: () => T): T { return panelScope.run(panel, fn); }
/** The panel serving the current request (its pages, their updates, their widgets), or `null` outside a request. */
export function getCurrentPanel(): Panel | null { return panelScope.getStore() ?? null; }

/**
 * Base class of a plugin with options: `BlogPlugin.make().authorResource()` creates it, `BlogPlugin.get()` returns the instance
 * registered on the current panel, to read its options. Setters store the option and return `this`; getters read it.
 */
export abstract class PanelPlugin implements Plugin {
    abstract getId(): string;
    abstract register(panel: Panel): void;
    boot(_panel: Panel): void {}

    /** A new instance; global callbacks registered with `configureUsing(BlogPlugin, …)` are applied to it. */
    static make<T extends PanelPlugin>(this: new () => T): T { return configured(new this()); }

    /** The instance registered on the given panel, by default the panel of the current request. */
    static get<T extends PanelPlugin>(this: new () => T, panel: Panel | null = getCurrentPanel()): T {
        if (!panel) throw new Error(`${this.name}.get() was called outside a panel request: pass the panel.`);
        return panel.getPlugin(new this().getId()) as T;
    }
}
