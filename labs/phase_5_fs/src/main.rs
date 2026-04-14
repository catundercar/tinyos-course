//! Kernel entry (Phase 4 baseline PROVIDED — simplified shim for Phase 5 focus).
#![no_std]
#![no_main]
#![feature(alloc_error_handler)]

extern crate alloc;

#[macro_use]
mod console;
mod lang_items;
mod sbi;
mod mm;
mod sync;
mod trap;
mod task;
mod syscall;
mod drivers;
mod fs;

use core::arch::global_asm;
global_asm!(include_str!("entry.asm"));

#[no_mangle]
pub fn rust_main() -> ! {
    println!("[kernel] phase 5 booting");
    mm::init();
    trap::init();
    drivers::init();
    fs::list_apps();
    task::run_first_task()
}
