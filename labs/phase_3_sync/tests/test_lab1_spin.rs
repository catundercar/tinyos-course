//! Lab 1 — `SpinLock<T>` tests. Run with:
//!
//!     cargo test --target $(rustc -vV | sed -n 's|host: ||p') --test test_lab1_spin
//!
//! Tests are arranged from simplest to hardest. Read them in order; each
//! one is a concrete specification of behavior.

use std::sync::Arc;
use std::thread;

use tinyos_sync::{SpinLock, SpinLockGuard};

// ─────────────────────────────────────────────────────────────
// 1. Basic ownership & deref
// ─────────────────────────────────────────────────────────────

#[test]
fn newly_constructed_lock_is_unlocked() {
    let m = SpinLock::new(42u32);
    let g = m.lock();
    assert_eq!(*g, 42);
}

#[test]
fn try_lock_succeeds_on_free_lock() {
    let m = SpinLock::new("hi");
    let g = m.try_lock().expect("should acquire free lock");
    assert_eq!(*g, "hi");
}

#[test]
fn try_lock_fails_when_held() {
    let m = SpinLock::new(0);
    let _held = m.lock();
    assert!(m.try_lock().is_none(), "second try_lock must fail");
}

#[test]
fn deref_mut_writes_through_guard() {
    let m = SpinLock::new(0u32);
    {
        let mut g = m.lock();
        *g = 99;
    }
    assert_eq!(*m.lock(), 99);
}

#[test]
fn guard_drop_releases_lock() {
    let m = SpinLock::new(());
    {
        let _g = m.lock();
    } // drop here
    // If the guard did not release, the next try_lock would fail.
    assert!(m.try_lock().is_some());
}

// ─────────────────────────────────────────────────────────────
// 2. Real contention with std::thread
// ─────────────────────────────────────────────────────────────

#[test]
fn concurrent_increment_is_race_free() {
    const THREADS: usize = 10;
    const ITERS: usize = 10_000;

    let counter = Arc::new(SpinLock::new(0usize));

    let handles: Vec<_> = (0..THREADS)
        .map(|_| {
            let c = Arc::clone(&counter);
            thread::spawn(move || {
                for _ in 0..ITERS {
                    let mut g = c.lock();
                    *g += 1;
                }
            })
        })
        .collect();

    for h in handles {
        h.join().unwrap();
    }
    assert_eq!(*counter.lock(), THREADS * ITERS);
}

#[test]
fn lock_is_fifo_ish_under_contention() {
    // Not a strict fairness test — SpinLock is best-effort — but verify
    // that no thread is fully starved by running 4 producers each pushing
    // 500 items into a Vec under the lock.
    let buf = Arc::new(SpinLock::new(Vec::<usize>::new()));
    let handles: Vec<_> = (0..4u8)
        .map(|id| {
            let b = Arc::clone(&buf);
            thread::spawn(move || {
                for _ in 0..500 {
                    b.lock().push(id as usize);
                }
            })
        })
        .collect();
    for h in handles {
        h.join().unwrap();
    }
    let v = buf.lock();
    assert_eq!(v.len(), 2000);
    for id in 0..4 {
        assert_eq!(v.iter().filter(|&&x| x == id).count(), 500);
    }
}

// ─────────────────────────────────────────────────────────────
// 3. Static context (no_std friendly)
// ─────────────────────────────────────────────────────────────

#[test]
fn const_new_allows_static_construction() {
    static LOCK: SpinLock<u64> = SpinLock::new(0);
    *LOCK.lock() = 123;
    assert_eq!(*LOCK.lock(), 123);
}
