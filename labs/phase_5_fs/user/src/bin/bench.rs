//! bench: time sequential writes of a 64 KiB file.
#![no_std]
#![no_main]

#[macro_use]
extern crate user_lib;
use user_lib::{open, write, close, OpenFlags};

#[no_mangle]
pub fn main() -> i32 {
    let fd = open("bench.dat\0", OpenFlags::CREATE | OpenFlags::WRONLY);
    if fd < 0 { return 1; }
    let buf = [0x7eu8; 4096];
    for _ in 0..16 { write(fd as usize, &buf); }
    close(fd as usize);
    println!("bench wrote 64 KiB");
    0
}
