#!/usr/bin/env python3
"""Распаковывает проверенную исходную сборку игры."""

from __future__ import annotations

import base64
import hashlib
import io
import shutil
import sys
import tarfile
from pathlib import Path

EXPECTED_SHA256 = "c91fb6c1dccd4aec9c07ccd77ea43e076dd7beea13abfcb6debf8338a5a38313"
ROOT = Path(__file__).resolve().parents[1]
PARTS_DIR = ROOT / ".upgrade"


def main() -> int:
    target = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "build-source"
    parts = sorted(PARTS_DIR.glob("part*.txt"))
    if not parts:
        raise SystemExit("Части игрового пакета не найдены.")

    encoded = "".join(part.read_text(encoding="utf-8") for part in parts)
    archive = base64.b64decode(encoded, validate=True)
    actual = hashlib.sha256(archive).hexdigest()
    if actual != EXPECTED_SHA256:
        raise SystemExit(f"Контрольная сумма не совпала: {actual}")

    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)

    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
        bundle.extractall(target, filter="data")

    print(f"Исходники распакованы: {target}")
    print(f"SHA-256 подтверждён: {actual}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
