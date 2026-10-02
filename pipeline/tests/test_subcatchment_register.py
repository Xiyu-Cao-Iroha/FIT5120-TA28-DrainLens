"""The register: a name is reproduced, a classification is claimed.

The first can be done by a rule. The second is what the Epic 6 definition of
done says needs an approval, and the tests that matter here are the ones that
check an unapproved proposal cannot reach a screen.
"""

from __future__ import annotations

from drainlens_pipeline import subcatchment_register as reg


class TestNames:
    def test_the_numeric_prefix_comes_off(self):
        # AC 6.1.1. Three published names carry one and nothing else does.
        assert reg.clean_name("9877 COUNCIL DRAINAGE DIRECT TO BAY") == "Council Drainage Direct to Bay"

    def test_main_drain_is_written_out(self):
        assert reg.clean_name("ALEXANDRA PARADE M.D.") == "Alexandra Parade Main Drain"

    def test_the_one_written_without_points_is_read_the_same_way(self):
        # 4902 is published as `PRINCES ST M D`.
        assert reg.clean_name("PRINCES ST M D") == "Princes Street Main Drain"

    def test_street_types_are_written_out(self):
        assert reg.clean_name("SUMMERHILL RD M.D.") == "Summerhill Road Main Drain"
        assert reg.clean_name("SUMNER AVE M.D.") == "Sumner Avenue Main Drain"

    def test_the_reach_in_brackets_is_kept(self):
        # `(LOWER)` and `(MOUTH TO MERRI)` say which part of a waterway the
        # area is, which is what a reader checks their suburb against.
        assert reg.clean_name("YARRA RIVER (MOUTH TO MERRI)") == "Yarra River (Mouth to Merri)"
        assert reg.clean_name("MOONEE PONDS CREEK (LOWER)") == "Moonee Ponds Creek (Lower)"

    def test_a_comma_survives_an_expansion(self):
        assert reg.clean_name("YARRA STREET DRAIN, PRAHRAN") == "Yarra Street Drain, Prahran"

    def test_every_published_name_cleans_to_something_readable(self):
        for entry in reg.REGISTER:
            cleaned = reg.clean_name(entry.name)
            assert cleaned and cleaned[0].isupper()
            assert "M.D." not in cleaned and not cleaned[0].isdigit()


class TestClassification:
    def test_an_unapproved_proposal_is_published_as_unclassified(self):
        # The whole point. A name ending in M.D. is evidence and not an
        # approval, and the Epic 6 definition of done says no subcatchment is
        # described as a Melbourne Water drain without one.
        assert reg.proposal("4410").proposed == "main-drain"
        assert reg.proposal("4410").approved is None
        assert reg.classify("4410") == "unclassified"

    def test_an_approved_row_publishes_what_it_was_approved_as(self):
        entry = reg.Entry("4410", "ALEXANDRA PARADE M.D.", "main-drain", "checked", ("A Teammate", "2026-10-02"))
        assert entry.approved is not None
        # Checked through the register's own lookup, with the row swapped in.
        original = reg.BY_NUMBER["4410"]
        reg.BY_NUMBER["4410"] = entry
        try:
            assert reg.classify("4410") == "main-drain"
        finally:
            reg.BY_NUMBER["4410"] = original

    def test_an_area_the_register_does_not_know_is_unclassified(self):
        assert reg.classify("0000") == "unclassified"

    def test_every_area_in_the_register_has_evidence_for_its_proposal(self):
        for entry in reg.REGISTER:
            assert entry.evidence.strip(), f"{entry.number} proposes a class with no reason"

    def test_the_canal_is_proposed_as_unclassified_rather_than_guessed_at(self):
        # Dynon Road Tidal Canal is a canal and the layer does not say whose.
        assert reg.proposal("4229").proposed == "unclassified"

    def test_nothing_is_approved_yet_and_the_build_can_say_so(self):
        assert len(reg.unapproved()) == len(reg.REGISTER)

    def test_the_register_covers_every_published_area(self):
        from json import loads
        from pathlib import Path

        published = loads(
            Path(__file__).resolve().parents[2].joinpath("apps/web/public/data/subcatchments.json").read_text(
                encoding="utf-8"
            )
        )
        for area in published["areas"]:
            assert reg.proposal(area["number"]) is not None, f"{area['number']} is published and not in the register"
