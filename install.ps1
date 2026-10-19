param(
  [string]$RepoRawBase = "https://raw.githubusercontent.com/huongmh14/BotAutoTask-/dev",
  [string]$LocalSource = "D:\BotAutoTask\dist\botautotask.mjs"
)

$ErrorActionPreference = "Stop"
$InstallDir = Join-Path $env:USERPROFILE ".botautotask\bin"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$TargetMjs = Join-Path $InstallDir "botautotask.mjs"

if (Test-Path $LocalSource) {
  Copy-Item -Force $LocalSource $TargetMjs
  Write-Host "[+] Installed standalone bundle from local build: $LocalSource"
} else {
  Write-Host "[*] Downloading standalone botautotask.mjs from $RepoRawBase/dist/botautotask.mjs ..."
  Invoke-WebRequest -Uri "$RepoRawBase/dist/botautotask.mjs" -OutFile $TargetMjs -UseBasicParsing
}

$CmdContent = "@echo off`r`nnode `"$TargetMjs`" %*`r`n"
$CmdShim = Join-Path $InstallDir "botautotask.cmd"
Set-Content -Path $CmdShim -Value $CmdContent -Encoding ASCII

$NpmBin = "$env:APPDATA\npm"
if (Test-Path $NpmBin) {
  Copy-Item -Force $TargetMjs (Join-Path $NpmBin "botautotask.mjs")
  Set-Content -Path (Join-Path $NpmBin "botautotask.cmd") -Value "@echo off`r`nnode `"%~dp0botautotask.mjs`" %*`r`n" -Encoding ASCII
  Set-Content -Path (Join-Path $NpmBin "botautotask") -Value "#!/bin/sh`nexec node `"`$(dirname `"`$0`")/botautotask.mjs`" `"`$@`"`n" -Encoding ASCII
  Write-Host "[+] Installed global CLI command 'botautotask' into $NpmBin"
}

Write-Host "[OK] Done! Run: botautotask models | botautotask cores | botautotask run <goal>"
