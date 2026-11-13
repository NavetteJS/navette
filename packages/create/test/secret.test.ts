import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { readSecret as readCreateSecret } from '../src/secret.ts';
import { readSecret as readCliSecret } from '../../cli/src/secret.ts';

/** Types keys into a fake terminal and returns the answer with everything written on screen. */
async function type(reader: typeof readCreateSecret, keys: string[]): Promise<{ answer: string; screen: string; raw: boolean[] }> {
    const raw: boolean[] = [];
    const input = Object.assign(new PassThrough(), { isRaw: false, setRawMode(mode: boolean) { raw.push(mode); this.isRaw = mode; return this; } });
    let screen = '';
    const output = new Writable({ write(chunk, _encoding, callback) { screen += String(chunk); callback(); } });
    const answer = reader('  Password: ', input as any, output as any);
    for (const key of keys) input.write(key);
    return { answer: await answer, screen, raw };
}

for (const [name, reader] of [['create-navette', readCreateSecret], ['navette make:user', readCliSecret]] as const) {
    test(`${name}: a password is typed hidden, with backspace, and the terminal is restored`, async () => {
        const { answer, screen, raw } = await type(reader, ['s', 'e', 'c', 'r', 'x', '\u007f', 'e', 't', '\x1b[D', '1', '2', '3', '\r']);
        assert.equal(answer, 'secret123');
        assert.doesNotMatch(screen, /secr|123/, 'never echoed');
        assert.match(screen, /Password: •••••••••\n$/);
        assert.deepEqual(raw, [true, false], 'raw mode on, then back off');
    });
    test(`${name}: a pasted password is read whole`, async () => {
        assert.equal((await type(reader, ['correct horse battery\r'])).answer, 'correct horse battery');
    });
}
