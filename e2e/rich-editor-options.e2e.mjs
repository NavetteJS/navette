// Rich editor options on the lab panel's "Rich editor options" page: dropdown groups of toolbar buttons, floating toolbars,
// sticky toolbar and panels, height, a plugin's buttons, link protocols checked on the server, and private image attachments
// (a temporary preview while editing, a `data-id` without URL in the database, signed temporary URLs when loaded).
// Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile);
const editor = () => page.locator('[data-rich-editor-key="form.description"]');
const content = () => editor().locator('.tiptap[contenteditable="true"]');
const tool = (name) => editor().locator(`[data-rich-editor-tool="${name}"]`);
const modal = () => page.locator('.fi-modal.fi-modal-open .fi-modal-window');
const name = `Rich options ${Date.now()}`;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };

await login(page, BASE, user);
try {
    await step('the toolbar holds dropdown groups, and the plugin adds its buttons (strike removed)', async () => {
        await page.goto(`${BASE}/lab/rich-editor-options/create`);
        await content().waitFor({ timeout: 15000 });
        assert.equal(await tool('Heading').count(), 1);
        assert.equal(await tool('Alignment').count(), 1);
        assert.equal(await tool('shout').count(), 1);
        assert.equal(await tool('highlight').count(), 1);
        assert.equal(await tool('strike').count(), 0);
    });

    await step('a textual dropdown applies a heading, and its trigger becomes active', async () => {
        await page.locator('input[id="form.name"]').fill(name);
        await content().click();
        await page.keyboard.type('Big title');
        await tool('Heading').click();
        const item = editor().getByRole('menuitemcheckbox', { name: 'Heading 2' });
        await item.waitFor({ state: 'visible' });
        assert.equal(await item.locator('span').innerText(), 'Heading 2');
        await item.click();
        await content().locator('h2', { hasText: 'Big title' }).waitFor();
        await until(async () => (await tool('Heading').getAttribute('class')).includes('fi-active'), 'active Heading trigger');
        assert.equal(await editor().getByRole('menuitemcheckbox', { name: 'Heading 2' }).isVisible(), false, 'the menu closed');
    });

    await step('the paragraph floating toolbar shows on a text selection, the table one inside a table', async () => {
        await content().click();
        await page.keyboard.press('Control+End');
        await page.keyboard.press('Enter');
        await page.keyboard.type('Some words to select');
        await page.keyboard.press('Shift+Home');
        const floating = editor().locator('[x-ref="floatingToolbar::paragraph"]');
        await floating.waitFor({ state: 'visible', timeout: 5000 });
        assert.equal(await floating.locator('[data-rich-editor-tool]').count(), 3);
        await page.keyboard.press('End');
        await editor().locator('.fi-fo-rich-editor-toolbar [data-rich-editor-tool="table"]').click();
        await content().locator('table').waitFor();
        await content().locator('td').first().click();
        await editor().locator('[x-ref="floatingToolbar::table"]').waitFor({ state: 'visible', timeout: 5000 });
        assert.equal(await editor().locator('[x-ref="floatingToolbar::table"] [data-rich-editor-tool]').count(), 3);
        await editor().locator('[x-ref="floatingToolbar::table"] [data-rich-editor-tool="tableDelete"]').click();
        await until(async () => (await content().locator('table').count()) === 0, 'table deleted');
    });

    await step('height limits, sticky toolbar and sticky panels', async () => {
        const styles = await editor().evaluate((element) => {
            const wrapper = element.closest('.fi-fo-rich-editor');
            const toolbar = element.querySelector('.fi-fo-rich-editor-toolbar');
            return { style: wrapper.getAttribute('style'), position: getComputedStyle(toolbar).position, panels: element.querySelector('.fi-fo-rich-editor-panels').className };
        });
        assert.equal(styles.style, '--min-height: 8rem; --max-height: 16rem; --rich-editor-sticky-offset: 4rem;');
        assert.equal(styles.position, 'sticky');
        assert.match(styles.panels, /fi-fo-rich-editor-sticky-panels/);
        // Past 16rem, the content scrolls instead of growing.
        await content().click();
        await page.keyboard.press('Control+End');
        for (let i = 0; i < 25; i++) await page.keyboard.press('Enter');
        const box = await editor().locator('.fi-fo-rich-editor-content').boundingBox();
        assert.ok(box.height <= 16 * 16 + 2, `content height ${box.height}`);
        for (let i = 0; i < 25; i++) await page.keyboard.press('Backspace');
    });

    await step('a link with a protocol outside linkProtocols() is refused by the server; mailto: is accepted', async () => {
        await content().click();
        await page.keyboard.press('Control+End');
        await page.keyboard.press('Enter');
        await page.keyboard.type('Write to us');
        await page.keyboard.press('Shift+Home');
        await editor().locator('.fi-fo-rich-editor-toolbar [data-rich-editor-tool="link"]').click();
        await modal().waitFor();
        await modal().locator('input[id$=".url"]').fill('tel:+33100000000');
        await modal().getByRole('button', { name: /Save|Submit|Link/ }).last().click();
        await modal().getByText('must be a valid URL').waitFor({ timeout: 8000 });
        await modal().locator('input[id$=".url"]').fill('mailto:hello@example.com');
        await modal().getByRole('button', { name: /Save|Submit|Link/ }).last().click();
        await modal().waitFor({ state: 'detached', timeout: 8000 }).catch(() => modal().waitFor({ state: 'hidden', timeout: 8000 }));
        await content().locator('a[href="mailto:hello@example.com"]').waitFor({ timeout: 8000 });
    });

    await step('a pasted image is shown through a temporary preview URL, then saved as a private data-id without URL', async () => {
        await content().click();
        await page.keyboard.press('Control+End');
        await content().evaluate((element, base64) => {
            const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
            const transfer = new DataTransfer();
            transfer.items.add(new File([bytes], 'pixel.png', { type: 'image/png' }));
            element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
        }, PNG);
        const image = content().locator('img[data-id]');
        await image.waitFor({ timeout: 15000 });
        await until(async () => /\/livewire\/preview-file\/[0-9a-f]{32}\?expires=\d+&signature=[0-9a-f]{64}$/.test((await image.getAttribute('src')) ?? ''), 'preview URL');
        const preview = await page.request.get(`${BASE}${await image.getAttribute('src')}`);
        assert.equal(preview.status(), 200, 'the preview is served');
        assert.equal(preview.headers()['content-type'], 'image/png');
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        await page.waitForURL(/\/lab\/rich-editor-options\/\d+\/edit$/, { timeout: 15000 });
        const row = db.prepare('select id, description from products where name = ?').get(name);
        assert.ok(row, 'created');
        assert.match(row.description, /<img data-id="lab-rich\/[0-9a-f-]+\.png">/);
        assert.equal(/<img[^>]*src=/.test(row.description), false, 'no URL saved for a private image');
        assert.match(row.description, /<h2>Big title<\/h2>/);
        assert.match(row.description, /href="mailto:hello@example\.com"/);
    });

    await step('loaded again, the image gets a signed temporary URL; a tampered signature gets a 404', async () => {
        await page.reload();
        await content().waitFor({ timeout: 15000 });
        const image = content().locator('img[data-id]');
        await image.waitFor({ timeout: 15000 });
        const src = await image.getAttribute('src');
        assert.match(src, /^\/lab-private-attachments\/lab-rich\/[0-9a-f-]+\.png\?expires=\d+&signature=[0-9a-f]{64}$/);
        await until(() => image.evaluate((element) => element.complete && element.naturalWidth === 1), 'the private image loads');
        const ok = await page.request.get(`${BASE}${src}`);
        assert.equal(ok.status(), 200);
        assert.equal(ok.headers()['content-type'], 'image/png');
        const forged = await page.request.get(`${BASE}${src.slice(0, -1)}${src.endsWith('0') ? '1' : '0'}`);
        assert.equal(forged.status(), 404);
        const unsigned = await page.request.get(`${BASE}${src.split('?')[0]}`);
        assert.equal(unsigned.status(), 404);
    });

    await step('saving again keeps the same private data-id', async () => {
        const before = db.prepare('select description from products where name = ?').get(name).description;
        await page.getByRole('button', { name: 'Save changes' }).click();
        await page.getByText('Saved').first().waitFor({ timeout: 10000 });
        const after = db.prepare('select description from products where name = ?').get(name).description;
        assert.equal(/data-id="([^"]+)"/.exec(after)[1], /data-id="([^"]+)"/.exec(before)[1]);
        assert.equal(/<img[^>]*src=/.test(after), false);
    });

} finally {
    db.close();
    await browser.close();
}
process.exit(exitCode(errors));
