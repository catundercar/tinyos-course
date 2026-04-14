//! Host-side tests for Lab 1 — TrapContext layout & app_init_context.
//!
//! These tests run under the HOST target (e.g. x86_64) via `cargo test`. They
//! exercise pure data-structure logic that does not depend on RISC-V CSRs.
//!
//! NOTE: `app_init_context` reads the `sstatus` CSR, which does not exist on
//! the host. To keep Lab 1 testable, the solution is expected to gate that
//! CSR read behind `#[cfg(target_arch = "riscv64")]` and fall back to a
//! constant on other targets (the test accepts any sstatus value where the
//! SPP bit is clear).

#![cfg(not(target_os = "none"))]

use phase_1_trap::trap::context::TrapContext;

const SSTATUS_SPP: usize = 1 << 8;

#[test]
fn struct_is_272_bytes() {
    assert_eq!(core::mem::size_of::<TrapContext>(), 34 * 8);
}

#[test]
fn fields_are_in_order() {
    let c = TrapContext { x: [0; 32], sstatus: 0, sepc: 0 };
    let base = &c as *const _ as usize;
    assert_eq!(&c.x[0]    as *const _ as usize - base, 0);
    assert_eq!(&c.x[2]    as *const _ as usize - base, 2 * 8);
    assert_eq!(&c.x[31]   as *const _ as usize - base, 31 * 8);
    assert_eq!(&c.sstatus as *const _ as usize - base, 32 * 8);
    assert_eq!(&c.sepc    as *const _ as usize - base, 33 * 8);
}

#[test]
fn set_sp_updates_x2_only() {
    let mut c = TrapContext { x: [7; 32], sstatus: 0, sepc: 0 };
    c.set_sp(0xDEAD_BEEF);
    assert_eq!(c.x[2], 0xDEAD_BEEF);
    for (i, v) in c.x.iter().enumerate() {
        if i != 2 { assert_eq!(*v, 7, "x[{}] clobbered", i); }
    }
}

#[test]
fn app_init_sets_entry_and_sp() {
    let c = TrapContext::app_init_context(0x8040_0000, 0x8050_0000);
    assert_eq!(c.sepc, 0x8040_0000, "sepc must equal entry");
    assert_eq!(c.x[2], 0x8050_0000, "x2 (sp) must equal user_sp");
    assert_eq!(c.sstatus & SSTATUS_SPP, 0, "SPP must be clear for U-mode");
    // All other GPRs zero
    for (i, v) in c.x.iter().enumerate() {
        if i != 2 { assert_eq!(*v, 0, "x[{}] should be 0", i); }
    }
}
