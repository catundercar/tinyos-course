//! types.rs — PROVIDED. Small enums and constants shared across modules.
//!
//! Do NOT modify. Extending these (e.g. adding a `Sleeping` state) happens in
//! Phase 3 and later — Phase 2 keeps the state machine intentionally tiny.

#![allow(dead_code)]

/// State of a task in the scheduler's view.
///
///   UnInit   — TCB slot is empty / app not yet loaded
///   Ready    — runnable; waiting for CPU
///   Running  — currently on CPU (there is exactly one per hart)
///   Exited   — exit() called, never eligible again
#[repr(u8)]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub enum TaskStatus {
    UnInit = 0,
    Ready = 1,
    Running = 2,
    Exited = 3,
}
