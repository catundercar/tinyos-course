//! Lab 1 tests — host-side, using a file-backed BlockDevice.
//! The real virtio_blk driver runs in QEMU; here we smoke-test the
//! BlockDevice trait contract via easy-fs's test helpers.

use easy_fs::BlockDevice;
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::{Arc, Mutex};

const BLOCK_SZ: usize = 512;

struct FileBlock(Mutex<File>);

impl BlockDevice for FileBlock {
    fn read_block(&self, id: usize, buf: &mut [u8]) {
        let mut f = self.0.lock().unwrap();
        f.seek(SeekFrom::Start((id * BLOCK_SZ) as u64)).unwrap();
        f.read_exact(buf).unwrap();
    }
    fn write_block(&self, id: usize, buf: &[u8]) {
        let mut f = self.0.lock().unwrap();
        f.seek(SeekFrom::Start((id * BLOCK_SZ) as u64)).unwrap();
        f.write_all(buf).unwrap();
    }
}

fn tmp() -> Arc<FileBlock> {
    let path = std::env::temp_dir().join(format!("efs-lab1-{}.img", std::process::id()));
    let f = OpenOptions::new().read(true).write(true).create(true).truncate(true).open(&path).unwrap();
    f.set_len((16 * BLOCK_SZ) as u64).unwrap();
    Arc::new(FileBlock(Mutex::new(f)))
}

#[test]
fn test_round_trip() {
    let dev = tmp();
    let mut w = [0u8; 512]; for (i, b) in w.iter_mut().enumerate() { *b = (i % 251) as u8; }
    dev.write_block(3, &w);
    let mut r = [0u8; 512];
    dev.read_block(3, &mut r);
    assert_eq!(w, r);
}

#[test]
fn test_distinct_blocks_isolated() {
    let dev = tmp();
    let a = [0xAAu8; 512]; let b = [0x55u8; 512];
    dev.write_block(1, &a); dev.write_block(2, &b);
    let mut r = [0u8; 512];
    dev.read_block(1, &mut r); assert_eq!(r, a);
    dev.read_block(2, &mut r); assert_eq!(r, b);
}
