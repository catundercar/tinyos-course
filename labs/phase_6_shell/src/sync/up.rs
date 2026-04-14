//! `UPSafeCell<T>` — a RefCell-alike that is `Sync` on the assumption that
//! the kernel runs on a single hart (UP = uniprocessor).
//!
//! We use it to hold "obviously global, obviously mutable" state such as the
//! task manager. Under SMP this would be unsound — then wrap the inner value
//! in a `SpinLock` instead.
//!
//! PROVIDED — do not modify.

use core::cell::{RefCell, RefMut};

pub struct UPSafeCell<T> {
    inner: RefCell<T>,
}

unsafe impl<T> Sync for UPSafeCell<T> {}

impl<T> UPSafeCell<T> {
    /// # Safety
    /// Caller guarantees the kernel is single-hart.
    pub const unsafe fn new(value: T) -> Self {
        Self {
            inner: RefCell::new(value),
        }
    }

    pub fn exclusive_access(&self) -> RefMut<'_, T> {
        self.inner.borrow_mut()
    }
}
