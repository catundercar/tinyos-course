//! task/task.rs — PROVIDED. Task Control Block (TCB).
//!
//! A TCB holds *everything* the kernel needs to know about a task while it
//! isn't running: its current state, its saved TaskContext (for __switch),
//! and a pointer to its kernel stack. Later phases will add more fields
//! (address space, file table, parent pointer, …).
//!
//!   ┌──────────────── TaskControlBlock ─────────────────┐
//!   │  status: TaskStatus   // Ready / Running / Exited  │
//!   │  task_cx: TaskContext // 14 usize                  │
//!   │  kstack_top: usize    // top of the kernel stack   │
//!   └────────────────────────────────────────────────────┘

use super::context::TaskContext;
use crate::types::TaskStatus;

#[derive(Copy, Clone)]
pub struct TaskControlBlock {
    pub status: TaskStatus,
    pub task_cx: TaskContext,
    pub kstack_top: usize,
}

impl TaskControlBlock {
    pub const fn empty() -> Self {
        Self {
            status: TaskStatus::UnInit,
            task_cx: TaskContext::zero_init(),
            kstack_top: 0,
        }
    }
}
