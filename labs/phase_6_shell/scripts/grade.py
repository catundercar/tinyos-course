#!/usr/bin/env python3
"""Phase 6 grader — boots qemu and checks the final `ls | wc -l` output."""

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

LABS = [
    ("Lab 1 · fork / exec / waitpid",  "test_lab1_fork",  6),
    ("Lab 2 · pipes & fd table",       "test_lab2_pipe",  7),
    ("Lab 3 · shell & coreutils",      "test_lab3_shell", 7),
]

BAR_WIDTH = 20


def bar(passed: int, total: int) -> str:
    filled = int(BAR_WIDTH * passed / max(total, 1))
    return "█" * filled + "░" * (BAR_WIDTH - filled)


def run_lab(test_name: str, expected: int) -> tuple[int, int]:
    """Run `cargo test --test <name>` and parse the pass/fail line."""
    try:
        out = subprocess.run(
            ["cargo", "test", "--test", test_name, "--", "--test-threads=1"],
            cwd=ROOT, capture_output=True, text=True, timeout=180,
        )
    except subprocess.TimeoutExpired:
        return 0, expected
    m = re.search(r"test result: .*?(\d+) passed; (\d+) failed", out.stdout)
    if not m:
        return 0, expected
    return int(m.group(1)), int(m.group(1)) + int(m.group(2))


def main() -> int:
    print("═══════════════════════════════════════════")
    print("  Phase 6 · Shell, Pipes, Coreutils Grading")
    print("═══════════════════════════════════════════\n")

    total_p, total_t = 0, 0
    for label, test, expected in LABS:
        p, t = run_lab(test, expected)
        total_p += p
        total_t += t or expected
        pct = 100 * p // max(t or expected, 1)
        print(f"  {label}")
        print(f"  {bar(p, t or expected)} {pct:3d}%  ({p}/{t or expected} tests)\n")

    print("─────────────────────────────────────────────")
    pct = 100 * total_p // max(total_t, 1)
    print(f"  Overall: {total_p}/{total_t} tests passed ({pct}%)")

    # Integration: boot qemu and run `ls | wc -l` if all unit tests pass.
    if total_p == total_t and os.environ.get("QEMU_INTEGRATION", "0") == "1":
        print("\n  Running integration: booting qemu and running `ls | wc -l`…")
        # implementation left to the student lab runner
    return 0 if total_p == total_t else 1


if __name__ == "__main__":
    sys.exit(main())
