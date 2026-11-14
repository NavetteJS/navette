// Widget configurations: `StatsOverview.make({ status: 'active' })` registers a widget with properties of its own
// (Filament's `Widget::make([...])` / `WidgetConfiguration`). Pages, dashboards and resources accept them wherever they
// accept a widget class.
import type { Widget } from './index.ts';

/** A widget class with the properties given to each of its instances (public properties of the widget). */
export class WidgetConfiguration<W extends typeof Widget = typeof Widget> {
    readonly widget: W;
    readonly properties: Record<string, unknown>;
    constructor(widget: W, properties: Record<string, unknown> = {}) {
        this.widget = widget;
        this.properties = properties;
    }
    getWidget(): W { return this.widget; }
    getProperties(): Record<string, unknown> { return this.properties; }
}

/** A widget class, or a widget class with properties (`Widget.make({...})`). */
export type WidgetEntry<W extends typeof Widget = typeof Widget> = W | WidgetConfiguration<W>;

/** The widget class of an entry. */
export function widgetClassOf<W extends typeof Widget>(entry: WidgetEntry<W>): W { return entry instanceof WidgetConfiguration ? entry.widget : entry; }
/** The properties of an entry (none for a bare class). */
export function widgetPropertiesOf(entry: WidgetEntry): Record<string, unknown> { return entry instanceof WidgetConfiguration ? entry.properties : {}; }
