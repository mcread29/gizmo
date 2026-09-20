# Fetches the latest Gizmo release, verifies it, and installs it under
# ~\.gizmo. It deliberately does not configure or start anything: a piped
# script should never register a service.
#Requires -Version 5.1
[CmdletBinding()]
param([string]$Version)

$ErrorActionPreference = 'Stop'
$repo = 'mcread29/gizmo'
$dataDir = if ($env:GIZMO_DATA_DIR) { $env:GIZMO_DATA_DIR } else { Join-Path $HOME '.gizmo' }
$binDir = Join-Path $dataDir 'app\current\bin'

function Stop-Install([string]$Message) { throw "gizmo: $Message" }

function Get-Major([string]$Value) {
	[int](($Value -replace '^v', '') -split '\.')[0]
}

function Assert-Command([string]$Name, [string]$Fix) {
	if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { Stop-Install "$Name is required. $Fix" }
}

Assert-Command 'tar' 'tar ships with Windows 10 1803 and newer.'
Assert-Command 'git' 'Gizmo clones the extension registry at runtime. See https://git-scm.com.'
Assert-Command 'node' 'Gizmo needs Node 24 or newer. See https://nodejs.org.'
if ((Get-Major (node --version)) -lt 24) { Stop-Install "Node $(node --version) is too old; Gizmo needs 24 or newer." }
Assert-Command 'pnpm' 'Run: corepack enable'
if ((Get-Major (pnpm --version)) -lt 11) { Stop-Install "pnpm $(pnpm --version) is too old; Gizmo needs 11 or newer. Run: corepack enable" }

if (-not $Version) {
	$latest = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'gizmo-installer' }
	$Version = $latest.tag_name
}
if (-not $Version) { Stop-Install 'Could not work out the latest release tag.' }

$tarball = "gizmo-$Version.tar.gz"
$base = "https://github.com/$repo/releases/download/$Version"
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("gizmo-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
try {
	Write-Host "Downloading $tarball"
	$archive = Join-Path $staging $tarball
	Invoke-WebRequest "$base/$tarball" -OutFile $archive
	$sumsFile = Join-Path $staging 'SHA256SUMS'
	Invoke-WebRequest "$base/SHA256SUMS" -OutFile $sumsFile

	$expected = (Get-Content $sumsFile | Where-Object { $_ -match "\s\*?$([regex]::Escape($tarball))$" } |
		ForEach-Object { ($_ -split '\s+')[0] } | Select-Object -First 1)
	if (-not $expected) { Stop-Install "SHA256SUMS does not list $tarball." }
	$actual = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLower()
	if ($actual -ne $expected.ToLower()) { Stop-Install "$tarball checksum mismatch ($actual != $expected)." }

	$target = Join-Path $dataDir "app\releases\$Version"
	Write-Host "Unpacking into $target"
	if (Test-Path $target) { Remove-Item $target -Recurse -Force }
	New-Item -ItemType Directory -Path $target -Force | Out-Null
	tar -xzf $archive -C $target
	if ($LASTEXITCODE -ne 0) { Stop-Install 'tar could not unpack the release.' }

	Write-Host 'Installing dependencies'
	Push-Location $target
	try {
		pnpm install --frozen-lockfile
		if ($LASTEXITCODE -ne 0) { Stop-Install 'pnpm install failed.' }
	} finally { Pop-Location }

	# The unpacked tree now has tsx, so the real CLI can take over from here.
	node "$target\node_modules\tsx\dist\cli.mjs" "$target\scripts\gizmo.ts" install --here
	if ($LASTEXITCODE -ne 0) { Stop-Install 'gizmo install --here failed.' }
} finally {
	Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $binDir) {
	[Environment]::SetEnvironmentVariable('Path', "$userPath;$binDir", 'User')
	Write-Host "Added $binDir to your user PATH; open a new terminal to pick it up."
}

Write-Host ''
Write-Host "Installed $Version."
Write-Host 'Next:'
Write-Host '  gizmo configure --local'
Write-Host '  gizmo service install   (from an elevated PowerShell)'
Write-Host '  gizmo service start'
