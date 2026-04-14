"""Shared utilities for per-phase scripts/grade.py.

Each phase's grader imports these helpers so the progress-bar /
spawn-qemu / regex-match logic stays consistent across phases.
"""
from __future__ import annotations

import subprocess
import sys
import re
from dataclasses import dataclass


@dataclass
class Check:
    name: str
    passed: bool
    detail: str = ""


def bar(passed: int, total: int, width: int = 30) -> str:
    """Return an ASCII progress bar — filled = passed, empty = remaining."""
    if total <= 0:
        return "[" + " " * width + "] 0/0"
    filled = int(width * passed / total)
    return "[" + "█" * filled + "░" * (width - filled) + f"] {passed}/{total}"


def run_qemu(kernel_bin: str, fs_img: str | None = None, timeout: int = 10) -> str:
    """Boot qemu-system-riscv64 and return its stdout+stderr as one string."""
    args = [
        "qemu-system-riscv64", "-machine", "virt", "-bios", "default",
        "-kernel", kernel_bin, "-m", "128M", "-nographic", "-smp", "1",
    ]
    if fs_img:
        args += [
            "-drive", f"file={fs_img},if=none,format=raw,id=x0",
            "-device", "virtio-blk-device,drive=x0,bus=virtio-mmio-bus.0",
        ]
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return r.stdout + "\n" + r.stderr
    except subprocess.TimeoutExpired as e:
        return (e.stdout or b"").decode() + "\n<timeout>"


def expect(haystack: str, needle: str | re.Pattern) -> bool:
    """True iff the substring or regex is present."""
    if isinstance(needle, re.Pattern):
        return bool(needle.search(haystack))
    return needle in haystack


def report(checks: list[Check]) -> int:
    """Print a checklist + bar; return shell exit code (0 if all pass)."""
    total = len(checks)
    passed = sum(c.passed for c in checks)
    for c in checks:
        mark = "✓" if c.passed else "✗"
        line = f"  {mark} {c.name}"
        if c.detail:
            line += f"  — {c.detail}"
        print(line)
    print("\n" + bar(passed, total) + f"  ({passed}/{total} passed)")
    return 0 if passed == total else 1
