//! main.rs — TinyOS kernel entry point (Rust side)
//!
//! This is the "glue" file that ties everything together. It is mostly
//! provided. The `rust_main` function is what Lab 1's `entry.asm` will
//! jump to after setting up the stack.
//!
//! You will edit very little here — the action lives in `entry.asm`,
//! `sbi.rs`, `console.rs`, and `lang_items.rs`.

#![no_std]
#![no_main]
#![feature(panic_info_message)]

use core::arch::global_asm;

#[macro_use]
mod console;
mod lang_items;
mod sbi;
mod types;

// Pull the boot assembly into the binary. `entry.asm` provides the
// `_start` symbol that the linker script uses as the ENTRY point.
global_asm!(include_str!("entry.asm"));

/// Zero out the `.bss` section.
///
/// The ELF loader (OpenSBI in our case) does not guarantee that `.bss`
/// is zero-initialised. Rust safety assumptions (e.g. static variables
/// starting at their declared value) require this. We do it early,
/// before calling into any Rust code that touches statics.
fn clear_bss() {
    extern "C" {
        fn sbss();
        fn ebss();
    }
    (sbss as usize..ebss as usize).for_each(|addr| unsafe {
        (addr as *mut u8).write_volatile(0);
    });
}

/// The Rust kernel entry point.
///
/// Control arrives here from `_start` in `entry.asm` after:
///   1. Stack pointer has been set to the top of the boot stack.
///   2. (optionally) a0/a1 have been preserved as hartid / dtb.
///
/// We must NEVER return from this function — it would jump back to
/// uninitialised stack memory. End with `sbi::shutdown()` or an
/// infinite loop.
#[no_mangle]
pub extern "C" fn rust_main() -> ! {
    clear_bss();

    println!("Hello, TinyOS!");
    println!("[kernel] booted at 0x{:x}", rust_main as usize);

    print_memory_layout();

    // For Phase 0 we simply shut down cleanly after printing.
    // Later phases will replace this with the scheduler loop.
    sbi::shutdown();
}

/// Print the linker-provided memory layout symbols.
/// Useful sanity check — if these print "0x0" then the linker
/// script was not picked up.
fn print_memory_layout() {
    extern "C" {
        fn stext();
        fn etext();
        fn srodata();
        fn erodata();
        fn sdata();
        fn edata();
        fn sbss();
        fn ebss();
    }
    println!("[kernel] .text   [{:#x}, {:#x})", stext as usize, etext as usize);
    println!("[kernel] .rodata [{:#x}, {:#x})", srodata as usize, erodata as usize);
    println!("[kernel] .data   [{:#x}, {:#x})", sdata as usize, edata as usize);
    println!("[kernel] .bss    [{:#x}, {:#x})", sbss as usize, ebss as usize);
}
