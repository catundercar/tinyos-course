//! PROVIDED — `print!`/`println!` via a write syscall (stub).

#[macro_export]
macro_rules! print {
    ($($arg:tt)*) => {{
        let _ = format_args!($($arg)*);
    }};
}

#[macro_export]
macro_rules! println {
    ($($arg:tt)*) => {{
        let _ = format_args!($($arg)*);
    }};
}
