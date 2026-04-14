//! Shared type / constant definitions.
//!
//! PROVIDED — do not modify.

// ────────────── Syscall numbers (aligned with rCore) ──────────────
pub const SYSCALL_WRITE:  usize = 64;
pub const SYSCALL_EXIT:   usize = 93;
pub const SYSCALL_GETPID: usize = 172;

// ────────────── RISC-V scause codes ──────────────
//
// `scause` MSB=1 → interrupt, MSB=0 → exception. We only strip the MSB in
// the handler, then match against the low bits below.
pub const EXC_INST_MISALIGNED:   usize = 0;
pub const EXC_INST_FAULT:        usize = 1;
pub const EXC_ILLEGAL_INST:      usize = 2;
pub const EXC_BREAKPOINT:        usize = 3;
pub const EXC_LOAD_MISALIGNED:   usize = 4;
pub const EXC_LOAD_FAULT:        usize = 5;
pub const EXC_STORE_MISALIGNED:  usize = 6;
pub const EXC_STORE_FAULT:       usize = 7;
pub const EXC_U_ECALL:           usize = 8;   // ecall from U-mode — our syscalls
pub const EXC_S_ECALL:           usize = 9;
pub const EXC_INST_PAGE_FAULT:   usize = 12;
pub const EXC_LOAD_PAGE_FAULT:   usize = 13;
pub const EXC_STORE_PAGE_FAULT:  usize = 15;

pub const INT_S_TIMER:           usize = 5;   // supervisor timer interrupt

// ────────────── sstatus bit masks ──────────────
pub const SSTATUS_SIE:   usize = 1 << 1;
pub const SSTATUS_SPIE:  usize = 1 << 5;
pub const SSTATUS_SPP:   usize = 1 << 8;  // 0 = came from U-mode, 1 = from S

// ────────────── User-space layout ──────────────
pub const USER_STACK_SIZE:   usize = 4096 * 2;
pub const KERNEL_STACK_SIZE: usize = 4096 * 2;
pub const APP_BASE_ADDRESS:  usize = 0x80400000;
pub const APP_SIZE_LIMIT:    usize = 0x20000;
