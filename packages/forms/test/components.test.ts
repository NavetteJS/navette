import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, raw, views } from '@navette/support';
import { Schema, FusedGroup, useColorManager as useSchemasColorManager } from '@navette/schemas';
import { Action, useColorManager as useActionsColorManager } from '@navette/actions';
import { CodeEditor, Hidden, MarkdownEditor, OneTimeCodeInput, Placeholder, RawJs, Select, Slider, TextInput, getSchemaState, useColorManager, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

/** Composant hôte minimal : un identifiant, des erreurs et l'état du formulaire sous `data`. */
const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {} });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
/** HTML sans les blancs de mise en page des vues EJS, apostrophes décodées : comparable au HTML compacté de l'oracle. */
const norm = (html: string) => html.replace(/>\s+/g, '>').replace(/\s+</g, '<').replace(/&#039;/g, "'");

test('MarkdownEditor : balisage de Filament, barre d\'outils, sans pièces jointes', async () => {
    const html = norm(await form(host({ body: '# Titre' }), [MarkdownEditor.make('body').label('Content')]).toHtml());
    assert.match(html, /<div id="form\.body-label" class="fi-fo-field-label">/);
    assert.match(html, /<div class="fi-fo-markdown-editor fi-input-wrp"><div class="fi-input-wrp-content-ctn"><div hidden data-field-accessibility ><\/div><div aria-labelledby="form\.body-label" id="form\.body" role="group" x-load x-load-src="\/js\/filament\/forms\/components\/markdown-editor\.js" x-data="markdownEditorFormComponent\(/);
    assert.match(html, /canAttachFiles: false/);
    assert.match(html, /minHeight: '10rem'/);
    assert.match(html, /state: \$wire\.\$entangle\('data\.body', false\)/);
    assert.match(html, /<textarea x-ref="editor" x-cloak><\/textarea>/);
    assert.match(html, /\\u0022bold\\u0022,\\u0022italic\\u0022,\\u0022strike\\u0022,\\u0022link\\u0022/);
    assert.ok(!html.includes('attachFiles'));
    const custom = await form(host(), [MarkdownEditor.make('body').toolbarButtons([['bold'], ['undo']]).disableToolbarButtons(['undo']).live()]).toHtml();
    assert.match(custom, /toolbarButtons: JSON\.parse\(&#039;\[\[\\u0022bold\\u0022\]\]&#039;\)/);
    assert.match(custom, /\$entangle\(&#039;data\.body&#039;, true\)/);
    // Lecture seule : texte échappé, jamais interprété.
    const disabled = await form(host({ body: '<script>x</script>' }), [MarkdownEditor.make('body').disabled()]).toHtml();
    assert.match(disabled, /class="fi-fo-markdown-editor fi-disabled fi-prose"/);
    assert.ok(disabled.includes('&lt;script&gt;') && !disabled.includes('<script>'));
});

test('MarkdownEditor : la validation refuse ce qui n\'est pas du texte', async () => {
    const livewire = host({ body: ['pas', 'du', 'texte'] });
    assert.deepEqual(await validateSchema(form(livewire, [MarkdownEditor.make('body')])), { 'data.body': ['The body field must be a string.'] });
});

test('CodeEditor : langage, retour à la ligne, empreinte identique à Filament', async () => {
    const html = norm(await form(host(), [CodeEditor.make('code')]).toHtml());
    // md5(serialize([false, null])), relevé sur l'oracle.
    assert.match(html, /wire:key="lw\.form\.code\.bba3c214551109422365e6bf973a6cd7"/);
    assert.match(html, /<div class="fi-fo-code-editor fi-input-wrp"><div class="fi-input-wrp-content-ctn"><div hidden data-field-accessibility ><\/div><div aria-labelledby="form\.code-label" id="form\.code" role="group"/);
    assert.match(html, /canWrap: false,\n isDisabled: false,/);
    assert.match(html, /<div x-ref="editor" x-cloak><\/div>/);
    const php = await form(host(), [CodeEditor.make('code').language('php').wrap()]).toHtml();
    assert.match(php, /canWrap: true/);
    assert.match(php, /language: &#039;php&#039;/);
    assert.throws(() => CodeEditor.make('code').language('<script>'));
});

test('Slider : configuration, empreinte, classes et validation des bornes', async () => {
    const livewire = host({ volume: 50, range: [20, 70] });
    const schema = form(livewire, [
        Slider.make('volume').label('Slider'),
        Slider.make('range').tooltips([true, false]).fillTrack([false, true, false]).pips().vertical().step(5),
        Slider.make('price').tooltips(RawJs.make('`$${$value.toFixed(2)}`')),
    ]);
    const html = norm(await schema.toHtml());
    assert.match(html, /Slider<sup class="fi-fo-field-label-required-mark">\*<\/sup>/);
    // md5(serialize([false])), relevé sur l'oracle.
    assert.match(html, /wire:key="lw\.form\.volume\.a8cf63fecab3eb3edf6760bc02f258a6" aria-labelledby="form\.volume-label" id="form\.volume" role="group" class="fi-fo-slider"/);
    assert.match(html, /behavior: 'tap',/);
    assert.match(html, /tooltips: \[true, false\]/);
    assert.match(html, /fillTrack: JSON\.parse\('\[false,true,false\]'\)/);
    assert.match(html, /class="fi-fo-slider fi-fo-slider-has-pips fi-fo-slider-has-tooltips fi-fo-slider-vertical"/);
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

test('Hidden : simple input caché, hors de la grille', async () => {
    const html = norm(await form(host(), [Hidden.make('token')]).toHtml());
    assert.match(html, /class="fi-grid-col fi-hidden"/);
    assert.match(html, /<input id="form\.token" type="hidden" wire:model="data\.token" class="fi-fo-hidden" \/>/);
});

test('OneTimeCodeInput : une case par chiffre, validation stricte', async () => {
    const livewire = host({ code: '12a456' });
    const schema = form(livewire, [OneTimeCodeInput.make('code').length(4).required()]);
    const html = norm(await schema.toHtml());
    assert.equal(html.match(/class="fi-one-time-code-input-digit"/g)?.length, 4);
    assert.match(html, /<input autocomplete="one-time-code" inputmode="numeric" type="text" id="form\.code" required="required" class="fi-one-time-code-input-digit" \/>/);
    assert.match(html, /aria-label="Character 2 of 4"/);
    assert.match(html, /x-data="filamentOneTimeCodeInput\(\{ shouldSubmitOnCompletion: false \}\)" x-modelable="state" x-model="code" dir="ltr" role="group" aria-label="Code" class="fi-one-time-code-input-ctn"/);
    assert.deepEqual(await validateSchema(schema), { 'data.code': ['The code field must be a number.'] });
    livewire.data.code = '01234';
    assert.deepEqual(await validateSchema(schema), { 'data.code': ['The code field must be 4 digits.'] });
    livewire.data.code = '0123';
    assert.deepEqual(await validateSchema(schema), {});
});

test('Placeholder : texte échappé dans une entrée, rien d\'enregistré', async () => {
    const schema = form(host(), [Placeholder.make('created').label('Créé').content('<b>hier</b>'), Placeholder.make('link').content(raw('<a href="/x">x</a>'))]);
    const html = norm(await schema.toHtml());
    assert.match(html, /<div class="fi-in-entry-label" role="term">Créé<\/div>/);
    assert.ok(html.includes('&lt;b&gt;hier&lt;/b&gt;'));
    assert.ok(html.includes('<a href="/x">x</a>'));
    assert.deepEqual(await getSchemaState(schema), {});
});

test('hint : texte, HTML brut, icône et action après le libellé (balisage de la page de connexion)', async () => {
    const html = norm(await form(host(), [
        TextInput.make('password').required().hint(raw('<a href="/reset" class="fi-link" tabindex="-1"><span class="fi-link-label">Forgot password?</span></a>')),
        TextInput.make('name').hint('<i>échappé</i>').hintColor('danger').hintIcon('o-information-circle', 'Aide'),
        TextInput.make('email').hintAction(Action.make('check').label('Vérifier').action(() => {})),
    ]).toHtml());
    assert.ok(html.includes(`<label for="form.password" class="fi-fo-field-label">`));
    assert.ok(html.includes(`</label><div class="fi-sc fi-inline fi-align-end fi-sc-has-gap fi-sc-dense"><div x-data="filamentSchemaComponent(JSON.parse('{\\u0022key\\u0022:null,\\u0022exposedMethods\\u0022:[],\\u0022path\\u0022:\\u0022data.password\\u0022,\\u0022containerPath\\u0022:\\u0022data\\u0022}'))"><div class="fi-sc-component"><span class="fi-sc-text"><a href="/reset" class="fi-link" tabindex="-1"><span class="fi-link-label">Forgot password?</span></a></span></div></div></div></div></div>`));
    assert.ok(html.includes('&lt;i&gt;échappé&lt;/i&gt;'));
    assert.match(html, /class="fi-color fi-color-danger fi-text-color-\d+ dark:fi-text-color-\d+ fi-sc-text"/);
    assert.match(html, /x-tooltip="\{ content: &#039;Aide&#039;|x-tooltip="\{ content: 'Aide'/);
    assert.match(html, /aria-hidden="true"[^>]*class="fi-color fi-color-danger fi-sc-icon fi-icon fi-size-md"/);
    assert.match(html, /<span aria-label="Aide" role="img" class="fi-sr-only"><\/span>/);
    assert.match(html, /<div class="fi-sc-action"><button type="button" [^>]*class="fi-ac-link-action fi-link fi-size-sm[^"]*" wire:click="mountAction\('check', \{\}, JSON\.parse\('\{\\u0022schemaComponent\\u0022:\\u0022form\.email\\u0022\}'\)\)">/);
    assert.ok(!html.includes('wire:key=""'));
});

test('hint : les actions d\'indication sont montables sur le champ', () => {
    const field = TextInput.make('email').hintAction(Action.make('check').action(() => {}));
    assert.deepEqual(field.getActions().map((action) => action.getName()), ['check']);
});

test('FusedGroup : champs accolés, libellés pour lecteurs d\'écran, première erreur sous le groupe', async () => {
    const livewire = host();
    livewire._errors = { 'data.country': ['The country field is required.'] };
    const html = norm(await form(livewire, [FusedGroup.make([TextInput.make('city').placeholder('City'), Select.make('country').placeholder('Country')]).label('Location').columns(2)]).toHtml());
    // Même structure que l'oracle (forms/fields/field, #fusedColumns).
    assert.ok(html.includes('<div data-field-wrapper class="fi-fo-field"><div class="fi-fo-field-label-col"><div class="fi-fo-field-label-ctn"><label class="fi-fo-field-label"><span class="fi-fo-field-label-content">Location</span></label></div></div><div class="fi-fo-field-content-col"><div role="group" class="fi-sc-fused-group"><div class="fi-grid lg:fi-grid-cols fi-sc" style="--cols-lg: repeat(2, minmax(0, 1fr)); --cols-default: repeat(1, minmax(0, 1fr));">'));
    assert.ok(html.includes('<div data-field-wrapper class="fi-fo-field"><label for="form.city" class="fi-fo-field-label fi-sr-only">City</label><div x-on:focus-input.stop="$el.querySelector(\'input\')?.focus()" class="fi-fo-text-input fi-input-wrp"><div class="fi-input-wrp-content-ctn"><input id="form.city" placeholder="City" type="text" wire:model="data.city" class="fi-input" /></div></div></div>'));
    assert.ok(html.includes('<option value="">Country</option>'));
    assert.match(html, /<p data-validation-error class="fi-fo-field-wrp-error-message">The country field is required\.<\/p><\/div><\/div>/);
    assert.equal(html.match(/data-validation-error/g)?.length, 1);
});

/** Hôte qui retient l'état et sait valider un formulaire de modale, comme une page de panel. */
const pageLike = (data: Record<string, unknown>) => ({ ...host(data), getActionMountContext: () => ({}) });

test('Select : bouton « + », modale de création, l\'option créée devient l\'état', async () => {
    const authors: Record<string, string> = { 1: 'Dan' };
    const livewire = pageLike({ author: null });
    const select = Select.make('author').label('Author').options(() => authors)
        .createOptionForm([TextInput.make('name').required()])
        .createOptionUsing((data) => { const id = String(Object.keys(authors).length + 1); authors[id] = String(data.name); return id; });
    const schema = form(livewire, [select]);
    const html = norm(await schema.toHtml());
    assert.ok(html.includes(`</select></div><div class="fi-input-wrp-suffix"><div class="fi-input-wrp-actions"><button title="Create" aria-label="Create" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-ac-icon-btn-action fi-icon-btn fi-size-sm" wire:click="mountAction('createOption', {}, JSON.parse('{\\u0022schemaComponent\\u0022:\\u0022form.author\\u0022}'))"><svg wire:loading.remove.delay.default="1"`));
    assert.ok(!html.includes('editOption'));
    const [create] = select.getActions();
    assert.equal(create.getName(), 'createOption');
    // Le formulaire de la modale est un vrai schéma : sa validation se fait côté serveur.
    const modal = create.applySchema(Schema.make(livewire as any).key('mountedActionSchema0').statePath('mountedActions.0.data'));
    (livewire as any).mountedActions = [{ data: { name: '' } }];
    assert.deepEqual(await validateSchema(modal), { 'mountedActions.0.data.name': ['The name field is required.'] });
    await create.call({ livewire, record: null, arguments: {}, data: { name: 'Zoé' } });
    assert.equal(livewire.data.author, '2');
    assert.deepEqual(await validateSchema(schema), {});
    assert.match(await schema.toHtml(), /<option value="2">Zoé<\/option>/);
});

test('Select : création en sélection multiple (ajout à la liste) et modification de l\'option choisie', async () => {
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
    // Champ vide : pas de bouton de modification ; champ désactivé : aucune action visible.
    livewire.data.author = null;
    assert.ok(!(await schema.toHtml()).includes('editOption'));
    const disabled = Select.make('x').disabled().options({}).createOptionForm([TextInput.make('name')]);
    assert.ok(!(await form(livewire, [disabled]).toHtml()).includes('createOption'));
});
