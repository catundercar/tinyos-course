//! sbi.rs — PROVIDED. Thin wrappers around legacy SBI ecalls.
//!
//! We only need a handful of these in Phase 2:
//!   * `console_putchar` — byte I/O (used by `console.rs`)
//!   * `shutdown`        — power off QEMU cleanly
//!   * `set_timer`       — program the next S-mode timer interrupt (Lab 3)

#![allow(dead_code)]

use core::arch::asm;

const SBI_SET_TIMER: usize = 0;
const SBI_CONSOLE_PUTCHAR: usize = 1;
const SBI_CONSOLE_GETCHAR: usize = 2;
const SBI_SHUTDOWN: usize = 8;

#[inline(always)]
fn sbi_call(eid: usize, arg0: usize, arg1: usize, arg2: usize) -> usize {
    let mut ret;
    unsafe {
        asm!(
            "ecall",
            inlateout("a0") arg0 => ret,
            in("a1") arg1,
            in("a2") arg2,
            in("a7") eid,
        );
    }
    ret
}

pub fn console_putchar(c: usize) {
    sbi_call(SBI_CONSOLE_PUTCHAR, c, 0, 0);
}

pub fn console_getchar() -> usize {
    sbi_call(SBI_CONSOLE_GETCHAR, 0, 0, 0)
}

/// Program the next S-mode timer interrupt. `stime_value` is an absolute
/// count against the `time` CSR. Used by `timer::set_next_trigger` in Lab 3.
pub fn set_timer(stime_value: u64) {
    sbi_call(SBI_SET_TIMER, stime_value as usize, 0, 0);
}

pub fn shutdown() -> ! {
    sbi_call(SBI_SHUTDOWN, 0, 0, 0);
    unreachable!("SBI shutdown should never return")
}
