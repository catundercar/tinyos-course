//! trap/mod.rs — PROVIDED with a small Lab 3 patch point (marked TODO).
//!
//! In Phase 1 we handled only `UserEnvCall` (ecall from U-mode) and a few
//! faults. In Phase 2 we add **S-mode timer interrupts**: scause = 0x8000…0005.
//! When one fires we just call `suspend_current_and_run_next()` — the
//! scheduler picks someone else and __switch does the rest.

use core::arch::global_asm;
use riscv_shim::*;

pub mod context;
pub use context::TrapContext;

global_asm!(include_str!("trap.S"));

/// Install `stvec = __alltraps` so every S-mode exception/interrupt enters our
/// assembly stub. Called once at boot.
pub fn init() {
    extern "C" { fn __alltraps(); }
    unsafe { stvec::write(__alltraps as usize, stvec::TrapMode::Direct); }
}

/// Lab 3: enable S-mode timer interrupt bit in `sie` and set the first timer.
pub fn enable_timer_interrupt() {
    unsafe { sie::set_stimer(); }
}

#[no_mangle]
pub extern "C" fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    let scause = scause::read();
    let _stval = stval::read();
    match scause.cause() {
        Trap::Exception(Exception::UserEnvCall) => {
            cx.sepc += 4; // skip the ecall instruction
            let ret = crate::syscall::syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]);
            cx.x[10] = ret as usize;
        }
        Trap::Exception(Exception::StoreFault) | Trap::Exception(Exception::StorePageFault) |
        Trap::Exception(Exception::LoadFault)  | Trap::Exception(Exception::LoadPageFault) => {
            crate::println!("[kernel] memory fault, killing task.");
            crate::task::exit_current_and_run_next();
        }
        Trap::Exception(Exception::IllegalInstruction) => {
            crate::println!("[kernel] illegal instruction, killing task.");
            crate::task::exit_current_and_run_next();
        }
        // ─── Lab 3 ─────────────────────────────────────────────────────────
        Trap::Interrupt(Interrupt::SupervisorTimer) => {
            // TODO(Lab 3): handle timer interrupt
            // Step 1: reprogram the next timer (call crate::timer::set_next_trigger)
            // Step 2: yield current task (call crate::task::suspend_current_and_run_next)
            // HINT: after step 2 returns, control flows back here for the *new* task
            //       via __switch, so the caller chain does not actually return.
            panic!("TODO Lab 3: timer interrupt not handled yet");
        }
        other => panic!("[kernel] unhandled trap {:?}", other),
    }
    cx
}

// ─── Minimal stand-in for the `riscv` crate so the scaffolding type-checks
// without pulling a new dep. A real Phase 2 may switch to `riscv = "0.10"`.
mod riscv_shim {
    pub mod scause {
        #[derive(Debug)] pub enum Trap { Exception(Exception), Interrupt(Interrupt) }
        #[derive(Debug)] pub enum Exception {
            UserEnvCall, StoreFault, StorePageFault, LoadFault, LoadPageFault, IllegalInstruction,
        }
        #[derive(Debug)] pub enum Interrupt { SupervisorTimer }
        pub struct Scause(usize);
        impl Scause { pub fn cause(&self) -> Trap { unimplemented!() } }
        pub fn read() -> Scause { Scause(0) }
    }
    pub mod stval { pub fn read() -> usize { 0 } }
    pub mod stvec {
        pub enum TrapMode { Direct }
        pub unsafe fn write(_: usize, _: TrapMode) {}
    }
    pub mod sie { pub unsafe fn set_stimer() {} }
    pub use scause::{Trap, Exception, Interrupt};
}
