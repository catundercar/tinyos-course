# Phase 5 — File System: From Memory to Disk

> **Vision:** by the end of this phase, running `ls`, `cat hello.txt`,
> and `echo hi > f` inside TinyOS will write to a real VirtIO disk,
> reboot safely, and read the data back.

---

## 5.0 Why the file system is the hardest subsystem

The first four phases lived entirely in RAM. Every structure — page tables,
task contexts, kernel heap — vanished when the CPU halted. Phase 5 changes
that: we introduce **durable storage** and suddenly the OS has to answer:

- Where on disk does file `f` live?
- How do we find free space in O(1)?
- How do we avoid 100 disk round-trips for a single `read`?
- What survives a crash mid-write?

The filesystem is typically the biggest single module in a hobby OS — xv6
dedicates a 45-page chapter to it. We simplify ruthlessly: no journaling,
no permissions, no symlinks. The result is **easy-fs**, ~500 lines you can
hold in your head.

```
╭───────────────── final vision ─────────────────╮
│  user > echo hello > greeting                  │
│  user > cat greeting                           │
│  hello                                         │
│  user > reboot && cat greeting                 │
│  hello   ← persisted on virtio-blk             │
╰────────────────────────────────────────────────╯
```

---

## 5.1 Block device abstraction

A *block device* speaks in fixed-size units (here: 512 bytes). Our
`BlockDevice` trait has exactly two methods:

```rust
fn read_block(&self, block_id: usize, buf: &mut [u8]);  // buf.len() == 512
fn write_block(&self, block_id: usize, buf: &[u8]);
```

Everything above — bitmaps, inodes, directories — is just a pattern of
block numbers that we interpret.

### VirtIO MMIO in one page

QEMU's `-device virtio-blk-device,bus=virtio-mmio-bus.0` exposes a device
at physical address **0x1000_1000**. The legacy MMIO register map:

```
offset  name                     purpose
0x000   MagicValue  (= 0x74726976, "virt")
0x004   Version     (1 = legacy)
0x008   DeviceID    (2 = block)
0x030   QueueSel
0x038   QueueNum
0x040   QueuePFN    ← descriptor ring physical addr
0x050   QueueNotify ← kick!
0x070   Status
```

A request is three descriptors chained together:

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ BlkReqHeader │ → │ data (512 B) │ → │ status (1 B) │
│ type|sector  │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
      ↑ writeable=false   ↑ direction depends    ↑ writeable=true
```

We don't rebuild all of this by hand — we use the `virtio-drivers` crate
and implement only the `Hal` trait (DMA alloc + address translation).

### Common mistakes

- **DMA coherency** — on real hardware you need `fence`s. On QEMU you don't,
  but real RISC-V boards will silently corrupt.
- **Request format** — putting status in the data descriptor instead of a
  separate one (spec violation).
- **Busy-waiting forever** — always bound the poll loop.

---

## Lab 1 ⭐⭐ — Implement VirtIOBlock

**File:** `src/drivers/virtio_blk.rs`

Goal: make `VirtIOBlock` satisfy `BlockDevice`.

```rust
impl BlockDevice for VirtIOBlock {
    fn read_block(&self, block_id: usize, buf: &mut [u8]) {
        self.0.lock().read_blocks(block_id, buf).expect("virtio read failed");
    }
    fn write_block(&self, block_id: usize, buf: &[u8]) {
        self.0.lock().write_blocks(block_id, buf).expect("virtio write failed");
    }
}
```

That's it — the crate hides queue management. The learning is *what it
does under the hood*, which we just covered. Run `cargo test --test
test_lab1_blkdev` to confirm the contract.

---

## 5.2 easy-fs disk layout

Five contiguous regions:

```
block #  0        1..                                               total-1
        ┌─────────┬──────────┬──────────┬──────────┬──────────────────────┐
        │ Super   │ Inode    │ Data     │ Inodes   │ Data Blocks          │
        │ Block   │ Bitmap   │ Bitmap   │ (packed  │ (one per file block) │
        │ (1 blk) │ (N blks) │ (M blks) │ 4/block) │                      │
        └─────────┴──────────┴──────────┴──────────┴──────────────────────┘
                  ↑              ↑           ↑            ↑
                  offsets & sizes stored in the SuperBlock
```

### Sizing example — 4 MiB disk

```
total_blocks        = 4 MiB / 512 B = 8192
inode_bitmap_blocks = 1          → 4096 inodes max
inode_area_blocks   = 4096/4 = 1024
data_bitmap_blocks  ≈ (8192 - 1 - 1 - 1024) / 4097 = 2
data_area_blocks    = 8192 - 1 - 1 - 1024 - 2 = 7164
```

That's enough to hold ~3.5 MiB of file data — plenty for a hobby OS.

---

## 5.3 Bitmap allocator

A bitmap block is 512 B × 8 = **4096 bits**. We treat each block as
`[u64; 64]` and use bit-manipulation tricks:

```
alloc():
  for each bitmap block:
    for each u64 in that block:
      if u64 != !0u64:            # at least one zero bit
        i = u64.trailing_ones()   # first zero bit, O(1)
        set bit i, return position
```

`trailing_ones()` is a single CPU instruction (`ctz` on inverted value).
Do **not** loop over 4096 bits — this is the hot path.

---

## 5.4 DiskInode — the pointer tree

A single inode is 128 bytes (so 4 fit in a block). Its block map:

```
          ┌─ direct[0..28] ──────────────►  28 × 512 B   = 14 KiB
          │
DiskInode ├─ indirect1  ────► [128 ptrs] ─► 128 × 512 B  = 64 KiB
          │
          └─ indirect2  ────► [128 ptrs] ──┬─► [128] → 64 KiB
                                           ├─► [128] → 64 KiB
                                           │    ...
                                           └─►                 = 8 MiB

Max file size ≈ 14 KiB + 64 KiB + 8 MiB ≈ 8.08 MiB
```

### Translating inner block index `n` → physical block id

```
if n < 28                         → direct[n]
elif n < 28 + 128                 → indirect1[n-28]
else                              → indirect2[(n-156)/128][(n-156)%128]
```

This is `DiskInode::get_block_id`. Every `read_at` / `write_at` uses it in
a loop. Get it right and the rest is just byte copying.

---

## 5.5 DirEntry — directories are files

A directory's *content* is just an array of 32-byte entries:

```
byte  0                          27 28        31
     ┌──────────────────────────────┬────────────┐
     │ name (NUL-padded, ≤27 chars) │ inode (u32)│
     └──────────────────────────────┴────────────┘
```

`ls` = read every DirEntry from the directory inode.
`find(name)` = linear scan; O(n) but n is small for course-sized FSes.

---

## Lab 2 ⭐⭐⭐ — easy-fs core

**Files:**

```
easy-fs/src/block_cache.rs   LRU cache
easy-fs/src/bitmap.rs        alloc/dealloc
easy-fs/src/layout.rs        DiskInode::{get_block_id, read_at, write_at, increase_size, clear_size}
easy-fs/src/vfs.rs           Inode::{find, create, ls, write_at, clear}
```

### Implementation order (recommended)

1. `BlockCacheManager::get_block_cache` — every other method calls it.
2. `Bitmap::alloc` / `dealloc`.
3. `DiskInode::get_block_id` — test by calling `read_at` on an empty file.
4. `DiskInode::read_at` + `write_at` — handle partial start/end blocks.
5. `DiskInode::increase_size` + `clear_size`.
6. `Inode::find` / `create` / `ls` / `write_at`.

### `read_at` sketch

```
let start = offset, end = min(offset + buf.len(), self.size);
let mut cur = start, mut out = 0;
while cur < end {
    let block = self.get_block_id(cur / 512, dev);
    let in_block_offset = cur % 512;
    let n = min(512 - in_block_offset, end - cur);
    get_block_cache(block, dev).lock().read(0, |d: &DataBlock| {
        buf[out..out+n].copy_from_slice(&d[in_block_offset..in_block_offset+n]);
    });
    cur += n; out += n;
}
out
```

---

## 5.6 BlockCache — the unsung hero

Without a cache, opening `/etc/passwd` in a real FS would trigger ~10 disk
reads (superblock, bitmap, inode block, directory block, …). With a
16-entry LRU cache, the same operation hits disk ~twice.

```
MRU → [b17][b02][b11][b99][...][b08] ← LRU (evict me when full)
```

**Eviction rule:** only evict entries whose `Arc::strong_count == 1`
(nobody else currently borrows the cache line). If the cache is full and
every line is borrowed, we **panic** — a signal that the cache is too
small for the workload. 16 is plenty for our labs.

**Write policy:** write-back. `sync()` flushes dirty lines on drop; the
kernel calls `block_cache_sync_all()` before power-off.

---

## Lab 3 ⭐⭐ — Kernel VFS

**Files:** `src/fs/inode.rs`, `src/syscall/fs.rs`.

The kernel `File` trait unifies stdin/stdout and disk files:

```rust
trait File: Send + Sync {
    fn readable(&self) -> bool;
    fn writable(&self) -> bool;
    fn read(&self, buf: &mut [u8]) -> usize;
    fn write(&self, buf: &[u8]) -> usize;
}
```

`OSInode` = easy-fs `Inode` + `Mutex<(cursor, inode)>` + flags.

### open_file pseudocode

```
let (r, w) = flags.read_write();
if CREATE in flags:
    if let Some(existing) = root.find(name):
        existing.clear();             // O_TRUNC semantics
        return OSInode(r, w, existing);
    else:
        return OSInode(r, w, root.create(name)?);
else:
    let inode = root.find(name)?;
    if TRUNC in flags: inode.clear();
    return OSInode(r, w, inode);
```

### The full call path

```
user: read(fd, buf, n)
  ↓  ecall
sys_read(fd, buf, n)
  ↓  FD_TABLE[fd].read(buf)
OSInode::read(buf)
  ↓  inode.read_at(offset, buf)
easy_fs::Inode::read_at
  ↓  disk_inode.read_at   (in DiskInode layout)
     loops: get_block_id → get_block_cache → copy_from_slice
                              ↓ (cache miss)
                         BlockDevice::read_block
                              ↓
                         VirtIOBlock.read_blocks
                              ↓
                         virtio MMIO → QEMU → host fs.img
```

---

## 5.7 Integration demo

```
$ make fs-img                   # runs easy-fs-fuse on host
fs image written to target/fs.img with 2 apps
$ make run
[kernel] phase 5 booting
[kernel] virtio-blk ready
/**** APPS ****
  test_fs
  bench
**************/
test_fs OK
```

Reboot, re-run — `hello.txt` is still there.

---

## 5.8 Review & Phase 6 preview

| Concept | You built | Key file |
|---------|-----------|----------|
| Block abstraction | `BlockDevice` trait + VirtIO impl | `drivers/virtio_blk.rs` |
| Space management | `Bitmap` alloc/dealloc | `easy-fs/bitmap.rs` |
| Pointer tree | `DiskInode` direct/indirect/2x | `easy-fs/layout.rs` |
| Namespace | `DirEntry` + `Inode::find/ls` | `easy-fs/vfs.rs` |
| Caching | 16-way LRU | `easy-fs/block_cache.rs` |
| OS integration | `File` trait + `OSInode` + syscalls | `fs/`, `syscall/fs.rs` |

### Phase 6 preview — Shell + pipe

With files working, we can finally ship a user-space shell. The one new
kernel primitive is **pipe**: an in-memory ring buffer that implements
`File`, enabling `ls | grep hello`.

### References

#### Required

- xv6 book, Ch. 8 *File system*
  — https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf
- OSTEP Ch. 39–40 *File System Implementation / FSCK & Journaling*
  — https://pages.cs.wisc.edu/~remzi/OSTEP/
- rCore tutorial §6 *File System*
  — https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter6/

#### Deep dive

- VirtIO 1.1 spec (authoritative for virtio-blk device registers,
  virtqueue layout, and the descriptor chain)
  — https://docs.oasis-open.org/virtio/virtio/v1.1/virtio-v1.1.pdf
- *A Fast File System for UNIX* (McKusick et al., 1984) — the
  cylinder-group / allocation-policy paper that easy-fs is a minimal
  subset of.
  — https://dsf.berkeley.edu/cs262/FFS.pdf
- Linux `fs/ext2/` source — industrial inode / dir_entry / bitmap
  code; compare against your `layout.rs` / `vfs.rs`.
  — https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/ext2

#### Stretch questions

- Why does `DiskInode` use a direct / single-indirect / double-indirect
  pointer tree instead of a balanced tree? (Hint: O(1) for small
  files, amortised cost for big ones. B-tree metadata overhead
  dominates on 4 KB files — ext4/XFS switch to extents only for large
  files.)
- If `block_cache` evicts an LRU entry before `sync` runs, can disk
  data corrupt? (Hint: no — eviction flushes dirty blocks first. But
  power-loss ordering is not guaranteed, which is why real FSes use
  journaling or COW for crash consistency.)
- easy-fs has no directory-entry hashing, so `find` is O(n). What
  happens at 100 k files in one directory? (Hint: every lookup walks
  all blocks; ext4 htree and btrfs B-trees exist precisely for this.)
