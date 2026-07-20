# Fish Shop Natural Child Narration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mechanical Zira rendition with a verified American child neural-voice narration while preserving every word of the supplied composition.

**Architecture:** A focused Python generator stores the approved paragraph segments, calls `en-US-AnaNeural` through a pinned one-off `edge-tts` runtime, converts each segment to canonical PCM with FFmpeg, and joins the segments with explicit paragraph silences. The existing PowerShell entry point becomes a small wrapper so regeneration stays simple without adding a project dependency.

**Tech Stack:** Python standard library, `edge-tts==7.2.7` through `uv`, FFmpeg 8, Python `unittest`, npm/Vitest/Vite.

---

## File Structure

- Create `tools/generate_fish_shop_narration.py`: text segmentation, neural synthesis, PCM concatenation, and MP3 export.
- Modify `tools/New-FishShopNarration.ps1`: reproducible Windows wrapper for the pinned one-off tool runtime.
- Create `tests/test_fish_shop_narration.py`: transcript, voice configuration, pause bounds, and PCM concatenation regression tests.
- Generate `deliverables/Fish-Shop-American-Girl-Natural.wav`: canonical PCM delivery file.
- Generate `deliverables/Fish-Shop-American-Girl-Natural.mp3`: compact delivery file.
- Modify `docs/maintenance-lessons.md`: root cause, new treatment, evidence, and future warning.

### Task 1: Lock the narration contract with failing tests

**Files:**
- Create: `tests/test_fish_shop_narration.py`
- Test: `tests/test_fish_shop_narration.py`

- [ ] **Step 1: Write the failing contract test**

```python
from __future__ import annotations

import importlib.util
import re
import tempfile
import unittest
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools/generate_fish_shop_narration.py"
SPEC = importlib.util.spec_from_file_location("fish_shop_narration", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Cannot load {SCRIPT}")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

EXPECTED_TEXT = """Fish Shop
Hello, everyone. My name is Paisley. Today I want to tell you a story. The story is Fish Shop.
Josh and Kit are good friends. They both like fish very much. Josh likes fresh fish. Kit likes shellfish.
One sunny morning, they go to a fish shop together. The fish shop is nice and clean. There are many fish and shellfish. Josh sees a big pink fish. Kit sees some small shellfish.
Wow! This fish is big and fresh, says Josh. I like these shellfish, says Kit. Josh picks the fish. Kit gets the shellfish. Then they go home.
At home, they put the fish and shellfish in a big dish. The dish smells so good! Josh tries the shellfish. Kit tries the fish.
Wow! Shellfish is yummy, says Josh. Wow! Fish is yummy, too, says Kit. They eat together. Yum, yum, yum, says Josh. Yum, yum, yum, says Kit.
Now Josh likes shellfish, too. And Kit likes fish, too.
Sometimes we only like what we know. But when we try, we may find something new. Sharing makes food better. What a yummy day!
That is my story. Thank you!"""


def words(text: str) -> list[str]:
    return re.findall(r"[a-z]+", text.lower())


class FishShopNarrationTest(unittest.TestCase):
    def test_uses_approved_child_voice_and_gentle_rate(self) -> None:
        self.assertEqual(MODULE.VOICE, "en-US-AnaNeural")
        self.assertEqual(MODULE.RATE, "-5%")

    def test_segments_preserve_every_source_word_in_order(self) -> None:
        actual = " ".join(text for text, _ in MODULE.SEGMENTS)
        self.assertEqual(words(actual), words(EXPECTED_TEXT))

    def test_paragraph_pauses_are_natural_and_bounded(self) -> None:
        pauses = [pause for _, pause in MODULE.SEGMENTS]
        self.assertGreaterEqual(len(pauses), 8)
        self.assertTrue(all(300 <= pause <= 750 for pause in pauses))

    def test_pcm_join_inserts_the_requested_silence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inputs = [root / "one.wav", root / "two.wav"]
            for path in inputs:
                with wave.open(str(path), "wb") as output:
                    output.setnchannels(1)
                    output.setsampwidth(2)
                    output.setframerate(1000)
                    output.writeframes(b"\x01\x00" * 100)
            result = root / "joined.wav"
            MODULE.combine_pcm_wavs(inputs, [50, 0], result)
            with wave.open(str(result), "rb") as joined:
                self.assertEqual(joined.getnframes(), 250)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test and verify the red state**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests/test_fish_shop_narration.py -v
```

Expected: FAIL because `tools/generate_fish_shop_narration.py` does not exist yet.

### Task 2: Implement the neural narration generator

**Files:**
- Create: `tools/generate_fish_shop_narration.py`
- Test: `tests/test_fish_shop_narration.py`

- [ ] **Step 1: Add the approved voice, exact segments, and PCM joiner**

Implement these public contracts exactly:

```python
VOICE = "en-US-AnaNeural"
RATE = "-5%"
SEGMENTS = [
    ("Fish Shop", 700),
    ("Hello, everyone. My name is Paisley. Today I want to tell you a story. The story is Fish Shop.", 600),
    ("Josh and Kit are good friends. They both like fish very much. Josh likes fresh fish. Kit likes shellfish.", 450),
    ("One sunny morning, they go to a fish shop together. The fish shop is nice and clean. There are many fish and shellfish. Josh sees a big pink fish. Kit sees some small shellfish.", 400),
    ("Wow! This fish is big and fresh, says Josh. I like these shellfish, says Kit. Josh picks the fish. Kit gets the shellfish. Then they go home.", 550),
    ("At home, they put the fish and shellfish in a big dish. The dish smells so good! Josh tries the shellfish. Kit tries the fish.", 400),
    ("Wow! Shellfish is yummy, says Josh. Wow! Fish is yummy, too, says Kit. They eat together. Yum, yum, yum, says Josh. Yum, yum, yum, says Kit.", 550),
    ("Now Josh likes shellfish, too. And Kit likes fish, too.", 450),
    ("Sometimes we only like what we know. But when we try, we may find something new. Sharing makes food better. What a yummy day!", 600),
    ("That is my story. Thank you!", 300),
]
```

`combine_pcm_wavs(inputs, pauses_ms, output)` must copy matching mono 16-bit PCM streams with Python `wave`, insert zero-valued frames using `round(sample_rate * pause_ms / 1000)`, and raise `ValueError` when input formats or list lengths differ.

- [ ] **Step 2: Add synthesis and export**

Inside `async synthesize(...)`, import `edge_tts`, save one MP3 per segment with `edge_tts.Communicate(text, VOICE, rate=RATE)`, then convert each segment using:

```python
subprocess.run(
    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3_path),
     "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", str(wav_path)],
    check=True,
)
```

Use `tempfile.TemporaryDirectory(prefix="fish-shop-neural-", dir=repo_root / "tmp")`, call `combine_pcm_wavs`, and export the final MP3 with:

```python
subprocess.run(
    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(output_wav),
     "-c:a", "libmp3lame", "-b:a", "192k", str(output_mp3)],
    check=True,
)
```

Fail before synthesis if `ffmpeg` is unavailable. Create output directories but never overwrite or delete the old `Fish-Shop-American-Female.wav` file.

- [ ] **Step 3: Run the focused test and verify green**

Run the Task 1 command again.

Expected: four tests PASS.

- [ ] **Step 4: Commit the tested generator**

Stage only the new Python generator and its test. Use a Lore commit whose intent is “Make the story sound like a child speaking naturally,” with `Tested:` naming the four Python unit tests and `Scope-risk: narrow`.

### Task 3: Replace the legacy entry point and generate both files

**Files:**
- Modify: `tools/New-FishShopNarration.ps1`
- Generate: `deliverables/Fish-Shop-American-Girl-Natural.wav`
- Generate: `deliverables/Fish-Shop-American-Girl-Natural.mp3`

- [ ] **Step 1: Replace the System.Speech implementation with a pinned wrapper**

The wrapper must resolve the repository root, require `uv`, and invoke:

```powershell
uv run --with 'edge-tts==7.2.7' python `
  '.\tools\generate_fish_shop_narration.py' `
  --output-wav '.\deliverables\Fish-Shop-American-Girl-Natural.wav' `
  --output-mp3 '.\deliverables\Fish-Shop-American-Girl-Natural.mp3'
```

Throw when `$LASTEXITCODE -ne 0`. Do not retain Zira fallback logic.

- [ ] **Step 2: Generate the approved narration**

Run:

```powershell
& '.\tools\New-FishShopNarration.ps1'
```

Expected: ten neural segments are synthesized, both final files exist, and the old Zira WAV remains unchanged.

- [ ] **Step 3: Verify codec and duration**

Run:

```powershell
ffprobe -v error -show_entries format=duration:stream=codec_name,sample_rate,channels -of json '.\deliverables\Fish-Shop-American-Girl-Natural.wav'
ffprobe -v error -show_entries format=duration:stream=codec_name,sample_rate,channels -of json '.\deliverables\Fish-Shop-American-Girl-Natural.mp3'
```

Expected: WAV is `pcm_s16le`, mono, 24000 Hz; MP3 is mono; both durations differ by less than 0.1 seconds.

### Task 4: Validate quality and record the maintenance lesson

**Files:**
- Modify: `docs/maintenance-lessons.md`
- Test: `tests/test_fish_shop_narration.py`

- [ ] **Step 1: Run signal-quality checks**

Read the final WAV with the bundled Python runtime and NumPy. Assert peak amplitude is below 32767, the last 250 ms RMS is below 10, duration is between 80 and 150 seconds, and the file uses one channel, two-byte samples, and 24000 Hz.

- [ ] **Step 2: Update maintenance lessons**

Record the reported mechanical voice, the Zira root cause, the `AnaNeural` paragraph-generation treatment, exact output paths, unit/signal/project verification, and the warning never to silently fall back to Zira.

- [ ] **Step 3: Run full verification**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests/test_fish_shop_narration.py -v
npm run lint
npm run test
npm run build
git diff --check
```

Expected: four Python tests pass, 109 existing Vitest tests pass, lint exits 0, build exits 0, and diff check reports no errors.

- [ ] **Step 4: Commit the wrapper, artifacts, and maintenance record**

Stage only `tools/New-FishShopNarration.ps1`, both new delivery files, the implementation plan, and `docs/maintenance-lessons.md`. Use a Lore commit whose intent is “Let learners hear the story in a believable child voice,” with `Rejected:` documenting the Zira fallback, `Tested:` listing Python/lint/Vitest/build/signal checks, and `Not-tested:` stating that subjective listening remains for the user.
