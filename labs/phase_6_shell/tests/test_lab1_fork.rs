//! Lab 1 — fork / exec / waitpid
//!
//! These tests are host-side unit tests that exercise the process-table logic
//! against an in-memory stub kernel. They do NOT boot qemu — that's the grader's
//! job. Each test describes the behaviour students must implement.

use phase_6_shell::task::*;

#[test]
fn fork_child_has_fresh_pid_and_same_fd_table() {
    // After a fork, the child gets a brand-new PID but its fd_table is a
    // slot-by-slot Arc::clone of the parent's. Closing an fd in one process
    // should NOT close it in the other.
}

#[test]
fn fork_child_returns_zero_via_a0() {
    // Student must set child trap_cx.x[10] = 0 so that the child sees
    // fork() == 0 on resume, while the parent sees the child pid.
}

#[test]
fn exec_rewrites_memory_set_in_place() {
    // sys_exec must swap the current memory_set for a new one loaded from ELF,
    // keeping pid, parent link, and fd_table intact.
}

#[test]
fn waitpid_reaps_zombie_and_returns_exit_code() {
    // After fork+exit, parent calling waitpid(-1) should receive the child's
    // pid and find exit_code written into *exit_code_ptr.
}

#[test]
fn waitpid_returns_minus_two_when_child_alive() {
    // Non-blocking semantics: if matching child exists but not zombie yet,
    // return -2 so user-space can yield and retry.
}

#[test]
fn orphan_reparenting_to_init_on_exit() {
    // If parent exits first, its still-alive children must have their `parent`
    // field re-pointed to initproc.
}
