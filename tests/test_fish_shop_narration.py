from __future__ import annotations

import importlib.util
import re
import tempfile
import unittest
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools/generate_fish_shop_narration.py"
WRAPPER = ROOT / "tools/New-FishShopNarration.ps1"

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


if not SCRIPT.exists():

    class MissingFishShopNarrationGeneratorTest(unittest.TestCase):
        def test_generator_exists(self) -> None:
            self.assertTrue(SCRIPT.exists(), f"Missing generator: {SCRIPT}")

else:
    SPEC = importlib.util.spec_from_file_location("fish_shop_narration", SCRIPT)
    if SPEC is None or SPEC.loader is None:
        raise RuntimeError(f"Cannot load {SCRIPT}")
    MODULE = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(MODULE)

    class FishShopNarrationTest(unittest.TestCase):
        def test_wrapper_uses_pinned_neural_tool_without_zira_fallback(self) -> None:
            self.assertTrue(WRAPPER.exists(), f"Missing wrapper: {WRAPPER}")
            source = WRAPPER.read_text(encoding="utf-8")
            self.assertIn("edge-tts==7.2.7", source)
            self.assertIn("generate_fish_shop_narration.py", source)
            self.assertNotIn("Zira", source)

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
