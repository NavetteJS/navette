# Publish the archives prepared by `node scripts/release.mjs <version> --pack`, in dependency order.
# Usage (PowerShell, from the repository root): & .\scripts\publish.ps1 1.0.0-beta.1
# npm asks for the two-factor authentication code for each package.
param([Parameter(Mandatory = $true)][string]$Version)
$tag = if ($Version.Contains('-')) { 'beta' } else { 'latest' }
foreach ($package in 'support', 'schemas', 'actions', 'database', 'forms', 'infolists', 'wire', 'tables', 'panels') {
    $archive = ".release/navette-js-$package-$Version.tgz"
    if (-not (Test-Path $archive)) { Write-Error "Missing archive: $archive (run node scripts/release.mjs $Version --pack first)"; exit 1 }
    Write-Host "`n=== @navette-js/$package@$Version (tag $tag)"
    npm publish $archive --access public --tag $tag
    if ($LASTEXITCODE -ne 0) { Write-Error "Publishing @navette-js/$package failed: stopping."; exit 1 }
}
Write-Host "`nAll 9 packages are published."
