import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, defineEnum } from '@navette-js/support';
import { Schema } from '@navette-js/schemas';
import { IconEntry, TextEntry, useColorManager } from '../src/index.ts';

useColorManager(new ColorManager());

const host = () => ({ id: 'lw', _errors: {} as Record<string, string[]>, getSchema() { return null as any; } });
const render = async (record: unknown, components: any[]) => (await Schema.make(host()).key('infolist').record(record as any).components(components).toHtml()).replace(/&#039;/g, "'");

const Status = defineEnum({
    draft: { label: 'Draft', color: 'gray', icon: 'm-pencil' },
    reviewing: { label: 'Reviewing', color: 'warning', icon: 'm-eye' },
    published: { label: 'Published', color: 'success' },
});
class Post {
    static casts = { status: Status };
    status: string;
    constructor(status: string) { this.status = status; }
}

test('TextEntry: label, badge color and icon of the enum the model casts to', async () => {
    const html = await render(new Post('reviewing'), [TextEntry.make('status').badge()]);
    assert.match(html, /<span class="fi-badge fi-size-sm fi-color fi-color-warning[^"]*"><svg[^>]*fi-icon[^>]*>[\s\S]*<\/svg>Reviewing<\/span>/);
    assert.doesNotMatch(html, />reviewing</);
    const published = await render(new Post('published'), [TextEntry.make('status')]);
    assert.match(published, /fi-color-success[^>]*>Published</);
    // Explicit options win.
    const custom = await render(new Post('published'), [TextEntry.make('status').formatStateUsing(({ state }) => `[${state}]`).color('danger')]);
    assert.match(custom, /fi-color-danger[^>]*>\[published\]</);
    // enum() on a plain record, and a state that is already a case.
    assert.match(await render({ status: 'draft' }, [TextEntry.make('status').enum(Status)]), />Draft</);
    assert.match(await render({}, [TextEntry.make('status').state(() => Status.from('published'))]), />Published</);
    assert.match(await render({ status: 'draft' }, [TextEntry.make('status')]), />draft</);
});

test('IconEntry: icon, color and text alternative from the enum', async () => {
    const html = await render(new Post('reviewing'), [IconEntry.make('status')]);
    assert.match(html, /<svg[^>]*fi-color-warning[^>]*>[\s\S]*<\/svg><span class="fi-sr-only">Reviewing<\/span>/);
    const none = await render(new Post('published'), [IconEntry.make('status')]);
    assert.doesNotMatch(none, /<svg/);
});
