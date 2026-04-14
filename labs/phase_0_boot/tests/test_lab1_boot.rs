//! tests/test_lab1_boot.rs — Host-side smoke tests for Phase 0.
//!
//! These tests run on the host (not inside QEMU). They check:
//!   - The kernel ELF builds
//!   - Required symbols exist at the right addresses
//!   - Running under QEMU prints the expected output
//!
//! Run with:  cargo test --test test_lab1_boot -- --nocapture
//!            (or simply `python3 scripts/grade.py` for the nicer UI)
//!
//! Note: these tests shell out to `cargo`, `rust-objdump`, and
//! `qemu-system-riscv64`, so they expect a working toolchain (see
//! labs/shared/TOOLCHAIN.md).

use std::process::{Command, Stdio};
use std::time::Duration;

const KERNEL_ELF: &str = "target/riscv64gc-unknown-none-elf/release/kernel";
const BASE_ADDRESS: &str = "0000000080200000";

fn build_kernel() {
    let status = Command::new("cargo")
        .args(["build", "--release"])
        .status()
        .expect("failed to run cargo");
    assert!(status.success(), "cargo build failed");
    // objcopy to .bin as well
    let _ = Command::new("rust-objcopy")
        .args([
            "--binary-architecture=riscv64",
            KERNEL_ELF,
            "--strip-all",
            "-O",
            "binary",
            &format!("{}.bin", KERNEL_ELF),
        ])
        .status();
}

fn nm(symbol: &str) -> Option<String> {
    let out = Command::new("rust-objdump")
        .args(["-t", KERNEL_ELF])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout).to_string();
    text.lines()
        .find(|l| l.ends_with(&format!(" {}", symbol)))
        .map(|s| s.to_string())
}

#[test]
fn lab1_kernel_builds() {
    build_kernel();
    assert!(
        std::path::Path::new(KERNEL_ELF).exists(),
        "kernel ELF not produced"
    );
}

#[test]
fn lab1_start_symbol_at_base_address() {
    build_kernel();
    let line = nm("_start").expect("_start symbol missing — check entry.asm");
    assert!(
        line.starts_with(BASE_ADDRESS),
        "_start is not at 0x80200000, got: {}",
        line
    );
}

#[test]
fn lab1_bss_symbols_present() {
    build_kernel();
    for sym in ["sbss", "ebss", "boot_stack_top"] {
        assert!(
            nm(sym).is_some(),
            "required linker symbol `{}` missing",
            sym
        );
    }
}

/// Full end-to-end: spawn QEMU, capture stdout, check for the
/// expected hello banner. Bounded by a timeout so a hung kernel does
/// not stall CI.
#[test]
#[ignore] // run with: cargo test -- --ignored
fn lab123_qemu_prints_hello() {
    build_kernel();
    let mut child = Command::new("qemu-system-riscv64")
        .args([
            "-machine",
            "virt",
            "-nographic",
            "-bios",
            "default",
            "-m",
            "128M",
            "-kernel",
            &format!("{}.bin", KERNEL_ELF),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to launch qemu");

    // Give the kernel a moment to boot, then kill.
    std::thread::sleep(Duration::from_secs(3));
    let _ = child.kill();
    let output = child.wait_with_output().expect("qemu wait failed");
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("Hello, TinyOS!"),
        "expected 'Hello, TinyOS!' in qemu output, got: {}",
        stdout
    );
}
