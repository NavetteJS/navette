import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, defineEnum, views } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { Group, IconColumn, SelectColumn, SelectFilter, TextColumn, useColorManager } from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
const colors = new ColorManager();
useColorManager(colors);

const Status = defineEnum({
    draft: { label: 'Draft', color: 'gray', icon: 'm-pencil' },
    reviewing: { label: 'Reviewing', color: 'warning', icon: 'm-eye' },
    published: { label: 'Published', color: 'success' },
});
class Post {
    static casts = { status: Status };
    status: string | null;
    title = 'Hello';
    constructor(status: string | null) { this.status = status; }
}
const badge = (color: string) => colors.getComponentClasses('badge', color).join(' ');

test('TextColumn: label, badge color and icon of the enum the model casts to', async () => {
    assert.equal(await TextColumn.make('status').badge().toHtml(new Post('published')), `<div class="fi-ta-text fi-ta-text-item fi-ta-text-has-badges"><span class="fi-badge fi-size-sm ${badge('success')}">Published</span></div>`);
    // A case with an icon: the full markup, icon before the label.
    const reviewing = await TextColumn.make('status').badge().toHtml(new Post('reviewing'));
    assert.match(reviewing, new RegExp(`<span class="fi-badge fi-size-sm ${badge('warning')}"><svg[^>]*class="fi-icon fi-size-sm"[^>]*>[\\s\\S]*</svg>Reviewing</span>`));
    // Gray badges have no color classes.
    assert.match(await TextColumn.make('status').badge().toHtml(new Post('draft')), /<span class="fi-badge fi-size-sm"><svg[^>]*>[\s\S]*<\/svg>Draft<\/span>/);
    // Without badge: colored text.
    assert.match(await TextColumn.make('status').toHtml(new Post('published')), new RegExp(`fi-size-sm ${colors.getComponentClasses('text', 'success').join(' ')}">Published`));
    // A value missing from the enum is displayed as is.
    assert.equal(await TextColumn.make('status').toHtml(new Post('deleted')), '<div class="fi-ta-text fi-ta-text-item fi-size-sm">deleted</div>');
    assert.equal(await TextColumn.make('status').toHtml(new Post(null)), '<div class="fi-ta-text"></div>');
});

test('TextColumn: explicit options win over the enum; enum() and case states', async () => {
    const html = await TextColumn.make('status').badge().color('danger').icon(null).formatStateUsing(({ state }) => `#${state}`).toHtml(new Post('reviewing'));
    assert.match(html, new RegExp(`<span class="fi-badge fi-size-sm ${badge('danger')}"><svg[^>]*>[\\s\\S]*</svg>#reviewing</span>`));
    const plain = { status: 'published' };
    assert.equal(await TextColumn.make('status').toHtml(plain), '<div class="fi-ta-text fi-ta-text-item fi-size-sm">published</div>');
    assert.match(await TextColumn.make('status').enum(Status).toHtml(plain), />Published</);
    assert.match(await TextColumn.make('state').getStateUsing(() => Status.from('published')).toHtml(plain), />Published</);
    // Lists: every item through the enum.
    const list = await TextColumn.make('tags').enum(Status).badge().toHtml({ tags: ['published', 'draft'] });
    assert.match(list, /Published<\/span><\/li><li class="fi-ta-text-item"><span class="fi-badge fi-size-sm"><svg[^>]*>[\s\S]*<\/svg>Draft<\/span>/);
});

test('IconColumn: icon, color and text alternative from the enum', async () => {
    const html = await IconColumn.make('status').toHtml(new Post('reviewing'));
    assert.match(html, new RegExp(`<svg[^>]*class="${colors.getComponentClasses('icon-column', 'warning').join(' ')} fi-icon fi-size-lg"`));
    assert.match(html, /<span class="fi-sr-only">Reviewing<\/span>/);
    // No icon for this case: nothing is rendered.
    assert.equal(await IconColumn.make('status').toHtml(new Post('published')), '<div class="fi-ta-icon"></div>');
    assert.match(await IconColumn.make('status').icon('o-star').toHtml(new Post('draft')), /<span class="fi-sr-only">Draft<\/span>/);
});

test('SelectColumn, SelectFilter and Group accept enums', async () => {
    assert.deepEqual(SelectColumn.make('status').options(Status).getOptions(), [['draft', 'Draft'], ['reviewing', 'Reviewing'], ['published', 'Published']]);
    assert.deepEqual(SelectFilter.make('status').options(Status).getFormDefinition().options, [['draft', 'Draft'], ['reviewing', 'Reviewing'], ['published', 'Published']]);
    assert.equal(Group.make('status').getTitle(new Post('reviewing')), 'Reviewing');
    assert.equal(Group.make('status').getTitle(new Post('unknown')), 'unknown');
    assert.equal(Group.make('status').getTitle({ status: 'reviewing' } as any), 'reviewing');
    assert.equal(Group.make('status').getTitleFromRecordUsing(() => 'Custom').getTitle(new Post('draft')), 'Custom');
});
