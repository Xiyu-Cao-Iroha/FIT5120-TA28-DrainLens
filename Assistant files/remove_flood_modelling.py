from pathlib import Path
import chromadb

BASE = Path(__file__).resolve().parent

client = chromadb.PersistentClient(
    path=str(BASE / "chroma_db")
)

collection = client.get_collection(
    name="drainlens_guidance_v2"
)

collection.delete(
    where={"filename": "Factsheet_Flood-modelling.pdf"}
)

print("Removed Factsheet_Flood-modelling.pdf from ChromaDB.")
