//! PROVIDED. PID-1 — fork+exec `sh` in a loop, reap anyone else.
#![no_std] #![no_main]
#[macro_use] extern crate user;
use user::{fork, exec, wait};

#[no_mangle]
fn main() -> i32 {
    loop {
        let pid = fork();
        if pid == 0 {
            exec("sh\0");
            panic!("exec sh failed");
        } else {
            let mut xstatus = 0;
            loop {
                let reaped = wait(&mut xstatus);
                if reaped == pid { break; }
            }
        }
    }
}
