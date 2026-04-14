//! Lab 3 ⭐⭐ — kernel VFS layer.
//!
//! Wraps `easy_fs::Inode` with a cursor + open flags, implements `File`.
//!
//! STUDENT: implement `OSInode::read` / `write` and `open_file`.

use super::File;
use crate::drivers::BLOCK_DEVICE;
use crate::sync::UPSafeCell;
use alloc::string::String;
use alloc::sync::Arc;
use alloc::vec::Vec;
use bitflags::bitflags;
use easy_fs::{EasyFileSystem, Inode};
use lazy_static::lazy_static;

bitflags! {
    pub struct OpenFlags: u32 {
        const RDONLY = 0;
        const WRONLY = 1 << 0;
        const RDWR   = 1 << 1;
        const CREATE = 1 << 9;
        const TRUNC  = 1 << 10;
    }
}

impl OpenFlags {
    pub fn read_write(&self) -> (bool, bool) {
        if self.is_empty() { (true, false) }
        else if self.contains(Self::WRONLY) { (false, true) }
        else { (true, true) }
    }
}

pub struct OSInode {
    readable: bool,
    writable: bool,
    inner: UPSafeCell<OSInodeInner>,
}

struct OSInodeInner {
    offset: usize,
    inode: Arc<Inode>,
}

impl OSInode {
    pub fn new(readable: bool, writable: bool, inode: Arc<Inode>) -> Self {
        Self {
            readable, writable,
            inner: UPSafeCell::new(OSInodeInner { offset: 0, inode }),
        }
    }

    pub fn read_all(&self) -> Vec<u8> {
        let mut inner = self.inner.lock();
        let mut buffer = [0u8; 512];
        let mut out = Vec::new();
        loop {
            let n = inner.inode.read_at(inner.offset, &mut buffer);
            if n == 0 { break; }
            inner.offset += n;
            out.extend_from_slice(&buffer[..n]);
        }
        out
    }
}

lazy_static! {
    pub static ref ROOT_INODE: Arc<Inode> = {
        let efs = EasyFileSystem::open(BLOCK_DEVICE.clone());
        Arc::new(EasyFileSystem::root_inode(&efs))
    };
}

pub fn list_apps() {
    crate::println!("/**** APPS ****");
    for name in ROOT_INODE.ls() {
        crate::println!("  {}", name);
    }
    crate::println!("**************/");
}

/// Open a file by absolute path. Honors CREATE/TRUNC flags.
///
/// TODO: Implement this function
///
/// Requirements:
/// 1. If CREATE is set:
///      - if file exists, truncate via inode.clear()
///      - else, ROOT_INODE.create(name)
/// 2. Else ROOT_INODE.find(name); return None if missing.
/// 3. If TRUNC is set (without CREATE) on existing file, clear it.
/// 4. Wrap resulting Inode in OSInode with readable/writable from flags.
///
/// HINT: flags.read_write() gives you (readable, writable).
pub fn open_file(name: &str, flags: OpenFlags) -> Option<Arc<OSInode>> {
    let (readable, writable) = flags.read_write();
    // TODO: Implement
    let _ = (name, readable, writable);
    None
}

impl File for OSInode {
    fn readable(&self) -> bool { self.readable }
    fn writable(&self) -> bool { self.writable }

    /// TODO: read from inode at cursor, advance cursor, return bytes read.
    fn read(&self, buf: &mut [u8]) -> usize {
        // TODO: Implement
        let _ = buf;
        0
    }

    /// TODO: write to inode at cursor, advance cursor.
    fn write(&self, buf: &[u8]) -> usize {
        // TODO: Implement
        let _ = buf;
        0
    }
}

#[allow(dead_code)]
fn _use_string() { let _: String = String::new(); }
