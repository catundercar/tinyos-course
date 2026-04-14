//! Lab 3 syscalls. `fd_table` lives on the task; here we use a process-wide
//! table as a teaching simplification.
//!
//! STUDENT: implement sys_open / sys_close / sys_read / sys_write.

use crate::fs::{open_file, File, FilePtr, OpenFlags, Stdin, Stdout};
use crate::mm::{translated_byte_buffer, translated_str};
use crate::sync::UPSafeCell;
use crate::task::current_user_token;
use alloc::sync::Arc;
use alloc::vec::Vec;
use lazy_static::lazy_static;

lazy_static! {
    static ref FD_TABLE: UPSafeCell<Vec<Option<FilePtr>>> = {
        let mut t: Vec<Option<FilePtr>> = Vec::new();
        t.push(Some(Arc::new(Stdin)));
        t.push(Some(Arc::new(Stdout)));
        t.push(Some(Arc::new(Stdout)));
        UPSafeCell::new(t)
    };
}

fn alloc_fd(table: &mut Vec<Option<FilePtr>>, file: FilePtr) -> usize {
    for (i, slot) in table.iter_mut().enumerate() {
        if slot.is_none() { *slot = Some(file); return i; }
    }
    table.push(Some(file));
    table.len() - 1
}

/// TODO: translate path, open_file, push into FD_TABLE, return fd.
pub fn sys_open(path: *const u8, flags: u32) -> isize {
    // TODO: Implement
    let token = current_user_token();
    let _name = translated_str(token, path);
    let _flags = OpenFlags::from_bits(flags).unwrap_or(OpenFlags::RDONLY);
    -1
}

/// TODO: set FD_TABLE[fd] = None; return 0 (or -1 if oob).
pub fn sys_close(fd: usize) -> isize {
    // TODO: Implement
    let _ = fd;
    -1
}

/// TODO: fetch file, verify readable, copy into user buffer via translated_byte_buffer.
pub fn sys_read(fd: usize, buf: *const u8, len: usize) -> isize {
    // TODO: Implement
    let token = current_user_token();
    let mut buffers = translated_byte_buffer(token, buf, len);
    let table = FD_TABLE.lock();
    if fd >= table.len() { return -1; }
    let file = match &table[fd] { Some(f) => f.clone(), None => return -1 };
    if !file.readable() { return -1; }
    drop(table);
    let mut total = 0;
    for b in buffers.iter_mut() {
        total += file.read(b);
    }
    total as isize
}

/// TODO: mirror sys_read but in the write direction.
pub fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize {
    let token = current_user_token();
    let buffers = translated_byte_buffer(token, buf, len);
    let table = FD_TABLE.lock();
    if fd >= table.len() { return -1; }
    let file = match &table[fd] { Some(f) => f.clone(), None => return -1 };
    if !file.writable() { return -1; }
    drop(table);
    let mut total = 0;
    for b in buffers.iter() { total += file.write(b); }
    total as isize
}

// Referenced to silence dead-code lint during early scaffolding.
#[allow(dead_code)]
fn _use_helpers() { let _ = alloc_fd; let _ = open_file; }
