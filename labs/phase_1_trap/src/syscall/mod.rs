//! Syscall dispatch (LAB 3 · ⭐⭐).
//!
//! ABI (RISC-V Linux-like):
//!   a7       syscall number
//!   a0..a5   arguments
//!   a0       return value (we only write one register back)

pub mod fs;
pub mod process;

use crate::types::{SYSCALL_EXIT, SYSCALL_GETPID, SYSCALL_WRITE};
use fs::sys_write;
use process::{sys_exit, sys_getpid};

/// Top-level syscall dispatcher.
///
/// TODO: Implement this function.
///
/// Requirements:
/// 1. Match on `id`:
///      SYSCALL_WRITE  → sys_write(args[0], args[1] as *const u8, args[2])
///      SYSCALL_EXIT   → sys_exit(args[0] as i32)     // diverges
///      SYSCALL_GETPID → sys_getpid()
///      _              → panic!("unknown syscall {}", id)
/// 2. Return the isize that will be placed in a0 by `trap_handler`.
///    (`sys_exit` never returns — its branch in the match must be `!`.)
///
/// HINT: `args[1] as *const u8` is fine; the pointer is a user-space VA that
/// we happen to be able to dereference because Phase 1 shares one flat
/// address space. Virtual memory arrives in Phase 4.
pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    // TODO: Implement
    // Step 1: match id against SYSCALL_* constants
    // Step 2: forward to the appropriate sys_* function
    // Step 3: return its isize result
    let _ = (id, args, sys_write, sys_exit, sys_getpid,
             SYSCALL_WRITE, SYSCALL_EXIT, SYSCALL_GETPID);
    unimplemented!("TODO: implement syscall dispatch")
}
