//! Process-flavoured syscalls (LAB 3 · ⭐⭐).

use crate::batch::exit_current;

/// `sys_exit(code)` — terminate the calling user task with the given code.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Delegate to `batch::exit_current(code)`.
/// 2. The function must diverge — its return type is `!`.
///
/// HINT: `exit_current` itself never returns; simply calling it satisfies
/// the `!` contract.
pub fn sys_exit(code: i32) -> ! {
    // TODO: Implement
    // Step 1: call exit_current(code)
    let _ = (code, exit_current);
    unimplemented!("TODO: implement sys_exit")
}

/// `sys_getpid()` — Phase 1 has exactly one user task, so always return 0.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Return 0 (the PID of the lone batch app).
///
/// HINT: Phase 2 will look up the current task and return its real PID.
pub fn sys_getpid() -> isize {
    // TODO: Implement
    unimplemented!("TODO: implement sys_getpid")
}
