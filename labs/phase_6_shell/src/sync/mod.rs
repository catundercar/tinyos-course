//! Kernel synchronization primitives. PROVIDED (baseline from Phase 3).
//!
//! ⚠️ BEFORE YOU START PHASE 6: paste your completed Phase 3 solutions for
//! `spin.rs`, `mutex.rs`, `semaphore.rs`, `condvar.rs` into this directory.
//! Phase 6 uses `SpinLock<T>` and `UPSafeCell<T>` extensively in the
//! process table, pipe buffer, and fd table.

pub mod condvar;
pub mod mutex;
pub mod semaphore;
pub mod spin;
pub mod up;

pub use condvar::Condvar;
pub use mutex::{Mutex, MutexBlocking};
pub use semaphore::Semaphore;
pub use spin::{SpinLock, SpinLockGuard};
pub use up::UPSafeCell;
