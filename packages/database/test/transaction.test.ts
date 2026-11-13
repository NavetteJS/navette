import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Model, ObjectionAdapter, currentTransaction, sqlite, transaction } from '../src/index.ts';

class Note extends Model { static tableName = 'notes'; declare id: number; declare body: string; }

test('a transaction commits or rolls back every query made through the connection, models and raw Knex alike', async () => {
    const knex = sqlite(':memory:');
    await knex.schema.createTable('notes', (table) => { table.increments('id'); table.string('body'); });
    const adapter = new ObjectionAdapter(Note);
    assert.equal(currentTransaction(knex), null);

    await adapter.transaction!(async () => {
        assert.ok(currentTransaction(knex));
        await adapter.create({ body: 'kept' });
        await knex('notes').insert({ body: 'kept too' });
    });
    await assert.rejects(transaction(knex, async () => {
        await adapter.create({ body: 'lost' });
        await knex('notes').insert({ body: 'lost too' });
        // Nested: joins the open transaction.
        await transaction(async () => { await Note.query().insert({ body: 'lost as well' }); });
        throw new Error('cancelled');
    }), /cancelled/);
    assert.deepEqual((await knex('notes').orderBy('id')).map((row: any) => row.body), ['kept', 'kept too']);
    await knex.destroy();
});
