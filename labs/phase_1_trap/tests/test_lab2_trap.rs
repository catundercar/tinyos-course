//! Host-side sanity tests for Lab 2 — trap_handler dispatch.
//!
//! Fully covering __alltraps / __restore requires running in QEMU (see
//! `scripts/grade.py`). These host-level tests lock down the Rust-side
//! behaviour of `trap_handler`: the syscall path must bump sepc and write a0.

#![cfg(not(target_os = "none"))]

use phase_1_trap::trap::context::TrapContext;

// We re-export the handler behind a test cfg so we can invoke it. See
// `src/trap/mod.rs`: when built for the host target, the handler substitutes
// `exit_current` with a panic and `console_putchar` with a thread-local sink.
// Students are expected to keep that shim (provided) intact.

#[test]
fn syscall_path_advances_sepc_and_writes_a0() {
    let mut cx = TrapContext { x: [0; 32], sstatus: 0, sepc: 0x8040_1000 };
    // a7 = getpid, a0..a2 = zeros
    cx.x[17] = 172;
    // scause is set by the test shim — see host_shim module below.
    phase_1_trap::test_support::set_scause_ecall_from_u();

    phase_1_trap::trap::trap_handler(&mut cx);

    assert_eq!(cx.sepc, 0x8040_1004, "sepc must be bumped by 4");
    assert_eq!(cx.x[10], 0, "getpid must return 0 in Phase 1");
}
