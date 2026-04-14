//! Kernel synchronization primitives.
//!
//! Layer 3 of TinyOS. Every primitive in this module is implemented by the
//! student. Re-exports live here so downstream modules (syscall, task) can
//! `use crate::sync::SpinLock;` without caring about the file layout.
//!
//! PROVIDED — do not modify.

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
