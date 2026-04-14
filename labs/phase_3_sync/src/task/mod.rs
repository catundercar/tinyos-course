//! Task subsystem carried over from Phase 2, plus per-process sync tables.
//!
//! For Phase 3 you must EXTEND `TaskControlBlock` to own:
//! - `mutex_list:    Vec<Option<Arc<dyn Mutex>>>`
//! - `sem_list:      Vec<Option<Arc<Semaphore>>>`
//! - `condvar_list:  Vec<Option<Arc<Condvar>>>`
//!
//! The syscall layer looks up primitives by integer handle. Students must
//! wire `sys_mutex_create` etc. to push into these vectors.
//!
//! PROVIDED skeleton — add the three `*_list` fields during Lab 2.

use alloc::sync::Arc;
use alloc::vec::Vec;

use crate::sync::{Condvar, Mutex, Semaphore};

pub struct TaskControlBlock {
    pub pid: usize,
    // TODO (Lab 2): add the per-process sync resource tables here.
    // pub mutex_list:   Vec<Option<Arc<dyn Mutex>>>,
    // pub sem_list:     Vec<Option<Arc<Semaphore>>>,
    // pub condvar_list: Vec<Option<Arc<Condvar>>>,
}

pub fn init() {}

pub fn run_first_task() -> ! {
    crate::sbi::shutdown();
}

/// Returns the currently running task's TCB.
///
/// PROVIDED stub — real implementation ships in Phase 2. Tests mock this.
pub fn current_task() -> Option<Arc<TaskControlBlock>> {
    None
}

/// Move current task to "blocked" and schedule the next one.
pub fn block_current_and_run_next() {
    // Real impl: mark task state, push to blocked list, switch.
}

/// Put a previously blocked task back on the ready queue.
pub fn wake_task(_task: Arc<TaskControlBlock>) {
    // Real impl: task.state = Ready; ready_queue.push(task);
}
