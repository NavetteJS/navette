import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, raw, views } from '@navette-js/support';
import { Schema, FusedGroup, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { Action, useColorManager as useActionsColorManager } from '@navette-js/actions';
import { CodeEditor, Hidden, MarkdownEditor, OneTimeCodeInput, Placeholder, RawJs, Select, Slider, TextInput, getSchemaState, useColorManager, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

/** Minimal host component: an id, errors and the form state under `data`. */
const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {} });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
/** HTML without the EJS layout whitespace, with apostrophes decoded, so it compares against compact expected markup. */
const norm = (html: string) => html.replace(/>\s+/g, '>').replace(/\s+</g, '<').replace(/&#039;/g, "'");

test('MarkdownEditor: markup, toolbar, no attachments', async () => {
    const html = norm(await form(host({ body: '# Title' }), [MarkdownEditor.make('body').label('Content')]).toHtml());
    assert.match(html, /<div id="form\.body-label" class="nv-fo-field-label">/);
    assert.match(html, /<div class="nv-fo-markdown-editor nv-input-wrp"><div class="nv-input-wrp-content-ctn"><div hidden data-field-accessibility ><\/div><div aria-labelledby="form\.body-label" id="form\.body" role="group" x-load x-load-src="\/js\/navette\/forms\/components\/markdown-editor\.js" x-data="markdownEditorFormComponent\(/);
    assert.match(html, /canAttachFiles: false/);
    assert.match(html, /minHeight: '10rem'/);
    assert.match(html, /state: \$wire\.\$entangle\('data\.body', false\)/);
    assert.match(html, /<textarea x-ref="editor" x-cloak><\/textarea>/);
    assert.match(html, /\\u0022bold\\u0022,\\u0022italic\\u0022,\\u0022strike\\u0022,\\u0022link\\u0022/);
    assert.ok(!html.includes('attachFiles'));
    const custom = await form(host(), [MarkdownEditor.make('body').toolbarButtons([['bold'], ['undo']]).disableToolbarButtons(['undo']).live()]).toHtml();
    assert.match(custom, /toolbarButtons: JSON\.parse\(&#039;\[\[\\u0022bold\\u0022\]\]&#039;\)/);
    assert.match(custom, /\$entangle\(&#039;data\.body&#039;, true\)/);
    // Read-only: escaped text, never interpreted.
    const disabled = await form(host({ body: '<script>x</script>' }), [MarkdownEditor.make('body').disabled()]).toHtml();
    assert.match(disabled, /class="nv-fo-markdown-editor nv-disabled nv-prose"/);
    assert.ok(disabled.includes('&lt;script&gt;') && !disabled.includes('<script>'));
});

test('MarkdownEditor: validation rejects non-string values', async () => {
    const livewire = host({ body: ['not', 'a', 'string'] });
    assert.deepEqual(await validateSchema(form(livewire, [MarkdownEditor.make('body')])), { 'data.body': ['The body field must be a string.'] });
});

test('CodeEditor: language, wrapping, stable key hash', async () => {
    const html = norm(await form(host(), [CodeEditor.make('code')]).toHtml());
    // Expected key hash for the default options.
    assert.match(html, /wire:key="lw\.form\.code\.bba3c214551109422365e6bf973a6cd7"/);
    assert.match(html, /<div class="nv-fo-code-editor nv-input-wrp"><div class="nv-input-wrp-content-ctn"><div hidden data-field-accessibility ><\/div><div aria-labelledby="form\.code-label" id="form\.code" role="group"/);
    assert.match(html, /canWrap: false,\n isDisabled: false,/);
    assert.match(html, /<div x-ref="editor" x-cloak><\/div>/);
    const php = await form(host(), [CodeEditor.make('code').language('php').wrap()]).toHtml();
    assert.match(php, /canWrap: true/);
    assert.match(php, /language: &#039;php&#039;/);
    assert.throws(() => CodeEditor.make('code').language('<script>'));
});

test('Slider: configuration, key hash, classes and bounds validation', async () => {
    const livewire = host({ volume: 50, range: [20, 70] });
    const schema = form(livewire, [
        Slider.make('volume').label('Slider'),
        Slider.make('range').tooltips([true, false]).fillTrack([false, true, false]).pips().vertical().step(5),
        Slider.make('price').tooltips(RawJs.make('`$${$value.toFixed(2)}`')),
    ]);
    const html = norm(await schema.toHtml());
    assert.match(html, /Slider<sup class="nv-fo-field-label-required-mark">\*<\/sup>/);
    // Expected key hash for the default options.
    assert.match(html, /wire:key="lw\.form\.volume\.a8cf63fecab3eb3edf6760bc02f258a6" aria-labelledby="form\.volume-label" id="form\.volume" role="group" class="nv-fo-slider"/);
    assert.match(html, /behavior: 'tap',/);
    assert.match(html, /tooltips: \[true, false\]/);
    assert.match(html, /fillTrack: JSON\.parse\('\[false,true,false\]'\)/);
    assert.match(html, /class="nv-fo-slider nv-fo-slider-has-pips nv-fo-slider-has-tooltips nv-fo-slider-vertical"/);
    assert.match(html, /isRtl: true/);
    assert.match(html, /tooltips: \{ to: \(\$value\) =&gt; `\$\$\{\$value\.toFixed\(2\)\}` \}/);
    assert.deepEqual(await validateSchema(schema), { 'data.price': ['The price field is required.'] });
    livewire.data.volume = 150;
    livewire.data.range = [20, 72];
    livewire.data.price = 'abc';
    assert.deepEqual(await validateSchema(schema), {
        'data.volume': ['The slider field must not be greater than 100.'],
        'data.range': ['The range field must be a multiple of 5.'],
        'data.price': ['The price field must be a number.'],
    });
    livewire.data.volume = '40';
    livewire.data.range = ['20', 70];
    livewire.data.price = 10;
    assert.deepEqual(await validateSchema(schema), {});
    assert.deepEqual(await getSchemaState(schema), { volume: 40, range: [20, 70], price: 10 });
});

test('Hidden: plain hidden input, outside the grid', async () => {
    const html = norm(await form(host(), [Hidden.make('token')]).toHtml());
    assert.match(html, /class="nv-grid-col nv-hidden"/);
    assert.match(html, /<input id="form\.token" type="hidden" wire:model="data\.token" class="nv-fo-hidden" \/>/);
});

test('OneTimeCodeInput: one box per digit, strict validation', async () => {
    const livewire = host({ code: '12a456' });
    const schema = form(livewire, [OneTimeCodeInput.make('code').length(4).required()]);
    const html = norm(await schema.toHtml());
    assert.equal(html.match(/class="nv-one-time-code-input-digit"/g)?.length, 4);
    assert.match(html, /<input autocomplete="one-time-code" inputmode="numeric" type="text" id="form\.code" required="required" class="nv-one-time-code-input-digit" \/>/);
    assert.match(html, /aria-label="Character 2 of 4"/);
    assert.match(html, /x-data="navetteOneTimeCodeInput\(\{ shouldSubmitOnCompletion: false \}\)" x-modelable="state" x-model="code" dir="ltr" role="group" aria-label="Code" class="nv-one-time-code-input-ctn"/);
    assert.deepEqual(await validateSchema(schema), { 'data.code': ['The code field must be a number.'] });
    livewire.data.code = '01234';
    assert.deepEqual(await validateSchema(schema), { 'data.code': ['The code field must be 4 digits.'] });
    livewire.data.code = '0123';
    assert.deepEqual(await validateSchema(schema), {});
});

test('Placeholder: escaped text in an entry, nothing saved', async () => {
    const schema = form(host(), [Placeholder.make('created').label('Created').content('<b>yesterday</b>'), Placeholder.make('link').content(raw('<a href="/x">x</a>'))]);
    const html = norm(await schema.toHtml());
    assert.match(html, /<div class="nv-in-entry-label" role="term">Created<\/div>/);
    assert.ok(html.includes('&lt;b&gt;yesterday&lt;/b&gt;'));
    assert.ok(html.includes('<a href="/x">x</a>'));
    assert.deepEqual(await getSchemaState(schema), {});
});

test('hint: text, raw HTML, icon and action after the label (login page markup)', async () => {
    const html = norm(await form(host(), [
        TextInput.make('password').required().hint(raw('<a href="/reset" class="nv-link" tabindex="-1"><span class="nv-link-label">Forgot password?</span></a>')),
        TextInput.make('name').hint('<i>escaped</i>').hintColor('danger').hintIcon('o-information-circle', 'Help'),
        TextInput.make('email').hintAction(Action.make('check').label('Check').action(() => {})),
    ]).toHtml());
    assert.ok(html.includes(`<label for="form.password" class="nv-fo-field-label">`));
    assert.ok(html.includes(`</label><div class="nv-sc nv-inline nv-align-end nv-sc-has-gap nv-sc-dense"><div x-data="navetteSchemaComponent(JSON.parse('{\\u0022key\\u0022:null,\\u0022exposedMethods\\u0022:[],\\u0022path\\u0022:\\u0022data.password\\u0022,\\u0022containerPath\\u0022:\\u0022data\\u0022}'))"><div class="nv-sc-component"><span class="nv-sc-text"><a href="/reset" class="nv-link" tabindex="-1"><span class="nv-link-label">Forgot password?</span></a></span></div></div></div></div></div>`));
    assert.ok(html.includes('&lt;i&gt;escaped&lt;/i&gt;'));
    assert.match(html, /class="nv-color nv-color-danger nv-text-color-\d+ dark:nv-text-color-\d+ nv-sc-text"/);
    assert.match(html, /x-tooltip="\{ content: &#039;Help&#039;|x-tooltip="\{ content: 'Help'/);
    assert.match(html, /aria-hidden="true"[^>]*class="nv-color nv-color-danger nv-sc-icon nv-icon nv-size-md"/);
    assert.match(html, /<span aria-label="Help" role="img" class="nv-sr-only"><\/span>/);
    assert.match(html, /<div class="nv-sc-action"><button type="button" [^>]*class="nv-ac-link-action nv-link nv-size-sm[^"]*" wire:click="mountAction\('check', \{\}, JSON\.parse\('\{\\u0022schemaComponent\\u0022:\\u0022form\.email\\u0022\}'\)\)">/);
    assert.ok(!html.includes('wire:key=""'));
});

test('hint: hint actions can be mounted on the field', () => {
    const field = TextInput.make('email').hintAction(Action.make('check').action(() => {}));
    assert.deepEqual(field.getActions().map((action) => action.getName()), ['check']);
});

test('FusedGroup: joined fields, screen-reader labels, first error under the group', async () => {
    const livewire = host();
    livewire._errors = { 'data.country': ['The country field is required.'] };
    const html = norm(await form(livewire, [FusedGroup.make([TextInput.make('city').placeholder('City'), Select.make('country').placeholder('Country')]).label('Location').columns(2)]).toHtml());
    assert.ok(html.includes('<div data-field-wrapper class="nv-fo-field"><div class="nv-fo-field-label-col"><div class="nv-fo-field-label-ctn"><label class="nv-fo-field-label"><span class="nv-fo-field-label-content">Location</span></label></div></div><div class="nv-fo-field-content-col"><div role="group" class="nv-sc-fused-group"><div class="nv-grid lg:nv-grid-cols nv-sc" style="--cols-lg: repeat(2, minmax(0, 1fr)); --cols-default: repeat(1, minmax(0, 1fr));">'));
    assert.ok(html.includes('<div data-field-wrapper class="nv-fo-field"><label for="form.city" class="nv-fo-field-label nv-sr-only">City</label><div x-on:focus-input.stop="$el.querySelector(\'input\')?.focus()" class="nv-fo-text-input nv-input-wrp"><div class="nv-input-wrp-content-ctn"><input id="form.city" placeholder="City" type="text" wire:model="data.city" class="nv-input" /></div></div></div>'));
    assert.ok(html.includes('<option value="">Country</option>'));
    assert.match(html, /<p data-validation-error class="nv-fo-field-wrp-error-message">The country field is required\.<\/p><\/div><\/div>/);
    assert.equal(html.match(/data-validation-error/g)?.length, 1);
});

/** Host that keeps state and can validate a modal form, like a panel page. */
const pageLike = (data: Record<string, unknown>) => ({ ...host(data), getActionMountContext: () => ({}) });

test('Select: "+" button, create modal, the created option becomes the state', async () => {
    const authors: Record<string, string> = { 1: 'Dan' };
    const livewire = pageLike({ author: null });
    const select = Select.make('author').label('Author').options(() => authors)
        .createOptionForm([TextInput.make('name').required()])
        .createOptionUsing((data) => { const id = String(Object.keys(authors).length + 1); authors[id] = String(data.name); return id; });
    const schema = form(livewire, [select]);
    const html = norm(await schema.toHtml());
    assert.ok(html.includes(`</select></div><div class="nv-input-wrp-suffix"><div class="nv-input-wrp-actions"><button title="Create" aria-label="Create" type="button" wire:loading.attr="aria-disabled" wire:loading.class="nv-disabled" class="nv-ac-icon-btn-action nv-icon-btn nv-size-sm" wire:click="mountAction('createOption', {}, JSON.parse('{\\u0022schemaComponent\\u0022:\\u0022form.author\\u0022}'))"><svg wire:loading.remove.delay.default="1"`));
    assert.ok(!html.includes('editOption'));
    const [create] = select.getActions();
    assert.equal(create.getName(), 'createOption');
    // The modal form is a real schema: it is validated on the server.
    const modal = create.applySchema(Schema.make(livewire as any).key('mountedActionSchema0').statePath('mountedActions.0.data'));
    (livewire as any).mountedActions = [{ data: { name: '' } }];
    assert.deepEqual(await validateSchema(modal), { 'mountedActions.0.data.name': ['The name field is required.'] });
    await create.call({ livewire, record: null, arguments: {}, data: { name: 'Zoe' } });
    assert.equal(livewire.data.author, '2');
    assert.deepEqual(await validateSchema(schema), {});
    assert.match(await schema.toHtml(), /<option value="2">Zoe<\/option>/);
});

test('Select: create in multiple mode (appended) and edit the selected option', async () => {
    const tags: Record<string, string> = { a: 'A' };
    const livewire = pageLike({ tags: ['a'], author: 'dan' });
    let updated: unknown = null;
    const multiple = Select.make('tags').multiple().options(() => tags).createOptionForm([TextInput.make('name')]).createOptionUsing((data) => { tags.b = String(data.name); return 'b'; });
    const single = Select.make('author').options({ dan: 'Dan Harrin' }).editOptionForm([TextInput.make('name')])
        .fillEditOptionActionFormUsing(({ state }) => ({ name: state === 'dan' ? 'Dan Harrin' : null }))
        .updateOptionUsing((data) => { updated = data; });
    const schema = form(livewire, [multiple, single]);
    const html = norm(await schema.toHtml());
    assert.match(html, /wire:model\.live="data\.author"/);
    assert.match(html, /<button title="Edit" aria-label="Edit"[^>]*wire:click="mountAction\('editOption', \{\}, JSON\.parse\('\{\\u0022schemaComponent\\u0022:\\u0022form\.author\\u0022\}'\)\)"/);
    const [create] = multiple.getActions();
    await create.call({ livewire, record: null, arguments: {}, data: { name: 'B' } });
    assert.deepEqual(livewire.data.tags, ['a', 'b']);
    const [edit] = single.getActions();
    assert.equal(edit.getName(), 'editOption');
    assert.deepEqual(await edit.getFormFill({ livewire, record: null, arguments: {}, data: {} }), { name: 'Dan Harrin' });
    await edit.call({ livewire, record: null, arguments: {}, data: { name: 'Dan' } });
    assert.deepEqual(updated, { name: 'Dan' });
    // Empty field: no edit button; disabled field: no visible action.
    livewire.data.author = null;
    assert.ok(!(await schema.toHtml()).includes('editOption'));
    const disabled = Select.make('x').disabled().options({}).createOptionForm([TextInput.make('name')]);
    assert.ok(!(await form(livewire, [disabled]).toHtml()).includes('createOption'));
});
