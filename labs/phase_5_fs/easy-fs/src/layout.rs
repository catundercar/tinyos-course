//! On-disk structures. All `#[repr(C)]` and fixed-size so they can be
//! reinterpreted directly from a 512-byte block cache.
//!
//! Layout:
//!   block 0               : SuperBlock
//!   InodeBitmap region
//!   DataBitmap region
//!   Inodes region         : (BLOCK_SZ / 128) = 4 DiskInode per block
//!   DataBlocks region
//!
//! STUDENT: implement `DiskInode::get_block_id`, `read_at`, `write_at`,
//! `increase_size`, `clear_size`.

use super::block_cache::get_block_cache;
use super::block_dev::BlockDevice;
use super::BLOCK_SZ;
use alloc::sync::Arc;
use alloc::vec::Vec;
use core::fmt::{Debug, Formatter, Result as FmtResult};

pub const EFS_MAGIC: u32 = 0x3b800001;
pub const NAME_LENGTH_LIMIT: usize = 27;
pub const INODE_DIRECT_COUNT: usize = 28;
pub const INODE_INDIRECT1_COUNT: usize = BLOCK_SZ / 4; // 128
pub const INODE_INDIRECT2_COUNT: usize = INODE_INDIRECT1_COUNT * INODE_INDIRECT1_COUNT;
pub const DIRECT_BOUND: usize = INODE_DIRECT_COUNT;
pub const INDIRECT1_BOUND: usize = DIRECT_BOUND + INODE_INDIRECT1_COUNT;
#[allow(dead_code)]
pub const INDIRECT2_BOUND: usize = INDIRECT1_BOUND + INODE_INDIRECT2_COUNT;

pub const DIRENT_SZ: usize = 32;

type IndirectBlock = [u32; BLOCK_SZ / 4];
type DataBlock = [u8; BLOCK_SZ];

#[repr(C)]
pub struct SuperBlock {
    magic: u32,
    pub total_blocks: u32,
    pub inode_bitmap_blocks: u32,
    pub inode_area_blocks: u32,
    pub data_bitmap_blocks: u32,
    pub data_area_blocks: u32,
}

impl Debug for SuperBlock {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        f.debug_struct("SuperBlock")
            .field("total_blocks", &self.total_blocks)
            .field("inode_bitmap_blocks", &self.inode_bitmap_blocks)
            .field("inode_area_blocks", &self.inode_area_blocks)
            .field("data_bitmap_blocks", &self.data_bitmap_blocks)
            .field("data_area_blocks", &self.data_area_blocks)
            .finish()
    }
}

impl SuperBlock {
    pub fn initialize(
        &mut self,
        total_blocks: u32,
        inode_bitmap_blocks: u32,
        inode_area_blocks: u32,
        data_bitmap_blocks: u32,
        data_area_blocks: u32,
    ) {
        *self = Self {
            magic: EFS_MAGIC,
            total_blocks,
            inode_bitmap_blocks,
            inode_area_blocks,
            data_bitmap_blocks,
            data_area_blocks,
        };
    }
    pub fn is_valid(&self) -> bool { self.magic == EFS_MAGIC }
}

#[derive(PartialEq, Eq, Clone, Copy, Debug)]
#[repr(u32)]
pub enum DiskInodeType {
    File = 0,
    Directory = 1,
}

/// 128 bytes per DiskInode -> 4 per 512B block.
#[repr(C)]
pub struct DiskInode {
    pub size: u32,
    pub direct: [u32; INODE_DIRECT_COUNT],
    pub indirect1: u32,
    pub indirect2: u32,
    type_: DiskInodeType,
}

impl DiskInode {
    pub fn initialize(&mut self, type_: DiskInodeType) {
        self.size = 0;
        self.direct.fill(0);
        self.indirect1 = 0;
        self.indirect2 = 0;
        self.type_ = type_;
    }
    pub fn is_dir(&self) -> bool { self.type_ == DiskInodeType::Directory }
    pub fn is_file(&self) -> bool { self.type_ == DiskInodeType::File }

    /// Return how many 512-byte data blocks `size` bytes need.
    pub fn data_blocks(&self) -> u32 { Self::_data_blocks(self.size) }
    fn _data_blocks(size: u32) -> u32 {
        (size + BLOCK_SZ as u32 - 1) / BLOCK_SZ as u32
    }

    /// Total number of disk blocks (data + indirect metadata) needed for `size`.
    pub fn total_blocks(size: u32) -> u32 {
        let data_blocks = Self::_data_blocks(size) as usize;
        let mut total = data_blocks;
        if data_blocks > INODE_DIRECT_COUNT { total += 1; }
        if data_blocks > INDIRECT1_BOUND {
            total += 1;
            total += (data_blocks - INDIRECT1_BOUND + INODE_INDIRECT1_COUNT - 1)
                / INODE_INDIRECT1_COUNT;
        }
        total as u32
    }

    pub fn blocks_num_needed(&self, new_size: u32) -> u32 {
        assert!(new_size >= self.size);
        Self::total_blocks(new_size) - Self::total_blocks(self.size)
    }

    /// Translate an inner-block index (0..data_blocks) into the physical
    /// block id on disk.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. If inner_id < INODE_DIRECT_COUNT, return self.direct[inner_id].
    /// 2. If inner_id < INDIRECT1_BOUND, look up inside self.indirect1.
    /// 3. Otherwise walk two levels via self.indirect2.
    ///
    /// HINT: load indirect blocks via `get_block_cache(x, dev).lock().read(0, |b: &IndirectBlock| ...)`
    pub fn get_block_id(&self, inner_id: u32, block_device: &Arc<dyn BlockDevice>) -> u32 {
        // TODO: Implement
        let _ = (inner_id, block_device);
        0
    }

    /// Grow the inode to `new_size`, consuming blocks from `new_blocks`
    /// (length must equal `self.blocks_num_needed(new_size)`).
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Fill direct slots first.
    /// 2. Allocate indirect1 block if crossing DIRECT_BOUND; write entries.
    /// 3. Allocate indirect2 + its leaves if crossing INDIRECT1_BOUND.
    /// 4. Update self.size = new_size at the end.
    ///
    /// HINT: iterate `new_blocks.into_iter()` and consume one id at a time.
    pub fn increase_size(
        &mut self,
        new_size: u32,
        new_blocks: Vec<u32>,
        block_device: &Arc<dyn BlockDevice>,
    ) {
        // TODO: Implement
        let _ = (new_size, new_blocks, block_device);
        unimplemented!("TODO: implement DiskInode::increase_size");
    }

    /// Free all data + indirect blocks, return them so the caller can
    /// feed them back to the data bitmap. Sets size to 0.
    ///
    /// TODO: Implement this method
    pub fn clear_size(&mut self, block_device: &Arc<dyn BlockDevice>) -> Vec<u32> {
        // TODO: Implement — gather all block ids (direct + indirect1 leaves +
        // indirect2 + its inner leaves), reset state, return them.
        let _ = block_device;
        Vec::new()
    }

    /// Read bytes starting at `offset` into `buf`. Returns bytes read
    /// (may be short at EOF).
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Clamp end = min(offset + buf.len(), self.size).
    /// 2. Walk block by block via get_block_id; copy the relevant slice.
    ///
    /// HINT: use get_block_cache(...).lock().read(0, |data: &DataBlock| ...)
    pub fn read_at(
        &self,
        offset: usize,
        buf: &mut [u8],
        block_device: &Arc<dyn BlockDevice>,
    ) -> usize {
        // TODO: Implement
        let _ = (offset, buf, block_device);
        0
    }

    /// Write bytes to an already-sized inode. The caller is responsible
    /// for calling `increase_size` first if needed.
    ///
    /// TODO: Implement this method
    pub fn write_at(
        &mut self,
        offset: usize,
        buf: &[u8],
        block_device: &Arc<dyn BlockDevice>,
    ) -> usize {
        // TODO: Implement
        let _ = (offset, buf, block_device);
        0
    }
}

/// 32-byte directory entry. `ls` iterates these.
#[repr(C)]
pub struct DirEntry {
    name: [u8; NAME_LENGTH_LIMIT + 1], // 28 bytes, NUL-terminated
    inode_number: u32,
}

impl DirEntry {
    pub fn empty() -> Self {
        Self { name: [0; NAME_LENGTH_LIMIT + 1], inode_number: 0 }
    }

    pub fn new(name: &str, inode_number: u32) -> Self {
        let mut bytes = [0u8; NAME_LENGTH_LIMIT + 1];
        let n = core::cmp::min(name.len(), NAME_LENGTH_LIMIT);
        bytes[..n].copy_from_slice(&name.as_bytes()[..n]);
        Self { name: bytes, inode_number }
    }

    pub fn as_bytes(&self) -> &[u8] {
        unsafe {
            core::slice::from_raw_parts(self as *const _ as *const u8, DIRENT_SZ)
        }
    }

    pub fn as_bytes_mut(&mut self) -> &mut [u8] {
        unsafe {
            core::slice::from_raw_parts_mut(self as *mut _ as *mut u8, DIRENT_SZ)
        }
    }

    pub fn name(&self) -> &str {
        let len = self.name.iter().position(|&b| b == 0).unwrap_or(NAME_LENGTH_LIMIT);
        core::str::from_utf8(&self.name[..len]).unwrap_or("")
    }

    pub fn inode_number(&self) -> u32 { self.inode_number }
}

// Silence dead-code warnings for helpers used only from student code.
#[allow(dead_code)]
fn _use_types() {
    let _: Option<IndirectBlock> = None;
    let _: Option<DataBlock> = None;
}
