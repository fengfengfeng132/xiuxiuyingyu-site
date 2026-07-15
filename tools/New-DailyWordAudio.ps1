param(
  [string]$OutputDir = ".\tmp\daily-word-audio"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Speech

$repoRoot = Resolve-Path -LiteralPath "."
$dictationPath = Join-Path $repoRoot.Path "src\data\dictationWords.ts"
$source = Get-Content -LiteralPath $dictationPath -Raw -Encoding UTF8
$words = [regex]::Matches($source, "word:\s*'([^']+)'") | ForEach-Object { $_.Groups[1].Value }

$voiceName = "Microsoft Zira Desktop"
if ($words.Count -eq 0) {
  throw "No words found in $dictationPath"
}

$resolvedOutputDir = Join-Path $repoRoot.Path $OutputDir
$normalDir = Join-Path $resolvedOutputDir "us"
$slowDir = Join-Path $resolvedOutputDir "us-slow"
New-Item -ItemType Directory -Force -Path $normalDir, $slowDir | Out-Null

$systemSpeaker = $null
$sapiSpeaker = $null
$useSapi = $false

try {
  $systemSpeaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $systemSpeaker.SelectVoice($voiceName)
} catch {
  if ($null -ne $systemSpeaker) {
    $systemSpeaker.Dispose()
    $systemSpeaker = $null
  }

  $sapiSpeaker = New-Object -ComObject SAPI.SpVoice
  $voiceToken = @($sapiSpeaker.GetVoices() | Where-Object { $_.GetDescription() -like "$voiceName*" })[0]
  if ($null -eq $voiceToken) {
    throw "Missing required voice: $voiceName"
  }

  $sapiSpeaker.Voice = $voiceToken
  $useSapi = $true
}

function Write-SystemSpeechWave([System.Speech.Synthesis.SpeechSynthesizer]$Speaker, [string]$Path, [string]$Text, [int]$Rate) {
  $Speaker.Rate = $Rate
  $Speaker.SetOutputToWaveFile($Path)
  $Speaker.Speak($Text)
  $Speaker.SetOutputToNull()
}

function Write-SapiWave($Speaker, [string]$Path, [string]$Text, [int]$Rate) {
  $stream = New-Object -ComObject SAPI.SpFileStream
  try {
    $stream.Open($Path, 3)
    $Speaker.AudioOutputStream = $stream
    $Speaker.Rate = $Rate
    [void]$Speaker.Speak($Text)
  } finally {
    $Speaker.AudioOutputStream = $null
    $stream.Close()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($stream)
  }
}

foreach ($word in $words) {
  if ($word -eq "read") {
    $spokenText = "red"
  } else {
    $spokenText = $word.Replace("-", " ")
  }
  $normalPath = Join-Path $normalDir "$word.wav"
  $slowPath = Join-Path $slowDir "$word.wav"

  if (Test-Path $normalPath) { Remove-Item -LiteralPath $normalPath -Force }
  if (Test-Path $slowPath) { Remove-Item -LiteralPath $slowPath -Force }

  try {
    if ($useSapi) {
      Write-SapiWave $sapiSpeaker $normalPath $spokenText -1
      Write-SapiWave $sapiSpeaker $slowPath $spokenText -5
    } else {
      Write-SystemSpeechWave $systemSpeaker $normalPath $spokenText -1
      Write-SystemSpeechWave $systemSpeaker $slowPath $spokenText -5
    }
  } catch {
    if (-not $useSapi) {
      throw
    }

    if (Test-Path $normalPath) { Remove-Item -LiteralPath $normalPath -Force }
    if (Test-Path $slowPath) { Remove-Item -LiteralPath $slowPath -Force }
    if ($null -ne $sapiSpeaker) {
      [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($sapiSpeaker)
      $sapiSpeaker = $null
    }

    $systemSpeaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $useSapi = $false
    Write-SystemSpeechWave $systemSpeaker $normalPath $spokenText -1
    Write-SystemSpeechWave $systemSpeaker $slowPath $spokenText -5
  }
}

if ($null -ne $systemSpeaker) {
  $systemSpeaker.Dispose()
}

if ($null -ne $sapiSpeaker) {
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($sapiSpeaker)
}

Get-ChildItem -LiteralPath $normalDir, $slowDir -Filter "*.wav" |
  Sort-Object DirectoryName, Name |
  Select-Object FullName, Length, LastWriteTime
