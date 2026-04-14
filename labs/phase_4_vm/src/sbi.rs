//! PROVIDED. Minimal SBI console + shutdown wrappers.
use core::arch::asm;

#[inline(always)]
fn sbi_call(eid: usize, fid: usize, a0: usize, a1: usize, a2: usize) -> usize {
    let mut ret;
    unsafe {
        asm!(
            "ecall",
            inlateout("x10") a0 => ret,
            in("x11") a1,
            in("x12") a2,
            in("x16") fid,
            in("x17") eid,
        );
    }
    ret
}

pub fn console_putchar(c: usize) { sbi_call(0x01, 0, c, 0, 0); }
pub fn shutdown() -> ! {
    sbi_call(0x08, 0, 0, 0, 0);
    loop {}
}
