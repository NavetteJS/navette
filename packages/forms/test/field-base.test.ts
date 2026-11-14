import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { Schema, Section, Group, JsContent, Text, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { Action, useColorManager as useActionsColorManager } from '@navette-js/actions';
import { DatePicker, KeyValue, Repeater, Select, TextInput, Textarea, fillSchema, getSchemaState, useColorManager, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

const host = (data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {}, ...extra });
const form = (livewire: any, components: any[], operation: string | null = null) => {
    const schema = Schema.make(livewire).key('form').statePath('data').components(components);
    return operation ? schema.operation(operation) : schema;
};
const norm = (html: string) => html.replace(/>\s+/g, '>').replace(/\s+</g, '<').replace(/&#039;/g, "'");

test('field content slots render around the label, the content and the error message', async () => {
    const livewire = host({ name: '' });
    livewire._errors = { 'data.name': ['The name field is required.'] };
    const field = TextInput.make('name')
        .aboveLabel('above-label').beforeLabel('before-label').afterLabel('after-label').belowLabel('below-label')
        .aboveContent('above-content').beforeContent('before-content').afterContent('after-content').belowContent('below-content')
        .aboveErrorMessage('above-error').belowErrorMessage('below-error');
    const html = norm(await form(livewire, [field]).toHtml());
    const order = ['above-label', 'before-label', 'after-label', 'below-label', 'above-content', 'before-content', 'after-content', 'below-content', 'above-error', 'The name field is required.', 'below-error'];
    const positions = order.map((text) => html.indexOf(text));
    assert.ok(positions.every((position) => position >= 0), `missing slot: ${order[positions.findIndex((p) => p < 0)]}`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
    // A slot accepts a component, a list of components or a function returning them.
    const dynamic = norm(await form(host({ name: 'Ada' }), [TextInput.make('name').belowContent(({ state }) => Text.make(`Hello ${state}`))]).toHtml());
    assert.ok(dynamic.includes('Hello Ada'));
});

test('hiddenJs() / visibleJs(), inlineLabel() on a field, a layout and a schema', async () => {
    const html = norm(await form(host(), [TextInput.make('a').hiddenJs("$get('b') === 'x'"), TextInput.make('c').visibleJs("$get('b') !== 'x'")]).toHtml());
    assert.match(html, /x-show="!\(\$get\('b'\) === 'x'\)"|x-show="! \(\$get\('b'\) === 'x'\)"|x-bind:class="\{ 'fi-hidden'/);
    assert.ok(html.includes("$get('b') !== 'x'"));
    const inline = norm(await form(host(), [TextInput.make('a').inlineLabel()]).toHtml());
    assert.match(inline, /fi-fo-field-has-inline-label|fi-inline/);
    const viaSection = norm(await form(host(), [Section.make('S').inlineLabel().schema([TextInput.make('a')])]).toHtml());
    assert.match(viaSection, /fi-fo-field-has-inline-label|fi-inline/);
    const viaSchema = norm(await form(host(), [TextInput.make('a')]).inlineLabel().toHtml());
    assert.match(viaSchema, /fi-fo-field-has-inline-label|fi-inline/);
    const optOut = norm(await form(host(), [TextInput.make('a').inlineLabel(false)]).inlineLabel().toHtml());
    assert.doesNotMatch(optOut, /fi-fo-field-has-inline-label/);
});

test('disabledOn() / hiddenOn() / visibleOn() follow the schema operation', async () => {
    const fields = () => [TextInput.make('a').disabledOn('edit'), TextInput.make('b').hiddenOn('edit'), TextInput.make('c').visibleOn('create')];
    const edit = norm(await form(host(), fields(), 'edit').toHtml());
    assert.match(edit, /<input disabled="disabled" id="form\.a"/);
    assert.ok(!edit.includes('id="form.b"'));
    assert.ok(!edit.includes('id="form.c"'));
    const create = norm(await form(host(), fields(), 'create').toHtml());
    assert.doesNotMatch(create, /<input disabled="disabled" id="form\.a"/);
    assert.ok(create.includes('id="form.b"') && create.includes('id="form.c"'));
});

test('extraInputAttributes(), extraFieldWrapperAttributes(), extraAlpineAttributes() and JsContent labels', async () => {
    const html = norm(await form(host(), [
        TextInput.make('a').extraInputAttributes({ 'data-input': 'yes' }).extraFieldWrapperAttributes({ 'data-wrapper': 'yes' }).extraAlpineAttributes({ 'x-on:keyup': 'count++' }),
        TextInput.make('b').label(JsContent.make("$get('a') ?? 'B'")),
    ]).toHtml());
    assert.match(html, /<input[^>]*data-input="yes"/);
    assert.match(html, /data-field-wrapper[^>]*data-wrapper="yes"|data-wrapper="yes"[^>]*data-field-wrapper/);
    assert.match(html, /x-on:keyup="count\+\+"/);
    assert.ok(html.includes(`<span x-text="() =>eval('$get(\\u0027a\\u0027) ?? \\u0027B\\u0027')"></span>`));
});

test('afterStateHydrated(), formatStateUsing(), dehydrateStateUsing()', async () => {
    const data: Record<string, unknown> = {};
    const schema = form(host(data), [
        TextInput.make('a').default('x').afterStateHydrated(({ component, state }) => { (component as any).livewire.data.a = `${state}!`; }),
        TextInput.make('b').default('lower').formatStateUsing(({ state }) => String(state).toUpperCase()),
        TextInput.make('c').default(' padded ').dehydrateStateUsing(({ state }) => String(state).trim()),
    ]);
    fillSchema(schema, data);
    assert.equal(data.b, 'LOWER');
    assert.ok(String(data.a).startsWith('x'));
    const state = await getSchemaState(schema);
    assert.equal(state.c, 'padded');
});

test('afterStateUpdated() receives old / oldRaw / rawState; get() and set() take relative and absolute paths', async () => {
    const seen: Record<string, unknown> = {};
    const livewire = host({ title: 'New', slug: '', meta: { count: 0 } }, { _oldValues: new Map([['data.title', 'Old']]) });
    const schema = form(livewire, [
        TextInput.make('title').live().afterStateUpdated(({ old, oldRaw, state, rawState, get, set }) => {
            Object.assign(seen, { old, oldRaw, state, rawState, absolute: get('/data.meta.count') });
            set('slug', String(state).toLowerCase());
        }),
        TextInput.make('slug'),
        Group.make().statePath('meta').schema([TextInput.make('count').afterStateUpdated(({ get }) => { seen.parent = get('../title'); })]),
    ]);
    await schema.callAfterStateUpdated('data.title');
    assert.deepEqual(seen, { old: 'Old', oldRaw: 'Old', state: 'New', rawState: 'New', absolute: 0 });
    assert.equal(livewire.data.slug, 'new');
    await schema.callAfterStateUpdated('data.meta.count');
    assert.equal(seen.parent, 'New');
});

test('live(debounce:) / live(onBlur:) on any field, afterStateUpdatedJs()', async () => {
    const html = norm(await form(host(), [
        Textarea.make('a').live({ debounce: 500 }),
        DatePicker.make('b').native().live({ onBlur: true }),
        TextInput.make('c').afterStateUpdatedJs("$set('d', $state)"),
    ]).toHtml());
    assert.match(html, /wire:model\.live\.debounce\.500="data\.a"/);
    assert.match(html, /wire:model\.live\.blur="data\.b"|wire:model\.blur="data\.b"/);
    assert.ok(html.includes("eval('$set(\\u0027d\\u0027, $state)')"));
});

test('partial rendering after a state update', async () => {
    const partials: string[] = [];
    let skipped = 0;
    const livewire = host({ a: '', b: '', c: '' }, { renderPartial: (name: string) => partials.push(name), skipRender: () => { skipped++; } });
    const schema = form(livewire, [
        TextInput.make('a').live().partiallyRenderComponentsAfterStateUpdated(['b']),
        TextInput.make('b').live().partiallyRenderAfterStateUpdated(),
        TextInput.make('c').live().skipRenderAfterStateUpdated(),
    ]);
    await schema.callAfterStateUpdated('data.a');
    await schema.callAfterStateUpdated('data.b');
    await schema.callAfterStateUpdated('data.c');
    assert.deepEqual(partials, ['schema-component::form.b', 'schema-component::form.b']);
    assert.equal(skipped, 1);
});

test('getContainer().getComponent() finds a sibling by key', async () => {
    const schema = form(host(), [TextInput.make('a'), Section.make('S').key('section').schema([TextInput.make('b')])]);
    const a = schema.getComponent('form.a', { isAbsoluteKey: true })!;
    assert.ok(a);
    assert.equal(a.getContainer().getComponent('section')?.getKey(), 'form.section');
    assert.equal((a.getContainer().getComponent((component) => component.getKey() === 'form.section') as any)?.getKey(), 'form.section');
});

test('setters accept functions of the field context', async () => {
    const html = norm(await form(host({ kind: 'pro', a: '' }), [
        TextInput.make('a').placeholder(({ get }) => `for ${get('kind')}`).prefix(() => 'P:').helperText(({ get }) => `helper ${get('kind')}`).readOnly(({ get }) => get('kind') === 'pro'),
        Select.make('s').options({ x: 'X' }).native(() => false).selectablePlaceholder(() => false),
        Textarea.make('t').disableGrammarly(() => true),
    ]).toHtml());
    assert.ok(html.includes('placeholder="for pro"'));
    assert.ok(html.includes('P:'));
    assert.ok(html.includes('helper pro'));
    assert.match(html, /id="form\.a"[^>]*readonly/);
    assert.match(html, /data-gramm="false"/);
    // Rule parameters may be functions too.
    const errors = await validateSchema(form(host({ min: 'b', v: 'a', w: 'zz', x: 'q' }), [
        TextInput.make('v').startsWith(({ get }) => [String(get('min'))]),
        TextInput.make('w').in(() => ['yy']),
        TextInput.make('x').regex(() => '/^[a-p]$/'),
        TextInput.make('y').requiredIf(() => 'min', () => 'b'),
    ]));
    assert.deepEqual(Object.keys(errors).sort(), ['data.v', 'data.w', 'data.x', 'data.y']);
});

test('repeater and key-value guards set with functions are enforced on the server', async () => {
    const livewire = host({ items: { one: { name: 'A' } } });
    const repeater = Repeater.make('items').schema([TextInput.make('name')]).addable(() => false).deletable(({ get }) => get('locked') !== true);
    form(livewire, [repeater]);
    const add = repeater.getActions().find((action) => action.getName() === 'add')!;
    await (add as any)._handler({ arguments: {} });
    assert.deepEqual(Object.keys((livewire.data as any).items), ['one']);
    const keyValue = KeyValue.make('meta').addable(() => false);
    const kvHost = host({ meta: [{ key: 'a', value: '1' }, { key: 'b', value: '2' }] });
    const schema = form(kvHost, [keyValue]);
    const state = await getSchemaState(schema);
    assert.deepEqual(state.meta, {});
});

test('validation methods', async () => {
    const check = async (data: Record<string, unknown>, components: any[]) => validateSchema(form(host(data), components));
    assert.deepEqual(Object.keys(await check({ start: '2024-01-10', end: '2024-01-05' }, [
        DatePicker.make('start'),
        DatePicker.make('end').afterOrEqual('start'),
    ])), ['data.end']);
    assert.deepEqual(Object.keys(await check({ d: '2024-01-01' }, [DatePicker.make('d').before('2023-12-31')])), ['data.d']);
    assert.deepEqual(Object.keys(await check({ d: '2023-12-31' }, [DatePicker.make('d').beforeOrEqual('2023-12-31').after('2023-01-01')])), []);
    assert.deepEqual(Object.keys(await check({ t: 'no' }, [TextInput.make('t').accepted()])), ['data.t']);
    assert.deepEqual(Object.keys(await check({ t: 'no' }, [TextInput.make('t').declined()])), []);
    assert.deepEqual(Object.keys(await check({ t: '' }, [TextInput.make('t').filled()])), ['data.t']);
    assert.deepEqual(Object.keys(await check({ t: '' }, [TextInput.make('t').nullable()])), []);
    assert.deepEqual(Object.keys(await check({ t: 12 }, [TextInput.make('t').string()])), ['data.t']);
    // Not dehydrated: still validated, unless validatedWhenNotDehydrated(false).
    assert.deepEqual(Object.keys(await check({ t: '' }, [TextInput.make('t').required().dehydrated(false)])), ['data.t']);
    assert.deepEqual(Object.keys(await check({ t: '' }, [TextInput.make('t').required().saved(false).validatedWhenNotDehydrated(() => false)])), []);
    // HTML in messages is escaped unless allowed.
    const livewire = host({ t: '' });
    livewire._errors = { 'data.t': ['<b>bold</b>'] };
    assert.ok((await form(livewire, [TextInput.make('t')]).toHtml()).includes('&lt;b&gt;bold&lt;/b&gt;'));
    assert.ok((await form(livewire, [TextInput.make('t').allowHtmlValidationMessages()]).toHtml()).includes('<b>bold</b>'));
    // activeUrl(): a URL whose host has no DNS record fails.
    assert.deepEqual(Object.keys(await check({ u: 'not a url' }, [TextInput.make('u').activeUrl()])), ['data.u']);
});
