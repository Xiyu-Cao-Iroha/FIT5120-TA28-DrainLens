from fastapi.testclient import TestClient
import pytest
from assistant.api import app
@pytest.fixture(autouse=True)
def mock_ai06_grounding_for_existing_tests(request, monkeypatch):
    if request.node.name == "test_ai06_rejects_unsupported_generated_answer":
        return

    monkeypatch.setattr(
        "assistant.api.get_llm",
        lambda: object(),
    )

    monkeypatch.setattr(
        "assistant.api.validate_answer_against_chunks",
        lambda documents, answer, llm: answer,
    )

client = TestClient(app)


def test_chat_accepts_message_at_500_characters(monkeypatch):
    monkeypatch.setattr("assistant.api.is_emergency", lambda _: True)

    response = client.post(
        "/chat",
        json={"message": "a" * 500},
    )

    assert response.status_code == 200


def test_chat_rejects_message_over_500_characters():
    response = client.post(
        "/chat",
        json={"message": "a" * 501},
    )

    assert response.status_code == 422


def test_chat_rejects_non_string_message():
    response = client.post(
        "/chat",
        json={"message": 123},
    )

    assert response.status_code == 422


def test_chat_rejects_null_message():
    response = client.post(
        "/chat",
        json={"message": None},
    )

    assert response.status_code == 422


def test_chat_rejects_array_message():
    response = client.post(
        "/chat",
        json={"message": []},
    )

    assert response.status_code == 422


def test_chat_rejects_object_message():
    response = client.post(
        "/chat",
        json={"message": {}},
    )

    assert response.status_code == 422


def test_chat_rejects_whitespace_only_message():
    response = client.post(
        "/chat",
        json={"message": "   "},
    )

    assert response.status_code == 422


def test_chat_rejects_whitespace_only_message():
    response = client.post(
        "/chat",
        json={"message": "   "},
    )

    assert response.status_code == 422


def test_chat_keeps_approved_https_source_url(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: [
            {
                "metadata": {
                    "title": "Flood Checklist",
                    "organisation": "VICSES",
                    "page": 1,
                    "source_url": "https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/flood",
                }
            }
        ],
    )
    monkeypatch.setattr(
        "assistant.api.generate_answer",
        lambda question, documents: "Approved answer.",
    )

    response = client.post(
        "/chat",
        json={"message": "How should I prepare for flooding?"},
    )

    assert response.status_code == 200
    assert response.json()["sources"][0]["url"].startswith(
        "https://www.ses.vic.gov.au/"
    )


def test_chat_removes_javascript_source_url(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: [
            {
                "metadata": {
                    "title": "Bad source",
                    "organisation": "Unknown",
                    "page": 1,
                    "source_url": "javascript:alert(1)",
                }
            }
        ],
    )
    monkeypatch.setattr(
        "assistant.api.generate_answer",
        lambda question, documents: "Test answer.",
    )

    response = client.post(
        "/chat",
        json={"message": "How should I prepare for flooding?"},
    )

    assert response.status_code == 200
    assert "url" not in response.json()["sources"][0]


def test_chat_removes_data_source_url(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: [
            {
                "metadata": {
                    "title": "Bad source",
                    "organisation": "Unknown",
                    "page": 1,
                    "source_url": "data:text/html,<script>alert(1)</script>",
                }
            }
        ],
    )
    monkeypatch.setattr(
        "assistant.api.generate_answer",
        lambda question, documents: "Test answer.",
    )

    response = client.post(
        "/chat",
        json={"message": "How should I prepare for flooding?"},
    )

    assert response.status_code == 200
    assert "url" not in response.json()["sources"][0]


def test_chat_removes_http_source_url(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: [
            {
                "metadata": {
                    "title": "Bad source",
                    "organisation": "VICSES",
                    "page": 1,
                    "source_url": "http://www.ses.vic.gov.au/flood",
                }
            }
        ],
    )
    monkeypatch.setattr(
        "assistant.api.generate_answer",
        lambda question, documents: "Test answer.",
    )

    response = client.post(
        "/chat",
        json={"message": "How should I prepare for flooding?"},
    )

    assert response.status_code == 200
    assert "url" not in response.json()["sources"][0]


def test_chat_removes_unapproved_https_source_url(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: [
            {
                "metadata": {
                    "title": "Bad source",
                    "organisation": "Unknown",
                    "page": 1,
                    "source_url": "https://example.com/flood",
                }
            }
        ],
    )
    monkeypatch.setattr(
        "assistant.api.generate_answer",
        lambda question, documents: "Test answer.",
    )

    response = client.post(
        "/chat",
        json={"message": "How should I prepare for flooding?"},
    )

    assert response.status_code == 200
    assert "url" not in response.json()["sources"][0]


def test_chat_removes_source_url_with_credentials(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: [
            {
                "metadata": {
                    "title": "Bad source",
                    "organisation": "VICSES",
                    "page": 1,
                    "source_url": "https://user:password@www.ses.vic.gov.au/flood",
                }
            }
        ],
    )
    monkeypatch.setattr(
        "assistant.api.generate_answer",
        lambda question, documents: "Test answer.",
    )

    response = client.post(
        "/chat",
        json={"message": "How should I prepare for flooding?"},
    )

    assert response.status_code == 200
    assert "url" not in response.json()["sources"][0]


def test_chat_rejects_oversized_generated_answer(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: [
            {
                "metadata": {
                    "title": "Flood Checklist",
                    "organisation": "VICSES",
                    "page": 1,
                    "source_url": (
                        "https://www.ses.vic.gov.au/"
                        "plan-and-stay-safe/emergencies/flood"
                    ),
                }
            }
        ],
    )

    monkeypatch.setattr(
        "assistant.api.generate_answer",
        lambda question, documents: "a" * 4001,
    )

    response = client.post(
        "/chat",
        json={"message": "How should I prepare for flooding?"},
    )

    assert response.status_code == 502


def test_validated_response_rejects_too_many_sources():
    from assistant.api import validated_chat_response

    sources = [
        {"title": "One"},
        {"title": "Two"},
        {"title": "Three"},
    ]

    try:
        validated_chat_response("Valid answer.", sources)
        assert False, "Expected validation to fail"
    except ValueError:
        pass


def test_validated_response_rejects_long_source_title():
    from assistant.api import validated_chat_response

    sources = [
        {
            "title": "a" * 201,
            "organisation": "VICSES",
        }
    ]

    try:
        validated_chat_response("Valid answer.", sources)
        assert False, "Expected validation to fail"
    except ValueError:
        pass


def test_validated_response_rejects_invalid_page():
    from assistant.api import validated_chat_response

    sources = [
        {
            "title": "Flood Checklist",
            "organisation": "VICSES",
            "page": -1,
        }
    ]

    try:
        validated_chat_response("Valid answer.", sources)
        assert False, "Expected validation to fail"
    except ValueError:
        pass


def test_validated_response_accepts_valid_source():
    from assistant.api import validated_chat_response

    result = validated_chat_response(
        "Valid answer.",
        [
            {
                "title": "Flood Checklist",
                "organisation": "VICSES",
                "page": 1,
                "url": (
                    "https://www.ses.vic.gov.au/"
                    "plan-and-stay-safe/emergencies/flood"
                ),
            }
        ],
    )

    assert result["answer"] == "Valid answer."
    assert len(result["sources"]) == 1


def test_emergency_question_does_not_reach_rag(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: (_ for _ in ()).throw(
            AssertionError("retrieve should not be called")
        ),
    )

    response = client.post(
        "/chat",
        json={
            "message": "Flooding right now and water is coming into my house."
        },
    )

    assert response.status_code == 200
    assert "132 500" in response.json()["answer"]
    assert "000" in response.json()["answer"]


def test_emergency_takes_priority_over_prediction(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: (_ for _ in ()).throw(
            AssertionError("retrieve should not be called")
        ),
    )

    response = client.post(
        "/chat",
        json={
            "message": "Flooding right now. Will my house flood?"
        },
    )

    assert response.status_code == 200
    assert "132 500" in response.json()["answer"]
    assert "000" in response.json()["answer"]


def test_out_of_scope_question_does_not_reach_rag(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: (_ for _ in ()).throw(
            AssertionError("retrieve should not be called")
        ),
    )

    response = client.post(
        "/chat",
        json={
            "message": "When will the council repair my drain?"
        },
    )

    assert response.status_code == 200
    assert (
        response.json()["answer"]
        == "The available DrainLens official guidance "
        "does not provide that information."
    )


def test_prediction_question_does_not_reach_rag(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: (_ for _ in ()).throw(
            AssertionError("retrieve should not be called")
        ),
    )

    response = client.post(
        "/chat",
        json={
            "message": "Will my house flood during the next storm?"
        },
    )

    assert response.status_code == 200
    assert "cannot predict" in response.json()["answer"].lower()


def test_current_warning_question_does_not_reach_rag(monkeypatch):
    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: (_ for _ in ()).throw(
            AssertionError("retrieve should not be called")
        ),
    )

    response = client.post(
        "/chat",
        json={
            "message": "Where can I check current flood warnings?"
        },
    )

    assert response.status_code == 200
    assert "emergency.vic.gov.au" in response.json()["answer"]


def test_normal_guidance_question_uses_rag(monkeypatch):
    called = {"retrieve": False, "generate": False}

    def fake_retrieve(question):
        called["retrieve"] = True
        return [
            {
                "metadata": {
                    "title": "Flood Checklist",
                    "organisation": "VICSES",
                    "page": 1,
                    "source_url": (
                        "https://www.ses.vic.gov.au/"
                        "plan-and-stay-safe/emergencies/flood"
                    ),
                }
            }
        ]

    def fake_generate(question, documents):
        called["generate"] = True
        return "Move valuables to higher ground."

    monkeypatch.setattr(
        "assistant.api.retrieve",
        fake_retrieve,
    )
    monkeypatch.setattr(
        "assistant.api.generate_answer",
        fake_generate,
    )

    response = client.post(
        "/chat",
        json={
            "message": "How should I prepare my home for flooding?"
        },
    )

    assert response.status_code == 200
    assert called["retrieve"] is True
    assert called["generate"] is True

def test_generate_answer_prompt_contains_only_supplied_documents(monkeypatch):
    from assistant import ai_service

    captured = {}

    class FakeLLM:
        def create_chat_completion(self, **kwargs):
            captured["kwargs"] = kwargs
            return {
                "choices": [
                    {
                        "message": {
                            "content": "Move valuables to higher ground."
                        }
                    }
                ]
            }

    monkeypatch.setattr(
        ai_service,
        "get_llm",
        lambda: FakeLLM(),
    )

    documents = [
        {
            "id": "doc-1",
            "text": "Move important belongings to higher ground.",
            "metadata": {
                "title": "Flood Checklist",
                "organisation": "VICSES",
                "chunk_title": "Protect belongings",
                "document_date": "2019-05-01",
                "page": 1,
            },
        }
    ]

    answer = ai_service.generate_answer(
        "How should I protect my belongings?",
        documents,
    )

    assert answer == "Move valuables to higher ground."

    messages = captured["kwargs"]["messages"]

    user_prompt = messages[1]["content"]

    assert "Move important belongings to higher ground." not in user_prompt

    # Retrieved evidence must be separate from the resident question.
    evidence_messages = messages[2:]
    assert evidence_messages
    assert any(
        "Move important belongings to higher ground." in str(message["content"])
        for message in evidence_messages
    )
    assert "UNRELATED SECRET TEXT" not in user_prompt


def test_generate_answer_system_prompt_contains_grounding_rules(monkeypatch):
    from assistant import ai_service

    captured = {}

    class FakeLLM:
        def create_chat_completion(self, **kwargs):
            captured["kwargs"] = kwargs
            return {
                "choices": [
                    {
                        "message": {
                            "content": "Supported answer."
                        }
                    }
                ]
            }

    monkeypatch.setattr(
        ai_service,
        "get_llm",
        lambda: FakeLLM(),
    )

    documents = [
        {
            "id": "doc-1",
            "text": "Official flood preparation guidance.",
            "metadata": {
                "title": "Flood Checklist",
                "organisation": "VICSES",
                "chunk_title": "Preparation",
                "document_date": "2019-05-01",
                "page": 1,
            },
        }
    ]

    ai_service.generate_answer(
        "How should I prepare?",
        documents,
    )

    system_prompt = captured["kwargs"]["messages"][0]["content"]

    assert "Use only the supplied document extracts" in system_prompt
    assert "Do not invent information missing from the documents" in system_prompt
    assert (
        "If a detail is not clearly supported by the retrieved documents"
        in system_prompt
    )


def test_generate_answer_uses_bounded_generation_settings(monkeypatch):
    from assistant import ai_service

    captured = {}

    class FakeLLM:
        def create_chat_completion(self, **kwargs):
            captured["kwargs"] = kwargs
            return {
                "choices": [
                    {
                        "message": {
                            "content": "Supported answer."
                        }
                    }
                ]
            }

    monkeypatch.setattr(
        ai_service,
        "get_llm",
        lambda: FakeLLM(),
    )

    documents = [
        {
            "id": "doc-1",
            "text": "Official guidance.",
            "metadata": {
                "title": "Flood Checklist",
                "organisation": "VICSES",
                "chunk_title": "Preparation",
                "document_date": "2019-05-01",
                "page": 1,
            },
        }
    ]

    ai_service.generate_answer(
        "How should I prepare?",
        documents,
    )

    assert captured["kwargs"]["temperature"] == 0.1
    assert captured["kwargs"]["max_tokens"] == 250
    assert captured["kwargs"]["repeat_penalty"] == 1.15


def test_no_documents_does_not_call_generate_answer(monkeypatch):
    called = {"generate": False}

    monkeypatch.setattr(
        "assistant.api.retrieve",
        lambda _: [],
    )

    def fake_generate(question, documents):
        called["generate"] = True
        return "This should not be returned."

    monkeypatch.setattr(
        "assistant.api.generate_answer",
        fake_generate,
    )

    response = client.post(
        "/chat",
        json={
            "message": "How should I prepare my home for flooding?"
        },
    )

    assert response.status_code == 200
    assert called["generate"] is False
    assert (
        response.json()["answer"]
        == "No supporting information was found "
        "in the available official guidance."
    )

import pytest


@pytest.mark.parametrize("question", [
    "I'm stuck upstairs and the water is rising.",
    "My street is underwater. Is it safe to drive?",
    "Water is reaching the power outlets.",
])
def test_ai05_emergency_paraphrases(question):
    from assistant.ai_service import is_emergency
    assert is_emergency(question)


def test_ai05_historical_question_not_emergency():
    from assistant.ai_service import is_emergency
    assert not is_emergency(
        "Last year, floodwater entered my house. What should I have done?"
    )


def test_ai05_property_prediction():
    from assistant.ai_service import is_prediction_question
    assert is_prediction_question(
        "Will my property flood next weekend?"
    )


@pytest.mark.parametrize("question, expected", [
    ("Last year I was trapped upstairs when the water rose.", False),
    ("How can I prepare if water reaches electrical outlets?", False),
    ("My road was flooded yesterday. Was it safe to drive?", False),
    ("There is no floodwater near my electrical equipment.", False),
    ("I'm stuck upstairs and the water is rising.", True),
    ("I became trapped yesterday and I'm still trapped now.", True),
    ("Water is reaching the power outlets.", True),
    ("My street is underwater. Is it safe to drive?", True),
])
def test_ai05_temporal_safety_cases(question, expected):
    from assistant.ai_service import is_emergency
    assert is_emergency(question) is expected


@pytest.mark.parametrize("question, expected", [
    ("How much will it cost to repair my home after a flood?", True),
    ("Which insurance company should I choose for the best flood cover?", True),
    ("What should I check in my insurance policy before a flood?", False),
])
def test_ai06_unsupported_requests(question, expected):
    from assistant.ai_service import is_out_of_scope
    assert is_out_of_scope(question) is expected


@pytest.mark.parametrize("question", [
    "How much will it cost to repair my home after a flood?",
    "Which insurance company should I choose for the best flood cover?",
])
def test_ai06_api_refuses_unsupported_requests(question, monkeypatch):
    from fastapi.testclient import TestClient
    from assistant.api import app

    def unexpected_retrieval(_question):
        raise AssertionError("Unsupported question reached retrieval")

    monkeypatch.setattr("assistant.api.retrieve", unexpected_retrieval)

    response = TestClient(app).post("/chat", json={"message": question})

    assert response.status_code == 200
    assert response.json()["sources"] == []
    assert "does not provide that information" in response.json()["answer"]


@pytest.mark.parametrize("question, expected", [
    (
        "What time will floodwater reach my street today?",
        "PREDICTION",
    ),
    (
        "Can you tell me whether my electrical switchboard is currently safe after being flooded?",
        "EMERGENCY",
    ),
    (
        "I need flood and storm emergency assistance but there is no immediate life-threatening danger. Who should I contact?",
        "EMERGENCY",
    ),
])
def test_ai06_special_routing(question, expected):
    from assistant.ai_service import (
        is_emergency,
        is_out_of_scope,
        is_prediction_question,
    )

    if is_emergency(question):
        actual = "EMERGENCY"
    elif is_out_of_scope(question):
        actual = "REFUSAL"
    elif is_prediction_question(question):
        actual = "PREDICTION"
    else:
        actual = "RAG"

    assert actual == expected


@pytest.mark.parametrize("question, expected_text", [
    (
        "What time will floodwater reach my street today?",
        "cannot predict when floodwater will",
    ),
    (
        "Can you tell me whether my electrical switchboard is currently safe after being flooded?",
        "Do not touch or operate flooded electrical equipment",
    ),
    (
        "I need flood and storm emergency assistance but there is no immediate life-threatening danger. Who should I contact?",
        "132 500",
    ),
])
def test_ai06_api_safety_responses(question, expected_text, monkeypatch):
    from fastapi.testclient import TestClient
    from assistant.api import app

    def unexpected_retrieval(_question):
        raise AssertionError("Safety question reached retrieval")

    monkeypatch.setattr("assistant.api.retrieve", unexpected_retrieval)

    response = TestClient(app).post("/chat", json={"message": question})

    assert response.status_code == 200
    assert expected_text.lower() in response.json()["answer"].lower()
    assert response.json()["sources"] == []


@pytest.mark.parametrize("distance, expected_count", [
    (0.6, 1),
    (1.3, 1),
    (1.5, 1),
    (1.6, 0),
    (1.8, 0),
])
def test_ai06_retrieval_distance_filter(distance, expected_count, monkeypatch):
    from assistant import ai_service

    class FakeCollection:
        def query(self, **kwargs):
            return {
                "ids": [["test-document"]],
                "documents": [["Official flood preparation guidance"]],
                "metadatas": [[{
                    "title": "Flood Checklist",
                    "coverage": "Victoria",
                    "organisation": "VICSES",
                }]],
                "distances": [[distance]],
            }

    monkeypatch.setattr(ai_service, "get_collection", lambda: FakeCollection())

    documents = ai_service.retrieve("How can I prepare for flooding?")

    assert len(documents) == expected_count


# ==========================================
# AI-05: Additional safety-routing tests
# ==========================================

@pytest.mark.parametrize("question", [
    "Im traped upstairs and water is rising",
    "Water is coming into my house and I cannot get out",
])
def test_ai05_additional_emergencies(question):
    from assistant.ai_service import is_emergency

    assert is_emergency(question)


@pytest.mark.parametrize("question", [
    "Any flood alerts around Melbourne right now?",
    "Are there any active flood warnings near me?",
])
def test_ai05_current_warning_paraphrases(question):
    from assistant.ai_service import is_current_warning_question

    assert is_current_warning_question(question)


@pytest.mark.parametrize("question", [
    "Will my house flood in tomorrow's storm?",
    "Is my property going to flood next weekend?",
])
def test_ai05_additional_predictions(question):
    from assistant.ai_service import is_prediction_question

    assert is_prediction_question(question)


@pytest.mark.parametrize("question", [
    "My street flooded last year.",
    "Last year floodwater entered my home.",
])
def test_ai05_historical_questions(question):
    from assistant.ai_service import is_emergency

    assert not is_emergency(question)


def test_ai05_flood_alert_bypasses_rag(monkeypatch):
    def unexpected_retrieval(_question):
        raise AssertionError("Flood alert reached RAG")

    def unexpected_generation(_question, _documents):
        raise AssertionError("Flood alert reached Llama")

    monkeypatch.setattr("assistant.api.retrieve", unexpected_retrieval)
    monkeypatch.setattr("assistant.api.generate_answer", unexpected_generation)

    response = client.post(
        "/chat",
        json={"message": "Any flood alerts around Melbourne right now?"},
    )

    assert response.status_code == 200
    assert "emergency.vic.gov.au" in response.json()["answer"]
    assert response.json()["sources"] == []


def test_ai05_real_emergency_with_alert_question(monkeypatch):
    def unexpected_retrieval(_question):
        raise AssertionError("Emergency reached RAG")

    def unexpected_generation(_question, _documents):
        raise AssertionError("Emergency reached Llama")

    monkeypatch.setattr("assistant.api.retrieve", unexpected_retrieval)
    monkeypatch.setattr("assistant.api.generate_answer", unexpected_generation)

    response = client.post(
        "/chat",
        json={
            "message": (
                "My house is flooding right now. "
                "Are there any flood alerts?"
            )
        },
    )

    assert response.status_code == 200
    assert "132 500" in response.json()["answer"]
    assert "000" in response.json()["answer"]
    assert response.json()["sources"] == []

def test_ai06_rejects_unsupported_generated_answer(monkeypatch):
    from assistant import api
    from assistant.grounding import GroundingError

    monkeypatch.setattr(
        api,
        "retrieve",
        lambda question: [
            {
                "text": "Move important belongings to higher ground.",
                "metadata": {
                    "title": "Flood preparation",
                    "organisation": "VICSES",
                    "page": 1,
                },
            }
        ],
    )

    monkeypatch.setattr(
        api,
        "generate_answer",
        lambda question, documents: (
            "Paint your house blue to reduce flood damage."
        ),
    )

    monkeypatch.setattr(api, "get_llm", lambda: object())

    def reject_grounding(documents, answer, llm):
        raise GroundingError("Unsupported claim")

    monkeypatch.setattr(
        api,
        "validate_answer_against_chunks",
        reject_grounding,
    )

    response = client.post(
        "/chat",
        json={"message": "How can I prepare my home for flooding?"},
    )

    assert response.status_code == 200
    assert "couldn't verify" in response.json()["answer"].lower()
    assert response.json()["sources"] == []

def test_ai06_accepts_supported_generated_answer(monkeypatch):
    from assistant import api

    monkeypatch.setattr(
        api,
        "retrieve",
        lambda question: [
            {
                "text": "Move important belongings to higher ground.",
                "metadata": {
                    "title": "Flood preparation",
                    "organisation": "VICSES",
                    "page": 1,
                },
            }
        ],
    )

    monkeypatch.setattr(
        api,
        "generate_answer",
        lambda question, documents: (
            "Move important belongings to higher ground."
        ),
    )

    monkeypatch.setattr(api, "get_llm", lambda: object())

    def accept_grounding(documents, answer, llm):
        assert any(
            "Move important belongings" in doc["text"]
            for doc in documents
        )
        return answer

    monkeypatch.setattr(
        api,
        "validate_answer_against_chunks",
        accept_grounding,
    )

    response = client.post(
        "/chat",
        json={"message": "How can I prepare my home for flooding?"},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == (
        "Move important belongings to higher ground."
    )

@pytest.mark.parametrize("question, expected", [
    (
        "I am trapped in my house because of flooding.",
        "call Triple Zero (000) now",
    ),
    (
        "Can I drive through floodwater if the road looks shallow?",
        "Never drive through floodwater",
    ),
    (
        "Water is around electrical equipment in my home.",
        "Do not touch or operate electrical equipment",
    ),
    (
        "Someone in my household is in immediate danger from flooding.",
        "call Triple Zero (000) now",
    ),
])
def test_ai11_specific_emergency_responses(question, expected):
    response = client.post(
        "/chat",
        json={"message": question},
    )

    assert response.status_code == 200
    assert expected.lower() in response.json()["answer"].lower()
    assert response.json()["sources"] == []


def test_ai11_flooded_switchboard_touch_warning():
    response = client.post(
        "/chat",
        json={
            "message": (
                "Can I touch an electrical switchboard "
                "after it has been flooded?"
            )
        },
    )

    assert response.status_code == 200

    answer = response.json()["answer"].lower()

    assert "do not touch" in answer
    assert "electrical" in answer
    assert response.json()["sources"] == []