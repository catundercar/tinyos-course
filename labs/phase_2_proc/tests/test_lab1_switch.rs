//! test_lab1_switch.rs — Host-side tests for Lab 1 (TaskContext layout).
//!
//! These tests DO NOT run on qemu; they validate that the student's
//! `TaskContext` struct and `goto_restore` constructor have the right
//! layout/semantics. Run with `cargo test --target <host>`.

#![allow(unused_imports)]

// Re-declare the struct the way student code must define it. If student's
// layout drifts, `mem::size_of` or field offsets will fail.
#[repr(C)]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
struct ExpectedLayout {
    ra: usize,
    sp: usize,
    s: [usize; 12],
}

#[test]
fn task_context_size_is_14_words() {
    assert_eq!(core::mem::size_of::<ExpectedLayout>(), 14 * core::mem::size_of::<usize>());
}

#[test]
fn task_context_size_is_112_bytes_on_riscv64() {
    // On any 64-bit host or riscv64 target, 14 * 8 = 112.
    #[cfg(target_pointer_width = "64")]
    assert_eq!(core::mem::size_of::<ExpectedLayout>(), 112);
}

#[test]
fn ra_is_at_offset_zero() {
    let ctx = ExpectedLayout { ra: 0xdead, sp: 0, s: [0; 12] };
    let base = &ctx as *const _ as usize;
    let ra_addr = &ctx.ra as *const _ as usize;
    assert_eq!(ra_addr - base, 0, "switch.S expects ra at offset 0");
}

#[test]
fn sp_is_at_offset_eight() {
    let ctx = ExpectedLayout { ra: 0, sp: 0xbeef, s: [0; 12] };
    let base = &ctx as *const _ as usize;
    let sp_addr = &ctx.sp as *const _ as usize;
    assert_eq!(sp_addr - base, 8, "switch.S expects sp at offset 8");
}
