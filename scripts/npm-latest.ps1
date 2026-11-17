# Points the npm `latest` tag of every Navette package to a published version.
# Until 1.0.0 is out, `latest` must follow the newest beta: otherwise `npm install @navette-js/panels` gets an old beta.
# Usage (PowerShell): & .\scripts\npm-latest.ps1 1.0.0-beta.9
# npm asks for the two-factor authentication for each package.
param([Parameter(Mandatory = $true)][string]$Version)
foreach ($name in '@navette-js/support', '@navette-js/schemas', '@navette-js/actions', '@navette-js/database', '@navette-js/forms', '@navette-js/infolists', '@navette-js/wire', '@navette-js/tables', '@navette-js/panels', '@navette-js/cli', 'create-navette') {
    Write-Host "`n=== $name@$Version -> latest"
    npm dist-tag add "$name@$Version" latest
    if ($LASTEXITCODE -ne 0) { Write-Error "Tagging $name failed: stopping."; exit 1 }
}
Write-Host "`nAll packages point latest to $Version."
