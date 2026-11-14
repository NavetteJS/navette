import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ButtonComponentColorMap, Color, ColorManager, ComponentColorMap, IconButtonComponentColorMap, WCAG_AA_NON_TEXT, WCAG_AAA_TEXT, buttonColorMap, iconButtonColorMap } from '../src/index.ts';

afterEach(() => { ColorManager.overrideColorMap('button', null); ColorManager.overrideColorMap('badge', null); });

test('the builders reproduce the default maps', () => {
    for (const palette of [Color.Blue, Color.Amber, Color.Yellow, Color.Zinc, Color.Lime]) {
        assert.deepEqual(ButtonComponentColorMap.make(palette).lightBackground(600, 500).lightBackground(400, 300, 500).darkBackground(600, 500, 700).get(), buttonColorMap(palette));
        assert.deepEqual(IconButtonComponentColorMap.make(palette).lightSurface(Color.Zinc[50]).darkSurface(Color.Zinc[700]).get(), iconButtonColorMap(palette, Color.Zinc));
    }
    const badge = ComponentColorMap.make(Color.Blue)
        .slot('text', { surface: Color.Blue[50] })
        .slot('dark:text', { surface: Color.Zinc[600], maxShade: 500, shouldStartFromDarkest: true, fallback: 200 })
        .get();
    const classes = new ColorManager().register({ x: Color.Blue }).getComponentClasses('badge', 'x');
    assert.ok(classes.includes(`fi-text-color-${badge.text}`) && classes.includes(`dark:fi-text-color-${badge['dark:text']}`), classes.join(' '));
    assert.equal(WCAG_AA_NON_TEXT, 3);
    assert.equal(WCAG_AAA_TEXT, 7);
});

test('the builders check their configuration', () => {
    assert.throws(() => ButtonComponentColorMap.make(Color.Blue).darkBackground(600, 500).get(), /lightBackground/);
    assert.throws(() => ButtonComponentColorMap.make(Color.Blue).lightBackground(600, 500).get(), /darkBackground/);
    assert.throws(() => IconButtonComponentColorMap.make(Color.Blue).darkSurface('oklch(0 0 0)').get(), /lightSurface/);
});

test('overrideColorMap() changes the classes of a component in every color manager', () => {
    const colors = new ColorManager();
    const before = colors.getComponentClasses('button', 'primary');
    const dangerBefore = colors.getComponentClasses('button', 'danger');
    assert.ok(before.includes('fi-bg-color-400'), 'amber: pale background by default');
    ColorManager.overrideColorMap('button', (palette, { color, getDefault }) => (color === 'danger' ? getDefault() : ButtonComponentColorMap.make(palette)
        .minContrastRatio(WCAG_AAA_TEXT)
        .lightBackground(800, 700)
        .lightBackground(400, 300, 500)
        .darkBackground(600, 500, 700)
        .get()));
    const after = colors.getComponentClasses('button', 'primary');
    assert.notDeepEqual(after, before, 'the cache is invalidated');
    assert.ok(after.includes('fi-bg-color-800'), after.join(' '));
    assert.deepEqual(colors.getComponentClasses('button', 'danger'), dangerBefore, 'getDefault() keeps the default map');
    // Other components keep their default maps.
    assert.deepEqual(colors.getComponentClasses('badge', 'primary'), new ColorManager().getComponentClasses('badge', 'primary'));
    ColorManager.overrideColorMap('button', null);
    assert.deepEqual(colors.getComponentClasses('button', 'primary'), before);
});

test('overrideColorMap() refuses unknown components, slots and shades', () => {
    assert.throws(() => ColorManager.overrideColorMap('card' as any, () => ({})), /Unknown colored component/);
    ColorManager.overrideColorMap('badge', () => ({ border: 500 }));
    assert.throws(() => new ColorManager().getComponentClasses('badge', 'info'), /Invalid color mapping key \[border\]/);
    ColorManager.overrideColorMap('badge', () => ({ text: 550.5 }));
    assert.throws(() => new ColorManager().getComponentClasses('badge', 'info'), /Invalid shade/);
    ColorManager.overrideColorMap('badge', () => ComponentColorMap.make(Color.Blue).slot('text', { surface: 'oklch(1 0 0)', minRatio: WCAG_AAA_TEXT }).get());
    assert.ok(new ColorManager().getComponentClasses('badge', 'info').some((c) => /^fi-text-color-\d+$/.test(c)));
});
