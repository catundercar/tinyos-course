//! SpinLock<T> — Lab 1 (difficulty ⭐⭐⭐)
//!
//! A mutex that spins on an atomic flag until it can acquire. Suitable for
//! very short critical sections inside the kernel. While a spinlock is held
//! we MUST disable local interrupts, otherwise a timer interrupt on the same
//! hart could schedule another task that tries to take the same lock →
//! self-deadlock.
//!
//! The primary type is `SpinLock<T>`, and the RAII handle returned by
//! `lock()` is `SpinLockGuard<T>`. Dropping the guard releases the lock AND
//! restores the previous interrupt-enable state.

use core::cell::UnsafeCell;
use core::ops::{Deref, DerefMut};
use core::sync::atomic::{AtomicBool, Ordering};

use crate::arch::interrupts;

/// A spin-based mutual-exclusion lock.
///
/// Memory layout:
/// - `locked`: atomic flag, `false` = free, `true` = held
/// - `data`:   the protected payload, reachable only through the guard
pub struct SpinLock<T> {
    locked: AtomicBool,
    data: UnsafeCell<T>,
}

// Safety: the `UnsafeCell` is guarded by `locked`. Once a thread observes the
// CAS flip from false → true, it has unique access until it flips it back.
unsafe impl<T: Send> Sync for SpinLock<T> {}
unsafe impl<T: Send> Send for SpinLock<T> {}

impl<T> SpinLock<T> {
    /// Construct an unlocked SpinLock holding `value`.
    ///
    /// PROVIDED — do not modify.
    pub const fn new(value: T) -> Self {
        Self {
            locked: AtomicBool::new(false),
            data: UnsafeCell::new(value),
        }
    }

    /// Acquire the lock, spinning with interrupts disabled.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Disable interrupts BEFORE attempting the atomic CAS. Remember the
    ///    previous interrupt state so `unlock()` (via `Drop`) can restore it.
    /// 2. Spin on `compare_exchange(false, true, Acquire, Relaxed)` until it
    ///    succeeds. Between failed attempts, hint the CPU with
    ///    `core::hint::spin_loop()` so we don't hammer the cache line.
    /// 3. Return a `SpinLockGuard<T>` that borrows `self` and owns the
    ///    restored-interrupt-flag state.
    ///
    /// HINT: A plain `swap(true, Acquire)` also works, but `compare_exchange`
    /// lets the test harness count failed acquisitions for contention stats.
    ///
    /// HINT: On RISC-V the atomic is lowered to `amoswap.w`/`amocas.w`. The
    /// `Acquire` ordering on success is what keeps reads of `data` from being
    /// hoisted above the CAS.
    pub fn lock(&self) -> SpinLockGuard<'_, T> {
        // TODO: Implement
        // Step 1: let saved = interrupts::disable_and_save();
        // Step 2: loop { if self.locked.compare_exchange(false, true,
        //                Acquire, Relaxed).is_ok() { break; }
        //               core::hint::spin_loop(); }
        // Step 3: SpinLockGuard { lock: self, irq_state: saved }
        unimplemented!("SpinLock::lock — Lab 1")
    }

    /// Try to acquire without blocking. Returns `Some(guard)` on success.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Save and disable interrupts as in `lock()`.
    /// 2. Do EXACTLY ONE compare_exchange. On failure, re-enable interrupts
    ///    to the saved state and return `None`.
    /// 3. On success, return `Some(SpinLockGuard)`.
    ///
    /// HINT: Forgetting to restore interrupts on the `None` path is the #1
    /// bug in this function.
    pub fn try_lock(&self) -> Option<SpinLockGuard<'_, T>> {
        // TODO: Implement
        unimplemented!("SpinLock::try_lock — Lab 1")
    }

    /// Release the lock. Called from `SpinLockGuard::drop`, never directly.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Store `false` into `self.locked` with `Release` ordering so the
    ///    writes to `data` inside the critical section are visible to the
    ///    next acquirer.
    /// 2. Do NOT touch the interrupt flag here; `Drop` for the guard does
    ///    that AFTER this call so the lock is released while interrupts are
    ///    still disabled (otherwise we could be interrupted mid-release).
    ///
    /// HINT: `self.locked.store(false, Ordering::Release)`.
    fn raw_unlock(&self) {
        // TODO: Implement
        unimplemented!("SpinLock::raw_unlock — Lab 1")
    }
}

/// RAII handle representing a held SpinLock. Deref gives `&T`/`&mut T`.
pub struct SpinLockGuard<'a, T> {
    lock: &'a SpinLock<T>,
    irq_state: interrupts::IrqState,
}

impl<'a, T> Deref for SpinLockGuard<'a, T> {
    type Target = T;
    fn deref(&self) -> &T {
        // Safety: we hold the lock, so no one else references `data`.
        unsafe { &*self.lock.data.get() }
    }
}

impl<'a, T> DerefMut for SpinLockGuard<'a, T> {
    fn deref_mut(&mut self) -> &mut T {
        unsafe { &mut *self.lock.data.get() }
    }
}

impl<'a, T> Drop for SpinLockGuard<'a, T> {
    /// TODO: Implement Drop
    ///
    /// Requirements:
    /// 1. Call `self.lock.raw_unlock()` — release the atomic flag first.
    /// 2. Restore interrupts with `interrupts::restore(self.irq_state)`.
    /// 3. ORDER MATTERS. If you restore interrupts first, an IRQ could fire
    ///    while the lock is still held and deadlock the hart.
    ///
    /// HINT: Both steps are a single line each.
    fn drop(&mut self) {
        // TODO: Implement
        // Step 1: self.lock.raw_unlock();
        // Step 2: interrupts::restore(self.irq_state);
        unimplemented!("SpinLockGuard::drop — Lab 1")
    }
}
