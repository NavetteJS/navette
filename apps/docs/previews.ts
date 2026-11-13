// Live previews: the code of a ```preview block runs at build time with the real packages, and the HTML it renders
// is shown in an isolated page (iframe) with the panel CSS. Previews therefore always match the current components.
//
// The code is a JavaScript expression, or a function body ending with `return`, that evaluates to schema components,
// actions, a table, an array of `Stat`, or HTML: `template(source, data)` renders an EJS view, component tags (`<x-button>`)
// included, like a view of the application. See README.md for what a preview can show. Optional directives, as the first lines of the block:
//   // state: {"name": "Ada"}          form state
//   // record: {"name": "Ada"}         record shown by infolist entries
//   // records: [{"name": "Ada"}]      table rows
//   // filters: {"status": {"value": "draft"}}   applied table filters (state of each filter, by name)
//   // selected: [1, 2]                 keys of the selected table rows (needs bulk actions)
//   // errors: {"data.name": ["…"]}    validation messages
//   // width: 32rem                    maximum width of the content
//   // viewport: 1100                  render at this width (px), then scale down — grids only get columns from the `lg` breakpoint
import * as actions from '@navette-js/actions';
import * as database from '@navette-js/database';
import * as forms from '@navette-js/forms';
import * as builder from '@navette-js/forms/builder';
import * as infolists from '@navette-js/infolists';
import * as panels from '@navette-js/panels';
import * as schemas from '@navette-js/schemas';
import * as support from '@navette-js/support';
import * as tables from '@navette-js/tables';
import { t, tc } from '@navette-js/support/i18n';
import { useColorManager as useUiColorManager } from '@navette-js/support/ui';
import { wireStyles } from '@navette-js/wire/express';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type Preview = { code: string };
export type RenderedPreview = { html: string; width: string | null; viewport: number | null; state: Record<string, unknown>; selected?: string[] };

// The same setup as a panel: colors (blue primary), views, translations.
const colors = new support.ColorManager().register({ primary: support.Color.Blue });
for (const use of [actions.useColorManager, forms.useColorManager, tables.useColorManager, infolists.useColorManager, useUiColorManager]) use(colors);
support.views.share({ t, tc, assetUrl: (file: string) => `/assets/filament/${file}` });
// HTML displayed by entries (markdown(), html()) is sanitized as in a panel.
infolists.useHtmlSanitizer((html: string) => forms.richDocumentToHtml(forms.richHtmlToDocument(html)) ?? '');

/** Names available to preview code: every export of the packages, except the global `use…` setters. */
const scope: Record<string, unknown> = {};
for (const module of [support, schemas, forms, builder, infolists, actions, tables, database, panels]) {
    for (const [name, value] of Object.entries(module)) if (!name.startsWith('use') && /^[A-Za-z_$][\w$]*$/.test(name) && !(name in scope)) scope[name] = value;
}
// Names exported by several packages (`Group`, `Grid`, `Panel`…) keep the first one above (schema components first);
// the tables export gets a `Table` prefix (`TableGroup`), and the panels list tab is `ListTab`.
for (const [name, value] of Object.entries(tables)) if (scope[name] !== value && !name.startsWith('use') && !name.startsWith('Table') && /^[A-Z]/.test(name)) scope[`Table${name}`] ??= value;
scope.ListTab = panels.Tab;
// `template(source, data)`: renders an EJS view from a file, as the application does (component tags included), and returns its HTML.
let templateDir: string | null = null;
let templateCount = 0;
scope.template = (source: string, data: Record<string, unknown> = {}) => {
    templateDir ??= mkdtempSync(path.join(tmpdir(), 'navette-docs-'));
    const file = path.join(templateDir, `preview-${++templateCount}.ejs`);
    writeFileSync(file, source);
    return new support.HtmlString(support.views.renderFile(file, data));
};
const names = Object.keys(scope);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<unknown>;

let knex: database.Knex | null = null;
let tableCount = 0;
/** In-memory SQLite table filled with the preview rows, read through an ObjectionAdapter like a real resource. */
async function adapterFor(records: Record<string, unknown>[]): Promise<database.DataAdapter> {
    knex ??= database.sqlite(':memory:');
    const name = `preview_${++tableCount}`;
    const columns = [...new Set(records.flatMap((record) => Object.keys(record)))].filter((column) => column !== 'id');
    await knex.schema.createTable(name, (table) => {
        table.increments('id');
        for (const column of columns) {
            const sample = records.find((record) => record[column] !== null && record[column] !== undefined)?.[column];
            if (typeof sample === 'number') table.float(column); else if (typeof sample === 'boolean') table.boolean(column); else table.text(column);
        }
    });
    if (records.length) await knex(name).insert(records.map((record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value !== null && typeof value === 'object' ? JSON.stringify(value) : value]))));
    // Arrays and objects are stored as JSON text: Objection parses them back, as with a JSON column of a real model.
    const json = columns.filter((column) => records.some((record) => record[column] !== null && typeof record[column] === 'object'));
    const Row = class extends database.Model { static tableName = name; static jsonAttributes = json; };
    return new database.ObjectionAdapter(Row);
}

/**
 * What a resource list page adds around its table (`ListRecords.renderTable()` in `@navette-js/panels`): the filters
 * form, header, bulk, record and empty-state actions. Unlike a list page, a preview has no default bulk action and
 * no "Edit" link: only what the table declares is shown.
 */
async function tableOptions(table: tables.Table, host: any, adapter: database.DataAdapter, ctx: any): Promise<tables.RenderTableOptions<any>> {
    const visible = async (list: any[]) => { const shown = []; for (const action of list) if (await action.isVisible(ctx)) shown.push(action); return shown; };
    const bulkActions: string[] = [];
    for (const action of await visible(table.getBulkActions() ?? [])) bulkActions.push(await action.toGroupedHtml(ctx, { table: true, bulk: true }));
    const headerActions: string[] = [];
    for (const action of await visible(table.getHeaderActions())) headerActions.push(await action.toHtml(ctx, { table: true }));
    const emptyStateActions: string[] = [];
    for (const action of await visible(table.getEmptyStateActions())) emptyStateActions.push(await action.toHtml(ctx, { table: true }));
    let filtersForm: string | null = null;
    if (table.getFilters().length) {
        // Same form as a list page: one group per filter, a query builder or other custom filter brings its own fields.
        const schema = schemas.Schema.make(host).key('tableFiltersForm').statePath(table.hasDeferredFilters() ? 'tableDeferredFilters' : 'tableFilters').columns(table.getFiltersFormColumns()).partiallyRendered().components(table.getFilters().map((filter) => {
            const custom = filter.getFormComponents?.() as schemas.Component[] | undefined;
            if (custom) return schemas.StatefulGroup.make(filter.name, custom).columnSpan(filter.getColumnSpan?.() ?? { default: 1, lg: 1 });
            const definition = filter.getFormDefinition();
            return schemas.StatefulGroup.make(filter.name, [forms.Select.make('value').label(filter.getLabel()).placeholder(definition.placeholder).options(filter.getFormOptions ? () => filter.getFormOptions!() : definition.options)]).columnSpan({ default: 1, lg: 1 });
        }));
        filtersForm = await schema.toHtml();
    }
    const rowActionsHtml = table.getRecordActions().length ? async (record: any) => {
        const key = adapter.getKey(record);
        const recordCtx = { ...ctx, record };
        const parts: string[] = [];
        for (const action of table.getRecordActions()) {
            if (action instanceof actions.ActionGroup) parts.push(await action.toHtml(recordCtx, { recordKey: key, table: true }, (item: actions.Action) => `preview.actions.${item.getName()}.${key}`));
            else if (await action.isVisible(recordCtx)) parts.push(await action.toLinkHtml(recordCtx, { recordKey: key, table: true }, `preview.actions.${action.getName()}.${key}`));
        }
        return parts.join('');
    } : undefined;
    return { bulkActions, headerActions, emptyStateActions, filtersForm, rowActionsHtml };
}

function directives(code: string): { body: string; values: Record<string, string> } {
    const values: Record<string, string> = {};
    const lines = code.split('\n');
    while (lines.length && /^\s*\/\/\s*(state|record|records|filters|selected|errors|width|viewport):/.test(lines[0])) {
        const [, key, value] = /^\s*\/\/\s*(\w+):\s*(.*)$/.exec(lines.shift()!)!;
        values[key] = value.trim();
    }
    return { body: lines.join('\n').trim(), values };
}

export async function renderPreview(preview: Preview): Promise<RenderedPreview> {
    const { body, values } = directives(preview.code);
    const json = (key: string, fallback: unknown) => (values[key] ? JSON.parse(values[key]) : fallback);
    const isBody = /(^|\n)\s*(const|let|return|class)\s/.test(body);
    const run = new AsyncFunction(...names, isBody ? body : `return (${body});`);
    const result = await run(...names.map((name) => scope[name]));
    const items = (Array.isArray(result) ? result : [result]).filter((item) => item !== null && item !== undefined);
    const host: any = { id: 'preview', _errors: json('errors', {}), data: json('state', {}), getSchema: () => null, dispatch() {}, getActionMountContext: () => ({}) };
    const context = { livewire: host, component: null as any, operation: null, record: null, get: () => undefined, state: undefined };
    let html: string;
    if (items.length === 1 && items[0] instanceof tables.Table) {
        const table = items[0] as tables.Table;
        // Applied filters: the defaults, overridden by the `// filters:` directive.
        const filters = { ...table.getDefaultFilterState(), ...json('filters', {}) };
        const tableHost = { ...host, tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: table.getDefaultPageOption(), paginators: { page: 1 }, tableGrouping: null, tableFilters: filters, tableDeferredFilters: structuredClone(filters), tableColumns: table.getDefaultColumnState() };
        tables.initializeTableGrouping(table, tableHost);
        const adapter = await adapterFor(json('records', []));
        html = await tables.renderTable(table, tableHost, adapter, await tableOptions(table, tableHost, adapter, context));
        host.tableFilters = tableHost.tableFilters;
        host.tableRecordsPerPage = tableHost.tableRecordsPerPage;
        host.tableDeferredFilters = tableHost.tableDeferredFilters;
    } else if (items.length && items.every((item) => item instanceof actions.Action || item instanceof actions.ActionGroup)) {
        const parts: string[] = [];
        for (const item of items) parts.push(item instanceof actions.Action ? await item.toHtml(context) : await (item as actions.ActionGroup).toHtml(context, {}, (action: actions.Action) => action.getName()));
        html = `<div class="fi-ac fi-align-start">${parts.join('')}</div>`;
    } else if (items.length && items.every((item) => item instanceof panels.Stat)) {
        // Same grid as StatsOverviewWidget. Charts need JavaScript and stay empty.
        const panel = { colors, assetUrl: (file: string) => `/assets/filament/${file}` } as any;
        const columns = items.length < 3 ? 3 : items.length % 3 !== 1 ? 3 : 4;
        const cells = (items as panels.Stat[]).map((stat, index) => `<div class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component">${stat.toHtml(panel, `stat-${index}`)}</div></div>`).join('');
        html = `<div class="fi-wi-widget fi-wi-stats-overview"><div class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));"><div class="fi-grid-col"><div class="fi-sc-component fi-grid-ctn"><div class="fi-sc-section"><section class="fi-section fi-section-not-contained"><div class="fi-section-content-ctn"><div class="fi-section-content fi-grid @xl:fi-grid-cols !@lg:fi-grid-cols fi-sc fi-sc-has-gap" style="--cols-cxl: repeat(${columns}, minmax(0, 1fr)); --cols-nclg: repeat(${columns}, minmax(0, 1fr)); --cols-default: repeat(1, minmax(0, 1fr));">${cells}</div></div></section></div></div></div></div></div>`;
    } else if (items.length && items.every((item) => typeof item === 'string' || item instanceof support.HtmlString)) {
        // HTML, from template(): shown as is.
        html = items.map(String).join('');
    } else if (items.length && items.every((item) => item instanceof schemas.Component)) {
        const record = json('record', null);
        const schema = schemas.Schema.make(host).key(record ? 'infolist' : 'form');
        if (record) schema.record(record); else schema.statePath('data');
        schema.components(items as schemas.Component[]);
        if (!record) {
            const given = host.data;
            host.data = {};
            if (Object.keys(given).length) forms.fillSchemaFromRecord(schema, host.data, given); else forms.fillSchema(schema, host.data);
            host.data = { ...given, ...host.data };
        }
        html = await schema.toHtml();
    } else {
        throw new Error(`the code must evaluate to schema components, actions, a table, stats or HTML (got: ${items.map((item) => item?.constructor?.name ?? typeof item).join(', ') || 'nothing'})`);
    }
    const viewport = Number(values.viewport);
    return { html, width: values.width ?? null, viewport: Number.isFinite(viewport) && viewport >= 320 && viewport <= 2000 ? viewport : null, state: { ...host.data, tableRecordsPerPage: host.tableRecordsPerPage ?? 10, tableFilters: host.tableFilters, tableDeferredFilters: host.tableDeferredFilters }, selected: (json('selected', []) as unknown[]).map(String) };
}

/** Standalone preview page. It follows the light or dark theme of the parent page and sizes its iframe. */
export function previewDocument(rendered: RenderedPreview): string {
    return `<!DOCTYPE html>
<html lang="en" class="fi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<style>[x-cloak=''],[x-cloak='x-cloak'],[x-cloak='1']{display:none!important}[x-cloak='inline-flex']{display:inline-flex!important}@media (max-width:1023px){[x-cloak='-lg']{display:none!important}}@media (min-width:1024px){[x-cloak='lg']{display:none!important}}</style>
${wireStyles()}
<link rel="stylesheet" href="/assets/fonts/inter/index.css">
${colors.renderCssVariables()}
<link rel="stylesheet" href="/assets/filament/css/filament/filament/app.css">
<style>
:root { --font-family: 'Inter Variable'; --font-family-mono: 'ui-monospace'; --font-family-serif: 'ui-serif'; }
html, body { margin: 0; background: transparent; }
.preview-root { padding: 1.5rem; ${rendered.width ? `max-width: ${rendered.width.replace(/[^\w.%-]/g, '')};` : ''} }
</style>
<script>
(() => {
    const sync = () => { try { document.documentElement.classList.toggle('dark', parent.document.documentElement.classList.contains('dark')); } catch {} };
    sync();
    try { new MutationObserver(sync).observe(parent.document.documentElement, { attributes: true, attributeFilter: ['class'] }); } catch {}
    // With a viewport, render at that width and scale the iframe down to the available width.
    const viewport = ${rendered.viewport ?? 0};
    const resize = () => {
        const frame = frameElement, box = frame?.parentElement;
        if (!frame || !box) return;
        const scale = viewport ? Math.min(1, box.clientWidth / viewport) : 1;
        if (viewport) { frame.style.width = viewport + 'px'; frame.style.transformOrigin = '0 0'; frame.style.transform = 'scale(' + scale + ')'; }
        const height = document.documentElement.scrollHeight;
        frame.style.height = height + 'px';
        box.style.height = Math.ceil(height * scale) + 'px';
    };
    // Field values are normally set client-side from the component state: copy them into the inputs.
    const state = ${JSON.stringify(rendered.state).replace(/</g, '\\u003c')};
    const valueAt = (path) => path.replace(/^data\\./, '').split('.').reduce((node, key) => (node == null ? undefined : node[key]), state);
    const fill = () => {
        for (const field of document.querySelectorAll('input, select, textarea')) {
            const model = [...field.attributes].find((attribute) => attribute.name.startsWith('wire:model'));
            if (!model) continue;
            const value = valueAt(model.value);
            if (value === undefined || value === null) continue;
            if (field.type === 'checkbox') field.checked = Array.isArray(value) ? value.map(String).includes(field.value) : Boolean(value);
            else if (field.type === 'radio') field.checked = String(value) === field.value;
            else if (field.tagName === 'SELECT' && field.multiple) for (const option of field.options) option.selected = [].concat(value).map(String).includes(option.value);
            else field.value = String(value);
        }
    };
    // Without Alpine, no tab or wizard step is active: activate the first one, as on page load.
    const activate = () => {
        for (const tabs of document.querySelectorAll('.fi-sc-tabs')) {
            tabs.querySelectorAll('[x-ref="tabsHeader"]').forEach((header) => header.removeAttribute('x-cloak'));
            tabs.querySelector('.fi-tabs-item')?.classList.add('fi-active');
            tabs.querySelector(':scope > .fi-sc-tabs-tab')?.classList.add('fi-active');
        }
        for (const wizard of document.querySelectorAll('.fi-sc-wizard')) {
            wizard.querySelectorAll('[x-cloak]').forEach((element) => { if (element.matches('.fi-sc-wizard-header, .fi-sc-wizard-header *')) element.removeAttribute('x-cloak'); });
            wizard.querySelector('.fi-sc-wizard-header-step')?.classList.add('fi-active');
            const step = wizard.querySelector('.fi-sc-wizard-step');
            step?.classList.add('fi-active');
            step?.removeAttribute('x-cloak');
        }
        // Toggles get their classes from Alpine; the server already rendered aria-checked.
        for (const toggle of document.querySelectorAll('button[role="switch"][x-bind\\\\:class]')) {
            const classes = /\\?\\s*'([^']*)'\\s*:\\s*'([^']*)'/.exec(toggle.getAttribute('x-bind:class'));
            if (classes) toggle.className += ' ' + (toggle.getAttribute('aria-checked') === 'true' ? classes[1] : classes[2]);
            toggle.removeAttribute('x-cloak');
        }
    };
    // Tables: what Alpine shows on load (filters always open above or below the content), and with the "selected"
    // directive, what depends on the selection (checkboxes, limit, bulk actions button, selection indicator).
    const selected = ${JSON.stringify(rendered.selected ?? []).replace(/</g, '\\u003c')};
    window.pluralize ??= (text, count, replace) => text.split('|')[count === 1 ? 0 : 1].replace(/:(\\w+)/g, (match, key) => replace?.[key] ?? match);
    const tables = () => {
        for (const table of document.querySelectorAll('.fi-ta')) {
            table.querySelectorAll('.fi-ta-filters[x-cloak]:not([x-show])').forEach((filters) => filters.removeAttribute('x-cloak'));
            const max = Number(/maxSelectableRecords:\\s*(\\d+)/.exec(table.getAttribute('x-data') ?? '')?.[1]) || null;
            const boxes = [...table.querySelectorAll('.fi-ta-record-checkbox')];
            for (const box of boxes) box.checked = selected.includes(box.value);
            const count = boxes.filter((box) => box.checked).length;
            if (!count) continue;
            if (max && count >= max) for (const box of boxes) if (!box.checked && box.hasAttribute('x-bind:disabled')) box.disabled = true;
            if (count === boxes.length) table.querySelectorAll('.fi-ta-page-checkbox').forEach((box) => { box.checked = true; });
            // Conditions on the selection count only, such as "getSelectedRecordsCount() && 1".
            for (const element of table.querySelectorAll('[x-show*="getSelectedRecordsCount()"]')) {
                const code = element.getAttribute('x-show').replace(/getSelectedRecordsCount\\(\\)/g, String(count));
                if (!/^(?:true|false|\\d+|[\\s()|&!])*$/.test(code) || !Function('return (' + code + ')')()) continue;
                element.removeAttribute('x-cloak');
                element.removeAttribute('hidden');
            }
            table.querySelectorAll('.fi-ta-selection-indicator [x-show="isLoading"]').forEach((spinner) => { spinner.style.display = 'none'; });
            for (const text of table.querySelectorAll('.fi-ta-selection-indicator [x-text]')) {
                try { text.textContent = Function('getSelectedRecordsCount', 'return (' + text.getAttribute('x-text') + ')')(() => count); } catch {}
            }
            // "Select all" is offered while some records are not selected, and only if the limit allows them all.
            const all = Number(table.querySelector('[x-ref="allSelectableRecordsCount"]')?.value) || 0;
            table.querySelectorAll('[x-show="canSelectAllRecords()"]').forEach((link) => { link.style.display = all && all !== count && (max === null || all <= max) ? '' : 'none'; });
        }
    };
    addEventListener('DOMContentLoaded', () => { fill(); activate(); tables(); });
    addEventListener('load', () => { resize(); new ResizeObserver(resize).observe(document.body); try { parent.addEventListener('resize', resize); } catch {} });
})();
</script>
</head>
<body class="fi-body">
<div class="preview-root">${rendered.html}</div>
</body>
</html>
`;
}

export async function closePreviews(): Promise<void> {
    await knex?.destroy();
    knex = null;
    if (templateDir) rmSync(templateDir, { recursive: true, force: true });
    templateDir = null;
}
