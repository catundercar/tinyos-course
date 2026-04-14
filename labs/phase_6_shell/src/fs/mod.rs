//! FS facade. Re-exports and the `File` trait both the pipe and stdio implement.
//! PROVIDED.
use crate::mm::UserBuffer;

pub mod inode;
pub mod pipe;
pub mod stdio;

pub use inode::{list_apps, open_file as open_file_real, OSInode};
pub use pipe::{make_pipe, Pipe, PipeRingBuffer};
pub use stdio::{Stdin, Stdout};

pub trait File: Send + Sync {
    fn readable(&self) -> bool;
    fn writable(&self) -> bool;
    fn read(&self, buf: UserBuffer) -> usize;
    fn write(&self, buf: UserBuffer) -> usize;
}

bitflags::bitflags! {
    pub struct OpenFlags: u32 {
        const RDONLY = 0;
        const WRONLY = 1 << 0;
        const RDWR   = 1 << 1;
        const CREATE = 1 << 9;
        const TRUNC  = 1 << 10;
    }
}

/// Thin wrapper on top of the Phase 5 easy-fs. PROVIDED.
///
/// The real implementation lives in `inode.rs` (exported as `open_file_real`).
/// This top-level function allows tests to stub-out the FS layer.
pub fn open_file(path: &str, flags: OpenFlags) -> Option<alloc::sync::Arc<dyn File + Send + Sync>> {
    open_file_real(path, flags)
}
