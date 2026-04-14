//! types.rs — SBI type definitions and constants
//!
//! PROVIDED FILE — Do NOT modify.
//!
//! This module centralises the constants needed to talk to the RISC-V
//! Supervisor Binary Interface (SBI). OpenSBI runs in M-mode and exposes
//! these "extensions" to our S-mode kernel via the `ecall` instruction.

#![allow(dead_code)]

/// Return value of an SBI call (per SBI v1.0 spec).
///
/// Not all legacy SBI calls populate `value`; for the ones we use in Phase 0
/// the return value can be safely ignored.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct SbiRet {
    /// Error code (0 = SBI_SUCCESS).
    pub error: isize,
    /// Returned value (meaning depends on the extension).
    pub value: isize,
}

// ─── Legacy SBI extension IDs (eid passed in a7) ─────────────────────────────
// These are the simplest subset of SBI we need for Phase 0.

/// Legacy: set timer via SBI.
pub const SBI_SET_TIMER: usize = 0;
/// Legacy: write one byte to the debug console.
pub const SBI_CONSOLE_PUTCHAR: usize = 1;
/// Legacy: read one byte from the debug console (may return -1 if none).
pub const SBI_CONSOLE_GETCHAR: usize = 2;
/// Legacy: clear IPI.
pub const SBI_CLEAR_IPI: usize = 3;
/// Legacy: send IPI to a list of harts.
pub const SBI_SEND_IPI: usize = 4;
/// Legacy: remote fence.i.
pub const SBI_REMOTE_FENCE_I: usize = 5;
/// Legacy: remote sfence.vma.
pub const SBI_REMOTE_SFENCE_VMA: usize = 6;
/// Legacy: remote sfence.vma with ASID.
pub const SBI_REMOTE_SFENCE_VMA_ASID: usize = 7;
/// Legacy: shutdown the system.
pub const SBI_SHUTDOWN: usize = 8;

// ─── SBI v1.0 "System Reset" extension (for graceful shutdown) ───────────────

/// System Reset extension ID.
pub const SBI_EID_SRST: usize = 0x53525354; // "SRST"
/// Function ID: system_reset.
pub const SBI_FID_SYSTEM_RESET: usize = 0;

/// Reset type: shutdown.
pub const SBI_RESET_TYPE_SHUTDOWN: usize = 0;
/// Reset type: cold reboot.
pub const SBI_RESET_TYPE_COLD_REBOOT: usize = 1;
/// Reset type: warm reboot.
pub const SBI_RESET_TYPE_WARM_REBOOT: usize = 2;

/// Reset reason: no reason (normal shutdown).
pub const SBI_RESET_REASON_NONE: usize = 0;
/// Reset reason: system failure.
pub const SBI_RESET_REASON_SYSTEM_FAILURE: usize = 1;
