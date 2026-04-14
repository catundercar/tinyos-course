#!/usr/bin/env python3
"""Auto-grader for Phase 1 — Traps & Syscalls."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BAR_LEN = 20
HOST = subprocess.check_output(
    ["rustc", "-vV"], text=True
).split("host: ", 1)[1].splitlines()[0].strip()

LABS = [
    ("Lab 1 · TrapContext", "test_lab1_context"),
    ("Lab 2 · trap_handler", "test_lab2_trap"),
    ("Lab 3 · syscall",     "test_lab3_syscall"),
]


def run_test(name: str) -> tuple[int, int]:
    cmd = [
        "cargo", "test",
        "--target", HOST,
        "--test", name,
        "--", "--format=terse",
    ]
    env = dict(os.environ)
    # Force host build even though .cargo/config pins riscv64
    env["CARGO_BUILD_TARGET"] = HOST
    out = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, env=env)
    text = out.stdout + "\n" + out.stderr
    passed = failed = 0
    for line in text.splitlines():
        if line.startswith("test result:"):
            # e.g.  test result: ok. 4 passed; 0 failed; ...
            toks = line.replace(";", " ").split()
            for i, t in enumerate(toks):
                if t == "passed;" or t == "passed":
                    passed = int(toks[i - 1])
                if t == "failed;" or t == "failed":
                    failed = int(toks[i - 1])
    return passed, passed + failed


def bar(p: int, n: int) -> str:
    if n == 0:
        return "░" * BAR_LEN + "   0%"
    frac = p / n
    filled = int(round(frac * BAR_LEN))
    return "█" * filled + "░" * (BAR_LEN - filled) + f" {int(frac * 100):3d}%"


def main() -> int:
    print("═" * 50)
    print("  Phase 1 · Traps & Syscalls · Grading Report")
    print("═" * 50)
    total_p = total_n = 0
    for label, test in LABS:
        p, n = run_test(test)
        total_p += p
        total_n += n
        print(f"\n  {label}")
        print(f"  {bar(p, n)}  ({p}/{n} tests)")
    print("\n" + "─" * 50)
    pct = 0 if total_n == 0 else int(100 * total_p / total_n)
    print(f"  Overall: {total_p}/{total_n} tests passed ({pct}%)")
    print("─" * 50)

    if shutil.which("qemu-system-riscv64"):
        print("\n  (Run `make qemu` to see the full U-mode → S-mode round-trip.)")
    return 0 if total_p == total_n else 1


if __name__ == "__main__":
    sys.exit(main())
