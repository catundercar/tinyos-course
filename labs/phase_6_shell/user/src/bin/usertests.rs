//! PROVIDED — battery of fork/exec/pipe tests the grader runs.
#![no_std] #![no_main]
#[macro_use] extern crate user;
use user::*;

fn t_fork_basic() {
    let pid = fork();
    if pid == 0 { exit(42); }
    let mut x = 0; waitpid(pid as usize, &mut x);
    assert_eq!(x, 42);
    println!("[ok] fork_basic");
}

fn t_pipe_roundtrip() {
    let mut fds = [0i32; 2];
    pipe(&mut fds);
    if fork() == 0 {
        close(fds[0] as usize);
        write(fds[1] as usize, b"hello");
        exit(0);
    }
    close(fds[1] as usize);
    let mut buf = [0u8; 5];
    let n = read(fds[0] as usize, &mut buf);
    assert_eq!(n, 5);
    let mut x = 0; wait(&mut x);
    println!("[ok] pipe_roundtrip");
}

#[no_mangle]
fn main() -> i32 {
    t_fork_basic();
    t_pipe_roundtrip();
    println!("usertests: ALL PASS");
    0
}
