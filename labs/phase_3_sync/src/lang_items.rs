//! PROVIDED — panic handler + alloc error handler.

use core::panic::PanicInfo;

#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    if let Some(location) = info.location() {
        crate::println!(
            "[kernel panic] {}:{}: {}",
            location.file(),
            location.line(),
            info.message().unwrap()
        );
    } else {
        crate::println!("[kernel panic] {}", info.message().unwrap());
    }
    crate::sbi::shutdown();
}

#[alloc_error_handler]
fn oom(layout: core::alloc::Layout) -> ! {
    panic!("heap OOM: {:?}", layout);
}
