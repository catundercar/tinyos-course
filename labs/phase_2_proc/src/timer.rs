//! timer.rs — STUDENT (Lab 3 ⭐⭐).
//!
//! RISC-V exposes a free-running 64-bit counter in the `time` CSR. Machine
//! firmware (OpenSBI) owns the comparator `mtimecmp`; we ask it to program
//! the next interrupt via `sbi::set_timer(stime_value)`. When `time` reaches
//! `stime_value`, an S-mode timer interrupt fires (scause = 0x8000…0005).
//!
//! Big picture:
//!
//!    ┌─ user app (running) ─┐
//!    │   ... compute ...    │
//!    └──────────┬───────────┘
//!               │  time >= mtimecmp
//!               ▼
//!    ┌─ trap.S: __alltraps ─┐   saves TrapContext
//!    └──────────┬───────────┘
//!               ▼
//!    ┌─ trap_handler() ─┐   matches SupervisorTimer →
//!    │   set_next_trigger() + suspend_current_and_run_next()
//!    └──────────┬──────┘
//!               ▼
//!    __switch → next task's __restore → sret → its user code

use crate::config::CLOCK_FREQ;
use crate::sbi::set_timer;
use core::arch::asm;

/// 10 ms time slice.
const TICKS_PER_SEC: usize = 100;
const MSEC_PER_SEC:  usize = 1000;

/// Read the 64-bit `time` CSR. PROVIDED helper.
pub fn get_time() -> usize {
    let t: usize;
    unsafe { asm!("rdtime {0}", out(reg) t); }
    t
}

/// Return the monotonic time in milliseconds since boot. PROVIDED.
pub fn get_time_ms() -> usize {
    get_time() / (CLOCK_FREQ / MSEC_PER_SEC)
}

/// Program the next timer interrupt to fire 10 ms from now.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Compute `next = get_time() + CLOCK_FREQ / TICKS_PER_SEC`.
/// 2. Call `set_timer(next as u64)` — this is an SBI ecall to M-mode, which
///    writes `mtimecmp` on our behalf.
///
/// HINT: you MUST compute `next` each call, not just `CLOCK_FREQ/TICKS_PER_SEC`;
///       `mtimecmp` is an absolute deadline, not an interval.
///
/// HINT: if the next deadline has already passed (e.g. long ISR), the
///       interrupt re-fires immediately — that's fine, it's self-healing.
pub fn set_next_trigger() {
    // TODO: Implement
    // Step 1: let next = get_time() + CLOCK_FREQ / TICKS_PER_SEC;
    // Step 2: set_timer(next as u64);
    unimplemented!("TODO Lab 3: set_next_trigger")
}
