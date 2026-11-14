# Navette documentation website

The Navette documentation: Markdown pages in `content/`, turned into a static site by `build.ts` (no Markdown dependency — `markdown.ts` renders the subset described in `WRITING.md`).

```bash
npm run docs -w @navette-js/docs     # build, check, then serve on http://127.0.0.1:3300
npm run build -w @navette-js/docs    # build only, into apps/docs/dist
npm run check -w @navette-js/docs    # titles, "Introduction" first, internal links and anchors, built Markdown outputs
```

- The build also writes, for AI coding agents, a Markdown version of every page at its URL + `.md` (`/tables/columns/overview.md`, linked from the page with `<link rel="alternate" type="text/markdown">` and a "Copy page" button), `/llms.txt` (index with one-line summaries: the front matter `description`, or the first sentence of the page), `/llms-full.txt` (every page) and `/pages.json` (`agents.ts`). `DOCS_ORIGIN=https://host` makes their links absolute. `node export-markdown.ts <dir> --version=<v>` writes the copy shipped with `@navette-js/cli` (`npx navette docs`), done by `scripts/release.mjs`.
- `DOCS_PORT` changes the port of `server.ts` (3300 by default).
- `DOCS_BASE=/docs` builds a site served under a sub-path; `DOCS_OUT` changes the output directory. `server.ts` reads the same variables, so the GitHub Pages site (`DOCS_BASE=/navette`, see `.github/workflows/docs.yml`) can be checked locally: run `build.ts` then `server.ts` with `DOCS_BASE=/navette` and open http://127.0.0.1:3300/navette/. In Git Bash, set `MSYS_NO_PATHCONV=1` first, or `/navette` is turned into a Windows path.
- Pages show **live previews** instead of screenshots: each ```preview block is run at build time with the real `@navette-js/*` packages, and the rendered HTML is written to `previews/<page>-<n>.html`, displayed in an isolated frame with the panel CSS (`previews.ts`). The build lists any preview that fails. What a preview can show, its directives and its limits (no JavaScript: dropdowns and modals stay closed) are described in [`WRITING.md`](WRITING.md#live-previews).
- `examples/` holds runnable code of the guides; `node apps/docs/examples/check-first-panel.mjs` and `node apps/docs/examples/check-installation.mjs` run them against a throwaway database.

To write or edit a page, follow [`WRITING.md`](WRITING.md). The old French documentation in `navette/docs` is kept as a source of verified facts and is no longer maintained.
