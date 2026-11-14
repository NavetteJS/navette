import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager } from '@navette-js/support';
import { TextInput, useColorManager as useFormsColorManager } from '@navette-js/forms';
import { Schema, Section, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { Page } from '../src/index.ts';

useFormsColorManager(new ColorManager());
useSchemasColorManager(new ColorManager());
useActionsColorManager(new ColorManager());

class Settings extends Page {
    data: Record<string, unknown> = { name: 'Ada', email: '' };
    formSchema(schema: Schema): Schema {
        return schema.components([
            TextInput.make('name'),
            Section.make('Advanced').lazyLoaded().schema([TextInput.make('email').required()]),
        ]);
    }
}
const page = () => {
    const instance = new Settings() as any;
    instance._id = 'page';
    instance._errors = {};
    return instance;
};

test('a lazy section renders a loading indicator, then only its schema on demand', async () => {
    const instance = page();
    const html = await instance.getSchema('form').toHtml();
    assert.match(html, /wire:partial="schema\.form\.advanced::data::section"/);
    assert.match(html, /isLoadingDeferred: true/);
    assert.match(html, /nv-sc-loading/);
    assert.doesNotMatch(html, /form\.email|data\.email/);
    await instance.loadDeferredSchema('form.advanced::data::section');
    assert.equal(instance.loadedDeferredSchemas['form.advanced::data::section'], true);
    const partial = instance._effects.partials['schema.form.advanced::data::section'];
    assert.match(partial, /^<div [^>]*wire:partial="schema\.form\.advanced::data::section"/);
    assert.match(partial, /data\.email/);
    // Once loaded, the full render includes it.
    assert.match(await instance.getSchema('form').toHtml(), /data\.email/);
});

test('unknown keys are ignored; a validation error inside loads the schema', async () => {
    const instance = page();
    await instance.loadDeferredSchema('form.nothing-here');
    assert.deepEqual(instance.loadedDeferredSchemas, {});
    instance._errors = { 'data.email': ['The email field is required.'] };
    assert.match(await instance.getSchema('form').toHtml(), /data\.email/);
    assert.equal(instance.loadedDeferredSchemas['form.advanced::data::section'], true);
});
