from __future__ import annotations

import json

import pytest

from drainlens_pipeline.cli import compare_with_audit, main


def write(path, records):
    path.write_text(json.dumps(records), encoding="utf-8")
    return path


def test_writes_an_artefact_and_reports_a_summary(tmp_path, capsys):
    pipes = write(
        tmp_path / "pipes.json",
        [
            {"ref": 1, "upstr_pit": 10, "dnstr_pit": 11, "diameter": 600},
            {"ref": 2, "upstr_pit": 11, "dnstr_pit": 12, "diameter": 300},
        ],
    )
    pits = write(
        tmp_path / "pits.json",
        [
            {"asset_number": 10, "object_type_lupvalue": "Grated OFK", "lat": -37.8, "lon": 144.9},
            {"asset_number": 11, "object_type_lupvalue": "Junction", "lat": -37.8, "lon": 144.9},
            {"asset_number": 12, "object_type_lupvalue": "Submerged", "lat": -37.8, "lon": 144.9},
        ],
    )
    out = tmp_path / "nested" / "graph.json"

    assert main(["--pipes", str(pipes), "--pits", str(pits), "--out", str(out), "--data-version", "v1"]) == 0

    artefact = json.loads(out.read_text(encoding="utf-8"))
    assert artefact["dataVersionId"] == "v1"
    assert artefact["stats"]["edgesTotal"] == 2
    assert artefact["stats"]["narrowingEdges"] == 1

    err = capsys.readouterr().err
    assert "edgesTotal: 2" in err
    assert "fully resolved:  100.0%" in err
    # These inputs are nothing like the real dataset, so drift must be reported.
    assert "drift from the recorded Epic 1 audit" in err


def test_rejects_a_source_file_that_is_not_a_list(tmp_path):
    bad = tmp_path / "pipes.json"
    bad.write_text(json.dumps({"records": []}), encoding="utf-8")
    pits = write(tmp_path / "pits.json", [])
    with pytest.raises(SystemExit):
        main(
            [
                "--pipes",
                str(bad),
                "--pits",
                str(pits),
                "--out",
                str(tmp_path / "out.json"),
                "--data-version",
                "v1",
            ]
        )


def test_reports_no_drift_when_the_figures_match_the_audit():
    assert compare_with_audit({"pipesIn": 17242, "pitsIn": 21113, "selfLoopsExcluded": 87}) == []


def test_names_every_figure_that_differs():
    drift = compare_with_audit({"pipesIn": 1, "pitsIn": 21113, "selfLoopsExcluded": 0})
    assert len(drift) == 2
    assert any("pipesIn" in line for line in drift)
    assert any("selfLoopsExcluded" in line for line in drift)


def test_handles_an_empty_source_without_dividing_by_zero(tmp_path, capsys):
    pipes = write(tmp_path / "pipes.json", [])
    pits = write(tmp_path / "pits.json", [])
    out = tmp_path / "graph.json"
    assert main(["--pipes", str(pipes), "--pits", str(pits), "--out", str(out), "--data-version", "v1"]) == 0
    assert "fully resolved:  0.0%" in capsys.readouterr().err
