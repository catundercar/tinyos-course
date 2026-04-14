//! Lab 2 tests — bitmap, DiskInode pointer tree, Inode CRUD, ls.

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

fn make_fs(blocks: u32) -> (Arc<dyn BlockDevice>, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("efs-lab2-{}.img", rand::random::<u32>()));
    let f = OpenOptions::new().read(true).write(true).create(true).truncate(true).open(&path).unwrap();
    f.set_len((blocks as u64) * 512).unwrap();
    let dev: Arc<dyn BlockDevice> = Arc::new(FileBlock(Mutex::new(f)));
    (dev, path)
}

#[test]
fn test_create_and_find() {
    let (dev, _) = make_fs(4096);
    let efs = EasyFileSystem::create(dev.clone(), 4096, 1);
    let root = EasyFileSystem::root_inode(&efs);
    assert!(root.create("hello").is_some(), "create hello");
    assert!(root.find("hello").is_some(), "find hello");
    assert!(root.find("missing").is_none(), "missing not found");
}

#[test]
fn test_ls_lists_created_files() {
    let (dev, _) = make_fs(4096);
    let efs = EasyFileSystem::create(dev.clone(), 4096, 1);
    let root = EasyFileSystem::root_inode(&efs);
    root.create("a").unwrap();
    root.create("b").unwrap();
    let names = root.ls();
    assert!(names.contains(&"a".to_string()));
    assert!(names.contains(&"b".to_string()));
}

#[test]
fn test_write_then_read_back() {
    let (dev, _) = make_fs(4096);
    let efs = EasyFileSystem::create(dev.clone(), 4096, 1);
    let root = EasyFileSystem::root_inode(&efs);
    let f = root.create("f").unwrap();
    let payload = b"easy-fs rocks!";
    assert_eq!(f.write_at(0, payload), payload.len());
    let mut buf = vec![0u8; payload.len()];
    assert_eq!(f.read_at(0, &mut buf), payload.len());
    assert_eq!(&buf, payload);
}

#[test]
fn test_large_file_crosses_indirect() {
    let (dev, _) = make_fs(8192);
    let efs = EasyFileSystem::create(dev.clone(), 8192, 1);
    let root = EasyFileSystem::root_inode(&efs);
    let f = root.create("big").unwrap();
    // 40 blocks > 28 direct threshold → exercises indirect1.
    let data = vec![0x5au8; 40 * 512];
    assert_eq!(f.write_at(0, &data), data.len());
    let mut buf = vec![0u8; data.len()];
    assert_eq!(f.read_at(0, &mut buf), data.len());
    assert_eq!(buf, data);
}
