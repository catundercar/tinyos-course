//! FS-related syscalls. Students add pipe / dup / close here; read/write are PROVIDED.

use alloc::sync::Arc;
use crate::fs::{make_pipe, File};
use crate::mm::{translated_byte_buffer, translated_refmut, UserBuffer};
use crate::task::{current_task, current_user_token};

pub const FD_STDIN: usize = 0;
pub const FD_STDOUT: usize = 1;

/// PROVIDED. Write `len` bytes from user `buf` to fd.
pub fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize {
    let task = current_task().unwrap();
    let inner = task.inner_exclusive_access();
    if fd >= inner.fd_table.len() { return -1; }
    if let Some(file) = &inner.fd_table[fd] {
        if !file.writable() { return -1; }
        let file = file.clone();
        drop(inner);
        let token = current_user_token();
        file.write(UserBuffer::new(translated_byte_buffer(token, buf, len))) as isize
    } else { -1 }
}

/// PROVIDED. Read up to `len` bytes from fd into user `buf`.
pub fn sys_read(fd: usize, buf: *mut u8, len: usize) -> isize {
    let task = current_task().unwrap();
    let inner = task.inner_exclusive_access();
    if fd >= inner.fd_table.len() { return -1; }
    if let Some(file) = &inner.fd_table[fd] {
        if !file.readable() { return -1; }
        let file = file.clone();
        drop(inner);
        let token = current_user_token();
        file.read(UserBuffer::new(translated_byte_buffer(token, buf, len))) as isize
    } else { -1 }
}

/// `sys_pipe` — create a pipe pair and install two fds in the calling process.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Call `make_pipe()` → returns `(read_end, write_end)` both implementing `File`
/// 2. Allocate two fresh slots in the current process's `fd_table`
///    (push `None` if every slot is taken, then overwrite)
/// 3. Write the two fd numbers to user memory at `pipe_ptr[0]` and `pipe_ptr[1]`
/// 4. Return 0 on success
///
/// HINT: `translated_refmut(token, pipe_ptr)` gives you a `&mut i32` in kernel
/// space pointing at user memory — write to it twice with an offset of one word.
///
/// HINT: Always allocate the READ fd first so the numerically smaller fd is
/// the reader — that's what POSIX says and what the shell assumes.
pub fn sys_pipe(_pipe_ptr: *mut i32) -> isize {
    // TODO: Implement
    // Step 1: let task = current_task().unwrap();
    // Step 2: let (r, w) = make_pipe();
    // Step 3: let mut inner = task.inner_exclusive_access();
    // Step 4: let rfd = alloc_fd(&mut inner); inner.fd_table[rfd] = Some(r);
    // Step 5: let wfd = alloc_fd(&mut inner); inner.fd_table[wfd] = Some(w);
    // Step 6: write rfd, wfd back to user via translated_refmut
    unimplemented!("TODO: sys_pipe");
}

/// `sys_dup` — duplicate `fd` into the lowest free slot.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Return -1 if `fd` is out of range or points at a `None` slot
/// 2. Clone the `Arc<dyn File>` into a fresh slot
/// 3. Return the new fd number
///
/// HINT: `Arc::clone` is the whole trick — both fds refer to the same pipe end,
/// sharing the same ring buffer. That's how the shell redirects stdout to a pipe.
pub fn sys_dup(_fd: usize) -> isize {
    // TODO: Implement
    unimplemented!("TODO: sys_dup");
}

/// `sys_close` — drop our reference to fd.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Return -1 on invalid fd
/// 2. `inner.fd_table[fd] = None` — the `Arc` drop chain handles cleanup
/// 3. Return 0
///
/// HINT: When the LAST Arc to a pipe's write-end drops, the reader will observe EOF.
/// Getting close() right is what makes `ls | wc -l` terminate.
pub fn sys_close(_fd: usize) -> isize {
    // TODO: Implement
    unimplemented!("TODO: sys_close");
}

/// PROVIDED helper — allocate the lowest free fd in `fd_table`.
fn alloc_fd(inner: &mut crate::task::PCBInner) -> usize {
    for (i, slot) in inner.fd_table.iter().enumerate() {
        if slot.is_none() { return i; }
    }
    inner.fd_table.push(None);
    inner.fd_table.len() - 1
}
