#!/usr/bin/env python3
"""Check architectural import boundaries inside src/."""

from __future__ import annotations

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = REPO_ROOT / "src"
IMPORT_RE = re.compile(r'^\s*import\s+.*?\s+from\s+"([^"]+)";', re.MULTILINE)

ALLOWED_TARGET_AREAS = {
    "index": {"core"},
    "core": {"core", "state", "entities", "systems", "data", "rendering", "audio", "ui", "debug"},
    "state": {"state"},
    "entities": {"entities"},
    "systems": {"systems", "core", "state", "entities", "audio", "data"},
    "data": {"data", "core"},
    "rendering": {"rendering", "core"},
    "audio": {"audio", "core"},
    "ui": {"ui", "state", "core"},
    "debug": {"debug", "state", "data", "systems", "core"},
}


def iter_source_files() -> list[Path]:
    return sorted(SRC_ROOT.rglob("*.js"))


def relative_repo_path(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def area_for_path(path: Path) -> str:
    relative = path.relative_to(SRC_ROOT)
    if relative.parts == ("index.js",):
        return "index"
    return relative.parts[0]


def resolve_import(source_path: Path, specifier: str) -> Path | None:
    if not specifier.startswith("."):
        return None
    candidate = (source_path.parent / specifier).resolve()
    if candidate.suffix:
        return candidate
    return candidate.with_suffix(".js")


def check_structure() -> list[str]:
    errors: list[str] = []

    for source_path in iter_source_files():
        source_rel = relative_repo_path(source_path)
        source_area = area_for_path(source_path)
        allowed_targets = ALLOWED_TARGET_AREAS[source_area]
        text = source_path.read_text(encoding="utf-8")

        for specifier in IMPORT_RE.findall(text):
            target_path = resolve_import(source_path, specifier)
            if target_path is None:
                continue

            if not target_path.exists():
                errors.append(
                    f"{source_rel} imports missing path {specifier}. "
                    f"Fix the import or restore the target file."
                )
                continue

            try:
                target_rel = relative_repo_path(target_path)
            except ValueError:
                continue

            if not target_rel.startswith("src/"):
                continue

            target_area = area_for_path(target_path)

            if target_area not in allowed_targets:
                errors.append(
                    f"{source_rel} imports {target_rel}, crossing from `{source_area}` into `{target_area}`. "
                    f"Move shared logic to an allowed layer or update docs/ARCHITECTURE.md and this checker together if the boundary changed intentionally."
                )

            if target_area == "debug" and source_area not in {"core", "index", "debug"}:
                errors.append(
                    f"{source_rel} imports debug-only code at {target_rel}. "
                    f"Route runtime inspection surfaces through `src/core/game.js` instead of depending on `src/debug/` directly."
                )

    return errors


def main() -> int:
    errors = check_structure()
    if errors:
        print("Structural import checks failed:\n")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Structural import checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
