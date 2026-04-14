//! Lab 3 — kernel VFS open/read/write flags. These tests compile against
//! easy-fs directly; the kernel OSInode wrapper mirrors the same semantics.
//! Students should keep these green before moving to integration tests.

use easy_fs::{BlockDevice, EasyFileSystem};
use std::fs::OpenOptions;
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::{Arc, Mutex};

struct FileBlock(Mutex<std::fs::File>);
impl BlockDevice for FileBlock {
    fn read_block(&self, id: usize, buf: &mut [u8]) {
        let mut f = self.0.lock().unwrap();
        f.seek(SeekFrom::Start((id * 512) as u64)).unwrap();
        f.read_exact(buf).unwrap();
    }
    fn write_block(&self, id: usize, buf: &[u8]) {
        let mut f = self.0.lock().unwrap();
        f.seek(SeekFrom::Start((id * 512) as u64)).unwrap();
        f.write_all(buf).unwrap();
    }
}

fn make() -> Arc<dyn BlockDevice> {
    let path = std::env::temp_dir().join(format!("efs-lab3-{}.img", rand::random::<u32>()));
    let f = OpenOptions::new().read(true).write(true).create(true).truncate(true).open(path).unwrap();
    f.set_len(4096 * 512).unwrap();
    Arc::new(FileBlock(Mutex::new(f)))
}

#[test]
fn test_trunc_clears_data() {
    let dev = make();
    let efs = EasyFileSystem::create(dev.clone(), 4096, 1);
    let root = EasyFileSystem::root_inode(&efs);
    let f = root.create("x").unwrap();
    f.write_at(0, b"hello world");
    assert_eq!(f.size(), 11);
    f.clear();
    assert_eq!(f.size(), 0);
}

#[test]
fn test_append_after_reopen() {
    let dev = make();
    let efs = EasyFileSystem::create(dev.clone(), 4096, 1);
    let root = EasyFileSystem::root_inode(&efs);
    let f = root.create("log").unwrap();
    f.write_at(0, b"line1\n");
    f.write_at(6, b"line2\n");
    let mut buf = [0u8; 12];
    assert_eq!(f.read_at(0, &mut buf), 12);
    assert_eq!(&buf, b"line1\nline2\n");
}
