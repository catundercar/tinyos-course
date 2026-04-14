//! Driver roots. PROVIDED (baseline from Phase 5).
//!
//! ⚠️ BEFORE YOU START PHASE 6: `virtio_blk.rs` is the same TODO scaffold
//! from Phase 5 — paste your completed Phase 5 implementation over it.
//! Phase 6's sh/ls/cat/fs demos all need a functioning block device.
pub mod virtio_blk;

use alloc::sync::Arc;
use easy_fs::BlockDevice;
use lazy_static::lazy_static;

lazy_static! {
    pub static ref BLOCK_DEVICE: Arc<dyn BlockDevice> = Arc::new(virtio_blk::VirtIOBlock::new());
}

pub fn init() {
    let _ = BLOCK_DEVICE.clone();
    crate::println!("[kernel] virtio-blk ready");
}
