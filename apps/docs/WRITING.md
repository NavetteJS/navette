# Writing Navette documentation pages

The site at `apps/docs` is built from the Markdown files in `apps/docs/content`. Pages describe Navette on its own: never compare it with another framework or explain where a feature comes from. Third-party works are credited only on the [credits page](content/12-advanced/07-credits.md).

## Files

- One page per file: `content/<NN-section>/<NN-page>.md`, or one level deeper for sub-sections: `content/04-tables/02-columns/02-text.md`.
- The numeric prefixes order the sidebar and are dropped from URLs: `content/04-tables/02-columns/02-text.md` is served at `/tables/columns/text`.
- A directory may contain `_section.json` with `{ "title": "Tables" }`; otherwise the title is derived from the directory name.

## Front matter

Every page starts with:

```md
---
title: Text input
---
```

Nothing else is read from the front matter.

## Supported Markdown

Only this subset is rendered — do not use anything else:

- Headings `##`, `###`, `####` (never `#`: the title comes from the front matter). Each `##`/`###` appears in the "On this page" column.
- Paragraphs, **bold**, *italic*, `inline code`, links `[label](/forms/select#making-the-field-searchable)`.
- Internal links are absolute site paths without the numeric prefixes, optionally with an anchor (anchors are the heading text lowercased, spaces as `-`, punctuation removed).
- Bullet lists (`-`) and numbered lists (`1.`), one level of nesting (two spaces).
- Fenced code blocks with a language: ```` ```ts ````, ```` ```bash ````, ```` ```html ````, ```` ```css ````, ```` ```json ````.
- GitHub-style tables.
- Asides, on their own lines, with Markdown inside:

```md
<Aside variant="tip">
You may also pass a function to `label()`.
</Aside>
```

Variants: `tip`, `info`, `warning`, `danger`. No images, no screenshots, no other HTML.

## Live previews

Instead of screenshots, a page shows what a component looks like with a `preview` code block. At build time, the code is **run with the real Navette packages** and the HTML it renders is displayed in an isolated frame with the panel CSS (light and dark themes follow the site). The code itself is not displayed: put the preview right after the example it illustrates.

````md
```preview
// state: {"name": "Ada Lovelace"}
TextInput.make('name').label('Full name').required()
```
````

- When several packages export the same name, the schema component keeps it (`Group`, `Grid`, `Tab`…) and the `@navette-js/tables` export gets a `Table` prefix: `TableGroup` for table grouping, and likewise for any other tables class whose name is taken (`TableGrid`, `TablePanel`…). The list tab of `@navette-js/panels` is `ListTab`. Do not redeclare a name that is already in scope (`const { Block } = …` fails).
- The code is plain **JavaScript** (no type annotations, no generics, no `import`): every export of the `@navette-js/*` packages is in scope (`TextInput`, `Section`, `TextEntry`, `TextColumn`, `Action`, `Table`…).
- It is one expression — a component, an array of components, an action, an array of actions, a table, or an array of `Stat` (stats overview) — or a function body ending with `return …`.
- Optional directives, as the first lines:
  - `// state: {...}` — values shown in the form fields (JSON).
  - `// record: {...}` — the record displayed by infolist entries (JSON). Without it, components are rendered as a form.
  - `// records: [...]` — the rows of a table (JSON); a table is built with `new Table().columns([...])`. Rows get the keys `1`, `2`… in order, unless they have an `id`. Arrays and objects are kept as such (stacked images, color palettes, `author.name`).
  - `// filters: {"status": {"value": "published"}}` — the applied state of the table's filters, by filter name: rows are filtered and "Active filters" lists them.
  - `// selected: [1, 2]` — keys of the selected rows. Needs bulk actions (`groupedBulkActions()`): the checkboxes are checked, the "Bulk actions" button and the selection indicator appear, and `maxSelectableRecords()` disables the other checkboxes once the limit is reached.
  - `// errors: {"data.name": ["The name field is required."]}` — validation messages to display.
  - `// viewport: 1100` — render at a desktop width, then scale down: needed to see multi-column grids (`columns(2)` applies from the `lg` breakpoint, 1024px) and the `before-content` / `after-content` filter layouts.
  - `// width: 28rem` — maximum width of the preview content.
- A table is rendered like on a resource list page, with what it declares: filters form, header, record, bulk and empty-state actions. There is no default "Edit" link or delete bulk action, and the built-in actions of `@navette-js/panels` (`EditAction`, `DeleteBulkAction`, `CreateAction`…) need a resource: use `Action.make()` with an `icon()`, a `url()` or an empty `action()` instead.
- Interactive behaviour is not available: the page has the panel CSS but no JavaScript (no Alpine, no Livewire). Dropdowns, modals and collapsible sections stay closed, search and sorting do not respond, and charts are empty. The preview script only reproduces what Alpine shows on load: the first tab or wizard step, toggles, filters always open above, below or beside the table, and the `selected` directive. Choose examples whose initial state is meaningful: the `'above-content'` filter layout rather than the dropdown, for instance.
- Images must be absolute `https://` URLs (the previews use `ui-avatars.com` and `picsum.photos`): the site has no `/storage` directory.
- `npm run build -w @navette-js/docs` lists every preview that fails, with its page and number. A failing preview is a bug in the example (or in Navette): fix it, do not remove it silently.

## Content rules

1. **English**, direct, second person: "You may set…", "To do this, use…". Headings are gerunds ("Making the field required", "Setting a placeholder").
2. Start with `## Introduction`: what the feature is, then the simplest useful example.
3. **Document only what exists in Navette.** Check every method name, argument and default in the source (`packages/*/src`) before writing it. When a common feature is not available yet, you may say so in one short `<Aside variant="warning">`.
4. Examples are TypeScript ES modules importing from `@navette-js/<package>` (`@navette-js/panels`, `@navette-js/forms`, `@navette-js/tables`, `@navette-js/schemas`, `@navette-js/infolists`, `@navette-js/actions`, `@navette-js/support`, `@navette-js/database`, `@navette-js/wire`). Show the `import` line in the first example of a page.
5. Functions passed to components receive one context object: write `({ record, get, state }) => …` and only use properties that the source actually provides.
6. Security: say what Navette does (server-side validation, escaping, authorization checks) and what the application must still do.
7. Keep pages focused; link to related pages instead of repeating them.
