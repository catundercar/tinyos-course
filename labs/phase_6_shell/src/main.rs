//! Kernel entry. PROVIDED — this is the same skeleton from Phase 5, extended to
//! push an `initproc` onto the ready queue before jumping into `run_tasks`.
#![no_std]
#![no_main]
#![feature(alloc_error_handler)]

extern crate alloc;
#[macro_use] extern crate lazy_static;

pub mod drivers;
pub mod fs;
pub mod mm;
pub mod sync;
pub mod syscall;
pub mod task;
pub mod trap;

use core::panic::PanicInfo;

#[no_mangle]
pub extern "C" fn rust_main() -> ! {
    mm::init();
    trap::init();
    task::add_initproc();
    task::run_tasks();
}

#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    // Phase 0/1/2/3/5 already taught the full panic-handler pattern
    // (location + message + sbi_shutdown). For Phase 6 we keep the
    // kernel minimal — the previous phases' richer handler can be
    // dropped in once you wire up println! + sbi::shutdown here.
    let _ = info;
    loop {}
}

#[alloc_error_handler]
fn oom(_: core::alloc::Layout) -> ! { loop {} }
