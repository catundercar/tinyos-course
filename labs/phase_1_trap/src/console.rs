//! Basic print! / println! macros that funnel bytes through the SBI console.
//!
//! PROVIDED — do not modify.

use crate::sbi::console_putchar;
use core::fmt::{self, Write};

struct Stdout;

impl Write for Stdout {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        for byte in s.bytes() {
            console_putchar(byte as usize);
        }
        Ok(())
    }
}

pub fn print(args: fmt::Arguments) {
    Stdout.write_fmt(args).unwrap();
}

#[macro_export]
macro_rules! print {
    ($($arg:tt)*) => ($crate::console::print(format_args!($($arg)*)));
}

#[macro_export]
macro_rules! println {
    () => ($crate::print!("\n"));
    ($fmt:expr $(, $($arg:tt)*)?) => (
        $crate::console::print(format_args!(concat!($fmt, "\n") $(, $($arg)*)?))
    );
}
