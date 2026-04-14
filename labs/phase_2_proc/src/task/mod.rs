//! task/mod.rs — STUDENT (Lab 2 ⭐⭐⭐).
//!
//! The scheduler. Owns the global TaskManager, implements Round-Robin, and
//! exposes `suspend_current_and_run_next` / `exit_current_and_run_next` that
//! `sys_yield` / `sys_exit` / the timer ISR all funnel into.
//!
//! ASCII overview — two tasks cooperating via yield():
//!
//!   Task A (on CPU)                         Task B (Ready)
//!   ─────────────────                       ──────────────
//!   running user code
//!   ecall ─── trap ───> syscall yield
//!                        │
//!                        ▼
//!             suspend_current_and_run_next
//!                        │
//!           mark A Ready, find B Ready, mark B Running
//!                        │
//!                        ▼
//!                  __switch(&A.cx, &B.cx)          ◀─ resumes here
//!                                                       ▲
//!                                                       │
//!                                           (first time: __restore → sret)
//!                                                       │
//!                                                    user code

use core::arch::global_asm;
use lazy_static::lazy_static;
use spin::Mutex;

use crate::config::MAX_APP_NUM;
use crate::loader::{get_num_app, get_base_i, KERNEL_STACKS, USER_STACKS};
use crate::trap::TrapContext;
use crate::types::TaskStatus;

pub mod context;
pub mod task;

use context::TaskContext;
use task::TaskControlBlock;

global_asm!(include_str!("switch.S"));

extern "C" {
    /// Defined in switch.S. See Lab 1.
    pub fn __switch(current: *mut TaskContext, next: *const TaskContext);
}

/// Global round-robin scheduler. Spin-lock because Phase 2 is single-hart and
/// we only lock for O(MAX_APP_NUM) work.
pub struct TaskManagerInner {
    pub tasks: [TaskControlBlock; MAX_APP_NUM],
    pub current: usize,
    pub num_app: usize,
}

pub struct TaskManager {
    pub inner: Mutex<TaskManagerInner>,
}

lazy_static! {
    pub static ref TASK_MANAGER: TaskManager = {
        let num_app = get_num_app();
        let mut tasks = [TaskControlBlock::empty(); MAX_APP_NUM];
        for i in 0..num_app {
            // Build the TrapContext on top of the kernel stack, then point
            // TaskContext::sp at it so __restore loads it on the first switch.
            let kstack_top = KERNEL_STACKS[i].top();
            let ustack_top = USER_STACKS[i].top();
            let trap_cx_ptr = (kstack_top - core::mem::size_of::<TrapContext>()) as *mut TrapContext;
            unsafe { *trap_cx_ptr = TrapContext::app_init_context(get_base_i(i), ustack_top); }
            tasks[i].status = TaskStatus::Ready;
            tasks[i].task_cx = TaskContext::goto_restore(trap_cx_ptr as usize);
            tasks[i].kstack_top = kstack_top;
        }
        TaskManager { inner: Mutex::new(TaskManagerInner { tasks, current: 0, num_app }) }
    };
}

impl TaskManager {
    /// Kick off the very first task. Never returns.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Lock `inner`, pick task 0, mark it Running, remember its cx ptr.
    /// 2. Drop the lock BEFORE calling __switch (otherwise the next task
    ///    inherits a locked mutex and will deadlock on its first yield).
    /// 3. Create a throw-away "unused" TaskContext to pass as `current` —
    ///    __switch will write boot-time registers into it but we never read
    ///    them again.
    /// 4. Call unsafe { __switch(&mut unused, &task0_cx); }
    ///
    /// HINT: after __switch, control flows through __restore → sret → user,
    ///       so the function literally never returns. Use `-> !`.
    pub fn run_first_task(&self) -> ! {
        // TODO: Implement
        // Step 1: let mut inner = self.inner.lock();
        // Step 2: let task0 = &mut inner.tasks[0]; task0.status = Running;
        // Step 3: let next_cx_ptr = &task0.task_cx as *const TaskContext;
        // Step 4: drop(inner);
        // Step 5: let mut unused = TaskContext::zero_init();
        // Step 6: unsafe { __switch(&mut unused, next_cx_ptr); }
        // Step 7: unreachable!()
        unimplemented!("TODO Lab 2: run_first_task")
    }

    /// Find the next Ready task after `current`, round-robin.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Scan tasks[(current+1) % N .. current+N+1] (wrap around).
    /// 2. Return Some(idx) for the first Ready task, None if none exists.
    ///
    /// HINT: using `(self.inner.lock().current + 1 + offset) % num_app` makes
    ///       the wrap-around trivial; an iterator over `1..=num_app` works.
    fn find_next_task(&self) -> Option<usize> {
        // TODO: Implement
        // Step 1: let inner = self.inner.lock();
        // Step 2: let n = inner.num_app; let cur = inner.current;
        // Step 3: for off in 1..=n { let i = (cur + off) % n;
        //             if inner.tasks[i].status == TaskStatus::Ready { return Some(i); } }
        // Step 4: None
        unimplemented!("TODO Lab 2: find_next_task")
    }

    /// Mark current task Ready (it yielded).
    fn mark_current_suspended(&self) {
        let mut inner = self.inner.lock();
        let c = inner.current;
        inner.tasks[c].status = TaskStatus::Ready;
    }

    /// Mark current task Exited (it died).
    fn mark_current_exited(&self) {
        let mut inner = self.inner.lock();
        let c = inner.current;
        inner.tasks[c].status = TaskStatus::Exited;
    }

    /// Switch to the next Ready task. If none is found, shut QEMU down.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Call `find_next_task()`; on None, `crate::sbi::shutdown()`.
    /// 2. Lock inner, update `current`, mark next Running, grab raw pointers
    ///    to current's and next's TaskContext.
    /// 3. Drop the lock BEFORE __switch (same reason as run_first_task).
    /// 4. `unsafe { __switch(current_cx_ptr, next_cx_ptr) }`.
    ///
    /// HINT: both pointers must outlive the __switch call — they point into
    ///       the static TASK_MANAGER, so they're fine even after `drop(inner)`.
    fn run_next_task(&self) {
        // TODO: Implement
        // Step 1: let next = match self.find_next_task() { Some(i) => i, None => shutdown(); };
        // Step 2: let mut inner = self.inner.lock();
        // Step 3: let cur = inner.current;
        // Step 4: inner.tasks[next].status = Running; inner.current = next;
        // Step 5: let cur_cx = &mut inner.tasks[cur].task_cx as *mut _;
        // Step 6: let nxt_cx = &inner.tasks[next].task_cx as *const _;
        // Step 7: drop(inner);
        // Step 8: unsafe { __switch(cur_cx, nxt_cx); }
        unimplemented!("TODO Lab 2: run_next_task")
    }
}

// ─── Public API used by syscalls and the timer ISR ───────────────────────────

pub fn run_first_task() -> ! { TASK_MANAGER.run_first_task() }

pub fn suspend_current_and_run_next() {
    TASK_MANAGER.mark_current_suspended();
    TASK_MANAGER.run_next_task();
}

pub fn exit_current_and_run_next() {
    TASK_MANAGER.mark_current_exited();
    TASK_MANAGER.run_next_task();
}
