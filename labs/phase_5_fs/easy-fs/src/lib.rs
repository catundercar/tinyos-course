//! easy-fs: a minimal Unix-like file system.
//!
//! On-disk layout (each region is a sequence of 512-byte blocks):
//!   | SuperBlock (1) | InodeBitmap | DataBitmap | Inodes | DataBlocks |
//!
//! This crate is `no_std`-compatible when used from the kernel, and
//! also builds under `std` for the host-side `easy-fs-fuse` tool.

#![cfg_attr(not(test), no_std)]

extern crate alloc;

pub mod block_cache;
pub mod block_dev;
pub mod bitmap;
pub mod efs;
pub mod layout;
pub mod vfs;

pub const BLOCK_SZ: usize = 512;

pub use block_cache::{block_cache_sync_all, get_block_cache};
pub use block_dev::BlockDevice;
pub use efs::EasyFileSystem;
pub use layout::{DiskInode, DiskInodeType, SuperBlock, DirEntry, DIRENT_SZ};
pub use vfs::Inode;
