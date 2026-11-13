// Session shared by the demo's `/app` and `/admin` panels: one sign-in serves both, `canAccess()` decides who enters `/admin`.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { reporter, specArgs } from './support.mjs';

const { base, user } = specArgs();
const { step, exitCode } = reporter({ errorLines: 3 });
const browser = await chromium.launch();
const signIn = async (page, panelPath, email, password) => {
    await page.goto(`${base}${panelPath}/login`);
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.locator('button[type=submit]').click();
};
const sessionCookies = async (context) => (await context.cookies()).map((cookie) => cookie.name).filter((name) => name.endsWith('_session'));

try {
    const staff = await browser.newContext();
    const staffPage = await staff.newPage();
    await step('the demo account signs in on /app, then opens /admin without signing in again', async () => {
        await signIn(staffPage, '/app', user.email, user.password);
        await staffPage.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10000 });
        assert.equal((await staffPage.goto(`${base}/`)).status(), 200);
        assert.ok(!staffPage.url().endsWith('/login'), staffPage.url());
        assert.ok(await staffPage.locator('.fi-sidebar-nav').count());
        assert.deepEqual(await sessionCookies(staff), ['navette_web_session']);
    });
    await step('signing out of /admin also signs out of /app', async () => {
        const token = await staffPage.locator('meta[name=csrf-token]').getAttribute('content');
        await staffPage.evaluate(async (csrf) => {
            await fetch('/logout', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `_token=${encodeURIComponent(csrf)}` });
        }, token);
        await staffPage.goto(`${base}/app`);
        assert.match(staffPage.url(), /\/app\/login$/);
    });

    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    const email = `customer-${Date.now()}@example.test`;
    await step('a customer who signed up on /app gets 403 on /admin, its login page included', async () => {
        await customerPage.goto(`${base}/app/register`);
        await customerPage.locator('[id="form.name"]').fill('Test Customer');
        await customerPage.locator('[id="form.email"]').fill(email);
        await customerPage.locator('[id="form.password"]').fill('customer-password-1');
        await customerPage.locator('[id="form.passwordConfirmation"]').fill('customer-password-1');
        await customerPage.locator('button[type=submit]').click();
        await customerPage.waitForURL((url) => !url.pathname.endsWith('/register'), { timeout: 10000 });
        for (const path of ['/', '/shop/customers', '/login']) assert.equal((await customerPage.goto(`${base}${path}`)).status(), 403, path);
    });

    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await step('the customer cannot sign in on /admin: same message as a wrong password, no session', async () => {
        await signIn(freshPage, '', email, 'customer-password-1');
        await freshPage.locator('.fi-fo-field-wrp-error-message').first().waitFor({ timeout: 8000 });
        assert.match(await freshPage.locator('.fi-fo-field-wrp-error-message').first().innerText(), /do not match/);
        assert.deepEqual(await sessionCookies(fresh), []);
    });
} finally {
    await browser.close();
}
process.exit(exitCode());
