---
title: AI coding agents
description: Give AI coding agents the documentation of your Navette version, offline with npx navette docs, online as Markdown and llms.txt, and through AGENTS.md.
---

## Introduction

AI coding agents (Claude Code, Cursor, Codex and others) write better Navette code when they read the documentation of the version you use instead of guessing method names. Navette gives them that documentation in three places:

- in your project, offline, with the `npx navette docs` command;
- on the documentation site, where every page is also available as plain Markdown, with an `llms.txt` index;
- in the `AGENTS.md` file that `npm create navette` writes at the root of a new project, which tells agents how the project works and where the documentation is.

## Instructions for agents in a new project

`npm create navette` writes two files at the root of the project:

- `AGENTS.md`: the commands (`npm run dev`, `npm test`, `npx navette migrate`, the `make:*` generators), the project structure, the conventions (no build step, `.ts` imports, automatic discovery of resources, pages and widgets, migrations, authorization, secrets in `.env`) and how to read the documentation. It describes the options you chose: the user panel, teams and the database.
- `CLAUDE.md`: a short file pointing to `AGENTS.md`, which it imports with `@AGENTS.md`, for agents that read `CLAUDE.md` rather than `AGENTS.md`.

Both files belong to your project: add your own conventions to `AGENTS.md` as the application grows (naming, business rules, how to run it locally), so every agent follows them.

## Reading the documentation offline

`@navette-js/cli`, installed in every project, ships the documentation of its version as Markdown files. Agents and people can list, search and read them without a network connection:

```bash
npx navette docs
npx navette docs search select options
npx navette docs show forms/select
npx navette docs show forms/select#searching-options
```

- `npx navette docs` lists the sections and their pages, with the path of each page. Add `--descriptions` to print a one-line summary under each page.
- `npx navette docs search <terms>` ranks the pages that contain every term (or any of them, when no page has them all), and shows up to three matching lines of each page, with their line numbers. Matches in the title and the path of a page count more than in its text. `--limit=<n>` changes the number of pages (10 by default).
- `npx navette docs show <page>` prints a page as Markdown. The page is its URL path (`tables/columns/overview`), with or without a leading `/` or a `.md` extension; a full URL of the site; the end of a path when it is unique (`columns/overview`); or a page title. Add `#` and a heading anchor to print only that section, and the sections under it.

The files are in `node_modules/@navette-js/cli/docs/`: one `.md` file per page, at its URL path, `llms.txt` (the index, with a summary of each page) and `pages.json` (the list read by the command). They always match the installed version: after an upgrade, agents read the documentation of the new version.

## Markdown versions on the site

Every page of this site has a plain Markdown version at its URL followed by `.md`: the [columns overview](/tables/columns/overview) is also at `/tables/columns/overview.md`. The Markdown version has the title as a level-1 heading, the asides as blockquotes, and links to the other pages pointing to their `.md` versions. Each page links to it with `<link rel="alternate" type="text/markdown">`, a "View as Markdown" link, and a "Copy page" button that copies the Markdown to the clipboard, to paste it into a conversation with an agent.

The site also publishes, following the `llms.txt` convention:

- [llms.txt](https://navettejs.github.io/navette/llms.txt): the index of the documentation, one section per section of the site, with a link to the Markdown version of each page and a one-line summary;
- [llms-full.txt](https://navettejs.github.io/navette/llms-full.txt): every page in one file, in navigation order.

Give these URLs to tools that read documentation from the web. The site documents the latest release; the offline copy documents the version installed in your project.

## Writing instructions for your own agents

When an agent works on Navette code outside a project created with `npm create navette`, give it the same instruction that `AGENTS.md` contains:

```md
Before using a Navette class, method or option, check it in the documentation of the installed version:
`npx navette docs search <terms>`, then `npx navette docs show <page>`.
```

The type declarations of the packages (`node_modules/@navette-js/*/lib/*.d.ts`) give the exact signatures.
