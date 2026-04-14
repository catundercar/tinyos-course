//! User-side ecall wrappers for sync syscalls.
//! PROVIDED — do not modify.

const SYS_MUTEX_CREATE:     usize = 1010;
const SYS_MUTEX_LOCK:       usize = 1011;
const SYS_MUTEX_UNLOCK:     usize = 1012;
const SYS_SEM_CREATE:       usize = 1020;
const SYS_SEM_UP:           usize = 1021;
const SYS_SEM_DOWN:         usize = 1022;
const SYS_CONDVAR_CREATE:   usize = 1030;
const SYS_CONDVAR_SIGNAL:   usize = 1031;
const SYS_CONDVAR_WAIT:     usize = 1032;
const SYS_THREAD_CREATE:    usize = 460;
const SYS_YIELD:            usize = 124;

#[inline]
fn syscall(id: usize, args: [usize; 3]) -> isize {
    let mut ret: isize;
    unsafe {
        core::arch::asm!(
            "ecall",
            inlateout("x10") args[0] => ret,
            in("x11") args[1],
            in("x12") args[2],
            in("x17") id,
        );
    }
    ret
}

pub fn sys_mutex_create()            -> isize { syscall(SYS_MUTEX_CREATE, [0, 0, 0]) }
pub fn sys_mutex_lock(id: usize)     -> isize { syscall(SYS_MUTEX_LOCK, [id, 0, 0]) }
pub fn sys_mutex_unlock(id: usize)   -> isize { syscall(SYS_MUTEX_UNLOCK, [id, 0, 0]) }
pub fn sys_sem_create(n: usize)      -> isize { syscall(SYS_SEM_CREATE, [n, 0, 0]) }
pub fn sys_sem_up(id: usize)         -> isize { syscall(SYS_SEM_UP, [id, 0, 0]) }
pub fn sys_sem_down(id: usize)       -> isize { syscall(SYS_SEM_DOWN, [id, 0, 0]) }
pub fn sys_condvar_create()          -> isize { syscall(SYS_CONDVAR_CREATE, [0, 0, 0]) }
pub fn sys_condvar_signal(id: usize) -> isize { syscall(SYS_CONDVAR_SIGNAL, [id, 0, 0]) }
pub fn sys_condvar_wait(c: usize, m: usize) -> isize { syscall(SYS_CONDVAR_WAIT, [c, m, 0]) }
pub fn sys_thread_create(entry: usize, arg: usize) -> isize { syscall(SYS_THREAD_CREATE, [entry, arg, 0]) }
pub fn sys_yield() -> isize { syscall(SYS_YIELD, [0, 0, 0]) }
