"""Inlet classification for stormwater pits.

The source data records an object type per pit but does not say which types are
places surface water enters the network. That judgement is made here, once, and
stored against the *type* rather than against each pit, so two pits of the same
type cannot disagree.

Four classes, and the last two are not failures — they are the honest answer
where the source data does not support one. The traversal service offers only
`inlet` pits as probable entry points; it never proposes a Junction or a
Submerged node as somewhere a resident's runoff enters.
"""

from __future__ import annotations

from typing import Final, Literal

InletClass = Literal["inlet", "network-internal", "unclear", "unknown"]

#: Types where surface water demonstrably enters the network.
INLET_TYPES: Final[frozenset[str]] = frozenset(
    {
        "Grated OFK",
        "Grated Kerbside",
        "Grated Side Entry",
        "Grated Manhole",
        "Side Entry",
    }
)

#: Types that connect or carry, but are not an entry point from the surface.
NETWORK_INTERNAL_TYPES: Final[frozenset[str]] = frozenset(
    {
        "Junction",
        "System Node",
        "Submerged",
        "Pipe to Pipe",
    }
)

#: Types the source data does not resolve. "Lane Type" is the largest of these
#: and is pending clarification from the City of Melbourne; until it arrives,
#: these pits are neither offered as inlets nor asserted to be internal.
UNCLEAR_TYPES: Final[frozenset[str]] = frozenset(
    {
        "Lane Type",
        "Other",
    }
)


def classify_object_type(object_type: str | None) -> InletClass:
    """Classify one source object type.

    An unrecognised type returns ``unknown`` rather than raising. New types
    appearing in a future data release must show up as unknown and be counted,
    not silently absorbed into an existing class.
    """
    if object_type is None:
        return "unknown"
    name = object_type.strip()
    if name == "" or name == "Not Known":
        return "unknown"
    if name in INLET_TYPES:
        return "inlet"
    if name in NETWORK_INTERNAL_TYPES:
        return "network-internal"
    if name in UNCLEAR_TYPES:
        return "unclear"
    return "unknown"


def is_probable_inlet(object_type: str | None) -> bool:
    """Whether a pit may be offered to a resident as a place water enters."""
    return classify_object_type(object_type) == "inlet"
