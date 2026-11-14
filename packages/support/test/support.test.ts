import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Attributes, Color, ColorManager, buttonColorMap, calculateContrastRatio, cls, convertToRgb, icon, js } from '../src/index.ts';
import { t } from '../src/i18n.ts';

test('js() escapes quotes and HTML characters inside JS literals', () => {
    assert.equal(js('ZczZ6KkwpBLnHFh5KNQu'), "'ZczZ6KkwpBLnHFh5KNQu'");
    assert.equal(
        js({ key: 'form.email', exposedMethods: [], path: 'data.email', containerPath: 'data' }),
        "JSON.parse('{\\u0022key\\u0022:\\u0022form.email\\u0022,\\u0022exposedMethods\\u0022:[],\\u0022path\\u0022:\\u0022data.email\\u0022,\\u0022containerPath\\u0022:\\u0022data\\u0022}')",
    );
    assert.equal(js(null), 'null');
    assert.equal(js("l'id<"), "'l\\u0027id\\u003C'");
});

test('Attributes: merge puts defaults first, class() appends, true becomes the attribute name', () => {
    const a = new Attributes().grid({}).merge({ 'x-data': 'x', hidden: null }).class(['nv-sc', { 'nv-inline': false }, 'nv-sc-has-gap']);
    assert.equal(a.toHtml(), 'x-data="x" class="nv-grid nv-sc nv-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));"');
    assert.equal(new Attributes().merge({ autofocus: true, disabled: false, id: 'form.email', 'wire:model': 'data.email' }).class(['nv-input']).toHtml(), 'autofocus="autofocus" id="form.email" wire:model="data.email" class="nv-input"');
    assert.equal(new Attributes().gridColumn({ default: 1 }, true).toHtml(), 'class="nv-grid-col nv-hidden" style="--col-span-default: span 1 / span 1;"');
    assert.equal(cls(['a', { b: true, c: false }, null, 'd']), 'a b d');
});

test('colors: oklch to rgb conversion and contrast (2.2 gamma formula)', () => {
    assert.deepEqual(convertToRgb('oklch(1 0 0)'), [255, 255, 255]);
    assert.deepEqual(convertToRgb('#fff'), [255, 255, 255]);
    assert.equal(Math.round(calculateContrastRatio('oklch(1 0 0)', 'rgb(0, 0, 0)')), 21);
});

test('filled button: color classes for primary = Blue, none for gray', () => {
    const classes = new ColorManager().register({ primary: Color.Blue }).getComponentClasses('button', 'primary').join(' ');
    assert.equal(classes, 'nv-color nv-color-primary nv-bg-color-600 hover:nv-bg-color-500 dark:nv-bg-color-600 dark:hover:nv-bg-color-500 nv-text-color-0 hover:nv-text-color-0 dark:nv-text-color-0 dark:hover:nv-text-color-0');
    assert.deepEqual(new ColorManager().getComponentClasses('button', 'gray'), []);
    // Amber (default primary): light 400 background with dark text.
    assert.equal(buttonColorMap(Color.Amber).bg, 400);
    assert.ok(buttonColorMap(Color.Amber).text >= 800);
});

test('Heroicons icon and translations', () => {
    assert.match(icon('m-eye'), /^<svg class="nv-icon nv-size-md" xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">/);
    assert.equal(t('navette-panels::auth/pages/login.form.email.label'), 'Email address');
    assert.equal(t('navette-panels::auth/pages/login.form.email.label', {}, 'fr'), 'Adresse e-mail');
    assert.equal(t('navette-panels::auth/pages/login.messages.failed'), 'These credentials do not match our records.');
});

test('diffForHumans() is localized, keeps the rounding rules and handles the future', async () => {
    const { diffForHumans, localeDirection, setLocale } = await import('../src/i18n.ts');
    const now = new Date('2026-11-14T12:00:00Z');
    assert.equal(diffForHumans('2026-11-14 11:59:30', now), '30 seconds ago');
    assert.equal(diffForHumans('2026-11-11 12:00:00', now), '3 days ago');
    assert.equal(diffForHumans('2026-10-20 12:00:00', now), '3 weeks ago');
    assert.equal(diffForHumans('2026-09-15 12:00:00', now), '1 month ago');
    assert.equal(diffForHumans('2024-11-14 12:00:00', now), '2 years ago');
    assert.equal(diffForHumans(now, now), '0 seconds ago');
    assert.equal(diffForHumans('2026-11-14T14:01:00Z', now), 'in 2 hours');
    assert.equal(diffForHumans('', now), null);
    assert.equal(diffForHumans('2026-09-10 10:00:00', now, 'fr'), 'il y a 2 mois');
    setLocale('fr');
    try {
        assert.equal(diffForHumans('2026-11-11 12:00:00', now), 'il y a 3 jours');
        assert.equal(diffForHumans('2026-11-17 13:00:00', now), 'dans 3 jours');
    } finally { setLocale('en'); }
    assert.equal(diffForHumans('2026-11-11 12:00:00', now, 'pt_BR'), 'há 3 dias');
    assert.equal(localeDirection('ar'), 'rtl');
    assert.equal(localeDirection('he_IL'), 'rtl');
    assert.equal(localeDirection('fr'), 'ltr');
    assert.equal(localeDirection('not a locale'), 'ltr');
});
