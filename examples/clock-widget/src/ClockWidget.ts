import { Widget } from '@navette-js/panels';
import { views } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { ClockWidgetPlugin } from './ClockWidgetPlugin.ts';
import { formatTime, safeTimezone } from './time.ts';

/** A clock: the server renders the current time, and Alpine.js updates it every second in the browser. */
export class ClockWidget extends Widget {
    static isLazy = false;
    static columnSpan = 'full' as const;
    /** Given by the page that shows the widget; the browser cannot change it. */
    static locked = ['timezone'];

    timezone: string | null = null;

    async render(): Promise<string> {
        const timezone = safeTimezone(this.timezone ?? ClockWidgetPlugin.get().getTimezone());

        return this.wrap(views.render('clock-widget::widget', {
            heading: t('clock-widget::clock-widget.title'),
            description: t('clock-widget::clock-widget.description', { timezone }),
            timezone,
            time: formatTime(new Date(), timezone),
        }), ['clock-widget']);
    }
}
