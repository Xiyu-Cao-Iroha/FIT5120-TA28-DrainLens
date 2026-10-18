
from pathlib import Path
import chromadb

BASE = Path(__file__).resolve().parent

client = chromadb.PersistentClient(
    path=str(BASE / "chroma_db")
)

collection = client.get_collection(
    name="drainlens_guidance_v3"
)

tests = [
    {
        "question": "How can residents prepare their homes before flooding?",
        "coverage": "Victoria"
    },
    {
        "question": "What should be included in an emergency kit?",
        "coverage": "Victoria"
    },
    {
        "question": "Where can residents check flood warnings?",
        "coverage": "Victoria"
    },
    {
        "question": "How should drains around a home be prepared for flooding?",
        "coverage": "Victoria"
    },
    {
        "question": "What should residents do during a flood?",
        "coverage": "Victoria"
    }
]

for test in tests:
    print("\n" + "=" * 70)
    print("QUESTION:", test["question"])
    print("COVERAGE:", test["coverage"])

    results = collection.query(
        query_texts=[test["question"]],
        n_results=3,
        where={"coverage": test["coverage"]}
    )

    for i, (document, metadata) in enumerate(
        zip(
            results["documents"][0],
            results["metadatas"][0]
        ),
        start=1
    ):
        print(f"\n--- Result {i} ---")
        print("Document:", metadata["filename"])
        print("Chunk title:", metadata.get("chunk_title", "Unknown"))
        print("Page:", metadata["page"])
        print("Text:", document[:500])
