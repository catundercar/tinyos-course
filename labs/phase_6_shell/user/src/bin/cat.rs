//! `cat <file>` — dump file contents to stdout. Lab 3.
//!
//! TODO: Implement
//!
//! Requirements:
//! 1. Open argv[1] read-only; return -1 if missing
//! 2. Loop `read(fd, buf)` then `write(1, buf)` until EOF
//! 3. Close fd; return 0
//!
//! HINT: A 512-byte buffer is plenty; the shell handles pipe blocking for you.
#![no_std] #![no_main]
#[macro_use] extern crate user;

#[no_mangle]
fn main() -> i32 {
    // TODO: Implement `cat`
    unimplemented!("TODO: cat")
}
