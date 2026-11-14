import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { Action, useColorManager as useActionsColors } from '@navette-js/actions';
import { FileUpload, MarkdownEditor, Repeater, RichEditor, TextInput, isFileUploadForSchemas, useColorManager as useFormsColors } from '@navette-js/forms';
import { Component, UploadStore, WireError, WireRuntime } from '@navette-js/wire';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColors } from '@navette-js/support/ui';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Panel, Resource, type User } from '../src/index.ts';
import { schemaBuilderNames } from '../src/upload-restriction.ts';

const colors = new ColorManager();
useActionsColors(colors); useFormsColors(colors); useUiColors(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Post extends Model { static tableName = 'posts'; }
const admin: User = { id: 1, name: 'A', email: 'a@x.test' };

class Posts extends Resource {
    static slug = 'posts';
    static adapter = new ObjectionAdapter(Post);
    static form(schema: any) {
        return schema.components([
            TextInput.make('title'),
            FileUpload.make('cover'),
            FileUpload.make('secret').hidden(),
            RichEditor.make('content'),
            MarkdownEditor.make('notes'),
            Repeater.make('gallery').schema([FileUpload.make('image'), TextInput.make('caption')]),
        ]);
    }
}
const panel = Panel.make().id('upload-restriction-test').key('k').resources([Posts]);
const createPage = async () => {
    const CreatePage = (Posts.getPages() as any).create;
    const component = new CreatePage();
    component._ctx = { panel, user: admin, req: { query: {} }, res: {} };
    component._id = 'create';
    await component.mount({});
    return component;
};

test('`isFileUploadForSchemaComponent()`: only the upload fields and editors of the page schemas', async () => {
    const page = await createPage();
    assert.equal(page.shouldRestrictFileUploadsToSchemaComponents(), true);
    assert.ok(schemaBuilderNames(page).includes('form'));
    assert.ok(!schemaBuilderNames(page).includes('loadDeferred'));
    for (const name of ['data.cover', 'data.cover.0f8c1d2e-uuid', 'componentFileAttachments.data.content', 'componentFileAttachments.data.content.abc', 'componentFileAttachments.data.notes']) {
        assert.equal(await page.isFileUploadForSchemaComponent(name), true, name);
    }
    // A text field, a hidden upload field, an unknown or empty path, an editor path without the attachments prefix
    // on a non-upload field, or a path two levels below an upload field.
    for (const name of ['data.title', 'data.title.x', 'data.secret', 'data.secret.x', 'data.unknown', '', 'mountedActions', 'componentFileAttachments.data.title', 'data.cover.a.b', 'data']) {
        assert.equal(await page.isFileUploadForSchemaComponent(name), false, name);
    }
    // Upload field inside a repeater item.
    page.data.gallery = { 'item-1': { image: [], caption: null } };
    assert.equal(await page.isFileUploadForSchemaComponent('data.gallery.item-1.image'), true);
    assert.equal(await page.isFileUploadForSchemaComponent('data.gallery.item-1.image.uuid'), true);
    assert.equal(await page.isFileUploadForSchemaComponent('data.gallery.item-1.caption'), false);
    assert.equal(await page.isFileUploadForSchemaComponent('data.gallery.item-2.image'), false);
});

test('`isFileUploadForSchemaComponent()`: forms of mounted actions; opt-out with a static flag', async () => {
    const page = await createPage();
    page.getHeaderActions = () => [Action.make('attach').schema([FileUpload.make('document')]).action(() => {})];
    assert.equal(await page.isFileUploadForSchemaComponent('mountedActions.0.data.document'), false);
    await page.mountAction('attach');
    assert.equal(await page.isFileUploadForSchemaComponent('mountedActions.0.data.document'), true);
    assert.equal(await page.isFileUploadForSchemaComponent('mountedActions.0.data.other'), false);
    class Unrestricted extends (page.constructor as any) { static restrictFileUploadsToSchemaComponents = false; }
    const open = Object.assign(new Unrestricted(), { _ctx: page._ctx });
    assert.equal(open.shouldRestrictFileUploadsToSchemaComponents(), false);
});

test('`isFileUploadForSchemas()` accepts custom fields declaring `acceptsFileUploads()`', async () => {
    const page = await createPage();
    const schema = page.getSchema('form').components([Object.assign(TextInput.make('signature'), { acceptsFileUploads: () => true }), TextInput.make('plain')]);
    assert.equal(await isFileUploadForSchemas([schema], 'data.signature'), true);
    assert.equal(await isFileUploadForSchemas([schema], 'data.plain'), false);
});

test('wire runtime: `_startUpload` / `_finishUpload` rejected for a target the component does not accept', async () => {
    const store = new UploadStore(mkdtempSync(path.join(tmpdir(), 'navette-restrict-')), 'test-key');
    class Restricted extends Component {
        data: Record<string, unknown> = { photo: null, name: null };
        shouldRestrictFileUploadsToSchemaComponents() { return true; }
        isFileUploadForSchemaComponent(name: string) { return name === 'data.photo' || name.startsWith('data.photo.'); }
        render() { return '<div></div>'; }
    }
    const runtime = new WireRuntime({ key: 'test-key', uploads: store }).register('restricted', Restricted);
    const snapshot = JSON.parse(/wire:snapshot="([^"]*)"/.exec(await runtime.mount('restricted'))![1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    await runtime.update(snapshot, {}, [{ method: '_startUpload', params: ['data.photo', [{ name: 'a.jpg', size: 1, type: 'image/jpeg' }], false] }]);
    for (const method of ['_startUpload', '_finishUpload', '_uploadErrored', '_removeUpload']) {
        await assert.rejects(runtime.update(snapshot, {}, [{ method, params: ['data.name', ['0'.repeat(32)], false] }]), (error: WireError) => error.status === 403, method);
    }
});
