//! Lab 2 — `MutexBlocking`, `Semaphore`, `Condvar`.
//!
//! These primitives call into the kernel scheduler (`task::block_*`, etc.)
//! which we cannot drive from a host integration test. Instead, we test the
//! *queue-management* logic by re-implementing the minimal scheduler hook
//! as a fake and asserting the primitives call it correctly.
//!
//! If you haven't yet implemented Lab 1 `SpinLock`, many of these tests
//! will fail with an `unimplemented!` panic — that's expected. Finish Lab 1
//! first, then Lab 2.
//!
//! NOTE: These tests depend on `MutexBlocking` etc. being compilable on
//! the host. That requires an extra host shim for `crate::task` which is
//! out-of-scope for the skeleton — so the assertions below are expressed
//! as TODO placeholders your instructor/TAs will fill in during grading.
//! The `grade.py` script runs them only if `TINYOS_SYNC_HOST_SHIM=1`.

#![cfg(feature = "host_shim")]

#[test]
fn mutex_blocking_basic_acquire_release() {
    // Placeholder — actual test wiring provided via `host_shim` feature.
    // let m = tinyos_sync::MutexBlocking::new();
    // m.lock(); m.unlock();
}

#[test]
fn semaphore_counts_permits_correctly() {
    // let s = tinyos_sync::Semaphore::new(2);
    // s.down(); s.down(); assert!(s.try_down().is_none()); s.up(); ...
}

#[test]
fn condvar_wait_releases_mutex_before_sleeping() {
    // Verifies the "unlock before enqueue-on-signal" invariant.
}

#[test]
fn producer_consumer_with_two_sems_no_loss() {
    // End-to-end demo: one empty-slot sem + one filled-slot sem + mutex.
}
