//! app_yielder.rs — PROVIDED. Same idea but prints "B".

#![no_std]
#![no_main]

use user as _;

#[no_mangle]
fn _start() -> ! {
    for i in 0..5 {
        let msg = [b'B', b'0' + i as u8, b' '];
        user::write(1, &msg);
        user::yield_();
    }
    user::write(1, b"[B done]\n");
    user::exit(0)
}
