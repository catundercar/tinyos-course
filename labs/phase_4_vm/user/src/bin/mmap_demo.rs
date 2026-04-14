//! Demo: allocate a fresh anonymous page at a fixed VA, write + read back.
#![no_std]
#![no_main]

#[macro_use]
extern crate user_lib;

const VA: usize = 0x1000_0000;
const LEN: usize = 4096;

#[no_mangle]
fn main() -> i32 {
    let r = user_lib::mmap(VA, LEN, 0b011 /* R|W */);
    assert_eq!(r, 0, "mmap should succeed");
    unsafe {
        let p = VA as *mut u64;
        *p = 0xdead_beef;
        assert_eq!(*p, 0xdead_beef);
    }
    println!("mmap_demo: ok");
    user_lib::munmap(VA, LEN);
    0
}
