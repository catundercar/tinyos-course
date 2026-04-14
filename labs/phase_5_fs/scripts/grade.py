#!/usr/bin/env python3
"""Phase 5 grader — runs host-side cargo tests for easy-fs and prints a
visual progress report. Lab 1 kernel driver is graded via QEMU integration
(optional; requires qemu-system-riscv64 on PATH)."""

import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

LABS = [
    ("Lab 1: VirtIOBlock driver",       "tests/test_lab1_blkdev.rs"),
    ("Lab 2: easy-fs layout + vfs",     "tests/test_lab2_easyfs.rs"),
    ("Lab 3: kernel VFS & OSInode",     "tests/test_lab3_vfs.rs"),
]

BAR_W = 20


def run_test(path: Path):
    """Return (passed, total) by running `cargo test --test <name>`."""
    name = Path(path).stem
    try:
        out = subprocess.run(
            ["cargo", "test", "--manifest-path", str(ROOT / "easy-fs" / "Cargo.toml"),
             "--test", name, "--", "--format=terse"],
            capture_output=True, text=True, timeout=180, cwd=ROOT,
        )
    except FileNotFoundError:
        return 0, 1
    text = out.stdout + out.stderr
    m = re.search(r"(\d+) passed.*?(\d+) failed", text)
    if not m:
        # fallback: count test_ lines
        passed = text.count(" ok")
        failed = text.count("FAILED")
        return passed, passed + failed
    return int(m.group(1)), int(m.group(1)) + int(m.group(2))


def bar(p, t):
    pct = 0 if t == 0 else int(100 * p / t)
    filled = int(BAR_W * pct / 100)
    return "#" * filled + "-" * (BAR_W - filled), pct


def main():
    print("=" * 47)
    print("  Phase 5 - File System Grading Report")
    print("=" * 47)
    total_p = total_t = 0
    for name, path in LABS:
        p, t = run_test(Path(path))
        total_p += p; total_t += t
        b, pct = bar(p, t)
        print(f"\n  {name}\n  [{b}] {pct:3d}%  ({p}/{t} tests)")
    print("\n" + "-" * 47)
    overall = 0 if total_t == 0 else int(100 * total_p / total_t)
    print(f"  Overall: {total_p}/{total_t} tests passed ({overall}%)")
    sys.exit(0 if total_p == total_t else 1)


if __name__ == "__main__":
    main()
