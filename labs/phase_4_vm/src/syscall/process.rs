//! Phase 4 process-related syscalls — student work.
//!
//! These are the demo endpoints exercised by `user/src/bin/mmap_demo.rs`.
//! Both operate on the _current_ task's MemorySet.

/// Allocate `len` bytes of anonymous virtual memory at VA `start`, with
/// permissions encoded in `port` (bit 0 = R, bit 1 = W, bit 2 = X).
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. `start` and `len` must be page-aligned; otherwise return -1.
/// 2. `port & !0x7 != 0` or `port & 0x7 == 0` → return -1 (invalid perm).
/// 3. For every VPN in `[start, start+len)`, error out if already mapped.
/// 4. Build a Framed MapArea with `MapPermission::U | (R/W/X from port)`,
///    push it into the current task's MemorySet, return 0.
///
/// HINT: In Phase 4 integration, fetch the current task via
///       `task::current_task()` and borrow its `memory_set`.
pub fn sys_mmap(start: usize, len: usize, port: u32) -> isize {
    // TODO: Implement
    let _ = (start, len, port);
    -1
}

/// Inverse of `sys_mmap`.
///
/// TODO: Implement this method
///
/// Requirements:
/// 1. `start` and `len` must be page-aligned; otherwise return -1.
/// 2. Every VPN in the range must be currently mapped; otherwise -1.
/// 3. Unmap each VPN, drop its frame, return 0.
pub fn sys_munmap(start: usize, len: usize) -> isize {
    // TODO: Implement
    let _ = (start, len);
    -1
}
