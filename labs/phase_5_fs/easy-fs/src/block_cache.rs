//! LRU block cache (capacity = 16 blocks).
//!
//! Every disk read/write goes through this cache. Without it a single
//! `read_at` could issue dozens of redundant VirtIO requests.
//!
//! STUDENT: implement `get_block_cache` and the LRU eviction inside
//! `BlockCacheManager::get_block_cache`.

use super::block_dev::BlockDevice;
use super::BLOCK_SZ;
use alloc::collections::VecDeque;
use alloc::sync::Arc;
use lazy_static::lazy_static;
use spin::Mutex;

const BLOCK_CACHE_SIZE: usize = 16;

pub struct BlockCache {
    cache: [u8; BLOCK_SZ],
    block_id: usize,
    block_device: Arc<dyn BlockDevice>,
    modified: bool,
}

impl BlockCache {
    /// Load a block from disk into an in-memory cache line.
    pub fn new(block_id: usize, block_device: Arc<dyn BlockDevice>) -> Self {
        let mut cache = [0u8; BLOCK_SZ];
        block_device.read_block(block_id, &mut cache);
        Self { cache, block_id, block_device, modified: false }
    }

    fn addr_of_offset(&self, offset: usize) -> usize {
        &self.cache[offset] as *const _ as usize
    }

    /// View the bytes starting at `offset` as `&T` (no copy).
    pub fn get_ref<T>(&self, offset: usize) -> &T
    where T: Sized {
        let type_size = core::mem::size_of::<T>();
        assert!(offset + type_size <= BLOCK_SZ);
        unsafe { &*(self.addr_of_offset(offset) as *const T) }
    }

    /// Mutable view; marks the block dirty.
    pub fn get_mut<T>(&mut self, offset: usize) -> &mut T
    where T: Sized {
        let type_size = core::mem::size_of::<T>();
        assert!(offset + type_size <= BLOCK_SZ);
        self.modified = true;
        unsafe { &mut *(self.addr_of_offset(offset) as *mut T) }
    }

    pub fn read<T, V>(&self, offset: usize, f: impl FnOnce(&T) -> V) -> V {
        f(self.get_ref(offset))
    }

    pub fn modify<T, V>(&mut self, offset: usize, f: impl FnOnce(&mut T) -> V) -> V {
        f(self.get_mut(offset))
    }

    /// Write back if dirty.
    pub fn sync(&mut self) {
        if self.modified {
            self.modified = false;
            self.block_device.write_block(self.block_id, &self.cache);
        }
    }
}

impl Drop for BlockCache {
    fn drop(&mut self) { self.sync(); }
}

pub struct BlockCacheManager {
    queue: VecDeque<(usize, Arc<Mutex<BlockCache>>)>,
}

impl BlockCacheManager {
    pub fn new() -> Self {
        Self { queue: VecDeque::new() }
    }

    /// Fetch a cache handle for `block_id`, loading from `block_device`
    /// if necessary. Evicts the least-recently-used entry when full.
    ///
    /// TODO: Implement this method
    ///
    /// Requirements:
    /// 1. If `block_id` already in queue, return its Arc<Mutex<BlockCache>>.
    /// 2. Otherwise, if queue is full (== BLOCK_CACHE_SIZE), evict the
    ///    first entry whose Arc has strong_count == 1 (nobody else holds it).
    ///    Panic if no such entry exists.
    /// 3. Create a new BlockCache, push to the back of the queue, return it.
    ///
    /// HINT: Arc::strong_count(&arc) tells you how many owners exist.
    /// HINT: We use a simple VecDeque — back = MRU, front = LRU candidate.
    pub fn get_block_cache(
        &mut self,
        block_id: usize,
        block_device: Arc<dyn BlockDevice>,
    ) -> Arc<Mutex<BlockCache>> {
        // TODO: Implement
        // Step 1: search self.queue for existing (block_id, cache)
        // Step 2: if full, find and remove one with strong_count == 1
        // Step 3: create new BlockCache, wrap in Arc<Mutex<_>>, push_back, return
        let _ = (block_id, block_device);
        unimplemented!("TODO: implement BlockCacheManager::get_block_cache")
    }
}

lazy_static! {
    pub static ref BLOCK_CACHE_MANAGER: Mutex<BlockCacheManager> =
        Mutex::new(BlockCacheManager::new());
}

/// Public entry used by bitmap/layout/vfs to fetch any block.
pub fn get_block_cache(
    block_id: usize,
    block_device: Arc<dyn BlockDevice>,
) -> Arc<Mutex<BlockCache>> {
    BLOCK_CACHE_MANAGER.lock().get_block_cache(block_id, block_device)
}

/// Flush every dirty cached block. Call before shutdown.
pub fn block_cache_sync_all() {
    let manager = BLOCK_CACHE_MANAGER.lock();
    for (_, cache) in manager.queue.iter() {
        cache.lock().sync();
    }
}
