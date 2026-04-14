//! PROVIDED dispatcher + `process` submodule with sys_mmap / sys_munmap
//! TODOs.

pub mod process;

const SYSCALL_WRITE:  usize = 64;
const SYSCALL_EXIT:   usize = 93;
const SYSCALL_MMAP:   usize = 222;
const SYSCALL_MUNMAP: usize = 215;

pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    match id {
        SYSCALL_MMAP   => process::sys_mmap(args[0], args[1], args[2] as u32),
        SYSCALL_MUNMAP => process::sys_munmap(args[0], args[1]),
        _ => { crate::println!("[kernel] unknown syscall {}", id); -1 }
    }
}
