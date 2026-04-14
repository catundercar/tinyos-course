//! Demo: two processes each write a magic value at the SAME virtual
//! address (0x1000_0000). After fork+sleep they must read back their own
//! value — proving address spaces are isolated.
#![no_std]
#![no_main]

#[macro_use]
extern crate user_lib;

const SHARED_VA: usize = 0x1000_0000;

#[no_mangle]
fn main() -> i32 {
    user_lib::mmap(SHARED_VA, 4096, 0b011);
    let pid = user_lib::fork();
    let magic = if pid == 0 { 0xAAAA_AAAA_u64 } else { 0xBBBB_BBBB_u64 };
    unsafe {
        let p = SHARED_VA as *mut u64;
        *p = magic;
        user_lib::yield_();
        assert_eq!(*p, magic, "VA 0x{:x} leaked across address spaces!", SHARED_VA);
    }
    println!("[pid?{}] isolation ok, value=0x{:x}", pid, magic);
    0
}
