param(
  [string]$OutputDir = ".\tmp\daily-word-audio"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Speech

$repoRoot = Resolve-Path -LiteralPath "."
$dictationPath = Join-Path $repoRoot.Path "src\data\dictationWords.ts"
$source = Get-Content -LiteralPath $dictationPath -Raw
$words = [regex]::Matches($source, "word:\s*'([^']+)'") | ForEach-Object { $_.Groups[1].Value }

if ($words.Count -eq 0) {
  throw "No words found in $dictationPath"
}

$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voiceName = "Microsoft Zira Desktop"
$availableVoices = $speaker.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if (-not ($availableVoices -contains $voiceName)) {
  throw "Missing required voice: $voiceName"
}

$speaker.SelectVoice($voiceName)

$resolvedOutputDir = Join-Path $repoRoot.Path $OutputDir
$normalDir = Join-Path $resolvedOutputDir "us"
$slowDir = Join-Path $resolvedOutputDir "us-slow"
New-Item -ItemType Directory -Force -Path $normalDir, $slowDir | Out-Null

foreach ($word in $words) {
  $spokenText = $word.Replace("-", " ")
  $normalPath = Join-Path $normalDir "$word.wav"
  $slowPath = Join-Path $slowDir "$word.wav"

  if (Test-Path $normalPath) { Remove-Item -LiteralPath $normalPath -Force }
  if (Test-Path $slowPath) { Remove-Item -LiteralPath $slowPath -Force }

  $speaker.Rate = -1
  $speaker.SetOutputToWaveFile($normalPath)
  $speaker.Speak($spokenText)
  $speaker.SetOutputToNull()

  $speaker.Rate = -5
  $speaker.SetOutputToWaveFile($slowPath)
  $speaker.Speak($spokenText)
  $speaker.SetOutputToNull()
}

$speaker.Dispose()

Get-ChildItem -LiteralPath $normalDir, $slowDir -Filter "*.wav" |
  Sort-Object DirectoryName, Name |
  Select-Object FullName, Length, LastWriteTime
