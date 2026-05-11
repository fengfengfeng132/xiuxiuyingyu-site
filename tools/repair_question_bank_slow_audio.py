from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf

from generate_question_bank_audio_batch import slugify_audio_text, wav_duration_seconds


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Repair question-bank slow WAV files by stretching local model audio.")
    parser.add_argument("texts", nargs="+")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--target-ratio", type=float, default=1.45)
    parser.add_argument("--min-extra-seconds", type=float, default=0.35)
    parser.add_argument("--force", action="store_true")
    return parser


def phase_vocoder_stretch(channel: np.ndarray, stretch_ratio: float) -> np.ndarray:
    n_fft = 1024
    hop_length = 256
    if channel.size < n_fft:
        channel = np.pad(channel, (0, n_fft - channel.size))

    window = np.hanning(n_fft).astype(np.float32)
    frame_count = 1 + max(0, (channel.size - n_fft) // hop_length)
    spectra = np.empty((n_fft // 2 + 1, frame_count), dtype=np.complex64)

    for frame_index in range(frame_count):
        start = frame_index * hop_length
        frame = channel[start:start + n_fft] * window
        spectra[:, frame_index] = np.fft.rfft(frame)

    rate = 1.0 / stretch_ratio
    time_steps = np.arange(0, frame_count - 1, rate, dtype=np.float32)
    output = np.zeros(n_fft + hop_length * max(0, len(time_steps) - 1), dtype=np.float32)
    window_sum = np.zeros_like(output)

    phase_acc = np.angle(spectra[:, 0])
    expected_phase = 2.0 * np.pi * hop_length * np.arange(spectra.shape[0]) / n_fft

    for output_index, step in enumerate(time_steps):
        left = int(np.floor(step))
        right = min(left + 1, frame_count - 1)
        fraction = step - left
        magnitude = (1.0 - fraction) * np.abs(spectra[:, left]) + fraction * np.abs(spectra[:, right])

        phase_delta = np.angle(spectra[:, right]) - np.angle(spectra[:, left]) - expected_phase
        phase_delta -= 2.0 * np.pi * np.round(phase_delta / (2.0 * np.pi))
        phase_acc += expected_phase + phase_delta

        stretched_frame = np.fft.irfft(magnitude * np.exp(1.0j * phase_acc), n=n_fft).astype(np.float32)
        start = output_index * hop_length
        output[start:start + n_fft] += stretched_frame * window
        window_sum[start:start + n_fft] += window * window

    nonzero = window_sum > 1e-8
    output[nonzero] /= window_sum[nonzero]
    peak = np.max(np.abs(output)) if output.size else 0
    if peak > 1:
        output = output / peak
    return output


def stretch_audio(normal_path: Path, slow_path: Path, target_seconds: float) -> None:
    normal_seconds = wav_duration_seconds(normal_path)
    audio, sample_rate = sf.read(str(normal_path), dtype="float32", always_2d=True)
    stretch_ratio = target_seconds / normal_seconds
    stretched_channels = [
        phase_vocoder_stretch(audio[:, channel_index], stretch_ratio)
        for channel_index in range(audio.shape[1])
    ]
    max_length = max(channel.size for channel in stretched_channels)
    stretched = np.zeros((max_length, len(stretched_channels)), dtype=np.float32)
    for channel_index, channel in enumerate(stretched_channels):
        stretched[:channel.size, channel_index] = channel
    sf.write(str(slow_path), stretched, sample_rate, subtype="PCM_16")


def main() -> int:
    args = build_parser().parse_args()
    repo_root = args.repo_root.resolve()
    normal_dir = repo_root / "public/audio/question-bank/us"
    slow_dir = repo_root / "public/audio/question-bank/us-slow"

    for text in args.texts:
        slug = slugify_audio_text(text)
        normal_path = normal_dir / f"{slug}.wav"
        slow_path = slow_dir / f"{slug}.wav"
        if not normal_path.exists():
            raise FileNotFoundError(normal_path)

        normal_seconds = wav_duration_seconds(normal_path)
        old_slow_seconds = wav_duration_seconds(slow_path) if slow_path.exists() else 0
        target_seconds = max(normal_seconds * args.target_ratio, normal_seconds + args.min_extra_seconds)
        should_repair = args.force or old_slow_seconds <= normal_seconds * 1.1

        if should_repair:
            stretch_audio(normal_path, slow_path, target_seconds)

        print(json.dumps({
            "text": text,
            "normalSeconds": round(normal_seconds, 3),
            "oldSlowSeconds": round(old_slow_seconds, 3),
            "newSlowSeconds": round(wav_duration_seconds(slow_path), 3),
            "repaired": should_repair,
        }, ensure_ascii=False), flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
