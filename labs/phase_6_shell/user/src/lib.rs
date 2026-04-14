//! PROVIDED. User-land runtime + syscall wrappers.
#![no_std]
#![feature(linkage)]

extern crate alloc;

pub mod syscall;
pub mod console;

pub use syscall::*;

#[linkage = "weak"]
#[no_mangle]
fn main() -> i32 { panic!("Cannot find main!"); }

#[no_mangle]
#[link_section = ".text.entry"]
pub extern "C" fn _start() -> ! {
    exit(main())
}

pub fn fork()  -> isize { sys_fork() }
pub fn exec(path: &str) -> isize { sys_exec(path) }
pub fn wait(exit_code: &mut i32) -> isize {
    loop {
        match sys_waitpid(-1, exit_code as *mut _) {
            -2 => { sys_yield(); }
            n  => return n,
        }
    }
}
pub fn waitpid(pid: usize, xcode: &mut i32) -> isize {
    loop {
        match sys_waitpid(pid as isize, xcode as *mut _) {
            -2 => { sys_yield(); }
            n  => return n,
        }
    }
}
pub fn exit(code: i32) -> ! { sys_exit(code); loop {} }
pub fn pipe(fds: &mut [i32; 2]) -> isize { sys_pipe(fds.as_mut_ptr()) }
pub fn dup(fd: usize) -> isize { sys_dup(fd) }
pub fn close(fd: usize) -> isize { sys_close(fd) }
pub fn read(fd: usize, buf: &mut [u8]) -> isize { sys_read(fd, buf) }
pub fn write(fd: usize, buf: &[u8]) -> isize { sys_write(fd, buf) }
pub fn getpid() -> isize { sys_getpid() }
pub fn yield_() -> isize { sys_yield() }
