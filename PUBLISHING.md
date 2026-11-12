# Publishing

The packages are developed as TypeScript sources (`packages/*/src`), which Node runs directly in this repository. Node does not run TypeScript from `node_modules`, so the published packages contain compiled JavaScript and `.d.ts` declarations, built by `scripts/release.mjs` into `.release/`.

## Once

1. Create the npm organization `navette-js` on npmjs.com (it owns the `@navette-js` scope) and add the maintainers.
2. Log in on the publishing machine: `npm login`.

## Each release

```bash
npm test
node scripts/release.mjs 1.0.0-beta.1 --pack
```

This writes `.release/<package>/` and one archive per package (`.release/navette-js-<package>-<version>.tgz`, and `.release/create-navette-<version>.tgz`). Check an archive before publishing:

```bash
tar -tzf .release/navette-js-panels-1.0.0-beta.1.tgz
```

Publish in dependency order (a package must exist before the ones that depend on it), from PowerShell:

```powershell
& .\scripts\publish.ps1 1.0.0-beta.1
```

Pre-releases of `@navette-js/*` go to the `beta` tag. `create-navette` always goes to `latest`, so that `npm create navette@latest` gets the newest version. npm asks you to confirm the publication with two-factor authentication.

Then tag the repository: `git tag v1.0.0-beta.1 && git push origin v1.0.0-beta.1`.

## Checking a build like a user

Install the archives in an empty directory outside the repository, copy `apps/starter/server.ts` and `extensions.ts` into it, and run the starter end-to-end test against it: `STARTER_DIR=<that directory> node e2e-starter.mjs`.
