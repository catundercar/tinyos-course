pub mod fs;

pub const SYSCALL_OPEN: usize = 56;
pub const SYSCALL_CLOSE: usize = 57;
pub const SYSCALL_READ: usize = 63;
pub const SYSCALL_WRITE: usize = 64;
pub const SYSCALL_FSTAT: usize = 80;

pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        SYSCALL_OPEN  => fs::sys_open(args[0] as *const u8, args[1] as u32),
        SYSCALL_CLOSE => fs::sys_close(args[0]),
        SYSCALL_READ  => fs::sys_read(args[0], args[1] as *const u8, args[2]),
        SYSCALL_WRITE => fs::sys_write(args[0], args[1] as *const u8, args[2]),
        _ => -1,
    }
}
