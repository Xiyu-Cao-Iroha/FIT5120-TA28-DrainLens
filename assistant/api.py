from contextlib import asynccontextmanager
from typing import Annotated
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, StringConstraints


from assistant.ai_service import (
    initialize_ai,
    retrieve,
    generate_answer,
    get_collection,
    get_llm,
    is_emergency,
    is_out_of_scope,
    is_prediction_question,
    is_current_warning_question,
    get_prediction_subject,
    EMERGENCY_RESPONSE,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    import shutil
    from pathlib import Path

    from assistant.verify_artifacts import verify_artifacts
    from assistant.ai_service import MODEL_PATH, DB_PATH

    base = Path(__file__).resolve().parent

    release_corpus = Path(
        os.environ.get(
            "DRAINLENS_CORPUS_RELEASE_PATH",
            str(base / "chroma_db_release_v3"),
        )
    ).resolve()

    model_path = MODEL_PATH.resolve()
    runtime_corpus = DB_PATH.resolve()

    # Never use the release snapshot as a writable database.
    if (
        runtime_corpus == release_corpus
        or runtime_corpus in release_corpus.parents
        or release_corpus in runtime_corpus.parents
        or runtime_corpus == model_path
        or runtime_corpus in model_path.parents
    ):
        raise RuntimeError("Unsafe AI runtime corpus path")

    # Verify immutable artifacts before AI initialization.
    verify_artifacts(model_path, release_corpus)

    # Never trust an existing writable runtime corpus; only a fresh snapshot copy.
    runtime_corpus.parent.mkdir(parents=True, exist_ok=True)

    if runtime_corpus.exists() or runtime_corpus.is_symlink():
        raise RuntimeError(
            "Runtime corpus already exists; refusing unverified data"
        )

    shutil.copytree(release_corpus, runtime_corpus)

    initialize_ai()
    yield

app = FastAPI(lifespan=lifespan)


@app.get("/version")
def ai_version():
    import json
    from pathlib import Path

    manifest_path = Path(__file__).resolve().parent / "release-manifest.json"

    with manifest_path.open("r", encoding="utf-8") as f:
        manifest = json.load(f)

    return {
        "release_id": manifest["release_id"],
        "model": manifest["model"]["name"],
        "model_sha256": manifest["model"]["sha256"],
        "corpus_version": manifest["corpus"]["version"],
        "collection_name": manifest["corpus"]["collection_name"],
        "repository_commit": manifest["repository_commit"],
    }


APPROVED_SOURCE_HOSTS = {
    "www.ses.vic.gov.au",
    "www.melbournewater.com.au",
}

MAX_CHAT_ANSWER_LENGTH = 4000
MAX_CHAT_SOURCES = 2
MAX_CHAT_SOURCE_TEXT_LENGTH = 200

def approved_source_url(value):
    if not isinstance(value, str):
        return ""

    try:
        parsed = urlparse(value.strip())
    except ValueError:
        return ""

    if parsed.scheme != "https":
        return ""

    if parsed.hostname not in APPROVED_SOURCE_HOSTS:
        return ""

    if parsed.username is not None or parsed.password is not None:
        return ""

    return value.strip()

def validated_chat_response(answer, sources):
    if not isinstance(answer, str):
        raise ValueError("invalid_chat_answer")

    if not answer.strip():
        raise ValueError("invalid_chat_answer")

    if len(answer) > MAX_CHAT_ANSWER_LENGTH:
        raise ValueError("invalid_chat_answer")

    if not isinstance(sources, list):
        raise ValueError("invalid_chat_sources")

    if len(sources) > MAX_CHAT_SOURCES:
        raise ValueError("invalid_chat_sources")

    validated_sources = []

    for source in sources:
        if not isinstance(source, dict):
            raise ValueError("invalid_chat_source")

        title = source.get("title")
        organisation = source.get("organisation")
        page = source.get("page")
        url = source.get("url")

        if title is not None:
            if (
                not isinstance(title, str)
                or len(title) > MAX_CHAT_SOURCE_TEXT_LENGTH
            ):
                raise ValueError("invalid_chat_source_title")

        if organisation is not None:
            if (
                not isinstance(organisation, str)
                or len(organisation) > MAX_CHAT_SOURCE_TEXT_LENGTH
            ):
                raise ValueError("invalid_chat_source_organisation")

        if page is not None:
            if (
                isinstance(page, bool)
                or not isinstance(page, int)
                or page <= 0
            ):
                raise ValueError("invalid_chat_source_page")

        if url is not None:
            approved_url = approved_source_url(url)

            if not approved_url:
                raise ValueError("invalid_chat_source_url")

            url = approved_url

        validated_source = {}

        if title is not None:
            validated_source["title"] = title

        if organisation is not None:
            validated_source["organisation"] = organisation

        if page is not None:
            validated_source["page"] = page

        if url is not None:
            validated_source["url"] = url

        validated_sources.append(validated_source)

    return {
        "answer": answer,
        "sources": validated_sources,
    }

class ChatRequest(BaseModel):
    message: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=1,
            max_length=500,
        ),
    ]

@app.get("/health")
def health():
    try:
        collection = get_collection()
        model = get_llm()

        if collection is None or model is None:
            raise RuntimeError("AI components unavailable")

        collection.count()

        return {"status": "ok"}

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable"
        )


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
    question = request.message

    if not question:
        return {
            "answer": "Please enter a question.",
            "sources": []
        }

    if is_emergency(question):
        q = question.lower()

        if (
            ("switchboard" in q or "electrical panel" in q)
            and ("safe" in q or "safety" in q)
            and ("flood" in q or "water" in q)
        ):
            return {
                "answer": (
                    "DrainLens cannot determine whether a flooded "
                    "electrical switchboard is safe. Do not touch or "
                    "operate flooded electrical equipment. Keep away "
                    "from the affected area and seek advice from a "
                    "licensed electrician when it is safe to do so. "
                    + EMERGENCY_RESPONSE
                ),
                "sources": []
            }

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

        if (
            ("what time" in q or "when" in q)
            and any(word in q for word in ("flood", "floodwater"))
            and any(word in q for word in ("reach", "arrive", "hit"))
        ):
            first_sentence = (
                "DrainLens cannot predict when floodwater will "
                "reach a particular street or property."
            )
        elif "how deep" in q or "floodwater depth" in q:
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

    from assistant.safety import UnsafeAIAnswer, validate_generated_safety

    try:
        answer = validate_generated_safety(generate_answer(question, documents))
    except UnsafeAIAnswer:
        raise HTTPException(status_code=502, detail="The chat assistant is temporarily unavailable.")

    sources = []
    seen_sources = set()

    for item in documents:
        metadata = item["metadata"]

        title = metadata.get("title", "Unknown document")
        organisation = metadata.get("organisation", "Unknown")
        page = normalise_page(metadata.get("page"))
        url = approved_source_url(
            metadata.get("source_url", "")
        )

        source_key = (title, organisation)

        if source_key in seen_sources:
            continue

        seen_sources.add(source_key)

        source = {
            "title": title,
            "organisation": organisation,
            "page": page,
        }

        if url:
            source["url"] = url

        sources.append(source)

        if len(sources) == 2:
            break

    try:
        return validated_chat_response(
            answer,
            sources,
        )
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="The chat assistant is temporarily unavailable.",
        )
