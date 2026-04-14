//! Block-sized bitmap. Used for both inode and data block allocation.
//!
//! One bitmap block = 512 bytes = 4096 bits. A `Bitmap` can span
//! multiple blocks (`blocks` field).
//!
//! STUDENT: implement `alloc` and `dealloc`.

use super::block_cache::get_block_cache;
use super::block_dev::BlockDevice;
use super::BLOCK_SZ;
use alloc::sync::Arc;

const BLOCK_BITS: usize = BLOCK_SZ * 8; // 4096

/// A bitmap block is 64 u64s = 4096 bits.
type BitmapBlock = [u64; 64];

pub struct Bitmap {
    start_block_id: usize,
    blocks: usize,
}

impl Bitmap {
    pub fn new(start_block_id: usize, blocks: usize) -> Self {
        Self { start_block_id, blocks }
    }

    /// Total number of bits this bitmap manages.
    pub fn maximum(&self) -> usize { self.blocks * BLOCK_BITS }

    /// Allocate the first free bit. Returns the bit position (a.k.a. the
    /// inode / data-block index into the parent region), or `None`.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Iterate over each bitmap block (0..self.blocks).
    /// 2. Inside each block, find the first u64 that is != !0 (not all-ones).
    /// 3. Use `trailing_ones()` on that u64 to locate the first 0 bit.
    /// 4. Set that bit to 1, return block_idx * BLOCK_BITS + u64_idx * 64 + bit.
    /// 5. Return None if no free bit.
    ///
    /// HINT: use get_block_cache(start_block_id + block_idx, dev).lock().modify(0, |bb: &mut BitmapBlock| ...)
    pub fn alloc(&self, block_device: &Arc<dyn BlockDevice>) -> Option<usize> {
        // TODO: Implement
        // Step 1: for block_idx in 0..self.blocks
        // Step 2:   load the bitmap block as &mut BitmapBlock
        // Step 3:   find (u64_idx, bits64) with bits64 != !0
        // Step 4:   let inner = bits64.trailing_ones() as usize
        // Step 5:   *bits64 |= 1u64 << inner; return Some(...)
        let _ = block_device;
        None
    }

    /// Deallocate a previously-allocated bit. Panics if the bit was already 0.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Decompose `bit` into (block_idx, u64_idx, inner_bit).
    /// 2. Clear the corresponding bit; assert it was set.
    ///
    /// HINT: block_idx = bit / BLOCK_BITS; remainder goes into u64_idx and inner.
    pub fn dealloc(&self, block_device: &Arc<dyn BlockDevice>, bit: usize) {
        // TODO: Implement
        let _ = (block_device, bit);
        unimplemented!("TODO: implement Bitmap::dealloc")
    }
}

fn decomposition(mut bit: usize) -> (usize, usize, usize) {
    let block_pos = bit / BLOCK_BITS;
    bit %= BLOCK_BITS;
    (block_pos, bit / 64, bit % 64)
}

#[allow(dead_code)]
fn _use_decomposition() { let _ = decomposition(0); }
