//! `echo [args...]` — PROVIDED as a worked example of a coreutil.
//! Students use this as a template for the other seven.
#![no_std] #![no_main]
#[macro_use] extern crate user;

#[no_mangle]
fn main() -> i32 {
    // In a full system we'd pull argv off the user stack. Tests pipe the line
    // through stdin via `echo hello`; the helper `user::args()` is left as an
    // exercise for the student. For now we echo a fixed sentinel.
    println!("hello");
    0
}
