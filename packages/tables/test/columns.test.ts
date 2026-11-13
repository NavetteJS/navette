import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { ColorColumn, formatDate, IconColumn, ImageColumn, Table, TextColumn, useColorManager } from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());

const record = { title: 'Alpha', tags: ['red', 'green', 'blue'], csv: 'a, b ,c', price: 12.5, created_at: '2026-11-09 14:05:07', status: 'draft', empty: null, is_on: 1 };
const text = (column: TextColumn<any>) => column.toHtml(record);

test('`TextColumn`: a plain value keeps the short markup', async () => {
    assert.equal(await text(TextColumn.make('title')), '<div class="fi-ta-text fi-ta-text-item fi-size-sm">Alpha</div>');
    assert.equal(await text(TextColumn.make('price').money('eur').alignEnd()), '<div class="fi-ta-text fi-ta-text-item fi-size-sm fi-numeric fi-align-end">€12.50</div>');
    assert.equal(await text(TextColumn.make('title').prefix('#').suffix('!')), '<div class="fi-ta-text fi-ta-text-item fi-size-sm">#Alpha!</div>');
});

test('`TextColumn`: empty state, `placeholder()`, `default()` and `state()`', async () => {
    assert.equal(await text(TextColumn.make('empty')), '<div class="fi-ta-text"></div>');
    assert.equal(await text(TextColumn.make('empty').placeholder('—')), '<div class="fi-ta-text"><p class="fi-ta-placeholder">—</p></div>');
    assert.match(await text(TextColumn.make('empty').default('n/a')), />n\/a</);
    assert.match(await text(TextColumn.make('anything').state((row: any) => row.title.toUpperCase())), />ALPHA</);
    assert.match(await text(TextColumn.make('anything').state('fixed')), />fixed</);
});

test('`TextColumn`: item options switch to the full markup', async () => {
    assert.equal(await text(TextColumn.make('title').weight('bold').size('lg').fontFamily('mono')), '<div class="fi-ta-text-item fi-font-mono fi-size-lg fi-font-bold fi-ta-text">Alpha</div>');
    assert.equal(await text(TextColumn.make('title').wrap()), '<div class="fi-ta-text-item fi-size-sm fi-ta-text fi-wrapped">Alpha</div>');
    assert.match(await text(TextColumn.make('title').icon('m-star').iconPosition('after')), /Alpha<svg/);
    assert.match(await text(TextColumn.make('title').tooltip((row: any) => `Title: ${row.title}`)), /<span x-tooltip="\{[^"]*Title: Alpha/);
});

test('`TextColumn`: descriptions above and below, line clamp', async () => {
    const html = await text(TextColumn.make('title').description('Above', 'above').description((row: any) => `${row.status} post`));
    assert.equal(html, '<div class="fi-ta-text fi-ta-text-has-descriptions"><p class="fi-ta-text-description">Above</p><p class="fi-ta-text-item fi-size-sm">Alpha</p><p class="fi-ta-text-description">draft post</p></div>');
    assert.match(await text(TextColumn.make('title').lineClamp(2)), /fi-ta-text-has-line-clamp[^>]*><li|style="--line-clamp: 2"/);
});

test('`TextColumn`: lists, bullets, separator and limits', async () => {
    assert.equal(await text(TextColumn.make('tags')), '<div class="fi-ta-text-item fi-size-sm fi-ta-text">red, green, blue</div>');
    assert.equal(await text(TextColumn.make('tags').listWithLineBreaks()), '<ul class="fi-ta-text fi-ta-text-has-line-breaks"><li class="fi-ta-text-item fi-size-sm">red</li><li class="fi-ta-text-item fi-size-sm">green</li><li class="fi-ta-text-item fi-size-sm">blue</li></ul>');
    assert.match(await text(TextColumn.make('csv').separator(',').listWithLineBreaks().bulleted()), /^<ul class="fi-ta-text fi-bulleted fi-ta-text-has-line-breaks"><li[^>]*>a<\/li><li[^>]*>b<\/li><li[^>]*>c<\/li><\/ul>$/);
    const limited = await text(TextColumn.make('tags').listWithLineBreaks().limitList(1));
    assert.match(limited, /fi-ta-text-list-limited/);
    assert.match(limited, /and 2 more/);
    assert.doesNotMatch(limited, /green/);
    const expandable = await text(TextColumn.make('tags').listWithLineBreaks().limitList(1, true));
    assert.match(expandable, /x-data="\{ isLimited: true \}"/);
    assert.match(expandable, /<li x-show="! isLimited" x-cloak x-transition class="fi-ta-text-item fi-size-sm">green<\/li>/);
    assert.match(expandable, /Show 2 more/);
});

test('`TextColumn`: badges per item, escaped values', async () => {
    assert.match(await text(TextColumn.make('tags').badge()), /^<div class="fi-ta-text fi-ta-text-has-badges"><ul>|^<ul class="fi-ta-text fi-ta-text-has-badges"><li class="fi-ta-text-item"><span class="fi-badge fi-size-sm/);
    assert.equal(await TextColumn.make('title').toHtml({ title: '<script>' }), '<div class="fi-ta-text fi-ta-text-item fi-size-sm">&lt;script&gt;</div>');
    assert.doesNotMatch(await TextColumn.make('tags').listWithLineBreaks().toHtml({ tags: ['<b>x</b>'] }), /<b>/);
});

test('`formatDate()` and date options', async () => {
    assert.equal(formatDate('2026-11-09 14:05:07', 'M j, Y'), 'Nov 9, 2026');
    assert.equal(formatDate('2026-11-09 14:05:07', 'd/m/Y H:i'), '09/11/2026 14:05');
    assert.equal(formatDate('2026-11-09 14:05:07', 'l jS \\o\\f F, g:i A'), 'Monday 9th of November, 2:05 PM');
    assert.equal(formatDate('2026-11-09 23:30:00', 'Y-m-d H:i', 'Europe/Paris'), '2026-11-10 00:30');
    assert.match(await text(TextColumn.make('created_at').date()), />Nov 9, 2026</);
    assert.match(await text(TextColumn.make('created_at').dateTime()), />Nov 9, 2026 14:05:07</);
    assert.match(await text(TextColumn.make('created_at').date('d.m.Y')), />09\.11\.2026</);
    assert.match(await text(TextColumn.make('created_at').since()), /ago</);
});

test('`IconColumn`: boolean, custom icons and colors per state, placeholder', async () => {
    const on = await IconColumn.make('is_on').boolean().toHtml(record);
    assert.match(on, /^<div class="fi-ta-icon"><svg[^>]*fi-color-success/);
    assert.match(on, /<span class="fi-sr-only">Yes<\/span><\/div>$/);
    const off = await IconColumn.make('is_on').boolean().falseIcon(false).toHtml({ is_on: 0 });
    assert.equal(off, '<div class="fi-ta-icon"></div>');
    const custom = await IconColumn.make('status').icon((row: any) => (row.status === 'draft' ? 'o-pencil' : 'o-check')).color('warning').size('md').toHtml(record);
    assert.match(custom, /fi-color-warning/);
    assert.match(custom, /fi-size-md/);
    assert.match(custom, /<span class="fi-sr-only">draft<\/span>/);
    assert.equal(await IconColumn.make('empty').placeholder('None').alignCenter().toHtml(record), '<div class="fi-ta-icon fi-align-center"><p class="fi-ta-placeholder">None</p></div>');
});

test('columns: `hidden()` and `visible()` remove the column from the table', () => {
    let admin = false;
    const table = new Table().columns([TextColumn.make('title').searchable(), TextColumn.make('secret').searchable().visible(() => admin), TextColumn.make('gone').hidden()]);
    assert.deepEqual(table.getColumns().map((column) => column.name), ['title']);
    assert.equal(table.getColumn('secret'), undefined);
    assert.deepEqual(table.getDefaultColumnState().map((column) => column.name), ['title']);
    admin = true;
    assert.deepEqual(table.getColumns().map((column) => column.name), ['title', 'secret']);
});

test('`ImageColumn`: Filament markup, sizes, stacked, limit, default image, unsafe URLs dropped', async () => {
    const row = { photo: '/img/a.png', photos: ['/img/a.png', 'https://cdn.test/b.png', 'javascript:alert(1)', '/img/c.png'], none: null };
    assert.equal(await ImageColumn.make('photo').alt('Photo').toHtml(row), '<div class="fi-ta-image"><img alt="Photo" src="/img/a.png" style="height: 2.5rem;" /></div>');
    assert.equal(await ImageColumn.make('photo').circular().toHtml(row), '<div class="fi-ta-image fi-circular"><img alt="" src="/img/a.png" style="height: 2.5rem; width: 2.5rem;" /></div>');
    assert.equal(await ImageColumn.make('photo').imageHeight(40).imageWidth('6rem').alignCenter().toHtml(row), '<div class="fi-ta-image fi-align-center"><img alt="" src="/img/a.png" style="height: 40px; width: 6rem;" /></div>');
    assert.match(await ImageColumn.make('photo').imageHeight('1rem; background: url(x)').toHtml(row), /style="height: 2\.5rem;"/, 'a CSS length only');
    const stacked = await ImageColumn.make('photos').circular().stacked().ring(3).overlap(4).limit(2).limitedRemainingText(true, 'lg').toHtml(row);
    assert.equal(stacked, '<div class="fi-ta-image fi-circular fi-stacked fi-ta-image-ring fi-ta-image-ring-3 fi-ta-image-overlap-4"><img alt="" src="/img/a.png" style="height: 2rem; width: 2rem;" /><img alt="" src="https://cdn.test/b.png" style="height: 2rem; width: 2rem;" /><div class="fi-ta-image-limited-remaining-text fi-size-lg" style="height: 2rem; width: 2rem;">+1</div></div>');
    assert.match(await ImageColumn.make('none').defaultImageUrl('/img/default.png').toHtml(row), /src="\/img\/default\.png"/);
    assert.equal(await ImageColumn.make('none').placeholder('No image').toHtml(row), '<div class="fi-ta-image"><p class="fi-ta-placeholder">No image</p></div>');
    assert.match(await ImageColumn.make('photo').tooltip('Zoom').toHtml(row), /x-tooltip="\{/);
});

test('`ColorColumn`: swatches, list, copyable, placeholder, unsafe colors not styled', async () => {
    const row = { color: '#ff0000', colors: ['#00ff00', 'rgb(0, 0, 255)', 'red; background: url(x)'], none: '' };
    assert.equal(await ColorColumn.make('color').toHtml(row), '<div class="fi-ta-color"><div aria-label="#ff0000" role="img" class="fi-ta-color-item" style="background-color: #ff0000;"></div></div>');
    const list = await ColorColumn.make('colors').wrap().toHtml(row);
    assert.match(list, /^<div class="fi-ta-color fi-wrapped">/);
    assert.equal((list.match(/fi-ta-color-item/g) ?? []).length, 3);
    assert.doesNotMatch(list, /url\(x\)/);
    const copyable = await ColorColumn.make('color').copyable().copyMessage('Copied!').toHtml(row);
    assert.match(copyable, /x-data="filamentCopyable"/);
    assert.match(copyable, /class="fi-ta-color-item fi-copyable"/);
    assert.doesNotMatch(copyable, /role="img"/);
    assert.equal(await ColorColumn.make('none').placeholder('—').toHtml(row), '<div class="fi-ta-color"><p class="fi-ta-placeholder">—</p></div>');
});

test('summaries: prefix, suffix, formatting, hidden label, hidden summarizer, `using()` and `Values`', async () => {
    const { Model, ObjectionAdapter, sqlite } = await import('@navette-js/database');
    const { renderTable, Sum, Count, Summarizer, Values } = await import('../src/index.ts');
    class Item extends Model { static tableName = 'items'; }
    const db = sqlite(':memory:');
    try {
        await db.schema.createTable('items', (table) => { table.increments('id'); table.string('kind'); table.integer('price'); });
        await db('items').insert([{ kind: 'a', price: 10 }, { kind: 'b', price: 25 }, { kind: 'a', price: 5 }]);
        const host = { id: 'S', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 } };
        const table = new Table().columns([
            TextColumn.make('id'),
            TextColumn.make('price').summarize([
                Sum.make().prefix('~').suffix(' pts').numeric(1).hiddenLabel(),
                Count.make().hidden(),
                Summarizer.make().label('Max').using(async ({ column, records }) => Math.max(...(await records()).map((record: any) => record[column]))),
            ]),
            TextColumn.make('kind').summarize(Values.make().label('Kinds')),
        ]);
        const html = (await renderTable(table, host as any, new ObjectionAdapter(Item))).replace(/\s+/g, ' ').replace(/> </g, '><');
        assert.match(html, /<span class="fi-ta-text-summary-label fi-sr-only">Sum<\/span><span>~40\.0 pts<\/span>/);
        assert.doesNotMatch(html, />Count</);
        assert.match(html, /<span class="fi-ta-text-summary-label">Max<\/span><span>25<\/span>/);
        assert.match(html, /<div class="fi-ta-values-summary"><span class="fi-ta-values-summary-label">Kinds<\/span><ul class="fi-bulleted"><li>a<\/li><li>b<\/li><\/ul><\/div>/);
    } finally {
        await db.destroy();
    }
});

test('`TextColumn`: `html()` is sanitized, `markdown()` renders safe HTML', async () => {
    const row = { body: '<p onclick="x()">Hi <script>alert(1)</script><a href="javascript:alert(1)">there</a></p>', notes: '**Bold** <b>raw</b>' };
    const html = await TextColumn.make('body').html().toHtml(row);
    assert.match(html, /<p>Hi <a>there<\/a><\/p>/);
    assert.doesNotMatch(html, /script|onclick|javascript/);
    const markdown = await TextColumn.make('notes').markdown().toHtml(row);
    assert.match(markdown, /<p><strong>Bold<\/strong> &lt;b&gt;raw&lt;\/b&gt;<\/p>/);
    assert.match(await TextColumn.make('notes').toHtml(row), /\*\*Bold\*\* &lt;b&gt;raw&lt;\/b&gt;/, 'escaped by default');
});

test('SelectColumn: allowHtml() sanitizes labels for the JavaScript select, strips tags in the native one', async () => {
    const { SelectColumn } = await import('../src/index.ts');
    const options = { a: '<b>Bold</b><img src=x onerror=alert(1)>' };
    const js = await SelectColumn.make('status').options(options).native(false).allowHtml().toHtml({ status: 'a' } as any, 1);
    assert.match(js, /isHtmlAllowed: true/);
    assert.doesNotMatch(js, /onerror/);
    const native = await SelectColumn.make('status').options(options).allowHtml().toHtml({ status: 'a' } as any, 1);
    assert.match(native, /<option value="a">Bold<\/option>/);
});
