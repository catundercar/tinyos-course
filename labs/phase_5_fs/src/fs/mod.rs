//! Kernel-side VFS. `File` trait, plus Stdin/Stdout, plus OSInode.
pub mod inode;
pub mod pipe;

use alloc::sync::Arc;

/// A generic file object. Readable/writable may both be false (e.g. closed).
pub trait File: Send + Sync {
    fn readable(&self) -> bool;
    fn writable(&self) -> bool;
    fn read(&self, buf: &mut [u8]) -> usize;
    fn write(&self, buf: &[u8]) -> usize;
}

pub struct Stdin;
pub struct Stdout;

impl File for Stdin {
    fn readable(&self) -> bool { true }
    fn writable(&self) -> bool { false }
    fn read(&self, buf: &mut [u8]) -> usize {
        // Phase 5: single-byte blocking read is fine.
        if buf.is_empty() { return 0; }
        buf[0] = b'\n';
        1
    }
    fn write(&self, _buf: &[u8]) -> usize { panic!("Stdin not writable") }
}

impl File for Stdout {
    fn readable(&self) -> bool { false }
    fn writable(&self) -> bool { true }
    fn read(&self, _buf: &mut [u8]) -> usize { panic!("Stdout not readable") }
    fn write(&self, buf: &[u8]) -> usize {
        let s = core::str::from_utf8(buf).unwrap_or("?");
        crate::print!("{}", s);
        buf.len()
    }
}

pub use inode::{list_apps, open_file, OSInode, OpenFlags};

pub type FilePtr = Arc<dyn File>;
