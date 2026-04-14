//! PROVIDED (Phase 3 baseline, patched for Phase 4).
//!
//! In Phase 4 the trap path must:
//!   1. Enter through the trampoline (mapped at `TRAMPOLINE` in every
//!      address space).
//!   2. Save user registers into the task's TRAP_CONTEXT page.
//!   3. Switch `satp` to the kernel's page table.
//!   4. Jump to `trap_handler` in kernel space.
//!
//! Students don't rewrite this file but they DO need to update `task::*`
//! so that switching tasks also switches `satp`.

use core::arch::global_asm;
global_asm!(include_str!("trampoline.S"));

pub fn init() {
    extern "C" { fn __alltraps(); }
    unsafe {
        riscv::register::stvec::write(
            __alltraps as usize,
            riscv::register::stvec::TrapMode::Direct,
        );
    }
}

#[no_mangle]
pub fn trap_handler() -> ! {
    // Students patch this in Phase 4 to:
    //   - read scause / stval
    //   - on page fault: print info, kill current task
    //   - on syscall: dispatch to syscall::syscall()
    panic!("trap_handler not yet implemented for Phase 4");
}

#[no_mangle]
pub fn trap_return() -> ! { panic!("trap_return stub") }
