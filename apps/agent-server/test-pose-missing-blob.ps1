# Isolated opt-in fixture: never run alongside other tests in the same process.
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Temp = Join-Path ([System.IO.Path]::GetTempPath()) ("slapdash-pose-" + [guid]::NewGuid())
$Exe = Join-Path $Temp 'pose-integration.exe'
$Raylib = Join-Path $Root 'raylib.lib'
try {
    New-Item -ItemType Directory -Path "$Temp/missing", "$Temp/recovery/assets" -Force | Out-Null
    Copy-Item (Join-Path $Root 'assets/marth_combat_pose.bin') "$Temp/recovery/assets/marth_combat_pose.bin"
    # Build without running: odin test otherwise chooses its own working directory.
    & odin test (Join-Path $Root 'source') -build-mode:test -vet -strict-style `
        -define:POSE_MISSING_BLOB_INTEGRATION=true `
        -define:ODIN_TEST_NAMES=slapdash.pose_missing_blob_fallback_and_recovery `
        -define:ODIN_TEST_THREADS=1 "-out:$Exe" "-extra-linker-flags:`"$Raylib`""
    if ($LASTEXITCODE -ne 0) { throw "Integration test build failed ($LASTEXITCODE)" }
    Push-Location "$Temp/missing"
    try {
        & $Exe
        if ($LASTEXITCODE -ne 0) { throw "Integration test failed ($LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
} finally {
    if (Test-Path $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force }
}
