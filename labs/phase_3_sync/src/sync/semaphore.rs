//! Counting Semaphore — Lab 2 (difficulty ⭐⭐⭐)
//!
//! A semaphore holds an integer `count`. `down()` decrements it and blocks
//! if it would go negative. `up()` increments it and wakes one waiter.
//! Semaphores with initial count 1 behave like a mutex; with N they gate N
//! concurrent users of a resource (classic bounded buffer uses two:
//! `empty_slots` and `filled_slots`).

use alloc::collections::VecDeque;
use alloc::sync::Arc;

use crate::sync::SpinLock;
use crate::task::{self, TaskControlBlock};

struct SemInner {
    count: isize,
    wait_queue: VecDeque<Arc<TaskControlBlock>>,
}

pub struct Semaphore {
    inner: SpinLock<SemInner>,
}

impl Semaphore {
    /// PROVIDED — do not modify.
    pub fn new(initial: isize) -> Self {
        Self {
            inner: SpinLock::new(SemInner {
                count: initial,
                wait_queue: VecDeque::new(),
            }),
        }
    }

    /// `V` / signal / release one permit.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Acquire the inner spinlock.
    /// 2. Increment `count`.
    /// 3. If after the increment `count <= 0`, there is at least one waiter:
    ///    pop the head of `wait_queue` and wake it.
    ///
    /// HINT: `count <= 0` after increment means we went from negative (or
    /// zero with waiters) to non-positive — the classic Dijkstra encoding
    /// where the magnitude of a negative count is the number of waiters.
    pub fn up(&self) {
        // TODO: Implement
        unimplemented!("Semaphore::up — Lab 2")
    }

    /// `P` / wait / take one permit. Blocks if none available.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Acquire the inner spinlock.
    /// 2. Decrement `count`.
    /// 3. If `count < 0` after decrement, enqueue the current task, drop the
    ///    spinlock, and call `task::block_current_and_run_next()`.
    /// 4. Otherwise just drop the spinlock and return.
    ///
    /// HINT: Decrement BEFORE the branch — the sign of the post-decrement
    /// value is the signal.
    pub fn down(&self) {
        // TODO: Implement
        unimplemented!("Semaphore::down — Lab 2")
    }
}
