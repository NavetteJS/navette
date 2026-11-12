import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Throttle } from '../src/index.ts';

test('Throttle : cinq essais par minute, puis attente, puis reprise', () => {
    const throttle = new Throttle(5, 60_000);
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) assert.equal(throttle.hit('ip', t0 + i * 1000), 0);
    assert.equal(throttle.hit('ip', t0 + 5000), 55);
    assert.equal(throttle.hit('autre', t0 + 5000), 0);
    assert.equal(throttle.hit('ip', t0 + 61_000), 0);
    throttle.clear('ip');
    for (let i = 0; i < 5; i++) assert.equal(throttle.hit('ip', t0 + 62_000), 0);
    assert.ok(throttle.hit('ip', t0 + 62_000) > 0);
});
