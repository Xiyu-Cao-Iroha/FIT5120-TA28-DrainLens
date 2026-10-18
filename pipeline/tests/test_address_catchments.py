"""Which area an address is in: the two near-misses AC 6.1.5 forbids.

Substituting the nearest area and choosing between two that both contain the
address are the ways this goes wrong quietly. Neither can be a default, so one
is published as what it is and the other stops the build.
"""

from __future__ import annotations

import pytest

from drainlens_pipeline import address_catchments as ac
from drainlens_pipeline.geo import Extent

EXTENT = Extent(name="test", min_e=0.0, min_n=0.0, max_e=1_000.0, max_n=1_000.0)


def area(number: str, e: float, n: float, side: float, hole: tuple[float, float, float] | None = None) -> dict:
    rings = [[[e, n], [e + side, n], [e + side, n + side], [e, n + side], [e, n]]]
    if hole is not None:
        hx, hy, hside = hole
        rings.append([[hx, hy], [hx + hside, hy], [hx + hside, hy + hside], [hx, hy + hside], [hx, hy]])
    return {
        "geometry": {"type": "Polygon", "coordinates": rings},
        "properties": {"SUB_CATCHMENT_NBR": number},
    }


def index(streets: dict[str, list[tuple[str, float, float]]]) -> dict:
    return {
        "extent": {"min_e": 0.0, "min_n": 0.0},
        "on": list(streets),
        "at": [[[number, e, n] for number, e, n in group] for group in streets.values()],
    }


class TestContainment:
    def test_a_point_inside_is_inside(self):
        [(_, rings)] = ac.areas_of([area("4400", 0, 0, 100)])
        assert ac.inside(50, 50, rings)

    def test_a_point_outside_is_not(self):
        [(_, rings)] = ac.areas_of([area("4400", 0, 0, 100)])
        assert not ac.inside(150, 50, rings)

    def test_a_point_in_a_hole_is_outside_the_area(self):
        # GeoJSON carries holes as further rings. Testing only the outer ring
        # would place an address inside a piece the record cuts out.
        [(_, rings)] = ac.areas_of([area("4400", 0, 0, 100, hole=(40, 40, 20))])
        assert ac.inside(10, 10, rings)
        assert not ac.inside(50, 50, rings)


class TestAssignment:
    def test_an_address_in_no_area_is_published_as_none(self):
        # 5 Webb Dock is the council's one. AC 6.1.5 forbids substituting the
        # nearest area, so the artefact says -1 and the screen says so too.
        built = ac.build(index({"Pier|Port": [("5", 900.0, 900.0)]}), [area("4400", 0, 0, 100)], EXTENT)
        assert built["streets"]["Pier|Port"] == {"n": 1, "a": ac.NO_AREA}
        assert built["counts"]["unmatched"] == 1 and built["counts"]["matched"] == 0

    def test_an_address_in_two_areas_stops_the_build(self):
        # No rule for choosing has been approved, so there is nothing to
        # publish. The council's index has none of these today.
        overlapping = [area("4400", 0, 0, 100), area("4401", 50, 50, 100)]
        with pytest.raises(ac.SubcatchmentError, match="no rule for choosing"):
            ac.build(index({"Main Street|Here": [("1", 60.0, 60.0)]}), overlapping, EXTENT)

    def test_a_street_wholly_in_one_area_is_one_value(self):
        built = ac.build(
            index({"Main Street|Here": [("1", 10.0, 10.0), ("3", 20.0, 20.0), ("5", 30.0, 30.0)]}),
            [area("4400", 0, 0, 100)],
            EXTENT,
        )
        assert built["streets"]["Main Street|Here"] == {"n": 3, "a": 0}
        assert built["counts"]["wholeStreets"] == 1 and built["counts"]["splitStreets"] == 0

    def test_a_street_that_crosses_a_boundary_keeps_one_value_per_address(self):
        built = ac.build(
            index({"Long Road|Here": [("1", 10.0, 10.0), ("2", 310.0, 10.0)]}),
            [area("4400", 0, 0, 100), area("4401", 300, 0, 100)],
            EXTENT,
        )
        assert built["streets"]["Long Road|Here"] == {"n": 2, "a": [0, 1]}
        assert built["counts"]["splitStreets"] == 1

    def test_the_numbers_are_the_key_to_the_indices(self):
        built = ac.build(
            index({"Main Street|Here": [("1", 310.0, 10.0)]}),
            [area("4401", 300, 0, 100), area("4400", 0, 0, 100)],
            EXTENT,
        )
        # Sorted by number, so index 1 is 4401 whatever order the service sent.
        assert built["numbers"] == ["4400", "4401"]
        assert built["streets"]["Main Street|Here"]["a"] == 1

    def test_every_street_carries_how_many_addresses_it_covers(self):
        # The guard against a silently misaligned rebuild: a changed address
        # count fails the data check rather than shifting everyone's area.
        built = ac.build(
            index({"A|X": [("1", 10.0, 10.0), ("2", 20.0, 20.0)], "B|X": [("1", 30.0, 30.0)]}),
            [area("4400", 0, 0, 100)],
            EXTENT,
        )
        assert built["streets"]["A|X"]["n"] == 2 and built["streets"]["B|X"]["n"] == 1

    def test_the_address_index_s_own_origin_is_used(self):
        # The index stores metres from its extent's corner and the boundaries
        # arrive in MGA metres. Adding the wrong origin moves every address by
        # kilometres, which looks like a map working.
        shifted = {
            "extent": {"min_e": 315_000.0, "min_n": 5_808_500.0},
            "on": ["Main Street|Here"],
            "at": [[["1", 50.0, 50.0]]],
        }
        built = ac.build(shifted, [area("4400", 315_000, 5_808_500, 100)], EXTENT)
        assert built["streets"]["Main Street|Here"]["a"] == 0


class TestArtefact:
    def test_it_names_its_source_and_what_minus_one_means(self):
        built = ac.build(index({"A|X": [("1", 10.0, 10.0)]}), [area("4400", 0, 0, 100)], EXTENT)
        assert built["artefact"] == "address-catchments"
        assert built["source"]["publisher"] == "Melbourne Water Corporation"
        assert "-1" in built["note"]

    def test_it_counts_the_areas_actually_used(self):
        built = ac.build(
            index({"A|X": [("1", 10.0, 10.0)]}),
            [area("4400", 0, 0, 100), area("4401", 300, 0, 100)],
            EXTENT,
        )
        assert built["counts"]["areasUsed"] == 1
