import pytest


GROUNDING_CASES = [
    (
        "Never drive through floodwater.",
        "It is safe to drive through shallow floodwater.",
        False,
    ),
    (
        "Never drive through floodwater.",
        "Avoid driving through flooded roads.",
        True,
    ),
    (
        "Keep a three-day emergency kit with essentials for babies and pets.",
        "Prepare supplies for babies and pets in your emergency kit.",
        True,
    ),
    (
        "Keep a three-day emergency kit with essentials for babies and pets.",
        "Prepare supplies for babies and pets. Flooding will occur tomorrow.",
        False,
    ),
    (
        "Check official emergency warnings before returning home.",
        "You can return home without checking official warnings.",
        False,
    ),
    (
        "Move electrical appliances above potential flood levels.",
        "Move electrical appliances to higher ground.",
        True,
    ),
    (
        "Move important belongings to higher ground.",
        "Move valuables to higher ground.",
        True,
    ),
    (
        "Keep important documents in waterproof storage.",
        "Store important documents in waterproof containers.",
        True,
    ),
    (
        "Keep important documents in waterproof storage.",
        "Floodwater will reach your home at 6 PM.",
        False,
    ),
    (
        "Move electrical appliances above potential flood levels.",
        "Move electrical appliances to higher ground. "
        "Your flood repair costs will be $5,000.",
        False,
    ),
]


@pytest.mark.parametrize(
    "evidence, answer, expected",
    GROUNDING_CASES,
)
def test_grounding_requirements(evidence, answer, expected):
    # Requirements only. Connect to a grounding validator
    # after choosing and evaluating its implementation.
    pytest.skip("Grounding validator not implemented yet")
