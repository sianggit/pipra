# Pipra Universal Windows PowerShell One-Liner Installer
# Usage: irm https://raw.githubusercontent.com/anggit-arisa/pipra/main/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"

$installDir = "$HOME\.pipra"
$binDir = "$HOME\.pipra\bin"
$zipUrl = "https://github.com/anggit-arisa/pipra/archive/refs/heads/main.zip"
$zipFile = "$env:TEMP\pipra-main.zip"

Write-Host "==> Installing Pipra for Windows..." -ForegroundColor Cyan

if (!(Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

Write-Host "==> Downloading latest release package..."
Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile

Write-Host "==> Extracting files..."
Expand-Archive -Path $zipFile -DestinationPath $env:TEMP\pipra-extract -Force
Copy-Item -Path "$env:TEMP\pipra-extract\pipra-main\*" -Destination $installDir -Recurse -Force
Remove-Item -Path $zipFile, "$env:TEMP\pipra-extract" -Recurse -Force

# Create pipra.cmd runner in bin
$cmdContent = @"
@echo off
node "%~dp0pipra.js" %*
"@
Set-Content -Path "$binDir\pipra.cmd" -Value $cmdContent

# Add to user PATH if not present
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$binDir", "User")
    Write-Host "==> Added $binDir to User PATH." -ForegroundColor Green
}

Write-Host ""
Write-Host "==> Pipra installed successfully to $installDir" -ForegroundColor Green
Write-Host "==> To start Pipra, restart your terminal and run:" -ForegroundColor Yellow
Write-Host "    pipra start" -ForegroundColor Cyan
Write-Host ""

