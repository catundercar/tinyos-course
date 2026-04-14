//! Syscall dispatch. PROVIDED skeleton.

pub mod sync;

pub const SYSCALL_MUTEX_CREATE:    usize = 1010;
pub const SYSCALL_MUTEX_LOCK:      usize = 1011;
pub const SYSCALL_MUTEX_UNLOCK:    usize = 1012;
pub const SYSCALL_SEMAPHORE_CREATE:usize = 1020;
pub const SYSCALL_SEMAPHORE_UP:    usize = 1021;
pub const SYSCALL_SEMAPHORE_DOWN:  usize = 1022;
pub const SYSCALL_CONDVAR_CREATE:  usize = 1030;
pub const SYSCALL_CONDVAR_SIGNAL:  usize = 1031;
pub const SYSCALL_CONDVAR_WAIT:    usize = 1032;
