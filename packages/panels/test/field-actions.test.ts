import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { Action, useColorManager as useActionsColors } from '@navette-js/actions';
import { CheckboxList, Repeater, TextInput, useColorManager as useFormsColors } from '@navette-js/forms';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColors } from '@navette-js/support/ui';
import { Panel, Resource, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

const colors = new ColorManager();
useActionsColors(colors); useFormsColors(colors); useUiColors(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Skill extends Model { static tableName = 'skills'; }
class Person extends Model {
    static tableName = 'people';
    static get relationMappings() { return { skills: { relation: Model.ManyToManyRelation, modelClass: Skill, join: { from: 'people.id', through: { from: 'person_skill.person_id', to: 'person_skill.skill_id' }, to: 'skills.id' } } }; }
}
let db: Knex;
const admin: User = { id: 1, name: 'A', email: 'a@x.test' };
const pinged: unknown[] = [];

class People extends Resource {
    static slug = 'people';
    static adapter = new ObjectionAdapter(Person);
    static form(schema: any) {
        let phones: Repeater;
        phones = Repeater.make('phones').schema([TextInput.make('number')])
            .deleteAction((action) => action.requiresConfirmation())
            .addBetweenAction((action) => action.visible())
            .extraItemActions([Action.make('ping').requiresConfirmation().action(async ({ arguments: args, component }: any) => { pinged.push((await component.getItemState(args.item)).number, component === undefined ? 'no component' : phones.getName()); })]);
        return schema.components([TextInput.make('name'), phones, CheckboxList.make('skills').relationship('skills', 'name')]);
    }
}
const panel = Panel.make().id('field-actions-test').key('k').resources([People]);
const createPage = async () => {
    const CreatePage = (People.getPages() as any).create;
    const component = new CreatePage();
    component._ctx = { panel, user: admin, mailbox: 'field-actions', req: { query: {} }, res: {} };
    component._id = 'create';
    await component.mount({});
    return component;
};
const run = (fn: () => Promise<unknown>) => runInRequest('field-actions', fn);
const context = { schemaComponent: 'form.phones' };

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('people', (t) => { t.increments('id'); t.string('name'); t.text('phones'); });
    await db.schema.createTable('skills', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('person_skill', (t) => { t.integer('person_id'); t.integer('skill_id'); });
    await db('skills').insert([{ name: 'Design' }, { name: 'Node' }]);
});
after(() => db.destroy());

test('a confirmed delete opens a modal and removes the item once confirmed; unknown item keys are refused', async () => {
    const page = await createPage();
    page.data.phones = { a: { number: '1' }, b: { number: '2' } };
    await page.mountAction('delete', { item: 'a' }, context);
    assert.equal(page.mountedActions.length, 1, 'the confirmation modal is open');
    assert.deepEqual(Object.keys(page.data.phones), ['a', 'b']);
    await run(() => page.callMountedAction());
    assert.equal(page.mountedActions.length, 0);
    assert.deepEqual(Object.keys(page.data.phones), ['b']);
    await assert.rejects(() => page.mountAction('delete', { item: 'zzz' }, context), (error: any) => error.status === 404);
    await assert.rejects(() => page.mountAction('addBetween', { afterItem: 'zzz' }, context), (error: any) => error.status === 404);
    // A key changed in the mounted action's state after mounting is checked again when confirming.
    await page.mountAction('delete', { item: 'b' }, context);
    page.mountedActions[0].arguments = { item: '__proto__' };
    await assert.rejects(() => run(() => page.callMountedAction()), (error: any) => error.status === 404);
});

test('insert between two items, and an extra item action that validates its item', async () => {
    const page = await createPage();
    page.data.phones = { a: { number: '1' }, b: { number: '2' } };
    await page.mountAction('addBetween', { afterItem: 'a' }, context);
    const keys = Object.keys(page.data.phones);
    assert.equal(keys.length, 3);
    assert.deepEqual([keys[0], keys[2]], ['a', 'b']);
    await page.mountAction('ping', { item: 'b' }, context);
    await run(() => page.callMountedAction());
    assert.deepEqual(pinged, ['2', 'phones']);
});

test('the checkbox list saves the many-to-many relationship with the created record', async () => {
    const page = await createPage();
    assert.match(await page.getSchema('form').toHtml(), /Design/);
    page.data.name = 'Ada';
    page.data.skills = ['2'];
    await run(() => page.create());
    const person = await db('people').first();
    assert.equal(person.name, 'Ada');
    assert.deepEqual((await db('person_skill').where('person_id', person.id)).map((row: any) => row.skill_id), [2]);
});
