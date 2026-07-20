param(
  [ValidateSet("natural-child", "slow-full-young-adult")]
  [string]$Profile = "natural-child",
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
$outputStem = switch ($Profile) {
  "natural-child" { "Fish-Shop-American-Girl-Natural" }
  "slow-full-young-adult" { "Fish-Shop-American-Young-Woman-Slow-Full" }
}
$wavPath = Join-Path $resolvedOutputDirectory "$outputStem.wav"
$mp3Path = Join-Path $resolvedOutputDirectory "$outputStem.mp3"

Push-Location $repoRoot
try {
  & $uv.Source run --with "edge-tts==7.2.7" python $generator `
    --profile $Profile `
    --output-directory $resolvedOutputDirectory
  if ($LASTEXITCODE -ne 0) {
    throw "Fish Shop neural narration generation failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

Get-Item -LiteralPath $wavPath, $mp3Path |
  Select-Object FullName, Length, LastWriteTime
