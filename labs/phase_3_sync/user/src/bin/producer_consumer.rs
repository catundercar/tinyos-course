//! Bounded-buffer producer/consumer via two semaphores + one mutex.
//!
//!   empty = Semaphore(BUF_SIZE)   // count of empty slots
//!   full  = Semaphore(0)          // count of filled slots
//!   m     = Mutex                 // protects the ring buffer indices
//!
//! Producer:    empty.down();  m.lock(); push; m.unlock();  full.up();
//! Consumer:    full.down();   m.lock(); pop;  m.unlock();  empty.up();
//!
//! PROVIDED — do not modify.

#![no_std]
#![no_main]

extern crate user;

use user::*;

const BUF_SIZE: usize = 8;
const N_ITEMS: usize = 2000;

static mut BUF: [usize; BUF_SIZE] = [0; BUF_SIZE];
static mut HEAD: usize = 0;
static mut TAIL: usize = 0;
static mut EMPTY: isize = -1;
static mut FULL: isize = -1;
static mut MUTEX: isize = -1;
static mut PRODUCED: usize = 0;
static mut CONSUMED: usize = 0;

fn producer(_: usize) {
    for i in 0..N_ITEMS {
        unsafe {
            sys_sem_down(EMPTY as usize);
            sys_mutex_lock(MUTEX as usize);
            BUF[TAIL % BUF_SIZE] = i;
            TAIL += 1;
            PRODUCED += 1;
            sys_mutex_unlock(MUTEX as usize);
            sys_sem_up(FULL as usize);
        }
    }
}

fn consumer(_: usize) {
    for _ in 0..N_ITEMS {
        unsafe {
            sys_sem_down(FULL as usize);
            sys_mutex_lock(MUTEX as usize);
            let _v = BUF[HEAD % BUF_SIZE];
            HEAD += 1;
            CONSUMED += 1;
            sys_mutex_unlock(MUTEX as usize);
            sys_sem_up(EMPTY as usize);
        }
    }
}

#[no_mangle]
fn main() -> i32 {
    unsafe {
        EMPTY = sys_sem_create(BUF_SIZE);
        FULL  = sys_sem_create(0);
        MUTEX = sys_mutex_create();
        sys_thread_create(producer as usize, 0);
        sys_thread_create(consumer as usize, 0);
        while CONSUMED < N_ITEMS { sys_yield(); }
        if PRODUCED == N_ITEMS && CONSUMED == N_ITEMS { 0 } else { -1 }
    }
}
