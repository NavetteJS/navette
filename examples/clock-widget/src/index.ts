// Clock widget: an example panel plugin for Navette (plugin class, widget, configurable page, views and translations).
import { loadTranslationsFrom } from '@navette-js/support/i18n';
import { views } from '@navette-js/support';

// The package's views (`clock-widget::widget`) and translations (`clock-widget::clock-widget.title`), registered once on import.
views.namespace('clock-widget', new URL('../views', import.meta.url));
loadTranslationsFrom(new URL('../lang', import.meta.url), 'clock-widget');

export { ClockWidgetPlugin } from './ClockWidgetPlugin.ts';
export { ClockWidget } from './ClockWidget.ts';
export { ClockPage, ClockPageConfiguration } from './ClockPage.ts';
