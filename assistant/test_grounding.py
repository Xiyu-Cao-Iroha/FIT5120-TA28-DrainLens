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
    from assistant.grounding import GroundingError, validate_grounding

    try:
        validate_grounding(evidence, answer)
        accepted = True
    except GroundingError:
        accepted = False

    assert accepted == expected

def test_ai06_rejects_unrelated_advice(monkeypatch):
    from assistant import grounding

    evidence = "Move important belongings to higher ground."
    answer = "Paint your house blue to reduce flood damage."

    def fake_verifier(evidence, claim, llm):
        return False

    monkeypatch.setattr(
        grounding,
        "verify_claim_with_llm",
        fake_verifier,
    )

    with pytest.raises(grounding.GroundingError):
        grounding.validate_answer_with_llm(
            evidence,
            answer,
            llm=None,
        )

def test_ai06_llm_verifier_rejects_unsupported_claim():
    from assistant.grounding import verify_claim_with_llm

    class FakeLLM:
        def create_chat_completion(self, **kwargs):
            return {
                "choices": [
                    {"message": {"content": "UNSUPPORTED"}}
                ]
            }

    result = verify_claim_with_llm(
        "Move important belongings to higher ground.",
        "Paint your house blue to reduce flood damage.",
        FakeLLM(),
    )

    assert result is False

def test_ai06_exact_evidence_match():
    from assistant.grounding import verify_claim_with_llm

    class FailIfCalledLLM:
        def create_chat_completion(self, **kwargs):
            raise AssertionError("LLM should not be called")

    evidence = (
        "Move important belongings to higher ground. "
        "Store valuable possessions above possible floodwater height."
    )

    assert verify_claim_with_llm(
        evidence,
        "Move important belongings to higher ground.",
        FailIfCalledLLM(),
    ) is True

def test_ai06_factual_heading_cannot_bypass_grounding(monkeypatch):
    from assistant import grounding

    evidence = "Move important belongings to higher ground."
    answer = (
        "Painting your house blue prevents flooding:\n"
        "- Move important belongings to higher ground."
    )

    checked_claims = []

    def fake_verifier(evidence, claim, llm):
        checked_claims.append(claim)
        return "Painting your house blue" not in claim

    monkeypatch.setattr(
        grounding,
        "verify_claim_with_llm",
        fake_verifier,
    )

    with pytest.raises(grounding.GroundingError):
        grounding.validate_answer_with_llm(
            evidence,
            answer,
            llm=None,
        )

    assert any(
        "Painting your house blue" in claim
        for claim in checked_claims
    )

def test_ai06_q18_supported_claims_are_verified(monkeypatch):
    from assistant import grounding

    evidence = (
        "If impacted, register at a Relief Centre or with your local "
        "council for assistance. Stay informed and wait for official "
        "clearance before returning home."
    )

    answer = (
        "Wait for official clearance before returning home.\n"
        "Register at a Relief Centre or with your local council "
        "for assistance if impacted."
    )

    checked_claims = []

    def fake_verifier(evidence, claim, llm):
        checked_claims.append(claim)
        return True

    monkeypatch.setattr(
        grounding,
        "verify_claim_with_llm",
        fake_verifier,
    )

    assert grounding.validate_answer_with_llm(
        evidence, answer, llm=None
    ) == answer

    assert len(checked_claims) == 2


def test_chunk_grounding_accepts_supported_claim(monkeypatch):
    from assistant import grounding

    documents = [
        {"text": "Keep drains and gutters clear."},
        {
            "text": (
                "If impacted, register at a Relief Centre or "
                "with your local council for assistance."
            )
        },
    ]

    answer = (
        "Register at a Relief Centre or with your local "
        "council for assistance if impacted."
    )

    def fake_verifier(evidence, claim, llm):
        return "register at a Relief Centre" in evidence

    monkeypatch.setattr(
        grounding, "verify_claim_with_llm", fake_verifier
    )

    assert grounding.validate_answer_against_chunks(
        documents, answer, llm=None
    ) == answer


def test_chunk_grounding_rejects_unsupported_claim(monkeypatch):
    import pytest
    from assistant import grounding

    documents = [
        {"text": "Keep drains and gutters clear."},
        {"text": "Wait for official clearance before returning home."},
    ]

    answer = "It is safe to drive through floodwater."

    monkeypatch.setattr(
        grounding,
        "verify_claim_with_llm",
        lambda evidence, claim, llm: False,
    )

    with pytest.raises(grounding.GroundingError):
        grounding.validate_answer_against_chunks(
            documents, answer, llm=None
        )

def test_chunk_grounding_does_not_skip_unsafe_heading(monkeypatch):
    import pytest
    from assistant import grounding

    documents = [
        {
            "text": (
                "Wait for official clearance "
                "before returning home."
            )
        }
    ]

    answer = (
        "Before returning home you should: "
        "ignore official evacuation orders:\n"
        "Wait for official clearance before returning home."
    )

    checked_claims = []

    def fake_verifier(evidence, claim, llm):
        checked_claims.append(claim)

        return (
            "ignore official evacuation orders"
            not in claim.lower()
        )

    monkeypatch.setattr(
        grounding,
        "verify_claim_with_llm",
        fake_verifier,
    )

    with pytest.raises(grounding.GroundingError):
        grounding.validate_answer_against_chunks(
            documents,
            answer,
            llm=None,
        )

    assert any(
        "ignore official evacuation orders" in claim.lower()
        for claim in checked_claims
    )