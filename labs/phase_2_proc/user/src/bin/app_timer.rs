//! app_timer.rs — PROVIDED. Spins in a tight loop WITHOUT yielding, to prove
//! that preemption (Lab 3) actually kicks in. Without Lab 3, this app would
//! starve A and B; with the 10 ms timer, we see A/B/C interleaved.

#![no_std]
#![no_main]

use user as _;

#[no_mangle]
fn _start() -> ! {
    let start = user::get_time();
    let mut i: u32 = 0;
    loop {
        // busy work; no yield. Preemption must come from the timer ISR.
        if i % 100_000 == 0 {
            user::write(1, b"C ");
        }
        i = i.wrapping_add(1);
        if user::get_time() - start > 50 { break; } // ~50ms of spinning
    }
    user::write(1, b"[C done]\n");
    user::exit(0)
}
