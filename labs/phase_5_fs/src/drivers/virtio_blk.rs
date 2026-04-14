//! Lab 1 ⭐⭐ — VirtIO block driver over MMIO at 0x1000_1000.
//!
//! We use the `virtio-drivers` crate to avoid hand-rolling queue setup,
//! but students still wire up the HAL and BlockDevice trait.
//!
//! STUDENT: implement `read_block` and `write_block` on `VirtIOBlock`.

use alloc::sync::Arc;
use easy_fs::BlockDevice;
use lazy_static::lazy_static;
use spin::Mutex;
use virtio_drivers::{
    device::blk::VirtIOBlk,
    transport::mmio::{MmioTransport, VirtIOHeader},
    BufferDirection, Hal, PhysAddr,
};

const VIRTIO0: usize = 0x1000_1000;

pub struct VirtIOBlock(Mutex<VirtIOBlk<VirtioHal, MmioTransport>>);

impl VirtIOBlock {
    pub fn new() -> Self {
        unsafe {
            let header = &mut *(VIRTIO0 as *mut VirtIOHeader);
            let transport = MmioTransport::new(header.into()).expect("virtio mmio probe");
            let blk = VirtIOBlk::<VirtioHal, _>::new(transport).expect("virtio-blk init");
            Self(Mutex::new(blk))
        }
    }
}

impl BlockDevice for VirtIOBlock {
    /// Read block `block_id` into `buf` via VirtIO.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Lock the inner VirtIOBlk.
    /// 2. Call `.read_blocks(block_id, buf)` (returns Result).
    /// 3. Panic on error with message "virtio read failed".
    ///
    /// HINT: buf.len() must equal 512.
    fn read_block(&self, block_id: usize, buf: &mut [u8]) {
        // TODO: Implement
        let _ = (block_id, buf);
        unimplemented!("TODO: implement VirtIOBlock::read_block")
    }

    /// Write `buf` to block `block_id`.
    ///
    /// TODO: Implement this method
    fn write_block(&self, block_id: usize, buf: &[u8]) {
        // TODO: Implement
        let _ = (block_id, buf);
        unimplemented!("TODO: implement VirtIOBlock::write_block")
    }
}

/// PROVIDED — HAL using identity-mapped DMA (Phase 5 assumes flat mapping).
pub struct VirtioHal;

lazy_static! {
    static ref DMA_BASE: Mutex<usize> = Mutex::new(0x8400_0000);
}

unsafe impl Hal for VirtioHal {
    fn dma_alloc(pages: usize, _dir: BufferDirection) -> (PhysAddr, core::ptr::NonNull<u8>) {
        let mut base = DMA_BASE.lock();
        let pa = *base;
        *base += pages * 4096;
        let ptr = core::ptr::NonNull::new(pa as *mut u8).unwrap();
        unsafe { core::ptr::write_bytes(ptr.as_ptr(), 0, pages * 4096); }
        (pa, ptr)
    }
    unsafe fn dma_dealloc(_pa: PhysAddr, _vaddr: core::ptr::NonNull<u8>, _pages: usize) -> i32 { 0 }
    unsafe fn mmio_phys_to_virt(pa: PhysAddr, _size: usize) -> core::ptr::NonNull<u8> {
        core::ptr::NonNull::new(pa as *mut u8).unwrap()
    }
    unsafe fn share(buf: core::ptr::NonNull<[u8]>, _dir: BufferDirection) -> PhysAddr {
        buf.as_ptr() as *mut u8 as usize
    }
    unsafe fn unshare(_pa: PhysAddr, _buf: core::ptr::NonNull<[u8]>, _dir: BufferDirection) {}
}

// Exports for test scaffolding.
pub fn block_device() -> Arc<dyn BlockDevice> { Arc::new(VirtIOBlock::new()) }
