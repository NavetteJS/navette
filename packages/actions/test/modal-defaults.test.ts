import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, ModalComponent, views } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { modal, useColorManager as useUiColorManager } from '@navette-js/support/ui';
import { Action, useColorManager } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors); useUiColorManager(colors);
views.share({ renderHook: () => '', t });
const livewire = { id: 'lw1', getActionMountContext: () => ({}), inspectActionAbility: async () => true };
const callCtx = { livewire, record: null, arguments: {}, data: {} } as any;

test('ModalComponent: app-wide defaults of action modals and of the standalone modal, overridden per modal', async (t) => {
    t.after(() => { ModalComponent.closeButton(); ModalComponent.closedByClickingAway(); ModalComponent.closedByEscaping(); ModalComponent.autofocus(); });
    const actionModal = () => Action.make('a').action(() => {}).schema([]).toModalHtml(callCtx, 0);
    let html = await actionModal();
    assert.match(html, /fi-modal-close-btn/);
    assert.match(html, /x-on:click\.self=/);
    assert.match(html, /keydown\.window\.escape/);
    assert.doesNotMatch(html, /noautofocus/);

    ModalComponent.closeButton(false);
    ModalComponent.closedByClickingAway(false);
    ModalComponent.closedByEscaping(false);
    ModalComponent.autofocus(false);
    html = await actionModal();
    assert.doesNotMatch(html, /fi-modal-close-btn/, 'no close button by default');
    assert.doesNotMatch(html, /x-on:click\.self=/, 'clicking away no longer closes');
    assert.doesNotMatch(html, /keydown\.window\.escape/, 'Escape no longer closes');
    assert.match(html, /noautofocus/);
    // An action asking for them gets them back.
    html = await Action.make('b').action(() => {}).schema([]).modalCloseButton().closeModalByClickingAway().closeModalByEscaping().modalAutofocus().toModalHtml(callCtx, 0);
    assert.match(html, /fi-modal-close-btn/);
    assert.match(html, /x-on:click\.self=/);
    assert.match(html, /keydown\.window\.escape/);
    assert.doesNotMatch(html, /noautofocus/);

    // The standalone component follows the same defaults, and its own props win.
    assert.doesNotMatch(modal({ id: 'm', heading: 'Hi' }), /fi-modal-close-btn/);
    assert.match(modal({ id: 'm', heading: 'Hi', closeButton: true }), /fi-modal-close-btn/);
    assert.match(modal({ id: 'm', heading: 'Hi', closeByEscaping: true }), /keydown\.window\.escape/);
});
