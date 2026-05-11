from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import wave
from pathlib import Path


DEFAULT_TTS_ROOT = Path(r"D:\AI\index-tts-nolfs")
DEFAULT_PROMPT_DIR = Path("tmp/index-tts-prompts")


def normalize_audio_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def read_daily_prompts(repo_root: Path) -> set[str]:
    source = (repo_root / "src/data/dailyLearningQuestions.ts").read_text(encoding="utf-8")
    return {
        match.group(1).strip().lower()
        for match in re.finditer(r"prompt:\s*'([^']+)'", source)
    }


def collect_question_bank_audio_texts(repo_root: Path) -> list[str]:
    raw_questions = json.loads((repo_root / "src/data/question_bank.json").read_text(encoding="utf-8"))
    daily_prompts = read_daily_prompts(repo_root)
    seen: set[str] = set()
    texts: list[str] = []

    for question in raw_questions:
        prompt = normalize_audio_text(str(question.get("prompt", "")))
        if prompt.lower() in daily_prompts:
            continue

        audio_text = normalize_audio_text(str(question.get("audioText") or prompt))
        key = audio_text.lower()
        if not audio_text or key in seen:
            continue

        seen.add(key)
        texts.append(audio_text)

    return texts


def slugify_audio_text(text: str) -> str:
    normalized = text.lower().replace("’", "'")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    if not slug:
        slug = "audio"

    if re.fullmatch(r"[a-z]+(?:-[a-z]+)*", slug) and " " not in text and len(slug) <= 48:
        return slug

    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]
    return f"{slug[:56].strip('-')}-{digest}"


def wav_duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as wav_file:
        return wav_file.getnframes() / float(wav_file.getframerate())


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate question-bank audio with IndexTTS2 in small batches.")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--tts-root", type=Path, default=DEFAULT_TTS_ROOT)
    parser.add_argument("--prompt-dir", type=Path, default=DEFAULT_PROMPT_DIR)
    parser.add_argument("--batch-index", type=int, default=1, help="1-based batch number")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--texts", nargs="*", help="Generate only these audio texts instead of a numbered batch")
    parser.add_argument("--audio-mode", choices=("both", "normal", "slow"), default="both")
    parser.add_argument("--slow-length-penalty", type=float, default=0.8)
    parser.add_argument("--force", action="store_true", help="Regenerate files even if they already exist")
    parser.add_argument("--list-only", action="store_true", help="Print selected batch without generating audio")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    repo_root = args.repo_root.resolve()
    tts_root = args.tts_root.resolve()
    prompt_dir = (repo_root / args.prompt_dir).resolve()

    if args.batch_index < 1:
        raise ValueError("--batch-index must be 1 or greater")
    if args.batch_size < 1 or args.batch_size > 10:
        raise ValueError("--batch-size must stay between 1 and 10")

    all_texts = collect_question_bank_audio_texts(repo_root)
    if args.texts:
        text_by_key = {normalize_audio_text(text).lower(): text for text in all_texts}
        selected = []
        missing_texts = []
        for text in args.texts:
            key = normalize_audio_text(text).lower()
            if key in text_by_key:
                selected.append(text_by_key[key])
            else:
                missing_texts.append(text)

        if missing_texts:
            raise ValueError(f"--texts contains items that are not in the question bank: {missing_texts}")
    else:
        start = (args.batch_index - 1) * args.batch_size
        selected = all_texts[start:start + args.batch_size]
    if not selected:
        print(json.dumps({"batchIndex": args.batch_index, "items": []}, ensure_ascii=False, indent=2))
        return 0

    normal_prompt = prompt_dir / "zira-reference.wav"
    slow_prompt = prompt_dir / "zira-reference-slow.wav"
    if not normal_prompt.exists() or not slow_prompt.exists():
        raise FileNotFoundError(f"Missing reference prompt files in {prompt_dir}")

    normal_dir = repo_root / "public/audio/question-bank/us"
    slow_dir = repo_root / "public/audio/question-bank/us-slow"
    normal_dir.mkdir(parents=True, exist_ok=True)
    slow_dir.mkdir(parents=True, exist_ok=True)

    batch_manifest = [
        {
            "text": text,
            "slug": slugify_audio_text(text),
            "normal": f"/audio/question-bank/us/{slugify_audio_text(text)}.wav",
            "slow": f"/audio/question-bank/us-slow/{slugify_audio_text(text)}.wav",
        }
        for text in selected
    ]

    print(json.dumps({"batchIndex": args.batch_index, "batchSize": args.batch_size, "items": batch_manifest}, ensure_ascii=False, indent=2), flush=True)
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

    for item in batch_manifest:
        text = item["text"]
        normal_path = normal_dir / f"{item['slug']}.wav"
        slow_path = slow_dir / f"{item['slug']}.wav"

        if args.audio_mode in ("both", "normal") and (args.force or not normal_path.exists()):
            print(f"[normal] {text} -> {normal_path}", flush=True)
            tts.infer(
                spk_audio_prompt=str(normal_prompt),
                text=text,
                output_path=str(normal_path),
                length_penalty=0.0,
                **common_kwargs,
            )

        if args.audio_mode in ("both", "slow") and (args.force or not slow_path.exists()):
            print(f"[slow] {text} -> {slow_path}", flush=True)
            tts.infer(
                spk_audio_prompt=str(slow_prompt),
                text=text,
                output_path=str(slow_path),
                length_penalty=args.slow_length_penalty,
                **common_kwargs,
            )

        print(json.dumps({
            "text": text,
            "normalSeconds": round(wav_duration_seconds(normal_path), 3),
            "slowSeconds": round(wav_duration_seconds(slow_path), 3),
        }, ensure_ascii=False), flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
