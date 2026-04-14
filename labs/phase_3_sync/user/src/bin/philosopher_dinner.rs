//! Dining philosophers — the canonical deadlock stress test.
//!
//! 5 philosophers share 5 forks. Each philosopher picks up the LOWER-
//! numbered fork first, which is the classic "resource ordering" recipe
//! to break the circular-wait condition.
//!
//! Acceptance: must run 60s without deadlock (tracked by a shared heartbeat
//! counter that the grader polls).
//!
//! PROVIDED — do not modify.

#![no_std]
#![no_main]

extern crate user;

use user::*;

const N: usize = 5;
static mut FORKS: [isize; N] = [-1; N];
static mut HEARTBEAT: [usize; N] = [0; N];

fn think() { for _ in 0..1000 { core::hint::spin_loop(); } }
fn eat()   { for _ in 0..1000 { core::hint::spin_loop(); } }

fn philosopher(id: usize) {
    let left = id;
    let right = (id + 1) % N;
    let (first, second) = if left < right { (left, right) } else { (right, left) };
    loop {
        think();
        unsafe {
            sys_mutex_lock(FORKS[first] as usize);
            sys_mutex_lock(FORKS[second] as usize);
            eat();
            HEARTBEAT[id] = HEARTBEAT[id].wrapping_add(1);
            sys_mutex_unlock(FORKS[second] as usize);
            sys_mutex_unlock(FORKS[first] as usize);
        }
    }
}

#[no_mangle]
fn main() -> i32 {
    unsafe {
        for i in 0..N {
            FORKS[i] = sys_mutex_create();
        }
        for i in 0..N {
            sys_thread_create(philosopher as usize, i);
        }
        // Parent observer: yield forever; the grader snapshots HEARTBEAT.
        loop { sys_yield(); }
    }
}
