import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, defineEnum, nativeEnum, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { CheckboxList, Radio, Select, TextInput, ToggleButtons, useColorManager, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {} });
const form = (data: Record<string, unknown>, components: any[]) => Schema.make(host(data) as any).key('form').statePath('data').components(components);
const norm = (html: string) => html.replace(/>\s+/g, '>').replace(/\s+</g, '<').replace(/&#039;/g, "'");

const Status = defineEnum({
    draft: { label: 'Draft', color: 'gray', icon: 'm-pencil', description: 'This has not finished being written yet.' },
    reviewing: { label: 'Reviewing', color: 'warning', icon: 'm-eye', description: 'This is ready for a staff member to read.' },
    published: { label: 'Published', color: 'success', icon: 'm-check' },
});

test('Select: enum options and the `in` rule', async () => {
    const select = Select.make('status').options(Status);
    assert.deepEqual(await select.resolveOptions(), [['draft', 'Draft'], ['reviewing', 'Reviewing'], ['published', 'Published']]);
    assert.match(norm(await form({ status: 'reviewing' }, [select]).toHtml()), /<option value="draft">Draft<\/option><option value="reviewing">Reviewing<\/option><option value="published">Published<\/option>/);
    assert.deepEqual(await validateSchema(form({ status: 'published' }, [Select.make('status').options(Status)])), {});
    assert.deepEqual(await validateSchema(form({ status: 'deleted' }, [Select.make('status').options(Status)])), { 'data.status': ['The selected status is invalid.'] });
    assert.deepEqual(await validateSchema(form({ status: ['draft', 'nope'] }, [Select.make('status').options(Status).multiple()])), { 'data.status': ['The selected status is invalid.'] });
    // Options computed by a function may return an enum too.
    const computed = Select.make('status').options(() => Status);
    form({}, [computed]);
    assert.deepEqual(await computed.resolveOptions(), Status.options());
});

test('Radio and CheckboxList: enum options with their descriptions', async () => {
    const radio = norm(await form({ status: 'draft' }, [Radio.make('status').options(Status)]).toHtml());
    assert.match(radio, /<p>Draft<\/p><p class="fi-fo-radio-label-description">This has not finished being written yet\.<\/p>/);
    assert.match(radio, /<p>Published<\/p><\/div>/);
    const overridden = norm(await form({}, [Radio.make('status').descriptions({ draft: 'Custom' }).options(Status)]).toHtml());
    assert.match(overridden, /fi-fo-radio-label-description">Custom</);
    assert.doesNotMatch(overridden, /staff member/);
    const list = norm(await form({ status: [] }, [CheckboxList.make('status').options(Status)]).toHtml());
    assert.match(list, /This is ready for a staff member to read\./);
    assert.deepEqual(await validateSchema(form({ status: 'nope' }, [Radio.make('status').options(Status)])), { 'data.status': ['The selected status is invalid.'] });
    assert.deepEqual(await validateSchema(form({ status: ['draft', 'nope'] }, [CheckboxList.make('status').options(Status)])), { 'data.status': ['The selected status is invalid.'] });
    assert.deepEqual(await validateSchema(form({ status: ['draft', 'published'] }, [CheckboxList.make('status').options(Status)])), {});
});

test('ToggleButtons: enum colors and icons', async () => {
    const html = norm(await form({ status: 'draft' }, [ToggleButtons.make('status').options(Status)]).toHtml());
    assert.match(html, new RegExp(`class="fi-btn fi-size-md ${colors.getComponentClasses('button', 'warning').join(' ')}"><svg[^>]*fi-icon`));
    assert.match(html, /<label for="form\.status-published"[^>]*class="fi-btn fi-size-md fi-color fi-color-success[^"]*"><svg/);
    const custom = norm(await form({}, [ToggleButtons.make('status').colors({ draft: 'danger' }).options(Status)]).toHtml());
    assert.match(custom, /status-draft"[^>]*class="fi-btn fi-size-md fi-color fi-color-danger/);
    assert.deepEqual(await validateSchema(form({ status: 'nope' }, [ToggleButtons.make('status').options(Status)])), { 'data.status': ['The selected status is invalid.'] });
});

test('`in()` and `enum()` rules accept an enum, numeric values included', async () => {
    const Priority = { Low: 1, High: 2, 1: 'Low', 2: 'High' } as const; // `enum Priority { Low = 1, High = 2 }` compiled by tsc
    const PriorityEnum = nativeEnum(Priority);
    assert.deepEqual(await validateSchema(form({ status: 'draft', priority: '2' }, [TextInput.make('status').enum(Status), TextInput.make('priority').in(PriorityEnum)])), {});
    assert.deepEqual(await validateSchema(form({ status: 'Draft', priority: 3 }, [TextInput.make('status').enum(Status), TextInput.make('priority').in(PriorityEnum)])), {
        'data.status': ['The selected status is invalid.'],
        'data.priority': ['The selected priority is invalid.'],
    });
    assert.deepEqual(await Select.make('priority').options(PriorityEnum).resolveOptions(), [['1', 'Low'], ['2', 'High']]);
});
