#!/usr/bin/env python3
"""Phase 4 auto-grader. Runs each lab's host-side tests and prints a visual
progress report."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

LABS = [
    ("Lab 1: Frame Allocator",     "test_lab1_frame"),
    ("Lab 2: Page Table (SV39)",   "test_lab2_pagetable"),
    ("Lab 3: MemorySet / MapArea", "test_lab3_memset"),
]

BAR_WIDTH = 20

def bar(frac: float) -> str:
    filled = int(round(frac * BAR_WIDTH))
    return "█" * filled + "░" * (BAR_WIDTH - filled)

def run_one(test_name: str):
    """Return (passed, total)."""
    try:
        out = subprocess.run(
            ["cargo", "test", "--test", test_name, "--", "--test-threads=1"],
            cwd=ROOT, capture_output=True, text=True, timeout=180,
        )
    except FileNotFoundError:
        print("cargo not found — install Rust toolchain first.", file=sys.stderr)
        sys.exit(2)
    text = out.stdout + out.stderr
    m = re.search(r"test result:.*?(\d+) passed.*?(\d+) failed", text)
    if not m:
        return (0, 1)   # treat compile errors as 0/1
    passed = int(m.group(1))
    failed = int(m.group(2))
    return (passed, passed + failed)

def main():
    print("═══════════════════════════════════════════")
    print("  Phase 4 · Virtual Memory — Grading Report")
    print("═══════════════════════════════════════════")
    print()
    total_p = total_t = 0
    for title, test in LABS:
        p, t = run_one(test)
        frac = (p / t) if t else 0
        pct = int(round(frac * 100))
        print(f"  {title}")
        print(f"  {bar(frac)}  {pct:>3}%  ({p}/{t} tests)")
        print()
        total_p += p; total_t += t
    print("─────────────────────────────────────────────")
    overall = int(round(100 * total_p / max(total_t, 1)))
    print(f"  Overall: {total_p}/{total_t} tests passed ({overall}%)")

if __name__ == "__main__":
    main()
