import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dashboard, Page, Panel, Resource, type Policy, type User } from '../src/index.ts';

const admin: User = { id: 1, name: 'A', email: 'a@x.test', role: 'admin' };
const reader: User = { id: 2, name: 'R', email: 'r@x.test', role: 'reader' };

class Notes extends Resource {
    static slug = 'notes';
    static policy: Policy<{ owner: number }> = {
        update: (user, record) => user.role === 'admin' || record?.owner === user.id,
        delete: (user) => user.role === 'admin',
    };
}
class Secret extends Page {
    static slug = 'secret';
    static canAccess(user: User): boolean { return user.role === 'admin'; }
}

test('resource policy: missing ability allowed, rule applied, record passed', async () => {
    Panel.make().id('t1').key('k').pages([Dashboard, Secret]).resources([Notes]);
    assert.equal(await Notes.can('viewAny', reader), true);
    assert.equal(await Notes.can('delete', reader), false);
    assert.equal(await Notes.can('delete', admin), true);
    assert.equal(await Notes.can('update', reader, { owner: 2 }), true);
    assert.equal(await Notes.can('update', reader, { owner: 9 }), false);
    assert.equal(await Notes.can('delete', null), false, 'no user: always denied');
});

test('pages: canAccess, and resource list / create according to its policy', async () => {
    class Locked extends Resource { static slug = 'locked'; static policy: Policy = { viewAny: () => false, create: (user) => user.role === 'admin' }; }
    const panel = Panel.make().id('t2').key('k').pages([Dashboard, Secret]).resources([Locked]);
    assert.equal(await panel.canAccessPage(Secret, admin), true);
    assert.equal(await panel.canAccessPage(Secret, reader), false);
    const pages = Locked.getPages();
    assert.equal(await panel.canAccessPage(pages.index, admin), false);
    assert.equal(await panel.canAccessPage(pages.create, admin), true);
    assert.equal(await panel.canAccessPage(pages.create, reader), false);
    assert.deepEqual([...(await panel.resolveInaccessiblePages(reader))].sort(), ['locked', 'secret']);
});

test('panel hook: decides before the policy, or lets it answer', async () => {
    const seen: string[] = [];
    Panel.make().id('t3').key('k').pages([Dashboard, Secret]).resources([Notes]).authorizeUsing(({ user, ability, resource, page }) => {
        seen.push(`${ability}:${resource ? 'resource' : page ? 'page' : '-'}`);
        if (user.role === 'admin') return true;            // admins can do everything
        if (ability === 'viewAny') return false;           // custom system: readers cannot list anything
        return undefined;                                  // otherwise the policy decides
    });
    assert.equal(await Notes.can('delete', admin), true);
    assert.equal(await Notes.can('viewAny', reader), false);
    assert.equal(await Notes.can('delete', reader), false, 'policy consulted');
    assert.equal(await Notes.can('update', reader, { owner: 2 }), true, 'policy consulted');
    assert.equal(await Notes.panel.canAccessPage(Secret, admin), true);
    assert.ok(seen.includes('delete:resource') && seen.includes('access:page'));
});
