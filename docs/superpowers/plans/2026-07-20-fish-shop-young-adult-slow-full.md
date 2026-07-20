# Fish Shop Young-Adult Slow Full Narration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slower, fuller young-adult American female narration without changing or overwriting the existing child narration.

**Architecture:** Refactor the existing generator around immutable named narration profiles. Both profiles reuse the exact text segments, PCM joiner, FFmpeg export, and pinned one-off Edge TTS runtime; only synthesis settings and output stems vary.

**Tech Stack:** Python 3.12 standard library, `edge-tts==7.2.7` through `uv`, FFmpeg 8, Python `unittest`, PowerShell, npm/Vitest/Vite.

---

## File Structure

- Modify `tools/generate_fish_shop_narration.py`: named profile model, profile-aware synthesis, and output naming.
- Modify `tools/New-FishShopNarration.ps1`: validated `-Profile` argument and profile-aware invocation.
- Modify `tests/test_fish_shop_narration.py`: protect the child profile and lock the new Ava parameters and filenames.
- Generate `deliverables/Fish-Shop-American-Young-Woman-Slow-Full.wav`.
- Generate `deliverables/Fish-Shop-American-Young-Woman-Slow-Full.mp3`.
- Modify `docs/maintenance-lessons.md`: record why a separate young-adult variant was added and how it was verified.

### Task 1: Lock both narration profiles with a failing test

**Files:**
- Modify: `tests/test_fish_shop_narration.py`
- Test: `tests/test_fish_shop_narration.py`

- [ ] **Step 1: Replace the single-voice assertion with profile assertions**

Add tests with these exact expectations:

Before executing the dynamically loaded generator module, import `sys` and register it so the frozen dataclass can resolve its module metadata:

```python
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
```

```python
def test_preserves_the_existing_child_profile(self) -> None:
    profile = MODULE.PROFILES["natural-child"]
    self.assertEqual(profile.voice, "en-US-AnaNeural")
    self.assertEqual(profile.rate, "-5%")
    self.assertEqual(profile.pitch, "+0Hz")
    self.assertEqual(profile.volume, "+0%")
    self.assertEqual(profile.output_stem, "Fish-Shop-American-Girl-Natural")

def test_defines_the_approved_slow_full_young_adult_profile(self) -> None:
    profile = MODULE.PROFILES["slow-full-young-adult"]
    self.assertEqual(profile.voice, "en-US-AvaNeural")
    self.assertEqual(profile.rate, "-10%")
    self.assertEqual(profile.pitch, "-2Hz")
    self.assertEqual(profile.volume, "+2%")
    self.assertEqual(
        profile.output_stem,
        "Fish-Shop-American-Young-Woman-Slow-Full",
    )

def test_profile_output_paths_do_not_overlap(self) -> None:
    directory = Path("deliverables")
    child = MODULE.default_output_paths(MODULE.PROFILES["natural-child"], directory)
    adult = MODULE.default_output_paths(
        MODULE.PROFILES["slow-full-young-adult"], directory
    )
    self.assertNotEqual(child, adult)
    self.assertEqual(adult[0].name, "Fish-Shop-American-Young-Woman-Slow-Full.wav")
    self.assertEqual(adult[1].name, "Fish-Shop-American-Young-Woman-Slow-Full.mp3")
```

Update the wrapper test to assert that its source contains `ValidateSet`, both profile names, and `--profile` while still containing no `Zira`.

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests/test_fish_shop_narration.py -v
```

Expected: FAIL because `PROFILES` and `default_output_paths` do not exist and the wrapper has no profile selector.

### Task 2: Implement reusable narration profiles

**Files:**
- Modify: `tools/generate_fish_shop_narration.py`
- Modify: `tools/New-FishShopNarration.ps1`
- Test: `tests/test_fish_shop_narration.py`

- [ ] **Step 1: Add the immutable profile model and values**

Add this model and mapping above `SEGMENTS`:

```python
from dataclasses import dataclass


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
```

Add:

```python
def default_output_paths(profile: NarrationProfile, directory: Path) -> tuple[Path, Path]:
    return (
        directory / f"{profile.output_stem}.wav",
        directory / f"{profile.output_stem}.mp3",
    )
```

- [ ] **Step 2: Thread the profile through synthesis and generation**

Change `synthesize_segments` to accept `profile: NarrationProfile` and call:

```python
edge_tts.Communicate(
    text,
    profile.voice,
    rate=profile.rate,
    pitch=profile.pitch,
    volume=profile.volume,
)
```

Change `generate_narration` to accept the selected profile and include all four synthesis settings in its JSON result. Keep `SEGMENTS`, `combine_pcm_wavs`, 24000 Hz PCM conversion, and 192 kbps MP3 export unchanged.

- [ ] **Step 3: Add profile-aware CLI and PowerShell entry point**

Python CLI arguments:

```python
parser.add_argument("--profile", choices=tuple(PROFILES), default=DEFAULT_PROFILE)
parser.add_argument("--output-directory", type=Path, default=Path("deliverables"))
```

`main()` must select `PROFILES[args.profile]`, call `default_output_paths`, and generate those paths.

PowerShell parameters and invocation:

```powershell
param(
  [ValidateSet("natural-child", "slow-full-young-adult")]
  [string]$Profile = "natural-child",
  [string]$OutputDirectory = ".\deliverables"
)

& $uv.Source run --with "edge-tts==7.2.7" python $generator `
  --profile $Profile `
  --output-directory $resolvedOutputDirectory
```

Compute the returned filenames from the selected profile and retain the nonzero-exit check.

- [ ] **Step 4: Run the focused test and verify green**

Run the Task 1 test command again.

Expected: seven tests PASS.

- [ ] **Step 5: Commit the profile refactor**

Stage only the generator, wrapper, and focused test. Use a Lore commit whose intent is “Let one verified story support distinct voices without duplicated text,” with `Tested:` naming the seven Python tests and `Scope-risk: narrow`.

### Task 3: Generate, verify, and document the new delivery files

**Files:**
- Generate: `deliverables/Fish-Shop-American-Young-Woman-Slow-Full.wav`
- Generate: `deliverables/Fish-Shop-American-Young-Woman-Slow-Full.mp3`
- Modify: `docs/maintenance-lessons.md`
- Modify: `docs/superpowers/plans/2026-07-20-fish-shop-young-adult-slow-full.md`

- [ ] **Step 1: Record existing child hashes before generation**

Run:

```powershell
Get-FileHash -Algorithm SHA256 `
  '.\deliverables\Fish-Shop-American-Girl-Natural.wav', `
  '.\deliverables\Fish-Shop-American-Girl-Natural.mp3'
```

Expected hashes:

```text
WAV 3451C5842B92C3CB3675B717DF66711F6EC560E08B67BDA733B9D9DB4DD6E5DC
MP3 18BE3A38B1AF872831FAF241A87AB91FEBD9EE7E345855CB6BA0701AF91B902F
```

- [ ] **Step 2: Generate the young-adult slow-full profile**

Run:

```powershell
& '.\tools\New-FishShopNarration.ps1' -Profile 'slow-full-young-adult'
```

Expected: ten segments use AvaNeural and both new delivery files are created without touching the child files.

- [ ] **Step 3: Verify duration, codec, peak, tail, and preserved hashes**

Use FFprobe and the bundled Python/NumPy runtime. Assert:

```text
new WAV codec = pcm_s16le
new WAV channels = 1
new WAV sample rate = 24000
118.4 < new duration <= 140
abs(WAV duration - MP3 duration) <= 0.1
peak < 32767
last 250 ms RMS < 10
child WAV and MP3 hashes equal the Step 1 values
```

- [ ] **Step 4: Update maintenance lessons**

Record the request for a slightly slower and fuller variant, the chosen Ava profile, why post-EQ was rejected, both new paths, actual duration/signal evidence, preserved child hashes, and the remaining subjective listening check.

- [ ] **Step 5: Run full verification**

Run:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests/test_fish_shop_narration.py -v
npm run lint
npm run test
npm run build
git diff --check
```

Expected: seven Python tests pass, the isolated branch Vitest baseline passes, lint and build exit 0, and diff check reports no errors.

- [ ] **Step 6: Commit artifacts and evidence**

Stage only both new audio files, maintenance lessons, and this completed plan. Use a Lore commit whose intent is “Offer a fuller slower reading without taking away the child version,” with `Tested:` listing Python/lint/Vitest/build/signal checks and `Not-tested:` recording the user's subjective listening check.
