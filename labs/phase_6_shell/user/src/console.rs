//! PROVIDED. print!/println! macros backed by `sys_write(1, …)`.
use core::fmt::{self, Write};
struct Stdout;
impl Write for Stdout {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        crate::sys_write(1, s.as_bytes()); Ok(())
    }
}
#[macro_export] macro_rules! print   { ($($a:tt)*) => { $crate::console::_print(format_args!($($a)*)); } }
#[macro_export] macro_rules! println { ($($a:tt)*) => { $crate::console::_print(format_args!("{}\n", format_args!($($a)*))); } }
#[doc(hidden)] pub fn _print(args: fmt::Arguments) { Stdout.write_fmt(args).unwrap(); }
