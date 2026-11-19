import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findRecords } from '../src/index.ts';

test('findRecords(): findMany() when the adapter has it, otherwise one find() per key', async () => {
    let finds = 0, manys = 0;
    const plain = { find: async (key: string) => { finds++; return key === 'x' ? null : { key }; } };
    assert.deepEqual(await findRecords(plain, ['a', 'x']), [{ key: 'a' }, null]);
    assert.equal(finds, 2);
    const batch = { ...plain, findMany: async (keys: string[]) => { manys++; return keys.map((key) => ({ key })); } };
    assert.deepEqual(await findRecords(batch, ['a', 'b']), [{ key: 'a' }, { key: 'b' }]);
    assert.equal(manys, 1);
    assert.equal(finds, 2);
});

test('extreme(): numbers compare as numbers, text as text', async () => {
    const { extreme } = await import('../src/index.ts');
    assert.equal(extreme([9, 10, 100], 'min'), '9');
    assert.equal(extreme(['9', '10', 2], 'max'), '10');
    assert.equal(extreme(['b', 'a', 'c'], 'min'), 'a');
    assert.equal(extreme(['2026-01-02', '2026-01-10'], 'max'), '2026-01-10');
    assert.equal(extreme([], 'max'), null);
});
