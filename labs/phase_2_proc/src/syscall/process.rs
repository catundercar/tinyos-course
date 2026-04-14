//! syscall/process.rs — PROVIDED. Process-control syscalls for Phase 2.
//!
//! These are the glue between user-space's `yield()` / `exit()` primitives and
//! the scheduler in `task::`. The heavy lifting lives there; these functions
//! are one-liners.

use crate::task::{exit_current_and_run_next, suspend_current_and_run_next};

pub fn sys_exit(exit_code: i32) -> ! {
    crate::println!("[kernel] task exited with code {}", exit_code);
    exit_current_and_run_next();
    panic!("sys_exit never returns")
}

pub fn sys_yield() -> isize {
    suspend_current_and_run_next();
    0
}

pub fn sys_get_time() -> isize {
    crate::timer::get_time_ms() as isize
}
