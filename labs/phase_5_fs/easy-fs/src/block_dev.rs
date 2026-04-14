//! Abstraction for any underlying block device (VirtIO, file-backed image, RAM).
//!
//! PROVIDED. Students do NOT modify.

use core::any::Any;

/// A block is always 512 bytes. Implementors must read/write an entire block.
pub trait BlockDevice: Send + Sync + Any {
    /// Read block `block_id` into `buf` (must be 512 bytes).
    fn read_block(&self, block_id: usize, buf: &mut [u8]);
    /// Write `buf` (must be 512 bytes) to block `block_id`.
    fn write_block(&self, block_id: usize, buf: &[u8]);
}
