param(
  [string]$OutputDir = ".\tmp\daily-word-audio"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Speech

$repoRoot = Resolve-Path -LiteralPath "."
$dictationPath = Join-Path $repoRoot.Path "src\data\dictationWords.json"
$entries = Get-Content -LiteralPath $dictationPath -Raw -Encoding UTF8 | ConvertFrom-Json

$voiceName = "Microsoft Zira Desktop"
if ($entries.Count -eq 0) {
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

function Normalize-PcmWaveHeader([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $offset = 12

  while ($offset -lt ($bytes.Length - 8)) {
    $chunkId = [System.Text.Encoding]::ASCII.GetString($bytes, $offset, 4)
    $chunkSize = [BitConverter]::ToInt32($bytes, $offset + 4)

    if ($chunkId -eq "fmt ") {
      $audioFormat = [BitConverter]::ToInt16($bytes, $offset + 8)
      $extensionSize = if ($chunkSize -ge 18) { [BitConverter]::ToInt16($bytes, $offset + 24) } else { -1 }
      if ($audioFormat -ne 1 -or $chunkSize -ne 18 -or $extensionSize -ne 0) {
        return
      }

      $trimOffset = $offset + 24
      $normalized = New-Object byte[] ($bytes.Length - 2)
      [Array]::Copy($bytes, 0, $normalized, 0, $trimOffset)
      [Array]::Copy($bytes, $trimOffset + 2, $normalized, $trimOffset, $bytes.Length - $trimOffset - 2)
      [Array]::Copy([BitConverter]::GetBytes([int]16), 0, $normalized, $offset + 4, 4)
      [Array]::Copy([BitConverter]::GetBytes([int]($normalized.Length - 8)), 0, $normalized, 4, 4)
      [System.IO.File]::WriteAllBytes($Path, $normalized)
      return
    }

    $offset += 8 + $chunkSize + ($chunkSize % 2)
  }
}

foreach ($entry in $entries) {
  $audioKey = [string]$entry.audioKey
  $spokenText = [string]$entry.spokenText
  $normalPath = Join-Path $normalDir "$audioKey.wav"
  $slowPath = Join-Path $slowDir "$audioKey.wav"

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

  Normalize-PcmWaveHeader $normalPath
  Normalize-PcmWaveHeader $slowPath
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
