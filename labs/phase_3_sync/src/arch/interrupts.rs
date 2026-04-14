//! RISC-V supervisor interrupt enable/disable helpers.
//!
//! `sstatus.SIE` is bit 1. We toggle it with `csrr`/`csrrs`/`csrrc`.
//!
//! PROVIDED — do not modify. Students call these from `SpinLock`.

/// Opaque handle returned by `disable_and_save`. Pass it to `restore` to
/// undo the disable.
#[derive(Clone, Copy, Debug)]
pub struct IrqState(usize);

const SIE: usize = 1 << 1;

/// Read sstatus, clear SIE, return previous sstatus so the caller can
/// restore it later.
#[inline]
pub fn disable_and_save() -> IrqState {
    let mut prev: usize;
    // On host-side tests this module is stubbed out — see cfg(test) below.
    #[cfg(target_arch = "riscv64")]
    unsafe {
        core::arch::asm!(
            "csrrci {0}, sstatus, {1}",
            out(reg) prev,
            const SIE,
        );
    }
    #[cfg(not(target_arch = "riscv64"))]
    {
        prev = 0;
    }
    IrqState(prev & SIE)
}

/// Restore sstatus.SIE to whatever it was when `state` was taken.
#[inline]
pub fn restore(state: IrqState) {
    #[cfg(target_arch = "riscv64")]
    unsafe {
        if state.0 & SIE != 0 {
            core::arch::asm!("csrrsi x0, sstatus, {0}", const SIE);
        }
    }
    #[cfg(not(target_arch = "riscv64"))]
    {
        let _ = state;
    }
}

/// Assert that interrupts are currently disabled — used as a sanity check
/// inside SpinLock acquire. Compiled out on the host.
#[inline]
pub fn assert_disabled() {
    #[cfg(target_arch = "riscv64")]
    unsafe {
        let s: usize;
        core::arch::asm!("csrr {0}, sstatus", out(reg) s);
        assert!(s & SIE == 0, "interrupts must be disabled here");
    }
}
