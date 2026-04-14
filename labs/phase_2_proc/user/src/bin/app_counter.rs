//! app_counter.rs — PROVIDED. Prints "A0 A1 A2 ..." yielding between each.

#![no_std]
#![no_main]

use user as _;

#[no_mangle]
fn _start() -> ! {
    for i in 0..5 {
        let msg = [b'A', b'0' + i as u8, b' '];
        user::write(1, &msg);
        user::yield_();
    }
    user::write(1, b"[A done]\n");
    user::exit(0)
}
