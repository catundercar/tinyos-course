//! `kill <pid>` — terminate a process. Lab 3.
//!
//! TODO: Implement
//!
//! Requirements:
//! 1. Parse argv[1] as usize (no libc atoi — write a 10-line loop)
//! 2. `sys_kill(pid)` — flips target to Zombie, exit_code = -9
//!
//! HINT: You cannot kill yourself; the syscall returns -1 in that case.
#![no_std] #![no_main]
#[macro_use] extern crate user;
#[no_mangle] fn main() -> i32 { unimplemented!("TODO: kill") }
