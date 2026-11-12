# Publish the archives prepared by `node scripts/release.mjs <version> --pack`, in dependency order.
# Usage (PowerShell, from the repository root): & .\scripts\publish.ps1 1.0.0-beta.1
# npm asks for the two-factor authentication code for each package.
param([Parameter(Mandatory = $true)][string]$Version)
$tag = if ($Version.Contains('-')) { 'beta' } else { 'latest' }
foreach ($package in 'support', 'schemas', 'actions', 'database', 'forms', 'infolists', 'wire', 'tables', 'panels', 'cli', 'create') {
    $archive = if ($package -eq 'create') { ".release/create-navette-$Version.tgz" } else { ".release/navette-js-$package-$Version.tgz" }
    if (-not (Test-Path $archive)) { Write-Error "Missing archive: $archive (run node scripts/release.mjs $Version --pack first)"; exit 1 }
    Write-Host "`n=== $archive (tag $tag)"
    # create-navette always goes to `latest`: `npm create navette@latest` must get the newest version.
    $packageTag = if ($package -eq 'create') { 'latest' } else { $tag }
    npm publish $archive --access public --tag $packageTag
    if ($LASTEXITCODE -ne 0) { Write-Error "Publishing $archive failed: stopping."; exit 1 }
}
Write-Host "`nAll packages are published."
