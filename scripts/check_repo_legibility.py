#!/usr/bin/env python3
"""Validate the repo's legibility artifacts and generated references."""

from __future__ import annotations

import json
import re
import subprocess

from generate_content_inventory import REPO_ROOT, render_inventory


REQUIRED_FILES = [
    "AGENTS.md",
    "README.md",
    "docs/index.md",
    "docs/ARCHITECTURE.md",
    "docs/QUALITY.md",
    "docs/RUNTIME.md",
    "docs/content/stages-bosses.md",
    "docs/generated/content-inventory.md",
    "package.json",
    "package-lock.json",
    "playwright.config.mjs",
    "scripts/generate_content_inventory.py",
    "scripts/run_fast_tests.mjs",
    "scripts/validate_fast.mjs",
    "scripts/check_structure.mjs",
    "scripts/check_content_contract.mjs",
    "scripts/check_combat_smoke.mjs",
    "scripts/check_powerup_smoke.mjs",
    "scripts/check_runtime_smoke.mjs",
    "scripts/check_runtime_browser_smoke.mjs",
    "tests/helpers/fixtures.mjs",
    "tests/helpers/runtimeFixture.mjs",
    "tests/contract/content/content-contract.test.mjs",
    "tests/scenario/combat/combat-scenarios.test.mjs",
    "tests/scenario/powerups/powerup-scenarios.test.mjs",
    "tests/scenario/runtime/runtime-scenarios.test.mjs",
    "tests/browser/runtime-browser.spec.mjs",
    "tests/unit/runtime/resource-cleanup.test.mjs",
    "tests/unit/structure/module-graph.test.mjs",
]

MARKDOWN_FILES = [
    "AGENTS.md",
    "README.md",
    "docs/index.md",
    "docs/ARCHITECTURE.md",
    "docs/QUALITY.md",
    "docs/RUNTIME.md",
    "docs/content/stages-bosses.md",
    "docs/generated/content-inventory.md",
]

LOCAL_LINK_RE = re.compile(r"\[[^\]]+\]\((?!https?://|mailto:|#)([^)]+)\)")


def require_files() -> list[str]:
    errors: list[str] = []
    for relative_path in REQUIRED_FILES:
        if not (REPO_ROOT / relative_path).exists():
            errors.append(
                f"Missing required file: {relative_path}. "
                f"Create it or update scripts/check_repo_legibility.py if the structure changed intentionally."
            )
    return errors


def check_markdown_links() -> list[str]:
    errors: list[str] = []
    for relative_path in MARKDOWN_FILES:
        path = REPO_ROOT / relative_path
        text = path.read_text(encoding="utf-8")
        for target in LOCAL_LINK_RE.findall(text):
            resolved = (path.parent / target).resolve()
            if not resolved.exists():
                errors.append(
                    f"Broken local link in {relative_path}: {target}. "
                    f"Fix the link or restore the target file."
                )
    return errors


def check_generated_inventory() -> list[str]:
    target = REPO_ROOT / "docs/generated/content-inventory.md"
    actual = target.read_text(encoding="utf-8").rstrip()
    expected = render_inventory().rstrip()
    if actual != expected:
        return [
            "docs/generated/content-inventory.md is stale. "
            "Run `python3 scripts/generate_content_inventory.py` and commit the refreshed file."
        ]
    return []


def check_structure() -> list[str]:
    result = subprocess.run(
        ["node", "scripts/check_structure.mjs", "--json"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError:
        detail = result.stderr.strip() or result.stdout.strip() or f"exit status {result.returncode}"
        return [f"Structural module graph checker did not return a valid report: {detail}"]
    return report.get("errors", [])


def main() -> int:
    errors = []
    errors.extend(require_files())
    errors.extend(check_markdown_links())
    errors.extend(check_generated_inventory())
    errors.extend(check_structure())

    if errors:
        print("Repo legibility checks failed:\n")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Repo legibility checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
