import assert from 'node:assert/strict';
import { test } from 'node:test';
import { e } from '@navette/support';
import { Schema } from '@navette/schemas';
import { CodeEntry, KeyValueEntry, ViewEntry } from '../src/index.ts';

const host = () => ({ id: 'lw', _errors: {} as Record<string, string[]>, getSchema() { return null as any; } });
const render = async (record: Record<string, unknown>, components: any[]) => (await Schema.make(host()).key('infolist').record(record).components(components).toHtml()).replace(/&#039;/g, "'");

test('KeyValueEntry : même table que l\'oracle, valeurs échappées, texte de remplacement', async () => {
    const html = await render({ meta: { description: 'Filament is a collection of Laravel packages', 'og:type': 'website', 'og:site_name': 'Filament' } }, [KeyValueEntry.make('meta')]);
    // Oracle : infolists/entries/key-value, #keyValue (blancs retirés).
    assert.ok(html.includes('<div class="fi-in-entry"><div class="fi-in-entry-label-col"><div class="fi-in-entry-label-ctn"><div class="fi-in-entry-label" role="term">Meta</div></div></div><div class="fi-in-entry-content-col"><div class="fi-in-entry-content-ctn" role="definition"><div class="fi-in-entry-content"><table class="fi-in-key-value"><thead><tr><th scope="col">Key</th><th scope="col">Value</th></tr></thead><tbody><tr><th scope="row">description</th><td>Filament is a collection of Laravel packages</td></tr><tr><th scope="row">og:type</th><td>website</td></tr><tr><th scope="row">og:site_name</th><td>Filament</td></tr></tbody></table></div></div></div></div>'));
    assert.match(html, /\\u0022path\\u0022:\\u0022meta\\u0022,\\u0022containerPath\\u0022:\\u0022\\u0022/);
    const custom = await render({ meta: '{"<k>":{"a":1},"n":null}' }, [KeyValueEntry.make('meta').keyLabel('Clé').valueLabel('Valeur')]);
    assert.ok(custom.includes('<th scope="col">Clé</th><th scope="col">Valeur</th>'));
    assert.ok(custom.includes(`<tr><th scope="row">&lt;k&gt;</th><td>${e('{"a":1}')}</td></tr><tr><th scope="row">n</th><td></td></tr>`));
    const empty = await render({ meta: {} }, [KeyValueEntry.make('meta')]);
    assert.ok(empty.includes('<tbody><tr><td colspan="2" class="fi-in-placeholder">No entries</td></tr></tbody>'));
});

test('CodeEntry : balisage Phiki sans coloration, JSON indenté, copie', async () => {
    const html = await render({ code: '<?php\n\necho 1;\n' }, [CodeEntry.make('code').grammar('php')]);
    assert.ok(html.includes('<div class="fi-in-code"><pre class="phiki language-php github-light phiki-themes github-dark-high-contrast" data-language="php" style="background-color: #fff;color: #24292e;--phiki-dark-background-color: #0a0c10;--phiki-dark-color: #f0f3f6;"><code><span class="line"><span class="token">&lt;?php</span><span class="token">\n</span></span><span class="line"><span class="token">\n</span></span><span class="line"><span class="token">echo 1;</span><span class="token">\n</span></span></code></pre></div>'));
    const json = await render({ data: { url: 'https://x.test/a', 'é': true } }, [CodeEntry.make('data')]);
    assert.match(json, /data-language="json"/);
    assert.ok(json.includes('<span class="token">    &quot;url&quot;: &quot;https:\\/\\/x.test\\/a&quot;,</span>'));
    assert.ok(json.includes('&quot;\\u00e9&quot;: true'));
    const empty = await render({ code: null }, [CodeEntry.make('code').placeholder('Aucun code')]);
    assert.ok(empty.includes('<div class="fi-in-code"><p class="fi-in-placeholder">Aucun code</p></div>'));
    const copyable = await render({ code: 'a' }, [CodeEntry.make('code').copyable()]);
    assert.match(copyable, /<div x-data="filamentCopyable" x-bind="bindings" x-id="\['copyable-code'\]" x-bind:aria-label="isStandalone \? 'Copy Code' : null" x-bind:aria-describedby="isStandalone \? \$id\('copyable-code'\) : null" x-on:click="if \(isStandalone\) \{/);
    assert.match(copyable, /class="fi-in-code fi-copyable"><div x-bind:id="\$id\('copyable-code'\)"><pre/);
});

test('ViewEntry : rendu fourni par le développeur, dans l\'enveloppe d\'entrée', async () => {
    const html = await render({ status: '<draft>' }, [ViewEntry.make('status').view(({ state, record }) => `<span data-status>${e(state)}/${e((record as any).status)}</span>`)]);
    assert.ok(html.includes('<div class="fi-in-entry-content"><span data-status>&lt;draft&gt;/&lt;draft&gt;</span></div>'));
    const bare = await render({ status: 'ok' }, [ViewEntry.make('status').wrapped(false).view(({ state }) => `<b>${e(state)}</b>`)]);
    assert.ok(bare.includes('<div class="fi-sc-component"><b>ok</b></div>'));
    await assert.rejects(() => render({}, [ViewEntry.make('status')]));
});
