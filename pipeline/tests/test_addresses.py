"""Tests for the address index.

No network: the fetch is driven through an injected opener. The index is the
one artefact that carries anything about a person's home, so what it leaves
behind matters as much as what it keeps, and both are asserted here.
"""

from __future__ import annotations

import json

import pytest

from drainlens_pipeline import addresses as ad
from drainlens_pipeline.geo import Extent, from_mga55

EXTENT = Extent("kensington", 316_500.0, 5_814_500.0, 317_500.0, 5_815_500.0)


def record(east_m: float, north_m: float, **fields) -> dict:
    latitude, longitude = from_mga55(EXTENT.min_e + east_m, EXTENT.min_n + north_m)
    return {"geo_point_2d": {"lat": latitude, "lon": longitude}, **fields}


def gatehouse(number: str = "46", east_m: float = 320.0, north_m: float = 640.0) -> dict:
    return at(east_m, north_m, number, "Gatehouse Drive")


def at(east_m: float, north_m: float, number: str, street: str, suburb: str = "Kensington") -> dict:
    """A record as `street-addresses` publishes it: already split, already titled."""
    return record(east_m, north_m, street_no=number, str_name=street, suburb=suburb)


class TestConvert:
    def test_builds_the_label_a_person_would_recognise(self):
        [address] = ad.convert([gatehouse()], EXTENT)
        assert address.label == "46 Gatehouse Drive, Kensington"
        assert address.number == "46"
        assert address.street == "Gatehouse Drive"

    def test_places_it_in_the_frame_the_map_uses(self):
        # A search result is already a map position; a second transform here
        # would be a second place for the two to disagree.
        [address] = ad.convert([gatehouse(east_m=320.0, north_m=640.0)], EXTENT)
        assert address.e == pytest.approx(320.0, abs=0.2)
        assert address.n == pytest.approx(640.0, abs=0.2)

    def test_keeps_only_what_a_search_and_a_pin_need(self):
        # A field that never leaves the pipeline cannot leak from the browser.
        #
        # Asserted against the built artefact rather than against one address.
        # It used to run on `Address.as_json`, which stopped being what ships
        # on 11 September -- a leak test aimed at a method the browser never
        # receives is a leak test that cannot fail for the right reason.
        noisy = ad.convert(
            [
                {
                    **gatehouse(),
                    "owner_name": "A Person",
                    "valuation": 1_250_000,
                    "parcel_id": "P-88213",
                }
            ],
            EXTENT,
        )
        shipped = json.dumps(ad.build(EXTENT, noisy))
        assert "A Person" not in shipped
        assert "1250000" not in shipped
        assert "P-88213" not in shipped

    def test_drops_an_address_outside_the_extent(self):
        far = record(
            9_000.0, 9_000.0, street_no="1", str_name="Elsewhere Road", suburb="Somewhere"
        )
        assert ad.convert([far], EXTENT) == []

    def test_drops_a_record_with_no_position(self):
        assert ad.convert([{"street_no": "1", "str_name": "Nowhere Road"}], EXTENT) == []

    def test_drops_a_record_with_no_street(self):
        assert ad.convert([record(100.0, 100.0, str_name="Nameless Lane")], EXTENT) == []

    def test_a_block_of_flats_is_one_address_not_forty(self):
        # The source has a record per parcel, and a tower is many parcels at
        # one street number. Forty identical suggestions is a broken search.
        parcels = [gatehouse(east_m=320.0 + n * 0.1) for n in range(40)]
        assert len(ad.convert(parcels, EXTENT)) == 1

    def test_orders_by_street_then_by_number_as_a_number(self):
        given = [gatehouse("100"), gatehouse("9"), gatehouse("46")]
        assert [a.number for a in ad.convert(given, EXTENT)] == ["9", "46", "100"]

    def test_title_cases_the_shouting_in_the_source(self):
        [address] = ad.convert([gatehouse()], EXTENT)
        assert "GATEHOUSE" not in address.label
        assert address.suburb == "Kensington"


class TestBuild:
    def index(self, *records: dict) -> dict:
        return ad.build(EXTENT, ad.convert(list(records), EXTENT))

    def test_lists_the_streets_separately(self):
        # The boundary check needs them. Recovering the street list by scanning
        # every label at run time is work the browser should not repeat on
        # every keystroke.
        artefact = self.index(gatehouse(), at(140.0, 480.0, "13", "Neale Street"))
        assert artefact["streets"] == ["Gatehouse Drive", "Neale Street"]

    def test_says_that_it_is_the_pilot_boundary(self):
        note = self.index(gatehouse())["note"]
        assert "pilot boundary" in note
        assert "ever sent anywhere" in note

    def test_names_its_source_and_licence(self):
        source = self.index(gatehouse())["source"]
        assert source["licence"] == "CC BY 4.0"
        assert source["publisher"].startswith("City of Melbourne")

    def test_refuses_to_publish_an_empty_index(self):
        # An empty index answers "not an address" to every query, including
        # real ones, and the pilot boundary becomes indistinguishable from a
        # typing mistake. Better to fail the build.
        with pytest.raises(ad.AddressError, match="pilot boundary"):
            ad.build(EXTENT, [])


class TestFetch:
    def test_asks_for_the_extent_and_parses_what_comes_back(self):
        seen: list[str] = []

        def opener(url: str) -> bytes:
            seen.append(url)
            return json.dumps([gatehouse()]).encode()

        [address] = ad.fetch(EXTENT, opener=opener)
        assert address.label == "46 Gatehouse Drive, Kensington"
        assert "in_bbox" in seen[0] and ad.DATASET in seen[0]

    def test_accepts_either_shape_the_portal_returns(self):
        wrapped = json.dumps({"results": [gatehouse()]}).encode()
        assert len(ad.fetch(EXTENT, opener=lambda _: wrapped)) == 1

    def test_an_empty_answer_is_not_an_error_here(self):
        # `build` is where an empty index is refused; `fetch` reporting nothing
        # is a fact about the query, and the two failures read differently.
        assert ad.fetch(EXTENT, opener=lambda _: b"[]") == []


class TestFixture:
    """The stand-in shipped while the portal's rate limit holds.

    Its whole justification is that nothing in it is invented, so that is what
    is asserted. A fixture that quietly made up house numbers would be the
    failure this product exists to avoid: a confident answer with nothing
    behind it.
    """

    def map_artefact(self) -> dict:
        return {
            "layers": {
                "street-name": [
                    {"maplabel": "GATEHOUSE  DRIVE"},
                    {"maplabel": "NEALE  STREET"},
                    {"name": "BELLAIR  STREET"},
                    {"maplabel": ""},
                ]
            }
        }

    def test_declares_itself_a_fixture(self):
        from drainlens_pipeline import address_fixture as fx

        artefact = fx.make(self.map_artefact())
        assert artefact["artefact"] == "address-index-fixture"
        assert "not the shipped index" in artefact["fixture"]
        assert "nothing here is invented" in artefact["fixture"]

    def test_carries_only_the_two_recorded_addresses(self):
        from drainlens_pipeline import address_fixture as fx
        from drainlens_pipeline.geo import DEMONSTRATION_ADDRESS, RESERVE_ADDRESS

        # The index travels grouped by street with the label left out, so it
        # is rebuilt here the way the browser rebuilds it. The fixture has to
        # travel in exactly the shipped shape or `unpack` refuses it, and a
        # fixture the frontend cannot read is a fixture that proves nothing.
        artefact = fx.make(self.map_artefact())
        labels = {
            f"{number} {key.split('|')[0]}, {key.split('|')[1]}"
            for key, group in zip(artefact["on"], artefact["at"], strict=True)
            for number, _e, _n in group
        }
        assert labels == {DEMONSTRATION_ADDRESS, RESERVE_ADDRESS}

    def test_takes_its_streets_from_the_real_map_artefact(self):
        from drainlens_pipeline import address_fixture as fx

        streets = fx.make(self.map_artefact())["streets"]
        assert "Gatehouse Drive" in streets
        assert "Bellair Street" in streets
        assert "" not in streets

    def test_collapses_the_double_spacing_the_source_publishes(self):
        from drainlens_pipeline import address_fixture as fx

        assert "Gatehouse  Drive" not in fx.street_names(self.map_artefact())
        assert "Gatehouse Drive" in fx.street_names(self.map_artefact())

    def test_splits_a_label_into_its_parts(self):
        from drainlens_pipeline import address_fixture as fx

        assert fx.parse("46 Gatehouse Drive, Kensington") == ("46", "Gatehouse Drive", "Kensington")


class TestTheDatasetItReads:
    """`street-addresses`, not `property-boundaries`.

    The parcel dataset was read first. It has no split street fields, and it
    does not contain either demonstration address — Gatehouse Drive has a 10,
    a 15 and a 17 but no 46, because a parcel is not an address. The index it
    produced had 1,619 plausible entries and was missing the two addresses the
    whole demonstration is built on.
    """

    def test_reads_the_address_dataset_rather_than_the_parcel_one(self):
        assert ad.DATASET == "street-addresses"
        assert ad.SOURCE["dataset_id"] == "street-addresses"

    def test_takes_the_street_type_from_the_name_it_is_already_part_of(self):
        # `str_name` is "Gatehouse Drive", not "Gatehouse" plus a type field.
        [address] = ad.convert([at(320.0, 640.0, "46", "Gatehouse Drive")], EXTENT)
        assert address.street == "Gatehouse Drive"

    def test_keeps_both_demonstration_addresses(self):
        # These are the two the demo script uses, and the reason the wrong
        # dataset was caught at all.
        found = ad.convert(
            [at(320.0, 640.0, "46", "Gatehouse Drive"), at(140.0, 480.0, "13", "Neale Street")],
            EXTENT,
        )
        assert {a.label for a in found} == {
            "46 Gatehouse Drive, Kensington",
            "13 Neale Street, Kensington",
        }


class TestStreetList:
    """The list answers one question: is this a real street?"""

    def test_carries_streets_the_map_knows_but_no_address_uses(self):
        # 38 street names on the map carry no address in this dataset — some
        # straddle the extent edge, some are lanes with no parcels. Built from
        # addresses alone, the index tells somebody on Harper Street that their
        # street does not exist, when it is simply outside the addressed area.
        artefact = ad.build(EXTENT, ad.convert([gatehouse()], EXTENT), ["Harper Street"])
        assert "Harper Street" in artefact["streets"]
        assert "Gatehouse Drive" in artefact["streets"]

    def test_collapses_the_double_spaces_the_map_labels_carry(self):
        # The map's labels are "McTaggart  Street". A plain union listed 92
        # streets twice and made the index look like it covered twice what
        # it does.
        artefact = ad.build(EXTENT, ad.convert([gatehouse()], EXTENT), ["Gatehouse  Drive"])
        assert artefact["streets"].count("Gatehouse Drive") == 1
        assert "Gatehouse  Drive" not in artefact["streets"]

    def test_ignores_blank_map_labels(self):
        artefact = ad.build(EXTENT, ad.convert([gatehouse()], EXTENT), ["", "   ", None])
        assert artefact["streets"] == ["Gatehouse Drive"]


class TestSourceNamesOneDataset:
    """The human-readable source and the dataset id must name the same thing.

    They did not, for every index this pipeline has ever published. When the
    builder was moved off the parcel dataset only ``dataset_id`` was changed,
    so the artefact went out saying its source was "Property boundaries" while
    its id said ``street-addresses``. Nothing wrong reached a screen -- the
    attribution footer reads the id -- but an artefact whose purpose is to be
    checkable was making a false statement about where it came from, and no
    test could tell.
    """

    def test_the_id_is_the_dataset_the_builder_fetches(self) -> None:
        assert ad.SOURCE["dataset_id"] == ad.DATASET

    def test_the_readable_name_is_the_portal_title_for_that_id(self) -> None:
        # "Street addresses" is the City of Melbourne portal's own title for
        # `street-addresses`. If the builder ever moves to another dataset,
        # this fails and forces both halves to move together.
        assert ad.SOURCE == {
            "dataset": "Street addresses",
            "publisher": "City of Melbourne Open Data Portal",
            "licence": "CC BY 4.0",
            "dataset_id": "street-addresses",
        }

    def test_it_never_names_the_parcel_dataset_again(self) -> None:
        assert "boundar" not in ad.SOURCE["dataset"].lower()


class TestTheShippedShape:
    """Streets once, then a triple per address.

    The index has to reach the browser whole, because nothing about a typed
    address is ever sent anywhere. That makes its size a design constraint
    rather than a detail: 62,397 addresses as a list of objects is 10.9 MB and
    986 KB gzipped; grouped like this it is 1.33 MB and 489 KB.
    """

    @staticmethod
    def two() -> list:
        from drainlens_pipeline.addresses import Address

        return [
            Address("x/46-gatehouse", "46 Gatehouse Drive, Kensington", "46",
                    "Gatehouse Drive", "Kensington", 320.5, 640.25),
            Address("x/48-gatehouse", "48 Gatehouse Drive, Kensington", "48",
                    "Gatehouse Drive", "Kensington", 330.0, 645.0),
            Address("x/13-neale", "13 Neale Street, Kensington", "13",
                    "Neale Street", "Kensington", 140.0, 480.0),
        ]

    def test_it_groups_by_street_and_suburb(self):
        from drainlens_pipeline.addresses import build
        from drainlens_pipeline.geo import DEMONSTRATION_EXTENT

        artefact = build(DEMONSTRATION_EXTENT, self.two())
        assert artefact["on"] == ["Gatehouse Drive|Kensington", "Neale Street|Kensington"]
        assert [len(group) for group in artefact["at"]] == [2, 1]

    def test_an_address_is_a_triple_that_cannot_come_apart(self):
        # Not three parallel arrays. Columnar was measured at 359 KB against
        # this shape's 489 KB, and the 123 KB buys an invariant nobody has to
        # test: a number cannot drift onto another address's coordinates.
        from drainlens_pipeline.addresses import build
        from drainlens_pipeline.geo import DEMONSTRATION_EXTENT

        artefact = build(DEMONSTRATION_EXTENT, self.two())
        assert artefact["at"][0][0] == ["46", 320.5, 640.2]

    def test_it_carries_neither_id_nor_label(self):
        # Both are exactly reconstructible from number, street and suburb --
        # 5.7 MB of text the browser can write itself.
        from drainlens_pipeline.addresses import build
        from drainlens_pipeline.geo import DEMONSTRATION_EXTENT

        text = json.dumps(build(DEMONSTRATION_EXTENT, self.two()))
        assert "46 Gatehouse Drive, Kensington" not in text
        assert "x/46-gatehouse" not in text

    def test_on_and_at_always_have_the_same_length(self):
        # The correspondence the browser refuses to repair. If these two ever
        # disagree, an address lands on another street: plausible on screen and
        # wrong in the only way this product cannot afford.
        from drainlens_pipeline.addresses import AddressError, build
        from drainlens_pipeline.geo import DEMONSTRATION_EXTENT

        for addresses in (self.two(), self.two()[:1]):
            artefact = build(DEMONSTRATION_EXTENT, addresses)
            assert len(artefact["on"]) == len(artefact["at"])

        # An empty index is refused outright rather than shipped with two
        # empty lists: it answers "not an address" to every query, including
        # real ones, and the pilot boundary becomes indistinguishable from a
        # typing mistake.
        with pytest.raises(AddressError, match="pilot boundary"):
            build(DEMONSTRATION_EXTENT, [])

    def test_it_keeps_the_street_list_separate_from_the_groups(self):
        # `streets` is deliberately wider: it is what tells "outside the pilot
        # area" from "no record of that street" (AC 1.1.8).
        from drainlens_pipeline.addresses import build
        from drainlens_pipeline.geo import DEMONSTRATION_EXTENT

        artefact = build(DEMONSTRATION_EXTENT, self.two(), map_streets=["Harper Street"])
        assert "Harper Street" in artefact["streets"]
        assert not any(key.startswith("Harper Street") for key in artefact["on"])
