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
$exampleNormalDir = Join-Path $resolvedOutputDir "examples\us"
$exampleSlowDir = Join-Path $resolvedOutputDir "examples\us-slow"
$normalRate = -1
$slowRate = -5

$audioJobs = @(
  foreach ($entry in $entries) {
    [PSCustomObject]@{ AudioKey = $entry.audioKey; Text = $entry.spokenText; NormalDir = $normalDir; SlowDir = $slowDir }
    if ($entry.PSObject.Properties.Name -contains "examples") {
      foreach ($example in $entry.examples) {
        [PSCustomObject]@{ AudioKey = $example.audioKey; Text = $example.text; NormalDir = $exampleNormalDir; SlowDir = $exampleSlowDir }
      }
    }
  }
)

foreach ($job in $audioJobs) {
  if ([string]::IsNullOrWhiteSpace($job.AudioKey) -or [string]::IsNullOrWhiteSpace($job.Text)) {
    throw "Every word and example must have a nonempty audioKey and spoken text."
  }
  if ($job.AudioKey.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0) {
    throw "Invalid audio key: $($job.AudioKey)"
  }
}

$outputDirectories = @($audioJobs | ForEach-Object { $_.NormalDir; $_.SlowDir } | Sort-Object -Unique)
New-Item -ItemType Directory -Force -Path $outputDirectories | Out-Null

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
  $voiceTokens = @($sapiSpeaker.GetVoices() | Where-Object { $_.GetDescription() -like "$voiceName*" })
  if ($voiceTokens.Count -eq 0) {
    throw "Missing required voice: $voiceName"
  }

  $sapiSpeaker.Voice = $voiceTokens[0]
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

try {
  foreach ($job in $audioJobs) {
    $audioKey = [string]$job.AudioKey
    $spokenText = [string]$job.Text
    $normalPath = Join-Path $job.NormalDir "$audioKey.wav"
    $slowPath = Join-Path $job.SlowDir "$audioKey.wav"

    if (Test-Path -LiteralPath $normalPath) { Remove-Item -LiteralPath $normalPath -Force }
    if (Test-Path -LiteralPath $slowPath) { Remove-Item -LiteralPath $slowPath -Force }

    if ($useSapi) {
      Write-SapiWave $sapiSpeaker $normalPath $spokenText $normalRate
      Write-SapiWave $sapiSpeaker $slowPath $spokenText $slowRate
    } else {
      Write-SystemSpeechWave $systemSpeaker $normalPath $spokenText $normalRate
      Write-SystemSpeechWave $systemSpeaker $slowPath $spokenText $slowRate
    }

    Normalize-PcmWaveHeader $normalPath
    Normalize-PcmWaveHeader $slowPath
  }
} finally {
  if ($null -ne $systemSpeaker) {
    $systemSpeaker.Dispose()
  }

  if ($null -ne $sapiSpeaker) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($sapiSpeaker)
  }
}

Get-ChildItem -LiteralPath $outputDirectories -Filter "*.wav" |
  Sort-Object DirectoryName, Name |
  Select-Object FullName, Length, LastWriteTime
