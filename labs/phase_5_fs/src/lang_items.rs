//! PROVIDED — panic handler.
use core::panic::PanicInfo;
#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    crate::println!("[kernel] panic: {}", info);
    crate::sbi::shutdown(true)
}
