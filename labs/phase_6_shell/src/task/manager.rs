//! Global ready queue + orphan reparenting. Mostly PROVIDED; students fill in the
//! orphan-reparent logic referenced by `sys_exit` in `syscall/process.rs`.

use alloc::collections::VecDeque;
use alloc::sync::Arc;
use lazy_static::lazy_static;
use spin::Mutex;

use super::ProcessControlBlock;

pub struct TaskManager {
    ready_queue: VecDeque<Arc<ProcessControlBlock>>,
}

impl TaskManager {
    pub const fn new() -> Self { Self { ready_queue: VecDeque::new() } }
    pub fn add(&mut self, task: Arc<ProcessControlBlock>) { self.ready_queue.push_back(task); }
    pub fn fetch(&mut self) -> Option<Arc<ProcessControlBlock>> { self.ready_queue.pop_front() }
}

lazy_static! {
    pub static ref TASK_MANAGER: Mutex<TaskManager> = Mutex::new(TaskManager::new());
    /// Initproc (pid == 0) holds adopted orphans. Set by `add_initproc()`.
    pub static ref INITPROC: Mutex<Option<Arc<ProcessControlBlock>>> = Mutex::new(None);
}

pub fn add_task(task: Arc<ProcessControlBlock>) {
    TASK_MANAGER.lock().add(task);
}

pub fn fetch_task() -> Option<Arc<ProcessControlBlock>> {
    TASK_MANAGER.lock().fetch()
}

/// Move every child of `dying` into initproc's children list.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Drain `dying.children`
/// 2. For each child, set its `parent` field to `Weak::new()` pointing at initproc
/// 3. Append the child to initproc's `children` vector
/// 4. Do nothing if initproc has not been installed yet (boot phase)
///
/// HINT: Use `Arc::downgrade(&initproc)` to build the weak pointer.
///
/// HINT: Acquire locks in the order `dying_inner` then `initproc_inner` to match
/// `sys_exit`'s ordering and avoid deadlocks.
pub fn reparent_to_init(_dying: &Arc<ProcessControlBlock>) {
    // TODO: Implement
    // Step 1: read INITPROC; return if None
    // Step 2: take dying.children into a temp Vec (drain)
    // Step 3: for each child: set parent = Arc::downgrade(&initproc)
    // Step 4: push the child into initproc.children
    unimplemented!("TODO: reparent_to_init");
}
