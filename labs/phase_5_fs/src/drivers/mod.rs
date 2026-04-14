//! Driver roots. `BLOCK_DEVICE` is a process-wide Arc<dyn BlockDevice>.
pub mod virtio_blk;

use alloc::sync::Arc;
use easy_fs::BlockDevice;
use lazy_static::lazy_static;

lazy_static! {
    pub static ref BLOCK_DEVICE: Arc<dyn BlockDevice> = Arc::new(virtio_blk::VirtIOBlock::new());
}

pub fn init() {
    // Force evaluation of BLOCK_DEVICE so probes run at boot.
    let _ = BLOCK_DEVICE.clone();
    crate::println!("[kernel] virtio-blk ready");
}
