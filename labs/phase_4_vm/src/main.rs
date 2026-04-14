//! Phase 4 kernel entry. PROVIDED.
#![no_std]
#![no_main]
#![feature(panic_info_message)]

#[macro_use]
mod console;
mod config;
mod mm;
mod sbi;
mod syscall;
mod task;
mod trap;

use core::arch::global_asm;
global_asm!(include_str!("entry.asm"));

#[no_mangle]
pub fn rust_main() -> ! {
    clear_bss();
    println!("[kernel] Phase 4: Virtual Memory boot");
    mm::init();
    println!("[kernel] mm subsystem up, SV39 enabled");
    trap::init();
    task::add_initproc();
    task::run_first_task();
    panic!("unreachable");
}

fn clear_bss() {
    extern "C" {
        fn sbss();
        fn ebss();
    }
    (sbss as usize..ebss as usize).for_each(|a| unsafe {
        (a as *mut u8).write_volatile(0);
    });
}

#[panic_handler]
fn panic(info: &core::panic::PanicInfo) -> ! {
    if let Some(loc) = info.location() {
        println!("[kernel] PANIC @ {}:{}: {}", loc.file(), loc.line(), info.message().unwrap());
    } else {
        println!("[kernel] PANIC: {}", info.message().unwrap());
    }
    sbi::shutdown();
}
