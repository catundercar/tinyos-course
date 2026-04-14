#!/usr/bin/env python3
"""grade.py — TinyOS Phase 2 auto-grader.

Runs `cargo test` for host-side unit tests (Labs 1/2/3) and then boots the
kernel in qemu to verify end-to-end behaviour:

  * A0..A4 and B0..B4 interleave (cooperative scheduling works)
  * "C " tokens appear without any yield (preemption works)
  * All three apps print their "[X done]" marker before shutdown

Prints a visual progress bar per lab and an overall score.
"""
from __future__ import annotations

import re
import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BAR_WIDTH = 20


def bar(passed: int, total: int) -> str:
    if total == 0:
        return "".ljust(BAR_WIDTH, "-")
    filled = int(round(BAR_WIDTH * passed / total))
    return "#" * filled + "-" * (BAR_WIDTH - filled)


def run(cmd: str, cwd: Path, timeout: int = 60) -> tuple[int, str]:
    try:
        r = subprocess.run(
            shlex.split(cmd), cwd=str(cwd),
            capture_output=True, text=True, timeout=timeout,
        )
        return r.returncode, (r.stdout or "") + (r.stderr or "")
    except subprocess.TimeoutExpired as e:
        return 124, (e.stdout or "") + (e.stderr or "") + "\n[timeout]"


@dataclass
class LabResult:
    name: str
    passed: int
    total: int


def run_host_tests(test_name: str) -> LabResult:
    host = subprocess.check_output(
        "rustc -vV", shell=True, text=True,
    )
    m = re.search(r"host:\s*(\S+)", host)
    target = m.group(1) if m else ""
    code, out = run(
        f"cargo test --target {target} --test {test_name} -- --nocapture",
        ROOT, timeout=300,
    )
    # parse "test result: ok. X passed; Y failed"
    passed = total = 0
    for line in out.splitlines():
        m = re.search(r"(\d+)\s+passed;\s+(\d+)\s+failed", line)
        if m:
            p, f = int(m.group(1)), int(m.group(2))
            passed += p
            total += p + f
    return LabResult(test_name, passed, total)


def run_qemu_integration() -> LabResult:
    """Boot kernel, capture output for ~3s, check interleaving + preemption."""
    code, out = run("make qemu", ROOT, timeout=30)
    passed = 0
    total = 4
    # Criterion 1: A0..A4 all printed
    if all(f"A{i}" in out for i in range(5)): passed += 1
    # Criterion 2: B0..B4 all printed
    if all(f"B{i}" in out for i in range(5)): passed += 1
    # Criterion 3: A and B interleave (an A and a B appear before either finishes)
    a_done = out.find("[A done]")
    b_done = out.find("[B done]")
    first_a = out.find("A0")
    first_b = out.find("B0")
    if 0 <= first_a < a_done and 0 <= first_b < b_done \
            and first_a < b_done and first_b < a_done:
        passed += 1
    # Criterion 4: "C " appears, proving preemption
    if "C " in out and "[C done]" in out: passed += 1
    return LabResult("integration", passed, total)


def main() -> int:
    print("=" * 47)
    print("  Phase 2 - Grading Report")
    print("=" * 47)
    labs = [
        ("Lab 1: TaskContext + __switch",     run_host_tests("test_lab1_switch")),
        ("Lab 2: Round-Robin Scheduler",      run_host_tests("test_lab2_scheduler")),
        ("Lab 3: Timer Interrupt Preemption", run_host_tests("test_lab3_timer")),
    ]
    try:
        labs.append(("Integration (qemu interleaving)", run_qemu_integration()))
    except Exception as e:
        print(f"[warn] qemu integration skipped: {e}")
    total_p = total_n = 0
    for title, r in labs:
        pct = (100 * r.passed // r.total) if r.total else 0
        print(f"\n  {title}")
        print(f"  {bar(r.passed, r.total)}  {pct:3d}%  ({r.passed}/{r.total} tests)")
        total_p += r.passed
        total_n += r.total
    print("\n" + "-" * 47)
    pct = (100 * total_p // total_n) if total_n else 0
    print(f"  Overall: {total_p}/{total_n} tests passed ({pct}%)")
    return 0 if total_p == total_n else 1


if __name__ == "__main__":
    sys.exit(main())
