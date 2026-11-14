import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager } from '@navette-js/support';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { TextInput, useColorManager as useFormsColorManager } from '@navette-js/forms';
import { Schema, Section, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useUiColorManager } from '@navette-js/support/ui';
import { EditRecord, Panel, RelationGroup, RelationManager, Resource, type DataAdapter } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

const colors = new ColorManager();
useActionsColorManager(colors); useFormsColorManager(colors); useSchemasColorManager(colors); useUiColorManager(colors);

const records: Record<string, any> = { 1: { id: 1, name: 'Acme', phone: '123', vip: false } };
const updates: Record<string, unknown>[] = [];
const adapter = {
    getKey: (record: any) => String(record.id),
    find: async (key: string) => records[key] ?? null,
    update: async (key: string, data: Record<string, unknown>) => { updates.push(data); Object.assign(records[key], data); return records[key]; },
} as unknown as DataAdapter;
class Phones extends RelationManager { static relationship = 'phones'; static icon = 'm-phone'; static getBadge() { return 3; } }
class Emails extends RelationManager { static relationship = 'emails'; }
class Secrets extends RelationManager { static relationship = 'secrets'; static canViewForRecord(owner: any) { return owner.vip === true; } }
class EditContact extends EditRecord {}
class Companies extends Resource {
    static slug = 'companies';
    static adapter = adapter;
    static relations = [RelationGroup.make('Contact', [Phones, Emails]).icon('m-user'), Secrets];
    static relatedPages = { contact: EditContact };
    static form(schema: Schema): Schema {
        return schema.components([TextInput.make('name').required(), Section.make('Contact').key('contact').schema([TextInput.make('phone').required()])]);
    }
}
const panel = Panel.make().id('record-pages').resources([Companies]);
const page = async (PageClass: any) => {
    const instance = new PageClass();
    instance._id = 'edit';
    instance._ctx = { panel, user: { id: 1, name: 'U', email: 'u@x.test' }, req: { headers: {}, get: () => undefined }, res: {} };
    instance._errors = {};
    instance._runtime = { nameOf: (manager: any) => `manager-${manager.relationship}` };
    instance.mountChild = async (name: string) => `<div data-child="${name}"></div>`;
    await instance.mount({ record: '1' });
    return instance;
};

test('another edit page of the record is served under the record, and groups and hidden managers make the tabs', async () => {
    const pages = Companies.getPages() as any;
    assert.equal(pages.contact.slug, 'companies/{record}/contact');
    assert.equal(pages.contact.resource, Companies);
    assert.equal(Companies.getUrl('contact', '1'), '/companies/1/contact');
    const edit = await page(pages.edit);
    let html = await edit.getSchema('content').toHtml();
    const labels = [...html.matchAll(/<span class="nv-tabs-item-label">([^<]+)<\/span>/g)].map((match) => match[1]);
    assert.deepEqual(labels, ['Contact'], 'the secrets manager is hidden for a regular company');
    assert.match(html, /data-child="manager-phones"[\s\S]*data-child="manager-emails"/, 'both managers of the group, one below the other');
    records[1].vip = true;
    html = await (await page(pages.edit)).getSchema('content').toHtml();
    assert.deepEqual([...html.matchAll(/<span class="nv-tabs-item-label">([^<]+)<\/span>/g)].map((match) => match[1]), ['Contact', 'Secrets']);
    records[1].vip = false;
});

test('saving one section of the form validates and saves only its fields', async () => {
    const edit = await page((Companies.getPages() as any).edit);
    edit.data = { ...edit.data, name: '', phone: '456' };
    updates.length = 0;
    const { pending } = await runInRequest('test', () => edit.saveFormComponentOnly('contact', 'Contact saved'));
    assert.deepEqual(updates, [{ phone: '456' }], 'the empty name is not validated nor saved');
    assert.equal(pending[0].title, 'Contact saved');
    edit.data = { ...edit.data, phone: '' };
    await runInRequest('test', () => edit.saveFormComponentOnly('contact'));
    assert.ok(Object.keys(edit._errors).some((key) => key.endsWith('phone')));
});
