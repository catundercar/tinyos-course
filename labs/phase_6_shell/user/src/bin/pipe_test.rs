//! PROVIDED demo — parent writes "ping", child reads and exits. Smoke-tests
//! `sys_pipe` + `sys_read` + `sys_write`.
#![no_std] #![no_main]
#[macro_use] extern crate user;
use user::*;

#[no_mangle]
fn main() -> i32 {
    let mut fds = [0i32; 2];
    pipe(&mut fds);
    if fork() == 0 {
        close(fds[1] as usize);
        let mut buf = [0u8; 16];
        let n = read(fds[0] as usize, &mut buf);
        println!("child got {} bytes: {:?}", n, &buf[..n as usize]);
        exit(0);
    } else {
        close(fds[0] as usize);
        write(fds[1] as usize, b"ping");
        close(fds[1] as usize);
        let mut x = 0; wait(&mut x);
    }
    0
}
