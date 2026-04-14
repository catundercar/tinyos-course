//! Syscall dispatcher. PROVIDED.
pub mod fs;
pub mod process;

pub const SYSCALL_READ:     usize = 63;
pub const SYSCALL_WRITE:    usize = 64;
pub const SYSCALL_EXIT:     usize = 93;
pub const SYSCALL_YIELD:    usize = 124;
pub const SYSCALL_GETPID:   usize = 172;
pub const SYSCALL_FORK:     usize = 220;
pub const SYSCALL_EXEC:     usize = 221;
pub const SYSCALL_WAITPID:  usize = 260;
pub const SYSCALL_PIPE:     usize = 59;
pub const SYSCALL_DUP:      usize = 24;
pub const SYSCALL_CLOSE:    usize = 57;

pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        SYSCALL_READ    => fs::sys_read(args[0], args[1] as *mut u8, args[2]),
        SYSCALL_WRITE   => fs::sys_write(args[0], args[1] as *const u8, args[2]),
        SYSCALL_EXIT    => process::sys_exit(args[0] as i32),
        SYSCALL_YIELD   => process::sys_yield(),
        SYSCALL_GETPID  => process::sys_getpid(),
        SYSCALL_FORK    => process::sys_fork(),
        SYSCALL_EXEC    => process::sys_exec(args[0] as *const u8),
        SYSCALL_WAITPID => process::sys_waitpid(args[0] as isize, args[1] as *mut i32),
        SYSCALL_PIPE    => fs::sys_pipe(args[0] as *mut i32),
        SYSCALL_DUP     => fs::sys_dup(args[0]),
        SYSCALL_CLOSE   => fs::sys_close(args[0]),
        _ => panic!("unsupported syscall id={}", id),
    }
}
