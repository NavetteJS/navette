import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, HtmlString, views } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import '@navette-js/support/ui';
import { Action, ActionGroup, AuthorizationResponse, mergeIntoRootTag, useColorManager } from '../src/index.ts';

useColorManager(new ColorManager());
views.share({ renderHook: () => '', t });
const livewire = { id: 'lw1', getActionMountContext: () => ({}), inspectActionAbility: async (ability: string, record: any) => (ability === 'update' ? (record?.locked ? AuthorizationResponse.deny('This post is locked.') : true) : ability === 'publish' ? false : true) };
const ctx = { livewire, component: null, operation: null, record: null, get: () => undefined, state: undefined } as any;
const locked = { ...ctx, record: { locked: true } };
const callCtx = { livewire, record: null, arguments: {}, data: {} } as any;
const clean = (html: string) => html.replace(/\s+/g, ' ');

test('extraAttributes(): merged onto the outer element of every rendering, classes added, merge option', async () => {
    const action = Action.make('edit').label('Edit').action(() => {}).extraAttributes({ title: 'Edit this post', class: 'my-edit', 'data-x': 1 });
    const button = clean(await action.toHtml(ctx));
    assert.match(button, /^ ?<button [^>]*title="Edit this post"/);
    assert.match(button, /class="fi-ac-btn-action fi-btn[^"]* my-edit"/);
    assert.match(button, /data-x="1"/);
    assert.match(clean(await action.toLinkHtml(ctx, {}, 'k')), /<button [^>]*class="[^"]*fi-ac-link-action[^"]* my-edit"[^>]*title="Edit this post"/);
    assert.match(clean(await action.toRecordGroupedHtml(ctx, {}, 'k')), /class="[^"]*fi-dropdown-list-item[^"]* my-edit"/);
    assert.match(clean(await Action.make('docs').url('/docs').extraAttributes({ target: '_self' }).toHtml(ctx)), /^<a [^>]*target="_self"/);
    // Without merge, a second call replaces the first; with merge, both apply.
    assert.doesNotMatch(clean(await Action.make('a').action(() => {}).extraAttributes({ title: 'one' }).extraAttributes({ 'data-two': '2' }).toHtml(ctx)), /title="one"/);
    assert.match(clean(await Action.make('a').action(() => {}).extraAttributes({ title: 'one' }).extraAttributes({ 'data-two': '2' }, true).toHtml(ctx)), /title="one"[^>]*data-two="2"|data-two="2"[^>]*title="one"/);
    // Values are escaped; a function receives the context.
    assert.match(clean(await Action.make('a').action(() => {}).extraAttributes(() => ({ title: '"><script>' })).toHtml(ctx)), /title="&quot;&gt;&lt;script&gt;"/);
    assert.throws(() => mergeIntoRootTag('<button>', { 'on click': 'x' }), /Invalid HTML attribute name/);
    assert.equal(mergeIntoRootTag(mergeIntoRootTag('<b class="a">', { class: 'b' }), { class: 'b' }), '<b class="a b">', 'idempotent');
});

test('actionJs(): runs in the browser, no request; alpineClickHandler() and livewireTarget()', async () => {
    const html = clean(await Action.make('slug').label('Slug').action(() => {}).actionJs("$set('slug', $get('title').toLowerCase())").toHtml(ctx));
    assert.match(html, /x-on:click="\$set\('slug', \$get\('title'\)\.toLowerCase\(\)\)"/);
    assert.doesNotMatch(html, /wire:click/);
    assert.match(clean(await Action.make('x').actionJs(() => 'alert(1)').iconButton().icon('m-play').toHtml(ctx)), /x-on:click="alert\(1\)"/);
    assert.match(clean(await Action.make('x').actionJs('go()').toLinkHtml(ctx, {}, 'k')), /x-on:click="go\(\)"/);
    assert.match(clean(await Action.make('x').alpineClickHandler('open = true').livewireTarget('save').toHtml(ctx)), /wire:target="save"[^]*x-on:click="open = true"/);
});

test('authorize(ability): policy through the host, hidden when denied; tooltip and notification keep it visible with a message', async () => {
    const edit = () => Action.make('edit').action(() => {}).authorize('update');
    assert.equal(await edit().isVisible(ctx), true);
    assert.equal(await edit().isVisible(locked), false);
    assert.equal(await Action.make('p').action(() => {}).authorize('publish').isVisible(ctx), false);
    assert.equal(await Action.make('p').action(() => {}).authorizeAny(['publish', 'update']).isVisible(ctx), true);
    assert.equal(await Action.make('p').action(() => {}).authorize(['publish', 'update']).isVisible(ctx), false);
    // A host that cannot check abilities denies them.
    assert.equal(await Action.make('p').action(() => {}).authorize('update').isVisible({ ...ctx, livewire: {} }), false);
    // A function may return a response.
    assert.equal(await Action.make('p').action(() => {}).authorize(() => AuthorizationResponse.deny('No')).isVisible(ctx), false);

    const tooltip = edit().authorizationTooltip();
    assert.equal(await tooltip.isVisible(locked), true);
    assert.equal(await tooltip.isDisabled(locked), true);
    const html = clean(await tooltip.toHtml(locked));
    assert.match(html, /x-tooltip="\{ content: &#039;This post is locked\.&#039;/);
    assert.match(html, /aria-disabled="true"/);
    assert.match(html, /fi-disabled/);
    assert.doesNotMatch(html, /wire:click|\sdisabled="disabled"/, 'with a tooltip, the button keeps the pointer but has no click');
    // Plain `false` has no message: hidden, unless `authorizationMessage()` gives one.
    assert.equal(await Action.make('p').action(() => {}).authorize('publish').authorizationTooltip().isVisible(ctx), false);
    const fallback = Action.make('p').action(() => {}).authorize('publish').authorizationTooltip().authorizationMessage('Ask an editor.');
    assert.equal(await fallback.isVisible(ctx), true);
    assert.equal(await fallback.getTooltip(ctx), 'Ask an editor.');

    const notify = edit().authorizationNotification();
    assert.equal(await notify.isVisible(locked), true);
    assert.equal(await notify.isDisabled(locked), false);
    assert.equal(await notify.isAuthorized(locked), false);
    assert.equal((await notify.getAuthorizationResponseWithMessage(locked)).message(), 'This post is locked.');
    // Row link and menu item show the disabled state too.
    assert.match(clean(await tooltip.toLinkHtml(locked, {}, 'k')), /aria-disabled="true"[^>]*class="[^"]*fi-disabled/);
    assert.match(clean(await tooltip.toRecordGroupedHtml(locked, {}, 'k')), /x-tooltip=[^>]*aria-disabled="true"/);
});

test('modal options: eyebrow, custom content, footer actions, icon color, slide-over position, click-through, autofocus, extra attributes', async () => {
    const action = Action.make('advance').label('Advance').color('warning').action(() => {})
        .modalEyebrow('Edit post').modalHeading('My post').modalIcon('o-bolt').modalIconColor('danger')
        .modalContent(new HtmlString('<p class="custom">Custom</p>')).modalContentFooter('<b>escaped</b>')
        .registerModalActions([Action.make('report').label('Report').requiresConfirmation().action(() => {})])
        .extraModalFooterActions((parent) => [parent.makeModalSubmitAction('another', { another: true }).label('Again')])
        .modalCancelAction((cancel) => cancel.label('Close'))
        .slideOver().slideOverPosition('start').modalClickThrough().modalAutofocus(false)
        .extraModalWindowAttributes({ class: 'update-author-modal', 'data-window': 'w' }).extraModalOverlayAttributes({ class: 'overlay-x' })
        .cancelParentActionsOnClose('first');
    const html = clean(await action.toModalHtml(callCtx, 0, null, {}));
    assert.match(html, /<p class="fi-modal-eyebrow"> Edit post <\/p> <h2 id="fi-lw1-action-0\.heading" class="fi-modal-heading"> My post/);
    assert.match(html, /class="fi-color fi-color-danger fi-modal-icon-bg"/, 'modalIconColor() colors the icon');
    assert.match(html, /<p class="custom">Custom<\/p>/);
    assert.match(html, /&lt;b&gt;escaped&lt;\/b&gt;/);
    assert.match(html, /fi-modal-slide-over-from-start/);
    assert.match(html, /fi-modal-click-through/);
    assert.match(html, /aria-modal="false"/);
    assert.doesNotMatch(html, /fi-modal-close-overlay/, 'a click-through modal has no backdrop');
    assert.doesNotMatch(html, /x-on:click\.self/, 'and cannot be closed by clicking away');
    assert.match(html, /data-window="w"[^>]*class="fi-modal-window[^"]* update-author-modal"/);
    assert.match(html, /wire:click="callMountedAction\(JSON\.parse\('\{\\u0022another\\u0022:true\}'\)\)"/);
    assert.match(html, /<\/svg> Again <\/button>/);
    assert.match(html, />\s*Close\s*<\/button>/);
    assert.match(html, /\$wire\.unmountAction\(&#39;first&#39;\)/);
    // The registered action renders as a child of the modal (mounted on top of it).
    const content = await Action.make('a').action(() => {}).registerModalActions([Action.make('report').label('Report').action(() => {})])
        .modalContent(async (c) => new HtmlString(await c.action!.renderModalAction('report', c))).toModalHtml(callCtx, 2, null, { table: true });
    assert.match(clean(content), /wire:click="mountAction\('report', \{\}, JSON\.parse\('\{\\u0022table\\u0022:true,\\u0022parentAction\\u0022:2\}'\)\)"/);
    // Autofocus and overlay.
    const plain = clean(await Action.make('b').action(() => {}).schema([]).modalAutofocus(false).extraModalOverlayAttributes({ class: 'overlay-x' }).toModalHtml(callCtx, 0));
    assert.match(plain, /x-trap\.noreturn\.noautofocus="isTrapActive"/);
    assert.match(plain, /class="fi-modal-close-overlay overlay-x"/);
    // Removing the default buttons.
    const bare = clean(await Action.make('c').action(() => {}).modalHeading('Help').modalSubmitAction(false).modalCancelAction(false).toModalHtml(callCtx, 0));
    assert.doesNotMatch(bare, /fi-modal-footer/);
    // Submit button customized.
    assert.match(clean(await Action.make('d').action(() => {}).schema([]).modalSubmitAction((submit) => submit.label('Send now')).toModalHtml(callCtx, 0)), /Send now/);
});

test('modal behavior flags: has modal, unsaved changes alert, parents, transactions, rate limit', async () => {
    assert.equal(Action.make('a').action(() => {}).hasModal(), false);
    assert.equal(Action.make('a').action(() => {}).modalHeading('Sure?').hasModal(), true);
    assert.equal(Action.make('a').action(() => {}).modalEyebrow('Op').hasModal(), true);
    assert.equal(Action.make('a').action(() => {}).schema([]).modal(false).hasModal(), false);
    assert.equal(Action.make('help').modalContent('Read me').isMountable(), true, 'a modal with only custom content can be opened');
    assert.equal(await Action.make('a').schema([]).hasUnsavedChangesAlert(callCtx), true);
    assert.equal(await Action.make('a').schema([]).disabledSchema().hasUnsavedChangesAlert(callCtx), false);
    assert.equal(await Action.make('a').schema([]).disabledSchema().unsavedChangesAlert().hasUnsavedChangesAlert(callCtx), true);
    assert.equal(await Action.make('a').unsavedChangesAlert(false).hasUnsavedChangesAlert(callCtx), false);
    const child = Action.make('c').cancelParentActions('second').overlayParentActions().cancelParentActionsOnClose();
    assert.equal(child.getParentActionToCancelTo(), 'second');
    assert.equal(child.shouldCancelAllParentActions(), false);
    assert.equal(await child.shouldOverlayParentActions(callCtx), true);
    assert.equal(child.getParentActionsToCancelOnClose(), true);
    assert.equal(await Action.make('t').hasDatabaseTransactions(callCtx), null);
    assert.equal(await Action.make('t').databaseTransaction().hasDatabaseTransactions(callCtx), true);
    assert.equal(await Action.make('t').databaseTransaction(() => false).hasDatabaseTransactions(callCtx), false);
    assert.equal(await Action.make('r').rateLimit(5).getRateLimit(callCtx), 5);
    assert.equal(await Action.make('r').rateLimit(() => 2).getRateLimit(callCtx), 2);
    assert.equal(Action.make('r').rateLimitedNotificationTitle(({ seconds }) => `Wait ${seconds}s`).getRateLimitedNotificationTitle({ ...callCtx, seconds: 9, minutes: 1 }), 'Wait 9s');
    assert.throws(() => Action.make('h').halt(true), (error: any) => error.rollsBackDatabaseTransaction === true && error.closesModal === false);
    assert.throws(() => Action.make('h').cancel(), (error: any) => error.rollsBackDatabaseTransaction === false && error.closesModal === true);
});

test('defaultColor() / defaultSize() apply unless color() / size() were called; modifyWizardUsing()', async () => {
    assert.match(clean(await Action.make('a').action(() => {}).defaultColor('danger').defaultSize('sm').toHtml(ctx)), /fi-size-sm[^"]*fi-color-danger|fi-color-danger[^"]*fi-size-sm/);
    assert.match(clean(await Action.make('a').action(() => {}).color('success').size('lg').defaultColor('danger').defaultSize('sm').toHtml(ctx)), /fi-size-lg[^"]*fi-color-success/);
    let modified: any = null;
    Action.stepsRenderer = (steps) => ({ steps });
    const wizard = Action.make('w').action(() => {}).steps([1, 2]).modifyWizardUsing((w) => { modified = w; return { ...w, hidden: true }; });
    const applied = wizard.applySchema({ components: (list: any[]) => list, columns() { return this; } });
    assert.deepEqual(modified, { steps: [1, 2] });
    assert.deepEqual(applied, [{ steps: [1, 2], hidden: true }]);
    Action.stepsRenderer = null;
});

test('ActionGroup: dropdownAutoPlacement(), dropdownMaxHeight(), dropdownFlip()', async () => {
    const items = [Action.make('a').action(() => {}), Action.make('b').action(() => {})];
    const auto = clean(await ActionGroup.make(items).dropdownAutoPlacement().toHtml(ctx));
    assert.match(auto, /x-float\.placement\.auto-placement\.teleport\.offset=/);
    assert.doesNotMatch(auto, /\.flip/);
    assert.match(clean(await ActionGroup.make(items).dropdownMaxHeight('12rem').toHtml(ctx)), /fi-scrollable" style="max-height: 12rem"/);
    assert.match(clean(await ActionGroup.make(items).dropdownFlip(false).toHtml(ctx)), /x-float\.placement\.bottom-end\.teleport/);
    assert.match(clean(await ActionGroup.make(items).dropdownPlacement('nonsense').toHtml(ctx)), /x-float\.placement\.bottom-end\.flip/);
});
