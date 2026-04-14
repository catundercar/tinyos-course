//! loader.rs — PROVIDED. Multi-app static loader.
//!
//! In Phase 1 we had one app, linked at a fixed address. In Phase 2 we support
//! N apps: they are embedded into the kernel image via `link_app.S` (or, for
//! the purposes of this lab, a manual extern block) and copied at boot time to
//! `APP_BASE_ADDRESS + i * APP_SIZE_LIMIT`. Each task gets its own
//! KernelStack + UserStack allocated below.

use crate::config::{APP_BASE_ADDRESS, APP_SIZE_LIMIT, KERNEL_STACK_SIZE, MAX_APP_NUM, USER_STACK_SIZE};
use core::arch::asm;

#[repr(align(4096))]
#[derive(Copy, Clone)]
pub struct KernelStack {
    pub data: [u8; KERNEL_STACK_SIZE],
}

#[repr(align(4096))]
#[derive(Copy, Clone)]
pub struct UserStack {
    pub data: [u8; USER_STACK_SIZE],
}

impl KernelStack {
    pub const fn new() -> Self { Self { data: [0; KERNEL_STACK_SIZE] } }
    pub fn top(&self) -> usize { self.data.as_ptr() as usize + KERNEL_STACK_SIZE }
}
impl UserStack {
    pub const fn new() -> Self { Self { data: [0; USER_STACK_SIZE] } }
    pub fn top(&self) -> usize { self.data.as_ptr() as usize + USER_STACK_SIZE }
}

pub static KERNEL_STACKS: [KernelStack; MAX_APP_NUM] = [KernelStack::new(); MAX_APP_NUM];
pub static USER_STACKS:   [UserStack;   MAX_APP_NUM] = [UserStack::new();   MAX_APP_NUM];

extern "C" {
    fn _num_app();
}

/// Number of apps packed into the kernel image.
pub fn get_num_app() -> usize {
    unsafe { (_num_app as usize as *const usize).read_volatile() }
}

/// Return base address where app `i` has been loaded.
pub fn get_base_i(i: usize) -> usize { APP_BASE_ADDRESS + i * APP_SIZE_LIMIT }

/// Copy each app's bytes from the kernel image to its runtime base address.
/// Must be called once at boot, before any task tries to run.
pub fn load_apps() {
    let num_app_ptr = _num_app as usize as *const usize;
    unsafe {
        let num_app = num_app_ptr.read_volatile();
        // num_app_ptr[1..=num_app+1] is the app_start table
        let app_start = core::slice::from_raw_parts(num_app_ptr.add(1), num_app + 1);
        // Clear i-cache since we wrote to .text region
        asm!("fence.i");
        for i in 0..num_app {
            let base = get_base_i(i);
            // zero-fill the region
            core::slice::from_raw_parts_mut(base as *mut u8, APP_SIZE_LIMIT).fill(0);
            let src = core::slice::from_raw_parts(app_start[i] as *const u8, app_start[i + 1] - app_start[i]);
            let dst = core::slice::from_raw_parts_mut(base as *mut u8, src.len());
            dst.copy_from_slice(src);
        }
        asm!("fence.i");
    }
}
