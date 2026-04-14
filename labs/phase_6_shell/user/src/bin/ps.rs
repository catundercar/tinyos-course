//! `ps` — print the process table. Lab 3.
//!
//! TODO: Implement
//!
//! Requirements:
//! 1. Syscall `sys_ps` fills a fixed-size buffer with (pid, status, name) triples
//! 2. Walk the buffer and print one line per process
//!
//! HINT: Status is a single byte — decode via `match` to "R", "Z", "S".
#![no_std] #![no_main]
#[macro_use] extern crate user;
#[no_mangle] fn main() -> i32 { unimplemented!("TODO: ps") }
