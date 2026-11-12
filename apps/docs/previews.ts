// Aperçus de la documentation : le code d'un bloc ```preview est exécuté au build avec les vrais paquets Navette,
// et le HTML qu'il produit est affiché tel quel, avec la CSS de Filament, dans une page isolée (iframe).
// L'aperçu est donc le rendu réel du composant : il suit le code de Navette sans capture d'écran à refaire.
//
// Le code est une expression JavaScript (ou un corps de fonction terminé par `return`) qui rend :
// - un ou plusieurs composants de schéma (champs, mises en page, entrées d'infolist) ;
// - une ou plusieurs actions (`Action`, `ActionGroup`) ;
// - une table (`Table`), remplie par la directive `// records:`.
// Directives facultatives, en tête du bloc :
//   // state: {"name": "Ada"}          état du formulaire
//   // record: {"name": "Ada"}         enregistrement affiché (infolist)
//   // records: [{"name": "Ada"}]      lignes d'une table
//   // errors: {"data.name": ["…"]}    erreurs de validation affichées
//   // width: 32rem                    largeur maximale de l'aperçu
//   // viewport: 1100                  rendu à cette largeur (px) puis réduit : utile pour les grilles à colonnes (point de rupture `lg`)
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

export type Preview = { code: string };
export type RenderedPreview = { html: string; width: string | null; viewport: number | null; state: Record<string, unknown> };

// Mêmes réglages qu'un panel : couleurs (primaire bleue, comme la démo), vues, traductions.
const colors = new support.ColorManager().register({ primary: support.Color.Blue });
for (const use of [actions.useColorManager, forms.useColorManager, tables.useColorManager, infolists.useColorManager, useUiColorManager]) use(colors);
support.views.share({ t, tc, assetUrl: (file: string) => `/assets/filament/${file}` });
// HTML affiché par une entrée (markdown(), html()) : nettoyé comme dans un panel, par le schéma de l'éditeur de texte enrichi.
infolists.useHtmlSanitizer((html: string) => forms.richDocumentToHtml(forms.richHtmlToDocument(html)) ?? '');

/** Noms disponibles dans le code d'un aperçu : tout ce qu'exportent les paquets (classes, fonctions), sauf les réglages globaux. */
const scope: Record<string, unknown> = {};
for (const module of [support, schemas, forms, builder, infolists, actions, tables, database, panels]) {
    for (const [name, value] of Object.entries(module)) if (!name.startsWith('use') && /^[A-Za-z_$][\w$]*$/.test(name) && !(name in scope)) scope[name] = value;
}
// `Group` et `Tab` existent dans plusieurs paquets : ceux des schémas gardent le nom court, les autres ont un alias.
scope.TableGroup = tables.Group;
scope.ListTab = panels.Tab;
const names = Object.keys(scope);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<unknown>;

let knex: database.Knex | null = null;
let tableCount = 0;
/** Table SQLite en mémoire remplie avec les lignes de l'aperçu, lue par un ObjectionAdapter comme dans une vraie resource. */
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
    const Row = class extends database.Model { static tableName = name; };
    return new database.ObjectionAdapter(Row);
}

function directives(code: string): { body: string; values: Record<string, string> } {
    const values: Record<string, string> = {};
    const lines = code.split('\n');
    while (lines.length && /^\s*\/\/\s*(state|record|records|errors|width|viewport):/.test(lines[0])) {
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
        const tableHost = { ...host, tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 }, tableGrouping: null, tableFilters: null, tableColumns: (items[0] as tables.Table).getDefaultColumnState() };
        tables.initializeTableGrouping(items[0] as tables.Table, tableHost);
        html = await tables.renderTable(items[0] as tables.Table, tableHost, await adapterFor(json('records', [])));
    } else if (items.length && items.every((item) => item instanceof actions.Action || item instanceof actions.ActionGroup)) {
        const parts: string[] = [];
        for (const item of items) parts.push(item instanceof actions.Action ? await item.toHtml(context) : await (item as actions.ActionGroup).toHtml(context, {}, (action: actions.Action) => action.getName()));
        html = `<div class="fi-ac fi-align-start">${parts.join('')}</div>`;
    } else if (items.length && items.every((item) => item instanceof panels.Stat)) {
        // Rangée de statistiques, comme StatsOverviewWidget (les courbes demandent JavaScript : elles restent vides).
        const panel = { colors, assetUrl: (file: string) => `/assets/filament/${file}` } as any;
        const columns = items.length < 3 ? 3 : items.length % 3 !== 1 ? 3 : 4;
        const cells = (items as panels.Stat[]).map((stat, index) => `<div class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component">${stat.toHtml(panel, `stat-${index}`)}</div></div>`).join('');
        html = `<div class="fi-wi-widget fi-wi-stats-overview"><div class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));"><div class="fi-grid-col"><div class="fi-sc-component fi-grid-ctn"><div class="fi-sc-section"><section class="fi-section fi-section-not-contained"><div class="fi-section-content-ctn"><div class="fi-section-content fi-grid @xl:fi-grid-cols !@lg:fi-grid-cols fi-sc fi-sc-has-gap" style="--cols-cxl: repeat(${columns}, minmax(0, 1fr)); --cols-nclg: repeat(${columns}, minmax(0, 1fr)); --cols-default: repeat(1, minmax(0, 1fr));">${cells}</div></div></section></div></div></div></div></div>`;
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
        throw new Error(`le code doit rendre des composants de schéma, des actions ou une table (reçu : ${items.map((item) => item?.constructor?.name ?? typeof item).join(', ') || 'rien'})`);
    }
    const viewport = Number(values.viewport);
    return { html, width: values.width ?? null, viewport: Number.isFinite(viewport) && viewport >= 320 && viewport <= 2000 ? viewport : null, state: { ...host.data, tableRecordsPerPage: 10 } };
}

/** Page HTML autonome d'un aperçu : CSS de Filament, couleurs, police ; thème clair ou sombre comme la page parente. */
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
    // Largeur de rendu : celle du cadre, ou une largeur « bureau » réduite à l'échelle du cadre (directive viewport).
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
    // Valeurs de l'état : Livewire les pose côté client ; ici elles sont recopiées dans les champs.
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
    // Sans Alpine, aucun onglet ni aucune étape n'est actif : le premier l'est ici, comme au chargement d'une vraie page.
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
        // Interrupteurs : Alpine choisit leurs classes d'après l'état ; le serveur a déjà posé aria-checked.
        for (const toggle of document.querySelectorAll('button[role="switch"][x-bind\\\\:class]')) {
            const classes = /\\?\\s*'([^']*)'\\s*:\\s*'([^']*)'/.exec(toggle.getAttribute('x-bind:class'));
            if (classes) toggle.className += ' ' + (toggle.getAttribute('aria-checked') === 'true' ? classes[1] : classes[2]);
            toggle.removeAttribute('x-cloak');
        }
    };
    addEventListener('DOMContentLoaded', () => { fill(); activate(); });
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

export async function closePreviews(): Promise<void> { await knex?.destroy(); knex = null; }
