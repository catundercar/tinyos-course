//! trap/context.rs — PROVIDED. 34-word TrapContext (same as Phase 1).
//!
//! Layout (all usize):
//!   x[0..32]  general registers x0..x31 (x0 is always zero, kept for alignment)
//!   sstatus   saved S-mode status CSR
//!   sepc      exception PC (return address back to user)

#[repr(C)]
#[derive(Copy, Clone, Debug)]
pub struct TrapContext {
    pub x: [usize; 32],
    pub sstatus: usize,
    pub sepc: usize,
}

impl TrapContext {
    /// Build a fresh TrapContext for a user app. `entry` is the user pc, `sp`
    /// is its user stack top. The first time we sret into this context, CPU
    /// jumps to `entry` in U-mode with sp = user stack.
    pub fn app_init_context(entry: usize, sp: usize) -> Self {
        // sstatus.SPP = 0 (return to U-mode), SPIE = 1 (enable interrupts after sret)
        const SPP_USER: usize = 0 << 8;
        const SPIE: usize = 1 << 5;
        let mut cx = Self { x: [0; 32], sstatus: SPP_USER | SPIE, sepc: entry };
        cx.x[2] = sp; // x2 = sp
        cx
    }
}
