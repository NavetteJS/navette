import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Color, ColorManager, convertToOklch, generatePalette } from '../src/index.ts';

test('convertToOklch : valeurs de référence', () => {
    assert.equal(convertToOklch('#ffffff'), 'oklch(1 0 89.876)');
    assert.equal(convertToOklch('oklch(0.5 0.1 20)'), 'oklch(0.5 0.1 20)');
    const [, l, c, h] = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(convertToOklch('#3b82f6'))!.map(Number);
    assert.ok(Math.abs(l - 0.623) < 0.002 && Math.abs(c - 0.188) < 0.002 && Math.abs(h - 259.8) < 0.5, `${l} ${c} ${h}`);
    assert.equal(convertToOklch('rgb(59, 130, 246)'), convertToOklch('#3b82f6'));
});

test('generatePalette : onze nuances, teinte conservée, gris sans saturation', () => {
    const palette = generatePalette('#b45309');
    assert.deepEqual(Object.keys(palette).map(Number), [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    const hue = /oklch\(\S+ \S+ (\S+)\)/.exec(convertToOklch('#b45309'))![1];
    assert.equal(palette[500], `oklch(0.68270588235294 0.17009090909091 ${hue})`);
    assert.match(generatePalette('#808080')[500], /^oklch\(0\.68270588235294 0 /);
});

test('ColorManager : les couleurs d\'une requête ne débordent pas sur les autres', async () => {
    const manager = new ColorManager().register({ primary: Color.Blue });
    const base = manager.getComponentClasses('button', 'primary');
    const seen: Record<string, string | undefined> = {};
    await Promise.all([
        manager.runWith('a', { primary: Color.Emerald }, async () => { await new Promise((r) => setTimeout(r, 10)); seen.a = manager.getColor('primary')?.[500]; assert.match(manager.renderCssVariables(), new RegExp(Color.Emerald[500].replace(/[().]/g, '\\$&'))); }),
        manager.runWith('b', { primary: '#b45309' }, async () => { seen.b = manager.getColor('primary')?.[500]; manager.getComponentClasses('button', 'primary'); }),
    ]);
    assert.equal(seen.a, Color.Emerald[500]);
    assert.match(seen.b!, /^oklch\(0\.68270588235294 0\.17009090909091 /);
    assert.equal(manager.getColor('primary')?.[500], Color.Blue[500]);
    assert.deepEqual(manager.getComponentClasses('button', 'primary'), base);
});
