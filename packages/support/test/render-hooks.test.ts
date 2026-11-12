import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RenderHookRegistry, hasRenderHook, renderHook, renderHooks, runWithRenderHooks } from '../src/index.ts';

class ListPage {}
class EditPage {}
class Resource {}

test('render hooks: unscoped everywhere, scoped only for calls carrying the scope', () => {
    const registry = new RenderHookRegistry();
    registry.register('panels::page.start', () => '[all]');
    registry.register('panels::page.start', () => '[list]', ListPage);
    registry.register('panels::page.start', () => '[resource]', [Resource]);
    assert.equal(registry.render('panels::page.start'), '[all]');
    assert.equal(registry.render('panels::page.start', [ListPage]), '[all][list]');
    assert.equal(registry.render('panels::page.start', [EditPage, Resource]), '[all][resource]');
    assert.equal(registry.render('panels::page.end', [ListPage]), '');
});

test('render hooks: unscoped first, then scope by scope, each hook rendered once', () => {
    const registry = new RenderHookRegistry();
    const both = () => '[both]';
    registry.register('x', () => '[resource]', Resource);
    registry.register('x', both, [ListPage, Resource]);
    registry.register('x', () => '[all]');
    assert.equal(registry.render('x', [ListPage, Resource]), '[all][both][resource]');
    assert.equal(registry.render('x', [Resource, ListPage]), '[all][resource][both]');
});

test('render hooks: the hook receives scopes and slot data; null and undefined render nothing', () => {
    const registry = new RenderHookRegistry();
    registry.register('actions::modal.schema.before', ({ scopes, data }) => `${scopes.length}:${data.action.name}`);
    registry.register('actions::modal.schema.before', () => null);
    registry.register('actions::modal.schema.before', () => undefined);
    assert.equal(registry.render('actions::modal.schema.before', [ListPage], { action: { name: 'delete' } }), '1:delete');
});

test('render hooks: has() follows the same scope rules as render()', () => {
    const registry = new RenderHookRegistry();
    registry.register('tables::header.cell', () => '<th></th>', ListPage);
    assert.equal(registry.has('tables::header.cell'), false);
    assert.equal(registry.has('tables::header.cell', [EditPage]), false);
    assert.equal(registry.has('tables::header.cell', ListPage), true);
});

test('render hooks: panel hooks only apply during that panel\'s renders, shared hooks everywhere', async () => {
    renderHooks.clear();
    const admin = new RenderHookRegistry().register('panels::footer', () => '[admin]');
    const app = new RenderHookRegistry().register('panels::footer', () => '[app]');
    assert.equal(renderHook('panels::footer'), '');
    assert.equal(hasRenderHook('panels::footer'), false);
    renderHooks.register('panels::footer', () => '[commun]');
    // Two interleaved renders: each one only sees its own panel's hooks.
    const [a, b] = await Promise.all([
        runWithRenderHooks(admin, async () => { await new Promise((r) => setTimeout(r, 5)); return renderHook('panels::footer'); }),
        runWithRenderHooks(app, async () => renderHook('panels::footer')),
    ]);
    assert.equal(a, '[commun][admin]');
    assert.equal(b, '[commun][app]');
    assert.equal(renderHook('panels::footer'), '[commun]');
    renderHooks.clear();
});
