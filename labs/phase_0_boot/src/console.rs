//! console.rs — Lab 2 ⭐⭐
//!
//! Formatted printing support built on top of `sbi::console_putchar`.
//!
//! `core::fmt` in no_std needs a sink that implements `fmt::Write`.
//! We provide a zero-sized `Stdout` struct whose `write_str` just
//! loops calling `console_putchar` byte by byte.

use crate::sbi::console_putchar;
use core::fmt::{self, Write};

/// Zero-sized writer that routes text to the SBI console.
struct Stdout;

impl Write for Stdout {
    /// Write every byte of `s` through the SBI putchar.
    ///
    /// TODO (Lab 2): implement this.
    ///
    /// Requirements:
    /// 1. Iterate over the bytes of `s`.
    /// 2. For each byte, call `console_putchar(byte as usize)`.
    /// 3. Return `Ok(())` — SBI putchar does not report errors.
    ///
    /// HINT: `s.as_bytes()` gives you a `&[u8]`. A `for` loop works.
    ///
    /// HINT: Do NOT use `println!`/`print!` inside this function; that
    ///       would be infinite recursion (they route back through here).
    fn write_str(&mut self, s: &str) -> fmt::Result {
        // TODO (Lab 2): replace the body with the real implementation.
        let _ = s;
        Ok(())
    }
}

/// Internal helper used by the `print!` / `println!` macros.
///
/// Not intended to be called directly from user code.
pub fn print(args: fmt::Arguments) {
    Stdout.write_fmt(args).unwrap();
}

/// `print!("{}", 42)` — no trailing newline.
#[macro_export]
macro_rules! print {
    ($($arg:tt)*) => {
        $crate::console::print(format_args!($($arg)*));
    };
}

/// `println!("booted on hart {}", hartid)` — append `\n`.
#[macro_export]
macro_rules! println {
    () => {
        $crate::print!("\n");
    };
    ($($arg:tt)*) => {
        $crate::console::print(format_args!("{}\n", format_args!($($arg)*)));
    };
}
