// Import action of the lab panel's products: upload, column mapping guessed from the file's headers and changed by the user,
// CSV and XLSX files. Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { login, openDatabase, reporter, specArgs } from './support.mjs';
import { buildXlsx } from '../packages/panels/src/xlsx.ts';

const { base: BASE, user, dbFile, tmpDir } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const modal = () => page.locator('.fi-modal.fi-modal-open .fi-modal-window');
const db = openDatabase(dbFile);

const openImport = async (file) => {
    await page.goto(`${BASE}/lab/products`);
    await page.getByRole('button', { name: /^Import/ }).first().click();
    await modal().waitFor();
    // FilePond replaces the input once its script has loaded.
    await modal().locator('input.filepond--browser').waitFor({ state: 'attached', timeout: 10000 });
    await modal().locator('input.filepond--browser').setInputFiles(file);
    try { await modal().getByText('Columns').waitFor({ timeout: 15000 }); } catch (error) { await page.screenshot({ path: path.join(tmpDir, 'import-modal.png') }); throw error; }
};
// One select per column of the importer, in order: name, SKU, price.
const columnSelect = (index) => modal().locator('select').nth(index);

await login(page, BASE, user);
try {
    await step('after the upload, each column is matched to a header of the file, and can be changed', async () => {
        const file = path.join(tmpDir, 'lab-products.csv');
        fs.writeFileSync(file, 'Product name,SKU,cost\nE2E Lamp,E2E-1,12.5\nE2E Desk,E2E-2,99\n');
        await openImport(file);
        assert.equal(await columnSelect(0).inputValue(), '');
        assert.equal(await columnSelect(1).inputValue(), 'SKU');
        assert.equal(await columnSelect(2).inputValue(), 'cost');
        // "Product name" is not a guess of the name column: the user picks it.
        await columnSelect(0).selectOption('Product name');
        await modal().getByRole('button', { name: 'Import' }).click();
        await page.getByText('Import completed').waitFor({ timeout: 10000 });
        const rows = db.prepare("select name, price from products where sku like 'E2E-%' order by sku").all();
        assert.deepEqual(rows.map((row) => [row.name, Number(row.price)]), [['E2E Lamp', 12.5], ['E2E Desk', 99]]);
    });
    await step('an XLSX file is imported the same way', async () => {
        const file = path.join(tmpDir, 'lab-products.xlsx');
        fs.writeFileSync(file, buildXlsx([['name', 'sku', 'price'], ['E2E Chair', 'E2E-3', '45']]));
        await openImport(file);
        await modal().getByRole('button', { name: 'Import' }).click();
        await page.getByText('Import completed').waitFor({ timeout: 10000 });
        assert.equal(db.prepare("select name from products where sku = 'E2E-3'").get()?.name, 'E2E Chair');
    });
    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} finally {
    await browser.close();
}
process.exit(exitCode());
