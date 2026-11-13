// Multi-factor authentication on the demo's `/app` panel: authenticator app (TOTP, recovery codes) and security keys
// (WebAuthn, with Chromium's virtual authenticator). Run by e2e/run.mjs, on a throwaway copy of the database.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { openDatabase, reporter, specArgs } from './support.mjs';
import { totpCode } from '../packages/panels/src/totp.ts';

const { base, dbFile } = specArgs();
const { step, exitCode } = reporter({ errorLines: 3 });
const browser = await chromium.launch();
const email = `mfa-${Date.now()}@example.test`;
const password = 'mfa-password-123';
let secret = null;
let recoveryCodes = [];

const modal = (page) => page.locator('.fi-modal.fi-modal-open .fi-modal-window');
const typeCode = async (page, scope, code) => {
    await scope.locator('.fi-one-time-code-input-digit').first().click();
    await page.keyboard.type(code);
};
const signIn = async (page, origin = base) => {
    await page.goto(`${origin}/app/login`);
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.locator('button[type=submit]').first().click();
};
const signOut = async (page) => {
    const token = await page.locator('meta[name=csrf-token]').getAttribute('content');
    await page.evaluate(async (csrf) => {
        await fetch('/app/logout', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `_token=${encodeURIComponent(csrf)}` });
    }, token);
};
const signedIn = async (page) => page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10000 });
// A code for a time step the server has not accepted yet (codes are single use).
let lastStep = 0;
const freshCode = async () => {
    for (;;) {
        const step = Math.floor(Date.now() / 30000);
        if (step > lastStep) { lastStep = step; return totpCode(secret); }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
};

try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await step('a new account opens its profile: both providers are offered, disabled', async () => {
        await page.goto(`${base}/app/register`);
        await page.locator('[id="form.name"]').fill('MFA User');
        await page.locator('[id="form.email"]').fill(email);
        await page.locator('[id="form.password"]').fill(password);
        await page.locator('[id="form.passwordConfirmation"]').fill(password);
        await page.locator('button[type=submit]').click();
        await page.waitForURL((url) => !url.pathname.endsWith('/register'), { timeout: 10000 });
        const db = openDatabase(dbFile);
        db.prepare("update users set email_verified_at = datetime('now') where email = ?").run(email);
        db.close();
        await page.goto(`${base}/app/profile`);
        const text = await page.locator('.fi-section.fi-divided').innerText();
        assert.match(text, /Authenticator app\s*Disabled/);
        assert.match(text, /Security keys\s*Disabled/);
    });

    await step('setting up the authenticator app: QR code, wrong then right code, password, recovery codes', async () => {
        await page.getByText('Set up', { exact: true }).click();
        await modal(page).waitFor();
        const qr = modal(page).locator('img.fi-sc-image, .fi-sc-image img, img[src^="data:image/svg+xml"]').first();
        assert.match(await qr.getAttribute('src'), /^data:image\/svg\+xml;base64,/);
        secret = (await modal(page).locator('.fi-font-mono.fi-copyable').innerText()).trim();
        assert.match(secret, /^[A-Z2-7]{32}$/);
        await typeCode(page, modal(page), '000000');
        await modal(page).locator('input[type=password]').fill(password);
        await modal(page).getByRole('button', { name: 'Next' }).click();
        await modal(page).locator('.fi-fo-field-wrp-error-message').first().waitFor();
        assert.match(await modal(page).innerText(), /The code you entered is invalid/);
        await modal(page).locator('.fi-one-time-code-input-digit').first().click();
        for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
        await typeCode(page, modal(page), totpCode(secret));
        await modal(page).getByRole('button', { name: 'Next' }).click();
        await modal(page).getByText(/save the following recovery codes/).waitFor();
        recoveryCodes = await modal(page).locator('.fi-sc-unordered-list .fi-font-mono').allInnerTexts();
        assert.equal(recoveryCodes.length, 8);
        await modal(page).getByRole('button', { name: 'Enable authenticator app' }).click();
        await page.getByText('Authenticator app has been enabled').waitFor();
        await page.locator('.fi-section.fi-divided').getByText('Enabled').first().waitFor();
        const row = openDatabase(dbFile).prepare('select app_authentication_secret as secret, app_authentication_recovery_codes as codes from users where email = ?').get(email);
        assert.match(row.secret, /^enc:v1:/, 'the secret is encrypted at rest');
        assert.ok(!row.secret.includes(secret));
        assert.ok(!row.codes.includes(recoveryCodes[0]), 'recovery codes are hashed');
    });

    const fresh = await browser.newContext();
    const login = await fresh.newPage();
    await step('signing in asks for a code: a wrong code is refused, the right one signs in', async () => {
        await signOut(page);
        await signIn(login);
        await login.getByRole('heading', { name: 'Verify your identity' }).waitFor();
        await typeCode(login, login.locator('#multiFactorChallengeForm'), '123456');
        await login.locator('.fi-fo-field-wrp-error-message').first().waitFor();
        assert.match(await login.locator('.fi-fo-field-wrp-error-message').first().innerText(), /code you entered is invalid/);
        assert.deepEqual((await fresh.cookies()).filter((cookie) => cookie.name.endsWith('_session')), [], 'no session before the second factor');
        await login.locator('.fi-one-time-code-input-digit').first().click();
        for (let i = 0; i < 6; i++) await login.keyboard.press('Backspace');
        await typeCode(login, login.locator('#multiFactorChallengeForm'), await freshCode());
        await signedIn(login);
        assert.ok((await fresh.cookies()).some((cookie) => cookie.name.endsWith('_session')));
    });

    await step('a recovery code signs in once', async () => {
        await signOut(login);
        await signIn(login);
        await login.getByText('Use a recovery code instead').click();
        // An empty recovery code is refused: the code field is hidden, the recovery code becomes required.
        // Called on the server directly: the browser would block the empty required field itself.
        await login.evaluate(() => window.Livewire.all().find((component) => component.name.endsWith('.auth.login')).$wire.authenticate());
        await login.locator('.fi-fo-field-wrp-error-message').first().waitFor();
        assert.match(await login.locator('.fi-fo-field-wrp-error-message').first().innerText(), /required/);
        assert.ok(login.url().endsWith('/login'));
        await login.locator('input[type=password]').last().fill(recoveryCodes[0]);
        await login.getByRole('button', { name: 'Confirm sign in' }).click();
        await signedIn(login);
        await signOut(login);
        await signIn(login);
        await login.getByText('Use a recovery code instead').click();
        await login.locator('input[type=password]').last().fill(recoveryCodes[0]);
        await login.getByRole('button', { name: 'Confirm sign in' }).click();
        await login.getByText('The recovery code you entered is invalid.').waitFor();
    });

    // WebAuthn needs a domain: an IP address (127.0.0.1) is not a valid relying party id, so these steps use localhost.
    const keyOrigin = base.replace('127.0.0.1', 'localhost');
    const keyContext = await browser.newContext();
    const keyPage = await keyContext.newPage();
    await step('adding a security key with the browser ceremony', async () => {
        const page = keyPage;
        const cdp = await keyContext.newCDPSession(page);
        await cdp.send('WebAuthn.enable');
        await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'usb', hasResidentKey: false, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
        await signIn(page, keyOrigin);
        await typeCode(page, page.locator('#multiFactorChallengeForm'), await freshCode());
        await signedIn(page);
        await page.goto(`${keyOrigin}/app/profile`);
        await page.getByText('Add a security key').click();
        await modal(page).waitFor();
        await modal(page).locator('input[type=text]').first().fill('Test key');
        await modal(page).getByRole('button', { name: 'Use my security key' }).click();
        await modal(page).getByText('Security key ready').waitFor();
        await modal(page).locator('input[type=password]').fill(password);
        await modal(page).getByRole('button', { name: 'Add security key' }).click();
        await page.getByText('Security key added').waitFor();
        await page.locator('.nv-security-key-name', { hasText: 'Test key' }).waitFor();
        assert.equal(openDatabase(dbFile).prepare('select count(*) as n from security_keys').get().n, 1);
        await signOut(page);
        // The same browser signs in with the key: the picker offers both providers.
        await signIn(page, keyOrigin);
        await page.getByRole('heading', { name: 'Verify your identity' }).waitFor();
        await page.getByLabel('Use a security key').check();
        await signedIn(page);
    });

    await step('removing the key and turning the app off bring sign-in back to the password alone', async () => {
        const page = keyPage;
        await page.goto(`${keyOrigin}/app/profile`);
        await page.getByText('Remove a key').click();
        await modal(page).getByLabel('Test key').check();
        await modal(page).locator('input[type=password]').fill(password);
        await modal(page).getByRole('button', { name: 'Remove key' }).click();
        await page.getByText('Security key removed').waitFor();
        await page.getByText('Turn off').click();
        await typeCode(page, modal(page), await freshCode());
        await modal(page).locator('input[type=password]').fill(password);
        await modal(page).getByRole('button', { name: 'Disable authenticator app' }).click();
        await page.getByText('Authenticator app has been disabled').waitFor();
        await signOut(page);
        await signIn(page, keyOrigin);
        await signedIn(page);
    });
} finally {
    await browser.close();
}
process.exit(exitCode());
