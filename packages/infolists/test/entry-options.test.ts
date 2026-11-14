import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Color, ColorManager, views, type FileUrlStorage } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { Schema } from '@navette-js/schemas';
import { Action, useColorManager as useActionsColorManager } from '@navette-js/actions';
import { ImageEntry, KeyValueEntry, RepeatableEntry, TextEntry, useColorManager } from '../src/index.ts';

const colors = new ColorManager().register({ primary: Color.Blue });
useColorManager(colors);
useActionsColorManager(colors);
views.share({ t, tc, assetUrl: (file: string) => file });

const host = () => ({ id: 'lw', _errors: {} as Record<string, string[]>, getSchema() { return null as any; } });
const schema = (record: Record<string, unknown>, components: any[]) => Schema.make(host()).key('infolist').record(record).components(components);
const render = async (record: Record<string, unknown>, components: any[]) => (await schema(record, components).toHtml()).replace(/&#039;/g, "'");

test('ImageEntry: stored keys through a storage, temporary URLs for private images, file existence', async () => {
    const existing = new Set(['avatars/a.png']);
    const storage: FileUrlStorage = {
        url: (key) => `/storage/${key}`,
        temporaryUrl: (key, expiresAt) => `/private/${key}?expires=${Math.floor(expiresAt.getTime() / 1000)}&signature=sig`,
        exists: (key) => existing.has(key),
    };
    // Public: the storage's URL. URLs in the state stay as they are.
    let html = await render({ photo: ['avatars/a.png', 'https://cdn.example.com/b.png'] }, [ImageEntry.make('photo').storage(storage)]);
    assert.match(html, /src="\/storage\/avatars\/a.png"/);
    assert.match(html, /src="https:\/\/cdn.example.com\/b.png"/);
    // Private: a temporary URL.
    html = await render({ photo: 'avatars/a.png' }, [ImageEntry.make('photo').storage(storage).visibility('private')]);
    assert.match(html, /src="\/private\/avatars\/a.png\?expires=\d+&amp;signature=sig"/);
    // A missing file shows the default image; without the check it is still displayed.
    html = await render({ photo: 'avatars/missing.png' }, [ImageEntry.make('photo').storage(storage).defaultImageUrl('/img/default.png')]);
    assert.match(html, /src="\/img\/default.png"/);
    html = await render({ photo: 'avatars/missing.png' }, [ImageEntry.make('photo').storage(storage).checkFileExistence(false)]);
    assert.match(html, /src="\/storage\/avatars\/missing.png"/);
    // Unsafe keys and URLs never reach the storage or the page.
    const asked: string[] = [];
    const spy: FileUrlStorage = { url: (key) => { asked.push(key); return `/s/${key}`; } };
    html = await render({ photo: ['../etc/passwd', 'javascript:alert(1)', '//evil.example.com/x.png'] }, [ImageEntry.make('photo').storage(spy)]);
    assert.deepEqual(asked, []);
    assert.doesNotMatch(html, /<img/);
    // A storage returning an unsafe URL is ignored.
    html = await render({ photo: 'a.png' }, [ImageEntry.make('photo').storage({ url: () => 'javascript:alert(1)' })]);
    assert.doesNotMatch(html, /javascript:/);
    // The storage's own visibility, and the application default.
    const privateStorage: FileUrlStorage = { ...storage, visibility: 'private' };
    ImageEntry.storage = privateStorage;
    try {
        html = await render({ photo: 'avatars/a.png' }, [ImageEntry.make('photo').alt((_record, state) => `Photo ${state}`)]);
        assert.match(html, /src="\/private\/avatars\/a.png\?/);
        // Alt text functions receive the state item (the key), not the URL.
        assert.match(html, /alt="Photo avatars\/a.png"/);
    } finally { ImageEntry.storage = null; }
    // Without a storage, a key is not an image.
    assert.doesNotMatch(await render({ photo: 'avatars/a.png' }, [ImageEntry.make('photo')]), /<img/);
});

test('TextEntry: prefix and suffix actions, small icon buttons mounted with the entry key', async () => {
    const copy = Action.make('copyCostToPrice').icon('o-clipboard').action(() => {});
    const entry = TextEntry.make('cost').prefix('€').suffixAction(copy).prefixAction(Action.make('info').icon('o-information-circle').url('/help'));
    const html = await render({ cost: 12 }, [entry]);
    assert.match(html, /<div class="nv-in-text nv-wrapped nv-in-text-affixed"><div class="nv-in-text-affix"><a [^>]*href="\/help"[^>]*class="nv-ac-icon-btn-action nv-icon-btn nv-size-sm/);
    assert.match(html, /<div class="nv-in-text-affixed-content"><ul><li class="nv-in-text-item nv-size-sm">€12<\/li><\/ul><\/div><div class="nv-in-text-affix"><button [^>]*class="nv-ac-icon-btn-action nv-icon-btn nv-size-sm/);
    assert.match(html, /mountAction\('copyCostToPrice', \{\}, \{ schemaComponent: 'infolist.cost' \}\)|mountAction\(&#039;copyCostToPrice|schemaComponent/);
    // The actions can be mounted from the entry.
    assert.deepEqual(entry.getActions().map((action: any) => action.getName()), ['info', 'copyCostToPrice']);
    // A chosen size or view is kept; hidden actions are left out.
    const html2 = await render({ cost: 1 }, [TextEntry.make('cost').suffixActions([Action.make('a').label('Open').button().size('lg').url('/a'), Action.make('b').icon('o-x-mark').hidden()])]);
    assert.match(html2, /nv-btn nv-size-lg/);
    assert.doesNotMatch(html2, /o-x-mark|actions\.b/);
    // Without affix actions, the markup is unchanged.
    assert.match(await render({ cost: 1 }, [TextEntry.make('cost')]), /<div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped">1<\/div>/);
});

test('TextEntry: getCharacterLimit() and limit() functions', async () => {
    const entry = TextEntry.make('title').limit(5);
    schema({ title: 'Hello world' }, [entry]);
    assert.equal(entry.getCharacterLimit(), 5);
    assert.equal(entry.getCharacterLimitEnd(), '...');
    assert.equal(TextEntry.make('x').getCharacterLimit(), null);
    // The tooltip shows the full text only when it is cut.
    const limited = TextEntry.make('title').limit(5).tooltip((_record, state) => (String(state).length > (limited.getCharacterLimit() ?? Infinity) ? String(state) : null));
    let html = await render({ title: 'Hello world' }, [limited]);
    assert.match(html, />Hello\.\.\.</);
    assert.match(html, /x-tooltip="\{ content: 'Hello world'/);
    html = await render({ title: 'Hi' }, [TextEntry.make('title').limit(5).tooltip((_record, state) => (String(state).length > 5 ? String(state) : null))]);
    assert.doesNotMatch(html, /x-tooltip/);
    // Per state item: the limit and its end can be functions.
    html = await render({ tags: ['abcdefgh', 'xyz'] }, [TextEntry.make('tags').listWithLineBreaks().limit((_record, state) => (String(state).startsWith('a') ? 3 : null), () => '…')]);
    assert.match(html, />abc…</);
    assert.match(html, />xyz</);
});

test('RepeatableEntry.maxItemsForProcessing(): a 413 error above the limit, before building item schemas', async () => {
    let built = 0;
    const entry = () => RepeatableEntry.make('comments').schema(() => { built++; return [TextEntry.make('body')]; });
    const comments = [{ body: 'a' }, { body: 'b' }, { body: 'c' }];
    await assert.rejects(render({ comments }, [entry().maxItemsForProcessing(2)]), (error: any) => error.status === 413 && /more than 2 items/.test(error.message));
    assert.equal(built, 0);
    await assert.rejects(render({ comments }, [entry().table([{ label: 'Body', getWidth: () => null }]).maxItemsForProcessing(1)]), (error: any) => error.status === 413);
    assert.match(await render({ comments }, [entry().maxItemsForProcessing(3)]), />c</);
    assert.match(await render({ comments }, [entry().maxItemsForProcessing(2).maxItemsForProcessing(null)]), />c</);
    assert.equal(RepeatableEntry.make('x').maxItemsForProcessing(10).getMaxItemsForProcessing(), 10);
});

test('Documented helpers: alignLeft(), alignRight(), KeyValueEntry.emptyMessage()', async () => {
    assert.match(await render({ a: 'x' }, [TextEntry.make('a').alignLeft()]), /nv-in-entry-content nv-align-left/);
    assert.match(await render({ a: 'x' }, [TextEntry.make('a').alignRight()]), /nv-in-entry-content nv-align-right/);
    assert.match(await render({ meta: {} }, [KeyValueEntry.make('meta').emptyMessage('No metadata')]), /No metadata/);
});
