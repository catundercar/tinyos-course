# Phase 5 — File System (easy-fs)

> Build a simplified Unix-style filesystem on top of a VirtIO block device,
> then wire it into the kernel as a VFS.

## Labs

| Lab | Difficulty | Target | What you implement |
|-----|-----------|--------|--------------------|
| **Lab 1** | ⭐⭐ | `src/drivers/virtio_blk.rs` | `BlockDevice::read_block` / `write_block` over VirtIO MMIO (0x1000_1000) |
| **Lab 2** | ⭐⭐⭐ | `easy-fs/` crate | `BlockCache` LRU, `Bitmap` alloc/dealloc, `DiskInode` direct/indirect/double-indirect, `Inode` find / create / ls / read_at / write_at |
| **Lab 3** | ⭐⭐ | `src/fs/inode.rs` + `src/syscall/fs.rs` | `OSInode` cursor, `OpenFlags`, `open_file`, `sys_open/close/read/write` |

## Directory Layout

```
phase_5_fs/
├── Cargo.toml              workspace root (kernel + easy-fs + fuse)
├── linker.ld               kernel linker script
├── Makefile                build / fs-img / run / grade
├── easy-fs/                no_std crate (PROVIDED scaffold, student TODOs)
│   └── src/{block_cache,bitmap,layout,vfs,efs,block_dev,lib}.rs
├── easy-fs-fuse/           host tool: mkfs + pack /bin apps into fs.img
├── src/                    kernel
│   ├── drivers/virtio_blk.rs   Lab 1
│   ├── fs/{mod,inode,pipe}.rs  Lab 3
│   └── syscall/fs.rs            Lab 3
├── user/src/bin/           test_fs.rs, bench.rs
├── tests/                  shortcuts pointing to easy-fs/tests/
└── scripts/grade.py
```

## Quick Start

```bash
# Build kernel + fs image
make build
make fs-img

# Run in QEMU
make run

# Host-side tests (Labs 1/2/3 contracts)
make test

# Full auto-grade
make grade
```

## What to Read First

1. `COURSE.zh-CN.md` / `COURSE.en.md` — theory, diagrams, lab guides.
2. `easy-fs/src/block_dev.rs` — the single trait everything depends on.
3. `easy-fs/src/layout.rs` — on-disk structs (exact memory layout matters!).
4. `tests/test_lab2_easyfs.rs` — behavior spec for Lab 2.

## Grading Output

```
===============================================
  Phase 5 - File System Grading Report
===============================================

  Lab 1: VirtIOBlock driver
  [####################] 100%  (2/2 tests)

  Lab 2: easy-fs layout + vfs
  [##############------]  70%  (3/4 tests)

  Lab 3: kernel VFS & OSInode
  [####################] 100%  (2/2 tests)

-----------------------------------------------
  Overall: 7/8 tests passed (87%)
```

## Reference

- xv6 book, Chapter 8 (File system)
- OSTEP Chapters 39–40
- rCore tutorial §6 — https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/
- VirtIO 1.1 spec — https://docs.oasis-open.org/virtio/virtio/v1.1/virtio-v1.1.pdf
