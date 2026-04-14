//! Static app loader (PROVIDED).
//!
//! For Phase 1 we embed a single user program at compile time via
//! `include_bytes!`. Phase 2 will generalise this to multiple apps with a
//! link-script-generated table.

use crate::trap::context::TrapContext;
use crate::types::{APP_BASE_ADDRESS, APP_SIZE_LIMIT, KERNEL_STACK_SIZE, USER_STACK_SIZE};

#[repr(align(4096))]
struct KernelStack { data: [u8; KERNEL_STACK_SIZE] }

#[repr(align(4096))]
struct UserStack { data: [u8; USER_STACK_SIZE] }

pub static KERNEL_STACK: KernelStack = KernelStack { data: [0; KERNEL_STACK_SIZE] };
pub static USER_STACK:   UserStack   = UserStack   { data: [0; USER_STACK_SIZE]   };

impl KernelStack {
    pub fn sp(&self) -> usize { self.data.as_ptr() as usize + KERNEL_STACK_SIZE }
    /// Push a TrapContext onto this kernel stack and return its address.
    pub fn push_context(&self, ctx: TrapContext) -> &'static mut TrapContext {
        let cx_ptr = (self.sp() - core::mem::size_of::<TrapContext>()) as *mut TrapContext;
        unsafe { *cx_ptr = ctx; &mut *cx_ptr }
    }
}
impl UserStack {
    pub fn sp(&self) -> usize { self.data.as_ptr() as usize + USER_STACK_SIZE }
}

// The user app binary is produced by `cd user && cargo build --release` and
// converted to a flat binary. For the lab we `include_bytes!` it directly.
// If the file is missing, we stub with an illegal-instruction byte so the
// kernel still links but panics visibly.
#[cfg(feature = "with_app")]
static APP_BIN: &[u8] =
    include_bytes!("../user/target/riscv64gc-unknown-none-elf/release/hello.bin");
#[cfg(not(feature = "with_app"))]
static APP_BIN: &[u8] = &[0x00, 0x00, 0x00, 0x00];

pub fn load_app() -> usize {
    assert!(APP_BIN.len() <= APP_SIZE_LIMIT, "app too large");
    unsafe {
        // zero the target region, then copy
        core::slice::from_raw_parts_mut(APP_BASE_ADDRESS as *mut u8, APP_SIZE_LIMIT).fill(0);
        core::slice::from_raw_parts_mut(APP_BASE_ADDRESS as *mut u8, APP_BIN.len())
            .copy_from_slice(APP_BIN);
        core::arch::asm!("fence.i");
    }
    APP_BASE_ADDRESS
}
