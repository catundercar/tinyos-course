//! test_fs: integration test invoked inside QEMU.
//! Writes /hello.txt, reads it back, exits 0 on match.
#![no_std]
#![no_main]

#[macro_use]
extern crate user_lib;

use user_lib::{open, read, write, close, OpenFlags};

#[no_mangle]
pub fn main() -> i32 {
    let msg = b"persist-me\n";
    let fd = open("hello.txt\0", OpenFlags::CREATE | OpenFlags::WRONLY);
    if fd < 0 { println!("open/create failed"); return 1; }
    write(fd as usize, msg);
    close(fd as usize);

    let fd = open("hello.txt\0", OpenFlags::RDONLY);
    if fd < 0 { return 2; }
    let mut buf = [0u8; 32];
    let n = read(fd as usize, &mut buf);
    close(fd as usize);
    if n <= 0 || &buf[..n as usize] != msg { return 3; }
    println!("test_fs OK");
    0
}
