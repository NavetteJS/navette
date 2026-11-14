import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, markdownToHtml, raw } from '@navette-js/support';
import { Action, ActionGroup } from '@navette-js/actions';
import { Notification, notificationActionFromArray, notificationActionsHtml, notificationActionToArray, renderNotification, useNotificationsColorManager } from '../src/notifications.ts';

useNotificationsColorManager(new ColorManager());
const html = (notification: Notification) => notificationActionsHtml(notification.getData().actions);
const decoded = (value: string) => value.replace(/&#039;/g, "'").replace(/&quot;/g, '"');

test('Notification actions are real Actions: small links by default, icons, sizes, tooltips, disabled state', () => {
    const notification = Notification.make().title('Saved').actions([
        Action.make('view').url('/posts/1').icon('o-eye'),
        Action.make('undo').button().color('gray').icon('o-arrow-uturn-left').iconPosition('after').size('md').tooltip('Undo the <change>').dispatch('undoEditingPost', { post: 5 }).close(),
        Action.make('archive').iconButton().icon('o-archive-box').dispatchTo('posts-table', 'archive', [5]),
        Action.make('locked').url('/locked').disabled().tooltip('Not allowed'),
        Action.make('read').badge().markAsRead(),
    ]);
    const out = decoded(html(notification));
    // A link, small, with its icon before the label.
    assert.match(out, /<a href="\/posts\/1" class="nv-ac-link-action nv-link nv-size-sm nv-color nv-color-primary [^"]*"><svg class="nv-icon nv-size-sm"[^>]*>[\s\S]*?<\/svg><span class="nv-link-label">View<\/span><\/a>/);
    // A button keeps its size, color and icon position; its tooltip is plain text.
    assert.match(out, /<button type="button" x-on:click="Livewire\.dispatch\('undoEditingPost', [^"]+\); close\(\)" class="nv-ac-btn-action nv-btn nv-size-md" x-tooltip="\{ content: 'Undo the \\u003Cchange\\u003E', theme: \$store\.theme, allowHTML: false \}">Undo<svg class="nv-icon nv-size-md"/);
    // An icon button: the label is its accessible name.
    assert.match(out, /<button type="button" x-on:click="Livewire\.dispatchTo\('posts-table', 'archive', [^"]+\)" title="Archive" aria-label="Archive" class="nv-ac-icon-btn-action nv-icon-btn nv-size-sm[^"]*"><svg/);
    // Disabled: no link, no click handler.
    assert.match(out, /<a class="nv-ac-link-action nv-link nv-disabled nv-size-sm[^"]*" x-tooltip="[^"]*Not allowed[^"]*" aria-disabled="true"><span class="nv-link-label">Locked<\/span><\/a>/);
    assert.doesNotMatch(out, /href="\/locked"/);
    // A badge marking the database notification as read.
    assert.match(out, /<button type="button" x-on:click="markAsRead\(\)" class="nv-ac-badge-action nv-badge nv-size-sm[^"]*"><span class="nv-badge-label-ctn"><span class="nv-badge-label">Read<\/span><\/span><\/button>/);
});

test('Notification action groups: a dropdown behind a link, items closing the notification', () => {
    const out = decoded(html(Notification.make().actions([
        ActionGroup.make([
            Action.make('edit').url('/posts/1/edit').icon('o-pencil'),
            Action.make('dismiss').close(),
            ActionGroup.make([Action.make('delete').color('danger').dispatch('deletePost', [1])]).dropdown(false),
        ]).tooltip('More'),
        ActionGroup.make([Action.make('a').url('/a'), Action.make('b').url('/b')]).dropdown(false),
    ])));
    // Filament's default trigger in notifications: a small "Actions" link.
    assert.match(out, /<div x-data="\{ notificationElement: null, closeNotification\(\.\.\.args\) \{ return Alpine\.\$data\(this\.notificationElement\)\.close\(\.\.\.args\) \} \}" x-init="notificationElement = \$el\.closest\('\.nv-no-notification'\)" style="display: contents"><div x-data="navetteDropdown" class="nv-dropdown"><div x-on:mousedown="if \(\$event\.button === 0\) toggle\(\$event\)" class="nv-dropdown-trigger"><button x-tooltip="[^"]*More[^"]*" type="button" class="nv-ac-link-group nv-link nv-size-sm[^"]*"><svg[\s\S]*?<span class="nv-link-label">Actions<\/span><\/button>/);
    assert.match(out, /<a href="\/posts\/1\/edit" role="menuitem" tabindex="-1" class="nv-dropdown-list-item nv-ac-grouped-action"><svg class="nv-icon nv-size-md"[\s\S]*?<span class="nv-dropdown-list-item-label">Edit<\/span><\/a>/);
    // The notification's close, not the dropdown's.
    assert.match(out, /<button type="button" x-on:click="closeNotification\(\)" role="menuitem"/);
    // A nested group without dropdown is a section of the menu.
    assert.match(out, /<\/div><div class="nv-dropdown-list" role="group"><button type="button" x-on:click="Livewire\.dispatch\('deletePost', [^"]+\)" role="menuitem" tabindex="-1" class="nv-dropdown-list-item nv-ac-grouped-action nv-color nv-color-danger/);
    // `dropdown(false)` at the top: the actions side by side.
    assert.match(out, /<a href="\/a" class="nv-ac-link-action nv-link nv-size-sm[^"]*"><span class="nv-link-label">A<\/span><\/a><a href="\/b"/);
});

test('Filament array format: Action / ActionGroup toArray() and fromArray(), checked when it comes from outside', () => {
    const action = Action.make('view').label('View post').url('/posts/1').openUrlInNewTab().icon('o-eye').iconPosition('after').size('lg').tooltip('Open').outlined().button().color('success').close().markAsRead();
    const array = action.toArray();
    assert.equal(array.name, 'view');
    assert.equal(array.label, 'View post');
    assert.equal(array.url, '/posts/1');
    assert.deepEqual([array.icon, array.iconPosition, array.size, array.tooltip, array.isOutlined, array.view, array.color, array.shouldClose, array.shouldMarkAsRead, array.shouldOpenUrlInNewTab], ['o-eye', 'after', 'lg', 'Open', true, 'button', 'success', true, true, true]);
    const copy = Action.fromArray(array).toArray();
    assert.deepEqual({ ...copy }, { ...array });
    assert.deepEqual(Action.make('x').dispatchTo('posts', 'refresh', { id: 1 }).toArray().dispatchDirection, 'to');
    assert.equal(Action.make('x').dispatchSelf('refresh').toArray().dispatchDirection, 'self');
    const group = ActionGroup.make([action, Action.make('b')]).label('More').icon('o-bars-3').button().tooltip('Menu');
    const groupArray = group.toArray();
    assert.equal(groupArray.actions.length, 2);
    assert.deepEqual([groupArray.label, groupArray.icon, groupArray.triggerView, groupArray.tooltip], ['More', 'o-bars-3', 'button', 'Menu']);
    assert.equal(ActionGroup.fromArray(groupArray).toArray().actions.length, 2);
    // Forged arrays: bad names, colors, icons, sizes and views are dropped.
    const forged = Action.fromArray({ name: 'a" onclick="x', color: 'red" x', icon: '../x', size: 'huge', view: 'evil', label: 'Ok' }).toArray();
    assert.deepEqual([forged.name, forged.color, forged.icon, forged.size, forged.view], ['action', 'primary', null, 'md', null]);

    // The notification array keeps groups and the new keys, and reads them back.
    const items = Notification.make().actions([group]).getData().actions!;
    const stored = items.map(notificationActionToArray);
    assert.equal((stored[0] as any).triggerView, 'navette::components.button.index');
    assert.deepEqual(stored.map((item) => notificationActionFromArray(item)), items);
});

test('Extra attributes of notification actions: only harmless names, values escaped', () => {
    const action = notificationActionFromArray({
        name: 'x', url: '/x', extraAttributes: {
            'data-id': '5" onmouseover="alert(1)', 'aria-label': 'Open', class: 'my-action', onclick: 'alert(1)', 'x-on:click': 'alert(1)', '@click': 'alert(1)',
            'wire:click': 'delete', href: 'javascript:alert(1)', style: 'position:fixed', 'x-init': 'alert(1)', ':class': 'x', id: 'open',
        },
    })!;
    assert.deepEqual((action as any).extraAttributes, { 'data-id': '5" onmouseover="alert(1)', 'aria-label': 'Open', class: 'my-action', id: 'open' });
    const out = notificationActionsHtml([action]);
    assert.match(out, /class="nv-ac-link-action nv-link nv-size-sm [^"]*my-action" data-id="5&quot; onmouseover=&quot;alert\(1\)" aria-label="Open" id="open"/);
    assert.doesNotMatch(out, /onclick|x-on:click="alert|wire:click|javascript:|position:fixed|x-init/);
    // From an Action: the attributes of `extraAttributes()` (actions package) go through the same filter.
    const withAttributes = Object.assign(Action.make('y').url('/y'), { getExtraAttributes: () => ({ 'data-test': 'ok', onclick: 'alert(1)' }) });
    assert.match(html(Notification.make().actions([withAttributes])), /data-test="ok"/);
    assert.doesNotMatch(html(Notification.make().actions([withAttributes])), /onclick/);
});

test('Title and body: safe HTML and Markdown, sanitized like Filament', () => {
    const notification = Notification.make().title(raw('<strong>Order</strong> <em>#5</em> shipped<script>alert(1)</script>'))
        .body(markdownToHtml('**Tracking**: [follow](https://example.com/t/5) <img src=x onerror=alert(1)>')).getData();
    const out = renderNotification(notification);
    assert.match(out, /<h3 class="nv-no-notification-title"><strong>Order<\/strong> <em>#5<\/em> shipped<\/h3>/);
    assert.match(out, /<div class="nv-no-notification-body"><p><strong>Tracking<\/strong>: <a href="https:\/\/example\.com\/t\/5"[^>]*>follow<\/a>/);
    assert.doesNotMatch(out, /<script|<img[^>]*onerror/);
    // Plain text is shown as text.
    assert.match(renderNotification(Notification.make().title('Price < 5 & more').getData()), /Price &lt; 5 &amp; more/);
    assert.equal(Notification.make().title('A').getTitle(), 'A');
});

test('getBroadcastMessage(): actions travel in the array format and come back whole through fromArray()', () => {
    const notification = Notification.make('n1').title('Exported').actions([
        Action.make('download').button().icon('o-arrow-down-tray').url('/exports/1').close(),
        ActionGroup.make([Action.make('retry').dispatch('retryExport', { id: 1 })]),
    ]);
    const message = notification.getBroadcastMessage();
    assert.equal(message.format, 'navette');
    assert.equal((message.actions![0] as any).shouldClose, true);
    assert.equal((message.actions![0] as any).view, 'navette::components.button.index');
    assert.ok(Array.isArray((message.actions![1] as any).actions));
    // What the browser sends back is rebuilt into the same notification.
    const rebuilt = Notification.fromArray(JSON.parse(JSON.stringify(message))).getData();
    assert.deepEqual(rebuilt.actions, notification.getData().actions);
    assert.deepEqual([rebuilt.id, rebuilt.title], ['n1', 'Exported']);
});

test('extra attributes kept by extraAttributes() as a list of sets (static objects and functions) are serialized', () => {
    const action = Object.assign(Action.make('z').url('/z'), { _extraAttributes: [{ 'data-a': '1' }, () => ({ 'data-b': '2' }), async () => ({ 'data-c': '3' })] });
    assert.deepEqual(action.toArray().extraAttributes, { 'data-a': '1', 'data-b': '2' });
});

test('notification action URLs: same-site paths and http(s) only', async () => {
    const { safeNotificationUrl } = await import('../src/notification-actions.ts');
    for (const ok of ['/admin/posts', 'https://example.com/a', 'http://example.com']) assert.equal(safeNotificationUrl(ok), ok);
    for (const bad of ['//evil.example', '/\\evil.example', '/\t/evil.example', 'javascript:alert(1)', 'data:text/html,x', ' https://a', 42]) assert.equal(safeNotificationUrl(bad), null);
});
