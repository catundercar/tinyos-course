//! High-level `Inode` handle: operates on a `DiskInode` inside a block cache.
//!
//! STUDENT: implement `find`, `create`, `ls`, `read_at`, `write_at`, `clear`.

use super::block_cache::{block_cache_sync_all, get_block_cache};
use super::block_dev::BlockDevice;
use super::efs::EasyFileSystem;
use super::layout::{DirEntry, DiskInode, DiskInodeType, DIRENT_SZ};
use alloc::string::String;
use alloc::sync::Arc;
use alloc::vec::Vec;
use spin::{Mutex, MutexGuard};

pub struct Inode {
    block_id: u32,
    block_offset: usize,
    fs: Arc<Mutex<EasyFileSystem>>,
    block_device: Arc<dyn BlockDevice>,
}

impl Inode {
    pub fn new(
        block_id: u32,
        block_offset: usize,
        fs: Arc<Mutex<EasyFileSystem>>,
        block_device: Arc<dyn BlockDevice>,
    ) -> Self {
        Self { block_id, block_offset, fs, block_device }
    }

    fn read_disk_inode<V>(&self, f: impl FnOnce(&DiskInode) -> V) -> V {
        get_block_cache(self.block_id as usize, Arc::clone(&self.block_device))
            .lock()
            .read(self.block_offset, f)
    }

    fn modify_disk_inode<V>(&self, f: impl FnOnce(&mut DiskInode) -> V) -> V {
        get_block_cache(self.block_id as usize, Arc::clone(&self.block_device))
            .lock()
            .modify(self.block_offset, f)
    }

    /// Grow backing blocks until `new_size` bytes can be written.
    fn increase_size(
        &self,
        new_size: u32,
        disk_inode: &mut DiskInode,
        fs: &mut MutexGuard<EasyFileSystem>,
    ) {
        if new_size <= disk_inode.size { return; }
        let blocks_needed = disk_inode.blocks_num_needed(new_size);
        let mut v: Vec<u32> = Vec::new();
        for _ in 0..blocks_needed { v.push(fs.alloc_data()); }
        disk_inode.increase_size(new_size, v, &self.block_device);
    }

    /// Search current directory for `name`.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. self must be a directory.
    /// 2. Number of DirEntry = size / DIRENT_SZ.
    /// 3. Read each DirEntry; if name matches, return a new Inode for it.
    ///
    /// HINT: use read_disk_inode + DiskInode::read_at into a DirEntry buffer.
    pub fn find(&self, name: &str) -> Option<Arc<Inode>> {
        let fs = self.fs.lock();
        self.read_disk_inode(|disk_inode| {
            // TODO: Implement
            let _ = (disk_inode, name, &fs);
            None
        })
    }

    /// Create a regular file named `name` under this directory. Returns the
    /// new inode or None if already exists.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. Fail if name already exists (reuse find-like logic).
    /// 2. fs.alloc_inode() to get a new inode id.
    /// 3. Initialize its DiskInode (File).
    /// 4. Append a DirEntry to self (grow size via self.increase_size).
    /// 5. Return the new Inode.
    pub fn create(&self, name: &str) -> Option<Arc<Inode>> {
        // TODO: Implement
        let _ = name;
        None
    }

    /// Return list of entry names in this directory.
    ///
    /// TODO: Implement this method
    pub fn ls(&self) -> Vec<String> {
        let _fs = self.fs.lock();
        self.read_disk_inode(|_disk_inode| {
            // TODO: Implement — iterate DirEntries, push String::from(entry.name()).
            Vec::new()
        })
    }

    pub fn read_at(&self, offset: usize, buf: &mut [u8]) -> usize {
        let _fs = self.fs.lock();
        self.read_disk_inode(|disk_inode| disk_inode.read_at(offset, buf, &self.block_device))
    }

    /// Write `buf` at `offset`, growing the file if necessary.
    ///
    /// TODO: Implement this method
    pub fn write_at(&self, offset: usize, buf: &[u8]) -> usize {
        let mut fs = self.fs.lock();
        let res = self.modify_disk_inode(|disk_inode| {
            // TODO: grow then write
            self.increase_size((offset + buf.len()) as u32, disk_inode, &mut fs);
            disk_inode.write_at(offset, buf, &self.block_device)
        });
        block_cache_sync_all();
        res
    }

    /// Truncate file to zero bytes; free all data blocks.
    ///
    /// TODO: Implement this method
    pub fn clear(&self) {
        let mut fs = self.fs.lock();
        self.modify_disk_inode(|disk_inode| {
            let freed = disk_inode.clear_size(&self.block_device);
            for b in freed { fs.dealloc_data(b); }
        });
        block_cache_sync_all();
    }

    pub fn size(&self) -> u32 { self.read_disk_inode(|d| d.size) }
    pub fn is_dir(&self) -> bool { self.read_disk_inode(|d| d.is_dir()) }
}

// Silence unused warnings for helpers students may or may not need.
#[allow(dead_code)]
fn _use_dirent() { let _ = DirEntry::empty(); let _ = DIRENT_SZ; let _ = DiskInodeType::File; }
