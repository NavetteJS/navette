# Clock widget for Navette

A clock widget, and pages showing the time of other time zones.

```ts
import { ClockPage, ClockWidgetPlugin } from 'navette-clock-widget';

panel.plugin(
    ClockWidgetPlugin.make()
        .timezone('Europe/Paris')
        .navigationGroup('Clocks')
        .clocks([
            ClockPage.make('tokyo').timezone('Asia/Tokyo').title('Tokyo'),
            ClockPage.make('new-york').timezone('America/New_York').title('New York'),
        ]),
);
```

The widget is added to the panel's widgets (the dashboard shows it). Each clock page is served at `/clock/<key>`, unless its
configuration has a `slug()`.

Translations: `clock-widget::clock-widget.title` and `clock-widget::clock-widget.description` (English and French). Override
them with `addTranslations('clock-widget', { en: { 'clock-widget': { title: 'Time' } } })`, and the view with
`views.overrideFrom(dir)` (`<dir>/clock-widget/widget.ejs`).
