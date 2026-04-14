//! Panic handler and other language items required by `no_std`.
//!
//! PROVIDED — do not modify.

use crate::{println, sbi::shutdown};
use core::panic::PanicInfo;

#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    if let Some(loc) = info.location() {
        println!(
            "[kernel] PANIC at {}:{} :: {}",
            loc.file(),
            loc.line(),
            info.message().unwrap_or(&format_args!(""))
        );
    } else {
        println!("[kernel] PANIC :: {}", info.message().unwrap_or(&format_args!("")));
    }
    shutdown()
}
