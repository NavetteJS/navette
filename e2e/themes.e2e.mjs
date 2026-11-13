// Themes: picked from the user menu, kept across pages, unknown themes refused.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import { login, reporter, specArgs } from './support.mjs';

const { base, user } = specArgs();
const { check: step, fail, exitCode } = reporter();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
    await login(page, base, user);
    await page.goto(base + '/shop/customers');
    const primary = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary-500').trim());
    const before = await primary();
    step((await page.locator('.nv-theme-list [data-theme]').count()) === 5, 'the menu offers the five themes');
    step((await page.locator('.nv-theme-list [aria-checked=true]').getAttribute('data-theme')) === 'navette', 'the default theme is checked');
    await page.click('.fi-user-menu-trigger');
    await Promise.all([page.waitForLoadState('load'), page.waitForResponse((r) => r.url().includes('/livewire') && r.request().method() === 'POST'), page.click('.nv-theme-list [data-theme=alpage]')]);
    await page.waitForFunction((b) => getComputedStyle(document.documentElement).getPropertyValue('--primary-500').trim() !== b, before);
    const after = await primary();
    step(after !== before && page.url().endsWith('/shop/customers'), 'the Meadow theme (alpage) changes the primary color, on the same page', `${before} → ${after}`);
    step((await page.locator('.nv-theme-list [aria-checked=true]').getAttribute('data-theme')) === 'alpage', 'Meadow is checked');
    await page.goto(base + '/shop/orders');
    step((await primary()) === after, 'the theme is kept from one page to the next');
    await page.click('.fi-user-menu-trigger');
    await page.click('.nv-theme-list [data-theme=crepuscule]');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--font-family').includes('Outfit'));
    step(true, 'the Dusk theme (crepuscule) brings its font');
    await page.click('.fi-user-menu-trigger');
    await page.click('.nv-theme-list [data-theme=cuivre]');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--primary-500').includes('0.68270588235294'));
    step(true, 'the Copper theme (cuivre) uses a palette generated from one color');
    // Forged cookie: unknown theme → default theme.
    await page.context().addCookies([{ name: 'navette_admin_theme', value: 'x"><script>', url: base }]);
    await page.goto(base + '/shop/customers');
    step((await primary()) === before, 'an unknown theme cookie falls back to the default theme');
    const status = await page.evaluate(async () => { try { await window.Livewire.all().find((c) => c.name.includes('sidebar') || c.el.querySelector('.fi-user-menu')).$wire.setTheme('unknown'); return 'accepted'; } catch (e) { return 'refused'; } });
    await page.goto(base + '/shop/customers');
    step((await primary()) === before, 'setTheme refuses a theme that is not declared', status);
} catch (error) {
    fail(`spec stopped: ${String(error?.message ?? error).split('\n')[0]}`);
} finally {
    await browser.close();
}
process.exit(exitCode());
