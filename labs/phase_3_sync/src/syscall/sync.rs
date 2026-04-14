//! Sync-primitive syscalls — Lab 2.
//!
//! Each "create" call allocates a new primitive inside the current task's
//! per-process list and returns its integer index. Subsequent lock/unlock
//! etc. use that index.
//!
//! All nine functions below are student-implemented. They follow the same
//! shape:
//!   1. grab the current `TaskControlBlock`
//!   2. index into the relevant resource list
//!   3. call the kernel primitive

use alloc::sync::Arc;

use crate::sync::{Condvar, MutexBlocking, Semaphore};
use crate::task;

/// Allocate a new blocking mutex and return its handle.
///
/// TODO: Implement this function
///
/// Requirements:
/// 1. Fetch `current_task()`; if None return -1.
/// 2. Construct `Arc::new(MutexBlocking::new())`.
/// 3. Append to the task's `mutex_list`. If there is a free slot
///    (`None`) reuse it; otherwise push_back. Return the slot index as
///    `isize`.
///
/// HINT: Use the `dyn Mutex` trait object so the same slot type can one day
/// hold a spinlock-backed mutex too.
pub fn sys_mutex_create() -> isize {
    // TODO: Implement
    unimplemented!("sys_mutex_create — Lab 2")
}

/// Lock mutex at `id`.
///
/// TODO: Implement this function
///
/// Requirements:
/// 1. Look up the mutex in current task's `mutex_list`. -1 if out of range.
/// 2. Call `.lock()` on it.
/// 3. Return 0.
pub fn sys_mutex_lock(_id: usize) -> isize {
    // TODO: Implement
    unimplemented!("sys_mutex_lock — Lab 2")
}

/// TODO: Implement — mirror image of lock.
pub fn sys_mutex_unlock(_id: usize) -> isize {
    // TODO: Implement
    unimplemented!("sys_mutex_unlock — Lab 2")
}

/// Create a semaphore with initial count `res_count`.
///
/// TODO: Implement this function
///
/// Requirements: analogous to `sys_mutex_create`, but construct
/// `Semaphore::new(res_count as isize)`.
pub fn sys_semaphore_create(_res_count: usize) -> isize {
    // TODO: Implement
    unimplemented!("sys_semaphore_create — Lab 2")
}

/// TODO: Implement — call `.up()` on the indexed semaphore.
pub fn sys_semaphore_up(_id: usize) -> isize {
    // TODO: Implement
    unimplemented!("sys_semaphore_up — Lab 2")
}

/// TODO: Implement — call `.down()` on the indexed semaphore.
pub fn sys_semaphore_down(_id: usize) -> isize {
    // TODO: Implement
    unimplemented!("sys_semaphore_down — Lab 2")
}

/// TODO: Implement — allocate a Condvar and return its handle.
pub fn sys_condvar_create() -> isize {
    // TODO: Implement
    unimplemented!("sys_condvar_create — Lab 2")
}

/// TODO: Implement — call `.signal()` on condvar `id`.
pub fn sys_condvar_signal(_id: usize) -> isize {
    // TODO: Implement
    unimplemented!("sys_condvar_signal — Lab 2")
}

/// Wait on condvar `condvar_id` atomically releasing mutex `mutex_id`.
///
/// TODO: Implement this function
///
/// Requirements:
/// 1. Look up both the condvar and mutex (both must exist; -1 otherwise).
/// 2. Call `condvar.wait(&*mutex)`.
/// 3. Return 0.
///
/// HINT: The `&*mutex` dance coerces `&Arc<dyn Mutex>` to `&dyn Mutex`.
pub fn sys_condvar_wait(_condvar_id: usize, _mutex_id: usize) -> isize {
    // TODO: Implement
    unimplemented!("sys_condvar_wait — Lab 2")
}
