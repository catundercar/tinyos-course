//! Host-side tool that materializes an easy-fs image and packs user binaries.
//!
//! PROVIDED. Students do NOT modify.

use clap::Parser;
use easy_fs::{BlockDevice, EasyFileSystem};
use std::fs::{read_dir, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::{Arc, Mutex};

const BLOCK_SZ: usize = 512;

struct BlockFile(Mutex<File>);

impl BlockDevice for BlockFile {
    fn read_block(&self, block_id: usize, buf: &mut [u8]) {
        let mut f = self.0.lock().unwrap();
        f.seek(SeekFrom::Start((block_id * BLOCK_SZ) as u64)).unwrap();
        assert_eq!(f.read(buf).unwrap(), BLOCK_SZ);
    }
    fn write_block(&self, block_id: usize, buf: &[u8]) {
        let mut f = self.0.lock().unwrap();
        f.seek(SeekFrom::Start((block_id * BLOCK_SZ) as u64)).unwrap();
        assert_eq!(f.write(buf).unwrap(), BLOCK_SZ);
    }
}

#[derive(Parser, Debug)]
#[command(author, version, about)]
struct Args {
    /// Source directory containing user `.rs` files (treated as binary stubs).
    #[arg(short, long)]
    source: String,
    /// Target directory containing compiled user ELFs.
    #[arg(short, long)]
    target: String,
    /// Output image path.
    #[arg(short, long)]
    out: String,
}

fn main() -> std::io::Result<()> {
    let args = Args::parse();

    let block_file = Arc::new(BlockFile(Mutex::new({
        let f = OpenOptions::new()
            .read(true).write(true).create(true).truncate(true)
            .open(&args.out)?;
        f.set_len(16 * 2048 * 512 as u64).unwrap(); // 16 MiB
        f
    })));

    let efs = EasyFileSystem::create(block_file.clone(), 16 * 2048, 1);
    let root = Arc::new(EasyFileSystem::root_inode(&efs));

    let mut apps: Vec<String> = Vec::new();
    for entry in read_dir(&args.source)? {
        let name = entry?.file_name().into_string().unwrap();
        if let Some(stem) = name.strip_suffix(".rs") {
            apps.push(stem.to_string());
        }
    }

    for app in &apps {
        let path = format!("{}/{}", args.target.trim_end_matches('/'), app);
        let mut host = match File::open(&path) {
            Ok(f) => f,
            Err(_) => { eprintln!("skip missing: {}", path); continue; }
        };
        let mut data = Vec::new();
        host.read_to_end(&mut data)?;
        let inode = root.create(app).expect("create failed");
        inode.write_at(0, &data);
    }

    println!("fs image written to {} with {} apps", args.out, apps.len());
    Ok(())
}
