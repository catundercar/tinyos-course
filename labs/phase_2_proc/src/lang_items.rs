//! lang_items.rs — PROVIDED. Panic handler for no_std kernel.

use crate::println;
use crate::sbi::shutdown;
use core::panic::PanicInfo;

#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    if let Some(loc) = info.location() {
        println!(
            "[kernel] panic at {}:{} — {}",
            loc.file(),
            loc.line(),
            info.message().unwrap_or(&format_args!(""))
        );
    } else {
        println!("[kernel] panic — {}", info.message().unwrap_or(&format_args!("")));
    }
    shutdown();
}
