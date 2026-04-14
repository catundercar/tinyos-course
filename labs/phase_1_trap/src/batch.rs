//! Batch-mode app runner (PROVIDED).
//!
//! `run_first_app` is the bridge from S-mode kernel → U-mode user code.
//! It wires a fresh TrapContext onto the kernel stack and dispatches to the
//! student-written `__restore` which pops it back into the CPU registers.

use crate::loader::{load_app, KERNEL_STACK, USER_STACK};
use crate::println;
use crate::trap::context::TrapContext;

pub fn run_first_app() -> ! {
    let entry = load_app();
    println!("[kernel] loaded app @ {:#x}, jumping to U-mode", entry);

    extern "C" {
        fn __restore(cx_addr: usize);
    }
    let cx = TrapContext::app_init_context(entry, USER_STACK.sp());
    let cx_addr = KERNEL_STACK.push_context(cx) as *const _ as usize;
    unsafe { __restore(cx_addr); }
    unreachable!("__restore must not return")
}

/// Called by `trap_handler` when a user app invokes `sys_exit`.
pub fn exit_current(code: i32) -> ! {
    println!("[kernel] app exited with code {}", code);
    crate::sbi::shutdown()
}
