// Rich editor features on the demo's blog posts: custom block, text color, merge tag and mention, saved as HTML.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const modal = () => page.locator('.fi-modal.fi-modal-open .fi-modal-window');
const content = page.locator('[data-rich-editor-key="form.content"] .tiptap[contenteditable="true"]');
const tool = (name) => page.locator(`[data-rich-editor-key="form.content"] [data-rich-editor-tool="${name}"]`);
const title = `Rich features ${Date.now()}`;

await login(page, BASE, user);
try {
    await step('the post editor offers colors, blocks and merge tags', async () => {
        await page.goto(`${BASE}/blog/posts/create`);
        await content.waitFor({ timeout: 15000 });
        for (const name of ['textColor', 'customBlocks', 'mergeTags']) assert.equal(await tool(name).count(), 1, name);
    });
    await step('a custom block, configured in its modal, is inserted with its preview', async () => {
        await content.click();
        await tool('customBlocks').click();
        await page.locator('[data-block-id="callToAction"]').click();
        await modal().waitFor();
        await modal().locator('input[id$=".label"]').fill('Read more');
        await modal().locator('input[id$=".url"]').fill('https://example.com/more');
        await modal().getByRole('button', { name: 'Insert' }).click();
        await content.locator('[data-type="customBlock"]').waitFor({ timeout: 8000 });
        await page.locator('[data-rich-editor-key="form.content"]').getByText('Read more').first().waitFor({ timeout: 8000 });
    });
    await step('a merge tag from the panel, a mention by typing @, a colored word', async () => {
        await content.click();
        await page.keyboard.press('Control+End');
        await page.keyboard.press('Enter');
        await page.keyboard.type('Written by ');
        await tool('mergeTags').click();
        await page.locator('.fi-fo-rich-editor-merge-tag-btn', { hasText: 'Author name' }).click();
        await content.locator('[data-type="mergeTag"]').waitFor();
        await content.click();
        await page.keyboard.press('Control+End');
        // Authors are searched on the server as the user types.
        await page.keyboard.type(' thanks @Eri');
        const suggestion = page.locator('.fi-dropdown-panel.fi-scrollable:visible .fi-dropdown-list-item', { hasText: 'Erick' }).first();
        await suggestion.waitFor({ timeout: 8000 });
        await suggestion.click();
        await content.locator('[data-type="mention"]').waitFor();
        await page.keyboard.type(' and red');
        for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
        await tool('textColor').click();
        await modal().waitFor();
        await modal().locator('.fi-select-input-btn').click();
        await page.locator('.fi-select-input-option', { hasText: 'Red' }).first().click();
        await modal().getByRole('button', { name: 'Submit' }).click();
        await content.locator('span.color[data-color="red"]').waitFor({ timeout: 8000 });
    });
    await step('saved as HTML with every node', async () => {
        await page.locator('[id="form.title"]').fill(title);
        await page.locator('[id="form.title"]').blur();
        const db = openDatabase(dbFile);
        const names = [db.prepare('select name from authors order by name limit 1').get().name, db.prepare('select name from post_categories order by name limit 1').get().name];
        for (const [index, name] of names.entries()) {
            await page.locator('.fi-fo-select .fi-select-input-btn').nth(index).click();
            await page.locator('.fi-select-input input:visible').first().fill(name.slice(0, 5));
            await page.locator('.fi-select-input-option', { hasText: name }).first().click();
        }
        await page.locator('form#form button[type=submit]').first().click();
        await page.waitForURL((url) => /\/blog\/posts\/\d+/.test(url.pathname), { timeout: 10000 });
        const row = openDatabase(dbFile).prepare('select content from posts where title = ?').get(title);
        assert.ok(row, 'post saved');
        assert.match(row.content, /data-type="customBlock" data-id="callToAction" data-config="\{&quot;label&quot;:&quot;Read more&quot;/);
        assert.match(row.content, /data-type="mergeTag" data-id="author"/);
        assert.match(row.content, /data-type="mention" data-id="\d+"/);
        assert.match(row.content, /class="color" data-color="red"/);
    });
    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} finally {
    await browser.close();
}
process.exit(exitCode());
