//! Host-side tests for Lab 3 — syscall dispatcher.

#![cfg(not(target_os = "none"))]

use phase_1_trap::syscall::syscall;

const SYSCALL_WRITE:  usize = 64;
const SYSCALL_GETPID: usize = 172;

#[test]
fn getpid_returns_zero() {
    assert_eq!(syscall(SYSCALL_GETPID, [0, 0, 0]), 0);
}

#[test]
fn write_to_stdout_returns_len() {
    phase_1_trap::test_support::reset_console_sink();
    let s = b"hello\n";
    let n = syscall(SYSCALL_WRITE, [1, s.as_ptr() as usize, s.len()]);
    assert_eq!(n, s.len() as isize);
    assert_eq!(phase_1_trap::test_support::console_captured(), s.to_vec());
}

#[test]
#[should_panic]
fn unknown_syscall_panics() {
    let _ = syscall(9999, [0, 0, 0]);
}
