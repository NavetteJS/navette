import { PanelPlugin, type Panel } from '@navette-js/panels';
import { ClockPage, type ClockPageConfiguration } from './ClockPage.ts';
import { ClockWidget } from './ClockWidget.ts';

/**
 * Adds a clock widget to the panel (shown on the dashboard), and one "clock" page per configuration given to `clocks()`.
 *
 * ```ts
 * panel.plugin(ClockWidgetPlugin.make().timezone('Europe/Paris').clocks([ClockPage.make('tokyo').timezone('Asia/Tokyo')]));
 * ```
 */
export class ClockWidgetPlugin extends PanelPlugin {
    protected _timezone = 'UTC';
    protected _clocks: ClockPageConfiguration[] = [];
    protected _navigationGroup: string | null = null;

    getId(): string {
        return 'clock-widget';
    }

    /** Time zone of the dashboard widget (an IANA name such as `Europe/Paris`). */
    timezone(timezone: string): this {
        this._timezone = timezone;
        return this;
    }

    getTimezone(): string {
        return this._timezone;
    }

    /** Pages showing one clock each: `ClockPage.make('tokyo').timezone('Asia/Tokyo')`. */
    clocks(configurations: ClockPageConfiguration[]): this {
        this._clocks = configurations;
        return this;
    }

    getClocks(): ClockPageConfiguration[] {
        return this._clocks;
    }

    /** Navigation group of the clock pages. */
    navigationGroup(group: string | null): this {
        this._navigationGroup = group;
        return this;
    }

    getNavigationGroup(): string | null {
        return this._navigationGroup;
    }

    register(panel: Panel): void {
        panel.widgets([ClockWidget]);

        if (this._clocks.length) {
            panel.pages(this._clocks.map((configuration) => (configuration.getNavigationGroup() === null ? configuration.navigationGroup(this._navigationGroup) : configuration)));
        }
    }

    boot(_panel: Panel): void {
        // Nothing to do once the panel is served: everything was registered in register().
    }
}
