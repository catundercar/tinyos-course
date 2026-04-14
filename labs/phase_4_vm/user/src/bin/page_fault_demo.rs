//! Demo: deliberately deref a null pointer. The kernel should catch the
//! page fault and kill this process without crashing the whole kernel.
#![no_std]
#![no_main]

#[macro_use]
extern crate user_lib;

#[no_mangle]
fn main() -> i32 {
    println!("about to segfault...");
    unsafe {
        let p = 0x0 as *mut u64;
        *p = 42;          // kernel should catch StorePageFault here
    }
    println!("this line must NEVER print");
    0
}
