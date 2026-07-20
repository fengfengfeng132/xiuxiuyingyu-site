from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class NarrationProfile:
    voice: str
    rate: str
    pitch: str
    volume: str
    output_stem: str


PROFILES = {
    "natural-child": NarrationProfile(
        voice="en-US-AnaNeural",
        rate="-5%",
        pitch="+0Hz",
        volume="+0%",
        output_stem="Fish-Shop-American-Girl-Natural",
    ),
    "slow-full-young-adult": NarrationProfile(
        voice="en-US-AvaNeural",
        rate="-10%",
        pitch="-2Hz",
        volume="+2%",
        output_stem="Fish-Shop-American-Young-Woman-Slow-Full",
    ),
}
DEFAULT_PROFILE = "natural-child"


def default_output_paths(
    profile: NarrationProfile, directory: Path
) -> tuple[Path, Path]:
    return (
        directory / f"{profile.output_stem}.wav",
        directory / f"{profile.output_stem}.mp3",
    )

SEGMENTS = [
    ("Fish Shop", 700),
    (
        "Hello, everyone. My name is Paisley. Today I want to tell you a story. "
        "The story is Fish Shop.",
        600,
    ),
    (
        "Josh and Kit are good friends. They both like fish very much. "
        "Josh likes fresh fish. Kit likes shellfish.",
        450,
    ),
    (
        "One sunny morning, they go to a fish shop together. The fish shop is nice and clean. "
        "There are many fish and shellfish. Josh sees a big pink fish. "
        "Kit sees some small shellfish.",
        400,
    ),
    (
        "Wow! This fish is big and fresh, says Josh. I like these shellfish, says Kit. "
        "Josh picks the fish. Kit gets the shellfish. Then they go home.",
        550,
    ),
    (
        "At home, they put the fish and shellfish in a big dish. The dish smells so good! "
        "Josh tries the shellfish. Kit tries the fish.",
        400,
    ),
    (
        "Wow! Shellfish is yummy, says Josh. Wow! Fish is yummy, too, says Kit. "
        "They eat together. Yum, yum, yum, says Josh. Yum, yum, yum, says Kit.",
        550,
    ),
    ("Now Josh likes shellfish, too. And Kit likes fish, too.", 450),
    (
        "Sometimes we only like what we know. But when we try, we may find something new. "
        "Sharing makes food better. What a yummy day!",
        600,
    ),
    ("That is my story. Thank you!", 300),
]


def _wave_format(reader: wave.Wave_read) -> tuple[int, int, int, str]:
    return (
        reader.getnchannels(),
        reader.getsampwidth(),
        reader.getframerate(),
        reader.getcomptype(),
    )


def combine_pcm_wavs(
    inputs: list[Path], pauses_ms: list[int], output: Path
) -> None:
    if not inputs:
        raise ValueError("At least one WAV input is required")
    if len(inputs) != len(pauses_ms):
        raise ValueError("Each WAV input must have one following pause")

    with wave.open(str(inputs[0]), "rb") as first:
        expected_format = _wave_format(first)

    channels, sample_width, sample_rate, compression = expected_format
    if channels != 1 or sample_width != 2 or compression != "NONE":
        raise ValueError("Inputs must be mono 16-bit PCM WAV files")

    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), "wb") as joined:
        joined.setnchannels(channels)
        joined.setsampwidth(sample_width)
        joined.setframerate(sample_rate)

        for path, pause_ms in zip(inputs, pauses_ms, strict=True):
            if pause_ms < 0:
                raise ValueError("Pause durations cannot be negative")
            with wave.open(str(path), "rb") as segment:
                if _wave_format(segment) != expected_format:
                    raise ValueError(f"WAV format mismatch: {path}")
                joined.writeframes(segment.readframes(segment.getnframes()))

            silence_frames = round(sample_rate * pause_ms / 1000)
            joined.writeframes(b"\x00" * silence_frames * sample_width * channels)


def _run_ffmpeg(arguments: list[str]) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", *arguments],
        check=True,
    )


async def synthesize_segments(
    temporary_directory: Path, profile: NarrationProfile
) -> list[Path]:
    import edge_tts

    wave_paths: list[Path] = []
    for index, (text, _) in enumerate(SEGMENTS, start=1):
        mp3_path = temporary_directory / f"segment-{index:02d}.mp3"
        wav_path = temporary_directory / f"segment-{index:02d}.wav"
        print(f"[{index:02d}/{len(SEGMENTS)}] {text}", flush=True)
        await edge_tts.Communicate(
            text,
            profile.voice,
            rate=profile.rate,
            pitch=profile.pitch,
            volume=profile.volume,
        ).save(str(mp3_path))
        _run_ffmpeg(
            [
                "-i",
                str(mp3_path),
                "-ar",
                "24000",
                "-ac",
                "1",
                "-c:a",
                "pcm_s16le",
                str(wav_path),
            ]
        )
        wave_paths.append(wav_path)
    return wave_paths


def generate_narration(
    output_wav: Path,
    output_mp3: Path,
    profile_name: str,
    profile: NarrationProfile,
) -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required to generate narration files")

    repo_root = Path(__file__).resolve().parents[1]
    temporary_root = repo_root / "tmp"
    temporary_root.mkdir(parents=True, exist_ok=True)
    output_wav = output_wav.resolve()
    output_mp3 = output_mp3.resolve()
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    output_mp3.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(
        prefix="fish-shop-neural-", dir=temporary_root
    ) as directory:
        segment_wavs = asyncio.run(synthesize_segments(Path(directory), profile))
        combine_pcm_wavs(
            segment_wavs,
            [pause for _, pause in SEGMENTS],
            output_wav,
        )

    _run_ffmpeg(
        [
            "-i",
            str(output_wav),
            "-c:a",
            "libmp3lame",
            "-b:a",
            "192k",
            str(output_mp3),
        ]
    )

    with wave.open(str(output_wav), "rb") as narration:
        duration = narration.getnframes() / narration.getframerate()
    print(
        json.dumps(
            {
                "profile": profile_name,
                "voice": profile.voice,
                "rate": profile.rate,
                "pitch": profile.pitch,
                "volume": profile.volume,
                "durationSeconds": round(duration, 3),
                "wav": str(output_wav),
                "mp3": str(output_mp3),
            },
            indent=2,
        ),
        flush=True,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate the Fish Shop story with an American child neural voice."
    )
    parser.add_argument(
        "--profile",
        choices=tuple(PROFILES),
        default=DEFAULT_PROFILE,
    )
    parser.add_argument(
        "--output-directory",
        type=Path,
        default=Path("deliverables"),
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    profile = PROFILES[args.profile]
    output_wav, output_mp3 = default_output_paths(profile, args.output_directory)
    generate_narration(output_wav, output_mp3, args.profile, profile)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
