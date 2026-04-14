//! task/context.rs — STUDENT (Lab 1 ⭐⭐).
//!
//! A `TaskContext` is the *tiny* snapshot we need to context-switch between
//! two kernel threads. Unlike `TrapContext` (34 words, saves the full user
//! register set on U→S entry), `TaskContext` only needs the registers that
//! the Rust calling convention says the *callee* must preserve across a
//! function call:
//!
//!   ra              — return address (where to resume when __switch returns)
//!   sp              — kernel stack pointer for this task
//!   s0 .. s11       — 12 callee-saved general registers
//!
//! Caller-saved registers (t0-t6, a0-a7) do NOT need to be in here: the
//! compiler already spilled them before calling `__switch`.
//!
//!                  kernel stack
//!                  ┌──────────────┐   high addr
//!                  │ (trap frame) │
//!                  ├──────────────┤ <-- task_cx.sp points here initially
//!                  │ (free)       │
//!                  │ ...          │
//!                  └──────────────┘   low addr
//!
//! A fresh task's context is set up so that the *first* __switch into it
//! lands on `__restore`, which then `sret`s into user space.

/// 14×usize = 112 bytes. Layout MUST match switch.S offsets.
#[repr(C)]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct TaskContext {
    pub ra: usize,
    pub sp: usize,
    pub s: [usize; 12],
}

impl TaskContext {
    /// Zeroed context — UnInit slots hold this.
    pub const fn zero_init() -> Self {
        Self { ra: 0, sp: 0, s: [0; 12] }
    }

    /// Build the initial TaskContext for a freshly loaded app.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. `ra` must point to `__restore` (extern "C" symbol from trap.S)
    ///    so the *first* __switch into this task sret's back to user mode.
    /// 2. `sp` must be `kstack_top` — the top of that task's kernel stack.
    /// 3. `s[0..12]` must be zeroed (Rust ABI says callee-saved start as 0
    ///    in a fresh frame; it's fine because nobody's read them yet).
    ///
    /// HINT: use `extern "C" { fn __restore(); }` then `__restore as usize`.
    ///
    /// HINT: the caller of `goto_restore` has already placed a TrapContext on
    ///       the kernel stack; `kstack_top` here is the address *just below*
    ///       that frame, so __restore's `mv sp, a0` picks it up correctly.
    pub fn goto_restore(_kstack_top: usize) -> Self {
        // TODO: Implement
        // Step 1: declare `extern "C" { fn __restore(); }`
        // Step 2: return Self { ra: __restore as usize, sp: kstack_top, s: [0;12] }
        unimplemented!("TODO Lab 1: TaskContext::goto_restore")
    }
}
