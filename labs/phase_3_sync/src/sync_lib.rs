//! Host-side facade over `sync/`. PROVIDED — do not modify.
//!
//! The kernel target is `no_std` + `no_main`; integration tests under
//! `tests/` want to use `std::thread` and `std::sync::atomic`. To avoid
//! maintaining two copies of the primitives, we compile the same `.rs`
//! files into a normal Rust library for the host target.
//!
//! Pieces that need kernel-only deps (the blocking `MutexBlocking`,
//! `Semaphore`, `Condvar` — which all call `task::block_current_and_run_next`)
//! are **not** included here. Lab 1 tests exercise `SpinLock` only; Lab 2
//! tests exercise the blocking primitives via a tiny host shim.

#![cfg_attr(not(test), no_std)]

extern crate alloc;

#[path = "arch/mod.rs"]
pub mod arch;

#[path = "sync/spin.rs"]
pub mod spin;

pub use spin::{SpinLock, SpinLockGuard};
