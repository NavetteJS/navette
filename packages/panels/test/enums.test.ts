import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineEnum, nativeEnum } from '@navette-js/support';
import { ImportColumn } from '../src/index.ts';

test('ImportColumn.enum(): values outside the enum fail the row, empty values pass', () => {
    const Status = defineEnum({ draft: 'Draft', published: 'Published' });
    const column = ImportColumn.make('status').enum(Status);
    assert.equal(column.validate('published', {}), null);
    assert.equal(column.validate(' draft ', {}), null);
    assert.equal(column.validate('', {}), null);
    assert.equal(column.validate(null, {}), null);
    assert.deepEqual(column.failedRule('Published', {}), { rule: 'enum', message: 'The selected status is invalid.' });
    assert.equal(ImportColumn.make('status').enum(Status).rules(['required']).validate('', {}), 'The status field is required.');
    assert.equal(column.cast(' draft '), 'draft');
    // `enum Priority { Low = 1, High = 2 }` compiled by tsc: the cell text becomes the numeric value.
    const Priority = nativeEnum({ Low: 1, High: 2, 1: 'Low', 2: 'High' } as const);
    assert.equal(ImportColumn.make('priority').enum(Priority).cast('2'), 2);
});
