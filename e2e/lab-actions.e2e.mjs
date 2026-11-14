// Action features of the lab panel (`/lab/actions`): JavaScript actions, links opening an action (and forged links being
// refused), rate limits, policy messages as tooltip or notification, modal options and nested actions.
// Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, reporter, specArgs } from './support.mjs';

const { base: BASE, user } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 3 });
const notification = (title) => page.locator('.nv-no-notification-title', { hasText: title });
const openModal = () => page.locator('.nv-modal.nv-modal-open');
const header = (label) => page.locator('.nv-header .nv-ac-btn-action', { hasText: label });
let livewireRequests = 0;
page.on('request', (request) => { if (request.url().includes('/livewire')) livewireRequests++; });
const settle = () => page.waitForTimeout(400);

await login(page, BASE, user);
try {
    await page.goto(`${BASE}/lab/actions`);
    await page.locator('h1.nv-header-heading', { hasText: 'Actions' }).waitFor();

    await step('actionJs(): the slug is generated in the browser, without any request; verticalAlignment() aligns the actions', async () => {
        await page.locator('input[id$="title"]').fill('Hello World');
        await settle();
        const before = livewireRequests;
        await page.locator('[data-cy="generate-slug"]').click();
        assert.equal(await page.locator('input[id$="slug"]').inputValue(), 'hello-world');
        await settle();
        assert.equal(livewireRequests, before, 'no request was sent');
        assert.equal(await page.locator('.nv-sc-actions.nv-vertical-align-end').count(), 1);
    });

    await step('a link opens an action with its arguments once loaded; closing it removes the parameters from the URL', async () => {
        await page.goto(`${BASE}/lab/actions?action=feedback&actionArguments[topic]=billing`);
        await openModal().locator('.nv-modal-heading', { hasText: 'Feedback about billing' }).waitFor();
        await openModal().locator('input').first().fill('Invoices are late');
        await openModal().getByRole('button', { name: 'Submit' }).click();
        await notification('Thanks for your feedback').waitFor();
        assert.match(await page.locator('.nv-no-notification-body', { hasText: 'billing' }).first().innerText(), /billing: Invoices are late/);
        await page.waitForFunction(() => !window.location.search.includes('action='));
        await page.reload();
        await page.locator('h1.nv-header-heading').waitFor();
        await settle();
        assert.equal(await openModal().count(), 0, 'the action does not reopen');
    });

    await step('forged links: an unauthorized action does not open, an action without a modal does not run', async () => {
        await page.goto(`${BASE}/lab/actions?action=hiddenAction`);
        await page.locator('h1.nv-header-heading').waitFor();
        await page.waitForTimeout(800);
        assert.equal(await openModal().count(), 0);
        await page.goto(`${BASE}/lab/actions?action=ping`);
        await page.locator('h1.nv-header-heading').waitFor();
        await page.waitForTimeout(800);
        assert.equal(await notification('Pong').count(), 0, 'the modal-less action was not run');
        await page.goto(`${BASE}/lab/actions?action=lockedAction`);
        await page.waitForTimeout(800);
        assert.equal(await openModal().count(), 0);
    });

    await step('rateLimit(2): the third click within a minute is refused by the server, with the custom title', async () => {
        await page.goto(`${BASE}/lab/actions`);
        await header('Ping').waitFor();
        for (let i = 0; i < 3; i++) { await header('Ping').click(); await settle(); }
        await notification('Slow down!').waitFor();
        assert.equal(await notification('Pong').count(), 2);
        assert.match(await page.locator('.nv-no-notification-body', { hasText: 'seconds' }).first().innerText(), /Please try again in \d+ seconds\./);
    });

    await step('authorizationTooltip(): disabled with the denial message; authorizationNotification(): the click sends it; no message: hidden', async () => {
        await page.goto(`${BASE}/lab/actions`);
        const trigger = page.locator('.nv-header .nv-ac-btn-group', { hasText: 'Restricted' });
        await trigger.click();
        const panel = page.locator('.nv-dropdown-panel:visible');
        await panel.waitFor();
        assert.match(await page.locator('[x-float\\.placement\\.auto-placement\\.teleport\\.offset]').first().getAttribute('class'), /nv-dropdown-panel nv-scrollable/);
        const locked = panel.locator('.nv-dropdown-list-item', { hasText: 'Archive (locked)' });
        assert.equal(await locked.getAttribute('aria-disabled'), 'true');
        await locked.hover();
        await page.locator('.tippy-box', { hasText: 'Archiving is locked during the demo.' }).waitFor();
        assert.equal(await panel.locator('.nv-dropdown-list-item', { hasText: 'Hidden' }).count(), 0);
        await panel.locator('.nv-dropdown-list-item', { hasText: 'Export (restricted)' }).click();
        await notification('Exports need the admin role.').waitFor();
        assert.equal(await notification('Exported').count(), 0);
    });

    await step('modal options: eyebrow, custom content with a registered action overlaying the modal, content footer, slide-over from the start', async () => {
        await page.goto(`${BASE}/lab/actions`);
        await header('Advance order').click();
        const modal = openModal();
        await modal.locator('.nv-modal-eyebrow', { hasText: 'Order workflow' }).waitFor();
        assert.match(await modal.getAttribute('class'), /nv-modal-slide-over-from-start/);
        assert.equal(await modal.locator('[data-cy="advance-window"].nv-modal-window').count(), 1);
        assert.equal(await modal.locator('[data-cy="advance-content"]').count(), 1);
        assert.equal(await modal.locator('[data-cy="advance-footer"]').count(), 1);
        assert.match(await modal.locator('.nv-modal-icon-bg').getAttribute('class'), /nv-color-info/);
        await modal.locator('[data-cy="advance-report"] button', { hasText: 'Report a problem' }).click();
        await page.locator('.nv-modal.nv-modal-open .nv-modal-heading', { hasText: 'Report a problem' }).waitFor();
        assert.equal(await page.locator('.nv-modal.nv-modal-open').count(), 2, 'the confirmation overlays the slide-over');
        await page.locator('.nv-modal.nv-modal-open').last().getByRole('button', { name: 'Confirm' }).click();
        await notification('Problem reported').waitFor();
        await page.waitForFunction(() => document.querySelectorAll('.nv-modal.nv-modal-open').length === 1);
        await openModal().getByRole('button', { name: 'Advance' }).click();
        await notification('Order advanced').waitFor();
    });

    await step('nested actions: fillData() on the parent, makeModalSubmitAction() arguments, cancelParentActionsOnClose()', async () => {
        await page.goto(`${BASE}/lab/actions`);
        await header('Write a note').click();
        await openModal().locator('.nv-modal-heading', { hasText: 'Write a note' }).waitFor();
        await openModal().getByRole('button', { name: 'Use template' }).click();
        await page.waitForFunction(() => document.querySelector('.nv-modal.nv-modal-open input')?.value === 'Call the customer back.');
        await openModal().getByRole('button', { name: 'Save as draft' }).click();
        await notification('Draft saved').waitFor();
        await page.waitForFunction(() => !document.querySelector('.nv-modal.nv-modal-open'));

        await header('Write a note').click();
        await openModal().locator('input').first().fill('Temporary');
        await openModal().getByRole('button', { name: 'Discard' }).click();
        await page.locator('.nv-modal.nv-modal-open .nv-modal-heading', { hasText: 'Discard' }).waitFor();
        // Closing the child's confirmation also cancels the parent.
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.nv-modal.nv-modal-open'));
        await settle();
        assert.equal(await openModal().count(), 0);
    });

    await step('modalClickThrough(): no backdrop, the page behind stays usable', async () => {
        await page.goto(`${BASE}/lab/actions`);
        await header('Peek').click();
        const modal = openModal();
        await modal.locator('.nv-modal-heading', { hasText: 'Peek' }).waitFor();
        assert.equal(await modal.getAttribute('aria-modal'), 'false');
        assert.equal(await page.locator('[data-cy="peek-overlay"]').count(), 0);
        await page.locator('input[id$="title"]').fill('Typed behind the modal');
        assert.equal(await page.locator('input[id$="title"]').inputValue(), 'Typed behind the modal');
        await modal.locator('.nv-modal-footer .nv-btn', { hasText: 'Close' }).click();
        await page.waitForFunction(() => !document.querySelector('.nv-modal.nv-modal-open'));
    });

    await step('no JavaScript errors', async () => {
        assert.deepEqual(errors, []);
    });
} finally {
    await browser.close();
}
process.exit(exitCode());
