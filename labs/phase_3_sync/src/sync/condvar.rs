//! Condition variable — Lab 2 (difficulty ⭐⭐⭐)
//!
//! A Condvar lets a task sleep until *some predicate* on shared state
//! becomes true. The predicate itself is evaluated under a Mutex; the
//! Condvar is the "wait for notification" half.
//!
//! Usage pattern:
//! ```ignore
//! mutex.lock();
//! while !predicate() {
//!     condvar.wait(&mutex);   // atomically: release(mutex), sleep
//! }
//! // predicate is true here, and mutex is re-acquired
//! mutex.unlock();
//! ```

use alloc::collections::VecDeque;
use alloc::sync::Arc;

use crate::sync::{Mutex, SpinLock};
use crate::task::{self, TaskControlBlock};

pub struct Condvar {
    wait_queue: SpinLock<VecDeque<Arc<TaskControlBlock>>>,
}

impl Condvar {
    /// PROVIDED — do not modify.
    pub fn new() -> Self {
        Self {
            wait_queue: SpinLock::new(VecDeque::new()),
        }
    }

    /// Wake one waiter, if any.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Lock `wait_queue`.
    /// 2. Pop the front task and `task::wake_task(it)`.
    /// 3. If queue is empty, do nothing — signals are not buffered.
    ///
    /// HINT: `pop_front()` returns `Option`; `if let Some(t) = …` is clean.
    pub fn signal(&self) {
        // TODO: Implement
        unimplemented!("Condvar::signal — Lab 2")
    }

    /// Broadcast — wake every waiter.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Drain the wait queue and wake each task.
    ///
    /// HINT: `while let Some(t) = queue.pop_front() { wake_task(t) }`.
    pub fn broadcast(&self) {
        // TODO: Implement
        unimplemented!("Condvar::broadcast — Lab 2")
    }

    /// Atomically release `mutex`, sleep, re-acquire `mutex`.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Enqueue the current task on `wait_queue`.
    /// 2. Call `mutex.unlock()` — the caller held it on entry.
    /// 3. Call `task::block_current_and_run_next()`.
    /// 4. On wake-up, call `mutex.lock()` before returning.
    ///
    /// HINT: The `wait_queue` push MUST happen before unlocking the mutex,
    /// otherwise a signal between unlock and enqueue would be lost (the
    /// "lost wakeup" problem — see COURSE.md §3.4).
    ///
    /// HINT: `mutex: &dyn Mutex` works for both SpinLock-wrapped and
    /// MutexBlocking; this is why we defined the `Mutex` trait.
    pub fn wait(&self, mutex: &dyn Mutex) {
        // TODO: Implement
        unimplemented!("Condvar::wait — Lab 2")
    }
}

impl Default for Condvar {
    fn default() -> Self {
        Self::new()
    }
}
