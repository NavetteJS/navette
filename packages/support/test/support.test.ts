import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Attributes, Color, ColorManager, buttonColorMap, calculateContrastRatio, cls, convertToRgb, icon, js } from '../src/index.ts';
import { t } from '../src/i18n.ts';

test('js() reproduit Js::from de Laravel (valeurs relevées dans le HTML réel de Filament)', () => {
    assert.equal(js('ZczZ6KkwpBLnHFh5KNQu'), "'ZczZ6KkwpBLnHFh5KNQu'");
    assert.equal(
        js({ key: 'form.email', exposedMethods: [], path: 'data.email', containerPath: 'data' }),
        "JSON.parse('{\\u0022key\\u0022:\\u0022form.email\\u0022,\\u0022exposedMethods\\u0022:[],\\u0022path\\u0022:\\u0022data.email\\u0022,\\u0022containerPath\\u0022:\\u0022data\\u0022}')",
    );
    assert.equal(js(null), 'null');
    assert.equal(js("l'id<"), "'l\\u0027id\\u003C'");
});

test('Attributes : merge place les défauts en premier, class() ajoute en fin, true devient le nom de l\'attribut', () => {
    const a = new Attributes().grid({}).merge({ 'x-data': 'x', hidden: null }).class(['fi-sc', { 'fi-inline': false }, 'fi-sc-has-gap']);
    assert.equal(a.toHtml(), 'x-data="x" class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));"');
    assert.equal(new Attributes().merge({ autofocus: true, disabled: false, id: 'form.email', 'wire:model': 'data.email' }).class(['fi-input']).toHtml(), 'autofocus="autofocus" id="form.email" wire:model="data.email" class="fi-input"');
    assert.equal(new Attributes().gridColumn({ default: 1 }, true).toHtml(), 'class="fi-grid-col fi-hidden" style="--col-span-default: span 1 / span 1;"');
    assert.equal(cls(['a', { b: true, c: false }, null, 'd']), 'a b d');
});

test('couleurs : conversion oklch → rgb et contraste (formule gamma 2,2 de Filament)', () => {
    assert.deepEqual(convertToRgb('oklch(1 0 0)'), [255, 255, 255]);
    assert.deepEqual(convertToRgb('#fff'), [255, 255, 255]);
    assert.equal(Math.round(calculateContrastRatio('oklch(1 0 0)', 'rgb(0, 0, 0)')), 21);
});

test('bouton plein : classes identiques à celles relevées sur le vrai Filament (primary = Blue)', () => {
    const classes = new ColorManager().register({ primary: Color.Blue }).getComponentClasses('button', 'primary').join(' ');
    assert.equal(classes, 'fi-color fi-color-primary fi-bg-color-600 hover:fi-bg-color-500 dark:fi-bg-color-600 dark:hover:fi-bg-color-500 fi-text-color-0 hover:fi-text-color-0 dark:fi-text-color-0 dark:hover:fi-text-color-0');
    assert.deepEqual(new ColorManager().getComponentClasses('button', 'gray'), []);
    // Amber (primary par défaut) : fond clair 400 et texte foncé, comme documenté dans la KB.
    assert.equal(buttonColorMap(Color.Amber).bg, 400);
    assert.ok(buttonColorMap(Color.Amber).text >= 800);
});

test('icône Heroicons et traductions', () => {
    assert.match(icon('m-eye'), /^<svg class="fi-icon fi-size-md" xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">/);
    assert.equal(t('filament-panels::auth/pages/login.form.email.label'), 'Email address');
    assert.equal(t('filament-panels::auth/pages/login.form.email.label', {}, 'fr'), 'Adresse e-mail');
    assert.equal(t('filament-panels::auth/pages/login.messages.failed'), 'These credentials do not match our records.');
});
