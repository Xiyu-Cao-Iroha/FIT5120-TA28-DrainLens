## Flood Preparation Assistant

The DrainLens Flood Preparation Assistant is an offline/local Retrieval-Augmented Generation (RAG) prototype developed for Stage 2 evaluation.

The assistant is currently kept separate from the main DrainLens frontend.

### Overview

The assistant is designed to answer flood-preparation questions using approved official guidance documents from VICSES, Melbourne Water and the City of Melbourne.

It uses semantic retrieval to find relevant information from the local document collection and then uses a locally running language model to generate a response based on the retrieved content.

The assistant uses:

- Streamlit for the user interface
- ChromaDB for local document retrieval
- Ollama for local LLM inference
- `llama3.2` for response generation
- `pypdf` for extracting text from PDF documents

### Local AI Runtime

The assistant uses the Ollama API running locally on the user's machine.

The required model is:

`llama3.2`

Ollama must be installed and running locally before the assistant can generate responses.

The required model can be downloaded using:

```bash
ollama pull llama3.2

### Run the Assistant

```bash
streamlit run assistant/app.py

