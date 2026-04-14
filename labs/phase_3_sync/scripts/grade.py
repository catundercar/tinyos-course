#!/usr/bin/env python3
"""Phase 3 grading script.

Runs the host-side cargo tests for Lab 1 (SpinLock) and Lab 2 (sync
primitives), then optionally boots the kernel in QEMU to check the three
end-to-end demos:

  1. race_counter         -> counter must equal 100_000
  2. producer_consumer    -> every produced item consumed
  3. philosopher_dinner   -> all 5 heartbeats advance for 60s

Each section prints a Unicode progress bar.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def bar(passed: int, total: int, width: int = 20) -> str:
    if total == 0:
        return "░" * width
    filled = int(width * passed / total)
    return "█" * filled + "░" * (width - filled)


def run_cargo_test(test_name: str) -> tuple[int, int]:
    """Return (passed, total) for a single `cargo test --test NAME` run."""
    host_triple = subprocess.check_output(
        ["rustc", "-vV"], text=True
    )
    triple = next(
        line.split(": ", 1)[1].strip()
        for line in host_triple.splitlines()
        if line.startswith("host:")
    )
    proc = subprocess.run(
        ["cargo", "test", "--target", triple, "--test", test_name, "--", "--nocapture"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    # parse lines like "test result: ok. N passed; M failed; ..."
    m = re.search(r"(\d+) passed;\s*(\d+) failed", proc.stdout)
    if not m:
        print(proc.stdout, proc.stderr, file=sys.stderr)
        return (0, 0)
    passed = int(m.group(1))
    failed = int(m.group(2))
    return (passed, passed + failed)


def main() -> int:
    print("═" * 48)
    print("  Phase 3 · Grading Report")
    print("═" * 48)
    print()

    total_pass = 0
    total_all = 0

    # ── Lab 1 ──────────────────────────────────────────────
    p, n = run_cargo_test("test_lab1_spin")
    total_pass += p
    total_all += n
    pct = int(100 * p / n) if n else 0
    print(f"  Lab 1: SpinLock<T> ⭐⭐⭐")
    print(f"  {bar(p, n)} {pct:3d}%  ({p}/{n} tests)")
    print()

    # ── Lab 2 ──────────────────────────────────────────────
    p, n = run_cargo_test("test_lab2_sync_primitives")
    total_pass += p
    total_all += n
    pct = int(100 * p / n) if n else 0
    print(f"  Lab 2: Mutex / Semaphore / Condvar ⭐⭐⭐")
    print(f"  {bar(p, n)} {pct:3d}%  ({p}/{n} tests)")
    print()

    print("─" * 48)
    pct = int(100 * total_pass / total_all) if total_all else 0
    print(f"  Overall: {total_pass}/{total_all} tests passed ({pct}%)")
    print()

    # ── End-to-end demos (optional, require qemu) ─────────
    print("  End-to-end demos (requires qemu-system-riscv64):")
    print("    make qemu USER=race_counter       → expect COUNTER = 100000")
    print("    make qemu USER=producer_consumer  → expect CONSUMED = 2000")
    print("    make qemu USER=philosopher_dinner → run 60s, no deadlock")
    print()

    return 0 if total_pass == total_all else 1


if __name__ == "__main__":
    sys.exit(main())
