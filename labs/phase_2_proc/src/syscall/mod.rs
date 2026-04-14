//! syscall/mod.rs — PROVIDED. Central syscall dispatch.
//!
//! Numbers are stable across phases so user code does not change:
//!   SYSCALL_WRITE    = 64
//!   SYSCALL_EXIT     = 93
//!   SYSCALL_YIELD    = 124  (Phase 2)
//!   SYSCALL_GET_TIME = 169  (Phase 2, Lab 3)

const SYSCALL_WRITE:    usize = 64;
const SYSCALL_EXIT:     usize = 93;
const SYSCALL_YIELD:    usize = 124;
const SYSCALL_GET_TIME: usize = 169;

pub mod fs;
pub mod process;

pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        SYSCALL_WRITE    => fs::sys_write(args[0], args[1] as *const u8, args[2]),
        SYSCALL_EXIT     => process::sys_exit(args[0] as i32),
        SYSCALL_YIELD    => process::sys_yield(),
        SYSCALL_GET_TIME => process::sys_get_time(),
        _ => panic!("[kernel] unknown syscall id = {}", id),
    }
}
