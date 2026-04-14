//! Stress test: 10 threads × 10_000 increments each against a single counter.
//!
//! Expected output after both runs:
//!   - WITHOUT mutex:  "unprotected: <some number ≪ 100000>"
//!   - WITH mutex:     "protected:   100000"
//!
//! PROVIDED — do not modify. Serves as the Phase 3 acceptance criterion #1.

#![no_std]
#![no_main]

extern crate user;

use user::*;

const THREADS: usize = 10;
const ITERS: usize = 10_000;

static mut COUNTER: usize = 0;
static mut MUTEX_ID: isize = -1;

fn worker(_arg: usize) {
    unsafe {
        for _ in 0..ITERS {
            sys_mutex_lock(MUTEX_ID as usize);
            COUNTER += 1;
            sys_mutex_unlock(MUTEX_ID as usize);
        }
    }
}

#[no_mangle]
fn main() -> i32 {
    unsafe {
        MUTEX_ID = sys_mutex_create();
        for _ in 0..THREADS {
            sys_thread_create(worker as usize, 0);
        }
        // Parent waits by yielding until all workers finish.
        while COUNTER < THREADS * ITERS {
            sys_yield();
        }
        if COUNTER == THREADS * ITERS { 0 } else { -1 }
    }
}
