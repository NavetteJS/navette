import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Action } from '@navette-js/actions';
import { sqlite, type Knex } from '@navette-js/database';
import { HtmlString } from '@navette-js/support';
import { AttachAction, CreateAction, DeleteAction, DeleteBulkAction, DetachBulkAction, EditAction, ExportAction, ExportBulkAction, ForceDeleteAction, ImportAction, Page, Panel, ReplicateAction, RestoreBulkAction, ViewAction, type User } from '../src/index.ts';
import { actingAs, livewire, setCurrentPanel, TestAction } from '../src/testing.ts';

class SendInvoiceAction extends Action {
    static override getDefaultName(): string { return 'sendInvoice'; }
    protected override setUp(): void {
        this.label('Send invoice').requiresConfirmation()
            .modalDescription(({ arguments: args }) => `Send it to ${String(args.email ?? "the customer's primary address")}.`)
            .action(() => {});
    }
}

class Billing extends Page {
    static slug = 'billing';
    getHeaderActions(): Action[] { return [SendInvoiceAction.make(), Action.make('archive').modalHeading('Archive the invoice').slideOver().modalWidth('lg').action(() => {})]; }
}

const user: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const panel = Panel.make().id('actions').key('actions-key').auth({ find: async () => user } as any).pages([Billing]);
let db: Knex;
before(() => { db = sqlite(':memory:'); setCurrentPanel(panel); actingAs(user); });
after(() => db.destroy());

test('`getDefaultName()`: `Action` requires a name, subclasses and prebuilt actions have their own', () => {
    assert.equal(Action.getDefaultName(), null);
    assert.throws(() => Action.make(), /must have a unique name/);
    const action = SendInvoiceAction.make();
    assert.ok(action instanceof SendInvoiceAction, 'make() returns an instance of the subclass');
    assert.equal(action.getName(), 'sendInvoice');
    assert.equal(SendInvoiceAction.make('other').getName(), 'other');
    const names: [{ getDefaultName(): string | null; make(): { getName(): string } }, string][] = [
        [CreateAction, 'create'], [EditAction, 'edit'], [ViewAction, 'view'], [DeleteAction, 'delete'], [ForceDeleteAction, 'forceDelete'],
        [ReplicateAction, 'replicate'], [DeleteBulkAction, 'delete'], [RestoreBulkAction, 'restore'], [AttachAction, 'attach'],
        [DetachBulkAction, 'detach'], [ExportAction, 'export'], [ExportBulkAction, 'export'], [ImportAction, 'import'],
    ];
    for (const [ActionClass, name] of names) {
        assert.equal(ActionClass.getDefaultName(), name);
        assert.equal(ActionClass.make().getName(), name);
    }
    assert.equal(TestAction.make(EditAction).name, 'edit');
    assert.equal(TestAction.make(SendInvoiceAction).name, 'sendInvoice');
});

test('modal getters evaluate with the action context', async () => {
    const action = Action.make('publish').requiresConfirmation();
    assert.equal(await action.getModalHeading(), 'Publish');
    assert.equal(await action.getModalDescription(), 'Are you sure you would like to do this?');
    assert.equal(await action.getModalSubmitActionLabel(), 'Confirm');
    assert.equal(action.getModalCancelActionLabel(), 'Cancel');
    assert.equal(action.getModalWidth(), 'md');
    assert.equal(action.getModalAlignment(), 'center');
    assert.ok(action.getModalIcon());
    assert.equal(action.isConfirmationRequired(), true);
    const custom = Action.make('send').modalHeading(({ record }) => `Send ${(record as any)?.title}`).modalDescription(new HtmlString('<b>Now</b>')).modalSubmitActionLabel('Go').modalCancelActionLabel('Back').modalWidth('2xl').modalFooterActionsAlignment('end');
    assert.equal(await custom.getModalHeading({ record: { title: 'Invoice' } } as any), 'Send Invoice');
    assert.equal(await custom.getModalDescription(), '<b>Now</b>');
    assert.deepEqual([await custom.getModalSubmitActionLabel(), custom.getModalCancelActionLabel(), custom.getModalWidth(), custom.getModalFooterActionsAlignment(), custom.isModalSlideOver(), custom.hasModalSubmitAction()], ['Go', 'Back', '2xl', 'end', false, true]);
});

test('`assertActionExists()` checks can read the modal getters (with the mount arguments)', async () => {
    await livewire(Billing)
        .assertActionExists(SendInvoiceAction, async (action: Action) => (await action.getModalDescription()) === "Send it to the customer's primary address.")
        .assertActionExists(TestAction.make('sendInvoice').arguments({ email: 'billing@example.test' }), async (action: Action) => (await action.getModalDescription()) === 'Send it to billing@example.test.')
        .assertActionExists('archive', async (action: Action) => (await action.getModalHeading()) === 'Archive the invoice' && action.isModalSlideOver() && action.getModalWidth() === 'lg');
    await assert.rejects(async () => { await livewire(Billing).assertActionExists('archive', async (action: Action) => (await action.getModalHeading()) === 'Other'); }, /provided configuration exists/);
});
