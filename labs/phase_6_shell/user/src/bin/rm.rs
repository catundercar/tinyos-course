//! `rm <name>` — unlink file. Lab 3.
//!
//! TODO: Implement
//!
//! Requirements:
//! 1. Call `sys_unlink`
//! 2. Refuse to rm "." or ".."
//!
//! HINT: In easy-fs, unlink = clear dirent + free data blocks.
#![no_std] #![no_main]
#[macro_use] extern crate user;
#[no_mangle] fn main() -> i32 { unimplemented!("TODO: rm") }
