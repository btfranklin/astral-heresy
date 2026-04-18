#!/usr/bin/env python3
"""Generate a checked-in gameplay inventory from source."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent


def load_content_snapshot() -> dict[str, object]:
    node_source = """
import { bossDefinitions, listBossShowcaseEntries } from "./src/data/bosses.js";
import { listEnemyShowcaseEntries } from "./src/data/enemies.js";
import { listPatternHelpers } from "./src/data/patterns.js";
import { stageDefinitions } from "./src/data/stages.js";

const snapshot = {
  stages: stageDefinitions.map((stage) => ({
    key: stage.key,
    name: stage.name,
    bossKey: stage.bossKey,
  })),
  bosses: bossDefinitions.map((boss) => ({
    key: boss.key,
    name: boss.name,
    renderKey: boss.renderKey,
    phases: boss.phases.map((phase) => phase.name),
  })),
  enemyShowcaseEntries: listEnemyShowcaseEntries(),
  bossShowcaseEntries: listBossShowcaseEntries(),
  patternHelpers: listPatternHelpers(),
};

console.log(JSON.stringify(snapshot));
"""

    result = subprocess.run(
        ["node", "--input-type=module", "-e", node_source],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def render_inventory() -> str:
    snapshot = load_content_snapshot()
    stages = snapshot["stages"]
    bosses = snapshot["bosses"]
    enemy_entries = snapshot["enemyShowcaseEntries"]
    boss_entries = snapshot["bossShowcaseEntries"]
    pattern_helpers = snapshot["patternHelpers"]

    lines = [
        "# Content Inventory",
        "",
        "This file is generated from source. Do not edit it by hand.",
        "",
        "Refresh command:",
        "",
        "```bash",
        "python3 scripts/generate_content_inventory.py",
        "```",
        "",
        "## Stages",
        "",
    ]

    for stage in stages:
        lines.append(f"- {stage['name']} (`{stage['key']}`) -> boss `{stage['bossKey']}`")

    lines.extend(
        [
            "",
            "## Bosses",
            "",
        ]
    )

    for boss in bosses:
        lines.append(f"- {boss['name']} (`{boss['key']}`, render `{boss['renderKey']}`)")
        phases = boss["phases"]
        for phase in phases:
            lines.append(f"  - {phase}")

    lines.extend(
        [
            "",
            "## Render-Study Enemy Keys",
            "",
        ]
    )

    for entry in enemy_entries:
        lines.append(f"- `{entry['key']}` ({entry['label']})")

    lines.extend(
        [
            "",
            "## Render-Study Boss Keys",
            "",
        ]
    )

    for entry in boss_entries:
        lines.append(f"- `{entry['key']}` ({entry['label']})")

    lines.extend(
        [
            "",
            "## Pattern Helpers",
            "",
        ]
    )

    for helper in pattern_helpers:
        lines.append(f"- `{helper}`")

    lines.extend(
        [
            "",
            "## Example URLs",
            "",
        ]
    )

    if enemy_entries:
        lines.append(f"- `/?mode=render&enemy={enemy_entries[0]['key']}`")

    for index, entry in enumerate(boss_entries, start=1):
        lines.append(f"- `/?mode=render&boss={entry['key']}&phase={index}`")
    lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Print the generated file instead of writing it to docs/generated/content-inventory.md.",
    )
    args = parser.parse_args()

    output = render_inventory()
    if args.stdout:
        print(output)
        return 0

    target = REPO_ROOT / "docs/generated/content-inventory.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(output + "\n", encoding="utf-8")
    print(f"Wrote {target.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
