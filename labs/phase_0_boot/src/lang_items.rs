//! lang_items.rs — Lab 3 ⭐⭐
//!
//! Rust's core library requires every `no_std` binary to declare a
//! `#[panic_handler]`. Panics happen when:
//!   - `unwrap()` / `expect()` on None/Err
//!   - An arithmetic overflow in debug mode
//!   - An explicit `panic!(...)`
//!   - `assert!` / `assert_eq!` failures
//!
//! Your handler is the last-chance logger: print what happened and
//! where, then bring the machine down — we have no process to kill
//! and no shell to return to in Phase 0.

use crate::println;
use crate::sbi::shutdown;
use core::panic::PanicInfo;

/// The kernel-wide panic handler.
///
/// TODO (Lab 3): implement this.
///
/// Requirements:
/// 1. Print a red banner like `[kernel] PANIC ...`.
/// 2. If `info.location()` returns Some(loc), include file + line.
/// 3. If `info.message()` returns Some(msg), include the message.
/// 4. Call `shutdown()` to halt the machine (it returns `!`).
///
/// HINT: `PanicInfo` exposes:
///         info.location() -> Option<&Location>
///         info.message()  -> Option<&fmt::Arguments>  (needs the
///                                                      panic_info_message
///                                                      feature, already on)
///
/// HINT: You can nest `format_args!` via `println!("{}", msg)`.
///
/// HINT: `#[panic_handler]` can only appear once across the whole
///       binary. If you forget `#[panic_handler]`, the linker will
///       complain with `error: #[panic_handler] function required`.
#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    // TODO (Lab 3): pretty-print the panic info, then shutdown.
    //
    // Suggested skeleton:
    //
    //     if let Some(location) = info.location() {
    //         println!(
    //             "[kernel] PANIC at {}:{}: {}",
    //             location.file(),
    //             location.line(),
    //             info.message().unwrap(),
    //         );
    //     } else {
    //         println!("[kernel] PANIC: {}", info.message().unwrap());
    //     }

    let _ = info; // silence unused-var warning until TODO is done
    println!("[kernel] PANIC (handler not yet implemented)");
    shutdown();
}
