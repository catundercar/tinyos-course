//! sbi.rs — Lab 2 ⭐⭐
//!
//! Thin Rust bindings over the RISC-V Supervisor Binary Interface (SBI).
//!
//! Everything in S-mode that needs to talk to "the firmware" (console,
//! shutdown, timers, IPIs, …) goes through the `ecall` instruction.
//! ecall traps into M-mode, OpenSBI inspects `a7` (the extension id),
//! `a6` (function id for v1.0 extensions), and `a0..a5` (args), does
//! the work, and returns with `a0` = error, `a1` = value.
//!
//! Convention (legacy SBI, what we use for Phase 0):
//!   a7 = SBI extension id (eid)
//!   a0 = arg0   (becomes return on exit)
//!   a1 = arg1
//!   a2 = arg2

use crate::types::{
    SBI_CONSOLE_PUTCHAR, SBI_EID_SRST, SBI_FID_SYSTEM_RESET, SBI_RESET_REASON_NONE,
    SBI_RESET_TYPE_SHUTDOWN, SBI_SHUTDOWN,
};

/// Perform an SBI ecall.
///
/// TODO (Lab 2): implement this using inline assembly.
///
/// Requirements:
/// 1. Load `eid` into register `a7`.
/// 2. Load `arg0`, `arg1`, `arg2` into `a0`, `a1`, `a2`.
/// 3. Execute the `ecall` instruction.
/// 4. Return the value left in `a0` after ecall.
///
/// HINT: Use `core::arch::asm!`. For a legacy SBI call you typically
///       want something like:
///
///           let mut ret: usize;
///           asm!(
///               "ecall",
///               inlateout("a0") arg0 => ret,
///               in("a1") arg1,
///               in("a2") arg2,
///               in("a7") eid,
///               options(nostack, preserves_flags),
///           );
///           ret
///
/// HINT: `inlateout` lets `a0` serve as both input (arg0) and
///       output (return value) — that matches the SBI calling
///       convention exactly.
#[inline(always)]
fn sbi_call(eid: usize, arg0: usize, arg1: usize, arg2: usize) -> usize {
    // TODO (Lab 2): replace the body below with a real ecall.
    // Step 1: declare `let mut ret: usize;`
    // Step 2: inline asm "ecall" with the register mapping above
    // Step 3: return ret
    let _ = (eid, arg0, arg1, arg2);
    0
}

/// Perform an SBI v1.0 ecall with (eid, fid, args).
/// Used by the System Reset extension.
///
/// TODO (Lab 2, optional but recommended for `shutdown` quality):
/// Extend `sbi_call` by also placing `fid` into `a6`.
///
/// HINT: Same `asm!` as above, plus `in("a6") fid`.
#[inline(always)]
#[allow(dead_code)]
fn sbi_call_v1(eid: usize, fid: usize, arg0: usize, arg1: usize, arg2: usize) -> usize {
    // TODO (Lab 2 stretch): implement with a6 = fid
    let _ = (eid, fid, arg0, arg1, arg2);
    0
}

/// Write a single byte to the SBI debug console (the UART, in QEMU).
///
/// TODO (Lab 2): call `sbi_call` with the legacy console-putchar eid.
///
/// Requirements:
/// 1. Use `SBI_CONSOLE_PUTCHAR` as the extension id.
/// 2. Pass the byte value as `arg0`, zeros for `arg1`/`arg2`.
///
/// HINT: The byte is conventionally passed zero-extended to `usize`.
pub fn console_putchar(c: usize) {
    // TODO (Lab 2):
    // sbi_call(SBI_CONSOLE_PUTCHAR, c, 0, 0);
    let _ = (SBI_CONSOLE_PUTCHAR, c);
}

/// Shut the machine down cleanly.
///
/// TODO (Lab 2): call the legacy `SBI_SHUTDOWN` extension. Optionally,
/// try the newer `SRST` extension first for nicer QEMU exit codes.
///
/// Requirements:
/// 1. The function must diverge — mark it `-> !`.
/// 2. After the ecall, spin in an infinite loop in case OpenSBI ever
///    returns control (it should not, but Rust needs the `!` proof).
///
/// HINT:
///     // Preferred (SBI v1.0):
///     sbi_call_v1(SBI_EID_SRST, SBI_FID_SYSTEM_RESET,
///                 SBI_RESET_TYPE_SHUTDOWN, SBI_RESET_REASON_NONE, 0);
///     // Fallback (always works):
///     sbi_call(SBI_SHUTDOWN, 0, 0, 0);
pub fn shutdown() -> ! {
    // TODO (Lab 2): issue the shutdown ecall(s).
    let _ = (
        SBI_EID_SRST,
        SBI_FID_SYSTEM_RESET,
        SBI_RESET_TYPE_SHUTDOWN,
        SBI_RESET_REASON_NONE,
        SBI_SHUTDOWN,
    );

    // Infinite loop so the function type is `-> !` regardless of
    // whether the TODO above has been completed yet.
    loop {
        unsafe { core::arch::asm!("wfi") };
    }
}
