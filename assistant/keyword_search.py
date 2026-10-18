from pathlib import Path
import re

import chromadb


# Project paths
BASE = Path(__file__).resolve().parent
DB_PATH = BASE / "chroma_db"

# Use the same final collection as the chatbot
COLLECTION_NAME = "drainlens_guidance_v3"


# Common words that are not useful for keyword matching
STOPWORDS = {
    "a", "an", "and", "are", "as", "at",
    "be", "before", "but", "by",
    "can", "could",
    "do", "does",
    "for", "from",
    "how",
    "i", "if", "in", "into", "is", "it",
    "me", "my",
    "of", "on", "or",
    "should",
    "the", "their", "them", "this", "to",
    "what", "when", "where", "which", "who",
    "will", "with", "would", "you", "your"
}


# Convert text into useful keywords
def tokenise(text):
    words = re.findall(
        r"[a-zA-Z0-9]+",
        text.lower()
    )

    return [
        word
        for word in words
        if word not in STOPWORDS
        and len(word) > 2
    ]


# Connect to ChromaDB only to read the stored documents
client = chromadb.PersistentClient(
    path=str(DB_PATH)
)

collection = client.get_collection(
    name=COLLECTION_NAME
)


# Plain keyword search
def keyword_search(question, top_k=5):

    query_terms = tokenise(question)

    # Get all Victoria-wide chunks from ChromaDB
    results = collection.get(
        where={"coverage": "Victoria"},
        include=[
            "documents",
            "metadatas"
        ]
    )

    scored_results = []

    for document_id, text, metadata in zip(
        results["ids"],
        results["documents"],
        results["metadatas"]
    ):

        document_terms = tokenise(text)

        score = 0
        matched_terms = []

        for term in query_terms:
            count = document_terms.count(term)

            if count > 0:
                score += count
                matched_terms.append(term)

        if score > 0:
            scored_results.append({
                "id": document_id,
                "score": score,
                "matched_terms": sorted(set(matched_terms)),
                "text": text,
                "metadata": metadata
            })

    scored_results.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    return scored_results[:top_k]


# Ask user for one test question
question = input(
    "\nEnter test question: "
).strip()

results = keyword_search(question)

print("\n" + "=" * 70)
print("QUESTION:", question)
print("=" * 70)

if not results:
    print("\nNo useful keyword matches were found.")

else:
    for number, item in enumerate(results, start=1):

        metadata = item["metadata"]

        print(f"\n--- Result {number} ---")

        print(
            "Document:",
            metadata.get("title", metadata.get("filename", "Unknown"))
        )

        print(
            "Chunk title:",
            metadata.get("chunk_title", "Unknown")
        )

        print(
            "Page:",
            metadata.get("page", "Unknown")
        )

        print(
            "Keyword match count:",
            item["score"]
        )

        print(
            "Matched words:",
            ", ".join(item["matched_terms"])
        )

        print(
            "Text:",
            item["text"][:700]
        )