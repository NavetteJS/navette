import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { JsField, RawJs, getSchemaState, useColorManager, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

const host = (data: Record<string, unknown> = {}, errors: Record<string, string[]> = {}) => ({ id: 'lw', _errors: errors, data, getSchema() { return null as any; }, dispatch() {} });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
const md5 = (value: string) => createHash('md5').update(value).digest('hex');
/** Decodes the HTML entities of an attribute value. */
const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attribute = (html: string, name: string) => { const match = html.match(new RegExp(`${name}="([^"]*)"`)); assert.ok(match, `missing ${name}`); return decode(match[1]); };

test('JsField: Filament markup, entangled state, renderer URL and Alpine component', async () => {
    const html = await form(host({ location: { latitude: 51.5, longitude: -0.12 } }), [JsField.make('location').renderer('/js/fields/location-picker.js')]).toHtml();
    assert.match(html, /<label for="form\.location" class="fi-fo-field-label">/);
    // The key changes with the renderer and the state binding (which remount it), not with the configuration.
    assert.ok(html.includes(`wire:key="lw.form.location.${md5('{"isLive":false,"isLiveOnBlur":false,"debounce":null}/js/fields/location-picker.js')}"`));
    assert.ok(html.includes('x-load-src="/js/filament/forms/components/js-field.js"'));
    assert.ok(html.includes('x-data="jsFieldFormComponent({'));
    assert.ok(html.includes('state: $wire.$entangle(&#039;data.location&#039;),'));
    assert.ok(html.includes('renderer: &#039;\\/js\\/fields\\/location-picker.js&#039;,'));
    assert.ok(html.includes(`...JSON.parse('{\\u0022isLive\\u0022:false,\\u0022isLiveOnBlur\\u0022:false,\\u0022debounce\\u0022:null}'),`));
    assert.equal(attribute(html, 'data-renderer-configuration'), '[]');
    assert.deepEqual(JSON.parse(attribute(html, 'data-field-configuration')), { id: 'form.location', ariaDescribedBy: '', isDisabled: false, isReadOnly: false, isRequired: false, isInvalid: false });
    assert.ok(html.includes(`wire:key="lw.form.location.renderer-configuration.${md5('[[],{"id":"form.location","ariaDescribedBy":"","isDisabled":false,"isReadOnly":false,"isRequired":false,"isInvalid":false}]')}"`));
    assert.ok(html.includes('x-init="updateRendererConfiguration(JSON.parse($el.dataset.rendererConfiguration), JSON.parse($el.dataset.fieldConfiguration))"'));
    assert.ok(html.includes('<div wire:ignore x-ref="host"></div>'));
    assert.match(html, /<p x-cloak x-show="hasError" role="alert" class="fi-fo-field-wrp-error-message">\s*This field could not be loaded\. Please reload the page to try again\.\s*<\/p>/);
});

test('JsField: input settings, accessibility and validation errors reach the props', async () => {
    const livewire = host({ location: null }, { 'data.location': ['The location field is required.'] });
    const html = await form(livewire, [JsField.make('location').renderer('/x.js').required().disabled().readOnly().helperText('Pick a point.')]).toHtml();
    assert.deepEqual(JSON.parse(attribute(html, 'data-field-configuration')), {
        id: 'form.location', ariaDescribedBy: 'form.location-helper-text form.location-error', isDisabled: true, isReadOnly: true, isRequired: true, isInvalid: true,
    });
    assert.match(html, /<p id="form\.location-error" data-validation-error class="fi-fo-field-wrp-error-message">\s*The location field is required\./);
    assert.ok(html.includes('id="form.location-helper-text"'));
});

test('JsField: state binding modifiers (live, on blur, debounce)', async () => {
    const binding = async (field: JsField) => {
        const html = await form(host(), [field]).toHtml();
        const match = html.match(/\.\.\.JSON\.parse\('(\{\\u0022isLive[^']*)'\)/);
        assert.ok(match);
        return JSON.parse(match[1].replace(/\\u0022/g, '"'));
    };
    assert.deepEqual(await binding(JsField.make('a').live()), { isLive: true, isLiveOnBlur: false, debounce: null });
    assert.deepEqual(await binding(JsField.make('a').live({ onBlur: true })), { isLive: true, isLiveOnBlur: true, debounce: null });
    assert.deepEqual(await binding(JsField.make('a').live({ debounce: 500 })), { isLive: true, isLiveOnBlur: false, debounce: 500 });
    assert.deepEqual(await binding(JsField.make('a').live({ debounce: '0.5s' })), { isLive: true, isLiveOnBlur: false, debounce: 500 });
    assert.deepEqual(await binding(JsField.make('a').live({ debounce: '250ms' })), { isLive: true, isLiveOnBlur: false, debounce: 250 });
    assert.deepEqual(await binding(JsField.make('a').live({ debounce: 300 }).live(false)), { isLive: false, isLiveOnBlur: false, debounce: null });
    assert.equal(JsField.make('a').live({ onBlur: true }).isLive(), true);
});

test('JsField: configuration from a function of the context, RawJs renderer, escaping', async () => {
    const livewire = host({ country: 'GB', location: null });
    const html = await form(livewire, [
        JsField.make('location')
            .renderer(RawJs.make('window.mountLocationPicker'))
            .rendererConfiguration(({ get }) => ({ country: get('country'), zoom: 12, note: '</p><script>alert(1)</script>', city: 'Zürich' }))
            .extraAttributes({ 'data-test': 'picker' }),
    ]).toHtml();
    assert.ok(html.includes('renderer: window.mountLocationPicker,'));
    assert.ok(html.includes(`wire:key="lw.form.location.${md5('{"isLive":false,"isLiveOnBlur":false,"debounce":null}window.mountLocationPicker')}"`));
    assert.ok(html.includes(' data-test="picker"'));
    // JSON-encoded as PHP does, then escaped for the attribute: no raw markup reaches the page.
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('data-renderer-configuration="{&quot;country&quot;:&quot;GB&quot;,&quot;zoom&quot;:12,&quot;note&quot;:&quot;&lt;\\/p&gt;&lt;script&gt;alert(1)&lt;\\/script&gt;&quot;,&quot;city&quot;:&quot;Z\\u00fcrich&quot;}"'));
    assert.deepEqual(JSON.parse(attribute(html, 'data-renderer-configuration')), { country: 'GB', zoom: 12, note: '</p><script>alert(1)</script>', city: 'Zürich' });
    // A renderer URL is a JavaScript string: quotes cannot close it.
    const quoted = await form(host(), [JsField.make('a').renderer("/x.js'),alert(1),('")]).toHtml();
    assert.ok(quoted.includes('renderer: &#039;\\/x.js\\u0027),alert(1),(\\u0027&#039;,'));
    await assert.rejects(form(host(), [JsField.make('a').rendererConfiguration(['x'] as any)]).toHtml(), /must be an object/);
    // No renderer: the Alpine component mounts nothing.
    assert.ok((await form(host(), [JsField.make('a')]).toHtml()).includes('renderer: null,'));
});

test('JsField: the state is validated, dehydrated and saved like any field (not when disabled)', async () => {
    const livewire = host({ location: { latitude: 51.5, longitude: -0.12 }, notes: 'x' });
    const isLocation = (value: unknown) => typeof value === 'object' && value !== null && Object.values(value).every((item) => item === null || typeof item === 'number');
    const schema = form(livewire, [
        JsField.make('location').renderer('/x.js').required().rule({ name: 'location', passes: isLocation, message: (attribute) => `The ${attribute} field must be a location.` }),
        JsField.make('notes').renderer('/y.js').disabled(),
    ]);
    assert.deepEqual(await validateSchema(schema), {});
    assert.deepEqual(await getSchemaState(schema), { location: { latitude: 51.5, longitude: -0.12 } });
    livewire.data.location = { latitude: '<b>' } as any;
    assert.deepEqual(await validateSchema(schema), { 'data.location': ['The location field must be a location.'] });
    livewire.data.location = null as any;
    assert.deepEqual(await validateSchema(schema), { 'data.location': ['The location field is required.'] });
});

test('JsField: a reusable field overrides getRenderer() and getRendererConfiguration()', async () => {
    class LocationPicker extends JsField {
        static make(name: string): LocationPicker { return new LocationPicker(name); }
        async getRenderer() { return '/vendor/location-picker/location-picker.js'; }
        async getRendererConfiguration() { return { zoom: 8 }; }
    }
    const html = await form(host(), [LocationPicker.make('location').live()]).toHtml();
    assert.ok(html.includes('renderer: &#039;\\/vendor\\/location-picker\\/location-picker.js&#039;,'));
    assert.equal(attribute(html, 'data-renderer-configuration'), '{"zoom":8}');
});
