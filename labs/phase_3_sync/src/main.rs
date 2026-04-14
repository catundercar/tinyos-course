//! TinyOS Phase 3 kernel entry point.
//!
//! Most of the kernel below this file is carried over from Phase 2
//! (trap, task, syscall). The student work for this phase lives in
//! `src/sync/` and in `src/syscall/sync.rs`.
//!
//! PROVIDED — do not modify.

#![no_std]
#![no_main]
#![feature(alloc_error_handler)]

extern crate alloc;

#[macro_use]
mod console;
mod arch;
mod heap;
mod lang_items;
mod sbi;
mod sync;
mod syscall;
mod task;
mod trap;

core::arch::global_asm!(include_str!("entry.asm"));

#[no_mangle]
pub fn rust_main() -> ! {
    clear_bss();
    heap::init();
    trap::init();
    task::init();
    println!("[tinyos phase_3] sync subsystem online");
    task::run_first_task();
}

fn clear_bss() {
    extern "C" {
        fn sbss();
        fn ebss();
    }
    unsafe {
        core::slice::from_raw_parts_mut(
            sbss as usize as *mut u8,
            ebss as usize - sbss as usize,
        )
        .fill(0);
    }
}
