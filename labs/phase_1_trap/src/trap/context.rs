//! Trap context (LAB 1 · ⭐⭐).
//!
//! When the hardware takes a trap from U-mode to S-mode, it ONLY saves `sepc`
//! and bumps the privilege bit in `sstatus`. Every general-purpose register is
//! still live and will be clobbered the moment we execute Rust code. So our
//! very first job, in `__alltraps`, is to spill all 32 GPRs plus `sstatus` and
//! `sepc` into a struct shaped exactly like this one.
//!
//! ```text
//! offset (×8)   field
//!   0..=31      x[0] .. x[31]       ← general-purpose registers
//!   32          sstatus             ← saved privilege / interrupt mode
//!   33          sepc                ← return address (user PC)
//! ```
//!
//! Total: 34 * 8 = 272 bytes.

use crate::types::SSTATUS_SPP;

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct TrapContext {
    /// General purpose registers x0..x31.
    pub x:       [usize; 32],
    /// Saved supervisor status register.
    pub sstatus: usize,
    /// Program counter to return to (user EIP at the time of the trap).
    pub sepc:    usize,
}

impl TrapContext {
    /// Overwrite x2 (sp) — useful for kernel code that wants the user to
    /// return onto a specific user stack.
    pub fn set_sp(&mut self, sp: usize) {
        self.x[2] = sp;
    }

    /// Build the initial TrapContext for a fresh user app.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Return a fully-initialised `TrapContext` with all GPRs = 0 except
    ///    for `x2` (sp) which must equal `user_sp`.
    /// 2. `sepc` must equal `entry` — this is the U-mode PC the CPU will
    ///    jump to when `__restore` completes with `sret`.
    /// 3. `sstatus` must have SPP = 0 so that `sret` drops us into U-mode
    ///    (not back into S-mode). Leave SIE/SPIE at their reset values.
    ///
    /// HINT: Read `sstatus` with the `riscv` CSR macro or inline asm:
    ///   `let mut s: usize; asm!("csrr {}, sstatus", out(reg) s);`
    /// then clear the SPP bit using `SSTATUS_SPP` from `types.rs`.
    ///
    /// HINT: `[0usize; 32]` is the idiomatic way to zero a GPR array.
    pub fn app_init_context(entry: usize, user_sp: usize) -> Self {
        // TODO: Implement
        // Step 1: read sstatus into a local
        // Step 2: clear the SPP bit so sret returns to U-mode
        // Step 3: build the struct with x = [0;32], x[2] = user_sp,
        //         sstatus = <patched value>, sepc = entry
        // Step 4: return it
        let _ = (entry, user_sp, SSTATUS_SPP);
        unimplemented!("TODO: implement TrapContext::app_init_context")
    }
}

// ── Sanity checks — these compile only if the struct layout is right ──
#[cfg(any(test, not(target_os = "none")))]
const _LAYOUT_CHECKS: () = {
    assert!(core::mem::size_of::<TrapContext>() == 34 * 8);
    assert!(core::mem::align_of::<TrapContext>() == 8);
};

#[cfg(test)]
mod sanity {
    use super::*;
    #[test]
    fn size_is_272() {
        assert_eq!(core::mem::size_of::<TrapContext>(), 272);
    }
    #[test]
    fn offsets() {
        let c = TrapContext { x: [0; 32], sstatus: 0, sepc: 0 };
        let base = &c as *const _ as usize;
        assert_eq!(&c.x[0]   as *const _ as usize - base, 0);
        assert_eq!(&c.x[31]  as *const _ as usize - base, 31 * 8);
        assert_eq!(&c.sstatus as *const _ as usize - base, 32 * 8);
        assert_eq!(&c.sepc    as *const _ as usize - base, 33 * 8);
    }
}
