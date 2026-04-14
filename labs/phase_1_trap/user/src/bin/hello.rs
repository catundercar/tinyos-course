//! Example user program (PROVIDED).
//!
//! Runs in U-mode, lives at 0x80400000, talks to the kernel via `ecall`.
//! Kept deliberately minimal — just enough to exercise sys_write + sys_exit.

#![no_std]
#![no_main]

use core::arch::asm;
use core::panic::PanicInfo;

const SYSCALL_WRITE:  usize = 64;
const SYSCALL_EXIT:   usize = 93;
const SYSCALL_GETPID: usize = 172;
const STDOUT: usize = 1;

#[inline(always)]
fn syscall(id: usize, a0: usize, a1: usize, a2: usize) -> isize {
    let mut ret: isize;
    unsafe {
        asm!(
            "ecall",
            inlateout("x10") a0 => ret,
            in("x11") a1,
            in("x12") a2,
            in("x17") id,
        );
    }
    ret
}

fn write(fd: usize, buf: &[u8]) -> isize {
    syscall(SYSCALL_WRITE, fd, buf.as_ptr() as usize, buf.len())
}
fn exit(code: i32) -> ! {
    syscall(SYSCALL_EXIT, code as usize, 0, 0);
    loop {}
}
fn getpid() -> isize { syscall(SYSCALL_GETPID, 0, 0, 0) }

#[no_mangle]
#[link_section = ".text.entry"]
pub extern "C" fn _start() -> ! {
    write(STDOUT, b"[user] hello from U-mode!\n");
    let _pid = getpid();
    write(STDOUT, b"[user] goodbye\n");
    exit(0);
}

#[panic_handler]
fn panic(_: &PanicInfo) -> ! { exit(-1) }
