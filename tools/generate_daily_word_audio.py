from __future__ import annotations

import argparse
import json
import os
import re
import sys
import wave
from pathlib import Path


DEFAULT_TTS_ROOT = Path(r"D:\AI\index-tts-nolfs")
DEFAULT_PROMPT_DIR = Path("tmp/index-tts-prompts")


def read_dictation_words(repo_root: Path) -> list[str]:
    source = (repo_root / "src/data/dictationWords.ts").read_text(encoding="utf-8")
    return [match.group(1) for match in re.finditer(r"word:\s*'([^']+)'", source)]


def wav_duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as wav_file:
        return wav_file.getnframes() / float(wav_file.getframerate())


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate daily dictation word audio with IndexTTS2.")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--tts-root", type=Path, default=DEFAULT_TTS_ROOT)
    parser.add_argument("--prompt-dir", type=Path, default=DEFAULT_PROMPT_DIR)
    parser.add_argument("--output-root", type=Path, default=Path("tmp/daily-word-audio"))
    parser.add_argument("--audio-mode", choices=("both", "normal", "slow"), default="both")
    parser.add_argument("--slow-length-penalty", type=float, default=0.8)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--list-only", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    repo_root = args.repo_root.resolve()
    tts_root = args.tts_root.resolve()
    prompt_dir = (repo_root / args.prompt_dir).resolve()
    output_root = (repo_root / args.output_root).resolve()
    words = read_dictation_words(repo_root)

    normal_prompt = prompt_dir / "zira-reference.wav"
    slow_prompt = prompt_dir / "zira-reference-slow.wav"
    if not normal_prompt.exists() or not slow_prompt.exists():
        raise FileNotFoundError(f"Missing reference prompt files in {prompt_dir}")

    normal_dir = output_root / "us"
    slow_dir = output_root / "us-slow"
    normal_dir.mkdir(parents=True, exist_ok=True)
    slow_dir.mkdir(parents=True, exist_ok=True)

    manifest = [
        {
            "word": word,
            "normal": str(normal_dir / f"{word}.wav"),
            "slow": str(slow_dir / f"{word}.wav"),
        }
        for word in words
    ]
    print(json.dumps({"count": len(manifest), "items": manifest}, ensure_ascii=False, indent=2), flush=True)

    if args.list_only:
        return 0

    sys.path.insert(0, str(tts_root))
    os.chdir(tts_root)

    import torch
    from indextts.infer_v2 import IndexTTS2

    tts = IndexTTS2(
        cfg_path=str(tts_root / "checkpoints/config.yaml"),
        model_dir=str(tts_root / "checkpoints"),
        use_fp16=torch.cuda.is_available(),
    )

    common_kwargs = {
        "do_sample": True,
        "top_p": 0.8,
        "top_k": 30,
        "temperature": 0.8,
        "num_beams": 3,
        "repetition_penalty": 10.0,
        "max_mel_tokens": 1500,
        "use_random": False,
        "verbose": False,
    }

    for item in manifest:
        word = item["word"]
        normal_path = Path(item["normal"])
        slow_path = Path(item["slow"])

        if args.audio_mode in ("both", "normal") and (args.force or not normal_path.exists()):
            print(f"[normal] {word} -> {normal_path}", flush=True)
            tts.infer(
                spk_audio_prompt=str(normal_prompt),
                text=word,
                output_path=str(normal_path),
                length_penalty=0.0,
                **common_kwargs,
            )

        if args.audio_mode in ("both", "slow") and (args.force or not slow_path.exists()):
            print(f"[slow] {word} -> {slow_path}", flush=True)
            tts.infer(
                spk_audio_prompt=str(slow_prompt),
                text=word,
                output_path=str(slow_path),
                length_penalty=args.slow_length_penalty,
                **common_kwargs,
            )

        print(json.dumps({
            "word": word,
            "normalSeconds": round(wav_duration_seconds(normal_path), 3),
            "slowSeconds": round(wav_duration_seconds(slow_path), 3),
        }, ensure_ascii=False), flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
