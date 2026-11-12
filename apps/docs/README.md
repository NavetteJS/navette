# Navette documentation website

The Navette documentation: Markdown pages in `content/`, turned into a static site by `build.ts` (no Markdown dependency — `markdown.ts` renders the subset described in `WRITING.md`).

```bash
npm run docs -w @navette-js/docs     # build, check, then serve on http://127.0.0.1:3300
npm run build -w @navette-js/docs    # build only, into apps/docs/dist
npm run check -w @navette-js/docs    # titles, "Introduction" first, internal links and anchors
```

- `DOCS_PORT` changes the port of `server.ts` (3300 by default).
- `DOCS_BASE=/docs` builds a site served under a sub-path; `DOCS_OUT` changes the output directory.
- Pages show **live previews** instead of screenshots: each ```preview block is run at build time with the real `@navette-js/*` packages, and the rendered HTML is displayed in an isolated frame with the panel CSS (`previews.ts`). The build lists any preview that fails.
- `examples/` holds runnable code of the guides; `node apps/docs/examples/check-first-panel.mjs` and `node apps/docs/examples/check-installation.mjs` run them against a throwaway database.

To write or edit a page, follow [`WRITING.md`](WRITING.md). The old French documentation in `navette/docs` is kept as a source of verified facts and is no longer maintained.
