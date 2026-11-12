import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configured, configureUsing, resetConfigurators } from '../src/index.ts';

class Base { label = ''; size = 'md'; }
class Derived extends Base { extra = false; }

test('configureUsing: applies to instances created afterwards, parent classes first, without affecting other classes', () => {
    resetConfigurators();
    assert.equal(configured(new Derived()).size, 'md');
    configureUsing(Base, (instance) => { instance.size = 'sm'; instance.label = 'base'; });
    configureUsing(Derived, (instance) => { instance.label = 'derived'; instance.extra = true; });
    const derived = configured(new Derived());
    assert.deepEqual([derived.size, derived.label, derived.extra], ['sm', 'derived', true]);
    const base = configured(new Base());
    assert.deepEqual([base.size, base.label], ['sm', 'base']);
    resetConfigurators();
    assert.equal(configured(new Base()).size, 'md');
});
