$ErrorActionPreference = 'Stop'
$electron = Join-Path $PSScriptRoot 'node_modules/electron/dist/electron.exe'
if (!(Test-Path -LiteralPath $electron)) { throw 'Run npm ci before creating the shortcut.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $PSScriptRoot '현빗 러그 v2.lnk'))
$shortcut.TargetPath = $electron
$shortcut.Arguments = '"' + $PSScriptRoot + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.IconLocation = (Join-Path $PSScriptRoot 'app-icon-v2.ico') + ',0'
$shortcut.Description = '현빗 러그 · 브랜딩 v2'
$shortcut.Save()
Write-Host 'Created shortcut in the project folder.'
