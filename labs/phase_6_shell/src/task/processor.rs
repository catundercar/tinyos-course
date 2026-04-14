//! Per-hart scheduler. PROVIDED skeleton with one TODO for `schedule()`.
//! Students wire up the "save old ctx → pick next → switch" sequence that is
//! exercised by fork/exec/waitpid on the hot path.

use alloc::sync::Arc;
use lazy_static::lazy_static;
use spin::Mutex;

use super::{fetch_task, ProcessControlBlock, TaskContext, TaskStatus};

pub struct Processor {
    current: Option<Arc<ProcessControlBlock>>,
    idle_task_cx: TaskContext,
}

impl Processor {
    pub const fn new() -> Self {
        Self { current: None, idle_task_cx: TaskContext { ra: 0, sp: 0, s: [0; 12] } }
    }
    pub fn take_current(&mut self) -> Option<Arc<ProcessControlBlock>> { self.current.take() }
    pub fn current(&self) -> Option<Arc<ProcessControlBlock>> { self.current.clone() }
    pub fn idle_cx_ptr(&mut self) -> *mut TaskContext { &mut self.idle_task_cx }
}

lazy_static! {
    pub static ref PROCESSOR: Mutex<Processor> = Mutex::new(Processor::new());
}

extern "C" { fn __switch(current: *mut TaskContext, next: *const TaskContext); }

pub fn current_task() -> Option<Arc<ProcessControlBlock>> { PROCESSOR.lock().current() }

pub fn current_user_token() -> usize {
    current_task().unwrap().inner_exclusive_access().memory_set.token()
}
pub fn current_trap_cx() -> &'static mut crate::trap::TrapContext {
    current_task().unwrap().inner_exclusive_access().memory_set.trap_cx_mut()
}

/// Yield the current task back to the scheduler.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Take the current task out of `PROCESSOR`
/// 2. Mark it `Ready` (unless caller already set status to `Zombie`/`Blocked`)
/// 3. Push it back onto the ready queue via `add_task` (skip if Zombie)
/// 4. Switch to idle context so `run_tasks` can pick a new task
///
/// HINT: The `__switch` call MUST happen AFTER all MutexGuards are dropped or
/// the context switch will deadlock on re-entry.
pub fn schedule(_switched_task_cx_ptr: *mut TaskContext) {
    // TODO: Implement
    // Step 1: let mut p = PROCESSOR.lock();
    // Step 2: let idle_ptr = p.idle_cx_ptr(); drop(p);
    // Step 3: unsafe { __switch(switched_task_cx_ptr, idle_ptr); }
    unimplemented!("TODO: schedule");
}

/// Main scheduler loop — PROVIDED.
pub fn run_tasks() -> ! {
    loop {
        if let Some(task) = fetch_task() {
            let idle_ptr = PROCESSOR.lock().idle_cx_ptr();
            let next_cx_ptr = {
                let mut inner = task.inner_exclusive_access();
                inner.status = TaskStatus::Running;
                &inner.task_cx as *const TaskContext
            };
            PROCESSOR.lock().current = Some(task);
            unsafe { __switch(idle_ptr, next_cx_ptr); }
        }
    }
}
