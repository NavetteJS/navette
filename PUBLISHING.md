# Publishing

The packages are developed as TypeScript sources (`packages/*/src`), which Node runs directly in this repository. Node does not run TypeScript from `node_modules`, so the published packages contain compiled JavaScript and `.d.ts` declarations, built by `scripts/release.mjs` into `.release/`.

## Once

1. Create the npm organization `navette` on npmjs.com (it owns the `@navette` scope) and add the maintainers.
2. Log in on the publishing machine: `npm login`.

## Each release

```bash
npm test
node scripts/release.mjs 1.0.0-beta.1 --pack
```

This writes `.release/<package>/` and one archive per package (`.release/navette-<package>-<version>.tgz`). Check an archive before publishing:

```bash
tar -tzf .release/navette-panels-1.0.0-beta.1.tgz
```

Publish in dependency order (a package must exist before the ones that depend on it). Pre-releases go to the `beta` tag, so `npm install @navette/panels` does not pick them up by default:

```bash
for p in support schemas actions database forms infolists wire tables panels; do npm publish .release/navette-$p-1.0.0-beta.1.tgz --access public --tag beta; done
```

Then tag the repository: `git tag v1.0.0-beta.1 && git push origin v1.0.0-beta.1`.

## Checking a build like a user

Install the archives in an empty directory outside the repository, copy `apps/starter/server.ts` and `extensions.ts` into it, and run the starter end-to-end test against it (from the parity tools, when available): `STARTER_DIR=<that directory> node e2e-starter.mjs`.
