//! Trap dispatch (LAB 2 · ⭐⭐⭐).
//!
//! Once `__alltraps` has finished spilling state, it tail-calls into
//! `trap_handler`. Our job here is:
//!   1. Read `scause` / `stval` to learn WHY we trapped.
//!   2. Dispatch:
//!        - ecall from U-mode  → forward to `syscall::syscall`
//!        - timer / page fault → print + exit the app for now
//!        - anything else      → panic the kernel
//!   3. Return the (possibly-modified) context so `__restore` can rebuild it.

pub mod context;

use crate::println;
use crate::syscall::syscall;
use crate::types::{
    EXC_ILLEGAL_INST, EXC_LOAD_FAULT, EXC_LOAD_PAGE_FAULT, EXC_STORE_FAULT,
    EXC_STORE_PAGE_FAULT, EXC_U_ECALL, INT_S_TIMER,
};
use context::TrapContext;

/// Install `__alltraps` as the supervisor trap vector and make sure `sscratch`
/// starts out pointing at the kernel stack top.
///
/// TODO: Implement this function.
///
/// Requirements:
/// 1. Write the address of the symbol `__alltraps` into the `stvec` CSR, in
///    "direct" mode (MODE = 0, the low two bits must be 0).
/// 2. Seed `sscratch` with the top of the global kernel stack (see
///    `loader::KERNEL_STACK.sp()`). Without this the first `csrrw` inside
///    `__alltraps` would swap in garbage.
///
/// HINT: You can reach the asm symbol from Rust with:
///   `extern "C" { fn __alltraps(); }` and cast it to `usize`.
///
/// HINT: For CSR writes use inline asm:
///   `asm!("csrw stvec, {}", in(reg) x)`.
pub fn init() {
    // TODO: Implement
    // Step 1: extern "C" { fn __alltraps(); }
    // Step 2: csrw stvec, __alltraps as usize
    // Step 3: csrw sscratch, KERNEL_STACK.sp()
    unimplemented!("TODO: implement trap::init");
}

/// Kernel-side trap entry. Called by `__alltraps` with a1 unused and
/// `a0 = &mut TrapContext` (we accept it as a Rust reference).
///
/// TODO: Implement this function.
///
/// Requirements:
/// 1. Read `scause` and `stval` via inline asm CSR reads.
/// 2. If the MSB of scause is 1 → interrupt; else exception.
/// 3. On `EXC_U_ECALL`:
///      a. Advance `cx.sepc` by 4 so we do not re-execute the `ecall`.
///      b. Call `syscall(id = cx.x[17], args = [cx.x[10..=12]])`.
///      c. Store the return value into `cx.x[10]` (a0).
/// 4. On illegal / fault / page-fault: print scause + stval + sepc, exit app.
/// 5. Return the same `&mut TrapContext` so assembly can fall through to
///    `__restore`.
///
/// HINT: A clean way to structure this is a single `match` on a stripped
/// scause (cause & 0x7FFF_FFFF_FFFF_FFFF) plus a boolean `is_interrupt`.
///
/// HINT: `cx.x[17]` is a7 (syscall number). `cx.x[10]` is a0.
#[no_mangle]
pub extern "C" fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    // TODO: Implement
    // Step 1: read scause, stval via csrr
    // Step 2: split into (is_interrupt, code)
    // Step 3: match on (is_interrupt, code):
    //    (false, EXC_U_ECALL)        → advance sepc, dispatch syscall
    //    (false, EXC_ILLEGAL_INST)   → print + exit_current(-3)
    //    (false, EXC_LOAD_FAULT | EXC_STORE_FAULT |
    //            EXC_LOAD_PAGE_FAULT | EXC_STORE_PAGE_FAULT)
    //                                → print + exit_current(-2)
    //    (true,  INT_S_TIMER)        → (phase 2 will preempt here; ignore)
    //    _                           → panic!("unsupported trap ...")
    // Step 4: return cx
    let _ = (cx, EXC_U_ECALL, EXC_ILLEGAL_INST, EXC_LOAD_FAULT, EXC_STORE_FAULT,
             EXC_LOAD_PAGE_FAULT, EXC_STORE_PAGE_FAULT, INT_S_TIMER);
    let _ = syscall;
    let _ = println!;
    unimplemented!("TODO: implement trap_handler")
}
