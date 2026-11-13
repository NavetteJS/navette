import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager } from '@navette-js/support';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { Field, TextInput, useColorManager as useFormsColorManager } from '@navette-js/forms';
import { Schema } from '@navette-js/schemas';
import { AttachAction, EditAction, Panel, RelationManager } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

useActionsColorManager(new ColorManager());
useFormsColorManager(new ColorManager());
const calls: unknown[][] = [];
const records: Record<string, { id: number; name: string; role: string }> = { '7': { id: 7, name: 'Ada', role: 'member' } };

class MembersRelationManager extends RelationManager {
    static relationship = 'members';
    static modelLabel = 'member';
    static adapterFor() {
        return { getKey: (record: any) => String(record.id), update: async (key: string, data: Record<string, unknown>) => { calls.push(['update', key, data]); return records[key]; } } as any;
    }
    static form(schema: Schema): Schema { return schema.components([TextInput.make('name').required()]); }
    static pivotForm(): any[] { return [TextInput.make('role').required()]; }
    static async attach(ownerKey: string, recordKey: string, pivot: Record<string, unknown> = {}) { calls.push(['attach', ownerKey, recordKey, pivot]); }
    static async updatePivot(ownerKey: string, recordKey: string, pivot: Record<string, unknown>) { calls.push(['updatePivot', ownerKey, recordKey, pivot]); }
}
const host = () => {
    const livewire = Object.create(MembersRelationManager.prototype);
    livewire.ownerRecord = '3';
    livewire._ctx = { panel: Panel.make().id('admin'), user: { id: 1, name: 'A', email: 'a@example.com' } };
    return livewire;
};

test('the attach modal adds the pivot fields after the record select, and attach() receives their values', async () => {
    const livewire = host();
    const action = AttachAction.make();
    const fields = action.applySchema(Schema.make(livewire)).getComponents().filter((component: unknown) => component instanceof Field).map((field: Field) => field.getName());
    assert.deepEqual(fields, ['recordId', 'role']);
    calls.length = 0;
    await runInRequest('test', () => action.call({ livewire, action, record: null, arguments: {}, data: { recordId: 9, role: 'owner' } } as any));
    assert.deepEqual(calls, [['attach', '3', '9', { role: 'owner' }]]);
});

test('editing a row saves the pivot fields through updatePivot() and the other fields on the record', async () => {
    const livewire = host();
    const action = EditAction.make();
    const schema = action.applySchema(Schema.make(livewire));
    const fields = schema.getComponents().filter((component: unknown) => component instanceof Field).map((field: Field) => field.getName());
    assert.deepEqual(fields, ['name', 'role']);
    calls.length = 0;
    await runInRequest('test', () => action.call({ livewire, action, record: records['7'], schema, arguments: {}, data: { name: 'Ada L.', role: 'admin' } } as any));
    assert.deepEqual(calls, [['updatePivot', '3', '7', { role: 'admin' }], ['update', '7', { name: 'Ada L.' }]]);
});
