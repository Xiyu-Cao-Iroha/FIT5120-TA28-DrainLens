from fastapi import FastAPI
from pydantic import BaseModel

from assistant.ai_service import (
    retrieve,
    generate_answer,
    is_emergency,
    is_out_of_scope,
    is_prediction_question,
    is_current_warning_question,
    get_prediction_subject,
    EMERGENCY_RESPONSE,
)

app = FastAPI()


class ChatRequest(BaseModel):
    message: str


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


def normalise_page(value):
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(value)

    try:
        text = str(value).strip()

        if not text:
            return None

        return int(float(text))
    except (TypeError, ValueError):
        return None


@app.post("/chat")
def chat(request: ChatRequest):
    question = request.message.strip()

    if not question:
        return {
            "answer": "Please enter a question.",
            "sources": []
        }

    if is_emergency(question):
        return {
            "answer": EMERGENCY_RESPONSE,
            "sources": []
        }

    if is_out_of_scope(question):
        return {
            "answer": (
                "The available DrainLens official guidance "
                "does not provide that information."
            ),
            "sources": []
        }

    if is_prediction_question(question):
        q = question.lower()

        if "how deep" in q or "floodwater depth" in q:
            first_sentence = (
                "DrainLens cannot predict how deep floodwater will be "
                "at a specific property during a future storm."
            )
        else:
            subject = get_prediction_subject(question)

            first_sentence = (
                f"DrainLens cannot predict whether a {subject} "
                "will flood during a future storm."
            )

        answer = (
            first_sentence
            + "\n\n"
            + "To prepare, you can clear gutters and drains, move valuables "
            + "and appliances to higher ground, keep important documents in "
            + "waterproof storage, and have an emergency kit ready.\n\n"
            + "For current flood warnings, check VicEmergency."
        )

        return {
            "answer": answer,
            "sources": []
        }

    if is_current_warning_question(question):
        return {
            "answer": (
                "For current Victorian flood warnings, check "
                "https://emergency.vic.gov.au/."
            ),
            "sources": []
        }

    documents = retrieve(question)

    if not documents:
        return {
            "answer": (
                "No supporting information was found "
                "in the available official guidance."
            ),
            "sources": []
        }

    answer = generate_answer(question, documents)

    sources = []
    seen_sources = set()

    for item in documents:
        metadata = item["metadata"]

        title = metadata.get("title", "Unknown document")
        organisation = metadata.get("organisation", "Unknown")
        page = normalise_page(metadata.get("page"))
        url = metadata.get("source_url", "")

        source_key = (title, organisation)

        if source_key in seen_sources:
            continue

        seen_sources.add(source_key)

        sources.append({
            "title": title,
            "organisation": organisation,
            "page": page,
            "url": url,
        })

        if len(sources) == 2:
            break

    return {
        "answer": answer,
        "sources": sources
    }