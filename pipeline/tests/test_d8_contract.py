"""The D8 code table is shared between the pipeline and the engine.

The pipeline writes flow directions as integers; the engine reads them back and
follows water downhill. Nothing in either codebase checks that the two agree on
what a `1` means — and if they stop agreeing, every symptom is invisible. The
build succeeds, the tests pass, the map renders, water flows somewhere
plausible, and every answer is wrong in a way no reviewer would spot.

So this test does not restate the table. It reads the TypeScript declaration and
compares it, which is the only version of this check that can actually fail when
somebody edits one side.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from drainlens_pipeline.hydrology import D8_OFFSETS, LEAVES_WINDOW

ENGINE_SOURCE = Path(__file__).resolve().parents[2] / "packages" / "scenario" / "src" / "flow.ts"


def parse_typescript_offsets(source: str) -> list[tuple[int, int]]:
    block = re.search(
        r"D8_OFFSETS[^=]*=\s*\[(.*?)\];", source, re.DOTALL
    )
    if block is None:
        raise AssertionError("no D8_OFFSETS declaration found in flow.ts")
    return [
        (int(dx), int(dy))
        for dx, dy in re.findall(r"\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]", block.group(1))
    ]


@pytest.fixture(scope="module")
def engine_source() -> str:
    if not ENGINE_SOURCE.exists():
        pytest.skip(f"{ENGINE_SOURCE} is not present")
    return ENGINE_SOURCE.read_text(encoding="utf-8")


class TestD8Contract:
    def test_the_offsets_match_the_engine_exactly(self, engine_source):
        assert list(D8_OFFSETS) == parse_typescript_offsets(engine_source)

    def test_the_order_is_the_documented_compass_sequence(self, engine_source):
        # Named rather than positional, so a reordering that keeps the same set
        # of offsets still fails here with a readable message.
        compass = {
            "E": (1, 0),
            "SE": (1, 1),
            "S": (0, 1),
            "SW": (-1, 1),
            "W": (-1, 0),
            "NW": (-1, -1),
            "N": (0, -1),
            "NE": (1, -1),
        }
        assert list(D8_OFFSETS) == list(compass.values())
        assert parse_typescript_offsets(engine_source) == list(compass.values())

    def test_rows_increase_southward(self):
        # The sign convention is the half of this contract a reader is most
        # likely to assume rather than check. South is +1 on the row axis,
        # which is what makes row 0 the northern edge of the ground surface.
        assert D8_OFFSETS[2] == (0, 1), "code 2 is S, so south must be +1"
        assert D8_OFFSETS[6] == (0, -1), "code 6 is N, so north must be -1"

    def test_both_files_spell_out_the_same_compass_order_in_prose(self, engine_source):
        # A future editor reads the comment, not the array. If the two drift,
        # the comment is what will mislead them.
        order = "e, se, s, sw, w, nw, n, ne"
        from drainlens_pipeline import hydrology

        assert order in engine_source.lower()
        assert order in (hydrology.__doc__ or "") + open(
            hydrology.__file__, encoding="utf-8"
        ).read().lower()

    def test_leaves_window_matches_the_engine(self, engine_source):
        declared = re.search(r"LEAVES_WINDOW\s*=\s*(-?\d+)", engine_source)
        assert declared is not None, "flow.ts no longer declares LEAVES_WINDOW"
        assert int(declared.group(1)) == LEAVES_WINDOW

    def test_leaves_window_cannot_collide_with_a_direction_code(self):
        assert LEAVES_WINDOW not in range(len(D8_OFFSETS))

    def test_there_are_eight_of_them(self, engine_source):
        assert len(D8_OFFSETS) == 8
        assert len(parse_typescript_offsets(engine_source)) == 8

    def test_every_offset_is_a_distinct_single_step(self):
        assert len(set(D8_OFFSETS)) == 8
        assert all(max(abs(dc), abs(dr)) == 1 for dc, dr in D8_OFFSETS)
        assert (0, 0) not in D8_OFFSETS
