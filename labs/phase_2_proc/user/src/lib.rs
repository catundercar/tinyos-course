//! user/lib.rs — PROVIDED. Minimal user-space runtime: write / exit / yield / get_time.

#![no_std]
#![feature(linkage)]

use core::arch::asm;

const SYSCALL_WRITE:    usize = 64;
const SYSCALL_EXIT:     usize = 93;
const SYSCALL_YIELD:    usize = 124;
const SYSCALL_GET_TIME: usize = 169;

#[inline(always)]
fn syscall(id: usize, args: [usize; 3]) -> isize {
    let mut ret: isize;
    unsafe {
        asm!(
            "ecall",
            inlateout("a0") args[0] => ret,
            in("a1") args[1],
            in("a2") args[2],
            in("a7") id,
        );
    }
    ret
}

pub fn write(fd: usize, buf: &[u8]) -> isize { syscall(SYSCALL_WRITE, [fd, buf.as_ptr() as usize, buf.len()]) }
pub fn exit(code: i32) -> ! { syscall(SYSCALL_EXIT, [code as usize, 0, 0]); loop {} }
pub fn yield_() -> isize { syscall(SYSCALL_YIELD, [0, 0, 0]) }
pub fn get_time() -> isize { syscall(SYSCALL_GET_TIME, [0, 0, 0]) }

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! { exit(-1) }
