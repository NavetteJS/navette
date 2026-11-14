import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Color, ColorManager, raw, views } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { Icon, Schema } from '@navette-js/schemas';
import { ColorEntry, IconEntry, ImageEntry, RepeatableEntry, TableColumn, TextEntry, formatIsoDate, formatPhpDate, useColorManager } from '../src/index.ts';

useColorManager(new ColorManager().register({ primary: Color.Blue }));
views.share({ t, tc, assetUrl: (file: string) => file });

const host = () => ({ id: 'lw', _errors: {} as Record<string, string[]>, getSchema() { return null as any; } });
const render = async (record: Record<string, unknown>, components: any[]) => (await Schema.make(host()).key('infolist').record(record).components(components).toHtml()).replace(/&#039;/g, "'");
/** Content of the single entry: what is inside `nv-in-entry-content`. */
const content = async (record: Record<string, unknown>, entry: any) => {
    const html = await render(record, [entry]);
    return /<(?:div|a)[^>]*class="nv-in-entry-content(?: nv-align-\w+)?">([\s\S]*)<\/(?:div|a)><\/div><\/div><\/div><\/div><\/div>\s*<\/div>$/.exec(html)?.[1] ?? html;
};

test('Default markup of text entries is unchanged', async () => {
    assert.equal(await content({ title: 'A <b>' }, TextEntry.make('title')), '<div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped">A &lt;b&gt;</div>');
    assert.equal(await content({ price: 1234.5 }, TextEntry.make('price').money('eur')), '<div class="nv-in-text-item nv-size-sm nv-in-text nv-numeric nv-wrapped">€1,234.50</div>');
    assert.equal(await content({ stock: 1234567 }, TextEntry.make('stock').numeric()), '<div class="nv-in-text-item nv-size-sm nv-in-text nv-numeric nv-wrapped">1,234,567</div>');
    assert.equal(await content({ d: '2024-03-05' }, TextEntry.make('d').date()), '<div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped">Mar 5, 2024</div>');
    assert.equal(await content({ d: '2024-03-05 10:11:12' }, TextEntry.make('d').dateTime()), '<div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped">Mar 5, 2024 10:11:12</div>');
    assert.equal(await content({ t: '10:11:12' }, TextEntry.make('t').time('H:i')), '<div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped">10:11</div>');
    assert.equal(await content({ n: null }, TextEntry.make('n')), '<div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped"></div>');
    assert.equal(await content({ n: null }, TextEntry.make('n').money()), '<div class="nv-in-text nv-numeric"></div>');
    assert.equal(await content({ n: null }, TextEntry.make('n').placeholder('None')), '<div class="nv-in-text"><p class="nv-in-placeholder">None</p></div>');
    assert.match(await content({ s: 'ok' }, TextEntry.make('s').badge()), /^<div class="nv-in-text-item nv-in-text nv-in-text-has-badges nv-wrapped"><span class="nv-badge nv-size-sm nv-color nv-color-primary[^"]*">ok<\/span><\/div>$/);
    assert.match(await content({ tags: ['a', 'b'] }, TextEntry.make('tags').badge()), /^<ul class="nv-in-text nv-in-text-has-badges nv-wrapped"><li class="nv-in-text-item"><span class="nv-badge nv-size-sm [^"]*">a<\/span><\/li><li class="nv-in-text-item">/);
});

test('Entry: default state, label function, inline label, alignment, tooltip', async () => {
    assert.match(await render({ title: null }, [TextEntry.make('title').default('Untitled')]), />Untitled<\/div>/);
    const html = await render({ title: 'Hi' }, [TextEntry.make('title').label(() => 'Heading <1>').inlineLabel().alignCenter().tooltip('Shown <here>')]);
    assert.match(html, /<div class="nv-in-entry nv-in-entry-has-inline-label"><div class="nv-in-entry-label-col"><div class="nv-in-entry-label-ctn"><div class="nv-in-entry-label" role="term">Heading &lt;1&gt;<\/div>/);
    assert.match(html, /<div class="nv-in-entry-content nv-align-center"><div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped nv-align-center"><span x-tooltip="\{ content: 'Shown \\u003Chere\\u003E', theme: \$store.theme, allowHTML: false \}">Hi<\/span>/);
    // Inline label with a hidden label keeps the label column.
    assert.match(await render({ t: 'x' }, [TextEntry.make('t').hiddenLabel().inlineLabel()]), /<div class="nv-in-entry-label nv-sr-only" role="term">T<\/div><div class="nv-in-entry-label-col"><\/div>/);
    // Unknown alignments are ignored.
    assert.match(await render({ t: 'x' }, [TextEntry.make('t').alignment('x" onclick="y')]), /<div class="nv-in-entry-content"><div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped">/);
});

test('Entry: url() renders a link only for safe URLs', async () => {
    const link = await render({ t: 'Hi' }, [TextEntry.make('t').url(({ record }) => `/posts/${(record as any).t}?a=1&b="2"`, true)]);
    assert.match(link, /<a href="\/posts\/Hi\?a=1&amp;b=&quot;2&quot;" target="_blank" class="nv-in-entry-content"><div class="nv-in-text-item/);
    assert.match(await render({ t: 'Hi' }, [TextEntry.make('t').url('https://example.com').openUrlInNewTab(false)]), /<a href="https:\/\/example.com" class="nv-in-entry-content">/);
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.test', ' JaVaScRiPt:x']) {
        const html = await render({ t: 'Hi' }, [TextEntry.make('t').url(url)]);
        assert.doesNotMatch(html, /<a /, url);
        assert.match(html, /<div class="nv-in-entry-content">/);
    }
});

test('Entry: extra content slots, escaped text, HtmlString and components', async () => {
    const entry = TextEntry.make('name')
        .aboveLabel('Above <label>')
        .beforeLabel(Icon.make('o-star'))
        .afterLabel(raw('<em>after</em>'))
        .belowLabel(['Below label'])
        .aboveContent('Above content')
        .beforeContent('Before')
        .afterContent('After')
        .belowContent(({ record }) => `Below ${(record as any).name}`);
    const html = await render({ name: 'Ada' }, [entry]);
    assert.match(html, /<div class="nv-in-entry-label-col"><div class="nv-sc nv-inline nv-sc-has-gap nv-sc-dense"><div x-data="[^"]+"><div class="nv-sc-component"><span class="nv-sc-text">Above &lt;label&gt;<\/span><\/div><\/div><\/div><div class="nv-in-entry-label-ctn"><div class="nv-sc nv-inline nv-sc-has-gap nv-sc-dense">.*?<svg[^>]*nv-sc-icon/s);
    assert.match(html, /<div class="nv-in-entry-label" role="term">Name<\/div><div class="nv-sc nv-inline nv-align-end nv-sc-has-gap nv-sc-dense">.*?<span class="nv-sc-text"><em>after<\/em><\/span>/s);
    assert.match(html, /<div class="nv-in-entry-content-col"><div class="nv-in-entry-content-slot"><div class="nv-sc nv-inline[^"]*">.*?Above content.*?<\/div><div class="nv-in-entry-content-ctn" role="definition"><div class="nv-in-entry-content-slot">.*?Before/s);
    assert.match(html, />Ada<\/div><\/div><div class="nv-sc nv-inline nv-align-end nv-sc-has-gap nv-sc-dense">.*?After.*?<\/div><\/div><div class="nv-sc nv-inline nv-sc-has-gap nv-sc-dense">.*?Below Ada/s);
    // Slot component state: the entry's path.
    assert.match(html, /\\u0022path\\u0022:\\u0022name\\u0022/);
    // Actions in slots are exposed for mounting.
    const action = { isVisible: async () => true, toHtml: async () => '<button>Generate</button>' };
    const withAction = TextEntry.make('name').belowContent([action as any, 'text']);
    assert.deepEqual(withAction.getActions(), [action]);
    assert.match(await render({ name: 'Ada' }, [withAction]), /<div class="nv-sc-action"><button>Generate<\/button><\/div>/);
});

test('Entry: extra attributes are escaped; wrapper attributes', async () => {
    const html = await render({ t: 'x' }, [TextEntry.make('t').extraAttributes({ class: 'custom', 'data-x': '"><script>', 'bad name': 'x' }).extraEntryWrapperAttributes({ class: 'locked', id: 'w' })]);
    assert.match(html, /<div class="locked nv-in-entry" id="w">/);
    assert.match(html, /<div class="nv-in-text-item nv-size-sm custom nv-in-text nv-wrapped" data-x="&quot;&gt;&lt;script&gt;">x<\/div>/);
    assert.doesNotMatch(html, /bad name/);
});

test('Entry: hiddenJs() and visibleJs() wrap the entry in a toggled fieldset', async () => {
    const html = await render({ t: 'x' }, [TextEntry.make('t').hiddenJs(`$get('role') !== "staff"`)]);
    assert.match(html, /<fieldset disabled role="none" wire:partial="schema-component::infolist.t" x-data="navetteSchemaComponent\([^"]+\)" x-bind:class="\{ 'nv-hidden': ! \(! \(\$get\('role'\) !== &quot;staff&quot;\)\) \}" x-bind:disabled="! \(! \(\$get\('role'\) !== &quot;staff&quot;\)\)" x-cloak wire:key="lw.infolist.t" class="nv-grid-col nv-sc-visibility-fieldset"/);
    assert.match(html, /<\/div><\/fieldset>\s*<\/div>$/);
    assert.match(await render({ t: 'x' }, [TextEntry.make('t').hiddenJs('a').visibleJs('b')]), /x-bind:disabled="! \(\(! \(a\)\) &amp;&amp; \(b\)\)"/);
    // Hidden on the server: no fieldset.
    assert.doesNotMatch(await render({ t: 'x' }, [TextEntry.make('t').hidden().hiddenJs('a')]), /fieldset/);
});

test('TextEntry: color, icon, size, weight, font family', async () => {
    const html = await content({ s: 'Active' }, TextEntry.make('s').color('success').icon('o-check-circle').iconColor('warning').iconPosition('after').size('lg').weight('bold').fontFamily('mono'));
    assert.match(html, /^<div class="nv-in-text-item nv-font-mono nv-size-lg nv-font-bold nv-color nv-color-success nv-text-color-\d+ dark:nv-text-color-\d+ nv-in-text nv-wrapped">Active<svg class="nv-color nv-color-warning nv-icon nv-size-lg"/);
    // Per item: the function receives the record and the state.
    assert.match(await content({ s: 'draft' }, TextEntry.make('s').color((_record: unknown, state: unknown) => (state === 'draft' ? 'gray' : null)).icon(() => 'o-pencil')), /nv-color nv-color-gray[^"]*"><svg class="nv-icon nv-size-sm"/);
    assert.match(await content({ s: 'x' }, TextEntry.make('s').size('base').weight('x"y')), /nv-size-md nv-font-xy|nv-size-md xy/);
});

test('TextEntry: date formats, time zones, iso formats, since and tooltips', async () => {
    const d = (format: string, tz = 'UTC') => formatPhpDate(new Date(Date.UTC(2024, 2, 5, 9, 4, 7)), format, tz);
    assert.equal(d('D, d M Y H:i:s'), 'Tue, 05 Mar 2024 09:04:07');
    assert.equal(d('l jS \\of F Y g:i A'), 'Tuesday 5th of March 2024 9:04 AM');
    assert.equal(d('Y-m-d H:i P', 'Europe/Paris'), '2024-03-05 10:04 +01:00');
    assert.equal(d('H:i', 'Not/AZone'), '09:04');
    const iso = (format: string) => formatIsoDate(new Date(Date.UTC(2024, 2, 5, 21, 4, 7)), format);
    assert.equal(iso('L'), '03/05/2024');
    assert.equal(iso('LLL'), 'March 5, 2024 9:04 PM');
    assert.equal(iso('dddd Do [of] MMMM YYYY, HH:mm:ss'), 'Tuesday 5th of March 2024, 21:04:07');
    assert.equal(iso('LT'), '9:04 PM');

    assert.match(await content({ d: '2024-03-05 23:30:00' }, TextEntry.make('d').date('d/m/Y', 'Asia/Tokyo')), />06\/03\/2024</);
    assert.match(await content({ d: '2024-03-05 23:30:00' }, TextEntry.make('d').dateTime().timezone('America/New_York')), />Mar 5, 2024 18:30:00</);
    assert.match(await content({ d: new Date(Date.UTC(2024, 0, 2, 3, 4, 5)) }, TextEntry.make('d').date()), />Jan 2, 2024</);
    assert.match(await content({ d: '2024-03-05T10:11:12+02:00' }, TextEntry.make('d').time()), />08:11:12</);
    assert.match(await content({ d: '2024-03-05 10:11:12' }, TextEntry.make('d').isoDate()), />03\/05\/2024</);
    assert.match(await content({ d: '2024-03-05 10:11:12' }, TextEntry.make('d').isoTime()), />10:11 AM</);
    assert.match(await content({ d: new Date(Date.now() - 3 * 86400000).toISOString() }, TextEntry.make('d').since()), />3 days ago</);
    assert.match(await content({ d: new Date(Date.now() + 2 * 3600000 + 60000).toISOString() }, TextEntry.make('d').since()), />in 2 hours</);
    assert.match(await content({ d: '2024-03-05 10:11:12' }, TextEntry.make('d').since().dateTooltip()), /<span x-tooltip="\{ content: 'Mar 5, 2024', [^"]*">\d+ \w+ ago<\/span>/);
    // An unparsable value is shown as is.
    assert.match(await content({ d: 'soon' }, TextEntry.make('d').date()), />soon</);
});

test('TextEntry: number and money arguments', async () => {
    assert.match(await content({ n: 1234.5678 }, TextEntry.make('n').numeric(2)), />1,234.57</);
    assert.match(await content({ n: 1234.5678 }, TextEntry.make('n').numeric({ decimalPlaces: 1, locale: 'de' })), />1.234,6</);
    assert.match(await content({ n: 1234.5 }, TextEntry.make('n').numeric({ decimalPlaces: 2, decimalSeparator: ',', thousandsSeparator: ' ' })), />1 234,50</);
    assert.match(await content({ n: 1.23456 }, TextEntry.make('n').numeric({ maxDecimalPlaces: 4 })), />1.2346</);
    assert.match(await content({ n: 'n/a' }, TextEntry.make('n').numeric()), />n\/a</);
    assert.match(await content({ n: 123456 }, TextEntry.make('n').money('eur', 100)), />€1,234.56</);
    assert.match(await content({ n: 123456 }, TextEntry.make('n').money('eur', { divideBy: 100, locale: 'fr', decimalPlaces: 0 })), />1\s235\s€</);
    assert.match(await content({ n: 9.5, c: 'gbp' }, TextEntry.make('n').money((record: any) => record.c, 0, null, 2)), />£9.50</);
    assert.doesNotMatch(await content({ n: 5 }, TextEntry.make('n').numeric().numeric(false)), /nv-numeric/);
});

test('TextEntry: Markdown, HTML and prose are sanitized', async () => {
    const markdown = await content({ t: '**Bold** [link](https://x.test) [bad](javascript:alert(1)) <img src=x onerror=alert(1)>' }, TextEntry.make('t').markdown());
    assert.match(markdown, /^<div class="nv-in-text-item nv-prose nv-size-sm nv-in-text nv-wrapped"><p><strong>Bold<\/strong> <a href="https:\/\/x.test" rel="noopener noreferrer nofollow">link<\/a> bad\) &lt;img src=x onerror=alert\(1\)&gt;<\/p><\/div>$/);
    // Content starting with a tag (rich editor HTML) is sanitized; tight list items are unwrapped.
    assert.match(await content({ t: '<p onclick="x">Hi</p><ul><li><p>a</p></li></ul><script>alert(1)</script>' }, TextEntry.make('t').markdown()), />\s*<p>Hi<\/p><ul><li>a<\/li><\/ul><\/div>$/);
    assert.equal(await content({ t: '<p style="color:red">Hi <a href="javascript:x">x</a></p>' }, TextEntry.make('t').html()), '<div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped"><p>Hi <a>x</a></p></div>');
    assert.match(await content({ t: '<b>x</b>' }, TextEntry.make('t').prose()), /class="nv-in-text-item nv-prose nv-size-sm nv-in-text nv-wrapped"><b>x<\/b>/);
    // HTML from formatStateUsing() via an HtmlString is inserted as is; plain strings are escaped.
    assert.match(await content({ t: 'x' }, TextEntry.make('t').formatStateUsing(() => raw('<mark>x</mark>'))), /><mark>x<\/mark><\/div>$/);
});

test('TextEntry: lists, separators and limits', async () => {
    assert.match(await content({ tags: ['a', '<b>', 'c'] }, TextEntry.make('tags')), />a, &lt;b&gt;, c<\/div>$/);
    assert.equal(await content({ tags: ['a', 'b'] }, TextEntry.make('tags').listWithLineBreaks()), '<ul class="nv-in-text nv-wrapped nv-in-text-has-line-breaks"><li class="nv-in-text-item nv-size-sm">a</li><li class="nv-in-text-item nv-size-sm">b</li></ul>');
    assert.match(await content({ tags: 'a, b' }, TextEntry.make('tags').separator(', ').bulleted()), /^<ul class="nv-in-text nv-wrapped nv-bulleted nv-in-text-has-line-breaks"><li class="nv-in-text-item nv-size-sm">a<\/li><li class="nv-in-text-item nv-size-sm">b<\/li><\/ul>$/);
    assert.match(await content({ tags: ['a', 'b', 'c', 'd'] }, TextEntry.make('tags').listWithLineBreaks().limitList(2)), /^<div class="nv-in-text nv-wrapped nv-in-text-has-line-breaks nv-in-text-list-limited"><ul><li class="nv-in-text-item nv-size-sm">a<\/li><li class="nv-in-text-item nv-size-sm">b<\/li><\/ul><div class="nv-in-text-list-limited-message">and 2 more<\/div><\/div>$/);
    const expandable = await content({ tags: ['a', 'b', 'c'] }, TextEntry.make('tags').bulleted().limitList(1).expandableLimitedList());
    assert.match(expandable, /^<div x-data="\{ isLimited: true \}" class="nv-in-text nv-wrapped nv-bulleted nv-in-text-has-line-breaks nv-in-text-list-limited"><ul><li class="nv-in-text-item nv-size-sm">a<\/li><li x-show="! isLimited" x-cloak x-transition class="nv-in-text-item nv-size-sm">b<\/li>/);
    assert.match(expandable, /x-show="isLimited" class="nv-link nv-size-xs">Show 2 more<\/div>.*x-show="! isLimited" class="nv-link nv-size-xs">Show 2 less<\/div>/s);
    // Without line breaks, the list is truncated before being joined.
    assert.match(await content({ tags: ['a', 'b', 'c'] }, TextEntry.make('tags').limitList(2)), />a, b<\/div>$/);
    assert.match(await content({ t: 'The quick brown fox' }, TextEntry.make('t').limit(9)), />The quick\.\.\.<\/div>$/);
    assert.match(await content({ t: 'The quick brown fox' }, TextEntry.make('t').words(2, ' (more)')), />The quick \(more\)<\/div>$/);
    assert.match(await content({ t: 'Short' }, TextEntry.make('t').limit(10).words(3)), />Short<\/div>$/);
    assert.equal(await content({ t: 'x' }, TextEntry.make('t').lineClamp(2).wrap(false)), '<div class="nv-in-text-item nv-size-sm nv-in-text" style="--line-clamp: 2;">x</div>');
    assert.match(await content({ t: '<x>' }, TextEntry.make('t').prefix('€ <').suffix(raw(' <sup>2</sup>'))), />€ &lt;&lt;x&gt; <sup>2<\/sup><\/div>$/);
});

test('TextEntry: copy message, duration and copyable state', async () => {
    const html = await content({ t: 'Order "1"' }, TextEntry.make('t').copyable().copyMessage("Copied 'it'").copyMessageDuration(1500).copyableState((record: any) => `#${record.t}`));
    assert.match(html, /x-bind:aria-label="isStandalone \? 'Copy Order \\u00221\\u0022' : null"/);
    assert.match(html, /copy\('#Order \\u00221\\u0022', 'Copied \\u0027it\\u0027', 1500, 'Could not copy'\)/);
    assert.match(html, /timeout: 1500,/);
    assert.match(html, /class="nv-copyable">Order &quot;1&quot;<\/span>/);
});

test('IconEntry: icons and colors from the state, size, boolean icons and colors', async () => {
    const html = await content({ status: 'draft' }, IconEntry.make('status').icon({ draft: 'o-pencil', published: 'o-check-circle' }).color({ draft: 'warning' }).size('md'));
    assert.match(html, /^<div class="nv-in-icon nv-wrapped"><svg class="nv-color nv-color-warning nv-text-color-\d+ dark:nv-text-color-\d+ nv-icon nv-size-md"/);
    assert.match(html, /<span class="nv-sr-only">draft<\/span><\/div>$/);
    assert.match(await content({ status: 'x' }, IconEntry.make('status').icon((_record: unknown, state: unknown) => (state === 'x' ? 'o-x-mark' : null)).tooltip('Rejected')), /<svg x-tooltip="\{ content: 'Rejected'[^"]*" class="nv-icon nv-size-lg".*<span class="nv-sr-only">Rejected<\/span>/s);
    // No icon for the value: nothing but the container.
    assert.equal(await content({ status: 'other' }, IconEntry.make('status').icon({ draft: 'o-pencil' })), '<div class="nv-in-icon nv-wrapped"></div>');
    const on = await content({ v: true }, IconEntry.make('v').trueIcon('o-check-badge').trueColor('info'));
    assert.match(on, /nv-color nv-color-info[^"]*nv-icon nv-size-lg/);
    assert.match(on, /<span class="nv-sr-only">Yes<\/span>/);
    assert.equal(await content({ v: 0 }, IconEntry.make('v').falseIcon(false)), '<div class="nv-in-icon nv-wrapped"></div>');
    assert.match(await content({ v: 0 }, IconEntry.make('v').boolean().falseColor('gray')), /<svg class="nv-icon nv-size-lg"/);
    assert.match(await content({ v: ['a', 'b'] }, IconEntry.make('v').icon('o-star').listWithLineBreaks().alignEnd()), /^<div class="nv-in-icon nv-in-icon-has-line-breaks nv-wrapped nv-align-end"><svg/);
});

test('ImageEntry: sizes, square, circular, default URL, stacking, limit and img attributes', async () => {
    assert.equal(await content({ a: '/a.png' }, ImageEntry.make('a').imageWidth(200).imageHeight('50%')), '<div class="nv-in-image nv-wrapped"><img alt="" src="/a.png" style="height: 50%; width: 200px;" /></div>');
    assert.equal(await content({ a: '/a.png' }, ImageEntry.make('a').imageHeight('10px; background: url(x)').imageHeight('3rem').circular()), '<div class="nv-in-image nv-circular nv-wrapped"><img alt="" src="/a.png" style="height: 3rem; width: 3rem;" /></div>');
    assert.match(await content({ a: '/a.png' }, ImageEntry.make('a').square().imageSize(40)), /style="height: 40px; width: 40px;"/);
    assert.match(await content({ a: null }, ImageEntry.make('a').defaultImageUrl('/placeholder.png')), /<img alt="" src="\/placeholder.png" style="height: 8rem;" \/>/);
    assert.equal(await content({ a: null }, ImageEntry.make('a').defaultImageUrl('javascript:alert(1)').placeholder('No image')), '<div class="nv-in-image"><p class="nv-in-placeholder">No image</p></div>');
    const stacked = await content({ a: ['/1.png', '/2.png', '/3.png', '/4.png'] }, ImageEntry.make('a').circular().stacked().ring(3).overlap(4).limit(2).limitedRemainingText(true, 'lg'));
    assert.match(stacked, /^<div class="nv-in-image nv-circular nv-wrapped nv-stacked nv-in-image-ring nv-in-image-ring-3 nv-in-image-overlap-4"><img alt="" src="\/1.png" style="height: 2.5rem; width: 2.5rem;" \/><img alt="" src="\/2.png"[^>]*\/><div class="nv-in-image-limited-remaining-text nv-size-lg" style="height: 2.5rem; width: 2.5rem;">\+2<\/div><\/div>$/);
    assert.match(await content({ a: ['/1.png', '/2.png'] }, ImageEntry.make('a').stacked()), /nv-stacked nv-in-image-overlap-2"/);
    const attributes = await content({ a: '/a.png' }, ImageEntry.make('a').alt((_record: unknown, state: unknown) => `Image ${state}`).extraImgAttributes({ loading: 'lazy', class: 'rounded', 'data-id': '"1"', onerror: 'alert(1)', style: 'x', src: '/evil', srcset: 'x' }).tooltip('Tip'));
    assert.equal(attributes, '<div class="nv-in-image nv-wrapped"><img alt="Image /a.png" src="/a.png" x-tooltip="{ content: \'Tip\', theme: $store.theme, allowHTML: false }" loading="lazy" class="rounded" data-id="&quot;1&quot;" style="height: 8rem;" /></div>');
});

test('ColorEntry: copyable swatches, arrays and tooltips', async () => {
    const html = await content({ c: ['#fff', 'red', 'rgb(0, 0, 0)'] }, ColorEntry.make('c').copyable().copyMessage('Copied!').copyMessageDuration(1000));
    assert.match(html, /^<div class="nv-in-color nv-wrapped"><div x-data="navetteCopyable" x-bind="bindings" x-bind:aria-label="isStandalone \? 'Copy #fff' : null" x-on:click="if \(isStandalone\) \{\n    copy\('#fff', 'Copied!', 1000, 'Could not copy'\)/);
    assert.match(html, /class="nv-in-color-item nv-copyable" style="background-color: #fff;"><\/div><div [^>]*style="background-color: rgb\(0, 0, 0\);"><\/div><\/div>$/);
    assert.doesNotMatch(html, /red/);
    assert.equal(await content({ c: '#000' }, ColorEntry.make('c').tooltip('Black')), '<div class="nv-in-color nv-wrapped"><div role="img" aria-label="Black" x-tooltip="{ content: \'Black\', theme: $store.theme, allowHTML: false }" class="nv-in-color-item" style="background-color: #000;"></div></div>');
});

test('RepeatableEntry: card layout with grid, columns and contained', async () => {
    const record = { items: [{ a: 'x', b: 'y' }, { a: 'z', b: 'w' }] };
    const html = await render(record, [RepeatableEntry.make('items').schema(() => [TextEntry.make('a'), TextEntry.make('b')]).grid(2).columns(2)]);
    assert.match(html, /<ul class="nv-in-repeatable nv-contained nv-grid lg:nv-grid-cols" style="--cols-lg: repeat\(2, minmax\(0, 1fr\)\); --cols-default: repeat\(1, minmax\(0, 1fr\)\);"><li class="nv-in-repeatable-item"><div class="nv-grid lg:nv-grid-cols nv-sc nv-sc-has-gap"/);
    assert.match(html, /wire:key="lw.infolist.items.1.b"/);
    assert.match(html, /\\u0022path\\u0022:\\u0022items.0.a\\u0022/);
    assert.match(await render(record, [RepeatableEntry.make('items').schema([TextEntry.make('a')]).contained(false)]), /<ul class="nv-in-repeatable nv-grid" style="--cols-default: repeat\(1, minmax\(0, 1fr\)\);">/);
    assert.match(await render({ items: [] }, [RepeatableEntry.make('items').schema([TextEntry.make('a')]).placeholder('Nothing')]), /<div class="nv-in-repeatable nv-contained"><p class="nv-in-placeholder">Nothing<\/p><\/div>/);
});

test('RepeatableEntry: table columns with hidden labels, wrapping, alignment and hidden cells', async () => {
    const html = await render({ items: [{ a: 'x', b: 'y', c: 'z' }] }, [RepeatableEntry.make('items')
        .table([TableColumn.make('A <1>').hiddenHeaderLabel(), TableColumn.make('B').wrapHeader().alignEnd().width(120), TableColumn.make('C').width('url(x)')])
        .schema(() => [TextEntry.make('a'), TextEntry.make('b').hidden(), TextEntry.make('c'), TextEntry.make('extra')])]);
    assert.match(html, /<thead><tr><th scope="col" class=""><span class="nv-sr-only">A &lt;1&gt;<\/span><\/th><th scope="col" class="nv-wrapped nv-align-end" style="width: 120px">B<\/th><th scope="col" class="">C<\/th><\/tr><\/thead>/);
    assert.match(html, /<td class="nv-hidden"><\/td><td wire:key="lw.infolist.items.0.c"/);
    assert.doesNotMatch(html, /items.0.extra/);
    assert.match(await render({ items: null }, [RepeatableEntry.make('items').table([TableColumn.make('A')]).schema([TextEntry.make('a')])]), /<div class="nv-in-entry-content"><div class="nv-in-table-repeatable"><\/div><\/div>/);
});
