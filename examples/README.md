# Example plugins

Two small plugins written the way a Navette plugin package is written. The demo app's `/lab` panel uses them, and so do the
tests (`packages/panels/test/plugins.test.ts`, `e2e/plugins.e2e.mjs`). The documentation walks through them in the
"Plugins" section.

- [`clock-widget`](clock-widget): a panel plugin. `ClockWidgetPlugin` (a `PanelPlugin` with `make()` / `get()` and options)
  registers a widget and one page per `ClockPage.make(key)` configuration; the package registers a view namespace and its
  translations.
- [`headings`](headings): a standalone plugin. `Heading` is a schema component usable in any form, infolist or page, with
  its own view and stylesheet.

They run as TypeScript sources in this repository. A published plugin ships JavaScript: see "Publishing a plugin" in the
documentation.
