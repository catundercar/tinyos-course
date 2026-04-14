//! User-mode library — thin wrappers around the sync syscalls.
//!
//! PROVIDED. Do not modify.

#![no_std]

#[macro_use]
pub mod console;
pub mod syscall;

pub use syscall::*;
