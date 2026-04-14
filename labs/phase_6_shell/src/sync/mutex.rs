//! Sleep-based Mutex — Lab 2 (difficulty ⭐⭐⭐)
//!
//! Unlike `SpinLock`, a blocking mutex does not burn CPU. If the lock is
//! held, the caller is enqueued on a wait queue and `yield`s. Release wakes
//! one waiter by moving it back into the scheduler's ready queue.

use alloc::collections::VecDeque;
use alloc::sync::Arc;

use crate::sync::SpinLock;
use crate::task::{self, TaskControlBlock};

/// Uniform interface shared by `SpinLock` (for short CS) and `MutexBlocking`
/// (for anything that might sleep). User-level `sys_mutex_*` syscalls all
/// go through this trait so the kernel can swap implementations.
///
/// PROVIDED — do not modify.
pub trait Mutex: Send + Sync {
    fn lock(&self);
    fn unlock(&self);
}

/// Internal state, protected by a spinlock.
struct MutexInner {
    locked: bool,
    wait_queue: VecDeque<Arc<TaskControlBlock>>,
}

pub struct MutexBlocking {
    inner: SpinLock<MutexInner>,
}

impl MutexBlocking {
    pub fn new() -> Self {
        Self {
            inner: SpinLock::new(MutexInner {
                locked: false,
                wait_queue: VecDeque::new(),
            }),
        }
    }
}

impl Mutex for MutexBlocking {
    /// Acquire. Blocks (yields) if already held.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Take the inner spinlock.
    /// 2. If `!locked`, set `locked = true`, drop the spinlock, return.
    /// 3. Otherwise push the current task onto `wait_queue`, drop the
    ///    spinlock, and call `task::block_current_and_run_next()`.
    /// 4. When we're woken up, `locked` is already `true` on our behalf —
    ///    do NOT set it again.
    ///
    /// HINT: You must drop the spinlock BEFORE calling the scheduler;
    /// otherwise we'd context-switch with the spinlock held. That is
    /// survivable (because spinlocks disable interrupts) but it stalls every
    /// other hart trying to queue on this mutex — pathological.
    fn lock(&self) {
        // TODO: Implement
        // Step 1: let mut inner = self.inner.lock();
        // Step 2: if !inner.locked { inner.locked = true; return; }
        // Step 3: inner.wait_queue.push_back(task::current_task().unwrap());
        // Step 4: drop(inner); task::block_current_and_run_next();
        unimplemented!("MutexBlocking::lock — Lab 2")
    }

    /// Release. Wakes one waiter (FIFO) if any, else clears the flag.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Take the inner spinlock.
    /// 2. If `wait_queue` is empty, set `locked = false`.
    /// 3. Otherwise pop the head, leave `locked = true` (ownership hand-off),
    ///    and call `task::wake_task(popped)` — which puts it back in the
    ///    ready queue.
    ///
    /// HINT: "Ownership hand-off" is the whole trick. If you set locked=false
    /// AND wake a waiter, a third task racing in between can steal the lock
    /// and you have a lost-wakeup bug.
    fn unlock(&self) {
        // TODO: Implement
        unimplemented!("MutexBlocking::unlock — Lab 2")
    }
}

impl Default for MutexBlocking {
    fn default() -> Self {
        Self::new()
    }
}
