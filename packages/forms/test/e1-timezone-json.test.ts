import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, NavetteTimezone, views } from '@navette-js/support';
import { t as translate, tc } from '@navette-js/support/i18n';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { CodeEntry, JsonFlags, TextEntry, encodeJson, setCodeHighlighterLoader } from '@navette-js/infolists';
import { TextColumn, useColorManager as useTablesColorManager } from '@navette-js/tables';
import { DatePicker, DateTimePicker, fillSchemaFromRecord, getSchemaState, useColorManager } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
useTablesColorManager(colors);
views.share({ t: translate, tc, assetUrl: (file: string) => `/${file}` });
const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {} });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
const infolist = async (record: Record<string, unknown>, components: any[]) => (await Schema.make(host()).key('infolist').record(record).components(components).toHtml()).replace(/&#039;/g, "'");

test('NavetteTimezone: UTC by default, validated, accepts a function', (t) => {
    t.after(() => NavetteTimezone.set(null));
    assert.equal(NavetteTimezone.get(), 'UTC');
    assert.equal(NavetteTimezone.isConfigured(), false);
    assert.throws(() => NavetteTimezone.set('Not/AZone'));
    NavetteTimezone.set('America/New_York');
    assert.equal(NavetteTimezone.get(), 'America/New_York');
    assert.equal(NavetteTimezone.isConfigured(), true);
    let zone: string | null = 'Europe/Paris';
    NavetteTimezone.set(() => zone);
    assert.equal(NavetteTimezone.get(), 'Europe/Paris');
    zone = null;
    assert.equal(NavetteTimezone.get(), 'UTC');
});

test('NavetteTimezone: fallback of DateTimePicker, TextEntry and TextColumn; timezone() still wins', async (t) => {
    t.after(() => NavetteTimezone.set(null));
    NavetteTimezone.set('America/New_York');
    const livewire = host({});
    const schema = form(livewire, [DateTimePicker.make('at'), DateTimePicker.make('paris').timezone('Europe/Paris'), DatePicker.make('day')]);
    fillSchemaFromRecord(schema, livewire.data, { at: '2026-07-01 10:00:00', paris: '2026-07-01 10:00:00', day: '2026-07-01' });
    assert.equal(livewire.data.at, '2026-07-01 06:00:00');
    assert.equal(livewire.data.paris, '2026-07-01 12:00:00');
    assert.equal(livewire.data.day, '2026-07-01');
    assert.deepEqual(await getSchemaState(schema), { at: '2026-07-01 10:00:00', paris: '2026-07-01 10:00:00', day: '2026-07-01' });

    assert.match(await infolist({ d: '2024-03-05 23:30:00' }, [TextEntry.make('d').dateTime()]), />Mar 5, 2024 18:30:00</);
    assert.match(await infolist({ d: '2024-03-05 23:30:00' }, [TextEntry.make('d').dateTime().timezone('UTC')]), />Mar 5, 2024 23:30:00</);
    assert.equal(TextEntry.make('d').getTimezone(), 'America/New_York');
    assert.match(await TextColumn.make('d').dateTime().toHtml({ d: '2024-03-05 23:30:00' }), />Mar 5, 2024 18:30:00</);
    assert.match(await TextColumn.make('d').dateTime('M j, Y H:i T').toHtml({ d: '2024-07-05 23:30:00' }), />Jul 5, 2024 19:30 EDT</);
    assert.match(await TextColumn.make('d').dateTime().timezone('UTC').toHtml({ d: '2024-03-05 23:30:00' }), />Mar 5, 2024 23:30:00</);

    NavetteTimezone.set(null);
    const plain = host({});
    fillSchemaFromRecord(form(plain, [DateTimePicker.make('at')]), plain.data, { at: '2026-07-01 10:00:00' });
    assert.equal(plain.data.at, '2026-07-01 10:00:00');
});

test('encodeJson: PHP json_encode() flags', () => {
    const value = { url: 'https://x.test/a', name: 'é<b>&\'"', emoji: '😀', list: [1, 2], empty: [], obj: {}, n: null, f: 1.5, skip: undefined };
    assert.equal(encodeJson(value, 0), '{"url":"https:\\/\\/x.test\\/a","name":"\\u00e9<b>&\'\\"","emoji":"\\ud83d\\ude00","list":[1,2],"empty":[],"obj":{},"n":null,"f":1.5}');
    assert.equal(encodeJson({ a: [1, { b: 'c' }], e: [] }), '{\n    "a": [\n        1,\n        {\n            "b": "c"\n        }\n    ],\n    "e": []\n}');
    assert.equal(encodeJson({ u: 'https://é' }, JsonFlags.UNESCAPED_SLASHES | JsonFlags.UNESCAPED_UNICODE), '{"u":"https://é"}');
    assert.equal(encodeJson('<a href=\'x\'>"&"</a>', JsonFlags.HEX_TAG | JsonFlags.HEX_AMP | JsonFlags.HEX_APOS | JsonFlags.HEX_QUOT), '"\\u003Ca href=\\u0027x\\u0027\\u003E\\u0022\\u0026\\u0022\\u003C\\/a\\u003E"');
    assert.equal(encodeJson(['a', 'b'], JsonFlags.FORCE_OBJECT), '{"0":"a","1":"b"}');
    assert.equal(encodeJson('line\nbreak\u0001'), '"line\\nbreak\\u0001"');
    assert.equal(encodeJson(new Date(Date.UTC(2026, 0, 1))), '"2026-01-01T00:00:00.000Z"');
});

test('CodeEntry: jsonFlags()', async (t) => {
    setCodeHighlighterLoader(null);
    t.after(() => setCodeHighlighterLoader(() => import('shiki')));
    const data = { url: 'https://x.test/a', 'é': true };
    const html = await infolist({ data }, [CodeEntry.make('data').jsonFlags(JsonFlags.PRETTY_PRINT | JsonFlags.UNESCAPED_SLASHES | JsonFlags.UNESCAPED_UNICODE)]);
    assert.ok(html.includes('<span class="token">    &quot;url&quot;: &quot;https://x.test/a&quot;,</span>'));
    assert.ok(html.includes('&quot;é&quot;: true'));
    const compact = await infolist({ data }, [CodeEntry.make('data').jsonFlags(() => 0)]);
    assert.ok(compact.includes('<span class="token">{&quot;url&quot;:&quot;https:\\/\\/x.test\\/a&quot;,&quot;\\u00e9&quot;:true}</span>'));
});
