import os
import shutil
import subprocess
import sys
from pathlib import Path

from assistant.verify_artifacts import verify_artifacts


BASE = Path(__file__).resolve().parent


def main():
    model_path = Path(
        os.environ.get(
            "DRAINLENS_MODEL_PATH",
            str(BASE / "models" / "llama-3.2-3b-instruct-q4_k_m.gguf"),
        )
    ).resolve()

    release_corpus = Path(
        os.environ.get(
            "DRAINLENS_CORPUS_RELEASE_PATH",
            str(BASE / "chroma_db_release_v3"),
        )
    ).resolve()

    runtime_corpus = Path(
        os.environ.get(
            "DRAINLENS_CHROMA_PATH",
            "/tmp/drainlens_chroma_runtime",
        )
    ).resolve()

    # Reject unsafe destinations before verifying or copying artifacts.
    if runtime_corpus == release_corpus or release_corpus in runtime_corpus.parents:
        raise RuntimeError("Runtime corpus overlaps the release corpus")

    if runtime_corpus in release_corpus.parents:
        raise RuntimeError("Runtime corpus cannot contain the release corpus")

    if runtime_corpus.exists() or runtime_corpus.is_symlink():
        raise RuntimeError("Runtime corpus destination must not already exist")

    if runtime_corpus == model_path or runtime_corpus in model_path.parents:
        raise RuntimeError("Runtime corpus overlaps the model artifact")

    release_id = verify_artifacts(model_path, release_corpus)
    print(f"Verified AI release: {release_id}", flush=True)

    os.environ["DRAINLENS_MODEL_PATH"] = str(model_path)
    os.environ["DRAINLENS_CHROMA_PATH"] = str(runtime_corpus)

    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "assistant.api:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8080",
        ],
        check=True,
        env=os.environ.copy(),
    )


if __name__ == "__main__":
    main()
