//! File-descriptor-flavoured syscalls (LAB 3 · ⭐⭐).
//!
//! For now the only FD that exists is stdout (fd = 1). Everything else is a
//! panic — a real FD table arrives in Phase 5 (file system).

use crate::sbi::console_putchar;

pub const FD_STDOUT: usize = 1;

/// `sys_write(fd, buf, len)` — write `len` bytes from user-space pointer
/// `buf` to file descriptor `fd`.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. Only `fd == FD_STDOUT` is supported; for anything else, panic.
/// 2. Walk the raw user pointer as a `&[u8]` of length `len` and feed each
///    byte to `console_putchar`.
/// 3. Return `len as isize` on success.
///
/// HINT: Use `core::slice::from_raw_parts(buf, len)`. In Phase 1 kernel and
/// user share a flat address space so the pointer is directly valid.
///
/// HINT: Do NOT print extra framing (like `[user] `) — the user program
/// builds the exact bytes it wants on screen.
pub fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize {
    // TODO: Implement
    // Step 1: assert / match fd == FD_STDOUT (else panic)
    // Step 2: build slice from (buf, len)
    // Step 3: for each byte, console_putchar(byte as usize)
    // Step 4: return len as isize
    let _ = (fd, buf, len, console_putchar, FD_STDOUT);
    unimplemented!("TODO: implement sys_write")
}
