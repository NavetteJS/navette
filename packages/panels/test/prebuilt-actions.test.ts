// Options and hooks of the prebuilt actions (Filament's create, edit, view, replicate, delete, restore, force-delete, attach,
// associate and detach actions): `using()`, "create another", form lifecycle hooks, `mutateRecordDataUsing()`,
// `skippableSteps()`, `fetchSelectedRecords()`, bulk notifications and redirects, `failureNotification()`, and the record
// select of the relationship actions (options query, search columns, preload, multiple, duplicates, table select).
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { Field, Select, Step, TableSelect, TextInput } from '@navette-js/forms';
import { Schema } from '@navette-js/schemas';
import { TextColumn, TrashedFilter, type Table } from '@navette-js/tables';
import {
    AssociateAction, AttachAction, CreateAction, DeleteAction, DeleteBulkAction, DetachBulkAction, EditAction, ForceDeleteBulkAction, Notification, Panel, RelationManager,
    ReplicateAction, Resource, RestoreBulkAction, ViewAction, type User,
} from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';
import { actingAs, livewire, setCurrentPanel, TestAction } from '../src/testing.ts';

class Post extends Model { static tableName = 'posts'; declare id: number; declare title: string; declare deleted_at: string | null; }
class Tag extends Model { static tableName = 'tags'; declare id: number; declare name: string; declare team: string; }
class Comment extends Model { static tableName = 'comments'; declare id: number; declare post_id: number | null; declare body: string; }
let db: Knex;

// Each test sets the actions of the table it exercises.
let headerActions: () => Action[] = () => [];
let recordActions: () => Action[] = () => [];
let bulkActions: () => Action[] = () => [];
let tagHeaderActions: () => Action[] = () => [];
let tagBulkActions: () => Action[] = () => [];
let tagDuplicates = false;
let commentHeaderActions: () => Action[] = () => [];
const calls: unknown[][] = [];

/** Posts, with a spy on the bulk methods of the adapter. */
class PostsAdapter extends ObjectionAdapter<Post> {
    async deleteMany(keys: (string | number)[]) { calls.push(['deleteMany', keys.map(String)]); return super.deleteMany(keys); }
    async delete(key: string | number) { calls.push(['delete', String(key)]); return super.delete(key); }
    async restoreMany(keys: (string | number)[]) { calls.push(['restoreMany', keys.map(String)]); return super.restoreMany(keys); }
    async forceDeleteMany(keys: (string | number)[]) { calls.push(['forceDeleteMany', keys.map(String)]); return super.forceDeleteMany(keys); }
}

const attachedTags = (owner: string) => db('post_tag').select('tag_id').where('post_id', owner);
class TagsRelationManager extends RelationManager {
    static relationship = 'tags';
    static modelLabel = 'tag';
    static recordTitleAttribute = 'name';
    static adapterFor(ownerKey: string) { return new ObjectionAdapter(Tag, { modify: (query) => { query.whereIn('tags.id', attachedTags(ownerKey)); } }); }
    // Every tag can be offered: the defaults of searchAttachable() / attachableLabel() use it.
    static relatedAdapter() { return new ObjectionAdapter(Tag); }
    static async attach(ownerKey: string, recordKey: string, pivot: Record<string, unknown> = {}) { calls.push(['attach', ownerKey, recordKey, pivot]); await db('post_tag').insert({ post_id: ownerKey, tag_id: recordKey }); }
    static async detach(ownerKey: string, recordKeys: string[]) { calls.push(['detach', ownerKey, recordKeys]); await db('post_tag').where('post_id', ownerKey).whereIn('tag_id', recordKeys).delete(); }
    static table(table: Table): Table { return table.columns([TextColumn.make('name')]).allowDuplicates(tagDuplicates).headerActions(tagHeaderActions()).groupedBulkActions(tagBulkActions()); }
}

class CommentsRelationManager extends RelationManager {
    static relationship = 'comments';
    static modelLabel = 'comment';
    static recordTitleAttribute = 'body';
    static adapterFor(ownerKey: string) { return new ObjectionAdapter(Comment, { modify: (query) => { query.where('comments.post_id', ownerKey); } }); }
    static relatedAdapter() { return new ObjectionAdapter(Comment); }
    static async associate(ownerKey: string, recordKey: string) { calls.push(['associate', ownerKey, recordKey]); await db('comments').where('id', recordKey).update({ post_id: ownerKey }); }
    static async dissociate(ownerKey: string, recordKeys: string[]) { await db('comments').where('post_id', ownerKey).whereIn('id', recordKeys).update({ post_id: null }); }
    static table(table: Table): Table { return table.columns([TextColumn.make('body')]).headerActions(commentHeaderActions()); }
}

class PostResource extends Resource {
    static slug = 'posts';
    static modelLabel = 'post';
    static isSimple = true;
    static adapter = new PostsAdapter(Post, { softDeletes: 'deleted_at' });
    static relations = [TagsRelationManager, CommentsRelationManager];
    static form(schema: Schema): Schema { return schema.components([TextInput.make('title').required()]); }
    static table(table: Table): Table {
        return table.columns([TextColumn.make('title')]).filters([TrashedFilter.make()]).headerActions(headerActions()).recordActions(recordActions()).groupedBulkActions(bulkActions());
    }
}

const user: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const panel = Panel.make().id('prebuilt-actions').key('prebuilt-key').auth({ find: async () => user } as any).resources([PostResource]);
const List = (PostResource.getPages() as any).index;
const titles = async () => (await db('posts').whereNull('deleted_at').orderBy('id')).map((row: any) => row.title);
const tagsOf = async (post: number) => (await db('post_tag').where('post_id', post).orderBy('tag_id')).map((row: any) => row.tag_id);

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.string('title'); table.timestamp('deleted_at').nullable(); });
    await db.schema.createTable('tags', (table) => { table.increments('id'); table.string('name'); table.string('team'); });
    await db.schema.createTable('post_tag', (table) => { table.integer('post_id'); table.integer('tag_id'); });
    await db.schema.createTable('comments', (table) => { table.increments('id'); table.integer('post_id').nullable(); table.string('body'); });
    setCurrentPanel(panel);
    actingAs(user);
});
after(() => db.destroy());
beforeEach(async () => {
    for (const name of ['posts', 'tags', 'post_tag', 'comments']) await db(name).delete();
    headerActions = () => []; recordActions = () => []; bulkActions = () => []; tagHeaderActions = () => []; tagBulkActions = () => []; commentHeaderActions = () => []; tagDuplicates = false;
    calls.length = 0;
});

test('create: `using()` replaces the creation, hooks run around filling and validating the form', async () => {
    const order: string[] = [];
    const action = () => CreateAction.make()
        .beforeFormFilled(() => { order.push('beforeFormFilled'); })
        .afterFormFilled(({ data }) => { order.push(`afterFormFilled:${JSON.stringify(data)}`); })
        .beforeFormValidated(({ data }) => { order.push(`beforeFormValidated:${data.title}`); })
        .afterFormValidated(({ data }) => { order.push(`afterFormValidated:${data.title}`); })
        .before(() => { order.push('before'); })
        .using(async ({ data, livewire }) => { order.push('using'); return (livewire as any).getDataAdapter().create({ title: `${data.title} (custom)` }); })
        .after(() => { order.push('after'); });
    headerActions = () => [action()];
    await livewire(List).callTableAction('create', null, { title: 'Hello' }).assertHasNoActionErrors().assertNotified('Created');
    assert.deepEqual(await titles(), ['Hello (custom)']);
    assert.deepEqual(order, ['beforeFormFilled', 'afterFormFilled:{"title":null}', 'beforeFormValidated:Hello', 'afterFormValidated:Hello', 'before', 'using', 'after']);
});

test('`beforeFormValidated()` can halt the action before validation; `beforeFormFilled()` can cancel the mount', async () => {
    headerActions = () => [
        CreateAction.make().beforeFormValidated(({ action }) => { Notification.make().title('Not now').send(); action!.halt(); }),
        Action.make('nope').schema([TextInput.make('x')]).beforeFormFilled(({ action }) => action!.cancel()).action(() => {}),
    ];
    // Halted before validation: no error for the empty required title, the modal stays open.
    await livewire(List).callTableAction('create').assertHasNoActionErrors().assertNotified('Not now').assertActionMounted('create');
    await livewire(List).mountTableAction('nope').assertActionNotMounted('nope');
    assert.deepEqual(await titles(), []);
});

test('create another: `createAnother(false)` removes the button, `createAnotherAction()` customizes it', async () => {
    assert.deepEqual(CreateAction.make().getExtraModalFooterActions().map((a) => a.getName()), ['createAnother']);
    assert.deepEqual(CreateAction.make().createAnother(false).getExtraModalFooterActions(), []);
    const custom = CreateAction.make().createAnotherAction((action) => action.label('Save & add another'));
    const ctx: any = { livewire: null, component: null, operation: null, record: null, get: () => undefined, state: undefined };
    assert.equal(await custom.getExtraModalFooterActions()[0].getLabel(ctx), 'Save & add another');
    assert.equal(custom.canCreateAnother(), true);
    // Other footer actions replace it, as in Filament.
    assert.deepEqual(CreateAction.make().extraModalFooterActions([Action.make('draft')]).createAnother(true).getExtraModalFooterActions().map((a) => a.getName()), ['draft']);
    headerActions = () => [CreateAction.make().createAnother(false)];
    await livewire(List).mountTableAction('create').assertMountedActionModalDontSee('Create &amp; create another').assertMountedActionModalDontSee('Create & create another');
});

test('`skippableSteps()`: the wizard of the modal lets the user move between steps without validating them', async () => {
    const steps = () => [Step.make('One').schema([TextInput.make('title').required()]), Step.make('Two').schema([TextInput.make('note')])];
    headerActions = () => [CreateAction.make().steps(steps()).skippableSteps(), Action.make('strict').steps(steps()).action(() => {})];
    await livewire(List).mountTableAction('create').assertMountedActionModalSee('isSkippable: true');
    await livewire(List).mountTableAction('strict').assertMountedActionModalSee('isSkippable: false');
});

test('edit and view: `mutateRecordDataUsing()` changes the data filling the form; `using()` replaces the save', async () => {
    const [id] = await db('posts').insert({ title: 'Draft' });
    recordActions = () => [
        EditAction.make().mutateRecordDataUsing((data) => ({ ...data, title: `${data.title}!` })).using(async ({ record, data }) => { calls.push(['save', (record as Post).id, data.title]); }),
        ViewAction.make().mutateRecordDataUsing((data) => ({ ...data, title: String(data.title).toUpperCase() })),
    ];
    await livewire(List).mountTableAction('edit', id).assertActionDataSet({ title: 'Draft!' }).callMountedAction().assertNotified('Saved');
    assert.deepEqual(calls, [['save', id, 'Draft!']]);
    assert.deepEqual(await titles(), ['Draft'], 'the default save did not run');
    // Without an infolist, the view modal shows the form, read-only.
    await livewire(List).mountTableAction('view', id).assertActionDataSet({ title: 'DRAFT' }).assertMountedActionModalSee('disabled');
});

test('replicate: `mutateRecordDataUsing()` changes the copy (without a form) and `using()` replaces it', async () => {
    const [id] = await db('posts').insert({ title: 'Original' });
    recordActions = () => [ReplicateAction.make().mutateRecordDataUsing((data) => ({ ...data, title: `${data.title} (copy)` }))];
    await livewire(List).callTableAction('replicate', id).assertNotified('Replicated');
    assert.deepEqual(await titles(), ['Original', 'Original (copy)']);
    recordActions = () => [ReplicateAction.make().using(async () => { calls.push(['custom replicate']); return null; })];
    await livewire(List).callTableAction('replicate', id);
    assert.deepEqual(calls, [['custom replicate']]);
});

test('delete: a failed process sends `failureNotification()` and follows `failureRedirectUrl()`', async () => {
    const [id] = await db('posts').insert({ title: 'Locked' });
    recordActions = () => [DeleteAction.make().using(() => false).failureNotificationTitle('Could not delete').failureNotification((notification) => notification.body('Locked post')).failureRedirectUrl('/admin/locked')];
    await livewire(List).callTableAction('delete', id).assertNotified('Could not delete').assertRedirect('/admin/locked');
    assert.deepEqual(await titles(), ['Locked']);
    // `failureNotification(null)`: no notification at all.
    recordActions = () => [DeleteAction.make().using(() => false).failureNotificationTitle('Could not delete').failureNotification(null)];
    await livewire(List).callTableAction('delete', id).assertNotNotified();
});

test('delete bulk: records are deleted one by one by default, in one query with `fetchSelectedRecords(false)`', async () => {
    const ids = await Promise.all(['A', 'B', 'C'].map(async (title) => (await db('posts').insert({ title }))[0]));
    bulkActions = () => [DeleteBulkAction.make()];
    await livewire(List).callTableBulkAction('delete', ids.slice(0, 2)).assertNotified('Deleted');
    assert.deepEqual(calls, [['delete', String(ids[0])], ['delete', String(ids[1])]]);
    calls.length = 0;
    bulkActions = () => [DeleteBulkAction.make().fetchSelectedRecords(false)];
    await livewire(List).callTableBulkAction('delete', [ids[2]]).assertNotified('Deleted');
    assert.deepEqual(calls, [['deleteMany', [String(ids[2])]]]);
    assert.deepEqual(await titles(), []);
});

test('bulk: a custom `successNotification()` and `successRedirectUrl()` are honored; `using()` receives the records', async () => {
    const ids = await Promise.all(['A', 'B'].map(async (title) => (await db('posts').insert({ title }))[0]));
    bulkActions = () => [DeleteBulkAction.make().successNotification((notification, ctx: any) => notification.title(`Removed ${ctx.successCount}`)).successRedirectUrl('/admin/posts?done=1')];
    await livewire(List).callTableBulkAction('delete', ids).assertNotified('Removed 2').assertRedirect('/admin/posts?done=1');
    const [id] = await db('posts').insert({ title: 'C' });
    calls.length = 0;
    bulkActions = () => [DeleteBulkAction.make().using(async ({ records }) => { calls.push(['using', (records as Post[]).map((record) => record.title)]); })];
    await livewire(List).callTableBulkAction('delete', [id]).assertNotified('Deleted');
    assert.deepEqual(calls, [['using', ['C']]]);
    assert.deepEqual(await titles(), ['C']);
});

test('bulk: `failureNotification()` receives the counts of the failed run', async () => {
    const ids = await Promise.all(['Keep', 'Gone'].map(async (title) => (await db('posts').insert({ title }))[0]));
    bulkActions = () => [DeleteBulkAction.make().authorizeIndividualRecords((record: any) => record.title !== 'Keep')
        .failureNotification((notification, ctx: any) => notification.title(`${ctx.successCount} of ${ctx.totalCount}, ${ctx.failureCount} left`)).failureRedirectUrl('/admin/failed')];
    await livewire(List).callTableBulkAction('delete', ids).assertNotified('1 of 2, 1 left').assertRedirect('/admin/failed');
    assert.deepEqual(await titles(), ['Keep']);
});

test('restore and force-delete bulk: `fetchSelectedRecords(false)` processes the keys in one query', async () => {
    const ids = await Promise.all(['A', 'B'].map(async (title) => (await db('posts').insert({ title, deleted_at: '2024-01-01 00:00:00' }))[0]));
    bulkActions = () => [RestoreBulkAction.make().fetchSelectedRecords(false), ForceDeleteBulkAction.make().fetchSelectedRecords(false)];
    await livewire(List).set('tableFilters.trashed.value', '0').callTableBulkAction('restore', [ids[0]]).assertNotified('Restored');
    assert.deepEqual(calls, [['restoreMany', [String(ids[0])]]]);
    assert.deepEqual(await titles(), ['A']);
    calls.length = 0;
    await livewire(List).set('tableFilters.trashed.value', '0').callTableBulkAction('forceDelete', [ids[1]]).assertNotified('Deleted');
    assert.deepEqual(calls, [['forceDeleteMany', [String(ids[1])]]]);
    assert.equal((await db('posts')).length, 1);
});

const seedTags = async () => {
    const [post] = await db('posts').insert({ title: 'Post' });
    const tags: Record<string, number> = {};
    for (const [name, team] of [['Alpha', 'a'], ['Beta', 'a'], ['Gamma', 'b'], ['Delta', 'a']]) tags[name] = (await db('tags').insert({ name, team }))[0];
    await db('post_tag').insert({ post_id: post, tag_id: tags.Delta });
    return { post, tags };
};
const host = (manager: typeof RelationManager, owner: number) => {
    const component = Object.create(manager.prototype);
    component.ownerRecord = String(owner);
    component._ctx = { panel, user };
    return component;
};

test('attach: options come from `relatedAdapter()`, within `recordSelectOptionsQuery()`, without the tags already attached', async () => {
    const { post, tags } = await seedTags();
    const action = AttachAction.make().recordSelectOptionsQuery((query) => query.where('team', 'a'));
    tagHeaderActions = () => [action];
    const options = action.getRecordSelectOptions(host(TagsRelationManager, post));
    // Delta is attached, Gamma is outside the options query.
    assert.deepEqual(await TagsRelationManager.searchAttachable(String(post), '', options), [[String(tags.Alpha), 'Alpha'], [String(tags.Beta), 'Beta']]);
    assert.deepEqual(await TagsRelationManager.searchAttachable(String(post), 'bet', options), [[String(tags.Beta), 'Beta']]);
    assert.equal(await TagsRelationManager.attachableLabel(String(post), String(tags.Gamma), options), null);
    assert.equal(await TagsRelationManager.attachableLabel(String(post), String(tags.Delta), options), null);
    assert.equal(await TagsRelationManager.attachableLabel(String(post), String(tags.Alpha), options), 'Alpha');
    await livewire(TagsRelationManager, { ownerRecord: post }).callAction(TestAction.make('attach').table(), { recordId: String(tags.Alpha) }).assertHasNoActionErrors().assertNotified('Attached');
    assert.deepEqual(await tagsOf(post), [tags.Alpha, tags.Delta]);
});

test('attach: a record outside the options query is refused, by validation and by the action itself', async () => {
    const { post, tags } = await seedTags();
    tagHeaderActions = () => [AttachAction.make().recordSelectOptionsQuery((query) => query.where('team', 'a'))];
    // A forged key in the modal state: the select's validation refuses it.
    await livewire(TagsRelationManager, { ownerRecord: post }).callAction(TestAction.make('attach').table(), { recordId: String(tags.Gamma) }).assertHasActionErrors(['recordId']);
    // Even when the handler is reached directly, only keys within the options query are attached.
    const component = host(TagsRelationManager, post);
    const action = AttachAction.make().recordSelectOptionsQuery((query) => query.where('team', 'a')).multiple();
    await assert.rejects(() => runInRequest('test', () => action.call({ livewire: component, record: null, arguments: {}, data: { recordId: [String(tags.Gamma), String(tags.Delta), '999'] } })));
    assert.deepEqual(calls, []);
    await runInRequest('test', () => action.call({ livewire: component, record: null, arguments: {}, data: { recordId: [String(tags.Gamma), String(tags.Beta)] } }));
    assert.deepEqual(calls, [['attach', String(post), String(tags.Beta), {}]]);
    assert.deepEqual(await tagsOf(post), [tags.Beta, tags.Delta]);
});

test('attach: `multiple()`, `recordSelectSearchColumns()`, `preloadRecordSelect()`, `recordSelect()` and `attachAnother(false)`', async () => {
    const { post, tags } = await seedTags();
    tagHeaderActions = () => [AttachAction.make().multiple().preloadRecordSelect().attachAnother(false).recordSelectSearchColumns(['team']).recordSelect((select) => select.placeholder('Pick tags'))];
    await livewire(TagsRelationManager, { ownerRecord: post })
        .mountAction(TestAction.make('attach').table())
        // Preloaded options are in the modal, the attached tag is not.
        .assertMountedActionModalSee(['Alpha', 'Beta', 'Gamma', 'Pick tags']).assertMountedActionModalDontSee(['Delta', 'Attach &amp; attach another'])
        .set('mountedActions.0.data.recordId', [String(tags.Alpha), String(tags.Gamma)]).callMountedAction().assertHasNoActionErrors();
    assert.deepEqual(await tagsOf(post), [tags.Alpha, tags.Gamma, tags.Delta].sort((a, b) => a - b));
    // Searched in the `team` column instead of the name: Beta is the only tag of team "a" left.
    const action = AttachAction.make().recordSelectSearchColumns(['team']);
    assert.deepEqual(await TagsRelationManager.searchAttachable(String(post), 'a', action.getRecordSelectOptions(host(TagsRelationManager, post))), [[String(tags.Beta), 'Beta']]);
    assert.equal(AttachAction.make().getRecordSelect() instanceof Select, true);
    assert.equal(AttachAction.make().canAttachAnother(), true);
    assert.deepEqual(AttachAction.make().attachAnother(false).getExtraModalFooterActions(), []);
});

test('attach: `allowDuplicates()` on the table offers and accepts records already attached', async () => {
    const { post, tags } = await seedTags();
    tagDuplicates = true;
    tagHeaderActions = () => [AttachAction.make()];
    const options = AttachAction.make().getRecordSelectOptions(host(TagsRelationManager, post));
    assert.equal(options.allowsDuplicates, true);
    assert.equal(await TagsRelationManager.attachableLabel(String(post), String(tags.Delta), options), 'Delta');
    await livewire(TagsRelationManager, { ownerRecord: post }).callAction(TestAction.make('attach').table(), { recordId: String(tags.Delta) }).assertHasNoActionErrors();
    assert.deepEqual(await tagsOf(post), [tags.Delta, tags.Delta]);
});

test('attach: `tableSelect()` picks the records in a table; a key outside the options query is still refused', async () => {
    const { post, tags } = await seedTags();
    const TagsTable = { name: 'tags-table', configure: (table: Table) => table.columns([TextColumn.make('name')]) };
    const action = AttachAction.make().tableSelect(TagsTable).recordSelectOptionsQuery((query) => query.where('team', 'a'));
    const field = action.getRecordSelect();
    assert.equal(field instanceof TableSelect, true);
    const component = host(TagsRelationManager, post);
    const schema = action.applySchema(Schema.make(component));
    const recordId = schema.getFlatComponents().find((c: unknown) => c instanceof Field && c.getName() === 'recordId') as TableSelect;
    const configuration: any = await recordId.getTableConfiguration();
    assert.equal(configuration.name, `tags-table.TagsRelationManager.attach.${post}`);
    // The table shows team "a" tags that are not attached yet.
    const table = configuration.configure(new (await import('@navette-js/tables')).Table());
    const shown = await new ObjectionAdapter(Tag).listKeys({ modifiers: table.getQueryModifiers().map((modifier: any) => (query: any) => { modifier(query); }) });
    assert.deepEqual(shown, [String(tags.Alpha), String(tags.Beta)]);
    await assert.rejects(() => runInRequest('test', () => action.call({ livewire: component, record: null, arguments: {}, data: { recordId: String(tags.Gamma) } })));
    assert.deepEqual(calls, []);
});

test('associate: options, `multiple()`, `recordSelectOptionsQuery()` and `associateAnother(false)`', async () => {
    const [post] = await db('posts').insert({ title: 'Post' });
    const [other] = await db('posts').insert({ title: 'Other' });
    const comments: Record<string, number> = {};
    for (const [body, owner] of [['Mine', post], ['Free', null], ['Theirs', other], ['Spam', null]] as [string, number | null][]) comments[body] = (await db('comments').insert({ body, post_id: owner }))[0];
    const action = AssociateAction.make().multiple().associateAnother(false).recordSelectOptionsQuery((query) => query.whereNot('body', 'Spam'));
    commentHeaderActions = () => [action];
    const options = action.getRecordSelectOptions(host(CommentsRelationManager, post));
    // Comments of another post can be moved here, unless excluded; this post's comments are not offered.
    assert.deepEqual((await CommentsRelationManager.searchAssociable(String(post), '', options)).map(([, label]) => label), ['Free', 'Theirs']);
    assert.deepEqual(action.getExtraModalFooterActions(), []);
    await livewire(CommentsRelationManager, { ownerRecord: post }).callAction(TestAction.make('associate').table(), { recordId: [String(comments.Free), String(comments.Spam)] }).assertHasActionErrors(['recordId']);
    await livewire(CommentsRelationManager, { ownerRecord: post }).callAction(TestAction.make('associate').table(), { recordId: [String(comments.Free), String(comments.Theirs)] }).assertHasNoActionErrors().assertNotified('Associated');
    assert.deepEqual(calls, [['associate', String(post), String(comments.Free)], ['associate', String(post), String(comments.Theirs)]]);
    assert.equal(AssociateAction.make().canAssociateAnother(), true);
});

test('detach bulk: one record at a time by default, all keys at once with `fetchSelectedRecords(false)`', async () => {
    const { post, tags } = await seedTags();
    await db('post_tag').insert([{ post_id: post, tag_id: tags.Alpha }, { post_id: post, tag_id: tags.Beta }]);
    tagBulkActions = () => [DetachBulkAction.make()];
    await livewire(TagsRelationManager, { ownerRecord: post }).callTableBulkAction('detach', [tags.Alpha, tags.Beta]).assertNotified('Detached');
    assert.deepEqual(calls, [['detach', String(post), [String(tags.Alpha)]], ['detach', String(post), [String(tags.Beta)]]]);
    calls.length = 0;
    tagBulkActions = () => [DetachBulkAction.make().fetchSelectedRecords(false)];
    await livewire(TagsRelationManager, { ownerRecord: post }).callTableBulkAction('detach', [tags.Delta]).assertNotified('Detached');
    assert.deepEqual(calls, [['detach', String(post), [String(tags.Delta)]]]);
    assert.deepEqual(await tagsOf(post), []);
});
