param(
  [string]$OutputDir = ".\\tmp\\index-tts-prompts"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Speech

$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voiceName = "Microsoft Zira Desktop"

$availableVoices = $speaker.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if (-not ($availableVoices -contains $voiceName)) {
  throw "Missing required voice: $voiceName"
}

$speaker.SelectVoice($voiceName)

$resolvedOutputDir = Resolve-Path -LiteralPath "." | ForEach-Object {
  Join-Path $_.Path $OutputDir
}

New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$normalPath = Join-Path $resolvedOutputDir "zira-reference.wav"
$slowPath = Join-Path $resolvedOutputDir "zira-reference-slow.wav"

if (Test-Path $normalPath) { Remove-Item -LiteralPath $normalPath -Force }
if (Test-Path $slowPath) { Remove-Item -LiteralPath $slowPath -Force }

$speaker.Rate = -1
$speaker.SetOutputToWaveFile($normalPath)
$speaker.Speak("Hello. I speak clear American English for beginner word practice. Please listen carefully and repeat the word after me.")
$speaker.SetOutputToNull()

$speaker.Rate = -3
$speaker.SetOutputToWaveFile($slowPath)
$speaker.Speak("Hello. I speak clear American English slowly for beginner word practice. Please listen carefully and repeat the word after me.")
$speaker.SetOutputToNull()

$speaker.Dispose()

Get-Item -LiteralPath $normalPath, $slowPath | Select-Object FullName, Length, LastWriteTime
