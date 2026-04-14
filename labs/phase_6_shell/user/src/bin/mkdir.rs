//! `mkdir <name>` — create a directory. Lab 3.
//!
//! TODO: Implement
//!
//! Requirements:
//! 1. Call `sys_mkdir` (thin easy-fs wrapper from Phase 5)
//! 2. Return 0 / -1
//!
//! HINT: Directory vs. file is a single flag on the inode — see Phase 5.
#![no_std] #![no_main]
#[macro_use] extern crate user;

#[no_mangle]
fn main() -> i32 { unimplemented!("TODO: mkdir") }
