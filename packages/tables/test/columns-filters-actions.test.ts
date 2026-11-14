import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { Action, useColorManager as useActionColorManager } from '@navette-js/actions';
import { ColorManager, resetConfigurators, views } from '@navette-js/support';
import '@navette-js/support/ui';
import { t, tc } from '@navette-js/support/i18n';
import {
    Average, BadgeColumn, ColumnGroup, Count, Filter, ImageColumn, IsRelatedToOperator, QueryBuilder, QueryBuilderOperator, Range, RelationshipConstraint, SelectColumn, SelectConstraint, SelectFilter, Sum, Table, TernaryFilter, TextColumn, TextConstraint,
    applyTableFilters, callTableColumnMethod, formatIsoDate, getFilterIndicators, getTableQuery, getTableRecords, limitText, limitWords, mergeIntoFirstTag, recordMatchesTableFilters, renderTable, updateTableColumnState, useColorManager, type TableHost,
} from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());
useActionColorManager(new ColorManager());

class Author extends Model { static tableName = 'authors'; }
class Post extends Model {
    static tableName = 'posts';
    static get relationMappings() { return { author: { relation: Model.BelongsToOneRelation, modelClass: Author, join: { from: 'posts.author_id', to: 'authors.id' } } }; }
    id!: number;
    title!: string;
    status!: string;
    author_id!: number;
    price!: number;
    published_at!: string | null;
}
let db: Knex;
const adapter = new ObjectionAdapter(Post);
const host = (over: Partial<TableHost> = {}): TableHost => ({ id: 'H', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 }, ...over });
const clean = (html: string) => html.replace(/\s+/g, ' ').replace(/> </g, '><').replace(/> /g, '>').replace(/ </g, '<');
const post = (over: Record<string, unknown> = {}) => Object.assign(new Post(), { id: 1, title: 'Hello world, this is a long title', status: 'draft', author_id: 1, price: 123456, published_at: '2026-03-05 14:30:00', ...over });

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('authors', (t) => { t.increments('id'); t.string('first_name'); t.string('last_name'); });
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); t.string('status'); t.integer('author_id'); t.integer('price'); t.string('published_at'); });
    await db('authors').insert([{ first_name: 'Ada', last_name: 'Lovelace' }, { first_name: 'Linus', last_name: 'Torvalds' }, { first_name: 'Grace', last_name: 'Hopper' }]);
    await db('posts').insert([
        { title: 'Alpha', status: 'draft', author_id: 1, price: 1000, published_at: '2026-03-05 14:30:00' },
        { title: 'Beta', status: 'published', author_id: 2, price: 2550, published_at: null },
        { title: 'Gamma', status: 'published', author_id: 3, price: 99, published_at: '2026-04-01 08:00:00' },
    ]);
});
after(() => db.destroy());

test('column options: URL in a new tab, disabled click, header tooltip, alignments and extra attributes', async () => {
    const table = new Table<Post>().recordUrl((record) => `/posts/${record.id}`).columns([
        TextColumn.make('title').url((record) => `https://example.com/${record.id}`, true).headerTooltip('The post title').alignStart(),
        TextColumn.make('status').disabledClick().verticallyAlignStart().alignRight()
            .extraAttributes((record) => ({ 'data-status': record.status, onclick: 'alert(1)', class: 'my-status' }))
            .extraCellAttributes({ 'data-cell': '"quoted"', class: 'status-cell' })
            .extraHeaderAttributes({ 'data-header': 'status', style: 'min-width: 10rem' }),
    ]);
    const html = clean(await renderTable(table, host(), adapter));
    assert.match(html, /<a href="https:\/\/example.com\/1" target="_blank" class="fi-ta-col fi-ta-col-has-column-url">/);
    assert.match(html, /<span x-tooltip="\{ content: &#039;The post title&#039;, theme: \$store.theme, \}" class="fi-ta-header-cell-tooltip">Title<\/span>/);
    // `disabledClick()`: the record URL does not wrap the cell.
    assert.match(html, /data-cell="&quot;quoted&quot;" class="fi-ta-cell fi-ta-cell-status fi-align-right fi-vertical-align-start status-cell"><div class="fi-ta-col"><div class="fi-ta-text fi-ta-text-item fi-size-sm fi-align-right my-status" data-status="draft">/);
    assert.doesNotMatch(html, /onclick/);
    assert.match(html, /<th scope="col" data-header="status" class="fi-ta-header-cell fi-ta-header-cell-status fi-align-right" style="min-width: 10rem">/);
    // Neither column links to the record: one has its own URL, the other a disabled click.
    assert.doesNotMatch(html, /href="\/posts\//);
    assert.match(clean(await renderTable(new Table<Post>().recordUrl((record) => `/posts/${record.id}`).columns([TextColumn.make('title')]), host(), adapter)), /<a href="\/posts\/2"/);
    assert.equal(TextColumn.make('a').alignLeft().getAlignment(), 'left');
    assert.equal(TextColumn.make('a').alignStart(false).getAlignment(), null);
    assert.equal(TextColumn.make('a').verticalAlignment('middle' as any).getVerticalAlignment(), null);
    // Attributes merged into the first tag: classes add up, others replace, names are checked.
    assert.equal(mergeIntoFirstTag('<div class="a" title="x">t</div>', { class: 'b', title: 'y', 'bad name': 1, style: 'color: red' }), '<div class="a b" style="color: red" title="y">t</div>');
});

test('column groups: label, alignment, header wrapping, extra attributes and placeholder cells', async () => {
    const group = ColumnGroup.make<Post>('Details', [TextColumn.make('status'), TextColumn.make('price')]).alignment('center').wrapHeader().extraHeaderAttributes({ 'data-group': 'details' }).hiddenFrom('md');
    const html = clean(await renderTable(new Table<Post>().columns([TextColumn.make('title'), group]), host(), adapter, { bulkActions: ['<button>Delete</button>'] }));
    assert.match(html, /<tr class="fi-ta-table-head-groups-row"><th><\/th><th><\/th><th colspan="2" scope="colgroup" data-group="details" class="fi-ta-header-group-cell fi-wrapped fi-align-center md:fi-hidden">Details<\/th><\/tr>/);
    assert.equal(group.getLabel(), 'Details');
    assert.match(html, /fi-ta-header-cell-price fi-grouped/);
});

test('TextColumn: date tooltips, ISO formats, numbers and money with a locale, limits', async () => {
    const record = post();
    assert.match(await TextColumn.make('published_at').since().dateTooltip().toHtml(record), /x-tooltip="\{[^"]*content: &#039;Mar 5, 2026&#039;/);
    assert.ok((await TextColumn.make('published_at').dateTimeTooltip('d/m/Y H:i').toHtml(record)).includes('content: &#039;05\\/03\\/2026 14:30&#039;'));
    assert.match(await TextColumn.make('published_at').timeTooltip().toHtml(record), /content: &#039;14:30:00&#039;/);
    assert.match(await TextColumn.make('published_at').date().sinceTooltip().toHtml(record), /content: &#039;\d+ \w+ ago&#039;/);
    assert.ok((await TextColumn.make('published_at').isoDateTooltip().toHtml(record)).includes('content: &#039;03\\/05\\/2026&#039;'));
    assert.match(await TextColumn.make('published_at').isoDateTimeTooltip(null, 'Europe/Paris').toHtml(record), /content: &#039;March 5, 2026 3:30 PM&#039;/);
    assert.match(await TextColumn.make('published_at').isoTimeTooltip().toHtml(record), /content: &#039;2:30 PM&#039;/);
    assert.match(await TextColumn.make('published_at').isoDate().toHtml(record), />03\/05\/2026</);
    assert.match(await TextColumn.make('published_at').isoDateTime().toHtml(record), />March 5, 2026 2:30 PM</);
    assert.match(await TextColumn.make('published_at').isoTime('HH:mm [h]').toHtml(record), />14:30 h</);
    assert.match(await TextColumn.make('published_at').isoDate('dddd Do MMMM YYYY').toHtml(record), />Thursday 5th March 2026</);
    // An empty date has no tooltip.
    assert.doesNotMatch(await TextColumn.make('published_at').dateTooltip().placeholder('-').toHtml(post({ published_at: null })), /x-tooltip/);
    assert.match(await TextColumn.make('price').numeric({ decimalPlaces: 2, locale: 'fr' }).toHtml(record), />123 456,00</);
    assert.match(await TextColumn.make('price').numeric(1, ',', '.').toHtml(record), />123.456,0</);
    assert.match(await TextColumn.make('price').numeric(null, null, null, 0, 'de').toHtml(post({ price: 1234.5678 })), />1.235</);
    assert.match(await TextColumn.make('price').money('eur', 100, 'fr').toHtml(record), />1 234,56 €</);
    assert.match(await TextColumn.make('price').money('usd', { divideBy: 100, decimalPlaces: 0 }).toHtml(record), />\$1,235</);
    const limited = TextColumn.make('title').limit(10, ' (more)');
    assert.equal(limited.getCharacterLimit(), 10);
    assert.equal(limited.getCharacterLimitEnd(), ' (more)');
    assert.match(await limited.toHtml(record), />Hello worl \(more\)</);
    assert.match(await TextColumn.make('title').words(3, '…').toHtml(record), />Hello world, this…</);
    assert.equal(TextColumn.make('title').words(3).getWordLimit(), 3);
    // HTML is not truncated (its markup would break).
    assert.match(await TextColumn.make('title').html().limit(5).toHtml(post({ title: '<strong>Bold text here</strong>' })), /<strong>Bold text here<\/strong>/);
    assert.equal(limitText('abc  def', 4), 'abc...');
    assert.equal(limitWords('one two three', 5), 'one two three');
    assert.equal(formatIsoDate(new Date('2026-03-05T14:30:00Z'), 'LLLL'), 'Thursday, March 5, 2026 2:30 PM');
});

test('ImageColumn: extra img attributes, without overriding the source', async () => {
    const column = ImageColumn.make('title').extraImgAttributes((_record, state) => ({ loading: 'lazy', 'data-src': String(state), src: 'https://evil.example/x.png', onerror: 'alert(1)' }));
    const html = await column.toHtml(post({ title: '/images/a.png' }));
    assert.match(html, /<img alt="" src="\/images\/a.png" style="height: 2.5rem;" loading="lazy" data-src="\/images\/a.png" \/>/);
    assert.doesNotMatch(html, /evil|onerror/);
});

test('SelectColumn: server-side search, labels, messages, aliases, and forged values refused', async () => {
    const statuses: Record<string, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' };
    const column = SelectColumn.make<Post>('status')
        .getOptionsSearchResultsUsing((search) => Object.fromEntries(Object.entries(statuses).filter(([, label]) => label.toLowerCase().includes(search.toLowerCase()))))
        .getOptionLabelUsing((value) => statuses[value] ?? null)
        .optionsSearchDebounce(300).optionsLoadingMessage('Loading statuses').noOptionsMessage('No statuses').noOptionsSearchResultsMessage('No match').optionsSearchPrompt('Type a status').optionsSearchingMessage('Looking...')
        .allowOptionsHtml().wrapOptionLabels(false);
    const decode = (text: string) => text.replace(/&#039;/g, "'").replace(/&quot;/g, '"');
    const html = decode(await column.toHtml(post(), 1));
    for (const fragment of ['hasDynamicSearchResults: true', 'hasInitialNoOptionsMessage: false', "initialOptionLabel: 'Draft'", 'searchDebounce: 300', "loadingMessage: 'Loading statuses'", "noOptionsMessage: 'No statuses'", "noSearchResultsMessage: 'No match'", "searchPrompt: 'Type a status'", "searchingMessage: 'Looking...'", 'isHtmlAllowed: true', 'canOptionLabelsWrap: false', 'isSearchable: true']) assert.ok(html.includes(fragment), fragment);
    assert.deepEqual(await column.getOptionsSearchResults(post(), 'arch'), [['archived', 'Archived']]);
    assert.equal(await column.validateFor(post(), 'archived'), null);
    assert.equal(await column.validateFor(post(), 'deleted'), 'The selected status is invalid.');
    assert.equal(await column.validateFor(post(), ['draft']), 'The selected status is invalid.');
    assert.equal(await column.validateFor(post(), { toString: () => 'draft' }), 'The selected status is invalid.');
    // Defaults: Filament's table messages.
    const plain = decode(await SelectColumn.make('status').options(statuses).native(false).toHtml(post(), 1));
    assert.ok(plain.includes("noOptionsMessage: 'No options available.'") && plain.includes("searchPrompt: 'Start typing to search'"));
    assert.deepEqual(SelectColumn.make('s').searchOptionValues().getSearchableOptionFields(), ['label', 'value']);

    // Relationship: searched on the server, labels from the related record, a forged key is refused.
    const author = () => SelectColumn.make<Post>('author_id').optionsRelationship('author', 'last_name').searchableOptions(['first_name', 'last_name']).getOptionLabelFromRecordUsing((record) => `${record.first_name} ${record.last_name}`);
    const record = (await Post.query().findById(1))!;
    assert.deepEqual(await author().getOptionsFor(record), [], 'searched on the server: not listed up front');
    assert.deepEqual(await author().getOptionsSearchResults(record, 'lin'), [['2', 'Linus Torvalds']]);
    assert.deepEqual(await author().getOptionsSearchResults(record, '%'), [], 'LIKE wildcards are matched literally');
    assert.deepEqual(await author().preloadOptions().getOptionsFor(record), [['3', 'Grace Hopper'], ['1', 'Ada Lovelace'], ['2', 'Linus Torvalds']]);
    assert.ok((await author().toHtml(record, 1)).includes('initialOptionLabel: &#039;Ada Lovelace&#039;'));
    assert.equal(await author().validateFor(record, '3'), null);
    assert.equal(await author().validateFor(record, '99'), 'The selected author id is invalid.');
    const limited = SelectColumn.make<Post>('author_id').optionsRelationship('author', 'last_name', (query: any) => query.where('id', '<', 3));
    assert.equal(await limited.validateFor(record, '3'), 'The selected author id is invalid.', 'outside the modified relationship query');
    // Remembered options: the function runs once per request.
    let calls = 0;
    const remembered = SelectColumn.make<Post>('status').options(() => { calls++; return statuses; }).rememberOptions();
    await remembered.getOptionsFor(record); await remembered.getOptionsFor(record);
    assert.equal(calls, 1);
});

test('callTableColumnMethod(): only exposed methods of a visible select column, for a record in scope', async () => {
    const table = new Table<Post>().columns([
        TextColumn.make('title'),
        SelectColumn.make<Post>('author_id').optionsRelationship('author', 'last_name').searchableOptions(),
        SelectColumn.make<Post>('status').options({ draft: 'Draft' }).hidden(),
    ]);
    const scoped = new ObjectionAdapter(Post, { modify: (query) => query.where('posts.id', '<', 3) });
    assert.deepEqual(await callTableColumnMethod(table, host(), scoped, 'author_id', '1', 'getOptionsSearchResultsForJs', { search: 'hop' }), [{ label: 'Hopper', value: '3', isDisabled: false }]);
    assert.equal(await callTableColumnMethod(table, host(), scoped, 'author_id', '1', 'getOptionLabel'), 'Lovelace');
    assert.equal(await callTableColumnMethod(table, host(), scoped, 'author_id', '3', 'getOptionLabel'), null, 'record outside the scope');
    assert.equal(await callTableColumnMethod(table, host(), scoped, 'author_id', '1', 'updateState'), null, 'not exposed');
    assert.equal(await callTableColumnMethod(table, host(), scoped, 'author_id', '1', 'constructor'), null);
    assert.equal(await callTableColumnMethod(table, host(), scoped, 'status', '1', 'getOptionsForJs'), null, 'hidden column');
    assert.equal(await callTableColumnMethod(table, host(), scoped, 'title', '1', 'getOptionsForJs'), null, 'not a select column');
    assert.equal(await callTableColumnMethod(table, host(), scoped, 'author_id', { id: 1 }, 'getOptionLabel'), null);
    // A forged value written through the same column is refused.
    assert.deepEqual(await updateTableColumnState(table, host(), scoped, 'author_id', '1', '42'), { error: 'The selected author id is invalid.' });
});

test('filters: modifyFormFieldUsing(), baseQuery(), excludeWhenResolvingRecord(), SelectFilter labels from records', async () => {
    const select = SelectFilter.make('status').options({ draft: 'Draft', published: 'Published' }).modifyFormFieldUsing((field) => field.native(false).placeholder('Any status'));
    assert.equal((select.getFormComponents()[0] as any)._native, false);
    assert.equal((TernaryFilter.make('is_featured').modifyFormFieldUsing((field) => field.label('Featured?')).getFormComponents()[0] as any)._label, 'Featured?');
    assert.equal((Filter.make('cheap').modifyFormFieldUsing((field) => field.label('Cheap only')).getFormComponents()[0] as any)._label, 'Cheap only');
    // `baseQuery()` applies whatever the select's state; not for an unchecked checkbox filter.
    const table = new Table<Post>().columns([TextColumn.make('title')]).filters([
        SelectFilter.make('status').options({ draft: 'Draft', published: 'Published' }).baseQuery((query) => query.where('price', '>', 100)),
        Filter.make('cheap').query((query) => query.where('price', '<', 2000)).baseQuery((query) => query.where('id', '>', 0)).excludeWhenResolvingRecord(),
    ]);
    const titles = async (state: Record<string, unknown>) => (await getTableRecords(table, host({ tableFilters: state as any }), adapter)).records.map((record: any) => record.title);
    assert.deepEqual(await titles({}), ['Alpha', 'Beta']);
    assert.deepEqual(await titles({ status: { value: 'published' }, cheap: { isActive: true } }), []);
    assert.deepEqual(await titles({ cheap: { isActive: true } }), ['Alpha']);
    // A forged select value is not an option: the filter does nothing.
    assert.deepEqual(await titles({ status: { value: "draft' OR 1=1 --" } }), ['Alpha', 'Beta']);
    // Resolving a row action's record: the record must match the filters, except `excludeWhenResolvingRecord()` ones.
    const filtered = host({ tableFilters: { status: { value: 'draft' }, cheap: { isActive: true } } as any });
    assert.equal(await recordMatchesTableFilters(table, filtered, adapter, '1'), true);
    assert.equal(await recordMatchesTableFilters(table, filtered, adapter, '2'), false, 'not a draft');
    const query = { keys: ['2'] };
    applyTableFilters(table, host({ tableFilters: { cheap: { isActive: true } } as any }), query as any, { resolvingRecord: true });
    assert.equal((query as any).modifiers.length, 2, 'both base queries, no cheap condition');
    // Labels of a relationship filter from the related record, in the options and the indicator.
    const byAuthor = new Table<Post>().columns([TextColumn.make('title')]).filters([SelectFilter.make('author').relationship('author', 'last_name').getOptionLabelFromRecordUsing((record) => `${record.first_name} ${record.last_name}`)]);
    assert.deepEqual(await (byAuthor.getFilters()[0] as SelectFilter).getFormOptions({ getDataAdapterForTable: () => adapter }), [['3', 'Grace Hopper'], ['1', 'Ada Lovelace'], ['2', 'Linus Torvalds']]);
    const authorHost = Object.assign(host({ tableFilters: { author: { value: '2' } } as any }), { getDataAdapterForTable: () => adapter });
    const html = await renderTable(byAuthor, authorHost, adapter);
    assert.match(html, /Author: Linus Torvalds/);
    assert.deepEqual(getFilterIndicators(byAuthor, authorHost).map((indicator) => indicator.label), ['Author: Linus Torvalds']);
});

test('filters actions and selection: remove-all action, deselect when filtered, selectable(), selectGroupsOnly()', async () => {
    const filters = () => [SelectFilter.make('status').options({ draft: 'Draft' })];
    const filtered = host({ tableFilters: { status: { value: 'draft' } } as any });
    const custom = clean(await renderTable(new Table<Post>().columns([TextColumn.make('title')]).filters(filters()).filtersRemoveAllAction((action) => action.label('Clear').link().color('danger')), filtered, adapter, { filtersForm: '' }));
    assert.match(custom, /<button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" wire:target="removeTableFilters,removeTableFilter" wire:click="removeTableFilters" class="fi-ac-link-action fi-link fi-size-sm[^"]*"><svg[\s\S]*?<\/svg><span class="fi-link-label">Clear<\/span><\/button>/);
    const hidden = clean(await renderTable(new Table<Post>().columns([TextColumn.make('title')]).filters(filters()).filtersRemoveAllAction((action) => action.hidden()), filtered, adapter, { filtersForm: '' }));
    assert.doesNotMatch(hidden, /removeTableFilters"/);
    assert.match(clean(await renderTable(new Table<Post>().columns([TextColumn.make('title')]).filters(filters()), filtered, adapter, { filtersForm: '' })), /aria-label="Remove all filters"/);

    const base = () => new Table<Post>().columns([TextColumn.make('title')]);
    assert.match(await renderTable(base(), host(), adapter, { bulkActions: ['<b>x</b>'] }), /canTrackDeselectedRecords: true,/);
    assert.match(await renderTable(base().deselectAllRecordsWhenFiltered(false), host(), adapter, { bulkActions: ['<b>x</b>'] }), /canTrackDeselectedRecords: false,/);
    // `selectable()`: checkboxes without bulk actions; `selectable(false)`: none despite bulk actions.
    const selectable = await renderTable(base().selectable(), host(), adapter);
    assert.equal((selectable.match(/class="fi-ta-record-checkbox/g) ?? []).length, 3);
    assert.match(selectable, /class="fi-ta-selection-indicator"/);
    assert.equal((await renderTable(base().selectable(false), host(), adapter, { bulkActions: ['<b>x</b>'] })).includes('fi-ta-record-checkbox'), false);
    assert.equal((await renderTable(base(), host(), adapter)).includes('fi-ta-record-checkbox'), false);
    // `selectGroupsOnly()`: no "select all" and no page checkbox; group checkboxes stay.
    const groups = await renderTable(base().groups(['status']).selectGroupsOnly(), host({ tableGrouping: 'status' }), adapter, { bulkActions: ['<b>x</b>'] });
    assert.doesNotMatch(groups, /x-on:click="selectAllRecords"|fi-ta-page-checkbox/);
    assert.match(groups, /fi-ta-group-checkbox/);
    assert.equal(base().persistGroupInSession().persistsGroupingInSession(), true);
});

test('modifyUngroupedRecordActionsUsing(): every record action outside a group, declared before or after', () => {
    const edit = Action.make('edit'), view = Action.make('view');
    const groupAction = Action.make('delete');
    const group = { getActions: () => [groupAction] };
    const touched: string[] = [];
    new Table().recordActions([edit, group]).modifyUngroupedRecordActionsUsing((action) => { touched.push(action.getName()); action.iconButton(); });
    assert.deepEqual(touched, ['edit']);
    assert.equal(edit.getView(), 'icon-button');
    const later: string[] = [];
    new Table().modifyUngroupedRecordActionsUsing((action) => { later.push(action.getName()); }).recordActions([view, group]);
    assert.deepEqual(later, ['view']);
});

test('actions: accessSelectedRecords() click, selected records, reportBulkProcessingFailure() counts and messages', async () => {
    const ctx = { livewire: { id: 'L' }, component: null as any, operation: null, record: null, get: () => undefined, state: undefined };
    const access = await Action.make('export').accessSelectedRecords().action(() => undefined).toHtml(ctx as any, { table: true });
    assert.match(access, /x-on:click="mountAction\('export', \{\}, JSON.parse/);
    assert.doesNotMatch(access, /wire:click=/);
    assert.match(access, /wire:target="mountAction\('export'/);
    assert.match(await Action.make('plain').action(() => undefined).toHtml(ctx as any, { table: true }), /wire:click="mountAction/);
    await assert.rejects(Action.make('x').action(async ({ action }) => action!.getSelectedRecords()).call({ livewire: {}, record: null, arguments: {}, data: {} }), /not using \[accessSelectedRecords\(\)\]/);

    const notified: Action[] = [];
    const fakeHost = {
        getSelectedTableRecords: async (fetch: boolean) => (fetch ? [{ id: 1 }, { id: 2 }, { id: 3 }] : ['1', '2', '3']),
        useSelectedTableRecordsQuery: async (use: (query: string) => unknown) => use('query'),
        notifySelectedRecordsOutcome: async (action: Action) => { notified.push(action); action.markSelectedRecordsOutcomeNotified(); },
    };
    const action = Action.make('archive').accessSelectedRecords().missingBulkProcessingFailureNotificationMessage((count) => `${count} failed silently.`).action(async ({ action: running }) => {
        for (const record of await running!.getSelectedRecords()) {
            if (record.id === 2) running!.reportBulkProcessingFailure('locked', (count, total) => `${count} of ${total} locked.`);
            if (record.id === 3) running!.reportBulkProcessingFailure();
        }
        assert.equal(await running!.getSelectedRecordsQuery((query) => `${query}!`), 'query!');
    });
    await action.call({ livewire: fakeHost, record: null, arguments: {}, data: {} });
    assert.equal(action.getTotalSelectedRecordsCount(), 3);
    assert.equal(action.getSuccessfulSelectedRecordsCount(), 1);
    assert.deepEqual(action.getBulkProcessingFailureMessages(), ['1 of 3 locked.']);
    assert.equal(action.getBulkProcessingFailureWithoutMessageCount(), 1);
    assert.equal(notified.length, 1);
    const keys = Action.make('keys').accessSelectedRecords().fetchSelectedRecords(false).action(async ({ action: running }) => { assert.deepEqual(await running!.getSelectedRecords(), ['1', '2', '3']); running!.reportBulkProcessingSuccessfulRecordsCount(2); });
    await keys.call({ livewire: fakeHost, record: null, arguments: {}, data: {} });
    assert.equal(keys.getBulkProcessingFailureWithoutMessageCount(), 1);
    assert.equal(Action.make('b').bulk().canAccessSelectedRecords(), true);
});

test('summaries: Range options, limit(), numbers and money with a locale', async () => {
    const values = { count: 3, sum: { price: 365000 }, avg: { price: 1216.6667 }, min: { title: 'Alpaca', price: 99, status: '' }, max: { title: 'Alpine', price: 2550, status: 'published' } };
    assert.equal(Range.make().minimalTextualDifference().summarize('title', values)!.value, 'Alpa - Alpi');
    assert.deepEqual(Range.minimalTextualBounds('Ada', 'Ada'), ['Ada']);
    assert.deepEqual(Range.minimalTextualBounds('Ada', 'Alan'), ['Ad', 'Al']);
    assert.deepEqual(Range.minimalTextualBounds('Ab', 'Abc'), ['Ab', 'Abc']);
    assert.equal(Range.make().limit(3, '…').summarize('title', values)!.value, 'Alp… - Alp…');
    assert.equal(Range.make().summarize('status', values)!.value, 'published');
    assert.equal(Range.make().excludeNull(false).summarize('status', values)!.value, ' - published');
    assert.equal(Sum.make().money('eur', 100, 'fr').summarize('price', values).value, '3 650,00 €');
    assert.equal(Sum.make().money('usd', { divideBy: 100, decimalPlaces: 0 }).summarize('price', values).value, '$3,650');
    assert.equal(Average.make().numeric({ decimalPlaces: 1, locale: 'de' }).summarize('price', values).value, '1.216,7');
    assert.equal(Average.make().numeric(2, ',', ' ').summarize('price', values).value, '1 216,67');
    assert.equal(Count.make().limit(1, '+').summarize('id', values).value, '3');
    assert.equal(Sum.make().limit(4).summarize('price', values).value, '365,...');
});

test('query builder: unshiftOperators(), configureUsing(), constraint groups, select constraint searched on the server', async () => {
    const first = QueryBuilderOperator.make('startsWith').label('Starts with').query((query, { settings, column }) => query.where(column, 'like', `${settings.value}%`));
    const replacement = QueryBuilderOperator.make('contains').label('Has');
    const constraint = TextConstraint.make('title').unshiftOperators([first, replacement]);
    assert.deepEqual(constraint.getAvailableOperators().map((operator) => operator.name), ['contains', 'startsWith', 'endsWith', 'equals']);
    assert.equal(constraint.getAvailableOperators()[0].label(false), 'Has');
    assert.deepEqual(TextConstraint.make('t').operators([first]).unshiftOperators([replacement]).getAvailableOperators().map((operator) => operator.name), ['contains', 'startsWith']);
    try {
        QueryBuilder.configureUsing((filter) => filter.maxRules(7));
        TextConstraint.configureUsing((c) => c.nullable());
        assert.equal(QueryBuilder.make().getMaxRules(), 7);
        assert.equal(TextConstraint.make('a').isNullable(), true);
    } finally { resetConfigurators(); }
    // Filament's `[constraint, 'Group' => [...]]`: ungrouped constraints first, then the groups.
    const grouped = QueryBuilder.make().constraints([{ People: [TextConstraint.make('author')] }, TextConstraint.make('title'), { Dates: [TextConstraint.make('created')] }]);
    assert.deepEqual(grouped.getConstraints().map((c) => [c.name, c.getPickerGroup()]), [['title', null], ['author', 'People'], ['created', 'Dates']]);

    // A select constraint searched on the server: any scalar is a bound parameter; labels come from the callbacks.
    const labels: Record<string, string> = { draft: 'Draft', published: 'Published' };
    const status = SelectConstraint.make('status').getSearchResultsUsing((search) => Object.fromEntries(Object.entries(labels).filter(([value]) => value.includes(search)))).getOptionLabelUsing((value) => labels[value] ?? null);
    const filter = QueryBuilder.make().constraints([status]);
    const table = new Table<Post>().columns([TextColumn.make('title')]).filters([filter]);
    const state = { queryBuilder: { rules: { a: { type: 'status', data: { operator: 'is', settings: { value: 'published' } } } } } };
    assert.deepEqual((await getTableRecords(table, host({ tableFilters: state as any }), adapter)).records.map((record: any) => record.title), ['Beta', 'Gamma']);
    await filter.loadIndicatorData(state.queryBuilder as any, host());
    assert.deepEqual(filter.getIndicators(state.queryBuilder as any).map((indicator) => indicator.label), ['Status is Published']);
    const forged = { queryBuilder: { rules: { a: { type: 'status', data: { operator: 'is', settings: { value: "x' OR '1'='1" } } } } } };
    assert.deepEqual((await getTableRecords(table, host({ tableFilters: forged as any }), adapter)).records.length, 0, 'an unknown value matches nothing');
    const field = (status.getAvailableOperators()[0].fields() as any[])[0];
    assert.equal(field.getExposedMethods().includes('getSearchResultsForJs'), true);

    // Related records searched on the server (`searchable()` without `preload()`).
    const related = IsRelatedToOperator.make().titleAttribute('last_name').searchable().getOptionLabelFromRecordUsing((record) => `${record.first_name} ${record.last_name}`);
    const authorConstraint = RelationshipConstraint.make('author').selectable(related).model(Post);
    assert.equal(related.searchesOnServer(), true);
    assert.deepEqual(await authorConstraint.searchRelatedOptions(related, null, 'tor'), [['2', 'Linus Torvalds']]);
    assert.deepEqual(await authorConstraint.findRelatedOptions(related, null, ['1', '99']), [['1', 'Ada Lovelace']]);
    assert.equal(IsRelatedToOperator.make().searchable().preload().searchesOnServer(), false);
    assert.ok(getTableQuery(table, host()).search !== undefined);
});

test('deprecated BadgeColumn and TextColumn iconPosition(), copyableState(), inline()', async () => {
    const badge = await BadgeColumn.make('status').toHtml(post());
    assert.match(badge, /fi-badge/);
    const html = await TextColumn.make('status').icon('m-check').iconPosition('after').copyable().copyableState('DRAFT').inline().toHtml(post());
    assert.match(html, /fi-inline/);
    assert.match(html, /draft<svg/);
    assert.match(html, /DRAFT/);
});
