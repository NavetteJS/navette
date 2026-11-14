import assert from 'node:assert/strict';
import { test } from 'node:test';
import { e } from '@navette-js/support';
import { Schema } from '@navette-js/schemas';
import { CodeEntry, KeyValueEntry, ViewEntry, setCodeHighlighterLoader } from '../src/index.ts';

const host = () => ({ id: 'lw', _errors: {} as Record<string, string[]>, getSchema() { return null as any; } });
const render = async (record: Record<string, unknown>, components: any[]) => (await Schema.make(host()).key('infolist').record(record).components(components).toHtml()).replace(/&#039;/g, "'");

test('KeyValueEntry: table markup, escaped values, placeholder', async () => {
    const html = await render({ meta: { description: 'Filament is a collection of Laravel packages', 'og:type': 'website', 'og:site_name': 'Filament' } }, [KeyValueEntry.make('meta')]);
    assert.ok(html.includes('<div class="nv-in-entry"><div class="nv-in-entry-label-col"><div class="nv-in-entry-label-ctn"><div class="nv-in-entry-label" role="term">Meta</div></div></div><div class="nv-in-entry-content-col"><div class="nv-in-entry-content-ctn" role="definition"><div class="nv-in-entry-content"><table class="nv-in-key-value"><thead><tr><th scope="col">Key</th><th scope="col">Value</th></tr></thead><tbody><tr><th scope="row">description</th><td>Filament is a collection of Laravel packages</td></tr><tr><th scope="row">og:type</th><td>website</td></tr><tr><th scope="row">og:site_name</th><td>Filament</td></tr></tbody></table></div></div></div></div>'));
    assert.match(html, /\\u0022path\\u0022:\\u0022meta\\u0022,\\u0022containerPath\\u0022:\\u0022\\u0022/);
    const custom = await render({ meta: '{"<k>":{"a":1},"n":null}' }, [KeyValueEntry.make('meta').keyLabel('Name').valueLabel('Setting')]);
    assert.ok(custom.includes('<th scope="col">Name</th><th scope="col">Setting</th>'));
    assert.ok(custom.includes(`<tr><th scope="row">&lt;k&gt;</th><td>${e('{"a":1}')}</td></tr><tr><th scope="row">n</th><td></td></tr>`));
    const empty = await render({ meta: {} }, [KeyValueEntry.make('meta')]);
    assert.ok(empty.includes('<tbody><tr><td colspan="2" class="nv-in-placeholder">No entries</td></tr></tbody>'));
});

test('CodeEntry: unhighlighted phiki markup, indented JSON, copyable', async (t) => {
    setCodeHighlighterLoader(null); // Without Shiki.
    t.after(() => setCodeHighlighterLoader(() => import('shiki')));
    const html = await render({ code: '<?php\n\necho 1;\n' }, [CodeEntry.make('code').grammar('php')]);
    assert.ok(html.includes('<div class="nv-in-code"><pre class="phiki language-php github-light phiki-themes github-dark-high-contrast" data-language="php" style="background-color: #fff;color: #24292e;--phiki-dark-background-color: #0a0c10;--phiki-dark-color: #f0f3f6;"><code><span class="line"><span class="token">&lt;?php</span><span class="token">\n</span></span><span class="line"><span class="token">\n</span></span><span class="line"><span class="token">echo 1;</span><span class="token">\n</span></span></code></pre></div>'));
    const json = await render({ data: { url: 'https://x.test/a', 'é': true } }, [CodeEntry.make('data')]);
    assert.match(json, /data-language="json"/);
    assert.ok(json.includes('<span class="token">    &quot;url&quot;: &quot;https:\\/\\/x.test\\/a&quot;,</span>'));
    assert.ok(json.includes('&quot;\\u00e9&quot;: true'));
    const empty = await render({ code: null }, [CodeEntry.make('code').placeholder('No code')]);
    assert.ok(empty.includes('<div class="nv-in-code"><p class="nv-in-placeholder">No code</p></div>'));
    const copyable = await render({ code: 'a' }, [CodeEntry.make('code').copyable()]);
    assert.match(copyable, /<div x-data="navetteCopyable" x-bind="bindings" x-id="\['copyable-code'\]" x-bind:aria-label="isStandalone \? 'Copy Code' : null" x-bind:aria-describedby="isStandalone \? \$id\('copyable-code'\) : null" x-on:click="if \(isStandalone\) \{/);
    assert.match(copyable, /class="nv-in-code nv-copyable"><div x-bind:id="\$id\('copyable-code'\)"><pre/);
});

test('CodeEntry: highlighted with Shiki in a light and a dark theme (Phiki markup)', async () => {
    const html = await render({ code: '<?php\n// <b>\necho 1;\n' }, [CodeEntry.make('code').grammar('php')]);
    assert.ok(html.includes('<pre class="phiki language-php github-light phiki-themes github-dark-high-contrast" data-language="php" style="background-color: #fff;color: #24292e;--phiki-dark-background-color: #0a0c10;--phiki-dark-color: #f0f3f6;"><code><span class="line">'));
    // Each token: light color as a property, dark color as a variable read by the dark-mode CSS; text escaped.
    assert.ok(html.includes('<span class="token" style="color: #6A737D;--phiki-dark-color: #BDC4CC;">// &lt;b&gt;</span><span class="token">\n</span></span>'));
    assert.ok(html.includes('<span class="token" style="color: #005CC5;--phiki-dark-color: #91CBFF;">echo</span>'));
    assert.ok(!html.includes('<b>'));
    // Other themes: their own background and text colors.
    const themed = await render({ code: 'const a = 1' }, [CodeEntry.make('code').grammar('ts').lightTheme('min-light').darkTheme('nord')]);
    assert.match(themed, /<pre class="phiki language-ts min-light phiki-themes nord" data-language="ts" style="background-color: #ffffff;color: #24292eff;--phiki-dark-background-color: #2e3440ff;--phiki-dark-color: #d8dee9ff;">/);
    // Unknown grammar or theme: single-color rendering.
    const unknown = await render({ code: 'x' }, [CodeEntry.make('code').grammar('no-such-grammar')]);
    assert.ok(unknown.includes('<code><span class="line"><span class="token">x</span></span></code>'));
    const unknownTheme = await render({ code: 'x' }, [CodeEntry.make('code').grammar('php').darkTheme('no-such-theme')]);
    assert.ok(unknownTheme.includes('<pre class="phiki language-php github-light phiki-themes no-such-theme" data-language="php"><code><span class="line"><span class="token">x</span></span></code></pre>'));
    // An array: highlighted JSON.
    const json = await render({ data: { a: [1, true] } }, [CodeEntry.make('data')]);
    assert.match(json, /data-language="json"/);
    assert.match(json, /<span class="token" style="color: #[0-9A-F]{6};--phiki-dark-color: #[0-9A-F]{6};">true<\/span>/);
});

test('ViewEntry: developer-supplied rendering inside the entry wrapper', async () => {
    const html = await render({ status: '<draft>' }, [ViewEntry.make('status').view(({ state, record }) => `<span data-status>${e(state)}/${e((record as any).status)}</span>`)]);
    assert.ok(html.includes('<div class="nv-in-entry-content"><span data-status>&lt;draft&gt;/&lt;draft&gt;</span></div>'));
    const bare = await render({ status: 'ok' }, [ViewEntry.make('status').wrapped(false).view(({ state }) => `<b>${e(state)}</b>`)]);
    assert.ok(bare.includes('<div class="nv-sc-component"><b>ok</b></div>'));
    await assert.rejects(() => render({}, [ViewEntry.make('status')]));
});

test('IconEntry: icons of registered sets and aliases of the boolean icons', async (t) => {
    const { IconEntry } = await import('../src/index.ts');
    const { icon, icons } = await import('@navette-js/support');
    t.after(() => icons.alias({ 'infolists::components.icon-entry.true': null }));
    icons.registerSet('entry-test', (name) => (name === 'star' ? '<svg data-star></svg>' : null));
    const html = await render({ rating: 5 }, [IconEntry.make('rating').icon('entry-test:star')]);
    assert.ok(html.includes('data-star'));
    const paths = (name: string) => icon(name).replace(/^<svg[^>]*>/, '');
    assert.ok((await render({ active: true }, [IconEntry.make('active').boolean()])).includes(paths('o-check-circle')));
    icons.alias({ 'infolists::components.icon-entry.true': 'm-hand-thumb-up' });
    assert.ok((await render({ active: true }, [IconEntry.make('active').boolean()])).includes(paths('m-hand-thumb-up')));
    // A state value that is not an icon name is not rendered.
    assert.ok(!(await render({ rating: '<svg onload=x>' }, [IconEntry.make('rating').icon((state: any) => state)])).includes('<svg onload'));
});
