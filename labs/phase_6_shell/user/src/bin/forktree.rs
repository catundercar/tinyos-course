//! PROVIDED demo — forks a small binary tree to stress the PCB allocator.
#![no_std] #![no_main]
#[macro_use] extern crate user;
use user::{fork, wait, getpid, exit};

const DEPTH: usize = 4;

fn spawn(depth: usize) {
    if depth == 0 { return; }
    let pid = fork();
    if pid == 0 {
        println!("hi from pid={}, depth={}", getpid(), depth);
        spawn(depth - 1);
        exit(0);
    }
}

#[no_mangle]
fn main() -> i32 {
    spawn(DEPTH);
    let mut x = 0;
    while wait(&mut x) > 0 {}
    0
}
