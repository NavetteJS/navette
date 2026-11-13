import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AssociateAction, DissociateAction, DissociateBulkAction, RelationManager } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

const calls: unknown[] = [];
class Members extends RelationManager {
    static async associate(owner: string, key: string) { calls.push(['associate', owner, key]); }
    static async dissociate(owner: string, keys: string[]) { calls.push(['dissociate', owner, keys]); }
}
const livewire = ({ constructor: Members,
    ownerRecord: '7', resource: { adapter: { getKey: (record: any) => record.id }, getRecordTitle: () => 'Ada', getPluralModelLabel: () => 'members', modelLabel: 'member' },
    getSelectedRecordKeys: async () => ['3', '4'], deselectAllTableRecords() { calls.push(['deselect']); },
}) as any;

test('associate / dissociate actions call the manager with the owner and the keys', async () => {
    await runInRequest('mailbox', async () => {
        await (AssociateAction.make() as any).call({ livewire, record: null, arguments: {}, data: { recordId: 12 } });
        await (DissociateAction.make() as any).call({ livewire, record: { id: '5' }, arguments: {}, data: {} });
        await (DissociateBulkAction.make() as any).call({ livewire, record: null, arguments: {}, data: {} });
    });
    assert.deepEqual(calls, [['associate', '7', '12'], ['dissociate', '7', ['5']], ['dissociate', '7', ['3', '4']], ['deselect']]);
});
