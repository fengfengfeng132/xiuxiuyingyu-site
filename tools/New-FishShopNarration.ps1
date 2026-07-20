param(
  [string]$OutputDirectory = ".\deliverables"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$generator = Join-Path $repoRoot "tools\generate_fish_shop_narration.py"
$resolvedOutputDirectory = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
  [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputDirectory))
}

$uv = Get-Command uv -ErrorAction Stop
$wavPath = Join-Path $resolvedOutputDirectory "Fish-Shop-American-Girl-Natural.wav"
$mp3Path = Join-Path $resolvedOutputDirectory "Fish-Shop-American-Girl-Natural.mp3"

Push-Location $repoRoot
try {
  & $uv.Source run --with "edge-tts==7.2.7" python $generator `
    --output-wav $wavPath `
    --output-mp3 $mp3Path
  if ($LASTEXITCODE -ne 0) {
    throw "Fish Shop neural narration generation failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

Get-Item -LiteralPath $wavPath, $mp3Path |
  Select-Object FullName, Length, LastWriteTime
