"""Moving an artefact from one extent's frame into another's.

The bug this prevents is silent and looks like a map: Kensington-frame shapes
drawn over a council-frame map land 1.5 km west and 6 km south of where they
belong. This repository has had that failure once, in 0.15.0, when the
interface and the pipeline disagreed about a pit's grid cell and all 895 drains
came out wrong -- with the interface blaming the council's data for it.
"""

from __future__ import annotations

import json

import pytest

from drainlens_pipeline.geo import CITY_OF_MELBOURNE, DEMONSTRATION_EXTENT, MELBOURNE_CBD, Extent
from drainlens_pipeline.reframe import ReframeError, combine, main, reframe, shift_coordinates


def artefact(**layers) -> dict:
    return {
        "artefact": "derived-layers",
        "basis": "derived",
        "extent": {"name": "kensington", "width_m": 1000, "height_m": 1000},
        "layers": layers,
    }


class TestShiftingCoordinates:
    def test_it_moves_a_bare_pair(self):
        assert shift_coordinates([10, 20], 1500, 6000) == [1510.0, 6020.0]

    def test_it_moves_a_line(self):
        assert shift_coordinates([[0, 0], [10, 10]], 1500, 6000) == [
            [1500.0, 6000.0],
            [1510.0, 6010.0],
        ]

    def test_it_moves_polygon_rings(self):
        # A ring is a list of lists of pairs, which is where a function that
        # knew each layer's shape would have to grow a third branch.
        moved = shift_coordinates([[[0, 0], [1, 1], [0, 0]]], 1500, 6000)
        assert moved == [[[1500.0, 6000.0], [1501.0, 6001.0], [1500.0, 6000.0]]]

    def test_it_rounds_to_a_decimetre_like_everything_else(self):
        assert shift_coordinates([0.123456, 0.987654], 0, 0) == [0.1, 1.0]

    def test_it_leaves_anything_that_is_not_a_pair_alone(self):
        # Recursive rather than keyed on layer names, so a layer added later
        # cannot silently stay in the old frame -- but a string or a number is
        # not a coordinate and must come back untouched.
        assert shift_coordinates("a line", 1500, 6000) == "a line"
        assert shift_coordinates(7, 1500, 6000) == 7

    def test_it_does_not_mistake_a_two_element_list_of_lists_for_a_pair(self):
        assert shift_coordinates([[0, 0], [1, 1]], 1, 1) == [[1.0, 1.0], [2.0, 2.0]]


class TestReframe:
    def test_it_shifts_by_the_difference_between_the_two_corners(self):
        # Kensington's origin is the council's (1500, 6000): 316,500 - 315,000
        # and 5,814,500 - 5,808,500.
        moved = reframe(
            artefact(channel=[{"g": "line", "c": [[0, 0]]}]),
            DEMONSTRATION_EXTENT,
            CITY_OF_MELBOURNE,
        )
        assert moved["layers"]["channel"][0]["c"] == [[1500.0, 6000.0]]

    def test_it_restates_the_extent_it_now_belongs_to(self):
        moved = reframe(artefact(channel=[]), DEMONSTRATION_EXTENT, CITY_OF_MELBOURNE)
        assert moved["extent"] == {
            "name": "city-of-melbourne",
            "width_m": 8500.0,
            "height_m": 9000.0,
        }

    def test_it_keeps_everything_about_a_shape_but_its_coordinates(self):
        moved = reframe(
            artefact(**{"low-point": [{"g": "polygon", "c": [[[0, 0]]], "depth_m": 0.4}]}),
            DEMONSTRATION_EXTENT,
            CITY_OF_MELBOURNE,
        )
        assert moved["layers"]["low-point"][0]["depth_m"] == 0.4
        assert moved["layers"]["low-point"][0]["g"] == "polygon"

    def test_it_says_what_the_layers_do_and_do_not_cover(self):
        # The shapes cannot say it themselves, and a reader looking at 75 km2
        # with no water paths on it needs to know the difference between "no
        # water goes here" and "nobody measured this ground".
        covers = reframe(artefact(channel=[]), DEMONSTRATION_EXTENT, CITY_OF_MELBOURNE)["covers"]
        assert "has not been measured" in covers
        assert "nothing is claimed" in covers

    def test_it_refuses_an_artefact_that_is_not_from_the_extent_named(self):
        # Reframing the wrong artefact by the right offset is the failure this
        # whole module exists to prevent, so it is checked rather than assumed.
        wrong = artefact(channel=[])
        wrong["extent"]["name"] = "somewhere-else"
        with pytest.raises(ReframeError, match="somewhere-else"):
            reframe(wrong, DEMONSTRATION_EXTENT, CITY_OF_MELBOURNE)

    def test_it_refuses_a_source_that_is_not_inside_the_target(self):
        # An artefact half outside the map it is drawn on is a question about
        # which extents were meant, not something to shift into place.
        outside = Extent("kensington", 900_000.0, 900_000.0, 901_000.0, 901_000.0)
        with pytest.raises(ReframeError, match="not inside"):
            reframe(artefact(channel=[]), outside, CITY_OF_MELBOURNE)

    def test_moving_an_extent_into_itself_changes_nothing(self):
        # The identity case, which is worth having because it is what a build
        # of the pilot extent alone will hit.
        same = reframe(
            artefact(channel=[{"g": "line", "c": [[10, 20]]}]),
            DEMONSTRATION_EXTENT,
            DEMONSTRATION_EXTENT,
        )
        assert same["layers"]["channel"][0]["c"] == [[10.0, 20.0]]

    def test_every_shape_moves_by_the_same_offset(self):
        # The whole-artefact invariant. One shape left behind is a path that
        # starts in the right street and ends in another suburb.
        given = artefact(
            channel=[{"g": "line", "c": [[0, 0], [100, 100]]}],
            **{"low-point": [{"g": "polygon", "c": [[[50, 50], [60, 60], [50, 50]]]}]},
        )
        moved = reframe(given, DEMONSTRATION_EXTENT, CITY_OF_MELBOURNE)
        flat_before = [0, 0, 100, 100, 50, 50, 60, 60, 50, 50]
        flat_after = [
            n
            for shape in (moved["layers"]["channel"] + moved["layers"]["low-point"])
            for pair in (shape["c"] if shape["g"] == "line" else shape["c"][0])
            for n in pair
        ]
        offsets = [
            after - before for after, before in zip(flat_after, flat_before, strict=True)
        ]
        assert offsets[::2] == [1500.0] * 5
        assert offsets[1::2] == [6000.0] * 5


class TestTheCommandThatBuiltTheCouncilArtefacts:
    """The CLI wrapper, which is how `derived.json` was moved into the council frame.

    It was the whole of this module's uncovered 31%, and it is not an
    incidental wrapper: `pipeline/README.md` gives this exact command as the
    way to rebuild the committed council artefacts, and the file it writes is
    the one the API image copies. A command documented and never run is a
    command that can stop working without anybody finding out until a
    deployment.
    """

    def _artefact(self, tmp_path):
        source = tmp_path / "derived.json"
        source.write_text(
            json.dumps(
                {
                    "artefact": "derived-layers",
                    "basis": "derived",
                    "extent": {"name": "kensington", "width_m": 1000, "height_m": 1000},
                    "layers": {"channel": [{"g": "line", "c": [[10, 20], [30, 40]]}]},
                }
            ),
            encoding="utf-8",
        )
        return source

    def test_it_writes_the_moved_artefact_where_it_was_asked_to(self, tmp_path, capsys):
        source = self._artefact(tmp_path)
        out = tmp_path / "council" / "derived.json"

        assert (
            main(
                [
                    "--in",
                    str(source),
                    "--out",
                    str(out),
                    "--from",
                    "kensington",
                    "--to",
                    "city-of-melbourne",
                ]
            )
            == 0
        )

        # The directory did not exist: the command makes it rather than failing
        # on a path the person typed from the README.
        moved = json.loads(out.read_text(encoding="utf-8"))
        assert moved["extent"]["name"] == "city-of-melbourne"
        # Kensington's corner is the council's (1500, 6000).
        assert moved["layers"]["channel"][0]["c"] == [[1510.0, 6020.0], [1530.0, 6040.0]]

    def test_it_says_what_it_moved_and_where(self, tmp_path, capsys):
        source = self._artefact(tmp_path)
        out = tmp_path / "out.json"
        main(["--in", str(source), "--out", str(out), "--from", "kensington", "--to", "city-of-melbourne"])

        said = capsys.readouterr().err
        assert "1 shapes moved" in said
        assert "kensington" in said and "city-of-melbourne" in said

    def test_it_refuses_an_extent_it_does_not_publish(self, tmp_path):
        # argparse, not a fallback: an unknown name is a typo, and reframing
        # into a guessed extent is the failure this module exists to prevent.
        source = self._artefact(tmp_path)
        with pytest.raises(SystemExit):
            main(
                [
                    "--in",
                    str(source),
                    "--out",
                    str(tmp_path / "out.json"),
                    "--from",
                    "kensington",
                    "--to",
                    "greater-melbourne",
                ]
            )

    def test_it_refuses_to_move_an_artefact_out_of_its_own_frame(self, tmp_path):
        # The artefact says it is Kensington's; asking to move it *from* the
        # council would shift it by the wrong offset and produce a file that
        # looks right.
        source = self._artefact(tmp_path)
        with pytest.raises(ReframeError):
            main(
                [
                    "--in",
                    str(source),
                    "--out",
                    str(tmp_path / "out.json"),
                    "--from",
                    "city-of-melbourne",
                    "--to",
                    "city-of-melbourne",
                ]
            )


def built(name: str, settings: dict | None = None, **layers) -> dict:
    return {
        "artefact": "derived-layers",
        "basis": "derived",
        "extent": {"name": name},
        "settings": settings if settings is not None else {"coverage_min_measured": 0.2},
        "layers": layers,
    }


class TestCombiningMeasuredAreas:
    """Kensington and the Hoddle Grid, each its own terrain run, as one artefact."""

    def parts(self):
        return [
            (built("kensington", channel=[{"g": "line", "c": [[0, 0]]}]), DEMONSTRATION_EXTENT),
            (
                built(
                    "melbourne-cbd",
                    channel=[{"g": "line", "c": [[0, 0]]}],
                    unavailable=[{"g": "polygon", "c": [[[0, 0], [1, 0], [0, 0]]]}],
                ),
                MELBOURNE_CBD,
            ),
        ]

    def test_it_moves_each_area_by_its_own_corner(self):
        # One offset for both would put the CBD's water paths in Kensington.
        combined = combine(self.parts(), CITY_OF_MELBOURNE)
        assert [shape["c"] for shape in combined["layers"]["channel"]] == [
            [[1500.0, 6000.0]],
            [[4000.0, 3000.0]],
        ]

    def test_it_keeps_a_layer_only_one_area_has(self):
        combined = combine(self.parts(), CITY_OF_MELBOURNE)
        assert len(combined["layers"]["unavailable"]) == 1

    def test_it_says_where_each_measured_area_is(self):
        # The browser and the CI check both need the boxes, and a sentence is
        # not something either can read.
        combined = combine(self.parts(), CITY_OF_MELBOURNE)
        assert combined["areas"] == [
            {"name": "kensington", "e": 1500.0, "n": 6000.0, "width_m": 1000.0, "height_m": 1000.0},
            {"name": "melbourne-cbd", "e": 4000.0, "n": 3000.0, "width_m": 3000.0, "height_m": 2500.0},
        ]

    def test_it_still_says_that_everywhere_else_nothing_is_claimed(self):
        covers = combine(self.parts(), CITY_OF_MELBOURNE)["covers"]
        assert "kensington and melbourne-cbd" in covers
        assert "8.50 km2 of the 76.50 km2" in covers
        assert "has not been measured" in covers
        assert "nothing is claimed" in covers

    def test_it_refuses_areas_built_with_different_settings(self):
        # One legend entry meaning two things, with nothing on the map to say
        # where the meaning changes.
        parts = self.parts()
        parts[1] = (built("melbourne-cbd", {"coverage_min_measured": 0.35}), MELBOURNE_CBD)
        with pytest.raises(ReframeError, match="different settings"):
            combine(parts, CITY_OF_MELBOURNE)

    def test_it_refuses_areas_that_overlap(self):
        nearby = Extent("kensington", 317_000.0, 5_815_000.0, 318_000.0, 5_816_000.0)
        parts = [self.parts()[0], (built("kensington"), nearby)]
        with pytest.raises(ReframeError, match="overlap"):
            combine(parts, CITY_OF_MELBOURNE)

    def test_areas_that_only_touch_are_not_an_overlap(self):
        east = Extent("kensington", 317_500.0, 5_814_500.0, 318_000.0, 5_815_000.0)
        combine([self.parts()[0], (built("kensington"), east)], CITY_OF_MELBOURNE)

    def test_it_refuses_nothing_at_all(self):
        with pytest.raises(ReframeError, match="nothing"):
            combine([], CITY_OF_MELBOURNE)

    def test_the_command_combines_when_given_more_than_one_area(self, tmp_path, capsys):
        paths = []
        for artefact, extent in self.parts():
            path = tmp_path / f"{extent.name}.json"
            path.write_text(json.dumps(artefact), encoding="utf-8")
            paths.append(path)
        out = tmp_path / "council.json"
        argv = ["--to", "city-of-melbourne", "--out", str(out)]
        argv += ["--in", str(paths[0]), "--from", "kensington"]
        argv += ["--in", str(paths[1]), "--from", "melbourne-cbd"]
        assert main(argv) == 0
        written = json.loads(out.read_text(encoding="utf-8"))
        assert [a["name"] for a in written["areas"]] == ["kensington", "melbourne-cbd"]
        assert "kensington + melbourne-cbd" in capsys.readouterr().err

    def test_the_command_wants_one_extent_per_file(self, tmp_path):
        path = tmp_path / "a.json"
        path.write_text(json.dumps(built("kensington")), encoding="utf-8")
        argv = ["--to", "city-of-melbourne", "--out", str(tmp_path / "o.json")]
        argv += ["--in", str(path), "--in", str(path), "--from", "kensington"]
        with pytest.raises(SystemExit):
            main(argv)
