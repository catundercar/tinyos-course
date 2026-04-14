//! config.rs — PROVIDED. Compile-time system configuration.
//!
//! These constants are deliberately conservative so that the whole Phase 2
//! kernel + N apps fits inside the 128 MiB QEMU gives us. If you raise
//! `MAX_APP_NUM`, also check `loader.rs` and `task/mod.rs` static arrays.

pub const MAX_APP_NUM: usize = 4;

/// User application image base — apps are placed side-by-side starting here.
pub const APP_BASE_ADDRESS: usize = 0x80400000;
/// Size budget for each app image (round up to a power of two for sanity).
pub const APP_SIZE_LIMIT: usize = 0x20000;

/// Per-task kernel stack size (used by TCB). 8 KiB is enough for a trap frame
/// plus a handful of deep Rust calls.
pub const KERNEL_STACK_SIZE: usize = 4096 * 2;
/// Per-task user stack size.
pub const USER_STACK_SIZE: usize = 4096 * 2;

/// QEMU virt machine ticks the `time` CSR at 10 MHz by default.
pub const CLOCK_FREQ: usize = 10_000_000;
