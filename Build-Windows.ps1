$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (!(Test-Path -LiteralPath 'node_modules/electron/dist/electron.exe')) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$previousSigning = $env:CSC_IDENTITY_AUTO_DISCOVERY
try {
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    # v26 configuration: executable resource editing remains enabled for the icon.
    & npx.cmd --yes electron-builder@26 --win --x64 --dir --publish never
    $result = $LASTEXITCODE
} finally { $env:CSC_IDENTITY_AUTO_DISCOVERY = $previousSigning }
if ($result -ne 0) { exit $result }
Write-Host 'Built: dist/win-unpacked/HyeonbitRug.exe'
