import { Page, PageConfiguration, type Widget } from '@navette-js/panels';
import { t } from '@navette-js/support/i18n';
import { ClockWidget } from './ClockWidget.ts';

/** Options of one clock page: its time zone, on top of the slug, title and navigation options of every page configuration. */
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

/** A page showing one clock. Register it once per time zone: `ClockPage.make('tokyo').timezone('Asia/Tokyo')`. */
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

    getHeaderWidgetsColumns(): number {
        return 1;
    }

    // The registration being served: `ClockPage.getConfiguration()` returns its options during the page's requests.
    getWidgetData(): Record<string, unknown> {
        return { timezone: ClockPage.getConfiguration()?.getTimezone() ?? null };
    }
}
