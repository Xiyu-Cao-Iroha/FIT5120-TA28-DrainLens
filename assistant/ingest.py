
from pathlib import Path
import csv
import hashlib
import re

import chromadb
from pypdf import PdfReader

# Project paths
BASE = Path(__file__).resolve().parent
PROJECT_ROOT = BASE.parent

DOCS = PROJECT_ROOT / "data" / "flood_guidance"
DB_PATH = BASE / "chroma_db"
CSV_PATH = BASE / "sources.csv"

# Use a NEW collection so the original remains untouched
COLLECTION_NAME = "drainlens_guidance_v3"

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150


def split_into_chunks(text):
    """Split text near sentence boundaries with overlap."""
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    current = ""

    for sentence in sentences:
        # Split exceptionally long sentences into smaller pieces
        if len(sentence) > CHUNK_SIZE:
            if current:
                chunks.append(current.strip())
                current = ""

            step = CHUNK_SIZE - CHUNK_OVERLAP

            for start in range(0, len(sentence), step):
                piece = sentence[start:start + CHUNK_SIZE]

                if len(piece.strip()) >= 80:
                    chunks.append(piece.strip())

            continue

        candidate = (
            f"{current} {sentence}".strip()
            if current
            else sentence
        )

        if len(candidate) <= CHUNK_SIZE:
            current = candidate
        else:
            if current:
                chunks.append(current.strip())

            # Carry part of the previous chunk into the next one
            overlap = (
                current[-CHUNK_OVERLAP:]
                if current
                else ""
            )

            current = f"{overlap} {sentence}".strip()

    if current and len(current.strip()) >= 80:
        chunks.append(current.strip())

    return chunks


def get_chunk_title(chunk):
    text = chunk.lower()

    topics = {
        "Emergency Kit": [
            "emergency kit",
            "first aid",
            "batteries",
            "torch",
            "food",
            "water",
            "medications",
            "radio"
        ],

        "Flood Warnings": [
            "warning",
            "warnings",
            "vicemergency",
            "emergency broadcaster",
            "watch zone",
            "emergency information"
        ],

        "Drains and Gutters": [
            "drain",
            "drains",
            "gutter",
            "gutters",
            "downpipe",
            "backflow"
        ],

        "Insurance": [
            "insurance",
            "insurer",
            "policy",
            "cover",
            "coverage"
        ],

        "Sandbags": [
            "sandbag",
            "sandbags",
            "sandbagging"
        ],

        "Evacuation": [
            "evacuate",
            "evacuation",
            "leave",
            "relief centre"
        ],

        "Electrical Safety": [
            "electrical",
            "switchboard",
            "power points",
            "electricity"
        ],

        "Pets and Babies": [
            "pets",
            "pet",
            "babies",
            "baby"
        ],

        "Important Documents": [
            "documents",
            "records",
            "passport",
            "identification",
            "usb",
            "cloud storage"
        ],

        "After Flooding": [
            "return home",
            "after flooding",
            "recovery",
            "official clearance"
        ]
    }

    scores = {}

    for topic, keywords in topics.items():
        score = 0

        for keyword in keywords:
            score += text.count(keyword)

        scores[topic] = score

    best_topic = max(scores, key=scores.get)

    if scores[best_topic] == 0:
        return "General Flood Preparation"

    return best_topic

# Load source metadata
if not CSV_PATH.exists():
    raise FileNotFoundError(
        f"Missing sources.csv: {CSV_PATH}"
    )

with CSV_PATH.open(
    encoding="utf-8-sig", newline=""
) as file:
    reader = csv.DictReader(file)

    required = {
        "filename",
        "title",
        "organisation",
        "coverage",
        "document_date",
        "source_url",
        "retrieval_date",
        "license_copyright"
    }

    if not required.issubset(reader.fieldnames or []):
        raise ValueError(
            "sources.csv is missing required columns."
        )

    sources = {
        row["filename"].strip(): row
        for row in reader
        if row.get("filename", "").strip()
    }


# Connect to existing ChromaDB without deleting it
client = chromadb.PersistentClient(
    path=str(DB_PATH)
)

collection = client.get_or_create_collection(
    name=COLLECTION_NAME
)

pdf_files = sorted(DOCS.glob("*.pdf"))

if not pdf_files:
    raise FileNotFoundError(
        f"No PDFs found in: {DOCS}"
    )

total_chunks = 0
processed = 0

for pdf in pdf_files:
    if pdf.name not in sources:
        print(f"SKIPPED: No CSV metadata for {pdf.name}")
        continue

    source = sources[pdf.name]
    print(f"\nProcessing: {pdf.name}")

    reader = PdfReader(str(pdf))
    file_chunks = 0

    for page_number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        chunks = split_into_chunks(text)

        if not chunks:
            print(
                f"  Page {page_number}: "
                "No usable text extracted"
            )
            continue

        for chunk_number, chunk in enumerate(chunks):
            
            chunk_title = get_chunk_title(chunk)
            identifier = hashlib.sha256(
                (
                    f"{pdf.name}:{page_number}:"
                    f"{chunk_number}"
                ).encode("utf-8")
            ).hexdigest()

            metadata = {
                "filename": pdf.name,
                "title": source["title"].strip(),
                "chunk_title": chunk_title,
                "organisation": source["organisation"].strip(),
                "coverage": source["coverage"].strip(),
                "document_date": (
                    source["document_date"] or ""
                ).strip(),
                "source_url": (
                    source["source_url"] or ""
                ).strip(),
                "retrieval_date": (
                    source["retrieval_date"] or ""
                ).strip(),
                "license_copyright": (
                    source["license_copyright"] or ""
                ).strip(),
                "page": page_number,
                "chunk_number": chunk_number
            }

            collection.upsert(
                ids=[identifier],
                documents=[chunk],
                metadatas=[metadata]
            )

            file_chunks += 1
            total_chunks += 1

    processed += 1
    print(f"  Saved {file_chunks} chunks")

print("\n--- V3 ingestion complete ---")
print(f"PDFs processed: {processed}")
print(f"Chunks processed: {total_chunks}")
print(
    f"V3 collection records: {collection.count()}"
)
print(f"Database: {DB_PATH}")
