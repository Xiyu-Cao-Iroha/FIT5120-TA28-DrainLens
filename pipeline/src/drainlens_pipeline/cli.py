"""Build the drainage graph artefact from the source exports.

Usage::

    python -m drainlens_pipeline.cli --pipes pipes.json --pits pits.json \\
        --out ../data/graph/drainage-graph.json \\
        --data-version com-drainage@2023-02-26

Prints a summary to stderr so the operator sees what was produced, and compares
it against the figures recorded in the Epic 1 data audit. A mismatch is reported
rather than raised: the classification rules live in this repository and may
legitimately move, but drift should never pass unnoticed.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Mapping, Sequence

from .graph import build, to_artefact

#: Figures recorded in the Epic 1 data audit, for comparison only.
#:
#: The audit counted a pipe as traceable when both endpoint identifiers were
#: recorded. This build additionally requires the identifier to resolve against
#: the pit dataset, which 1,622 pipes (9.4%) do not. `edgesFullyResolved` is
#: therefore expected to sit below the audit's 13,753, and the difference is a
#: finding about the data rather than a defect here.
AUDIT_EXPECTATIONS: Mapping[str, int] = {
    "pipesIn": 17242,
    "pitsIn": 21113,
    "selfLoopsExcluded": 87,
}


def compare_with_audit(stats: Mapping[str, Any]) -> list[str]:
    """Return one line per figure that differs from the recorded audit."""
    drift: list[str] = []
    for key, expected in AUDIT_EXPECTATIONS.items():
        actual = stats.get(key)
        if actual != expected:
            drift.append(f"  {key}: audit recorded {expected}, build produced {actual}")
    return drift


def _load(path: Path) -> Sequence[Mapping[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise SystemExit(f"{path} does not contain a list of records")
    return data


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the drainage graph artefact")
    parser.add_argument("--pipes", type=Path, required=True)
    parser.add_argument("--pits", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--data-version", required=True)
    args = parser.parse_args(argv)

    graph = build(_load(args.pipes), _load(args.pits))
    artefact = to_artefact(graph, args.data_version)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(artefact, handle, separators=(",", ":"))

    stats = artefact["stats"]
    print(f"wrote {args.out} ({args.out.stat().st_size / 1_000_000:.1f} MB)", file=sys.stderr)
    for key, value in stats.items():
        print(f"  {key}: {value}", file=sys.stderr)

    total = stats["pipesIn"]
    resolved = stats["edgesFullyResolved"] / total if total else 0
    reachable = stats["edgesTotal"] / total if total else 0
    print(f"  reachable share: {reachable:.1%}  (upstream pit known)", file=sys.stderr)
    print(f"  fully resolved:  {resolved:.1%}  (both pits known)", file=sys.stderr)

    drift = compare_with_audit(stats)
    if drift:
        print("\ndrift from the recorded Epic 1 audit:", file=sys.stderr)
        for line in drift:
            print(line, file=sys.stderr)
        print("  (reported, not fatal — confirm the change was intended)", file=sys.stderr)

    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
