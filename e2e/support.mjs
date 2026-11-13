// Shared helpers for the end-to-end specs: arguments, the database safety check, sign-in and step reporting.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Reads `<baseUrl> <users.json> <database>` from the command line.
 * Specs create, change and delete records: they refuse any database other than the disposable copy made by run.mjs.
 */
export function specArgs() {
    const [base, usersFile, dbFile] = process.argv.slice(2);
    if (!base || !usersFile || !dbFile || !/e2e\.sqlite$/.test(dbFile)) {
        console.error('Refused: this spec writes to the database and only runs against the disposable e2e.sqlite copy. Run it with `npm run test:e2e`.');
        process.exit(2);
    }
    return {
        base,
        user: JSON.parse(fs.readFileSync(usersFile, 'utf8'))[0],
        dbFile,
        // Scratch folder for files a spec needs to write: the folder of the disposable database.
        tmpDir: path.dirname(dbFile),
    };
}

export function openDatabase(dbFile, options = {}) {
    return new Database(dbFile, options);
}

export async function login(page, base, user) {
    await page.goto(`${base}/login`);
    await page.locator('input[type=email]').fill(user.email);
    await page.locator('input[type=password]').fill(user.password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL((u) => !u.pathname.endsWith('/login'));
}

/**
 * Prints one line per step as it completes. run.mjs counts the lines by their first character:
 * `✔` passed, `✖` failed, `○` skipped.
 */
export function reporter({ errorLines = 1 } = {}) {
    let failed = 0;
    const print = (line) => console.log(line);
    return {
        /** Runs `fn`; a thrown error fails the step and the spec carries on with the next one. */
        async step(name, fn) {
            try {
                await fn();
                print(`✔ ${name}`);
            } catch (e) {
                failed++;
                print(`✖ ${name} — ${String(e?.message ?? e).split('\n').slice(0, errorLines).join(' | ')}`);
            }
        },
        /** Records an already computed outcome. */
        check(ok, name, detail = '') {
            if (!ok) failed++;
            print(`${ok ? '✔' : '✖'} ${name}${detail ? ' — ' + detail : ''}`);
        },
        skip(name, reason) {
            print(`○ ${name} — skipped: ${reason}`);
        },
        fail(message) {
            failed++;
            print(`✖ ${message}`);
        },
        get failed() {
            return failed;
        },
        /** Exit code for the spec: non-zero when a step failed or, if given, when the page threw errors. */
        exitCode(pageErrors = []) {
            if (pageErrors.length) console.log('Page errors:\n' + pageErrors.slice(0, 5).join('\n'));
            return failed || pageErrors.length ? 1 : 0;
        },
    };
}
