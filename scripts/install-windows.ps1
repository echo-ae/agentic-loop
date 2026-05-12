[CmdletBinding()]
param(
    [switch]$Copy,
    [switch]$Symlink,
    [switch]$Force,
    [switch]$DryRun,
    [switch]$Help,
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } elseif ($env:USERPROFILE) { Join-Path $env:USERPROFILE ".codex" } else { Join-Path $HOME ".codex" })
)

$ErrorActionPreference = "Stop"

function Show-Usage {
    @"
Install the agentic-loop Codex skill on Windows.

Usage:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 [-Copy|-Symlink] [-Force] [-CodexHome PATH]

Options:
  -Copy             Copy the skill directory. Default.
  -Symlink          Symlink the skill directory for local development.
  -Force            Replace an existing installed skill and remove the legacy
                    agentic-reviewer-loop install if present.
  -DryRun           Print resolved paths without writing files.
  -CodexHome PATH   Override CODEX_HOME. Defaults to `%CODEX_HOME`% or `%USERPROFILE`%\.codex.
  -Help             Show this help.

After install, restart Codex App.
"@
}

if ($PSBoundParameters.ContainsKey("Help")) {
    Show-Usage
    exit 0
}

if ($Copy -and $Symlink) {
    throw "Choose only one install mode: -Copy or -Symlink."
}

$mode = if ($Symlink) { "symlink" } else { "copy" }
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $repoRoot "skills\agentic-loop"
$destParent = Join-Path $CodexHome "skills"
$destDir = Join-Path $destParent "agentic-loop"
$legacyDestDir = Join-Path $destParent "agentic-reviewer-loop"

function Test-ExistingPath {
    param([string]$Path)
    return $null -ne (Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue)
}

function Remove-PathTree {
    param([string]$Path)
    if (Test-ExistingPath -Path $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

function Copy-DirectoryContents {
    param(
        [string]$Source,
        [string]$Destination
    )

    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $sourceDir "SKILL.md") -PathType Leaf)) {
    throw "Skill source not found at $sourceDir"
}
if (-not (Test-Path -LiteralPath (Join-Path $sourceDir "agents\openai.yaml") -PathType Leaf)) {
    throw "Skill interface metadata not found at $sourceDir\agents\openai.yaml"
}

Write-Host "[install-windows] summary"
Write-Host "  - mode: $mode"
Write-Host "  - source: $sourceDir"
Write-Host "  - destination: $destDir"
Write-Host "  - legacy destination: $legacyDestDir"

if ($DryRun) {
    Write-Host "[install-windows] dry run complete; no files were changed."
    exit 0
}

New-Item -ItemType Directory -Force -Path $destParent | Out-Null

if (Test-ExistingPath -Path $destDir) {
    if (-not $Force) {
        throw "Destination already exists: $destDir. Re-run with -Force to replace it."
    }
    Remove-PathTree -Path $destDir
}

if ($legacyDestDir -ne $destDir -and (Test-ExistingPath -Path $legacyDestDir)) {
    if (-not $Force) {
        throw "Legacy destination already exists: $legacyDestDir. Re-run with -Force to remove it while installing agentic-loop."
    }
    Remove-PathTree -Path $legacyDestDir
}

if ($mode -eq "symlink") {
    try {
        New-Item -ItemType SymbolicLink -Path $destDir -Target $sourceDir | Out-Null
    } catch {
        throw "Failed to create symbolic link at $destDir. Enable Windows Developer Mode, run PowerShell as Administrator, or re-run with -Copy. $($_.Exception.Message)"
    }
} else {
    Copy-DirectoryContents -Source $sourceDir -Destination $destDir
}

Write-Host "[install-windows] installed agentic-loop skill:"
Write-Host "  $destDir"
Write-Host ""
Write-Host "Restart Codex App to pick up the skill."
