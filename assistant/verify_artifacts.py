import hashlib
import json
import re
from pathlib import Path


BASE = Path(__file__).resolve().parent
SHA256_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")


def load_json(path):
    with Path(path).open("r", encoding="utf-8-sig") as file:
        return json.load(file)


def safe_relative_path(value):
    if not isinstance(value, str) or not value:
        raise RuntimeError("Invalid artifact path")

    if "\\" in value or value.startswith("/") or "\x00" in value:
        raise RuntimeError("Unsafe artifact path")

    parts = value.split("/")

    if any(part in ("", ".", "..") for part in parts):
        raise RuntimeError("Unsafe artifact path")

    if ":" in value:
        raise RuntimeError("Unsafe artifact path")

    return Path(*parts)


def check_file(path, expected_size, expected_hash):
    path = Path(path)

    if (
        not isinstance(expected_size, int)
        or isinstance(expected_size, bool)
        or expected_size < 0
        or not isinstance(expected_hash, str)
        or not SHA256_PATTERN.fullmatch(expected_hash)
    ):
        raise RuntimeError("Invalid artifact checksum metadata")

    if not path.is_file() or path.is_symlink():
        raise RuntimeError(f"Missing or invalid artifact: {path}")

    if path.stat().st_size != expected_size:
        raise RuntimeError(f"Artifact size mismatch: {path}")

    digest = hashlib.sha256()

    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)

    if digest.hexdigest().lower() != expected_hash.lower():
        raise RuntimeError(f"Artifact checksum mismatch: {path}")


def verify_artifacts(model_path, corpus_path, manifest_path=None):
    manifest_path = Path(
        manifest_path or BASE / "release-manifest.json"
    )
    manifest = load_json(manifest_path)

    if manifest.get("manifest_version") != 1:
        raise RuntimeError("Unsupported manifest version")

    model = manifest["model"]

    check_file(
        model_path,
        model["size_bytes"],
        model["sha256"],
    )

    corpus = manifest["corpus"]

    inventory_relative = safe_relative_path(
        corpus["snapshot_checksums_file"]
    )
    inventory_path = manifest_path.parent / inventory_relative
    inventory = load_json(inventory_path)

    if not isinstance(inventory, list) or not inventory:
        raise RuntimeError("Invalid corpus inventory")

    corpus_path = Path(corpus_path)

    if not corpus_path.is_dir() or corpus_path.is_symlink():
        raise RuntimeError("Invalid corpus directory")

    expected = set()

    for item in inventory:
        relative = safe_relative_path(item["path"])
        relative_name = relative.as_posix()

        if relative_name in expected:
            raise RuntimeError("Duplicate corpus inventory path")

        expected.add(relative_name)

        candidate = corpus_path / relative

        if any(
            component.is_symlink()
            for component in (candidate, *candidate.parents)
            if component == corpus_path
            or corpus_path in component.parents
        ):
            raise RuntimeError("Corpus contains a symbolic link")

        check_file(
            candidate,
            item["size_bytes"],
            item["sha256"],
        )

    actual = set()

    for path in corpus_path.rglob("*"):
        if path.is_symlink():
            raise RuntimeError("Corpus contains a symbolic link")

        if path.is_file():
            actual.add(path.relative_to(corpus_path).as_posix())

    if actual != expected:
        raise RuntimeError("Unexpected or missing corpus files")

    return manifest["release_id"]
