import hashlib
import json

import pytest

from assistant.verify_artifacts import verify_artifacts


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture
def artifacts(tmp_path):
    model = tmp_path / "model.gguf"
    model.write_bytes(b"approved-model")

    corpus = tmp_path / "corpus"
    corpus.mkdir()

    document = corpus / "chroma.sqlite3"
    document.write_bytes(b"approved-corpus")

    inventory = [{
        "path": document.name,
        "size_bytes": document.stat().st_size,
        "sha256": sha256(document),
    }]

    manifest = {
        "manifest_version": 1,
        "release_id": "ai09-test",
        "model": {
            "size_bytes": model.stat().st_size,
            "sha256": sha256(model),
        },
        "corpus": {
            "snapshot_checksums_file": "inventory.json",
        },
    }

    inventory_path = tmp_path / "inventory.json"
    manifest_path = tmp_path / "manifest.json"

    inventory_path.write_text(json.dumps(inventory), encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    return model, corpus, manifest_path, inventory_path


def test_valid_artifacts(artifacts):
    model, corpus, manifest, _ = artifacts
    assert verify_artifacts(model, corpus, manifest) == "ai09-test"


def test_modified_model_rejected(artifacts):
    model, corpus, manifest, _ = artifacts
    model.write_bytes(b"tampered-model")

    with pytest.raises(RuntimeError):
        verify_artifacts(model, corpus, manifest)


def test_modified_corpus_rejected(artifacts):
    model, corpus, manifest, _ = artifacts
    (corpus / "chroma.sqlite3").write_bytes(b"tampered-corpus")

    with pytest.raises(RuntimeError):
        verify_artifacts(model, corpus, manifest)


def test_duplicate_inventory_rejected(artifacts):
    model, corpus, manifest, inventory_path = artifacts

    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    inventory.append(dict(inventory[0]))
    inventory_path.write_text(json.dumps(inventory), encoding="utf-8")

    with pytest.raises(RuntimeError, match="Duplicate corpus inventory path"):
        verify_artifacts(model, corpus, manifest)


def test_path_traversal_rejected(artifacts):
    model, corpus, manifest, inventory_path = artifacts

    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    inventory[0]["path"] = "../outside.bin"
    inventory_path.write_text(json.dumps(inventory), encoding="utf-8")

    with pytest.raises(RuntimeError, match="Unsafe artifact path"):
        verify_artifacts(model, corpus, manifest)


def test_corpus_symlink_rejected(artifacts, tmp_path):
    model, corpus, manifest, _ = artifacts

    outside = tmp_path / "outside.bin"
    outside.write_bytes(b"unexpected")
    link = corpus / "unexpected.bin"

    try:
        link.symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("Symbolic links unavailable")

    with pytest.raises(RuntimeError, match="symbolic link"):
        verify_artifacts(model, corpus, manifest)
