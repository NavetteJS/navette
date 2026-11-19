import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { UploadStore } from '../src/uploads.ts';

test('the temporary folder is swept at most once a minute', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'nv-uploads-'));
    const store = new UploadStore(dir, 'secret-key-0123456789', { ttl: 10 * 60_000 });
    const old = (name: string) => { const file = path.join(dir, name); writeFileSync(file, 'x'); const past = new Date(Date.now() - 3600_000); utimesSync(file, past, past); return file; };
    const first = old('old-1');
    await store.storeContent('a.txt', 'a');
    assert.equal(existsSync(first), false, 'the first upload sweeps expired files');
    const second = old('old-2');
    await store.storeContent('b.txt', 'b');
    assert.equal(existsSync(second), true, 'a second upload within the minute does not walk the folder again');
});
