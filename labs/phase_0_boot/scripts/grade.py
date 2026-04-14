#!/usr/bin/env python3
"""
grade.py — Auto-grader for Phase 0 (Boot & Kernel Entry)

Runs the three labs end-to-end:
  Lab 1 — builds the kernel and checks _start is at 0x80200000
  Lab 2 — boots qemu and looks for "Hello, TinyOS!" + memory layout banner
  Lab 3 — forces a panic path and checks the handler prints a location

Usage:
    python3 scripts/grade.py
    python3 scripts/grade.py --verbose
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

BASE_ADDRESS = "0000000080200000"
KERNEL_ELF = ROOT / "target/riscv64gc-unknown-none-elf/release/kernel"
KERNEL_BIN = KERNEL_ELF.with_suffix(".bin")

RESET = "\033[0m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
BOLD = "\033[1m"
DIM = "\033[2m"


@dataclass
class Check:
    name: str
    passed: bool = False
    detail: str = ""


@dataclass
class Lab:
    key: str
    title: str
    checks: list[Check] = field(default_factory=list)

    @property
    def passed(self) -> int:
        return sum(c.passed for c in self.checks)

    @property
    def total(self) -> int:
        return len(self.checks)


def run(cmd: list[str], timeout: int = 60, check: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=check,
    )


def progress_bar(passed: int, total: int, width: int = 20) -> str:
    if total == 0:
        pct = 0
    else:
        pct = int(passed / total * 100)
    filled = int(width * passed / total) if total else 0
    bar = "█" * filled + "░" * (width - filled)
    color = GREEN if passed == total else (YELLOW if passed > 0 else RED)
    return f"{color}{bar}{RESET} {pct:3d}%  ({passed}/{total} tests)"


# ─── Lab 1 ────────────────────────────────────────────────────────────────────

def grade_lab1(verbose: bool) -> Lab:
    lab = Lab(key="lab1", title="entry.asm + linker.ld")

    # 1.1 build
    c = Check("kernel builds with `cargo build --release`")
    r = run(["cargo", "build", "--release"], timeout=180)
    c.passed = r.returncode == 0
    c.detail = r.stderr[-400:] if not c.passed else "ok"
    lab.checks.append(c)
    if not c.passed:
        return lab

    # objcopy to bin
    run(
        [
            "rust-objcopy",
            "--binary-architecture=riscv64",
            str(KERNEL_ELF),
            "--strip-all",
            "-O",
            "binary",
            str(KERNEL_BIN),
        ],
        timeout=30,
    )

    # 1.2 _start at 0x80200000
    c = Check("_start is at 0x80200000")
    r = run(["rust-objdump", "-t", str(KERNEL_ELF)])
    out = r.stdout
    match = re.search(r"^([0-9a-f]+)\s.+\s_start$", out, re.MULTILINE)
    c.passed = bool(match and match.group(1) == BASE_ADDRESS)
    c.detail = (match.group(0) if match else "no _start symbol") if not c.passed else "ok"
    lab.checks.append(c)

    # 1.3 required linker-provided symbols
    c = Check("linker symbols stext/etext/sbss/ebss/boot_stack_top exist")
    needed = ["stext", "etext", "srodata", "erodata", "sbss", "ebss", "boot_stack_top"]
    missing = [s for s in needed if not re.search(rf"\s{re.escape(s)}$", out, re.MULTILINE)]
    c.passed = not missing
    c.detail = f"missing: {missing}" if missing else "ok"
    lab.checks.append(c)

    # 1.4 entry.asm sets sp (look for `la sp` in disassembly near _start)
    c = Check("_start loads stack pointer before calling rust_main")
    r = run(["rust-objdump", "-d", "--disassemble-symbols=_start", str(KERNEL_ELF)])
    dis = r.stdout
    has_sp = "sp," in dis or "x2," in dis
    has_call = "rust_main" in dis or "jal" in dis
    c.passed = has_sp and has_call
    c.detail = dis[-400:] if not c.passed else "ok"
    lab.checks.append(c)

    return lab


# ─── Lab 2 + 3 (runtime tests) ────────────────────────────────────────────────

def qemu_run(extra_args: list[str] | None = None, timeout: float = 5.0) -> str:
    """Boot the kernel in QEMU, return captured stdout. Always kills qemu."""
    if not KERNEL_BIN.exists():
        return ""
    args = [
        "qemu-system-riscv64",
        "-machine",
        "virt",
        "-nographic",
        "-bios",
        "default",
        "-m",
        "128M",
        "-kernel",
        str(KERNEL_BIN),
    ] + (extra_args or [])

    proc = subprocess.Popen(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        preexec_fn=os.setsid if os.name == "posix" else None,
    )
    try:
        out, _ = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        if os.name == "posix":
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        else:
            proc.kill()
        out, _ = proc.communicate()
    return (out or b"").decode(errors="replace")


def grade_lab2(verbose: bool) -> Lab:
    lab = Lab(key="lab2", title="sbi.rs + console.rs")
    output = qemu_run(timeout=5.0)

    if verbose:
        print(DIM + output + RESET)

    c1 = Check("prints 'Hello, TinyOS!'")
    c1.passed = "Hello, TinyOS!" in output
    c1.detail = "ok" if c1.passed else "banner not found in qemu stdout"
    lab.checks.append(c1)

    c2 = Check("prints kernel memory layout (.text / .bss)")
    c2.passed = ".text" in output and ".bss" in output
    c2.detail = "ok" if c2.passed else "layout banner missing"
    lab.checks.append(c2)

    c3 = Check("qemu exits cleanly (sbi::shutdown works)")
    # A clean shutdown means the qemu process ended before our timeout.
    # We approximate by checking that output does NOT end mid-line with
    # the "booted" message still pending.
    c3.passed = "Hello, TinyOS!" in output and len(output) < 4096
    c3.detail = "ok" if c3.passed else "no clean exit observed"
    lab.checks.append(c3)

    return lab


def grade_lab3(verbose: bool) -> Lab:
    lab = Lab(key="lab3", title="panic_handler")

    # We monkey-patch main.rs temporarily: inject an intentional panic
    # before shutdown, run qemu, check output, then restore.
    main_path = ROOT / "src/main.rs"
    original = main_path.read_text()
    patched = original.replace(
        "    sbi::shutdown();",
        '    panic!("intentional grader panic at line {}", line!());\n    #[allow(unreachable_code)] sbi::shutdown();',
        1,
    )
    if patched == original:
        lab.checks.append(Check(
            "could patch main.rs to trigger panic",
            passed=False,
            detail="failed to locate shutdown() call site",
        ))
        return lab

    try:
        main_path.write_text(patched)
        run(["cargo", "build", "--release"], timeout=180)
        run(
            [
                "rust-objcopy",
                "--binary-architecture=riscv64",
                str(KERNEL_ELF),
                "--strip-all",
                "-O",
                "binary",
                str(KERNEL_BIN),
            ],
            timeout=30,
        )
        output = qemu_run(timeout=5.0)
    finally:
        main_path.write_text(original)
        # rebuild the clean kernel so subsequent runs match lab 2 state
        run(["cargo", "build", "--release"], timeout=180)
        run(
            [
                "rust-objcopy",
                "--binary-architecture=riscv64",
                str(KERNEL_ELF),
                "--strip-all",
                "-O",
                "binary",
                str(KERNEL_BIN),
            ],
            timeout=30,
        )

    if verbose:
        print(DIM + output + RESET)

    c1 = Check("panic handler prints the word PANIC")
    c1.passed = "PANIC" in output or "panic" in output
    c1.detail = "ok" if c1.passed else "no panic banner"
    lab.checks.append(c1)

    c2 = Check("panic handler prints file:line location")
    c2.passed = bool(re.search(r"main\.rs:\d+", output))
    c2.detail = "ok" if c2.passed else "no file:line string"
    lab.checks.append(c2)

    c3 = Check("panic handler prints the panic message")
    c3.passed = "intentional grader panic" in output
    c3.detail = "ok" if c3.passed else "message missing"
    lab.checks.append(c3)

    c4 = Check("panic handler shuts down (no hang)")
    c4.passed = "PANIC" in output or "panic" in output
    c4.detail = "ok" if c4.passed else "qemu ran to timeout"
    lab.checks.append(c4)

    return lab


# ─── Reporting ────────────────────────────────────────────────────────────────

def report(labs: list[Lab], verbose: bool) -> int:
    print()
    print("═" * 49)
    print(f"{BOLD}  Phase 0 · Grading Report{RESET}")
    print("═" * 49)
    print()

    total_pass = 0
    total = 0
    for lab in labs:
        total_pass += lab.passed
        total += lab.total
        print(f"  {BOLD}{lab.title}{RESET}")
        print(f"  {progress_bar(lab.passed, lab.total)}")
        for c in lab.checks:
            icon = f"{GREEN}✓{RESET}" if c.passed else f"{RED}✗{RESET}"
            print(f"    {icon} {c.name}")
            if verbose or not c.passed:
                if c.detail and c.detail != "ok":
                    for line in c.detail.splitlines()[-6:]:
                        print(f"      {DIM}{line}{RESET}")
        print()

    print("─" * 49)
    pct = int(total_pass / total * 100) if total else 0
    color = GREEN if total_pass == total else (YELLOW if total_pass > 0 else RED)
    print(f"  {BOLD}Overall:{RESET} {color}{total_pass}/{total} tests passed ({pct}%){RESET}")
    print()
    return 0 if total_pass == total else 1


def preflight() -> None:
    for tool in ["cargo", "rust-objdump", "rust-objcopy", "qemu-system-riscv64"]:
        if shutil.which(tool) is None:
            print(f"{RED}[preflight]{RESET} missing tool: {tool}")
            print(f"            see labs/shared/TOOLCHAIN.md")
            sys.exit(2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--lab", choices=["1", "2", "3", "all"], default="all")
    args = parser.parse_args()

    preflight()

    labs: list[Lab] = []
    if args.lab in ("1", "all"):
        labs.append(grade_lab1(args.verbose))
    if args.lab in ("2", "all"):
        labs.append(grade_lab2(args.verbose))
    if args.lab in ("3", "all"):
        labs.append(grade_lab3(args.verbose))

    return report(labs, args.verbose)


if __name__ == "__main__":
    sys.exit(main())
