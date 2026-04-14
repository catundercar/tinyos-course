//! PROVIDED — minimal SBI stubs.
pub fn console_putchar(c: usize) {
    #[allow(deprecated)]
    sbi_rt::legacy::console_putchar(c);
}
pub fn shutdown(_failure: bool) -> ! {
    use sbi_rt::{system_reset, NoReason, Shutdown};
    system_reset(Shutdown, NoReason);
    unreachable!()
}
